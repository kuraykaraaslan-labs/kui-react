# Toggle

- **id:** `toggle`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/Toggle.tsx`
- **status:** stable
- **since:** 2025-02

role="switch" toggle/switch with three sizes, description slot, and disabled support. Fully accessible via CSS transform without a native input.

## Used by

- `control-tile`
- `entity-aliases`

## Design tokens consumed

- `--border`
- `--primary`
- `--secondary`
- `--surface-sunken`
- `--text-primary`
- `--text-secondary`

## Variants

### Checked

```tsx
<Toggle id="notif" label="Notifications enabled" checked onChange={setEnabled} />
```

### Unchecked

```tsx
<Toggle id="dark" label="Dark mode" checked={false} onChange={setDark} />
```

### No visible label

```tsx
<Toggle id="t" label="" ariaLabel="Enable notifications" checked onChange={setEnabled} />
```

### Disabled

```tsx
<Toggle id="a" label="Enabled (disabled)" checked disabled onChange={() => {}} />
<Toggle id="b" label="Disabled option" checked={false} disabled onChange={() => {}} />
```

### Sizes

```tsx
<Toggle id="sm" label="Small" size="sm" checked onChange={set} />
<Toggle id="md" label="Medium" size="md" checked onChange={set} />
<Toggle id="lg" label="Large" size="lg" checked onChange={set} />
```

### Pending (a write is in flight)

```tsx
<Toggle id="heater" label="Heater" checked pending onChange={write} />
```

### Mismatch (the device reports another value)

```tsx
<Toggle id="heater" label="Heater" checked mismatch describedBy="heater-hint" onChange={write} />
<p id="heater-hint">The device reports a different value.</p>
```

### With description

```tsx
<Toggle id="marketing" label="Marketing emails" description="Receive weekly updates." checked={value} onChange={setValue} />
```

### Settings list (controlled)

```tsx
function Demo() {
  const [s, setS] = useState({ notifications: true, marketing: false });
  return (
    <div className="divide-y border rounded-lg">
      {[{ key: 'notifications', label: 'Push notifications', desc: 'Alerts for new activity' }, ...].map(({ key, label, desc }) => (
        <div key={key} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-text-secondary">{desc}</p>
          </div>
          <Toggle id={key} label="" ariaLabel={label} checked={s[key]} onChange={() => setS(p => ({ ...p, [key]: !p[key] }))} />
        </div>
      ))}
    </div>
  );
}
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';

const sizeMap = {
  sm: { track: 'h-4 w-7',  thumb: 'h-3 w-3',     on: 'translate-x-3.5' },
  md: { track: 'h-5 w-9',  thumb: 'h-3.5 w-3.5', on: 'translate-x-4'   },
  lg: { track: 'h-6 w-11', thumb: 'h-4 w-4',     on: 'translate-x-5'   },
};

export function Toggle({ id, label, description, checked, onChange, disabled, size = 'md', className }) {
  const { track, thumb, on } = sizeMap[size];
  return (
    <label htmlFor={id} className={cn('flex items-start gap-3', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
      <div className="relative shrink-0 mt-0.5">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} aria-checked={checked} className="sr-only" />
        <div className={cn('rounded-full transition-colors duration-200', track, checked ? 'bg-primary' : 'bg-surface-sunken border border-border')} />
        <div className={cn('absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200', thumb, checked ? on : 'translate-x-0')} />
      </div>
      <div>
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
    </label>
  );
}
```
