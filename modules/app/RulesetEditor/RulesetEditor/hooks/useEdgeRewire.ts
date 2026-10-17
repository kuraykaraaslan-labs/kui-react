'use client';
import { useState } from 'react';
import { rewireEdge } from '../../graph/edit';
import type { Graph } from '../../graph/types';
import type { Catalog } from '../../catalog/types';

/** a connection end being dragged: which connection, which end */
export type Rewiring = { edgeId: string; end: 'source' | 'target' } | null;

/**
 * UI-31: drag an end of the selected connection onto another port or block. The source end goes to an output (or a
 * block: the same port when it has one, else its first output), the target end to an input (or a block: its first
 * input). A drop the rules refuse, or one on the empty canvas, leaves the connection as it was. One undo step.
 */
export function useEdgeRewire({ getGraph, apply, catalog, readOnly, setMouse }: {
  getGraph: () => Graph;
  apply: (fn: (graph: Graph) => Graph, key?: string) => void;
  catalog: Catalog;
  readOnly: boolean;
  setMouse: (p: { x: number; y: number }) => void;
}) {
  const [rewiring, setRewiring] = useState<Rewiring>(null);

  function start(e: React.PointerEvent, edgeId: string, end: 'source' | 'target', at: { x: number; y: number }) {
    e.stopPropagation();
    if (readOnly) return;
    setRewiring({ edgeId, end });
    setMouse(at);
  }

  function dropOn(nodeId: string, port?: string) {
    const r = rewiring;
    setRewiring(null);
    if (!r || readOnly) return;
    if (!rewireEdge(getGraph(), catalog, r.edgeId, r.end, nodeId, port)) return;
    apply((g) => rewireEdge(g, catalog, r.edgeId, r.end, nodeId, port) ?? g, 'rewire');
  }

  /** the pointer was released: find the port (or the block) under it, as a touch pointer stays captured where it began */
  function finishAt(clientX: number, clientY: number) {
    if (!rewiring) return;
    const hit = document.elementFromPoint(clientX, clientY);
    const nodeEl = hit?.closest<HTMLElement>('[data-node-id]');
    if (rewiring.end === 'target') {
      const port = hit?.closest<HTMLElement | SVGElement>('[data-in-node]');
      if (port) return dropOn(port.dataset.inNode!, port.dataset.inPort);
    } else {
      const port = hit?.closest<HTMLElement | SVGElement>('[data-out-node]');
      if (port) return dropOn(port.dataset.outNode!, port.dataset.outPort);
    }
    if (nodeEl) return dropOn(nodeEl.dataset.nodeId!);
    setRewiring(null);
  }

  return { rewiring, start, dropOn, finishAt, cancel: () => setRewiring(null) };
}
