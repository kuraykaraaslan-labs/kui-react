import type {
  RuleAction, RuleCondition, RuleDefinition, RuleDeviceOrHome, RuleDeviceRef, RuleProblem, RuleScope, RuleTrigger,
} from '../types/rules';
import type { IotMessages } from '../messages';

/**
 * The draft of a rule as the editor holds it (docs/concepts/iot-rules 00 §0.2): pure helpers for building rows, naming devices and
 * values from the scope, and for the completeness check the editor runs before it asks the server (which is the authority and says the
 * rest in words with the row of each problem).
 */
export type DeviceCode = string;

/** A device reference as a select value: `d:<id>` or `t:<profileId>`; empty for nothing picked. */
export const codeOf = (ref: RuleDeviceOrHome | undefined): DeviceCode => (!ref ? '' : 'home' in ref ? 'home' : 'device' in ref ? (ref.device ? `d:${ref.device}` : '') : ref.deviceType ? `t:${ref.deviceType}` : '');
export function refOf(code: DeviceCode): RuleDeviceRef {
  return code.startsWith('t:') ? { deviceType: code.slice(2) } : { device: code.startsWith('d:') ? code.slice(2) : '' };
}
export function refOrHomeOf(code: DeviceCode): RuleDeviceOrHome {
  return code === 'home' ? { home: true } : refOf(code);
}

export type Option = { value: string; label: string };

/** The devices of the scope by name, then every kind of device ("Every Fan") that has more than one device. */
export function deviceOptions(scope: Pick<RuleScope, 'devices' | 'deviceTypes'>, m: IotMessages['rules']): Option[] {
  const one = scope.devices.map((d) => ({ value: `d:${d.deviceId}`, label: d.name }));
  const kinds = scope.deviceTypes.filter((t) => t.deviceCount > 1).map((t) => ({ value: `t:${t.profileId}`, label: m.kindAllOf.replace('{type}', t.name) }));
  return [...one, ...kinds];
}

/** The devices a reference stands for. */
export function devicesOfRef(scope: Pick<RuleScope, 'devices'>, ref: RuleDeviceOrHome | undefined) {
  if (!ref || 'home' in ref) return [];
  return 'device' in ref ? scope.devices.filter((d) => d.deviceId === ref.device) : scope.devices.filter((d) => d.profileId === ref.deviceType);
}

/** The values a device (or any device of a kind) reports, by name, each once. */
export function valueOptions(scope: Pick<RuleScope, 'devices'>, ref: RuleDeviceOrHome | undefined): Array<Option & { sample: string | number | boolean | null }> {
  const seen = new Map<string, { label: string; sample: string | number | boolean | null }>();
  for (const d of devicesOfRef(scope, ref)) for (const v of d.values) if (!seen.has(v.key)) seen.set(v.key, { label: v.label, sample: v.sample });
  return [...seen].map(([key, v]) => ({ value: key, label: v.label, sample: v.sample })).sort((a, b) => a.label.localeCompare(b.label));
}

/** The commands the devices of a reference share: those of the kind of the first device (a kind's devices share its list). */
export function commandOptions(scope: Pick<RuleScope, 'devices' | 'deviceTypes'>, ref: RuleDeviceOrHome | undefined) {
  const d = devicesOfRef(scope, ref)[0];
  return scope.deviceTypes.find((t) => t.profileId === d?.profileId)?.commands ?? [];
}

/** Every item id of a draft (triggers, actions, nested ones), for picking a fresh one. */
export function collectIds(def: RuleDefinition): Set<string> {
  const ids = new Set<string>(def.when.map((t) => t.id));
  const walk = (list: readonly RuleAction[]) => {
    for (const a of list) {
      ids.add(a.id);
      if (a.kind === 'choose') { a.branches.forEach((b) => walk(b.then)); if (a.else) walk(a.else); }
    }
  };
  walk(def.then);
  return ids;
}

