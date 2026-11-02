import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecordingTimeline } from './RecordingTimeline';

const FROM = new Date('2026-11-02T00:00:00Z');
const TO = new Date('2026-11-03T00:00:00Z');
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 2, h, m));
const COVERAGE = [{ from: at(1), to: at(3) }, { from: at(5), to: at(6, 30) }];
const GAPS = [{ from: at(0), to: at(1) }, { from: at(3), to: at(5) }];

describe('RecordingTimeline', () => {
  it('draws the footage, the kept clips and the cursor, lists the ranges for a screen reader, and says when nothing was recorded', () => {
    const { container, rerender } = render(
      <RecordingTimeline from={FROM} to={TO} coverage={COVERAGE} gaps={GAPS} clips={[{ id: 'k1', from: at(2), to: at(2, 10) }]} cursor={at(12)} onPick={() => undefined} timeZone="UTC" locale="en" />,
    );
    expect(container.querySelectorAll('[data-kind="coverage"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-kind="clip"]')).toHaveLength(1);
    const cursor = container.querySelector<HTMLElement>('[data-kind="cursor"]')!;
    expect(cursor.style.left).toBe('50%');
    const first = container.querySelector<HTMLElement>('[data-kind="coverage"]')!;
    expect(parseFloat(first.style.left)).toBeCloseTo(100 / 24, 3);
    expect(parseFloat(first.style.width)).toBeCloseTo(200 / 24, 3);
    expect(screen.getAllByText(/^Recorded:/)).toHaveLength(2);
    expect(screen.getAllByText(/^Not recorded:/)).toHaveLength(2);
    rerender(<RecordingTimeline from={FROM} to={TO} coverage={[]} cursor={null} onPick={() => undefined} />);
    expect(screen.getByText('Nothing was recorded in this period.')).toBeInTheDocument();
    expect(container.querySelector('[data-kind="cursor"]')).toBeNull();
  });

  it('is a slider: the arrows move a minute (Shift ten), Home and End go to the ends, Enter plays, and nothing leaves the window', () => {
    const onPick = vi.fn();
    const onPlay = vi.fn();
    render(<RecordingTimeline from={FROM} to={TO} coverage={COVERAGE} cursor={at(12)} onPick={onPick} onPlay={onPlay} timeZone="UTC" />);
    const bar = screen.getByRole('slider', { name: 'Recordings timeline' });
    expect(bar).toHaveAttribute('aria-valuenow', String(at(12).getTime()));
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onPick).toHaveBeenLastCalledWith(at(12, 1));
    fireEvent.keyDown(bar, { key: 'ArrowLeft', shiftKey: true });
    expect(onPick).toHaveBeenLastCalledWith(at(11, 50));
    fireEvent.keyDown(bar, { key: 'Home' });
    expect(onPick).toHaveBeenLastCalledWith(FROM);
    fireEvent.keyDown(bar, { key: 'End' });
    expect(onPick).toHaveBeenLastCalledWith(new Date(TO.getTime() - 1));
    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('a click picks the moment under the pointer, an event marker is a labelled button that moves the cursor to the event', () => {
    const onPick = vi.fn();
    render(<RecordingTimeline from={FROM} to={TO} coverage={COVERAGE} markers={[{ id: 'e1', at: at(5, 30), kind: 'motion' }]} cursor={null} onPick={onPick} markerLabel={(k) => (k === 'motion' ? 'Motion' : 'Event')} timeZone="UTC" locale="en-GB" />);
    const bar = screen.getByRole('slider');
    bar.getBoundingClientRect = () => ({ left: 0, width: 240, top: 0, height: 48, right: 240, bottom: 48, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(bar, { clientX: 60 });
    expect(onPick).toHaveBeenLastCalledWith(at(6));
    const marker = screen.getByRole('button', { name: /^Motion at / });
    fireEvent.click(marker);
    expect(onPick).toHaveBeenLastCalledWith(at(5, 30));
  });

  it('takes the host\'s words', () => {
    render(<RecordingTimeline from={FROM} to={TO} coverage={[]} cursor={null} onPick={() => undefined} messages={{ recording: { bar: 'Kayıt zaman çizelgesi', noFootage: 'Bu aralıkta kayıt yok.' } }} />);
    expect(screen.getByRole('slider', { name: 'Kayıt zaman çizelgesi' })).toBeInTheDocument();
    expect(screen.getByText('Bu aralıkta kayıt yok.')).toBeInTheDocument();
  });
});
