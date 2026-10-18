// modules/ui/ServiceMap/layout.ts
//
// A small, deterministic layered graph layout for service maps (no graph library):
//   1. cycles are cut by reversing back edges (DFS in input order);
//   2. nodes get a layer by longest path from the sources;
//   3. edges spanning several layers get one dummy point per layer they cross, so they route between nodes;
//   4. order inside each layer is improved by barycenter sweeps (ties broken by input order);
//   5. y coordinates follow the neighbours' average while keeping the order and a minimum gap.
// The same input always gives the same output. Pure; unit-tested.

export type MapNodeInput = { id: string };
export type MapEdgeInput = { id?: string; from: string; to: string };

export type LayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  /** Horizontal gap between layers. */
  gapX?: number;
  /** Vertical gap between nodes of a layer. */
  gapY?: number;
  /** 'rtl' mirrors the layout so callers sit on the right. Default = 'ltr'. */
  direction?: 'ltr' | 'rtl';
  /** Padding around the drawing. */
  padding?: number;
};

export type PlacedNode = { id: string; x: number; y: number; width: number; height: number; layer: number; order: number };

export type PlacedEdge = {
  id: string;
  from: string;
  to: string;
  /** Anchor points: start, the dummy points of crossed layers, end. */
  points: { x: number; y: number }[];
  /** The edge points against the flow (it closes a cycle) or stays in one layer. */
  back: boolean;
  /** Where a badge sits: the middle of the polyline. */
  mid: { x: number; y: number };
  /** SVG path data. */
  path: string;
};

export type MapLayout = {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
  layers: string[][];
};

type Vertex = { key: string; real: boolean; layer: number; order: number; y: number };

