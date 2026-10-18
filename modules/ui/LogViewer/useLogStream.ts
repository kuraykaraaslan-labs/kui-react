'use client';
// modules/ui/LogViewer/useLogStream.ts
//
// The producer side of LogViewer's live tail: `push` lines as they arrive (one by one or in batches); the hook
// coalesces them into at most one state update per `flushMs`, keeps the newest `maxLines`, and counts what it dropped.
// `dropped` also takes the number a server reports ("12 lines were skipped"), so one counter shows both kinds.
// The transport (WebSocket, SSE, polling) stays with the caller.

import { useCallback, useEffect, useRef, useState } from 'react';
import { appendWindow, type LogLine } from './model';

export type UseLogStreamOptions = {
  /** Lines kept in memory; older ones are dropped and counted. Default = 10 000. */
  maxLines?: number;
  /** Coalescing interval in ms. Default = 100. 0 flushes on every push. */
  flushMs?: number;
  /** Lines to start with. */
  initial?: LogLine[];
};

export type LogStream = {
  lines: LogLine[];
  /** Lines evicted from the window plus those reported dropped upstream. */
  dropped: number;
  push: (batch: LogLine | readonly LogLine[], opts?: { dropped?: number }) => void;
  clear: () => void;
};

export function useLogStream(options: UseLogStreamOptions = {}): LogStream {
  const { maxLines = 10_000, flushMs = 100, initial } = options;
  const buffer = useRef<LogLine[]>([]);
  const upstreamDropped = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snap, setSnap] = useState<{ lines: LogLine[]; dropped: number }>(() => ({ lines: initial ?? [], dropped: 0 }));
  const retained = useRef<LogLine[]>(snap.lines);
  const droppedTotal = useRef(0);

  const flush = useCallback(() => {
    timer.current = null;
    const incoming = buffer.current;
    buffer.current = [];
    const { lines, dropped } = appendWindow(retained.current, incoming, maxLines);
    retained.current = lines;
    droppedTotal.current += dropped + upstreamDropped.current;
    upstreamDropped.current = 0;
    setSnap({ lines, dropped: droppedTotal.current });
  }, [maxLines]);

  const push = useCallback((batch: LogLine | readonly LogLine[], opts?: { dropped?: number }) => {
    if (Array.isArray(batch)) buffer.current.push(...(batch as readonly LogLine[]));
    else buffer.current.push(batch as LogLine);
    if (opts?.dropped) upstreamDropped.current += Math.max(0, Math.floor(opts.dropped));
    if (flushMs <= 0) { flush(); return; }
    if (timer.current === null) timer.current = setTimeout(flush, flushMs);
  }, [flush, flushMs]);

  const clear = useCallback(() => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    buffer.current = [];
    upstreamDropped.current = 0;
    droppedTotal.current = 0;
    retained.current = [];
    setSnap({ lines: [], dropped: 0 });
  }, []);

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  return { lines: snap.lines, dropped: snap.dropped, push, clear };
}
