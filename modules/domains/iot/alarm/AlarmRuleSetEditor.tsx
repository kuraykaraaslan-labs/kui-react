'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faPen, faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { EmptyState } from '@/modules/ui/EmptyState';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { Toggle } from '@/modules/ui/Toggle';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import {
  DEVICE_OFFLINE_RULE_TYPE, describeCondition, isInactivityRule, newInactivityRule, newThresholdRule, renameAlarmRuleKeys, undeclaredRuleKeys, type AlarmRuleDefinition,
} from '../types/alarm-rule';
import { onProfileKeyRenames } from '../profile/profile-key-events';
import { AlarmRuleDrawer } from './AlarmRuleDrawer';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';

/**
 * AlarmRuleSetEditor — the alarm rules of one device profile (phase 01 §1.4, NB iot_alarm 01 §1.1, the profile's "Alarm rules" tab
 * contributed by the alarm module, P-3). A DataTable of the rules (kind, type, title, the comparison per severity, debounce, enabled), add a threshold
 * rule or the device-offline rule, edit one in a drawer (form or JSON), remove one. Changes collect in the page and "Save rules"
 * replaces the profile's whole set (a removed rule's open alarms are resolved by the host). Read-only without `canManageAlarmRules`.
 *
 * The profile's telemetry keys (read through `profiles.get` when the host offers it, again when a drawer opens, so keys renamed on the
 * Telemetry keys tab count) are offered in the drawer, and a rule reading a key the profile does not declare is marked "Unknown key".
 * While changes are unsaved the bar says how many rules changed and leaving or reloading the page asks first. When the profile editor
 * renames keys and the host rewrites the rules (`onProfileKeyRenames`), the rules held here, unsaved edits included, take the new keys, so
 * a later save never puts the old keys back. A refusal of one rule names that rule.
 */
/** How many rules differ between the saved set and the edited one (added, removed or changed, by type). */
export function changedRuleCount(base: readonly AlarmRuleDefinition[], rules: readonly AlarmRuleDefinition[]): number {
  const before = new Map(base.map((r) => [r.type, JSON.stringify(r)]));
  const after = new Map(rules.map((r) => [r.type, JSON.stringify(r)]));
  let n = 0;
  for (const [type, json] of after) if (before.get(type) !== json) n++;
  for (const type of before.keys()) if (!after.has(type)) n++;
  return n;
}

/** A row of the rules table: the rule and its position in the set (edits and removals go by position). */
type RuleRow = { i: number; r: AlarmRuleDefinition };

export type AlarmRuleSetEditorProps = {
  profileId: string;
  className?: string;
};

