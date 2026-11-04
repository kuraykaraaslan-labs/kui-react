'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fillSnmp, issueText, type SnmpMessages } from './messages';
import { SnmpValueFields } from './SnmpValueFields';
import {
  normaliseOid, parsePairs, rowIssues, snmpMappingIssues, tableKeyPreview,
  type SnmpLimits, type SnmpMapping, type SnmpMappingIssue, type SnmpScalarRow, type SnmpTableMapping, type SnmpTestPollVarbind, type SnmpTrapMapping, type SnmpValueRow,
} from './types';

/**
 * The drawers of the SNMP mapping editor: one row is edited in a drawer on a working copy and applied with Done (the editor's own Save
 * sends the block). A row is judged in the block it would be part of (duplicate keys included); Done stays disabled while it has a problem.
 * Remove asks first (the kit's ConfirmDialog). A table's drawer lists its columns (the kit DataTable) and edits one column in the same
 * drawer (Back returns to the table): no drawer opens over another.
 */

/** The issues the row at `prefix` would have inside `block`, by field (client rules plus the host's issues for this path). */
function issuesIn(block: SnmpMapping, prefix: string, limits: SnmpLimits, server: readonly SnmpMappingIssue[]): Record<string, string> {
  return { ...rowIssues(server, prefix), ...rowIssues(snmpMappingIssues(block, limits), prefix) };
}

function Footer({ m, onCancel, onDone, onRemove, doneDisabled, readOnly }: { m: SnmpMessages; onCancel: () => void; onDone: () => void; onRemove?: () => void; doneDisabled: boolean; readOnly?: boolean }) {
  if (readOnly) return <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>{m.common.close}</Button></div>;
  return (
    <div className="flex items-center justify-between gap-2">
      <div>{onRemove && <Button variant="ghost" size="sm" className="text-error" onClick={onRemove}>{m.common.remove}</Button>}</div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>{m.common.cancel}</Button>
        <Button variant="primary" size="sm" disabled={doneDisabled} onClick={onDone}>{m.common.done}</Button>
      </div>
    </div>
  );
}

const ask = (m: SnmpMessages, title: string, message: string) =>
  confirmDialog({ title, message, tone: 'danger', confirmLabel: m.common.remove, cancelLabel: m.common.cancel });

// ── Scalar value ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type SnmpScalarDrawerProps = {
  /** The row's index in `block.mapping`, or null for a new row. */
  index: number | null;
  initial: SnmpScalarRow;
  block: SnmpMapping;
  limits: SnmpLimits;
  serverIssues: readonly SnmpMappingIssue[];
  samples?: ReadonlyMap<string, SnmpTestPollVarbind>;
  readOnly?: boolean;
  m: SnmpMessages;
  onClose: () => void;
  onApply: (row: SnmpScalarRow) => void;
  onRemove?: () => void;
};

