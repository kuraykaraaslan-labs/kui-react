'use client';
// modules/ui/IconPicker/index.tsx
//
// IconPicker — chooses one Font Awesome solid icon. The value is the class
// string module manifests and menus store: `fas fa-industry`. The trigger shows
// the chosen icon and its name; the panel has a search box (names and the
// pack's alternative names), recent choices first, and a grid moved through
// with the arrow keys while the focus stays in the search box (combobox +
// listbox, `aria-activedescendant`).
//
// The whole solid set (~1 400 icons) is imported lazily the first time a picker
// opens, so a page that never opens one does not load it. Until then the
// trigger draws the chosen icon only when `resolveIcon` knows it (an app's own
// icon map) or the set is already loaded; the name is always shown.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { useFocusTrap } from '../Overlays/shared/useFocusTrap';
import { useDismiss } from '../Overlays/shared/useDismiss';
import { useKeepInViewport } from '../Overlays/shared/useKeepInViewport';
import {
  findSolidIcon,
  iconNameOf,
  iconValueOf,
  loadSolidIcons,
  loadedSolidIcons,
  readRecentIcons,
  rememberIcon,
  searchIcons,
  type SolidIcon,
} from './icons';

export { iconNameOf, iconValueOf, loadSolidIcons, clearRecentIcons, type SolidIcon } from './icons';

export type IconPickerMessages = {
  /** Trigger text with no value. */
  placeholder: string;
  /** Name of the panel. */
  dialog: string;
  /** Label of the search box. */
  search: string;
  loading: string;
  error: string;
  retry: string;
  /** `{query}` is replaced. */
  noResults: string;
  recent: string;
  all: string;
  /** `{count}` is replaced. */
  results: string;
  showMore: string;
};

export const DEFAULT_ICON_PICKER_MESSAGES: IconPickerMessages = {
  placeholder: 'Choose an icon',
  dialog: 'Choose an icon',
  search: 'Search icons',
  loading: 'Loading icons…',
  error: 'The icons could not be loaded.',
  retry: 'Try again',
  noResults: 'No icon matches “{query}”',
  recent: 'Recent',
  all: 'All icons',
  results: '{count} icons',
  showMore: 'Show more',
};

export type IconPickerProps = {
  id: string;
  label?: string;
  /** `fas fa-<name>`; `fa-<name>` and a bare name are read too. */
  value?: string;
  /** Called with `fas fa-<name>`. */
  onChange: (value: string) => void;
  /** Trigger text with no value. Default: `messages.placeholder`. */
  placeholder?: string;
  disabled?: boolean;
  messages?: Partial<IconPickerMessages>;
  /** Draws the chosen icon in the trigger before the set is loaded (an app's own name → icon map). */
  resolveIcon?: (name: string) => IconDefinition | undefined;
  className?: string;
};

const COLUMNS = 8;
const PAGE = COLUMNS * 12;

