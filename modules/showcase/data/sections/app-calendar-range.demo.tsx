'use client';
import { useState } from 'react';
import { Calendar } from '@/modules/app/Calendar';
import type { Event, View } from '@/modules/app/Calendar';

/** The Calendar showcase's "Month view — drag to plan ranges" demo (monthDrag), kept apart from the 600-line section file. */
const DEMO_ANCHOR = new Date(2026, 4, 13);

function makeRangeEvents(): Event[] {
  const y = 2026, m = 4;
  return [
    { id: 'p1', title: 'Spring sale', start: new Date(y, m, 4), end: new Date(y, m, 11), allDay: true, color: 'warning' },
    { id: 'p2', title: 'Launch week', start: new Date(y, m, 13, 9, 0), end: new Date(y, m, 19, 18, 0), color: 'primary' },
    { id: 'p3', title: 'Newsletter', start: new Date(y, m, 14), end: new Date(y, m, 15), allDay: true, color: 'info' },
    { id: 'p4', title: 'Summer preview', start: new Date(y, m, 25), end: new Date(y, m, 30), allDay: true, color: 'success' },
    { id: 'p5', title: 'Design sync', start: new Date(y, m, 21, 10, 0), end: new Date(y, m, 21, 11, 0), color: 'secondary' },
  ];
}

export function CalendarMonthRangeDemo() {
  const [view, setView] = useState<View>('month');
  const [events, setEvents] = useState<Event[]>(() => makeRangeEvents());
  const [log, setLog] = useState<string[]>([]);
  const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const append = (msg: string) => setLog((prev) => [msg, ...prev].slice(0, 6));

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3 items-start">
      <Calendar
        events={events}
        view={view}
        defaultDate={DEMO_ANCHOR}
        onViewChange={setView}
        locale="en"
        monthDrag
        onEventCreate={({ start, end, allDay }) => {
          setEvents((prev) => [...prev, { id: `n${Date.now()}`, title: 'New campaign', start, end, allDay, color: 'info' }]);
          append(`create  ${day(start)} – ${day(end)} (end exclusive)`);
        }}
        onEventUpdate={(updated) => {
          setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          append(`update  ${updated.title}  ${day(updated.start)} – ${day(updated.end)}`);
        }}
        onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
      />
      <aside className="rounded-md border border-border bg-surface-raised p-3 text-xs flex flex-col gap-1.5">
        <h4 className="font-semibold text-text-primary">Event log</h4>
        <p className="text-text-secondary">
          Drag across empty days to create, drag a bar to move it, drag its edge to resize. Keyboard: Shift + arrows and
          Enter on a day; Alt + arrows, Shift + Left / Right and Alt + Shift + Left / Right on a bar.
        </p>
        <div className="border-t border-border my-1" />
        {log.length === 0 ? (
          <span className="text-text-disabled italic">no events yet…</span>
        ) : (
          log.map((line, i) => (
            <code key={i} className="text-[11px] font-mono text-text-secondary truncate">
              {line}
            </code>
          ))
        )}
      </aside>
    </div>
  );
}
