import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SlotData, WidgetKindView } from '../kind';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { DATA_TABLE_VIEW } from '../views/DataTableView';
import { SCADA_SCENE_VIEW } from '../views/ScadaSceneView';
import { PlacementCard } from '../PlacementCard';
import { ZoomPane } from '../ZoomPane';
import { clampZoom, scrollForZoom, stepZoom, wheelZoom, zoomKey, ZOOM_MAX, ZOOM_MIN } from '../zoom-logic';

describe('zoom logic', () => {
  it('keeps the zoom between fit and the most', () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_MIN);
  });
  it('steps a quarter in and back to exactly fit', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(stepZoom(1, 1), -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
  });
  it('zooms a step per mouse notch and smoothly on a pinch', () => {
    expect(wheelZoom(1, -100)).toBe(1.25);
    expect(wheelZoom(2, 100)).toBe(1.6);
    expect(wheelZoom(1, -3, 1)).toBe(1.25);
    expect(wheelZoom(1, 100)).toBe(1);
    const pinched = wheelZoom(2, -10);
    expect(pinched).toBeGreaterThan(2);
    expect(pinched).toBeLessThan(2.5);
  });
  it('keeps the point under the pointer where it is', () => {
    // At 1x the point 100 px into the pane is picture pixel 100; at 2x that pixel sits at 200, so the scroll is 100.
    expect(scrollForZoom({ left: 0, top: 0 }, { x: 100, y: 50 }, 1, 2)).toEqual({ left: 100, top: 50 });
    expect(scrollForZoom({ left: 100, top: 50 }, { x: 100, y: 50 }, 2, 1)).toEqual({ left: 0, top: 0 });
  });
  it('reads + = - _ 0 with or without Ctrl, and nothing with Alt', () => {
    expect(['+', '=', '-', '_', '0', 'a'].map((key) => zoomKey({ key }))).toEqual(['in', 'in', 'out', 'out', 'fit', null]);
    expect(zoomKey({ key: '+', altKey: true })).toBeNull();
  });
});

describe('ZoomPane', () => {
  const pane = () => screen.getByRole('group', { name: /^Zoom \d+%$/ });
  it('opens fitted, zooms with the buttons and the keys, and fits again', () => {
    render(<ZoomPane><svg data-testid="picture" /></ZoomPane>);
    expect(pane()).toHaveAttribute('data-zoom', '1');
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit to view' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(pane()).toHaveAttribute('data-zoom', '1.25');
    expect(screen.getByText('125%')).toBeInTheDocument();
    expect((screen.getByTestId('picture').parentElement as HTMLElement).style.width).toBe('125%');
    fireEvent.keyDown(pane(), { key: '+' });
    expect(pane()).toHaveAttribute('data-zoom', String(1.25 * 1.25));
    fireEvent.keyDown(pane(), { key: '0' });
    expect(pane()).toHaveAttribute('data-zoom', '1');
  });
  it('zooms on Ctrl + wheel and leaves the plain wheel to scroll', () => {
    render(<ZoomPane><svg /></ZoomPane>);
    const plain = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    pane().dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(pane()).toHaveAttribute('data-zoom', '1');
    const ctrl = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    fireEvent(pane(), ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(Number(pane().getAttribute('data-zoom'))).toBeGreaterThan(1);
  });
  it('moves a zoomed picture by dragging, and the click that ends the drag reaches nothing', () => {
    const onClick = vi.fn();
    render(<ZoomPane><button type="button" onClick={onClick}>pump</button></ZoomPane>);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const el = pane();
    el.scrollLeft = 50;
    el.scrollTop = 40;
    fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'mouse', clientX: 80, clientY: 90 });
    fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'mouse', clientX: 80, clientY: 90 });
    expect([el.scrollLeft, el.scrollTop]).toEqual([70, 50]);
    fireEvent.click(screen.getByRole('button', { name: 'pump' }));
    expect(onClick).not.toHaveBeenCalled();
    // A press that does not move is a click.
    fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'mouse', clientX: 101, clientY: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'pump' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('PlacementCard full screen zoom', () => {
  const table = { shape: 'table', columns: [{ key: 'name', label: 'Name', type: 'text' }], rows: [{ name: 'a' }], fetchedAt: '2026-10-16T10:00:00.000Z' } as SlotData;
  const open = (view: WidgetKindView) => {
    render(<PlacementCard title="Plant" template={DATA_TABLE} slots={DATA_TABLE_KIND.slots} view={view} settings={{}} data={{ rows: table }} now={Date.parse('2026-10-16T10:00:00.000Z')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
  };
  it('gives a diagram the zoom pane', () => {
    expect(SCADA_SCENE_VIEW.zoomable).toBe(true);
    open({ ...DATA_TABLE_VIEW, zoomable: true });
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeInTheDocument();
  });
  it('shows anything else larger, without zoom', () => {
    open(DATA_TABLE_VIEW);
    expect(screen.queryByRole('toolbar', { name: 'Zoom' })).toBeNull();
  });
});
