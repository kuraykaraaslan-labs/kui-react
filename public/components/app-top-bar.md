# AppTopBar

- **id:** `app-top-bar`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/AppTopBar.tsx`
- **status:** stable
- **since:** 2025-03

Top bar wrapper passed into AppShell's header slot. The logo slot anchors the left side while children (GlobalSearch, UserMenu, Button, etc.) are arranged in a flex row. Named regions `start` (after the logo) and `end` (pushed to the far end) take a node or ordered `{ id, node, order, hidden }` items, for controls other modules contribute.

## Variants

### Arama + actions + kullanıcı

```tsx
<AppTopBar>
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
</AppTopBar>
```

### Logo + action + kullanıcı

```tsx
<AppTopBar logo={<span className="font-black text-primary text-lg">Acme</span>}>
  <div className="ml-auto flex items-center gap-2">
    <Button variant="primary" size="sm">Upgrade</Button>
    <UserMenu user={currentUser} />
  </div>
</AppTopBar>
```

### Regions: start + ordered end items

```tsx
// Contributed controls arrive as ordered items; hidden ones are left out.
<AppTopBar
  logo={<Logo />}
  start={<EnvironmentBadge />}
  end={[
    { id: 'notifications', order: 10, node: <NotificationBell /> },
    { id: 'calls', order: 20, node: <PresenceToggle />, hidden: !telephonyEnabled },
    { id: 'user', order: 100, node: <UserMenu user={currentUser} /> },
  ]}
/>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

export function AppTopBar({ logo, children, className, ...rest }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3 flex-1', className)} {...rest}>
      {logo && <div className="shrink-0">{logo}</div>}
      {children}
    </div>
  );
}
```
