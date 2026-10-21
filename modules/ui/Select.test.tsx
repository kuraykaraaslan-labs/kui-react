import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, type SelectOption } from './Select';

// Select is actually two implementations behind one export: a native
// <select> (default) and a custom listbox combobox (when any option has an
// icon, or `searchable` is set). Both paths are tested separately.

const PLAIN_OPTIONS: SelectOption[] = [
  { value: 'us', label: 'United States' },
  { value: 'tr', label: 'Turkey' },
  { value: 'de', label: 'Germany' },
];

describe('Select (native <select> path)', () => {
  it('renders a real <select> with a label and every option', () => {
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} value="us" onChange={() => {}} />);
    const select = screen.getByLabelText('Country') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Turkey' })).toBeInTheDocument();
  });

  it('a placeholder renders as an empty-value option', () => {
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} placeholder="Pick one" onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'Pick one' })).toHaveValue('');
  });

  it('error sets aria-invalid and renders role="alert" wired via aria-describedby', () => {
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} error="Required" onChange={() => {}} />);
    const select = screen.getByLabelText('Country');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByRole('alert');
    expect(select).toHaveAttribute('aria-describedby', message.id);
  });

  it('does not reference the unrendered hint once an error replaces it', () => {
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} hint="Where you live" error="Required" onChange={() => {}} />);
    expect(screen.getByLabelText('Country')).toHaveAttribute('aria-describedby', 'country-error');
  });

  it('fires onChange when a different option is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} value="us" onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText('Country'), 'tr');
    expect(onChange).toHaveBeenCalled();
  });

  it('disabled prevents interaction', () => {
    render(<Select id="country" label="Country" options={PLAIN_OPTIONS} disabled onChange={() => {}} />);
    expect(screen.getByLabelText('Country')).toBeDisabled();
  });
});

const ICON_OPTIONS: SelectOption[] = [
  { value: 'us', label: 'United States', icon: <span data-testid="flag-us" /> },
  { value: 'tr', label: 'Turkey', icon: <span data-testid="flag-tr" /> },
];

describe('Select (custom combobox path — has icons or searchable)', () => {
  it('renders a closed combobox showing the placeholder when nothing is selected', () => {
    render(<Select id="country2" label="Country" options={ICON_OPTIONS} placeholder="Choose a country" onChange={() => {}} />);
    const combobox = screen.getByRole('combobox', { name: 'Country' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Choose a country')).toBeInTheDocument();
  });

  it('opens the listbox on click and shows every option', async () => {
    const user = userEvent.setup();
    render(<Select id="country2" label="Country" options={ICON_OPTIONS} onChange={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Turkey/ })).toBeInTheDocument();
  });

  it('selecting an option calls onChange and closes the listbox', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select id="country2" label="Country" options={ICON_OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Turkey/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: 'tr' } }));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not reference the unrendered hint once an error replaces it', () => {
    render(<Select id="country2" label="Country" options={ICON_OPTIONS} hint="Where you live" error="Required" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-describedby', 'country2-error');
  });

  it('Escape closes the open listbox', async () => {
    const user = userEvent.setup();
    render(<Select id="country2" label="Country" options={ICON_OPTIONS} onChange={() => {}} />);
    const combobox = screen.getByRole('combobox');
    combobox.focus();
    await user.keyboard(' '); // Space opens it (component-level Enter/Space handling)
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('searchable filters the option list as you type', async () => {
    const user = userEvent.setup();
    render(<Select id="country3" label="Country" options={PLAIN_OPTIONS} searchable onChange={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search…'), 'ger');
    expect(screen.getByRole('option', { name: 'Germany' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Turkey' })).not.toBeInTheDocument();
  });
});
