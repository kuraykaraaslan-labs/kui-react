import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityAliasPicker, aliasPickerOptions } from './EntityAliasPicker';
import { AliasEntitySelect } from './AliasEntitySelect';
import { DEFAULT_ALIAS_MESSAGES } from './messages';
import { DEMO_ENTITY_TYPES } from './demo-access';
import type { BoardFilter, EntityAlias } from './types';

const aliases: EntityAlias[] = [
  { key: 'pumps', name: 'Pumps', resolveMultiple: true, filter: { type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] } },
  { key: 'tank', name: 'Tank', resolveMultiple: false, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' } },
  { key: 'sites', name: 'Sites', resolveMultiple: true, filter: { type: 'entityType', entityType: 'iot_asset' } },
  {
    key: 'related', name: 'Related', resolveMultiple: false,
    filter: { type: 'relationsQuery', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1, filters: [] },
  },
];

describe('aliasPickerOptions (slot compatibility)', () => {
  it('a single device slot: wrong type and "resolves to many" are disabled with the reason; relations are allowed', () => {
    const opts = aliasPickerOptions(aliases, { entityTypes: ['iot_device'], multiple: false }, DEMO_ENTITY_TYPES, [], DEFAULT_ALIAS_MESSAGES);
    const byKey = Object.fromEntries(opts.map((o) => [o.value, o]));
    expect(opts[0]).toEqual({ value: '', label: 'None' });
    expect(byKey.pumps).toMatchObject({ disabled: true, description: 'Resolves to many entities; this slot takes one' });
    expect(byKey.tank.disabled).toBeUndefined();
    expect(byKey.sites).toMatchObject({ disabled: true, description: 'Gives Assets; this slot takes Devices' });
    expect(byKey.related.disabled).toBeUndefined();
  });

  it('with the host\'s rules an alias of sites fits a device slot by what it holds, and one of many fits by the one', () => {
    const rules = { holds: (from: string) => from === 'iot_asset', oneOfMany: true };
    const one = Object.fromEntries(aliasPickerOptions(aliases, { entityTypes: ['iot_device'], multiple: false }, DEMO_ENTITY_TYPES, [], DEFAULT_ALIAS_MESSAGES, rules).map((o) => [o.value, o]));
    expect(one.sites).toMatchObject({ description: 'Gives Assets: takes the one of the devices it holds' });
    expect(one.sites.disabled).toBeUndefined();
    expect(one.pumps).toMatchObject({ description: 'Gives several: taken when exactly one matches' });
    expect(one.pumps.disabled).toBeUndefined();
    const many = Object.fromEntries(aliasPickerOptions(aliases, { entityTypes: ['iot_device'], multiple: true }, DEMO_ENTITY_TYPES, [], DEFAULT_ALIAS_MESSAGES, rules).map((o) => [o.value, o]));
    expect(many.sites).toMatchObject({ description: 'Gives Assets: takes the devices they hold' });
  });

  it('a multiple slot of any type takes every alias', () => {
    const opts = aliasPickerOptions(aliases, { entityTypes: [], multiple: true }, DEMO_ENTITY_TYPES, [], DEFAULT_ALIAS_MESSAGES);
    expect(opts.filter((o) => o.disabled)).toHaveLength(0);
  });
});

describe('EntityAliasPicker', () => {
  it('lists the aliases with the incompatible ones disabled, and picks one', () => {
    const onChange = vi.fn();
    render(
      <EntityAliasPicker aliases={aliases} slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={DEMO_ENTITY_TYPES} onChange={onChange} />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Pumps/ })).toBeDisabled();
    expect(screen.getByText('Resolves to many entities; this slot takes one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tank/ }));
    expect(onChange).toHaveBeenCalledWith('tank');
  });

  it('"None" clears the binding and "New alias" asks the host', () => {
    const onChange = vi.fn();
    const onCreate = vi.fn();
    render(
      <EntityAliasPicker value="tank" aliases={aliases} slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={DEMO_ENTITY_TYPES}
        onChange={onChange} onCreate={onCreate} />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'New alias' }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('EntityAliasPicker: the filter next to the alias', () => {
  const filters: BoardFilter[] = [
    { key: 'hot', name: 'Hot', keyFilters: [{ key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: 30 }] }] },
    { key: 'active', name: 'Active', keyFilters: [{ key: { type: 'attribute', name: 'active', scope: 'server' }, valueType: 'boolean', operation: 'and', predicates: [{ op: 'true' }] }] },
  ];
  const slot = { entityTypes: ['iot_device'], multiple: false };
  const filterSelect = () => screen.queryByLabelText('Filter') as HTMLSelectElement | null;

  it('offers "None" and the board filters once an alias is chosen, with the chosen filter as text', () => {
    const onFilterChange = vi.fn();
    render(
      <EntityAliasPicker value="tank" aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={() => {}}
        filters={filters} filterValue="hot" onFilterChange={onFilterChange} />,
    );
    const select = filterSelect()!;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['None', 'Hot', 'Active']);
    expect(select.value).toBe('hot');
    expect(screen.getByText('temperature (latest) > 30')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'active' } });
    expect(onFilterChange).toHaveBeenLastCalledWith('active');
    fireEvent.change(select, { target: { value: '' } });
    expect(onFilterChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows no filter select without an alias or without filters', () => {
    const { rerender } = render(
      <EntityAliasPicker aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={() => {}} filters={filters} onFilterChange={() => {}} />,
    );
    expect(filterSelect()).toBeNull();
    rerender(<EntityAliasPicker value="tank" aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={() => {}} filters={[]} onFilterChange={() => {}} />);
    expect(filterSelect()).toBeNull();
    rerender(<EntityAliasPicker value="tank" aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={() => {}} />);
    expect(filterSelect()).toBeNull();
  });

  it('keeps a filter the board no longer has visible by its key, so it can be cleared', () => {
    render(
      <EntityAliasPicker value="tank" aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={() => {}}
        filters={[]} filterValue="gone" onFilterChange={() => {}} />,
    );
    expect(Array.from(filterSelect()!.options).map((o) => o.value)).toEqual(['', 'gone']);
  });

  it('clearing the alias clears the filter', () => {
    const onChange = vi.fn();
    const onFilterChange = vi.fn();
    render(
      <EntityAliasPicker value="tank" aliases={aliases} slot={slot} entityTypes={DEMO_ENTITY_TYPES} onChange={onChange}
        filters={filters} filterValue="hot" onFilterChange={onFilterChange} />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(onFilterChange).toHaveBeenCalledWith(undefined);
  });
});

describe('AliasEntitySelect', () => {
  const load = vi.fn(async () => []);

  it('draws nothing without selectable aliases', () => {
    const { container } = render(<AliasEntitySelect items={[]} loadOptions={load} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current entity's name for one alias, \"Entities\" for several", () => {
    const tank = { type: 'iot_device', id: 'd3', name: 'Tank A' };
    const { rerender } = render(
      <AliasEntitySelect items={[{ aliasKey: 'tank', aliasName: 'Tank', current: tank }]} loadOptions={load} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Tank A/ })).toBeInTheDocument();
    rerender(
      <AliasEntitySelect
        items={[{ aliasKey: 'tank', aliasName: 'Tank', current: tank }, { aliasKey: 'site', aliasName: 'Site', current: null }]}
        loadOptions={load}
        onChange={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /Entities/ });
    fireEvent.click(button);
    expect(screen.getByText('Tank', { selector: 'label' })).toBeInTheDocument();
    expect(screen.getByText('Site', { selector: 'label' })).toBeInTheDocument();
  });
});
