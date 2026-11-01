import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboBox, DEFAULT_COMBOBOX_MESSAGES } from './index';
import { Modal } from '../Modal';
import type { ComboBoxOption } from './types';

const FRUITS: ComboBoxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function optionNames() {
  return screen.getAllByRole('option').map((o) => o.textContent);
}

describe('ComboBox', () => {
  it('an opened ComboBox with a selection lists every option, not only the current one', async () => {
    const user = userEvent.setup();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    expect(input).toHaveValue('Banana');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(optionNames()).toEqual(['Apple', 'Banana', 'Cherry']);
    // The selected label stays visible as the value, selected so typing replaces it.
    expect(input).toHaveValue('Banana');
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe('Banana'.length);
  });

  it('filters once the user types, and lists everything again after reopening', async () => {
    const user = userEvent.setup();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(input);
    await user.keyboard('ch');
    expect(input).toHaveValue('ch');
    expect(optionNames()).toEqual(['Cherry']);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('Banana');

    await user.click(input);
    expect(optionNames()).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('a keystroke that reopens a closed list filters it at once', async () => {
    const user = userEvent.setup();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} onChange={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard('ap');
    expect(optionNames()).toEqual(['Apple']);
  });

  it('async search is called with an empty query on open, not with the selected label', async () => {
    const onSearch = vi.fn(async (_query: string) => FRUITS);
    const user = userEvent.setup();
    render(
      <ComboBox id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={() => {}} onSearch={onSearch} debounceMs={0} />,
    );
    await user.click(screen.getByRole('searchbox', { name: 'Fruit' }));
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    expect(onSearch.mock.calls[0][0]).toBe('');
  });

  it('Escape with the list open closes the list but not an enclosing Modal', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <ComboBox id="fruit" label="Fruit" options={FRUITS} onChange={() => {}} />
      </Modal>,
    );
    // Let the Modal's deferred initial focus land before interacting.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // With the list closed, Escape reaches the Modal.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the English defaults', async () => {
    const user = userEvent.setup();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    expect(input).toHaveAttribute('placeholder', DEFAULT_COMBOBOX_MESSAGES.placeholder);
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
    await user.click(input);
    await user.keyboard('zzz');
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('messages translate every built-in string', async () => {
    const user = userEvent.setup();
    render(
      <ComboBox
        id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={() => {}}
        messages={{ placeholder: 'Suchen oder wählen…', noResults: 'Keine Treffer.', clear: 'Auswahl löschen' }}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    expect(input).toHaveAttribute('placeholder', 'Suchen oder wählen…');
    expect(screen.getByRole('button', { name: 'Auswahl löschen' })).toBeInTheDocument();
    await user.click(input);
    await user.keyboard('zzz');
    expect(screen.getByText('Keine Treffer.')).toBeInTheDocument();
    expect(screen.queryByText('No results found.')).toBeNull();
  });

  it('the placeholder and noResultsText props still win over messages', async () => {
    const user = userEvent.setup();
    render(
      <ComboBox
        id="fruit" label="Fruit" options={FRUITS} onChange={() => {}}
        placeholder="Pick a fruit" noResultsText="Nothing here."
        messages={{ placeholder: 'ignored', noResults: 'ignored too' }}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    expect(input).toHaveAttribute('placeholder', 'Pick a fruit');
    await user.click(input);
    await user.keyboard('zzz');
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('highlights the first match while typing, so Enter takes it (next-boilerplate e2e round 5, V1-B16)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(input);
    // nothing typed: nothing highlighted, Enter takes nothing
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('an');
    expect(input).toHaveAttribute('aria-activedescendant', 'fruit-option-0');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('banana');
    expect(screen.queryByRole('listbox')).toBeNull();
    // an arrow moves on from the first match
    await user.clear(input);
    await user.keyboard('a');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('banana');
  });

  it('clearing gives the focus back without opening the list again (next-boilerplate e2e round 5, V1-B17)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboBox id="fruit" label="Fruit" options={FRUITS} value="banana" onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(screen.getByRole('button', { name: DEFAULT_COMBOBOX_MESSAGES.clear }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
    // the next click or keystroke opens it as usual
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('messages.loading is announced while an async search is pending', async () => {
    const user = userEvent.setup();
    const never = () => new Promise<ComboBoxOption[]>(() => {});
    render(
      <ComboBox id="fruit" label="Fruit" options={FRUITS} onChange={() => {}} onSearch={never} debounceMs={0}
        messages={{ loading: 'Lädt…' }} />,
    );
    await user.click(screen.getByRole('searchbox', { name: 'Fruit' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Lädt…');
  });
});
