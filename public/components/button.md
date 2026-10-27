# Button

- **id:** `button`
- **layer:** ui
- **category:** Atom
- **filePath:** `modules/ui/Button.tsx`
- **status:** stable
- **since:** 2025-01

Core interactive element. Supports 6 visual styles (variants) and 5 sizes: secondary is the neutral alternative (Cancel, Back), accent the coloured one (a brand's second colour). disabled, loading and selected states are built-in.

## Used by

- `color-picker`
- `comment-thread`
- `confirm-dialog`
- `control-tile`
- `entity-aliases`
- `form-builder`
- `gantt`
- `onboarding-wizard`
- `popconfirm`
- `reviews-review-submit-form`
- `rich-text-editor`
- `share-dialog`

## Design tokens consumed

- `--accent`
- `--accent-fg`
- `--border`
- `--border-focus`
- `--border-strong`
- `--error`
- `--primary`
- `--primary-fg`
- `--primary-hover`
- `--surface-overlay`
- `--text-inverse`
- `--text-primary`

## Variants

### Primary

```tsx
<Button variant="primary">Primary</Button>
```

### Secondary

```tsx
<Button variant="secondary">Secondary</Button>
```

### Accent

```tsx
<Button variant="accent">Accent</Button>
```

### Ghost

```tsx
<Button variant="ghost">Ghost</Button>
```

### Danger

```tsx
<Button variant="danger">Danger</Button>
```

### Outline

```tsx
<Button variant="outline">Outline</Button>
```

### Disabled

```tsx
<Button variant="primary" disabled>Disabled</Button>
```

### Sizes

```tsx
<Button size="xs">XS</Button>
<Button size="sm">SM</Button>
<Button size="md">MD</Button>
<Button size="lg">LG</Button>
<Button size="xl">XL</Button>
```

### Icon left / right

```tsx
<Button iconLeft="⬇">Download</Button>
<Button variant="outline" iconRight="→">Next</Button>
```

### Icon only

```tsx
<Button iconOnly aria-label="Delete item">✕</Button>
```

### Full width

```tsx
<Button fullWidth>Full-width</Button>
```

### Selected / active state

```tsx
<Button variant="outline" selected>Selected</Button>
```

### Loading state

```tsx
<Button variant="primary" loading>Saving…</Button>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface-overlay text-text-primary hover:bg-border-strong',
  accent:    'bg-accent text-accent-fg hover:bg-accent-hover',
  ghost:     'bg-transparent text-text-primary hover:bg-surface-overlay',
  danger:    'bg-error text-text-inverse hover:opacity-90',
  outline:   'border border-border text-text-primary hover:bg-surface-overlay',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-lg',
};

export function Button({ children, variant = 'primary', size = 'md', disabled, loading, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant], sizeClasses[size]
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```
