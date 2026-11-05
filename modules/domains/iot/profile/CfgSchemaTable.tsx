'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faMicrochip, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import { isCfgKey, type CfgKeySpec } from '../types/profile';

/**
 * CfgSchemaTable — a profile's fallback `cfg.*` allowlist (FZ-27, protocol 04 §5): key, type (integer, boolean, string), label, range
 * for integers, lengths for strings, allowed values, and the secret flag (a secret key is write-only everywhere: its value is never
 * shown, P-5 spirit). Read-only with a "from firmware" badge when a firmware's `profile.json` describes the keys. Drawn by the kit
 * DataTable (manual mode), one row per key with its inputs in the cells; a row's id is its position, so typing a key keeps the row.
 */
export type CfgSchemaTableProps = {
  value: CfgKeySpec[];
  onChange?: (next: CfgKeySpec[]) => void;
  fromFirmware?: string | null;
  readOnly?: boolean;
  error?: string;
  /** Errors of single cells by `<row>.<field>` (`2.enum`), already in words: the cell is marked and the error listed under the table. */
  fieldErrors?: Partial<Record<string, string>>;
  messages?: IotMessagesInput;
  className?: string;
};

const TYPES: Array<CfgKeySpec['type']> = ['integer', 'boolean', 'string'];
const cell = 'w-full min-w-0 rounded-md border border-border bg-surface-base px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50';
const num = (raw: string): number | undefined => (raw.trim() === '' ? undefined : Number(raw));
/** A row of the table: the key and its position (the row's id, so editing a key keeps its row). */
type CfgRow = { i: number; k: CfgKeySpec };

/**
 * The comma list of allowed values, typed by the key's type (integers as numbers, booleans as true / false). A part that does not fit
 * the type stays as the text typed, so the form refuses it (`invalid_enum`) instead of dropping it: a list with a typo never shrinks or
 * vanishes silently (a vanished list would lift the restriction).
 */
export function parseCfgEnum(raw: string, type: CfgKeySpec['type']): CfgKeySpec['enum'] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  if (type === 'integer') return parts.map((p) => (/^-?\d+$/.test(p) && Number.isSafeInteger(Number(p)) ? Number(p) : p));
  if (type === 'boolean') return parts.map((p) => (p === 'true' ? true : p === 'false' ? false : p));
  return parts;
}

