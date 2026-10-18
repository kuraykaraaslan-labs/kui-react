import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from './index';

// Same portal/focus-trap-timing notes as Modal.test.tsx: Drawer renders via
// createPortal onto document.body (query from `document`, not RTL's
// `container`), and useFocusTrap's initial-focus effect is deferred via
// setTimeout(0).

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={() => {}} title="Hidden">
        content
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with the title as its accessible name (aria-label)', () => {
    render(
      <Drawer open onClose={() => {}} title="Filters">
        Filter controls
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Filter controls')).toBeInTheDocument();
  });

  it('defaults to the right side', () => {
    render(
      <Drawer open onClose={() => {}} title="Filters">
        content
      </Drawer>,
    );
    const panel = screen.getByText('Filters').closest('[data-state]') as HTMLElement;
    expect(panel.className).toContain('ml-auto');
  });

  it('side="left" renders on the left', () => {
    render(
      <Drawer open onClose={() => {}} title="Nav" side="left">
        content
      </Drawer>,
    );
    const panel = screen.getByText('Nav').closest('[data-state]') as HTMLElement;
    expect(panel.className).toContain('mr-auto');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        content
      </Drawer>,
    );
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on a backdrop click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        content
      </Drawer>,
    );
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the close button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Drawer open onClose={onClose} title="Filters">
        content
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeLabel names the close button, with and without a custom header', () => {
    const { rerender } = render(
      <Drawer open onClose={() => {}} title="Filters" closeLabel="Paneli kapat">
        content
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'Paneli kapat' })).toBeInTheDocument();
    rerender(
      <Drawer open onClose={() => {}} title="Filters" header={<span>Head</span>} closeLabel="Paneli kapat">
        content
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'Paneli kapat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close drawer' })).toBeNull();
  });

  it('renders the footer when given one', () => {
    render(
      <Drawer open onClose={() => {}} title="Filters" footer={<button>Apply</button>}>
        content
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});