/** A fresh id (`t3`, `a5`) not in `taken`; the server wants `^[a-z0-9][a-z0-9_-]{0,23}$`. */
export function freshId(prefix: 't' | 'a', taken: Set<string>): string {
  for (let n = 1; ; n++) if (!taken.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

export type TriggerKind = RuleTrigger['kind'];
export type ConditionKind = Exclude<RuleCondition, { all: unknown } | { any: unknown } | { not: unknown }>['kind'];
export type ActionKind = RuleAction['kind'];
export const TRIGGER_KINDS: readonly TriggerKind[] = ['value', 'status', 'alarm', 'time', 'date', 'every', 'sun', 'manual'];
export const CONDITION_KINDS: readonly ConditionKind[] = ['value', 'status', 'alarm', 'time', 'date', 'holiday', 'sun', 'expr'];
export const ACTION_KINDS: readonly ActionKind[] = ['command', 'setting', 'notify', 'alarm', 'wait', 'wait_until', 'choose', 'rule'];

const none: RuleDeviceRef = { device: '' };

export function emptyTrigger(kind: TriggerKind, id: string): RuleTrigger {
  switch (kind) {
    case 'value': return { id, kind, target: none, key: '', change: 'above' };
    case 'status': return { id, kind, target: none, to: 'offline' };
    case 'alarm': return { id, kind, target: none, event: 'raised' };
    case 'time': return { id, kind, at: '08:00' };
    case 'date': return { id, kind, at: '09:00', daysOfMonth: [1] };
    case 'every': return { id, kind, minutes: 15 };
    case 'sun': return { id, kind, event: 'sunset' };
    case 'manual': return { id, kind };
  }
}

export function emptyCondition(kind: ConditionKind): RuleCondition {
  switch (kind) {
    case 'value': return { kind, target: none, key: '', op: '>', value: '' };
    case 'status': return { kind, target: none, is: 'online' };
    case 'alarm': return { kind, target: none, active: true };
    case 'time': return { kind, after: '08:00', before: '20:00' };
    case 'date': return { kind, months: [6, 7, 8, 9] };
    case 'holiday': return { kind, is: false };
    case 'sun': return { kind, is: 'day' };
    case 'expr': return { kind, expr: '' };
  }
}

export function emptyAction(kind: ActionKind, id: string): RuleAction {
  switch (kind) {
    case 'command': return { id, kind, target: none, command: '' };
    case 'setting': return { id, kind, target: none, key: '', value: '' };
    case 'notify': return { id, kind, recipients: [{ kind: 'role', role: 'ADMIN' }], text: '' };
    case 'alarm': return { id, kind, op: 'raise', target: none, alarmType: '' };
    case 'wait': return { id, kind, sec: 60 };
    case 'wait_until': return { id, kind, condition: emptyCondition('value'), timeoutSec: 600, onTimeout: 'continue' };
    case 'choose': return { id, kind, branches: [{ if: emptyCondition('value'), then: [] }] };
    case 'rule': return { id, kind, op: 'enable', rule: '' };
  }
}

/** A new rule: one empty value trigger, one empty command, the plainest options. */
export function emptyDefinition(): RuleDefinition {
  return { v: 1, when: [emptyTrigger('value', 't1')], then: [emptyAction('command', 'a1')], options: { overlap: 'ignore' } };
}

/** Whether the rule sends commands or changes settings by itself (the author's confirmation, 409 `needsConfirmation` otherwise). */
export function actsOnDevices(def: RuleDefinition): boolean {
  const walk = (list: readonly RuleAction[]): boolean => list.some((a) => a.kind === 'command' || a.kind === 'setting' || (a.kind === 'choose' && (a.branches.some((b) => walk(b.then)) || (a.else ? walk(a.else) : false))));
  return walk(def.then);
}

const picked = (r: RuleDeviceOrHome | undefined): boolean => codeOf(r) !== '';

function conditionProblems(c: RuleCondition, path: Array<string | number>, m: IotMessages['rules'], out: RuleProblem[]): void {
  if ('all' in c || 'any' in c) {
    const parts = 'all' in c ? c.all : c.any;
    if (!parts.length) out.push({ path, code: 'empty', message: m.pickKind });
    parts.forEach((p, i) => conditionProblems(p, [...path, 'all' in c ? 'all' : 'any', i], m, out));
    return;
  }
  if ('not' in c) return conditionProblems(c.not, [...path, 'not'], m, out);
  if (c.kind === 'value') {
    if (!picked(c.target)) out.push({ path: [...path, 'target'], code: 'device', message: m.pickDevice });
    else if (!c.key) out.push({ path: [...path, 'key'], code: 'key', message: m.pickValue });
    if (c.value === '' || c.value === undefined) out.push({ path: [...path, 'value'], code: 'value', message: m.thanValue });
    if (c.op === 'between' && (typeof c.value2 !== 'number' || !Number.isFinite(c.value2))) out.push({ path: [...path, 'value2'], code: 'value2', message: m.thanValue2 });
  } else if ((c.kind === 'status' || c.kind === 'alarm') && !picked(c.target)) {
    out.push({ path: [...path, 'target'], code: 'device', message: m.pickDevice });
  } else if (c.kind === 'date') {
    if (!c.months && !c.daysOfMonth && !c.from && !c.to) out.push({ path, code: 'date_empty', message: m.dateNeeded });
    else if ((c.from === undefined) !== (c.to === undefined)) out.push({ path, code: 'date_window_half', message: m.dateWindowHalf });
  } else if (c.kind === 'expr' && !c.expr.trim()) {
    out.push({ path: [...path, 'expr'], code: 'expr', message: m.formulaLabel });
  }
}

function actionProblems(list: readonly RuleAction[], path: Array<string | number>, m: IotMessages['rules'], out: RuleProblem[]): void {
  list.forEach((a, i) => {
    const p = [...path, i];
    switch (a.kind) {
      case 'command':
        if (!picked(a.target)) out.push({ path: [...p, 'target'], code: 'device', message: m.pickDevice });
        else if (!a.command) out.push({ path: [...p, 'command'], code: 'command', message: m.pickCommand });
        break;
      case 'setting':
        if (!picked(a.target)) out.push({ path: [...p, 'target'], code: 'device', message: m.pickDevice });
        if (!a.key.trim()) out.push({ path: [...p, 'key'], code: 'key', message: m.settingKey });
        if (a.value === '') out.push({ path: [...p, 'value'], code: 'value', message: m.settingValue });
        break;
      case 'notify':
        if (!a.recipients.length) out.push({ path: [...p, 'recipients'], code: 'recipients', message: m.notifyWho });
        if (!a.text.trim()) out.push({ path: [...p, 'text'], code: 'text', message: m.notifyText });
        break;
      case 'alarm':
        if (a.target && !picked(a.target)) out.push({ path: [...p, 'target'], code: 'device', message: m.pickDevice });
        if (!a.alarmType.trim()) out.push({ path: [...p, 'alarmType'], code: 'alarmType', message: m.alarmTypeNeeded });
        break;
      case 'wait':
        if (!(a.sec >= 1)) out.push({ path: [...p, 'sec'], code: 'sec', message: m.waitLabel });
        break;
      case 'wait_until':
        conditionProblems(a.condition, [...p, 'condition'], m, out);
        if (!(a.timeoutSec >= 1)) out.push({ path: [...p, 'timeoutSec'], code: 'timeoutSec', message: m.waitUntilTimeout });
        break;
      case 'choose':
        a.branches.forEach((b, j) => { conditionProblems(b.if, [...p, 'branches', j, 'if'], m, out); actionProblems(b.then, [...p, 'branches', j, 'then'], m, out); });
        if (a.else) actionProblems(a.else, [...p, 'else'], m, out);
        break;
      case 'rule':
        if (!a.rule) out.push({ path: [...p, 'rule'], code: 'rule', message: m.ruleWhich });
        break;
    }
  });
}

/** The rows the editor itself can see are unfinished (nothing picked, nothing typed), with the row's path; the server says the rest. */
export function draftProblems(name: string, def: RuleDefinition, m: IotMessages['rules']): RuleProblem[] {
  const out: RuleProblem[] = [];
  if (!name.trim()) out.push({ path: ['name'], code: 'name', message: m.namePlaceholder });
  def.when.forEach((t, i) => {
    const p = ['when', i];
    if ((t.kind === 'value' || t.kind === 'status' || (t.kind === 'alarm' && 'target' in t)) && 'target' in t && !picked(t.target)) out.push({ path: [...p, 'target'], code: 'device', message: m.pickDevice });
    if (t.kind === 'value') {
      if (picked(t.target) && !t.key) out.push({ path: [...p, 'key'], code: 'key', message: m.pickValue });
      if (t.change !== 'any' && (t.value === undefined || t.value === '')) out.push({ path: [...p, 'value'], code: 'value', message: m.thanValue });
      if ((t.change === 'between' || t.change === 'outside') && (typeof t.value2 !== 'number' || !Number.isFinite(t.value2))) out.push({ path: [...p, 'value2'], code: 'value2', message: m.thanValue2 });
    }
    if (t.kind === 'date' && t.daysOfMonth && t.days) out.push({ path: [...p, 'days'], code: 'date_days_conflict', message: m.dateDaysConflict });
    if (t.kind === 'every' && !(t.minutes >= 1)) out.push({ path: [...p, 'minutes'], code: 'minutes', message: m.everyLabel });
  });
  if (def.onlyIf) conditionProblems(def.onlyIf, ['onlyIf'], m, out);
  actionProblems(def.then, ['then'], m, out);
  return out;
}

/** Problems of one path prefix (the editor shows each row's own). */
export const problemsAt = (all: readonly RuleProblem[], path: ReadonlyArray<string | number>): RuleProblem[] =>
  all.filter((p) => path.every((seg, i) => p.path[i] === seg));
