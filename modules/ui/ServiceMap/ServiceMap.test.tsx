import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceMap, fitView, healthOf, type ServiceNode, type ServiceEdge } from './index';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 420, x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 420, toJSON() {} });
  // jsdom has no requestAnimationFrame focus timing issues, but CSS.escape is missing in some builds.
  if (typeof CSS === 'undefined' || !CSS.escape) vi.stubGlobal('CSS', { escape: (s: string) => s });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const nodes: ServiceNode[] = [
  { id: 'web', name: 'web', kind: 'service', rate: 1200, errorRate: 0.002, latencyMs: 80 },
  { id: 'api', name: 'api', kind: 'service', rate: 1100, errorRate: 0.031, latencyMs: 240 },
  { id: 'pay', name: 'payments', kind: 'service', rate: 90, errorRate: 0.12, latencyMs: 900 },
  { id: 'db', name: 'orders-db', kind: 'database', rate: 2000, latencyMs: 4 },
];
const edges: ServiceEdge[] = [
  { from: 'web', to: 'api', rate: 1100, errorRate: 0.01, latencyMs: 120 },
  { from: 'api', to: 'pay', rate: 90, errorRate: 0.12, latencyMs: 700 },
  { from: 'api', to: 'db', rate: 2000, latencyMs: 4 },
];

const node = (name: RegExp) => screen.getByRole('button', { name });
const transformOf = () => document.querySelector('svg > g')!.getAttribute('transform')!;

describe('ServiceMap model helpers', () => {
  it('derives health from the error rate unless given', () => {
    const t = { warn: 0.01, error: 0.05 };
    expect(healthOf({ errorRate: 0.001 }, t)).toBe('ok');
    expect(healthOf({ errorRate: 0.02 }, t)).toBe('warn');
    expect(healthOf({ errorRate: 0.2 }, t)).toBe('error');
    expect(healthOf({}, t)).toBe('unknown');
    expect(healthOf({ errorRate: 0.2, status: 'ok' }, t)).toBe('ok');
  });
  it('fits a drawing into the viewport, centred', () => {
    const v = fitView(1000, 400, 500, 400);
    expect(v.k).toBeLessThan(1);
    expect(v.x).toBeGreaterThan(0);
    expect(fitView(0, 0, 100, 100)).toEqual({ x: 0, y: 0, k: 1 });
  });
});