export function layoutServiceMap(nodesIn: readonly MapNodeInput[], edgesIn: readonly MapEdgeInput[], opts: LayoutOptions = {}): MapLayout {
  const nodeW = opts.nodeWidth ?? 184;
  const nodeH = opts.nodeHeight ?? 64;
  const gapX = opts.gapX ?? 96;
  const gapY = opts.gapY ?? 28;
  const pad = opts.padding ?? 24;
  const rtl = opts.direction === 'rtl';

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const n of nodesIn) if (!seen.has(n.id)) { seen.add(n.id); ids.push(n.id); }

  // Edges: known endpoints, no self loops, one per (from, to) pair; ids stay stable.
  const edges: { id: string; from: string; to: string }[] = [];
  const pair = new Set<string>();
  for (const e of edgesIn) {
    if (!seen.has(e.from) || !seen.has(e.to) || e.from === e.to) continue;
    const k = `${e.from}\u0000${e.to}`;
    if (pair.has(k)) continue;
    pair.add(k);
    edges.push({ id: e.id ?? `${e.from}->${e.to}`, from: e.from, to: e.to });
  }

  // 1. Cut cycles: a DFS in input order; an edge to a node still on the stack is a back edge and is reversed for layering.
  const out = new Map<string, string[]>();
  for (const id of ids) out.set(id, []);
  for (const e of edges) out.get(e.from)!.push(e.to);
  const state = new Map<string, 0 | 1 | 2>();
  const reversed = new Set<string>();
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      const s = state.get(v) ?? 0;
      if (s === 1) reversed.add(`${u}\u0000${v}`);
      else if (s === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.get(id)) visit(id);
  const dag = edges.map((e) => (reversed.has(`${e.from}\u0000${e.to}`) ? { ...e, from: e.to, to: e.from, back: true } : { ...e, back: false }));

  // 2. Longest-path layering (Kahn, input order for determinism).
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const id of ids) { indeg.set(id, 0); succ.set(id, []); }
  for (const e of dag) { indeg.set(e.to, indeg.get(e.to)! + 1); succ.get(e.from)!.push(e.to); }
  const layer = new Map<string, number>();
  const queue = ids.filter((id) => indeg.get(id) === 0);
  for (const id of queue) layer.set(id, 0);
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    for (const v of succ.get(u)!) {
      layer.set(v, Math.max(layer.get(v) ?? 0, layer.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  for (const id of ids) if (!layer.has(id)) layer.set(id, 0);

  // 3. Dummy vertices for edges that cross layers.
  const vertices = new Map<string, Vertex>();
  ids.forEach((id) => vertices.set(id, { key: id, real: true, layer: layer.get(id)!, order: 0, y: 0 }));
  const chains: { keys: string[] }[] = [];
  const adj: Map<string, { up: string[]; down: string[] }> = new Map();
  const ensureAdj = (k: string) => { if (!adj.has(k)) adj.set(k, { up: [], down: [] }); return adj.get(k)!; };
  dag.forEach((e) => {
    const l0 = layer.get(e.from)!;
    const l1 = layer.get(e.to)!;
    const keys = [e.from];
    for (let l = l0 + 1; l < l1; l++) {
      const key = `\u0001${e.id}@${l}`;
      vertices.set(key, { key, real: false, layer: l, order: 0, y: 0 });
      keys.push(key);
    }
    keys.push(e.to);
    for (let j = 0; j + 1 < keys.length; j++) { ensureAdj(keys[j]).down.push(keys[j + 1]); ensureAdj(keys[j + 1]).up.push(keys[j]); }
    chains.push({ keys });
  });

  const layerCount = Math.max(0, ...[...vertices.values()].map((v) => v.layer)) + 1;
  const layers: string[][] = Array.from({ length: ids.length ? layerCount : 0 }, () => []);
  for (const v of vertices.values()) layers[v.layer].push(v.key);
  // Initial order: real nodes in input order, dummies after the real nodes they leave.
  const inputIndex = new Map(ids.map((id, i) => [id, i]));
  const creation = new Map([...vertices.keys()].map((k, i) => [k, i]));
  const rank = (k: string) => inputIndex.get(k) ?? ids.length + (creation.get(k) ?? 0);
  layers.forEach((l) => l.sort((a, b) => rank(a) - rank(b)));
  const reindex = () => layers.forEach((l) => l.forEach((k, i) => { vertices.get(k)!.order = i; }));
  reindex();

  // 4. Barycenter sweeps.
  const bary = (k: string, side: 'up' | 'down') => {
    const ns = adj.get(k)?.[side] ?? [];
    if (!ns.length) return vertices.get(k)!.order;
    return ns.reduce((s, n) => s + vertices.get(n)!.order, 0) / ns.length;
  };
  for (let pass = 0; pass < 6; pass++) {
    const down = pass % 2 === 0;
    const range = down ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).slice(0, -1).reverse();
    for (const li of range) {
      const side = down ? 'up' : 'down';
      const keyed = layers[li].map((k, i) => ({ k, b: bary(k, side), i }));
      keyed.sort((a, b) => a.b - b.b || a.i - b.i);
      layers[li] = keyed.map((x) => x.k);
      reindex();
    }
  }

  // 5. Coordinates: stack each layer, centre it, then relax toward neighbour averages keeping order and gaps.
  const slot = (v: Vertex) => (v.real ? nodeH : 8);
  const gap = (a: Vertex, b: Vertex) => (a.real && b.real ? gapY : Math.max(10, gapY / 2));
  const stack = (l: string[]) => {
    let y = 0;
    l.forEach((k, i) => {
      const v = vertices.get(k)!;
      if (i > 0) y += gap(vertices.get(l[i - 1])!, v);
      v.y = y + slot(v) / 2;
      y += slot(v);
    });
    return y;
  };
  const heights = layers.map(stack);
  const maxH = Math.max(0, ...heights);
  layers.forEach((l, li) => { const shift = (maxH - heights[li]) / 2; l.forEach((k) => { vertices.get(k)!.y += shift; }); });
  const relax = (li: number, side: 'up' | 'down') => {
    const l = layers[li];
    const want = l.map((k) => {
      const ns = adj.get(k)?.[side] ?? [];
      return ns.length ? ns.reduce((s, n) => s + vertices.get(n)!.y, 0) / ns.length : vertices.get(k)!.y;
    });
    // Place in order with minimum separation, as close to `want` as the order allows (two sweeps settle it).
    const ys = [...want];
    for (let i = 1; i < l.length; i++) {
      const min = ys[i - 1] + slot(vertices.get(l[i - 1])!) / 2 + gap(vertices.get(l[i - 1])!, vertices.get(l[i])!) + slot(vertices.get(l[i])!) / 2;
      if (ys[i] < min) ys[i] = min;
    }
    for (let i = l.length - 2; i >= 0; i--) {
      const max = ys[i + 1] - slot(vertices.get(l[i + 1])!) / 2 - gap(vertices.get(l[i])!, vertices.get(l[i + 1])!) - slot(vertices.get(l[i])!) / 2;
      if (ys[i] > max && want[i] <= max + 1e-6) ys[i] = max;
    }
    l.forEach((k, i) => { vertices.get(k)!.y = ys[i]; });
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let li = 1; li < layers.length; li++) relax(li, 'up');
    for (let li = layers.length - 2; li >= 0; li--) relax(li, 'down');
  }
  // Normalise so the top-most vertex sits at the padding.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices.values()) { minY = Math.min(minY, v.y - slot(v) / 2); maxY = Math.max(maxY, v.y + slot(v) / 2); }
  if (!Number.isFinite(minY)) { minY = 0; maxY = 0; }
  for (const v of vertices.values()) v.y += pad - minY;

  const width = layers.length ? layers.length * nodeW + (layers.length - 1) * gapX + pad * 2 : pad * 2;
  const height = maxY - minY + pad * 2;
  const xOf = (li: number, w: number) => {
    const x = pad + li * (nodeW + gapX);
    return rtl ? width - x - w : x;
  };

  const nodes: PlacedNode[] = ids.map((id) => {
    const v = vertices.get(id)!;
    return { id, x: xOf(v.layer, nodeW), y: v.y - nodeH / 2, width: nodeW, height: nodeH, layer: v.layer, order: v.order };
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const placedEdges: PlacedEdge[] = edges.map((e, i) => {
    const isBack = reversed.has(`${e.from}\u0000${e.to}`);
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    const flip = rtl ? -1 : 1;
    let points: { x: number; y: number }[];
    if (isBack) {
      // Against the flow: leave the top of the source, arc over, enter the top of the target.
      const top = Math.min(a.y, b.y) - 36;
      points = [{ x: a.x + a.width / 2, y: a.y }, { x: (a.x + b.x + a.width) / 2, y: top }, { x: b.x + b.width / 2, y: b.y }];
    } else {
      const keys = chains[i].keys;
      points = keys.map((k, j) => {
        const v = vertices.get(k)!;
        if (v.real) {
          const n = nodeById.get(k)!;
          // Leave from the downstream edge of the source, enter at the upstream edge of the target.
          const leaving = j === 0;
          return { x: n.x + (leaving ? (flip > 0 ? n.width : 0) : (flip > 0 ? 0 : n.width)), y: n.y + n.height / 2 };
        }
        return { x: xOf(v.layer, nodeW) + nodeW / 2, y: v.y };
      });
    }
    return { id: e.id, from: e.from, to: e.to, points, back: isBack, mid: polylineMid(points), path: smoothPath(points, isBack) };
  });

  return { nodes, edges: placedEdges, width, height, layers: layers.map((l) => l.filter((k) => vertices.get(k)!.real)) };
}

function polylineMid(points: { x: number; y: number }[]): { x: number; y: number } {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let walk = total / 2;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (walk <= seg && seg > 0) {
      const t = walk / seg;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
    walk -= seg;
  }
  return points[0] ?? { x: 0, y: 0 };
}

/** A smooth path through the points: horizontal tangents at each point (a quadratic for an arc over a node). */
function smoothPath(points: { x: number; y: number }[], arc: boolean): string {
  if (points.length < 2) return '';
  const r = (n: number) => Math.round(n * 100) / 100;
  if (arc && points.length === 3) {
    const [a, c, b] = points;
    return `M${r(a.x)},${r(a.y)} Q${r(a.x)},${r(c.y)} ${r(c.x)},${r(c.y)} T${r(b.x)},${r(b.y)}`;
  }
  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    const mx = (p.x + q.x) / 2;
    d += ` C${r(mx)},${r(p.y)} ${r(mx)},${r(q.y)} ${r(q.x)},${r(q.y)}`;
  }
  return d;
}

/** The neighbours used for keyboard navigation, from the placed layout. */
export function neighbours(layout: MapLayout, id: string): { downstream: string[]; upstream: string[]; sameLayer: string[] } {
  const downstream: string[] = [];
  const upstream: string[] = [];
  for (const e of layout.edges) {
    if (e.from === id) downstream.push(e.to);
    if (e.to === id) upstream.push(e.from);
  }
  const me = layout.nodes.find((n) => n.id === id);
  const sameLayer = me ? layout.layers[me.layer] ?? [] : [];
  return { downstream, upstream, sameLayer };
}
