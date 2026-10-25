'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../Button';
import { formatMessage, type DataTableMessages } from '../types';

export type FilterChip = {
  /** Unique per chip (`field:<id>` or `column:<key>`). */
  id: string;
  text: string;
  onRemove: () => void;
};

// The applied filters as removable chips under the toolbar, with "Clear all".
// Covers the filter panel and the column header filters alike.

export function FilterChips({
  chips,
  msgs,
  onClearAll,
}: {
  chips: FilterChip[];
  msgs: DataTableMessages;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={msgs.activeFilters ?? 'Active filters'}
      className="flex flex-wrap items-center gap-1.5"
      data-part="filter-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-raised py-0.5 pl-2.5 pr-1 text-xs text-text-primary"
          data-part="filter-chip"
        >
          <span className="truncate">{chip.text}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={formatMessage(msgs.removeFilter ?? 'Remove filter {filter}', { filter: chip.text })}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" size="xs" onClick={onClearAll} data-part="clear-filters">
          {msgs.clearAllFilters ?? 'Clear all'}
        </Button>
      )}
    </div>
  );
}
