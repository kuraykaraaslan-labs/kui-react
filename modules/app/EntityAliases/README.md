# EntityAliases

The editor kit for dashboard **entity aliases**, the ThingsBoard model, built for next-boilerplate dashboard phase 36
(slice 36.4, `docs/phases/07-dashboard/36-entity-aliases-and-filters.md` there). An alias is a named entity filter that
belongs to a board; every widget on every page can bind its entity slots to it. next-boilerplate vendors this folder.

The UX follows ThingsBoard's alias dialogs, read at the Apache-licensed commit `5954190c32`
(`ui-ngx/src/app/modules/home/components/alias/*`, `entity/entity-filter*`); nothing is copied, the behaviour is rebuilt
with kui primitives.

## Pieces

| Export | What it is |
|---|---|
| `EntityAliasesDialog` | The board's alias list: numbered rows (name, key, the filter as one line, the resolve-multiple switch, edit, remove), "Add alias", Save / Cancel. Edits stay local until Save. `usage` (alias key → widget titles) blocks removing a used alias and names the widgets. |
| `EntityAliasDialog` | Add or edit one alias: name (the key is derived with `slugKey` on add and read-only after), resolve-multiple with its hint, `EntityFilterForm`, and a preview (`access.preview`, debounced 400 ms) with the total and the first names. A filter that matches nothing blocks Save ("No entities matching the filter were found"); a preview that fails does not. |
| `EntityFilterForm` | The filter type select and the fields of each type (table below). Controlled; picking a type sets resolve-multiple the TB way (off for a single entity and the page's entity, on otherwise). |
| `entityFilterText(filter, { entityTypes, params, messages })` | The filter as one readable line, e.g. "Devices of device profiles Pump, Tank whose name starts with 'A'", "Entities related TO the page's site (up to 3 levels)". Pure. |
| `AliasEntitySelect` | The board toolbar's entity select: one searchable picker per selectable alias. The button shows the current entity's name for one alias, "Entities" for several; nothing when there is none. |
| `EntityAliasPicker` | A widget data tab's alias picker for one entity slot `{ entityTypes, multiple }`: "None", the aliases (the ones that do not fit are disabled with the reason), "New alias". |
| `validateAlias`, `validateAliases`, `validateFilter`, `slugKey` | The server caps, mirrored (below). Pure. |
| `normalizeAlias`, `aliasCompatibility`, `emptyFilter`, `defaultResolveMultiple` | Save clean-up (trim, drop empty and duplicate relation filters, single entity → one), the slot rule, the type-change defaults. Pure. |
| `DEFAULT_ALIAS_MESSAGES`, `mergeAliasMessages` | Every text the kit draws, English defaults; every component takes `messages` (a partial override). |

## Filter types

| Type | Fields |
|---|---|
| `singleEntity` | entity type + one entity (searchable). Always resolves to one. |
| `entityList` | entity type + 1–100 entities (searchable, names resolved with `entitiesByIds`). |
| `entityName` | entity type + "name starts with" (1–120). |
| `entityType` | entity type: every entity of it. |
| `stateEntity` | entity type + a board param (the page's entity). |
| `entitySubtype` | entity type with subtypes + 1–50 subtype chips (labelled with `subtypeLabel`, e.g. "Device profiles") + optional name prefix. |
| `relationsQuery` | relation source (when more than one) + root ("Use the page's entity" = a board param, or a fixed entity) + direction + max level 1–10 + "fetch last level only" (when the level is above 1) + up to 8 relation filters (relation type, entity types, NOT). |
| `entitySearchQuery` | the same root and options + one relation type + entity type + optional subtypes. |

The two relation types are offered only when `access.relationProviders()` returns at least one provider.

## The data contract

`types.ts` holds the contract verbatim (`EntityAlias`, `EntityAliasFilter`, `EntityRef`, `EntityTypeInfo`,
`RelationProviderInfo`, `BoardParamInfo`, `AliasPreview`, `EntityAliasesAccess`); next-boilerplate's server implements
the same shapes. Change them only together with the server.

**The host owns fetching.** The kit never calls `fetch`; every read goes through the `EntityAliasesAccess` the host
passes:

| Method | Used for |
|---|---|
| `entityTypes()` | Entity type selects, filter text labels. Loaded once per access object (cached for a minute). |
| `relationProviders()` | Whether the relation types are offered, the relation type lists. A rejection means none. |
| `subtypes(entityType, search)` | The subtype chips. |
| `searchEntities(entityType, search)` | The single and list entity pickers, the fixed root entity. |
| `entitiesByIds(entityType, ids)` | Names of stored ids. An id it does not return is shown as the id. |
| `preview(alias)` | The alias dialog's preview. The alias carries `key: 'draft'`, `name: 'Draft'` (`PREVIEW_KEY`, `PREVIEW_NAME`); only its filter and resolve-multiple matter. |

Pass a stable access object (`useMemo`); a new object per render works but loses the shared cache.
`AliasEntitySelect` takes its own `loadOptions(aliasKey, search)` (the resolved set of one alias, E36-6).

## Caps (`validate.ts`)

At most 32 aliases (`MAX_ALIASES`); key `^[a-z][a-zA-Z0-9_]{0,39}$`, not `__proto__` / `constructor` / `prototype`, unique;
name 1–80 characters, unique on the board ignoring case; entity list 1–100 ids; name prefix 1–120 (optional for a subtype
filter); subtypes 1–50 for a subtype filter (at most 50 for a search query); max level an integer 1–10 (no unlimited);
at most 8 relation filters; `stateEntity.param` and a param root must name a board param; a single entity never resolves
to many. Errors are field-keyed codes (`{ 'filter.ids': 'tooMany' }`); `messages.error(field, code)` gives the text.

## Parity

React only: kui-ejs and KUInative have no board editor (E36-11, `parity.exceptions.json` record `entity-aliases`).
