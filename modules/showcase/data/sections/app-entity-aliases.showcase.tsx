'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import {
  AliasEntitySelect,
  EntityAliasesDialog,
  EntityAliasPicker,
  EntityFilterForm,
  entityFilterText,
  type EntityAlias,
  type EntityAliasFilter,
  type EntityRef,
} from '@/modules/app/EntityAliases';
import { DEMO_ENTITIES, DEMO_ENTITY_TYPES, DEMO_PROVIDERS, demoAccess } from '@/modules/app/EntityAliases/demo-access';
import type { ShowcaseComponent } from '../showcase.types';

const PARAMS = [{ key: 'site', label: 'site', entityType: 'iot_asset' }];

const SAMPLE_ALIASES: EntityAlias[] = [
  { key: 'pumps', name: 'Pumps', resolveMultiple: true, filter: { type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] } },
  { key: 'mainTank', name: 'Main tank', resolveMultiple: false, filter: { type: 'singleEntity', entityType: 'iot_device', id: 'd3' } },
  {
    key: 'siteDevices', name: 'Site devices', resolveMultiple: false,
    filter: { type: 'relationsQuery', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 3, filters: [{ relationType: 'Contains', entityTypes: ['iot_device'] }] },
  },
];

function Output({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-surface-raised p-3 text-xs text-text-primary">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AliasesDialogDemo() {
  const access = useMemo(() => demoAccess(), []);
  const [open, setOpen] = useState(false);
  const [aliases, setAliases] = useState<EntityAlias[]>(SAMPLE_ALIASES);
  return (
    <div className="w-full max-w-xl">
      <Button onClick={() => setOpen(true)}>Entity aliases</Button>
      <EntityAliasesDialog
        open={open}
        aliases={aliases}
        usage={{ pumps: ['Pump pressure', 'Pump map'] }}
        params={PARAMS}
        access={access}
        onSave={(next) => { setAliases(next); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
      <Output value={aliases} />
    </div>
  );
}

function FilterFormDemo() {
  const access = useMemo(() => demoAccess(), []);
  const [filter, setFilter] = useState<EntityAliasFilter | null>({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] });
  const [multiple, setMultiple] = useState(true);
  return (
    <div className="w-full max-w-xl">
      <EntityFilterForm value={filter} onChange={setFilter} resolveMultiple={multiple} onResolveMultipleChange={setMultiple} params={PARAMS} access={access} />
      <p className="mt-3 text-sm text-text-secondary">
        {entityFilterText(filter, { entityTypes: DEMO_ENTITY_TYPES, params: PARAMS, relationProviders: DEMO_PROVIDERS })}
      </p>
      <Output value={{ resolveMultiple: multiple, filter }} />
    </div>
  );
}

function ToolbarSelectDemo() {
  const [current, setCurrent] = useState<Record<string, EntityRef | null>>({ mainTank: DEMO_ENTITIES[2], siteDevices: DEMO_ENTITIES[0] });
  const load = async (_key: string, search: string) =>
    DEMO_ENTITIES.filter((e) => e.type === 'iot_device' && e.name.toLowerCase().includes(search.toLowerCase()));
  const pick = (key: string, id: string) => setCurrent((c) => ({ ...c, [key]: DEMO_ENTITIES.find((e) => e.id === id) ?? null }));
  return (
    <div className="flex min-h-[18rem] w-full flex-wrap items-start gap-6">
      <AliasEntitySelect items={[{ aliasKey: 'mainTank', aliasName: 'Main tank', current: current.mainTank }]} loadOptions={load} onChange={pick} />
      <AliasEntitySelect
        items={[
          { aliasKey: 'mainTank', aliasName: 'Main tank', current: current.mainTank },
          { aliasKey: 'siteDevices', aliasName: 'Site devices', current: current.siteDevices },
        ]}
        loadOptions={load}
        onChange={pick}
      />
    </div>
  );
}

function PickerDemo() {
  const [single, setSingle] = useState<string | undefined>('mainTank');
  const [many, setMany] = useState<string | undefined>();
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
      <EntityAliasPicker label="Device (one)" value={single} onChange={setSingle} aliases={SAMPLE_ALIASES}
        slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={DEMO_ENTITY_TYPES} params={PARAMS} onCreate={() => {}} />
      <EntityAliasPicker label="Assets (many)" value={many} onChange={setMany} aliases={SAMPLE_ALIASES}
        slot={{ entityTypes: ['iot_asset'], multiple: true }} entityTypes={DEMO_ENTITY_TYPES} params={PARAMS} />
    </div>
  );
}

export function buildAppEntityAliasesData(): ShowcaseComponent[] {
  return [
    {
      id: 'entity-aliases',
      title: 'EntityAliases',
      category: 'App',
      abbr: 'EA',
      description:
        "Dashboard entity aliases, the ThingsBoard model (next-boilerplate dashboard phase 36.4). EntityAliasesDialog lists a board's aliases (numbered rows, the filter as one readable line, resolve-multiple switch, edit, remove; an alias a widget uses cannot be removed, the widgets are named). EntityAliasDialog adds or edits one alias: name with the key derived on add, resolve-multiple with its hint, the filter form and a debounced preview; a filter that matches no entity blocks the save. EntityFilterForm covers single entity, entity list, name prefix, entity type, the page's entity (a board param), entity subtype, relations query and entity search query (the last two only when the host has a relation provider). AliasEntitySelect is the toolbar's entity select, EntityAliasPicker binds a widget's entity slot. The host supplies every read through EntityAliasesAccess; validateAlias mirrors the server caps. React only.",
      filePath: 'modules/app/EntityAliases/EntityAliasesDialog.tsx',
      sourceCode: `import { EntityAliasesDialog, type EntityAliasesAccess } from '@/modules/app/EntityAliases';

<EntityAliasesDialog
  open={open}
  aliases={board.aliases}
  usage={{ pumps: ['Pump pressure'] }}
  params={board.params}
  access={access}
  onSave={saveAliases}
  onClose={() => setOpen(false)}
/>`,
      since: '2026-10',
      status: 'beta',
      composes: ['modal', 'select', 'combo-box', 'multi-select', 'toggle', 'checkbox', 'input', 'button', 'popover', 'empty-state', 'spinner'],
      designTokens: ['--surface-base', '--surface-raised', '--text-primary', '--text-secondary', '--text-disabled', '--border', '--border-focus', '--primary', '--error', '--error-subtle'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['dialog', 'combobox', 'listbox', 'switch', 'alert'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Move between the rows, switches, edit and remove buttons and the form fields' },
          { keys: 'Escape', action: 'Close the topmost dialog only (the alias dialog opens over the list)' },
          { keys: 'Arrow keys / Enter', action: 'Move through and pick entities in the searchable pickers' },
        ],
        notes: 'Every control has a label; icon buttons are named after their alias ("Remove alias Pumps"). A refused removal and a filter that matches nothing are announced with role="alert"; the preview is a polite live region.',
      },
      variants: [
        { title: 'Aliases dialog (remove "Pumps" to see the used-by guard)', layout: 'stack' as const, preview: <AliasesDialogDemo />,
          code: `<EntityAliasesDialog open={open} aliases={aliases} usage={usage} params={params} access={access}
  onSave={setAliases} onClose={close} />` },
        { title: 'Entity filter form + filter text', layout: 'stack' as const, preview: <FilterFormDemo />,
          code: `<EntityFilterForm value={filter} onChange={setFilter} resolveMultiple={multiple}
  onResolveMultipleChange={setMultiple} params={params} access={access} />
{entityFilterText(filter, { entityTypes, params })}` },
        { title: 'Toolbar entity select (one alias, several aliases)', layout: 'stack' as const, preview: <ToolbarSelectDemo />,
          code: `<AliasEntitySelect items={[{ aliasKey: 'mainTank', aliasName: 'Main tank', current }]}
  loadOptions={(aliasKey, search) => api.aliasEntities(aliasKey, search)} onChange={setAliasEntity} />` },
        { title: 'Alias picker for a widget entity slot', layout: 'stack' as const, preview: <PickerDemo />,
          code: `<EntityAliasPicker value={key} onChange={setKey} aliases={aliases}
  slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={entityTypes} onCreate={openAliasDialog} />` },
      ],
    },
  ];
}
