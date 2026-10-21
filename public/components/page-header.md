# PageHeader

- **id:** `page-header`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/PageHeader.tsx`
- **status:** stable
- **since:** 2025-02

Page title + subtitle + optional badge + action buttons. Supports 5 button variants (primary/secondary/outline/danger/ghost); rendered as a link with href or as a button.

## Design tokens consumed

- `--border`
- `--border-focus`
- `--error`
- `--primary`
- `--primary-fg`
- `--primary-hover`
- `--secondary`
- `--surface-overlay`
- `--text-inverse`
- `--text-primary`
- `--text-secondary`

## Variants

### With actions

```tsx
<PageHeader
  title="Users"
  subtitle="Manage your team members."
  badge={<Badge variant="info">48 members</Badge>}
  actions={[
    { label: 'Export', variant: 'outline' },
    { label: '+ Invite user', variant: 'primary' },
  ]}
/>
```

### Danger action

```tsx
<PageHeader
  title="Danger Zone"
  subtitle="Irreversible actions."
  actions={[
    { label: 'Archive', variant: 'outline' },
    { label: 'Delete project', variant: 'danger' },
  ]}
/>
```

### Minimal

```tsx
<PageHeader title="Settings" subtitle="Configure your workspace preferences." />
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

const variantMap = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-secondary text-secondary-fg hover:bg-secondary-hover',
  outline:   'border border-border text-text-primary hover:bg-surface-overlay',
  danger:    'bg-error text-text-inverse hover:opacity-90',
  ghost:     'bg-transparent text-text-primary hover:bg-surface-overlay',
};

export function PageHeader({ title, subtitle, badge, actions, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 pb-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary leading-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions?.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((action, i) => (
            <button key={i} type="button" onClick={action.onClick} disabled={action.disabled} className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50', variantMap[action.variant ?? 'primary'])}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```
