import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentMethodList, paymentMethodName, type SavedPaymentMethod } from './PaymentMethodList';

const visa: SavedPaymentMethod = {
  methodId: 'pm_visa', kind: 'card', brand: 'VISA', last4: '4242', expiryMonth: '08', expiryYear: '28',
  holderName: 'Jane Doe', provider: 'iyzico', status: 'active', isDefault: true,
};
const mc: SavedPaymentMethod = {
  methodId: 'pm_mc', kind: 'card', brand: 'MASTERCARD', last4: '5559', expiryMonth: '12', expiryYear: '2026', status: 'expiring',
};
const sepa: SavedPaymentMethod = { methodId: 'pm_sepa', kind: 'sepa', last4: '3000', provider: 'Stripe', status: 'requires_reauth' };
const paypal: SavedPaymentMethod = { methodId: 'pm_pp', kind: 'agreement', label: 'PayPal billing agreement', status: 'revoked' };

const table = () => screen.getByRole('table');
const rowOf = (text: string) => within(table()).getByText(text).closest('tr') as HTMLElement;
const openActions = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('button', { name: `Actions for ${name}` }));

describe('PaymentMethodList', () => {
  it('lists every kind with its brand chip, last four, expiry, status and the default marker', () => {
    render(<PaymentMethodList methods={[visa, mc, sepa, paypal]} />);
    const v = rowOf('•••• 4242');
    expect(within(v).getByRole('img', { name: 'Visa' })).toHaveTextContent('VISA');
    expect(within(v).getByText('08/28')).toBeInTheDocument();
    expect(within(v).getByText('Active')).toBeInTheDocument();
    expect(within(v).getByText('Default')).toBeInTheDocument();
    expect(within(v).getByText('Jane Doe · iyzico')).toBeInTheDocument();
    expect(within(rowOf('•••• 5559')).getByText('12/26')).toBeInTheDocument();
    expect(within(rowOf('•••• 5559')).getByText('Expiring')).toBeInTheDocument();
    expect(within(rowOf('•••• 3000')).getByText('SEPA Direct Debit · Stripe')).toBeInTheDocument();
    expect(within(rowOf('•••• 3000')).getByText('Needs re-authorisation')).toBeInTheDocument();
    expect(within(rowOf('PayPal billing agreement')).getByText('Revoked')).toBeInTheDocument();
    expect(within(rowOf('PayPal billing agreement')).getByText('—')).toBeInTheDocument();
  });

  it('puts the default first and sorts by its columns', () => {
    render(<PaymentMethodList methods={[mc, sepa, visa]} />);
    const firstRow = within(table()).getAllByRole('row')[1];
    expect(firstRow).toHaveTextContent('•••• 4242');
    expect(screen.getByRole('button', { name: /Expires/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();
  });

  it('makes a method the default at once; the default and unusable methods offer no "Make default"', async () => {
    const user = userEvent.setup();
    const onMakeDefault = vi.fn();
    render(<PaymentMethodList methods={[visa, mc, sepa]} onMakeDefault={onMakeDefault} />);
    await openActions(user, 'Mastercard •••• 5559');
    await user.click(screen.getByRole('menuitem', { name: 'Make default' }));
    expect(onMakeDefault).toHaveBeenCalledWith(expect.objectContaining({ methodId: 'pm_mc' }));
    // the default and a method that needs re-authorisation have no actions at all
    expect(screen.queryByRole('button', { name: 'Actions for Visa •••• 4242' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Actions for SEPA Direct Debit •••• 3000' })).toBeNull();
  });

  it('removes only after the ConfirmDialog', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<PaymentMethodList methods={[visa, mc]} onRemove={onRemove} />);
    await openActions(user, 'Mastercard •••• 5559');
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onRemove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Remove payment method' });
    expect(dialog).toHaveTextContent('Mastercard •••• 5559 is removed. It will not be charged again.');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ methodId: 'pm_mc' }));
    expect(screen.queryByRole('dialog', { name: 'Remove payment method' })).toBeNull();
  });

  it('keeps the dialog open with the error when the removal fails', async () => {
    const user = userEvent.setup();
    render(<PaymentMethodList methods={[visa, mc]} onRemove={() => Promise.reject(new Error('Gateway down'))} />);
    await openActions(user, 'Mastercard •••• 5559');
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove payment method' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await within(dialog).findByText('Gateway down')).toBeInTheDocument();
  });

  it('in use: the default cannot be removed while others exist, and removing the last says renewals become payment requests', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PaymentMethodList methods={[visa, mc]} onRemove={vi.fn()} inUse />);
    await openActions(user, 'Visa •••• 4242');
    const item = screen.getByRole('menuitem', { name: /Remove/ });
    expect(item).toBeDisabled();
    expect(screen.getByText('Make another method the default first.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    rerender(<PaymentMethodList methods={[visa]} onRemove={vi.fn()} inUse />);
    await openActions(user, 'Visa •••• 4242');
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(screen.getByRole('dialog', { name: 'Remove payment method' })).toHaveTextContent(
      'Visa •••• 4242 is your last payment method. Renewals will no longer be charged automatically',
    );
  });

  it('has the "Add payment method" header action and an empty state that offers it too', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PaymentMethodList methods={[]} onAdd={onAdd} />);
    expect(screen.getByText('No saved payment methods')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Add payment method' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows the loading state', () => {
    render(<PaymentMethodList methods={[]} loading />);
    expect(screen.getByText('Loading payment methods…')).toBeInTheDocument();
  });

  it('read-only: no add button and no row actions, whatever handlers are passed', () => {
    render(<PaymentMethodList methods={[visa, mc]} readOnly onAdd={vi.fn()} onRemove={vi.fn()} onMakeDefault={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add payment method' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });

  it('takes its strings from messages', () => {
    render(<PaymentMethodList methods={[visa]} messages={{ title: 'Ödeme yöntemleri', statusActive: 'Etkin', isDefault: 'Varsayılan' }} />);
    expect(screen.getByText('Ödeme yöntemleri')).toBeInTheDocument();
    expect(screen.getByText('Etkin')).toBeInTheDocument();
    expect(within(rowOf('•••• 4242')).getByText('Varsayılan')).toBeInTheDocument();
  });

  it('names a method in one line', () => {
    expect(paymentMethodName(visa)).toBe('Visa •••• 4242');
    expect(paymentMethodName(paypal)).toBe('PayPal billing agreement');
    expect(paymentMethodName({ methodId: 'x', kind: 'mandate', status: 'active' })).toBe('Direct debit mandate');
  });
});
