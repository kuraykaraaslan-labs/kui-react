'use client';
import { AppShell } from '@/modules/app/AppShell';
import { AppSidebar } from '@/modules/app/AppSidebar';
import { AppTopBar } from '@/modules/app/AppTopBar';
import { UserMenu } from '@/modules/domains/common/user/UserMenu';
import { NotificationMenu } from '@/modules/domains/common/notification/NotificationMenu';
import { GlobalSearch } from '@/modules/app/GlobalSearch';
import { Avatar } from '@/modules/ui/Avatar';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { useState, type ComponentProps } from 'react';
import type { ShowcaseComponent } from '../showcase.types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faCog, faGear, faHouse, faUsers } from '@fortawesome/free-solid-svg-icons';

const DEMO_NOTIFICATIONS = [
  { id: 'n1', title: 'New comment on your post', description: 'Jane replied to your article "Getting started with Next.js".', timestamp: '2 min ago', read: false, variant: 'info' as const },
  { id: 'n2', title: 'Payment received', description: 'Invoice #1042 has been paid ($153.96).', timestamp: '1 hr ago', read: false, variant: 'success' as const },
  { id: 'n3', title: 'Storage limit at 90%', description: 'You are using 9 GB of your 10 GB plan.', timestamp: '3 hr ago', read: false, variant: 'warning' as const },
  { id: 'n4', title: 'Deployment complete', description: 'v2.4.1 deployed to production successfully.', timestamp: 'Yesterday', read: true, variant: 'success' as const },
];

const DEMO_USER: ComponentProps<typeof UserMenu>['user'] = {
  userId: 'demo-1',
  email: 'jane@acme.com',
  userRole: 'ADMIN',
  userStatus: 'ACTIVE',
  userProfile: { name: 'Jane Doe', profilePicture: null },
};

const SIMPLE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <FontAwesomeIcon icon={faHouse}    className="w-3 h-3" /> },
  { id: 'analytics', label: 'Analytics', icon: <FontAwesomeIcon icon={faChartBar} className="w-3 h-3" /> },
  { id: 'team',      label: 'Team',      icon: <FontAwesomeIcon icon={faUsers}    className="w-3 h-3" /> },
  { id: 'settings',  label: 'Settings',  icon: <FontAwesomeIcon icon={faCog}      className="w-3 h-3" /> },
];

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <FontAwesomeIcon icon={faHouse}    className="w-3 h-3" /> },
      { id: 'analytics', label: 'Analytics', icon: <FontAwesomeIcon icon={faChartBar} className="w-3 h-3" />, badge: 3 },
      { id: 'team',      label: 'Team',      icon: <FontAwesomeIcon icon={faUsers}    className="w-3 h-3" /> },
      { id: 'settings',  label: 'Settings',  icon: <FontAwesomeIcon icon={faCog}      className="w-3 h-3" /> },
    ],
  },
];

function NotificationMenuDemo() {
  const [items, setItems] = useState(DEMO_NOTIFICATIONS);
  return (
    <NotificationMenu
      items={items}
      onMarkAllRead={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
      onViewAll={() => {}}
    />
  );
}

function AppShellFullDemo() {
  const [activeId, setActiveId] = useState('dashboard');
  // The preview is a whole shell in a narrow pane: the sidebar starts collapsed and the user menu
  // shows its avatar only, so the top bar's search, bell and menu fit next to the sidebar.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
      <AppShell
        logo={<span className="text-sm font-bold text-primary">Acme</span>}
        compactLogo={<span className="text-xs font-bold text-primary">A</span>}
        sidebarCollapsed={sidebarCollapsed}
        sidebar={
          <AppSidebar
            navItems={SIMPLE_NAV_ITEMS}
            activeId={activeId}
            onSelect={setActiveId}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            footer={({ collapsed }) => (
              <div className={collapsed ? 'p-2 flex items-center justify-center' : 'p-2 flex items-center gap-2'}>
                <Avatar name="Jane Doe" size="sm" />
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">Jane Doe</p>
                    <p className="text-[10px] text-text-secondary">Admin</p>
                  </div>
                )}
              </div>
            )}
          />
        }
        topbar={
          <AppTopBar>
            <GlobalSearch onSearch={() => {}} onSelect={() => {}} className="flex-1 max-w-sm hidden sm:block" />
            <div className="ml-auto flex items-center gap-1">
              <NotificationMenuDemo />
              <UserMenu user={DEMO_USER} onlyAvatar />
            </div>
          </AppTopBar>
        }
        className="h-full min-h-0"
      >
        <div className="space-y-2.5">
          <div className="h-4 w-1/4 rounded bg-surface-sunken animate-pulse" />
          <div className="h-3 w-full rounded bg-surface-sunken/60 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-surface-sunken/60 animate-pulse" />
          <div className="h-16 rounded-lg bg-surface-sunken/60 animate-pulse mt-2" />
        </div>
      </AppShell>
    </div>
  );
}

