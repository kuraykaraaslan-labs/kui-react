import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('applies the variant class for every variant', () => {
    const variants = {
      primary: 'bg-primary',
      secondary: 'bg-surface-overlay',
      accent: 'bg-accent',
      ghost: 'bg-transparent',
      danger: 'bg-error',
      outline: 'border-border',
    } as const;
    for (const [variant, expectedClass] of Object.entries(variants)) {
      const { unmount } = render(<Button variant={variant as keyof typeof variants}>x</Button>);
      expect(screen.getByRole('button').className).toContain(expectedClass);
      unmount();
    }
  });

  it('secondary is neutral (surface tokens); accent carries the brand\'s second colour', () => {
    const { unmount } = render(<Button variant="secondary">Cancel</Button>);
    const secondary = screen.getByRole('button').className;
    expect(secondary).toContain('text-text-primary');
    expect(secondary).not.toMatch(/\b(?:bg|text|hover:bg)-(?:secondary|accent)/);
    unmount();
    render(<Button variant="accent">Import</Button>);
    const accent = screen.getByRole('button').className;
    expect(accent).toContain('text-accent-fg');
    expect(accent).toContain('hover:bg-accent-hover');
  });

  it('disabled sets the attribute and the disabled: classes', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
    expect(button.className).toContain('disabled:cursor-not-allowed');
  });

  it('loading sets aria-busy and shows a spinner instead of the icons', () => {
    render(
      <Button loading iconLeft={<span data-testid="icon-left" />} iconRight={<span data-testid="icon-right" />}>
        Loading
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('icon-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-right')).not.toBeInTheDocument();
  });

  it('selected sets aria-pressed and a focus ring', () => {
    render(<Button selected>Toggle</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toContain('ring-2');
  });

  it('is not aria-pressed by default', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('fires onClick on a real click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Enter and Space (native <button> keyboard semantics)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as a different element via the polymorphic "as" prop, without a type attribute', () => {
    render(
      <Button as="a" href="/somewhere">
        Link button
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link button' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/somewhere');
    expect(link).not.toHaveAttribute('type');
  });

  it('merges a custom className via cn() rather than replacing the built-in classes', () => {
    render(<Button className="my-custom-class">x</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('my-custom-class');
    expect(button.className).toContain('rounded-md');
  });
});
