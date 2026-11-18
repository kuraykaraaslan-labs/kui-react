import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionPlanCard, type SubscriptionPlan } from './SubscriptionPlanCard';

const pro: SubscriptionPlan = { planId: 'pro', name: 'Pro', price: 2900, currency: 'USD', interval: 'MONTHLY', features: ['Unlimited projects'] };

describe('SubscriptionPlanCard', () => {
  it('shows the price, unit and features and chooses the plan', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SubscriptionPlanCard plan={pro} onSelect={onSelect} />);
    expect(screen.getByText('$29')).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();
    expect(screen.getByText('Unlimited projects')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose Pro' }));
    expect(onSelect).toHaveBeenCalledWith('pro');
  });

  it('without onSelect, and on the current plan, there is no button (the badge says it)', () => {
    const { rerender } = render(<SubscriptionPlanCard plan={pro} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<SubscriptionPlanCard plan={pro} isCurrent onSelect={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('a selected plan reads Selected with aria-pressed; actionLabel words the button', () => {
    const { rerender } = render(<SubscriptionPlanCard plan={pro} onSelect={vi.fn()} isSelected />);
    expect(screen.getByRole('button', { name: 'Selected' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<SubscriptionPlanCard plan={pro} onSelect={vi.fn()} actionLabel="Upgrade to Pro" />);
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a free plan says Free without a unit; actionNote replaces the button', () => {
    render(<SubscriptionPlanCard plan={{ ...pro, price: 0 }} onSelect={vi.fn()} actionNote="Assigned by your workspace plan" />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.queryByText('/ month')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Assigned by your workspace plan')).toBeInTheDocument();
  });

  it('formats in the given locale and strikes the list price beside a discount', () => {
    render(
      <SubscriptionPlanCard
        plan={{ ...pro, price: 149900, currency: 'TRY' }}
        locale="tr-TR"
        intervalLabel="/ay"
        discount={{ amount: 99000, note: 'PARTNER: your price' }}
        priceNote="₺1.188 incl. KDV (20%)"
      />,
    );
    expect(screen.getByLabelText(/List price ₺1\.499/)).toBeInTheDocument();
    expect(screen.getByText(/₺990/)).toBeInTheDocument();
    expect(screen.getByText('/ay')).toBeInTheDocument();
    expect(screen.getByText('PARTNER: your price')).toBeInTheDocument();
    expect(screen.getByText('₺1.188 incl. KDV (20%)')).toBeInTheDocument();
  });

  it('uses the currency\'s own minor unit (JPY has none)', () => {
    render(<SubscriptionPlanCard plan={{ ...pro, price: 1000, currency: 'JPY' }} />);
    expect(screen.getByText('¥1,000')).toBeInTheDocument();
  });

  it('the interval switch reports the other term', async () => {
    const user = userEvent.setup();
    const onIntervalChange = vi.fn();
    render(
      <SubscriptionPlanCard
        plan={pro}
        intervalOptions={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly', badge: '-17%' }]}
        onIntervalChange={onIntervalChange}
      />,
    );
    const group = screen.getByRole('group', { name: 'Billing interval' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Monthly', 'Yearly-17%']);
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    await user.click(buttons[1]);
    expect(onIntervalChange).toHaveBeenCalledWith('YEARLY');
  });

  it('one interval: no switch', () => {
    render(<SubscriptionPlanCard plan={pro} intervalOptions={[{ value: 'MONTHLY', label: 'Monthly' }]} />);
    expect(screen.queryByRole('group', { name: 'Billing interval' })).toBeNull();
  });

  it('the renewal line: renews on a date for an amount, or ends on a date', () => {
    const { rerender } = render(<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17', amount: 2900 }} />);
    expect(screen.getByText('Renews on Dec 17, 2026 for $29')).toBeInTheDocument();
    rerender(<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17' }} />);
    expect(screen.getByText('Renews on Dec 17, 2026')).toBeInTheDocument();
    rerender(<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17', ends: true }} />);
    expect(screen.getByText('Ends on Dec 17, 2026')).toBeInTheDocument();
  });

  it('a bare date is that calendar day', () => {
    render(<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17', ends: true }} />);
    expect(screen.getByText('Ends on Dec 17, 2026')).toBeInTheDocument();
  });

  it('the trial line', () => {
    render(<SubscriptionPlanCard plan={pro} trial={{ endsOn: new Date(2026, 11, 1), thenAmount: 2900 }} />);
    expect(screen.getByText('Trial ends on Dec 1, 2026; then $29')).toBeInTheDocument();
  });

  it('cancel renewal asks first and states the no-refund rule', async () => {
    const user = userEvent.setup();
    const onCancelRenewal = vi.fn().mockResolvedValue(undefined);
    render(<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17', amount: 2900 }} onCancelRenewal={onCancelRenewal} />);
    await user.click(screen.getByRole('button', { name: 'Cancel renewal' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel automatic renewal' });
    expect(dialog).toHaveTextContent(
      'Cancelling stops the next renewal. You keep access until Dec 17, 2026. Payments already made are not refunded.',
    );
    expect(onCancelRenewal).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel renewal' }));
    expect(onCancelRenewal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Cancel automatic renewal' })).toBeNull();
  });

  it('a plan that ends offers Resume renewal instead', async () => {
    const user = userEvent.setup();
    const onResumeRenewal = vi.fn();
    render(
      <SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: '2026-12-17', ends: true }} onCancelRenewal={vi.fn()} onResumeRenewal={onResumeRenewal} />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel renewal' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Resume renewal' }));
    expect(onResumeRenewal).toHaveBeenCalledTimes(1);
  });

  it('an operator\'s assignment: the badge, "Ends on", and neither cancel nor resume', () => {
    render(
      <SubscriptionPlanCard
        plan={pro}
        isCurrent
        assignedByOperator
        renewal={{ date: '2026-12-17', ends: true }}
        onCancelRenewal={vi.fn()}
        onResumeRenewal={vi.fn()}
      />,
    );
    expect(screen.getByText('Assigned by the operator')).toBeInTheDocument();
    expect(screen.getByText('Ends on Dec 17, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
