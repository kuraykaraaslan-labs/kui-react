'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route-aware auto-close: an overlay with `closeOnRouteChange` calls `onClose`
 * when the Next.js pathname changes while it is open — the nav-drawer case,
 * where a link inside the drawer navigates client-side and the drawer would
 * otherwise stay over the new page. Query-string changes do not close it:
 * reading them (useSearchParams) would force every statically rendered page
 * that shows an overlay into a Suspense boundary. Outside the App Router
 * usePathname returns null, so nothing ever closes.
 */

type Options = {
  active: boolean;
  closeOnRouteChange?: boolean;
  onClose: () => void;
};

export function useRouteClose({ active, closeOnRouteChange, onClose }: Options): void {
  const pathname = usePathname();
  const last = useRef(pathname);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    if (active && closeOnRouteChange) onClose();
  }, [pathname, active, closeOnRouteChange, onClose]);
}
