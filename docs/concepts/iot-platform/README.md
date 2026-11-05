# IoT plan (docs/concepts/iot-platform)

Phased plan for the **IoT-only** UI of the IoT platform that next-boilerplate (NB) is building (NB plan index: `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-platform/README.md`). kui-react is the design source of truth: every IoT screen is built here first, shown in the IoT demo at `/theme/iot`, then vendored into NB (the `modules/common/ui/kui/` precedent).

Written 2026-10-04. English only.

## Where things are planned

The NB split rule (2026-10-04) decides it:

| Kind of work | Planned in |
|---|---|
| Generic UI component (any product could use it) | [`docs/phases/09-data-and-realtime-components.md`](../dev/phase-9-data-and-realtime-components.md), referenced below as `9.N` |
| IoT-only UI component or screen | **this folder** |
| 3D / digital-twin viewer capabilities | kui-viewer `docs/phases/28-iot-platform-integration.md` |
| Backend, storage, transport, rules | NB `docs/new-iot-platform/<module>/` |

**Not in this plan:** the RulesetEditor (typed blocks, schema forms, groups, flows that run each other, undo, `roltek-automation-1` format) is being upgraded **in a separate session**. Nothing here touches `modules/app/RulesetEditor/**`, `app/theme/iot/rulesets/**` or the rule-engine types in `modules/domains/iot/types.ts` (`RuleNode*`, `RuleEdge*`, `RuleChain*`). Where a phase needs the editor it says "RulesetEditor (in progress, separate session)".

**→ DECISION OD-79 (owner, 2026-10-04):** the cloud rule engine is **in the NB MVP**: the kui-react RulesetEditor (typed blocks, format `roltek-automation-1`) is vendored into NB **within the MVP** and is the editor of NB's new module `iot_automation` (cloud executor; NB plan: `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-automation/README.md`), with the full set of cloud-runnable blocks and no hard-coded automatic actions (supersedes OD-29 / NB P6). The editor code still belongs to the separate RulesetEditor session; what this plan needs from it is listed in [Cloud rule engine in the MVP](#cloud-rule-engine-in-the-mvp-od-79-od-87-od-88) below.

## Order

