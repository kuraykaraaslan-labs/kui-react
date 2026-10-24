# Phase 9: Data and realtime components

**Goal:** finish the generic data-display and realtime building blocks that a monitoring product needs and that are stubs or missing today: a real time axis and zoom on charts, a gauge and a heatmap, dashboard time ranges with a live mode, live map markers with clustering, a key/value editor, a schema-driven form, a transport-agnostic live-data hook and a status indicator. Every item is generic; nothing here knows about devices. The IoT plan in [`docs/concepts/iot-platform/`](../concepts/iot-platform/README.md) is the first consumer, but every item must make sense to any domain (fintech prices, logistics fleets, ops dashboards).
**Effort:** L. Every numbered section is an independent PR.
**Depends on:** nothing hard. Phase 1 (CI) and phase 2 (tests) protect the work if they land first; phase 4.4 (parity matrix) turns the exception records below into CI checks.
**Repos:** kui-react first; kui-ejs and KUInative where the component already exists there (see the parity rule below).
**Origin:** the IoT platform plan in next-boilerplate (`docs/concepts/iot-platform/README.md`, section "How this tree is split": generic UI components are planned here, IoT-only ones in `docs/concepts/iot-platform/`). Written 2026-10-04.

## Parity rule for this phase

[ADR 0003](../adr/0003-react-ejs-parity-contract.md) applies, extended to KUInative (`$KUINATIVE_ROOT`) by the owner's standing rule:

- If the component already exists in kui-ejs and/or KUInative, the change is mirrored there **pixel-perfect** (same DOM/view shape, prop/local names, defaults and tokens). The mirror is a task in the same section, not a follow-up phase.
- If the component does **not** exist in the other repo, it is **not** created there. The item is tagged `[react]` and gets a line in `parity.exceptions.json` (phase 4.4) with the reason "new in phase 9, no counterpart".
- Tags: `[react]` only kui-react · `[ejs]` only kui-ejs · `[both]` kui-react + kui-ejs. This phase adds one marker that the legend in [README.md](README.md) does not have: **`+native`** after a tag means "also mirror in KUInative". KUInative has no `docs/phases/` of its own, so its mirror tasks live here.

Existence was checked on 2026-10-04:

| Component | kui-react | kui-ejs | KUInative |
|---|---|---|---|
| `Chart` (Line/Area/Bar/…) | `modules/ui/Chart/` (M1 charts, M3 stubs return `null`, `Brush` stub) | `modules/ui/Chart/Chart.ejs` (line, bar, area, pie, donut, sparkline; gauge/heatmap/brush are TODO comments) | `modules/ui/Chart/` (M1 charts, M3 stubs incl. `GaugeChart`/`HeatmapChart` exported as `null`; `Brush` not exported) |
| `MapView` | `modules/ui/MapView/` (leaflet; cluster/onTelemetry TODO M2/M5) | `modules/ui/MapView/` (`scripts/cluster.js` is a 3-line TODO) | `modules/ui/MapView/` (same TODO list in `types.ts`) |
| `DateRangePicker` | `modules/ui/DatePicker/` (`PresetList` is an empty placeholder) | `modules/ui/DatePicker/DateRangePicker.ejs` (presets TODO M2) | `modules/ui/DatePicker/` (has `DateTimePicker`, no presets) |
| `Badge` (with `dot`) | yes | yes | yes |
| `DataTable` | yes | yes | `modules/ui/Table/` |
| Time-range picker, key/value editor, schema form, live-data hook, status indicator, QR scanner/renderer | missing | missing | missing |

## How each item is proven

Every new component or prop gets a showcase entry (at least two variants) and a `showcase.menu.ts` line, then `npm run registry:snapshot` (AGENTS.md). The IoT demo under `/theme/iot` uses each item in a real screen; the "Seen in" line of each section names that route. The IoT phases reference these sections by number (`9.3` and so on).

## Owner decisions (2026-10-04)

From next-boilerplate `docs/concepts/iot-platform/README.md` §"Owner decisions (2026-10-04)":

