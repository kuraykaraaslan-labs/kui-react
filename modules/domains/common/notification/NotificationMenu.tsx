'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { useKeepInViewport } from '@/modules/ui/Overlays/shared/useKeepInViewport';

/** An inline action of an item (an alarm's Acknowledge) or a source's action in the header (Acknowledge all). */
export type NotificationAction = {
  label: string;
  onClick: () => void;
  /** Spins and disables the button. */
  loading?: boolean;
  disabled?: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  /** The time as text; without it the menu writes `at` as a relative time in `locale`. */
  timestamp?: string;
  /** When it happened: the one list is newest first across every source (items without one keep their order, after the dated). */
  at?: Date | string | number;
  read: boolean;
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Drawn instead of the unread dot: the item's look (an alarm's severity icon). */
  icon?: React.ReactNode;
  /** A line under the title (an alarm's device and site). */
  meta?: string;
  /**
   * Where the item leads: the row is a link, so a modified click opens it in a new tab. A plain click runs `onClick` instead of
   * following it when there is one (the host navigates inside the app).
   */
  href?: string;
  /** A plain click (the host marks the item read and opens its page); the menu closes. */
  onClick?: () => void;
  /** An inline action beside the item; it does not open the item and the menu stays open. */
  action?: NotificationAction;
};

/**
 * Another source of the same bell (the IoT alarms): its items join the one list, newest first, a filter shows it alone, its
 * unread count joins the badge, its action sits in the header and its page in the footer.
 */
export type NotificationSource = {
  /** Stable key: the filter's id. */
  key: string;
  /** The filter's label ("Alarms"). */
  label: string;
  items: NotificationItem[];
  /** What the source adds to the badge, when it is more than its unread items (every open alarm, not only the listed ones). */
  unread?: number;
  /**
   * The header action of the source ("Acknowledge all (3)"), shown under All and under the source's filter. It closes the menu
   * (focus back on the bell) before it runs: what it opens (a confirmation) is not left under the panel.
   */
  action?: NotificationAction;
  /** A line about the source under its filter ("3 open · 2 acknowledged"), what its items alone do not tell. */
  summary?: string;
  /** The source's page, in the footer ("View all alarms"): a link, or a click (the host navigates inside the app). */
  viewAll?: { label: string; href?: string; onClick?: () => void };
  /** Shown under the source's filter when it has no items ("No open alarms"). */
  emptyLabel?: string;
};

export type NotificationMenuLabels = {
  title: string;
  markAllRead: string;
  empty: string;
  viewAll: string;
  /** The filter of every item. */
  all: string;
  /** The filter of the menu's own items. */
  notifications: string;
  /** The filter group's name, for screen readers. */
  filter: string;
  /** The trigger's unread suffix: `{n}` is the badge count. */
  unread: string;
};

const DEFAULT_LABELS: NotificationMenuLabels = {
  title: 'Notifications',
  markAllRead: 'Mark all read',
  empty: 'No notifications',
  viewAll: 'View all notifications',
  all: 'All',
  notifications: 'Notifications',
  filter: 'Show',
  unread: '{n} unread',
};

type NotificationMenuProps = {
  /** The menu's own notifications. */
  items: NotificationItem[];
  onMarkAllRead?: () => void;
  onViewAll?: () => void;
  align?: 'left' | 'right';
  /** More sources of the same bell: their items join the one list (newest first) and a filter All / <source> / Notifications appears. */
  sources?: NotificationSource[];
  /**
   * More content of the same bell, above the list, for a source that draws its own section. With sections the panel stays
   * mounted while closed (hidden), so a section keeps its own counts live.
   */
  sections?: React.ReactNode;
  /** Added to the unread count on the badge: what the sections still want the viewer to see. */
  extraCount?: number;
  /** BCP 47 tag of the relative times. */
  locale?: string;
  /** The time the relative times count from (tests). */
  now?: number;
  labels?: Partial<NotificationMenuLabels>;
  className?: string;
};

const variantDot: Record<NonNullable<NotificationItem['variant']>, string> = {
  info:    'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error:   'bg-error',
};

/** The menu's own items under the filter. */
const OWN = 'notifications';

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60], ['second', 1],
];

