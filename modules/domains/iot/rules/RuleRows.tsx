'use client';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Select } from '@/modules/ui/Select';
import { SchemaForm } from '@/modules/app/SchemaForm/SchemaForm';
import { cn } from '@/libs/utils/cn';
import type { IotMessages } from '../messages';
import type {
  RuleAction, RuleCondition, RuleDeviceOrHome, RuleProblem, RuleScope, RuleSeverity, RuleTrigger, RuleValue,
} from '../types/rules';
import {
  ACTION_KINDS, CONDITION_KINDS, TRIGGER_KINDS, codeOf, commandOptions, deviceOptions, emptyAction, emptyCondition, emptyTrigger, freshId, problemsAt,
  refOf, refOrHomeOf, valueOptions, type ActionKind, type ConditionKind, type TriggerKind,
} from './rule-draft';

/**
 * The rows of the rule editor (docs/concepts/iot-rules 05 §5.1): every row is one sentence of pickers, a device by name, a value by
 * name, a command by name. The rows are controlled (`value` in, `onChange` out) and know nothing of ids except that they travel in
 * the select values. The first problem of a row is shown under it, in the words the editor or the server gave.
 */
type M = IotMessages['rules'];
type Ctx = { scope: RuleScope; m: M; problems: readonly RuleProblem[]; locale?: string; otherRules?: ReadonlyArray<{ ruleId: string; name: string }> };

const SEVERITIES: readonly RuleSeverity[] = ['critical', 'major', 'minor', 'warning', 'info'];
const NUM = 'w-24';

const Field = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('min-w-[8rem]', className)}>{children}</div>;

function Pick({ id, label, value, options, onChange, className, placeholder }: { id: string; label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <Field className={className}>
      <Select id={id} label={label} hideLabel value={value} onChange={(e) => onChange(e.target.value)} options={placeholder === undefined ? options : [{ value: '', label: placeholder }, ...options]} />
    </Field>
  );
}

function Num({ id, label, value, onChange, min = 0, className }: { id: string; label: string; value: number | undefined; onChange: (v: number | undefined) => void; min?: number; className?: string }) {
  return (
    <label className={cn('flex flex-col', className ?? NUM)}>
      <span className="sr-only">{label}</span>
      <input
        id={id} type="number" aria-label={label} min={min} value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="rounded-md border border-border bg-surface-base px-2 py-2 text-sm text-text-primary"
      />
    </label>
  );
}

function Txt({ id, label, value, onChange, placeholder, className, type = 'text' }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return (
    <label className={cn('flex flex-col', className ?? 'min-w-[10rem] flex-1')}>
      <span className="sr-only">{label}</span>
      <input
        id={id} type={type} aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-base px-2 py-2 text-sm text-text-primary"
      />
    </label>
  );
}

const Why = ({ problems, path }: { problems: readonly RuleProblem[]; path: ReadonlyArray<string | number> }) => {
  const p = problemsAt(problems, path)[0];
  return p ? <p role="alert" className="mt-1 text-xs text-error-fg">{p.message}</p> : null;
};

/** A value typed in a sentence: true/false for a value that is one, a number for a number, else text; the stored type follows the sample. */
function ValueInput({ id, label, sample, value, onChange }: { id: string; label: string; sample: unknown; value: RuleValue | undefined; onChange: (v: RuleValue) => void }) {
  if (typeof sample === 'boolean') {
    return <Pick id={id} label={label} value={String(value ?? '')} onChange={(v) => onChange(v === 'true')} placeholder="" options={[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]} />;
  }
  if (typeof sample === 'number') {
    return <Num id={id} label={label} value={typeof value === 'number' ? value : value === '' || value === undefined ? undefined : Number(value)} onChange={(v) => onChange(v ?? '')} min={-1_000_000} />;
  }
  return <Txt id={id} label={label} value={String(value ?? '')} onChange={onChange} className="w-32" />;
}

/** A set of numbered chips, all lit when nothing is chosen: the weekdays, months and days of the month share it. Choosing all or none = no filter. */
function Chips({ id, label, all, items, value, onChange, allLabel }: { id: string; label: string; all: number; items: Array<{ n: number; label: string }>; value: number[] | undefined; onChange: (v: number[] | undefined) => void; allLabel: string }) {
  const on = new Set(value ?? []);
  const toggle = (d: number) => {
    const next = new Set(on);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange(next.size === 0 || next.size === all ? undefined : [...next].sort((a, b) => a - b));
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {items.map((it) => (
        <button
          key={it.n} id={`${id}-${it.n}`} type="button" aria-pressed={!value || on.has(it.n)} onClick={() => toggle(it.n)}
          className={cn('rounded-md border px-2 py-1 text-xs', !value || on.has(it.n) ? 'border-primary bg-primary-subtle text-primary' : 'border-border text-text-secondary')}
        >{it.label}</button>
      ))}
      {!value ? <span className="ml-1 text-xs text-text-secondary">{allLabel}</span> : null}
    </div>
  );
}

