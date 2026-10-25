'use client';
import { cn } from '@/libs/utils/cn';

const sizeMap = {
  xs:  'h-3 w-3 border',
  sm:  'h-4 w-4 border-2',
  md:  'h-6 w-6 border-2',
  lg:  'h-8 w-8 border-[3px]',
  xl:  'h-12 w-12 border-4',
};

export function Spinner({
  size = 'md',
  label = 'Loading…',
  className,
}: {
  size?: keyof typeof sizeMap;
  /**
   * Screen-reader text. `null` leaves it out, for a spinner whose visible text next to it already says it
   * (a "Loading…" message), so the words are not read or found twice.
   */
  label?: string | null;
  className?: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block rounded-full border-border border-t-primary animate-spin',
          sizeMap[size],
          className
        )}
      />
      {label !== null && <span className="sr-only">{label}</span>}
    </>
  );
}
