'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraBenchFrame } from './types';

/**
 * LoraCodecBench — the codec test bench (NB iot_lorawan_codecs 05; kui-react iot 10.7): an FPort and a payload in hex, Decode, and what the
 * codec made of it: every decoded key with its value and unit (a DataTable), warnings, errors and bytes left over. Decoder only (OD-106).
 * The host runs the frame (`onRun`, NB `POST …/codecs/[codecId]/test` or `…/codecs/test` for an unsaved table); a rejected promise's
 * message is shown. Checks the input first: FPort 1–255, hexadecimal digits (spaces and colons allowed), at most 255 bytes.
 */
export type LoraCodecBenchProps = {
  onRun: (fport: number, hex: string) => Promise<LoraBenchFrame>;
  /** A first payload to try (a codec's own test vector). */
  initial?: { fport: number; hex: string };
  messages?: LoraMessagesInput;
  idPrefix?: string;
};

type Row = { key: string; value: string; unit: string };

const cleanHex = (v: string) => v.replace(/[\s:]/g, '');
export const benchInputOk = (fport: string, hex: string): boolean => {
  const n = Number(fport);
  const h = cleanHex(hex);
  return Number.isInteger(n) && n >= 1 && n <= 255 && h.length > 0 && h.length % 2 === 0 && h.length <= 510 && /^[0-9A-Fa-f]+$/.test(h);
};

const flatValues = (v: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> => {
  if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatValues(x, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) out[prefix] = v;
  return out;
};

export function LoraCodecBench({ onRun, initial, messages, idPrefix = 'lora-bench' }: LoraCodecBenchProps) {
  const m = mergeLoraMessages(messages).bench;
  const [fport, setFport] = useState(String(initial?.fport ?? ''));
  const [hex, setHex] = useState(initial?.hex ?? '');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<LoraBenchFrame | null>(null);
  const rows = useMemo((): Row[] => {
    if (!frame?.fields) return [];
    const units = frame.keys ?? {};
    return Object.entries(flatValues(frame.fields)).map(([key, value]) => ({
      key, value: typeof value === 'string' ? value : JSON.stringify(value), unit: units[key.replace(/\.\d+(?=\.|$)/g, '.*')] ?? frame.units?.[key] ?? '',
    }));
  }, [frame]);
  const columns: Column<Row>[] = [
    { key: 'key', header: m.key, sortable: true, render: (r) => <code className="font-mono text-xs">{r.key}</code> },
    { key: 'value', header: m.value, render: (r) => <span className="font-mono text-xs">{r.value}</span> },
    { key: 'unit', header: m.unit, sortable: true, render: (r) => <span className="text-xs">{r.unit}</span> },
  ];
  const run = async () => {
    setTried(true);
    if (!benchInputOk(fport, hex)) return;
    setBusy(true); setError(null);
    try { setFrame(await onRun(Number(fport), cleanHex(hex))); } catch (e) { setFrame(null); setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const bad = tried && !benchInputOk(fport, hex);
  return (
    <section className="space-y-3" aria-labelledby={`${idPrefix}-title`}>
      <div>
        <h3 id={`${idPrefix}-title`} className="text-sm font-semibold text-text-primary">{m.title}</h3>
        <p className="text-xs text-text-secondary">{m.intro}</p>
      </div>
      <form className="grid gap-3 sm:grid-cols-[8rem,1fr,auto] sm:items-end" noValidate onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Input id={`${idPrefix}-fport`} label={m.fport} inputMode="numeric" value={fport} onChange={(e) => setFport(e.target.value)} />
        <Input id={`${idPrefix}-hex`} label={m.hex} hint={m.hexHint} value={hex} onChange={(e) => setHex(e.target.value)} className="font-mono" />
        <Button type="submit" loading={busy}>{m.run}</Button>
      </form>
      {bad && <Callout variant="warning">{m.invalid}</Callout>}
      {error && <Callout variant="danger">{error}</Callout>}
      {frame && (
        <div className="space-y-2">
          {rows.length
            ? (
              <DataTable<Row>
                mode="paginated" variant="plain" density="compact" caption={m.result} columns={columns} rows={rows} rowId={(r) => r.key}
                pageSize={20} searchPlaceholder={m.key} emptyMessage={m.nothing}
              />
            )
            : <p className="text-sm text-text-secondary">{m.nothing}</p>}
          {!!frame.errors?.length && <Callout variant="danger" title={m.errors}>{frame.errors.join('; ')}</Callout>}
          {!!frame.warnings?.length && <Callout variant="warning" title={m.warnings}>{frame.warnings.join('; ')}</Callout>}
          {frame.rest && <p className="font-mono text-xs text-text-secondary">{fillText(m.rest, { hex: frame.rest })}</p>}
        </div>
      )}
    </section>
  );
}
