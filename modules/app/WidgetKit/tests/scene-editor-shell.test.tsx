import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { smallScene } from './scene-edit-fixture';
import {
  boxes, click, drag, element, elements, fireEvent, key, links, mockLayout, mount, screen, selected, shapes, viewBox, waitFor, within,
} from './scene-editor-harness';
import { parseClipboard, problems } from '../views/scene-edit-logic';

// The palette draws a thumbnail for every symbol of the library (about 540): a mount takes seconds in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const B = boxes();
const gap = (B.pump1.x + B.pump1.w + B.valve1.x) / 2;

function clipboard(over: Partial<Record<'writeText' | 'readText', unknown>> = {}) {
  const api = { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn().mockResolvedValue(''), ...over };
  Object.defineProperty(navigator, 'clipboard', { value: api, configurable: true });
  return api as { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn> };
}

beforeEach(() => { mockLayout(); try { window.localStorage.clear(); } catch { /* none */ } });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('the keyboard', () => {
  it('lets Tab walk through every symbol, shape and connection in draw order, selecting what has the focus', () => {
    const { canvas } = mount();
    const stops = [...canvas.querySelectorAll('[data-layer="focus"] > g')];
    expect(stops.every((g) => g.getAttribute('tabindex') === '0' && g.getAttribute('role') === 'button')).toBe(true);
    expect(stops.map((g) => g.getAttribute('data-element') ?? `s${g.getAttribute('data-shape')}${g.getAttribute('data-link') ?? ''}`).slice(0, 3)).toEqual(['tank1', 'pump1', 'valve1']);
    // Every stop has a name a screen reader can say: the symbol, its type and where it is.
    expect(canvas.querySelector('[data-element="pump1"]')).toHaveAttribute('aria-label', 'pump1, pump.volute, at 300, 200');
    expect(canvas.querySelector('[data-link="0"]')?.getAttribute('aria-label')).toBe('Connection from Feed to pump1');
    fireEvent.focus(canvas.querySelector('[data-element="pump1"]') as Element);
    expect(selected(document.body)).toEqual(['pump1']);
    expect(canvas.querySelector('[data-element="pump1"]')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.focus(canvas.querySelector('[data-link="1"]') as Element);
    expect(document.body.querySelector('[data-selected-link="1"]')).not.toBeNull();
    expect(selected(document.body)).toEqual([]);
  });

  it('moves the selection with the arrows and announces the new position', () => {
    const { canvas, said } = mount();
    const g = canvas.querySelector('[data-element="tank1"]') as Element;
    fireEvent.focus(g);
    key(g, 'ArrowLeft');
    expect(said()).toBe('Moved tank1 to 99, 200');
    key(g, 'ArrowDown', { shiftKey: true });
    expect(said()).toBe('Moved tank1 to 99, 210');
  });

  it('deletes the selection with Delete and takes the connections with it', async () => {
    const { svg, canvas, said, applied } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    key(canvas, 'Delete');
    expect(said()).toBe('Deleted pump1');
    expect(selected(document.body)).toEqual([]);
    const s = await applied();
    expect(elements(s).map((e) => e.id)).toEqual(['tank1', 'valve1']);
    expect(links(s)).toEqual([]);
  });

  it('deletes a selected connection and a selected shape', async () => {
    const { svg, canvas, applied } = mount();
    fireEvent.focus(canvas.querySelector('[data-link="0"]') as Element);
    key(canvas, 'Delete');
    click(svg, { x: 200, y: 400 });
    key(canvas, 'Backspace');
    const s = await applied();
    expect(links(s)).toHaveLength(1);
    expect(shapes(s).map((h) => h.kind)).toEqual(['text', 'zone']);
  });

  it('selects everything with A (not a symbol that is locked) and removes it with Delete', async () => {
    const { canvas, said, applied } = mount();
    key(canvas, 'a');
    expect(selected(document.body)).toEqual(['tank1', 'pump1', 'valve1']);
    expect(said()).toBe('Selected 6 items');
    key(canvas, 'Delete');
    expect(elements(await applied())).toEqual([]);
  });

  it('duplicates with Ctrl+D and selects the copies', async () => {
    const { svg, canvas, applied } = mount();
    click(svg, { x: B.tank1.cx, y: B.tank1.cy });
    key(canvas, 'd', { ctrlKey: true });
    expect(selected(document.body)).toEqual(['tank2']);
    const s = await applied();
    expect(element(s, 'tank2')).toMatchObject({ symbol: 'tank.vertical', x: 120, y: 220, label: 'Feed' });
  });

  it('undoes and redoes with Ctrl or Cmd + Z, Shift+Z and Y', async () => {
    const { svg, canvas, said, applied } = mount();
    click(svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(canvas, 'Delete');
    key(canvas, 'z', { ctrlKey: true });
    expect(said()).toBe('Undone');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    key(canvas, 'Z', { ctrlKey: true, shiftKey: true });
    expect(said()).toBe('Redone');
    key(canvas, 'z', { metaKey: true });
    key(canvas, 'y', { metaKey: true });
    expect(elements(await applied())).toHaveLength(2);
  });

  it('renames in place with F2 (the links follow), refuses a name that is taken and closes with Escape', async () => {
    const { svg, canvas, applied } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    key(canvas, 'F2');
    const box = screen.getByLabelText('New name') as HTMLInputElement;
    expect(box.value).toBe('pump1');
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: 'tank1' } });
    key(box, 'Enter');
    expect(screen.getByRole('alert')).toHaveTextContent('Another symbol already has this id');
    expect(screen.getByLabelText('New name')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'pump9' } });
    key(box, 'Enter');
    expect(screen.queryByLabelText('New name')).toBeNull();
    expect(selected(document.body)).toEqual(['pump9']);
    const s = await applied();
    expect(element(s, 'pump9')).toBeDefined();
    expect(links(s).map((l) => [l.from, l.to])).toEqual([['tank1.r', 'pump9.l'], ['pump9.r', 'valve1.l:0.5']]);
    // Escape closes the box without renaming.
    key(canvas, 'F2');
    key(screen.getByLabelText('New name'), 'Escape');
    expect(screen.queryByLabelText('New name')).toBeNull();
    expect(selected(document.body)).toEqual(['pump9']);
  });

  it('renames a title in place with a double click', async () => {
    const { svg, applied } = mount();
    fireEvent.doubleClick(svg, { clientX: 400, clientY: 250 });
    expect(screen.queryByLabelText('New name')).toBeNull();
    const title = { x: 500, y: 30 };
    const a = (await import('./scene-editor-harness')).at(svg, title);
    fireEvent.doubleClick(svg, a);
    const box = screen.getByLabelText('New name') as HTMLInputElement;
    expect(box.value).toBe('Plant');
    fireEvent.change(box, { target: { value: 'Plant 2' } });
    key(box, 'Enter');
    expect(shapes(await applied())[0]).toMatchObject({ kind: 'text', text: 'Plant 2' });
  });

  it('clears the selection with Escape', () => {
    const { svg, canvas, said } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    key(canvas, 'Escape');
    expect(selected(document.body)).toEqual([]);
    expect(said()).toBe('Selection cleared');
  });

  it('chooses and announces tools by letter', () => {
    const { canvas, said } = mount();
    key(canvas, 'z');
    expect(said()).toBe('Zone tool');
    expect(screen.getByTestId('scene-tool-zone')).toHaveAttribute('aria-pressed', 'true');
    key(canvas, 'v');
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves the keys alone in a field or a control outside the canvas', () => {
    const { svg } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    key(screen.getByTestId('link-kind'), 'Delete');
    key(screen.getByTestId('zoom-in'), 'ArrowLeft');
    key(screen.getByTestId('zoom-in'), 'a');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    expect(selected(document.body)).toEqual(['pump1']);
  });

  it('draws focus rings on the stand-ins (visible on keyboard focus)', () => {
    const { canvas } = mount();
    const ring = canvas.querySelector('[data-element="pump1"] rect') as Element;
    expect(ring.getAttribute('class')).toContain('group-focus-visible:stroke-border-focus');
    expect(canvas.getAttribute('class')).toContain('focus-visible:ring-2');
  });
});

