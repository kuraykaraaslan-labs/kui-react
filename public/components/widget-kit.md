# WidgetKit

- **id:** `widget-kit`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/WidgetKit/index.ts`
- **status:** beta
- **since:** 2026-10

Dashboard widgets. PlacementCard draws a widget from its kind, settings and data inside a WidgetCard frame: title, card buttons, and the loading, empty, not-configured and error states. Built-in kinds cover numbers, states, gauges, tables, feeds, content, charts, maps, controls and SCADA process diagrams. Settings from the data source are the defaults; a placement's own settings win. WidgetSettingsEditor and WidgetBoard exist in kui-react only.

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

## Variants

### WidgetCard

```tsx
<WidgetCard title="Load" card={card} stale={stale}>{body}</WidgetCard>
```

### WidgetCard — unavailable

```tsx
<WidgetCard title="Open calls" card={card} state="unavailable"
  unavailable={{ reason: 'disabled', action: { label: 'Enable telephony', onClick: enable } }} />
```

### PlacementCard + WidgetSettingsEditor

```tsx
<WidgetSettingsEditor templates={[kind.template, CORE_CARD, CORE_FORMAT]} settings={settings} onChange={setSettings} caps={caps} />
```

### WidgetBoard — edit, export, import

```tsx
<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />
```

## Full source

```tsx
import { WidgetBoard, BUILTIN_KINDS, BUILTIN_VIEWS } from '@/modules/app/WidgetKit';

<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />
```
