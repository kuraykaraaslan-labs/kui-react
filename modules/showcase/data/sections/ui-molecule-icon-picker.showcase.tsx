'use client';
import { useState } from 'react';
import { faGear, faIndustry } from '@fortawesome/free-solid-svg-icons';
import { IconPicker } from '@/modules/ui/IconPicker';
import type { ShowcaseComponent } from '../showcase.types';

function IconPickerDemo({ initial, ...rest }: { initial?: string } & Partial<React.ComponentProps<typeof IconPicker>>) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <IconPicker id={rest.id ?? 'icon-demo'} label="Workspace icon" value={value} onChange={setValue} {...rest} />
      <code className="text-xs text-text-secondary">{value ?? '—'}</code>
    </div>
  );
}

// An app's own name → icon map draws the trigger before the full set loads.
const APP_ICONS: Record<string, typeof faGear> = { gear: faGear, industry: faIndustry };

export function buildIconPickerData(): ShowcaseComponent[] {
  return [
    {
      id: 'icon-picker',
      title: 'IconPicker',
      category: 'Molecule',
      abbr: 'IP',
      description: 'Chooses one Font Awesome solid icon; the value is the class string manifests and menus store ("fas fa-industry"). Search by name and by the older names the pack lists, recent choices first, an 8-column grid moved through with the arrow keys while the focus stays in the search box. The whole solid set is imported lazily the first time a picker opens. React-only (next-boilerplate phase 54, D54-10).',
      filePath: 'modules/ui/IconPicker/index.tsx',
      since: '2026-11',
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['dialog', 'combobox', 'listbox'],
        keyboardInteractions: [
          { keys: 'Enter / Space', action: 'Open the panel (focus goes to the search box)' },
          { keys: 'Arrow keys', action: 'Move through the grid (up / down by column)' },
          { keys: 'Page Up / Page Down', action: 'Move four rows' },
          { keys: 'Enter', action: 'Choose the active icon' },
          { keys: 'Escape', action: 'Close without choosing' },
        ],
      },
      sourceCode: `'use client';
import { IconPicker } from '@/modules/ui/IconPicker';

const [icon, setIcon] = useState('fas fa-industry');

<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon} />

// Draw the chosen icon in the trigger before the set loads (an app's icon map):
<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon}
  resolveIcon={(name) => appIcons[name]} />`,
      variants: [
        {
          title: 'Empty',
          layout: 'stack',
          preview: <IconPickerDemo id="icon-empty" />,
          code: `const [icon, setIcon] = useState<string>();\n<IconPicker id="ws-icon" label="Workspace icon" value={icon} onChange={setIcon} />`,
        },
        {
          title: 'With a value and an app icon map',
          layout: 'stack',
          preview: <IconPickerDemo id="icon-value" initial="fas fa-industry" resolveIcon={(n) => APP_ICONS[n]} />,
          code: `<IconPicker id="ws-icon" label="Workspace icon" value="fas fa-industry"\n  resolveIcon={(name) => appIcons[name]} onChange={setIcon} />`,
        },
        {
          title: 'Disabled',
          layout: 'stack',
          preview: <IconPickerDemo id="icon-disabled" initial="fas fa-gear" resolveIcon={(n) => APP_ICONS[n]} disabled />,
          code: `<IconPicker id="ws-icon" label="Workspace icon" value="fas fa-gear" disabled onChange={setIcon} />`,
        },
      ],
    },
  ];
}
