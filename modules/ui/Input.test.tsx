import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Input } from './Input';

describe('Input', () => {
  it('hideLabel keeps the label as the accessible name, visually hidden (phase 11.16)', () => {
    render(<Input id="qty" label="Quantity" hideLabel />);
    const input = screen.getByLabelText('Quantity');
    expect(input.tagName).toBe('INPUT');
    expect(document.querySelector('label[for="qty"]')).toHaveClass('sr-only');
  });

  it('renders with a label linked via htmlFor/id', () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('required shows the visible marker and an accessible "(required)" text', () => {
    render(<Input id="name" label="Name" required />);
    expect(screen.getByText('(required)')).toBeInTheDocument();
    // The accessible name includes the sr-only "(required)" suffix, so match
    // by id rather than the full computed label text.
    expect(document.getElementById('name')).toBeRequired();
  });

  it('error sets aria-invalid and aria-describedby, and renders role="alert"', () => {
    render(<Input id="pw" label="Password" error="Too short" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Too short');
    expect(input).toHaveAttribute('aria-describedby', message.id);
  });

  it('hint renders and is wired via aria-describedby when there is no error/success', () => {
    render(<Input id="bio" label="Bio" hint="Max 200 characters" />);
    const input = screen.getByLabelText('Bio');
    const hint = screen.getByText('Max 200 characters');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });

  it('a type="password" field starts masked and toggles to visible text', async () => {
    const user = userEvent.setup();
    render(<Input id="pw2" label="Password" type="password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('clearable shows a Clear button only when there is a value, and it calls onClear', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Input id="q" label="Search" clearable value="" onChange={() => {}} onClear={onClear} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    rerender(<Input id="q" label="Search" clearable value="abc" onChange={() => {}} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('showCount + maxLength renders a live character count', () => {
    render(<Input id="tw" label="Tweet" value="hello" onChange={() => {}} showCount maxLength={10} />);
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('forwards the ref to the underlying <input> element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input id="ref-test" label="Ref test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.id).toBe('ref-test');
  });

  it('readOnly disables editing and shows the "(read-only)" label suffix', () => {
    render(<Input id="ro" label="Locked" readOnly value="fixed" onChange={() => {}} />);
    expect(screen.getByText('(read-only)')).toBeInTheDocument();
    // Same reasoning as the "required" test above: the label's visible text
    // includes the "(read-only)" suffix, so query by id.
    expect(document.getElementById('ro')).toHaveAttribute('readonly');
  });
});
