'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faMicrochip, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import { isCfgKey, type CfgKeySpec } from '../types/profile';

/**
 * CfgSchemaTable — a profile's fallback `cfg.*` allowlist (FZ-27, protocol 04 §5): key, type (integer, boolean, string), label, range
 * for integers, lengths for strings, allowed values, and the secret flag (a secret key is write-only everywhere: its value is never
 * shown, P-5 spirit). Read-only with a "from firmware" badge when a firmware's `profile.json` describes the keys.
 */
export type CfgSchemaTableProps = {
  value: CfgKeySpec[];
  onChange?: (next: CfgKeySpec[]) => void;
  fromFirmware?: string | null;
  readOnly?: boolean;
  error?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const TYPES: Array<CfgKeySpec['type']> = ['integer', 'boolean', 'string'];
const cell = 'w-full min-w-0 rounded-md border border-border bg-surface-base px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50';
const num = (raw: string): number | undefined => (raw.trim() === '' ? undefined : Number(raw));

/** The comma list of allowed values, typed by the key's type (integers as numbers, booleans as true / false). */
export function parseCfgEnum(raw: string, type: CfgKeySpec['type']): CfgKeySpec['enum'] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  if (type === 'integer') return parts.map(Number).filter((n) => Number.isInteger(n));
  if (type === 'boolean') return parts.filter((p) => p === 'true' || p === 'false').map((p) => p === 'true');
  return parts;
}

export function CfgSchemaTable({ value, onChange, fromFirmware, readOnly, error, messages, className }: CfgSchemaTableProps) {
  const { m } = useIotText(messages);
  const locked = readOnly || !!fromFirmware;
  const keys = value.map((k) => k.key);
  // what is typed in an enum cell, kept until it parses (a trailing comma, a half-typed number)
  const [enumText, setEnumText] = useState<Record<number, string>>({});
  const set = (i: number, patch: Partial<CfgKeySpec>) => onChange?.(value.map((k, j) => (j === i ? clean({ ...k, ...patch }) : k)));
  return (
    <div className={cn('space-y-2', className)}>
      {fromFirmware && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <Badge variant="info" size="sm"><FontAwesomeIcon icon={faMicrochip} className="mr-1 h-3 w-3" aria-hidden="true" />{fill(m.schema.fromFirmware, { label: fromFirmware })}</Badge>
          {m.schema.readOnlyHint}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">{m.schema.cfgTitle}</caption>
          <thead className="bg-surface-overlay text-left text-xs text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.key}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.type}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.label}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.min} / {m.schema.max}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.enum}</th>
              <th scope="col" className="px-3 py-2 font-medium">{m.schema.secret}</th>
              {!locked && <th scope="col" className="px-3 py-2"><span className="sr-only">{m.profiles.actions}</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {value.length === 0 && (
              <tr><td colSpan={locked ? 6 : 7} className="px-3 py-4 text-center text-text-secondary">{m.schema.empty}</td></tr>
            )}
            {value.map((k, i) => {
              const bad = !isCfgKey(k.key) || keys.indexOf(k.key) !== i;
              const name = k.key || String(i + 1);
              const enumShown = enumText[i] ?? (k.enum ?? []).join(', ');
              return (
                <tr key={i}>
                  <td className="px-3 py-1.5">
                    {locked ? (
                      <code className="inline-flex items-center gap-1 font-mono text-xs">{k.secret && <FontAwesomeIcon icon={faLock} className="h-3 w-3 text-text-secondary" aria-label={m.schema.secret} />}{k.key}</code>
                    ) : (
                      <input className={cn(cell, 'font-mono', bad && 'border-error')} value={k.key} placeholder="cfg." maxLength={128} aria-label={`${m.schema.key} ${i + 1}`}
                        aria-invalid={bad || undefined} onChange={(e) => set(i, { key: e.target.value })} />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? k.type : (
                      <select className={cell} value={k.type} aria-label={`${m.schema.type} ${name}`} onChange={(e) => {
                        setEnumText((t) => Object.fromEntries(Object.entries(t).filter(([row]) => Number(row) !== i)));
                        set(i, { type: e.target.value as CfgKeySpec['type'], enum: undefined, min: undefined, max: undefined, minLength: undefined, maxLength: undefined });
                      }}>
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? (k.label ?? '—') : <input className={cell} value={k.label ?? ''} maxLength={128} aria-label={`${m.schema.label} ${name}`} onChange={(e) => set(i, { label: e.target.value })} />}
                  </td>
                  <td className="px-3 py-1.5">
                    {k.type === 'boolean' ? '—' : locked ? (
                      k.type === 'integer' ? `${k.min ?? '…'} – ${k.max ?? '…'}` : `${k.minLength ?? 0} – ${k.maxLength ?? '…'}`
                    ) : (
                      <span className="flex items-center gap-1">
                        <input className={cell} type="number" step={1}
                          value={(k.type === 'integer' ? k.min : k.minLength) ?? ''}
                          aria-label={`${k.type === 'integer' ? m.schema.min : m.schema.minLength} ${name}`}
                          onChange={(e) => set(i, k.type === 'integer' ? { min: num(e.target.value) } : { minLength: num(e.target.value) })} />
                        <input className={cell} type="number" step={1}
                          value={(k.type === 'integer' ? k.max : k.maxLength) ?? ''}
                          aria-label={`${k.type === 'integer' ? m.schema.max : m.schema.maxLength} ${name}`}
                          onChange={(e) => set(i, k.type === 'integer' ? { max: num(e.target.value) } : { maxLength: num(e.target.value) })} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {locked ? ((k.enum ?? []).join(', ') || '—') : (
                      <input className={cell} value={enumShown} placeholder={m.schema.enumHint} aria-label={`${m.schema.enum} ${name}`}
                        onChange={(e) => { setEnumText((t) => ({ ...t, [i]: e.target.value })); set(i, { enum: parseCfgEnum(e.target.value, k.type) }); }} />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!!k.secret} disabled={locked} aria-label={`${m.schema.secret} ${name}`}
                      onChange={(e) => set(i, { secret: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50" />
                  </td>
                  {!locked && (
                    <td className="px-3 py-1.5 text-right">
                      <button type="button" onClick={() => { setEnumText({}); onChange?.(value.filter((_, j) => j !== i)); }} aria-label={fill(m.schema.remove, { key: name })}
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
        <Button variant="outline" size="sm" onClick={() => onChange?.([...value, { key: 'cfg.', type: 'integer' }])} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
          {m.schema.add}
        </Button>
      )}
    </div>
  );
}

function clean(k: CfgKeySpec): CfgKeySpec {
  const out: CfgKeySpec = { key: k.key, type: k.type };
  if (k.label) out.label = k.label;
  const n = (v: number | undefined) => typeof v === 'number' && Number.isFinite(v);
  if (k.type === 'integer') {
    if (n(k.min)) out.min = k.min;
    if (n(k.max)) out.max = k.max;
  }
  if (k.type === 'string') {
    if (n(k.minLength)) out.minLength = k.minLength;
    if (n(k.maxLength)) out.maxLength = k.maxLength;
  }
  if (k.enum && k.enum.length) out.enum = k.enum;
  if (k.secret) out.secret = true;
  return out;
}
