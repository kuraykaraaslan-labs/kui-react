# AppSidebar

- **id:** `app-sidebar`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/AppSidebar.tsx`
- **status:** stable
- **since:** 2025-03

Collapsible side navigation. Accepts navGroups or navItems with a built-in collapse toggle. The searchable prop adds an inline filter; a header slot (above the nav groups) and a footer slot can host a workspace switcher, a user block or any content. Item badges take a count or any node. Items nest through children, indented behind a disclosure toggle; the branch holding the active item opens, also when activeId changes after client-side navigation, and search keeps the branch down to a match. renderLink swaps the plain anchors for a router Link; an external item (href + external) stays a plain anchor that opens a new tab, with a trailing outside-link icon and a hidden "(opens in a new tab)" note (messages.opensInNewTab), and is never marked active. headerClassName / footerClassName style the slot wrappers, e.g. to hide the whole strip at a breakpoint. The active item, link or button, is marked aria-current="page"; collapsed, the nav shows top-level items only and reserves no scrollbar gutter, so the icons stay centered.

## Design tokens consumed

- `--border`
- `--border-focus`
- `--primary`
- `--primary-subtle`
- `--secondary`
- `--surface-overlay`
- `--text-disabled`
- `--text-primary`
- `--text-secondary`

## Variants

### Açık (grouped nav + footer)

```tsx
<AppSidebar
  navGroups={[
    { label: 'Main',     items: mainItems },
    { label: 'Settings', items: settingsItems },
  ]}
  activeId={activeId}
  onSelect={setActiveId}
  footer={({ collapsed }) => (
    <div className={collapsed ? 'p-3 flex items-center justify-center' : 'p-3 flex items-center gap-2'}>
      <Avatar name="Jane Doe" size="sm" status="online" />
      {!collapsed && <p className="text-xs font-semibold">Jane Doe</p>}
    </div>
  )}
/>
```

### Arama filtreli

```tsx
<AppSidebar
  navGroups={navGroups}
  activeId={activeId}
  onSelect={setActiveId}
  searchable
/>
```

### Daraltılmış (icon-only)

```tsx
<AppSidebar
  navGroups={navGroups}
  activeId={activeId}
  onSelect={setActiveId}
  defaultCollapsed
/>
```

### Header + node badges

```tsx
<AppSidebar
  navGroups={[{ label: 'Main', items: [
    { id: 'analytics', label: 'Analytics', badge: 3 },                                       // a count
    { id: 'team', label: 'Team', badge: <Badge variant="warning" size="sm" dot>Beta</Badge> }, // any node
  ] }]}
  header={({ collapsed }) => <WorkspaceSwitcher compact={collapsed} />}   // above the nav groups
/>
```

### Nested items + router links

```tsx
<AppSidebar
  navItems={[
    { id: 'intro', label: 'Introduction', href: '/docs' },
    { id: 'guides', label: 'Guides', href: '/docs/guides', children: [   // a page with children: link + chevron
      { id: 'writing', label: 'Writing pages', href: '/docs/guides/writing' },
      { id: 'advanced', label: 'Advanced', children: [ /* ... */ ] },    // no page: the row toggles
    ] },
    { id: 'kuray-dev', label: 'kuray.dev', href: 'https://kuray.dev', external: true }, // new tab + outside-link icon
  ]}
  activeId={pathname}                                // its branch opens, also after client-side navigation
  renderLink={(item, props) => <Link {...props} />}  // next/link instead of full page loads
  header={<SiteLinks />}
  headerClassName="md:hidden"                        // drop the whole bordered strip at md and up
/>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';
import { Badge } from '@/modules/ui/Badge';

export function AppSidebar({ navGroups, navItems, activeId, onSelect, collapsed, defaultCollapsed = false, onCollapsedChange, footer, className, ...rest }) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const groups = navGroups ?? (navItems ? [{ items: navItems }] : []);
  const footerContent = typeof footer === 'function' ? footer({ collapsed: isCollapsed }) : footer;

  const setCollapsed = (next) => {
    if (collapsed === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <div data-collapsed={isCollapsed ? 'true' : 'false'} className={cn('flex flex-col flex-1 min-h-0 transition-all duration-200', isCollapsed ? 'w-14' : 'w-56', className)} {...rest}>
      <div className={cn('flex items-center px-2 py-2 border-b border-border', isCollapsed ? 'justify-center' : 'justify-end')}>
        <button type="button" onClick={() => setCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded text-text-secondary hover:bg-surface-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <span aria-hidden="true" className={cn('block text-lg transition-transform', isCollapsed ? 'rotate-180' : '')}>‹</span>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 sidebar-scrollbar-hover" aria-label="Sidebar navigation">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && !isCollapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-disabled px-3 mb-1">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button key={item.id} type="button"
                  aria-current={item.id === activeId ? 'page' : undefined}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => onSelect?.(item.id)}
                  className={cn('w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 text-left',
                    item.id === activeId ? 'bg-primary-subtle text-primary font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay')}>
                  {item.icon && <span aria-hidden="true" className="shrink-0 w-5 text-center text-[15px] leading-none">{item.icon}</span>}
                  {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!isCollapsed && item.badge > 0 && <Badge variant="primary" size="sm">{item.badge}</Badge>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footerContent != null && (
        <div className={cn('border-t border-border shrink-0', isCollapsed ? 'flex justify-center px-2 py-3' : '')}>{footerContent}</div>
      )}
    </div>
  );
}
```