function AppShellMinimalDemo() {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: 200 }}>
      <AppShell
        topbar={
          <AppTopBar logo={<span className="font-bold text-primary text-sm">Acme</span>}>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="primary" size="sm">New project</Button>
              <UserMenu user={DEMO_USER} />
            </div>
          </AppTopBar>
        }
        className="h-full min-h-0"
      >
        <div className="space-y-2">
          <div className="h-3 w-1/3 rounded bg-surface-sunken animate-pulse" />
          <div className="h-2.5 w-full rounded bg-surface-sunken/60 animate-pulse" />
          <div className="h-2.5 w-5/6 rounded bg-surface-sunken/60 animate-pulse" />
        </div>
      </AppShell>
    </div>
  );
}

function AppSidebarExpandedDemo() {
  const [activeId, setActiveId] = useState('dashboard');
  return (
    <div className="flex justify-center py-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface-raised flex" style={{ height: 320 }}>
        <AppSidebar
          navGroups={NAV_GROUPS}
          activeId={activeId}
          onSelect={setActiveId}
          footer={({ collapsed }) => (
            <div className={collapsed ? 'p-2 flex items-center justify-center' : 'p-2 flex items-center gap-2'}>
              <Avatar name="Jane Doe" size="sm" status="online" />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">Jane Doe</p>
                  <p className="text-[10px] text-text-secondary">Admin</p>
                </div>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

function AppSidebarNestedDemo() {
  const [activeId, setActiveId] = useState('plugins');
  const items = [
    { id: 'intro', label: 'Introduction', href: '#intro' },
    {
      id: 'guides', label: 'Guides', href: '#guides',
      children: [
        { id: 'writing', label: 'Writing pages', href: '#writing' },
        { id: 'advanced', label: 'Advanced', children: [
          { id: 'plugins', label: 'Fence plugins', href: '#plugins' },
          { id: 'theming', label: 'Theming', href: '#theming' },
        ] },
      ],
    },
    { id: 'reference', label: 'Reference', children: [
      { id: 'config', label: 'Configuration', href: '#config' },
      { id: 'api', label: 'API', href: '#api' },
    ] },
  ];
  return (
    <div className="flex justify-center py-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface-raised flex" style={{ height: 360 }}>
        <AppSidebar
          navItems={items}
          activeId={activeId}
          // A router Link goes here in an app; the demo stays on the page.
          renderLink={(item, props) => (
            <a {...props} onClick={(e) => { e.preventDefault(); setActiveId(item.id); }} />
          )}
        />
      </div>
    </div>
  );
}

function AppSidebarHeaderDemo() {
  const [activeId, setActiveId] = useState('dashboard');
  const groups = [
    {
      label: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <FontAwesomeIcon icon={faHouse} className="w-3 h-3" /> },
        { id: 'analytics', label: 'Analytics', icon: <FontAwesomeIcon icon={faChartBar} className="w-3 h-3" />, badge: 3 },
        { id: 'team', label: 'Team', icon: <FontAwesomeIcon icon={faUsers} className="w-3 h-3" />, badge: <Badge variant="warning" size="sm" dot>Beta</Badge> },
      ],
    },
  ];
  return (
    <div className="flex justify-center py-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface-raised flex" style={{ height: 320 }}>
        <AppSidebar
          navGroups={groups}
          activeId={activeId}
          onSelect={setActiveId}
          searchable={false}
          header={({ collapsed }) => (
            <div className={collapsed ? 'flex justify-center' : 'flex items-center gap-2 px-1'}>
              <Avatar name="Acme Corp" size="sm" />
              {!collapsed && <span className="text-xs font-semibold text-text-primary truncate">Acme Corp</span>}
            </div>
          )}
        />
      </div>
    </div>
  );
}

function AppTopBarRegionsDemo() {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center h-14 px-4 bg-surface-raised">
        <AppTopBar
          logo={<span className="font-black text-primary text-lg">Acme</span>}
          start={<Badge variant="neutral" size="sm">Production</Badge>}
          end={[
            { id: 'user', order: 100, node: <UserMenu user={DEMO_USER} onlyAvatar /> },
            { id: 'notifications', order: 10, node: <NotificationMenuDemo /> },
            { id: 'help', node: <Button variant="ghost" size="sm">Help</Button> },
            { id: 'calls', order: 20, hidden: true, node: <Button variant="ghost" size="sm">Calls</Button> },
          ]}
        />
      </div>
    </div>
  );
}

function AppSidebarSearchDemo() {
  const [activeId, setActiveId] = useState('dashboard');
  return (
    <div className="flex justify-center py-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface-raised flex" style={{ height: 320 }}>
        <AppSidebar
          navGroups={NAV_GROUPS}
          activeId={activeId}
          onSelect={setActiveId}
          searchable
        />
      </div>
    </div>
  );
}

function AppSidebarCollapsedDemo() {
  const [activeId, setActiveId] = useState('dashboard');
  return (
    <div className="flex justify-center py-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface-raised flex" style={{ height: 320 }}>
        <AppSidebar
          navGroups={NAV_GROUPS}
          activeId={activeId}
          onSelect={setActiveId}
          defaultCollapsed
        />
      </div>
    </div>
  );
}

function AppTopBarSearchDemo() {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center h-14 px-4 bg-surface-raised">
        <AppTopBar>
          <GlobalSearch onSearch={() => {}} onSelect={() => {}} className="flex-1 max-w-sm hidden sm:block" />
          <div className="ml-auto flex items-center gap-1">
            <NotificationMenuDemo />
            <Button variant="ghost" size="sm" iconOnly aria-label="Settings"><FontAwesomeIcon icon={faGear} className="w-3 h-3" /></Button>
            <UserMenu user={DEMO_USER} />
          </div>
        </AppTopBar>
      </div>
    </div>
  );
}

