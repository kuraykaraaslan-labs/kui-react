import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboBox } from './index';
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
});
