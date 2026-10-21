'use client';
import { cn } from '@/libs/utils/cn';
import { useMessages } from '../messages';
import { clockMs } from '../insight/format';
import { JsonTree } from '../insight/JsonTree';
import { portColor } from '../node-meta';
import { outTotal, type NodeActivity } from '../../graph/activity';

/**
 * One message a block received (`in`) or sent (`out`, on `port`), as the host recorded it (UI-33). `msg` is the body: the
 * panel shows it only when the host passes `bodies` (a viewer who may see message bodies); otherwise the row keeps its
 * time, direction, port and run.
 */
export type NodeMessage = {
  id: string;
  /** milliseconds since the epoch */
  ts: number;
  dir: 'in' | 'out';
  /** the output port of an `out` message */
  port?: string;
  /** the run it belongs to */
  run?: string;
  /** an error the block raised on this message */
  error?: string;
  msg?: unknown;
};

/** most rows the tab draws, newest first */
export const NODE_MESSAGES_MAX = 50;

/** The node panel's Messages tab: the block's counters, then the recent messages through it, newest first. */
export function NodeMessages({ messages, bodies, activity, activityWindow, onTest }: {
  messages: NodeMessage[];
  /** the viewer may see message bodies */
  bodies: boolean;
  activity?: NodeActivity;
  activityWindow?: string;
  /** "Test with this input" on a received message with a body */
  onTest?: (message: NodeMessage) => void;
}) {
  const m = useMessages();
  const rows = [...messages].sort((a, b) => b.ts - a.ts).slice(0, NODE_MESSAGES_MAX);
  return (
    <div data-testid="panel-messages" className="space-y-3 text-xs">
      {activity && (
        <p data-testid="panel-counters" className="rounded-md bg-surface-sunken px-2.5 py-1.5 tabular-nums text-text-secondary">
          {m.nodeCounters(activity.in ?? null, outTotal(activity), activity.errors ?? null, activityWindow)}
        </p>
      )}
      {!bodies && rows.length > 0 && <p data-testid="panel-messages-hidden" className="text-text-secondary">{m.panelMessagesHidden}</p>}
      {rows.length === 0 ? <p className="text-text-secondary">{m.panelMessagesNone}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid="panel-message"
              className={cn('rounded-md border border-l-[3px] bg-surface-base px-2 py-1.5', r.error ? 'border-error bg-error-subtle' : 'border-border')}
              style={r.error ? undefined : { borderLeftColor: r.dir === 'in' ? 'var(--border-strong)' : portColor(r.port ?? 'out') }}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary">
                <span className="tabular-nums">{clockMs(r.ts / 1000)}</span>
                <span className="font-semibold text-text-primary">{r.dir === 'in' ? m.panelMessageIn : m.panelMessageOut(r.port)}</span>
                {r.run && <span className="truncate font-mono" title={r.run}>{m.panelMessageRun(r.run.slice(0, 8))}</span>}
                {bodies && onTest && r.dir === 'in' && r.msg !== undefined && (
                  <button type="button" onClick={() => onTest(r)} className="ml-auto text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                    {m.panelMessageTest}
                  </button>
                )}
              </div>
              {r.error && <p className="mt-0.5 text-error">{r.error}</p>}
              {bodies && r.msg !== undefined && <div className="mt-1 overflow-x-auto font-mono text-[11px] leading-[1.45]"><JsonTree value={r.msg} name="msg" /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
