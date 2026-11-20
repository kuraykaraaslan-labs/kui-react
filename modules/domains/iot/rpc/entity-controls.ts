/*
 * Pure helpers of the entity controls and command bindings views (NB 42-telemetry/14, iot-rpc 04): tier words and badge tones, the
 * bound targets of a control in words, a control's params checked before sending, the idempotency key of a press, and a binding's
 * draft as the host's input.
 */
import type { FieldSchema } from '@/modules/app/SchemaForm/types';
import type { IotMessages } from '../messages';
import { fill } from '../format';
import type {
  BindableCommand, CommandBinding, CommandBindingInput, CommandBindingParamSource, CommandBindingTargetType, ControlBindingSummary, ControlParamSpec,
  ControlTier, EntityControl, EntityControlsView,
} from '../types/rpc';

export const tierVariant = (t: ControlTier): 'neutral' | 'warning' | 'error' => (t === 'critical' ? 'error' : t === 'privileged' ? 'warning' : 'neutral');
export const tierText = (t: ControlTier, m: IotMessages): string => (m.controls as Record<string, string>)[`tier_${t}`] ?? t;

/** What every sink has bound to one control: the labels the viewer may read, and how many more there are. */
export function boundOf(view: Pick<EntityControlsView, 'sinks'>, control: string): { labels: string[]; count: number } {
  const labels: string[] = [];
  let count = 0;
  for (const s of view.sinks) {
    for (const b of s.bindings as ControlBindingSummary[]) {
      if (b.control !== control) continue;
      if (Array.isArray(b.targets)) {
        labels.push(...b.targets.map((t) => t.label));
        count += b.targets.length;
      } else count += Math.max(0, b.targets.count);
    }
  }
  return { labels, count };
}

/** The bound targets of a control in words: the labels when every one may be read, else the count, else "Not connected". */
export function boundText(view: Pick<EntityControlsView, 'sinks'>, control: string, m: IotMessages): string {
  const { labels, count } = boundOf(view, control);
  if (!count) return m.controls.notConnected;
  if (labels.length === count) return labels.join(', ');
  return fill(count === 1 ? m.controls.boundTargets_one : m.controls.boundTargets, { n: count });
}

/** A fresh key for one press (the host dedupes every target on it). */
export function newPressKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const id = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `press-${id}`;
}

/** The typed value of one param from its text field, or the problem in words (empty optional: undefined). */
export function controlParamValue(spec: ControlParamSpec, raw: string | boolean, m: IotMessages): { value?: unknown; problem?: string } {
  if (spec.type === 'boolean') return { value: raw === true || raw === 'true' };
  const text = String(raw ?? '').trim();
  if (!text) return spec.required ? { problem: m.controls.required } : {};
  if (spec.type === 'number' || spec.type === 'integer') {
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n)) return { problem: m.controls.notNumber };
    if (spec.type === 'integer' && !Number.isInteger(n)) return { problem: m.controls.notInteger };
    if (spec.min !== undefined && n < spec.min) return { problem: fill(m.controls.tooSmall, { n: spec.min }) };
    if (spec.max !== undefined && n > spec.max) return { problem: fill(m.controls.tooBig, { n: spec.max }) };
    return { value: n };
  }
  if (spec.type === 'text') return text.length > spec.maxLength ? { problem: fill(m.controls.tooLong, { n: spec.maxLength }) } : { value: text };
  if (spec.type === 'select') return spec.options.some((o) => o.value === text) ? { value: text } : { problem: m.controls.required };
  return { problem: m.controls.required };
}

/** Every param of a control checked: the values to send, or the problems by param. */
export function controlParams(control: EntityControl, raw: Record<string, string | boolean>, m: IotMessages): { params: Record<string, unknown>; problems: Record<string, string> } {
  const params: Record<string, unknown> = {};
  const problems: Record<string, string> = {};
  for (const [key, spec] of Object.entries(control.params ?? {})) {
    const r = controlParamValue(spec, raw[key] ?? (spec.type === 'boolean' ? false : ''), m);
    if (r.problem) problems[key] = r.problem;
    else if (r.value !== undefined) params[key] = r.value;
  }
  return { params, problems };
}

