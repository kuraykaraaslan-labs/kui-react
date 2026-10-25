'use client';
import { cn } from '@/libs/utils/cn';
import { groupByOrder } from '@/libs/utils/orderItems';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './Overlays/shared/useFocusTrap';
import { usePortal } from './Overlays/shared/usePortal';
import { useKeepInViewport } from './Overlays/shared/useKeepInViewport';

export type DropdownMenuItem = {
  type?: 'item';
  /** Stable id: the React key, `data-item-id`, and the key `mergeMenuItems` replaces by. */
  id?: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Renders the item as a link. A disabled item never navigates. */
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Why the item is disabled: shown under the label and as its tooltip while `disabled`. */
  disabledReason?: string;
  /** Leave the item out (a contribution the viewer may not use). */
  hidden?: boolean;
  /** Position, like CSS `order`: missing counts as 0, ties keep array order. */
  order?: number;
  /** Items of a group sit together; groups are split by a separator and ranked by their lowest `order`. */
  group?: string;
  /** The current choice (the page on screen): `aria-current="true"`, tinted and semibold, focused when the menu opens. */
  selected?: boolean;
  /** Drawn at the far end of the row: a badge, a count, a chip. */
  trailing?: React.ReactNode;
};

export type DropdownSeparator = { type: 'separator'; id?: string; hidden?: boolean };

/**
 * A small uppercase label over the entries after it. Not focusable. Dropped when no visible
 * entry follows it before the next heading, separator or the end of the list.
 */
export type DropdownHeading = { type: 'heading'; id?: string; label: string; hidden?: boolean };

export type DropdownItem = DropdownMenuItem | DropdownSeparator | DropdownHeading;

/** Options of `arrangeMenuItems`. */
export type ArrangeMenuOptions = {
  /**
   * Grouped lists only: a group whose key has a label here gets a heading in place of the
   * separator before it (the first group too).
   */
  groupLabels?: Readonly<Record<string, string>>;
};

/** A search box at the top of a long menu. */
export type DropdownMenuSearch = {
  placeholder: string;
  /** Shown when no entry matches the query. */
  emptyText: string;
  /** Accessible name of the box. Default = `placeholder`. */
  ariaLabel?: string;
  /** The box appears once the menu shows at least this many entries. Default 8. */
  minItems?: number;
};

/** A node that renders something (not undefined, null or false). */
function present(node: React.ReactNode): boolean {
  return node !== undefined && node !== null && node !== false;
}

function isEntry(item: DropdownItem): item is DropdownMenuItem {
  return item.type !== 'separator' && item.type !== 'heading';
}

/**
 * Drops headings with no entry right under them, then leading, trailing and doubled
 * separators (left behind by hidden or filtered-out items).
 */
function tidyMenu(items: readonly DropdownItem[]): DropdownItem[] {
  const out: DropdownItem[] = [];
  items.forEach((item, index) => {
    if (item.type === 'heading') {
      const next = items[index + 1];
      if (next && isEntry(next)) out.push(item);
      return;
    }
    if (item.type === 'separator' && (out.length === 0 || out[out.length - 1].type === 'separator')) return;
    out.push(item);
  });
  while (out.length && out[out.length - 1].type === 'separator') out.pop();
  return out;
}

function groupLabel(labels: ArrangeMenuOptions['groupLabels'], group: string | undefined): string | undefined {
  if (!labels || group === undefined || !Object.prototype.hasOwnProperty.call(labels, group)) return undefined;
  const label = labels[group];
  return typeof label === 'string' && label ? label : undefined;
}

/**
 * The items a menu shows, in the order it shows them. Hidden items are left out. When any
 * item sets `group` or `order`, items are laid out by group (a separator, or a heading from
 * `groupLabels`, before each group; explicit separators and headings ignored); otherwise the
 * list keeps its own order, separators and headings (a heading with nothing under it goes).
 */
export function arrangeMenuItems(items: readonly DropdownItem[], { groupLabels }: ArrangeMenuOptions = {}): DropdownItem[] {
  const visible = items.filter((item) => !item.hidden);
  const grouped = visible.some((item) => isEntry(item) && (item.group !== undefined || item.order !== undefined));
  if (!grouped) {
    const untouched = visible.length === items.length && !visible.some((item) => item.type === 'heading');
    return untouched ? visible : tidyMenu(visible);
  }
  const out: DropdownItem[] = [];
  groupByOrder(visible.filter(isEntry), (item) => item.group).forEach((group, index) => {
    const label = groupLabel(groupLabels, group.group);
    if (label) out.push({ type: 'heading', id: `group:${group.group}`, label });
    else if (index > 0) out.push({ type: 'separator', id: `group:${group.group ?? ''}` });
    out.push(...group.items);
  });
  return out;
}

/** Entries whose label contains the query (any case); headings stay over a match, separators tidied. */
function filterMenuItems(items: readonly DropdownItem[], query: string): DropdownItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...items];
  return tidyMenu(items.filter((item) => !isEntry(item) || item.label.toLocaleLowerCase().includes(needle)));
}

