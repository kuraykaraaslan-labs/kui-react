import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypedConfirmDialog } from './TypedConfirmDialog';

describe('TypedConfirmDialog', () => {
  it('confirms only after the exact phrase is typed, by button or Enter', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<TypedConfirmDialog open title="Reboot?" phrase="REBOOT" label="Type REBOOT" confirmLabel="Reboot" onConfirm={onConfirm} onCancel={vi.fn()} />);
    const confirm = screen.getByRole('button', { name: 'Reboot' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Type REBOOT'), 'reboot');
    expect(confirm).toBeDisabled();
    expect(screen.getByLabelText('Type REBOOT')).toHaveAttribute('aria-invalid', 'true');
    await user.clear(screen.getByLabelText('Type REBOOT'));
    await user.type(screen.getByLabelText('Type REBOOT'), 'REBOOT{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('starts empty each time it opens and cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(<TypedConfirmDialog open title="T" phrase="X" label="L" confirmLabel="Go" onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.type(screen.getByLabelText('L'), 'X');
    rerender(<TypedConfirmDialog open={false} title="T" phrase="X" label="L" confirmLabel="Go" onConfirm={vi.fn()} onCancel={onCancel} />);
    rerender(<TypedConfirmDialog open title="T" phrase="X" label="L" confirmLabel="Go" onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(await screen.findByLabelText('L')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
