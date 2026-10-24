# TagInput

- **id:** `tag-input`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/TagInput.tsx`
- **status:** stable
- **since:** 2025-03

Free-text input that creates chips. Add tags with Enter or comma, double-click to edit, Backspace to delete. Duplicates are ignored.

## Used by

- `entity-aliases`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--error`
- `--primary`
- `--primary-subtle`
- `--surface-base`
- `--surface-sunken`
- `--text-disabled`
- `--text-primary`

## Variants

### Default

```tsx
const [tags, setTags] = useState(['next.js', 'react']);
<TagInput id="tags" label="Tags" value={tags} onChange={setTags} hint="Press Enter or comma to add." />
```

### Empty / Error

```tsx
<TagInput id="tags" label="Required tags" value={[]} onChange={setTags} error="At least one tag is required." />
```

## Full source

```tsx
'use client';
import { useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';

export function TagInput({ id, label, hint, error, value, onChange, placeholder = 'Type and press Enter or comma…', disabled, className }) {
  const [input, setInput] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');

  function addTags(raw) {
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
    onChange([...new Set([...value, ...tags])]);
    setInput('');
  }
  function removeTag(idx) { onChange(value.filter((_, i) => i !== idx)); }
  // ... keyboard handlers + inline edit
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">{label}</label>
      <div className={cn('flex flex-wrap gap-1.5 min-h-10 w-full rounded-md border px-3 py-2 transition-colors cursor-text focus-within:ring-2 focus-within:ring-border-focus', disabled ? 'opacity-50 cursor-not-allowed bg-surface-sunken' : 'bg-surface-base border-border', error && 'border-error ring-1 ring-error')}>
        {value.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-subtle text-primary">
            {tag}
            {!disabled && <button type="button" onClick={() => removeTag(i)} className="hover:opacity-70">✕</button>}
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={value.length === 0 ? placeholder : undefined} disabled={disabled} className="flex-1 min-w-24 bg-transparent text-sm text-text-primary placeholder:text-text-disabled outline-none" />
      </div>
    </div>
  );
}
```
