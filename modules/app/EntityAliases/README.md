# EntityAliases

The editor kit for dashboard **entity aliases** and **key filters**, the ThingsBoard model, built for next-boilerplate
dashboard phase 36 (slices 36.4 and 36.7, `docs/phases/07-dashboard/36-entity-aliases-and-filters.md` there). An alias is
a named entity filter that belongs to a board; every widget on every page can bind its entity slots to it. A key filter
("Filters" in ThingsBoard) is a second board-level object that keeps the entities of an alias whose fields, attributes or
latest telemetry match; a widget binds it next to the alias (`{ "$alias": "devices", "filter": "hot" }`).
next-boilerplate vendors this folder.

The UX follows ThingsBoard's alias and filter dialogs, read at the Apache-licensed commit `5954190c32`
(`ui-ngx/src/app/modules/home/components/alias/*`, `entity/entity-filter*`, `filter/*`, `shared/models/query/query.models.ts`);
nothing is copied, the behaviour is rebuilt with kui primitives.

## Pieces

| Export | What it is |
|---|---|
| `EntityAliasesDialog` | The board's alias list: numbered rows (name, key, the filter as one line, the resolve-multiple switch, edit, remove), "Add alias", Save / Cancel. Edits stay local until Save. `usage` (alias key → widget titles) blocks removing a used alias and names the widgets. |
| `EntityAliasDialog` | Add or edit one alias: name (the key is derived with `slugKey` on add and read-only after), resolve-multiple with its hint, `EntityFilterForm`, and a preview (`access.preview`, debounced 400 ms) with the total and the first names. A filter that matches nothing blocks Save ("No entities matching the filter were found"); a preview that fails does not. |
| `EntityFilterForm` | The filter type select and the fields of each type (table below). Controlled; picking a type sets resolve-multiple the TB way (off for a single entity and the page's entity, on otherwise). |
| `entityFilterText(filter, { entityTypes, params, messages })` | The filter as one readable line, e.g. "Devices of device profiles Pump, Tank whose name starts with 'A'", "Entities related TO the page's site (up to 3 levels)". Pure. |
| `AliasEntitySelect` | The board toolbar's entity select: one searchable picker per selectable alias. The button shows the current entity's name for one alias, "Entities" for several; nothing when there is none. |
| `EntityAliasPicker` | A widget data tab's alias picker for one entity slot `{ entityTypes, multiple }`: "None", the aliases (the ones that do not fit are disabled with the reason), "New alias". With `filters`, `filterValue` and `onFilterChange`, a second select "Filter: None / <names>" appears once an alias is chosen (the chosen filter's text as its hint); clearing the alias clears the filter. |
| `BoardFiltersDialog` | The board's filter list: numbered rows (name, key, the filter as one line, edit, remove), "Add filter", Save / Cancel. `usage` (filter key → widget titles) blocks removing a used filter and names the widgets. `entityType` (optional) is the entity type the key names are suggested for. |
| `BoardFilterDialog` | Add or edit one filter: name (key derived with `slugKey(name, keys, 'filter')` on add, read-only after), the key filters edited in place (each a `KeyFilterEditor`; TB opens a third dialog per key filter) joined by and / or (the select appears from two key filters on, default and), "Add key filter", a text preview, field errors on Save. |
| `KeyFilterEditor` | One key filter, controlled (table below). |
| `boardFilterText(filter, { params, messages, formatDateTime })`, `keyFilterText` | The filter as one readable line, e.g. "temperature (latest) > 30 and status (latest) = 'ACTIVE'", "name starts with 'Pump' (ignore case)", "temperature (latest) > the dashboard's limit". Pure. |
| `validateBoardFilter`, `validateBoardFilters`, `validateKeyFilter`, `keyFilterErrorsAt` | The key filter caps, mirrored (below). Pure. |
| `KEY_FILTER_OPS`, `predicateShape`, `withValueType`, `normalizeBoardFilter`, `filterParamKeys` | The operations per value type, what each operation reads, the value-type change, the save clean-up, the params a filter reads (for the param bar). Pure. |
| `validateAlias`, `validateAliases`, `validateFilter`, `slugKey` | The server caps, mirrored (below). Pure. |
| `normalizeAlias`, `aliasCompatibility`, `emptyFilter`, `defaultResolveMultiple` | Save clean-up (trim, drop empty and duplicate relation filters, single entity → one), the slot rule, the type-change defaults. Pure. |
| `EntityParamFields` | The fields of one **entity parameter** (phase 41, below): entity type, how the entity is chosen and that choice's fields, one or many, the filter-bar mode, a default entity searched by name inside the set, "with no value, take the first". Controlled; the label and the key are the host's. `advanced` shows the relation details, `preview` the entities a set matches. |
| `validateEntityParam`, `normalizeEntityParam`, `withChoice`, `withChoicePatch`, `withEntityType`, `fitChoice`, `barModesFor`, `takesFirst`, `takesDefault`, `defaultFits`, `followsParam`, `previewAlias`, `peerFits`, `paramKeyFromLabel` | The entity parameter's caps against the whole list (what it follows exists, is one entity, never comes back), the save clean-up, the choice and entity-type changes with what depends on them, and the key made from the label. Pure. |
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

