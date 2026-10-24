# IoT 07: Dashboard widgets

**Goal:** IoT-bound widget bodies that NB's dashboard platform can host: alarm table, device table, gauge, map, state, time series and latest values, each reading from the adapter and the live source, each with a declared settings schema. The demo dashboard home is rebuilt from them.
**→ DECISION OD-80 (owner, 2026-10-04):** the MVP widget set is time series, gauge, latest value; map, device and alarm tables; and **control widgets** (button, switch, slider, set-point → RPC / shared attributes). **No SCADA** (no mimic diagrams, no free-drawn process graphics, no symbol libraries). Control widgets are §7.3.
**Effort:** M–L.
**Depends on:** 00, 01 (key specs), 02 (chart and latest values), 03 (alarm list); 9.3 (`GaugeChart`), 9.7 (`TimeRangePicker`), 9.8 (live `MapView`), 9.10 (`SchemaForm` vocabulary), 9.11, 9.12. (OD-80) 01 §1.5 (shared attributes, desired vs reported), 04 (`rpc.send`, declared methods), 9.16 (async control states).
**Demo routes:** `/theme/iot` (dashboard home rebuilt from widgets) · `/theme/iot/dashboards/[slug]` (two seeded boards, for example "Press line" and "Fleet map").
**NB consumer:** `docs/new-iot-platform/dashboard/` (IoT-only widget contributions). The generic gauge, map and state widgets and the board-wide time window belong to NB `phases/dashboard/` and vendor the phase 9 components directly; this phase only adds the IoT binding.

## Boundary with NB's dashboard

kui-react does **not** build a grid, a layout editor or a widget registry: NB's `dashboard` module owns layout, persistence, permissions and the settings drawer (which already renders widget settings with `SchemaForm`). Each widget here is a body component plus a descriptor NB can register:

```ts
type IotWidgetDescriptor<C> = {
  id: string;                 // 'iot.gauge', 'iot.alarm-table', …
  title: string;
  settingsSchema: Record<string, FieldSchema>; // 9.10 vocabulary
  defaultSettings: C;
  Body: (props: { settings: C; timeWindow: TimeWindow; size: { w: number; h: number } }) => JSX.Element;
};
```

The adapter and live source come from `IotAdapterProvider` (phase 00), the time window from the board (9.7).

> **→ DECISION OD-16 (owner, 2026-10-04):** `settingsSchema` uses `FieldSchema`, the single form-schema vocabulary that moves from NB `common/ui/schema-form` into kui-react (9.10). NB's settings drawer and the demo drawer render the same schema; no widget defines its own settings format.
>
> **→ DECISION OD-15 (owner, 2026-10-04):** every chart-bearing widget (`iot.gauge`, `iot.timeseries`, a heatmap) draws with the kui-react **native SVG `Chart`** (9.1–9.4), at parity with kui-ejs/KUInative; not chart.js. Migration note for NB: any NB `dashboard` data widget planned or built on chart.js moves to the vendored native `Chart` (NB `docs/new-iot-platform/dashboard/` and `phases/dashboard/` own that note; this phase only guarantees the IoT widgets need no chart.js).

## 7.1 Widgets

