/**
 * Live activity on the canvas (next-boilerplate automation 09 §9.5): how many messages passed each connection and each
 * block, as the host counts them, and which connections should light up now. Pure: no React. The host supplies the
 * numbers (a live socket, a poll); nothing here talks to an engine.
 */

/** Counters of one connection: `count` messages so far (in the host's window), `at` the time of the last one (ms). */
export type EdgeActivity = { count: number; at?: number };

/** Counters of one block. `out` is one number or a count per output port (the error port is `error`). */
export type NodeActivity = { in?: number; out?: number | Record<string, number>; errors?: number; avgMs?: number };

/**
 * What the host knows of the traffic: per connection id, per block id, or both. A connection the host does not list
 * takes the count of its source port (`nodes[source].out[port]`), since every message on a port goes down each of its
 * connections. `window` names the span the numbers cover ("last 24 h"), shown with them.
 */
export type CanvasActivity = {
  edges?: Record<string, EdgeActivity>;
  nodes?: Record<string, NodeActivity>;
  window?: string;
};

type EdgeRef = { edgeId: string; sourceNodeId: string; sourcePort: string };

/** the messages a block sent on one port, or null when the host does not count it */
export function portCount(stats: NodeActivity | undefined, port: string): number | null {
  const out = stats?.out;
  if (out == null) return null;
  if (typeof out === 'number') return port === 'error' ? null : out;
  const n = out[port];
  return typeof n === 'number' ? n : null;
}

/** total of a block's `out`, whatever its shape */
export function outTotal(stats: NodeActivity | undefined): number | null {
  const out = stats?.out;
  if (out == null) return null;
  if (typeof out === 'number') return out;
  return Object.values(out).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
}

/** The counters of each connection of the graph: the host's own, else its source port's. Connections with no number are left out. */
export function edgeActivityOf(edges: readonly EdgeRef[], activity: CanvasActivity | undefined): Record<string, EdgeActivity> {
  const out: Record<string, EdgeActivity> = {};
  if (!activity) return out;
  for (const e of edges) {
    const own = activity.edges?.[e.edgeId];
    if (own) { out[e.edgeId] = own; continue; }
    const n = portCount(activity.nodes?.[e.sourceNodeId], e.sourcePort);
    if (n !== null) out[e.edgeId] = { count: n };
  }
  return out;
}

/** The shortest gap between two flashes of one connection: 2 Hz at most. */
export const PULSE_GAP_MS = 500;
/** How long a flash stays lit. Less than the gap, so a busy connection blinks instead of staying lit. */
export const PULSE_ON_MS = 400;

/** what the pulse gate remembers per connection */
export type PulseMemory = Map<string, { count: number; at?: number; last: number }>;

/**
 * Which connections flash now and which later: a connection flashes when its count or its `at` went up since the last
 * call, at most once every `gap` ms; one that went up too soon after its last flash is returned in `later` with the time
 * it may flash. The first sight of a connection only records it (opening the editor does not light every busy wire).
 * `memory` is updated in place.
 */
export function pulseStep(memory: PulseMemory, current: Record<string, EdgeActivity>, now: number, gap = PULSE_GAP_MS): { now: string[]; later: { id: string; at: number }[] } {
  const fire: string[] = [];
  const later: { id: string; at: number }[] = [];
  for (const [id, a] of Object.entries(current)) {
    const seen = memory.get(id);
    if (!seen) { memory.set(id, { count: a.count, at: a.at, last: -Infinity }); continue; }
    const moved = a.count > seen.count || (a.at !== undefined && (seen.at === undefined || a.at > seen.at));
    // a count that went down is a new window (a restart, a reset): remember it, no flash
    seen.count = a.count;
    seen.at = a.at;
    if (!moved) continue;
    if (now - seen.last >= gap) { seen.last = now; fire.push(id); }
    else later.push({ id, at: seen.last + gap });
  }
  for (const id of [...memory.keys()]) if (!(id in current)) memory.delete(id);
  return { now: fire, later };
}
