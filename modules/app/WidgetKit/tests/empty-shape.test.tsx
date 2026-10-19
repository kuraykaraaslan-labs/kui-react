import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/modules/ui/MapView', () => ({
  MapCanvas: () => <div role="region" aria-label="map" />,
}));

import { WidgetCard } from '../WidgetCard';
import { PlacementCard } from '../PlacementCard';
import { BUILTIN_KINDS } from '../templates';
import { BUILTIN_VIEWS } from '../views';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { DATA_TABLE_VIEW } from '../views/DataTableView';
import { rangeFor } from '../settings/style';

const NOW = Date.parse('2026-10-19T10:00:00.000Z');

describe('WidgetCard empty shape', () => {
  it('shows emptyBody faded and hidden from assistive tech, under the no-data text', () => {
    const { container } = render(<WidgetCard title="Load" card={{}} state="empty" emptyBody={<p>shape</p>}><p>body</p></WidgetCard>);
    expect(screen.getByText('No data')).toBeInTheDocument();
    const shape = container.querySelector('[aria-hidden="true"][inert]');
    expect(shape).not.toBeNull();
    expect(shape).toHaveTextContent('shape');
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('uses the shape for the unconfigured state too, with its own text', () => {
    render(<WidgetCard title="Load" card={{}} state="unconfigured" unconfiguredText="Bind data" emptyBody={<p>shape</p>} />);
    expect(screen.getByText('Bind data')).toBeInTheDocument();
    expect(screen.getByText('shape', { selector: 'p' }).closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the text alone without emptyBody', () => {
    const { container } = render(<WidgetCard title="Load" card={{ noDataText: 'Nothing yet' }} state="empty" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(container.querySelector('[inert]')).toBeNull();
  });
});

describe('PlacementCard empty shape', () => {
  const table = (settings: Record<string, unknown>) => render(
    <PlacementCard title="Devices" template={DATA_TABLE} slots={DATA_TABLE_KIND.slots} view={DATA_TABLE_VIEW}
      settings={settings} data={{}} boundSlots={['rows']} now={NOW} />,
  );

  it('draws a table with no result as its configured headers over no rows', () => {
    const { container } = table({ columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }] });
    expect(screen.getByText('No data')).toBeInTheDocument();
    const shape = container.querySelector('[inert]')!;
    expect(shape.querySelectorAll('th')).toHaveLength(2);
    expect(shape).toHaveTextContent('Name');
    expect(shape.querySelector('tbody tr')).toBeNull();
    expect(shape.querySelector('input')).toBeNull();
  });

  it('shows the message only when $card.emptyDisplay is message', () => {
    const { container } = table({ columns: [{ key: 'name', label: 'Name' }], $card: { emptyDisplay: 'message' } });
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(container.querySelector('[inert]')).toBeNull();
  });

  // Map and the 3D viewer need their canvases; their empty shape is the plain base map / model.
  const shaped = BUILTIN_KINDS.filter((k) => BUILTIN_VIEWS[k.type]?.emptyShape && k.type !== 'viewer.model');
  it.each(shaped.map((k) => [k.type, k] as const))('%s draws an empty shape from no data, with no made-up value', (_type, kind) => {
    const { container } = render(
      <PlacementCard title={kind.label} template={kind.template} slots={kind.slots} view={BUILTIN_VIEWS[kind.type]}
        settings={{}} data={{}} boundSlots={kind.slots.map((s) => s.key)} now={NOW} />,
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    const shape = container.querySelector('[inert]');
    expect(shape).not.toBeNull();
    expect(shape!.textContent).not.toMatch(/NaN|Infinity|Invalid Date/);
  });

  it.each(['heatmap', 'data.feed'])('%s keeps the text alone (no meaningful empty shape)', (type) => {
    expect(BUILTIN_VIEWS[type].emptyShape).toBeFalsy();
  });

  it('stat.value shows a dash without its unit, never 0', () => {
    const kind = BUILTIN_KINDS.find((k) => k.type === 'stat.value')!;
    const { container } = render(
      <PlacementCard title="Power" template={kind.template} slots={kind.slots} view={BUILTIN_VIEWS['stat.value']}
        settings={{ $format: { unit: 'kWh' } }} data={{}} boundSlots={['value']} now={NOW} />,
    );
    const shape = container.querySelector('[inert]')!;
    expect(shape).toHaveTextContent('—');
    expect(shape.textContent).not.toContain('kWh');
    expect(shape.textContent).not.toMatch(/\b0\b/);
  });
});

describe('rangeFor', () => {
  it('finds no range for a missing value (Number(null) is 0)', () => {
    const ranges = [{ from: -10, to: 10, color: 'red' }];
    expect(rangeFor(null, ranges)).toBeUndefined();
    expect(rangeFor(undefined, ranges)).toBeUndefined();
    expect(rangeFor('', ranges)).toBeUndefined();
    expect(rangeFor(0, ranges)?.color).toBe('red');
  });
});