describe('the clipboard', () => {
  async function copyTankAndPump(m: ReturnType<typeof mount>) {
    drag(m.svg, { x: 20, y: 120 }, { x: gap, y: 320 });
    key(m.canvas, 'c', { ctrlKey: true });
  }

  it('copies the selection as an assembly on the system clipboard (Ctrl+C)', async () => {
    const api = clipboard();
    const m = mount();
    await copyTankAndPump(m);
    expect(api.writeText).toHaveBeenCalledTimes(1);
    const parsed = parseClipboard(api.writeText.mock.calls[0][0]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.assembly.elements.map((e) => e.id)).toEqual(['tank1', 'pump1']);
      expect(parsed.assembly.links).toHaveLength(1);
    }
    expect(m.said()).toMatch(/^Copied \d+ items$/);
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('says so instead of copying nothing', () => {
    const api = clipboard();
    const { canvas, said } = mount();
    key(canvas, 'c', { ctrlKey: true });
    expect(said()).toBe('Select something to copy first.');
    expect(api.writeText).not.toHaveBeenCalled();
  });

  it('pastes what the browser delivers with its paste event (no permission needed)', async () => {
    const api = clipboard();
    const m = mount();
    await copyTankAndPump(m);
    const text = api.writeText.mock.calls[0][0] as string;
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => text } });
    const s = await m.applied();
    expect(elements(s).map((e) => e.id)).toEqual(['tank1', 'pump1', 'valve1', 'tank2', 'pump2']);
    expect(links(s)).toHaveLength(3);
    expect(links(s)[2]).toMatchObject({ from: 'tank2.r', to: 'pump2.l' });
  });

  it('puts a second paste a step aside from the first', async () => {
    const api = clipboard();
    const m = mount();
    await copyTankAndPump(m);
    const text = api.writeText.mock.calls[0][0] as string;
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => text } });
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => text } });
    const s = await m.applied();
    const a = element(s, 'tank2') as { x: number; y: number }; const b = element(s, 'tank3') as { x: number; y: number };
    expect(b.x - a.x).toBe(20);
    expect(b.y - a.y).toBe(20);
  });

  it('shows a paste box instead of failing when the browser refuses to read the clipboard, and inserts from it', async () => {
    const api = clipboard({ readText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) });
    const m = mount();
    await copyTankAndPump(m);
    const text = api.writeText.mock.calls[0][0] as string;
    await act(async () => { fireEvent.click(screen.getByTestId('paste')); });
    const dialog = await screen.findByRole('dialog', { name: 'Paste a diagram piece' });
    const box = within(dialog).getByLabelText('Copied diagram piece') as HTMLTextAreaElement;
    // What was copied in this editor is offered, since the browser would not let it be read back.
    expect(box.value).toBe(text);
    fireEvent.change(box, { target: { value: text } });
    fireEvent.click(within(dialog).getByTestId('paste-insert'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(elements(await m.applied()).map((e) => e.id)).toEqual(['tank1', 'pump1', 'valve1', 'tank2', 'pump2']);
  });

  it('starts the paste box empty when nothing was copied here, and keeps it open with the reason for text that is not a piece', async () => {
    clipboard({ readText: vi.fn().mockRejectedValue(new Error('denied')) });
    mount();
    await act(async () => { fireEvent.click(screen.getByTestId('paste')); });
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByLabelText('Copied diagram piece') as HTMLTextAreaElement;
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(within(dialog).getByTestId('paste-insert'));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('This is not a diagram piece');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    // Escape closes it and the focus goes back where it was.
    key(screen.getByRole('dialog'), 'Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads the clipboard directly when the browser allows it', async () => {
    const m = mount();
    const copied = clipboard();
    await copyTankAndPump(m);
    const text = copied.writeText.mock.calls[0][0] as string;
    copied.readText.mockResolvedValue(text);
    await act(async () => { fireEvent.click(screen.getByTestId('paste')); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(elements(await m.applied())).toHaveLength(5);
  });

  it('refuses a piece drawn with another meaning of x and y, and text that is far too long', async () => {
    clipboard();
    const m = mount();
    const wrong = JSON.stringify({ format: 'kui.scada.assembly', version: 1, anchor: 'corner', elements: [{ id: 'a', symbol: 'pump.volute', x: 0, y: 0 }], shapes: [], links: [] });
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => wrong } });
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('another meaning of x and y');
    key(screen.getByRole('dialog'), 'Escape');
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => 'x'.repeat(400_000) } });
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('too long');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('works when there is no system clipboard at all', async () => {
    const m = mount();
    drag(m.svg, { x: 20, y: 120 }, { x: gap, y: 320 });
    key(m.canvas, 'c', { ctrlKey: true });
    expect(m.said()).toMatch(/^Copied/);
    // The paste event with no text falls back to what was copied here.
    fireEvent.paste(m.canvas, { clipboardData: { getData: () => '' } });
    expect(elements(await m.applied())).toHaveLength(5);
  });

  it('leaves a paste into a text field alone', () => {
    const m = mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    const field = screen.getByPlaceholderText('Find an item');
    const ok = fireEvent.paste(field, { clipboardData: { getData: () => '{}' } });
    expect(ok).toBe(true);
    expect(m.said()).toBe('');
  });
});

