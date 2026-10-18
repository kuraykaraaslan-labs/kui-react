import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetCard } from '../WidgetCard';
import { WidgetSettingsEditor } from '../WidgetSettingsEditor';
import { WidgetKitProvider, useKitMessages } from '../WidgetKitContext';
import type { WidgetKitHost } from '../WidgetKitContext';
import { localizeKind, localizeTemplate } from '../localize';
import type { TemplateTextFn, WidgetKitMessagesInput } from '../messages';
import { effective } from '../settings/engine';
import type { SettingsTemplate, Sparse } from '../settings/types';
import type { SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import { CONTROL_SWITCH } from '../templates/control-switch';
import { CONTROL_SLIDER } from '../templates/control-slider';
import { CONTROL_SETPOINT } from '../templates/control-setpoint';
import { CONTROL_BUTTON } from '../templates/control-button';
import { DATA_TABLE } from '../templates/data-table';
import { DATA_FEED } from '../templates/data-feed';
import { STATE } from '../templates/state';
import { STAT_ATTRIBUTES } from '../templates/stat-attributes';
import { PROGRESS } from '../templates/progress';
import { CONTENT_LINKS } from '../templates/content-links';
import { CONTENT_EMBED } from '../templates/content-embed';
import { CHART_PIE } from '../templates/chart-pie';
import { MAP } from '../templates/map';
import { STAT_VALUE_KIND } from '../templates/stat-value';
import { CONTROL_SWITCH_VIEW } from '../views/ControlSwitchView';
import { CONTROL_SLIDER_VIEW } from '../views/ControlSliderView';
import { CONTROL_SETPOINT_VIEW } from '../views/ControlSetpointView';
import { CONTROL_BUTTON_VIEW } from '../views/ControlButtonView';
import { DataTableView } from '../views/DataTableView';
import { DataFeedView } from '../views/DataFeedView';
import { STATE_VIEW } from '../views/StateView';
import { STAT_ATTRIBUTES_VIEW } from '../views/StatAttributesView';
import { PROGRESS_VIEW } from '../views/ProgressView';
import { CONTENT_LINKS_VIEW } from '../views/ContentLinksView';
import { CONTENT_EMBED_VIEW } from '../views/ContentEmbedView';
import { CHART_PIE_VIEW } from '../views/PieChartView';
import { MapWidgetView, buildMarkers } from '../views/MapView';
import { rowsToScatterSeries } from '../views/chart-data';
import { SchemaForm } from '../../SchemaForm/SchemaForm';

const TR: WidgetKitMessagesInput = {
  card: { refresh: 'Yenile', download: 'Veriyi indir (CSV)', fullscreen: 'Tam ekran', noData: 'Veri yok', unconfigured: 'Yapılandırılmadı.', error: 'Yüklenemedi.', retry: 'Tekrar dene', updated: (w) => `Güncellendi: ${w}`, about: (t) => `${t} hakkında`, oldData: 'Eski veri', loading: 'Yükleniyor' },
  editor: { tabDisplay: 'Görünüm', tabCard: 'Kart', tabData: 'Veri', title: 'Başlık', advancedOn: 'Gelişmiş: açık', advancedOff: 'Gelişmiş: kapalı', tabsLabel: 'Bileşen ayarları', newerVersion: 'Daha yeni bir sürüm kaydetti.' },
  form: { reset: 'Sıfırla', addItem: 'Öğe ekle', item: (n) => `Öğe ${n}`, searchLabel: 'Ayarlarda ara' },
  controls: { notConnected: 'Bağlı değil.', on: 'Açık', off: 'Kapalı', unknownLabel: 'Bilinmiyor', now: 'Şimdi', value: 'Değer', reported: (v) => `Bildirilen: ${v}`, run: 'Çalıştır', confirm: 'Onayla', cancel: 'Vazgeç', typeToConfirm: 'Onaylamak için "{text}" yazın', failed: 'Değişiklik başarısız.' },
  table: { search: 'Ara', columns: 'Sütunlar' },
  feed: { unknownDay: 'Zaman bilinmiyor' },
  map: { loading: 'Harita yükleniyor…', map: 'Harita', open: 'Aç', legend: 'Açıklama' },
  charts: { other: 'Diğer', series: 'Seri', total: 'Toplam', pieChart: 'Pasta grafik' },
  content: { linksEmpty: 'Bağlantı ekleyin.', embedEmpty: 'Adres girin.', embedRefused: (h) => `${h} reddedildi` },
  stat: { unknown: 'Bilinmiyor', of: (t) => `/ ${t}`, progress: (v, t) => `${v} / ${t}` },
  common: { yes: 'Evet', no: 'Hayır' },
};

const host = (over: Partial<WidgetKitHost> = {}): WidgetKitHost => ({ messages: TR, ...over });
const inKit = (node: ReactNode, value: WidgetKitHost = host()) => render(<WidgetKitProvider value={value}>{node}</WidgetKitProvider>);
const props = (template: SettingsTemplate, over: Partial<WidgetViewProps> & { settings?: Sparse } = {}): WidgetViewProps =>
  ({ format: {}, data: {}, locale: 'en', ...over, settings: effective(template, over.settings) });

describe('useKitMessages', () => {
  it('is English without a provider and the host texts over it with one', () => {
    const Probe = () => {
      const m = useKitMessages().card;
      return <p data-testid="probe">{`${m.refresh}/${m.retry}`}</p>;
    };
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('Refresh/Retry');
    unmount();
    inKit(<Probe />, host({ messages: { card: { refresh: 'Yenile' } } }));
    expect(screen.getByTestId('probe')).toHaveTextContent('Yenile/Retry');
  });
});

describe('WidgetCard texts', () => {
  it('translates the buttons, states and footer', () => {
    const { rerender } = inKit(
      <WidgetCard title="Rooms" card={{ buttons: ['refresh', 'export', 'fullscreen'], showUpdated: 'time', titleTooltip: 'x' }} updatedAt={Date.UTC(2026, 0, 1, 10, 0)}
        onRefresh={() => {}} onExport={() => {}} onFullscreen={() => {}} stale>body</WidgetCard>,
    );
    for (const name of ['Yenile', 'Veriyi indir (CSV)', 'Tam ekran', 'Rooms hakkında']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByText('Eski veri')).toBeInTheDocument();
    expect(screen.getByText(/^Güncellendi: /)).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="empty" /></WidgetKitProvider>);
    expect(screen.getByText('Veri yok')).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="unconfigured" /></WidgetKitProvider>);
    expect(screen.getByText('Yapılandırılmadı.')).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="error" onRetry={() => {}} /></WidgetKitProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Yüklenemedi.');
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="loading" /></WidgetKitProvider>);
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('explicit props and the card\'s own "No data" text still win', () => {
    const { rerender } = inKit(<WidgetCard card={{ noDataText: 'Nothing today' }} state="empty" />);
    expect(screen.getByText('Nothing today')).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="error" errorText="Source offline" /></WidgetKitProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Source offline');
    rerender(<WidgetKitProvider value={host()}><WidgetCard card={{}} state="unconfigured" unconfiguredText="Bind it" /></WidgetKitProvider>);
    expect(screen.getByText('Bind it')).toBeInTheDocument();
  });
});

