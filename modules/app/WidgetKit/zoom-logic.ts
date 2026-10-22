// The zoom of a full-screen picture (a process diagram): the steps, the limits and the scroll that keeps the point under
// the pointer where it is. Pure, so every kit zooms the same way.

/** 1 is the whole picture in the pane (fit); the view never zooms out past it. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
/** One button press or key: a quarter more, or a fifth less. */
export const ZOOM_STEP = 1.25;

export interface Pt { x: number; y: number }
export interface Scroll { left: number; top: number }

export const clampZoom = (z: number): number => (Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : ZOOM_MIN);

/** One step in or out. A step that lands within a hair of fit is fit, so stepping back always reaches 100 %. */
export function stepZoom(z: number, dir: 1 | -1): number {
  const next = clampZoom(dir > 0 ? z * ZOOM_STEP : z / ZOOM_STEP);
  return Math.abs(next - ZOOM_MIN) < 0.01 ? ZOOM_MIN : next;
}

/**
 * The zoom a Ctrl + wheel event asks for. A mouse notch (about 100 px, or a line or page in the other delta modes) is one
 * step, like the buttons; a trackpad pinch, which browsers send as Ctrl + wheel too, is many small deltas and zooms smoothly.
 */
export function wheelZoom(z: number, deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;
  if (Math.abs(px) >= 50) return stepZoom(z, px < 0 ? 1 : -1);
  return clampZoom(z * Math.exp(-px * 0.01));
}

/**
 * The scroll that keeps `at` (pixels from the pane's top-left corner) over the same spot of the picture when the zoom
 * goes from `from` to `to`. The picture is `zoom` times the pane in both directions, so a spot moves with the ratio.
 */
export function scrollForZoom(scroll: Scroll, at: Pt, from: number, to: number): Scroll {
  const f = to / from;
  return { left: Math.max(0, (scroll.left + at.x) * f - at.x), top: Math.max(0, (scroll.top + at.y) * f - at.y) };
}

/** What a key does in the pane: + and = zoom in, - zooms out, 0 fits (with or without Ctrl or Cmd, as in an editor). */
export function zoomKey(e: { key: string; altKey?: boolean }): 'in' | 'out' | 'fit' | null {
  if (e.altKey) return null;
  if (e.key === '+' || e.key === '=') return 'in';
  if (e.key === '-' || e.key === '_') return 'out';
  if (e.key === '0') return 'fit';
  return null;
}

/** The percent the zoom shows as ("150"). */
export const zoomPercent = (z: number): number => Math.round(z * 100);
