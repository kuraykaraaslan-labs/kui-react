import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { ScadaSceneView, DOUBLE_CLICK_MS } from '../views/ScadaSceneView';
import { sceneModel } from '../views/scada-scene-logic';
import type { ElementActions, ElementGesture } from '../kind';

afterEach(() => { vi.useRealTimers(); });

const settings = {
  width: 400, height: 200, scale: 0.7, fit: 'canvas' as const,
  elements: [
    { id: 'tank', symbol: 'tank.vertical', x: 80, y: 100, label: 'Storage tank' },
    { id: 'pump', symbol: 'pump.volute', x: 220, y: 100 },
    { id: 'valve', symbol: 'valve.ball', x: 320, y: 100 },
  ],
  links: [{ from: 'tank.r', to: 'pump.l', kind: 'pipe' }],
};
const data = { points: { shape: 'table' as const, rows: [{ id: 'valve', label: 'Inlet valve' }] } };

/** Which gestures each symbol answers, and a log of what ran. */
function host(map: Record<string, ElementGesture[]>) {
  const runs: string[] = [];
  const actions: ElementActions = {
    has: (g, id) => (map[id] ?? []).includes(g),
    run: (g, id) => { runs.push(`${g}:${id}`); },
  };
  return { actions, runs };
}
const view = (elementActions?: ElementActions) => render(<ScadaSceneView settings={settings} format={{}} data={data} title="Plant" elementActions={elementActions} />);
const hit = (container: HTMLElement, id: string) => container.querySelector(`[data-element="${id}"]`) as SVGRectElement;

describe('the scene model\'s hit areas', () => {
  it('gives every placed symbol its box and its name (the row label, else the symbol label, else the id)', () => {
    const g = sceneModel(settings, data)
    expect(g.hits.map((h) => [h.id, h.name])).toEqual([['tank', 'Storage tank'], ['pump', 'pump'], ['valve', 'Inlet valve']]);
    for (const h of g.hits) expect(h.w).toBeGreaterThan(0);
  });
});

describe('symbols with actions', () => {
  it('draws no hit area without a host, and none for a symbol that answers nothing', () => {
    expect(view().container.querySelectorAll('[data-element]')).toHaveLength(0);
    const { actions } = host({ pump: ['click'] });
    const { container } = view(actions);
    expect([...container.querySelectorAll('[data-element]')].map((e) => e.getAttribute('data-element'))).toEqual(['pump']);
    expect(hit(container, 'pump')).toHaveAttribute('role', 'button');
    expect(hit(container, 'pump')).toHaveAttribute('aria-label', 'pump');
    expect(hit(container, 'pump')).toHaveAttribute('tabindex', '0');
  });

  it('runs the click at once when the symbol has no double click', () => {
    const { actions, runs } = host({ pump: ['click'] });
    const { container } = view(actions);
    fireEvent.click(hit(container, 'pump'));
    expect(runs).toEqual(['click:pump']);
  });

  it('waits for a second click when the symbol also has a double click, and runs only the double click then', () => {
    vi.useFakeTimers();
    const { actions, runs } = host({ valve: ['click', 'doubleClick'] });
    const { container } = view(actions);
    fireEvent.click(hit(container, 'valve'));
    expect(runs).toEqual([]);
    act(() => { vi.advanceTimersByTime(DOUBLE_CLICK_MS + 1); });
    expect(runs).toEqual(['click:valve']);
    runs.length = 0;
    fireEvent.click(hit(container, 'valve'));
    fireEvent.doubleClick(hit(container, 'valve'));
    act(() => { vi.advanceTimersByTime(DOUBLE_CLICK_MS * 2); });
    expect(runs).toEqual(['doubleClick:valve']);
  });

  it('a right click runs the context action and keeps the browser menu away; without one the menu is left alone', () => {
    const { actions, runs } = host({ pump: ['contextMenu'], tank: ['click'] });
    const { container } = view(actions);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => { hit(container, 'pump').dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(runs).toEqual(['contextMenu:pump']);
    const other = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => { hit(container, 'tank').dispatchEvent(other); });
    expect(other.defaultPrevented).toBe(false);
    expect(runs).toEqual(['contextMenu:pump']);
  });

  it('answers the keyboard: Enter and Space click, the context-menu key and Shift+F10 open the context action', () => {
    const { actions, runs } = host({ pump: ['click', 'contextMenu'] });
    const { container } = view(actions);
    const el = hit(container, 'pump');
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    fireEvent.keyDown(el, { key: 'ContextMenu' });
    fireEvent.keyDown(el, { key: 'F10', shiftKey: true });
    fireEvent.keyDown(el, { key: 'a' });
    expect(runs).toEqual(['click:pump', 'click:pump', 'contextMenu:pump', 'contextMenu:pump']);
  });

  it('does not run a click for a symbol that only has a right-click action', () => {
    const { actions, runs } = host({ pump: ['contextMenu'] });
    const { container } = view(actions);
    fireEvent.click(hit(container, 'pump'));
    fireEvent.keyDown(hit(container, 'pump'), { key: 'Enter' });
    expect(runs).toEqual([]);
  });
});
