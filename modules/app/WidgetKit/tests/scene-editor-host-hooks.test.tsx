import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { screen, fireEvent, boxes, click, key, mockLayout, mount } from './scene-editor-harness';

/**
 * What the host can hook into: a rename (so it can carry what hangs off the id), its own problems (in the list and in the
 * count), and the words of the panels.
 */
beforeEach(() => { mockLayout(); try { window.localStorage.clear(); } catch { /* none */ } });
afterEach(cleanup);

const B = boxes();
const ctl = (label: string): HTMLElement => screen.getAllByLabelText(label).find((e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName))!;

describe('host.onRename', () => {
  it('is told about a rename made in the inspector', () => {
    const onRename = vi.fn();
    const m = mount({ host: { onRename } });
    click(m.svg, { x: B.pump1.cx, y: B.pump1.cy });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'pumpA' } });
    key(box, 'Enter');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('pump1', 'pumpA');
  });

  it('is not told when the rename is refused or does not change the id', () => {
    const onRename = vi.fn();
    const m = mount({ host: { onRename } });
    click(m.svg, { x: B.pump1.cx, y: B.pump1.cy });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'tank1' } });
    key(box, 'Enter');
    fireEvent.change(box, { target: { value: 'pump1' } });
    key(box, 'Enter');
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe('host.problems', () => {
  it('adds the host\'s own problems to the count and to the problems tab', () => {
    const problems = vi.fn(() => [{ severity: 'warning' as const, code: 'actions-dropped', id: 'pump1', message: 'The click action of pump1 would be dropped' }]);
    mount({ host: { problems } });
    expect(screen.getByTestId('problems-count')).toHaveTextContent('1 problem');
    fireEvent.click(screen.getByTestId('problems-count'));
    expect(screen.getByText(/click action of pump1 would be dropped/)).toBeInTheDocument();
  });
});

describe('panelMessages', () => {
  it('replaces the words of the palette while the rest stays English', () => {
    mount({ panelMessages: { palette: { searchPlaceholder: 'Find a symbol to add' } } });
    expect(screen.getByPlaceholderText('Find a symbol to add')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rules' })).toBeInTheDocument();
  });
});

describe('host.dirty', () => {
  it('enables Apply when only the host has edits, and Close asks before discarding them', () => {
    const m = mount({ host: { dirty: true } });
    expect(screen.getByTestId('editor-apply')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Close/ }));
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
    expect(m.onClose).not.toHaveBeenCalled();
  });
  it('leaves Apply disabled when neither the diagram nor the host has edits', () => {
    mount({ host: { dirty: false } });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });
});
