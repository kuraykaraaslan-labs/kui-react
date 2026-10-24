# ComboBox

- **id:** `combo-box`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/ComboBox/index.tsx`
- **status:** beta
- **since:** 2025-03

Searchable autocomplete single-select with keyboard navigation, described options, and a clearable button.

## Used by

- `entity-aliases`

## Variants

### Controlled selection

```tsx
function Demo() {
  const [value, setValue] = useState('nextjs');
  return (
    <ComboBox
      id="framework"
      label="Framework"
      options={COMBO_OPTIONS}
      value={value}
      onChange={setValue}
    />
  );
}
```

### Async search

```tsx
<ComboBox id="search" label="Async search" options={COMBO_OPTIONS} onSearch={search} value={value} onChange={setValue} />
```

### Debounced async suggestions

```tsx
async function suggest(query, signal) {
  const res = await fetch('/api/suggest?q=' + encodeURIComponent(query), { signal });
  return res.json();
}

<ComboBox
  id="cb-async-debounced"
  label="Debounced suggestions"
  options={[]}
  value={value}
  onChange={setValue}
  onSearch={suggest}      // signature: (q, signal) => Promise<Option[]>
  debounceMs={300}        // useAsync debounces & cancels in-flight
  placeholder="Type to search…"
/>
```

## Full source

```tsx
'use client';
import { Trigger } from './parts/Trigger';
import { Listbox } from './parts/Listbox';
import { useFilter } from './hooks/useFilter';
import { useAsync } from './hooks/useAsync';
import { useLoadMore } from './hooks/useLoadMore';

export function ComboBox({ id, label, options, value, onChange, onSearch, onLoadMore, debounceMs = 300, virtualize }) {
  // M1: debounced async + AbortController + 5min cache + IO-backed pagination + manual windowing.
}
```
