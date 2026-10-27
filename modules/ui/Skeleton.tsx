'use client';
import { cn } from '@/libs/utils/cn';

const base = 'animate-pulse bg-surface-sunken';

export function SkeletonLine({ width = 'w-full', className }: { width?: string; className?: string }) {
  return <div className={cn(base, 'h-3 rounded', width, className)} />;
}

export function SkeletonAvatar({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }[size];
  return <div className={cn(base, 'rounded-full shrink-0', s, className)} />;
}

/** `label` is the accessible name of the busy region. */
export function SkeletonText({
  lines = 3,
  label = 'Loading content',
  className,
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? 'w-4/5' : 'w-full'} />
      ))}
    </div>
  );
}

export function SkeletonCard({ label = 'Loading content', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('bg-surface-raised border border-border rounded-xl p-6 space-y-4', className)}
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-2/3" />
          <SkeletonLine width="w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} label={label} />
      <div className="flex justify-between">
        <div className={cn(base, 'h-6 w-16 rounded')} />
        <div className={cn(base, 'h-6 w-20 rounded')} />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 4, className }: { cols?: number; className?: string }) {
  const widths = ['w-28', 'w-40', 'w-20', 'w-16'];
  return (
    <tr className={cn('border-b border-border', className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={cn(base, 'h-4 rounded', widths[i] ?? 'w-24')} />
        </td>
      ))}
    </tr>
  );
}
