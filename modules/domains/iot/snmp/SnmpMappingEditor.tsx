'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { fillSnmp, issueText, mergeSnmpMessages, type SnmpMessages, type SnmpMessagesInput } from './messages';
import { SnmpScalarDrawer, SnmpTableDrawer, SnmpTrapDrawer } from './SnmpRowDrawers';
import {
  SNMP_DEFAULT_LIMITS, SNMP_POLL_RANGES, expectedKeys, normaliseOid, rowIssues, snmpMappingIssues, tableKeyPreview,
  type SnmpLimits, type SnmpMapping, type SnmpMappingIssue, type SnmpScalarRow, type SnmpTableMapping, type SnmpTestPollVarbind, type SnmpTrapMapping,
} from './types';

/**
 * SnmpMappingEditor — the OID → key mapping of an SNMP device profile (kui-react iot 11.3; NB iot_gateway 11.1, D307): the values (scalar
 * OIDs), the walked tables and the trap rows, each a list on the kit DataTable (search, sort, paging) whose row opens a drawer, plus the
 * poll settings and the expected key count with a warning above the profile's key limit. Controlled: `value` is the draft block, every
 * change goes to `onChange`; the host saves (see `SnmpMappingView`). Problems are judged here as the host would (`snmpMappingIssues`) and
 * the host's own refusal (`serverIssues`, the same paths) is shown on the rows it names. Unknown fields of the block are kept.
 */
export type SnmpMappingEditorProps = {
  value: SnmpMapping;
  onChange?: (next: SnmpMapping) => void;
  serverIssues?: readonly SnmpMappingIssue[];
  limits?: SnmpLimits;
  readOnly?: boolean;
  /** The template the profile was copied from (`snmp-ups-rfc1628 v2`): the "from template" hint. */
  template?: string | null;
  /** The last test poll's answers by OID (previews in the value drawer). */
  samples?: ReadonlyMap<string, SnmpTestPollVarbind>;
  /** Controls at the right of the title (the test poll button). */
  actions?: React.ReactNode;
  messages?: SnmpMessagesInput;
  className?: string;
};

type Editing =
  | { kind: 'scalar'; index: number | null; row: SnmpScalarRow }
  | { kind: 'table'; index: number | null; table: SnmpTableMapping }
  | { kind: 'trap'; index: number | null; trap: SnmpTrapMapping }
  | null;

type ScalarItem = SnmpScalarRow & { i: number; bad: boolean };
type TableItem = SnmpTableMapping & { i: number; bad: boolean; label: string };
type TrapItem = SnmpTrapMapping & { i: number; bad: boolean };

const without = <T,>(list: readonly T[], i: number) => list.filter((_, j) => j !== i);
const put = <T,>(list: readonly T[], i: number | null, item: T) => { const next = [...list]; next[i ?? next.length] = item; return next; };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
      <header>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function Problems({ m, issues }: { m: SnmpMessages; issues: readonly SnmpMappingIssue[] }) {
  // issues of the block itself (no row path): the budget and the poll settings are shown by their own cards
  const own = issues.filter((i) => !/^(mapping|tables|traps)\.\d+/.test(i.path) && !['tables', 'mapping', ...Object.keys(SNMP_POLL_RANGES)].includes(i.path));
  if (!own.length) return null;
  return (
    <Callout variant="danger" title={null}>
      <ul className="list-inside list-disc text-sm">{own.map((i) => <li key={`${i.path}:${i.message}`}>{fillSnmp(m.editor.blockIssue, { path: i.path || '—', issue: issueText(m, i.message) })}</li>)}</ul>
    </Callout>
  );
}