/** What a binding sends, in words: the command's label, or "Sets a, b". */
export function sendsText(b: Pick<CommandBinding, 'targetType' | 'commandLabel' | 'method' | 'paramMap' | 'state'>, m: IotMessages): string {
  if (b.targetType === 'ATTRIBUTES') return fill(m.controls.sendsValues, { keys: Object.keys(b.paramMap ?? {}).join(', ') });
  return b.commandLabel ?? m.controls.state_command_gone;
}

export const stateText = (s: CommandBinding['state'], m: IotMessages): string => (m.controls as Record<string, string>)[`state_${s}`] ?? s;

/** One row of a draft's param map. `source`: a control param, or `fixed` (a value typed here). */
export type ParamRow = { id: string; key: string; source: 'fixed' | `from:${string}`; value: string };

/** The rows of a stored map (the command's params first, in its order, then any other key). */
export function paramRowsOf(map: Record<string, CommandBindingParamSource>, schema?: Record<string, FieldSchema>): ParamRow[] {
  const keys = [...Object.keys(schema ?? {}), ...Object.keys(map).filter((k) => !(schema && k in schema))];
  return keys.map((key, i) => {
    const src = map[key];
    if (src && 'from' in src) return { id: `p${i}`, key, source: `from:${src.param}`, value: '' };
    const v = src && 'const' in src ? src.const : undefined;
    return { id: `p${i}`, key, source: 'fixed', value: v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v) };
  });
}

/** A fixed value as the device param's type wants it (a number, a boolean), or JSON / text for a device value. */
export function fixedValueOf(text: string, field?: FieldSchema): unknown {
  const t = text.trim();
  if (field?.type === 'number') {
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : t;
  }
  if (field?.type === 'boolean') return t === 'true' ? true : t === 'false' ? false : t;
  if (field) return t;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** The rows as the host's map: a control param, or a fixed value that is not empty. */
export function paramMapOf(rows: readonly ParamRow[], schema?: Record<string, FieldSchema>): Record<string, CommandBindingParamSource> {
  const out: Record<string, CommandBindingParamSource> = {};
  for (const r of rows) {
    const key = r.key.trim();
    if (!key) continue;
    if (r.source.startsWith('from:')) out[key] = { from: 'control', param: r.source.slice(5) };
    else if (r.value.trim() !== '') out[key] = { const: fixedValueOf(r.value, schema?.[key]) };
  }
  return out;
}

export type BindingDraft = {
  targetKind: string;
  targetEntityId: string;
  targetLabel: string | null;
  control: string;
  deviceId: string;
  deviceName: string | null;
  targetType: CommandBindingTargetType;
  method: string;
  rows: ParamRow[];
  position: number;
  enabled: boolean;
  note: string;
};

export function draftOf(b: CommandBinding | null | undefined, fixed: Partial<BindingDraft> = {}): BindingDraft {
  return {
    targetKind: b?.targetKind ?? fixed.targetKind ?? '',
    targetEntityId: b?.targetEntityId ?? fixed.targetEntityId ?? '',
    targetLabel: b?.targetLabel ?? fixed.targetLabel ?? null,
    control: b?.control ?? fixed.control ?? '',
    deviceId: b?.deviceId ?? fixed.deviceId ?? '',
    deviceName: b?.deviceName ?? fixed.deviceName ?? null,
    targetType: b?.targetType ?? 'COMMAND',
    method: b?.method ?? '',
    rows: b ? paramRowsOf(b.paramMap) : [],
    position: b?.position ?? 0,
    enabled: b?.enabled ?? true,
    note: b?.note ?? '',
  };
}

export function inputOf(d: BindingDraft, command?: BindableCommand | null): CommandBindingInput {
  return {
    targetKind: d.targetKind, targetEntityId: d.targetEntityId, control: d.control, deviceId: d.deviceId, targetType: d.targetType,
    method: d.targetType === 'COMMAND' ? d.method || null : null,
    paramMap: paramMapOf(d.rows, d.targetType === 'COMMAND' ? command?.paramsSchema : undefined),
    position: d.position, enabled: d.enabled, note: d.note.trim() || null,
  };
}

/** The draft names a record, a control and a device (and a command, when it runs one). */
export const draftComplete = (d: BindingDraft): boolean =>
  !!(d.targetKind && d.targetEntityId && d.control && d.deviceId && (d.targetType === 'ATTRIBUTES' || d.method));
