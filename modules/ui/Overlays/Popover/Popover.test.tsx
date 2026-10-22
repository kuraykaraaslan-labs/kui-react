import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from './index';

describe('Popover', () => {
  it('caps its wrapper at the container width only with shrinkTrigger', () => {
    const { container, rerender } = render(<Popover trigger={<button>Open</button>}>Panel</Popover>);
    expect((container.firstChild as HTMLElement).className).toBe('relative inline-block');
    rerender(<Popover shrinkTrigger trigger={<button>Open</button>}>Panel</Popover>);
    expect((container.firstChild as HTMLElement).className).toBe('relative inline-block max-w-full');
  });

  it('is closed by default', () => {
    render(<Popover trigger={<button>Open</button>}>Panel content</Popover>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on trigger click and moves focus into the panel', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>}>
        <button>First action</button>
      </Popover>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus());
  });

  it('Escape closes the panel and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>}>
        <button>First action</button>
      </Popover>,
    );
    const trigger = screen.getByText('Open');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('clicking outside the panel closes it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popover trigger={<button>Open</button>}>Panel content</Popover>
        <button>Outside</button>
      </div>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focusTrap={false} skips the initial focus move', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>} focusTrap={false}>
        <button>First action</button>
      </Popover>,
    );
    const trigger = screen.getByText('Open');
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Give the (skipped) initial-focus timeout a tick to *not* fire.
    await new Promise((r) => setTimeout(r, 10));
    expect(trigger).toHaveFocus();
  });

  it('controlled: open and onOpenChange drive it, and a button inside can close it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Popover trigger={<button>Open</button>} open={false} onOpenChange={onOpenChange}>
        <button>Apply</button>
      </Popover>,
    );
    await user.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <button onClick={() => onOpenChange(false)}>Apply</button>
      </Popover>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

