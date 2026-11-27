/**
 * Calendar module — public types.
 *
 * M1: month / week / day views.       — done
 * M2: interactions (popover + drag).  — in progress
 * M3: RRULE recurrence.               — stub
 * M4: resource / multi-calendar.      — stub
 * M5: agenda + mini + search.         — stub
 * M6: full a11y / i18n / perf.        — stub
 *
 * See modules/app/Calendar/PLAN.md for the roadmap.
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type View = 'month' | 'week' | 'day' | 'agenda' | 'resource';

/** Color hint used for the event pill / bar. */
export type EventColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'secondary'
  | 'neutral';

/** A single calendar event. */
export type Event = {
  id: string;
  title: string;
  /** Inclusive start instant. */
  start: Date;
  /** Exclusive end instant. */
  end: Date;
  /** True → renders as an all-day bar instead of a timed pill. */
  allDay?: boolean;
  /** Token-based color; fallback "primary". */
  color?: EventColor;
  /** Optional FontAwesome icon shown next to the title. */
  icon?: IconDefinition;
  /** Optional plain-text description (used by popover). */
  description?: string;
  /** Optional calendar identifier — wired up properly in M4. */
  calendarId?: string;
  /**
   * RFC 5545 RRULE string (without `DTSTART:` prefix), e.g.
   * `FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10`.
   * Occurrences are expanded for the visible date range only.
   * Supported tokens (M3 subset): FREQ, INTERVAL, COUNT, UNTIL, BYDAY.
   */
  rrule?: string;
  /** Dates to skip when expanding `rrule` (matched on day boundary). */
  exceptions?: Date[];
  /** Resource (room / person / lane) the event belongs to. Used by ResourceView. */
  resourceId?: string;
};

/**
 * Materialised occurrence of a recurring event. The `id` becomes
 * `${parent.id}::${ISO start}` so consumers can distinguish a single
 * instance from the series. `parentId` + `originalStart` are added
 * so handlers can scope edits ("this", "this and following", "series").
 */
export type EventOccurrence = Event & {
  parentId?: string;
  originalStart?: Date;
  isRecurrence?: boolean;
};

/** Resource (room / person / lane). Real handling in M4. */
export type Resource = {
  id: string;
  name: string;
  color?: EventColor;
};

/** Locale messages — translatable strings displayed in chrome. */
export type CalendarMessages = {
  today: string;
  previous: string;
  next: string;
  month: string;
  week: string;
  day: string;
  agenda: string;
  resource: string;
  allDay: string;
  noEvents: string;
  more: (n: number) => string;
  /** Popover action labels (M2). */
  edit: string;
  delete: string;
  confirmDelete: string;
  close: string;
  /** Legend section title (M4). */
  calendars: string;
  /** Empty-state for ResourceView when `resources` is empty (M4). */
  noResources: string;
  /** Agenda search input placeholder (M5). */
  search: string;
  /** Live-region announcement for nav changes — receives the new period label (M6). */
  showing: (periodLabel: string) => string;
  /** Cell aria-label template — `${weekday} ${day} ${month}` + event count (M6). */
  cellLabel: (dateLabel: string, eventCount: number) => string;
  /** Month range drag (`monthDrag`): live-region text for a keyboard day selection; `days` is "14 May – 16 May" or "14 May". */
  rangeSelected: (days: string) => string;
  /** Month range drag: live-region text after a bar was moved or resized from the keyboard. */
  rangeChanged: (title: string, days: string) => string;
  /** Month range drag: screen-reader hint on the day cells. */
  cellKeysHint: string;
  /** Month range drag: screen-reader hint on the bars. */
  barKeysHint: string;
};

/** Working-hours config (visual shading hint only in M1). */
export type WorkingHours = {
  /** 0–23 inclusive — slot start hour. */
  start: number;
  /** 0–23 inclusive — slot end hour. */
  end: number;
  /** ISO weekday numbers (0=Sun … 6=Sat). */
  days: number[];
};

/** Popover state held in the store. */
export type CalendarPopoverState = {
  event: Event | null;
  anchorRect: DOMRect | null;
};

