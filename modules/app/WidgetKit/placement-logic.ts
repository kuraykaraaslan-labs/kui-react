// The pure status logic of a placement (no React): which slots are bound, how old the data is and what the
// card body shows. `PlacementCard.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { SlotData, SlotSpec } from './kind';
import type { CardSettings } from './settings/types';
import type { WidgetCardState } from './card-logic';

/** The newest `fetchedAt` across bound slots. */
export function newestFetch(data: Record<string, SlotData | undefined>): number | null {
  let best: number | null = null;
  for (const d of Object.values(data)) {
    const t = d?.fetchedAt ? Date.parse(d.fetchedAt) : NaN;
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best;
}

export interface PlacementStatusInput {
  slots: SlotSpec[];
  data: Record<string, SlotData | undefined>;
  card: CardSettings;
  /** Slot keys bound to a source; defaults to the keys of `data`. */
  boundSlots?: string[];
  loading?: boolean;
  error?: string | null;
  isEditor?: boolean;
  /** The type's `isEmpty` already asked of the data. */
  empty: boolean;
  now: number;
}

/** Whether a required slot, or every slot of an any-of group, is still unbound. */
export function requiredUnbound(slots: SlotSpec[], bound: string[]): boolean {
  const isBound = (s: SlotSpec) => bound.some((b) => b === s.key || b.startsWith(`${s.key}#`));
  const groups = [...new Set(slots.flatMap((s) => (s.anyOf ? [s.anyOf] : [])))];
  return slots.some((s) => s.required && !isBound(s)) || groups.some((g) => !slots.some((s) => s.anyOf === g && isBound(s)));
}

export function placementStatus(i: PlacementStatusInput): { bound: string[]; fetchedAt: number | null; stale: boolean; state: WidgetCardState } {
  const bound = i.boundSlots ?? Object.keys(i.data).filter((k) => i.data[k] !== undefined);
  const fetchedAt = newestFetch(i.data);
  const stale = !!i.card.staleAfterSeconds && fetchedAt !== null && i.now - fetchedAt > i.card.staleAfterSeconds * 1000;
  let state: WidgetCardState = 'ready';
  if (i.error) state = 'error';
  else if (i.loading && fetchedAt === null) state = 'loading';
  else if (i.slots.length > 0 && requiredUnbound(i.slots, bound)) state = i.isEditor ? 'unconfigured' : 'empty';
  else if (i.empty) state = 'empty';
  return { bound, fetchedAt, stale, state };
}