- **→ DECISION OD-15 (owner, 2026-10-04):** the chart engine is the kui-react **native SVG `Chart`** (`modules/ui/Chart/`) with a time axis (9.1), zoom (9.2), `GaugeChart` (9.3) and `HeatmapChart` (9.4), at parity with kui-ejs (`Chart.ejs`) and KUInative (`modules/ui/Chart/`); **not chart.js**. 9.1–9.4 are therefore committed work, not one option among two. chart.js remains only in existing non-IoT domain components (fintech, media, `domains/common/charts`), outside this phase; no new chart.js consumer is added anywhere.
- **→ DECISION OD-16 (owner, 2026-10-04):** NB `common/ui/schema-form` `FieldSchema` moves into kui-react as the single form-schema vocabulary (9.10); OpenWrt `blocks.d` field types map onto it.
- **→ DECISION OD-9 (owner, 2026-10-04):** alarm severities are five levels (CRITICAL/MAJOR/MINOR/WARNING/INFO) and the IoT term is Alarm. Generic components here stay severity-agnostic; 9.12 `StatusIndicator` keeps its `'alarm'` status and the IoT layer maps severities onto it (IoT 03).
- **→ DECISION OD-80 (owner, 2026-10-04):** control widgets (button, switch, slider, set-point → RPC / shared attributes) are in the IoT MVP dashboard (IoT 07 §7.3); no SCADA. The generic part — a control that shows pending / confirmed / failed for an asynchronous write and a slider that commits once on release — is planned here as **9.16**, not as an IoT one-off.
- **→ DECISION OD-82 (owner, 2026-10-04):** MVP mobile is responsive web + PWA (camera QR scan, push); a native app later. 9.13 `QrScanner` must work in an installed PWA (standalone display mode).
- **→ DECISION OD-79 (owner, 2026-10-04):** the RulesetEditor is vendored into NB **in the MVP** (cloud rule engine, IoT README §"Cloud rule engine in the MVP"), so the 9.10 `fromParamSpec` / `fromBlocksField` coordination is MVP work if that editor renders block forms with `SchemaForm`.
- **→ DECISION OD-90 (owner, 2026-10-04):** NB's 8 weeks (and every "week N" the IoT plan names for these items) start only after NB's blockers are done (RLS cutover, ABAC self-signup fix, Docker workspace fix, once-per-cluster websocket delivery). The items here do not depend on NB and may start earlier.

## 9.1 Charts: a real time axis `[both]` `+native`

> **Status 2026-10-06 (react side):** shipped as `xAxis="time"` (alias `xScale="time"`) on `LineChart` / `AreaChart` (`charts/TimeSeriesChart.tsx`, `charts/_time.ts`: `timeExtent`, `xTime`, `timeTicks`, `formatTick`, `nearestIndex`, tested in `charts/chart-math.test.ts`), with viewer-local drag-to-zoom and a reset button (§9.2 partly: no controlled `xDomain`, no `Brush` overview yet). Not done: `'linear'`, `maxPoints` (LTTB), shared 10 000-point fixture, kui-ejs and KUInative mirrors. `stacked` on `BarChart` / `AreaChart` also landed.

`LineChart`/`AreaChart` place x on a band scale (`xCategories`, `bandCenter` in `charts/_helpers.ts`). Telemetry, prices and logs need a continuous time axis: uneven sample spacing, gaps, thousands of points.

