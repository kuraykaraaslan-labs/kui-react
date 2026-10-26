'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import {
  AliasEntitySelect,
  BoardFiltersDialog,
  EntityAliasesDialog,
  EntityAliasPicker,
  EntityFilterForm,
  EntityParamFields,
  boardFilterText,
  entityFilterText,
  normalizeEntityParam,
  validateEntityParam,
  type BoardFilter,
  type EntityAlias,
  type EntityAliasFilter,
  type EntityParam,
  type EntityRef,
} from '@/modules/app/EntityAliases';
import { DEMO_ENTITIES, DEMO_ENTITY_TYPES, DEMO_PROVIDERS, demoAccess } from '@/modules/app/EntityAliases/demo-access';
import type { ShowcaseComponent } from '../showcase.types';

const PARAMS = [{ key: 'site', label: 'site', entityType: 'iot_asset' }, { key: 'limit', label: 'temperature limit' }];

const SAMPLE_FILTERS: BoardFilter[] = [
  {
    key: 'hot',
    name: 'Hot',
    keyFilters: [
      { key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: { $param: 'limit' } }] },
      { key: { type: 'attribute', name: 'active', scope: 'server' }, valueType: 'boolean', operation: 'and', predicates: [{ op: 'true' }] },
    ],
  },
  {
    key: 'pumpsOutOfRange',
    name: 'Pumps out of range',
    keyFilters: [
      { key: { type: 'field', name: 'name' }, valueType: 'string', operation: 'and', predicates: [{ op: 'startsWith', value: 'Pump', ignoreCase: true }] },
      { key: { type: 'telemetry', name: 'pressure' }, valueType: 'number', operation: 'or', predicates: [{ op: 'lt', value: 1.5 }, { op: 'gt', value: 6 }] },
    ],
  },
];

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

function ParamFieldsDemo() {
  const access = useMemo(() => demoAccess(), []);
  const [advanced, setAdvanced] = useState(false);
  const [param, setParam] = useState<EntityParam>({
    kind: 'entity', key: 'siteDevices', label: 'Site devices', entityType: 'iot_device',
    choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 2 },
  });
  const peers = [...PARAMS, param];
  return (
    <div className="w-full max-w-xl">
      <EntityParamFields value={param} onChange={setParam} params={peers} access={access} advanced={advanced}
        errors={validateEntityParam(param, peers)} />
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setAdvanced((a) => !a)}>
        {advanced ? 'Hide advanced' : 'Advanced'}
      </Button>
      <Output value={normalizeEntityParam(param)} />
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

function FiltersDialogDemo() {
  const access = useMemo(() => demoAccess(), []);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<BoardFilter[]>(SAMPLE_FILTERS);
  return (
    <div className="w-full max-w-xl">
      <Button onClick={() => setOpen(true)}>Filters</Button>
      <ul className="mt-3 space-y-1 text-sm text-text-secondary">
        {filters.map((f) => (
          <li key={f.key}>
            <span className="font-medium text-text-primary">{f.name}:</span> {boardFilterText(f, { params: PARAMS })}
          </li>
        ))}
      </ul>
      <BoardFiltersDialog
        open={open}
        filters={filters}
        usage={{ hot: ['Hot devices', 'Temperature chart'] }}
        params={PARAMS}
        entityType="iot_device"
        access={access}
        onSave={(next) => { setFilters(next); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
      <Output value={filters} />
    </div>
  );
}

function PickerDemo() {
  const [single, setSingle] = useState<string | undefined>('mainTank');
  const [filter, setFilter] = useState<string | undefined>('hot');
  const [many, setMany] = useState<string | undefined>();
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
      <EntityAliasPicker label="Device (one)" value={single} onChange={setSingle} aliases={SAMPLE_ALIASES}
        slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={DEMO_ENTITY_TYPES} params={PARAMS} onCreate={() => {}}
        filters={SAMPLE_FILTERS} filterValue={filter} onFilterChange={setFilter} />
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
        "Dashboard entity aliases and key filters, the ThingsBoard model (next-boilerplate dashboard phases 36.4 and 36.7). EntityAliasesDialog lists a board's aliases (numbered rows, the filter as one readable line, resolve-multiple switch, edit, remove; an alias a widget uses cannot be removed, the widgets are named). EntityAliasDialog adds or edits one alias: name with the key derived on add, resolve-multiple with its hint, the filter form and a debounced preview; a filter that matches no entity blocks the save. EntityFilterForm covers single entity, entity list, name prefix, entity type, the page's entity (a board param), entity subtype, relations query and entity search query (the last two only when the host has a relation provider). AliasEntitySelect is the toolbar's entity select, EntityAliasPicker binds a widget's entity slot (and, once an alias is chosen, one of the board's filters). Key filters (phase 36.7, ThingsBoard's dashboard filters): BoardFiltersDialog lists the board's filters (a filter a widget uses cannot be removed), BoardFilterDialog edits one, KeyFilterEditor edits one key filter (entity field, attribute or latest telemetry; key names suggested through access.entityKeys; up to 4 conditions with the operations of the value type; a value can read a dashboard parameter), boardFilterText writes it as one line. EntityParamFields (phase 41, parameters as one concept) edits an entity parameter: its entity type, how the entity is chosen (the viewer picks, the page or a link sets it, fixed one or list, all of the type, by name, by subtype, related to another parameter or entity), one or many, the filter-bar mode, a default searched by name and \"with no value, take the first\"; the relation details sit under the host's Advanced. The host supplies every read through EntityAliasesAccess; validateAlias and validateBoardFilter mirror the server caps. React only.",
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
      composes: ['modal', 'select', 'combo-box', 'multi-select', 'tag-input', 'toggle', 'checkbox', 'input', 'button', 'popover', 'empty-state', 'spinner'],
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
        { title: 'Entity parameter fields (how the entity is chosen; Advanced shows the relation details)', layout: 'stack' as const, preview: <ParamFieldsDemo />,
          code: `<EntityParamFields value={param} onChange={setParam} params={board.params} access={access}
  advanced={advancedOpen} errors={validateEntityParam(param, board.params)} />` },
        { title: 'Toolbar entity select (one alias, several aliases)', layout: 'stack' as const, preview: <ToolbarSelectDemo />,
          code: `<AliasEntitySelect items={[{ aliasKey: 'mainTank', aliasName: 'Main tank', current }]}
  loadOptions={(aliasKey, search) => api.aliasEntities(aliasKey, search)} onChange={setAliasEntity} />` },
        { title: 'Alias picker for a widget entity slot (with the filter select)', layout: 'stack' as const, preview: <PickerDemo />,
          code: `<EntityAliasPicker value={key} onChange={setKey} aliases={aliases}
  slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={entityTypes} onCreate={openAliasDialog}
  filters={board.filters} filterValue={filterKey} onFilterChange={setFilterKey} />` },
        { title: 'Key filters dialog (remove "Hot" to see the used-by guard)', layout: 'stack' as const, preview: <FiltersDialogDemo />,
          code: `<BoardFiltersDialog open={open} filters={board.filters} usage={{ hot: ['Hot devices'] }}
  params={board.params} entityType="iot_device" access={access} onSave={saveFilters} onClose={close} />
{boardFilterText(filter, { params })} // "temperature (latest) > the dashboard's temperature limit and active (server attribute) is true"` },
      ],
    },
  ];
}