/** Drag preview state — single source of truth for ghost rendering. */
export type CalendarDragState =
  | { kind: 'idle' }
  | { kind: 'move'; eventId: string; ghostStart: Date; ghostEnd: Date; dayIndex: number }
  | { kind: 'resize'; eventId: string; ghostEnd: Date }
  | { kind: 'create'; ghostStart: Date; ghostEnd: Date; dayIndex: number }
  /** Month view day-range drag (`monthDrag`): the ghost days are `[ghostStart, ghostEnd)`. */
  | {
      kind: 'range';
      change: 'create' | 'move' | 'resize-start' | 'resize-end';
      eventId?: string;
      ghostStart: Date;
      ghostEnd: Date;
    };

/** Telemetry payload — reserved for future analytics integrations. */
export type CalendarTelemetry =
  | { type: 'view-change'; view: View }
  | { type: 'nav'; date: Date; direction: 'prev' | 'next' | 'today' }
  | { type: 'event-click'; eventId: string }
  | { type: 'event-create'; start: Date; end: Date }
  | { type: 'event-update'; eventId: string }
  | { type: 'event-delete'; eventId: string }
  | { type: 'calendar-toggle'; calendarId: string; visible: boolean };

/** A named calendar — a logical grouping of events with a shared color. */
export type CalendarSource = {
  id: string;
  name: string;
  color: EventColor;
};

export type CalendarProps = {
  /** Events to render. Caller is responsible for fetching & memoising. */
  events: Event[];
  /** Active view; controlled by caller. Default "month". */
  view?: View;
  /** Date the view is anchored to. Default `new Date()`. */
  defaultDate?: Date;
  /** Called when the user picks a view. URL-state wiring is caller's job. */
  onViewChange?: (v: View) => void;
  /** Called when navigating (today / prev / next / keyboard). */
  onDateChange?: (d: Date) => void;
  /** Click handler — fires once per event press. */
  onEventClick?: (e: Event) => void;
  /**
   * Fired after a drag-create gesture commits. From the month view (`monthDrag`) the range is whole days: `start` is the first
   * day 00:00, `end` the day after the last day 00:00 (exclusive), and `allDay` is true.
   */
  onEventCreate?: (range: { start: Date; end: Date; allDay?: boolean }) => void | Promise<void>;
  /** Fired after a drag-move or resize gesture commits. */
  onEventUpdate?: (event: Event) => void | Promise<void>;
  /** Fired from the popover's delete-confirm. */
  onEventDelete?: (id: string) => void | Promise<void>;

  /**
   * Month view: draw all-day and multi-day events as continuous bars across the day cells and week rows (lanes, "+N more"),
   * instead of one card per day. Default false. Implied by `monthDrag`.
   */
  monthBars?: boolean;
  /**
   * Month view: drag across empty days to create an all-day range (`onEventCreate`), drag a bar to move it and drag a bar's
   * start or end edge to resize it (`onEventUpdate`), all by whole days keeping the times of day. Keyboard: Shift + arrows
   * select days and Enter creates; on a bar Alt + arrows move, Shift + Left / Right change the end and Alt + Shift + Left /
   * Right change the start. Default false (opt-in; the week / day time grid drag is always on).
   */
  monthDrag?: boolean;

  /** Resources column list — used by ResourceView. */
  resources?: Resource[];
  /**
   * Multi-calendar overlay. Each calendar contributes a color + visibility
   * toggle (via the legend); events with a matching `calendarId` inherit the
   * calendar's color when they don't carry their own.
   */
  calendars?: CalendarSource[];
  /** Fired when the user toggles a calendar's visibility in the legend. */
  onCalendarToggle?: (calendarId: string, visible: boolean) => void;
  /** Hide the legend even when `calendars` is provided. */
  hideCalendarLegend?: boolean;
  /** Lazy RRULE expansion toggle. Defaults to false until M3 lands. */
  recurrence?: boolean;
  /** Locale code — currently "tr" or "en". Default "tr". */
  locale?: string;
  /** Override individual chrome strings. */
  messages?: Partial<CalendarMessages>;
  /** Optional working-hours hint. */
  workingHours?: WorkingHours;
  /** Time-slot granularity in week / day views. */
  slotMinutes?: 5 | 15 | 30 | 60;
  /** Disable enter / leave animations. */
  reducedMotion?: boolean;
  /** IANA timezone string — full support arrives in M6. */
  timezone?: string;
  /** Optional telemetry sink. */
  onTelemetry?: (e: CalendarTelemetry) => void;
  /** Extra class on the outer wrapper. */
  className?: string;
};

/** Imperative handle — caller can drive nav programmatically (M2+). */
export type CalendarHandle = {
  goToToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  setView: (v: View) => void;
};
