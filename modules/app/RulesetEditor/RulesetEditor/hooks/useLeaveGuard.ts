'use client';
import { useCallback, useEffect, useRef } from 'react';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';

/**
 * A guard against losing a change by leaving the page. While `active`, closing the tab or reloading asks the browser
 * to confirm (`beforeunload`; the browser shows its own text, not ours), and `confirmLeave()` asks (the kit's ConfirmDialog) for a page's own
 * links (the flow list, a breadcrumb, a flow tab that leaves the page): true when it is fine to go. Not active, it
 * does nothing, so a host switches it on only while a change is not yet kept anywhere (the server draft).
 */
export function useLeaveGuard(
  active: boolean,
  message: string,
  labels: { title: string; leave: string; stay: string } = { title: 'Leave without saving', leave: 'Leave', stay: 'Stay' },
): { active: boolean; confirmLeave: () => Promise<boolean> } {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
  const latest = useRef({ active, message, labels });
  useEffect(() => { latest.current = { active, message, labels }; });
  const confirmLeave = useCallback(async () => {
    const { active: on, message: text, labels: l } = latest.current;
    if (!on) return true;
    return !!(await confirmDialog({ title: l.title, message: text, tone: 'warning', confirmLabel: l.leave, cancelLabel: l.stay }));
  }, []);
  return { active, confirmLeave };
}
