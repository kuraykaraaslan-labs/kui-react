'use client';
// The board-level "Still watching?" (next-boilerplate iot-camera phase 05, OD-169): every video card of a board that
// streams and asks shares ONE presence group, so a board of twelve cameras asks once and, with no answer, stops all
// twelve. A card outside a board asks on its own. The group and its prompt live in kui-player; this file only
// collects who wants to be asked and how often, and loads kui-player's React subpath when someone does.
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { PresenceGroup } from '@kuraykaraaslan/kui-player';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';

const VideoPresenceLayer = lazy(() => import('./VideoPresenceLayer').then((m) => ({ default: m.VideoPresenceLayer })));

/** What a card asks for: the interval and the time to answer (ms), and the language of the prompt. */
export interface PresenceRequest {
  everyMs: number;
  graceMs: number;
  locale?: string;
}

interface Board {
  /** The shared group, once kui-player has loaded; null before that and while no card asks. */
  group: PresenceGroup | null;
  register: (id: string, request: PresenceRequest) => () => void;
}

const BoardContext = createContext<Board | null>(null);

/** The request that asks soonest wins: one board, one interval. */
export function soonest(requests: Iterable<PresenceRequest>): PresenceRequest | null {
  let lead: PresenceRequest | null = null;
  for (const r of requests) if (!lead || r.everyMs < lead.everyMs) lead = r;
  return lead;
}

/** Wrap a board: its video cards share one presence group. Renders nothing of its own. */
export function VideoPresenceBoard({ children }: { children?: ReactNode }) {
  const [requests, setRequests] = useState<ReadonlyMap<string, PresenceRequest>>(() => new Map());
  const [group, setGroup] = useState<PresenceGroup | null>(null);

  const register = useCallback((id: string, request: PresenceRequest) => {
    setRequests((prev) => new Map(prev).set(id, request));
    return () => setRequests((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const lead = useMemo(() => soonest(requests.values()), [requests]);
  const value = useMemo<Board>(() => ({ group: lead ? group : null, register }), [lead, group, register]);

  return (
    <BoardContext.Provider value={value}>
      {children}
      {lead && (
        // A prompt that cannot load must not take the board with it: the cards then simply never ask.
        <ContributionBoundary>
          <Suspense fallback={null}>
            <VideoPresenceLayer everyMs={lead.everyMs} graceMs={lead.graceMs} locale={lead.locale} onGroup={setGroup} />
          </Suspense>
        </ContributionBoundary>
      )}
    </BoardContext.Provider>
  );
}

/**
 * The `presence` prop for one card's player. `false` = never asks (the card has it off, or it is not a stream), and
 * also while the board's group is still loading. In a board: the shared group. Alone: its own interval, asked inside
 * the player.
 */
export function useVideoPresence(
  presence: { everyMs: number; graceMs: number } | null, locale: string | undefined,
): PresenceGroup | { everyMs: number; graceMs: number } | false {
  const board = useContext(BoardContext);
  const id = useId();
  const everyMs = presence?.everyMs;
  const graceMs = presence?.graceMs;
  const register = board?.register;

  useEffect(() => {
    if (!register || everyMs === undefined || graceMs === undefined) return;
    return register(id, { everyMs, graceMs, locale });
  }, [register, id, everyMs, graceMs, locale]);

  const group = board?.group ?? null;
  const inBoard = board !== null;
  return useMemo(() => {
    if (everyMs === undefined || graceMs === undefined) return false;
    return inBoard ? group ?? false : { everyMs, graceMs };
  }, [everyMs, graceMs, inBoard, group]);
}
