'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@/libs/utils/cn';
import type { Event } from '../types';
import { effectiveColor, EVENT_COLOR_CLASSES } from '../colors';
import { useCalStore } from '../store';
import { fmtTime } from '../date-utils';
import { dayRangeText } from '../hooks/dayRange';
import { BAR_WIDTH_CLASSES, barRadiusClass, type MonthSegment } from '../hooks/monthLayout';

type MonthBarProps = {
  segment: MonthSegment<Event>;
  monthNames: string[];
  /** Range drag on: grab cursor, edge handles, keyboard hint. */
  draggable: boolean;
  /** This event is the one being dragged (dims the source bar). */
  dragging: boolean;
  hintId?: string;
  onClick?: (e: Event, anchorRect: DOMRect) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
};

/** "Spring sale, 14 May – 20 May" (+ ", 10:00 – 18:00" for a timed event). Mirrored by kui-ejs month-range.js `barLabel`. */
export function monthBarLabel(event: Event, monthNames: string[]): string {
  const days = dayRangeText(event, monthNames);
  return event.allDay ? `${event.title}, ${days}` : `${event.title}, ${days}, ${fmtTime(event.start)} – ${fmtTime(event.end)}`;
}

/**
 * One week-row segment of an event in the month view's bar layout. Sits in its first day's cell and overflows to the right
 * over `span` days (BAR_WIDTH_CLASSES); `relative z-10` paints it above the following cells.
 */
export function MonthBar({ segment, monthNames, draggable, dragging, hintId, onClick, onPointerDown }: MonthBarProps) {
  const calendars = useCalStore((s) => s.calendars);
  const { event, span, continuesBefore, continuesAfter, isRange } = segment;
  const styles = EVENT_COLOR_CLASSES[effectiveColor(event, calendars)];
  const showTime = !event.allDay && !continuesBefore;

  return (
    <button
      type="button"
      data-event-id={event.id}
      data-cal-range-bar={draggable ? '' : undefined}
      data-cal-dragging={dragging ? '' : undefined}
      aria-label={monthBarLabel(event, monthNames)}
      aria-describedby={draggable ? hintId : undefined}
      onClick={(e) => onClick?.(event, (e.currentTarget as HTMLElement).getBoundingClientRect())}
      onPointerDown={onPointerDown}
      className={cn(
        'relative z-10 flex items-center gap-1.5 h-5 px-2 text-left text-[11px] leading-tight font-medium truncate',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'transition-colors motion-reduce:transition-none data-[cal-dragging]:opacity-60',
        BAR_WIDTH_CLASSES[span - 1],
        barRadiusClass(continuesBefore, continuesAfter),
        isRange ? styles.bar : styles.pill,
        draggable && 'cursor-grab',
      )}
    >
      {event.icon && <FontAwesomeIcon icon={event.icon} className="w-3 h-3 shrink-0" aria-hidden="true" />}
      {showTime && <span className="opacity-90 tabular-nums shrink-0">{fmtTime(event.start)}</span>}
      <span className="truncate">{event.title}</span>
      {draggable && !continuesBefore && (
        <span
          data-cal-range-handle="start"
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-text-primary/10"
        />
      )}
      {draggable && !continuesAfter && (
        <span
          data-cal-range-handle="end"
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-text-primary/10"
        />
      )}
    </button>
  );
}
