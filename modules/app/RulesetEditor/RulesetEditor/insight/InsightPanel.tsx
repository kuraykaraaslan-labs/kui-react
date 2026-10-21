'use client';
import { useId, useState, type ReactNode } from 'react';
import { Ic } from './Ic';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBug, faCircleInfo, faClock, faGaugeHigh, faRoute, faSliders, faTableList, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { MessagesProvider, useMergedMessages, useMessages, type EditorMessages } from '../messages';
import { BusiestTab } from './BusiestTab';
import { DataTab, type DataTabProps } from './DataTab';
import { DebugTab, type DebugTabProps } from './DebugTab';
import { ErrorsTab, type DeployProblem } from './ErrorsTab';
import { aggregateErrors } from './stats';
import type { NodeStats, RunRecord } from './types';

export type InsightTabId = 'block' | 'debug' | 'help' | 'trace' | 'errors' | 'runs' | 'data' | 'busiest';

/** the tabs the host fills: the block editor, the help, the trace and the runs (the router keeps them in the same bar) */
export type InsightSlotId = 'block' | 'help' | 'trace' | 'runs';

/** what a host-filled tab shows; `label` replaces the default name, `count` is a badge on the tab */
export type InsightSlot = { content: ReactNode; label?: string; count?: number };

/** a tab of the host's own, after Busiest */
export type InsightExtraTab = { id: string; label: string; icon?: IconDefinition; content: ReactNode; count?: number };

export type InsightPanelProps = DataTabProps & Pick<DebugTabProps, 'messages' | 'chainId' | 'nodeNames' | 'selectedNodeId' | 'flowId' | 'onReveal' | 'onNotice'> & {
  /** counters per block id, supplied by the host (a subflow inner block is `instance/inner`) */
  nodeStats?: Record<string, NodeStats>;
  /** the run history, for the errors something caught */
  runs?: RunRecord[];
  /** problems that stop a deploy (the editor's validation, the host's pre-flight): first in the Errors tab, counted on it */
  deployProblems?: DeployProblem[];
  /**
   * The router's single side bar (debug comparison item 6): the Block, Help, Trace and Runs tabs, filled by the host, in the
   * router's order Block, Debug, Help, Trace, Errors, Runs, Data, Busiest. A slot that is not given has no tab.
   */
  slots?: Partial<Record<InsightSlotId, InsightSlot>>;
  /** more tabs of the host's own, after Busiest */
  extraTabs?: InsightExtraTab[];
  /** shown above the content of every tab but Block and Help (the host's debug controls) */
  header?: ReactNode;
  defaultTab?: InsightTabId | string;
  /** the open tab, when the host keeps it (an id of `InsightTabId` or of `extraTabs`) */
  tab?: InsightTabId | string;
  onTabChange?: (tab: string) => void;
  /** shows the close button at the end of the tab strip (the router's side bar has one); the host hides the panel */
  onClose?: () => void;
  /** the words of the panel, to translate it (named apart: `messages` is the debug messages here); see `EditorMessages` */
  uiMessages?: Partial<EditorMessages>;
  className?: string;
};

/** A standalone side panel the host places next to the editor: Debug, Errors, Data and Busiest, plus the Block, Help,
 *  Trace and Runs tabs when the host fills them (`slots`), and tabs of its own (`extraTabs`). It is driven by props;
 *  `onReveal(nodeId)` is called with the block on the canvas to select and show (call the editor's select / reveal
 *  there). `RulesetEditor`'s `sideBar` places it for the host, with the node panel as its Block and Help tabs. */
export function InsightPanel(p: InsightPanelProps) {
  const m = useMergedMessages(p.uiMessages);
  return <MessagesProvider value={m}><InsightBody {...p} /></MessagesProvider>;
}

const ICONS: Record<InsightTabId, IconDefinition> = {
  block: faSliders, debug: faBug, help: faCircleInfo, trace: faRoute, errors: faTriangleExclamation, runs: faClock, data: faTableList, busiest: faGaugeHigh,
};
const SLOT_IDS: readonly string[] = ['block', 'help', 'trace', 'runs'];

