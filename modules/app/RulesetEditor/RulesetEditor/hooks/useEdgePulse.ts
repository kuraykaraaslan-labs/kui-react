'use client';
import { useEffect, useRef, useState } from 'react';
import { PULSE_ON_MS, pulseStep, type EdgeActivity, type PulseMemory } from '../../graph/activity';

/**
 * The connections lit right now: each one whose counter went up flashes for `PULSE_ON_MS`, at most twice a second
 * (`pulseStep`); a rise that comes too soon flashes once when the gap is over. Nothing flashes until the host sends
 * counters, and the first counters only set the baseline.
 *
 * The connections that light up together are one batch: one state change to light them, one timer and one state change
 * to put them out (so a busy flow costs two renders per counter update, not two per connection). The rises that must wait
 * share one timer too, set for the earliest of them.
 */
export function useEdgePulse(activity: Record<string, EdgeActivity>): ReadonlySet<string> {
  const memory = useRef<PulseMemory>(new Map());
  /** the batch each lit connection belongs to: a newer flash of it moves it to the newer batch */
  const batchOf = useRef(new Map<string, number>());
  const nextBatch = useRef(0);
  const offTimers = useRef(new Set<number>());
  /** rises waiting for their gap: id -> the time it may flash */
  const pending = useRef(new Map<string, number>());
  const pendingTimer = useRef<{ handle: number; at: number } | null>(null);
  const [lit, setLit] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const flash = (ids: readonly string[]) => {
      if (!ids.length) return;
      const batch = ++nextBatch.current;
      for (const id of ids) batchOf.current.set(id, batch);
      setLit((s) => {
        if (ids.every((id) => s.has(id))) return s;
        const n = new Set(s);
        for (const id of ids) n.add(id);
        return n;
      });
      const handle = window.setTimeout(() => {
        offTimers.current.delete(handle);
        const off = ids.filter((id) => batchOf.current.get(id) === batch);
        if (!off.length) return;
        for (const id of off) batchOf.current.delete(id);
        setLit((s) => {
          if (!off.some((id) => s.has(id))) return s;
          const n = new Set(s);
          for (const id of off) n.delete(id);
          return n;
        });
      }, PULSE_ON_MS);
      offTimers.current.add(handle);
    };
    const schedule = () => {
      if (!pending.current.size) return;
      const at = Math.min(...pending.current.values());
      if (pendingTimer.current && pendingTimer.current.at <= at) return;
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current.handle);
      const handle = window.setTimeout(() => {
        pendingTimer.current = null;
        const now = Date.now();
        const due: string[] = [];
        for (const [id, t] of pending.current) {
          if (t > now) continue;
          pending.current.delete(id);
          const seen = memory.current.get(id);
          if (!seen) continue;
          seen.last = now;
          due.push(id);
        }
        flash(due);
        schedule();
      }, Math.max(0, at - Date.now()));
      pendingTimer.current = { handle, at };
    };
    const step = pulseStep(memory.current, activity, Date.now());
    flash(step.now);
    for (const { id, at } of step.later) if (!pending.current.has(id)) pending.current.set(id, at);
    schedule();
  }, [activity]);

  useEffect(() => {
    const offs = offTimers.current, wait = pendingTimer;
    return () => {
      offs.forEach((h) => window.clearTimeout(h));
      if (wait.current) window.clearTimeout(wait.current.handle);
    };
  }, []);

  return lit;
}
