// modules/ui/TraceWaterfall/model.ts
//
// Pure model of a distributed trace: the span tree, the flattened visible rows, the critical path and
// the time ruler. No React, so it is unit-tested directly and reusable by a server or a worker.
// Times are milliseconds (fractions allowed); `start` is any common origin (epoch ms or trace-relative).

export type SpanStatus = 'ok' | 'error' | 'unset';

export type TraceSpan = {
  id: string;
  /** Absent or unknown parent: the span is a root. */
  parentId?: string | null;
  name: string;
  /** The service that ran the span; drives the bar colour. */
  service?: string;
  /** Start in ms on any origin shared by all spans of the trace. */
  start: number;
  /** Duration in ms. */
  duration: number;
  status?: SpanStatus;
  /** `server`, `client`, `producer`, `consumer`, `internal`... shown in the detail. */
  kind?: string;
  attributes?: Record<string, string | number | boolean>;
};

export type TraceNode = {
  span: TraceSpan;
  depth: number;
  children: TraceNode[];
  parent: TraceNode | null;
};

export type TraceTree = {
  roots: TraceNode[];
  byId: Map<string, TraceNode>;
  /** Earliest start and latest end over all spans. */
  start: number;
  end: number;
  duration: number;
};

export type TraceRow = {
  node: TraceNode;
  /** 1-based, among its siblings (aria-posinset). */
  posInSet: number;
  setSize: number;
};

const safeDuration = (s: TraceSpan) => (Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0);
export const spanEnd = (s: TraceSpan) => s.start + safeDuration(s);

