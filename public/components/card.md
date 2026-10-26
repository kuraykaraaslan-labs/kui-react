# Card

- **id:** `card`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Card.tsx`
- **status:** stable
- **since:** 2025-02

Content container with raised / flat / outline variants and default / compact density (compact: 16 px sides, for narrow side panels and embedded views). Supports title, subtitle, headerRight, footer slots and loading skeleton state.

## Design tokens consumed

- `--border`
- `--primary`
- `--secondary`
- `--surface-base`
- `--surface-raised`
- `--text-primary`
- `--text-secondary`

## Variants

### Raised

```tsx
<Card title="User profile" subtitle="Manage your account" headerRight={<Badge variant="success">Active</Badge>}>
  <p>Card body content goes here.</p>
</Card>
```

### With footer

```tsx
<Card title="Confirm deletion" footer={<><Button variant="outline" size="sm">Cancel</Button><Button variant="danger" size="sm">Delete</Button></>}>
  <p>This action is irreversible.</p>
</Card>
```

### Flat

```tsx
<Card variant="flat" title="Flat card">
  <p>No shadow, uses page background color.</p>
</Card>
```

### Outline

```tsx
<Card variant="outline" title="Outline card">
  <p>Transparent background, border only.</p>
</Card>
```

### Clickable / hoverable

```tsx
<Card title="Clickable" onClick={() => navigate('/detail')}>...</Card>
<Card title="Hoverable" hoverable>...</Card>
```

### Loading skeleton

```tsx
<Card loading />
```

### Compact (narrow panel)

```tsx
<Card density="compact" title="Incident" subtitle="Where, what, how bad" footer={<Button size="sm">Plan the response</Button>}>
  <p>16 px sides, for a narrow side panel.</p>
</Card>
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

const densityClasses = {
  default: { header: 'px-6 py-4', body: 'px-6 py-4', footer: 'px-6 py-3' },
  compact: { header: 'px-4 py-3', body: 'px-4 py-3', footer: 'px-4 py-2.5' },
};

export function Card({ title, subtitle, headerRight, footer, children, variant = 'raised', density = 'default', className }) {
  const pad = densityClasses[density];
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', variant === 'raised' && 'bg-surface-raised shadow-sm', variant === 'flat' && 'bg-surface-base', variant === 'outline' && 'bg-transparent', className)}>
      {(title || headerRight) && (
        <div className={cn('flex items-start justify-between gap-3 border-b border-border', pad.header)}>
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}
      {children && <div className={pad.body}>{children}</div>}
      {footer && <div className={cn('border-t border-border bg-surface-base', pad.footer)}>{footer}</div>}
    </div>
  );
}
```
