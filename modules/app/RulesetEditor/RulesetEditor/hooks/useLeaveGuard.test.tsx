import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLeaveGuard } from './useLeaveGuard';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe({ active, onGuard }: { active: boolean; onGuard: (g: ReturnType<typeof useLeaveGuard>) => void }) {
  onGuard(useLeaveGuard(active, 'Leave without saving?'));
  return null;
}
const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e; };

describe('useLeaveGuard', () => {
  it('asks the browser to confirm a reload or close only while active', () => {
    const { rerender } = render(<Probe active={false} onGuard={() => undefined} />);
    expect(unload().defaultPrevented).toBe(false);
    rerender(<Probe active onGuard={() => undefined} />);
    expect(unload().defaultPrevented).toBe(true);
    rerender(<Probe active={false} onGuard={() => undefined} />);
    expect(unload().defaultPrevented).toBe(false);
  });
  it('removes the listener when it unmounts', () => {
    const { unmount } = render(<Probe active onGuard={() => undefined} />);
    unmount();
    expect(unload().defaultPrevented).toBe(false);
  });
  it('confirmLeave asks (the kit ConfirmDialog) only while active, and says what the user answered', async () => {
    const user = userEvent.setup();
    let guard!: ReturnType<typeof useLeaveGuard>;
    const { rerender } = render(<Probe active={false} onGuard={(g) => { guard = g; }} />);
    expect(await guard.confirmLeave()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Probe active onGuard={(g) => { guard = g; }} />);
    let answer!: Promise<boolean>;
    act(() => { answer = guard.confirmLeave(); });
    expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(await answer).toBe(false);
    act(() => { answer = guard.confirmLeave(); });
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await answer).toBe(true);
  });
});
