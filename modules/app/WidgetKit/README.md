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
WidgetKitContext.tsx  host hooks: icon resolver, field overrides, locale, embed site allow-list (`embedHosts`)
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

## Changing a template

| Change | Bump the version? | What else |
|---|---|---|
| Add a field (its default renders exactly as before), an option, or change a label/group/`advanced` | No | Give the field `since: <current version>` |
| Change a default, rename, retype, narrow a range, remove an option | Yes | Append a migration step (`ops` or `up`); never edit or delete an old step |
| Remove a multi-select option | Yes | Append a step with `{ op: 'filterList', key, remove: [<option>] }` (or `keep: [<options left>]`); a list that ends up empty is removed, so the card falls back to its default |
| Remove a field | Yes, twice | First `deprecated: { since, replacedBy?, removeIn }`, drop it at least one version later |

The declarative ops (`MigrationOp`, the only kind a tenant-authored template may use) are `rename`,
`mapValue`, `materializeDefault`, `clamp`, `drop`, `each` (the same ops on every item of a repeater) and
`filterList`. Each is pure, sparse-safe and idempotent; an op this code does not know leaves the values
unchanged, so settings migrated by a newer version still read.

`tests/templates.lock.json` records every field at its version and fails a change that needed a bump.
After an intended bump, run `UPDATE_TEMPLATE_LOCK=1 npx vitest run modules/app/WidgetKit/tests/templates-lock.test.ts`:
it locks the new version and writes a golden fixture `tests/fixtures/<id>/v<N>.json` for it. Existing fixtures
are append-only, so settings saved by every past version keep migrating.
