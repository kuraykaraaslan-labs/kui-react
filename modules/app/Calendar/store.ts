'use client';
/* =========================================================
   PER-INSTANCE ZUSTAND STORE
   Each <Calendar> creates its own store via
   `createCalendarStore()` and provides it through
   `CalendarStoreContext`. Sub-components read state via
   `useCalStore(selector)`.
   Pattern mirrors modules/app/RichTextEditor/store.ts.
========================================================= */

import { createContext, createElement, useContext } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type {
  CalendarDragState,
  CalendarPopoverState,
  CalendarSource,
  Event,
  View,
} from './types';

export type CalendarState = {
  // Navigation
  date: Date;
  view: View;

  // Popover anchored to a clicked event
  popover: CalendarPopoverState;

  // Drag / resize / create preview (single source of truth for the ghost)
  drag: CalendarDragState;

  // Multi-calendar overlay — sources are pushed by index.tsx on prop change so
  // sub-components can resolve event colours via the store (M4).
  calendars: CalendarSource[];
  hiddenCalendarIds: Set<string>;

  // Live-region text pushed by an interaction (month range drag); cleared on navigation so the period label is read again.
  liveMessage: string;
};

export type CalendarActions = {
  setDate: (d: Date) => void;
  setView: (v: View) => void;

  openPopover: (event: Event, anchorRect: DOMRect) => void;
  closePopover: () => void;

  setDrag: (d: CalendarDragState) => void;

  setCalendars: (cals: CalendarSource[]) => void;
  toggleCalendar: (id: string) => void;

  announce: (message: string) => void;
};

export type CalendarStore = CalendarState & CalendarActions;

const IDLE_DRAG: CalendarDragState = { kind: 'idle' };
const EMPTY_POPOVER: CalendarPopoverState = { event: null, anchorRect: null };

export function createCalendarStore(initial: { date: Date; view: View }) {
  return create<CalendarStore>((set) => ({
    date: initial.date,
    view: initial.view,
    popover: EMPTY_POPOVER,
    drag: IDLE_DRAG,
    calendars: [],
    hiddenCalendarIds: new Set<string>(),
    liveMessage: '',

    setDate: (d) => set({ date: d }),
    setView: (v) => set({ view: v }),

    openPopover: (event, anchorRect) => set({ popover: { event, anchorRect } }),
    closePopover: () => set({ popover: EMPTY_POPOVER }),

    setDrag: (d) => set({ drag: d }),

    setCalendars: (cals) => set({ calendars: cals }),
    toggleCalendar: (id) =>
      set((s) => {
        const next = new Set(s.hiddenCalendarIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { hiddenCalendarIds: next };
      }),

    announce: (message) => set({ liveMessage: message }),
  }));
}

export type CalendarStoreHook = UseBoundStore<StoreApi<CalendarStore>>;

const CalendarStoreContext = createContext<CalendarStoreHook | null>(null);

export function CalendarStoreProvider({
  store,
  children,
}: {
  store: CalendarStoreHook;
  children: React.ReactNode;
}) {
  return createElement(CalendarStoreContext.Provider, { value: store }, children);
}

export function useCalStore<T>(selector: (s: CalendarStore) => T): T {
  const store = useContext(CalendarStoreContext);
  if (!store) throw new Error('useCalStore must be used inside <CalendarStoreProvider>');
  return store(selector);
}

export function useCalStoreApi(): CalendarStoreHook {
  const store = useContext(CalendarStoreContext);
  if (!store) throw new Error('useCalStoreApi must be used inside <CalendarStoreProvider>');
  return store;
}