## Entity parameters (phase 41)

next-boilerplate phase 41 merges the board parameters and the entity aliases into one concept: a **parameter** is a value
(text, number, date, a fixed list) or an **entity**. An entity parameter (`EntityParam`, verbatim with the server's
`modules/dashboard/server/board-params.ts`) has an entity type and **how the entity is chosen** (`EntityChoice`); a card
names it with `{ "$param": "<key>" }`. `EntityParamFields` edits one; the host's parameter list keeps the label, the kind
and the key (made from the label, `paramKeyFromLabel`, editable under the host's Advanced).

| Choice | Fields | Was (alias filter) |
|---|---|---|
| The viewer picks (`viewer`) | — (a search box in the filter bar) | an entity-type `remote-select` parameter |
| The page or a link sets it (`page`) | "Taken from": a link / page / button, or another parameter of one entity | a hidden parameter; `stateEntity` |
| Fixed: one entity (`single`) | the entity, searched by name | `singleEntity` |
| Fixed: a list (`list`) | 1–100 entities, searched by name | `entityList` |
| All of the type (`all`) | — | `entityType` |
| By name (`name`) | name starts with | `entityName` |
| By subtype or profile (`subtype`) | 1–50 subtypes + optional name prefix (offered for a type with subtypes) | `entitySubtype` |
| Related to another parameter or entity (`related`) | "Related to": a parameter of one entity of a known type, or a fixed entity; Advanced: direction, max level, last level only, relation type and subtypes, or relation filters (which may mix types, and then the parameter has no entity type) | `entitySearchQuery`, `relationsQuery` |

Beside the choice: **one or many** (not for one fixed entity), the **filter-bar mode** (shown and changeable, shown, hidden;
none for a page choice, no picker for one fixed entity, which defaults to hidden), a **default entity** searched by name
inside the set (one entity chosen from a set of a known type, not a relation, whose set only the server walks; `defaultFits`
keeps the search to the listed entities, the name prefix and the subtypes) and **with no value, take the first** (the same).
A page choice that follows another parameter always takes the first of its set, the followed entity: it is its only way to
a value. `fitChoice` keeps these consistent whenever the choice or the count changes, and a change of the set drops the
default picked in the old one (`withChoice`, `withChoicePatch`, `withEntityType`); `normalizeEntityParam` leaves out what
says nothing and keeps a name prefix as typed. With `preview`, a set by name, by subtype or related to a fixed entity shows
the entities it matches (`previewAlias` through `access.preview`). The form never asks for a path, a search key or a value
key: the host's access lists and searches the entities. A key made from the label is never one the server reserves
(`RESERVED_PARAM_KEYS`).

Errors are field-keyed codes (`{ 'choose.param': 'cycle' }`); `messages.paramError(field, code)` gives the text in plain
words ("The parameters it follows lead back to it.").

## Key filters

A filter is `{ key, name, operation?, keyFilters }`; its key filters are joined by its `operation`, **and** (the default,
saved as no `operation`) or **or** (TB's `keyFiltersOperation`; saved only between two or more key filters). The text
brackets a key filter's conditions when they are joined the other way: "(a and b) or c". A key filter is
`{ key: { type, name, scope? }, valueType, operation, predicates }`; its conditions (predicates) are joined by its
`operation` (and / or). `KeyFilterEditor` edits one:

| Field | What |
|---|---|
| Key type | Entity field, attribute, latest telemetry. |
| Key name | With `entityType`, a searchable ComboBox fed by `access.entityKeys(entityType, search)`, showing the keys of the chosen type (and scope); the typed text is always offered first ("Use this name"), so a key the host does not list can still be used. Without `entityType`, a plain text input. Picking a suggested key presets the value type from its `valueType`. |
| Attribute scope | Any, client, shared, server; only for an attribute (saved as `any` when absent). |
| Value type | Text, number, boolean, date and time. Changing it keeps the rows: an operation the new type allows stays, any other becomes the type's default; a dashboard parameter value stays, a literal is dropped (TB clears every row after a confirmation instead). |
| Conditions are joined by | And / or; shown from two conditions on. |
| Conditions | Up to 4 rows: the operation (only the ones of the value type), then the value: a text input, a number input, a `datetime-local` input (stored as ISO text in UTC) or a true / false select; `between` adds "To"; `in` / `not in` take value chips; `is set`, `is not set`, `is true`, `is false` take nothing; text comparisons offer "Ignore case". The button beside a value switches it to a dashboard parameter (`{ $param: key }`, TB's user value of an editable filter); it is disabled on a board without parameters. |

Operations per value type (phase 36.7): text `eq ne startsWith endsWith contains notContains in notIn set unset`;
number `eq ne gt gte lt lte between in notIn set unset`; boolean `eq ne true false set unset`; date and time
`eq ne gt gte lt lte between set unset`. New rows default the TB way: text "starts with", boolean "is true", the rest
"equal".

## The data contract

`types.ts` holds the contract verbatim (`EntityAlias`, `EntityAliasFilter`, `EntityRef`, `EntityTypeInfo`,
`RelationProviderInfo`, `BoardParamInfo`, `AliasPreview`, `EntityAliasesAccess`) and, between its own markers, the
phase 36.7 key filter contract (`KeyFilterKeyType`, `AttributeScope`, `KeyFilterValueType`, `KeyFilterOp`, `FilterValue`,
`KeyFilterPredicate`, `KeyFilter`, `BoardFilter`, `EntityKeyInfo`); next-boilerplate's server implements the same shapes.
Change them only together with the server.

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
| `entityKeys(entityType, search)` | The key filter editor's key name suggestions (fields, attributes with their scope, telemetry keys, each with a `valueType`). Asked only when the filters dialog gets an `entityType`; a rejection means no suggestions (typing still works). |

Pass a stable access object (`useMemo`); a new object per render works but loses the shared cache.
`AliasEntitySelect` takes its own `loadOptions(aliasKey, search)` (the resolved set of one alias, E36-6).

## Caps (`validate.ts`)

At most 32 aliases (`MAX_ALIASES`); key `^[a-z][a-zA-Z0-9_]{0,39}$`, not `__proto__` / `constructor` / `prototype`, unique;
name 1–80 characters, unique on the board ignoring case; entity list 1–100 ids; name prefix 1–120 (optional for a subtype
filter); subtypes 1–50 for a subtype filter (at most 50 for a search query); max level an integer 1–10 (no unlimited);
at most 8 relation filters; `stateEntity.param` and a param root must name a board param; a single entity never resolves
to many. Errors are field-keyed codes (`{ 'filter.ids': 'tooMany' }`); `messages.error(field, code)` gives the text.

Key filters (`validate-filters.ts`): at most 16 filters (`MAX_BOARD_FILTERS`); the filter key follows the alias key rule
and is unique; name 1–80 characters, unique on the board ignoring case; `operation` absent, `and` or `or`; 1–8 key filters (`MAX_KEY_FILTERS`); a key name
1–200 characters and a known key type, scope and value type; 1–4 conditions (`MAX_PREDICATES`); the operation must be one
of the value type's; `value` (and `to` for between) is required where the operation reads it and must fit the value type
(a finite number, a boolean, a non-blank text of at most 200 characters, a parseable ISO date); `in` / `not in` take
1–50 values (`MAX_FILTER_VALUES`) of at most 200 characters, numbers for a number key; a `{ $param }` must name a board
param. Codes are keyed `name`, `keyFilters`, `keyFilters.<n>.key.name`, `keyFilters.<n>.predicates.<m>.value` …;
`messages.filterError(field, code)` gives the text, and `keyFilterErrorsAt(errors, n)` strips the prefix for one
`KeyFilterEditor`.

## Parity

React only: kui-ejs and KUInative have no board editor (E36-11, `parity.exceptions.json` record `entity-aliases`).