function timeOf(at: NotificationItem['at']): number | null {
  if (at === undefined || at === null || at === '') return null;
  const t = (at instanceof Date ? at : new Date(at)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** `at` as a relative time in `locale` ("5 min. ago", "yesterday"), or '' without a valid date. */
export function formatNotificationTime(at: NotificationItem['at'], opts: { locale?: string; now?: number } = {}): string {
  const t = timeOf(at);
  if (t === null) return '';
  const diff = Math.round((t - (opts.now ?? Date.now())) / 1000);
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(opts.locale, { numeric: 'auto', style: 'short' });
  } catch {
    rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
  }
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size || unit === 'second') return rtf.format(Math.trunc(diff / size), unit);
  }
  return rtf.format(0, 'second');
}

type Entry = { item: NotificationItem; source: string; key: string };

/** Every source's items in one list: newest first, the undated after the dated in the order they came. */
function mergeItems(items: NotificationItem[], sources: NotificationSource[]): Entry[] {
  const all = [
    ...items.map((item) => ({ item, source: OWN })),
    ...sources.flatMap((s) => s.items.map((item) => ({ item, source: s.key }))),
  ].map((e, i) => ({ ...e, key: `${e.source}:${e.item.id}`, t: timeOf(e.item.at), i }));
  all.sort((a, b) => {
    if (a.t === null || b.t === null) return a.t !== null ? -1 : b.t !== null ? 1 : a.i - b.i;
    return b.t - a.t || a.i - b.i;
  });
  return all.map(({ item, source, key }) => ({ item, source, key }));
}

const unreadOf = (list: NotificationItem[]) => list.filter((n) => !n.read).length;
const NO_SOURCES: NotificationSource[] = [];

