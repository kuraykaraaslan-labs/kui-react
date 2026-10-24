import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BoardFiltersDialog, filterRemovalBlockers } from './BoardFiltersDialog';
import { BoardFilterDialog } from './BoardFilterDialog';
import { demoAccess } from './demo-access';
import type { BoardFilter, BoardParamInfo } from './types';

const params: BoardParamInfo[] = [{ key: 'limit', label: 'limit' }];

const filters: BoardFilter[] = [
  {
    key: 'hot', name: 'Hot', keyFilters: [
      { key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: { $param: 'limit' } }] },
    ],
  },
  {
    key: 'pumps', name: 'Pumps', keyFilters: [
      { key: { type: 'field', name: 'name' }, valueType: 'string', operation: 'and', predicates: [{ op: 'startsWith', value: 'Pump', ignoreCase: true }] },
    ],
  },
];

function setup(over: Partial<React.ComponentProps<typeof BoardFiltersDialog>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <BoardFiltersDialog
      open
      filters={filters}
      usage={{ hot: ['Hot devices', 'Temperature chart'] }}
      params={params}
      access={demoAccess()}
      onSave={onSave}
      onClose={onClose}
      {...over}
    />,
  );
  return { onSave, onClose };
}

describe('BoardFiltersDialog', () => {
  it('lists the filters numbered, each as one line of text', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Filters' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('1.')).toBeInTheDocument();
    expect(screen.getByText("temperature (latest) > the dashboard's limit")).toBeInTheDocument();
    expect(screen.getByText("name starts with 'Pump' (ignore case)")).toBeInTheDocument();
  });

  it('refuses to remove a filter a widget uses and names the widgets', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Hot' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unable to delete filter');
    expect(alert).toHaveTextContent("Filter 'Hot' can't be deleted");
    expect(within(alert).getByText('Hot devices')).toBeInTheDocument();
    expect(within(alert).getByText('Temperature chart')).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('removes an unused filter and saves the rest', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Pumps' }));
    expect(screen.queryByText('Pumps')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith([filters[0]]);
  });

  it('refuses to save a list with an invalid filter and marks it', () => {
    const broken: BoardFilter = { ...filters[1], keyFilters: [{ ...filters[1].keyFilters[0], predicates: [{ op: 'startsWith' }] }] };
    const { onSave } = setup({ filters: [filters[0], broken], usage: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Hot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Some filters are not valid. Edit the ones marked below before saving.')).toBeInTheDocument();
    expect(screen.getByText('A value is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('opens the filter dialog to edit a row', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit filter Pumps' }));
    expect(screen.getByRole('dialog', { name: 'Edit filter' })).toBeInTheDocument();
    expect((screen.getByLabelText(/^Filter name/) as HTMLInputElement).value).toBe('Pumps');
  });

  it('hides "Add filter" with disableAdd and shows the empty state without filters', () => {
    setup({ filters: [], disableAdd: true });
    expect(screen.queryByRole('button', { name: 'Add filter' })).toBeNull();
    expect(screen.getByText('No filters yet')).toBeInTheDocument();
  });
});

describe('filterRemovalBlockers', () => {
  it('returns the widgets that use the filter', () => {
    expect(filterRemovalBlockers('hot', { hot: ['A'] })).toEqual(['A']);
    expect(filterRemovalBlockers('pumps', { hot: ['A'] })).toEqual([]);
    expect(filterRemovalBlockers('pumps')).toEqual([]);
  });
});

describe('BoardFilterDialog', () => {
  function open(over: Partial<React.ComponentProps<typeof BoardFilterDialog>> = {}) {
    const onSave = vi.fn();
    render(
      <BoardFilterDialog open existingKeys={['hot']} params={params} access={demoAccess()} onSave={onSave} onClose={() => {}} {...over} />,
    );
    return { onSave };
  }

  it('derives the key from the name on add, avoiding taken keys', () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Filter name/), { target: { value: 'Hot' } });
    expect((screen.getByLabelText(/^Key$|^Key\*/) as HTMLInputElement).value).toBe('hot2');
  });

  it('keeps the key of a filter being edited', () => {
    open({ filter: filters[1], existingKeys: [] });
    fireEvent.change(screen.getByLabelText(/^Filter name/), { target: { value: 'All pumps' } });
    expect((screen.getByLabelText(/^Key$|^Key\*/) as HTMLInputElement).value).toBe('pumps');
  });

  it('shows the errors under the fields and does not save an incomplete filter', () => {
    const { onSave } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Filter name is required.')).toBeInTheDocument();
    expect(screen.getByText('Key name is required.')).toBeInTheDocument();
    expect(screen.getByText('A value is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('a filter without key filters cannot be saved', () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText(/^Filter name/), { target: { value: 'Empty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove key filter 1' }));
    expect(screen.getByText('No key filters configured.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Add at least one key filter.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the filter normalised and shows it as text', () => {
    const { onSave } = open({ filter: filters[1], existingKeys: [] });
    expect(screen.getByText("name starts with 'Pump' (ignore case)", { selector: 'p' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Filter name/), { target: { value: ' Pump names ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ ...filters[1], name: 'Pump names' });
  });

  it('caps the key filters at 8', () => {
    open();
    const add = screen.getByRole('button', { name: 'Add key filter' });
    for (let i = 0; i < 7; i += 1) fireEvent.click(add);
    expect(screen.getByRole('heading', { name: 'Key filter 8' })).toBeInTheDocument();
    expect(add).toBeDisabled();
  });
});
