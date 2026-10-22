# AppShell

- **id:** `app-shell`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/AppShell.tsx`
- **status:** stable
- **since:** 2025-03

Full-screen layout wrapper with logo, sidebar and topbar slots. Sidebar renders as an aside on desktop and opens via a drawer on mobile.

## Design tokens consumed

- `--border`
- `--surface-base`
- `--surface-raised`

## Variants

### Sidebar + topbar + content

```tsx
const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

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
</AppShell>
```

### Sadece topbar (sidebar yok)

```tsx
<AppShell
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
</AppShell>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

export function AppShell({ logo, compactLogo, sidebarCollapsed = false, sidebar, topbar, children, className, ...rest }) {
  const logoContent = sidebarCollapsed && compactLogo ? compactLogo : (logo ?? compactLogo);

  return (
    <div className={cn('flex h-screen overflow-hidden bg-surface-base', className)} {...rest}>
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
}
```
