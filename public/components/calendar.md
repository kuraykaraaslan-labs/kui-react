# Calendar

- **id:** `calendar`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/Calendar/index.tsx`
- **status:** beta
- **since:** 2026-05

Month / week / day / agenda / resource calendar with view switcher, full keyboard nav (PageUp/Down + T + arrow keys for day-step), per-event color and icon, all-day bars + timed pills, opt-in continuous multi-day bars in the month view (monthBars) with day-range drag-create, drag-move and edge-resize plus keyboard equivalents (monthDrag), TR/EN locales, full interactions (anchored popover, drag-move, edge-resize, drag-create), in-house RRULE expansion (FREQ/INTERVAL/COUNT/UNTIL/BYDAY + exceptions), multi-calendar overlay with per-calendar visibility legend, ResourceView lanes with O(n²) conflict highlighting, agenda list (search + date grouping) and a composable MiniCalendar sidebar. WAI-ARIA grid pattern with live-region nav announcements ("Showing May 2026") and event-count cell labels ("Tuesday May 12, 3 events"). Optional Intl.DateTimeFormat-based time formatting for locale-aware clocks.

## Accessibility

- WCAG: AA
- ARIA patterns: Grid (month), Tablist (view switcher), Region (week/day), Live region (nav announcements), Dialog (event popover)
- Keyboard:
  - `Page Up` — Previous period (month / week / day)
  - `Page Down` — Next period (month / week / day)
  - `T` — Jump to today
  - `Arrow Left` — Step back one day
  - `Arrow Right` — Step forward one day
  - `Arrow Up` — Step back one week
  - `Arrow Down` — Step forward one week
  - `Escape` — Close popover / cancel drag in progress / drop a month day selection
  - `Shift + Arrow keys` — Month view with monthDrag, on a day: select days from the focused day
  - `Enter` — Month view with monthDrag, on a day: create an all-day event for the selection (or the day)
  - `Alt + Arrow keys` — Month view with monthDrag, on a bar: move it by a day (Left / Right) or a week (Up / Down)
  - `Shift + Arrow Left / Right` — Month view with monthDrag, on a bar: change its end by a day
  - `Alt + Shift + Arrow Left / Right` — Month view with monthDrag, on a bar: change its start by a day
  - `Tab` — Focus the next interactive element (events, nav buttons, legend chips)

Month view uses role="grid" with role="gridcell" per day. Cells announce "Tuesday May 12, 3 events" via aria-label. View switcher uses role="tablist". Legend chips use role="switch". Nav changes push a polite live-region message ("Showing May 2026"); month range drags announce the selection ("13 May – 15 May selected") and keyboard moves ("Spring sale now runs 14 May – 20 May"), and day cells and bars carry a keyboard hint via aria-describedby. Month drags work with mouse, pen and touch (a touch drag starts after a 300 ms press, so swipes still scroll). Drag is direct manipulation (no animated motion), so prefers-reduced-motion is a no-op for the calendar.

## Design tokens consumed

- `--primary`
- `--primary-fg`
- `--success`
- `--success-fg`
- `--warning`
- `--error`
- `--info`
- `--secondary`
- `--surface-base`
- `--surface-raised`
- `--surface-overlay`
- `--border`
- `--border-focus`
- `--text-primary`
- `--text-secondary`
- `--text-disabled`

## Variants

### Month view — Türkçe

```tsx
<Calendar
  events={events}
  view="month"
  defaultDate={new Date(2026, 4, 13)}
  onViewChange={setView}
  locale="tr"
/>
```

### Week view — working hours shading

```tsx
<Calendar
  events={events}
  view="week"
  defaultDate={new Date(2026, 4, 13)}
  onViewChange={setView}
  locale="tr"
  workingHours={{ start: 9, end: 18, days: [1,2,3,4,5] }}
/>
```

### Day view — English

```tsx
<Calendar
  events={events}
  view="day"
  defaultDate={new Date(2026, 4, 13)}
  onViewChange={setView}
  locale="en"
  workingHours={{ start: 9, end: 18, days: [1,2,3,4,5] }}
/>
```

### Recurring — RRULE expansion

```tsx
// Lazy in-house RRULE expander — FREQ + INTERVAL + COUNT + UNTIL + BYDAY.
const events: Event[] = [
  {
    id: 'standup',
    title: 'Daily standup',
    start: new Date(2026, 4, 11, 9, 30),
    end:   new Date(2026, 4, 11, 9, 45),
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=20',
    exceptions: [new Date(2026, 4, 13)], // skip team off-site
  },
  {
    id: 'coffee',
    title: 'Coffee with Ada',
    start: new Date(2026, 4, 12, 8, 30),
    end:   new Date(2026, 4, 12, 9, 0),
    rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=5',
  },
];

<Calendar
  events={events}
  view="week"
  defaultDate={new Date(2026, 4, 13)}
  slotMinutes={15}
  workingHours={{ start: 9, end: 18, days: [1, 2, 3, 4, 5] }}
