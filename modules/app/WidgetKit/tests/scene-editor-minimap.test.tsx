import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SceneMinimap, MINIMAP_SIZE } from '../views/SceneMinimap';
import { smallScene } from './scene-edit-fixture';
import { sceneModel } from '../views/scada-scene-logic';

afterEach(cleanup);

const settings = { ...smallScene(), shapes: [{ kind: 'zone', x: 10, y: 10, w: 200, h: 100, text: 'Zone' }, { kind: 'text', x: 50, y: 30, text: 'Title' }, null] };
const base = { x: 0, y: 0, w: 800, h: 500 };
const view = { x: 100, y: 50, w: 400, h: 250 };

function mount() {
  const onCenter = vi.fn();
  render(<SceneMinimap settings={settings as never} geo={sceneModel(settings as never, {})} base={base} view={view} onCenter={onCenter} label="Overview" />);
  return { onCenter, svg: screen.getByTestId('scene-minimap') };
}
describe('SceneMinimap', () => {
  it('draws the canvas, the symbols, the shapes and the rectangle the editor shows', () => {
    const { svg } = mount();
    expect(svg).toHaveAttribute('aria-label', 'Overview');
    expect(svg).toHaveAttribute('width', String(MINIMAP_SIZE.w));
    expect(screen.getByTestId('minimap-view')).toHaveAttribute('width', String(view.w));
    expect(svg.querySelectorAll('rect').length).toBeGreaterThanOrEqual(4);
  });
  it('a press moves the view to that point, and a drag keeps moving it until release', () => {
    const { svg, onCenter } = mount();
    fireEvent.pointerDown(svg, { clientX: 80, clientY: 50, pointerId: 1 });
    expect(onCenter).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 60, pointerId: 1 });
    expect(onCenter).toHaveBeenCalledTimes(2);
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(onCenter).toHaveBeenCalledTimes(2);
    const first = onCenter.mock.calls[0][0] as { x: number; y: number };
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(800);
  });
  it('a cancelled pointer also ends the drag', () => {
    const { svg, onCenter } = mount();
    fireEvent.pointerDown(svg, { clientX: 80, clientY: 50, pointerId: 1 });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 90, clientY: 60, pointerId: 1 });
    expect(onCenter).toHaveBeenCalledTimes(1);
  });
  it('the arrow keys move the view by a tenth of its size; other keys do nothing', () => {
    const { svg, onCenter } = mount();
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(onCenter).toHaveBeenLastCalledWith({ x: 300 + 40, y: 175 });
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(onCenter).toHaveBeenLastCalledWith({ x: 300 - 40, y: 175 });
    fireEvent.keyDown(svg, { key: 'ArrowUp' });
    expect(onCenter).toHaveBeenLastCalledWith({ x: 300, y: 175 - 40 });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    expect(onCenter).toHaveBeenLastCalledWith({ x: 300, y: 175 + 40 });
    onCenter.mockClear();
    fireEvent.keyDown(svg, { key: 'a' });
    expect(onCenter).not.toHaveBeenCalled();
  });
});
