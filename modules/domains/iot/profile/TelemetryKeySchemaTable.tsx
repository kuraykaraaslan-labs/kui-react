'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import { isTelemetryKey, type TelemetryKeySpec } from '../types/profile';

/**
 * TelemetryKeySchemaTable — a profile's fallback telemetry keys (01 §1.1, P-4): key, type, unit, label, expected range and decimals,
 * used for devices whose firmware description is unknown. Editable rows (a bad or duplicate key is marked where it is); read-only with
 * a "from firmware" badge when the keys come from a firmware's `profile.json`.
 */
export type TelemetryKeySchemaTableProps = {
  value: TelemetryKeySpec[];
  onChange?: (next: TelemetryKeySpec[]) => void;
  /** The keys come from a firmware description: read-only with its label (`roltek-esp32 1.8.2`). */
  fromFirmware?: string | null;
  readOnly?: boolean;
  error?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const TYPES: Array<NonNullable<TelemetryKeySpec['type']>> = ['number', 'integer', 'boolean', 'string', 'json'];
const cell = 'w-full min-w-0 rounded-md border border-border bg-surface-base px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50';
const num = (raw: string): number | undefined => (raw.trim() === '' ? undefined : Number(raw));

export function TelemetryKeySchemaTable({ value, onChange, fromFirmware, readOnly, error, messages, className }: TelemetryKeySchemaTableProps) {
  const { m } = useIotText(messages);
  const locked = readOnly || !!fromFirmware;
  const keys = value.map((k) => k.key);
  const set = (i: number, patch: Partial<TelemetryKeySpec>) => onChange?.(value.map((k, j) => (j === i ? clean({ ...k, ...patch }) : k)));
  return (
    <div className={cn('space-y-2', className)}>
      {fromFirmware && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <Badge variant="info" size="sm"><FontAwesomeIcon icon={faMicrochip} className="mr-1 h-3 w-3" aria-hidden="true" />{fill(m.schema.fromFirmware, { label: fromFirmware })}</Badge>
          {m.schema.readOnlyHint}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[42rem] text-sm">
          <caption className="sr-only">{m.schema.telemetryTitle}</caption>
          <thead className="bg-surface-overlay text-left text-xs text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.key}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.type}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.unit}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.label}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.min}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.max}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.decimals}</th>
              {!locked && <th scope="col" className="px-3 py-2"><span className="sr-only">{m.profiles.actions}</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {value.length === 0 && (
              <tr><td colSpan={locked ? 7 : 8} className="px-3 py-4 text-center text-text-secondary">{m.schema.empty}</td></tr>
            )}
            {value.map((k, i) => {
              const bad = !isTelemetryKey(k.key) || keys.indexOf(k.key) !== i;
              return (
                <tr key={i}>
                  <td className="px-3 py-1.5">
                    {locked ? <code className="font-mono text-xs">{k.key}</code> : (
                      <input className={cn(cell, 'font-mono', bad && 'border-error')} value={k.key} aria-label={`${m.schema.key} ${i + 1}`} aria-invalid={bad || undefined}
                        maxLength={64} onChange={(e) => set(i, { key: e.target.value })} />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.type ?? m.schema.any) : (
                      <select className={cell} value={k.type ?? ''} aria-label={`${m.schema.type} ${k.key || i + 1}`}
                        onChange={(e) => set(i, { type: (e.target.value || undefined) as TelemetryKeySpec['type'] })}>
                        <option value="">{m.schema.any}</option>
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.unit ?? '—') : <input className={cell} value={k.unit ?? ''} maxLength={32} aria-label={`${m.schema.unit} ${k.key || i + 1}`} onChange={(e) => set(i, { unit: e.target.value })} />}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.label ?? '—') : <input className={cell} value={k.label ?? ''} maxLength={128} aria-label={`${m.schema.label} ${k.key || i + 1}`} onChange={(e) => set(i, { label: e.target.value })} />}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.min ?? '—') : <input className={cell} type="number" value={k.min ?? ''} aria-label={`${m.schema.min} ${k.key || i + 1}`} onChange={(e) => set(i, { min: num(e.target.value) })} />}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.max ?? '—') : <input className={cell} type="number" value={k.max ?? ''} aria-label={`${m.schema.max} ${k.key || i + 1}`} onChange={(e) => set(i, { max: num(e.target.value) })} />}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.decimals ?? '—') : <input className={cell} type="number" min={0} max={10} value={k.decimals ?? ''} aria-label={`${m.schema.decimals} ${k.key || i + 1}`} onChange={(e) => set(i, { decimals: num(e.target.value) })} />}
                  </td>
                  {!locked && (
                    <td className="px-3 py-1.5 text-right">
                      <button type="button" onClick={() => onChange?.(value.filter((_, j) => j !== i))} aria-label={fill(m.schema.remove, { key: k.key || String(i + 1) })}
                        className="rounded p-1.5 text-text-secondary hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                        <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {!locked && (
        <Button variant="outline" size="sm" onClick={() => onChange?.([...value, { key: '' }])} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
          {m.schema.add}
        </Button>
      )}
    </div>
  );
}

/** Drops empty optional fields (the host refuses unknown and empty values alike). */
function clean(k: TelemetryKeySpec): TelemetryKeySpec {
  const out: TelemetryKeySpec = { key: k.key };
  if (k.type) out.type = k.type;
  if (k.unit) out.unit = k.unit;
  if (k.label) out.label = k.label;
  if (typeof k.min === 'number' && Number.isFinite(k.min)) out.min = k.min;
  if (typeof k.max === 'number' && Number.isFinite(k.max)) out.max = k.max;
  if (typeof k.decimals === 'number' && Number.isFinite(k.decimals)) out.decimals = k.decimals;
  return out;
}