// ── the settings editor ─────────────────────────────────────────────────────────────

const DEMO: SettingsTemplate = {
  id: 'tenant:demo', version: 1, namespace: '', label: 'Demo', migrations: [],
  groups: [
    { id: 'main', label: 'Main', tab: 'Display', since: 1 },
    { id: 'more', label: 'More', tab: 'Display', since: 1 },
  ],
  fields: {
    heading: { label: 'Heading', type: 'text', since: 1, group: 'main', placeholder: 'Type a heading', description: 'Shown on top' },
    mode: { label: 'Mode', type: 'select', since: 1, group: 'main', required: true, value: 'a', options: ['a', { value: 'b', label: 'Bee' }] },
    items: { label: 'Items', type: 'repeater', since: 1, group: 'more', fields: { name: { label: 'Name', type: 'text' } } },
  },
};
const caps = { hasData: false, exportable: false, formatsNumbers: false };
const TR_TEXT: TemplateTextFn = ({ templateId, path, prop, value, english }) => {
  if (templateId !== 'tenant:demo') return undefined;
  const table: Record<string, string> = {
    'heading.label': 'Başlık metni', 'heading.placeholder': 'Bir başlık yazın', 'heading.description': 'Üstte gösterilir',
    'mode.label': 'Kip', 'mode.option.a': 'Ah', 'mode.option.b': 'Arı', 'main.group': 'Ana', 'more.group': 'Diğer',
    'items.label': 'Öğeler', 'items.name.label': 'Ad', '.label': 'Demo (tr)',
  };
  return table[[path, prop, value].filter((x) => x !== undefined).join('.')] ?? (english === 'never' ? '' : undefined);
};