describe('ServiceMap', () => {
  it('renders a node per service with an accessible description including health and calls', () => {
    render(<ServiceMap nodes={nodes} edges={edges} />);
    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('data-node-id'))).toHaveLength(4);
    const api = node(/^api, degraded/);
    expect(api.getAttribute('aria-label')).toContain('3.1% errors');
    expect(api.getAttribute('aria-label')).toContain('calls payments, orders-db');
  });

  it('never relies on colour alone for errors: text status, percentage and a dashed edge', () => {
    const { container } = render(<ServiceMap nodes={nodes} edges={edges} />);
    expect(node(/payments, failing/)).toHaveAttribute('data-health', 'error');
    expect(container.querySelector('[data-node-id="pay"]')!.textContent).toContain('12%');
    expect(container.querySelector('[data-node-id="pay"]')!.textContent).toContain('failing');
    const dashed = [...container.querySelectorAll('path')].filter((p) => p.getAttribute('stroke-dasharray') === '6 4');
    expect(dashed).toHaveLength(1);
    expect(screen.getAllByRole('img').some((i) => i.textContent?.includes('! 90/s · 12% · 700 ms'))).toBe(true);
  });

  it('shows rate, error and latency badges on edges', () => {
    const { container } = render(<ServiceMap nodes={nodes} edges={edges} />);
    expect(container.textContent).toContain('1.1k/s · 1% · 120 ms');
  });

  it('selects on click and Enter, exposes aria-pressed and fills the selection slot', () => {
    const onSelect = vi.fn();
    render(<ServiceMap nodes={nodes} edges={edges} onSelect={onSelect} renderSelection={(n, { incoming, outgoing }) => <p>{n.name}: in {incoming.length}, out {outgoing.length}</p>} />);
    fireEvent.click(node(/^api,/));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'api' }));
    expect(node(/^api,/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Selected service' })).toHaveTextContent('api: in 1, out 2');
    const svg = document.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('region', { name: 'Selected service' })).toBeNull();
  });

  it('shows a default selection panel listing callers and callees', () => {
    render(<ServiceMap nodes={nodes} edges={edges} defaultSelectedId="api" />);
    const panel = screen.getByRole('region', { name: 'Selected service' });
    expect(panel).toHaveTextContent('web');
    expect(panel).toHaveTextContent('payments, orders-db');
  });

  it('uses roving focus: only the active node is tabbable', () => {
    render(<ServiceMap nodes={nodes} edges={edges} />);
    const nodesEls = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-node-id'));
    expect(nodesEls.filter((n) => n.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('moves along calls with the arrow keys and enters on Enter', () => {
    const onSelect = vi.fn();
    render(<ServiceMap nodes={nodes} edges={edges} onSelect={onSelect} />);
    const svg = document.querySelector('svg')!;
    // The first node in layout order is the entry service.
    fireEvent.keyDown(svg, { key: 'ArrowRight' }); // web -> api
    expect(node(/^api,/)).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(svg, { key: 'ArrowLeft' }); // api -> web
    expect(node(/^web,/)).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(svg, { key: 'ArrowRight' }); // web -> api
    fireEvent.keyDown(svg, { key: 'ArrowRight' }); // api -> one of its callees
    const callee = ['payments', 'orders-db'].find((n) => node(new RegExp(`^${n},`)).getAttribute('tabindex') === '0')!;
    expect(callee).toBeDefined();
    const other = callee === 'payments' ? 'orders-db' : 'payments';
    fireEvent.keyDown(svg, { key: callee === 'payments' ? 'ArrowDown' : 'ArrowUp' }); // its sibling in the same layer
    expect(node(new RegExp(`^${other},`))).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('mirrors the arrow keys for a right-to-left map', () => {
    render(<ServiceMap nodes={nodes} edges={edges} direction="rtl" />);
    const svg = document.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'ArrowLeft' }); // along the flow, which now points left
    expect(node(/^api,/)).toHaveAttribute('tabindex', '0');
  });

  it('zooms with the buttons and keys and fits again', () => {
    render(<ServiceMap nodes={nodes} edges={edges} />);
    const fitted = transformOf();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const zoomed = transformOf();
    expect(zoomed).not.toBe(fitted);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.keyDown(document.querySelector('svg')!, { key: '+' });
    expect(transformOf()).not.toBe(fitted);
    fireEvent.keyDown(document.querySelector('svg')!, { key: '0' });
    expect(transformOf()).toBe(fitted);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    expect(transformOf()).toBe(fitted);
  });

  it('pans by dragging the background and with Shift + arrows', () => {
    render(<ServiceMap nodes={nodes} edges={edges} />);
    const svg = document.querySelector('svg')!;
    const before = transformOf();
    svg.setPointerCapture = vi.fn();
    svg.hasPointerCapture = vi.fn().mockReturnValue(true);
    svg.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(svg, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 70, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 70, clientY: 40, pointerId: 1 });
    const dragged = transformOf();
    expect(dragged).not.toBe(before);
    fireEvent.keyDown(svg, { key: 'ArrowLeft', shiftKey: true });
    expect(transformOf()).not.toBe(dragged);
  });

  it('Ctrl + wheel zooms and a plain wheel does not', () => {
    render(<ServiceMap nodes={nodes} edges={edges} />);
    const svg = document.querySelector('svg')!;
    const before = transformOf();
    fireEvent.wheel(svg, { deltaY: -100 });
    expect(transformOf()).toBe(before);
    fireEvent.wheel(svg, { deltaY: -100, ctrlKey: true });
    expect(transformOf()).not.toBe(before);
  });

  it('is controllable and takes its text from messages', () => {
    render(<ServiceMap nodes={nodes} edges={edges} selectedId="db" messages={{ label: 'Carte', zoomIn: 'Agrandir' }} />);
    expect(screen.getByRole('group', { name: 'Carte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agrandir' })).toBeInTheDocument();
    expect(node(/^orders-db,/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders an empty message', () => {
    render(<ServiceMap nodes={[]} edges={[]} />);
    expect(screen.getByText('No services to show.')).toBeInTheDocument();
  });
});