/** Monday = 1 … Sunday = 7, named in the host's language. */
export function DaysPicker({ id, value, onChange, locale, label, allDays }: { id: string; value: number[] | undefined; onChange: (v: number[] | undefined) => void; locale?: string; label: string; allDays: string }) {
  const items = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, label: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(Date.UTC(2026, 10, 1 + n))) }));
  return <Chips id={id} label={label} all={7} items={items} value={value} onChange={onChange} allLabel={allDays} />;
}

/** January = 1 … December = 12, named in the host's language. */
export function MonthsPicker({ id, value, onChange, locale, label, allMonths }: { id: string; value: number[] | undefined; onChange: (v: number[] | undefined) => void; locale?: string; label: string; allMonths: string }) {
  const items = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 15))) }));
  return <Chips id={id} label={label} all={12} items={items} value={value} onChange={onChange} allLabel={allMonths} />;
}

/** The days 1 … 31 of a month. */
export function DaysOfMonthPicker({ id, value, onChange, label, anyDay }: { id: string; value: number[] | undefined; onChange: (v: number[] | undefined) => void; label: string; anyDay: string }) {
  const items = Array.from({ length: 31 }, (_, i) => ({ n: i + 1, label: String(i + 1) }));
  return <Chips id={id} label={label} all={31} items={items} value={value} onChange={onChange} allLabel={anyDay} />;
}

/** A date without a year as the server stores it (`MM-DD`): a month and a day, empty until both are chosen. */
function MonthDayInput({ id, label, value, onChange, locale }: { id: string; label: string; value: string | undefined; onChange: (v: string | undefined) => void; locale?: string }) {
  const [mm, dd] = value ? value.split('-') : ['', ''];
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 15))) }));
  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }));
  const set = (m: string, d: string) => onChange(m && d ? `${m}-${d}` : m || d ? `${m || '01'}-${d || '01'}` : undefined);
  return (
    <>
      <Pick id={`${id}-month`} label={label} value={mm ?? ''} options={months} placeholder="" onChange={(v) => set(v, dd ?? '')} />
      <Pick id={`${id}-day`} label={label} value={dd ?? ''} options={days} placeholder="" className="min-w-[5rem]" onChange={(v) => set(mm ?? '', v)} />
    </>
  );
}

