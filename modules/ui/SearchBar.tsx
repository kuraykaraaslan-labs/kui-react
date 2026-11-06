'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';

export function SearchBar({
  id = 'search',
  placeholder = 'Search…',
  label,
  clearLabel = 'Clear search',
  maxLength,
  value,
  onChange,
  onClear,
  className,
}: {
  id?: string;
  placeholder?: string;
  /** Accessible name of the input (a placeholder is not one); without it the input is named by nothing but its context. */
  label?: string;
  /** Accessible name of the clear button. */
  clearLabel?: string;
  /** Longest search the input takes (the host's limit), so a longer one is never typed only to be refused. */
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  const [internal, setInternal] = useState('');
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internal;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!controlled) setInternal(e.target.value);
    onChange?.(e.target.value);
  }

  function handleClear() {
    if (!controlled) setInternal('');
    onChange?.('');
    onClear?.();
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <span
        aria-hidden="true"
        className="absolute left-3 text-text-disabled pointer-events-none"
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} className="w-3.5 h-3.5" />
      </span>
      <input
        id={id}
        type="text"
        role="searchbox"
        aria-label={label}
        maxLength={maxLength}
        value={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        data-testid={`searchbar-${id}`}
        className={cn(
          'block w-full rounded-md border border-border bg-surface-base px-3 py-2 pl-8 text-sm',
          'text-text-primary placeholder:text-text-disabled',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-focus',
          'transition-colors',
          currentValue && 'pr-8'
        )}
      />
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          className="absolute right-2 text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
        >
          <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
