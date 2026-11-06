'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { errorMessage, IotApiError, type AlarmRuleSaveResult } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, plural } from '../format';
import {
  DEVICE_OFFLINE_RULE_TYPE, describeCondition, isInactivityRule, newInactivityRule, newThresholdRule, renameAlarmRuleKeys, undeclaredRuleKeys, type AlarmRuleDefinition,
  type AlarmRuleRecord,
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
 * While changes are unsaved the bar says how many rules changed; reloading or closing the page asks the browser first, and a link to
 * another page of the app asks here first (`useLeaveGuard`, N5: a capture listener, so the host's router never sees the click; after
 * "Leave" the click goes on, through any guard of the host's own). When the profile editor renames keys and the host rewrites the rules
 * (`onProfileKeyRenames`), the rules held here, unsaved edits included, take the new keys, so a later save never puts the old keys back;
 * the rules are read again and a rule's new version is taken only when the host's rule is exactly the old one renamed (anything else
 * moved meanwhile: the set is `stale`). A refusal of one rule names that rule.
 *
 * A save sends the rules it was read as (`expectedSet`: their ids and versions): a host that finds the set moved meanwhile refuses it
 * (`stale`), and the edits stay here with a reload the viewer chooses (NB 41-ui-fixes/24 1.1); Discard then reloads too, so the stale
 * state never hides behind the old rules. A saved rule keeps its type (a new type would delete it and resolve its alarms, 1.5); the bar
 * names the rules a save removes or switches off and says their open alarms are resolved (1.4); open alarms a save left to the host's
 * later clean-up (`resolvePending`) are counted in a notice. Until the viewer's capabilities are read the view says nothing about
 * editing; a failed read says so, with a retry (1.12).
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

/** The types a save removes and the stored rules it switches off (enabled when read, off now). */
export function pendingRuleChanges(base: readonly AlarmRuleDefinition[], rules: readonly AlarmRuleDefinition[]): { removed: string[]; disabled: string[] } {
  const now = new Map(rules.map((r) => [r.type, r]));
  return {
    removed: base.filter((b) => !now.has(b.type)).map((b) => b.type),
    disabled: base.filter((b) => b.enabled && now.get(b.type)?.enabled === false).map((b) => b.type),
  };
}

/**
 * The rule a refusal names, from the host's field errors: NB answers each refused field by its full path (`rules.2.severities.0.condition.value`)
 * with its text, another host one `rules` entry starting with the position (`2.severities…: text`). Null when no rule is named.
 */
export function refusedRule(e: unknown, rules: readonly AlarmRuleDefinition[]): { type: string; detail: string } | null {
  const fields = e instanceof IotApiError ? e.fieldErrors : undefined;
  if (!fields) return null;
  for (const [path, text] of Object.entries(fields)) {
    const at = /^rules\.(\d+)\./.exec(path);
    const rule = at ? rules[Number(at[1])] : undefined;
    if (rule) return { type: rule.type, detail: text };
  }
  const at = fields.rules ? /^(\d+)(?:\.([\s\S]*))?$/.exec(fields.rules) : null;
  const rule = at ? rules[Number(at[1])] : undefined;
  return rule ? { type: rule.type, detail: at?.[2] ?? fields.rules } : null;
}

/** A save's answer as one shape: a host that answers only the stored rules left nothing pending. */
export function ruleSaveResult(res: AlarmRuleRecord[] | AlarmRuleSaveResult): { rules: AlarmRuleRecord[]; resolvePending: number } {
  if (Array.isArray(res)) return { rules: res, resolvePending: 0 };
  return { rules: res.rules, resolvePending: Math.max(0, res.resolvePending ?? 0) };
}

/**
 * The rules re-read after the host renamed keys in them: `listed` when every rule read before is there under its id with exactly its
 * definition renamed (only the versions moved), else null (a rule added, changed or removed meanwhile: the set is stale).
 */
export function adoptRenamed(before: readonly AlarmRuleRecord[], listed: readonly AlarmRuleRecord[], renames: Record<string, string>): AlarmRuleRecord[] | null {
  if (listed.length !== before.length) return null;
  const was = new Map(before.map((r) => [r.ruleId, r]));
  for (const r of listed) {
    const prev = r.ruleId ? was.get(r.ruleId) : undefined;
    if (!prev || JSON.stringify(r.definition) !== JSON.stringify(renameAlarmRuleKeys(prev.definition, renames))) return null;
  }
  return [...listed];
}

/**
 * While `active`, a plain click on a link to another page of the app asks first (`confirm` answers true to leave). A capture listener on
 * the document runs before the host's router; a click another guard already stopped is left alone. After "Leave" the same link is
 * clicked again past this guard (a host guard of its own still has its say); a link gone from the page meanwhile is followed by the
 * browser. Links in the same page (another `?tab=`) and new tabs are never asked about. Answers whether the viewer chose to leave.
 */
export function useLeaveGuard(active: boolean, confirm: () => Promise<boolean>): () => boolean {
  const activeRef = useRef(active);
  const confirmRef = useRef(confirm);
  const leavingRef = useRef(false);
  useEffect(() => { activeRef.current = active; confirmRef.current = confirm; });
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let replaying: Element | null = null;
    const onClick = (e: MouseEvent) => {
      if (!activeRef.current || leavingRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor === replaying || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const to = new URL(anchor.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmRef.current().then((ok) => {
        if (!ok) return;
        if (anchor.isConnected) {
          replaying = anchor;
          try { anchor.click(); } finally { replaying = null; }
        } else {
          leavingRef.current = true;
          window.location.assign(to.href);
        }
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  // whether "Leave" sent the browser away (a reload prompt then would ask twice); stable, so it can sit in an effect's dependencies
  return useCallback(() => leavingRef.current, []);
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
  const { m, locale } = useIotText();
  const [base, setBase] = useState<AlarmRuleDefinition[] | null>(null);
  /** The rules as read (ids and versions): what a save says it started from. */
  const [records, setRecords] = useState<AlarmRuleRecord[]>([]);
  /** The host refused a save because the set moved: the edits stay until the viewer reloads. */
  const [stale, setStale] = useState(false);
  const [rules, setRules] = useState<AlarmRuleDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Open alarms of removed or switched-off rules the last save left to the host's later clean-up. */
  const [resolvePending, setResolvePending] = useState(0);
  const [editing, setEditing] = useState<{ index: number; rule: AlarmRuleDefinition } | null>(null);
  const [telemetryKeys, setTelemetryKeys] = useState<string[]>([]);

  const readKeys = useCallback((signal?: AbortSignal) => {
    if (!profiles?.get) return;
    profiles.get(profileId, signal).then(
      (p) => { if (!signal?.aborted) setTelemetryKeys((p.telemetrySchema ?? []).map((k) => k.key).filter(Boolean)); },
      () => undefined, // the keys only feed suggestions and warnings: the rules work without them
    );
  }, [profiles, profileId]);

  /** The rules as read, for the rename handler (it runs outside a render). */
  const recordsRef = useRef<AlarmRuleRecord[]>([]);
  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list(profileId, signal).then(
      (records) => {
        if (signal?.aborted) return;
        const defs = records.map((r) => r.definition);
        setRecords(records);
        recordsRef.current = records;
        setBase(defs);
        setRules(defs);
        setError(null);
        setStale(false);
        setSaveError(null);
        setResolvePending(0);
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

  const staleText = m.alarmRules.stale;
  // the host rewrote the rules onto renamed keys: the saved set and the edits take the same names (a save would revert them otherwise)
  useEffect(() => onProfileKeyRenames(profileId, (renames) => {
    setBase((cur) => (cur ? cur.map((r) => renameAlarmRuleKeys(r, renames)) : cur));
    setRules((cur) => cur.map((r) => renameAlarmRuleKeys(r, renames)));
    setEditing((cur) => (cur ? { ...cur, rule: renameAlarmRuleKeys(cur.rule, renames) } : cur));
    readKeys();
    // the host's rewrite gave the rules new versions: a later save names those, so it is not refused as stale for the rename alone;
    // only for rules that are exactly the ones read, renamed: a rule someone added, changed or removed meanwhile makes the set stale
    const before = recordsRef.current;
    api?.list(profileId).then((listed) => {
      if (recordsRef.current !== before) return; // read again meanwhile: that read is the truth
      const adopted = adoptRenamed(before, listed, renames);
      if (adopted) {
        setRecords(adopted);
        recordsRef.current = adopted;
      } else {
        setStale(true);
        setSaveError(staleText);
      }
    }, () => undefined);
  }), [api, profileId, readKeys, staleText]);

  const canEdit = caps.canManageAlarmRules;
  const capsFailed = caps.ready && caps.failed;
  const dirty = base !== null && JSON.stringify(base) !== JSON.stringify(rules);

  // unsaved rules are lost on a link to another page, a reload or a closed tab: a link asks here first (N5), the browser asks for the rest
  const leaving = useLeaveGuard(dirty && !!canEdit, () => confirmDialog({
    title: m.alarmRules.leaveTitle, message: m.alarmRules.leaveBody, tone: 'warning', confirmLabel: m.alarmRules.leave, cancelLabel: m.alarmRules.stay,
  }).then((ok) => !!ok));
  useEffect(() => {
    if (!dirty || !canEdit) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (leaving()) return; e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, canEdit, leaving]);

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
      const { rules: saved, resolvePending: left } = ruleSaveResult(
        await api.replace(profileId, rules, { expectedSet: records.map((r) => ({ ruleId: r.ruleId, version: r.version })) }),
      );
      const defs = saved.map((r) => r.definition);
      setRecords(saved);
      recordsRef.current = saved;
      setBase(defs);
      setRules(defs);
      setResolvePending(left);
      notify({ tone: 'success', message: m.alarmRules.saved });
    } catch (e) {
      // someone saved the set meanwhile: nothing was written; the edits stay until the viewer reloads
      if (e instanceof IotApiError && e.code === 'stale') { setStale(true); setSaveError(m.alarmRules.stale); return; }
      setSaveError(refusalText(e));
    } finally {
      setSaving(false);
    }
  }

  /** The host's refusal; one about a rule names the rule instead of its position. An unanswered save says the save failed. */
  function refusalText(e: unknown): string {
    const named = refusedRule(e, rules);
    if (named) return fill(m.alarmRules.ruleRefused, named);
    return errorMessage(e, m.alarmRules.saveFailed);
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
  const pending = pendingRuleChanges(base, rules);
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
          <span title={r.enabled ? m.alarmRules.disableHint : undefined}>
            <Toggle id={`rule-enabled-${i}`} size="sm" label={m.alarmRules.enabled} checked={r.enabled}
              onChange={(v) => setRules(rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
          </span>
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

      {capsFailed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.common.capabilitiesError}
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      {caps.ready && !capsFailed && !canEdit && <Callout variant="info" title={null}>{m.alarmRules.readOnly}</Callout>}
      {resolvePending > 0 && (
        <Callout variant="info" title={null}>
          <span role="status">{plural(resolvePending, { one: m.alarmRules.resolvePending_one, other: m.alarmRules.resolvePending }, locale)}</span>
        </Callout>
      )}

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
            <p className="text-xs text-text-secondary">{plural(changedRuleCount(base, rules), { one: m.alarmRules.unsavedCount_one, other: m.alarmRules.unsavedCount }, locale)}</p>
            {pending.removed.length > 0 && <p className="text-xs text-text-secondary">{fill(m.alarmRules.removedPending, { types: pending.removed.join(', ') })}</p>}
            {pending.disabled.length > 0 && <p className="text-xs text-text-secondary">{fill(m.alarmRules.disabledPending, { types: pending.disabled.join(', ') })}</p>}
            {saveError && <p role="alert" className="text-xs text-error">{saveError}</p>}
          </div>
          <div className="flex gap-2">
            {stale && <Button variant="outline" size="sm" disabled={saving} onClick={() => void load()}>{m.alarmRules.staleReload}</Button>}
            {/* after a stale refusal the rules read are old: discarding reloads them, so the stale state never hides behind them */}
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { if (stale) void load(); else { setRules(base); setSaveError(null); } }}>{m.alarmRules.discard}</Button>
            <Button variant="primary" size="sm" loading={saving} disabled={stale} onClick={() => void save()}>{m.alarmRules.save}</Button>
          </div>
        </div>
      )}

      {editing && (
        <AlarmRuleDrawer
          open
          rule={editing.rule}
          isNew={editing.index < 0}
          typeLocked={editing.index >= 0 && base.some((b) => b.type === editing.rule.type)}
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
