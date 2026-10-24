# Spinner

- **id:** `spinner`
- **layer:** ui
- **category:** Atom
- **filePath:** `modules/ui/Spinner.tsx`
- **status:** stable
- **since:** 2025-01

CSS border-based loading indicator. Does not require FontAwesome. 5 sizes, border-border / border-t-primary colour system.

## Used by

- `entity-aliases`

## Design tokens consumed

- `--border`

## Variants

### Sizes

```tsx
<Spinner size="xs" />
<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />
<Spinner size="xl" />
```

### In a Button

```tsx
<Button variant="primary" loading>Loading…</Button>
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

const sizeMap = {
  xs: 'h-3 w-3 border', sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2', lg: 'h-8 w-8 border-[3px]', xl: 'h-12 w-12 border-4',
};

export function Spinner({ size = 'md', className }) {
  return (
    <>
      <span aria-hidden="true" className={cn('inline-block rounded-full border-border border-t-primary animate-spin', sizeMap[size], className)} />
      <span className="sr-only">Loading…</span>
    </>
  );
}
```
