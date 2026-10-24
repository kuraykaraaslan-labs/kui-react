'use client';
// Trigger — combobox shell (input + clear + caret). Pure presentational;
// owns no state, just receives handlers.

import { forwardRef } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';

type TriggerProps = {
  id: string;
  inputId: string;
  labelId: string;
  listboxId: string;
  describedBy?: string;
  value: string;
  placeholder?: string;
  /** Accessible name of the clear button. */
  clearLabel: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  clearable: boolean;
  open: boolean;
  highlightedIndex: number;
  showClear: boolean;
  onFocus: () => void;
  onChange: (next: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClick: () => void;
  onClear: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export const Trigger = forwardRef<HTMLInputElement, TriggerProps>(function Trigger(
  {
    id,
    inputId,
    labelId,
    listboxId,
    describedBy,
    value,
    placeholder,
    clearLabel,
    disabled,
    required,
    error,
    clearable,
    open,
    highlightedIndex,
    showClear,
    onFocus,
    onChange,
    onKeyDown,
    onClick,
    onClear,
  },
  ref
) {
  return (
    <div
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-labelledby={labelId}
      aria-disabled={disabled}
      aria-invalid={!!error}
      className={cn(
        'flex min-h-10 w-full items-center gap-2 rounded-md border bg-surface-base px-3 py-1.5 transition-colors',
        'focus-within:ring-2 focus-within:ring-border-focus',
        error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border',
        disabled && 'cursor-not-allowed bg-surface-sunken opacity-50'
      )}
      onClick={onClick}
    >
      <input
        ref={ref}
        id={inputId}
        type="text"
        role="searchbox"
        disabled={disabled}
        required={required}
        value={value}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-autocomplete="list"
        aria-activedescendant={highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined}
        autoComplete="off"
        className={cn(
          'w-full bg-transparent text-sm text-text-primary placeholder:text-text-disabled',
          'outline-none'
        )}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />

      {clearable && showClear && !disabled && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          className="rounded px-1 text-text-disabled transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
        </button>
      )}

      <FontAwesomeIcon
        aria-hidden="true"
        icon={open ? faChevronUp : faChevronDown}
        className="h-3 w-3 select-none text-text-disabled"
      />
    </div>
  );
});
