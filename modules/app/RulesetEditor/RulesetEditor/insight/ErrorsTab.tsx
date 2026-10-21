'use client';
import { useMemo } from 'react';
import { cn } from '@/libs/utils/cn';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useMessages } from '../messages';
import { Ic } from './Ic';
import { Badge, Caps, NodeLink } from './parts';
import { aggregateErrors, caughtRows, clock, rootNode } from './stats';
import type { DebugMessage, NodeStats, RunRecord } from './types';

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

const Th = ({ children, last }: { children: string; last?: boolean }) => <th className={cn('py-1 font-medium', last && 'text-right')}>{children}</th>;

export function ErrorsTab({ deployProblems, messages, runs, nodeStats, nodeNames, onReveal }: ErrorsTabProps) {
  const m = useMessages();
  const rows = useMemo(() => aggregateErrors(messages), [messages]);
  const caught = useMemo(() => caughtRows(runs), [runs]);
  const counted = Object.entries(nodeStats ?? {}).filter(([, n]) => (n?.errors ?? 0) > 0);
  const name = (id: string) => nodeNames?.[rootNode(id)] ?? id;
  const Link = ({ id, title, testid, children }: { id: string; title: string; testid?: string; children?: React.ReactNode }) => (
    <NodeLink title={title} testid={testid} onClick={() => onReveal?.(rootNode(id))}>{children ?? name(id)}</NodeLink>
  );
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
      {rows.length ? (
        <table data-testid="insight-error-rows" className="w-full">
          <thead><tr className="text-left text-text-secondary"><Th>{m.insErrLast}</Th><Th>{m.insErrBlock}</Th><Th>{m.insErrError}</Th><Th last>{m.insErrCount}</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.node}|${r.text}`} className="border-t border-border align-top">
                <td className="py-1 pr-2 tabular-nums">{clock(r.last)}</td>
                <td className="py-1 pr-2"><Link id={r.node} title={m.insShowBlock} /></td>
                <td className="py-1 pr-2">{r.text} <Badge tone="warning">{m.insNotCaught}</Badge></td>
                <td className="py-1 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-text-secondary">{m.insNoErrors}</p>}

      {caught.length > 0 && (
        <>
          <Caps>{m.insCaughtRecent}</Caps>
          <table data-testid="insight-caught-rows" className="w-full">
            <thead><tr className="text-left text-text-secondary"><Th>{m.insErrLast}</Th><Th>{m.insErrBlock}</Th><Th>{m.insErrError}</Th><Th>{m.insCaughtBy}</Th><Th last>{m.insErrCount}</Th></tr></thead>
            <tbody>
              {caught.map((r) => (
                <tr key={`${r.node}|${r.text}|${r.caught}`} className="border-t border-border align-top">
                  <td className="py-1 pr-2 tabular-nums">{clock(r.last)}</td>
                  <td className="py-1 pr-2"><Link id={r.node} title={m.insShowBlock} /></td>
                  <td className="py-1 pr-2">{r.text}</td>
                  <td className="py-1 pr-2">
                    {r.caught === r.node
                      ? <Badge tone="success" dot>{m.insErrPort}</Badge>
                      : <Link id={r.caught} title={m.insShowCatcher} testid="insight-caught-link"><Ic icon={faArrowRight} size="1rem" />{name(r.caught)}</Link>}
                  </td>
                  <td className="py-1 text-right tabular-nums">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