export function SnmpMappingEditor({
  value, onChange, serverIssues = [], limits = SNMP_DEFAULT_LIMITS, readOnly: readOnlyProp, template, samples, actions, messages, className,
}: SnmpMappingEditorProps) {
  const m = useMemo(() => mergeSnmpMessages(messages), [messages]);
  const readOnly = readOnlyProp || !onChange;
  const [editing, setEditing] = useState<Editing>(null);
  const rows = value.mapping ?? [];
  const tables = value.tables ?? [];
  const traps = value.traps ?? [];
  const issues = useMemo(() => [...snmpMappingIssues(value, limits), ...serverIssues], [value, limits, serverIssues]);
  const bad = (prefix: string) => Object.keys(rowIssues(issues, prefix)).length > 0;
  const budget = expectedKeys(value, limits);
  const set = (patch: Partial<SnmpMapping>) => onChange?.({ ...value, ...patch });
  const byPath = (path: string) => issues.find((i) => i.path === path)?.message;

  const scalarItems: ScalarItem[] = rows.map((r, i) => ({ ...r, i, bad: bad(`mapping.${i}`) }));
  const tableItems: TableItem[] = tables.map((t, i) => ({ ...t, i, bad: bad(`tables.${i}`), label: t.name || fillSnmp(m.tables.unnamed, { n: i + 1 }) }));
  const trapItems: TrapItem[] = traps.map((t, i) => ({ ...t, i, bad: bad(`traps.${i}`) }));
  const mark = (b: boolean) => (b ? <Badge size="sm" variant="error">!</Badge> : null);

  const scalarColumns: Column<ScalarItem>[] = [
    { key: 'oid', header: m.scalars.oid, sortable: true, sortValue: (r) => r.oid, render: (r) => <span className="inline-flex items-center gap-1.5">{mark(r.bad)}<code className="font-mono text-xs">{r.oid}</code></span> },
    { key: 'key', header: m.scalars.key, sortable: true, render: (r) => <span className="font-medium">{r.key}</span> },
    { key: 'kind', header: m.scalars.kind, sortable: true, hideBelow: 'sm', sortValue: (r) => r.kind ?? 'telemetry', render: (r) => m.row[r.kind ?? 'telemetry'].split(' (')[0] },
    { key: 'type', header: m.scalars.type, sortable: true, hideBelow: 'sm', sortValue: (r) => r.type ?? 'auto', searchValue: (r) => m.type[r.type ?? 'auto'], render: (r) => m.type[r.type ?? 'auto'] + (r.rate ? ` · ${m.scalars.rate}` : '') },
    { key: 'scale', header: m.scalars.scale, sortable: true, hideBelow: 'md', align: 'right', sortValue: (r) => r.scale ?? 1, searchable: false, render: (r) => <span className="tabular-nums">{r.scale ?? 1}</span> },
    { key: 'unit', header: m.scalars.unit, hideBelow: 'md', render: (r) => r.unit ?? m.common.none },
  ];
  const tableColumns: Column<TableItem>[] = [
    { key: 'label', header: m.tables.name, sortable: true, render: (t) => <span className="inline-flex items-center gap-1.5">{mark(t.bad)}<span className="font-medium">{t.label}</span></span> },
    { key: 'indexBy', header: m.tables.indexBy, hideBelow: 'md', sortValue: (t) => t.indexBy ?? 'index', render: (t) => (!t.indexBy || t.indexBy === 'index' ? m.tables.index : <code className="font-mono text-xs">{fillSnmp(m.tables.byColumn, { oid: t.indexBy })}</code>) },
    { key: 'maxRows', header: m.tables.maxRows, sortable: true, align: 'right', searchable: false, sortValue: (t) => t.maxRows ?? limits.defaultTableRows, render: (t) => <span className="tabular-nums">{t.maxRows ?? limits.defaultTableRows}</span> },
    { key: 'columns', header: m.tables.columns, sortable: true, align: 'right', sortValue: (t) => t.columns.length, searchValue: (t) => t.columns.map((c) => `${c.oid} ${c.key}`).join(' '), render: (t) => <span className="tabular-nums">{t.columns.length}</span> },
    { key: 'keys', header: m.tables.keys, hideBelow: 'sm', searchable: false, render: (t) => <code className="font-mono text-xs">{tableKeyPreview(t).slice(0, 2).join(', ') || m.common.none}</code> },
  ];
  const trapColumns: Column<TrapItem>[] = [
    { key: 'trapOid', header: m.traps.trapOid, sortable: true, render: (t) => <span className="inline-flex items-center gap-1.5">{mark(t.bad)}<code className="font-mono text-xs">{t.trapOid}</code></span> },
    { key: 'key', header: m.traps.key, sortable: true },
    { key: 'value', header: m.traps.value, hideBelow: 'sm', searchable: false, render: (t) => (t.value && t.value !== 1 ? fillSnmp(m.traps.valueFrom, { oid: t.value.fromVarbind }) : m.traps.valueOne) },
    { key: 'varbinds', header: m.traps.varbinds, hideBelow: 'md', align: 'right', searchable: false, sortable: true, sortValue: (t) => (t.varbinds ?? []).length, render: (t) => <span className="tabular-nums">{(t.varbinds ?? []).length}</span> },
  ];
  const tableMessages = { loading: m.common.loading, retry: m.common.retry };
  const addButton = (label: string, can: boolean, open: () => void) => (!readOnly && can ? <Button size="sm" variant="outline" onClick={open}>{label}</Button> : undefined);

  const numberField = (k: keyof typeof SNMP_POLL_RANGES) => {
    const r = SNMP_POLL_RANGES[k];
    const v = value[k];
    return (
      <Input id={`snmp-${k}`} type="number" label={m.settings[k]} hint={fillSnmp(m.settings.range, { min: r.min, max: r.max })} min={r.min} max={r.max}
        placeholder={String(r.value)} value={typeof v === 'number' ? String(v) : ''} disabled={readOnly}
        error={byPath(k) ? issueText(m, byPath(k)!) : undefined}
        onChange={(e) => set({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
    );
  };

  const over = budget.telemetry > limits.maxTelemetryKeys;
  const overAttributes = budget.attributes > limits.maxAttributeKeys;

  return (
    <div className={cn('space-y-4', className)}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{m.editor.title}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{m.editor.hint}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
      {template && <Callout variant="info" title={null}>{fillSnmp(m.editor.fromTemplate, { template })}</Callout>}
      {readOnlyProp && <Callout variant="note" title={null}>{m.editor.readOnly}</Callout>}
      <Callout variant={over || overAttributes ? 'warning' : 'note'} title={null}>
        <span data-testid="snmp-key-count">
          {over ? fillSnmp(m.editor.keyCountOver, { telemetry: budget.telemetry, max: limits.maxTelemetryKeys })
            : fillSnmp(m.editor.keyCount, { telemetry: budget.telemetry, attributes: budget.attributes })}
          {overAttributes && <> {fillSnmp(m.editor.attributesOver, { attributes: budget.attributes, max: limits.maxAttributeKeys })}</>}
        </span>
      </Callout>
      <Problems m={m} issues={serverIssues} />

      <Section title={m.scalars.title} hint={m.scalars.hint}>
        <DataTable<ScalarItem>
          mode="paginated" variant="plain" density="compact" caption={m.scalars.caption} columns={scalarColumns} rows={scalarItems} rowId={(r) => String(r.i)}
          searchPlaceholder={m.scalars.search} emptyMessage={m.scalars.empty} pageSize={20} pageSizeOptions={LIST_PAGE_SIZES} messages={tableMessages}
          onRowClick={(r) => setEditing({ kind: 'scalar', index: r.i, row: rows[r.i] })}
          headerActions={addButton(m.scalars.add, rows.length < limits.maxMappingRows, () => setEditing({ kind: 'scalar', index: null, row: { oid: '', key: '', kind: 'telemetry', type: 'auto' } }))}
        />
      </Section>

      <Section title={m.tables.title} hint={m.tables.hint}>
        <DataTable<TableItem>
          mode="paginated" variant="plain" density="compact" caption={m.tables.caption} columns={tableColumns} rows={tableItems} rowId={(t) => String(t.i)}
          searchPlaceholder={m.tables.search} emptyMessage={m.tables.empty} pageSize={10} pageSizeOptions={LIST_PAGE_SIZES} messages={tableMessages}
          onRowClick={(t) => setEditing({ kind: 'table', index: t.i, table: tables[t.i] })}
          headerActions={addButton(m.tables.add, tables.length < limits.maxTables, () => setEditing({ kind: 'table', index: null, table: { indexBy: 'index', maxRows: limits.defaultTableRows, columns: [] } }))}
        />
      </Section>

      <Section title={m.traps.title} hint={m.traps.hint}>
        <DataTable<TrapItem>
          mode="paginated" variant="plain" density="compact" caption={m.traps.caption} columns={trapColumns} rows={trapItems} rowId={(t) => String(t.i)}
          searchPlaceholder={m.traps.search} emptyMessage={m.traps.empty} pageSize={10} pageSizeOptions={LIST_PAGE_SIZES} messages={tableMessages}
          onRowClick={(t) => setEditing({ kind: 'trap', index: t.i, trap: traps[t.i] })}
          headerActions={addButton(m.traps.add, traps.length < limits.maxTrapRows, () => setEditing({ kind: 'trap', index: null, trap: { trapOid: '', key: '', value: 1, varbinds: [] } }))}
        />
      </Section>

      <Section title={m.settings.title} hint={m.settings.hint}>
        <div className="grid gap-3 md:grid-cols-3">
          {numberField('timeoutMs')}
          {numberField('retries')}
          {numberField('maxRepetitions')}
        </div>
      </Section>

      {editing?.kind === 'scalar' && (
        <SnmpScalarDrawer key={`s${editing.index}`} index={editing.index} initial={editing.row} block={value} limits={limits} serverIssues={serverIssues} samples={samples}
          readOnly={readOnly} m={m} onClose={() => setEditing(null)}
          onApply={(row) => { set({ mapping: put(rows, editing.index, row) }); setEditing(null); }}
          onRemove={editing.index === null || readOnly ? undefined : () => { set({ mapping: without(rows, editing.index!) }); setEditing(null); }} />
      )}
      {editing?.kind === 'table' && (
        <SnmpTableDrawer key={`t${editing.index}`} index={editing.index} initial={editing.table} block={value} limits={limits} serverIssues={serverIssues}
          readOnly={readOnly} m={m} onClose={() => setEditing(null)}
          onApply={(table) => { set({ tables: put(tables, editing.index, table) }); setEditing(null); }}
          onRemove={editing.index === null || readOnly ? undefined : () => { set({ tables: without(tables, editing.index!) }); setEditing(null); }} />
      )}
      {editing?.kind === 'trap' && (
        <SnmpTrapDrawer key={`p${editing.index}`} index={editing.index} initial={editing.trap} block={value} limits={limits} serverIssues={serverIssues}
          readOnly={readOnly} m={m} onClose={() => setEditing(null)}
          onApply={(trap) => { set({ traps: put(traps, editing.index, trap) }); setEditing(null); }}
          onRemove={editing.index === null || readOnly ? undefined : () => { set({ traps: without(traps, editing.index!) }); setEditing(null); }} />
      )}
    </div>
  );
}

/** Adds a row to the block's values unless its OID is already read; returns the block unchanged then. */
export function addScalar(block: SnmpMapping, row: SnmpScalarRow): SnmpMapping {
  const oid = normaliseOid(row.oid);
  if ((block.mapping ?? []).some((r) => normaliseOid(r.oid) === oid)) return block;
  return { ...block, mapping: [...(block.mapping ?? []), { ...row, oid }] };
}
