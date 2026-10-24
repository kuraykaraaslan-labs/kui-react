'use client';
import { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faRotateLeft, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { fill } from '../format';
import {
  DEFAULT_RATE_LIMITS, LIMIT_COUNT_MAX, LIMIT_SECONDS_MAX, LIMIT_WINDOWS_MAX, RATE_LIMIT_FAMILIES, formatLimitString, parseLimitString,
  type ProfileRateLimits, type RateLimitFamily,
} from '../types/profile';

/**
 * RateLimitEditor — the per-device rate limits of a profile in the protocol's notation (09 §2): each family is one or more windows
 * `count : seconds` ("10 per 1 s and 300 per 60 s"), at most four, each longer than the one before. A row edits its windows in place;
 * an invalid family keeps what was typed and is marked (the string it would send is shown), so the form blocks saving instead of
 * guessing. "Protocol default" puts the family back.
 */
export type RateLimitEditorProps = {
  value: ProfileRateLimits;
  onChange?: (next: ProfileRateLimits) => void;
  disabled?: boolean;
  /** Families with an error (already in words). */
  errors?: Partial<Record<RateLimitFamily, string>>;
  messages?: IotMessagesInput;
  className?: string;
};

type Row = { count: string; seconds: string };

const rowsOf = (raw: string): Row[] => {
  const parsed = parseLimitString(raw);
  if (parsed) return parsed.map((w) => ({ count: String(w.count), seconds: String(w.seconds) }));
  return raw.split(',').map((part) => {
    const [count = '', seconds = ''] = part.split(':');
    return { count, seconds };
  });
};
const stringOf = (rows: readonly Row[]) => rows.map((r) => `${r.count.trim()}:${r.seconds.trim()}`).join(',');

export function RateLimitEditor({ value, onChange, disabled, errors = {}, messages, className }: RateLimitEditorProps) {
  const { m } = useIotText(messages);
  const id = useId();
  return (
    <div className={cn('divide-y divide-border rounded-xl border border-border bg-surface-raised', className)}>
      {RATE_LIMIT_FAMILIES.map((family) => (
        <FamilyRow
          key={family}
          id={`${id}-${family}`}
          family={family}
          raw={value[family] ?? ''}
          disabled={disabled}
          error={errors[family]}
          onChange={(next) => onChange?.({ ...value, [family]: next })}
          m={m}
        />
      ))}
      <p className="px-4 py-2 text-xs text-text-secondary">{fill(m.limits.windowsHint, { n: LIMIT_WINDOWS_MAX })}</p>
    </div>
  );
}

function FamilyRow({ id, family, raw, disabled, error, onChange, m }: {
  id: string;
  family: RateLimitFamily;
  raw: string;
  disabled?: boolean;
  error?: string;
  onChange: (next: string) => void;
  m: ReturnType<typeof useIotText>['m'];
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsOf(raw));
  const [seen, setSeen] = useState(raw);
  // a change from outside (discard, reset) replaces what is typed; our own edits are already in `rows`
  if (raw !== seen) {
    setSeen(raw);
    if (stringOf(rows) !== raw) setRows(rowsOf(raw));
  }

  function update(next: Row[]) {
    setRows(next);
    setSeen(stringOf(next));
    onChange(stringOf(next));
  }
  const isDefault = raw === DEFAULT_RATE_LIMITS[family];
  const label = m.limits[`family_${family}`];
  const parsed = parseLimitString(raw);

  return (
    <div className="space-y-2 px-4 py-3" role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-text-primary">{label}</span>
        <span className="flex items-center gap-1">
          {parsed && <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text-secondary">{formatLimitString(parsed)}</code>}
          {!isDefault && (
            <Button variant="ghost" size="xs" disabled={disabled} onClick={() => update(rowsOf(DEFAULT_RATE_LIMITS[family]))}
              iconLeft={<FontAwesomeIcon icon={faRotateLeft} className="h-3 w-3" aria-hidden="true" />}>
              {m.limits.reset}
            </Button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rows.map((r, i) => (
          <span key={i} className={cn('inline-flex items-center gap-1 rounded-lg border bg-surface-base px-2 py-1', error ? 'border-error' : 'border-border')}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMIT_COUNT_MAX}
              value={r.count}
              disabled={disabled}
              aria-label={`${label}: ${m.limits.count} ${i + 1}`}
              aria-invalid={error ? true : undefined}
              onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))}
              className="w-20 rounded bg-transparent px-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-xs text-text-secondary">{m.limits.per}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMIT_SECONDS_MAX}
              value={r.seconds}
              disabled={disabled}
              aria-label={`${label}: ${m.limits.seconds} ${i + 1}`}
              aria-invalid={error ? true : undefined}
              onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, seconds: e.target.value } : x)))}
              className="w-20 rounded bg-transparent px-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-xs text-text-secondary">s</span>
            {rows.length > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => update(rows.filter((_, j) => j !== i))}
                aria-label={`${m.limits.removeWindow} (${label} ${i + 1})`}
                className="rounded p-1 text-text-secondary hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {rows.length < LIMIT_WINDOWS_MAX && (
          <Button variant="ghost" size="xs" disabled={disabled} aria-label={`${m.limits.addWindow} (${label})`}
            onClick={() => {
              const last = Number(rows[rows.length - 1]?.seconds) || 1;
              update([...rows, { count: '', seconds: String(Math.min(LIMIT_SECONDS_MAX, last * 60)) }]);
            }}
            iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
            {m.limits.addWindow}
          </Button>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}
