# Checkbox

- **id:** `checkbox`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Checkbox.tsx`
- **status:** stable
- **since:** 2025-02

Label + checkbox + optional hint / error message. aria-describedby is wired up and border-error is applied on the error state.

## Used by

- `entity-aliases`
- `form-builder`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--error`
- `--primary`
- `--secondary`
- `--text-disabled`
- `--text-primary`
- `--text-secondary`

## Variants

### Default

```tsx
<Checkbox id="accept" label="I agree to the Terms of Service" />
```

### With hint

```tsx
<Checkbox id="newsletter" label="Subscribe to newsletter" hint="We send weekly updates, no spam." />
```

### Error

```tsx
<Checkbox id="accept" label="I agree to the Terms of Service" error="You must accept the terms." />
```

### Disabled

```tsx
<Checkbox id="accept" label="Checked and disabled" defaultChecked disabled />
```

### Indeterminate (select all)

```tsx
// Set indeterminate prop to show mixed state:
<Checkbox id="all" label="Select all" checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

export function Checkbox({ id, label, hint, error, disabled, className, ...props }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" disabled={disabled} aria-describedby={describedBy} aria-invalid={!!error}
        className={cn('mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed', error && 'border-error')} {...props} />
      <div>
        <label htmlFor={id} className={cn('text-sm font-medium', disabled ? 'text-text-disabled' : 'text-text-primary')}>{label}</label>
        {hint && !error && <p id={hintId} className="text-xs text-text-secondary mt-0.5">{hint}</p>}
        {error && <p id={errorId} className="text-xs text-error mt-0.5" role="alert">{error}</p>}
      </div>
    </div>
  );
}
```
