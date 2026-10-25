'use client';
import { useMemo } from 'react';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { useMessages } from '../messages';
import { Ic } from './Ic';
import { Badge, Caps, NodeLink } from './parts';
import { aggregateErrors, caughtRows, clock, rootNode } from './stats';
import type { CaughtError, DebugMessage, ErrorRow, NodeStats, RunRecord } from './types';

/** A problem that stops a deploy (the editor's own checks, the host's pre-flight): shown first in the Errors tab, with a link to its block. */
export type DeployProblem = { message: string; nodeId?: string; code?: string; severity?: 'error' | 'warning' };

export type ErrorsTabProps = {
  deployProblems?: DeployProblem[];
  messages?: DebugMessage[];
  runs?: RunRecord[];
  nodeStats?: Record<string, NodeStats>;
  nodeNames?: Record<string, string>;
  onReveal?: (nodeId: string) => void;
};

/* the error tables are the kit DataTable (static: the rows are here), sortable by time, block and count; the router's
   LuCI editor draws the same tables (roltek-automation-flow, `kui-flow-dt`) */
type RunRow = ErrorRow & { block: string; key: string };
type CaughtRow = CaughtError & { block: string; key: string };
const TABLE = { mode: 'static', multiSort: false, searchable: false, density: 'compact', bordered: false, tableClassName: 'text-xs leading-normal', rowClassName: () => 'align-top' } as const;

export function ErrorsTab({ deployProblems, messages, runs, nodeStats, nodeNames, onReveal }: ErrorsTabProps) {
  const m = useMessages();
  const rows = useMemo(() => aggregateErrors(messages), [messages]);
  const caught = useMemo(() => caughtRows(runs), [runs]);
  const counted = Object.entries(nodeStats ?? {}).filter(([, n]) => (n?.errors ?? 0) > 0);
  const name = (id: string) => nodeNames?.[rootNode(id)] ?? id;
  const Link = ({ id, title, testid, children }: { id: string; title: string; testid?: string; children?: React.ReactNode }) => (
    <NodeLink title={title} testid={testid} onClick={() => onReveal?.(rootNode(id))}>{children ?? name(id)}</NodeLink>
  );
  const runRows = rows.map((r): RunRow => ({ ...r, block: name(r.node), key: `${r.node}|${r.text}` }));
  const caughtRowsShown = caught.map((r): CaughtRow => ({ ...r, block: name(r.node), key: `${r.node}|${r.text}|${r.caught}` }));
  const num = 'tabular-nums';
  const runColumns: Column<RunRow>[] = [
    { key: 'last', header: m.insErrLast, sortable: true, tdClass: num, render: (r) => clock(r.last) },
    { key: 'block', header: m.insErrBlock, sortable: true, render: (r) => <Link id={r.node} title={m.insShowBlock} /> },
    { key: 'text', header: m.insErrError, render: (r) => <>{r.text} <Badge tone="warning">{m.insNotCaught}</Badge></> },
    { key: 'count', header: m.insErrCount, sortable: true, align: 'right', tdClass: num },
  ];
  const caughtColumns: Column<CaughtRow>[] = [
    { key: 'last', header: m.insErrLast, sortable: true, tdClass: num, render: (r) => clock(r.last) },
    { key: 'block', header: m.insErrBlock, sortable: true, render: (r) => <Link id={r.node} title={m.insShowBlock} /> },
    { key: 'text', header: m.insErrError },
    {
      key: 'caught', header: m.insCaughtBy,
      render: (r) => (r.caught === r.node
        ? <Badge tone="success" dot>{m.insErrPort}</Badge>
        : <Link id={r.caught} title={m.insShowCatcher} testid="insight-caught-link"><Ic icon={faArrowRight} size="1rem" />{name(r.caught)}</Link>),
    },
    { key: 'count', header: m.insErrCount, sortable: true, align: 'right', tdClass: num },
  ];
  return (
    <div className="text-xs leading-normal">
      {(deployProblems?.length ?? 0) > 0 && (
        <>
          <Caps>{m.insDeployProblems}</Caps>
          <ul data-testid="insight-deploy-problems" className="flex flex-col gap-1">
            {deployProblems!.map((p, i) => (
              <li key={`${p.nodeId ?? ''}|${p.code ?? ''}|${i}`} className="flex items-start gap-1.5">
                <Badge tone={p.severity === 'warning' ? 'warning' : 'error'}>{p.severity === 'warning' ? m.insProblemWarning : m.insProblemError}</Badge>
                {p.nodeId
                  ? <NodeLink title={m.insShowBlock} onClick={() => onReveal?.(rootNode(p.nodeId!))}>{`${name(p.nodeId)}: ${p.message}`}</NodeLink>
                  : <span>{p.message}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <Caps>{m.insErrRunning}</Caps>
      {runRows.length ? (
        <div data-testid="insight-error-rows">
          <DataTable<RunRow> {...TABLE} rows={runRows} columns={runColumns} rowId={(r) => r.key} messages={{ tableLabel: m.insErrRunning }} />
        </div>
      ) : <p className="text-text-secondary">{m.insNoErrors}</p>}

      {caughtRowsShown.length > 0 && (
        <>
          <Caps>{m.insCaughtRecent}</Caps>
          <div data-testid="insight-caught-rows">
            <DataTable<CaughtRow> {...TABLE} rows={caughtRowsShown} columns={caughtColumns} rowId={(r) => r.key} messages={{ tableLabel: m.insCaughtRecent }} />
          </div>
        </>
      )}

      {counted.length > 0 && (
        <>
          <Caps>{m.insErrCounters}</Caps>
          <ul className="flex flex-col gap-1">
            {counted.map(([id, n]) => (
              <li key={id}><Link id={id} title={m.insShowBlock} /> <span className="tabular-nums text-text-secondary">{` ${m.insErrorsN(n.errors ?? 0)}`}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
