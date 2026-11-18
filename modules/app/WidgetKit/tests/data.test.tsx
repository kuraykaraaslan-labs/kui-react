import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { effective, templateDefaults, validate } from '../settings/engine';
import type { SettingsTemplate, Sparse } from '../settings/types';
import type { SlotData } from '../kind';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { DATA_FEED, DATA_FEED_KIND } from '../templates/data-feed';
import { MAP, MAP_KIND } from '../templates/map';
import { DATA_TABLE_VIEW, DataTableView, expandLinkTemplate, formatDatePattern, ruleMatches, statusColor, tableColumns } from '../views/DataTableView';
import { DATA_FEED_VIEW, DataFeedView, feedItems } from '../views/DataFeedView';
import { MAP_VIEW, MapWidgetView, TILE_PRESETS, buildMarkers, mapLegend } from '../views/MapView';
import { WidgetKitProvider } from '../WidgetKitContext';

const templates: SettingsTemplate[] = [DATA_TABLE, DATA_FEED, MAP];

describe('data templates', () => {
  it.each(templates.map((t) => [t.id, t] as const))('%s validates its own defaults and every field group exists', (_id, t) => {
    // the map moved to version 2 for the label mode (its older on / off switch is renamed); the data tables are at 1
    expect(t.version).toBe(t.id === MAP.id ? 2 : 1);
    expect(t.migrations).toHaveLength(t.id === MAP.id ? 1 : 0);
    if (t.id === MAP.id) expect(t.migrations[0]).toMatchObject({ from: 1, to: 2 });
    expect(validate(t, templateDefaults(t)).issues).toEqual([]);
    const groups = new Set(t.groups.map((g) => g.id));
    for (const [k, f] of Object.entries(t.fields)) expect(groups.has(f.group as string), `${t.id}.${k}`).toBe(true);
  });

  it('kinds carry their slots, templates and card defaults', () => {
    expect(DATA_TABLE_KIND.template).toBe(DATA_TABLE);
    expect(DATA_TABLE_KIND.slots[0].key).toBe('rows');
    expect(DATA_FEED_KIND.slots[0].key).toBe('events');
    expect(MAP_KIND.slots[0].key).toBe('points');
    expect(DATA_TABLE.cardDefaults).toEqual({ padding: 4, buttons: ['fullscreen', 'export'] });
    expect(MAP.cardDefaults).toEqual({ padding: 0 });
    expect([DATA_TABLE, DATA_FEED, MAP].every((t) => t.exportable)).toBe(true);
  });

  it('refuses a non-internal link template', () => {
    expect(validate(MAP, { linkTemplate: 'https://evil.example/{id}' }).issues.map((i) => i.path)).toContain('linkTemplate');
    expect(validate(MAP, { linkTemplate: '//evil.example' }).issues).toHaveLength(1);
    expect(validate(MAP, { linkTemplate: '/admin/devices/{id}' }).issues).toEqual([]);
    expect(validate(DATA_TABLE, { columns: [{ key: 'id', cell: 'link', linkTemplate: 'javascript:alert(1)' }] }).issues.map((i) => i.path))
      .toContain('columns.0.linkTemplate');
  });
});

// ── table ──────────────────────────────────────────────────────────────────────

const table: SlotData = {
  shape: 'table',
  columns: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'temp', label: 'Temperature', type: 'number' },
    { key: 'secret', label: 'Secret', type: 'text' },
    { key: 'path', label: 'Path', type: 'text' },
  ],
  rows: [
    { name: 'Boiler', status: 'warning', temp: 71.5, secret: 'x', path: '/devices/1' },
    { name: 'Pump', status: 'success', temp: 20, secret: 'y', path: 'https://evil.example' },
    { name: 'Fan', status: 'error', temp: 45, secret: 'z', path: '/devices/3' },
  ],
};

const tableSettings = (over: Sparse = {}) => effective(DATA_TABLE, over);
const renderTable = (over: Sparse = {}, extra: Record<string, unknown> = {}) =>
  render(<DataTableView settings={tableSettings(over)} format={{}} data={{ rows: table }} locale="en" {...extra} />);