export function AlarmRuleSetEditor({ profileId, className }: AlarmRuleSetEditorProps) {
  const adapter = useIotAdapter();
  const api = adapter.alarmRules;
  const profiles = adapter.profiles;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [base, setBase] = useState<AlarmRuleDefinition[] | null>(null);
  const [rules, setRules] = useState<AlarmRuleDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ index: number; rule: AlarmRuleDefinition } | null>(null);
  const [telemetryKeys, setTelemetryKeys] = useState<string[]>([]);

  const readKeys = useCallback((signal?: AbortSignal) => {
    if (!profiles?.get) return;
    profiles.get(profileId, signal).then(
      (p) => { if (!signal?.aborted) setTelemetryKeys((p.telemetrySchema ?? []).map((k) => k.key).filter(Boolean)); },
      () => undefined, // the keys only feed suggestions and warnings: the rules work without them
    );
  }, [profiles, profileId]);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list(profileId, signal).then(
      (records) => {
        if (signal?.aborted) return;
        const defs = records.map((r) => r.definition);
        setBase(defs);
        setRules(defs);
        setError(null);
      },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.alarmRules.loadError)); },
    );
  }, [api, profileId, m.alarmRules.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    readKeys(ctrl.signal);
    return () => ctrl.abort();
  }, [load, readKeys]);

  // the host rewrote the rules onto renamed keys: the saved set and the edits take the same names (a save would revert them otherwise)
  useEffect(() => onProfileKeyRenames(profileId, (renames) => {
    setBase((cur) => (cur ? cur.map((r) => renameAlarmRuleKeys(r, renames)) : cur));
    setRules((cur) => cur.map((r) => renameAlarmRuleKeys(r, renames)));
    setEditing((cur) => (cur ? { ...cur, rule: renameAlarmRuleKeys(cur.rule, renames) } : cur));
    readKeys();
  }), [profileId, readKeys]);

  const canEdit = caps.canManageAlarmRules;
  const dirty = base !== null && JSON.stringify(base) !== JSON.stringify(rules);

  // unsaved rules are lost on a reload or a closed tab: the browser asks first while there are any
  useEffect(() => {
    if (!dirty || !canEdit) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, canEdit]);

  function edit(next: { index: number; rule: AlarmRuleDefinition }) {
    readKeys();
    setEditing(next);
  }
  const hasOffline = rules.some((r) => r.type === DEVICE_OFFLINE_RULE_TYPE);

  async function save() {
    if (!api) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await api.replace(profileId, rules);
      const defs = saved.map((r) => r.definition);
      setBase(defs);
      setRules(defs);
      notify({ tone: 'success', message: m.alarmRules.saved });
    } catch (e) {
      setSaveError(refusalText(e));
    } finally {
      setSaving(false);
    }
  }

  /** The host's refusal; one about a rule (`rules.2.severities.0.condition.key: …`) names the rule instead of its position. */
  function refusalText(e: unknown): string {
    const detail = e instanceof IotApiError ? e.fieldErrors?.rules : undefined;
    const at = detail ? /^(\d+)(?:\.([\s\S]*))?$/.exec(detail) : null;
    const rule = at ? rules[Number(at[1])] : undefined;
    if (detail && rule) return fill(m.alarmRules.ruleRefused, { type: rule.type, detail: at?.[2] ?? detail });
    return errorMessage(e, m.alarmRules.loadError);
  }

  function add(kind: 'threshold' | 'offline') {
    let rule: AlarmRuleDefinition = kind === 'offline' ? newInactivityRule() : newThresholdRule();
    if (kind === 'threshold') {
      let n = 1;
      while (rules.some((r) => r.type === rule.type)) rule = newThresholdRule(`high_value_${++n}`);
    }
    edit({ index: -1, rule });
  }

  if (!api) return null;
  if (error && base === null) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (base === null) return <SkeletonText lines={4} label={m.common.loading} className={className} />;

  const words = { and: m.alarmRules.and, or: m.alarmRules.or, attribute: m.alarmRules.attribute, topic: m.alarmRules.onTopic };
  const columns: Column<RuleRow>[] = [
    {
      key: 'type',
      header: m.alarmRules.type,
      sortable: true,
      sortValue: ({ r }) => r.type,
      searchValue: ({ r }) => r.type,
      render: ({ r }) => {
        const unknown = undeclaredRuleKeys(r, telemetryKeys);
        return (
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
            <Badge variant="neutral" size="sm">{isInactivityRule(r) ? m.alarmRules.offlineKind : m.alarmRules.thresholdKind}</Badge>
            <code className="font-mono text-xs text-text-secondary">{r.type}</code>
            {!r.enabled && <Badge variant="warning" size="sm">{m.alarmRules.disabledRule}</Badge>}
            {unknown.length > 0 && (
              <span title={fill(m.alarmRules.undeclaredTitle, { keys: unknown.join(', ') })}>
                <Badge variant="warning" size="sm">{m.alarmRules.undeclared}</Badge>
                <span className="sr-only">{fill(m.alarmRules.undeclaredTitle, { keys: unknown.join(', ') })}</span>
              </span>
            )}
          </span>
        );
      },
    },
    { key: 'title', header: m.alarmRules.titleField, sortable: true, sortValue: ({ r }) => r.title ?? null, searchValue: ({ r }) => r.title ?? '', render: ({ r }) => <span className="text-sm text-text-primary">{r.title}</span> },
    {
      key: 'when',
      header: m.alarmRules.when,
      searchValue: ({ r }) => (isInactivityRule(r) ? '' : r.severities.map((s) => describeCondition(s.condition, words)).join(' ')),
      render: ({ r }) => (
        <ul className="space-y-1 text-xs text-text-secondary">
          {isInactivityRule(r) ? (
            <li className="flex items-center gap-2">
              <AlarmSeverityBadge severity={r.inactivity.severity} size="sm" />
              <span>{`${m.alarmRules.afterSec}: ${r.inactivity.afterSec}`}</span>
            </li>
          ) : (
            <>
              {r.severities.map((s) => (
                <li key={s.severity} className="flex items-center gap-2">
                  <AlarmSeverityBadge severity={s.severity} size="sm" />
                  <code className="font-mono">{describeCondition(s.condition, words)}</code>
                </li>
              ))}
              {r.debounce && (r.debounce.raise > 1 || r.debounce.clear > 1) && (
                <li>{`${m.alarmRules.debounce}: ${r.debounce.raise} / ${r.debounce.clear} (${r.debounce.mode === 'count' ? m.alarmRules.debounceCount : m.alarmRules.debounceDuration})`}</li>
              )}
            </>
          )}
        </ul>
      ),
    },
    ...(canEdit ? [{
      key: 'actions',
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      searchable: false,
      render: ({ i, r }: RuleRow) => (
        <span className="inline-flex items-center justify-end gap-1">
          <Toggle id={`rule-enabled-${i}`} size="sm" label={m.alarmRules.enabled} checked={r.enabled}
            onChange={(v) => setRules(rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
          <Button variant="ghost" size="xs" aria-label={`${m.alarmRules.edit} ${r.type}`} onClick={() => edit({ index: i, rule: r })}
            iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>{m.alarmRules.edit}</Button>
          <Button onClick={() => { void confirmDialog({ title: fill(m.alarmRules.removeConfirm, { type: r.type }), message: m.alarmRules.removeHint, tone: 'danger', confirmLabel: m.alarmRules.remove, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void setRules(rules.filter((_, j) => j !== i)); }); }} variant="ghost" size="xs" aria-label={`${m.alarmRules.remove} ${r.type}`} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}><span className="sr-only">{m.alarmRules.remove}</span></Button>
        </span>
      ),
    }] : []),
  ];
  const filterFields: DataTableFilterField<RuleRow>[] = [
    {
      id: 'kind', label: m.alarmRules.type, type: 'select',
      options: [{ value: 'threshold', label: m.alarmRules.thresholdKind }, { value: 'offline', label: m.alarmRules.offlineKind }],
      match: ({ r }, v) => !v || (v === 'offline') === isInactivityRule(r),
    },
    {
      id: 'enabled', label: m.alarmRules.enabled, type: 'select',
      options: [{ value: 'true', label: m.alarmRules.enabled }, { value: 'false', label: m.alarmRules.disabledRule }],
      match: ({ r }, v) => !v || String(r.enabled) === v,
    },
  ];
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{m.alarmRules.title}</h2>
          <p className="text-xs text-text-secondary">{m.alarmRules.subtitle}</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => add('threshold')} iconLeft={<FontAwesomeIcon icon={faBolt} className="h-3 w-3" aria-hidden="true" />}>
              {m.alarmRules.addThreshold}
            </Button>
            <Button variant="outline" size="sm" disabled={hasOffline} onClick={() => add('offline')} iconLeft={<FontAwesomeIcon icon={faPlug} className="h-3 w-3" aria-hidden="true" />}>
              {m.alarmRules.addOffline}
            </Button>
          </div>
        )}
      </div>

      {!canEdit && <Callout variant="info" title={null}>{m.alarmRules.readOnly}</Callout>}

      {rules.length === 0 ? (
        <EmptyState icon={<FontAwesomeIcon icon={faBolt} aria-hidden="true" />} title={m.alarmRules.title} description={m.alarmRules.empty} />
      ) : (
        <DataTable<RuleRow>
          mode="paginated"
          variant="plain"
          caption={m.alarmRules.title}
          columns={columns}
          rows={rules.map((r, i) => ({ i, r }))}
          rowId={(x) => `${x.r.type}-${x.i}`}
          rowClassName={(x) => (x.r.enabled ? undefined : 'opacity-70')}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
          searchPlaceholder={m.alarmRules.search}
          filterFields={filterFields}
          pageSize={25}
          pageSizeOptions={LIST_PAGE_SIZES}
        />
      )}

      {dirty && canEdit && (
        <div role="region" aria-label={m.alarmRules.unsaved}
          className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface-base p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-text-primary">{m.alarmRules.unsaved}</p>
            <p className="text-xs text-text-secondary">{fill(m.alarmRules.unsavedCount, { n: changedRuleCount(base, rules) })}</p>
            {saveError && <p role="alert" className="text-xs text-error">{saveError}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setRules(base); setSaveError(null); }}>{m.alarmRules.discard}</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>{m.alarmRules.save}</Button>
          </div>
        </div>
      )}

      {editing && (
        <AlarmRuleDrawer
          open
          rule={editing.rule}
          isNew={editing.index < 0}
          telemetryKeys={telemetryKeys}
          others={rules.filter((_, j) => j !== editing.index)}
          onClose={() => setEditing(null)}
          onApply={(rule) => {
            setRules(editing.index < 0 ? [...rules, rule] : rules.map((x, j) => (j === editing.index ? rule : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
