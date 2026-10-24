# MultiSelect

- **id:** `multi-select`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/MultiSelect.tsx`
- **status:** stable
- **since:** 2025-02

Chip-based multi-select popover with searchable filter, keyboard navigation, and disabled-option support.

## Used by

- `entity-aliases`

## Variants

### Controlled

```tsx
function Demo() {
  const [v, setV] = useState([]);
  return (
    <MultiSelect id="ms" label="Frameworks"
      options={[{ value: 'react', label: 'React' }, ...]}
      value={v} onChange={setV}
    />
  );
}
```

### With error

```tsx
<MultiSelect id="ms" label="Tags" options={[...]} error="Please select at least one tag." />
```

### With countries

```tsx
import { countries, getEmojiFlag } from 'countries-list';

const COUNTRY_OPTIONS = Object.entries(countries)
  .map(([code, data]) => ({ value: code, label: `${getEmojiFlag(code)} ${data.name}` }))
  .sort((a, b) => a.label.localeCompare(b.label));

function Demo() {
  const [v, setV] = useState([]);
  return (
    <MultiSelect id="ms-countries" label="Countries"
      options={COUNTRY_OPTIONS} placeholder="Select countries…"
      value={v} onChange={setV} hint="Select one or more countries." />
  );
}
```

### Searchable

```tsx
<MultiSelect id="countries" label="Countries" searchable
  options={COUNTRY_OPTIONS} placeholder="Search and select…"
  value={v} onChange={setV} hint="Type to filter the list." />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useFilter, useAsync, useLoadMore } from './ComboBox/hooks';

export function MultiSelect({ id, label, options, value, onChange, onSearch, onLoadMore, debounceMs = 300 }) {
  // shares filter/async/load-more hooks with ComboBox; chip strip stays local.
}
```
