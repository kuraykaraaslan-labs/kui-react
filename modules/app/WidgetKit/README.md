# modules/app/WidgetKit

The dashboard widget kit: one card around every widget, versioned settings templates (ThingsBoard-depth
editing), a settings editor, the presentational view of every builtin widget type, and a board with
JSON export/import. Source of truth for next-boilerplate's dashboard (phase 21), which vendors this
directory into `modules/common/ui/kui/widget-kit/` with `scripts/kui/vendor-widgetkit.mjs`.

## Files

```
settings/types.ts     SettingsTemplate, TemplateField, MigrationStep, SettingsStamp, WidgetCaps (pure)
settings/engine.ts    migrate, validate (deep), effective, prune, readSettings, prepareForSave (pure)
settings/style.ts     isColor / cssColor (free colour or theme token), fontStyle, formatValue, rangeFor (pure)
settings/packs.ts     field packs: value/label style, colour ranges, legend, axis, thresholds, icon, layout (pure)
settings/core.ts      core:card, core:format, core:board templates (pure)
settings/resolve.ts   resolvePlacement (layers), toCsvText (pure)
settings/board.ts     BoardDocument, exportBoard, importBoard (pure)
templates/*.ts        one BuiltinKindSpec + SettingsTemplate per widget type; index.ts = BUILTIN_KINDS (pure)
views/*.tsx           one view per widget type; index.ts = BUILTIN_VIEWS
kind.ts               SlotData, SlotSpec, WidgetViewProps, WidgetKindView, BuiltinKindSpec
WidgetCard.tsx        the frame: title row, buttons, body states, stale, footer
PlacementCard.tsx     one placement: resolved settings + WidgetCard + view, full screen, CSV
WidgetSettingsEditor.tsx  tabs (Display, Data, Card, Actions), Basic/Advanced, read-only newer parts
WidgetBoard.tsx       a whole board: grid, edit mode, card + board settings, export/import
board-cell.ts         cardCellResponsive: a card's small-screen settings on its grid cell (pure)
WidgetKitContext.tsx  host hooks: icon resolver, field overrides, locale, embed site allow-list (`embedHosts`),
                      the kit's texts (`messages`, `useKitMessages`), template and type texts (`templateText`, `kindText`)
messages.ts           every text the kit draws, by group, with the English defaults; mergeKitMessages (pure)
localize.ts           localizeTemplate, localizeKind: template and type texts through the host's hooks (pure)
```

## Rules

1. **Free colour** (owner decision D-21.1): a colour setting is any CSS colour or a theme token
   (`var(--primary)`); defaults are tokens. Settings colours reach the DOM only through `cssColor()`.
2. **Versioned templates** (D-21.6): every template has an id and an integer version; stored settings
   carry `$v`; a change that is not purely additive bumps the version and appends a migration step.
   Steps are never deleted. Data from a newer version is shown read-only and never downgraded.
3. Pure files (`settings/*`, `templates/*`, `kind.ts`) import no React at runtime: next-boilerplate's
   server validates with them.
4. No stored code and no raw CSS in settings (the only ThingsBoard features not taken).

See [/AGENTS.md](../../../AGENTS.md).

## Texts in the host's language

Every text the kit draws itself (the card chrome, the board, the settings editor and its form, the
controls, every view) comes from `messages.ts`, by group: `card`, `board`, `editor`, `form`, `controls`,
`table`, `feed`, `map`, `viewer`, `charts`, `content`, `stat`, `common`. A host passes any of them:

```tsx
<WidgetKitProvider value={{
  locale,
  messages: { card: { refresh: t('Refresh') }, table: { rowCount: (n) => t('{{count}} rows', { count: n }) } },
  templateText: ({ templateId, path, prop, value, english }) => lookup(templateId, path, prop, value),
  kindText: ({ type, prop, key, english }) => lookup(type, prop, key),
}}>
```

- Whatever the host leaves out stays English (`DEFAULT_WIDGET_KIT_MESSAGES`). A text that interpolates
  is a function of its values; the control texts ControlTile fills itself keep its single-brace marks
  (`typeToConfirm: 'Type "{text}" to confirm'`).
- Precedence, lowest first: the defaults, the host's `messages`, a placement's own settings (the card's
  "No data" text, a control's feedback texts, `unknownLabel`, `otherLabel`, `totalLabel`, `countLabel`,
  `valueName`, `linkLabel`, `openLabel` …), explicit props (`errorText`, `unconfiguredText`, a view's
  `messages`, `loadingLabel`, `legendLabel`, `layerLabels`, `controlDisabledReason`, SchemaForm's
  `emptyMessage`).
- `controls.failed`: when a host sets it, a failed write shows "failed (reason)". A host whose
  `onControl` already rejects with a worded error should leave it out.
- Keep `messages` stable (memoize it): the provider merges it once per change. Keep `templateText` and
  `kindText` stable per language: `localizeTemplate` and `localizeKind` memoize per function, so a new
  function (a language switch) re-localizes and an old one's labels never leak.
- Template and type texts are looked up by template id (`core:card`, `builtin:stat.value`) and type, never
  rendered as markup. Only what is shown changes: field keys, option values, stored values, versions and
  the text a typed confirmation needs stay as they are.
- Group labels are the editor's grouping key, so `localizeTemplate` never gives two groups the same
  label: a later group whose translation is taken keeps its English, or gets `English (id)` when that is
  taken too.
- Pure helpers take the texts as an optional argument (`controlBlockReason`, `requestControl`,
  `controlMessages`, `forText`, `spanText`, `buildMarkers`, `validateSchemaValues`, `importBoard`'s
  `defaultTitle`); `importBoard` refusals carry a `code` (`invalid-json`, `not-board`, `newer-format`,
  `newer-templates`) and `detail`, so a host can word them.

## Changing a template

| Change | Bump the version? | What else |
|---|---|---|
| Add a field (its default renders exactly as before), an option, or change a label/group/`advanced` | No | Give the field `since: <current version>` |
| Change a default, rename, retype, narrow a range, remove an option | Yes | Append a migration step (`ops` or `up`); never edit or delete an old step |
| Remove a multi-select option | Yes | Append a step with `{ op: 'filterList', key, remove: [<option>] }` (or `keep: [<options left>]`); a list that ends up empty is removed, so the card falls back to its default |
| Remove a field | Yes, twice | First `deprecated: { since, replacedBy?, removeIn }`, drop it at least one version later. Until then the editor shows a stored value read-only under "No longer used" |

The declarative ops (`MigrationOp`, the only kind a tenant-authored template may use) are `rename`,
`mapValue`, `materializeDefault`, `clamp`, `drop`, `each` (the same ops on every item of a repeater) and
`filterList`. Each is pure, sparse-safe and idempotent; an op this code does not know leaves the values
unchanged, so settings migrated by a newer version still read.

`tests/templates.lock.json` records every field at its version and fails a change that needed a bump.
After an intended bump, run `UPDATE_TEMPLATE_LOCK=1 npx vitest run modules/app/WidgetKit/tests/templates-lock.test.ts`:
it locks the new version and writes a golden fixture `tests/fixtures/<id>/v<N>.json` for it. Existing fixtures
are append-only, so settings saved by every past version keep migrating.
