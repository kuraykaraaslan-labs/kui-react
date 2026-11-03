import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QuoteCalculator, quoteEstimate } from './QuoteCalculator';

afterEach(cleanup);

describe('QuoteCalculator', () => {
  it('adds the base, the rates and the chosen extras, and rounds', () => {
    const inputs = [{ label: 'Area', unit: 'm²', min: 20, max: 200, rate: 2 }];
    expect(quoteEstimate(100, inputs, [80], [{ label: 'Packing', price: 55 }], [true], 10)).toBe(320);
    expect(quoteEstimate(0, inputs, [80], [], [], 1)).toBe(160);
  });

  it('moves with the slider, writes the sum out and links to the form with the estimate', () => {
    render(<QuoteCalculator title="Cost" currency="€" baseFee={100} locale="en" ctaHref="/contact" inputs={[{ label: 'Area', unit: 'm²', min: 20, max: 200, step: 5, value: 50, rate: 2 }]} extras={[{ label: 'Packing', price: 40 }]} />);
    expect(screen.getByText('€200')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Packing/ }));
    expect(screen.getByText('€340')).toBeInTheDocument();
    expect(screen.getByText('Base €100 + 100 m² × €2 + Packing €40')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get an exact quote' })).toHaveAttribute('href', '/contact?estimate=340');
  });
});
