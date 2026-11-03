import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BeforeAfter } from './BeforeAfter';

afterEach(cleanup);
const P = [{ before: '/b.jpg', after: '/a.jpg', beforeAlt: 'Old kitchen', afterAlt: 'New kitchen', caption: 'Kitchen' }];

describe('BeforeAfter', () => {
  it('the slider is a range input that moves the cut', () => {
    const { container } = render(<BeforeAfter pairs={P} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Before / After' }), { target: { value: '25' } });
    expect((container.querySelector('[data-before-after] > div') as HTMLElement).style.clipPath).toBe('inset(0 0 0 25%)');
    expect(screen.getByRole('img', { name: 'Old kitchen' })).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
  });

  it('side by side, with labels in another language, and nothing without pairs', () => {
    const { container, rerender } = render(<BeforeAfter pairs={P} mode="side-by-side" labels={{ before: 'Önce', after: 'Sonra' }} />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('Önce')).toBeInTheDocument();
    rerender(<BeforeAfter pairs={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
