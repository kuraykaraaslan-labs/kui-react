'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the viewer asks for reduced motion (false on the server). Running parts then stand still. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches,
    () => false,
  );
}
