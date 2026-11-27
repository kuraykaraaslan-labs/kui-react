# Badge

- **id:** `badge`
- **layer:** ui
- **category:** Atom
- **filePath:** `modules/ui/Badge.tsx`
- **status:** stable
- **since:** 2025-01

Status, category or label indicator. 6 semantic variants, 3 sizes, dot and dismissible support.

## Used by

- `kanban-board`
- `landing-promo-banner`
- `maintenance-page`
- `reviews-review-card`

## Design tokens consumed

- `--error`
- `--error-subtle`
- `--info`
- `--info-subtle`
- `--primary`
- `--primary-subtle`
- `--secondary`
- `--success`
- `--success-fg`
- `--success-subtle`
- `--surface-sunken`
- `--text-secondary`
- `--warning`
- `--warning-subtle`

## Variants

### Success

```tsx
<Badge variant="success">Active</Badge>
```

### Error

```tsx
<Badge variant="error">Inactive</Badge>
```

### Warning

```tsx
<Badge variant="warning">Pending</Badge>
```

### Info

```tsx
<Badge variant="info">New</Badge>
```

### Neutral

```tsx
<Badge variant="neutral">Design</Badge>
```

### Primary

```tsx
<Badge variant="primary">Frontend</Badge>
```

### Sizes

```tsx
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>
```

### Dot badge

```tsx
<Badge variant="success" dot>Online</Badge>
<Badge variant="warning" dot>Away</Badge>
```

### Dismissible

```tsx
<Badge variant="primary" dismissible onDismiss={() => remove(tag)}>React</Badge>
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

const variantMap = {
  success: 'bg-success-subtle text-success-fg',
  error:   'bg-error-subtle text-error-fg',
  warning: 'bg-warning-subtle text-warning-fg',
  info:    'bg-info-subtle text-info-fg',
  neutral: 'bg-surface-sunken text-text-secondary',
  primary: 'bg-primary-subtle text-primary',
};

export function Badge({ children, variant = 'neutral', className }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variantMap[variant], className)}>
      {children}
    </span>
  );
}
```