/** Build the span tree. Orphans (unknown parent) become roots; a parent cycle is broken at the first repeat. */
export function buildTraceTree(spans: TraceSpan[]): TraceTree {
  const byId = new Map<string, TraceNode>();
  for (const span of spans) {
    if (!byId.has(span.id)) byId.set(span.id, { span, depth: 0, children: [], parent: null });
  }
  const roots: TraceNode[] = [];
  for (const node of byId.values()) {
    const pid = node.span.parentId;
    const parent = pid != null && pid !== node.span.id ? byId.get(pid) : undefined;
    if (parent && !reaches(parent, node, byId)) {
      node.parent = parent;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const order = (a: TraceNode, b: TraceNode) => a.span.start - b.span.start || spanEnd(b.span) - spanEnd(a.span) || a.span.id.localeCompare(b.span.id);
  const setDepth = (n: TraceNode, depth: number) => {
    n.depth = depth;
    n.children.sort(order);
    for (const c of n.children) setDepth(c, depth + 1);
  };
  roots.sort(order);
  for (const r of roots) setDepth(r, 0);

  let start = Infinity;
  let end = -Infinity;
  for (const n of byId.values()) {
    start = Math.min(start, n.span.start);
    end = Math.max(end, spanEnd(n.span));
  }
  if (!Number.isFinite(start)) { start = 0; end = 0; }
  return { roots, byId, start, end, duration: Math.max(0, end - start) };
}

/** Would attaching `child` under `parent` close a loop? (parent is already a descendant of child) */
function reaches(parent: TraceNode, child: TraceNode, byId: Map<string, TraceNode>): boolean {
  let cur: TraceNode | undefined = parent;
  const seen = new Set<string>();
  while (cur) {
    if (cur === child) return true;
    if (seen.has(cur.span.id)) return true;
    seen.add(cur.span.id);
    const pid: string | null | undefined = cur.span.parentId;
    cur = pid != null ? byId.get(pid) : undefined;
  }
  return false;
}

/** Rows in display order: a depth-first walk that skips the children of collapsed spans. */
export function visibleRows(tree: TraceTree, collapsed: ReadonlySet<string>): TraceRow[] {
  const rows: TraceRow[] = [];
  const walk = (nodes: TraceNode[]) => {
    nodes.forEach((node, i) => {
      rows.push({ node, posInSet: i + 1, setSize: nodes.length });
      if (node.children.length && !collapsed.has(node.span.id)) walk(node.children);
    });
  };
  walk(tree.roots);
  return rows;
}

/** Ids of every span that has children. */
export function expandableIds(tree: TraceTree): string[] {
  const out: string[] = [];
  for (const n of tree.byId.values()) if (n.children.length) out.push(n.span.id);
  return out;
}

/**
 * The critical path: the chain of spans that decided when the trace finished. Starting at the root, walk back from
 * its end: the child that finished last (but not after the cursor) is on the path, then continue from its start with the
 * remaining children, and recurse into each chosen child. Self time of a span is not a span, so it is not marked.
 */
export function criticalPathIds(tree: TraceTree): Set<string> {
  const out = new Set<string>();
  if (!tree.roots.length) return out;
  // With several roots the one that finished last decides the trace.
  const root = tree.roots.reduce((best, n) => (spanEnd(n.span) > spanEnd(best.span) ? n : best));
  const walk = (node: TraceNode, bound: number) => {
    out.add(node.span.id);
    let cursor = Math.min(bound, spanEnd(node.span));
    const kids = [...node.children].sort((a, b) => spanEnd(b.span) - spanEnd(a.span) || b.span.start - a.span.start);
    for (const kid of kids) {
      // A child that starts at or after the cursor ended after it, or was hidden behind a later one: it did not block.
      if (kid.span.start >= cursor) continue;
      walk(kid, Math.min(spanEnd(kid.span), cursor));
      cursor = kid.span.start;
    }
  };
  walk(root, spanEnd(root.span));
  return out;
}

/** Nice tick values (ms offsets from the trace start) for a ruler: about `target` ticks, 1/2/5 steps. */
export function rulerTicks(duration: number, target = 5): number[] {
  if (!(duration > 0)) return [0];
  const raw = duration / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const base = raw / pow;
  const step = (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let t = 0; t <= duration + step * 1e-9; t += step) out.push(Number(t.toFixed(9)));
  return out;
}

// ── Labels that fit the track ───────────────────────────────────────────────────────────────────
// The ruler and duration labels are placed for the measured width of the time track. Their width is an estimate
// from the number of characters (text-xs, a little wide on purpose) rather than a measurement, so kui-react and
// kui-ejs's browser script place them the same way without measuring text.

/** Advance of one label character, px (an estimate for text-xs). */
export const LABEL_CHAR_PX = 7.5;
/** Space between a label and its tick line or bar, px. */
export const LABEL_PAD = 4;
/** Least space between two ruler labels, px. */
export const LABEL_GAP = 8;

/** Estimated width of a label, px. */
export function labelPx(text: string): number {
  return Math.ceil(text.length * LABEL_CHAR_PX);
}

/** A ruler tick and where its label goes: after the line, before it, or nowhere (`null`, the line only). */
export type RulerLabel = { t: number; text: string; side: 'after' | 'before' | null };

/**
 * The ruler of a time track `width` px wide. The ticks are the densest of `rulerTicks(duration, 5..1)` whose labels
 * do not touch; each label sits after its line, the last one before it when it would run past the end of the track
 * (left out when it would then touch the label before it). Without a width (not measured yet) the ruler is
 * `rulerTicks(duration)` with every label after its line.
 */
export function rulerLabels(duration: number, width: number, format: (ms: number) => string): RulerLabel[] {
  if (!(width > 0) || !(duration > 0)) return rulerTicks(duration).map((t) => ({ t, text: format(t), side: 'after' }));
  let ticks = [0];
  for (let target = 5; target >= 1; target--) {
    const candidate = rulerTicks(duration, target);
    if (candidate.length < 2) { ticks = candidate; break; }
    const stepPx = ((candidate[1] - candidate[0]) / duration) * width;
    const widest = Math.max(...candidate.map((t) => labelPx(format(t))));
    if (stepPx >= widest + LABEL_PAD + LABEL_GAP) { ticks = candidate; break; }
  }
  const out: RulerLabel[] = ticks.map((t) => ({ t, text: format(t), side: 'after' }));
  const last = out[out.length - 1];
  const x = (last.t / duration) * width;
  if (last.t > 0 && x + LABEL_PAD + labelPx(last.text) > width) {
    const prev = out[out.length - 2];
    const prevEnd = prev ? (prev.t / duration) * width + LABEL_PAD + labelPx(prev.text) : -Infinity;
    last.side = x - LABEL_PAD - labelPx(last.text) >= prevEnd + LABEL_GAP ? 'before' : null;
  }
  return out;
}

/**
 * Which side of its bar a duration label goes, for a time track `width` px wide. After the bar unless the bar ends in
 * the last third, as before; but a label that would run past the end of the track goes before the bar, and one that
 * has no room before the bar goes after it when it fits there. Without a width (not measured yet): the thirds rule.
 */
export function durationLabelSide(box: { left: number; width: number }, text: string, width: number): 'after' | 'before' {
  const preferAfter = box.left + box.width < 66;
  if (!(width > 0)) return preferAfter ? 'after' : 'before';
  const w = labelPx(text);
  const afterFits = ((box.left + box.width) / 100) * width + LABEL_PAD + w <= width;
  const beforeFits = (box.left / 100) * width - LABEL_PAD - w >= 0;
  if (preferAfter) return afterFits ? 'after' : 'before';
  return !beforeFits && afterFits ? 'after' : 'before';
}

/** Position and width of a span's bar as percentages of the trace duration (a minimum width keeps tiny spans visible). */
export function barBox(span: TraceSpan, tree: TraceTree, minWidthPct = 0.4): { left: number; width: number } {
  if (!(tree.duration > 0)) return { left: 0, width: 100 };
  const left = ((span.start - tree.start) / tree.duration) * 100;
  const width = Math.max(minWidthPct, (safeDuration(span) / tree.duration) * 100);
  return { left: Math.min(Math.max(left, 0), 100 - minWidthPct), width: Math.min(width, 100) };
}

/** Self time: the span's duration minus the union of its children's intervals (clipped to the span). */
export function selfTime(node: TraceNode): number {
  const s = node.span.start;
  const e = spanEnd(node.span);
  const spans = node.children
    .map((c) => [Math.max(s, c.span.start), Math.min(e, spanEnd(c.span))] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let curEnd = -Infinity;
  let curStart = 0;
  for (const [a, b] of spans) {
    if (a > curEnd) {
      if (curEnd > -Infinity) covered += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd > -Infinity) covered += curEnd - curStart;
  return Math.max(0, safeDuration(node.span) - covered);
}
