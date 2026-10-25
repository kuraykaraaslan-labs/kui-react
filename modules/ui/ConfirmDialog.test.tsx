import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, cancelAllConfirms, confirmDialog, confirmReady } from './ConfirmDialog';

const base = { open: true, title: 'Delete user', confirmLabel: 'Delete', onConfirm: () => {}, onCancel: () => {} };

describe('ConfirmDialog', () => {
  it('shows the title, the message and the two buttons; confirm resolves an empty value', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} message="Ada Lovelace and her data are deleted." onConfirm={onConfirm} />);
    expect(screen.getByText('Delete user')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace and her data are deleted.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith({ value: '', choice: 'confirm' });
  });

  it('Cancel calls onCancel, not onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('danger tone gives the confirm button the danger variant', () => {
    render(<ConfirmDialog {...base} tone="danger" />);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-error');
  });

  it('a required input locks the confirm button until it has text, and returns it trimmed', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} input={{ kind: 'textarea', label: 'Reason', required: true }} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), '  duplicate record  ');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledWith({ value: 'duplicate record', choice: 'confirm' });
  });

  it('minLength counts the trimmed text', () => {
    const input = { kind: 'text' as const, label: 'Reason', minLength: 3 };
    expect(confirmReady({ input }, { value: ' ab ', acknowledged: false, typed: '' })).toBe(false);
    expect(confirmReady({ input }, { value: 'abc', acknowledged: false, typed: '' })).toBe(true);
  });

  it('a date input refuses anything but YYYY-MM-DD', () => {
    const input = { kind: 'date' as const, label: 'From', required: true };
    expect(confirmReady({ input }, { value: '25.10.2026', acknowledged: false, typed: '' })).toBe(false);
    expect(confirmReady({ input }, { value: '2026-10-25', acknowledged: false, typed: '' })).toBe(true);
  });

  it('the acknowledgement must be ticked before confirming', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} acknowledgement="I understand this cannot be undone." />);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone.' }));
    expect(button).toBeEnabled();
  });

  it('the phrase must be typed exactly', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} phrase="REBOOT" phraseLabel="Type REBOOT" />);
    const field = screen.getByLabelText('Type REBOOT');
    const button = screen.getByRole('button', { name: 'Delete' });
    await user.type(field, 'reboot');
    expect(button).toBeDisabled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.clear(field);
    await user.type(field, 'REBOOT');
    expect(button).toBeEnabled();
  });

  it('every gate together: all three must be met', () => {
    const props = { input: { kind: 'text' as const, label: 'Reason', required: true }, acknowledgement: 'ok', phrase: 'X' };
    expect(confirmReady(props, { value: 'r', acknowledged: true, typed: '' })).toBe(false);
    expect(confirmReady(props, { value: 'r', acknowledged: false, typed: 'X' })).toBe(false);
    expect(confirmReady(props, { value: '', acknowledged: true, typed: 'X' })).toBe(false);
    expect(confirmReady(props, { value: 'r', acknowledged: true, typed: 'X' })).toBe(true);
  });

  it('Enter in a single-line field confirms', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} input={{ kind: 'text', label: 'Name', required: true }} onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/Name/), 'Reports{Enter}');
    expect(onConfirm).toHaveBeenCalledWith({ value: 'Reports', choice: 'confirm' });
  });

  it('the secondary action resolves with choice secondary', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} confirmLabel="Keep mine" secondaryLabel="Load theirs" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Load theirs' }));
    expect(onConfirm).toHaveBeenCalledWith({ value: '', choice: 'secondary' });
  });

  it('busy disables both buttons and an error shows in the footer', () => {
    render(<ConfirmDialog {...base} busy error="The user could not be deleted." />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('The user could not be deleted.');
  });

  it('reopening clears what was entered last time', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ConfirmDialog {...base} input={{ kind: 'text', label: 'Reason' }} />);
    await user.type(screen.getByLabelText('Reason'), 'old');
    rerender(<ConfirmDialog {...base} open={false} input={{ kind: 'text', label: 'Reason' }} />);
    rerender(<ConfirmDialog {...base} input={{ kind: 'text', label: 'Reason', defaultValue: 'new' }} />);
    expect(screen.getByLabelText('Reason')).toHaveValue('new');
  });
});

// vitest.setup.ts mounts one ConfirmHost per test.
describe('confirmDialog + ConfirmHost', () => {
  it('cancelAllConfirms answers every waiting request with null', async () => {
    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => { a = confirmDialog({ title: 'A' }); b = confirmDialog({ title: 'B' }); });
    expect(await screen.findByText('A')).toBeInTheDocument();
    act(() => cancelAllConfirms());
    await expect(a).resolves.toBeNull();
    await expect(b).resolves.toBeNull();
  });

  it('resolves the result on confirm and null on cancel, one request at a time', async () => {
    const user = userEvent.setup();
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = confirmDialog({ title: 'First', confirmLabel: 'Yes' });
      second = confirmDialog({ title: 'Second', confirmLabel: 'Yes' });
    });
    expect(await screen.findByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await expect(first).resolves.toEqual({ value: '', choice: 'confirm' });
    expect(await screen.findByText('Second')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBeNull();
  });

  it('an action that throws keeps the dialog open with the error; a retry that succeeds resolves', async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValueOnce(new Error('Server said no')).mockResolvedValueOnce(undefined);
    let answer!: Promise<unknown>;
    act(() => { answer = confirmDialog({ title: 'Revoke key', confirmLabel: 'Revoke', tone: 'danger', action }); });
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await expect(answer).resolves.toEqual({ value: '', choice: 'confirm' });
    expect(action).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