const move = <T,>(list: readonly T[], i: number, by: -1 | 1): T[] => {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

const rowBox = 'rounded-md border border-border bg-surface-base p-3';

function RowTools({ i, count, m, onMove, onRemove, name }: { i: number; count: number; m: M; onMove: (by: -1 | 1) => void; onRemove: () => void; name: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="xs" aria-label={`${m.moveUp}: ${name}`} disabled={i === 0} onClick={() => onMove(-1)}><FontAwesomeIcon icon={faArrowUp} /></Button>
      <Button variant="ghost" size="xs" aria-label={`${m.moveDown}: ${name}`} disabled={i === count - 1} onClick={() => onMove(1)}><FontAwesomeIcon icon={faArrowDown} /></Button>
      <Button variant="ghost" size="xs" aria-label={`${m.remove}: ${name}`} onClick={onRemove}><FontAwesomeIcon icon={faTrash} /></Button>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------------------- triggers */

const triggerKindLabel = (m: M, k: TriggerKind) => ({ value: m.tValue, status: m.tStatus, alarm: m.tAlarm, time: m.tTime, date: m.tDate, every: m.tEvery, sun: m.tSun, manual: m.tManual })[k];

export function TriggerRow({ t, ctx, onChange }: { t: RuleTrigger; ctx: Ctx; onChange: (t: RuleTrigger) => void }) {
  const { scope, m } = ctx;
  const devices = deviceOptions(scope, m);
  const id = `trigger-${t.id}`;
  const changeKind = (k: string) => onChange(emptyTrigger(k as TriggerKind, t.id));
  return (
    <div className="flex flex-wrap items-start gap-2" data-row={`trigger-${t.kind}`}>
      <Pick id={`${id}-kind`} label={m.pickKind} value={t.kind} onChange={changeKind} options={TRIGGER_KINDS.map((k) => ({ value: k, label: triggerKindLabel(m, k) }))} className="min-w-[12rem]" />
      {t.kind === 'value' ? (
        <>
          <Pick id={`${id}-device`} label={m.device} value={codeOf(t.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...t, target: refOf(v), key: '' })} />
          <Pick id={`${id}-key`} label={m.value} value={t.key} placeholder={m.pickValue} options={valueOptions(scope, t.target)} onChange={(v) => onChange({ ...t, key: v })} />
          <Pick
            id={`${id}-change`} label={m.changeLabel} value={t.change}
            options={[['any', m.changeAny], ['above', m.changeAbove], ['below', m.changeBelow], ['equals', m.changeEquals], ['not_equals', m.changeNotEquals], ['between', m.changeBetween], ['outside', m.changeOutside]].map(([value, label]) => ({ value: value!, label: label! }))}
            onChange={(v) => onChange({ ...t, change: v as typeof t.change })}
          />
          {t.change !== 'any' ? (
            <ValueInput id={`${id}-value`} label={m.thanValue} sample={valueOptions(scope, t.target).find((o) => o.value === t.key)?.sample} value={t.value} onChange={(v) => onChange({ ...t, value: v })} />
          ) : null}
          {t.change === 'between' || t.change === 'outside' ? (
            <>
              <span className="self-center text-sm text-text-secondary">{m.thanValue2}</span>
              <Num id={`${id}-value2`} label={m.thanValue2} value={t.value2} onChange={(v) => onChange({ ...t, value2: v })} min={-1_000_000} />
            </>
          ) : null}
          {t.change !== 'any' ? (
            <>
              <span className="self-center text-sm text-text-secondary">{m.stays}</span>
              <Num id={`${id}-for`} label={m.staysMin} value={t.forSec ? Math.round(t.forSec / 60) : undefined} onChange={(v) => onChange({ ...t, forSec: v ? v * 60 : undefined })} className="w-20" />
              <span className="self-center text-sm text-text-secondary">{t.forSec ? m.staysMin : m.staysNone}</span>
            </>
          ) : null}
        </>
      ) : null}
      {t.kind === 'status' ? (
        <>
          <Pick id={`${id}-device`} label={m.device} value={codeOf(t.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...t, target: refOf(v) })} />
          <Pick id={`${id}-to`} label={m.tStatus} value={t.to} options={[{ value: 'online', label: m.toOnline }, { value: 'offline', label: m.toOffline }, { value: 'inactive', label: m.toInactive }]} onChange={(v) => onChange({ ...t, to: v as typeof t.to })} />
        </>
      ) : null}
      {t.kind === 'alarm' ? (
        <>
          <Pick
            id={`${id}-device`} label={m.device} value={codeOf(t.target)} placeholder={m.pickDevice}
            options={[...(scope.place.type === 'device' ? [{ value: 'home', label: m.alarmHere }] : []), ...devices]} onChange={(v) => onChange({ ...t, target: refOrHomeOf(v) })}
          />
          <Pick id={`${id}-event`} label={m.tAlarm} value={t.event} options={[{ value: 'raised', label: m.alarmRaised }, { value: 'cleared', label: m.alarmCleared }]} onChange={(v) => onChange({ ...t, event: v as typeof t.event })} />
          <Pick
            id={`${id}-severity`} label={m.alarmFrom} value={t.minSeverity ?? ''} onChange={(v) => onChange({ ...t, minSeverity: (v || undefined) as RuleSeverity | undefined })}
            options={[{ value: '', label: m.alarmAnySeverity }, ...SEVERITIES.map((s) => ({ value: s, label: IOT_SEVERITY_LABEL[s] }))]}
          />
          <Txt id={`${id}-type`} label={m.alarmTypeLabel} placeholder={m.alarmTypeLabel} value={t.alarmType ?? ''} onChange={(v) => onChange({ ...t, alarmType: v || undefined })} className="w-48" />
        </>
      ) : null}
      {t.kind === 'time' ? (
        <>
          <span className="self-center text-sm text-text-secondary">{m.atTime}</span>
          <Txt id={`${id}-at`} type="time" label={m.atTime} value={t.at} onChange={(v) => onChange({ ...t, at: v })} className="w-28" />
          <DaysPicker id={`${id}-days`} value={t.days} onChange={(d) => onChange({ ...t, days: d })} locale={ctx.locale} label={m.onDays} allDays={m.allDays} />
        </>
      ) : null}
      {t.kind === 'date' ? (
        <>
          <span className="self-center text-sm text-text-secondary">{m.onDaysOfMonth}</span>
          <DaysOfMonthPicker id={`${id}-dom`} value={t.daysOfMonth} onChange={(v) => onChange({ ...t, daysOfMonth: v, ...(v ? { days: undefined } : {}) })} label={m.onDaysOfMonth} anyDay={m.anyDayOfMonth} />
          <span className="self-center text-sm text-text-secondary">{m.onMonths}</span>
          <MonthsPicker id={`${id}-months`} value={t.months} onChange={(v) => onChange({ ...t, months: v })} locale={ctx.locale} label={m.onMonths} allMonths={m.allMonths} />
          <span className="self-center text-sm text-text-secondary">{m.atTime}</span>
          <Txt id={`${id}-at`} type="time" label={m.atTime} value={t.at} onChange={(v) => onChange({ ...t, at: v })} className="w-28" />
          {!t.daysOfMonth ? <DaysPicker id={`${id}-days`} value={t.days} onChange={(d) => onChange({ ...t, days: d })} locale={ctx.locale} label={m.onDays} allDays={m.allDays} /> : null}
        </>
      ) : null}
      {t.kind === 'every' ? (
        <>
          <span className="self-center text-sm text-text-secondary">{m.everyLabel}</span>
          <Num id={`${id}-minutes`} label={m.everyMinutes} value={t.minutes} min={1} onChange={(v) => onChange({ ...t, minutes: v ?? 0 })} />
          <span className="self-center text-sm text-text-secondary">{m.everyMinutes}</span>
        </>
      ) : null}
      {t.kind === 'sun' ? (
        <>
          <Pick id={`${id}-event`} label={m.tSun} value={t.event} options={[{ value: 'sunrise', label: m.sunrise }, { value: 'sunset', label: m.sunset }]} onChange={(v) => onChange({ ...t, event: v as typeof t.event })} />
          <Num id={`${id}-offset`} label={m.sunOffset} value={t.offsetMin ?? 0} min={-180} onChange={(v) => onChange({ ...t, offsetMin: v ?? 0 })} />
          <span className="self-center text-xs text-text-secondary">{m.sunOffset}</span>
          <DaysPicker id={`${id}-days`} value={t.days} onChange={(d) => onChange({ ...t, days: d })} locale={ctx.locale} label={m.onDays} allDays={m.allDays} />
        </>
      ) : null}
    </div>
  );
}

const IOT_SEVERITY_LABEL: Record<RuleSeverity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor', warning: 'Warning', info: 'Info' };

export function TriggerList({ items, path, ctx, onChange }: { items: RuleTrigger[]; path: Array<string | number>; ctx: Ctx; onChange: (v: RuleTrigger[]) => void }) {
  const { m } = ctx;
  return (
    <div className="flex flex-col gap-2">
      {items.map((t, i) => (
        <div key={t.id} className={rowBox}>
          <div className="flex items-start justify-between gap-2">
            <TriggerRow t={t} ctx={ctx} onChange={(next) => onChange(items.map((x, j) => (j === i ? next : x)))} />
            <RowTools i={i} count={items.length} m={m} name={`${m.when} ${i + 1}`} onMove={(by) => onChange(move(items, i, by))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
          <Why problems={ctx.problems} path={[...path, i]} />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------------------- conditions */

type GroupKind = 'all' | 'any' | 'none';
const groupOf = (c: RuleCondition): { kind: GroupKind; children: RuleCondition[] } | null => {
  if ('all' in c) return { kind: 'all', children: c.all };
  if ('any' in c) return { kind: 'any', children: c.any };
  if ('not' in c) return 'any' in c.not ? { kind: 'none', children: c.not.any } : { kind: 'none', children: [c.not] };
  return null;
};
const groupWith = (kind: GroupKind, children: RuleCondition[]): RuleCondition => (kind === 'all' ? { all: children } : kind === 'any' ? { any: children } : { not: { any: children } });

const conditionKindLabel = (m: M, k: ConditionKind) => ({ value: m.cValue, status: m.cStatus, alarm: m.cAlarm, time: m.cTime, date: m.cDate, holiday: m.cHoliday, sun: m.cSun, expr: m.cExpr })[k];

function ConditionLeaf({ c, path, ctx, onChange }: { c: Exclude<RuleCondition, { all: unknown } | { any: unknown } | { not: unknown }>; path: Array<string | number>; ctx: Ctx; onChange: (c: RuleCondition) => void }) {
  const { scope, m } = ctx;
  const devices = deviceOptions(scope, m);
  const id = `cond-${path.join('-')}`;
  const OPS = [['>', m.opGt], ['>=', m.opGte], ['<', m.opLt], ['<=', m.opLte], ['==', m.opEq], ['!=', m.opNeq], ['between', m.opBetween]].map(([value, label]) => ({ value: value!, label: label! }));
  return (
    <div className="flex flex-wrap items-start gap-2" data-row={`condition-${c.kind}`}>
      <Pick id={`${id}-kind`} label={m.pickKind} value={c.kind} className="min-w-[12rem]" onChange={(k) => onChange(emptyCondition(k as ConditionKind))} options={CONDITION_KINDS.map((k) => ({ value: k, label: conditionKindLabel(m, k) }))} />
      {c.kind === 'value' ? (
        <>
          <Pick id={`${id}-device`} label={m.device} value={codeOf(c.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...c, target: refOf(v), key: '' })} />
          <Pick id={`${id}-key`} label={m.value} value={c.key} placeholder={m.pickValue} options={valueOptions(scope, c.target)} onChange={(v) => onChange({ ...c, key: v })} />
          <Pick id={`${id}-op`} label={m.changeLabel} value={c.op} options={OPS} onChange={(v) => onChange({ ...c, op: v as typeof c.op })} />
          <ValueInput id={`${id}-value`} label={m.thanValue} sample={valueOptions(scope, c.target).find((o) => o.value === c.key)?.sample} value={c.value} onChange={(v) => onChange({ ...c, value: v })} />
          {c.op === 'between' ? (
            <>
              <span className="self-center text-sm text-text-secondary">{m.thanValue2}</span>
              <Num id={`${id}-value2`} label={m.thanValue2} value={c.value2} onChange={(v) => onChange({ ...c, value2: v })} min={-1_000_000} />
            </>
          ) : null}
        </>
      ) : null}
      {c.kind === 'status' ? (
        <>
          <Pick id={`${id}-device`} label={m.device} value={codeOf(c.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...c, target: refOf(v) })} />
          <Pick id={`${id}-is`} label={m.cStatus} value={c.is} options={[{ value: 'online', label: m.isOnline }, { value: 'offline', label: m.isOffline }]} onChange={(v) => onChange({ ...c, is: v as typeof c.is })} />
        </>
      ) : null}
      {c.kind === 'alarm' ? (
        <>
          <Pick id={`${id}-device`} label={m.device} value={codeOf(c.target)} placeholder={m.pickDevice} options={[...(scope.place.type === 'device' ? [{ value: 'home', label: m.alarmHere }] : []), ...devices]} onChange={(v) => onChange({ ...c, target: refOrHomeOf(v) as RuleDeviceOrHome })} />
          <Pick id={`${id}-active`} label={m.cAlarm} value={String(c.active)} options={[{ value: 'true', label: m.alarmActive }, { value: 'false', label: m.alarmNone }]} onChange={(v) => onChange({ ...c, active: v === 'true' })} />
        </>
      ) : null}
      {c.kind === 'time' ? (
        <>
          <span className="self-center text-sm text-text-secondary">{m.after}</span>
          <Txt id={`${id}-after`} type="time" label={m.after} value={c.after ?? ''} onChange={(v) => onChange({ ...c, after: v || undefined })} className="w-28" />
          <span className="self-center text-sm text-text-secondary">{m.before}</span>
          <Txt id={`${id}-before`} type="time" label={m.before} value={c.before ?? ''} onChange={(v) => onChange({ ...c, before: v || undefined })} className="w-28" />
          <DaysPicker id={`${id}-days`} value={c.days} onChange={(d) => onChange({ ...c, days: d })} locale={ctx.locale} label={m.onDays} allDays={m.allDays} />
        </>
      ) : null}
      {c.kind === 'date' ? (
        <>
          <span className="self-center text-sm text-text-secondary">{m.onMonths}</span>
          <MonthsPicker id={`${id}-months`} value={c.months} onChange={(v) => onChange({ ...c, months: v })} locale={ctx.locale} label={m.onMonths} allMonths={m.allMonths} />
          <span className="self-center text-sm text-text-secondary">{m.onDaysOfMonth}</span>
          <DaysOfMonthPicker id={`${id}-dom`} value={c.daysOfMonth} onChange={(v) => onChange({ ...c, daysOfMonth: v })} label={m.onDaysOfMonth} anyDay={m.anyDayOfMonth} />
          <span className="self-center text-sm text-text-secondary">{m.dateFrom}</span>
          <MonthDayInput id={`${id}-from`} label={m.dateFrom} value={c.from} locale={ctx.locale} onChange={(v) => onChange({ ...c, from: v })} />
          <span className="self-center text-sm text-text-secondary">{m.dateTo}</span>
          <MonthDayInput id={`${id}-to`} label={m.dateTo} value={c.to} locale={ctx.locale} onChange={(v) => onChange({ ...c, to: v })} />
        </>
      ) : null}
      {c.kind === 'holiday' ? <Pick id={`${id}-is`} label={m.cHoliday} value={String(c.is)} options={[{ value: 'true', label: m.isHoliday }, { value: 'false', label: m.isNotHoliday }]} onChange={(v) => onChange({ ...c, is: v === 'true' })} /> : null}
      {c.kind === 'sun' ? <Pick id={`${id}-is`} label={m.cSun} value={c.is} options={[{ value: 'day', label: m.isDay }, { value: 'night', label: m.isNight }]} onChange={(v) => onChange({ ...c, is: v as typeof c.is })} /> : null}
      {c.kind === 'expr' ? <Txt id={`${id}-expr`} label={m.formulaLabel} placeholder={m.formulaLabel} value={c.expr} onChange={(v) => onChange({ ...c, expr: v })} /> : null}
    </div>
  );
}

/** A group of conditions (all / any / none of them), the rows inside it and the buttons that add to it. Recursive. */
export function ConditionGroup({ value, path, ctx, onChange, root = false, depth = 0 }: { value: RuleCondition | undefined; path: Array<string | number>; ctx: Ctx; onChange: (c: RuleCondition | undefined) => void; root?: boolean; depth?: number }) {
  const { m } = ctx;
  const g = value ? groupOf(value) : { kind: 'all' as GroupKind, children: [] as RuleCondition[] };
  // a leaf at the root (a condition written without a group) is shown as a group of one
  const view = g ?? { kind: 'all' as GroupKind, children: value ? [value] : [] };
  const base = value && g ? [...path, view.kind === 'none' ? 'not' : view.kind] : path;
  const set = (kind: GroupKind, children: RuleCondition[]) => onChange(children.length === 0 && root ? undefined : groupWith(kind, children));
  const label = (k: GroupKind) => (k === 'all' ? m.groupAll : k === 'any' ? m.groupAny : m.groupNot);
  return (
    <div className={cn('flex flex-col gap-2', !root && 'rounded-md border border-dashed border-border p-2')}>
      {(view.children.length > 1 || !root) ? (
        <Pick id={`group-${path.join('-')}-kind`} label={m.group} value={view.kind} onChange={(k) => set(k as GroupKind, view.children)} className="max-w-xs"
          options={(['all', 'any', 'none'] as const).map((k) => ({ value: k, label: label(k) }))} />
      ) : null}
      {view.children.map((child, i) => {
        const cg = groupOf(child);
        const p = [...base, i];
        return (
          <div key={i} className={rowBox}>
            <div className="flex items-start justify-between gap-2">
              {cg ? (
                <ConditionGroup value={child} path={p} ctx={ctx} depth={depth + 1} onChange={(next) => set(view.kind, next ? view.children.map((x, j) => (j === i ? next : x)) : view.children.filter((_, j) => j !== i))} />
              ) : (
                <ConditionLeaf c={child as never} path={p} ctx={ctx} onChange={(next) => set(view.kind, view.children.map((x, j) => (j === i ? next : x)))} />
              )}
              <RowTools i={i} count={view.children.length} m={m} name={`${m.onlyIf} ${i + 1}`} onMove={(by) => set(view.kind, move(view.children, i, by))} onRemove={() => set(view.kind, view.children.filter((_, j) => j !== i))} />
            </div>
            {!cg ? <Why problems={ctx.problems} path={p} /> : null}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => set(view.kind, [...view.children, emptyCondition('value')])}>{m.addCondition}</Button>
        {depth < 2 ? <Button size="sm" variant="ghost" onClick={() => set(view.kind, [...view.children, { any: [emptyCondition('value')] }])}>{m.addGroup}</Button> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ actions */

const actionKindLabel = (m: M, k: ActionKind) => ({ command: m.aCommand, setting: m.aSetting, notify: m.aNotify, alarm: m.aAlarm, wait: m.aWait, wait_until: m.aWaitUntil, choose: m.aChoose, rule: m.aRule })[k];

function ActionRow({ a, path, ctx, onChange, takenIds }: { a: RuleAction; path: Array<string | number>; ctx: Ctx; onChange: (a: RuleAction) => void; takenIds: Set<string> }) {
  const { scope, m } = ctx;
  const devices = deviceOptions(scope, m);
  const id = `action-${a.id}`;
  const roles = scope.roles;
  const kinds = ACTION_KINDS.filter((k) => k !== 'rule' || (ctx.otherRules?.length ?? 0) > 0);
  return (
    <div className="flex flex-col gap-2" data-row={`action-${a.kind}`}>
      <div className="flex flex-wrap items-start gap-2">
        <Pick id={`${id}-kind`} label={m.pickKind} value={a.kind} className="min-w-[12rem]" options={kinds.map((k) => ({ value: k, label: actionKindLabel(m, k) }))} onChange={(k) => onChange(emptyAction(k as ActionKind, a.id))} />
        {a.kind === 'command' ? (
          <>
            <Pick id={`${id}-device`} label={m.device} value={codeOf(a.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...a, target: refOf(v), command: '', params: undefined })} />
            <Pick id={`${id}-command`} label={m.command} value={a.command} placeholder={m.pickCommand} options={commandOptions(scope, a.target).map((c) => ({ value: c.method, label: c.label }))} onChange={(v) => onChange({ ...a, command: v, params: undefined })} />
          </>
        ) : null}
        {a.kind === 'setting' ? (
          <>
            <Pick id={`${id}-device`} label={m.device} value={codeOf(a.target)} placeholder={m.pickDevice} options={devices} onChange={(v) => onChange({ ...a, target: refOf(v) })} />
            <Txt id={`${id}-key`} label={m.settingKey} placeholder={m.settingKey} value={a.key} onChange={(v) => onChange({ ...a, key: v })} className="w-40" />
            <span className="self-center text-sm text-text-secondary">{m.settingValue}</span>
            <Txt id={`${id}-value`} label={m.settingValue} value={String(a.value)} onChange={(v) => onChange({ ...a, value: v !== '' && /^[-+]?\d+(\.\d+)?$/.test(v) ? Number(v) : v })} className="w-32" />
          </>
        ) : null}
        {a.kind === 'notify' ? (
          <>
            <div role="group" aria-label={m.notifyWho} className="flex flex-wrap items-center gap-3">
              {roles.map((r) => {
                const on = a.recipients.some((x) => x.kind === 'role' && x.role === r);
                return (
                  <Checkbox
                    key={r} id={`${id}-role-${r}`} label={{ OWNER: m.roleOwner, ADMIN: m.roleAdmin, USER: m.roleUser }[r]} checked={on}
                    onChange={(e) => onChange({ ...a, recipients: e.target.checked ? [...a.recipients, { kind: 'role', role: r }] : a.recipients.filter((x) => !(x.kind === 'role' && x.role === r)) })}
                  />
                );
              })}
            </div>
            <Txt id={`${id}-text`} label={m.notifyText} placeholder={m.notifyText} value={a.text} onChange={(v) => onChange({ ...a, text: v })} className="min-w-[14rem] flex-1" />
          </>
        ) : null}
        {a.kind === 'alarm' ? (
          <>
            <Pick id={`${id}-op`} label={m.aAlarm} value={a.op} options={[{ value: 'raise', label: m.alarmRaise }, { value: 'clear', label: m.alarmClear }]} onChange={(v) => onChange({ ...a, op: v as typeof a.op })} />
            <Pick id={`${id}-device`} label={m.device} value={codeOf(a.target)} placeholder={m.pickDevice} options={[...(scope.place.type === 'device' ? [{ value: 'home', label: m.alarmHere }] : []), ...devices]} onChange={(v) => onChange({ ...a, target: refOrHomeOf(v) })} />
            <Txt id={`${id}-type`} label={m.alarmTypeNeeded} placeholder={m.alarmTypeNeeded} value={a.alarmType} onChange={(v) => onChange({ ...a, alarmType: v })} className="w-44" />
            {a.op === 'raise' ? <Pick id={`${id}-severity`} label={m.alarmSeverityLabel} value={a.severity ?? 'warning'} options={SEVERITIES.map((s) => ({ value: s, label: IOT_SEVERITY_LABEL[s] }))} onChange={(v) => onChange({ ...a, severity: v as RuleSeverity })} /> : null}
          </>
        ) : null}
        {a.kind === 'wait' ? (
          <>
            <span className="self-center text-sm text-text-secondary">{m.waitLabel}</span>
            <Num id={`${id}-sec`} label={m.waitLabel} min={1} value={a.sec % 60 === 0 ? a.sec / 60 : a.sec} onChange={(v) => onChange({ ...a, sec: (v ?? 0) * (a.sec % 60 === 0 ? 60 : 1) })} />
            <Pick id={`${id}-unit`} label={m.waitLabel} value={a.sec % 60 === 0 ? 'min' : 'sec'} options={[{ value: 'sec', label: m.waitSeconds }, { value: 'min', label: m.waitMinutes }]} onChange={(u) => onChange({ ...a, sec: u === 'min' ? Math.max(60, Math.round(a.sec / 60) * 60) : a.sec })} />
          </>
        ) : null}
        {a.kind === 'rule' ? (
          <>
            <Pick id={`${id}-op`} label={m.aRule} value={a.op} options={[{ value: 'enable', label: m.ruleSwitchOn }, { value: 'disable', label: m.ruleSwitchOff }, { value: 'run', label: m.ruleStart }]} onChange={(v) => onChange({ ...a, op: v as 'enable' | 'disable' | 'run' })} />
            <Pick id={`${id}-rule`} label={m.ruleWhich} value={a.rule} placeholder={m.ruleWhich} options={(ctx.otherRules ?? []).map((r) => ({ value: r.ruleId, label: r.name }))} onChange={(v) => onChange({ ...a, rule: v })} />
          </>
        ) : null}
      </div>
      {a.kind === 'command' ? <CommandParams a={a} ctx={ctx} onChange={onChange} id={id} /> : null}
      {a.kind === 'wait_until' ? (
        <div className="flex flex-col gap-2">
          <ConditionGroup root value={{ all: [a.condition] }} path={[...path, 'condition']} ctx={ctx} onChange={(c) => onChange({ ...a, condition: (c && 'all' in c ? c.all[0] : c) ?? emptyCondition('value') })} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">{m.waitUntilTimeout}</span>
            <Num id={`${id}-timeout`} label={m.waitUntilTimeout} min={1} value={Math.round(a.timeoutSec / 60)} onChange={(v) => onChange({ ...a, timeoutSec: (v ?? 0) * 60 })} className="w-20" />
            <span className="text-sm text-text-secondary">{m.waitMinutes}</span>
            <Pick id={`${id}-timeout-do`} label={m.waitUntilTimeout} value={a.onTimeout} options={[{ value: 'continue', label: m.onTimeoutContinue }, { value: 'stop', label: m.onTimeoutStop }]} onChange={(v) => onChange({ ...a, onTimeout: v as typeof a.onTimeout })} />
          </div>
        </div>
      ) : null}
      {a.kind === 'choose' ? (
        <div className="flex flex-col gap-3">
          {a.branches.map((b, j) => (
            <div key={j} className="rounded-md border border-dashed border-border p-2">
              <p className="text-xs font-medium text-text-secondary">{m.choiceIf}</p>
              <ConditionGroup root value={b.if} path={[...path, 'branches', j, 'if']} ctx={ctx} onChange={(c) => onChange({ ...a, branches: a.branches.map((x, k) => (k === j ? { ...x, if: c ?? emptyCondition('value') } : x)) })} />
              <p className="mt-2 text-xs font-medium text-text-secondary">{m.choiceThen}</p>
              <ActionList items={b.then} path={[...path, 'branches', j, 'then']} ctx={ctx} takenIds={takenIds} nested onChange={(then) => onChange({ ...a, branches: a.branches.map((x, k) => (k === j ? { ...x, then } : x)) })} />
              {a.branches.length > 1 ? <Button size="xs" variant="ghost" className="mt-1" onClick={() => onChange({ ...a, branches: a.branches.filter((_, k) => k !== j) })}>{m.remove}</Button> : null}
            </div>
          ))}
          {a.branches.length < 5 ? <Button size="sm" variant="outline" className="self-start" onClick={() => onChange({ ...a, branches: [...a.branches, { if: emptyCondition('value'), then: [] }] })}>{m.addChoice}</Button> : null}
          <div className="rounded-md border border-dashed border-border p-2">
            <p className="text-xs font-medium text-text-secondary">{m.choiceElse}</p>
            <ActionList items={a.else ?? []} path={[...path, 'else']} ctx={ctx} takenIds={takenIds} nested onChange={(els) => onChange({ ...a, else: els.length ? els : undefined })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommandParams({ a, ctx, onChange, id }: { a: Extract<RuleAction, { kind: 'command' }>; ctx: Ctx; onChange: (a: RuleAction) => void; id: string }) {
  const cmd = commandOptions(ctx.scope, a.target).find((c) => c.method === a.command);
  const schema = (cmd?.paramsSchema ?? {}) as Record<string, never>;
  if (!cmd || !Object.keys(schema).length) return null;
  return (
    <div id={`${id}-params`} className="rounded-md bg-surface-sunken p-2">
      <SchemaForm schema={schema} values={a.params ?? {}} onChange={(v) => onChange({ ...a, params: v })} debounceMs={0} />
    </div>
  );
}

/** The actions in order; a choice deeper than the server allows (two levels) is turned back into a plain command row. */
export function ActionList({ items, path, ctx, onChange, takenIds }: { items: RuleAction[]; path: Array<string | number>; ctx: Ctx; onChange: (v: RuleAction[]) => void; takenIds: Set<string>; nested?: boolean }) {
  const { m } = ctx;
  const depth = path.filter((p) => p === 'branches' || p === 'else').length;
  const add = () => {
    const id = freshId('a', takenIds);
    takenIds.add(id);
    onChange([...items, emptyAction('command', id)]);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map((a, i) => (
        <div key={a.id} className={rowBox}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <ActionRow a={a} path={[...path, i]} ctx={ctx} takenIds={takenIds} onChange={(next) => onChange(items.map((x, j) => (j === i ? (depth >= 2 && next.kind === 'choose' ? emptyAction('command', next.id) : next) : x)))} />
              <Why problems={ctx.problems} path={[...path, i]} />
            </div>
            <RowTools i={i} count={items.length} m={m} name={`${m.then} ${i + 1}`} onMove={(by) => onChange(move(items, i, by))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="self-start" onClick={add}>{m.addAction}</Button>
    </div>
  );
}

export type { Ctx as RuleRowsContext };
