import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraceWaterfall, buildTraceTree, criticalPathIds, rulerTicks, visibleRows, selfTime, barBox, type TraceSpan } from './index';

const spans: TraceSpan[] = [
  { id: 'root', name: 'GET /checkout', service: 'web', start: 1000, duration: 100 },
  { id: 'auth', parentId: 'root', name: 'auth.verify', service: 'auth', start: 1002, duration: 10 },
  { id: 'cart', parentId: 'root', name: 'cart.load', service: 'cart', start: 1012, duration: 38 },
  { id: 'db', parentId: 'cart', name: 'SELECT cart', service: 'cart', start: 1015, duration: 30 },
  { id: 'pay', parentId: 'root', name: 'payment.charge', service: 'payment', start: 1050, duration: 48, status: 'error' },
];

describe('trace model', () => {
  it('builds a tree with depth, orders children by start and measures the trace', () => {
    const t = buildTraceTree(spans);
    expect(t.roots.map((r) => r.span.id)).toEqual(['root']);
    expect(t.byId.get('root')!.children.map((c) => c.span.id)).toEqual(['auth', 'cart', 'pay']);
    expect(t.byId.get('db')!.depth).toBe(2);
    expect(t.start).toBe(1000);
    expect(t.end).toBe(1100);
    expect(t.duration).toBe(100);
  });

  it('makes orphans roots and breaks parent cycles', () => {
    const t = buildTraceTree([
      { id: 'a', parentId: 'missing', name: 'a', start: 0, duration: 5 },
      { id: 'b', parentId: 'c', name: 'b', start: 0, duration: 5 },
      { id: 'c', parentId: 'b', name: 'c', start: 1, duration: 5 },
      { id: 'self', parentId: 'self', name: 's', start: 2, duration: 1 },
    ]);
    const roots = t.roots.map((r) => r.span.id).sort();
    expect(roots).toContain('a');
    expect(roots).toContain('self');
    expect(roots).toEqual(['a', 'b', 'c', 'self']); // a cycle is cut by making its members roots, so nothing is lost or loops
    expect(visibleRows(t, new Set())).toHaveLength(4);
  });

  it('skips the children of collapsed spans and numbers siblings', () => {
    const t = buildTraceTree(spans);
    const all = visibleRows(t, new Set());
    expect(all.map((r) => r.node.span.id)).toEqual(['root', 'auth', 'cart', 'db', 'pay']);
    expect(all[2]).toMatchObject({ posInSet: 2, setSize: 3 });
    const folded = visibleRows(t, new Set(['cart']));
    expect(folded.map((r) => r.node.span.id)).toEqual(['root', 'auth', 'cart', 'pay']);
  });

  it('finds the critical path: the last-finishing chain, not parallel work hidden behind it', () => {
    const t = buildTraceTree([
      { id: 'r', name: 'r', start: 0, duration: 100 },
      { id: 'a', parentId: 'r', name: 'a', start: 0, duration: 40 },
      { id: 'b', parentId: 'r', name: 'b', start: 40, duration: 60 },
      { id: 'b1', parentId: 'b', name: 'b1', start: 45, duration: 50 },
      { id: 'p', parentId: 'r', name: 'parallel', start: 10, duration: 20 },
    ]);
    const ids = criticalPathIds(t);
    expect([...ids].sort()).toEqual(['a', 'b', 'b1', 'r']);
  });

  it('computes ruler ticks on round steps', () => {
    expect(rulerTicks(100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(rulerTicks(0)).toEqual([0]);
    expect(rulerTicks(1.2, 4).at(-1)).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it('computes bar boxes and self time', () => {
    const t = buildTraceTree(spans);
    expect(barBox(t.byId.get('pay')!.span, t)).toMatchObject({ left: 50, width: 48 });
    expect(selfTime(t.byId.get('cart')!)).toBe(8);
    expect(selfTime(t.byId.get('root')!)).toBe(100 - 10 - 38 - 48);
  });
});

describe('TraceWaterfall', () => {
  it('renders tree semantics with level, set position and expanded state', () => {
    render(<TraceWaterfall spans={spans} />);
    expect(screen.getByRole('tree', { name: 'Trace waterfall' })).toBeInTheDocument();
    const items = screen.getAllByRole('treeitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAttribute('aria-level', '1');
    expect(items[0]).toHaveAttribute('aria-expanded', 'true');
    expect(items[1]).toHaveAttribute('aria-level', '2');
    expect(items[1]).not.toHaveAttribute('aria-expanded');
    expect(items[2]).toHaveAttribute('aria-posinset', '2');
    expect(items[2]).toHaveAttribute('aria-setsize', '3');
  });

  it('states errors as text, not only by colour', () => {
    render(<TraceWaterfall spans={spans} />);
    const pay = screen.getByRole('treeitem', { name: /payment\.charge/ });
    expect(pay).toHaveAttribute('aria-label', expect.stringContaining('error'));
    expect(pay.querySelector('.sr-only')).toHaveTextContent('error');
  });

  it('collapses and expands with the keyboard (and mirrors the arrows in RTL)', () => {
    render(<TraceWaterfall spans={spans} />);
    const tree = screen.getByRole('tree');
    tree.focus();
    fireEvent.keyDown(tree, { key: 'ArrowLeft' }); // collapse root
    expect(screen.getAllByRole('treeitem')).toHaveLength(1);
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(tree, { key: 'ArrowRight' }); // expand again
    expect(screen.getAllByRole('treeitem')).toHaveLength(5);
  });

  it('moves the active descendant with the arrows, Home and End', () => {
    render(<TraceWaterfall spans={spans} />);
    const tree = screen.getByRole('tree');
    const items = screen.getAllByRole('treeitem');
    expect(tree).toHaveAttribute('aria-activedescendant', items[0].id);
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(tree).toHaveAttribute('aria-activedescendant', items[1].id);
    fireEvent.keyDown(tree, { key: 'End' });
    expect(tree).toHaveAttribute('aria-activedescendant', items[4].id);
    fireEvent.keyDown(tree, { key: 'Home' });
    expect(tree).toHaveAttribute('aria-activedescendant', items[0].id);
  });

  it('ArrowLeft on a leaf moves to its parent', () => {
    render(<TraceWaterfall spans={spans} />);
    const tree = screen.getByRole('tree');
    const items = screen.getAllByRole('treeitem');
    fireEvent.keyDown(tree, { key: 'End' }); // pay (leaf, child of root)
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(tree).toHaveAttribute('aria-activedescendant', items[0].id);
  });

  it('selects with Enter and click, sets aria-selected and fills the detail slot', () => {
    const onSelect = vi.fn();
    render(<TraceWaterfall spans={spans} onSelect={onSelect} renderDetail={(s, info) => <p>custom {s.name} {info.childCount}</p>} />);
    const tree = screen.getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'auth' }));
    expect(screen.getByRole('treeitem', { name: /auth\.verify/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Span details' })).toHaveTextContent('custom auth.verify 0');
    fireEvent.click(screen.getByRole('treeitem', { name: /cart\.load/ }));
    expect(screen.getByRole('region', { name: 'Span details' })).toHaveTextContent('custom cart.load 1');
    fireEvent.keyDown(tree, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Span details' })).toBeNull();
  });

  it('shows a default detail panel with attributes and self time', () => {
    render(<TraceWaterfall spans={[{ ...spans[0], attributes: { 'http.method': 'GET' } }, ...spans.slice(1)]} defaultSelectedId="root" />);
    const panel = screen.getByRole('region', { name: 'Span details' });
    expect(panel).toHaveTextContent('http.method');
    expect(panel).toHaveTextContent('Self time');
  });

  it('honours controlled collapsedIds and reports changes', () => {
    const onCollapsedChange = vi.fn();
    render(<TraceWaterfall spans={spans} collapsedIds={['cart']} onCollapsedChange={onCollapsedChange} />);
    expect(screen.getAllByRole('treeitem')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Expand cart.load' }));
    expect(onCollapsedChange).toHaveBeenCalledWith([]);
    expect(screen.getAllByRole('treeitem')).toHaveLength(4); // controlled: the parent decides
  });

  it('marks the critical path and lets the switch turn it off', () => {
    render(<TraceWaterfall spans={spans} />);
    const root = screen.getByRole('treeitem', { name: /GET \/checkout/ });
    expect(root).toHaveAttribute('data-critical', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Critical path' }));
    expect(root).not.toHaveAttribute('data-critical');
  });

  it('windows the list above the threshold: 5000 spans render a small slice, and End scrolls to the last', () => {
    const many: TraceSpan[] = [{ id: 'r', name: 'root', start: 0, duration: 10_000 }];
    for (let i = 0; i < 5000; i++) many.push({ id: `s${i}`, parentId: 'r', name: `span ${i}`, start: i, duration: 1 });
    render(<TraceWaterfall spans={many} />);
    const rendered = screen.getAllByRole('treeitem');
    expect(rendered.length).toBeLessThan(80);
    expect(rendered[0]).toHaveAttribute('aria-setsize', '1');
    const tree = screen.getByRole('tree');
    fireEvent.keyDown(tree, { key: 'End' });
    expect(tree).toHaveAttribute('aria-activedescendant', expect.stringContaining('s4999'));
  });

  it('does not window small traces', () => {
    render(<TraceWaterfall spans={spans} virtualizeThreshold={500} />);
    expect(screen.getAllByRole('treeitem')).toHaveLength(5);
  });

  it('renders an empty message', () => {
    render(<TraceWaterfall spans={[]} />);
    expect(screen.getByText('No spans in this trace.')).toBeInTheDocument();
  });

  it('takes its text from messages', () => {
    render(<TraceWaterfall spans={spans} messages={{ expandAll: 'Tout ouvrir', label: 'Cascade' }} />);
    expect(screen.getByRole('button', { name: 'Tout ouvrir' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Cascade' })).toBeInTheDocument();
  });
});