- [ ] `xScale?: 'band' | 'time' | 'linear'` on `BaseChartProps` (default `'band'`, so nothing changes for current users). With `'time'`, `SeriesPoint.x` is an epoch-ms number or ISO string.
- [ ] `_helpers.ts`: `timeExtent`, `timeScale(value, min, max, rect)`, `timeTicks(min, max, approxCount)` choosing a step (1 s … 1 y) and a label format per step; locale through `Intl.DateTimeFormat`. Pure functions, unit-tested; they are mirrored 1:1 in kui-ejs `scripts/chart-helpers.js` and KUInative `charts/_helpers.ts` (both already copy this file).
- [ ] `null` y values break the line (gap) on a time axis instead of being skipped silently.
- [ ] Down-sampling for large series: `maxPoints?: number` applies LTTB (largest-triangle-three-buckets) before drawing; tooltip still shows the nearest raw point.
- [ ] Tooltip and `Crosshair` snap to the nearest point by x distance (not band index) on a time axis.
- [ ] kui-ejs: `Chart.ejs` accepts `xScale: 'time'` and renders the same DOM; `chart-helpers.js` gains the same functions.
- [ ] KUInative: `charts/Cartesian.tsx` gets the same prop and helpers.
- [ ] (OD-15) Parity check: the same 10 000-point time-axis fixture renders in kui-react, kui-ejs and KUInative with identical tick labels (one shared fixture file per repo, compared in each repo's test suite).

Seen in: `/theme/iot/devices/[slug]/telemetry` (IoT phase 02), which replaces the chart.js `TelemetryTimeSeriesChart` (OD-15).

## 9.2 Charts: Brush and zoom `[both]`

`primitives/Brush.tsx` is an M4 stub returning `null`. Zoom is needed for any history view.

- [ ] Implement `Brush` as its file header describes: drag to select, two handles, controlled `range`, `onRangeChange([x0, x1])` in domain units, arrow keys move the focused handle, Shift+arrow moves faster, no drag inertia under `prefers-reduced-motion`.
- [ ] `LineChart`/`AreaChart`: controlled `xDomain?: [number, number]` + `onXDomainChange`; `brush?: boolean` renders a mini overview with the `Brush` under the plot; drag-select on the main plot zooms; double-click or a "Reset zoom" button restores the full domain.
- [ ] Zoom never refetches by itself; the consumer decides (the IoT explorer refetches at a finer aggregation when the window shrinks).
- [ ] kui-ejs: `Chart.ejs` `brush: true` renders the same overview DOM; the drag logic goes into `scripts/chart-brush.js` (client script, same events as a `CustomEvent('kui:chart:range')`).
- [ ] KUInative: `Brush` is **not exported** there today, so it is not created (exception record: "touch zoom on native is a separate design"). Revisit when a KUInative screen needs history zoom. (OD-15 asks for zoom parity with KUInative; this exception stands until a KUInative history screen exists, then zoom is designed there as a task in this section, not a separate library.)

Seen in: `/theme/iot/devices/[slug]/telemetry`.

## 9.3 Charts: `GaugeChart` `[both]` `+native`

> **Status 2026-10-06 (react side):** `charts/GaugeChart.tsx` implemented with the props below (`bands`, `unit`, `label`, `format`, `needle`, `size`, `ariaLabel`, `stale`, `staleLabel`), `role="meter"`, animated arc. kui-ejs and KUInative still stubs.

Stub in all three repos. The header in `charts/GaugeChart.tsx` already fixes the design: half-donut, threshold bands in `--success`/`--warning`/`--error`, centred value label, optional needle.

- [ ] Props: `value`, `min = 0`, `max = 100`, `bands?: { to: number; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }[]`, `unit?`, `label?`, `format?: (v) => string`, `needle?: boolean`, `size?: 'sm' | 'md' | 'lg'`, `ariaLabel?`. Value is clamped; out-of-range shows the clamped arc plus the real value in the label.
- [ ] `role="meter"` with `aria-valuemin/max/now` and `aria-valuetext` (value + unit + band name).
- [ ] Value change animates over `animationDuration()` (0 under reduced motion).
- [ ] `stale?: boolean` dims the arc and shows a "stale" hint (pairs with 9.11/9.12).
- [ ] kui-ejs: `Chart.ejs` `type: 'gauge'` + `partials/_gauge.ejs`; same DOM. Note: `modules/domain/ups/PowerLoadGauge.ejs` is an EJS-only linear load bar; it stays as is (not a generic gauge).
- [ ] KUInative: replace the `GaugeChart` stub in `charts/Stubs.tsx` with a `react-native-svg` implementation in `charts/Radial.tsx`; `accessibilityRole="progressbar"` + value text.

Seen in: `/theme/iot` dashboard gauge widget (IoT phase 07).

## 9.4 Charts: `HeatmapChart` `[both]` `+native`

> **Status 2026-10-06 (react side):** matrix mode implemented (`cells`, `min`/`max` domain, `valueFormat`, legend, tooltip, missing cell is empty). Not done: `calendar` mode, diverging scale, hatched empty cells, arrow-key cell focus; kui-ejs and KUInative stubs.

Stub in all three repos.

- [ ] `mode: 'matrix'` (x categories × y categories, one numeric cell value) and `mode: 'calendar'` (week-of-year × day-of-week), as the stub header describes. Colour interpolates between `--surface-overlay` and `--primary`; an optional diverging scale (`--info` ↔ `--error`) for signed values.
- [ ] Legend strip with min/max and the unit; tooltip shows x, y, value; empty cells are hatched, not zero-coloured.
- [ ] Keyboard: arrow keys move a focus cell, value announced.
- [ ] kui-ejs: `type: 'heatmap'` + `partials/_heatmap.ejs`.
- [ ] KUInative: replace the stub.

Seen in: `/theme/iot/devices/[slug]/telemetry` (hour × weekday view of one key).

## 9.5 Charts: rolling live window `[react]`

- [ ] `LineChart`/`AreaChart`/`SparkLine` with `xScale: 'time'` accept `window?: { durationMs: number }`: the x domain follows `now`, points older than the window drop out, new points append without remounting the SVG.
- [ ] Driven by 9.11 (`useLiveData` delivers coalesced batches); the chart never subscribes by itself.
- [ ] kui-ejs has no client data API for charts (they are server-rendered); exception record "live window needs a client data API that EJS charts do not have". KUInative: not mirrored until a native live screen exists (exception record).

Seen in: `/theme/iot/devices/[slug]/telemetry` (live mode).

## 9.6 DateRangePicker presets `[both]` `+native`

`DatePicker/parts/PresetList.tsx` renders a hidden placeholder (TODO M2). kui-ejs and KUInative have the same TODO.

- [ ] `presets?: { id: string; label: string; range: () => DateRange }[]` with a default set (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month); roving tabindex; selecting a preset applies and closes.
- [ ] `messages` keys for every default label (English defaults; `tr` locale file gets the translations; no Turkish strings outside `locale/tr.ts`).
- [ ] kui-ejs: `DateRangePicker.ejs` `presets` local + `partials/_presets.ejs`; same DOM.
- [ ] KUInative: same prop on `DateRangePicker`.

Seen in: `/theme/iot/alerts` filter bar (IoT phase 03).

## 9.7 `TimeRangePicker` for dashboards `[react]`

> **Status 2026-10-06:** the simpler inline `TimeWindowPicker` (`modules/ui/TimeWindowPicker.tsx`: presets, absolute UTC range, interval, aggregation) shipped for next-boilerplate's board header. The popover `TimeRangePicker` below (live mode, `resolveTimeWindow`, `DateTimePicker`) is still open.

A new molecule in `modules/ui/DatePicker/TimeRangePicker.tsx`. Monitoring screens think in "last 6 hours, live" rather than calendar days; `DateRangePicker` stays the calendar control and is reused inside this one.

- [ ] Value type in `DatePicker/types.ts`:
  `TimeWindow = { kind: 'relative'; durationMs: number } | { kind: 'absolute'; from: Date; to: Date }`, plus `live: boolean`, `refreshMs?: number`, `aggregation?: { interval: 'auto' | number; fn: 'none' | 'avg' | 'min' | 'max' | 'sum' | 'count' }`.
- [ ] Pure helper `resolveTimeWindow(win, now) => { from, to }` and `autoInterval(from, to, maxPoints)`; unit-tested.
- [ ] UI: a trigger showing the window in words ("Last 6 hours · live"); a popover with quick relative ranges (5 m, 15 m, 1 h, 6 h, 24 h, 7 d, 30 d), a custom relative input (number + unit), an absolute tab using `DateRangePicker` with time (needs `DateTimePicker`, see below), a live toggle with refresh interval, and an optional aggregation section (`showAggregation`).
- [ ] Live mode: a pulsing dot on the trigger; leaving live mode (by zooming a chart, 9.2) is reported through `onChange` so a board can show "paused".
- [ ] Prerequisite: `DateTimePicker` (TODO M4 in `DateRangePicker.tsx`). KUInative already ships a `DateTimePicker`; port its behaviour and prop names so the two stay aligned rather than inventing a second API.
- [ ] Exception record: new component, absent in kui-ejs and KUInative.

Seen in: `/theme/iot/devices/[slug]/telemetry` and the board time window on `/theme/iot` (IoT phases 02 and 07). Also the shape next-boilerplate's generic "board-wide time window" (`docs/phases/07-dashboard`) should vendor.

## 9.8 MapView: live markers, clustering, `onTelemetry` `[both]` `+native`

The M2/M5 TODOs in `MapView/types.ts` (`activeMarkerId`, `cluster`, `onTelemetry`) exist identically in all three repos.

- [ ] Markers are diffed by `id`: changing a marker's `position`, `variant` or `tooltip` updates that Leaflet marker in place (no full layer rebuild); `animateMoves?: boolean` tweens position changes (off under reduced motion).
- [ ] `activeMarkerId` (scale + ring) and custom `icon` per marker (TODO M2 in `parts/Marker.tsx`).
- [ ] `cluster?: boolean | { radius?: number; maxZoom?: number }` using `supercluster` (ISC; kui-ejs `scripts/cluster.js` already names it). A cluster bubble shows the count and takes the **worst** variant of its members (error > warning > info > success > neutral), so a red device is never hidden inside a green cluster. Clicking a cluster zooms to its bounds.
- [ ] `onTelemetry` becomes a subscription prop: `subscribe?: (apply: (patches: MapMarkerPatch[]) => void) => () => void`, where `MapMarkerPatch = { id } & Partial<Omit<MapMarker, 'id'>>`. Patches are applied in one batch per animation frame. Fed by 9.11 in practice.
- [ ] Fix while there: the hard-coded Turkish loading text `Harita yükleniyor…` in `MapView/index.tsx` becomes `messages.loading` (default "Loading map…"); `VARIANT_HEX`/`VARIANT_FILL` resolve the CSS variables at draw time instead of fixed hex (KUInative's `resolveColor` is the precedent), so dark mode and brand themes recolour markers.
- [ ] kui-ejs: `scripts/cluster.js` and `scripts/markers.js` implement the same diffing and cluster rules; `MapView.ejs` gains `cluster` and `activeMarkerId` locals; a `kui:map:patch` `CustomEvent` on the map element is the EJS equivalent of `subscribe`.
- [ ] KUInative: `MapView/index.web.tsx` and the native `index.tsx` get the same props (`react-native-maps` clustering on native, `supercluster` on web).

Seen in: `/theme/iot` map widget and `/theme/iot/assets` site map (IoT phases 07 and 08).

## 9.9 `KeyValueEditor` `[react]`

A new molecule in `modules/ui/KeyValueEditor.tsx` for editable attribute sets, headers, metadata, RPC parameters.

- [ ] Rows of `{ key, type: 'string' | 'number' | 'boolean' | 'json', value }`; add, remove, reorder; typed value input per type (`Input`, number input, `Toggle`, a JSON `CodeEditor` in a popover).
- [ ] Validation: unique keys, optional `keyPattern`, optional `reservedKeys`; errors inline and summarised for screen readers.
- [ ] `readOnly` rows (per row or whole editor), `original?` value map to highlight added/changed/removed rows, and `onChange(nextMap, diff)` so a consumer can send only the diff.
- [ ] "Paste JSON" to bulk-replace and "Copy as JSON".
- [ ] Optional per-row meta slot (for example "last updated 2 min ago").
- [ ] Prior art to read first: next-boilerplate `modules/common/ui/json-object-editor.component.tsx`. If it already solves part of this, upstream its behaviour here so next-boilerplate can vendor this component back instead of keeping two.
- [x] Exception record (`parity.exceptions.json`, provisional format): absent in kui-ejs and KUInative.

Seen in: `/theme/iot/devices/[slug]?tab=attributes` (IoT phase 01).

## 9.10 `SchemaForm` `[react]`

> **Status 2026-10-06 (react side):** `modules/app/SchemaForm/` is built and tested (19 tests) and is now the source of truth for `FieldSchema`: `types.ts` (`FieldSchema`, `FieldType`, `shouldShow`, framework-neutral, no imports) and `zod-from-schema.ts` moved from next-boilerplate unchanged except a header and `date` validated as a string. Added: `SchemaForm`, `FieldControl`, `fieldOverrides` (prop or `SchemaFormProvider`), `validateSchemaValues`, `fromJsonSchema`, `fromFormBuilder`, showcase entry `schema-form` (4 variants), `parity.exceptions.json` record, registry snapshot. Not done: `fromParamSpec` and `fromBlocksField` (deliberately, see below), react-hook-form wiring (the Zod schema is resolver-compatible but no `useForm` binding or demo is shipped), the NB side (vendor `types.ts` + `zod-from-schema.ts` to `modules/common/ui/kui/schema-form/`, delete NB's copy, keep its app-bound fields as `fieldOverrides`, migration note in NB's schema-form README), NB's responsive (`responsive`, breakpoint tabs) and upload behaviour (not upstreamed: app-specific), and the `FieldType` list still carries NB's app-bound names (media, remote-select, symbol, color-token, img, icon, link, background, rich-text) so NB stays type-compatible; kui-react renders none of them except as a degraded text/JSON input unless an override is registered.

kui-react has three form vocabularies and no generic schema-driven renderer:

1. `modules/app/FormBuilder` (`FormSchema`/`Field`): a survey builder with its own renderer.
2. `modules/app/RulesetEditor/catalog/params.ts` (`ParamSpec`, `when`): the block parameter schema of the RulesetEditor upgrade that is **in progress in a separate session**. Do not touch it here.
3. next-boilerplate already ships `modules/common/ui/schema-form/` (`FieldSchema`, `showIf`, `group`, `zod-from-schema.ts`), extracted from `dynamic_page` and used by its page builder, module settings and dashboard widgets. It is not in kui-react, so the design source of truth is behind the app.

- [x] Build `modules/app/SchemaForm/` in kui-react on the **next-boilerplate `FieldSchema` vocabulary** (~~recommended;~~ **→ DECISION OD-16 (owner, 2026-10-04):** decided; three live consumers use it). Upstream the field set that is not app-specific: text, url, textarea, number, boolean, select, multi-select, json, color, date, datetime, repeater, group, `showIf`. App-bound fields (media library, remote-select, symbol, color-token) stay as an injectable `fieldOverrides` registry so next-boilerplate plugs its own back in.
- [~] `zodFromSchema(schema)` for validation (done, plus `validateSchemaValues` which adds `required` and skips `showIf`-hidden fields); the react-hook-form + Zod wiring per phase 6.3 is not done: `SchemaForm` keeps its own debounced local state and takes `errors` as a prop.
- [~] Adapters, each a pure function with tests (`fromJsonSchema` and `fromFormBuilder` done in `modules/app/SchemaForm/adapters/`; `fromParamSpec` still open): `fromJsonSchema(subset)` (type/enum/min/max/required/default/description, for device-profile and RPC parameter schemas), `fromFormBuilder(FormSchema)`. A `fromParamSpec` adapter is added **after** the RulesetEditor session lands, coordinated with it, so the rule editor can render its block forms with this component if that session wants to. (**→ OD-79:** the RulesetEditor ships in the NB MVP, so "after it lands" is still inside the MVP; ask that session early whether it uses `SchemaForm`.)
- [ ] Exception record: absent in kui-ejs (kui-ejs reverted `FormBuilder` deliberately; do not add a schema form there without a scope decision) and KUInative.
- [ ] ~~Open decision (owner): confirm `FieldSchema` as the one schema-form vocabulary across kui-react and next-boilerplate.~~ **→ DECISION OD-16 (owner, 2026-10-04):** `FieldSchema` is the single form-schema vocabulary; it **moves** from NB `modules/common/ui/schema-form/` into kui-react (kui-react becomes its source of truth) and OpenWrt `blocks.d` field types map onto it.
- [~] (OD-16) Move, not copy (kui-react half done; NB half open, it must vendor the files listed in the status line and delete its copy): the `FieldSchema` type, `showIf`/`group` semantics and `zod-from-schema.ts` land in kui-react `modules/app/SchemaForm/` with their tests; NB then vendors them back (the `modules/common/ui/kui/` precedent) and deletes its own copy, keeping only its app-bound `fieldOverrides` (media library, remote-select, symbol, color-token). A short migration note in NB's schema-form README points to kui-react.
- [ ] (OD-16) `blocks.d` mapping: a documented table and a pure `fromBlocksField(field)` adapter (with tests) from the OpenWrt automation block field types (`roltek-openwrt-dev` `feed/roltek-automation/files/usr/share/roltek/automation/blocks.d/*.json`) onto `FieldSchema`: `string` → text, `number` → number, `bool` → boolean, `enum` → select, `list` → repeater or multi-select, `json` → json, `secret` → text with `secret: true` (masked), `time` → time/datetime, `duration` → number + unit (or a `duration` field type, added to `FieldSchema` if NB agrees), `hex`/`ip`/`mac`/`cron`/`topic` → text with a `pattern`, `code`/`expr`/`template` → code/textarea; editor-specific types (`source`, `path`, `value`, `rules`) go through `fieldOverrides`. The exact field-type list is re-read from `blocks.d` when the task starts; the RulesetEditor session (which owns `ParamSpec`) is consulted, and `fromParamSpec` and `fromBlocksField` share one mapping table.
- [ ] (OD-16) Consumers named in the IoT plan use only this vocabulary: device-profile settings (IoT 01 §1.4), RPC parameter forms (IoT 04 §4.1), dashboard widget settings (IoT 07).

Seen in: `/theme/iot/device-profiles/[slug]` and the RPC console parameter form (IoT phases 01 and 04); widget settings in phase 07.

## 9.11 Data hooks: `useResource` and `useLiveData` `[react]`

The live part of every realtime screen, written once and transport-agnostic, in `libs/live/` (hooks in `libs/hooks/`).

- [ ] `LiveSource<T>` interface: `subscribe(topics: string[], onBatch: (batch: Map<string, T>) => void): () => void` plus an observable `state: 'connecting' | 'open' | 'reconnecting' | 'closed'`. The interface knows nothing about Socket.IO, native WebSocket, SSE or polling; the host app implements it.
- [ ] Shared, ref-counted subscriptions: two components asking for the same topic cause one upstream subscription; the last unmount unsubscribes.
- [ ] Coalescing: last value per topic wins, flushed at most `maxHz` times per second (default 10) on `requestAnimationFrame`. These are the same semantics as kui-viewer's `TelemetryThrottle` (`modules/iot/telemetry-throttle.ts`), so one host socket can feed kui-react widgets and the 3D viewer with identical behaviour.
- [ ] `useLiveData(source, topics, { maxHz, staleAfterMs, paused })` returns `{ values, state, lastUpdate, isStale(topic) }`; pauses while `document.hidden` and resumes with a resync callback.
- [ ] `useResource(load, deps)` for request/response data: `{ data, error, loading, refresh, mutate }`, abort on unmount or deps change, optimistic `mutate(next, commit)` with rollback on error. No new dependency (no SWR/TanStack); keep it small and documented as replaceable.
- [ ] `createMockLiveSource({ topics, generator, intervalMs, seed })`: deterministic random-walk feed for demos and tests (the kui-viewer `mock-telemetry-source.ts` precedent).
- [ ] Tests with fake timers: coalescing, ref counting, staleness, pause/resume, abort.
- [ ] KUInative: the hooks have no DOM dependency except `document.hidden`/`requestAnimationFrame`; not copied until a KUInative screen needs them (exception record), then copied with `AppState` replacing `document.hidden`.

Seen in: every live element of `/theme/iot` (IoT phase 00 defines the IoT topics on top of this).

## 9.12 `StatusIndicator` and `Badge` `pulse` `[react]` / `[both]` `+native`

- [ ] `[both]` `+native`: `Badge` gains `pulse?: boolean` (animated ring on the dot, disabled under reduced motion). `Badge` exists in all three repos, so all three get it.
- [ ] `[react]`: new `modules/ui/StatusIndicator.tsx`: `status: 'ok' | 'warning' | 'alarm' | 'offline' | 'unknown'`, `label?`, `since?: Date` (relative time, refreshed by a shared ticker), `staleAfterMs?` + `lastUpdate?` (switches to a "stale" look when exceeded), `size`, `variant: 'dot' | 'badge' | 'inline'`, `announce?: boolean` (polite live region on change). Status tones map to the existing tokens; the status names line up with kui-viewer's `SensorStatus` (`ok`/`warn`/`alarm`/`off`) through a documented mapping.
- [ ] Exception record for `StatusIndicator`: absent in kui-ejs and KUInative.

Seen in: device rows, latest-value tables, the state widget (IoT phases 01, 02, 07).

## 9.13 QR scanner and QR code `[react]`

- [ ] `modules/ui/QrScanner.tsx`: camera preview, `BarcodeDetector` when the browser has it, lazy-loaded decoder fallback otherwise (MIT/ISC licence only; check before adding), permission states (prompt, denied with instructions, no camera), torch toggle when supported, manual code entry fallback, `onResult(text)`. Lazy-loaded through `modules/ui/lazy.tsx`.
- [ ] `modules/ui/QrCode.tsx`: real encoder (for example `qrcode-generator`, MIT), token colours, `size`, `level`, accessible label with the encoded text. Note: `modules/domains/event/TicketCard.tsx` draws a fake `QRPattern`; switching it is a follow-up for the event vertical, not part of this task.
- [ ] Exception records: absent in kui-ejs and KUInative.
- [ ] (OD-82) PWA standalone mode: `QrScanner` works when the host app runs as an installed PWA (`display-mode: standalone`) on Android Chrome and iOS Safari: rear camera by default, the permission states re-checked on every open (iOS standalone apps may ask again per session), a "denied" state whose instructions name the installed app rather than the browser tab, and the camera stream stopped when the app goes to the background (`visibilitychange`). Proven on real phones through a host page served over HTTPS; the kui-react demo itself ships no manifest or service worker.

Seen in: `/theme/iot/claim` ~~and claim-label printing in `/theme/iot/provisioning`~~ (IoT phase 05).

> **→ DECISION OD-6 (owner, 2026-10-04):** no printed claim labels; the claim QR is shown on the device's own panel. `QrScanner` is the IoT consumer; `QrCode` stays a generic component (IoT 05 uses it only for a demo stand-in of the device panel's QR, plus the `TicketCard` follow-up above), so it no longer has a label-printing use case.

## 9.14 CSV export `[react]` / `[both]` `+native`

- [ ] `[react]`: `libs/utils/csv.ts`: RFC 4180 writer (quoting, embedded newlines, `\r\n`, optional BOM for spreadsheet apps), streaming-friendly `toCsvRows(iterable)`, and `downloadBlob(name, blob)`. Unit-tested.
- [ ] `[both]` `+native`: `DataTable` gets `exportable?: boolean | { filename, columns }`: a toolbar action exporting the current filtered rows. kui-ejs: same toolbar DOM, client script builds the CSV. KUInative: same prop on `Table`, delivered through the share sheet instead of a download.
- [ ] Large exports are not this component's job: a consumer with server-side data passes `onExport` and returns a URL (next-boilerplate's generic short-lived signed download URLs).

