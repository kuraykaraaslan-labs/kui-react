# Breadcrumb

- **id:** `breadcrumb`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Breadcrumb.tsx`
- **status:** stable
- **since:** 2025-02

Hierarchical navigation trail wrapped in a nav landmark (ariaLabel, default "Breadcrumb"). Last item marked with aria-current="page" and aria-hidden separators. renderLink renders linked items through a router Link for client-side navigation. Items take an icon, a chip (pill) style and a status tone dot; `leading` puts a node (a page-menu button) first, never collapsed by maxItems.

## Design tokens consumed

- `--border`
- `--border-focus`
- `--primary`
- `--secondary`
- `--text-disabled`
- `--text-primary`
- `--text-secondary`

## Variants

### Default

```tsx
<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Components', href: '/components' },
  { label: 'Breadcrumb' },
]} />
```

### Long path

```tsx
<Breadcrumb items={[
  { label: 'Dashboard', href: '/' },
  { label: 'Users', href: '/users' },
  { label: 'Settings', href: '/users/settings' },
  { label: 'Permissions' },
]} />
```

### Custom separator

```tsx
<Breadcrumb items={[...]} separator={<span>/</span>} />
```

### Overflow / ellipsis

```tsx
<Breadcrumb items={[/* 6 items */]} maxItems={3} />
```

### Router link

```tsx
import Link from 'next/link';

<Breadcrumb
  ariaLabel="Page trail"
  items={[...]}
  renderLink={(item, className) => (
    <Link href={item.href} className={className}>{item.label}</Link>
  )}
/>
```

### Page path: leading menu, chips, tones

```tsx
<Breadcrumb
  ariaLabel="Board pages"
  leading={<DropdownMenu trigger={<Button variant="ghost" size="xs">Pages ▾</Button>} items={pages} />}
  items={[
    { label: 'Overview', href: '/b/overview', chip: true },
    { label: 'Line 1', href: '/b/line-1', chip: true, tone: 'success' },
    { label: 'Pump room', chip: true, tone: 'warning' },
  ]}
/>
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

export function Breadcrumb({ items, className, renderLink, ariaLabel = 'Breadcrumb' }) {
  const linkClass = 'text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded';
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {!isLast && item.href ? (
                <>{renderLink ? renderLink({ ...item, href: item.href }, linkClass) : <a href={item.href} className={linkClass}>{item.label}</a>}<span aria-hidden="true" className="text-text-disabled">›</span></>
              ) : (
                <span className={isLast ? 'text-text-primary font-medium' : 'text-text-secondary'} aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```
