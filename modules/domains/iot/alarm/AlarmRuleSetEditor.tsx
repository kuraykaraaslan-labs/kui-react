'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faPen, faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Popconfirm } from '@/modules/ui/Popconfirm';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { Toggle } from '@/modules/ui/Toggle';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import {
  DEVICE_OFFLINE_RULE_TYPE, describeCondition, isInactivityRule, newInactivityRule, newThresholdRule, type AlarmRuleDefinition,
} from '../types/alarm-rule';
import { AlarmRuleDrawer } from './AlarmRuleDrawer';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';

/**
 * AlarmRuleSetEditor — the alarm rules of one device profile (phase 01 §1.4, NB iot_alarm 01 §1.1, the profile's "Alarm rules" tab
 * contributed by the alarm module, P-3). Rule cards (kind, type, title, the comparison per severity, debounce, enabled), add a threshold
 * rule or the device-offline rule, edit one in a drawer (form or JSON), remove one. Changes collect in the page and "Save rules"
 * replaces the profile's whole set (a removed rule's open alarms are resolved by the host). Read-only without `canManageAlarmRules`.
 */
export type AlarmRuleSetEditorProps = {
  profileId: string;
  className?: string;
};

export function AlarmRuleSetEditor({ profileId, className }: AlarmRuleSetEditorProps) {
  const api = useIotAdapter().alarmRules;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [base, setBase] = useState<AlarmRuleDefinition[] | null>(null);
  const [rules, setRules] = useState<AlarmRuleDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ index: number; rule: AlarmRuleDefinition } | null>(null);

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
    return () => ctrl.abort();
  }, [load]);

  const canEdit = caps.canManageAlarmRules;
  const dirty = base !== null && JSON.stringify(base) !== JSON.stringify(rules);
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
      setSaveError(errorMessage(e, m.alarmRules.loadError));
    } finally {
      setSaving(false);
    }
  }

  function add(kind: 'threshold' | 'offline') {
    let rule: AlarmRuleDefinition = kind === 'offline' ? newInactivityRule() : newThresholdRule();
    if (kind === 'threshold') {
      let n = 1;
      while (rules.some((r) => r.type === rule.type)) rule = newThresholdRule(`high_value_${++n}`);
    }
    setEditing({ index: -1, rule });
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
  if (base === null) return <SkeletonText lines={4} className={className} />;

  const words = { and: m.alarmRules.and, or: m.alarmRules.or, attribute: m.alarmRules.attribute, topic: m.alarmRules.onTopic };
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
        <ul className="space-y-3" aria-label={m.alarmRules.title}>
          {rules.map((r, i) => (
            <li key={`${r.type}-${i}`} className={cn('rounded-xl border border-border bg-surface-raised p-4', !r.enabled && 'opacity-70')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                    <Badge variant="neutral" size="sm">{isInactivityRule(r) ? m.alarmRules.offlineKind : m.alarmRules.thresholdKind}</Badge>
                    <code className="font-mono text-xs text-text-secondary">{r.type}</code>
                    {!r.enabled && <Badge variant="warning" size="sm">{m.alarmRules.disabledRule}</Badge>}
                  </p>
                  <p className="mt-1 truncate text-sm text-text-primary">{r.title}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Toggle id={`rule-enabled-${i}`} size="sm" label={m.alarmRules.enabled} checked={r.enabled}
                      onChange={(v) => setRules(rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
                    <Button variant="ghost" size="xs" aria-label={`${m.alarmRules.edit} ${r.type}`} onClick={() => setEditing({ index: i, rule: r })}
                      iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>{m.alarmRules.edit}</Button>
                    <Popconfirm
                      trigger={<Button variant="ghost" size="xs" aria-label={`${m.alarmRules.remove} ${r.type}`} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}><span className="sr-only">{m.alarmRules.remove}</span></Button>}
                      title={fill(m.alarmRules.removeConfirm, { type: r.type })}
                      description={m.alarmRules.removeHint}
                      confirmLabel={m.alarmRules.remove}
                      cancelLabel={m.common.cancel}
                      danger
                      placement="bottom"
                      onConfirm={() => setRules(rules.filter((_, j) => j !== i))}
                    />
                  </div>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-text-secondary">
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
            </li>
          ))}
        </ul>
      )}

      {dirty && canEdit && (
        <div role="region" aria-label={m.alarmRules.unsaved}
          className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface-base p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-text-primary">{m.alarmRules.unsaved}</p>
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
