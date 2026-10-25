'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';

/**
 * DescriptionList — label/value pairs of one record, for detail pages (phase 11.10).
 *
 * Replaces the hand-made `Row` / `Field` helpers detail pages kept writing: one `<dl>`, the same spacing,
 * an empty value shown as a dash, an optional copy button for ids and keys, and 1–3 columns that collapse to one on a
 * phone. `inline` puts label and value side by side (a key/value sheet); `stacked` puts the label above the value.
 */
export type DescriptionItem = {
  /** Stable key; defaults to the label. */
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small text under the value. */
  hint?: React.ReactNode;
  /** Adds a copy button; the string is what gets copied (an id, a key, an address). */
  copyValue?: string;
  /** Monospace value (ids, hashes, codes). */
  mono?: boolean;
  /** Spans every column of the grid (a long description, an address). */
  wide?: boolean;
  hidden?: boolean;
};

export type DescriptionListMessages = {
  copy: string;
  copied: string;
};

const DEFAULT_MESSAGES: DescriptionListMessages = { copy: 'Copy', copied: 'Copied' };

const COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
} as const;

function isEmpty(v: React.ReactNode) {
  return v === null || v === undefined || v === false || v === '';
}

function CopyButton({ text, msgs }: { text: string; msgs: DescriptionListMessages }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      aria-label={done ? msgs.copied : msgs.copy}
      title={done ? msgs.copied : msgs.copy}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      data-part="copy"
    >
      <FontAwesomeIcon icon={done ? faCheck : faCopy} className="w-3 h-3" aria-hidden="true" />
    </button>
  );
}

export function DescriptionList({
  items,
  columns = 1,
  layout = 'inline',
  emptyValue = '—',
  dense = false,
  divided = true,
  messages,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  /** `inline`: label left, value right. `stacked`: label above value. */
  layout?: 'inline' | 'stacked';
  /** Shown for an empty value. */
  emptyValue?: React.ReactNode;
  dense?: boolean;
  /** Hairlines between rows (inline layout, one column). */
  divided?: boolean;
  messages?: Partial<DescriptionListMessages>;
  className?: string;
}) {
  const msgs = { ...DEFAULT_MESSAGES, ...messages };
  const shown = items.filter((i) => !i.hidden);
  const inline = layout === 'inline';
  return (
    <dl
      className={cn(
        'grid gap-x-6',
        COLUMNS[columns],
        inline && columns === 1 && divided ? 'divide-y divide-border' : dense ? 'gap-y-2' : 'gap-y-4',
        className,
      )}
      data-layout={layout}
    >
      {shown.map((item, i) => (
        <div
          key={item.id ?? (typeof item.label === 'string' ? item.label : i)}
          className={cn(
            'min-w-0',
            item.wide && 'sm:col-span-full',
            inline
              ? cn('flex items-start justify-between gap-4', columns === 1 && divided && (dense ? 'py-1.5' : 'py-2.5'))
              : 'flex flex-col gap-1',
          )}
          data-part="item"
        >
          <dt className={cn('text-sm text-text-secondary', inline && 'shrink-0')}>{item.label}</dt>
          <dd className={cn('min-w-0 text-sm text-text-primary', inline && 'text-right')}>
            <span className={cn('inline-flex max-w-full items-center gap-1', inline && 'justify-end')}>
              <span className={cn('min-w-0 break-words', item.mono && 'font-mono text-xs')}>
                {isEmpty(item.value) ? <span className="text-text-disabled">{emptyValue}</span> : item.value}
              </span>
              {item.copyValue && !isEmpty(item.value) && <CopyButton text={item.copyValue} msgs={msgs} />}
            </span>
            {item.hint && <span className="mt-0.5 block text-xs text-text-secondary">{item.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
