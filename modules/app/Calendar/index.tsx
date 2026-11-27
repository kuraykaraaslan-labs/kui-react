'use client';
import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import type { CalendarProps, View } from './types';
import { HeaderBar } from './parts/HeaderBar';
import { EventPopover } from './parts/EventPopover';
import { CalendarLegend } from './parts/CalendarLegend';
import { LiveRegion } from './parts/LiveRegion';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';
import { DayView } from './views/DayView';
import { AgendaView } from './views/AgendaView';
import { ResourceView } from './views/ResourceView';
import {
  addDays,
  addMonths,
  periodLabel,
  visibleWindow,
} from './date-utils';
import { mergeMessages, resolveLocale } from './locale';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useRecurrence } from './hooks/useRecurrence';
import {
  CalendarStoreProvider,
  createCalendarStore,
  useCalStore,
  type CalendarStoreHook,
} from './store';

export type {
  CalendarProps,
  Event,
  EventOccurrence,
  View,
  Resource,
  CalendarSource,
  EventColor,
  CalendarMessages,
  WorkingHours,
  CalendarTelemetry,
  CalendarHandle,
} from './types';
export { MiniCalendar } from './parts/MiniCalendar';

export function Calendar(props: CalendarProps) {
  // One store per <Calendar> instance — lazy state keeps it stable across re-renders.
  const [store] = useState<CalendarStoreHook>(() =>
    createCalendarStore({
      date: props.defaultDate ?? new Date(),
      view: props.view ?? 'month',
    }),
  );

  // Reflect controlled `view` prop into the store.
  useEffect(() => {
    if (props.view) store.getState().setView(props.view);
  }, [props.view, store]);

  return (
    <CalendarStoreProvider store={store}>
      <CalendarInner {...props} />
    </CalendarStoreProvider>
  );
}

