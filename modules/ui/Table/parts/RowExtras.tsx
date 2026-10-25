'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Leading cells for row selection and expandable rows. Both stop click
// propagation so ticking a box or opening a row never fires the row's onClick.

const checkboxClass =
  'h-4 w-4 rounded border-border text-primary accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed';

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

export function SelectCell({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()} data-part="select">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
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