const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('DataTableView', () => {
  it('shows every declared column by default', () => {
    renderTable();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Status', 'Temperature', 'Secret', 'Path']);
    expect(bodyRows()).toHaveLength(3);
  });

  it('configured columns: order, rename, hidden, undeclared skipped', () => {
    renderTable({ columns: [{ key: 'temp', label: 'Temp' }, { key: 'name' }, { key: 'secret', visible: 'hidden' }, { key: 'gone' }] });
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Temp', 'Name']);
    expect(screen.queryByText('Secret')).toBeNull();
  });

  it('renders a badge cell for a badge column and a bar cell on request', () => {
    renderTable({ columns: [{ key: 'name' }, { key: 'status' }, { key: 'temp', cell: 'bar', ranges: [{ from: 50, color: '#ff0000' }] }] });
    expect(screen.getByText('warning').closest('span')!.style.color).toBe('var(--warning)');
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(3);
    expect((meters[0].firstChild as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    expect((meters[0].firstChild as HTMLElement).style.width).toBe('100%');
  });

  it('sorts by the default sort and lets the viewer re-sort', () => {
    renderTable({ defaultSort: 'temp', defaultSortDir: 'asc' });
    expect(within(bodyRows()[0]).getByText('Pump')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Temperature/ }));
    expect(within(bodyRows()[0]).getByText('Boiler')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Temperature/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('caps rows, pages and searches client-side', () => {
    const { unmount } = renderTable({ maxRows: 2 });
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText('Showing 2 of 3 rows')).toBeTruthy();
    unmount();
    renderTable({ maxRows: 2, paging: 'pages' });
    expect(screen.getByText('1–2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'pum' } });
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText('Pump')).toBeTruthy();
  });

  it('link cells: only internal paths become links; the template is URL-encoded', () => {
    renderTable({ columns: [{ key: 'name' }, { key: 'path', cell: 'link' }] });
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/devices/1', '/devices/3']);
    expect(screen.getByText('https://evil.example').closest('a')).toBeNull();
    expect(expandLinkTemplate('/d/{name}', { name: 'a/../b' })).toBe('/d/a%2F..%2Fb');
    expect(expandLinkTemplate('https://evil/{name}', { name: 'x' })).toBeNull();
  });

  it('a non-internal column link template is not rendered as a link', () => {
    renderTable({ columns: [{ key: 'name', cell: 'link', linkTemplate: 'https://evil.example/{name}' }] });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Boiler')).toBeTruthy();
  });

  it('uses renderLink for internal links', () => {
    const renderLink = vi.fn((href: string, children: React.ReactNode) => <a href={`/t${href}`}>{children}</a>);
    renderTable({ columns: [{ key: 'name', cell: 'link', linkTemplate: '/devices/{name}' }] }, { renderLink });
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/t/devices/Boiler');
  });

  it('look: density, striped, row colour, header colour, desktop-only and phone-only columns', () => {
    renderTable({ density: 'comfortable', striped: true, rowColorColumn: 'status', headerColor: '#123456', columns: [{ key: 'name' }, { key: 'temp', visible: 'desktop' }, { key: 'secret', visible: 'mobile' }] });
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header.style.color).toBe('rgb(18, 52, 86)');
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].className).toMatch(/h-11/);
    expect(screen.getByRole('columnheader', { name: /Temperature/ }).className).toMatch(/hidden md:table-cell/);
    expect(screen.getByRole('columnheader', { name: /Secret/ }).className).toMatch(/md:hidden/);
    expect(bodyRows()[0].style.background).toContain('color-mix');
  });

  it('rows are 36px by default and 28px compact; the header is a subtle band', () => {
    const { unmount } = renderTable();
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].className).toMatch(/\bh-9\b/);
    expect(screen.getByRole('columnheader', { name: /Name/ }).className).toMatch(/text-xs font-medium/);
    unmount();
    renderTable({ density: 'compact', headerBackground: '#eeeeee' });
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].className).toMatch(/\bh-7\b/);
    expect(screen.getByRole('columnheader', { name: /Name/ }).style.background).toBe('rgb(238, 238, 238)');
  });

  it('dates: relative by default, then date, time, datetime or a custom pattern, per table or per column', () => {
    const now = Date.parse('2026-10-15T12:00:00');
    const dated: SlotData = {
      shape: 'table',
      columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'seen', label: 'Seen', type: 'date' }],
      rows: [{ name: 'A', seen: '2026-10-15T11:34:00' }],
    };
    const show = (over: Sparse) => {
      const r = render(<DataTableView settings={tableSettings(over)} format={{}} data={{ rows: dated }} locale="en" now={now} />);
      const text = within(bodyRows()[0]).getAllByRole('cell')[1].textContent;
      r.unmount();
      return text;
    };
    expect(show({})).toBe('26m ago');
    expect(show({ dateFormat: 'date' })).toBe('Oct 15');
    expect(show({ dateFormat: 'time' })).toMatch(/11:34/);
    expect(show({ dateFormat: 'custom', datePattern: "dd.MM.yyyy 'at' HH:mm" })).toBe('15.10.2026 at 11:34');
    expect(show({ dateFormat: 'date', columns: [{ key: 'name' }, { key: 'seen', dateFormat: 'custom', datePattern: 'HH:mm:ss' }] })).toBe('11:34:00');
    expect(formatDatePattern(new Date(2026, 0, 5, 15, 7), 'd/M/yy h:mm a')).toBe('5/1/26 3:07 PM');
  });

  it('badge columns map values to colours, labels and styles; status words colour without a map', () => {
    renderTable({
      columns: [
        { key: 'name', cell: 'badge', badgeStyle: 'dot', valueMap: [{ value: 'boiler', color: '#00ff00', label: 'Hot one' }] },
        { key: 'status', cell: 'badge', badgeStyle: 'solid' },
      ],
    });
    const hot = screen.getByText('Hot one');
    expect((hot.firstChild as HTMLElement).style.background).toBe('rgb(0, 255, 0)');
    expect(screen.getByText('success').closest('span')!.style.background).toBe('var(--success)');
    expect(statusColor('Online')).toBe('var(--success)');
    expect(statusColor('OFFLINE')).toBe('var(--error)');
    expect(statusColor('banana')).toBeUndefined();
  });

  it('a value map alone makes an Auto column a badge; text cells take the map colour when shown as text', () => {
    renderTable({ columns: [{ key: 'name', valueMap: [{ value: 'Pump', color: '#0000ff' }] }, { key: 'secret', cell: 'text', valueMap: [{ value: 'x', color: '#ff0000' }] }] });
    expect(screen.getByText('Pump').closest('span')!.style.color).toBe('rgb(0, 0, 255)');
    expect(screen.getByText('x').closest('td')!.style.color).toBe('rgb(255, 0, 0)');
  });

  it('number, progress and icon cells', () => {
    render(
      <WidgetKitProvider value={{ renderIcon: (name, p) => <i data-icon={name} style={p?.style} /> }}>
        <DataTableView
          settings={tableSettings({ columns: [
            { key: 'name', cell: 'icon', valueMap: [{ value: 'Boiler', icon: 'fas fa-fire', color: '#ff0000' }], icon: 'fas fa-circle' },
            { key: 'temp', cell: 'progress', barMax: 80, ranges: [{ from: 50, color: '#ff0000' }] },
            { key: 'path', cell: 'number' },
          ] })}
          format={{}} data={{ rows: table }} locale="en"
        />
      </WidgetKitProvider>,
    );
    expect(document.querySelector('[data-icon="fas fa-fire"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-icon="fas fa-circle"]')).toHaveLength(2);
    const meters = screen.getAllByRole('meter');
    expect(meters[0]).toHaveAttribute('aria-valuemax', '80');
    expect((meters[0].firstChild as HTMLElement).style.width).toBe('89.375%');
    expect(screen.getByText('89 %')).toBeTruthy();
    expect(screen.getAllByRole('columnheader')[2].className).toMatch(/text-right/);
  });

  it('row rules colour the background, the text or a left bar; row numbers and empty text', () => {
    renderTable({
      showRowNumbers: true,
      rowRules: [
        { column: 'temp', op: 'gt', value: '60', color: '#ff0000', target: 'background' },
        { column: 'name', op: 'contains', value: 'um', color: '#0000ff', target: 'text' },
        { column: 'status', op: 'eq', value: 'ERROR', color: '#00ff00', target: 'bar' },
      ],
    });
    const [boiler, pump, fan] = bodyRows();
    expect(boiler.style.background).toContain('rgb(255, 0, 0)');
    expect(pump.style.color).toBe('rgb(0, 0, 255)');
    expect(within(fan).getAllByRole('cell')[0].style.boxShadow).toContain('#00ff00');
    expect(within(fan).getAllByRole('cell')[0].textContent).toBe('3');
    expect(ruleMatches({ column: 'a', op: 'empty' }, { a: '' })).toBe(true);
    expect(ruleMatches({ column: 'a', op: 'lte', value: '5' }, { a: 5 })).toBe(true);
    expect(ruleMatches({ column: 'a', op: 'ne', value: 'x' }, { a: 'X' })).toBe(false);
  });

  it('empty text replaces "No matching rows"; scroll mode shows every row; hover can be turned off', () => {
    const { unmount } = renderTable({ emptyText: 'Nothing here' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing here')).toBeTruthy();
    unmount();
    renderTable({ maxRows: 1, paging: 'scroll', rowHover: false, gridLines: 'none' });
    expect(bodyRows()).toHaveLength(3);
    expect(bodyRows()[0].className).not.toMatch(/hover:/);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].className).not.toMatch(/border-b/);
  });

  it('server paging: echoes page/sort and asks the host for the next page', () => {
    const set = vi.fn();
    const paged = { ...table, total: 30, paging: { page: 1, pageSize: 3, sortable: ['temp'], searchable: true } } as SlotData;
    render(<DataTableView settings={tableSettings()} format={{}} data={{ rows: paged }} paging={{ set }} />);
    expect(screen.getByText(/Page 1 of 10/)).toBeTruthy();
    expect(screen.getByText('1–3 of 30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(set).toHaveBeenCalledWith({ page: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Temperature/ }));
    expect(set).toHaveBeenCalledWith({ sort: { key: 'temp', dir: 'asc' } });
    expect(screen.queryByRole('button', { name: /Name/ })).toBeNull();
  });

  describe('server paging: the saved default sort (next-boilerplate decision 2026-10-17 #5b)', () => {
    type Echo = { page: number; pageSize: number; sortable: string[]; searchable: boolean; sort?: { key: string; dir: 'asc' | 'desc' }; q?: string };
    const echoOf = (over: Partial<Echo> = {}) => ({ ...table, total: 30, paging: { page: 1, pageSize: 3, sortable: ['temp'], searchable: true, ...over } }) as SlotData;
    const view = (settings: Record<string, unknown>, rows: SlotData, paging: { set: (patch: object) => void; key?: string }) =>
      <DataTableView settings={tableSettings(settings)} format={{}} data={{ rows }} paging={paging} />;

    it('asks the server for it once, only for a key the query can sort by', () => {
      const set = vi.fn();
      const { rerender } = render(view({ defaultSort: 'temp', defaultSortDir: 'asc' }, echoOf(), { set }));
      expect(set).toHaveBeenCalledWith({ sort: { key: 'temp', dir: 'asc' } });
      rerender(view({ defaultSort: 'temp', defaultSortDir: 'asc' }, echoOf({ sort: { key: 'temp', dir: 'asc' }, page: 2 }), { set }));
      expect(set).toHaveBeenCalledTimes(1);
      cleanup();
      const other = vi.fn();
      render(view({ defaultSort: 'name' }, echoOf(), { set: other }));
      expect(other).not.toHaveBeenCalled();
    });

    it("keeps a sort, search or page the viewer already chose for this query", () => {
      for (const over of [{ sort: { key: 'temp', dir: 'desc' as const } }, { q: 'boil' }, { page: 3 }]) {
        const set = vi.fn();
        render(view({ defaultSort: 'temp', defaultSortDir: 'asc' }, echoOf(over), { set }));
        expect(set).not.toHaveBeenCalled();
        cleanup();
      }
    });

    it('asks again for another query, follows a changed setting, and removes its own sort when the setting goes', () => {
      const set = vi.fn();
      const { rerender } = render(view({ defaultSort: 'temp' }, echoOf(), { set, key: 'q1' }));
      expect(set).toHaveBeenLastCalledWith({ sort: { key: 'temp', dir: 'desc' } });
      rerender(view({ defaultSort: 'temp', defaultSortDir: 'asc' }, echoOf({ sort: { key: 'temp', dir: 'desc' } }), { set, key: 'q1' }));
      expect(set).toHaveBeenLastCalledWith({ sort: { key: 'temp', dir: 'asc' } });
      rerender(view({}, echoOf({ sort: { key: 'temp', dir: 'asc' } }), { set, key: 'q1' }));
      expect(set).toHaveBeenLastCalledWith({ sort: undefined });
      set.mockClear();
      rerender(view({ defaultSort: 'temp' }, echoOf(), { set, key: 'q2' }));
      expect(set).toHaveBeenCalledWith({ sort: { key: 'temp', dir: 'desc' } });
    });
  });

  it('isEmpty and toCsv follow the effective columns with raw values', () => {
    const s = tableSettings({ columns: [{ key: 'name', label: 'Device' }, { key: 'temp' }, { key: 'secret', visible: 'hidden' }] });
    expect(DATA_TABLE_VIEW.isEmpty!({ rows: table }, s)).toBe(false);
    expect(DATA_TABLE_VIEW.isEmpty!({ rows: { shape: 'table', columns: table.columns, rows: [] } }, s)).toBe(true);
    expect(DATA_TABLE_VIEW.isEmpty!({}, s)).toBe(true);
    expect(DATA_TABLE_VIEW.toCsv!({ rows: table }, s, {})).toEqual([
      ['Device', 'Temperature'], ['Boiler', '71.5'], ['Pump', '20'], ['Fan', '45'],
    ]);
    expect(tableColumns(table, tableSettings()).length).toBe(5);
  });
});

