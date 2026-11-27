import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Calendar } from '../index';
import type { Event } from '../types';

// en locale → weeks start on Sunday; the May 2026 grid starts on Sunday 26 April, so cell i is 26 April + i (13 May = 17).
const ANCHOR = new Date(2026, 4, 13);
const d = (day: number, h = 0) => new Date(2026, 4, day, h);
const EVENTS: Event[] = [
  { id: 'sale', title: 'Spring sale', start: d(12, 10), end: d(14, 18), color: 'warning' },
  { id: 'meet', title: 'Standup', start: d(13, 9), end: d(13, 10) },
];

// jsdom has no layout: give every month cell a 100 × 100 box on a 7-column grid.
let rectSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect;
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const idx = (this as HTMLElement).dataset?.calMonthDay;
    if (idx === undefined) return original.call(this);
    const i = Number(idx);
    const left = (i % 7) * 100, top = Math.floor(i / 7) * 100;
    return { left, top, right: left + 100, bottom: top + 100, width: 100, height: 100, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => rectSpy.mockRestore());

const cellAt = (i: number) => document.querySelector<HTMLElement>(`[data-cal-month-day="${i}"]`)!;
const point = (i: number) => ({ clientX: (i % 7) * 100 + 50, clientY: Math.floor(i / 7) * 100 + 50 });
function pointer(type: string, target: EventTarget, i: number) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...point(i) });
  act(() => {
    target.dispatchEvent(ev);
  });
}

function setup(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
  const onEventCreate = vi.fn();
  const onEventUpdate = vi.fn();
  const utils = render(
    <Calendar events={EVENTS} view="month" defaultDate={ANCHOR} locale="en" onEventCreate={onEventCreate} onEventUpdate={onEventUpdate} {...props} />,
  );
  return { ...utils, onEventCreate, onEventUpdate };
}

describe('Calendar month view range drag', () => {
  it('leaves the default month view unchanged (no bars, no drag hooks)', () => {
    setup();
    expect(document.querySelector('[data-cal-month-day]')).toBeNull();
    // The 3-day event is one card per day there.
    expect(document.querySelectorAll('[data-event-id="sale"]')).toHaveLength(3);
  });

  it('draws a multi-day event as one continuous bar with monthBars', () => {
    setup({ monthBars: true });
    const bars = document.querySelectorAll<HTMLElement>('[data-event-id="sale"]');
    expect(bars).toHaveLength(1);
    expect(bars[0].className).toContain('w-[calc(300%+18px)]');
    expect(bars[0]).toHaveAccessibleName('Spring sale, 12 May – 14 May, 10:00 – 18:00');
    expect(bars[0].hasAttribute('data-cal-range-bar')).toBe(false);
    expect(cellAt(16).contains(bars[0])).toBe(true);
  });

  it('creates an all-day range by dragging across days and week rows', () => {
    const { onEventCreate } = setup({ monthDrag: true });
    pointer('pointerdown', cellAt(18), 18);
    pointer('pointermove', window, 24);
    expect(cellAt(20).hasAttribute('data-cal-ghost')).toBe(true);
    expect(cellAt(25).hasAttribute('data-cal-ghost')).toBe(false);
    pointer('pointerup', window, 24);
    expect(onEventCreate).toHaveBeenCalledWith({ start: d(14), end: d(21), allDay: true });
    expect(document.querySelector('[data-cal-ghost]')).toBeNull();
  });

  it('moves a bar by whole days, keeping its times', () => {
    const { onEventUpdate } = setup({ monthDrag: true });
    const bar = document.querySelector<HTMLElement>('[data-event-id="sale"]')!;
    pointer('pointerdown', bar, 17);
    pointer('pointermove', window, 19);
    pointer('pointerup', window, 19);
    expect(onEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'sale', start: d(14, 10), end: d(16, 18) }));
  });

  it('resizes the end edge, never before the start', () => {
    const { onEventUpdate } = setup({ monthDrag: true });
    const handle = document.querySelector<HTMLElement>('[data-event-id="sale"] [data-cal-range-handle="end"]')!;
    pointer('pointerdown', handle, 18);
    pointer('pointermove', window, 10);
    pointer('pointerup', window, 10);
    expect(onEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ start: d(12, 10), end: d(12, 18) }));
  });

  it('selects days with Shift + arrows and creates with Enter', () => {
    const { onEventCreate } = setup({ monthDrag: true });
    const focused = () => document.querySelector<HTMLElement>('[data-cal-month-day][tabindex="0"]')!;
    expect(focused()).toBe(cellAt(17));
    fireEvent.keyDown(focused(), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(focused(), { key: 'ArrowDown', shiftKey: true });
    expect(focused()).toBe(cellAt(25));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('13 May – 21 May selected');
    fireEvent.keyDown(focused(), { key: 'Enter' });
    expect(onEventCreate).toHaveBeenCalledWith({ start: d(13), end: d(22), allDay: true });
  });

  it('moves and resizes a focused bar from the keyboard and announces it', () => {
    const { onEventUpdate } = setup({ monthDrag: true });
    const bar = document.querySelector<HTMLElement>('[data-event-id="sale"]')!;
    fireEvent.keyDown(bar, { key: 'ArrowRight', altKey: true });
    expect(onEventUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ start: d(13, 10), end: d(15, 18) }));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Spring sale now runs 13 May – 15 May');
    fireEvent.keyDown(bar, { key: 'ArrowLeft', shiftKey: true });
    expect(onEventUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ start: d(12, 10), end: d(13, 18) }));
    fireEvent.keyDown(bar, { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(onEventUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ start: d(11, 10), end: d(14, 18) }));
  });
});