- [~] `iot.alarm-table`: compact alarm list (severity, title, device, age) with status/severity filters in settings and inline acknowledge; live.
- [~] `iot.device-table`: devices by profile/tag/asset with connectivity `StatusIndicator`, chosen latest-value columns (keys from the profile), click → device detail; live.
- [ ] `iot.gauge`: `GaugeChart` (9.3) for one device key; min/max/bands default from the profile's key spec and alarm rules, overridable in settings; stale state from 9.11.
- [ ] `iot.map`: `MapView` (9.8) of devices or assets with a location; marker variant from connectivity and worst open alarm; clustering on; live patches through `subscribe`; click → device.
- [ ] `iot.state`: one or many `StatusIndicator`s (9.12) for connectivity, an attribute (for example relay on/off) or a key compared against a threshold; layout as a grid of tiles.
- [ ] `iot.timeseries`: the phase 02 `TelemetryHistoryChart` in compact mode, following the board time window, live when the board is live.
- [ ] `iot.latest-values`: the phase 02 `LatestValuesTable` in compact mode.
- [ ] ~~Could: `iot.rpc-button` / `iot.switch` (sends a declared RPC from phase 04 with confirmation) for control panels.~~ (OD-8: never a factory reset.) **→ DECISION OD-80 (owner, 2026-10-04):** control widgets are **MVP**, not Could; they are specified in §7.3.
- [x] (OD-9) `iot.alarm-table` severity filter and colouring use the five levels from `alarm-severity.ts` (phase 03); the map widget's "worst open alarm" uses the same order.
- [ ] (OD-15) No widget imports chart.js; the showcase entries prove `iot.gauge` and `iot.timeseries` on the native chart.
- [ ] **→ DECISION OD-31 / OD-32 (owner, 2026-10-04):** widgets read the NB views, not raw rows: `iot.timeseries` follows the phase 02 resolution ladder (a board window over 24 h reads `iot_ts_1m`/`1h`/`1d`, never raw); `iot.latest-values` and `iot.gauge` read latest values (`iot_latest`); `iot.device-table`, `iot.state` and `iot.map` read `iot_device_status`; `iot.alarm-table` reads `iot_open_alarms`. Each widget makes at most one query per refresh (no per-device fan-out); the dashboard query target is p95 < 300 ms, so a widget whose settings would need raw rows over more than 24 h shows a settings validation error instead of querying.
- [ ] (OD-25) `iot.latest-values` and `iot.timeseries` settings can filter by `metadata.topic` (live values always; ~~history only when `telemetryTopicStored`, phase 02~~ **→ DECISION OD-34 (owner, 2026-10-04):** never on history — the topic is not stored; the setting is labelled "live only", phase 02).
- [ ] (OD-87) Key pickers in widget settings (`iot.timeseries`, `iot.gauge`, `iot.latest-values`, `iot.device-table` columns) list the keys from `telemetry.keys` (saved by a flow, phase 02); a key that is only live shows in `iot.latest-values` with the phase 02 "live only" tag, and `iot.timeseries` refuses it with a settings validation error ("not saved by any flow, so it has no history").

## 7.2 Demo boards

- [ ] `/theme/iot` keeps today's look (stat cards, recent devices, open alarms, fleet status) but every block is a widget body in a static CSS grid, so the page demonstrates the widgets without a layout engine.
- [ ] `/theme/iot/dashboards/[slug]`: two seeded boards with a board-level `TimeRangePicker` and live toggle; a "settings" button per widget opens a `Drawer` with its `SchemaForm`, so the settings schema is proven in the demo the same way NB will render it.

## 7.3 Control widgets (OD-80)

