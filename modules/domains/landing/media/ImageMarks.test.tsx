import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { ImageMarks, resolveMarks } from './ImageMarks';

afterEach(cleanup);

describe('ImageMarks', () => {
  it('gives 2D / 3D / Map their icons, keeps a given icon, drops empties and keeps three', () => {
    const r = resolveMarks(['2D', ' ', '3B', { label: 'Live', icon: faStar }, 'Map']);
    expect(r.map((m) => m.label)).toEqual(['2D', '3B', 'Live']);
    expect(r.every((m) => m.icon)).toBe(true);
    expect(r[2].icon).toBe(faStar);
    expect(resolveMarks(['Scheduler'])[0].icon).toBeUndefined();
  });

  it('renders the marks as text, and nothing without marks', () => {
    const { container, rerender } = render(<ImageMarks marks={['2D', '<b>x</b>']} />);
    expect(screen.getByText('2D')).toBeInTheDocument();
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    rerender(<ImageMarks marks={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
