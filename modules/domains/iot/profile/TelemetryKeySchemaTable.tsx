'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import { isTelemetryKey, type TelemetryKeySpec } from '../types/profile';

/**
 * TelemetryKeySchemaTable — a profile's fallback telemetry keys (01 §1.1, P-4): key, type, unit, label, expected range and decimals,
 * used for devices whose firmware description is unknown. Editable rows (a bad or duplicate key is marked where it is); read-only with
 * a "from firmware" badge when the keys come from a firmware's `profile.json`. Drawn by the kit DataTable (manual mode), one row per key
 * with its inputs in the cells; a row's id is its position, so typing a key keeps the row.
 *
 * The type reads in words ("Number", "Yes / no", …; "Not set" for an untyped key) and a new row starts as a number. A row's key is
 * marked only once it was typed in or left (or `showAll`, after a Save press), and the table's error waits for that too: a row just added
 * is not red before any input. Any other error (the host's refusal of a unit, a decimals value, the size of the table) shows at once.
 */
export type TelemetryKeySchemaTableProps = {
  value: TelemetryKeySpec[];
  onChange?: (next: TelemetryKeySpec[]) => void;
  /** The keys come from a firmware description: read-only with its label (`roltek-esp32 1.8.2`). */
  fromFirmware?: string | null;
  readOnly?: boolean;
  error?: string;
  /** Mark every row, new empty ones included (the host's form after a Save press with something to fix). */
  showAll?: boolean;
  messages?: IotMessagesInput;
  className?: string;
};

const TYPES: Array<NonNullable<TelemetryKeySpec['type']>> = ['number', 'integer', 'boolean', 'string', 'json'];
const cell = 'w-full min-w-0 rounded-md border border-border bg-surface-base px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50';
const num = (raw: string): number | undefined => (raw.trim() === '' ? undefined : Number(raw));
/** A row of the table: the key and its position (the row's id, so editing a key keeps its row). */
type TelemetryRow = { i: number; k: TelemetryKeySpec };

