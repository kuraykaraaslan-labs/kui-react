import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';
import { Modal } from './Modal';

const TAGS: MultiSelectOption[] = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

describe('MultiSelect', () => {
  it('uses the English defaults', async () => {
    const user = userEvent.setup();
    render(<MultiSelect id="tags" label="Tags" options={TAGS} value={['red']} searchable onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove Red' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    await user.type(screen.getByRole('textbox', { name: 'Search…' }), 'zzz');
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('messages translate the built-in strings, filling {label} in the remove name', async () => {
    const user = userEvent.setup();
    render(
      <MultiSelect
        id="tags" label="Tags" options={TAGS} value={['red']} searchable onChange={() => {}}
        messages={{ noResults: 'Keine Treffer.', search: 'Suchen…', remove: '{label} entfernen' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Red entfernen' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    await user.type(screen.getByRole('textbox', { name: 'Suchen…' }), 'zzz');
    expect(screen.getByText('Keine Treffer.')).toBeInTheDocument();
    expect(screen.queryByText('No results found.')).toBeNull();
  });

  it('Escape in the search box closes the list but not an enclosing Modal', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <MultiSelect id="tags" label="Tags" options={TAGS} searchable onChange={() => {}} />
      </Modal>,
    );
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    const combobox = screen.getByRole('combobox', { name: 'Tags' });
    await user.click(combobox);
    screen.getByRole('textbox', { name: 'Search…' }).focus();
    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
