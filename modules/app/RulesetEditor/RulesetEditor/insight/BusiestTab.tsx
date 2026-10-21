'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { useMessages } from '../messages';
import { NodeLink } from './parts';
import { barPct, busiestRows, rootNode } from './stats';
import type { BusiestKey, NodeStats } from './types';

const TOP = 30;

export type BusiestTabProps = {
  nodeStats?: Record<string, NodeStats>;
  /** names of the blocks on the canvas by id; an id with a path (`s1/x`) is named after its first segment `s1` */
  nodeNames?: Record<string, string>;
  onReveal?: (nodeId: string) => void;
  selectedNodeId?: string | null;
};

export function BusiestTab({ nodeStats, nodeNames, onReveal, selectedNodeId }: BusiestTabProps) {
  const m = useMessages();
  const sorts: [BusiestKey, string][] = [['in', m.insSortIn], ['ms', m.insSortMs], ['errors', m.insSortErrors]];
  const [key, setKey] = useState<BusiestKey>('in');
  const rows = useMemo(() => busiestRows(nodeStats, key).slice(0, TOP), [nodeStats, key]);
  const top = Math.max(1, ...rows.map((r) => r[key]));
  return (
    <div>
      <div role="group" aria-label={m.insSortBy} className="flex flex-wrap gap-1 py-1.5">
        {sorts.map(([k, t]) => (
          <button
            key={k} type="button" data-testid={`insight-perf-${k}`} aria-pressed={k === key} onClick={() => setKey(k)}
            className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium leading-[1.25] transition-colors',
              k === key ? 'border-primary bg-primary-subtle text-primary' : 'border-border-strong bg-surface-base text-text-primary hover:bg-surface-overlay')}
          >{t}</button>
        ))}
      </div>
      {rows.length ? (
        <table data-testid="insight-perf-rows" className="w-full text-xs leading-normal">
          <thead>
            <tr className="text-left text-text-secondary">
              {[m.insColBlock, m.insColIn, m.insColOut, m.insColErrors, m.insColMs].map((h, i) => <th key={h} className={cn('py-1 font-medium', i && 'text-right')}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const root = rootNode(r.id);
              return (
                <tr key={r.id} data-selected={root === selectedNodeId || undefined} className={cn('border-t border-border align-top', root === selectedNodeId && 'bg-primary-subtle')}>
                  <td className="py-1 pr-2">
                    <NodeLink title={m.insShowBlock} onClick={() => onReveal?.(root)}>{nodeNames?.[root] ?? root}</NodeLink>
                    <span aria-hidden="true" className="mt-1 block h-[3px] rounded-[2px] bg-border">
                      <span className="block h-full rounded-[2px] bg-primary" style={{ width: `${barPct(r[key], top)}%` }} />
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{r.in}</td>
                  <td className="py-1 text-right tabular-nums">{r.out}</td>
                  <td className="py-1 text-right tabular-nums">{r.errors ? <span className="font-semibold text-error">{r.errors}</span> : '0'}</td>
                  <td className="py-1 text-right tabular-nums">{r.ms ? r.ms.toFixed(1) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="text-xs text-text-secondary">{m.insNoBusiest}</p>}
    </div>
  );
}
