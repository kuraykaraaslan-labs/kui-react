import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EntityFilterForm } from './EntityFilterForm';
import { demoAccess } from './demo-access';
import type { EntityAliasFilter, EntityAliasesAccess } from './types';

function Harness({
  access,
  initial = null,
  initialMultiple = true,
  onFilter,
  onMultiple,
}: {
  access: EntityAliasesAccess;
  initial?: EntityAliasFilter | null;
  initialMultiple?: boolean;
  onFilter?: (f: EntityAliasFilter) => void;
  onMultiple?: (v: boolean) => void;
}) {
  const [filter, setFilter] = useState<EntityAliasFilter | null>(initial);
  const [multiple, setMultiple] = useState(initialMultiple);
  return (
    <EntityFilterForm
      value={filter}
      onChange={(f) => { setFilter(f); onFilter?.(f); }}
      resolveMultiple={multiple}
      onResolveMultipleChange={(v) => { setMultiple(v); onMultiple?.(v); }}
      params={[{ key: 'site', label: 'Site', entityType: 'iot_asset' }]}
      access={access}
    />
  );
}

const typeSelect = () => screen.getByLabelText(/Filter type/) as HTMLSelectElement;
const optionValues = (select: HTMLSelectElement) => within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);

describe('EntityFilterForm', () => {
  it('picking a single entity turns resolve-multiple off; a list turns it back on (TB)', () => {
    const onMultiple = vi.fn();
    const onFilter = vi.fn();
    render(<Harness access={demoAccess()} onMultiple={onMultiple} onFilter={onFilter} />);
    fireEvent.change(typeSelect(), { target: { value: 'singleEntity' } });
    expect(onMultiple).toHaveBeenLastCalledWith(false);
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'singleEntity', entityType: '', id: '' });
    fireEvent.change(typeSelect(), { target: { value: 'entityList' } });
    expect(onMultiple).toHaveBeenLastCalledWith(true);
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'entityList', entityType: '', ids: [] });
  });

  it('offers the relation types only when the host has a relation provider', async () => {
    render(<Harness access={demoAccess()} />);
    await waitFor(() => expect(optionValues(typeSelect())).toContain('relationsQuery'));
    expect(optionValues(typeSelect())).toContain('entitySearchQuery');
  });

  it('hides the relation types when there is no relation provider', async () => {
    render(<Harness access={demoAccess({ relationProviders: async () => [] })} initial={{ type: 'entityType', entityType: '' }} />);
    // The entity type select fills once the catalog (entity types + providers) is in.
    expect(await screen.findByRole('option', { name: 'Device' })).toBeInTheDocument();
    expect(optionValues(typeSelect())).not.toContain('relationsQuery');
    expect(optionValues(typeSelect())).not.toContain('entitySearchQuery');
    expect(optionValues(typeSelect())).toContain('entityName');
  });

  it('labels the subtype chips from the entity type (e.g. "Device profiles")', async () => {
    render(<Harness access={demoAccess()} initial={{ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] }} />);
    expect(await screen.findByText('Device profiles')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name starts with/)).toBeInTheDocument();
  });

  it('shows "Fetch last level only" only when the max level is above 1', () => {
    const relations: EntityAliasFilter = {
      type: 'relationsQuery', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1, filters: [],
    };
    render(<Harness access={demoAccess()} initial={relations} />);
    expect(screen.queryByText('Fetch last level only')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Max relation level/), { target: { value: '3' } });
    expect(screen.getByText('Fetch last level only')).toBeInTheDocument();
  });
});
