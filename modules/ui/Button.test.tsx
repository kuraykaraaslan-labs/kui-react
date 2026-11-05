import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Button } from './Button';

// WCAG relative luminance and contrast ratio of two #rrggbb colours.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// The value of a token in the first block of `css` that opens with `selector`.
function token(css: string, selector: string, name: string): string {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (start < 0 || !match) throw new Error(`${name} not found in ${selector}`);
  return match[1];
}

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

  it('the accent tokens keep their label readable (WCAG AA 4.5:1) at rest and on hover, light and dark', () => {
    for (const file of ['styles/index.css', 'app/globals.css']) {
      const css = readFileSync(join(process.cwd(), file), 'utf8');
      for (const selector of [':root', '.dark']) {
        const fg = token(css, selector, '--accent-fg');
        for (const fill of ['--accent', '--accent-hover']) {
          expect(contrast(token(css, selector, fill), fg), `${file} ${selector} ${fill}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
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

  it('a loading native button is disabled (no second click), a link is not', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button onClick={onClick}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    rerender(<Button as="a" href="/x" loading>Open</Button>);
    expect(screen.getByRole('link', { name: 'Open' })).not.toHaveAttribute('disabled');
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
