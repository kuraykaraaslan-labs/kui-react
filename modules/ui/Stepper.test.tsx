import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('names each step with its state', () => {
    render(
      <Stepper
        orientation="vertical"
        steps={[
          { label: 'Hazard', state: 'complete' },
          { label: 'Shelters', state: 'warning' },
          { label: 'Report', state: 'pending' },
        ]}
      />
    );
    expect(screen.getByLabelText('Step 2: Shelters — warning')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 3: Report — pending')).toBeInTheDocument();
  });

  it('draws a warning step hollow, with a mark instead of its number', () => {
    render(<Stepper steps={[{ label: 'Shelters', state: 'warning' }]} />);
    const circle = screen.getByLabelText('Step 1: Shelters — warning');
    expect(circle.className).toMatch(/\bbg-warning-subtle\b/);
    expect(circle.className).toMatch(/\bborder-warning\b/);
    expect(circle.querySelector('svg')).not.toBeNull();
    expect(circle).not.toHaveTextContent('1');
  });

  it('continues the line after a warning step in the warning colour (the step ran)', () => {
    const { container } = render(
      <Stepper
        orientation="vertical"
        steps={[
          { label: 'Shelters', state: 'warning' },
          { label: 'Report', state: 'pending' },
        ]}
      />
    );
    expect(container.querySelector('[aria-hidden="true"].bg-warning')).not.toBeNull();
  });
});
