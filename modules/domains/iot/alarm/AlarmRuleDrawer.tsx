'use client';
import { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { Toggle } from '@/modules/ui/Toggle';
import { useIotText } from '../api/IotAdapterProvider';
import { ALARM_SEVERITIES, type AlarmSeverity } from '../types/alarm';
import {
  ALARM_RULE_OPS, alarmRuleIssues, isInactivityRule, isLeafCondition,
  type AlarmRuleDefinition, type AlarmRuleLeaf, type AlarmRuleOp, type InactivityAlarmRule, type ThresholdAlarmRule,
} from '../types/alarm-rule';

/**
 * AlarmRuleDrawer — edits one alarm rule of a profile (phase 01 §1.4 "Alarm rules", NB iot_alarm 01 §1.1) as a form or as JSON. The
 * form covers the common shape: type, title, enabled; for a threshold rule one comparison per severity (key, operator, value, optional
 * topic, OD-25), debounce, hysteresis and runbook; for the `device_offline` rule the delay and severity. Settings the form does not
 * draw (notifications, dampening, a clear condition) are kept as they are; a rule with combined conditions opens as JSON. "Apply"
 * returns the rule to the set; nothing is sent until the set is saved.
 */
export type AlarmRuleDrawerProps = {
  open: boolean;
  rule: AlarmRuleDefinition;
  /** The other rules of the set (their types must stay unique). */
  others: readonly AlarmRuleDefinition[];
  onApply: (rule: AlarmRuleDefinition) => void;
  onClose: () => void;
};

/** `80` → 80, `true` → true, `attribute:limit` → `{ attribute: 'limit' }`, anything else stays text. */
export function parseRuleValue(raw: string): AlarmRuleLeaf['value'] {
  const s = raw.trim();
  if (s.startsWith('attribute:') && s.length > 'attribute:'.length) return { attribute: s.slice('attribute:'.length).trim() };
  if (s === 'true' || s === 'false') return s === 'true';
  if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  return raw;
}
export function formatRuleValue(v: AlarmRuleLeaf['value']): string {
  return typeof v === 'object' && v !== null ? `attribute:${v.attribute}` : String(v);
}

/** True when every severity's condition is one comparison (the form can draw it). */
export function isFormable(r: AlarmRuleDefinition): boolean {
  return isInactivityRule(r) || r.severities.every((s) => isLeafCondition(s.condition));
}

export function AlarmRuleDrawer({ open, rule, others, onApply, onClose }: AlarmRuleDrawerProps) {
  const { m } = useIotText();
  const id = useId();
  const [draft, setDraft] = useState<AlarmRuleDefinition>(() => structuredClone(rule));
  const [mode, setMode] = useState<'form' | 'json'>(() => (isFormable(rule) ? 'form' : 'json'));
  const [json, setJson] = useState(() => JSON.stringify(rule, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const issues = alarmRuleIssues(draft, others);
  const issueText = issues.map((i) => m.alarmRules[`issue_${i}`]);

  function toJson() {
    setJson(JSON.stringify(draft, null, 2));
    setJsonError(null);
    setMode('json');
  }
  function fromJson(): AlarmRuleDefinition | null {
    try {
      const parsed = JSON.parse(json) as AlarmRuleDefinition;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string' || typeof parsed.title !== 'string') throw new Error('shape');
      setJsonError(null);
      return parsed;
    } catch {
      setJsonError(m.alarmRules.jsonInvalid);
      return null;
    }
  }
  function toForm() {
    const parsed = fromJson();
    if (!parsed) return;
    setDraft(parsed);
    if (isFormable(parsed)) setMode('form');
  }
  function apply() {
    const next = mode === 'json' ? fromJson() : draft;
    if (!next) return;
    if (alarmRuleIssues(next, others).length) { setDraft(next); return; }
    onApply(next);
  }

  const threshold = !isInactivityRule(draft) ? (draft as ThresholdAlarmRule) : null;
  const inactivity = isInactivityRule(draft) ? draft : null;
  const setT = (patch: Partial<ThresholdAlarmRule>) => setDraft({ ...(draft as ThresholdAlarmRule), ...patch });
  const setI = (patch: Partial<InactivityAlarmRule>) => setDraft({ ...(draft as InactivityAlarmRule), ...patch });
  const setLeaf = (i: number, patch: Partial<AlarmRuleLeaf>) => threshold && setT({
    severities: threshold.severities.map((s, j) => (j === i ? { ...s, condition: { ...(s.condition as AlarmRuleLeaf), ...patch } } : s)),
  });
  const severityOptions = ALARM_SEVERITIES.map((s) => ({ value: s, label: m.severity[s] }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.alarmRules.editTitle}
      closeLabel={m.common.close}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label={`${m.alarmRules.form} / ${m.alarmRules.json}`}>
            <Button variant={mode === 'form' ? 'secondary' : 'ghost'} size="sm" aria-pressed={mode === 'form'} onClick={() => (mode === 'json' ? toForm() : undefined)}>{m.alarmRules.form}</Button>
            <Button variant={mode === 'json' ? 'secondary' : 'ghost'} size="sm" aria-pressed={mode === 'json'} onClick={() => (mode === 'form' ? toJson() : undefined)}>{m.alarmRules.json}</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
            <Button variant="primary" size="sm" onClick={apply}>{m.alarmRules.apply}</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        {issueText.length > 0 && (
          <ul role="alert" className="list-inside list-disc text-sm text-error">{issueText.map((t) => <li key={t}>{t}</li>)}</ul>
        )}
        {mode === 'json' ? (
          <>
            {!isFormable(draft) && <Callout variant="info" title={null}>{m.alarmRules.compound}</Callout>}
            <Textarea id={`${id}-json`} label={m.alarmRules.json} rows={18} value={json} error={jsonError ?? undefined}
              className="font-mono" onChange={(e) => setJson(e.target.value)} />
          </>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); apply(); }}>
            <Input id={`${id}-type`} label={m.alarmRules.type} hint={m.alarmRules.typeHint} required maxLength={128} value={draft.type}
              disabled={!!inactivity} className="font-mono" onChange={(e) => setDraft({ ...draft, type: e.target.value } as AlarmRuleDefinition)} />
            <Input id={`${id}-title`} label={m.alarmRules.titleField} required maxLength={300} value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <Toggle id={`${id}-enabled`} label={m.alarmRules.enabled} checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />

            {inactivity && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id={`${id}-after`} type="number" label={m.alarmRules.afterSec} min={10} max={7 * 86_400} step={1} value={inactivity.inactivity.afterSec}
                  onChange={(e) => setI({ inactivity: { ...inactivity.inactivity, afterSec: Number(e.target.value) } })} />
                <Select id={`${id}-offline-severity`} label={m.alarmRules.severity} value={inactivity.inactivity.severity} options={severityOptions}
                  onChange={(e) => setI({ inactivity: { ...inactivity.inactivity, severity: e.target.value as AlarmSeverity } })} />
              </div>
            )}

            {threshold && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-text-primary">{m.alarmRules.when}</legend>
                {threshold.severities.map((s, i) => {
                  const leaf = s.condition as AlarmRuleLeaf;
                  return (
                    <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-[8rem_minmax(0,1fr)_5rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <Select id={`${id}-sev-${i}`} label={m.alarmRules.severity} value={s.severity} options={severityOptions}
                        onChange={(e) => setT({ severities: threshold.severities.map((x, j) => (j === i ? { ...x, severity: e.target.value as AlarmSeverity } : x)) })} />
                      <Input id={`${id}-key-${i}`} label={m.alarmRules.key} value={leaf.key} className="font-mono" onChange={(e) => setLeaf(i, { key: e.target.value })} />
                      <Select id={`${id}-op-${i}`} label={m.alarmRules.op} value={leaf.op} options={ALARM_RULE_OPS.map((o) => ({ value: o, label: o }))}
                        onChange={(e) => setLeaf(i, { op: e.target.value as AlarmRuleOp })} />
                      <Input id={`${id}-value-${i}`} label={m.alarmRules.value} value={formatRuleValue(leaf.value)} onChange={(e) => setLeaf(i, { value: parseRuleValue(e.target.value) })} />
                      <Input id={`${id}-topic-${i}`} label={m.alarmRules.topic} placeholder={m.alarmRules.topicHint} value={leaf.topic ?? ''}
                        onChange={(e) => setLeaf(i, { topic: e.target.value || undefined })} />
                      <Button variant="ghost" size="sm" aria-label={`${m.alarmRules.removeSeverity} (${m.severity[s.severity]})`} disabled={threshold.severities.length < 2}
                        onClick={() => setT({ severities: threshold.severities.filter((_, j) => j !== i) })}>
                        <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
                {threshold.severities.length < ALARM_SEVERITIES.length && (
                  <Button variant="outline" size="sm" iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}
                    onClick={() => {
                      const free = ALARM_SEVERITIES.find((x) => !threshold.severities.some((s) => s.severity === x)) ?? 'INFO';
                      const first = threshold.severities[0]?.condition as AlarmRuleLeaf | undefined;
                      setT({ severities: [...threshold.severities, { severity: free, condition: { key: first?.key ?? '', op: first?.op ?? '>', value: first?.value ?? 0 } }] });
                    }}>
                    {m.alarmRules.addSeverity}
                  </Button>
                )}
              </fieldset>
            )}

            {threshold && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Select id={`${id}-debounce-mode`} label={m.alarmRules.debounce} value={threshold.debounce?.mode ?? 'count'}
                  options={[{ value: 'count', label: m.alarmRules.debounceCount }, { value: 'duration', label: m.alarmRules.debounceDuration }]}
                  onChange={(e) => setT({ debounce: { raise: 1, clear: 1, ...threshold.debounce, mode: e.target.value as 'count' | 'duration' } })} />
                <Input id={`${id}-raise`} type="number" label={m.alarmRules.raise} min={1} max={86_400} step={1} value={threshold.debounce?.raise ?? 1}
                  onChange={(e) => setT({ debounce: { mode: 'count', clear: 1, ...threshold.debounce, raise: Number(e.target.value) } })} />
                <Input id={`${id}-clear`} type="number" label={m.alarmRules.clear} min={1} max={86_400} step={1} value={threshold.debounce?.clear ?? 1}
                  onChange={(e) => setT({ debounce: { mode: 'count', raise: 1, ...threshold.debounce, clear: Number(e.target.value) } })} />
                <Input id={`${id}-hysteresis`} type="number" label={m.alarmRules.hysteresis} min={0} step="any" value={threshold.hysteresis ?? ''}
                  onChange={(e) => { const { hysteresis: _h, ...rest } = threshold; setDraft(e.target.value === '' ? rest : { ...rest, hysteresis: Number(e.target.value) }); }} />
              </div>
            )}

            <Textarea id={`${id}-runbook`} label={m.alarmRules.runbook} rows={4} maxLength={10_000} value={draft.runbook ?? ''}
              onChange={(e) => { const { runbook: _r, ...rest } = draft; setDraft((e.target.value ? { ...rest, runbook: e.target.value } : rest) as AlarmRuleDefinition); }} />
          </form>
        )}
      </div>
    </Drawer>
  );
}
