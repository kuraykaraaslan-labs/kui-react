import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, type RadioOption } from './RadioGroup';

const PLANS: RadioOption[] = [
  { value: 'free', label: 'Free', hint: 'Up to 3 users' },
  { value: 'pro', label: 'Pro', disabled: true, disabledReason: 'Needs a paid licence' },
  { value: 'ent', label: 'Enterprise' },
];

describe('RadioGroup', () => {
  it('disables a single option and leaves the others enabled', () => {
    render(<RadioGroup name="plan" legend="Plan" options={PLANS} value="free" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /Pro/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Free/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Enterprise/ })).toBeEnabled();
  });

  it('a disabled option cannot be chosen', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RadioGroup name="plan" legend="Plan" options={PLANS} value="free" onChange={onChange} />);
    await user.click(screen.getByText('Pro'));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByText('Enterprise'));
    expect(onChange).toHaveBeenCalledWith('ent');
  });

  it('shows the disabled reason and wires it (and the hint) through aria-describedby', () => {
    render(<RadioGroup name="plan" legend="Plan" options={PLANS} onChange={() => {}} />);
    const reason = screen.getByText('Needs a paid licence');
    expect(screen.getByRole('radio', { name: /Pro/ })).toHaveAttribute('aria-describedby', reason.id);
    const hint = screen.getByText('Up to 3 users');
    expect(screen.getByRole('radio', { name: /Free/ })).toHaveAttribute('aria-describedby', hint.id);
  });

  it('the reason is not shown while the option is enabled', () => {
    render(
      <RadioGroup name="plan" legend="Plan" onChange={() => {}}
        options={[{ value: 'pro', label: 'Pro', disabledReason: 'Needs a paid licence' }]} />,
    );
    expect(screen.queryByText('Needs a paid licence')).toBeNull();
    expect(screen.getByRole('radio', { name: /Pro/ })).toBeEnabled();
  });

  it('the group-level disabled still disables every option', () => {
    render(<RadioGroup name="plan" legend="Plan" options={PLANS} disabled onChange={() => {}} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});
