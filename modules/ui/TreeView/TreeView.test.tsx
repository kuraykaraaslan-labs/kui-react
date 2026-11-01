import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TreeView, applyTreeMove, type TreeMoveTarget, type TreeNode } from './index';
import { autoScrollStep } from './hooks/treeMove';

// Visible order with everything open:
// 0 src, 1 components, 2 Button, 3 index, 4 docs, 5 guide, 6 readme
const NODES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'components', label: 'components', children: [{ id: 'Button', label: 'Button.tsx' }] },
      { id: 'index', label: 'index.ts' },
    ],
  },
  { id: 'docs', label: 'docs', children: [{ id: 'guide', label: 'guide.md' }] },
  { id: 'readme', label: 'README.md' },
];

const ROW_H = 32;

/** Rows are 30 px tall with a 2 px gap; the list is 300 px wide. */
function mockLayout() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const list = this.closest('[role="tree"]');
    if (this.matches('[data-tree-row]') && list) {
      const i = Array.from(list.querySelectorAll('[data-tree-row]')).indexOf(this);
      return DOMRect.fromRect({ x: 0, y: i * ROW_H, width: 300, height: 30 });
    }
    if (this.matches('[role="tree"]')) {
      const n = this.querySelectorAll('[data-tree-row]').length;
      return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: n * ROW_H });
    }
    return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
  });
}

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-tree-node-id="${id}"] > [data-tree-row]`)!;
const ids = () => Array.from(document.querySelectorAll('[data-tree-node-id]')).map((el) => el.getAttribute('data-tree-node-id'));
const status = () => document.querySelector('[data-tree-live]')!.textContent!.replace(/​/g, '');

/** Press on a row, move to (x, y) — which starts the drag — and return a release function. */
function dragTo(id: string, x: number, y: number, opts: { pointerType?: string; from?: HTMLElement } = {}) {
  const pointerType = opts.pointerType ?? 'mouse';
  const el = opts.from ?? rowOf(id);
  const start = Array.from(document.querySelectorAll('[data-tree-row]')).indexOf(rowOf(id)) * ROW_H + 15;
  fireEvent.pointerDown(el, { pointerId: 1, pointerType, button: 0, clientX: 40, clientY: start });
  fireEvent.pointerMove(document, { pointerId: 1, pointerType, clientX: x, clientY: y });
  return () => fireEvent.pointerUp(document, { pointerId: 1, pointerType, clientX: x, clientY: y });
}

function Controlled(props: { initial?: TreeNode[]; onMove?: (ids: string[], t: TreeMoveTarget) => void; canDrop?: (ids: string[], t: TreeMoveTarget) => boolean }) {
  const [nodes, setNodes] = useState(props.initial ?? NODES);
  return (
    <TreeView
      label="Files"
      nodes={nodes}
      canDrop={props.canDrop}
      onMove={(moved, target) => {
        props.onMove?.(moved, target);
        setNodes((n) => applyTreeMove(n, moved, target));
      }}
    />
  );
}

describe('applyTreeMove', () => {
  it('moves within a parent, across parents and to the root, with final-position indexes', () => {
    const within = applyTreeMove(NODES, ['index'], { parentId: 'src', index: 0 });
    expect(within[0].children!.map((n) => n.id)).toEqual(['index', 'components']);
    const across = applyTreeMove(NODES, ['readme'], { parentId: 'docs', index: 1 });
    expect(across.map((n) => n.id)).toEqual(['src', 'docs']);
    expect(across[1].children!.map((n) => n.id)).toEqual(['guide', 'readme']);
    const root = applyTreeMove(NODES, ['src'], { parentId: null, index: 2 });
    expect(root.map((n) => n.id)).toEqual(['docs', 'readme', 'src']);
  });

  it('keeps several nodes in tree order and drops descendants of a moved node', () => {
    const out = applyTreeMove(NODES, ['readme', 'Button', 'components'], { parentId: 'docs', index: 0 });
    expect(out[1].children!.map((n) => n.id)).toEqual(['components', 'readme', 'guide']);
    expect(out[1].children![0].children!.map((n) => n.id)).toEqual(['Button']);
  });

  it('never moves a node into its own subtree and never mutates the input', () => {
    const copy = JSON.stringify(NODES);
    expect(applyTreeMove(NODES, ['src'], { parentId: 'components', index: 0 })).toBe(NODES);
    applyTreeMove(NODES, ['index'], { parentId: null, index: 0 });
    expect(JSON.stringify(NODES)).toBe(copy);
  });
});

describe('TreeView move — pointer', () => {
  let layout: ReturnType<typeof mockLayout>;
  beforeEach(() => { layout = mockLayout(); });
  afterEach(() => { layout.mockRestore(); vi.useRealTimers(); });

  it('drops before a sibling (move within a parent) with a line indicator', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    const release = dragTo('index', 40, 1 * ROW_H + 3);
    const line = document.querySelector('[data-tree-node-id="components"] > [data-tree-drop-indicator="before"]') as HTMLElement;
    expect(line).not.toBeNull();
    expect(line.style.left).toBe('1.25rem');
    expect(rowOf('index').className).toContain('opacity-50');
    expect(document.querySelector('[data-tree-drag-preview]')).toHaveTextContent('index.ts');
    release();
    expect(onMove).toHaveBeenCalledWith(['index'], { parentId: 'src', index: 0 });
    expect(document.querySelector('[data-tree-drop-indicator]')).toBeNull();
    expect(document.querySelector('[data-tree-drag-preview]')).toBeNull();
    expect(status()).toBe('index.ts moved to position 1 of 2 in src');
  });

  it('drops inside another parent (move across parents) with a tinted row', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    const release = dragTo('readme', 40, 4 * ROW_H + 15);
    expect(document.querySelector('[data-tree-node-id="docs"] > [data-tree-drop-indicator="inside"]')).not.toBeNull();
    expect(rowOf('docs').className).toContain('bg-primary-subtle');
    release();
    expect(onMove).toHaveBeenCalledWith(['readme'], { parentId: 'docs', index: 1 });
  });

  it('after the last child of a group, moving the pointer left climbs out of the group', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    const release = dragTo('index', 5, 5 * ROW_H + 27);
    const line = document.querySelector('[data-tree-node-id="guide"] > [data-tree-drop-indicator="after"]') as HTMLElement;
    expect(line.style.left).toBe('0rem');
    release();
    expect(onMove).toHaveBeenCalledWith(['index'], { parentId: null, index: 2 });
  });

  it('canDrop refuses a target: no indicator, no move, inside falls back to before/after first', () => {
    const onMove = vi.fn();
    const canDrop = vi.fn((_ids: string[], t: TreeMoveTarget) => t.parentId !== 'docs');
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} canDrop={canDrop} />);
    const release = dragTo('readme', 40, 4 * ROW_H + 15);
    expect(canDrop).toHaveBeenCalledWith(['readme'], { parentId: 'docs', index: 1 });
    expect(document.querySelector('[data-tree-drop-indicator]')).toBeNull();
    release();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('a drop where the node already is, or into its own subtree, is no target', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    const release = dragTo('src', 40, 1 * ROW_H + 15);
    expect(document.querySelector('[data-tree-drop-indicator]')).toBeNull();
    release();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('drags every selected node in multi-select mode', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} selectionMode="multi" selectedIds={['guide', 'Button']} onMove={onMove} />);
    const release = dragTo('Button', 40, 6 * ROW_H + 3);
    expect(document.querySelector('[data-tree-drag-preview]')).toHaveTextContent('2 items');
    release();
    expect(onMove).toHaveBeenCalledWith(['Button', 'guide'], { parentId: null, index: 2 });
    expect(status()).toBe('2 items moved to position 3 of 5');
  });

  it('the click that ends a drag does not select; Escape cancels a drag', () => {
    const onMove = vi.fn();
    const onSelect = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} onSelect={onSelect} />);
    const release = dragTo('readme', 40, 4 * ROW_H + 15);
    release();
    fireEvent.click(rowOf('readme'));
    expect(onSelect).not.toHaveBeenCalled();

    const release2 = dragTo('readme', 40, 1 * ROW_H + 3);
    expect(document.querySelector('[data-tree-drop-indicator]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('[data-tree-drop-indicator]')).toBeNull();
    release2();
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('touch: a long press starts the drag; moving first is a scroll', () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    // Moving before the long press: no drag.
    fireEvent.pointerDown(rowOf('readme'), { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 6 * ROW_H + 15 });
    fireEvent.pointerMove(document, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 6 * ROW_H - 10 });
    act(() => { vi.advanceTimersByTime(500); });
    expect(document.querySelector('[data-tree-drag-preview]')).toBeNull();
    fireEvent.pointerUp(document, { pointerId: 1, pointerType: 'touch' });

    fireEvent.pointerDown(rowOf('readme'), { pointerId: 2, pointerType: 'touch', clientX: 40, clientY: 6 * ROW_H + 15 });
    act(() => { vi.advanceTimersByTime(450); });
    expect(document.querySelector('[data-tree-drag-preview]')).not.toBeNull();
    fireEvent.pointerMove(document, { pointerId: 2, pointerType: 'touch', clientX: 40, clientY: 4 * ROW_H + 15 });
    fireEvent.pointerUp(document, { pointerId: 2, pointerType: 'touch', clientX: 40, clientY: 4 * ROW_H + 15 });
    expect(onMove).toHaveBeenCalledWith(['readme'], { parentId: 'docs', index: 1 });
  });

  it('dragHandle: only the grip starts a drag', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} dragHandle />);
    dragTo('readme', 40, 1 * ROW_H + 3)();
    expect(onMove).not.toHaveBeenCalled();
    const grip = document.querySelector<HTMLElement>('[data-tree-node-id="readme"] [data-tree-drag-handle]')!;
    dragTo('readme', 40, 1 * ROW_H + 3, { from: grip })();
    expect(onMove).toHaveBeenCalledWith(['readme'], { parentId: 'src', index: 0 });
  });

  it('a parent hovered "inside" for a moment opens', () => {
    vi.useFakeTimers();
    const onExpand = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={vi.fn()} defaultExpandedIds={['src']} onExpand={onExpand} />);
    // Visible: 0 src, 1 components (closed), 2 index, 3 docs (closed), 4 readme
    dragTo('readme', 40, 3 * ROW_H + 15);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onExpand).toHaveBeenCalledWith('docs', true);
    expect(screen.getByText('guide.md')).toBeInTheDocument();
  });

  it('scrolls faster the closer the pointer is to an edge', () => {
    expect(autoScrollStep(200, 0, 400)).toBe(0);
    expect(autoScrollStep(5, 0, 400)).toBeLessThan(0);
    expect(autoScrollStep(395, 0, 400)).toBeGreaterThan(autoScrollStep(370, 0, 400));
    expect(autoScrollStep(-50, 0, 400)).toBe(-16);
  });
});

describe('TreeView move — keyboard', () => {
  const focusRow = (id: string) => { fireEvent.click(rowOf(id)); rowOf(id).focus(); };
  const key = (k: string) => fireEvent.keyDown(screen.getByRole('tree'), { key: k, altKey: true });

  it('Alt+ArrowUp / Alt+ArrowDown move the focused node among its siblings and announce it', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    focusRow('index');
    key('ArrowUp');
    expect(onMove).toHaveBeenLastCalledWith(['index'], { parentId: 'src', index: 0 });
    expect(screen.getByRole('status')).toHaveTextContent('index.ts moved to position 1 of 2 in src');
    focusRow('src');
    key('ArrowDown');
    expect(onMove).toHaveBeenLastCalledWith(['src'], { parentId: null, index: 1 });
    expect(status()).toBe('src moved to position 2 of 3');
  });

  it('Alt+ArrowLeft moves out after the parent; Alt+ArrowRight into the previous sibling as its last child', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} />);
    focusRow('index');
    key('ArrowLeft');
    expect(onMove).toHaveBeenLastCalledWith(['index'], { parentId: null, index: 1 });
    key('ArrowRight');
    expect(onMove).toHaveBeenLastCalledWith(['index'], { parentId: 'components', index: 1 });
    expect(status()).toBe('index.ts moved to position 2 of 2 in components');
  });

  it('does nothing at a boundary; canDrop refusal is announced and nothing moves', () => {
    const onMove = vi.fn();
    render(<TreeView label="Files" nodes={NODES} onMove={onMove} canDrop={(_ids, t) => t.parentId !== null} />);
    focusRow('components');
    key('ArrowUp');
    expect(onMove).not.toHaveBeenCalled();
    focusRow('index');
    key('ArrowLeft');
    expect(onMove).not.toHaveBeenCalled();
    expect(status()).toBe('index.ts cannot move there');
  });

  it('a controlled tree re-orders and keeps the focus on the moved row', () => {
    render(<Controlled />);
    focusRow('index');
    key('ArrowUp');
    expect(ids()).toEqual(['src', 'index', 'components', 'Button', 'docs', 'guide', 'readme']);
    expect(document.activeElement).toBe(rowOf('index'));
    key('ArrowLeft');
    expect(ids()).toEqual(['src', 'components', 'Button', 'index', 'docs', 'guide', 'readme']);
    expect(document.activeElement).toBe(rowOf('index'));
    // Into a leaf: the leaf becomes a parent and opens, so the node stays in sight. (The click also closes docs.)
    focusRow('docs');
    key('ArrowRight');
    expect(ids()).toEqual(['src', 'components', 'Button', 'index', 'docs', 'readme']);
    expect(document.querySelector('[data-tree-node-id="index"]')).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-tree-node-id="docs"]')).toHaveAttribute('aria-level', '2');
    expect(document.activeElement).toBe(rowOf('docs'));
  });

  it('without onMove, Alt+Arrow keeps its old meaning and there is no live region', () => {
    render(<TreeView label="Files" nodes={NODES} />);
    focusRow('src'); // the click also closes src
    key('ArrowDown');
    expect(rowOf('docs')).toHaveAttribute('tabindex', '0');
    expect(document.querySelector('[data-tree-live]')).toBeNull();
    expect(document.querySelector('[data-tree-node-id="src"]')).not.toHaveClass('relative');
  });
});

describe('TreeView renderLabel', () => {
  it('renders custom row content after the chevron; type-ahead still matches the label', () => {
    render(
      <TreeView
        label="Files"
        nodes={NODES}
        renderLabel={(n) => (
          <span className="flex justify-between">
            <span>{n.label}</span>
            {n.children ? <em>{n.children.length} items</em> : null}
          </span>
        )}
      />,
    );
    expect(document.querySelector('[data-tree-node-id="docs"] em')).toHaveTextContent('1 items');
    expect(document.querySelector('[data-tree-node-id="docs"] [data-tree-label]')).not.toBeNull();
    rowOf('src').focus();
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'r' });
    expect(rowOf('readme')).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(rowOf('readme'));
  });
});