Seen in: telemetry raw-data export and device list export (IoT phases 01 and 02).

## 9.15 Typed confirmation on a confirm `Modal` `[react]` (proposed 2026-10-04)

Added for the owner decisions OD-24 (release a device) and OD-1 (revoke a provisioning key), which ask for a typed confirmation. kui-react has `Popconfirm` and `Modal` but no typed-confirmation pattern, so it is built here as a generic option, not an IoT one-off.

- [ ] A confirm variant of `Modal` with `requireText?: string` (and `requireTextLabel`): the confirm button stays disabled until the input matches exactly (trimmed, case-sensitive by default); Enter confirms only when it matches; the mismatch hint is announced politely.
- [ ] Exception record: absent in kui-ejs and KUInative (not created there unless a screen needs it).

Seen in: IoT 05 §5.4 `ReleaseDeviceDialog` and IoT 01 §1.4 key revocation.

## 9.16 Async controls: pending state and commit-on-release `[both]` `+native` (OD-80)

> **Status 2026-10-06 (react side):** `Toggle` `pending` / `mismatch` / `describedBy`, `RangeSlider` `onCommit` / `pending` / `commitIdleMs`, `libs/hooks/useAsyncControl.ts` and `modules/ui/ControlTile/` (`ControlTile` frame plus `ControlButton`, `ControlSwitch`, `ControlSlider`, `ControlSetpoint`) are built and tested, with showcase variants. kui-ejs / KUInative `Toggle` and `RangeSlider` mirrors are open. 9.10 `SchemaForm` / `FieldSchema` landed 2026-10-06 (see its section).

