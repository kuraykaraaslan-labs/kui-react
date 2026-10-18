import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WidgetBoard } from '../WidgetBoard';
import { WidgetKitProvider } from '../WidgetKitContext';
import type { WidgetKitMessagesInput } from '../messages';
import type { BoardDocument } from '../settings/board';
import { STAT_VALUE_KIND } from '../templates/stat-value';
import { STAT_VALUE_VIEW } from '../views/StatValueView';

const kinds = [STAT_VALUE_KIND];
const views = { 'stat.value': STAT_VALUE_VIEW };
const doc = (placements: BoardDocument['placements']): BoardDocument => ({
  format: 'widgetkit.board', version: 1, templates: {}, board: { title: 'Plant', settings: {} }, placements,
});
const cellOf = (id: string) => document.querySelector(`[data-placement="${id}"]`) as HTMLElement;

afterEach(() => { vi.restoreAllMocks(); });

describe('WidgetBoard cells', () => {
  it('places a cell from lg up only: no inline grid-column / grid-row, the place in variables', () => {
    render(<WidgetBoard doc={doc([{ id: 'a', type: 'stat.value', title: 'A', x: 4, y: 2, w: 3, h: 2, settings: {} }])} kinds={kinds} views={views} />);
    const cell = cellOf('a');
    expect(cell.style.gridColumn).toBe('');
    expect(cell.style.gridRow).toBe('');
    expect(cell.style.getPropertyValue('--wk-gc')).toBe('5 / span 3');
    expect(cell.style.getPropertyValue('--wk-gr')).toBe('3 / span 2');
    expect(cell.className).toContain('lg:[grid-column:var(--wk-gc)]');
    expect(cell.className).toContain('lg:[grid-row:var(--wk-gr)]');
  });

  it('the card\'s small-screen settings act on the cell', () => {
    render(<WidgetBoard doc={doc([
      { id: 'a', type: 'stat.value', title: 'A', x: 0, y: 0, w: 3, h: 2, settings: { $card: { hideOnMobile: true } } },
      { id: 'b', type: 'stat.value', title: 'B', x: 3, y: 0, w: 3, h: 2, settings: { $card: { mobileOrder: 2 } } },
      { id: 'c', type: 'stat.value', title: 'C', x: 6, y: 0, w: 3, h: 2, settings: {} },
    ])} kinds={kinds} views={views} />);
    expect(cellOf('a').className).toContain('max-lg:hidden');
    expect(cellOf('b').className).toContain('max-lg:[order:var(--wk-mo)]');
    expect(cellOf('b').style.getPropertyValue('--wk-mo')).toBe('2');
    expect(cellOf('c').className).not.toMatch(/max-lg:hidden|order:var/);
  });

  it('in edit mode a hidden card keeps its cell and its edit buttons (the hide can be undone)', () => {
    render(<WidgetBoard doc={doc([
      { id: 'd', type: 'stat.value', title: 'D', x: 0, y: 0, w: 3, h: 2, settings: { $card: { hideOnDesktop: true, mobileOrder: 1 } } },
      { id: 'm', type: 'stat.value', title: 'M', x: 3, y: 0, w: 3, h: 2, settings: { $card: { hideOnMobile: true } } },
    ])} kinds={kinds} views={views} onChange={() => {}} />);
    expect(cellOf('d').className).toContain('lg:hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(cellOf('d').className).not.toMatch(/(^|\s)lg:hidden/);
    expect(cellOf('m').className).not.toContain('max-lg:hidden');
    expect(cellOf('d').className).toContain('max-lg:[order:var(--wk-mo)]');
    expect(screen.getByRole('button', { name: 'Settings of D' })).toBeInTheDocument();
    for (const id of ['d', 'm']) expect(cellOf(id).querySelector('section')?.className).not.toMatch(/(^|\s)(max-)?lg:hidden/);
  });

  it('stacks cells in y, x order below lg (the DOM order)', () => {
    render(<WidgetBoard doc={doc([
      { id: 'late', type: 'stat.value', title: 'L', x: 0, y: 4, w: 3, h: 2, settings: {} },
      { id: 'right', type: 'stat.value', title: 'R', x: 6, y: 0, w: 3, h: 2, settings: {} },
      { id: 'left', type: 'stat.value', title: 'E', x: 0, y: 0, w: 3, h: 2, settings: {} },
    ])} kinds={kinds} views={views} />);
    expect([...document.querySelectorAll('[data-placement]')].map((e) => e.getAttribute('data-placement'))).toEqual(['left', 'right', 'late']);
  });
});

describe('WidgetBoard texts', () => {
  const board: WidgetKitMessagesInput['board'] = {
    edit: 'Düzenle', done: 'Bitti', addWidget: 'Bileşen ekle', closeDrawer: 'Paneli kapat', settings: 'Pano ayarları', import: 'İçe aktar', export: 'Dışa aktar',
    moveLeft: 'Sola taşı', remove: (t) => `${t} kaldır`, empty: 'Boş pano.', emptyEditable: 'Boş pano. Düzenle\'ye basın.',
    invalidJson: 'Geçerli JSON değil.', newerFormat: (v) => `Daha yeni biçim (${v}).`, searchWidgets: 'Bileşen ara',
  };
  const inKit = (ui: React.ReactElement, kindText?: Parameters<typeof WidgetKitProvider>[0]['value']['kindText']) =>
    render(<WidgetKitProvider value={{ messages: { board }, kindText }}>{ui}</WidgetKitProvider>);

  it('translates the toolbar, the edit buttons and the empty board', () => {
    const { rerender } = inKit(<WidgetBoard doc={doc([{ id: 'a', type: 'stat.value', title: 'A', x: 1, y: 0, w: 3, h: 2, settings: {} }])}
      onChange={() => {}} kinds={kinds} views={views} />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    for (const name of ['Bitti', 'Bileşen ekle', 'Pano ayarları', 'İçe aktar', 'Sola taşı', 'A kaldır']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    rerender(<WidgetKitProvider value={{ messages: { board } }}><WidgetBoard doc={doc([])} kinds={kinds} views={views} /></WidgetKitProvider>);
    expect(screen.getByText('Boş pano.')).toBeInTheDocument();
  });

  it('the board\'s drawers name their close button with board.closeDrawer', () => {
    inKit(<WidgetBoard doc={doc([{ id: 'a', type: 'stat.value', title: 'A', x: 1, y: 0, w: 3, h: 2, settings: {} }])} onChange={() => {}} kinds={kinds} views={views} />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pano ayarları' }));
    expect(screen.getByRole('button', { name: 'Paneli kapat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close drawer' })).toBeNull();
  });

  it('words an import refusal by its code', async () => {
    inKit(<WidgetBoard doc={doc([])} onChange={() => {}} kinds={kinds} views={views} />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    const input = screen.getByLabelText('Import a dashboard file') as HTMLInputElement;
    const file = (text: string) => ({ name: 'x.json', text: async () => text }) as unknown as File;
    fireEvent.change(input, { target: { files: [file('nope')] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Geçerli JSON değil.'));
    fireEvent.change(input, { target: { files: [file(JSON.stringify({ ...doc([]), version: 7 }))] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Daha yeni biçim (7).'));
  });

  it('the picker shows the types through kindText and adds a card titled in that language', () => {
    const onChange = vi.fn();
    inKit(<WidgetBoard doc={doc([])} onChange={onChange} kinds={kinds} views={views} />,
      ({ prop, english }) => (prop === 'label' ? 'Sayı' : prop === 'category' ? 'Değerler' : english));
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bileşen ekle' }));
    expect(screen.getByRole('searchbox', { name: 'Bileşen ara' })).toBeInTheDocument();
    expect(screen.getByText('Değerler')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sayı/ }));
    expect(onChange.mock.calls[0][0].placements[0]).toMatchObject({ type: 'stat.value', title: 'Sayı' });
  });
});

describe('WidgetBoard columns (12 or 24)', () => {
  const card = (id: string, x: number, w: number) => ({ id, type: 'stat.value', title: id.toUpperCase(), x, y: 0, w, h: 2, settings: {} });
  const grid = () => document.querySelector('[data-grid-cols]') as HTMLElement;
  const openBoardSettings = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard settings' }));
  };

  it('lays out on 12 columns by default and on 24 when the board says so', () => {
    const { rerender } = render(<WidgetBoard doc={doc([card('a', 0, 3)])} kinds={kinds} views={views} />);
    expect(grid().dataset.gridCols).toBe('12');
    expect(grid().className).toContain('lg:grid-cols-12');
    const wide = doc([card('a', 18, 6)]);
    rerender(<WidgetBoard doc={{ ...wide, board: { ...wide.board, gridCols: 24 } }} kinds={kinds} views={views} />);
    expect(grid().dataset.gridCols).toBe('24');
    expect(grid().className).toContain('lg:grid-cols-[repeat(24,minmax(0,1fr))]');
    expect(grid().className).not.toContain('lg:grid-cols-12');
    expect(cellOf('a').style.getPropertyValue('--wk-gc')).toBe('19 / span 6');
  });

  it('the right-move button stops at the board\'s own right edge', () => {
    const wide = doc([card('a', 9, 3)]);
    render(<WidgetBoard doc={{ ...wide, board: { ...wide.board, gridCols: 24 } }} onChange={() => {}} kinds={kinds} views={views} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Move right' })).toBeEnabled();
  });

  it('changing the column count in the board settings rescales every card', () => {
    const onChange = vi.fn();
    render(<WidgetBoard doc={doc([card('a', 0, 3), card('b', 3, 9)])} onChange={onChange} kinds={kinds} views={views} />);
    openBoardSettings();
    const select = screen.getByLabelText('Grid columns') as HTMLSelectElement;
    expect(select.value).toBe('12');
    expect([...select.options].map((o) => o.text)).toEqual(['12 columns', '24 columns']);
    fireEvent.change(select, { target: { value: '24' } });
    const next = onChange.mock.calls[0][0] as BoardDocument;
    expect(next.board.gridCols).toBe(24);
    expect(next.placements.map(({ x, w }) => ({ x, w }))).toEqual([{ x: 0, w: 6 }, { x: 6, w: 18 }]);
  });

  it('going back to 12 drops gridCols (the board exports as version 1)', () => {
    const onChange = vi.fn();
    const wide = doc([card('a', 0, 6)]);
    render(<WidgetBoard doc={{ ...wide, board: { ...wide.board, gridCols: 24 } }} onChange={onChange} kinds={kinds} views={views} />);
    openBoardSettings();
    fireEvent.change(screen.getByLabelText('Grid columns'), { target: { value: '12' } });
    const next = onChange.mock.calls[0][0] as BoardDocument;
    expect(next.board).not.toHaveProperty('gridCols');
    expect(next.placements[0]).toMatchObject({ x: 0, w: 3 });
  });

  it('a new card on 24 columns takes its type\'s default width as the same share', () => {
    const onChange = vi.fn();
    const wide = doc([]);
    render(<WidgetBoard doc={{ ...wide, board: { ...wide.board, gridCols: 24 } }} onChange={onChange} kinds={kinds} views={views} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(STAT_VALUE_KIND.label) }));
    expect(onChange.mock.calls[0][0].placements[0].w).toBe(STAT_VALUE_KIND.defaultW * 2);
  });

  it('the column field is translated through messages.board', () => {
    render(
      <WidgetKitProvider value={{ messages: { board: { edit: 'Düzenle', settings: 'Pano ayarları', gridCols: 'Izgara sütunları', gridColsOption: (n) => `${n} sütun` } } }}>
        <WidgetBoard doc={doc([])} onChange={() => {}} kinds={kinds} views={views} />
      </WidgetKitProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pano ayarları' }));
    const select = screen.getByLabelText('Izgara sütunları') as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(['12 sütun', '24 sütun']);
  });
});