describe('saved pieces (a small local library)', () => {
  it('saves the selection under a name, lists it, inserts it and removes it', async () => {
    const m = mount();
    click(m.svg, { x: B.pump1.cx, y: B.pump1.cy });
    fireEvent.click(screen.getByTestId('menu-save'));
    fireEvent.change(screen.getByLabelText('Name of the piece'), { target: { value: 'My pump' } });
    fireEvent.click(screen.getByTestId('save-assembly'));
    expect(m.said()).toBe('Saved My pump to the library');
    const stored = JSON.parse(window.localStorage.getItem('kui.scada.editor.library') as string);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('My pump');
    fireEvent.click(screen.getByTestId('menu-insert'));
    fireEvent.click(screen.getByRole('button', { name: 'My pump' }));
    expect(m.said()).toBe('Inserted My pump');
    expect(selected(document.body)).toEqual(['pump2']);
    expect(elements(await m.applied())).toHaveLength(4);
    fireEvent.click(screen.getByTestId('menu-insert'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove My pump from the library' }));
    expect(screen.getByText('No saved pieces yet.')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('kui.scada.editor.library') as string)).toEqual([]);
  });

  it('keeps pieces between editors through localStorage', () => {
    const first = mount();
    click(first.svg, { x: B.pump1.cx, y: B.pump1.cy });
    fireEvent.click(screen.getByTestId('menu-save'));
    fireEvent.click(screen.getByTestId('save-assembly'));
    cleanup();
    mount();
    fireEvent.click(screen.getByTestId('menu-insert'));
    expect(screen.getByRole('button', { name: 'Piece 1' })).toBeInTheDocument();
  });

  it('works without localStorage: the piece lives for the session and nothing throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    const m = mount();
    click(m.svg, { x: B.pump1.cx, y: B.pump1.cy });
    fireEvent.click(screen.getByTestId('menu-save'));
    fireEvent.change(screen.getByLabelText('Name of the piece'), { target: { value: 'Session only' } });
    fireEvent.click(screen.getByTestId('save-assembly'));
    fireEvent.click(screen.getByTestId('menu-insert'));
    fireEvent.click(screen.getByRole('button', { name: 'Session only' }));
    expect(selected(document.body)).toEqual(['pump2']);
  });

  it('ignores a library in storage that is not valid', () => {
    window.localStorage.setItem('kui.scada.editor.library', '{"broken":');
    mount();
    fireEvent.click(screen.getByTestId('menu-insert'));
    expect(screen.getByText('No saved pieces yet.')).toBeInTheDocument();
  });

  it('closes a menu with Escape and with a click elsewhere', () => {
    mount();
    fireEvent.click(screen.getByTestId('menu-insert'));
    expect(screen.getByText('No saved pieces yet.')).toBeInTheDocument();
    key(screen.getByText('No saved pieces yet.'), 'Escape');
    expect(screen.queryByText('No saved pieces yet.')).toBeNull();
    fireEvent.click(screen.getByTestId('menu-insert'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('No saved pieces yet.')).toBeNull();
  });
});

describe('the toolbar', () => {
  it('aligns and distributes a selection and changes draw order', async () => {
    const m = mount();
    // Move pump1 down first so there is something to align.
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    drag(m.svg, start, { x: start.x, y: start.y + 80 });
    key(m.canvas, 'a');
    expect(screen.getByTestId('menu-align')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('menu-align'));
    fireEvent.click(screen.getByText('Align middles'));
    const s = await m.applied();
    const ys = elements(s).map((e) => Math.round(Number(e.y)));
    expect(new Set(ys).size).toBe(1);
  });

  it('disables what the selection cannot do', () => {
    const { svg } = mount();
    for (const id of ['duplicate', 'copy', 'delete', 'menu-align', 'menu-distribute', 'menu-order', 'menu-save', 'connect-selected']) expect(screen.getByTestId(id)).toBeDisabled();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(screen.getByTestId('duplicate')).not.toBeDisabled();
    expect(screen.getByTestId('menu-align')).toBeDisabled();
    click(svg, { x: B.valve1.cx, y: B.valve1.cy }, { shiftKey: true });
    expect(screen.getByTestId('menu-align')).not.toBeDisabled();
    expect(screen.getByTestId('menu-distribute')).toBeDisabled();
    expect(screen.getByTestId('connect-selected')).not.toBeDisabled();
  });

  it('toggles the grid and the guides and shows the zoom level', () => {
    mount();
    expect(screen.getByTestId('toggle-grid')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('toggle-grid'));
    expect(screen.getByTestId('toggle-grid')).not.toHaveAttribute('aria-pressed');
    fireEvent.click(screen.getByTestId('toggle-guides'));
    expect(screen.getByTestId('toggle-guides')).not.toHaveAttribute('aria-pressed');
    expect(screen.getByTestId('zoom-level')).toHaveTextContent('Zoom 100%');
  });

  it('counts the problems of the draft and opens the problems tab', () => {
    const s = { ...smallScene(), links: [...(smallScene().links as unknown[]), { from: 'pump1.r', to: 'ghost.l' }] };
    mount({}, s);
    const count = problems(s, {}).length;
    expect(count).toBeGreaterThan(0);
    expect(screen.getByTestId('problems-count')).toHaveTextContent(count === 1 ? "1 problem" : `${count} problems`);
    fireEvent.click(screen.getByTestId('problems-count'));
    expect(screen.getByRole('tab', { name: /Problems/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-panel="problems"]')).not.toBeNull();
  });

  it('says there are no problems when there are none', () => {
    mount({}, { width: 1000, height: 600, elements: [], links: [] });
    expect(screen.getByTestId('problems-count')).toHaveTextContent('No problems');
  });
});

describe('lock and hide (session only, never stored)', () => {
  it('hides a symbol from the canvas and the keyboard order and brings it back with Show all', () => {
    const { canvas } = mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    fireEvent.click(screen.getByRole('button', { name: /^Hide pump1/ }));
    expect(canvas.querySelector('[data-layer="focus"] [data-element="pump1"]')).toBeNull();
    expect(screen.getByRole('button', { name: /^Show pump1/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(canvas.querySelector('[data-layer="focus"] [data-element="pump1"]')).not.toBeNull();
  });

  it('draws a hidden symbol out of the picture without touching the stored settings', async () => {
    const m = mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    fireEvent.click(screen.getByRole('button', { name: /^Hide pump1/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Lock Feed/ }));
    click(m.svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(m.canvas, 'ArrowRight');
    const s = await m.applied();
    expect(s.rules).toEqual(smallScene().rules);
    expect(JSON.stringify(s)).not.toContain('"hidden"');
    expect(element(s, 'pump1')).toEqual(element(smallScene(), 'pump1'));
  });

  it('keeps a locked symbol out of select-all and the marquee, and out of a nudge', async () => {
    const m = mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    fireEvent.click(screen.getByRole('button', { name: /^Lock pump1/ }));
    key(m.canvas, 'a');
    expect(selected(document.body)).toEqual(['tank1', 'valve1']);
    key(m.canvas, 'ArrowRight');
    expect(element(await m.applied(), 'pump1')).toMatchObject({ x: 300 });
  });

  it('filters the layer list', () => {
    mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    fireEvent.change(screen.getByPlaceholderText('Find an item'), { target: { value: 'tank' } });
    expect(screen.queryByRole('button', { name: /^Hide pump1/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Hide Feed/ })).toBeInTheDocument();
  });
});

describe('the minimap', () => {
  it('shows the viewport rectangle and moves the view with a click', () => {
    const { svg, canvas } = mount();
    const mm = screen.getByTestId('scene-minimap');
    const full = Number(screen.getByTestId('minimap-view').getAttribute('width'));
    key(canvas, '+'); key(canvas, '+'); key(canvas, '+');
    expect(Number(screen.getByTestId('minimap-view').getAttribute('width'))).toBeLessThan(full);
    const before = viewBox(svg);
    fireEvent.pointerDown(mm, { pointerId: 1, button: 0, clientX: 100, clientY: 62.5 });
    fireEvent.pointerUp(mm, { pointerId: 1 });
    const after = viewBox(svg);
    expect(after.w).toBeCloseTo(before.w, 6);
    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
  });

  it('moves the view from the keyboard too', () => {
    const { svg, canvas } = mount();
    key(canvas, '+'); key(canvas, '+');
    const x0 = viewBox(svg).x;
    key(screen.getByTestId('scene-minimap'), 'ArrowRight');
    expect(viewBox(svg).x).toBeGreaterThan(x0);
  });
});

describe('Apply and Close', () => {
  it('closes at once when nothing changed', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onClose } = mount();
    fireEvent.click(screen.getByTestId('editor-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks inside the page before it throws changes away (no window.confirm)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { svg, onClose } = mount();
    click(svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(screen.getByTestId('scene-canvas'), 'Delete');
    fireEvent.click(screen.getByTestId('editor-close'));
    const dialog = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('dirty-keep')).toHaveFocus();
    // Escape and "Keep editing" both stay.
    key(dialog, 'Escape');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByTestId('editor-close'));
    fireEvent.click(screen.getByTestId('dirty-keep'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    // Discard closes.
    fireEvent.click(screen.getByTestId('editor-close'));
    fireEvent.click(screen.getByTestId('dirty-discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps the focus inside the dialog with Tab', () => {
    const { svg } = mount();
    click(svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(screen.getByTestId('scene-canvas'), 'Delete');
    fireEvent.click(screen.getByTestId('editor-close'));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByTestId('dirty-keep')).toHaveFocus();
    key(dialog, 'Tab');
    expect(within(dialog).getByTestId('dirty-discard')).toHaveFocus();
    key(dialog, 'Tab');
    expect(within(dialog).getByTestId('dirty-keep')).toHaveFocus();
    key(dialog, 'Tab', { shiftKey: true });
    expect(within(dialog).getByTestId('dirty-discard')).toHaveFocus();
  });

  it('applies the draft, then calls the host so it can close; the draft is then clean', async () => {
    const m = mount();
    click(m.svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(m.canvas, 'Delete');
    expect(screen.getByTestId('editor-apply')).not.toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByTestId('editor-apply')); });
    expect(m.onApply).toHaveBeenCalledTimes(1);
    const sent = m.onApply.mock.calls[0][0] as ReturnType<typeof smallScene>;
    expect((sent.elements as unknown[]).length).toBe(2);
    expect(m.onApplied).toHaveBeenCalledTimes(1);
    expect(m.said()).toBe('Applied');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    // Closing now is not a loss: no dialog.
    fireEvent.click(screen.getByTestId('editor-close'));
    expect(m.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('offers Apply only when there is something to apply', () => {
    mount();
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('stays open and says so when the host rejects, and does not call onApplied', async () => {
    const onApply = vi.fn().mockRejectedValue(new Error('conflict'));
    const m = mount({ onApply });
    click(m.svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(m.canvas, 'Delete');
    await act(async () => { fireEvent.click(screen.getByTestId('editor-apply')); });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(m.onApplied).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('The diagram could not be applied.');
    expect(screen.getByTestId('editor-apply')).not.toBeDisabled();
    // The edits are still there: closing still asks.
    fireEvent.click(screen.getByTestId('editor-close'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(m.onClose).not.toHaveBeenCalled();
  });

  it('is busy while the host works and does not apply twice', async () => {
    let finish: () => void = () => undefined;
    const onApply = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const m = mount({ onApply });
    click(m.svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(m.canvas, 'Delete');
    fireEvent.click(screen.getByTestId('editor-apply'));
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    expect(screen.getByTestId('editor-apply')).toHaveTextContent('Applying');
    fireEvent.click(screen.getByTestId('editor-apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await waitFor(() => expect(m.onApplied).toHaveBeenCalledTimes(1));
  });

  it('works on a copy: the settings the host gave are never changed', async () => {
    const settings = smallScene();
    const before = JSON.stringify(settings);
    const m = mount({}, settings);
    click(m.svg, { x: B.valve1.cx, y: B.valve1.cy });
    key(m.canvas, 'Delete');
    await m.applied();
    expect(JSON.stringify(settings)).toBe(before);
  });
});

describe('the layout and the panels', () => {
  it('has the toolbar, the palette, the canvas and the inspector, with the real panels', () => {
    mount();
    expect(screen.getByRole('toolbar', { name: 'Diagram tools' })).toBeInTheDocument();
    expect(document.querySelector('[data-panel="palette"]')).not.toBeNull();
    expect(document.querySelector('[data-panel="inspector"]')).not.toBeNull();
    expect(screen.getByTestId('scene-canvas')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Diagram editor' })).toBeInTheDocument();
  });

  it('uses the title the host gives and the words the host overrides', () => {
    mount({ title: 'Boiler house', messages: { apply: 'Uygula', toolSelect: 'Pick' } });
    expect(screen.getByRole('region', { name: 'Boiler house' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-apply')).toHaveTextContent('Uygula');
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-label', 'Pick');
    expect(screen.getByTestId('editor-close')).toHaveTextContent('Close');
  });

  it('collapses and expands the side panels', () => {
    mount();
    const palette = screen.getByTestId('panel-palette');
    expect(palette).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByTestId('panel-palette-toggle'));
    expect(palette).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('panel-palette-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('panel-palette-toggle')).toHaveAccessibleName('Expand Symbols');
    fireEvent.click(screen.getByTestId('panel-palette-toggle'));
    expect(palette).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByTestId('panel-inspector-toggle'));
    expect(screen.getByTestId('panel-inspector')).toHaveAttribute('data-open', 'false');
  });

  it('stacks on a narrow screen: the canvas comes first and the panels follow (order classes)', () => {
    mount();
    expect(screen.getByTestId('panel-palette').className).toContain('order-2');
    expect(screen.getByTestId('panel-palette').className).toContain('lg:order-1');
    expect(screen.getByTestId('scene-canvas').parentElement?.className).toContain('order-1');
  });

  it('shows Properties, Rules, Problems and What-if, and the Actions tab only when the host has an action editor', () => {
    const { unmount } = (() => { mount(); return { unmount: cleanup }; })();
    expect(screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Properties', 'Rules', 'Problems', 'What-if']);
    unmount();
    mount({ host: { renderActions: (id) => <p data-testid="actions-editor">actions of {id}</p> } });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Properties', 'Rules', 'Actions', 'Problems', 'What-if']);
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }));
    expect(screen.getByText('Select one symbol to edit its actions.')).toBeInTheDocument();
    click(screen.getByTestId('scene-svg') as unknown as SVGSVGElement, { x: B.pump1.cx, y: B.pump1.cy });
    expect(screen.getByTestId('actions-editor')).toHaveTextContent('actions of pump1');
  });

  it('moves between the tabs with the arrow keys, and shows each panel in its tab panel', () => {
    mount();
    const first = screen.getByRole('tab', { name: 'Properties' });
    expect(first).toHaveAttribute('tabindex', '0');
    key(first, 'ArrowRight');
    expect(screen.getByRole('tab', { name: 'Rules' })).toHaveAttribute('aria-selected', 'true');
    key(screen.getByRole('tab', { name: 'Rules' }), 'ArrowRight');
    expect(screen.getByRole('tab', { name: /Problems/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'scene-tab-problems');
    expect(document.querySelector('[data-panel="problems"]')).not.toBeNull();
    key(screen.getByRole('tab', { name: /Problems/ }), 'End');
    expect(document.querySelector('[data-panel="whatif"]')).not.toBeNull();
    key(screen.getByRole('tab', { name: 'What-if' }), 'ArrowRight');
    expect(document.querySelector('[data-panel="inspector"]')).not.toBeNull();
  });
});

describe('announcements', () => {
  it('announces what was added, connected, moved and deleted, with name, symbol and position', () => {
    const { svg, canvas, said } = mount();
    key(canvas, 'c');
    drag(svg, { x: B.tank1.cx, y: B.tank1.cy }, { x: B.valve1.x + 2, y: B.valve1.cy });
    expect(said()).toBe('Connected tank1 to valve1');
    key(canvas, 'v');
    const start = { x: B.valve1.cx, y: B.valve1.cy };
    drag(svg, start, { x: start.x + 40, y: start.y + 40 });
    expect(said()).toMatch(/^Moved valve1 to \d+, \d+$/);
    key(canvas, 'Delete');
    expect(said()).toBe('Deleted valve1');
  });

  it('is a polite live region that is not shown', () => {
    mount();
    const live = screen.getByTestId('scene-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('role', 'status');
    expect(live.className).toContain('sr-only');
  });

  it('says the same thing twice when the same thing happens twice', () => {
    const { canvas, said } = mount();
    key(canvas, 'Escape'); key(canvas, 'a'); key(canvas, 'a');
    expect(said()).toContain('Selected 6 items');
    expect(said().length).toBeGreaterThan('Selected 6 items'.length);
  });
});
