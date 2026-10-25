'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableQuery } from '@/modules/ui/Table/types';
import { useMessages } from '../messages';
import { NodeLink } from './parts';
import { barPct, busiestRows, rootNode } from './stats';
import type { BusiestKey, BusiestRow, NodeStats } from './types';

const TOP = 30;

export type BusiestTabProps = {
  nodeStats?: Record<string, NodeStats>;
  /** names of the blocks on the canvas by id; an id with a path (`s1/x`) is named after its first segment `s1` */
  nodeNames?: Record<string, string>;
  onReveal?: (nodeId: string) => void;
  selectedNodeId?: string | null;
};

/** what the table can order by: a counter, or the block's name */
type SortKey = 'block' | 'in' | 'out' | 'errors' | 'ms';
type Row = BusiestRow & { root: string; name: string };

/**
 * The busiest blocks: the 30 at the top of the chosen counter (the sort buttons, or a click on a counter's heading),
 * in the kit DataTable. The heading sort orders those 30 either way; a click on the block's name orders them by name.
 * The router's LuCI editor draws the same table (roltek-automation-flow, `kui-flow-dt`).
 */
export function BusiestTab({ nodeStats, nodeNames, onReveal, selectedNodeId }: BusiestTabProps) {
  const m = useMessages();
  const sorts: [BusiestKey, string][] = [['in', m.insSortIn], ['ms', m.insSortMs], ['errors', m.insSortErrors]];
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'in', dir: 'desc' });
  // the counter that picks the 30 rows and draws the bar: the sorted one, else `in`
  const key: BusiestKey | 'out' = sort.key === 'block' ? 'in' : sort.key;
  const rows = useMemo(() => {
    const picked = busiestRows(nodeStats, key === 'out' ? 'in' : key)
      .sort((a, b) => (b[key] - a[key]) || (b.in - a.in))
      .slice(0, TOP)
      .map((r): Row => { const root = rootNode(r.id); return { ...r, root, name: nodeNames?.[root] ?? root }; });
    if (sort.key === 'block') picked.sort((a, b) => a.name.localeCompare(b.name));
    return sort.dir === 'asc' ? picked.reverse() : picked;
  }, [nodeStats, nodeNames, key, sort.key, sort.dir]);
  const top = Math.max(1, ...rows.map((r) => r[key]));

  const num = 'tabular-nums';
  const columns: Column<Row>[] = [
    {
      key: 'block', header: m.insColBlock, sortable: true,
      render: (r) => (
        <>
          <NodeLink title={m.insShowBlock} onClick={() => onReveal?.(r.root)}>{r.name}</NodeLink>
          <span aria-hidden="true" className="mt-1 block h-[3px] rounded-[2px] bg-border">
            <span className="block h-full rounded-[2px] bg-primary" style={{ width: `${barPct(r[key], top)}%` }} />
          </span>
        </>
      ),
    },
    { key: 'in', header: m.insColIn, sortable: true, align: 'right', tdClass: num, render: (r) => r.in },
    { key: 'out', header: m.insColOut, sortable: true, align: 'right', tdClass: num, render: (r) => r.out },
    { key: 'errors', header: m.insColErrors, sortable: true, align: 'right', tdClass: num, render: (r) => (r.errors ? <span className="font-semibold text-error">{r.errors}</span> : '0') },
    { key: 'ms', header: m.insColMs, sortable: true, align: 'right', tdClass: num, render: (r) => (r.ms ? r.ms.toFixed(1) : '–') },
  ];
  /** the table reports its sort: a new heading (or the same one turned around) orders the rows; a cleared sort goes back to `in` */
  const onQueryChange = (q: DataTableQuery) => {
    const next = q.sort[0];
    const want = next ? { key: next.key as SortKey, dir: next.dir } : { key: 'in' as const, dir: 'desc' as const };
    if (want.key !== sort.key || want.dir !== sort.dir) setSort(want);
  };

  return (
    <div>
      <div role="group" aria-label={m.insSortBy} className="flex flex-wrap gap-1 py-1.5">
        {sorts.map(([k, t]) => (
          <button
            key={k} type="button" data-testid={`insight-perf-${k}`} aria-pressed={k === sort.key} onClick={() => setSort({ key: k, dir: 'desc' })}
            className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium leading-[1.25] transition-colors',
              k === sort.key ? 'border-primary bg-primary-subtle text-primary' : 'border-border-strong bg-surface-base text-text-primary hover:bg-surface-overlay')}
          >{t}</button>
        ))}
      </div>
      {rows.length ? (
        <div data-testid="insight-perf-rows">
          <DataTable<Row>
            mode="manual"
            rows={rows}
            columns={columns}
            rowId={(r) => r.id}
            query={{ sort: [sort] }}
            onQueryChange={onQueryChange}
            multiSort={false}
            searchable={false}
            density="compact"
            bordered={false}
            messages={{ tableLabel: m.insTabBusiest }}
            tableClassName="text-xs leading-normal"
            rowClassName={(r) => cn('align-top', r.root === selectedNodeId && 'bg-primary-subtle')}
          />
        </div>
      ) : <p className="text-xs text-text-secondary">{m.insNoBusiest}</p>}
    </div>
  );
}