/>
```

### Interactive — drag, resize, popover

```tsx
<Calendar
  events={events}
  view="week"
  defaultDate={new Date(2026, 4, 13)}
  slotMinutes={30}
  workingHours={{ start: 9, end: 18, days: [1, 2, 3, 4, 5] }}
  onEventCreate={({ start, end }) =>
    setEvents((prev) => [...prev, { id: `n${Date.now()}`, title: 'New event', start, end }])
  }
  onEventUpdate={(updated) =>
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }
  onEventDelete={(id) =>
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }
/>
```

### Resource view — rooms with conflict highlight

```tsx
const resources = [
  { id: 'room-a', name: 'Studio A',  color: 'primary' },
  { id: 'room-b', name: 'Studio B',  color: 'success' },
  { id: 'room-c', name: 'Boardroom', color: 'warning' },
];
const events = [
  { id: 'r1', title: 'Sprint planning',
    start: new Date(2026, 4, 13,  9, 0), end: new Date(2026, 4, 13, 11, 0),
    resourceId: 'room-a' },
  { id: 'r2', title: 'Design crit',  // overlaps r1 → ring-error
    start: new Date(2026, 4, 13, 10, 30), end: new Date(2026, 4, 13, 12, 0),
    resourceId: 'room-a' },
  // …
];

<Calendar
  events={events}
  view="resource"
  defaultDate={new Date(2026, 4, 13)}
  resources={resources}
  slotMinutes={15}
  workingHours={{ start: 9, end: 18, days: [1, 2, 3, 4, 5] }}
/>
```

### Multi-calendar overlay — toggle visibility

```tsx
const calendars = [
  { id: 'work',     name: 'Work',     color: 'primary' },
  { id: 'personal', name: 'Personal', color: 'success' },
  { id: 'family',   name: 'Family',   color: 'warning' },
];
const events = [
  { id: 'm1', title: 'Design sync',     start: ..., end: ..., calendarId: 'work' },
  { id: 'm2', title: 'Yoga',            start: ..., end: ..., calendarId: 'personal' },
  { id: 'm3', title: 'Dinner — parents', start: ..., end: ..., calendarId: 'family' },
];

<Calendar
  events={events}
  view="week"
  calendars={calendars}
  onCalendarToggle={(id, visible) => console.log(id, visible)}
/>
```

### Agenda view — date-grouped + search

```tsx
<Calendar
  events={events}
  view="agenda"
  defaultDate={new Date(2026, 4, 13)}
  onViewChange={setView}
  locale="en"
/>
```

### MiniCalendar sidebar — jumps the main view to picked date

```tsx
import { Calendar, MiniCalendar } from '@/modules/app/Calendar';

const [date, setDate] = useState(new Date(2026, 4, 13));
const [view, setView] = useState<View>('week');

<div className="grid grid-cols-[15rem_1fr] gap-3">
  <MiniCalendar
    value={date}
    onChange={(d) => { setDate(d); setView('day'); }}
    locale="en"
  />
  <Calendar
    events={events}
    view={view}
    defaultDate={date}
    onViewChange={setView}
    onDateChange={setDate}
  />
</div>
```

### Month view — drag to plan ranges

```tsx
<Calendar
  events={events}
  view="month"
  defaultDate={new Date(2026, 4, 13)}
  locale="en"
  monthDrag                       // implies monthBars: continuous multi-day bars
  onEventCreate={({ start, end, allDay }) =>
    // start = first day 00:00, end = the day after the last day 00:00, allDay = true
    setEvents((prev) => [...prev, { id: crypto.randomUUID(), title: 'New campaign', start, end, allDay }])
  }
  onEventUpdate={(updated) =>
    // moved / resized by whole days; times of day kept
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }
/>
```

## Full source

```tsx
'use client';
import { Calendar } from '@/modules/app/Calendar';
import type { Event, View } from '@/modules/app/Calendar';
import { faVideo } from '@fortawesome/free-solid-svg-icons';

const events: Event[] = [
  {
    id: '1',
    title: 'Design sync',
    start: new Date(2026, 4, 13, 10, 0),
    end:   new Date(2026, 4, 13, 11, 0),
    color: 'primary',
    icon: faVideo,
  },
  {
    id: '2',
    title: 'Birthday — Grace',
    start: new Date(2026, 4, 14, 0, 0),
    end:   new Date(2026, 4, 14, 23, 59),
    allDay: true,
    color: 'warning',
  },
];

<Calendar
  events={events}
  view={view}                    // 'month' | 'week' | 'day' | 'agenda' | 'resource'
  defaultDate={new Date(2026, 4, 13)}
  onViewChange={setView}
  onEventClick={(e) => console.log(e)}
  onEventCreate={({ start, end }) => api.create({ start, end })}
  onEventUpdate={(event) => api.update(event)}
  onEventDelete={(id) => api.remove(id)}
  locale="tr"                    // 'tr' (default) | 'en'
  workingHours={{ start: 9, end: 18, days: [1,2,3,4,5] }}
  slotMinutes={30}
/>
```