**→ DECISION OD-80 (owner, 2026-10-04):** button, switch, slider and set-point widgets are in the MVP and act through **RPC** (phase 04) or **shared attributes** (01 §1.5). They are thin IoT bindings over the generic async-control pieces of [phase 9.16](../dev/phase-9-data-and-realtime-components.md#916-async-controls-pending-state-and-commit-on-release-both-native-od-80): a generic "action widget" fits (label, control, pending/confirmed/failed state, optional confirmation), so the state machine is built once there and the IoT layer adds only the target (device, method or attribute key) and the reported-value source. No SCADA.

- [ ] One target model for all four, in `settingsSchema` (`FieldSchema`, OD-16): `target: { kind: 'rpc', deviceId, method, params?, oneway, timeoutMs } | { kind: 'sharedAttribute', deviceId, key }`, plus `confirm?: { text }`, `reportedKey?` (a client attribute or telemetry key whose value shows the device's actual state) and `label`. RPC methods come from `rpc.methods(deviceId)` (declared methods only; no free text in a widget); attribute keys from the device's shared attributes.
- [ ] `iot.button`: one press sends the configured RPC (or writes a fixed attribute value); pending spinner on the button, result toast, error with retry; `Popconfirm` when `confirm` is set (the default for methods the profile flags as destructive, e.g. `reboot`; OD-8: never a factory reset).
- [ ] `iot.switch`: on/off bound to a boolean shared attribute or to an RPC pair (`setOn`/`setOff` or one method with `{ value }`); shows **desired vs reported** (the 01 §1.5 sync `StatusIndicator`: in sync / pending / device reported a different value) and stays "pending" until the reported value matches or the timeout passes.
- [ ] `iot.slider`: numeric value with min/max/step from the profile's key spec (01 `TelemetryKeySpec`), overridable in settings; sends **once on release** (9.16 `onCommit`), never on every drag step; desired vs reported as for the switch.
- [ ] `iot.setpoint`: number input with unit and "Apply" (or Enter), min/max/precision from the key spec, the current reported value beside it, desired vs reported state; out-of-range input is a field error, not a request.
- [ ] Permissions and safety: every control respects `canSendRpc` (RPC targets) and a new `canWriteSharedAttributes` capability (attribute targets); without it the widget renders read-only with the reported value. A control whose device is offline shows "device offline" and, for RPC, sends only when the target is `persistent` (phase 04).
- [ ] (OD-85) A device on the ThingsBoard compatible scheme cannot be an RPC target: the settings drawer disables RPC targets for it with the phase 04 reason; shared-attribute targets work.
- [ ] Every control action is traceable: RPC targets appear in the phase 04 request list with "sent by: dashboard / widget"; attribute writes appear in the device Events tab.
- [ ] Demo: the "Press line" board gets a pump switch (shared attribute with reported state), a speed slider, a temperature set-point and a "Reset counter" button with confirmation; the mock live source reports the new value after a short delay, and one seeded device never confirms so the timeout/mismatch state is visible.

## Showcase

One Domain entry per widget (data, empty and stale variants) and an `IotWidgetDescriptor` usage note in the IoT section. (OD-80) The control widgets add pending, confirmed, mismatch/timeout and read-only (no permission) variants.

## Definition of done

- Every widget renders from the demo adapter, updates live, and reconfigures from its settings drawer.
- Changing the board time window updates every time-aware widget at once; zooming one chart pauses live for that widget only.
- NB can register a widget by importing its descriptor, with no kui-react code that knows about NB's dashboard.
- (OD-16) Every descriptor's `settingsSchema` validates against the kui-react `FieldSchema` type and renders in the 9.10 `SchemaForm`.
- (OD-15) The rebuilt `/theme/iot` home and both seeded boards load no chart.js code.
- (OD-80) On the "Press line" board: flip the pump switch and see pending → in sync when the mock device reports; drag the slider and see exactly one request on release (demo adapter call log); apply an out-of-range set-point and get a field error with no request; the confirmation button asks before sending; the never-confirming device shows the mismatch/timeout state; without `canSendRpc` the RPC controls are read-only. No SCADA-style widget exists.
- (OD-82) Every widget, including the controls, is usable at a 360 px phone width.

## 2026-10-24 — as built

> Built on branch `feat/iot-p2-screens`: the two table bodies only. **ED** = engineering decision (owner delegated, owner may veto).

- `AlarmTable` (`modules/domains/iot/alarm/`): rows in, viewer-side severity chips (five levels, no re-query), status pills,
  relative times, row cap, keyboard row focus, optional row action, rows that leave "not resolved" fade for `fadeOutMs` (5 s) then go.
- `DeviceTable` (`modules/domains/iot/device/`): online dot with last seen and a stale threshold computed from `lastSeenAt`,
  telemetry key columns (unit, decimals) merged by id, row click.
- **ED-K15 Bodies without a descriptor.** NB's dashboard already owns the descriptor (its `dashboard:widget` contribution with
  `dataSpec`, schema and action sources), so the bodies take rows and callbacks and know nothing of a board; `IotWidgetDescriptor`
  stays for the widgets that need the adapter (gauge, map, …).

**Left.** Every other widget of §7.1, the descriptors, §7.2 demo boards and §7.3 control widgets.