Added for the owner decision OD-80 (control widgets in the IoT MVP, IoT 07 §7.3). A control that writes to something slow (a device, a remote service, a setting saved on a server) needs the same states in every domain: idle → pending → confirmed, or failed with the previous value restored, and sometimes "the other side reports a different value". kui-react has the controls (`Button` with `loading`, `Toggle`, `RangeSlider`, number `Input` with steppers, `Popconfirm`) but no pending state on `Toggle`, no commit-on-release on `RangeSlider` and no shared logic for an asynchronous write. A **generic "action widget" fits**: the state machine is generic (smart home, ops toggles, feature flags), only the target is IoT. Checked on 2026-10-04: `Toggle` and `RangeSlider` exist in kui-react, kui-ejs (`Toggle.ejs`, `RangeSlider.ejs`) and KUInative (`Toggle.tsx`, `RangeSlider.tsx`), none of them with a pending state or a commit event.

- [ ] `[both]` `+native`: `Toggle` gains `pending?: boolean` (thumb shows a small spinner, `aria-busy`, input disabled while pending, no layout shift) and `mismatch?: boolean` (warning ring + `aria-describedby` hint text from the consumer). kui-ejs `Toggle.ejs` gets the same locals and DOM; KUInative `Toggle.tsx` the same props (`accessibilityState.busy`).
- [ ] `[both]` `+native`: `RangeSlider` (single mode) gains `onCommit?: (value) => void`, fired once on pointer up, on keyboard change after a short idle (default 400 ms) and on blur, plus `pending?: boolean`; `onChange` keeps firing while dragging for the live label. kui-ejs: a `kui:range:commit` `CustomEvent`; KUInative: fired from the gesture end.
- [ ] `[react]`: `useAsyncControl({ value, reported?, commit, timeoutMs?, confirm? })` in `libs/hooks/`: returns `{ displayValue, state: 'idle' | 'pending' | 'confirmed' | 'mismatch' | 'failed', set(next), retry() }`; optimistic display with rollback on a rejected `commit`, "pending" until `reported` equals the desired value or `timeoutMs` passes (then `mismatch`), and an optional confirmation step the consumer renders with `Popconfirm`. Pure state machine, unit-tested with fake timers; no transport knowledge (pairs with 9.11).
- [ ] `[react]`: `ControlTile` molecule (the generic action widget): label, the control slot (`Button`, `Toggle`, `RangeSlider` or a number `Input` + "Apply"), the reported value line, a `StatusIndicator` (9.12) for the `useAsyncControl` state, and a read-only mode. Exception record: absent in kui-ejs and KUInative (not created there until a screen needs it).
- [ ] Showcase: `Toggle` and `RangeSlider` pending/commit variants; `ControlTile` with idle, pending, confirmed, mismatch, failed and read-only variants driven by a mock async commit.

