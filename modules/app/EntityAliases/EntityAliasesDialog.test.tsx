import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EntityAliasesDialog, aliasRemovalBlockers } from './EntityAliasesDialog';
import { demoAccess } from './demo-access';
import type { EntityAlias } from './types';

const aliases: EntityAlias[] = [
  { key: 'pumps', name: 'Pumps', resolveMultiple: true, filter: { type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] } },
  { key: 'tank', name: 'Tank', resolveMultiple: false, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' } },
];

function setup(over: Partial<React.ComponentProps<typeof EntityAliasesDialog>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <EntityAliasesDialog
      open
      aliases={aliases}
      usage={{ pumps: ['Pump pressure', 'Pump map'] }}
      params={[]}
      access={demoAccess()}
      onSave={onSave}
      onClose={onClose}
      {...over}
    />,
  );
  return { onSave, onClose };
}

describe('EntityAliasesDialog', () => {
  it('lists the aliases numbered, with the filter as text once the entity types are loaded', async () => {
    setup();
    const list = screen.getByRole('list', { name: 'Entity aliases' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('1.')).toBeInTheDocument();
    expect(await screen.findByText('Devices of device profiles Pump')).toBeInTheDocument();
    expect(screen.getByText('One device')).toBeInTheDocument();
  });

  it('refuses to remove an alias a widget uses and names the widgets', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove alias Pumps' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unable to delete entity alias');
    expect(alert).toHaveTextContent("Alias 'Pumps' can't be deleted");
    expect(within(alert).getByText('Pump pressure')).toBeInTheDocument();
    expect(within(alert).getByText('Pump map')).toBeInTheDocument();
    expect(screen.getByText('Pumps')).toBeInTheDocument();
    // Nothing changed, so there is nothing to save.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('removes an unused alias and saves the rest', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove alias Tank' }));
    expect(screen.queryByText('Tank')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith([aliases[0]]);
  });

  it('a single entity alias has its resolve-multiple switch off and disabled; the others switch in place', () => {
    const { onSave } = setup();
    const sw = screen.getByRole('switch', { name: 'Resolve Tank as multiple entities' });
    expect(sw).not.toBeChecked();
    expect(sw).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Resolve Pumps as multiple entities' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith([{ ...aliases[0], resolveMultiple: false }, aliases[1]]);
  });

  it('hides "Add alias" with disableAdd and shows the empty state without aliases', () => {
    setup({ aliases: [], disableAdd: true });
    expect(screen.queryByRole('button', { name: 'Add alias' })).toBeNull();
    expect(screen.getByText('No aliases yet')).toBeInTheDocument();
  });
});

describe('aliasRemovalBlockers', () => {
  it('returns the widgets that use the alias', () => {
    expect(aliasRemovalBlockers('pumps', { pumps: ['A'] })).toEqual(['A']);
    expect(aliasRemovalBlockers('tank', { pumps: ['A'] })).toEqual([]);
    expect(aliasRemovalBlockers('tank')).toEqual([]);
  });
});