| # | File | Goal | Demo route(s) under `/theme/iot` | NB consumer (`docs/new-iot-platform/…`) | Needs | Status |
|---|---|---|---|---|---|---|
| 00 | [00-api-adapter-layer.md](phases/00-api-adapter-layer.md) | Typed adapter contract + demo adapter replacing direct `iot.data.ts` imports; page bodies move into vendorable views; demo gaps fixed | every existing route, new `/settings`, `/workspaces/[slug]` | all `iot_*` modules | 9.11 | [~] built 2026-10-24 (P2) |
| 01 | [01-device-management.md](phases/01-device-management.md) | Bound device list and detail, credentials panel, device profile editor, attributes editor | `/devices`, `/devices/[slug]`, ~~`/device-profiles`, `/device-profiles/[slug]`~~ `/profiles`, `/profiles/[slug]` | `iot_device`, `iot_device_profile`, `iot_pki` | 00, 9.9, 9.10, 9.12, 9.14 | [~] built 2026-10-24 (P2; profile screens slice 6b) |
| 02 | [02-telemetry-explorer.md](phases/02-telemetry-explorer.md) | Latest values, history chart with real time axis and zoom, raw data, CSV export | `/devices/[slug]/telemetry` | `iot_telemetry`, `websocket` | 00, 9.1, 9.2, 9.4, 9.5, 9.7, 9.14 | ⬜ |
| 03 | [03-alarms.md](phases/03-alarms.md) | Alert → Alarm rename (OD-9), five severities, real acknowledge/clear flows, alarm list filters, live alarm badge, CRITICAL-bypass setting (OD-10) | ~~`/alerts`, `/alerts/[id]`~~ `/alarms`, `/alarms/[id]` (`/alerts/**` redirects for one release), `/devices/[slug]?tab=alarms` | `iot_alarm`, `notification` | 00, 9.6, 9.7 | [~] built 2026-10-24 (P2) |
| 04 | [04-rpc-console.md](phases/04-rpc-console.md) | Send one-way/two-way RPC, track persistent RPC state, history | `/devices/[slug]?tab=rpc`, `/rpc` | `iot_rpc` | 00, 01, 9.10 | [~] built 2026-10-24 (P2) |
| 05 | [05-provisioning-and-claim.md](phases/05-provisioning-and-claim.md) | QR scan/claim screen (QR read from the device's own panel, OD-6), factory pool view, bulk import, ~~claim labels~~ provisioning-key display, release action and quarantine badge (OD-1, OD-24) ; camera QR claim in the PWA (OD-82) | `/claim`, `/provisioning`, `/provisioning/import` | `iot_provisioning`, `data_import` | 00, 01, 9.13 (08 for the site picker) | ⬜ |
| 06 | [06-ota.md](phases/06-ota.md) | Firmware list and upload, assignment, rollout progress, `fw_allow_metered` toggle and device-approval state (OD-7, OD-13) | `/firmware`, `/firmware/[id]`, `/firmware/rollouts/[id]` | `iot_ota`, `storage` | 00, 01 | ⬜ |
| 07 | [07-dashboard-widgets.md](phases/07-dashboard-widgets.md) | IoT-bound widget bodies: alarm table, device table, gauge, map, state, time series, latest values; control widgets (button, switch, slider, set-point → RPC / shared attributes, OD-80; no SCADA) | `/` (dashboard rebuilt from widgets), `/dashboards/[slug]` | `dashboard` (IoT contributions) | 00–03, 04 (OD-80), 9.3, 9.7, 9.8, 9.10, 9.12, 9.16 (OD-80) | [~] built 2026-10-24 (P2) |
| 08 | [08-sites-and-assets.md](phases/08-sites-and-assets.md) | Site/building/line hierarchy tree, device placement, site map | `/assets`, `/assets/[id]` | `iot_asset` | 00, 01, 9.8, 9.9 | ⬜ |
| 09 | [09-digital-twin.md](phases/09-digital-twin.md) | Digital-twin page embedding kui-viewer with live values, alarms, bindings, history | `/twin`, `/assets/[id]/twin` | `iot_twin` | 00, 02, 03, 08, kui-viewer phase 28 | ⬜ |
| 10 | [10-lorawan.md](phases/10-lorawan.md) | LoRaWAN: gateways list/map, gateway detail, device LoRa tab (reception per gateway), live frames, codecs (roltek-lns codec format, OD-83; no mixed mode, OD-86) | `/lorawan/gateways`, `/lorawan/gateways/[eui]`, `/lorawan/frames`, `/lorawan/codecs`, `/devices/[slug]?tab=lorawan` | `iot_lorawan` | 00, 01, 02 | ⬜ (after wk 8) |
| 11 | [11-snmp-targets.md](phases/11-snmp-targets.md) | SNMP: target list, target editor (v2c/v3 credentials, poll interval, polled by cloud or a Roltek router, OD-59), OID → key mapping editor with type and scale, MIB-free test poll, trap receiver view, v2c plaintext warning (OD-64); cloud v2c off until a tenant admin enables it (OD-78) | `/snmp`, `/snmp/targets/new`, `/snmp/targets/[id]`, `/snmp/profiles/[slug]`, `/snmp/traps`, `/devices/[slug]?tab=snmp` | `iot_gateway` (11 SNMP collector); router layout reference `roltek-openwrt-dev` `07-gateway-mode.md` | 00, 01, 9.9, 9.10, 9.11, 9.12, 9.14 | ⬜ (after wk 8) |
| 12 | [12-device-settings.md](phases/12-device-settings.md) | A device's settings from its own manifest: the Settings tab, the generic form with write-only secrets, firewall / Wi-Fi / LTE hints, drift and history, dry run and confirmation; baselines and bulk jobs | device page `?tab=settings`, `/device-settings`, `/device-settings/baselines`, `/device-settings/job` | `iot_device_settings` (phase 05) | 00, 9.10 | [~] built 2026-11-02 |
| 13 | [13-device-certificates.md](phases/13-device-certificates.md) | Device certificates: status badge, detail card with Renew (`cert.renew`) and Revoke, the revoke dialog (reason select, serial typed), recovery request card (Approve / Reject), certificate and recovery lists on the DataTable | `/certificates` | `iot_pki` (03 §3.5) | 00 | [~] built 2026-11-05 |

Status legend as in [`docs/phases/README.md`](../dev/README.md): `[ ]` / `[~]` / `[x]` per task (add the commit hash), `⬜` planned · `🟡` in progress · `✅` done per phase.

Suggested calendar against NB's 8-week plan: 00 and the needed `9.N` items in NB weeks 0–2 (before NB's live chart in week 3), 01–03 by week 3, 07 for the week-4 simulator demo, 04/08 in week 4, 05–06 in week 5, 09 in week 6. NB's cut order applies here too: if the schedule slips, the map widget and 09 go first.