function CalendarInner({
  events,
  view = 'month',
  onViewChange,
  onDateChange,
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  locale,
  messages: messageOverrides,
  workingHours,
  slotMinutes = 30,
  resources,
  calendars,
  onCalendarToggle,
  hideCalendarLegend,
  onTelemetry,
  monthBars = false,
  monthDrag = false,
  className,
}: CalendarProps) {
  const date = useCalStore((s) => s.date);
  const setStoreDate = useCalStore((s) => s.setDate);
  const openPopover = useCalStore((s) => s.openPopover);
  const setCalendars = useCalStore((s) => s.setCalendars);
  const hiddenCalendarIds = useCalStore((s) => s.hiddenCalendarIds);
  const liveMessage = useCalStore((s) => s.liveMessage);
  const announce = useCalStore((s) => s.announce);

  // Push `calendars` prop into the store so descendants resolve effective colour.
  useEffect(() => {
    setCalendars(calendars ?? []);
  }, [calendars, setCalendars]);

  const localeBundle = useMemo(() => resolveLocale(locale), [locale]);
  const messages = useMemo(
    () => mergeMessages(localeBundle.messages, messageOverrides),
    [localeBundle, messageOverrides],
  );

  const today = useMemo(() => new Date(), []);
  const rootRef = useRef<HTMLDivElement>(null);

  const [windowStart, windowEnd] = useMemo(
    () => visibleWindow(view, date, localeBundle.weekStart),
    [view, date, localeBundle.weekStart],
  );
  const expanded = useRecurrence(events, windowStart, windowEnd);
  // Filter out events from hidden calendars.
  const visibleEvents = useMemo(() => {
    if (!hiddenCalendarIds.size) return expanded;
    return expanded.filter((e) => !e.calendarId || !hiddenCalendarIds.has(e.calendarId));
  }, [expanded, hiddenCalendarIds]);

  const handleCalendarToggle = useCallback(
    (calendarId: string, visible: boolean) => {
      onCalendarToggle?.(calendarId, visible);
      onTelemetry?.({ type: 'calendar-toggle', calendarId, visible });
    },
    [onCalendarToggle, onTelemetry],
  );

  const label = useMemo(
    () => periodLabel(view, date, localeBundle.monthNames, localeBundle.weekStart),
    [view, date, localeBundle.monthNames, localeBundle.weekStart],
  );

  const setDate = useCallback(
    (next: Date, direction: 'prev' | 'next' | 'today') => {
      setStoreDate(next);
      // Navigation reads the period label again (an interaction's message would otherwise stay in the live region).
      announce('');
      onDateChange?.(next);
      onTelemetry?.({ type: 'nav', date: next, direction });
    },
    [setStoreDate, announce, onDateChange, onTelemetry],
  );

  const goPrev = useCallback(() => {
    if (view === 'month' || view === 'agenda' || view === 'resource') {
      setDate(addMonths(date, -1), 'prev');
    } else if (view === 'week') {
      setDate(addDays(date, -7), 'prev');
    } else {
      setDate(addDays(date, -1), 'prev');
    }
  }, [view, date, setDate]);

  const goNext = useCallback(() => {
    if (view === 'month' || view === 'agenda' || view === 'resource') {
      setDate(addMonths(date, 1), 'next');
    } else if (view === 'week') {
      setDate(addDays(date, 7), 'next');
    } else {
      setDate(addDays(date, 1), 'next');
    }
  }, [view, date, setDate]);

  const goToday = useCallback(() => {
    setDate(new Date(), 'today');
  }, [setDate]);

  const stepDays = useCallback(
    (delta: number) => {
      setDate(addDays(date, delta), delta < 0 ? 'prev' : 'next');
    },
    [date, setDate],
  );

  const handleViewChange = useCallback(
    (v: View) => {
      onViewChange?.(v);
      onTelemetry?.({ type: 'view-change', view: v });
    },
    [onViewChange, onTelemetry],
  );

  const handleEventClick = useCallback(
    (event: Parameters<NonNullable<CalendarProps['onEventClick']>>[0], rect?: DOMRect) => {
      if (rect) openPopover(event, rect);
      onEventClick?.(event);
      onTelemetry?.({ type: 'event-click', eventId: event.id });
    },
    [openPopover, onEventClick, onTelemetry],
  );

  useKeyboardNav({ rootRef, onPrev: goPrev, onNext: goNext, onToday: goToday, onStepDays: stepDays });

  // Announce nav changes via the live region (M6).
  const announcement = useMemo(() => messages.showing(label), [messages, label]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={cn(
        'flex flex-col w-full rounded-lg border border-border bg-surface-base overflow-hidden',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
      aria-label="Calendar"
    >
      <HeaderBar
        label={label}
        view={view}
        onViewChange={handleViewChange}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        messages={messages}
      />

      {!hideCalendarLegend && calendars && calendars.length > 0 && (
        <CalendarLegend messages={messages} onToggle={handleCalendarToggle} />
      )}

      {view === 'month' && (
        <MonthView
          date={date}
          events={visibleEvents}
          locale={{ ...localeBundle, messages }}
          today={today}
          onEventClick={handleEventClick}
          bars={monthBars}
          rangeDrag={monthDrag}
          onEventCreate={onEventCreate}
          onEventUpdate={onEventUpdate}
          onStepDays={stepDays}
          onTelemetry={onTelemetry}
        />
      )}
      {view === 'week' && (
        <WeekView
          date={date}
          events={visibleEvents}
          locale={{ ...localeBundle, messages }}
          today={today}
          workingHours={workingHours}
          slotMinutes={slotMinutes}
          onEventClick={handleEventClick}
          onEventCreate={onEventCreate}
          onEventUpdate={onEventUpdate}
          onTelemetry={onTelemetry}
        />
      )}
      {view === 'day' && (
        <DayView
          date={date}
          events={visibleEvents}
          locale={{ ...localeBundle, messages }}
          today={today}
          workingHours={workingHours}
          slotMinutes={slotMinutes}
          onEventClick={handleEventClick}
          onEventCreate={onEventCreate}
          onEventUpdate={onEventUpdate}
          onTelemetry={onTelemetry}
        />
      )}
      {view === 'agenda' && (
        <AgendaView
          events={visibleEvents}
          locale={{ ...localeBundle, messages }}
          today={today}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'resource' && (
        <ResourceView
          date={date}
          events={visibleEvents}
          resources={resources ?? []}
          locale={{ ...localeBundle, messages }}
          today={today}
          workingHours={workingHours}
          slotMinutes={slotMinutes}
          onEventClick={handleEventClick}
          onTelemetry={onTelemetry}
        />
      )}

      <EventPopover
        messages={messages}
        onEventUpdate={onEventUpdate}
        onEventDelete={onEventDelete}
        onTelemetry={onTelemetry}
      />

      <LiveRegion message={liveMessage || announcement} />
    </div>
  );
}
