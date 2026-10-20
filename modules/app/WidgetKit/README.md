# modules/app/WidgetKit

The dashboard widget kit: one card around every widget, versioned settings templates (ThingsBoard-depth
editing), a settings editor, the presentational view of every builtin widget type, and a board with
JSON export/import. Source of truth for next-boilerplate's dashboard (phase 21), which vendors this
directory into `modules/common/ui/kui/widget-kit/` with `scripts/kui/vendor-widgetkit.mjs`. It is also the source
of the sibling repos' WidgetKit: kui-ejs (EJS partials) and KUInative (React Native) vendor its pure logic and draw
it with their own markup (see "Siblings" below).

## Files

```
settings/types.ts     SettingsTemplate, TemplateField, MigrationStep, SettingsStamp, WidgetCaps (pure)
settings/engine.ts    migrate, validate (deep), effective, prune, readSettings, prepareForSave (pure)
settings/style.ts     isColor / cssColor (free colour or theme token), fontStyle, formatValue, rangeFor (pure)
settings/packs.ts     field packs: value/label style, colour ranges, legend, axis, thresholds, icon, layout (pure)
settings/core.ts      core:card, core:format, core:board templates (pure)
settings/resolve.ts   resolvePlacement (layers), toCsvText (pure)
settings/board.ts     BoardDocument, exportBoard, importBoard (pure)
settings/grid.ts      the board's column count (12 | 24): normalizeGridCols, scaleWidth, scaleLayout, resolveOverlaps (pure)
templates/*.ts        one BuiltinKindSpec + SettingsTemplate per widget type; index.ts = BUILTIN_KINDS (pure)
views/*.tsx           one view per widget type; index.ts = BUILTIN_VIEWS
views/*-logic.ts      the pure part of a view (no React, no DOM): `*Model` functions that decide everything the view
                      draws as plain data. `*-model.ts` is the same for the content widgets. The .tsx files only
                      map a model to JSX; kui-ejs and KUInative vendor these files (pure)
card-logic.ts         cardModel (the frame's classes, styles, body state), formatUpdated, styleAttribute (pure)
placement-logic.ts    placementStatus: bound slots, stale, the card state (pure)
tests/parity/         the reference rendering: cases.ts (49+ widget cases as JSON), golden.json (the HTML kui-react
                      draws for them, normalised by normalize.ts), golden.test.tsx (fails when a view's markup changes)
kind.ts               SlotData, SlotSpec, WidgetViewProps, WidgetKindView, BuiltinKindSpec
WidgetCard.tsx        the frame: title row, buttons, body states, stale, footer
PlacementCard.tsx     one placement: resolved settings + WidgetCard + view, full screen, CSV
WidgetSettingsEditor.tsx  tabs (Display, Data, Card, Actions), Basic/Advanced, read-only newer parts
previews.tsx          layout thumbnails: renderWidgetPreview(id), one inline SVG per option `preview` id;
                      type thumbnails for a catalog/picker: renderWidgetTypePreview(type, settings?) (static, no view mounts)
WidgetBoard.tsx       a whole board: grid, edit mode, card + board settings, export/import
board-cell.ts         cardCellResponsive: a card's small-screen settings on its grid cell (pure)
WidgetKitContext.tsx  host hooks: icon resolver, field overrides, layout thumbnails (`renderPreview`), locale, embed site allow-list (`embedHosts`),
                      the kit's texts (`messages`, `useKitMessages`), template and type texts (`templateText`, `kindText`)
messages.ts           every text the kit draws, by group, with the English defaults; mergeKitMessages (pure)
localize.ts           localizeTemplate, localizeKind: template and type texts through the host's hooks (pure)
```

## Siblings

A widget must look and behave the same in kui-react, kui-ejs and KUInative. The way this is kept true:

