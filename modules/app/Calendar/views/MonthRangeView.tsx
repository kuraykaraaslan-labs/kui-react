'use client';
import { useId, useMemo, useRef } from 'react';
import { cn } from '@/libs/utils/cn';
import type { CalendarTelemetry, Event } from '../types';
import { MonthBar } from '../parts/MonthBar';
import { eventOnDay, isSameDay, isSameMonth, monthGrid, startOfDay } from '../date-utils';
import type { LocaleBundle } from '../locale';
import { useCalStore } from '../store';
import { lastDayOf } from '../hooks/dayRange';
import { layoutWeek } from '../hooks/monthLayout';
import { useMonthRangeDrag } from '../hooks/useMonthRangeDrag';
import { useMonthRangeKeys } from '../hooks/useMonthRangeKeys';

type MonthRangeViewProps = {
  date: Date;
  events: Event[];
  locale: LocaleBundle;
  today: Date;
  /** Range drag + keyboard on (`monthDrag`); off = bars only (`monthBars`). */
  draggable: boolean;
  onEventClick?: (e: Event, anchorRect: DOMRect) => void;
  onEventCreate?: (range: { start: Date; end: Date; allDay?: boolean }) => void | Promise<void>;
  onEventUpdate?: (event: Event) => void | Promise<void>;
  onStepDays?: (delta: number) => void;
  onTelemetry?: (e: CalendarTelemetry) => void;
  /** Lanes per week row before "+N more". */
  maxPerDay?: number;
};

/**
 * Month grid with continuous bars (`monthBars` / `monthDrag`): every event is laid out per week row in lanes (layoutWeek), a
 * multi-day event as one bar across its days and rows. With `draggable`, days and bars take pointer and keyboard range drags.
 * Same header, cell size and colours as MonthView. kui-ejs sibling: partials/_month-bars.ejs + scripts/month-range.js.
 */
export function MonthRangeView({
  date,
  events,
  locale,
  today,
  draggable,
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onStepDays,
  onTelemetry,
  maxPerDay = 3,
}: MonthRangeViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const cells = useMemo(() => monthGrid(date, locale.weekStart), [date, locale.weekStart]);
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, w) => layoutWeek(events, cells[w * 7], maxPerDay)),
    [events, cells, maxPerDay],
  );
  const headerOrder = Array.from({ length: 7 }, (_, i) => (i + locale.weekStart) % 7);
  const drag = useCalStore((s) => s.drag);
  const ghost = drag.kind === 'range' ? { from: startOfDay(drag.ghostStart).getTime(), to: lastDayOf({ start: drag.ghostStart, end: drag.ghostEnd }).getTime() } : null;
  const focusIndex = Math.max(0, cells.findIndex((c) => isSameDay(c, date)));

  const { onCellPointerDown, barPointerDown } = useMonthRangeDrag({ gridRef, cells, onEventCreate, onEventUpdate, onTelemetry });
  useMonthRangeKeys({
    gridRef,
    enabled: draggable,
    date,
    events,
    messages: locale.messages,
    monthNames: locale.monthNames,
    onStepDays,
    onEventCreate,
    onEventUpdate,
    onTelemetry,
  });

  return (
    <div className="flex flex-col w-full">
      <div className="grid grid-cols-7 border-b border-border bg-surface-raised" role="row">
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

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${locale.monthNames[date.getMonth()]} ${date.getFullYear()}`}
        className="grid grid-cols-7 grid-rows-6 flex-1"
      >
        {cells.map((cell, i) => {
          const week = weeks[Math.floor(i / 7)];
          const col = i % 7;
          const inMonth = isSameMonth(cell, date);
          const isToday = isSameDay(cell, today);
          const count = events.filter((e) => eventOnDay(e, cell)).length;
          const inGhost = !!ghost && cell.getTime() >= ghost.from && cell.getTime() <= ghost.to;
          const dateLabel = `${locale.dayLong[cell.getDay()]} ${cell.getDate()} ${locale.monthNames[cell.getMonth()]}`;
          return (
            <div
              key={i}
              role="gridcell"
              data-cal-month-day={i}
              data-cal-ghost={inGhost ? '' : undefined}
              tabIndex={draggable ? (i === focusIndex ? 0 : -1) : undefined}
              aria-selected={isToday}
              aria-label={locale.messages.cellLabel(dateLabel, count)}
              aria-describedby={draggable ? `${hintId}-cell` : undefined}
              onPointerDown={draggable ? onCellPointerDown : undefined}
              className={cn(
                'min-h-[88px] border-b border-r border-border p-1 flex flex-col gap-0.5',
                'last-of-type:border-r-0',
                (i + 1) % 7 === 0 && 'border-r-0',
                !inMonth && 'bg-surface-raised/50',
                'data-[cal-ghost]:bg-primary/10',
                draggable &&
                  'select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
              )}
            >
              <div className="flex items-center justify-between h-6">
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
                {Array.from({ length: week.lanes }, (_, lane) => {
                  const seg = week.segments.find((s) => s.lane === lane && s.startCol === col);
                  if (!seg) return <div key={`lane-${lane}`} aria-hidden="true" className="h-5" />;
                  return (
                    <MonthBar
                      key={seg.event.id}
                      segment={seg}
                      monthNames={locale.monthNames}
                      draggable={draggable}
                      dragging={drag.kind === 'range' && drag.eventId === seg.event.id}
                      hintId={`${hintId}-bar`}
                      onClick={onEventClick}
                      onPointerDown={draggable ? barPointerDown(seg.event) : undefined}
                    />
                  );
                })}
                {week.hidden[col] > 0 && (
                  <span className="px-1.5 text-[10px] text-text-secondary">{locale.messages.more(week.hidden[col])}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {draggable && (
        <>
          <span id={`${hintId}-cell`} className="sr-only">{locale.messages.cellKeysHint}</span>
          <span id={`${hintId}-bar`} className="sr-only">{locale.messages.barKeysHint}</span>
        </>
      )}
    </div>
  );
}