Seen in: IoT 07 §7.3 control widgets (`iot.button`, `iot.switch`, `iot.slider`, `iot.setpoint`) on `/theme/iot/dashboards/[slug]`.

## 9.17 `EntityAliases` (dashboard entity aliases) `[react]` (2026-10-24)

> **Status 2026-10-24 (react side):** built on branch `feat/entity-aliases` for next-boilerplate dashboard phase 36.4
> (owner decision 2026-10-24: dashboards get ThingsBoard's entity aliases; design in NB
> `docs/phases/07-dashboard/36-entity-aliases-and-filters.md`). Tests written, not run yet.

- [~] `modules/app/EntityAliases/`: `EntityAliasesDialog`, `EntityAliasDialog` (preview, "no entity matched"),
  `EntityFilterForm` (eight filter types, relation types only with a relation provider), `entityFilterText`,
  `AliasEntitySelect`, `EntityAliasPicker`; `validateAlias` / `slugKey` mirror the server caps; the data contract in
  `types.ts` is shared verbatim with the NB server. Showcase entry `entity-aliases` (4 variants), `parity.exceptions.json`
  record `entity-aliases`, README in the folder.
- [ ] Run the kit's tests (`modules/app/EntityAliases/*.test.ts(x)`) and `npm run registry:snapshot`, then merge.
- [ ] NB vendors the folder (36.4) and wires it (36.5): board settings, a placement's data tab, the toolbar, the preview route.
- [ ] Key filters editor (NB 36.7), kui-react first, in this folder.
- [ ] Sibling mirrors of `AliasEntitySelect` only when a kui-ejs or KUInative board viewer needs it (NB 36.9).