/**
 * Adds contributed items to a base list. An extra item whose `id` matches a base item
 * replaces it in place; the rest are appended (then placed by `arrangeMenuItems`).
 */
export function mergeMenuItems(base: readonly DropdownItem[], extra: readonly DropdownItem[] = []): DropdownItem[] {
  const byId = new Map<string, DropdownItem>();
  for (const item of extra) if (item.id) byId.set(item.id, item);
  const replaced = new Set<string>();
  const out = base.map((item) => {
    const next = item.id ? byId.get(item.id) : undefined;
    if (!next || !item.id) return item;
    replaced.add(item.id);
    return next;
  });
  for (const item of extra) if (!item.id || !replaced.has(item.id)) out.push(item);
  return out;
}

type Anchor = { bottom: number; left: number; right: number };

const MENU_ITEM = '[role="menuitem"]:not([disabled])';

export function DropdownMenu({
  trigger,
  items,
  header,
  footer,
  align = 'left',
  portal = false,
  groupLabels,
  search,
  open: openProp,
  onOpenChange,
  className,
  menuClassName,
}: {
  trigger: React.ReactNode;
  items: DropdownItem[];
  header?: React.ReactNode;
  /** Rendered under the entries, above a top border (a "Manage…" link, a hint). */
  footer?: React.ReactNode;
  align?: 'left' | 'right';
  /**
   * Render the open menu in `document.body` with fixed positioning, so a scrolling or
   * clipping parent (a table's overflow wrapper) cannot cut it off.
   */
  portal?: boolean;
  /** Grouped items: a heading for each group key listed here, in place of its separator. */
  groupLabels?: Readonly<Record<string, string>>;
  /** A search box over the entries once the menu shows `minItems` (default 8) or more. */
  search?: DropdownMenuSearch;
  /** Controlled open state; leave undefined to let the menu manage it. */
  open?: boolean;
  /** Called with every open / close the menu asks for (trigger, item, Escape, outside click). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Classes for the open menu panel, e.g. a width (`w-72`). */
  menuClassName?: string;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const listId = `${menuId}-list`;
  const portalTarget = usePortal();
  const shown = useMemo(() => arrangeMenuItems(items, { groupLabels }), [items, groupLabels]);
  const entryCount = useMemo(() => shown.filter(isEntry).length, [shown]);
  const searchBox = search && entryCount >= (search.minItems ?? 8) ? search : undefined;
  const searching = searchBox !== undefined;
  const listed = useMemo(() => (searching ? filterMenuItems(shown, query) : shown), [searching, shown, query]);

  // A closed menu forgets its query (whoever closed it), so it opens unfiltered.
  if (!open && query !== '') setQuery('');

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setOpenState(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  useFocusTrap(menuRef, { active: open, onEscape: () => setOpen(false) });
  // A portalled menu renders in place for the frame before its trigger is measured, then moves
  // into the portal: the panel kept on screen is the one finally shown.
  useKeepInViewport(menuRef, open && (!portal || portalTarget === null || anchor !== null));

  // Runs after the focus trap's own first focus (same tick, scheduled later): the search box,
  // else the selected item, else the first enabled item.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const panel = menuRef.current;
      if (!panel) return;
      const target =
        searchRef.current ??
        panel.querySelector<HTMLElement>(`${MENU_ITEM}[aria-current="true"]`) ??
        panel.querySelector<HTMLElement>(MENU_ITEM);
      target?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const place = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ bottom: rect.bottom, left: rect.left, right: rect.right });
  }, []);

  // A menu opened from outside (controlled `open`) measures its trigger before it paints.
  useLayoutEffect(() => {
    if (open && portal) place();
  }, [open, portal, place]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    if (portal) {
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
    }
    return () => {
      document.removeEventListener('mousedown', onOutside);
      if (portal) {
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
      }
    };
  }, [open, portal, place, setOpen]);

  const toggle = () => {
    if (!open && portal) place();
    setOpen(!open);
  };

  // Arrow keys move between enabled items (wrapping), Home / End jump to the ends; from the
  // search box ArrowDown enters the list and Enter picks the first match.
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const panel = menuRef.current;
    if (!panel) return;
    const enabled = Array.from(panel.querySelectorAll<HTMLElement>(MENU_ITEM));
    if (searchRef.current && e.target === searchRef.current) {
      if (e.key === 'ArrowDown' && enabled.length) {
        e.preventDefault();
        enabled[0].focus();
      } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        enabled[0]?.click();
      }
      return;
    }
    const at = enabled.indexOf(e.target as HTMLElement);
    if ((at < 0 && e.target !== panel) || enabled.length === 0) return;
    let next: number;
    switch (e.key) {
      case 'ArrowDown': next = at < 0 ? 0 : (at + 1) % enabled.length; break;
      case 'ArrowUp': next = at < 0 ? enabled.length - 1 : (at - 1 + enabled.length) % enabled.length; break;
      case 'Home': next = 0; break;
      case 'End': next = enabled.length - 1; break;
      default: return;
    }
    e.preventDefault();
    enabled[next].focus();
  };

  // aria-haspopup/aria-expanded belong on the trigger's own interactive
  // element (a real <button> in every current usage) — a plain wrapping
  // <div> has an implicit "generic" role, which doesn't support those
  // attributes at all (axe: aria-allowed-attr, critical). Clone them onto
  // the trigger when it's a single element; the wrapper's onClick still
  // works either way since the click bubbles up from the real trigger.
  type TriggerProps = {
    onClick?: (e: React.MouseEvent) => void;
    'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
    'aria-expanded'?: boolean;
  };
  const triggerNode = React.isValidElement<TriggerProps>(trigger)
    ? React.cloneElement(trigger, {
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (e: React.MouseEvent) => {
          trigger.props.onClick?.(e);
          toggle();
        },
      })
    : trigger;

  const renderEntry = (item: DropdownItem, i: number) => {
    const key = item.id ?? i;
    if (item.type === 'separator') {
      return <div key={key} role="separator" className="my-1 border-t border-border" />;
    }
    if (item.type === 'heading') {
      return (
        <div
          key={key}
          role="presentation"
          className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          {item.label}
        </div>
      );
    }
    const reasonId = item.disabled && item.disabledReason ? `${menuId}-reason-${i}` : undefined;
    const itemClassName = cn(
      'flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
      'focus-visible:outline-none focus-visible:bg-surface-overlay',
      item.danger
        ? 'text-error hover:bg-error-subtle'
        : 'text-text-primary hover:bg-surface-overlay',
      item.selected && 'bg-primary-subtle font-semibold text-primary hover:bg-primary-subtle',
      item.selected && 'focus-visible:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
      item.disabled && 'opacity-50 cursor-not-allowed'
    );
    const body = (
      <>
        {item.icon && <span aria-hidden="true">{item.icon}</span>}
        {reasonId ? (
          <span className="flex min-w-0 flex-col">
            <span>{item.label}</span>
            <span id={reasonId} className="text-xs text-text-secondary">{item.disabledReason}</span>
          </span>
        ) : (
          item.label
        )}
        {present(item.trailing) && (
          <span className="ml-auto flex shrink-0 items-center pl-2">{item.trailing}</span>
        )}
      </>
    );
    const current = item.selected ? 'true' : undefined;
    const select = () => { item.onClick?.(); setOpen(false); };
    if (item.href && !item.disabled) {
      return (
        <a key={key} role="menuitem" href={item.href} data-item-id={item.id} aria-current={current} onClick={select} className={itemClassName}>
          {body}
        </a>
      );
    }
    return (
      <button
        key={key}
        role="menuitem"
        type="button"
        disabled={item.disabled}
        data-item-id={item.id}
        title={reasonId ? item.disabledReason : undefined}
        aria-label={reasonId ? item.label : undefined}
        aria-describedby={reasonId}
        aria-current={current}
        onClick={select}
        className={itemClassName}
      >
        {body}
      </button>
    );
  };

  const floating = portal && portalTarget !== null && anchor !== null;
  // With a search box or a footer the panel is a plain container and the entries sit in their
  // own role="menu" list (a menu may only own items); otherwise the panel is the menu, as before.
  const split = searching || present(footer);
  const menu = open && (
    <div
      ref={menuRef}
      role={split ? undefined : 'menu'}
      onKeyDown={onMenuKeyDown}
      className={cn(
        floating
          ? 'fixed z-[60] min-w-[10rem] rounded-lg border border-border bg-surface-raised shadow-lg py-1'
          : 'absolute z-[60] mt-1 min-w-[10rem] rounded-lg border border-border bg-surface-raised shadow-lg py-1',
        !floating && (align === 'right' ? 'right-0' : 'left-0'),
        menuClassName
      )}
      style={
        floating && anchor
          ? align === 'right'
            ? { top: anchor.bottom + 4, right: document.documentElement.clientWidth - anchor.right }
            : { top: anchor.bottom + 4, left: anchor.left }
          : undefined
      }
    >
      {header && (
        <div className="border-b border-border mb-1">
          {header}
        </div>
      )}
      {searchBox && (
        <div className="mb-1 border-b border-border px-2 pb-2 pt-1">
          <div className="relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-disabled"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchBox.placeholder}
              aria-label={searchBox.ariaLabel ?? searchBox.placeholder}
              aria-controls={listed.length ? listId : undefined}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'w-full rounded-md border border-border bg-surface-base py-1.5 pl-7 pr-2 text-sm text-text-primary',
                'placeholder:text-text-disabled',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
              )}
            />
          </div>
        </div>
      )}
      {!split && listed.map(renderEntry)}
      {split && listed.length > 0 && (
        <div role="menu" id={listId} className={cn(searching && 'max-h-96 overflow-y-auto')}>
          {listed.map(renderEntry)}
        </div>
      )}
      {searchBox && listed.length === 0 && (
        <p role="status" className="px-3 py-2 text-sm text-text-secondary">
          {searchBox.emptyText}
        </p>
      )}
      {present(footer) && (
        <div className="mt-1 border-t border-border">
          {footer}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div onClick={React.isValidElement(trigger) ? undefined : toggle}>
        {triggerNode}
      </div>
      {menu && floating && portalTarget ? createPortal(menu, portalTarget) : menu}
    </div>
  );
}