type Section = { key: 'recent' | 'all' | 'results'; title?: string; items: SolidIcon[]; offset: number };

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function IconPicker({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  messages,
  resolveIcon,
  className,
}: IconPickerProps) {
  const msg = useMemo(() => ({ ...DEFAULT_ICON_PICKER_MESSAGES, ...messages }), [messages]);
  const uid = useId();
  const labelId = `${uid}-label`;
  const valueId = `${uid}-value`;
  const panelId = `${uid}-panel`;
  const listId = `${uid}-list`;
  const optionId = (name: string) => `${uid}-opt-${name}`;

  const [open, setOpen] = useState(false);
  const [icons, setIcons] = useState<SolidIcon[] | null>(() => loadedSolidIcons());
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [recent, setRecent] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const name = iconNameOf(value);
  const known = name ? findSolidIcon(name) : undefined;
  const triggerIcon = name ? resolveIcon?.(name) ?? known?.icon : undefined;
  const shownName = known?.name ?? name;

  const load = () => {
    setFailed(false);
    loadSolidIcons().then(setIcons, () => setFailed(true));
  };

  const openPanel = () => {
    if (disabled) return;
    setQuery('');
    setActive(0);
    setLimit(PAGE);
    setRecent(readRecentIcons());
    setOpen(true);
    if (!icons) load();
  };
  const close = () => setOpen(false);

  useDismiss({ active: open, ref: rootRef, layerRef: panelRef, onDismiss: close });
  useFocusTrap(panelRef, { active: open, onEscape: close, handleEscape: false });
  useKeepInViewport(panelRef, open);

  const sections: Section[] = useMemo(() => {
    if (!icons) return [];
    if (query.trim()) return [{ key: 'results', items: searchIcons(icons, query, recent), offset: 0 }];
    const rec = recent.map((n) => icons.find((i) => i.name === n)).filter((i): i is SolidIcon => !!i);
    const seen = new Set(rec.map((i) => i.name));
    const rest = icons.filter((i) => !seen.has(i.name));
    return rec.length
      ? [
          { key: 'recent', title: msg.recent, items: rec, offset: 0 },
          { key: 'all', title: msg.all, items: rest, offset: rec.length },
        ]
      : [{ key: 'all', items: rest, offset: 0 }];
  }, [icons, query, recent, msg.recent, msg.all]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const total = flat.length;
  const shown = Math.min(total, limit);

  // Rows as the grid draws them (each section starts a new row), for up/down by column.
  const rows = useMemo(() => {
    const out: number[][] = [];
    for (const s of sections) {
      for (let i = 0; i < s.items.length; i += COLUMNS) {
        const row: number[] = [];
        for (let j = i; j < Math.min(i + COLUMNS, s.items.length); j++) row.push(s.offset + j);
        out.push(row);
      }
    }
    return out;
  }, [sections]);

  const activeIcon = flat[Math.min(active, total - 1)];

  useEffect(() => {
    if (!open || !activeIcon) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-icon-name="${activeIcon.name}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIcon]);

  const pick = (icon: SolidIcon) => {
    setRecent(rememberIcon(icon.name));
    onChange(iconValueOf(icon.name));
    close();
    triggerRef.current?.focus();
  };

  const moveTo = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    if (clamped >= limit) setLimit((l) => Math.max(l + PAGE, clamped + 1));
    setActive(clamped);
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!total) return;
    const cur = Math.min(active, total - 1);
    const r = rows.findIndex((row) => row.includes(cur));
    const c = r === -1 ? 0 : rows[r].indexOf(cur);
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveTo(cur + 1); break;
      case 'ArrowLeft': e.preventDefault(); moveTo(cur - 1); break;
      case 'ArrowDown': {
        e.preventDefault();
        const row = rows[r + 1];
        if (row) moveTo(row[Math.min(c, row.length - 1)]);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const row = rows[r - 1];
        if (row) moveTo(row[Math.min(c, row.length - 1)]);
        break;
      }
      case 'PageDown': e.preventDefault(); moveTo(cur + COLUMNS * 4); break;
      case 'PageUp': e.preventDefault(); moveTo(cur - COLUMNS * 4); break;
      case 'Enter': {
        e.preventDefault();
        if (activeIcon) pick(activeIcon);
        break;
      }
      default:
    }
  };

  const triggerText = shownName || placeholder || msg.placeholder;

  return (
    <div ref={rootRef} className={cn('relative space-y-1', className)}>
      {label && (
        <label id={labelId} htmlFor={id} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
        onClick={() => (open ? close() : openPanel())}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-border bg-surface-base px-3 py-2 text-left text-sm text-text-primary transition-colors',
          'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary" aria-hidden="true">
          {triggerIcon ? (
            <FontAwesomeIcon icon={triggerIcon} className="h-4 w-4" />
          ) : (
            <span className={cn('h-4 w-4 rounded-sm border border-dashed', name ? 'border-border-strong' : 'border-border')} />
          )}
        </span>
        <span id={valueId} className={cn('min-w-0 flex-1 truncate', !shownName && 'text-text-disabled')}>
          {triggerText}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 shrink-0 text-text-disabled" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={msg.dialog}
          tabIndex={-1}
          className="absolute left-0 top-full z-[70] mt-2 w-[20rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-raised p-2 shadow-xl focus-visible:outline-none"
        >
          <div className="relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-disabled"
              aria-hidden="true"
            />
            <input
              type="text"
              role="combobox"
              aria-label={msg.search}
              aria-expanded={!!icons && total > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIcon && icons ? optionId(activeIcon.name) : undefined}
              placeholder={msg.search}
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setLimit(PAGE);
              }}
              onKeyDown={onSearchKey}
              className={cn(
                'block w-full rounded-md border border-border bg-surface-base py-1.5 pl-8 pr-2 text-sm text-text-primary placeholder:text-text-disabled',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            />
          </div>

          {!icons && !failed && (
            <p role="status" className="px-1 py-6 text-center text-sm text-text-secondary">{msg.loading}</p>
          )}
          {failed && (
            <div role="alert" className="flex flex-col items-center gap-2 px-1 py-6 text-sm text-text-secondary">
              <span>{msg.error}</span>
              <button
                type="button"
                onClick={load}
                className="rounded-md px-2 py-1 text-primary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {msg.retry}
              </button>
            </div>
          )}

          {icons && (
            <>
              <p className="sr-only" aria-live="polite">{query.trim() ? fill(msg.results, { count: total }) : ''}</p>
              {total === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-text-secondary">{fill(msg.noResults, { query: query.trim() })}</p>
              ) : (
                <div id={listId} role="listbox" aria-label={msg.dialog} className="mt-2 max-h-72 overflow-y-auto">
                  {sections.map((s) => {
                    const visible = s.items.slice(0, Math.max(0, shown - s.offset));
                    if (!visible.length) return null;
                    const headId = `${uid}-sec-${s.key}`;
                    return (
                      <div key={s.key} role="group" aria-labelledby={s.title ? headId : undefined} className="mb-1">
                        {s.title && (
                          <p id={headId} className="px-1 pb-1 pt-1.5 text-xs font-medium text-text-secondary">{s.title}</p>
                        )}
                        <div className="grid grid-cols-8 gap-0.5">
                          {visible.map((icon, i) => {
                            const flatIndex = s.offset + i;
                            const isActive = flatIndex === Math.min(active, total - 1);
                            const isChosen = icon.name === shownName;
                            return (
                              <div
                                key={icon.name}
                                id={optionId(icon.name)}
                                role="option"
                                aria-selected={isChosen}
                                aria-label={icon.name}
                                title={icon.name}
                                data-icon-name={icon.name}
                                data-active={isActive ? 'true' : undefined}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setActive(flatIndex)}
                                onClick={() => pick(icon)}
                                className={cn(
                                  'flex h-9 cursor-pointer items-center justify-center rounded-md text-text-primary transition-colors',
                                  isActive && 'bg-surface-overlay ring-2 ring-inset ring-border-focus',
                                  isChosen && 'bg-primary-subtle text-primary',
                                )}
                              >
                                <FontAwesomeIcon icon={icon.icon} className="h-4 w-4" aria-hidden="true" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {shown < total && (
                    <button
                      type="button"
                      onClick={() => setLimit((l) => l + PAGE)}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      {msg.showMore} ({total - shown})
                    </button>
                  )}
                </div>
              )}
              {activeIcon && (
                <p className="truncate px-1 pt-1.5 text-xs text-text-secondary" aria-hidden="true">{activeIcon.name}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
