'use client';
import { cn } from '@/libs/utils/cn';
import type { CalendarTelemetry, Event } from '../types';
import { EventCard } from '../parts/EventCard';
import { eventOnDay, isSameDay, isSameMonth, monthGrid } from '../date-utils';
import type { LocaleBundle } from '../locale';
import { MonthRangeView } from './MonthRangeView';

type MonthViewProps = {
  date: Date;
  events: Event[];
  locale: LocaleBundle;
  today: Date;
  onEventClick?: (e: Event, anchorRect: DOMRect) => void;
  /** Maximum event rows per cell before showing "+N more". */
  maxPerDay?: number;
  /** Continuous multi-day bars (MonthRangeView). */
  bars?: boolean;
  /** Day-range drag + keyboard (MonthRangeView); implies `bars`. */
  rangeDrag?: boolean;
  onEventCreate?: (range: { start: Date; end: Date; allDay?: boolean }) => void | Promise<void>;
  onEventUpdate?: (event: Event) => void | Promise<void>;
  onStepDays?: (delta: number) => void;
  onTelemetry?: (e: CalendarTelemetry) => void;
};

const HEADER_ORDER = (weekStart: 0 | 1) =>
  Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

export function MonthView({
  date,
  events,
  locale,
  today,
  onEventClick,
  maxPerDay = 3,
  bars = false,
  rangeDrag = false,
  onEventCreate,
  onEventUpdate,
  onStepDays,
  onTelemetry,
}: MonthViewProps) {
  if (bars || rangeDrag) {
    return (
      <MonthRangeView
        date={date}
        events={events}
        locale={locale}
        today={today}
        draggable={rangeDrag}
        onEventClick={onEventClick}
        onEventCreate={onEventCreate}
        onEventUpdate={onEventUpdate}
        onStepDays={onStepDays}
        onTelemetry={onTelemetry}
        maxPerDay={maxPerDay}
      />
    );
  }
  const cells = monthGrid(date, locale.weekStart);
  const headerOrder = HEADER_ORDER(locale.weekStart);

  return (
    <div className="flex flex-col w-full">
      {/* Weekday header row */}
      <div
        className="grid grid-cols-7 border-b border-border bg-surface-raised"
        role="row"
      >
        {headerOrder.map((dayIdx) => (
          <div
            key={dayIdx}
            role="columnheader"
            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-center"
          >
            {locale.dayShort[dayIdx]}
          </div>
        ))}
      </div>

      {/* 6 × 7 grid */}
      <div
        role="grid"
        aria-label={`${locale.monthNames[date.getMonth()]} ${date.getFullYear()}`}
        className="grid grid-cols-7 grid-rows-6 flex-1"
      >
        {cells.map((cell, i) => {
          const inMonth = isSameMonth(cell, date);
          const isToday = isSameDay(cell, today);
          const dayEvents = events.filter((e) => eventOnDay(e, cell));
          const visible = dayEvents.slice(0, maxPerDay);
          const overflow = dayEvents.length - visible.length;
          const dateLabel = `${locale.dayLong[cell.getDay()]} ${cell.getDate()} ${locale.monthNames[cell.getMonth()]}`;
          return (
            <div
              key={i}
              role="gridcell"
              aria-selected={isToday}
              aria-label={locale.messages.cellLabel(dateLabel, dayEvents.length)}
              className={cn(
                'min-h-[88px] border-b border-r border-border p-1 flex flex-col gap-0.5',
                'last-of-type:border-r-0',
                (i + 1) % 7 === 0 && 'border-r-0',
                !inMonth && 'bg-surface-raised/50',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    !inMonth && 'text-text-disabled',
                    inMonth && !isToday && 'text-text-primary',
                    isToday &&
                      'inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-fg',
                  )}
                >
                  {cell.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 min-h-0">
                {visible.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    variant={e.allDay ? 'bar' : 'pill'}
                    onClick={onEventClick}
                  />
                ))}
                {overflow > 0 && (
                  <span className="px-1.5 text-[10px] text-text-secondary">
                    {locale.messages.more(overflow)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
