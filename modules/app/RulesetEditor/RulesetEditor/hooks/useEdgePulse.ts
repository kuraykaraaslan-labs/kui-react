'use client';
import { useEffect, useRef, useState } from 'react';
import { PULSE_ON_MS, pulseStep, type EdgeActivity, type PulseMemory } from '../../graph/activity';

/**
 * The connections lit right now: each one whose counter went up flashes for `PULSE_ON_MS`, at most twice a second
 * (`pulseStep`); a rise that comes too soon flashes once when the gap is over. Nothing flashes until the host sends
 * counters, and the first counters only set the baseline.
 */
export function useEdgePulse(activity: Record<string, EdgeActivity>): ReadonlySet<string> {
  const memory = useRef<PulseMemory>(new Map());
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, number>());
  const [lit, setLit] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const flash = (id: string) => {
      setLit((s) => (s.has(id) ? s : new Set(s).add(id)));
      const old = timers.current.get(id);
      if (old !== undefined) window.clearTimeout(old);
      timers.current.set(id, window.setTimeout(() => {
        timers.current.delete(id);
        setLit((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
      }, PULSE_ON_MS));
    };
    const step = pulseStep(memory.current, activity, Date.now());
    step.now.forEach(flash);
    for (const { id, at } of step.later) {
      if (pending.current.has(id)) continue;
      pending.current.set(id, window.setTimeout(() => {
        pending.current.delete(id);
        const seen = memory.current.get(id);
        if (!seen) return;
        seen.last = Date.now();
        flash(id);
      }, Math.max(0, at - Date.now())));
    }
  }, [activity]);

  useEffect(() => {
    const t = timers.current, p = pending.current;
    return () => { t.forEach((h) => window.clearTimeout(h)); p.forEach((h) => window.clearTimeout(h)); };
  }, []);

  return lit;
}
