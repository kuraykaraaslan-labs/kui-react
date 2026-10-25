# Input

- **id:** `input`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Input.tsx`
- **status:** stable
- **since:** 2025-02

Text input field with label, hint, error, prefix icon, password toggle, and 3 size variants.

## Used by

- `entity-aliases`
- `form-builder`
- `reviews-review-submit-form`
- `rich-text-editor`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--error`
- `--error-subtle`
- `--primary`
- `--secondary`
- `--surface-base`
- `--surface-sunken`
- `--text-disabled`
- `--text-primary`
- `--text-secondary`

## Variants

### Default

```tsx
<Input id="email" label="Email" type="email" placeholder="you@example.com" hint="We'll never share your email." />
```

### Hidden label (hideLabel)

```tsx
// An editable table cell: the column heading shows what it is; the label stays the accessible name.
<Input id="qty-a" label="Quantity of Widget A" hideLabel type="number" />
```

### Error

```tsx
<Input id="email" label="Email" type="email" error="A valid email address is required." required />
```

### Disabled

```tsx
<Input id="email" label="Email" type="email" placeholder="you@example.com" disabled />
```

### Prefix / suffix icon

```tsx
<Input id="search" label="Search" prefixIcon={<SearchIcon />} placeholder="Search…" />
<Input id="amount" label="Amount" suffixIcon={<span>$</span>} type="number" />
```

### Clearable

```tsx
function Demo() {
  const [v, setV] = useState('');
  return <Input id="clr" label="Label" value={v} onChange={(e) => setV(e.target.value)}
    clearable onClear={() => setV('')} />;
}
```

### Success state

```tsx
<Input id="username" label="Username" value="johndoe" success="Username is available!" />
```

### Read only

```tsx
<Input id="api-key" label="API Key" value="sk-abc123xyz" readOnly />
```

### Character counter

```tsx
<Input id="bio" label="Bio" value={v} onChange={(e) => setV(e.target.value)} maxLength={50} showCount />
```

### Password with eye toggle

```tsx
<Input id="password" label="Password" type="password" value={v} onChange={setV} />
```

### Number stepper

```tsx
<Input id="qty" label="Quantity" type="number" value={v} onChange={setV} min={0} max={99} />
```

### Prefix / suffix text

```tsx
<Input id="website" label="Website"
  prefixIcon={<span className="text-text-secondary text-xs font-mono">https://</span>}
  placeholder="yoursite.com" />

<Input id="handle" label="Twitter handle"
  prefixIcon={<span className="text-text-secondary">@</span>}
  placeholder="username" />

<Input id="price" label="Price"
  suffixIcon={<span className="text-text-secondary">USD</span>}
  type="number" />
```

### Loading state

```tsx
<Input id="username" label="Username" value={v} onChange={setV}
  suffixIcon={<Spinner size="xs" />}
  hint="Checking availability…" />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

export function Input({ id, label, hint, error, required, className, ...props }) {
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </label>
      <input id={id} required={required} aria-invalid={!!error} aria-describedby={describedBy || undefined}
        className={cn('block w-full rounded-md border px-3 py-2 text-sm transition-colors text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken', error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border bg-surface-base', className)}
        {...props} />
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}
```
