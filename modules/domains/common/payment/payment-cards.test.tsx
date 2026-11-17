import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreditCardVisual, maskCardNumber } from './CreditCardVisual';
import { SavedCardSelector } from './SavedCardSelector';
import type { SavedCard } from '../PaymentTypes';

describe('CreditCardVisual', () => {
  it('groups 16 digits by four and AMEX 4-6-5, padding with dots', () => {
    expect(maskCardNumber('4111', 'VISA')).toBe('4111 •••• •••• ••••');
    expect(maskCardNumber('378282246310005', 'AMEX')).toBe('3782 822463 10005');
  });

  it('keeps every digit of a 17–19 digit card and sets it smaller', () => {
    expect(maskCardNumber('6200000000000000005', 'UNIONPAY')).toBe('6200 0000 0000 0000 005');
    const { container } = render(<CreditCardVisual brand="UNIONPAY" cardNumber="6200000000000000005" />);
    const number = within(container).getByText('6200 0000 0000 0000 005');
    expect(number).toHaveClass('text-sm');
  });

  it('draws the chip and the CVV panel from tokens, with translated labels', () => {
    const { container } = render(<CreditCardVisual brand="VISA" messages={{ cardHolder: 'Kart sahibi', expires: 'Son kullanma' }} />);
    expect(within(container).getByText('Kart sahibi')).toBeInTheDocument();
    expect(within(container).getByText('Son kullanma')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/bg-yellow|text-gray|bg-white\/90/);
    expect(container.querySelector('.bg-warning\\/80')).not.toBeNull();
  });
});

const cards: SavedCard[] = [
  { cardId: 'c1', last4: '4242', brand: 'VISA', cardholderName: 'Jane', expiryMonth: '08', expiryYear: '28', isDefault: true },
  { cardId: 'c2', last4: '5559', brand: 'MASTERCARD', cardholderName: 'Jane', expiryMonth: '12', expiryYear: '27' },
];

describe('SavedCardSelector', () => {
  it('shows the shared brand chip', () => {
    render(<SavedCardSelector cards={cards} onSelect={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Visa' })).toHaveTextContent('VISA');
    expect(screen.getByRole('img', { name: 'Mastercard' })).toHaveTextContent('MC');
  });

  it('removes a card only after the ConfirmDialog', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<SavedCardSelector cards={cards} onSelect={vi.fn()} onRemove={onRemove} />);
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(onRemove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Remove card' });
    expect(dialog).toHaveTextContent('The card ending in 5559 is removed from your saved cards.');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('c2');
  });
});