1. **One implementation of every decision.** A view's logic lives in a pure `views/*-logic.ts` (`*Model(settings,
   format, data, locale, …)`); `WidgetCard`'s lives in `card-logic.ts`. A setting therefore means the same thing in
   all three; only the drawing is per platform.
2. **Vendoring, not copying by hand.** kui-ejs (`src/widget-kit/`) and KUInative (`modules/app/WidgetKit/kit/`) have a
   `scripts/kui/vendor-widgetkit.mjs` that copies the pure files at a pinned kui-react commit. A vendored file is
   never edited there; change it here, commit, bump the pin.
3. **Machine-checked parity.** `tests/parity/golden.json` holds the HTML kui-react draws for each case in
   `cases.ts`. kui-ejs draws the same cases with its partials and compares the normalised HTML. After a change that
   alters a view's markup, `UPDATE_PARITY_GOLDEN=1 npx vitest run modules/app/WidgetKit/tests/parity` rewrites the golden
   file: that diff is the list of what the siblings must follow. KUInative has no DOM to compare; it compares the
   visible text of every case.
4. **Pure means pure.** A `*-logic.ts` / `*-model.ts` file imports no React and no kui-react component module (a
   type-only import of one is re-pointed at a host shim by the vendor scripts). Its only runtime dependencies are
   `clsx` and `tailwind-merge`, through `@/libs/utils/cn`, so class merging is the same everywhere.

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

## Layout thumbnails

A layout option names a drawing: `opt('arc', 'Half circle', 'gauge-arc')`. A select with
`display: 'cards'` (`layoutField`, the card style, the line shape, the pie layout) is a radiogroup of
picture cards; SchemaForm asks its `renderOptionPreview(id)` for each option's drawing and shows the
label only for an id that returns `null`. The settings editor passes the host's `renderPreview` first
and `renderWidgetPreview` (in `previews.tsx`) for the ids the host leaves to the kit, so a tenant
template can bring its own drawings and a host can redraw a builtin one.

Every drawing is a 48 x 32 SVG in `currentColor` at a few opacities (and `var(--surface-raised)` for a
mark on a solid fill): idle cards draw it in the secondary text colour, the picked one in the primary
colour, and the dark theme follows the tokens. It is `aria-hidden`; the label is the radio's name. The
group has one tab stop; the arrow keys, Home and End move the pick. A new `preview` id in a builtin
template needs a drawing: `tests/previews.test.tsx` fails for an id `WIDGET_PREVIEW_IDS` lacks.

## Columns

A board lays out on 12 columns, or on 24 when `doc.board.gridCols` is 24 (the same rule as
next-boilerplate's `gridCols`, phase 21.10). The board settings drawer has the field; a change rescales
every card's `x` and `w` with `scaleLayout` (12 → 24 is exact; 24 → 12 pushes narrow neighbours that
land on the same column down a row). A new card's width is its type's `defaultW` (of 12) as the same
share. `exportBoard` writes `version: 2` and `board.gridCols` only for a 24-column board, so a
12-column board stays a version 1 file; `importBoard` reads versions up to 2
(`BOARD_DOCUMENT_VERSION`), clamps each card into the board's own columns and pushes clamped cards
that collide down.

## Texts in the host's language

Every text the kit draws itself (the card chrome, the board, the settings editor and its form, the
controls, every view) comes from `messages.ts`, by group: `card`, `board`, `editor`, `form`, `controls`,
`table`, `feed`, `map`, `viewer`, `charts`, `content`, `stat`, `issues`, `common`. A host passes any of them:

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
- `issues`: a settings issue (`Issue`) carries a `code` and `params` next to its English `message`; the
  engine's field checks and the kit's cross-field rules (`minBelowMax`, the content and model URL rules,
  `positiveStep`) set them. `WidgetSettingsEditor` shows an issue in `issues` through `issueText` with the
  field's label as shown, so a server that sends the issues back with a 422 gets them in the host's
  language; one without a code (a host's own rule) keeps its `message`.
- The kit passes its texts to the primitives too: `charts.total` is the stacked tooltip's total row
  (`tooltipTotalLabel`), `card.closeFullscreen` and `board.closeDrawer` name the close buttons of the
  full-screen `Modal` and the board's `Drawer`s (`closeLabel`).
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
