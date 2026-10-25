import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeepInViewport } from './useKeepInViewport';

function Panel({ open, rect }: { open: boolean; rect: { left: number; width: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  useKeepInViewport(ref, open);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => ({ left: rect.left, right: rect.left + rect.width, width: rect.width, top: 0, bottom: 10, height: 10, x: rect.left, y: 0, toJSON: () => ({}) });
      }}
      data-testid="panel"
    />
  );
}

describe('useKeepInViewport', () => {
  afterEach(() => vi.unstubAllGlobals());

  function screenOf(width: number, offsetLeft = 0) {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { width, offsetLeft, height: 800, offsetTop: 0 }));
  }

  it('shifts a panel that runs off the right edge back in, and caps its width', () => {
    screenOf(400);
    const { getByTestId } = render(<Panel open rect={{ left: 300, width: 200 }} />);
    expect(getByTestId('panel').style.translate).toBe('-108px 0');
    expect(getByTestId('panel').style.maxWidth).toBe('384px');
  });

  it('shifts a panel that runs off the left edge back in', () => {
    screenOf(400);
    const { getByTestId } = render(<Panel open rect={{ left: -150, width: 180 }} />);
    expect(getByTestId('panel').style.translate).toBe('158px 0');
  });

  it('follows a pinch-zoomed screen, and leaves a panel that fits alone', () => {
    screenOf(300, 500);
    const { getByTestId, rerender } = render(<Panel open rect={{ left: 450, width: 100 }} />);
    expect(getByTestId('panel').style.translate).toBe('58px 0');
    rerender(<Panel open={false} rect={{ left: 450, width: 100 }} />);
    expect(getByTestId('panel').style.translate).toBe('');
    screenOf(400);
    const fits = render(<Panel open rect={{ left: 20, width: 100 }} />);
    expect(fits.getAllByTestId('panel')[1].style.translate).toBe('');
  });
});
