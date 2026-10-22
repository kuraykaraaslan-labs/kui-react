'use client';
import { useEffect, useState } from 'react';

/**
 * Id of the last element (in `ids` order) whose top has crossed `offset` px from
 * the viewport top — the first one before any has. Used by TableOfContents.
 *
 * The IntersectionObserver only says *when* to recompute; a position scan decides
 * *what* is active, so a fast scroll past several headings still lands right.
 */
export function useScrollSpy(ids: string[], offset = 80): string | undefined {
  const key = ids.join('\n');
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    if (!key || typeof IntersectionObserver === 'undefined') return;
    const elements = key
      .split('\n')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const pick = () => {
      let current = elements[0].id;
      for (const el of elements) {
        if (el.getBoundingClientRect().top - offset <= 1) current = el.id;
        else break;
      }
      setActive(current);
    };

    const observer = new IntersectionObserver(pick, { rootMargin: `-${offset}px 0px 0px 0px`, threshold: [0, 1] });
    elements.forEach((el) => observer.observe(el));
    pick();
    return () => observer.disconnect();
  }, [key, offset]);

  return active;
}