function AppTopBarLogoDemo() {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center h-14 px-4 bg-surface-raised">
        <AppTopBar logo={<span className="font-black text-primary text-lg">Acme</span>}>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="sm">Upgrade</Button>
            <UserMenu user={DEMO_USER} />
          </div>
        </AppTopBar>
      </div>
    </div>
  );
}

export function buildAppShellData(): ShowcaseComponent[] {
  return [
    {
      id: 'app-shell',
      title: 'AppShell',
      category: 'App',
      abbr: 'AS',
      description: 'Full-screen layout wrapper with logo, sidebar and topbar slots. Sidebar renders as an aside on desktop and opens via a drawer on mobile.',
      filePath: 'modules/app/AppShell.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

export function AppShell({ logo, compactLogo, sidebarCollapsed = false, sidebar, topbar, children, className, ...rest }) {
  const logoContent = sidebarCollapsed && compactLogo ? compactLogo : (logo ?? compactLogo);

  return (
    <div className={cn('relative flex h-screen overflow-hidden bg-surface-base', className)} {...rest}>
      {sidebar && (
        <aside className="relative hidden lg:flex flex-col h-full min-h-0 shrink-0 border-r border-border bg-surface-raised">
          {logoContent && (
            <div className={cn(
              'absolute inset-x-0 top-0 z-10 flex items-center h-14 border-b border-border bg-surface-raised overflow-hidden',
              sidebarCollapsed && compactLogo ? 'justify-center px-2' : 'px-4'
            )}>{logoContent}</div>
          )}
          <div className={cn('flex min-h-0 flex-1', logoContent && 'pt-14')}>
            {sidebar}
          </div>
        </aside>
      )}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {topbar && (
          <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-border bg-surface-raised/90 backdrop-blur shrink-0">
            {topbar}
          </header>
        )}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}`,
      variants: [
        {
          title: 'Sidebar + topbar + content',
          layout: 'stack' as const,
          preview: <AppShellFullDemo />,
          code: `const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

<AppShell
  logo={<span className="font-black text-primary">Acme</span>}
  compactLogo={<span className="font-black text-primary">A</span>}
  sidebarCollapsed={sidebarCollapsed}
  sidebar={
    <AppSidebar
      navGroups={navGroups}
      activeId={activeId}
      onSelect={setActiveId}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
      searchable
      footer={<Avatar name="Jane Doe" size="sm" status="online" />}
    />
  }
  topbar={
    <AppTopBar>
      <GlobalSearch onSearch={handleSearch} onSelect={handleSelect} className="flex-1 max-w-sm hidden sm:block" />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" iconOnly>🔔</Button>
        <UserMenu user={currentUser} onlyAvatar />
      </div>
    </AppTopBar>
  }
>
  {/* page content */}
</AppShell>`,
        },
        {
          title: 'Sadece topbar (sidebar yok)',
          layout: 'stack' as const,
          preview: <AppShellMinimalDemo />,
          code: `<AppShell
  topbar={
    <AppTopBar logo={<span className="font-bold text-primary">Acme</span>}>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="primary" size="sm">New project</Button>
        <UserMenu user={currentUser} />
      </div>
    </AppTopBar>
  }
>
  {/* page content */}
</AppShell>`,
        },
      ],
    },
    {
      id: 'app-sidebar',
      title: 'AppSidebar',
      category: 'App',
      abbr: 'Ab',
      description: 'Collapsible side navigation. Accepts navGroups or navItems with a built-in collapse toggle. The searchable prop adds an inline filter; a header slot (above the nav groups) and a footer slot can host a workspace switcher, a user block or any content. Item badges take a count or any node. Items nest through children, indented behind a disclosure toggle; the branch holding the active item opens, also when activeId changes after client-side navigation, and search keeps the branch down to a match. renderLink swaps the plain anchors for a router Link. headerClassName / footerClassName style the slot wrappers, e.g. to hide the whole strip at a breakpoint. The active item, link or button, is marked aria-current="page"; collapsed, the nav shows top-level items only and reserves no scrollbar gutter, so the icons stay centered.',
      filePath: 'modules/app/AppSidebar.tsx',
      sourceCode: `'use client';
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
}`,
      variants: [
        {
          title: 'Açık (grouped nav + footer)',
          layout: 'stack' as const,
          preview: <AppSidebarExpandedDemo />,
          code: `<AppSidebar
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
/>`,
        },
        {
          title: 'Arama filtreli',
          layout: 'stack' as const,
          preview: <AppSidebarSearchDemo />,
          code: `<AppSidebar
  navGroups={navGroups}
  activeId={activeId}
  onSelect={setActiveId}
  searchable
/>`,
        },
        {
          title: 'Daraltılmış (icon-only)',
          layout: 'stack' as const,
          preview: <AppSidebarCollapsedDemo />,
          code: `<AppSidebar
  navGroups={navGroups}
  activeId={activeId}
  onSelect={setActiveId}
  defaultCollapsed
/>`,
        },
        {
          title: 'Header + node badges',
          layout: 'stack' as const,
          preview: <AppSidebarHeaderDemo />,
          code: `<AppSidebar
  navGroups={[{ label: 'Main', items: [
    { id: 'analytics', label: 'Analytics', badge: 3 },                                       // a count
    { id: 'team', label: 'Team', badge: <Badge variant="warning" size="sm" dot>Beta</Badge> }, // any node
  ] }]}
  header={({ collapsed }) => <WorkspaceSwitcher compact={collapsed} />}   // above the nav groups
/>`,
        },
        {
          title: 'Nested items + router links',
          layout: 'stack' as const,
          preview: <AppSidebarNestedDemo />,
          code: `<AppSidebar
  navItems={[
    { id: 'intro', label: 'Introduction', href: '/docs' },
    { id: 'guides', label: 'Guides', href: '/docs/guides', children: [   // a page with children: link + chevron
      { id: 'writing', label: 'Writing pages', href: '/docs/guides/writing' },
      { id: 'advanced', label: 'Advanced', children: [ /* ... */ ] },    // no page: the row toggles
    ] },
  ]}
  activeId={pathname}                                // its branch opens, also after client-side navigation
  renderLink={(item, props) => <Link {...props} />}  // next/link instead of full page loads
  header={<SiteLinks />}
  headerClassName="md:hidden"                        // drop the whole bordered strip at md and up
/>`,
        },
      ],
    },
    {
      id: 'app-top-bar',
      title: 'AppTopBar',
      category: 'App',
      abbr: 'AT',
      description: 'Top bar wrapper passed into AppShell\'s header slot. The logo slot anchors the left side while children (GlobalSearch, UserMenu, Button, etc.) are arranged in a flex row. Named regions `start` (after the logo) and `end` (pushed to the far end) take a node or ordered `{ id, node, order, hidden }` items, for controls other modules contribute.',
      filePath: 'modules/app/AppTopBar.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

export function AppTopBar({ logo, children, className, ...rest }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3 flex-1', className)} {...rest}>
      {logo && <div className="shrink-0">{logo}</div>}
      {children}
    </div>
  );
}`,
      variants: [
        {
          title: 'Arama + actions + kullanıcı',
          layout: 'stack' as const,
          preview: <AppTopBarSearchDemo />,
          code: `<AppTopBar>
  <GlobalSearch
    onSearch={handleSearch}
    onSelect={handleSelect}
    className="flex-1 max-w-sm hidden sm:block"
  />
  <div className="ml-auto flex items-center gap-1">
    <Button variant="ghost" size="sm" iconOnly aria-label="Notifications">🔔</Button>
    <Button variant="ghost" size="sm" iconOnly aria-label="Settings">⚙️</Button>
    <UserMenu user={currentUser} />
  </div>
</AppTopBar>`,
        },
        {
          title: 'Logo + action + kullanıcı',
          layout: 'stack' as const,
          preview: <AppTopBarLogoDemo />,
          code: `<AppTopBar logo={<span className="font-black text-primary text-lg">Acme</span>}>
  <div className="ml-auto flex items-center gap-2">
    <Button variant="primary" size="sm">Upgrade</Button>
    <UserMenu user={currentUser} />
  </div>
</AppTopBar>`,
        },
        {
          title: 'Regions: start + ordered end items',
          layout: 'stack' as const,
          preview: <AppTopBarRegionsDemo />,
          code: `// Contributed controls arrive as ordered items; hidden ones are left out.
<AppTopBar
  logo={<Logo />}
  start={<EnvironmentBadge />}
  end={[
    { id: 'notifications', order: 10, node: <NotificationBell /> },
    { id: 'calls', order: 20, node: <PresenceToggle />, hidden: !telephonyEnabled },
    { id: 'user', order: 100, node: <UserMenu user={currentUser} /> },
  ]}
/>`,
        },
      ],
    },
  ];
}
