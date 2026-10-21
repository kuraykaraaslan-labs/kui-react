# WidgetKit

- **id:** `widget-kit`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/WidgetKit/index.ts`
- **status:** beta
- **since:** 2026-10

Dashboard widget kit (next-boilerplate dashboard phase 21). WidgetCard frames every widget (title row with icon, subtitle and help, card buttons for full screen, CSV and refresh, loading/empty/unconfigured/error/stale/unavailable states, "Updated" footer; `unavailable` keeps the title and shows an UnavailableContribution). Versioned settings templates (core:card, core:format, core:board and one per widget type) give ThingsBoard-depth editing with free colours (any CSS colour or a theme token); stored settings carry $v and migrate with append-only steps. WidgetSettingsEditor edits a placement in tabs with Basic/Advanced, layout variants picked from thumbnail cards (renderWidgetPreview, or a host renderPreview); WidgetBoard lays out a whole board with edit mode and JSON export/import that carries every card.

## Depends on

- `schema-form`
- `tab-group`
- `drawer`
- `modal`
- `tooltip`
- `chart`
- `map-view`
- `control-tile`
- `unavailable-contribution`

## Accessibility

- WCAG: AA
- ARIA patterns: region, tablist, dialog, radiogroup
- Keyboard:
  - `Tab` — Reach the card buttons (shown on focus), the editor tabs and every field
  - `Escape` — Close the full-screen view and the settings drawers

Each card is a labelled section; card buttons have aria-labels; loading sets aria-busy; errors use role="alert".

## Design tokens consumed

- `--surface-raised`
- `--surface-base`
- `--border`
- `--text-primary`
- `--text-secondary`
- `--primary`
- `--warning-subtle`
- `--warning-fg`
- `--canvas-bg`

## Variants

### WidgetCard

```tsx
<WidgetCard title="Load" card={card} stale={stale}>{body}</WidgetCard>
```

### WidgetCard unavailable (admin view of a widget whose module is off)

```tsx
<WidgetCard title="Open calls" card={card} state="unavailable"
  unavailable={{ reason: 'disabled', action: { label: 'Enable telephony', onClick: enable } }} />
```

### PlacementCard + WidgetSettingsEditor

```tsx
<WidgetSettingsEditor templates={[kind.template, CORE_CARD, CORE_FORMAT]} settings={settings} onChange={setSettings} caps={caps} />
```

### WidgetBoard (edit, export, import)

```tsx
<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />
```

## Full source

```tsx
import { WidgetBoard, BUILTIN_KINDS, BUILTIN_VIEWS } from '@/modules/app/WidgetKit';

<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />
```