export function NotificationMenu({
  items,
  onMarkAllRead,
  onViewAll,
  align = 'right',
  sources = NO_SOURCES,
  sections,
  extraCount = 0,
  locale,
  now,
  labels: labelsIn,
  className,
}: NotificationMenuProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsIn };
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ownUnread = unreadOf(items);
  const sourceUnread = (s: NotificationSource) => s.unread ?? unreadOf(s.items);
  const badgeCount = ownUnread + sources.reduce((n, s) => n + sourceUnread(s), 0) + extraCount;
  const merged = useMemo(() => mergeItems(items, sources), [items, sources]);
  // a source that went away leaves its filter
  const shown = filter === 'all' || filter === OWN || sources.some((s) => s.key === filter) ? filter : 'all';
  const visible = shown === 'all' ? merged : merged.filter((e) => e.source === shown);
  const shownSource = sources.find((s) => s.key === shown);
  useKeepInViewport(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** A plain click opens the item through the host; a modified click on a link is the browser's (a new tab). */
  function activate(e: React.MouseEvent, item: NotificationItem) {
    if (item.href && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
    if (item.href && item.onClick) e.preventDefault();
    item.onClick?.();
    setOpen(false);
  }

  const filters = sources.length > 0
    ? [
      { id: 'all', label: labels.all, count: 0 },
      ...sources.map((s) => ({ id: s.key, label: s.label, count: sourceUnread(s) })),
      { id: OWN, label: labels.notifications, count: ownUnread },
    ]
    : [];
  // keyed by whose action it is: one that goes away (Mark all read) does not hand its focus to the next
  const actions: Array<NotificationAction & { key: string }> = [
    ...(onMarkAllRead && ownUnread > 0 && (shown === 'all' || shown === OWN) ? [{ key: OWN, label: labels.markAllRead, onClick: onMarkAllRead }] : []),
    ...sources.filter((s) => s.action && (shown === 'all' || shown === s.key)).map((s) => ({
      ...s.action!,
      key: s.key,
      onClick: () => { triggerRef.current?.focus(); setOpen(false); s.action!.onClick(); },
    })),
  ];
  const footer = [
    ...sources.filter((s) => s.viewAll).map((s) => ({ key: s.key, ...s.viewAll! })),
    ...(onViewAll ? [{ key: OWN, label: labels.viewAll, href: undefined, onClick: onViewAll }] : []),
  ];
  const linkClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={badgeCount > 0 ? `${labels.title}, ${labels.unread.replace('{n}', String(badgeCount))}` : labels.title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <FontAwesomeIcon icon={faBell} className="w-4 h-4" aria-hidden="true" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-error text-primary-fg text-[10px] font-bold leading-none pointer-events-none">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {(open || sections !== undefined) && (
        <div
          ref={panelRef}
          hidden={!open}
          role="dialog"
          aria-label={labels.title}
          className={cn(
            'absolute top-full mt-2 z-50 w-80 rounded-xl border border-border bg-surface-raised shadow-xl overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="space-y-2 px-4 py-3 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{labels.title}</span>
                {badgeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-error text-primary-fg text-[10px] font-bold leading-none">
                    {badgeCount}
                  </span>
                )}
              </div>
              {actions.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={a.onClick}
                      disabled={a.disabled || a.loading}
                      aria-busy={a.loading || undefined}
                      className={cn('text-xs text-primary hover:underline rounded disabled:opacity-50 disabled:cursor-not-allowed', linkClass)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filters.length > 0 && (
              <div role="group" aria-label={labels.filter} className="flex flex-wrap items-center gap-1">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={shown === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      linkClass,
                      shown === f.id
                        ? 'bg-primary text-primary-fg'
                        : 'bg-surface-overlay text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', shown === f.id ? 'bg-primary-fg/20' : 'bg-surface-base')}>
                        {f.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {shownSource?.summary && <p className="text-xs text-text-secondary">{shownSource.summary}</p>}
          </div>

          {sections}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-disabled">
              <FontAwesomeIcon icon={faBell} className="w-6 h-6" aria-hidden="true" />
              <p className="text-sm">{shownSource?.emptyLabel ?? labels.empty}</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {visible.map(({ item, source, key }) => {
                const time = item.timestamp ?? formatNotificationTime(item.at, { locale, now });
                const at = timeOf(item.at);
                const body = (
                  <>
                    {item.icon ? (
                      <span className="mt-0.5 shrink-0">{item.icon}</span>
                    ) : (
                      <span
                        className={cn(
                          'mt-1.5 shrink-0 w-2 h-2 rounded-full',
                          item.read ? 'bg-transparent' : (variantDot[item.variant ?? 'info'])
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm truncate',
                        item.read ? 'text-text-secondary' : 'text-text-primary font-medium'
                      )}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      {item.meta && <p className="text-xs text-text-secondary mt-0.5 truncate">{item.meta}</p>}
                      {time && (
                        <time
                          dateTime={at !== null ? new Date(at).toISOString() : undefined}
                          className="block text-[11px] text-text-disabled mt-1"
                        >
                          {time}
                        </time>
                      )}
                    </div>
                  </>
                );
                const target = 'flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:bg-surface-overlay';
                return (
                  <li
                    key={key}
                    data-source={source}
                    className={cn('flex items-start transition-colors hover:bg-surface-overlay', !item.read && 'bg-primary-subtle/40')}
                  >
                    {item.href ? (
                      <a href={item.href} onClick={(e) => activate(e, item)} className={target}>{body}</a>
                    ) : (
                      <button type="button" onClick={(e) => activate(e, item)} className={target}>{body}</button>
                    )}
                    {item.action && (
                      <Button
                        variant="outline"
                        size="xs"
                        className="mr-4 mt-3 shrink-0"
                        loading={item.action.loading}
                        disabled={item.action.disabled}
                        onClick={item.action.onClick}
                      >
                        {item.action.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {footer.length > 0 && (
            <div className="flex divide-x divide-border border-t border-border">
              {footer.map((f) => {
                const cls = cn('flex-1 py-2.5 text-center text-xs text-primary font-medium hover:bg-surface-overlay transition-colors', linkClass);
                return f.href ? (
                  <a
                    key={f.key}
                    href={f.href}
                    className={cls}
                    onClick={(e) => {
                      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      if (f.onClick) { e.preventDefault(); f.onClick(); }
                      setOpen(false);
                    }}
                  >
                    {f.label}
                  </a>
                ) : (
                  <button key={f.key} type="button" className={cls} onClick={() => { f.onClick?.(); setOpen(false); }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