export function TelemetryKeySchemaTable({ value, onChange, fromFirmware, readOnly, error, showAll = false, messages, className }: TelemetryKeySchemaTableProps) {
  const { m } = useIotText(messages);
  const [touched, setTouched] = useState<ReadonlySet<number>>(() => new Set());
  const locked = readOnly || !!fromFirmware;
  const typeLabel = (t: TelemetryKeySpec['type']) => (t ? m.schema[`type_${t}`] : m.schema.notSet);
  // an empty key nobody has typed in or left yet is not an error yet (the save stays blocked by the host's checks all the same)
  const pending = (i: number, k: TelemetryKeySpec) => !showAll && k.key === '' && !touched.has(i);
  const isBad = (i: number, k: TelemetryKeySpec) => !pending(i, k) && (!isTelemetryKey(k.key) || value.findIndex((x) => x.key === k.key) !== i);
  // an error waits only while rows nobody has typed in or left yet are all that is wrong with the keys (the error is then theirs)
  const shownError = error && (value.some((k, i) => isBad(i, k)) || !value.some((k, i) => pending(i, k))) ? error : undefined;
  const set = (i: number, patch: Partial<TelemetryKeySpec>) => onChange?.(value.map((k, j) => (j === i ? clean({ ...k, ...patch }) : k)));
  // rows keep their position as id: a key being typed never remounts its row (and never loses the caret)
  const rows: TelemetryRow[] = value.map((k, i) => ({ i, k }));
  const nameOf = ({ i, k }: TelemetryRow) => k.key || i + 1;
  const columns: Column<TelemetryRow>[] = [
    {
      key: 'key',
      header: m.schema.key,
      sortable: true,
      sortValue: (r) => r.k.key,
      searchValue: (r) => r.k.key,
      render: ({ i, k }) => {
        const bad = isBad(i, k);
        return locked ? <code className="font-mono text-xs">{k.key}</code> : (
          <input className={cn(cell, 'min-w-[8rem] font-mono', bad && 'border-error')} value={k.key} aria-label={`${m.schema.key} ${i + 1}`} aria-invalid={bad || undefined}
            maxLength={64} onChange={(e) => set(i, { key: e.target.value })} onBlur={() => setTouched((t) => (t.has(i) ? t : new Set(t).add(i)))} />
        );
      },
    },
    {
      key: 'type',
      header: m.schema.type,
      sortable: true,
      searchable: false,
      sortValue: (r) => r.k.type ?? null,
      render: (r) => (locked ? typeLabel(r.k.type) : (
        <select className={cn(cell, 'min-w-[7rem]')} value={r.k.type ?? ''} aria-label={`${m.schema.type} ${nameOf(r)}`}
          onChange={(e) => set(r.i, { type: (e.target.value || undefined) as TelemetryKeySpec['type'] })}>
          <option value="">{m.schema.notSet}</option>
          {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
      )),
    },
    {
      key: 'unit',
      header: m.schema.unit,
      sortable: true,
      sortValue: (r) => r.k.unit ?? null,
      searchValue: (r) => r.k.unit ?? '',
      render: (r) => (locked ? (r.k.unit ?? '—') : <input className={cell} value={r.k.unit ?? ''} maxLength={32} aria-label={`${m.schema.unit} ${nameOf(r)}`} onChange={(e) => set(r.i, { unit: e.target.value })} />),
    },
    {
      key: 'label',
      header: m.schema.label,
      sortable: true,
      sortValue: (r) => r.k.label ?? null,
      searchValue: (r) => r.k.label ?? '',
      render: (r) => (locked ? (r.k.label ?? '—') : <input className={cn(cell, 'min-w-[10rem]')} value={r.k.label ?? ''} maxLength={128} aria-label={`${m.schema.label} ${nameOf(r)}`} onChange={(e) => set(r.i, { label: e.target.value })} />),
    },
    {
      key: 'min',
      header: m.schema.min,
      searchable: false,
      render: (r) => (locked ? (r.k.min ?? '—') : <input className={cell} type="number" value={r.k.min ?? ''} aria-label={`${m.schema.min} ${nameOf(r)}`} onChange={(e) => set(r.i, { min: num(e.target.value) })} />),
    },
    {
      key: 'max',
      header: m.schema.max,
      searchable: false,
      render: (r) => (locked ? (r.k.max ?? '—') : <input className={cell} type="number" value={r.k.max ?? ''} aria-label={`${m.schema.max} ${nameOf(r)}`} onChange={(e) => set(r.i, { max: num(e.target.value) })} />),
    },
    {
      key: 'decimals',
      header: m.schema.decimals,
      searchable: false,
      render: (r) => (locked ? (r.k.decimals ?? '—') : <input className={cell} type="number" min={0} max={10} value={r.k.decimals ?? ''} aria-label={`${m.schema.decimals} ${nameOf(r)}`} onChange={(e) => set(r.i, { decimals: num(e.target.value) })} />),
    },
    ...(locked ? [] : [{
      key: 'actions',
      searchable: false,
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      render: (r: TelemetryRow) => (
        <button type="button" onClick={() => { setTouched((t) => new Set([...t].filter((j) => j !== r.i).map((j) => (j > r.i ? j - 1 : j)))); onChange?.(value.filter((_, j) => j !== r.i)); }} aria-label={fill(m.schema.remove, { key: r.k.key || String(r.i + 1) })}
          className="rounded p-1.5 text-text-secondary hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    }]),
  ];
  return (
    <div className={cn('space-y-2', className)}>
      {fromFirmware && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <Badge variant="info" size="sm"><FontAwesomeIcon icon={faMicrochip} className="mr-1 h-3 w-3" aria-hidden="true" />{fill(m.schema.fromFirmware, { label: fromFirmware })}</Badge>
          {m.schema.readOnlyHint}
        </p>
      )}
      <DataTable<TelemetryRow>
        mode="paginated"
        variant="plain"
        caption={m.schema.telemetryTitle}
        columns={columns}
        rows={rows}
        rowId={(r) => r.i}
        emptyMessage={m.schema.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        searchPlaceholder={m.schema.search}
        filterFields={[{ id: 'type', label: m.schema.type, type: 'checkboxes', options: TYPES.map((t) => ({ value: t, label: typeLabel(t) })), match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(r.k.type ?? '') }]}
        pageSize={25}
        pageSizeOptions={LIST_PAGE_SIZES}
        density="compact"
        tableClassName="min-w-[48rem]"
      />
      {shownError && <p role="alert" className="text-xs text-error">{shownError}</p>}
      {!locked && (
        <Button variant="outline" size="sm" onClick={() => onChange?.([...value, { key: '', type: 'number' }])} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
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