describe('WidgetSettingsEditor texts', () => {
  beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('translates the tabs, the title field, the mode toggle and the newer-version notice', () => {
    inKit(<WidgetSettingsEditor templates={[DEMO]} settings={{ $v: { 'tenant:demo': 9 } }} onChange={() => {}} caps={caps} title="x" onTitleChange={() => {}} />);
    expect(screen.getByLabelText('Başlık')).toHaveValue('x');
    expect(screen.getByRole('tab', { name: 'Görünüm' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Bileşen ayarları' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gelişmiş: kapalı' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Daha yeni bir sürüm kaydetti.');
  });

  it('templateText localizes labels, options by value, groups, descriptions, placeholders and repeater fields', () => {
    inKit(<WidgetSettingsEditor templates={[DEMO]} settings={{ items: [{ name: '' }] }} onChange={() => {}} caps={caps} />, host({ templateText: TR_TEXT }));
    expect(screen.getByRole('textbox', { name: 'Başlık metni' })).toHaveAttribute('placeholder', 'Bir başlık yazın');
    expect(screen.getByText('Üstte gösterilir')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ah' })).toHaveValue('a');
    expect(screen.getByRole('option', { name: 'Arı' })).toHaveValue('b');
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Diğer')).toBeInTheDocument();
    expect(screen.getByText('Ad')).toBeInTheDocument();
    expect(screen.getByText('Öğe 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Öğe ekle' })).toBeInTheDocument();
  });

  it('writes exactly what it writes without the hook', () => {
    const edit = (value: WidgetKitHost) => {
      const onChange = vi.fn();
      const { unmount } = inKit(<WidgetSettingsEditor templates={[DEMO]} settings={{}} onChange={onChange} caps={caps} />, value);
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'b' } });
      act(() => { vi.runAllTimers(); });
      unmount();
      return JSON.stringify(onChange.mock.calls);
    };
    expect(edit(host({ templateText: TR_TEXT }))).toBe(edit({}));
  });

  it('a new templateText function re-localizes (a language switch)', () => {
    const view = (fn: TemplateTextFn) => <WidgetKitProvider value={{ templateText: fn }}>
      <WidgetSettingsEditor templates={[DEMO]} settings={{}} onChange={() => {}} caps={caps} />
    </WidgetKitProvider>;
    const { rerender } = render(view(TR_TEXT));
    expect(screen.getByText('Kip')).toBeInTheDocument();
    rerender(view(({ path, prop }) => (path === 'mode' && prop === 'label' ? 'Modus' : undefined)));
    expect(screen.getByText('Modus')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
  });
});

describe('localizeTemplate and localizeKind', () => {
  it('keeps keys, values and versions; memoizes per function and template', () => {
    const out = localizeTemplate(DEMO, TR_TEXT);
    expect(out).not.toBe(DEMO);
    expect(Object.keys(out.fields)).toEqual(Object.keys(DEMO.fields));
    expect(out.fields.mode.options).toEqual([{ value: 'a', label: 'Ah' }, { value: 'b', label: 'Arı' }]);
    expect(out.fields.mode.value).toBe('a');
    expect(out.label).toBe('Demo (tr)');
    expect([out.id, out.version, out.namespace, out.migrations]).toEqual([DEMO.id, DEMO.version, DEMO.namespace, DEMO.migrations]);
    expect(localizeTemplate(DEMO, TR_TEXT)).toBe(out);
    expect(localizeTemplate(DEMO, () => undefined)).not.toBe(out);
    expect(DEMO.fields.heading.label).toBe('Heading');
  });

  it('asks by template id; an empty answer keeps the English', () => {
    const fn = vi.fn<TemplateTextFn>(() => '');
    const out = localizeTemplate(DEMO, fn);
    expect(out.fields.heading.label).toBe('Heading');
    expect(fn).toHaveBeenCalledWith({ templateId: 'tenant:demo', path: 'heading', prop: 'label', english: 'Heading' });
    expect(fn).toHaveBeenCalledWith({ templateId: 'tenant:demo', path: 'mode', prop: 'option', value: 'b', english: 'Bee' });
    expect(fn).toHaveBeenCalledWith({ templateId: 'tenant:demo', path: 'items.name', prop: 'label', english: 'Name' });
    expect(fn).toHaveBeenCalledWith({ templateId: 'tenant:demo', path: 'main', prop: 'group', english: 'Main' });
  });

  it('two groups translated alike stay apart (the group label is the grouping key)', () => {
    const out = localizeTemplate(DEMO, ({ prop }) => (prop === 'group' ? 'Genel' : undefined));
    expect(out.groups.map((g) => g.label)).toEqual(['Genel', 'More']);
  });

  it('localizes a kind\'s label, description, category and slots by type', () => {
    const out = localizeKind(STAT_VALUE_KIND, ({ type, prop, key }) => `${type}:${prop}${key ? `:${key}` : ''}`);
    expect([out.label, out.description, out.category]).toEqual(['stat.value:label', 'stat.value:description', 'stat.value:category']);
    expect(out.slots.map((s) => s.label)).toEqual(STAT_VALUE_KIND.slots.map((s) => `stat.value:slot:${s.key}`));
    expect(out.template).toBe(STAT_VALUE_KIND.template);
  });
});

describe('SchemaForm texts', () => {
  it('takes a messages prop; emptyMessage still wins', () => {
    const schema = { size: { label: 'Size', type: 'number' as const } };
    const { rerender } = render(<SchemaForm schema={schema} values={{ size: 2 }} defaults={{ size: 1 }} onChange={() => {}} messages={{ reset: 'Sıfırla', resetLabel: (l) => `${l} sıfırla` }} />);
    expect(screen.getByRole('button', { name: 'Size sıfırla' })).toHaveTextContent('Sıfırla');
    rerender(<SchemaForm schema={{}} values={{}} onChange={() => {}} messages={{ empty: 'Ayar yok.' }} />);
    expect(screen.getByText('Ayar yok.')).toBeInTheDocument();
    rerender(<SchemaForm schema={{}} values={{}} onChange={() => {}} emptyMessage="Nothing here" messages={{ empty: 'Ayar yok.' }} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('theme swatches are labelled by value; the stored value is the token', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={{ c: { label: 'Colour', type: 'color' } }} values={{}} onChange={onChange} debounceMs={0} messages={{ colorPrimary: 'Birincil' }} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Birincil' }));
    expect(onChange).toHaveBeenLastCalledWith({ c: 'var(--primary)' });
    expect(screen.getByRole('radio', { name: 'Secondary' })).toBeInTheDocument();
  });
});

// ── views ─────────────────────────────────────────────────────────────────────

describe('control texts', () => {
  it('a switch shows the host on/off/unknown labels; its own labels win', () => {
    const view = (settings: Sparse, value: boolean | null) => <WidgetKitProvider value={host()}>
      <CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { settings, data: { value: { shape: 'scalar', value } }, onControl: vi.fn() })} />
    </WidgetKitProvider>;
    const { rerender } = render(view({}, true));
    expect(screen.getByText('Açık')).toBeInTheDocument();
    rerender(view({}, false));
    expect(screen.getByText('Kapalı')).toBeInTheDocument();
    rerender(view({}, null));
    expect(screen.getAllByText('Bilinmiyor').length).toBeGreaterThan(0);
    rerender(view({ onLabel: 'Running' }, true));
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('the not-connected reason, the slider name and the setpoint caption come from the host', () => {
    inKit(<>
      <CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON)} />
      <CONTROL_SLIDER_VIEW.View {...props(CONTROL_SLIDER, { data: { value: { shape: 'scalar', value: 4 } }, onControl: vi.fn() })} />
      <CONTROL_SETPOINT_VIEW.View {...props(CONTROL_SETPOINT, { data: { value: { shape: 'scalar', value: 20 } }, onControl: vi.fn() })} />
    </>);
    expect(screen.getByRole('button', { name: 'Çalıştır' })).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Bağlı değil.');
    expect(screen.getByRole('slider', { name: 'Değer' })).toBeInTheDocument();
    expect(screen.getByText('Şimdi')).toBeInTheDocument();
  });

  it('a host failure text leads and the reason follows it in brackets', async () => {
    const onControl = vi.fn().mockRejectedValue(new Error('Device offline'));
    inKit(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: { value: { shape: 'scalar', value: false } }, onControl })} />);
    await userEvent.setup().click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByText('Değişiklik başarısız. (Device offline)')).toBeInTheDocument());
  });

  it('without a host failure text the reason alone shows', async () => {
    const onControl = vi.fn().mockRejectedValue(new Error('Device offline'));
    inKit(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: { value: { shape: 'scalar', value: false } }, onControl })} />, { messages: { controls: { on: 'Açık' } } });
    await userEvent.setup().click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByText('Device offline')).toBeInTheDocument());
  });

  it('a typed confirmation still needs the command\'s own text; only the prompt is translated', async () => {
    const onControl = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    inKit(<CONTROL_BUTTON_VIEW.View {...props(CONTROL_BUTTON, { onControl, confirm: { mode: 'typed', text: 'pump-1' } })} />);
    await user.click(screen.getByRole('button', { name: 'Çalıştır' }));
    expect(screen.getByRole('textbox', { name: 'Onaylamak için "pump-1" yazın' })).toBeInTheDocument();
    const ok = screen.getByRole('button', { name: 'Onayla' });
    await user.type(screen.getByRole('textbox'), 'Onayla');
    expect(ok).toBeDisabled();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'pump-1');
    await user.click(ok);
    expect(onControl).toHaveBeenCalledWith({ kind: 'run', confirmation: { confirmed: true, typed: 'pump-1' } });
  });
});

