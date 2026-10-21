/** Types of the runtime insight panel (busiest blocks, debug messages, caught errors, context fill). The host
 *  supplies all numbers; nothing here talks to an engine. */

/** Counters of one block. `out` is one number or a count per output port. A counter id with a path
 *  such as `s1/x` belongs to the block on the canvas named by its first segment. */
export type NodeStats = {
  in?: number;
  out?: number | Record<string, number>;
  errors?: number;
  /** mean handling time in milliseconds */
  avgMs?: number;
};

export type BusiestKey = 'in' | 'ms' | 'errors';

export type BusiestRow = { id: string; in: number; out: number; errors: number; ms: number };

export type DebugKind = 'msg' | 'error' | 'warn';

/** what the kind filter of the Debug tab shows */
export type DebugKindFilter = 'all' | 'problem' | 'msg';

export type DebugMessage = {
  /** increasing sequence number given by the host ring */
  seq: number;
  /** seconds since the epoch */
  ts: number;
  flow?: string;
  /** id of the block (an id with a path, `s1/x`, belongs to the block `s1`) */
  node: string;
  name?: string;
  kind: DebugKind;
  /** the text of an error or warning */
  text?: string;
  msg?: unknown;
  topic?: string | number;
  /** the message property that was shown, default `msg` */
  prop?: string;
  truncated?: boolean;
  /** bytes of the value that was cut (with `truncated`) */
  size?: number;
  /** set on error messages: the block that took the error */
  caught?: string | null;
};

/** One run of the history, as far as this panel needs it. */
export type RunRecord = {
  ts?: number;
  errors?: { node: string; message?: string; code?: string; caught?: string | null }[];
};

export type CaughtError = { node: string; text: string; caught: string; count: number; last: number };

export type ErrorRow = { flow: string; node: string; name: string; text: string; count: number; first: number; last: number };

export type ContextStore = 'memory' | 'persist';
export type ContextScope = 'flow' | 'global' | 'sys';

/** Bytes used against the limit of a store. Both missing: no bar. */
export type ContextUsage = { bytes?: number; limit?: number };

export type FillTone = 'ok' | 'warn' | 'full';

export type ContextFill = { bytes: number; limit: number; pct: number; tone: FillTone };

/** Something that happened on the host lately (an event the host's bus carried), offered as a start for a trigger block. */
export type EventRecord = { seq: number; ts: number; source: string; kind: string; data?: unknown };