export function CfgSchemaTable({ value, onChange, fromFirmware, readOnly, error, fieldErrors = {}, messages, className }: CfgSchemaTableProps) {
  const { m } = useIotText(messages);
  const locked = readOnly || !!fromFirmware;
  const keys = value.map((k) => k.key);
  const typeLabel = (t: CfgKeySpec['type']) => m.schema[`type_${t}`];
  // what is typed in an enum cell, kept until it parses (a trailing comma, a half-typed number)
  const [enumText, setEnumText] = useState<Record<number, string>>({});
  // the table the typed texts belong to: a table the host replaces (Save, Discard, a reload) drops them, so they never outlive it
  const [ownValue, setOwnValue] = useState<CfgKeySpec[] | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== ownValue) setEnumText({});
  }
  const emit = (next: CfgKeySpec[]) => { setOwnValue(next); onChange?.(next); };
  const set = (i: number, patch: Partial<CfgKeySpec>) => emit(value.map((k, j) => (j === i ? clean({ ...k, ...patch }) : k)));
  const cellError = (i: number, field: string) => fieldErrors[`${i}.${field}`];
  const listed = Object.entries(fieldErrors).filter((e): e is [string, string] => !!e[1]).map(([at, text]) => {
    const [row, field] = at.split('.');
    const k = value[Number(row)];
    const head = (m.schema as Record<string, string>)[field] ?? field;
    return `${k?.key || Number(row) + 1} · ${head}: ${text}`;
  });
  // rows keep their position as id: a key being typed never remounts its row (and never loses the caret)
  const rows: CfgRow[] = value.map((k, i) => ({ i, k }));
  const nameOf = ({ i, k }: CfgRow) => k.key || String(i + 1);
  const columns: Column<CfgRow>[] = [
    {
      key: 'key',
      header: m.schema.key,
      sortable: true,
      sortValue: (r) => r.k.key,
      searchValue: (r) => r.k.key,
      render: ({ i, k }) => {
        const bad = !isCfgKey(k.key) || keys.indexOf(k.key) !== i;
        return locked ? (
          <code className="inline-flex items-center gap-1 font-mono text-xs">{k.secret && <FontAwesomeIcon icon={faLock} className="h-3 w-3 text-text-secondary" aria-label={m.schema.secret} />}{k.key}</code>
        ) : (
          <input className={cn(cell, 'font-mono', (bad || cellError(i, 'key')) && 'border-error')} value={k.key} placeholder="cfg." maxLength={128} aria-label={`${m.schema.key} ${i + 1}`}
            aria-invalid={bad || !!cellError(i, 'key') || undefined} onChange={(e) => set(i, { key: e.target.value })} />
        );
      },
    },
    {
      key: 'type',
      header: m.schema.type,
      sortable: true,
      searchable: false,
      sortValue: (r) => r.k.type,
      render: (r) => (locked ? typeLabel(r.k.type) : (
        <select className={cell} value={r.k.type} aria-label={`${m.schema.type} ${nameOf(r)}`} onChange={(e) => {
          setEnumText((t) => Object.fromEntries(Object.entries(t).filter(([row]) => Number(row) !== r.i)));
          set(r.i, { type: e.target.value as CfgKeySpec['type'], enum: undefined, min: undefined, max: undefined, minLength: undefined, maxLength: undefined });
        }}>
          {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
      )),
    },
    {
      key: 'label',
      header: m.schema.label,
      sortable: true,
      sortValue: (r) => r.k.label ?? null,
      searchValue: (r) => r.k.label ?? '',
      render: (r) => (locked ? (r.k.label ?? '—') : <input className={cn(cell, cellError(r.i, 'label') && 'border-error')} value={r.k.label ?? ''} maxLength={128} aria-label={`${m.schema.label} ${nameOf(r)}`} aria-invalid={!!cellError(r.i, 'label') || undefined} onChange={(e) => set(r.i, { label: e.target.value })} />),
    },
    {
      key: 'range',
      header: `${m.schema.min} / ${m.schema.max}`,
      searchable: false,
      render: (r) => {
        const { i, k } = r;
        const name = nameOf(r);
        return k.type === 'boolean' ? '—' : locked ? (
          k.type === 'integer' ? `${k.min ?? '…'} – ${k.max ?? '…'}` : `${k.minLength ?? 0} – ${k.maxLength ?? '…'}`
        ) : (
          <span className="flex items-center gap-1">
            <input className={cn(cell, cellError(i, k.type === 'integer' ? 'min' : 'minLength') && 'border-error')} type="number" step={1}
              aria-invalid={!!cellError(i, k.type === 'integer' ? 'min' : 'minLength') || undefined}
              value={(k.type === 'integer' ? k.min : k.minLength) ?? ''}
              aria-label={`${k.type === 'integer' ? m.schema.min : m.schema.minLength} ${name}`}
              onChange={(e) => set(i, k.type === 'integer' ? { min: num(e.target.value) } : { minLength: num(e.target.value) })} />
            <input className={cn(cell, cellError(i, k.type === 'integer' ? 'max' : 'maxLength') && 'border-error')} type="number" step={1}
              aria-invalid={!!cellError(i, k.type === 'integer' ? 'max' : 'maxLength') || undefined}
              value={(k.type === 'integer' ? k.max : k.maxLength) ?? ''}
              aria-label={`${k.type === 'integer' ? m.schema.max : m.schema.maxLength} ${name}`}
              onChange={(e) => set(i, k.type === 'integer' ? { max: num(e.target.value) } : { maxLength: num(e.target.value) })} />
          </span>
        );
      },
    },
    {
      key: 'enum',
      header: m.schema.enum,
      searchValue: (r) => (r.k.enum ?? []).join(' '),
      render: (r) => {
        const { i, k } = r;
        const enumShown = enumText[i] ?? (k.enum ?? []).join(', ');
        return locked ? ((k.enum ?? []).join(', ') || '—') : (
          <input className={cn(cell, cellError(i, 'enum') && 'border-error')} value={enumShown} placeholder={m.schema.enumHint} aria-label={`${m.schema.enum} ${nameOf(r)}`}
            aria-invalid={!!cellError(i, 'enum') || undefined}
            onChange={(e) => { setEnumText((t) => ({ ...t, [i]: e.target.value })); set(i, { enum: parseCfgEnum(e.target.value, k.type) }); }} />
        );
      },
    },
    {
      key: 'secret',
      header: m.schema.secret,
      sortable: true,
      searchable: false,
      sortValue: (r) => (r.k.secret ? 1 : 0),
      render: (r) => (
        <input type="checkbox" checked={!!r.k.secret} disabled={locked} aria-label={`${m.schema.secret} ${nameOf(r)}`}
          onChange={(e) => set(r.i, { secret: e.target.checked })}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50" />
      ),
    },
    ...(locked ? [] : [{
      key: 'actions',
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      searchable: false,
      render: (r: CfgRow) => (
        <button type="button" onClick={() => { setEnumText({}); emit(value.filter((_, j) => j !== r.i)); }} aria-label={fill(m.schema.remove, { key: nameOf(r) })}
          className="rounded p-1.5 text-text-secondary hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    }]),
  ];
  const filterFields: DataTableFilterField<CfgRow>[] = [
    { id: 'type', label: m.schema.type, type: 'checkboxes', options: TYPES.map((t) => ({ value: t, label: typeLabel(t) })), match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(r.k.type) },
    { id: 'secret', label: m.schema.secret, type: 'checkbox', match: (r) => !!r.k.secret },
  ];
  return (
    <div className={cn('space-y-2', className)}>
      {fromFirmware && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <Badge variant="info" size="sm"><FontAwesomeIcon icon={faMicrochip} className="mr-1 h-3 w-3" aria-hidden="true" />{fill(m.schema.fromFirmware, { label: fromFirmware })}</Badge>
          {m.schema.readOnlyHint}
        </p>
      )}
      <DataTable<CfgRow>
        variant="plain"
        caption={m.schema.cfgTitle}
        columns={columns}
        rows={rows}
        rowId={(r) => r.i}
        mode="paginated"
        emptyMessage={m.schema.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        searchPlaceholder={m.schema.search}
        filterFields={filterFields}
        pageSize={25}
        pageSizeOptions={LIST_PAGE_SIZES}
        density="compact"
        tableClassName="min-w-[46rem]"
      />
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {listed.length > 0 && (
        <ul role="alert" className="list-inside list-disc text-xs text-error">{listed.map((line) => <li key={line}>{line}</li>)}</ul>
      )}
      {!locked && (
        <Button variant="outline" size="sm" onClick={() => emit([...value, { key: 'cfg.', type: 'integer' }])} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
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