const table: SlotData = {
  shape: 'table',
  columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'on', label: 'On', type: 'text' }],
  rows: [{ name: 'Boiler', on: true }, { name: 'Pump', on: false }],
};

describe('data texts', () => {
  it('the table takes the host texts and Yes/No; its messages prop wins', () => {
    const { rerender } = inKit(<DataTableView settings={effective(DATA_TABLE, {})} format={{}} data={{ rows: table }} locale="en" />);
    expect(screen.getByRole('searchbox', { name: 'Ara' })).toBeInTheDocument();
    expect(screen.getByText('Evet')).toBeInTheDocument();
    expect(screen.getByText('Hayır')).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><DataTableView settings={effective(DATA_TABLE, {})} format={{}} data={{ rows: table }} locale="en" messages={{ search: 'Suchen' }} /></WidgetKitProvider>);
    expect(screen.getByRole('searchbox', { name: 'Suchen' })).toBeInTheDocument();
  });

  it('the feed names the undated group through the host; its messages prop wins', () => {
    const events: SlotData = { shape: 'table', rows: [{ time: 'garbage', title: 'A' }] };
    const s = effective(DATA_FEED, { groupByDay: true });
    const { rerender } = inKit(<DataFeedView settings={s} format={{}} data={{ events }} now={0} locale="en" />);
    expect(screen.getByText('Zaman bilinmiyor')).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><DataFeedView settings={s} format={{}} data={{ events }} now={0} locale="en" messages={{ unknownDay: 'Undatiert' }} /></WidgetKitProvider>);
    expect(screen.getByText('Undatiert')).toBeInTheDocument();
  });
});