export function SnmpScalarDrawer({ index, initial, block, limits, serverIssues, samples, readOnly, m, onClose, onApply, onRemove }: SnmpScalarDrawerProps) {
  const [row, setRow] = useState<SnmpScalarRow>(initial);
  const at = index ?? (block.mapping ?? []).length;
  const trial = useMemo(() => {
    const rows = [...(block.mapping ?? [])];
    rows[at] = row;
    return { ...block, mapping: rows };
  }, [block, row, at]);
  const unchanged = JSON.stringify(row) === JSON.stringify(initial);
  const errors = issuesIn(trial, `mapping.${at}`, limits, unchanged ? serverIssues : []);
  const bad = Object.keys(rowIssues(snmpMappingIssues(trial, limits), `mapping.${at}`)).length > 0;
  return (
    <Drawer open onClose={onClose} title={index === null ? m.row.addValue : fillSnmp(m.row.editValue, { key: initial.key })} closeLabel={m.common.close} className="w-[32rem]"
      footer={<Footer m={m} readOnly={readOnly} onCancel={onClose} doneDisabled={bad} onDone={() => onApply({ ...row, oid: normaliseOid(row.oid) })}
        onRemove={onRemove && (() => { void ask(m, fillSnmp(m.scalars.removeTitle, { key: initial.key }), m.scalars.removeHint).then((ok) => { if (ok) onRemove(); }); })} />}>
      <SnmpValueFields idPrefix="snmp-scalar" value={row} onChange={setRow} m={m} withKind errors={errors} disabled={readOnly} sample={samples?.get(normaliseOid(row.oid))} />
    </Drawer>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SnmpTableDrawerProps = {
  index: number | null;
  initial: SnmpTableMapping;
  block: SnmpMapping;
  limits: SnmpLimits;
  serverIssues: readonly SnmpMappingIssue[];
  readOnly?: boolean;
  m: SnmpMessages;
  onClose: () => void;
  onApply: (table: SnmpTableMapping) => void;
  onRemove?: () => void;
};

type ColumnRow = SnmpValueRow & { i: number };

export function SnmpTableDrawer({ index, initial, block, limits, serverIssues, readOnly, m, onClose, onApply, onRemove }: SnmpTableDrawerProps) {
  const [table, setTable] = useState<SnmpTableMapping>(initial);
  // the column being edited in this drawer (its index, or the new one at the end), with its working copy
  const [column, setColumn] = useState<{ i: number; row: SnmpValueRow; isNew: boolean } | null>(null);
  const [maxRowsText, setMaxRowsText] = useState(table.maxRows === undefined ? '' : String(table.maxRows));
  const at = index ?? (block.tables ?? []).length;
  const withTable = (t: SnmpTableMapping) => { const tables = [...(block.tables ?? [])]; tables[at] = t; return { ...block, tables }; };
  const unchanged = JSON.stringify(table) === JSON.stringify(initial);
  const own = rowIssues(snmpMappingIssues(withTable(table), limits), `tables.${at}`);
  const errors = { ...(unchanged ? rowIssues(serverIssues, `tables.${at}`) : {}), ...own };
  const byColumn = table.indexBy !== undefined && table.indexBy !== 'index';
  const err = (f: string) => (errors[f] ? issueText(m, errors[f]) : undefined);

  if (column) {
    const cols = [...table.columns];
    cols[column.i] = column.row;
    const trial = withTable({ ...table, columns: cols });
    const prefix = `tables.${at}.columns.${column.i}`;
    const colErrors = rowIssues(snmpMappingIssues(trial, limits), prefix);
    const shown = { ...(column.isNew ? {} : rowIssues(serverIssues, prefix)), ...colErrors };
    const back = () => setColumn(null);
    return (
      <Drawer open onClose={onClose} title={column.isNew ? m.row.addColumn : fillSnmp(m.row.editColumn, { key: table.columns[column.i]?.key ?? '' })} closeLabel={m.common.close} className="w-[32rem]"
        footer={readOnly ? <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={back}>{m.common.back}</Button></div> : (
          <div className="flex items-center justify-between gap-2">
            <div>{!column.isNew && (
              <Button variant="ghost" size="sm" className="text-error" onClick={() => {
                void ask(m, fillSnmp(m.row.removeColumnTitle, { key: table.columns[column.i]?.key ?? '' }), m.tables.removeHint).then((ok) => {
                  if (!ok) return;
                  setTable({ ...table, columns: table.columns.filter((_, j) => j !== column.i) });
                  back();
                });
              }}>{m.common.remove}</Button>
            )}</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={back}>{m.common.back}</Button>
              <Button variant="primary" size="sm" disabled={Object.keys(colErrors).length > 0} onClick={() => {
                const next = [...table.columns];
                next[column.i] = { ...column.row, oid: normaliseOid(column.row.oid) };
                setTable({ ...table, columns: next });
                back();
              }}>{m.common.done}</Button>
            </div>
          </div>
        )}>
        <SnmpValueFields idPrefix="snmp-column" value={column.row} onChange={(row) => setColumn({ ...column, row })} m={m} column errors={shown} disabled={readOnly} />
      </Drawer>
    );
  }

  const columnRows: ColumnRow[] = table.columns.map((c, i) => ({ ...c, i }));
  const colIssues = (i: number) => Object.keys(rowIssues([...snmpMappingIssues(withTable(table), limits), ...(unchanged ? serverIssues : [])], `tables.${at}.columns.${i}`)).length > 0;
  const columns: Column<ColumnRow>[] = [
    { key: 'oid', header: m.scalars.oid, sortable: true, render: (c) => <code className="font-mono text-xs">{c.oid}</code> },
    { key: 'key', header: m.scalars.key, sortable: true, render: (c) => <span className={colIssues(c.i) ? 'text-error' : undefined}>{c.key}</span> },
    { key: 'type', header: m.scalars.type, sortValue: (c) => c.type ?? 'auto', render: (c) => m.type[c.type ?? 'auto'] + (c.rate ? ` · ${m.scalars.rate}` : '') },
  ];
  const preview = tableKeyPreview(table).slice(0, 3).join(', ');
  return (
    <Drawer open onClose={onClose} title={index === null ? m.row.addTable : fillSnmp(m.row.editTable, { name: initial.name || fillSnmp(m.tables.unnamed, { n: at + 1 }) })} closeLabel={m.common.close} className="w-[36rem]"
      footer={<Footer m={m} readOnly={readOnly} onCancel={onClose} doneDisabled={Object.keys(own).length > 0} onDone={() => onApply(table)}
        onRemove={onRemove && (() => { void ask(m, fillSnmp(m.tables.removeTitle, { name: initial.name || fillSnmp(m.tables.unnamed, { n: at + 1 }) }), m.tables.removeHint).then((ok) => { if (ok) onRemove(); }); })} />}>
      <div className="space-y-4">
        <Input id="snmp-table-name" label={m.row.tableName} hint={m.row.tableNameHint} maxLength={64} value={table.name ?? ''} disabled={readOnly}
          onChange={(e) => setTable({ ...table, name: e.target.value || undefined })} />
        <Select id="snmp-table-index" label={m.row.indexBy} value={byColumn ? 'column' : 'index'} disabled={readOnly}
          onChange={(e) => setTable({ ...table, indexBy: e.target.value === 'index' ? 'index' : '' })}
          options={[{ value: 'index', label: m.row.indexByIndex }, { value: 'column', label: m.row.indexByColumn }]} />
        {byColumn && (
          <Input id="snmp-table-index-oid" label={m.row.indexOid} hint={m.row.indexOidHint} required value={table.indexBy ?? ''} disabled={readOnly} className="font-mono"
            error={err('indexBy')} onChange={(e) => setTable({ ...table, indexBy: e.target.value.trim() })} />
        )}
        <Input id="snmp-table-rows" label={m.row.maxRows} hint={fillSnmp(m.row.maxRowsHint, { max: limits.maxTableRows })} inputMode="numeric" value={maxRowsText} disabled={readOnly}
          error={err('maxRows')} onChange={(e) => {
            setMaxRowsText(e.target.value);
            const n = Number(e.target.value);
            setTable({ ...table, maxRows: e.target.value.trim() === '' ? undefined : Number.isFinite(n) ? n : table.maxRows });
          }} />
        <DataTable<ColumnRow>
          mode="paginated" variant="plain" density="compact" caption={m.row.columns} title={m.row.columns} columns={columns} rows={columnRows} rowId={(c) => String(c.i)}
          pageSize={10} searchPlaceholder={m.tables.search} emptyMessage={m.row.noColumns}
          onRowClick={(c) => setColumn({ i: c.i, row: table.columns[c.i], isNew: false })}
          headerActions={!readOnly && table.columns.length < limits.maxTableColumns
            ? <Button size="sm" variant="outline" onClick={() => setColumn({ i: table.columns.length, row: { oid: '', key: '' }, isNew: true })}>{m.row.addColumnButton}</Button>
            : undefined}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
        />
        {err('columns') && <p role="alert" className="text-xs text-error">{err('columns')}</p>}
        {table.columns.length > 0 && <p className="text-xs text-text-secondary">{fillSnmp(m.row.keysLookLike, { keys: preview })}</p>}
      </div>
    </Drawer>
  );
}

// ── Trap ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SnmpTrapDrawerProps = {
  index: number | null;
  initial: SnmpTrapMapping;
  block: SnmpMapping;
  limits: SnmpLimits;
  serverIssues: readonly SnmpMappingIssue[];
  readOnly?: boolean;
  m: SnmpMessages;
  onClose: () => void;
  onApply: (trap: SnmpTrapMapping) => void;
  onRemove?: () => void;
};

export function SnmpTrapDrawer({ index, initial, block, limits, serverIssues, readOnly, m, onClose, onApply, onRemove }: SnmpTrapDrawerProps) {
  const [trap, setTrap] = useState<SnmpTrapMapping>(initial);
  const [pairs, setPairs] = useState((initial.varbinds ?? []).map((v) => `${v.oid}=${v.key}`).join('\n'));
  const at = index ?? (block.traps ?? []).length;
  const traps = [...(block.traps ?? [])];
  traps[at] = trap;
  const own = rowIssues(snmpMappingIssues({ ...block, traps }, limits), `traps.${at}`);
  const errors = { ...(JSON.stringify(trap) === JSON.stringify(initial) ? rowIssues(serverIssues, `traps.${at}`) : {}), ...own };
  const err = (f: string) => (errors[f] ? issueText(m, errors[f]) : undefined);
  const parsed = parsePairs(pairs);
  const fromVarbind = !!trap.value && trap.value !== 1;
  return (
    <Drawer open onClose={onClose} title={index === null ? m.row.addTrap : fillSnmp(m.row.editTrap, { oid: initial.trapOid })} closeLabel={m.common.close} className="w-[32rem]"
      footer={<Footer m={m} readOnly={readOnly} onCancel={onClose} doneDisabled={Object.keys(own).length > 0 || parsed.bad.length > 0}
        onDone={() => onApply({ ...trap, trapOid: normaliseOid(trap.trapOid) })}
        onRemove={onRemove && (() => { void ask(m, fillSnmp(m.traps.removeTitle, { oid: initial.trapOid }), m.traps.removeHint).then((ok) => { if (ok) onRemove(); }); })} />}>
      <div className="space-y-4">
        <Callout variant="info" title={null}>{m.traps.hint}</Callout>
        <Input id="snmp-trap-oid" label={m.row.trapOid} required value={trap.trapOid} disabled={readOnly} className="font-mono" error={err('trapOid')}
          onChange={(e) => setTrap({ ...trap, trapOid: e.target.value.trim() })} />
        <Input id="snmp-trap-key" label={m.row.trapKey} hint={m.row.keyHint} required maxLength={96} value={trap.key} disabled={readOnly} error={err('key')}
          onChange={(e) => setTrap({ ...trap, key: e.target.value.trim() })} />
        <Select id="snmp-trap-value" label={m.row.trapValue} value={fromVarbind ? 'varbind' : 'one'} disabled={readOnly}
          onChange={(e) => setTrap({ ...trap, value: e.target.value === 'one' ? 1 : { fromVarbind: '' } })}
          options={[{ value: 'one', label: m.row.trapValueOne }, { value: 'varbind', label: m.row.trapValueVarbind }]} />
        {fromVarbind && (
          <Input id="snmp-trap-value-oid" label={m.row.trapVarbindOid} required value={(trap.value as { fromVarbind: string }).fromVarbind} disabled={readOnly} className="font-mono"
            error={err('value')} onChange={(e) => setTrap({ ...trap, value: { fromVarbind: e.target.value.trim() } })} />
        )}
        <Textarea id="snmp-trap-varbinds" label={m.row.varbinds} hint={m.row.varbindsHint} rows={4} value={pairs} disabled={readOnly} className="font-mono"
          error={parsed.bad.length ? issueText(m, 'invalid_varbind') : err('varbinds')}
          onChange={(e) => { setPairs(e.target.value); const p = parsePairs(e.target.value); setTrap({ ...trap, varbinds: p.rows }); }} />
      </div>
    </Drawer>
  );
}