> **→ DECISION OD-90 (owner, 2026-10-04):** NB's week 0 is **not** a calendar date: no IoT work starts before NB's blockers are done (the RLS cutover, the ABAC self-signup fix, the Docker workspace fix and once-per-cluster websocket delivery); the 8 weeks start after that. Every week number in this folder ("week 3", "after week 8", "after wk 8") counts from that start. kui-react work that does not depend on NB (phase 9 items, the demo adapter) may start earlier.
>
> **→ DECISION OD-79 / OD-80 / OD-89 (owner, 2026-10-04):** the MVP scope grows by the RulesetEditor vendoring with the cloud block palette and the default root flow ([below](#cloud-rule-engine-in-the-mvp-od-79-od-87-od-88)) and by the control widgets of phase 07 (OD-80); the owner keeps the 8 weeks for the full scope. The planner's estimate (≈ 5–7 extra dev-weeks, i.e. 11–12 weeks) is recorded in NB as a risk, not a plan change; the cut order above is unchanged (it names only the map widget and 09).

## Parity

The `iot` vertical is React-only by design ([ADR 0003](../../adr/0003-react-ejs-parity-contract.md)); kui-ejs and KUInative have no IoT domain. Every task in this folder is therefore `[react]` and no tag is written. Parity work for the generic components these phases need is in phase 9, not here.

> **→ DECISION OD-82 (owner, 2026-10-04):** mobile in the MVP is **responsive web + PWA** (installable, camera QR scan, push notifications); a native app comes later on expo-react-native-boilerplate + KUInative. So every view in this folder must work at phone width, and the claim flow's camera QR scan must work inside the installed PWA (phase 05, 9.13). The PWA shell itself (manifest, service worker, web push subscription) is NB's (`notification` for push); kui-react ships no service worker. When the native app is scheduled, the "React-only" line above is revisited for the screens it needs.

> **→ DECISION OD-9 (owner, 2026-10-04):** the Alert → Alarm rename (phase 03 §3.0) is kui-react only. Checked 2026-10-04: kui-ejs and KUInative have no IoT `Alert*` component (their only `Alert*` is the generic `AlertBanner`, plus kui-ejs `modules/domain/modem/AlertItem.ejs` and `modules/app/InlineAlert.ejs`, none of them IoT alarms), so nothing is renamed or created there. The generic `AlertBanner` is **not** renamed in any repo.
>
> **→ DECISION OD-15 (owner, 2026-10-04):** every IoT chart (history, gauge, heatmap, widget trend) is the kui-react **native SVG `Chart`** with its time axis, zoom, `GaugeChart` and `HeatmapChart` (phase 9.1–9.4), at parity with kui-ejs and KUInative; not chart.js.

## How the demo proves each phase

The owner wants to see every phase in the IoT demo. A phase is not done until:

1. Each route in its "Demo routes" list renders from the **demo adapter** (phase 00) with no direct import of `iot.data.ts` in the page.
2. Every interaction in the phase changes demo state visibly (acknowledging an alarm moves it to ACKNOWLEDGED in the list, the badge and the timeline), and survives navigation inside the demo session.
3. Live elements move: the demo's mock live source (9.11 `createMockLiveSource`) drives values, online state, alarm arrivals and RPC/OTA progress.
4. Loading, empty and error states are reachable on purpose: `/theme/iot/settings` has latency and failure-injection switches (phase 00).
5. Every new domain component has a showcase entry (at least two variants) in `domain-iot.showcase.tsx` and a `showcase.menu.ts` line; `npm run registry:snapshot` is committed.
6. The routes are added to the phase 2 route smoke test list, and a quick browser pass shows no console errors.
7. The phase file's "NB consumer" line names what NB vendors; nothing NB needs lives only in `app/theme/iot/`.
8. **(OD-82)** Each route is usable at a 360 px phone width (no horizontal page scroll, touch targets ≥ 44 px, tables collapse or scroll inside their card), because the MVP mobile client is the responsive web app as a PWA.

## Cloud rule engine in the MVP (OD-79, OD-87, OD-88)

**→ DECISION OD-79 (owner, 2026-10-04):** a rule engine like the OpenWrt automation package (`roltek-automation-1`, RulesetEditor + cloud executor) is in the MVP with the full cloud-runnable block set; it supersedes OD-29 / P6 (the MVP limited to profile threshold alarms, with the flow editor postponed). **→ DECISION OD-88:** every tenant starts with a **default root flow** (save telemetry + save attributes + alarm evaluation) that the tenant can edit. **→ DECISION OD-87:** only rule-engine nodes write data ("save telemetry", "save attributes", ThingsBoard style); only the message `data` is saved, **metadata is never stored**, and there is no raw-message archive.

The editor is owned by the RulesetEditor session (see "Not in this plan" above); these tasks are the MVP contract this plan needs from it and from NB, and are tracked here until that session's own plan carries them:

- [ ] The RulesetEditor (typed blocks, schema forms, groups, flows that run each other, undo, `roltek-automation-1`) is **vendored into NB in the MVP** as the editor of NB `iot_automation` (`$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-automation/README.md`), the same way as the IoT views (self-contained, host-injected data, no NB URLs in kui-react).
- [ ] **Cloud mode of the RulesetEditor** (NB `iot_automation/06` §6.1, `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-automation/phases/06-editor-ui-and-live-debug.md`): a new kui-react phase for the editor's cloud mode, vendored into NB in the MVP — debug overlay, per-node stats, trace view, config-node import, `msgType` trigger forms and the host adapter namespace `automation.*` (06 §6.2). Planned with the RulesetEditor session; shown in the `/theme/iot/rulesets` demo (e.g. `/theme/iot/rulesets/catalog-demo`) before vendoring.
- [ ] **Cloud block palette:** the editor takes its block catalog from the host, and NB passes only the **cloud-runnable** blocks; blocks the cloud executor cannot run (router-local hardware and system blocks) are not offered. The palette list comes from NB, never hard-coded in kui-react; the demo proves the filtering with a seeded cloud catalog.
- [ ] **Default root flow (OD-88):** the editor opens a tenant's default root flow (save telemetry → save attributes → alarm evaluation) as an ordinary, **editable** flow; the demo seeds it, and the IoT demo's data screens (02, 03, 07) behave as if it ran.
- [ ] **(OD-87)** The "save telemetry" / "save attributes" blocks state in their help text that they save `data` only (no metadata, no topic); a flow that never reaches a save block stores nothing. UI text in this folder that says a value "is stored" means "is saved by a flow" (phases 01, 02, 09, 11).
- [ ] **(OD-83)** Non-LoRa payloads that are not native JSON are decoded on the router or in the cloud **script block** of a flow, not in a per-transport "converter" screen; LoRa uplinks go from the cloud LNS straight into the rule engine (phase 10). No MQTT/HTTP/BLE converter UI is planned anywhere in kui-react.
- [ ] Alarm display links back to the flow: an alarm raised by the default flow's "alarm evaluation" (profile alarm rules, 01 §1.4) or by an alarm block in another flow names that flow and node in its "Related" panel (phase 03 §3.1).
- [ ] 9.10 `SchemaForm` coordination: if the RulesetEditor renders block forms with `SchemaForm`, the shared `fromParamSpec` / `fromBlocksField` mapping table (9.10) is needed inside the MVP, not after it.

## Adapter strategy

The demo today imports static arrays from `app/theme/iot/iot.data.ts` straight into pages, and the page files hold most of the UI (table columns, layouts, filters). NB cannot vendor a page that reads a mock file. Phase 00 changes the shape, not the look:

- **Contract in the domain:** `modules/domains/iot/api/` defines `IotAdapter` (request/response, one sub-interface per resource: devices, profiles, credentials, attributes, telemetry, alarms, rpc, provisioning, ota, assets, twin) and `IotLive` (topic names and payload types on top of the generic `LiveSource` from 9.11). Zod schemas in `modules/domains/iot/types/` are the payload types. Every method takes an `AbortSignal`; errors are a typed `IotApiError`.
- **Injection:** `IotAdapterProvider` (React context) + `useIotAdapter()` / resource hooks built on 9.11 `useResource`. Views never import a fetcher.
- **Views, not pages:** page bodies move into `modules/domains/iot/<area>/*View.tsx`. Theme pages become a few lines (`generateStaticParams` + `<DeviceDetailView slug={slug} />`). NB vendors the views and mounts them under its own routes with its own adapter.
- **Two adapters:** the **demo adapter** (`app/theme/iot/_demo/`) is an in-memory store seeded from `iot.data.ts`, with mutations, deterministic seeds, simulated latency/failures and a mock live source. It keeps the theme rule "no real data fetching" (AGENTS.md, theme rule 7): nothing leaves the browser. The **NB adapter** lives in NB: `fetch` against `iot_*` route handlers and a Socket.IO client on NB's `websocket` IoT namespace. kui-react never contains NB URLs or Socket.IO.
- **Contract tests:** `modules/domains/iot/api/adapter.contract.ts` exports a test suite any adapter must pass; kui-react runs it against the demo adapter, NB runs the same suite against its adapter.
- **Capabilities:** `IotCapabilities` (`canEditDevice`, `canAcknowledge`, `canSendRpc`, `canManageOta`, …) come from the adapter, so NB's ABAC hides actions without the views knowing about ABAC.

## Known demo gaps (fixed in phase 00)

| Gap | Where |
|---|---|
| Workspace rows link to `/theme/iot/workspaces/[slug]`, which does not exist | `workspaces/page.tsx` |
| Sidebar "Settings" points back to `/theme/iot` | `layout.tsx` `NAV_GROUPS` |
| Sidebar `activeId="dashboard"` is hard-coded, so the active item never follows the route | `layout.tsx` |
| Sidebar badges (7, 3), topbar workspace name and bell dot are hard-coded | `layout.tsx` |
| Alarm detail handlers are no-ops (`onAcknowledge={() => undefined}` and the same for resolve and runbook) | `alerts/[id]/page.tsx` |
| "View metrics" 404s for 6 of 7 devices (`DEVICE_METRICS` has one slug) | `devices/[slug]/page.tsx`, `iot.data.ts` |
| Alerts `alert-003`…`alert-005` 404 on their detail page (`ALERT_EVENTS` has two keys) | `alerts/[id]/page.tsx`, `iot.data.ts` (seed ids and exports become `alarm-*`, `ALARMS`, `ALARM_EVENTS` in the OD-9 rename, phase 03 §3.0) |
| Metrics page uses hard-coded `rgba(...)` series colours and a "mixed" unit axis with ×0.1/×0.01 scaling | `devices/[slug]/metrics/page.tsx` (fixed in phase 02) |

## Open decisions (owner)

The owner decided D1–D4 and the customer part of D6 on 2026-10-04 (NB `docs/new-iot-platform/README.md` §"Owner decisions (2026-10-04)"). D5 stays open in NB.

| # | Decision | Recommendation |
|---|---|---|
| D1 | ~~"Alert" (kui-react today) or "Alarm" (NB `iot_alarm`, ThingsBoard) as the domain word~~ | **Alarm.** Rename types and components in phase 03 with deprecated re-exports for one release; keep the `/alerts` demo URL as a redirect. **→ DECISION OD-9 (owner, 2026-10-04):** the term is **Alarm**; kui-react IoT `Alert*` components are renamed `Alarm*` (phase 03 §3.0) |
| D2 | ~~Alarm severity set: `INFO/WARNING/CRITICAL` today vs ThingsBoard's five levels~~ | ~~Follow whatever NB `iot_alarm` phase 0 fixes;~~ phase 03 maps it in one table. **→ DECISION OD-9 (owner, 2026-10-04):** five levels `CRITICAL`/`MAJOR`/`MINOR`/`WARNING`/`INFO` |
| D3 | ~~Telemetry chart engine: the native `modules/ui/Chart` (with 9.1/9.2) or chart.js (`TelemetryTimeSeriesChart` today)~~ | **Native Chart.** One token-aware engine, mirrored in kui-ejs and KUInative; chart.js stays only where already used outside IoT. **→ DECISION OD-15 (owner, 2026-10-04):** kui-react native SVG `Chart` (time axis, zoom, Gauge, Heatmap), parity with kui-ejs/KUInative; not chart.js |
| D4 | ~~One schema-form vocabulary (9.10)~~ | NB's `FieldSchema`. **→ DECISION OD-16 (owner, 2026-10-04):** NB `common/ui/schema-form` `FieldSchema` moves into kui-react (9.10) as the single form-schema vocabulary; OpenWrt `blocks.d` field types map onto it |
| D5 | Where NB mounts the vendored views (`modules/common/ui/kui/iot/` or inside each `iot_*` module's `ui/`) | Decided in NB; kui-react only guarantees views are self-contained and adapter-driven |
| D6 | Demo "Workspaces" vs NB tenant/organization (and ~~the open customer sub-account question in NB~~) | Keep "Workspace" in the demo; the adapter maps it to whatever NB decides. **→ DECISION OD-2 (owner, 2026-10-04):** each customer is its own tenant for the 8 weeks (in-tenant customers later via `contact_companies` + `auth_abac:record_scope`), so no phase here builds an in-tenant customer UI (customer list, customer assignment of devices/dashboards) in the 8 weeks; the Workspace naming question stays as written |

Other owner decisions that change phases here: OD-1, OD-6, OD-24 (phase 05 and the device detail in 01), OD-7, OD-13 (phase 06 and the profile in 01), OD-8 (phase 04), OD-10 (phase 03 §3.4), OD-3 (phase 09, via kui-viewer phase 28), OD-25/OD-26/OD-33 (own protocol with default topics under the plain `v1/` prefix, any-topic telemetry with `metadata.topic`, ThingsBoard v1 only as the "ThingsBoard compatible" mapping profile: phases 01, 02, 03, 04), ~~OD-29 (threshold alarms only in the MVP: phases 01, 03)~~ (**→ superseded by OD-79**, below), OD-31/OD-32 (rollup views and p95 < 300 ms query target: phases 01, 02, 03, 07, 08, 09).

**→ Owner decisions OD-34…OD-44 (2026-10-04, later batch):** OD-34 (topic only in `metadata`, never stored: phases 02, 03, 07, snippet in 01), OD-35 (any-topic limits 8 / 128 / 50 / `raw` 4 KB: phase 01), OD-40 (router alarms on the same five levels: phase 03), OD-41 (claim window by a Cloud-page button, 15 min: phase 05), OD-43 (a profile may enable both topic schemes: phase 01 multi-select), OD-44 (HTTP default paths with a bearer header: phase 01 snippet). OD-36–OD-39 and OD-42 do not change kui-react.

**→ Owner decisions OD-61…OD-64 (2026-10-04):** OD-61 (next LoRaWAN region AS923: phase 10 §10.6 note only, the region list is adapter-driven), OD-62 (gateway health counts as messages: no kui-react change), OD-63 (no transport-based online defaults; the profile form requires an explicit Online status choice: phases 01 §1.4, 10 §10.6, 11 §11.3), OD-64 (SNMP target panel: new phase [11](phases/11-snmp-targets.md), after week 8; OD-90: weeks count from the end of NB's blockers).

**→ Owner decisions OD-67…OD-92 (2026-10-04):** OD-75 (quarantined devices count toward `MAX_DEVICES`: phase 01 §1.1), OD-78 (cloud SNMP v2c off by default, tenant-admin switch with warning and audit: phase 11), OD-79 (cloud rule engine in the MVP, RulesetEditor vendored into NB: [section above](#cloud-rule-engine-in-the-mvp-od-79-od-87-od-88), phases 00, 01 §1.4, 03), OD-80 (control widgets in the MVP, no SCADA: phase 07, phase 9.16), OD-82 (responsive web + PWA: [Parity](#parity), phase 05, 9.13), OD-83 (LoRa codecs in roltek-lns's format; other decoding on the router or in the script block: phase 10 §10.7, section above), OD-85 (ThingsBoard mapping = telemetry + attributes only: phases 01, 04, 05, 07), OD-86 (no LoRa mixed mode, reverses OD-53: phase 10), OD-87 / OD-88 (only flows save data, metadata never stored, default root flow: section above, phases 01, 02, 09, 11; kui-viewer phase 28 note), OD-89 / OD-90 (8 weeks for the full scope, counted after NB's blockers: calendar above). OD-67–OD-74, OD-76, OD-77, OD-81, OD-84 (platform MCP server later, read-only first; no screen in this plan), OD-91 and OD-92 do not change kui-react.

**→ Owner decisions OD-93…OD-102 (2026-10-04):** OD-95 (live `/iot` only from save nodes: phase 02 live view and history always match), OD-96 (a tenant may remove every save node with no lock and no warning: the editor shows **no** "not stored" warning or badge), OD-97 (**no cloud → router flow push**: no push button, target picker or router-catalog portability badge in the cloud editor; only manual JSON export/import), OD-98 (one shared block catalog, `runtimes: edge / cloud` per block: the palette filters on `runtimes` from the host catalog), OD-100 (anyone who can edit flows may write scripts: no separate script role in the editor; the host audits changes), OD-101 (run history only while debug is on, last N runs per node, 24 h: the runs panel says so), OD-102 (per-profile root flow: phase 01 profile editor field). NB plan: `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-automation/README.md`.
