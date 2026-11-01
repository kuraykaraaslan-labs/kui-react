import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SceneEditorToolbar, type SceneEditorToolbarProps } from '../views/SceneEditorToolbar';
import { SCENE_EDITOR_MESSAGES as m } from '../views/scene-editor-messages-canvas';

afterEach(cleanup);

function props(over: Partial<SceneEditorToolbarProps> = {}): SceneEditorToolbarProps {
  const fn = () => vi.fn();
  return {
    m, tool: 'select', onTool: fn(), canUndo: true, canRedo: true, onUndo: fn(), onRedo: fn(),
    zoomPercent: 100, onZoomIn: fn(), onZoomOut: fn(), onFit: fn(), grid: true, guides: true, onGrid: fn(), onGuides: fn(),
    linkKind: 'pipe', onLinkKind: fn(), selected: 3, selectedElements: 3,
    onDuplicate: fn(), onDelete: fn(), onCopy: fn(), onPaste: fn(), onConnectSelected: fn(),
    onAlign: fn(), onDistribute: fn(), onOrder: fn(), library: [], onSaveAssembly: fn(), onInsertAssembly: fn(), onRemoveAssembly: fn(),
    layers: [], onToggleLock: fn(), onToggleHide: fn(), onUnlockAll: fn(), onShowAll: fn(), problems: 0, onProblems: fn(), ...over,
  } as SceneEditorToolbarProps;
}
const mount = (over: Partial<SceneEditorToolbarProps> = {}) => { const p = props(over); render(<SceneEditorToolbar {...p} />); return p; };
const openMenu = (id: string) => { fireEvent.click(screen.getByTestId(id)); return within(screen.getByRole('group', { name: screen.getByTestId(id).getAttribute('aria-label') ?? '' })); };