function InsightBody(p: InsightPanelProps) {
  const m = useMessages();
  /* the order of the router's side bar: Block, Debug, Help, Trace, Errors, Runs, Data, Busiest (a slot the host does not fill has no tab) */
  const names: Record<InsightTabId, string> = {
    block: p.slots?.block?.label ?? m.insTabBlock, debug: m.insTabDebug, help: p.slots?.help?.label ?? m.insTabHelp, trace: p.slots?.trace?.label ?? m.insTabTrace,
    errors: m.insTabErrors, runs: p.slots?.runs?.label ?? m.insTabRuns, data: m.insTabData, busiest: m.insTabBusiest,
  };
  const order: InsightTabId[] = ['block', 'debug', 'help', 'trace', 'errors', 'runs', 'data', 'busiest'];
  const tabs: { id: string; label: string; icon: IconDefinition }[] = [
    ...order.filter((id) => !SLOT_IDS.includes(id) || p.slots?.[id as InsightSlotId]).map((id) => ({ id, label: names[id], icon: ICONS[id] })),
    ...(p.extraTabs ?? []).map((x) => ({ id: x.id, label: x.label, icon: x.icon ?? faTableList })),
  ];
  const [ownTab, setOwnTab] = useState<string>(p.defaultTab ?? 'debug');
  const wanted = p.tab ?? ownTab;
  const tab = tabs.some((x) => x.id === wanted) ? wanted : 'debug';
  const setTab = (id: string) => { setOwnTab(id); p.onTabChange?.(id); };
  const uid = useId();
  const errCount = aggregateErrors(p.messages).length + (p.deployProblems?.length ?? 0);
  /* messages that came while another tab was open, counted on the Debug tab until it is opened (as the router does) */
  const lastSeq = (p.messages ?? []).reduce((n, x) => Math.max(n, x.seq), 0);
  const [seenSeq, setSeenSeq] = useState(lastSeq);
  if (tab === 'debug' && seenSeq !== lastSeq) setSeenSeq(lastSeq);
  const unseen = tab === 'debug' ? 0 : (p.messages ?? []).filter((x) => x.seq > seenSeq).length;
  const counts: Record<string, { n: number; error?: boolean } | undefined> = {
    debug: { n: unseen }, errors: { n: errCount, error: true },
    ...Object.fromEntries(SLOT_IDS.map((id) => [id, p.slots?.[id as InsightSlotId]?.count !== undefined ? { n: p.slots[id as InsightSlotId]!.count! } : undefined])),
    ...Object.fromEntries((p.extraTabs ?? []).map((x) => [x.id, x.count !== undefined ? { n: x.count } : undefined])),
  };
  const slot = SLOT_IDS.includes(tab) ? p.slots?.[tab as InsightSlotId] : undefined;
  const extra = p.extraTabs?.find((x) => x.id === tab);
  const showHeader = !!p.header && tab !== 'block' && tab !== 'help';
  return (
    <aside aria-label={m.insPanel} className={cn('flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-surface-raised', p.className)}>
      <div role="tablist" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 pt-1.5">
        {tabs.map(({ id, label, icon }) => {
          const on = tab === id, count = counts[id];
          return (
            <button
              key={id} type="button" role="tab" id={`${uid}-${id}`} aria-selected={on} aria-controls={`${uid}-panel`} data-testid={`insight-tab-${id}`}
              title={label} aria-label={label} onClick={() => setTab(id)}
              className={cn('-mb-px inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-t-[var(--radius-md)] border px-2.5 py-2 text-[0.8125rem] font-semibold leading-normal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus',
                on ? 'border-border border-b-surface-raised bg-surface-raised text-primary' : 'border-transparent bg-transparent text-text-secondary hover:text-text-primary')}
            >
              <Ic icon={icon} size=".8rem" />
              {on && <span>{label}</span>}
              {count && count.n > 0 && (
                <span data-testid={id === 'errors' ? 'insight-err-count' : id === 'debug' ? 'insight-dbg-count' : `insight-${id}-count`}
                  className={cn('min-w-[1.1rem] rounded-full px-[.3rem] text-center text-[0.625rem] leading-[1.1rem] text-primary-fg', count.error ? 'bg-error' : 'bg-primary')}>{count.n > 99 ? '99+' : count.n}</span>
              )}
            </button>
          );
        })}
        <span className="flex-1" />
        {p.onClose && (
          <button type="button" data-testid="insight-close" aria-label={m.panelClose} title={m.panelClose} onClick={p.onClose}
            className="inline-flex h-9 min-h-9 w-9 min-w-9 flex-none items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-base p-1 text-sm font-medium leading-[1.25] text-text-primary hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-border-focus">
            <Ic icon={faXmark} />
          </button>
        )}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {showHeader && <div data-testid="insight-header" className="shrink-0 border-b border-border">{p.header}</div>}
        {(slot || extra) && <div data-testid={`insight-slot-${tab}`} className="flex min-h-0 flex-1 flex-col overflow-y-auto">{(slot ?? extra)!.content}</div>}
        {tab === 'debug' && <DebugTab messages={p.messages} chainId={p.chainId} nodeNames={p.nodeNames} selectedNodeId={p.selectedNodeId} flowId={p.flowId} onReveal={p.onReveal} onNotice={p.onNotice} />}
        {(tab === 'busiest' || tab === 'errors' || tab === 'data') && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2 text-xs leading-normal">
            {tab === 'busiest' && <BusiestTab nodeStats={p.nodeStats} nodeNames={p.nodeNames} onReveal={p.onReveal} selectedNodeId={p.selectedNodeId} />}
            {tab === 'errors' && <ErrorsTab deployProblems={p.deployProblems} messages={p.messages} runs={p.runs} nodeStats={p.nodeStats} nodeNames={p.nodeNames} onReveal={p.onReveal} />}
            {tab === 'data' && <DataTab events={p.events} onUseAsTrigger={p.onUseAsTrigger} context={p.context} contextKeys={p.contextKeys} contextError={p.contextError} flowSaved={p.flowSaved} canEditContext={p.canEditContext} onContextLoad={p.onContextLoad} onContextEdit={p.onContextEdit} onContextDelete={p.onContextDelete} defaultSegment={p.defaultSegment} />}
          </div>
        )}
      </div>
    </aside>
  );
}
