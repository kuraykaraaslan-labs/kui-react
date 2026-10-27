'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Ic } from './Ic';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBug, faCircleInfo, faClock, faEllipsis, faGaugeHigh, faRoute, faSliders, faTableList, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { MessagesProvider, useMergedMessages, useMessages, type EditorMessages } from '../messages';
import { ContextMenu, type ContextMenuClose } from '../canvas/ContextMenu';
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
  /** counters per block id, supplied by the host (an id with a path, `s1/x`, belongs to the block `s1`) */
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

/**
 * The tabs the strip shows and the ones its "More tabs" menu holds: all when they fit (or the strip is not measured yet),
 * else as many as fit next to the menu button, the open tab always among the shown ones. `fit` is how many tab widths
 * the strip has room for.
 */
export function splitTabs<T extends { id: string }>(tabs: T[], open: string, fit: number | null): { shown: T[]; hidden: T[] } {
  if (fit === null || tabs.length <= fit) return { shown: tabs, hidden: [] };
  const cap = Math.max(1, fit - 1);
  let shown = tabs.slice(0, cap);
  const active = tabs.find((t) => t.id === open);
  if (active && !shown.includes(active)) shown = [...shown.slice(0, cap - 1), active];
  return { shown, hidden: tabs.filter((t) => !shown.includes(t)) };
}

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
  /* the strip never scrolls: the tabs are icons of one width (the name is the tooltip and the accessible name), and the
     ones that do not fit go into a "More tabs" menu at its end */
  const asideRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const [more, setMore] = useState<{ x: number; y: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  /* where the focus goes when the menu has closed: the More button after Escape, the picked tab after a pick (a click
     elsewhere leaves it where the click put it) */
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const to = refocus.current;
    if (more || !to) return;
    refocus.current = null;
    (to === 'more' ? moreRef.current : document.getElementById(`${uid}-${to}`))?.focus();
  });
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const tabW = el.querySelector<HTMLElement>('[role="tab"]')?.offsetWidth || 32;
      setFit(w > 0 ? Math.max(1, Math.floor(w / tabW)) : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { shown, hidden } = splitTabs(tabs, tab, fit);
  const hiddenCount = hidden.reduce<{ n: number; error: boolean }>((a, x) => {
    const c = counts[x.id];
    return c && c.n > 0 ? { n: a.n + c.n, error: a.error || !!c.error } : a;
  }, { n: 0, error: false });
  const openMore = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (more) { setMore(null); return; }
    const b = e.currentTarget.getBoundingClientRect(), a = asideRef.current?.getBoundingClientRect();
    setMore({ x: a ? b.left - a.left : 0, y: a ? b.bottom - a.top + 2 : 0 });
  };
  const countText = (n: number) => (n > 99 ? '99+' : String(n));
  const closeMore = (how: ContextMenuClose) => {
    if (how !== 'away') refocus.current = 'more';
    setMore(null);
  };
  /* the counts of the hidden tabs are in the button's name too (the dot is for the eye) */
  const moreLabel = hiddenCount.n > 0 ? `${m.insMoreTabs} (${countText(hiddenCount.n)})` : m.insMoreTabs;
  return (
    <aside ref={asideRef} aria-label={m.insPanel} className={cn('relative flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-surface-raised', p.className)}>
      <div className="flex shrink-0 items-end gap-1 border-b border-border px-1.5 pt-1.5">
        <div ref={stripRef} className="flex min-w-0 flex-1 items-end overflow-hidden">
          <div role="tablist" aria-label={m.insPanel} className="flex items-end">
            {shown.map(({ id, label, icon }) => {
              const on = tab === id, count = counts[id];
              return (
                <button
                  key={id} type="button" role="tab" id={`${uid}-${id}`} aria-selected={on} aria-controls={`${uid}-panel`} data-testid={`insight-tab-${id}`}
                  title={label} aria-label={label} onClick={() => setTab(id)}
                  className={cn('relative -mb-px inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-t-[var(--radius-md)] border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus',
                    on ? 'border-border border-b-surface-raised bg-surface-raised text-primary' : 'border-transparent bg-transparent text-text-secondary hover:text-text-primary')}
                >
                  <Ic icon={icon} size=".8rem" />
                  {count && count.n > 0 && (
                    <span data-testid={id === 'errors' ? 'insight-err-count' : id === 'debug' ? 'insight-dbg-count' : `insight-${id}-count`}
                      className={cn('absolute right-0 top-0.5 min-w-[0.95rem] rounded-full px-[.2rem] text-center text-[0.5625rem] font-semibold leading-[0.95rem] text-primary-fg', count.error ? 'bg-error' : 'bg-primary')}>{countText(count.n)}</span>
                  )}
                </button>
              );
            })}
          </div>
          {hidden.length > 0 && (
            <button ref={moreRef} type="button" data-testid="insight-more" aria-label={moreLabel} title={moreLabel} aria-haspopup="menu" aria-expanded={!!more} onClick={openMore}
              className="relative mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-2 focus-visible:outline-border-focus">
              <Ic icon={faEllipsis} size=".8rem" />
              {hiddenCount.n > 0 && <span aria-hidden="true" className={cn('absolute right-1 top-1 h-1.5 w-1.5 rounded-full', hiddenCount.error ? 'bg-error' : 'bg-primary')} />}
            </button>
          )}
        </div>
        {p.onClose && (
          <button type="button" data-testid="insight-close" aria-label={m.panelClose} title={m.panelClose} onClick={p.onClose}
            className="mb-1 inline-flex h-8 min-h-8 w-8 min-w-8 flex-none items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-base p-1 text-sm font-medium leading-[1.25] text-text-primary hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-border-focus">
            <Ic icon={faXmark} size=".85rem" />
          </button>
        )}
      </div>
      {more && hidden.length > 0 && (
        <ContextMenu x={more.x} y={more.y} anchor={moreRef} onClose={closeMore}
          items={hidden.map((x) => {
            const c = counts[x.id];
            return { kind: 'item' as const, label: c && c.n > 0 ? `${x.label} (${countText(c.n)})` : x.label, icon: x.icon, onSelect: () => { refocus.current = x.id; setTab(x.id); } };
          })} />
      )}
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
