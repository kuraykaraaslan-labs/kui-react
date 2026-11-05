'use client';
import { Button } from '@/modules/ui/Button';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { fill } from '../format';
import type { OtaMessages, OtaMessagesInput } from './messages';
import { useOtaText } from './OtaText';
import type { OtaWaveSpec } from './types';

/** The most waves a rollout takes (NB iot_ota MAX_WAVES). */
export const OTA_MAX_WAVES = 20;

const GATES = { minSuccessPct: 90, maxFailurePct: 5, maxFailures: null, maxDurationMin: 240 } as const;

/** The usual plan (NB iot_ota 03 §3.1): a 1 % canary (1 to 10 devices), then 10 %, 50 % and the rest; 5 % failed at most, 90 % updated at least. */
export function defaultOtaWaves(deviceCount = 0): OtaWaveSpec[] {
  const canary = Math.max(1, Math.min(10, Math.round(deviceCount / 100)));
  return [
    { size: { count: canary }, soakMin: 30, ...GATES },
    { size: { percent: 10 }, soakMin: 30, ...GATES },
    { size: { percent: 50 }, soakMin: 15, ...GATES },
    { size: { percent: 100 }, soakMin: 0, ...GATES },
  ];
}

const ok = (n: unknown, min: number, max: number, int = true): boolean => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n));

/** What is wrong with a plan, in words, or null. The last wave's size is not looked at (it takes the rest). */
export function otaWavesProblem(m: OtaMessages, waves: readonly OtaWaveSpec[]): string | null {
  const problem = (p: string) => fill(m.waves.invalid, { problem: p });
  if (!waves.length || waves.length > OTA_MAX_WAVES) return problem(m.waves.problemCount);
  for (const [i, w] of waves.entries()) {
    const last = i === waves.length - 1;
    if (!last && ('percent' in w.size ? !ok(w.size.percent, 0.01, 100, false) : !ok(w.size.count, 1, 100_000))) return problem(m.waves.problemSize);
    if (!ok(w.minSuccessPct, 0, 100, false) || !ok(w.maxFailurePct, 0, 100, false)) return problem(m.waves.problemPct);
    if (w.maxFailures !== null && w.maxFailures !== undefined && !ok(w.maxFailures, 0, 100_000)) return problem(m.waves.problemSize);
    if (!ok(w.soakMin, 0, 10_080)) return problem(m.waves.problemSoak);
    if (!ok(w.maxDurationMin, 5, 43_200)) return problem(m.waves.problemDuration);
  }
  return null;
}

/** The plan as the API takes it: the last wave's size is the rest (100 %). */
export function otaWavesForApi(waves: readonly OtaWaveSpec[]): OtaWaveSpec[] {
  return waves.map((w, i) => ({ ...w, maxFailures: w.maxFailures ?? null, ...(i === waves.length - 1 ? { size: { percent: 100 } } : {}) }));
}

export interface OtaWavesEditorProps {
  value: OtaWaveSpec[];
  onChange: (waves: OtaWaveSpec[]) => void;
  /** The devices the assignment covers, for "Use the usual plan". */
  deviceCount?: number;
  disabled?: boolean;
  messages?: OtaMessagesInput | OtaMessages;
  locale?: string;
}

const num = (v: string): number => (v.trim() === '' ? Number.NaN : Number(v));
const shown = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? String(n) : '');

/**
 * OtaWavesEditor — the waves of a rollout as a list of small forms: each wave's size (a count or a share of the devices to update; the last
 * wave takes the rest), the wait after it passed, its gates (at least updated, at most failed as a share and as a count) and how long it stays
 * open. Add, remove, or start again from the usual plan. It only edits the draft it is given: nothing is saved until the drawer's Assign.
 */
