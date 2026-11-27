'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';

export type PromoCouponProps = {
  code: string;
  /** Text before the code ("Code"). */
  label: string;
  /** Copy button name before copying ("Copy code"). */
  copyLabel: string;
  /** Button name and the polite announcement after copying ("Copied"). */
  copiedLabel: string;
  size?: 'sm' | 'md';
  onCopy?: (code: string) => void;
  className?: string;
};

/**
 * A coupon code with a copy button: the DescriptionList copy pattern (clipboard, check icon and "copied" name for
 * 1.5 s) plus a visually hidden status line so screen readers hear that the copy worked.
 */
export function PromoCoupon({ code, label, copyLabel, copiedLabel, size = 'md', onCopy, className }: PromoCouponProps) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clipboard?.writeText) return;
    void clipboard.writeText(code).then(() => {
      setDone(true);
      onCopy?.(code);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1500);
    }, () => {});
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface-base ps-2.5 pe-1',
        size === 'sm' ? 'py-0.5' : 'py-1',
        className,
      )}
      data-part="coupon"
    >
      <span className="text-xs text-text-secondary">{label}</span>
      <code className={cn('font-mono font-semibold tracking-wide text-text-primary', size === 'sm' ? 'text-xs' : 'text-sm')}>{code}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={done ? copiedLabel : copyLabel}
        title={done ? copiedLabel : copyLabel}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        data-part="copy"
      >
        <FontAwesomeIcon icon={done ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">{done ? copiedLabel : ''}</span>
    </span>
  );
}
