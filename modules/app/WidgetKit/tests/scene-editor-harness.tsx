'use client';
// Helpers shared by the scene editor view tests (not a test file): a fixed layout for jsdom (which has no layout), the
// editor mounted with a small diagram, and pointer helpers that speak in scene units.
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { SceneEditor } from '../views/SceneEditor';
import type { SceneEditorProps } from '../views/scene-editor-types';
import { sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import { sceneToLocal } from '../views/scene-editor-state';
import { smallScene } from './scene-edit-fixture';

export const RECT = { left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, x: 0, y: 0, toJSON: () => ({}) };

/** Gives every element the same 800 x 500 box, so the measured size and the pointer rectangle agree. */
export function mockLayout() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT as DOMRect);
}

export interface Mounted {
  svg: SVGSVGElement;
  canvas: HTMLElement;
  onApply: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  onApplied: ReturnType<typeof vi.fn>;
  rerender: () => void;
  /** The settings after the edits so far: presses Apply and reads what the host received. */
  applied: () => Promise<SceneSettings>;
  /** The live region's text. */
  said: () => string;
}

export function mount(over: Partial<SceneEditorProps> = {}, settings: SceneSettings = smallScene()): Mounted {
  const onApply = vi.fn(async () => undefined);
  const onClose = vi.fn();
  const onApplied = vi.fn();
  const props: SceneEditorProps = { settings, data: {}, onApply, onClose, host: { onApplied }, ...over };
  const view = render(<SceneEditor {...props} />);
  const svg = screen.getByTestId('scene-svg') as unknown as SVGSVGElement;
  return {
    svg, canvas: screen.getByTestId('scene-canvas'), onApply, onClose, onApplied,
    rerender: () => view.rerender(<SceneEditor {...props} />),
    applied: async () => {
      const apply = screen.getByTestId('editor-apply');
      await act(async () => { fireEvent.click(apply); });
      const calls = (props.onApply as unknown as ReturnType<typeof vi.fn>).mock.calls;
      return calls[calls.length - 1][0] as SceneSettings;
    },
    said: () => screen.getByTestId('scene-live').textContent ?? '',
  };
}

/** The view box the canvas shows now. */
export function viewBox(svg: SVGSVGElement) {
  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
  return { x, y, w, h };
}

/** Where a scene point is on screen, for the pointer events. */
export function at(svg: SVGSVGElement, p: { x: number; y: number }) {
  const l = sceneToLocal(p, RECT, viewBox(svg));
  return { clientX: l.x, clientY: l.y };
}

export const down = (svg: SVGSVGElement, p: { x: number; y: number }, init: PointerEventInit = {}) => fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(svg, p), ...init });
export const move = (svg: SVGSVGElement, p: { x: number; y: number }, init: PointerEventInit = {}) => fireEvent.pointerMove(svg, { pointerId: 1, ...at(svg, p), ...init });
export const up = (svg: SVGSVGElement, p: { x: number; y: number }, init: PointerEventInit = {}) => fireEvent.pointerUp(svg, { pointerId: 1, button: 0, ...at(svg, p), ...init });

/** Press at `from`, move through `via` and release at `to`. */
export function drag(svg: SVGSVGElement, from: { x: number; y: number }, to: { x: number; y: number }, via: Array<{ x: number; y: number }> = [], init: PointerEventInit = {}) {
  down(svg, from, init);
  for (const p of [...via, to]) move(svg, p, init);
  up(svg, to, init);
}

export const click = (svg: SVGSVGElement, p: { x: number; y: number }, init: PointerEventInit = {}) => { down(svg, p, init); up(svg, p, init); };

/** The drawn boxes of the small diagram's symbols, by id. */
export function boxes(settings: SceneSettings = smallScene()) {
  const out: Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }> = {};
  for (const h of sceneModel(settings, {}).hits) out[h.id] = { x: h.x, y: h.y, w: h.w, h: h.h, cx: h.x + h.w / 2, cy: h.y + h.h / 2 };
  return out;
}

export const key = (el: Element, k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(el, { key: k, ...init });

export const selected = (container: HTMLElement) => [...container.querySelectorAll('[data-selected]')].map((e) => e.getAttribute('data-selected'));
export const links = (s: SceneSettings) => (s.links ?? []) as Array<Record<string, unknown>>;
export const elements = (s: SceneSettings) => (s.elements ?? []) as Array<Record<string, unknown>>;
export const shapes = (s: SceneSettings) => (s.shapes ?? []) as Array<Record<string, unknown>>;
export const element = (s: SceneSettings, id: string) => elements(s).find((e) => e.id === id);

export { act, fireEvent, render, screen, waitFor, within };

/** A palette drop or drag-over: jsdom has no DragEvent, so the pointer position is put on the event by hand. */
export function dragEvent(type: 'drop' | 'dragOver', target: Element, svg: SVGSVGElement, p: { x: number; y: number }, symbol: string) {
  const dataTransfer = { types: ['text/x-scada-symbol'], getData: (t: string) => (t === 'text/x-scada-symbol' ? symbol : ''), dropEffect: 'none' };
  const ev = createEvent[type](target, { dataTransfer });
  const c = at(svg, p);
  Object.defineProperty(ev, 'clientX', { value: c.clientX });
  Object.defineProperty(ev, 'clientY', { value: c.clientY });
  fireEvent(target, ev);
  return ev;
}