export function OtaWavesEditor({ value, onChange, deviceCount = 0, disabled, messages, locale }: OtaWavesEditorProps) {
  const { m } = useOtaText(messages as OtaMessagesInput, locale);
  const set = (i: number, patch: Partial<OtaWaveSpec>) => onChange(value.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const problem = otaWavesProblem(m, value);
  return (
    <section className="space-y-3" aria-label={m.waves.editorTitle} data-ota-waves-editor>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.waves.editorTitle}</h3>
        <Button size="xs" variant="ghost" onClick={() => onChange(defaultOtaWaves(deviceCount))} disabled={disabled}>{m.waves.useDefault}</Button>
      </div>
      <p className="text-xs text-text-secondary">{m.waves.editorIntro}</p>
      <ol className="space-y-3">
        {value.map((w, i) => {
          const last = i === value.length - 1;
          const n = i + 1;
          const kind = 'percent' in w.size ? 'percent' : 'count';
          const size = 'percent' in w.size ? w.size.percent : w.size.count;
          const id = (k: string) => `ota-wave-${i}-${k}`;
          return (
            <li key={i} className="rounded-md border border-border bg-surface-raised p-3" data-ota-wave={i}>
              <fieldset className="space-y-3" disabled={disabled}>
                <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium text-text-primary">
                  <span>{fill(m.waves.wave, { n })}{last ? ` · ${m.waves.rest}` : ''}</span>
                  {value.length > 1 && (
                    <Button size="xs" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={fill(m.waves.remove, { n })}>
                      {fill(m.waves.remove, { n })}
                    </Button>
                  )}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {last ? (
                    <p className="text-xs text-text-secondary sm:col-span-2">{m.waves.restHint}</p>
                  ) : (
                    <>
                      <Select
                        id={id('kind')} label={m.waves.sizeKind} value={kind}
                        onChange={(e) => set(i, { size: e.target.value === 'percent' ? { percent: 10 } : { count: 1 } })}
                        options={[{ value: 'percent', label: m.waves.percent }, { value: 'count', label: m.waves.count }]}
                      />
                      <Input
                        id={id('size')} label={kind === 'percent' ? m.waves.percent : m.waves.count} type="number" inputMode="decimal"
                        min={kind === 'percent' ? 0.01 : 1} max={kind === 'percent' ? 100 : 100_000} step={kind === 'percent' ? 'any' : 1}
                        value={shown(size)} onChange={(e) => set(i, { size: kind === 'percent' ? { percent: num(e.target.value) } : { count: num(e.target.value) } })}
                      />
                    </>
                  )}
                  <Input
                    id={id('success')} label={m.waves.minSuccessPct} type="number" min={0} max={100} step="any" value={shown(w.minSuccessPct)}
                    onChange={(e) => set(i, { minSuccessPct: num(e.target.value) })}
                  />
                  <Input
                    id={id('failure')} label={m.waves.maxFailurePct} type="number" min={0} max={100} step="any" value={shown(w.maxFailurePct)}
                    onChange={(e) => set(i, { maxFailurePct: num(e.target.value) })}
                  />
                  <Input
                    id={id('failures')} label={m.waves.maxFailures} hint={m.waves.maxFailuresHint} type="number" min={0} step={1} value={shown(w.maxFailures)}
                    onChange={(e) => set(i, { maxFailures: e.target.value.trim() === '' ? null : num(e.target.value) })}
                  />
                  <Input
                    id={id('duration')} label={m.waves.maxDurationMin} hint={m.waves.maxDurationHint} type="number" min={5} step={1} value={shown(w.maxDurationMin)}
                    onChange={(e) => set(i, { maxDurationMin: num(e.target.value) })}
                  />
                  {!last && (
                    <Input
                      id={id('soak')} label={m.waves.soakMin} type="number" min={0} step={1} value={shown(w.soakMin)}
                      onChange={(e) => set(i, { soakMin: num(e.target.value) })}
                    />
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      {value.length < OTA_MAX_WAVES && (
        <Button
          size="sm" variant="outline" disabled={disabled}
          onClick={() => onChange([...value.slice(0, -1), { size: { percent: 10 }, soakMin: 30, ...GATES }, ...value.slice(-1)])}
        >
          {m.waves.add}
        </Button>
      )}
      {problem && <p className="text-sm text-error" role="alert">{problem}</p>}
    </section>
  );
}
