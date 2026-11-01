'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useState } from 'react';
import { isBrowser } from '@/libs/utils/isBrowser';
import { Badge } from '@/modules/ui/Badge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare, faChevronLeft, faChevronDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

export type AppSidebarNavItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** A count (shown when above 0) or any node, e.g. a status `Badge` or a dot. */
  badge?: number | React.ReactNode;
  href?: string;
  /**
   * An outside address: with `href`, the row is a plain anchor that opens a new tab
   * (`target="_blank"`, `rel="noopener noreferrer"`; `renderLink` is not used) with a trailing
   * outside-link icon, and its accessible name says so (`messages.opensInNewTab`). It is never
   * marked active. Ignored without `href`.
   */
  external?: boolean;
  /** Nested items, shown indented under this one behind a disclosure toggle. */
  children?: AppSidebarNavItem[];
  /** Start this item's children expanded. A branch holding the active item, or whose own page is active, always starts expanded. */
  defaultExpanded?: boolean;
};

export type AppSidebarNavGroup = {
  label?: string;
  items: AppSidebarNavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

export type AppSidebarSlotRenderContext = {
  collapsed: boolean;
};

/** Kept for existing imports; the same context now feeds `header` too. */
export type AppSidebarFooterRenderContext = AppSidebarSlotRenderContext;

type AppSidebarSlot = React.ReactNode | ((context: AppSidebarSlotRenderContext) => React.ReactNode);

/** The sidebar's own text, for translation. */
export type AppSidebarMessages = {
  /** Read after an external item's label (a visually hidden note), e.g. "(opens in a new tab)". */
  opensInNewTab: string;
};

export const DEFAULT_APP_SIDEBAR_MESSAGES: AppSidebarMessages = {
  opensInNewTab: '(opens in a new tab)',
};

/** What `renderLink` must put on the element it renders. */
export type AppSidebarLinkProps = {
  href: string;
  className: string;
  title?: string;
  'aria-current'?: 'page';
  children: React.ReactNode;
};

type AppSidebarProps = {
  navGroups?: AppSidebarNavGroup[];
  navItems?: AppSidebarNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Rendered above the nav groups (below the collapse toggle), e.g. a workspace switcher. */
  header?: AppSidebarSlot;
  footer?: AppSidebarSlot;
  /** Classes on the header slot's bordered wrapper, e.g. `md:hidden` to drop the whole strip at a breakpoint. */
  headerClassName?: string;
  /** Classes on the footer slot's bordered wrapper. */
  footerClassName?: string;
  /** Render a linked item yourself (a router `Link` for client-side navigation); defaults to a plain anchor. */
  renderLink?: (item: AppSidebarNavItem & { href: string }, props: AppSidebarLinkProps) => React.ReactNode;
  searchable?: boolean;
  /** Overrides for the sidebar's own text (`DEFAULT_APP_SIDEBAR_MESSAGES`). */
  messages?: Partial<AppSidebarMessages>;
  className?: string;
};

/** An item that opens an outside address in a new tab. */
function isExternal(item: AppSidebarNavItem): boolean {
  return Boolean(item.href && item.external);
}

/** Whether `id` is this item or one in its branch; an external item never counts as the active page. */
function containsId(item: AppSidebarNavItem, id: string | undefined): boolean {
  if (id === undefined) return false;
  return (item.id === id && !isExternal(item)) || (item.children ?? []).some((c) => containsId(c, id));
}

/** Ids of the items whose branch holds `id` (the item itself excluded). */
function ancestorIds(items: AppSidebarNavItem[], id: string | undefined, trail: string[] = []): string[] {
  if (id === undefined) return [];
  for (const item of items) {
    if (item.id === id) return trail;
    if (item.children?.length) {
      const found = ancestorIds(item.children, id, [...trail, item.id]);
      if (found.length) return found;
    }
  }
  return [];
}

/** The items to open so `id` and its children show: its ancestors, and the item itself (a no-op for a leaf). */
function openTrail(items: AppSidebarNavItem[], id: string | undefined): string[] {
  return id === undefined ? [] : [...ancestorIds(items, id), id];
}

function collectDefaultExpanded(items: AppSidebarNavItem[], into: Set<string>) {
  for (const item of items) {
    if (item.defaultExpanded && item.children?.length) into.add(item.id);
    if (item.children) collectDefaultExpanded(item.children, into);
  }
}

/** Keeps an item whose label matches (with its whole subtree), or the branch down to a matching descendant. */
function filterItems(items: AppSidebarNavItem[], q: string): AppSidebarNavItem[] {
  const out: AppSidebarNavItem[] = [];
  for (const item of items) {
    if (item.label.toLowerCase().includes(q)) out.push(item);
    else if (item.children?.length) {
      const children = filterItems(item.children, q);
      if (children.length) out.push({ ...item, children });
    }
  }
  return out;
}

/** A slot counts as empty for null, undefined, false and '' — none of them get a bordered wrapper. */
function hasContent(node: React.ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== '';
}

export function AppSidebar({
  navGroups,
  navItems,
  activeId,
  onSelect,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  header,
  footer,
  headerClassName,
  footerClassName,
  renderLink,
  searchable = true,
  messages,
  className,
}: AppSidebarProps) {
  const m = { ...DEFAULT_APP_SIDEBAR_MESSAGES, ...messages };
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const resolvedGroups: AppSidebarNavGroup[] = navGroups ?? (navItems ? [{ items: navItems }] : []);
    const initial = new Set<string>();
    for (const g of resolvedGroups) {
      if (!g.collapsible) continue;
      const key = g.label ?? '';
      const containsActive = g.items.some((i) => containsId(i, activeId));
      if (containsActive || g.defaultExpanded) initial.add(key);
    }
    return initial;
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const allItems = (navGroups ?? (navItems ? [{ items: navItems }] : [])).flatMap((g) => g.items);
    // The active item's own branch opens too: a parent page (Members) shows its children (Invitations) while it is open.
    const initial = new Set<string>(openTrail(allItems, activeId));
    collectDefaultExpanded(allItems, initial);
    return initial;
  });
  // With client-side navigation (renderLink) the sidebar outlives a page change, so
  // a newly active item's group and branch are opened when activeId moves —
  // adjusted during render, React's pattern for state derived from a prop.
  const [seenActiveId, setSeenActiveId] = useState(activeId);
  if (activeId !== seenActiveId) {
    setSeenActiveId(activeId);
    const allGroups = navGroups ?? (navItems ? [{ items: navItems }] : []);
    const owner = allGroups.find((g) => g.collapsible && g.items.some((i) => containsId(i, activeId)));
    if (owner) setExpandedGroups((prev) => new Set(prev).add(owner.label ?? ''));
    const trail = openTrail(allGroups.flatMap((g) => g.items), activeId);
    if (trail.length) setExpandedItems((prev) => new Set([...prev, ...trail]));
  }
  const [isDesktop, setIsDesktop] = useState(() => {
    if (!isBrowser) {
      return true;
    }
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const isCollapsed = collapsed ?? internalCollapsed;
  const effectiveCollapsed = isDesktop ? isCollapsed : false;
  const q = searchQuery.trim().toLowerCase();
  const rawGroups: AppSidebarNavGroup[] = navGroups ?? (navItems ? [{ items: navItems }] : []);
  const groups: AppSidebarNavGroup[] = q
    ? rawGroups
        .map((g) => ({ ...g, items: filterItems(g.items, q) }))
        .filter((g) => g.items.length > 0)
    : rawGroups;
  const footerContent = typeof footer === 'function'
    ? (footer as (context: AppSidebarSlotRenderContext) => React.ReactNode)({ collapsed: effectiveCollapsed })
    : footer;
  const headerContent = typeof header === 'function'
    ? (header as (context: AppSidebarSlotRenderContext) => React.ReactNode)({ collapsed: effectiveCollapsed })
    : header;

  const setCollapsed = (next: boolean) => {
    if (collapsed === undefined) {
      setInternalCollapsed(next);
    }
    onCollapsedChange?.(next);
  };

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleItem(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderItem(item: AppSidebarNavItem, depth: number): React.ReactNode {
    const hasChildren = !effectiveCollapsed && Boolean(item.children?.length);
    // A search shows every surviving branch open; otherwise the reader's toggles rule.
    const expanded = hasChildren && (q !== '' || expandedItems.has(item.id));
    const external = isExternal(item);
    const isActive = !external && item.id === activeId;
    // Icon-only mode shows top-level items only, so the one holding the active page lights up.
    const holdsActive = effectiveCollapsed && !isActive && containsId(item, activeId);
    const itemClassName = cn(
      'w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
      effectiveCollapsed ? 'justify-center px-2 py-2' : cn('px-3 text-left', depth > 0 ? 'py-1.5' : 'py-2'),
      isActive || holdsActive
        ? 'bg-primary-subtle text-primary font-medium'
        : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
    );
    const chevron = (
      <FontAwesomeIcon
        icon={faChevronDown}
        className={cn('w-3 h-3 transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')}
        aria-hidden="true"
      />
    );
    const itemContent = (
      <>
        {item.icon && <span aria-hidden="true" className="shrink-0 w-5 text-center text-[15px] leading-none">{item.icon}</span>}
        {!effectiveCollapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!effectiveCollapsed && (typeof item.badge === 'number'
          ? item.badge > 0 && <Badge variant="primary" size="sm">{item.badge}</Badge>
          : item.badge != null && item.badge !== false && <span className="shrink-0">{item.badge}</span>
        )}
        {/* A parent with no page of its own: the whole row is its disclosure toggle. */}
        {hasChildren && !item.href && chevron}
        {/* Collapsed, the label and this icon are gone and the title carries the note instead. */}
        {external && !effectiveCollapsed && (
          <>
            <span className="sr-only">{` ${m.opensInNewTab}`}</span>
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="shrink-0 w-3 h-3 text-text-disabled" aria-hidden="true" />
          </>
        )}
      </>
    );
    const current = isActive ? ('page' as const) : undefined;
    const title = effectiveCollapsed ? (external ? `${item.label} ${m.opensInNewTab}` : item.label) : undefined;

    let row: React.ReactNode;
    if (external) {
      // An outside address leaves the app: a plain anchor in a new tab, never the router's renderLink.
      row = (
        <a href={item.href} target="_blank" rel="noopener noreferrer" title={title} className={itemClassName}>
          {itemContent}
        </a>
      );
    } else if (item.href) {
      const props: AppSidebarLinkProps = { href: item.href, className: itemClassName, title, 'aria-current': current, children: itemContent };
      row = renderLink ? renderLink({ ...item, href: item.href }, props) : <a {...props} />;
    } else {
      row = (
        <button
          type="button"
          aria-current={current}
          aria-expanded={hasChildren ? expanded : undefined}
          title={title}
          onClick={() => (hasChildren ? toggleItem(item.id) : onSelect?.(item.id))}
          className={itemClassName}
        >
          {itemContent}
        </button>
      );
    }

    if (!hasChildren) return <div key={item.id}>{row}</div>;

    return (
      <div key={item.id}>
        {item.href ? (
          // A parent page keeps its link; the chevron beside it opens and closes the branch.
          <div className="flex items-center gap-0.5">
            <div className="min-w-0 flex-1">{row}</div>
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
              className="shrink-0 rounded-md p-2 text-text-disabled hover:text-text-primary hover:bg-surface-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {chevron}
            </button>
          </div>
        ) : (
          row
        )}
        {expanded && (
          <div role="group" aria-label={item.label} className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
            {item.children!.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function isGroupExpanded(group: AppSidebarNavGroup): boolean {
    if (!group.collapsible || effectiveCollapsed) return true;
    return expandedGroups.has(group.label ?? '');
  }

  return (
    <div
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
      className={cn(
        'flex flex-col flex-1 min-h-0 transition-all duration-200',
        effectiveCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-56',
        className
      )}
    >
      <div className={cn('hidden lg:flex items-center px-2 py-2 border-b border-border shrink-0', effectiveCollapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          onClick={() => setCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <FontAwesomeIcon icon={faChevronLeft} className={cn('w-4 h-4 transition-transform', isCollapsed ? 'rotate-180' : '')} aria-hidden="true" />
        </button>
      </div>

      {hasContent(headerContent) && (
        <div className={cn('shrink-0 border-b border-border px-2 py-2', effectiveCollapsed && 'flex justify-center', headerClassName)}>
          {headerContent}
        </div>
      )}

      {searchable && !effectiveCollapsed && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-disabled" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
              placeholder="Search…"
              autoComplete="off"
              aria-label="Search navigation"
              className="w-full rounded-md border border-border bg-surface-base pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>
        </div>
      )}

      <nav
        className={cn('flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4 sidebar-scrollbar-hover', effectiveCollapsed && 'sidebar-scrollbar-none')}
        // Icon-only mode is too narrow to spare a scrollbar: the `scrollbar-gutter: stable`
        // of .sidebar-scrollbar-hover, or a classic scrollbar once the menu overflows
        // (Windows), would push the centered icons left, so the collapsed nav has neither.
        style={effectiveCollapsed ? { scrollbarGutter: 'auto' } : undefined}
        aria-label="Sidebar navigation"
      >
        {groups.map((group, gi) => {
          const groupKey = group.label ?? String(gi);
          const expanded = isGroupExpanded(group);
          const hasActive = group.items.some((i) => containsId(i, activeId));
          return (
          <div key={groupKey}>
            {group.label && !effectiveCollapsed && (
              group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={expanded}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1 rounded-md mb-1 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    hasActive ? 'text-text-primary' : 'text-text-disabled hover:text-text-secondary'
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{group.label}</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={cn('w-3 h-3 transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-disabled px-3 mb-1">
                  {group.label}
                </p>
              )
            )}
            {expanded && (
            <div className="space-y-0.5">
              {group.items.map((item) => renderItem(item, 0))}
            </div>
            )}
          </div>
          );
        })}
      </nav>

      {hasContent(footerContent) && (
        <div className={cn('border-t border-border shrink-0', effectiveCollapsed ? 'flex justify-center px-2 py-3' : '', footerClassName)}>
          {footerContent}
        </div>
      )}
    </div>
  );
}
