'use client';
import { cn } from '@/libs/utils/cn';
import { Input } from '@/modules/ui/Input';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import { PROFILE_RANGES, type ProfileRangeKey } from '../types/profile';

/*
 * Small pieces the profile sections share: a ranged number input (the range is the hint, the issue the error) and a titled section.
 * Domain-internal; not exported from the vertical's barrel.
 */

export function RangeNumberField({
  id, label, range, value, onChange, error, hint, nullable, step = 1, disabled,
}: {
  id: string;
  label: string;
  range: ProfileRangeKey;
  value: number | null;
  onChange: (v: number | null) => void;
  error?: string;
  hint?: string;
  /** An empty input is a valid value (null). */
  nullable?: boolean;
  step?: number;
  disabled?: boolean;
}) {
  const { m } = useIotText();
  const r = PROFILE_RANGES[range];
  return (
    <Input
      id={id}
      type="number"
      label={label}
      min={r.min}
      max={r.max}
      step={step}
      disabled={disabled}
      value={value === null || !Number.isFinite(value) ? '' : value}
      error={error}
      hint={hint ? `${hint} ${fill(m.limits.range, r)}` : fill(m.limits.range, r)}
      onChange={(e) => {
        const raw = e.target.value.trim();
        onChange(raw === '' ? (nullable ? null : Number.NaN) : Number(raw));
      }}
    />
  );
}

export function ProfileSection({ title, hint, children, className, actions }: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-3 rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
