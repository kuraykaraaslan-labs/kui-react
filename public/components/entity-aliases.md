# EntityAliases

- **id:** `entity-aliases`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/EntityAliases/EntityAliasesDialog.tsx`
- **status:** beta
- **since:** 2026-10

Dashboard entity aliases and key filters, the ThingsBoard model (next-boilerplate dashboard phases 36.4 and 36.7). EntityAliasesDialog lists a board's aliases (numbered rows, the filter as one readable line, resolve-multiple switch, edit, remove; an alias a widget uses cannot be removed, the widgets are named). EntityAliasDialog adds or edits one alias: name with the key derived on add, resolve-multiple with its hint, the filter form and a debounced preview; a filter that matches no entity blocks the save. EntityFilterForm covers single entity, entity list, name prefix, entity type, the page's entity (a board param), entity subtype, relations query and entity search query (the last two only when the host has a relation provider). AliasEntitySelect is the toolbar's entity select, EntityAliasPicker binds a widget's entity slot (and, once an alias is chosen, one of the board's filters). Key filters (phase 36.7, ThingsBoard's dashboard filters): BoardFiltersDialog lists the board's filters (a filter a widget uses cannot be removed), BoardFilterDialog edits one, KeyFilterEditor edits one key filter (entity field, attribute or latest telemetry; key names suggested through access.entityKeys; up to 4 conditions with the operations of the value type; a value can read a dashboard parameter), boardFilterText writes it as one line. EntityParamFields (phase 41, parameters as one concept) edits an entity parameter: its entity type, how the entity is chosen (the viewer picks, the page or a link sets it, fixed one or list, all of the type, by name, by subtype, related to another parameter or entity), one or many, the filter-bar mode, a default searched by name and "with no value, take the first"; the relation details sit under the host's Advanced. The host supplies every read through EntityAliasesAccess; validateAlias and validateBoardFilter mirror the server caps. React only.

## Depends on

- `modal`
- `select`
- `combo-box`
- `multi-select`
- `tag-input`
- `toggle`
- `checkbox`
- `input`
- `button`
- `popover`
- `empty-state`
- `spinner`

## Accessibility

- WCAG: AA
- ARIA patterns: dialog, combobox, listbox, switch, alert
- Keyboard:
  - `Tab` — Move between the rows, switches, edit and remove buttons and the form fields
  - `Escape` — Close the topmost dialog only (the alias dialog opens over the list)
  - `Arrow keys / Enter` — Move through and pick entities in the searchable pickers

Every control has a label; icon buttons are named after their alias ("Remove alias Pumps"). A refused removal and a filter that matches nothing are announced with role="alert"; the preview is a polite live region.

## Design tokens consumed

- `--surface-base`
- `--surface-raised`
- `--text-primary`
- `--text-secondary`
- `--text-disabled`
- `--border`
- `--border-focus`
- `--primary`
- `--error`
- `--error-subtle`

## Variants

### Aliases dialog (remove "Pumps" to see the used-by guard)

```tsx
<EntityAliasesDialog open={open} aliases={aliases} usage={usage} params={params} access={access}
  onSave={setAliases} onClose={close} />
```

### Entity filter form + filter text

```tsx
<EntityFilterForm value={filter} onChange={setFilter} resolveMultiple={multiple}
  onResolveMultipleChange={setMultiple} params={params} access={access} />
{entityFilterText(filter, { entityTypes, params })}
```

### Entity parameter fields (how the entity is chosen; Advanced shows the relation details)

```tsx
<EntityParamFields value={param} onChange={setParam} params={board.params} access={access}
  advanced={advancedOpen} errors={validateEntityParam(param, board.params)} />
```

### Toolbar entity select (one alias, several aliases)

```tsx
<AliasEntitySelect items={[{ aliasKey: 'mainTank', aliasName: 'Main tank', current }]}
  loadOptions={(aliasKey, search) => api.aliasEntities(aliasKey, search)} onChange={setAliasEntity} />
```

### Alias picker for a widget entity slot (with the filter select)

```tsx
<EntityAliasPicker value={key} onChange={setKey} aliases={aliases}
  slot={{ entityTypes: ['iot_device'], multiple: false }} entityTypes={entityTypes} onCreate={openAliasDialog}
  filters={board.filters} filterValue={filterKey} onFilterChange={setFilterKey} />
```

### Key filters dialog (remove "Hot" to see the used-by guard)

```tsx
<BoardFiltersDialog open={open} filters={board.filters} usage={{ hot: ['Hot devices'] }}
  params={board.params} entityType="iot_device" access={access} onSave={saveFilters} onClose={close} />
{boardFilterText(filter, { params })} // "temperature (latest) > the dashboard's temperature limit and active (server attribute) is true"
```

## Full source

```tsx
import { EntityAliasesDialog, type EntityAliasesAccess } from '@/modules/app/EntityAliases';

<EntityAliasesDialog
  open={open}
  aliases={board.aliases}
  usage={{ pumps: ['Pump pressure'] }}
  params={board.params}
  access={access}
  onSave={saveAliases}
  onClose={() => setOpen(false)}
/>
```