describe('the buttons', () => {
  it('each button calls its handler', () => {
    const p = mount();
    for (const [id, call] of [['undo', p.onUndo], ['redo', p.onRedo], ['zoom-in', p.onZoomIn], ['zoom-out', p.onZoomOut], ['zoom-fit', p.onFit],
      ['toggle-grid', p.onGrid], ['toggle-guides', p.onGuides], ['duplicate', p.onDuplicate], ['copy', p.onCopy], ['paste', p.onPaste], ['delete', p.onDelete]] as const) {
      fireEvent.click(screen.getByTestId(id));
      expect(call, id).toHaveBeenCalledTimes(1);
    }
  });
  it('the zoom level button fits the view too', () => {
    const p = mount();
    fireEvent.click(screen.getByTestId('zoom-level'));
    expect(p.onFit).toHaveBeenCalledTimes(1);
  });
  it('picks a tool and a connection kind', () => {
    const p = mount();
    fireEvent.click(screen.getByTestId('scene-tool-zone'));
    expect(p.onTool).toHaveBeenCalledWith('zone');
    // the kinds by name, never the stored word (next-boilerplate e2e round 5, V1-X2)
    expect([...(screen.getByTestId('link-kind') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Pipe', 'Hose', 'Cable', 'Signal wire', 'Strip', 'Thin line', 'Single-line']);
    fireEvent.change(screen.getByTestId('link-kind'), { target: { value: 'sld' } });
    expect(p.onLinkKind).toHaveBeenCalledWith('sld');
  });
  it('joins two selected symbols only when exactly two are selected', () => {
    mount({ selectedElements: 2 });
    expect(screen.getByTestId('connect-selected')).toBeEnabled();
    cleanup();
    mount({ selectedElements: 3 });
    expect(screen.getByTestId('connect-selected')).toBeDisabled();
  });
  it('disables what needs a selection, and the menus that need several symbols', () => {
    mount({ selected: 0, selectedElements: 0, canUndo: false, canRedo: false });
    for (const id of ['duplicate', 'copy', 'delete', 'menu-align', 'menu-distribute', 'menu-order', 'menu-save', 'undo', 'redo']) expect(screen.getByTestId(id), id).toBeDisabled();
    cleanup();
    mount({ selected: 2, selectedElements: 2 });
    expect(screen.getByTestId('menu-align')).toBeEnabled();
    expect(screen.getByTestId('menu-distribute')).toBeDisabled();
  });
});

describe('the problems count', () => {
  it('says none, one, or how many, and opens the problems', () => {
    const p = mount({ problems: 0 });
    expect(screen.getByTestId('problems-count')).toHaveTextContent(m.noProblems);
    cleanup();
    mount({ problems: 1 });
    expect(screen.getByTestId('problems-count')).toHaveTextContent(m.problemsOne);
    cleanup();
    const q = mount({ problems: 4 });
    expect(screen.getByTestId('problems-count')).toHaveTextContent('4 problems');
    fireEvent.click(screen.getByTestId('problems-count'));
    expect(q.onProblems).toHaveBeenCalled();
    expect(p.onProblems).not.toHaveBeenCalled();
  });
});

describe('the menus', () => {
  it('align, distribute and order call their handlers and close', () => {
    const p = mount();
    fireEvent.click(openMenu('menu-align').getByText(m.alignRight));
    expect(p.onAlign).toHaveBeenCalledWith('right');
    expect(screen.queryByRole('group', { name: m.align })).toBeNull();
    for (const [text, mode] of [[m.alignLeft, 'left'], [m.alignCenter, 'center'], [m.alignTop, 'top'], [m.alignMiddle, 'middle'], [m.alignBottom, 'bottom']] as const) {
      fireEvent.click(openMenu('menu-align').getByText(text));
      expect(p.onAlign).toHaveBeenLastCalledWith(mode);
    }
    fireEvent.click(openMenu('menu-distribute').getByText(m.distributeH));
    expect(p.onDistribute).toHaveBeenLastCalledWith('horizontal');
    fireEvent.click(openMenu('menu-distribute').getByText(m.distributeV));
    expect(p.onDistribute).toHaveBeenLastCalledWith('vertical');
    for (const [text, mode] of [[m.toFront, 'front'], [m.forward, 'forward'], [m.backward, 'backward'], [m.toBack, 'back']] as const) {
      fireEvent.click(openMenu('menu-order').getByText(text));
      expect(p.onOrder).toHaveBeenLastCalledWith(mode);
    }
  });
  it('Escape and a click elsewhere close an open menu', () => {
    mount();
    openMenu('menu-order');
    fireEvent.keyDown(screen.getByRole('group', { name: m.order }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: m.order })).toBeNull();
    openMenu('menu-order');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group', { name: m.order })).toBeNull();
  });
  it('saves the selection as a piece under the typed name, or a default one', () => {
    const p = mount({ library: [{ name: 'A' } as never] });
    const menu = openMenu('menu-save');
    fireEvent.change(menu.getByLabelText(m.assemblyName), { target: { value: '  Pump skid ' } });
    fireEvent.click(menu.getByTestId('save-assembly'));
    expect(p.onSaveAssembly).toHaveBeenCalledWith('Pump skid');
    const again = openMenu('menu-save');
    fireEvent.click(again.getByTestId('save-assembly'));
    expect(p.onSaveAssembly).toHaveBeenLastCalledWith(m.assemblyDefault.replace('{n}', '2'));
  });
  it('lists the saved pieces to insert or remove, or says there are none', () => {
    mount();
    expect(openMenu('menu-insert').getByText(m.libraryEmpty)).toBeInTheDocument();
    cleanup();
    const item = { name: 'Pump skid' } as never;
    const p = mount({ library: [item] });
    const menu = openMenu('menu-insert');
    fireEvent.click(menu.getByText('Pump skid'));
    expect(p.onInsertAssembly).toHaveBeenCalledWith(item);
    fireEvent.click(openMenu('menu-insert').getByRole('button', { name: m.libraryRemove.replace('{name}', 'Pump skid') }));
    expect(p.onRemoveAssembly).toHaveBeenCalledWith('Pump skid');
  });
  it('layers: lock, hide, filter, unlock all and show all', () => {
    const layers = [{ id: 'pump1', label: 'Pump 1', locked: true, hidden: false }, { id: 'tank1', label: 'Tank 1', locked: false, hidden: true }];
    const p = mount({ layers });
    const menu = openMenu('menu-layers');
    fireEvent.click(menu.getByRole('button', { name: `${m.unlock} Pump 1` }));
    expect(p.onToggleLock).toHaveBeenCalledWith('pump1');
    fireEvent.click(menu.getByRole('button', { name: `${m.show} Tank 1` }));
    expect(p.onToggleHide).toHaveBeenCalledWith('tank1');
    fireEvent.change(menu.getByPlaceholderText(m.layersFilter), { target: { value: 'tank' } });
    expect(menu.queryByText('Pump 1')).toBeNull();
    expect(menu.getByText('Tank 1')).toBeInTheDocument();
    fireEvent.click(menu.getByText(m.unlockAll));
    fireEvent.click(menu.getByText(m.showAll));
    expect(p.onUnlockAll).toHaveBeenCalled();
    expect(p.onShowAll).toHaveBeenCalled();
  });
  it('unlock all and show all are disabled when nothing is locked or hidden', () => {
    mount({ layers: [{ id: 'a', label: 'A', locked: false, hidden: false }] });
    const menu = openMenu('menu-layers');
    expect(menu.getByText(m.unlockAll).closest('button')).toBeDisabled();
    expect(menu.getByText(m.showAll).closest('button')).toBeDisabled();
  });
});
