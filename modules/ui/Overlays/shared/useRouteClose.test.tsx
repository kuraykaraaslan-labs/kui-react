import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let pathname: string | null = '/a';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

// vitest.setup mounts a ConfirmHost (Modal -> useRouteClose), so the hook is already loaded with the real
// next/navigation; load it again so it picks up the mock above.
vi.resetModules();
const { useRouteClose } = await import('./useRouteClose');

describe('useRouteClose', () => {
  beforeEach(() => {
    pathname = '/a';
  });

  const mount = (active: boolean, closeOnRouteChange: boolean | undefined) => {
    const onClose = vi.fn();
    const hook = renderHook((p: { active: boolean }) => useRouteClose({ active: p.active, closeOnRouteChange, onClose }), {
      initialProps: { active },
    });
    return { onClose, hook };
  };

  it('closes an open, opted-in overlay when the pathname changes', () => {
    const { onClose, hook } = mount(true, true);
    expect(onClose).not.toHaveBeenCalled();
    pathname = '/b';
    hook.rerender({ active: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the opt-in, while closed, or on a re-render at the same path', () => {
    const optOut = mount(true, undefined);
    const closed = mount(false, true);
    const same = mount(true, true);
    same.hook.rerender({ active: true });
    expect(same.onClose).not.toHaveBeenCalled();
    pathname = '/b';
    optOut.hook.rerender({ active: true });
    closed.hook.rerender({ active: false });
    expect(optOut.onClose).not.toHaveBeenCalled();
    expect(closed.onClose).not.toHaveBeenCalled();
  });

  it('opening later does not close for a path change that happened while closed', () => {
    const { onClose, hook } = mount(false, true);
    pathname = '/b';
    hook.rerender({ active: false });
    hook.rerender({ active: true });
    expect(onClose).not.toHaveBeenCalled();
  });
});
