import { describe, it, expect } from 'vitest';
import { CLOCK_SKEW_SEC, relativeTime } from './table-logic';

/**
 * The relative "Updated" cell: a reading stamped by a server whose clock runs a few seconds ahead of the browser's must read as now,
 * never as "in 7 seconds"; a genuinely future instant (a due date days ahead) still reads as the future.
 */
describe('relativeTime', () => {
  const now = Date.UTC(2026, 9, 29, 12, 0, 0);
  it('a past instant reads as the past', () => {
    expect(relativeTime(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago');
    expect(relativeTime(now - 7_000, now, 'en')).toBe('7 seconds ago');
  });
  it('an instant a few seconds ahead of the viewer\'s clock reads as now, not as the future', () => {
    expect(relativeTime(now + 7_000, now, 'en')).toBe('now');
    expect(relativeTime(now + CLOCK_SKEW_SEC * 1000, now, 'en')).toBe('now');
  });
  it('an instant further ahead than the skew window is still the future', () => {
    expect(relativeTime(now + (CLOCK_SKEW_SEC + 1) * 1000, now, 'en')).toBe('in 2 minutes');
    expect(relativeTime(now + 3 * 86_400_000, now, 'en')).toBe('in 3 days');
  });
});
