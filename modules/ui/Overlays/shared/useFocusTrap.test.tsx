import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { useFocusTrap } from './useFocusTrap';

// useFocusTrap needs a real DOM container with focusable children to trap
// between, so these use `render()` with a small harness component rather
// than `renderHook()` in isolation.

function TrapHarness({
  active,
  onEscape,
  handleEscape,
}: {
  active: boolean;
  onEscape?: () => void;
  handleEscape?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { active, onEscape, handleEscape });
  return (
    <div>
      <button>Outside before</button>
      <div ref={ref} data-testid="trap">
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </div>
      <button>Outside after</button>
    </div>
  );
}

function ToggleableTrapHarness() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { active, onEscape: () => setActive(false) });
  return (
    <div>
      <button onClick={() => setActive(true)}>Trigger</button>
      {active && (
        <div ref={ref}>
          <button>Inside</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the container (first focusable child) shortly after activating', async () => {
    render(<TrapHarness active onEscape={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
  });

  it('focuses the container itself when it has no focusable children', async () => {
    function EmptyTrap() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, { active: true });
      return (
        <div>
          <button>Outside</button>
          <div ref={ref} tabIndex={-1} data-testid="empty-trap" />
        </div>
      );
    }
    render(<EmptyTrap />);
    await waitFor(() => expect(screen.getByTestId('empty-trap')).toHaveFocus());
  });

  it('Tab from the last focusable element wraps to the first', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active onEscape={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    screen.getByRole('button', { name: 'Last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('Shift+Tab from the first focusable element wraps to the last', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active onEscape={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('leaves Tab to a dialog layered over it (one not on the stack, a confirm portaled to <body>), and still pulls stray focus back', async () => {
    render(
      <>
        <TrapHarness active onEscape={() => {}} />
        <div role="alertdialog" aria-label="Discard?"><button>Keep</button><button>Discard</button></div>
      </>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    const keep = screen.getByRole('button', { name: 'Keep' });
    keep.focus();
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    keep.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(false);
    expect(keep).toHaveFocus();
    // focus outside every dialog is still the trap's to bring back
    screen.getByRole('button', { name: 'Outside after' }).focus();
    const stray = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(stray);
    expect(stray.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('calls onEscape when Escape is pressed while active', async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<TrapHarness active onEscape={onEscape} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores an Escape an inner control already handled (defaultPrevented)', async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    function InnerHandledHarness() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, { active: true, onEscape });
      return (
        <div ref={ref}>
          <button onKeyDown={(e) => { if (e.key === 'Escape') e.preventDefault(); }}>Handles Escape</button>
          <button>Plain</button>
        </div>
      );
    }
    render(<InnerHandledHarness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Handles Escape' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onEscape).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Plain' }).focus();
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not call onEscape when handleEscape is false', async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<TrapHarness active onEscape={onEscape} handleEscape={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does nothing when not active (no initial focus move, Tab behaves normally)', async () => {
    render(<TrapHarness active={false} onEscape={() => {}} />);
    // Give the (non-existent, since inactive) initial-focus timeout a tick
    // to *not* fire.
    await new Promise((r) => setTimeout(r, 10));
    expect(document.body).toHaveFocus();
  });

  it('restores focus to the trigger that opened it, once it deactivates', async () => {
    const user = userEvent.setup();
    render(<ToggleableTrapHarness />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.click(trigger); // activates the trap
    await waitFor(() => expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus());

    await user.keyboard('{Escape}'); // deactivates it (onEscape -> setActive(false))
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
