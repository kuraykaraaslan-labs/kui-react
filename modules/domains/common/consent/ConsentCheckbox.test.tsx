import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentCheckbox, type ConsentCheckboxProps } from './ConsentCheckbox';

function Harness(props: Partial<ConsentCheckboxProps>) {
  const [checked, setChecked] = useState(false);
  return (
    <ConsentCheckbox
      checked={checked}
      onChange={setChecked}
      label="My subscription renews automatically until I cancel it."
      text={'1. Term\nThe subscription renews for the same term.'}
      textTitle="Automatic renewal"
      version="v3 · 2026-11-17"
      {...props}
    />
  );
}

describe('ConsentCheckbox', () => {
  it('starts unticked; the label ticks it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: /renews automatically/ });
    expect(box).not.toBeChecked();
    await user.click(screen.getByText('My subscription renews automatically until I cancel it.'));
    expect(box).toBeChecked();
  });

  it('"Read the text" opens the versioned text in a drawer without ticking the box', async () => {
    const user = userEvent.setup();
    const onOpenText = vi.fn();
    render(<Harness onOpenText={onOpenText} />);
    await user.click(screen.getByRole('button', { name: 'Read the text' }));
    const drawer = screen.getByRole('dialog', { name: 'Automatic renewal' });
    expect(within(drawer).getByText('Version v3 · 2026-11-17')).toBeInTheDocument();
    expect(within(drawer).getByText(/The subscription renews for the same term\./)).toBeInTheDocument();
    expect(onOpenText).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { hidden: true })).not.toBeChecked();
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Automatic renewal' })).toBeNull());
  });

  it('shows a loading line while the text loads', async () => {
    const user = userEvent.setup();
    render(<Harness text={undefined} textLoading />);
    await user.click(screen.getByRole('button', { name: 'Read the text' }));
    expect(screen.getByText('Loading the text…')).toBeInTheDocument();
  });

  it('has no link without a text', () => {
    render(<Harness text={undefined} />);
    expect(screen.queryByRole('button', { name: 'Read the text' })).toBeNull();
  });

  it('required and invalid: aria-required, aria-invalid and the error tied by aria-describedby; ticking clears it', async () => {
    const user = userEvent.setup();
    render(<Harness required invalid />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-required', 'true');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Tick this box to continue.');
    expect(screen.getByText('(required)')).toBeInTheDocument();
    await user.click(box);
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes a custom error and translated strings', () => {
    render(<Harness invalid error="Bitte zustimmen." messages={{ readText: 'Text lesen' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte zustimmen.');
    expect(screen.getByRole('button', { name: 'Text lesen' })).toBeInTheDocument();
  });

  it('disabled cannot be ticked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConsentCheckbox checked={false} onChange={onChange} label="I agree" disabled />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
