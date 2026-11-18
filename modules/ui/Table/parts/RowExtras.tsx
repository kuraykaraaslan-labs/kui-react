'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Leading cells for row selection and expandable rows. Both stop click
// propagation so ticking a box or opening a row never fires the row's onClick.

const checkboxClass =
  'h-4 w-4 accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed';

export function SelectAllHeaderCell({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <th scope="col" className="w-10 px-4 py-3" data-part="select">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        // `indeterminate` is a DOM property, not an attribute.
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className={checkboxClass}
      />
    </th>
  );
}

/**
 * The card layout's select-all: no header row to hold it, so a named checkbox at the start of the selection line. It
 * selects the cards shown (the page), as the table's header checkbox selects the rows shown.
 */
export function SelectAllControl({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-text-secondary" data-part="select-all">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        // `indeterminate` is a DOM property, not an attribute.
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className={checkboxClass}
      />
      {label}
    </label>
  );
}

export function SelectCell({
  checked,
  label,
  onChange,
  disabledReason,
  locked = false,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  /** Set when the row cannot be selected: the checkbox is disabled and this is its tooltip. */
  disabledReason?: string;
  /** Ticked and locked (`isRowSelectionLocked`): disabled, shown checked. */
  locked?: boolean;
}) {
  return (
    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()} data-part="select" data-locked={locked || undefined}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={locked || disabledReason !== undefined}
        title={disabledReason}
        onChange={onChange}
        className={checkboxClass}
      />
    </td>
  );
}

export function ExpandHeaderCell({ label }: { label: string }) {
  return (
    <th scope="col" className="w-10 px-4 py-3" data-part="expand">
      <span className="sr-only">{label}</span>
    </th>
  );
}

/** The expand toggle; renders an empty cell for a row without details. */
export function ExpandCell({
  expandable,
  expanded,
  controls,
  label,
  onToggle,
}: {
  expandable: boolean;
  expanded: boolean;
  controls: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()} data-part="expand">
      {expandable && (
        <button
          type="button"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={expanded ? controls : undefined}
          onClick={onToggle}
          className="rounded text-text-disabled transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <FontAwesomeIcon
            icon={expanded ? faChevronDown : faChevronRight}
            className="w-2.5 h-2.5"
            aria-hidden="true"
          />
        </button>
      )}
    </td>
  );
}