// ── feed ───────────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-10-15T12:00:00Z');
const events: SlotData = {
  shape: 'table',
  columns: [{ key: 'time', label: 'When', type: 'date' }, { key: 'title', label: 'What', type: 'text' }, { key: 'tone', label: 'Tone', type: 'text' }],
  rows: [
    { time: '2026-10-15T11:00:00Z', title: 'Middle', tone: 'warning' },
    { time: '2026-10-15T11:55:00Z', title: 'Newest', tone: 'error' },
    { time: 'garbage', title: 'Unknown time' },
    { time: '2026-10-14T09:00:00Z', title: 'Oldest' },
    { time: '2026-10-15T11:58:00Z', title: '' },
  ],
};
const feedSettings = (over: Sparse = {}) => effective(DATA_FEED, over);
const titles = () => [...document.querySelectorAll('[data-feed-item]')].map((li) => li.querySelector('[data-part="title"]')?.textContent);

describe('DataFeedView', () => {
  it('newest first by default; untitled rows skipped; unknown time last', () => {
    render(<DataFeedView settings={feedSettings()} format={{}} data={{ events }} now={NOW} locale="en" />);
    expect(titles()).toEqual(['Newest', 'Middle', 'Oldest', 'Unknown time']);
    expect(screen.getByText('5 minutes ago')).toBeTruthy();
  });

  it('order oldest, max items, colour column, time display and layout change the output', () => {
    render(<DataFeedView settings={feedSettings({ order: 'oldest', maxItems: 2, colorColumn: 'tone', layout: 'compact', timeDisplay: 'date' })} format={{}} data={{ events }} now={NOW} locale="en" />);
    expect(titles()).toEqual(['Oldest', 'Middle']);
    const middle = [...document.querySelectorAll('[data-feed-item]')][1];
    expect((middle.querySelector('[data-part="marker"] span') as HTMLElement).style.background).toBe('var(--warning)');
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  it('groups by day', () => {
    render(<DataFeedView settings={feedSettings({ groupByDay: true })} format={{}} data={{ events }} now={NOW} locale="en" />);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Today', 'Yesterday', 'Time unknown']);
  });

  it('severity: status words and the severity map colour items; indicator dot, icon, bar or none', () => {
    const sev: SlotData = { shape: 'table', rows: [
      { time: '2026-10-15T11:00:00Z', title: 'A', level: 'Critical' },
      { time: '2026-10-15T10:00:00Z', title: 'B', level: 'minor' },
      { time: '2026-10-15T09:00:00Z', title: 'C', level: 'custom' },
    ] };
    const items = feedItems(sev, feedSettings({ colorColumn: 'level', valueColors: [{ value: 'CUSTOM', color: '#123456', icon: 'fas fa-star' }] }));
    expect(items.map((i) => i.color)).toEqual(['var(--error)', 'var(--warning)', '#123456']);
    expect(items[2].icon).toBe('fas fa-star');
    const icons = render(
      <WidgetKitProvider value={{ renderIcon: (name) => <i data-icon={name} /> }}>
        <DataFeedView settings={feedSettings({ colorColumn: 'level', indicator: 'icon', layout: 'list' })} format={{}} data={{ events: sev }} now={NOW} locale="en" />
      </WidgetKitProvider>,
    );
    expect(document.querySelector('[data-icon="fas fa-circle-exclamation"]')).toBeTruthy();
    expect(document.querySelector('[data-icon="fas fa-triangle-exclamation"]')).toBeTruthy();
    icons.unmount();
    const bar = render(<DataFeedView settings={feedSettings({ colorColumn: 'level', indicator: 'bar', layout: 'list' })} format={{}} data={{ events: sev }} now={NOW} locale="en" />);
    expect((document.querySelector('[data-feed-item]') as HTMLElement).style.boxShadow).toContain('var(--error)');
    expect(document.querySelector('[data-part="marker"]')).toBeNull();
    bar.unmount();
    render(<DataFeedView settings={feedSettings({ indicator: 'none' })} format={{}} data={{ events }} now={NOW} locale="en" />);
    expect(document.querySelector('[data-part="marker"]')).toBeNull();
  });

  it('layouts, time position and pattern, dividers', () => {
    const { unmount } = render(<DataFeedView settings={feedSettings({ layout: 'cards' })} format={{}} data={{ events }} now={NOW} locale="en" />);
    expect((document.querySelector('[data-feed-item]') as HTMLElement).className).toMatch(/rounded-lg border/);
    unmount();
    const below = render(<DataFeedView settings={feedSettings({ layout: 'list', timePosition: 'below', timeDisplay: 'custom', timePattern: "'at' HH:mm", divider: false })} format={{}} data={{ events }} now={NOW} locale="en" />);
    const first = document.querySelector('[data-feed-item]') as HTMLElement;
    expect(first.className).not.toMatch(/border-b/);
    expect(first.querySelector('time')!.textContent).toMatch(/^at \d\d:55$/);
    // Below the text: the time follows the title instead of sharing its line.
    expect(first.querySelector('time')!.closest('.justify-between')).toBeNull();
    below.unmount();
  });

  it('next-boilerplate phase 53.2.9 (re-run 4 #27): a title or description prints its column\'s value words, never the raw code', () => {
    // the open-alarms card of a Turkish workspace: the alarm source names its statuses (`valueMap`)
    const alarms: SlotData = {
      shape: 'table',
      columns: [
        { key: 'openedAt', label: 'Açıldı', type: 'date' }, { key: 'title', label: 'Alarm', type: 'text' },
        { key: 'status', label: 'Durum', type: 'badge', kind: 'enum', valueMap: { OPEN: { label: 'Açık', color: 'var(--error)' }, ACKNOWLEDGED: { label: 'Onaylandı', color: 'var(--warning)' } } },
      ],
      rows: [
        { openedAt: '2026-10-15T11:50:00Z', title: 'Tahıl ısınması', status: 'OPEN' },
        { openedAt: '2026-10-15T11:40:00Z', title: 'Fan arızası', status: 'ACKNOWLEDGED' },
        { openedAt: '2026-10-15T11:30:00Z', title: 'Eski alarm', status: 'RESOLVED' },
      ],
    };
    const s = feedSettings({ timeColumn: 'openedAt', descriptionColumn: 'status' });
    expect(feedItems(alarms, s).map((i) => i.description)).toEqual(['Açık', 'Onaylandı', 'RESOLVED']);
    expect(feedItems(alarms, feedSettings({ timeColumn: 'openedAt', titleColumn: 'status' })).map((i) => i.title)).toEqual(['Açık', 'Onaylandı', 'RESOLVED']);
    render(<DataFeedView settings={s} format={{}} data={{ events: alarms }} now={NOW} locale="tr" />);
    expect(screen.getByText('Açık')).toBeTruthy();
    expect(screen.queryByText('OPEN')).toBeNull();
  });

  it('isEmpty and toCsv', () => {
    const s = feedSettings();
    expect(DATA_FEED_VIEW.isEmpty!({ events }, s)).toBe(false);
    expect(DATA_FEED_VIEW.isEmpty!({ events: { shape: 'table', rows: [{ title: '' }] } }, s)).toBe(true);
    const csv = DATA_FEED_VIEW.toCsv!({ events }, s, {});
    // Default columns the result does not declare (description, color, icon) stay out of the file.
    expect(csv[0]).toEqual(['When', 'What']);
    expect(csv[1]).toEqual(['2026-10-15T11:55:00Z', 'Newest']);
    expect(csv).toHaveLength(5);
    expect(feedItems(events, s).length).toBe(4);
  });
});

// ── map ────────────────────────────────────────────────────────────────────────

const points: SlotData = {
  shape: 'table',
  columns: [
    { key: 'lat', label: 'Lat', type: 'number' }, { key: 'lng', label: 'Lng', type: 'number' },
    { key: 'name', label: 'Name', type: 'text' }, { key: 'id', label: 'Id', type: 'text' },
    { key: 'status', label: 'Status', type: 'badge' }, { key: 'load', label: 'Load', type: 'number' },
  ],
  rows: [
    { lat: 41, lng: 29, name: 'Istanbul', id: 'ist', status: 'success', load: 10 },
    { lat: 39.9, lng: 32.8, name: 'Ankara', id: 'ank', status: 'error', load: 90 },
    { lat: 'x', lng: 1, name: 'Bad', id: 'bad' },
    { lat: 95, lng: 1, name: 'Out of range', id: 'oor' },
  ],
};
const mapSettings = (over: Sparse = {}) => effective(MAP, over);

describe('map', () => {
  it('builds markers from valid rows only, with style, size and tooltip fields', () => {
    const { markers } = buildMarkers(points, mapSettings({ labelColumn: 'name', idColumn: 'id', tooltipColumns: ['status', 'load'], markerStyle: 'dot', markerSize: 30 }));
    expect(markers.map((m) => m.id)).toEqual(['ist', 'ank']);
    // Coloured by the status column by default.
    expect(markers[0]).toMatchObject({ shape: 'dot', size: 30, color: 'var(--success)', label: 'Istanbul' });
    expect(markers[0].tooltip).toMatchObject({ title: 'Istanbul', color: 'var(--success)' });
    expect(markers[0].tooltip?.fields).toEqual([{ label: 'Status', value: 'success' }, { label: 'Load', value: '10' }]);
    // Without the status among the fields, it names itself under the title.
    expect(buildMarkers(points, mapSettings({ labelColumn: 'name' })).markers[1].tooltip?.description).toBe('error');
    expect(buildMarkers(points, mapSettings({ colorBy: 'fixed', markerStyle: 'circle' })).markers[0]).toMatchObject({ color: 'var(--primary)', shape: 'circle' });
  });

  it('colours markers from a column or from ranges on a value', () => {
    expect(buildMarkers(points, mapSettings({ colorBy: 'column', colorColumn: 'status' })).markers.map((m) => m.color))
      .toEqual(['var(--success)', 'var(--error)']);
    expect(buildMarkers(points, mapSettings({ valueColors: [{ value: 'SUCCESS', color: '#00ff00', label: 'Fine' }] })).markers.map((m) => m.color))
      .toEqual(['#00ff00', 'var(--error)']);
    expect(buildMarkers(points, mapSettings({ colorBy: 'ranges', valueColumn: 'load', ranges: [{ from: 50, color: '#ff0000' }] })).markers.map((m) => m.color))
      .toEqual(['var(--primary)', '#ff0000']);
  });

  it('a link template becomes a tooltip link only when it is internal', () => {
    const ok = buildMarkers(points, mapSettings({ idColumn: 'id', linkTemplate: '/devices/{id}' })).markers;
    expect(ok[0].tooltip?.href).toBe('/devices/ist');
    const bad = buildMarkers(points, mapSettings({ idColumn: 'id', linkTemplate: 'https://evil.example/{id}' })).markers;
    expect(bad[0].tooltip?.href).toBeUndefined();
  });

  it('renders a labelled map region with a colour legend', () => {
    const { unmount } = render(<MapWidgetView settings={mapSettings({ legendPosition: 'topright' })} format={{}} data={{ points }} ariaLabel="Sites" />);
    expect(screen.getByRole('region', { name: 'Sites' })).toBeTruthy();
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['success1', 'error1']);
    expect(legend.className).toMatch(/top-2 right-2/);
    unmount();
    render(<MapWidgetView settings={mapSettings({ legend: false })} format={{}} data={{ points }} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
  });

  it('legend: configured status colours first, ranges by their labels, nothing for one colour', () => {
    expect(mapLegend(points, mapSettings({ valueColors: [{ value: 'idle', color: '#999999', label: 'Idle' }, { value: 'error', color: '#ff0000', label: 'Down' }] })))
      .toEqual([{ label: 'Idle', color: '#999999', count: 0 }, { label: 'Down', color: '#ff0000', count: 1 }, { label: 'success', color: 'var(--success)', count: 1 }]);
    expect(mapLegend(points, mapSettings({ colorBy: 'ranges', valueColumn: 'load', ranges: [{ to: 50, color: '#00ff00' }, { from: 50, color: '#ff0000', label: 'Busy' }] })))
      .toEqual([{ label: '< 50', color: '#00ff00' }, { label: 'Busy', color: '#ff0000' }]);
    expect(mapLegend(points, mapSettings({ colorBy: 'fixed' }))).toEqual([]);
  });

  it('every tile style is keyless and follows the theme by default', () => {
    expect(TILE_PRESETS.auto).toHaveProperty('dark');
    for (const t of Object.values(TILE_PRESETS)) {
      for (const layer of 'url' in t ? [t] : [t.light, t.dark]) expect(layer.url).not.toMatch(/cartocdn/);
    }
  });

  it('isEmpty and toCsv', () => {
    const s = mapSettings({ labelColumn: 'name', tooltipColumns: ['load'] });
    expect(MAP_VIEW.isEmpty!({ points }, s)).toBe(false);
    expect(MAP_VIEW.isEmpty!({ points: { shape: 'table', rows: [{ lat: 'x', lng: 'y' }] } }, s)).toBe(true);
    expect(MAP_VIEW.toCsv!({ points }, s, {})).toEqual([['Lat', 'Lng', 'Name', 'Status', 'Load'], ['41', '29', 'Istanbul', 'success', '10'], ['39.9', '32.8', 'Ankara', 'error', '90']]);
  });
});
