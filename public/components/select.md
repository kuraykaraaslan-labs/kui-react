# Select

- **id:** `select`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Select.tsx`
- **status:** stable
- **since:** 2025-02

Label + select + hint + error anatomy. appearance-none overrides the native dropdown style and renders a chevron icon.

## Used by

- `entity-aliases`
- `form-builder`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--error`
- `--error-subtle`
- `--primary`
- `--secondary`
- `--surface-base`
- `--surface-sunken`
- `--text-primary`
- `--text-secondary`

## Variants

### Controlled

```tsx
const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const [role, setRole] = useState('editor');
<Select id="role" label="Role" options={ROLES} value={role}
  onChange={(e) => setRole(e.target.value)} />
```

### With icons

```tsx
const STATUSES = [
  { value: 'active',   label: 'Active',   icon: <span className="text-success">●</span> },
  { value: 'inactive', label: 'Inactive', icon: <span className="text-text-disabled">●</span> },
  { value: 'pending',  label: 'Pending',  icon: <span className="text-warning">●</span> },
];

<Select id="status" label="Status" options={STATUSES} value={status} onChange={setStatus} />
```

### Validation states

```tsx
<Select id="plan" label="Plan" placeholder="Select a plan" required
  error="Please select a plan." options={[...]} />

<Select id="plan" label="Plan" disabled options={[...]} value="pro" />
```

### With countries

```tsx
import { countries, getEmojiFlag } from 'countries-list';

const COUNTRY_OPTIONS = Object.entries(countries)
  .map(([code, data]) => ({ value: code, label: `${getEmojiFlag(code)} ${data.name}` }))
  .sort((a, b) => a.label.localeCompare(b.label));

<Select id="country" label="Country" placeholder="Select a country…"
  options={COUNTRY_OPTIONS} hint="Powered by countries-list." />
```

### Searchable

```tsx
<Select id="country" label="Country" placeholder="Select a country…" searchable
  options={COUNTRY_OPTIONS} value={val} onChange={(e) => setVal(e.target.value)}
  hint="Type to filter the list." />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

export function Select({ id, label, options, placeholder, hint, error, disabled, required, className, ...props }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}{required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </label>
      <select id={id} disabled={disabled} required={required} aria-describedby={describedBy} aria-invalid={!!error}
        className={cn('block w-full rounded-md border px-3 py-2 text-sm transition-colors appearance-none bg-surface-base text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken', error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border')} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {hint && !error && <p id={hintId} className="text-xs text-text-secondary">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}
```
