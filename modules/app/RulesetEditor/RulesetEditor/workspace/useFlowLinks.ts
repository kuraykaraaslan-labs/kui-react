'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import type { RuleNode } from '../../types';
import {
  createFlowCache, isFlowBlock, isLinkBlock, LINK_IN, linkHits, linkNames, type FlowCache, type FlowRef, type LinkFlow, type LinkHit,
} from '../../graph/links';
import { FLOW_INPUT, FLOW_RUN } from '../../graph/types';
import type { RulesetGraph } from '../hooks/useGraphEditor';
import type { ContextMenuItem, NodeMenuContext } from '../index';
import { useMessages } from '../messages';

export type LinkList = { title: string; hits: LinkHit[] };

type Options = {
  /** the flow that is open (its blocks are read live from the editor) */
  here: FlowRef & { name: string };
  getGraph: () => RulesetGraph | undefined;
  /** ids of the other flows whose blocks are searched too */
  otherIds: string[];
  /** the host loads other flows; without it only the open flow is searched */
  loadFlows?: (ids: string[]) => Promise<LinkFlow[] | null | undefined>;
  /** show the block in the open flow */
  reveal: (nodeId: string) => void;
  /** go to a block of another flow (the host leaves the open one first) */
  jump: (hit: LinkHit) => void;
  notify: (text: string, tone?: 'info' | 'warning' | 'error') => void;
};

/**
 * Jumps through link blocks: a link out or link call goes to its link in, a link in lists its callers; in this flow
 * or in another one. A Run flow block goes to the Flow input of the flow it runs, a Flow input lists the Run flow blocks
 * that run its flow. The open flow is read live from the editor, the others come from `loadFlows` (kept 30 s).
 * One hit shows the block, several open a list, none says so.
 */
export function useFlowLinks({ here, getGraph, otherIds, loadFlows, reveal, jump, notify }: Options) {
  const m = useMessages();
  const loadRef = useRef(loadFlows);
  useEffect(() => { loadRef.current = loadFlows; });
  // the loader reads the latest `loadFlows` when called (never during render)
  // eslint-disable-next-line react-hooks/refs
  const [cache] = useState<FlowCache>(() => createFlowCache((ids) => (loadRef.current ? loadRef.current(ids) : Promise.resolve([]))));
  const latest = useRef({ here, otherIds, reveal, jump, notify, getGraph });
  useEffect(() => { latest.current = { here, otherIds, reveal, jump, notify, getGraph }; });
  const [list, setList] = useState<LinkList | null>(null);

  const flows = useCallback(async (): Promise<LinkFlow[]> => {
    const { here: h, otherIds: ids, getGraph: get } = latest.current;
    const cur: LinkFlow = { id: h.id ?? '', name: h.name, nodes: get()?.nodes ?? [] };
    const others = loadRef.current ? await cache.get(ids.filter((id) => id !== h.id)) : [];
    return [cur, ...others];
  }, [cache]);

  const jumpTo = useCallback((hit: LinkHit) => {
    const { here: h, reveal: show, jump: go } = latest.current;
    if (hit.flow === (h.id ?? '')) show(hit.node);
    else go(hit);
  }, []);

  const go = useCallback(async (node: RuleNode, name?: string) => {
    const { here: h, notify: say } = latest.current;
    const hits = linkHits(await flows(), node, { id: h.id ?? '' }, name);
    if (!hits.length) {
      say(node.type === FLOW_INPUT ? m.wsNoRunner : node.type === FLOW_RUN ? m.wsNoFlowInput : node.type === LINK_IN ? m.wsNoCaller : m.wsNoLinkIn((name ? [name] : linkNames(node)).join(', ') || '?'), 'warning');
      return;
    }
    if (hits.length === 1) { jumpTo(hits[0]); return; }
    setList({ title: node.type === FLOW_INPUT ? m.wsFlowRunnersTitle : node.type === FLOW_RUN ? m.wsFlowTargetTitle : node.type === LINK_IN ? m.wsLinkInTitle : m.wsLinkOutTitle, hits });
  }, [flows, jumpTo, m]);

  /** the entry of the block menu (pass it as `nodeMenuItems`) */
  const menuItems = useCallback(({ nodeIds }: NodeMenuContext): ContextMenuItem[] => {
    const graph = latest.current.getGraph();
    const node = nodeIds.length === 1 && graph ? graph.nodes.find((n) => n.nodeId === nodeIds[0]) : undefined;
    if (node && isFlowBlock(node)) {
      if (node.type === FLOW_RUN && !node.config?.flow) return [];
      return [
        { kind: 'item', label: node.type === FLOW_INPUT ? m.wsFlowShowRunners : m.wsFlowGoTo, icon: faLink, onSelect: () => { void go(node); } },
      ];
    }
    if (!node || !isLinkBlock(node) || !(linkNames(node).length || node.type === LINK_IN)) return [];
    return [
      { kind: 'item', label: node.type === LINK_IN ? m.wsLinkShowCallers : m.wsLinkGoTo, icon: faLink, onSelect: () => { void go(node); } },
    ];
  }, [go, m]);

  return { menuItems, list, closeList: () => setList(null), pick: (hit: LinkHit) => { setList(null); jumpTo(hit); }, go };
}
