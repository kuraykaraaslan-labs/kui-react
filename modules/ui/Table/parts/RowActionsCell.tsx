'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../Button';
import { DropdownMenu, arrangeMenuItems, type DropdownItem } from '../../DropdownMenu';
import type { DataTableRowAction } from '../types';

function per<T, V>(value: V | ((row: T) => V), row: T): V {
  return typeof value === 'function' ? (value as (row: T) => V)(row) : value;
}

/** A row's actions as dropdown items, every per-row field resolved for `row`. */
export function resolveRowActions<T>(actions: readonly DataTableRowAction<T>[], row: T): DropdownItem[] {
  return actions.map((action) => ({
    type: 'item' as const,
    id: action.id,
    label: action.label,
    icon: action.icon,
    href: action.href === undefined ? undefined : per(action.href, row),
    onClick: action.onClick ? () => action.onClick?.(row) : undefined,
    hidden: action.hidden === undefined ? undefined : per(action.hidden, row),
    disabled: action.disabled === undefined ? undefined : per(action.disabled, row),
    disabledReason: action.disabledReason === undefined ? undefined : per(action.disabledReason, row),
    danger: action.destructive,
    order: action.order,
    group: action.group,
  }));
}

/** The trailing table cell holding a row's actions menu (empty when every action is hidden). */
export function RowActionsCell<T>({
  row,
  actions,
  label,
  as = 'td',
}: {
  row: T;
  actions: readonly DataTableRowAction<T>[];
  label: string;
  /** `div`: the menu alone, for a card of the card layout. */
  as?: 'td' | 'div';
}) {
  const items = arrangeMenuItems(resolveRowActions(actions, row));
  const Cell = as;
  return (
    // The menu's clicks must not reach the row's own onClick (React bubbles through portals).
    <Cell
      className={as === 'td' ? 'w-12 px-2 py-2 text-right' : 'inline-flex'}
      onClick={(e) => e.stopPropagation()}
      data-part="row-actions"
    >
      {items.length > 0 && (
        <DropdownMenu
          portal
          align="right"
          items={items}
          trigger={
            <Button variant="ghost" size="sm" iconOnly aria-label={label}>
              <FontAwesomeIcon icon={faEllipsisVertical} className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          }
        />
      )}
    </Cell>
  );
}
