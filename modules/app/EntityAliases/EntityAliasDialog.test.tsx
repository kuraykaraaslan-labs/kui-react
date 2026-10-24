import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntityAliasDialog } from './EntityAliasDialog';
import { demoAccess } from './demo-access';
import type { EntityAlias, EntityAliasesAccess } from './types';

function setup(alias: EntityAlias | undefined, access: EntityAliasesAccess = demoAccess(), existingKeys: string[] = []) {
  const onSave = vi.fn();
  render(
    <EntityAliasDialog open alias={alias} existingKeys={existingKeys} params={[]} access={access} onSave={onSave} onClose={() => {}} />,
  );
  return { onSave };
}

describe('EntityAliasDialog', () => {
  it('derives the key from the name on add, avoiding taken keys', () => {
    setup(undefined, demoAccess(), ['pumpStation']);
    fireEvent.change(screen.getByLabelText(/Alias name/), { target: { value: 'Pump station' } });
    expect((screen.getByLabelText(/^Key/) as HTMLInputElement).value).toBe('pumpStation2');
  });

  it('keeps the key of an alias being edited', () => {
    setup({ key: 'tank', name: 'Tank', resolveMultiple: false, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' } });
    fireEvent.change(screen.getByLabelText(/Alias name/), { target: { value: 'Main tank' } });
    expect((screen.getByLabelText(/^Key/) as HTMLInputElement).value).toBe('tank');
  });

  it('a single entity forces resolve-multiple off, and is saved that way', async () => {
    const { onSave } = setup({
      key: 'tank', name: 'Tank', resolveMultiple: true, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' },
    });
    const sw = screen.getByRole('switch', { name: /Resolve as multiple entities/ });
    expect(sw).not.toBeChecked();
    expect(sw).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual({
      key: 'tank', name: 'Tank', resolveMultiple: false, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' },
    });
  });

  it('shows the preview total and first names', async () => {
    setup({ key: 'pumps', name: 'Pumps', resolveMultiple: true, filter: { type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] } });
    expect(await screen.findByText('2 entities matched')).toBeInTheDocument();
    expect(screen.getByText(/Pump 1, Pump 2/)).toBeInTheDocument();
  });

  it('refuses to save a filter that matches no entity (TB noEntityMatched)', async () => {
    const access = demoAccess({ preview: async () => ({ total: 0, entities: [] }) });
    const { onSave } = setup(
      { key: 'ghosts', name: 'Ghosts', resolveMultiple: true, filter: { type: 'entityName', entityType: 'iot_device', namePrefix: 'Zz' } },
      access,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('No entities matching the filter were found.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('still saves when the preview itself fails', async () => {
    const access = demoAccess({ preview: async () => { throw new Error('down'); } });
    const { onSave } = setup(
      { key: 'pumps', name: 'Pumps', resolveMultiple: true, filter: { type: 'entityType', entityType: 'iot_device' } },
      access,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it('shows field errors and does not save an incomplete alias', async () => {
    const { onSave } = setup(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Alias name is required.')).toBeInTheDocument();
    expect(screen.getByText('Filter type is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
