# IconPicker

- **id:** `icon-picker`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/IconPicker/index.tsx`
- **status:** stable
- **since:** 2026-11

Chooses one Font Awesome solid icon; the value is the class string manifests and menus store ("fas fa-industry"). Search by name and by the older names the pack lists, recent choices first, an 8-column grid moved through with the arrow keys while the focus stays in the search box. The whole solid set is imported lazily the first time a picker opens. React-only (next-boilerplate phase 54, D54-10).

## Accessibility

- WCAG: AA
- ARIA patterns: dialog, combobox, listbox
- Keyboard:
  - `Enter / Space` — Open the panel (focus goes to the search box)
  - `Arrow keys` — Move through the grid (up / down by column)
  - `Page Up / Page Down` — Move four rows
  - `Enter` — Choose the active icon
  - `Escape` — Close without choosing

## Variants

### Empty

```tsx
const [icon, setIcon] = useState<string>();
<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon} />
```

### With a value and an app icon map

```tsx
<IconPicker id="ws-icon" label="Workspace icon" value="fas fa-industry"
  resolveIcon={(name) => appIcons[name]} onChange={setIcon} />
```

### Disabled

```tsx
<IconPicker id="ws-icon" label="Workspace icon" value="fas fa-gear" disabled onChange={setIcon} />
```

## Full source

```tsx
'use client';
import { IconPicker } from '@/modules/ui/IconPicker';

const [icon, setIcon] = useState('fas fa-industry');

<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon} />

// Draw the chosen icon in the trigger before the set loads (an app's icon map):
<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon}
  resolveIcon={(name) => appIcons[name]} />
```
