'use client';
import { useState } from 'react';
import { newNode } from '../../graph/edit';
import { fixedFlowInputId } from '../../graph/flowInput';
import { FLOW_INPUT, type Graph } from '../../graph/types';
import type { Catalog } from '../../catalog/types';
import { NODE_W, NODE_HEADER_H, type Point } from '../geometry';

export function usePaletteDrop({ getGraph, apply, catalog, toWorld }: {
  getGraph: () => Graph;
  apply: (fn: (graph: Graph) => Graph, key?: string) => void;
  catalog: Catalog;
  /** screen (client) coordinates → canvas world coordinates (pan + zoom aware) */
  toWorld: (clientX: number, clientY: number) => Point;
}) {
  const [paletteDrag, setPaletteDrag] = useState<string | null>(null);

  function onPaletteDragStart(type: string) { setPaletteDrag(type); }
  function onPaletteDragEnd() { setPaletteDrag(null); }

  /** add a node centred on a world point; returns its id. The Flow input is never added (a flow has its fixed one): nothing is added and its id comes back */
  function addAt(type: string, pt: Point): string {
    if (type === FLOW_INPUT) return fixedFlowInputId(getGraph().nodes) ?? '';
    const node = newNode(catalog, type, pt, getGraph().nodes, { width: NODE_W, headerHeight: NODE_HEADER_H });
    apply((g) => ({ ...g, nodes: [...g.nodes, node] }), 'add');
    return node.nodeId;
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!paletteDrag) return;
    addAt(paletteDrag, toWorld(e.clientX, e.clientY));
    setPaletteDrag(null);
  }

  return { paletteDrag, onPaletteDragStart, onPaletteDragEnd, onDrop, addAt };
}