## Order

9.11 first (everything live builds on it), then 9.1 and 9.12 (the telemetry explorer and device list need them), then 9.2, 9.7, 9.3, 9.8, 9.9, 9.10, then the rest. ~~9.10 waits for the owner's vocabulary decision;~~ (decided, OD-16) 9.10's `fromParamSpec` adapter waits for the RulesetEditor session. **→ OD-80:** 9.16 lands before IoT 07's control widgets (after 9.11 and 9.12, which it builds on).

## Definition of done

- No chart in `modules/ui/Chart/charts/` that the IoT plan uses returns `null`: `GaugeChart` and `HeatmapChart` render in all three repos; `Brush` renders in kui-react and kui-ejs.
- `LineChart` with `xScale: 'time'` plots 10 000 uneven points with LTTB down-sampling and zooms through the brush without a layout jump.
- `MapView` with 2 000 markers and `cluster` pans smoothly; a patch to one marker's variant re-colours it without rebuilding the layer; a cluster containing an `error` marker is red.
- `useLiveData` tests prove one upstream subscription per topic and at most 10 store flushes per second.
- Every new component has a showcase entry and a registry snapshot entry; every `[react]` item has a `parity.exceptions.json` line (or, before phase 4.4 exists, a line in the PR description).
- No hard-coded Turkish strings or hex colours remain in `MapView`.
- (OD-15) No chart the IoT plan uses depends on chart.js; time axis, zoom, gauge and heatmap are the native SVG `Chart` in kui-react with their kui-ejs/KUInative mirrors (or recorded exceptions).
- (OD-16) `FieldSchema` lives in kui-react `modules/app/SchemaForm/`; `fromBlocksField` maps every field type found in `blocks.d` (or routes it to `fieldOverrides`) with a test per type.
- (OD-80) `Toggle` shows a pending state and `RangeSlider` fires exactly one `onCommit` per drag in kui-react, kui-ejs and KUInative; `useAsyncControl` tests cover rollback on failure, pending → confirmed on a matching reported value and pending → mismatch on timeout.
- (OD-82) `QrScanner` reads a QR code inside an installed PWA on an Android phone and an iPhone, and recovers from a denied permission with the installed-app instructions.
