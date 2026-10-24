import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './index';

// Modal renders through a portal into document.body and its initial-focus
// effect in useFocusTrap is deferred via setTimeout(0), so assertions that
// depend on focus need a `waitFor`/`findBy*` tick rather than a synchronous
// check right after render.

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        content
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with title and description wired via aria-labelledby/aria-describedby', () => {
    render(
      <Modal open onClose={() => {}} title="Delete item" description="This cannot be undone.">
        Are you sure?
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Delete item').id).toBe(dialog.getAttribute('aria-labelledby'));
    expect(screen.getByText('This cannot be undone.').id).toBe(dialog.getAttribute('aria-describedby'));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('gives each open modal its own title id (a dialog opened from a dialog)', () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Outer">outer</Modal>
        <Modal open onClose={() => {}} title="Inner">inner</Modal>
      </>,
    );
    const [outer, inner] = screen.getAllByRole('dialog');
    expect(outer.getAttribute('aria-labelledby')).not.toBe(inner.getAttribute('aria-labelledby'));
    expect(document.getElementById(inner.getAttribute('aria-labelledby')!)?.textContent).toBe('Inner');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        content
      </Modal>,
    );
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on a backdrop click by default', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        content
      </Modal>,
    );
    // The Modal renders through a portal straight onto document.body, not
    // into RTL's `container` — query from `document` instead.
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on backdrop click when closeOnBackdropClick is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog" closeOnBackdropClick={false}>
        content
      </Modal>,
    );
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the close button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        content
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeLabel names the close button', () => {
    render(
      <Modal open onClose={() => {}} title="Dialog" closeLabel="Pencereyi kapat">
        content
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Pencereyi kapat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
  });

  it.each([
    ['sm', 'max-w-sm'],
    ['md', 'max-w-md'],
    ['lg', 'max-w-lg'],
    ['xl', 'max-w-xl'],
    ['full', 'max-w-none'],
  ] as const)('size="%s" gives the panel %s', (size, cls) => {
    render(
      <Modal open onClose={() => {}} title="Dialog" size={size}>
        content
      </Modal>,
    );
    const panel = screen.getByText('Dialog').closest('[tabindex="-1"]') as HTMLElement;
    expect(panel).toHaveClass(cls);
    expect(panel).toHaveClass('rounded-xl', 'w-full');
  });

  it('an Escape an inner control handled (defaultPrevented) does not close it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <input aria-label="Inner" onKeyDown={(e) => { if (e.key === 'Escape') e.preventDefault(); }} />
      </Modal>,
    );
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    screen.getByRole('textbox', { name: 'Inner' }).focus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the footer when given one', () => {
    render(
      <Modal open onClose={() => {}} title="Dialog" footer={<button>Confirm</button>}>
        content
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });
});
