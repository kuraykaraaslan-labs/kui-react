# EmptyState

- **id:** `empty-state`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/EmptyState.tsx`
- **status:** stable
- **since:** 2025-02

Empty-state message shown when there is no data. Supports icon, title, description, and action slots.

## Used by

- `entity-aliases`

## Design tokens consumed

- `--primary`
- `--secondary`
- `--surface-sunken`
- `--text-disabled`
- `--text-primary`
- `--text-secondary`

## Variants

### With action

```tsx
<EmptyState icon="📁" title="No projects yet" description="Create your first project to get started." action={<Button variant="primary" size="sm">New project</Button>} />
```

### Minimal

```tsx
<EmptyState title="No results found" description="Try adjusting your search or filters." />
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {icon && <div className="h-12 w-12 rounded-full bg-surface-sunken flex items-center justify-center text-text-disabled text-2xl mb-4" aria-hidden="true">{icon}</div>}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-sm text-text-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```
