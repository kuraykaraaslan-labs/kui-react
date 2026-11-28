import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardSafePanel } from './useKeyboardSafePanel';

/** A visual viewport the test moves, as the on-screen keyboard does. */
function fakeViewport(height: number, offsetTop: number) {
  const vv = Object.assign(new EventTarget(), { height, offsetTop });
  vi.stubGlobal('visualViewport', vv);
  return {
    keyboard(h: number, top: number) {
      vv.height = h;
      vv.offsetTop = top;
      vv.dispatchEvent(new Event('resize'));
    },
  };
}

function fakeMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches, media: '(max-width: 639px)' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
});

describe('useKeyboardSafePanel', () => {
  it('keeps the open panel on the visible part of a phone screen when the keyboard opens', () => {
    fakeMedia(true);
    const vv = fakeViewport(860, 0);
    const panel = document.createElement('div');
    const { unmount } = renderHook(() => useKeyboardSafePanel({ current: panel }, true));
    expect(panel.style.top).toBe('0px');
    expect(panel.style.height).toBe('860px');
    expect(document.body.style.overflow).toBe('hidden');

    vv.keyboard(520, 300);
    expect(panel.style.top).toBe('300px');
    expect(panel.style.height).toBe('520px');

    unmount();
    expect(panel.style.top).toBe('');
    expect(panel.style.height).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('leaves the panel and the page alone on wide screens and while closed', () => {
    fakeMedia(false);
    fakeViewport(860, 0);
    const panel = document.createElement('div');
    renderHook(() => useKeyboardSafePanel({ current: panel }, true));
    expect(panel.style.top).toBe('');
    expect(document.body.style.overflow).toBe('');

    fakeMedia(true);
    renderHook(() => useKeyboardSafePanel({ current: panel }, false));
    expect(panel.style.top).toBe('');
  });
});