describe('map, chart, content and stat texts', () => {
  const points: SlotData = { shape: 'table', rows: [{ id: 1, lat: 41, lng: 29, ok: true }] };

  it('buildMarkers words the tooltip link and booleans; a placement link label wins', () => {
    const s = effective(MAP, { idColumn: 'id', linkTemplate: '/devices/{id}', tooltipColumns: ['ok'] });
    expect(buildMarkers(points, s).markers[0].tooltip).toMatchObject({ linkLabel: 'Open', fields: [{ label: 'ok', value: 'Yes' }] });
    expect(buildMarkers(points, s, 'tr', null, { open: 'Aç', yes: 'Evet', no: 'Hayır' }).markers[0].tooltip)
      .toMatchObject({ linkLabel: 'Aç', fields: [{ label: 'ok', value: 'Evet' }] });
    expect(buildMarkers(points, { ...s, linkLabel: 'Details' }, 'tr', null, { open: 'Aç' }).markers[0].tooltip?.linkLabel).toBe('Details');
  });

  it('the map view takes its loading text and name from the host; explicit props win', () => {
    const { rerender } = inKit(<MapWidgetView settings={effective(MAP)} format={{}} data={{ points }} locale="en" />);
    expect(screen.getByRole('region', { name: 'Harita' })).toBeInTheDocument();
    rerender(<WidgetKitProvider value={host()}><MapWidgetView settings={effective(MAP)} format={{}} data={{ points }} locale="en" ariaLabel="Sites" /></WidgetKitProvider>);
    expect(screen.getByRole('region', { name: 'Sites' })).toBeInTheDocument();
  });

  it('pie names the folded slice; scatter names the ungrouped series but keeps its id', () => {
    const rows = [{ label: 'A', value: 5 }, { label: 'B', value: 30 }, { label: 'C', value: 10 }, { label: 'D', value: 1 }];
    inKit(<CHART_PIE_VIEW.View settings={effective(CHART_PIE, { maxSlices: 3, layout: 'donut-total' })} format={{}} data={{ slices: { shape: 'table', rows } }} locale="en" />);
    // The legend names the folded slice (the chart itself needs a measured box, which jsdom has not).
    expect(screen.getAllByText('Diğer').length).toBeGreaterThan(0);
    expect(rowsToScatterSeries([{ x: 1, y: 2 }], { x: 'x', y: 'y', unnamed: 'Seri' })).toEqual([{ id: 'Series', name: 'Seri', data: [{ x: 1, y: 2 }] }]);
  });

  it('links, embed, state, attributes and progress take the host texts', () => {
    inKit(<>
      <CONTENT_LINKS_VIEW.View {...props(CONTENT_LINKS)} />
      <CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED)} />
      <STATE_VIEW.View {...props(STATE)} />
      <STAT_ATTRIBUTES_VIEW.View {...props(STAT_ATTRIBUTES, { data: { record: { shape: 'record', record: { door: true } } } })} />
      <PROGRESS_VIEW.View {...props(PROGRESS, { settings: { target: 10, display: 'value' }, data: { value: { shape: 'scalar', value: 5 } } })} />
    </>);
    expect(screen.getByText('Bağlantı ekleyin.')).toBeInTheDocument();
    expect(screen.getByText('Adres girin.')).toBeInTheDocument();
    expect(screen.getAllByText('Bilinmiyor').length).toBeGreaterThan(0);
    expect(screen.getByText('Evet')).toBeInTheDocument();
    expect(screen.getByLabelText('5 / 10')).toBeInTheDocument();
  });

  it('an embed refused by the host list names the site in the host words', () => {
    inKit(<CONTENT_EMBED_VIEW.View {...props(CONTENT_EMBED, { settings: { url: 'https://evil.com/x' } })} />, host({ embedHosts: ['good.com'] }));
    expect(screen.getByText('evil.com reddedildi')).toBeInTheDocument();
  });
});

describe('a view without a provider', () => {
  it('keeps the English', () => {
    render(<CONTROL_SWITCH_VIEW.View {...props(CONTROL_SWITCH, { data: { value: { shape: 'scalar', value: true } }, onControl: vi.fn() })} />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('is a WidgetKindView like before', () => {
    const v: WidgetKindView = CONTROL_SWITCH_VIEW;
    expect(typeof v.View).toBe('function');
  });
});
