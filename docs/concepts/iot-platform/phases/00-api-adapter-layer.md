# IoT 00: API adapter layer

**Goal:** every IoT screen reads and writes through a typed adapter instead of importing `app/theme/iot/iot.data.ts`, so NB can inject real fetchers and a live transport while the demo keeps running on mocks. Page bodies move into vendorable domain views. The known demo gaps are fixed on the way.
**Effort:** M–L.
**Depends on:** phase 9.11 (`LiveSource`, `useLiveData`, `useResource`, `createMockLiveSource`).
**Demo routes:** every existing `/theme/iot/**` route (same look, now adapter-driven) · new `/theme/iot/settings` · new `/theme/iot/workspaces/[slug]`.
**NB consumer:** all `iot_*` modules (`docs/new-iot-platform/iot_device/` … `iot_twin/`) implement the NB side of this contract; the live part is NB `docs/new-iot-platform/websocket/` (IoT namespace).
**Out of scope:** `modules/app/RulesetEditor/**`, `app/theme/iot/rulesets/**` and the rule-engine types (RulesetEditor, in progress, separate session). The rulesets pages keep their own `rulesets.store.ts`.
**→ DECISION OD-79 (owner, 2026-10-04):** still out of scope of this phase's code, but no longer "later": the RulesetEditor is vendored into NB **in the MVP** as the editor of NB `iot_automation` (cloud block palette, editable default root flow, OD-88); the contract is listed in [README §Cloud rule engine in the MVP](../README.md#cloud-rule-engine-in-the-mvp-od-79-od-87-od-88). If that work wants the IoT adapter (device and key pickers inside block forms), it uses `IotAdapterProvider` from this phase rather than a second data layer.

## 0.1 Types

`modules/domains/iot/types.ts` (188 lines) covers device, telemetry reading, workspace, alert and the rule engine. The platform needs more entities, aligned with NB's `_protocol` spec and module set.

- [~] Create `modules/domains/iot/types/` with one file per entity and a barrel; `types.ts` re-exports it so every current import keeps working. The rule-engine schemas stay in `types.ts` untouched. ⚠️ On 2026-10-04 the RulesetEditor session had uncommitted edits in `types.ts`; start this task only after that work is merged, and add the re-export lines without moving its schemas.
- [~] New schemas (Zod, inferred types): `DeviceProfile`, `TelemetryKeySpec` (key, type, unit, precision, label, min/max), `DeviceCredentials` (`ACCESS_TOKEN` | `MQTT_BASIC` | `X509` with fingerprint/ref only, never a private key), `AttributeScope` (`SERVER` | `SHARED` | `CLIENT`) + `AttributeEntry` (key, value, lastUpdateTs, desired/reported for shared), `TimeseriesPoint` + `TimeseriesQuery` (keys, from, to, interval, agg, limit), `AlarmRule`, `AlarmEvent` (the shape `AlertEventTimeline` already renders), `RpcRequest` (method, params, oneway, timeoutMs, persistent, status, response, timestamps), `ClaimRequest`/`FactoryDevice`, `FirmwarePackage`, `OtaRollout` + `OtaDeviceState`, `Asset` + `AssetRelation`, `TwinBinding`.
  > **→ DECISION OD-9 (owner, 2026-10-04):** the term is **Alarm** and severities are five levels. New entity files use Alarm names from the start (`types/alarm.ts`: `AlarmSeverityEnum = ['CRITICAL','MAJOR','MINOR','WARNING','INFO']`, `AlarmStatusEnum`, `AlarmSchema` with `alarmId`); the existing `Alert*` schemas/types are renamed and kept as deprecated aliases (full list and order in phase 03 §3.0).
  >
  > **→ DECISION OD-1 / OD-24 (owner, 2026-10-04):** add `ProvisioningKey` (`keyId`, `state: 'active' | 'retired' | 'revoked'`, `createdAt`, `retiredAt?`, `revokedAt?`, secret never returned after creation except once on rotate), `ProvisioningSettings` (`strategy`, `rateLimitPerHour`, `autoActivate`), and a device claim/quarantine state on `Device` (`claimState: 'unclaimed' | 'quarantined' | 'active'`). `FactoryDevice` gains `provisionKeyId` and the lifecycle (`MANUFACTURED` | `PROVISIONED` | `CLAIMED` | `RETIRED`).
  >
  > **→ DECISION OD-7 / OD-13 (owner, 2026-10-04):** `DeviceProfile` and `Device` carry `fwAllowMetered: boolean` (default `false`); `OtaDeviceState` can report "waiting for the device's approval" and "held: metered link".
- [x] Field names follow NB's DTOs where NB has fixed them; where NB is still open, the schema carries a `// NB: pending <module> phase 0` comment so the later rename is mechanical.
- [~] Keep `Device.status` but add `connectivity` (`online`, `lastActivityTs`, `lastConnectTs`, `lastDisconnectTs`) as a separate field: "ONLINE/OFFLINE" is live transport state, "ERROR/MAINTENANCE" is operational state. Both exist in ThingsBoard-style platforms and mixing them is why the demo needs four statuses.

## 0.2 Adapter contract

- [~] `modules/domains/iot/api/adapter.ts`: `IotAdapter` with sub-interfaces `devices`, `profiles`, `credentials`, `attributes`, `telemetry`, `alarms`, `rpc`, `provisioning`, `ota`, `assets`, `twin`, `workspaces`. Methods are only those the phases 01–09 need; each phase file lists the methods it adds.
- [x] Paging: `list(query: { page; pageSize; sort?; filter?; search? }, signal) => Promise<{ items; total }>`, the same shape `ServerDataTable` consumes.
- [x] Errors: `IotApiError { code: 'not_found' | 'forbidden' | 'conflict' | 'validation' | 'rate_limited' | 'timeout' | 'unavailable' | 'unknown'; message; fieldErrors?; retryAfterMs? }`. Views map codes to `ErrorState`, inline field errors or a toast.
- [~] `capabilities(): IotCapabilities` (`canEditDevice`, `canDeleteDevice`, `canViewCredentials`, `canAcknowledge`, `canSendRpc`, `canManageProfiles`, `canManageOta`, `canClaim`, `canEditAssets`, `canEditTwin`). Views hide or disable actions from it.
- [~] Capabilities added by the owner decisions of 2026-10-04: `canReleaseDevice` (OD-24, owning tenant admin), `canForceRelease` (OD-24, platform operator only), `canManageProvisioningKeys` (OD-1 rotation/revocation), `canActivateDevice` (OD-1 quarantine), `canManageAlarmSettings` (OD-10). There is **no** capability or method for a remote factory reset (OD-8). Data capabilities: `telemetryTopicStored` (OD-25; false until the NB topic-storage proposal is decided, so history hides topic columns), `rawMaxWindowMs` (OD-31/OD-32; default 24 h, the longest window for which raw rows may be requested; longer windows read rollups).
- [ ] Downloads (CSV export, firmware files) return `{ url } | { blob }` so NB can answer with a signed short-lived URL.

## 0.3 Live contract

- [~] `modules/domains/iot/api/live.ts`: `IotLive = LiveSource<IotLiveEvent>` (9.11) plus topic helpers: `topics.telemetry(deviceId, keys?)`, `topics.deviceState(deviceId | '*')`, `topics.alarms(scope)`, `topics.rpc(deviceId)`, `topics.otaRollout(rolloutId)`, `topics.attributes(deviceId, scope)`.
- [ ] Payload types per topic (Zod), validated in development builds only.
- [x] The contract says nothing about the wire. NB maps topics to its Socket.IO IoT namespace rooms (`tenantEntityRoom` convention); the demo maps them to the mock source.
- [ ] A connection banner (`LiveConnectionNotice`) shows `reconnecting`/`closed` from `IotLive.state` in the IoT shell.

## 0.4 Provider and hooks

- [x] `IotAdapterProvider({ adapter, live, children })` and `useIotAdapter()`, `useIotLive()`; throws a clear error when a view is rendered without a provider.
- [ ] Resource hooks on top of 9.11 `useResource`: `useDevices(query)`, `useDevice(id)`, `useAlarms(query)`, … one per list/detail the views need, each with `mutate` for optimistic updates.

## 0.5 Demo adapter

- [~] `app/theme/iot/_demo/demo-adapter.ts`: an in-memory store seeded from `iot.data.ts` (which stays as the seed file), implementing `IotAdapter` fully. Mutations persist for the browser session (memory + `sessionStorage`, wrapped in try/catch).
- [ ] Seed coverage: metrics for **every** device (generated from a seeded random walk, not only `press-line-sensor-a1`) and events for **every** alert, so no demo link 404s.
- [~] Seed coverage for the owner decisions (2026-10-04): alarms of all five severities (OD-9), at least one quarantined and one unclaimed device (OD-1), a profile with one `active`, one `retired` and one `revoked` provisioning key (OD-1), a profile with `fwAllowMetered` on and one off (OD-7), and a factory-pool unit owned by "another account" so the `not_claimable` claim error is reachable (OD-24).
- [~] `app/theme/iot/_demo/demo-live.ts`: `createMockLiveSource` with telemetry random walks per device key, occasional online/offline flips, a new alarm every ~45 s that later clears, RPC and OTA progress events in response to adapter calls.
- [ ] Simulation controls read by both: latency (0 / 300 ms / 1.5 s), failure rate (0 / 10 % / 100 %), live feed on/off, "reset demo data".
- [x] `app/theme/iot/layout.tsx` wraps children in `IotAdapterProvider` with the demo adapter and live source.

## 0.6 Views instead of page bodies

- [~] Move each page body into a domain view: `DashboardView`, `DeviceListView`, `DeviceDetailView`, `DeviceMetricsView` (replaced in 02), `AlarmListView`, `AlarmDetailView` (Alarm names from the start, OD-9; they render the existing `Alert*` components until phase 03 §3.0 renames them), `WorkspaceListView`, `WorkspaceDetailView`. Views are client components that read only from the adapter hooks; they take ids and an `hrefs` object (`hrefs.device(slug)`, `hrefs.alarm(id)`, …) so NB can map them onto its own routes.
- [x] Pages keep `generateStaticParams`, metadata and the provider-less wrapper; nothing else.
- [~] Each view handles loading (`Skeleton`/`LoadingState`), empty (`EmptyState`) and error (`ErrorState` with retry) through the adapter.
- [x] Showcase: add the views as Domain entries with the demo adapter in a preview provider (two variants each: data and empty/error).

## 0.7 Demo gaps

- [ ] `workspaces/[slug]`: new detail route (`WorkspaceDetailView`: `CloudWorkspaceCard` header, device status breakdown, members list, region/domain/plan), with `generateStaticParams` from the seed.
- [ ] Settings: new `/theme/iot/settings` (`IotSettingsView`): the simulation controls from 0.5, the current adapter name ("Demo, in memory"), live connection state, and a short "what NB replaces here" note. The sidebar item points to it.
- [x] Sidebar `activeId` derived from `usePathname()` (the `resolveActiveId` precedent in `app/theme/social/layout.tsx`).
- [~] Sidebar badges, topbar workspace name and the bell dot read live counts from the adapter (open alarms, devices).
- [x] Alarm detail handlers stop being no-ops: acknowledge and resolve call `adapter.alarms.acknowledge/clear` and update the list, the header and the timeline; Runbook opens a drawer. (The full flow, notes and bulk actions are phase 03.)
- [ ] `iot.data.ts` gaps from the README table are closed by the seed generator in 0.5.

## 0.8 Contract tests

- [ ] `modules/domains/iot/api/adapter.contract.ts` exports `runIotAdapterContract(makeAdapter)`: paging totals, not-found errors, acknowledge transitions, optimistic rollback on failure, abort handling, capability gating.
- [ ] kui-react runs it against the demo adapter in the phase 2 test suite. NB runs the same file against its adapter (vendored with the views).

## Files created / touched

`modules/domains/iot/types/**`, `modules/domains/iot/api/**`, `modules/domains/iot/<area>/*View.tsx`, `modules/domains/iot/index.ts`, `app/theme/iot/_demo/**`, `app/theme/iot/layout.tsx`, every `app/theme/iot/**/page.tsx` except `rulesets/**`, new `app/theme/iot/settings/page.tsx`, new `app/theme/iot/workspaces/[slug]/page.tsx`, `modules/showcase/data/sections/domain-iot.showcase.tsx`, `showcase.menu.ts`, `public/registry/**`.

## Definition of done

- `grep -rn "iot.data" app/theme/iot --include=page.tsx` returns nothing (the seed is read only by `_demo/`).
- Every link in the demo resolves; no route under `/theme/iot` 404s for a seeded entity.
- With latency 1.5 s every view shows its loading state; with failure 100 % every view shows its error state and recovers on retry.
- The sidebar highlights the current section; badges change when an alarm is acknowledged.
- The contract suite passes against the demo adapter.

## 2026-10-24 — as built

> Built on branch `feat/iot-p2-screens` with the device (01) and alarm (03) screens, for NB IoT P2 slice 6a. Boxes marked `[~]` are
> built for the device and alarm screens only. **ED** = engineering decision under the owner's delegation (owner may veto).

**Built.** `modules/domains/iot/types/` (`alarm.ts`, `device.ts`, barrel; `types.ts` re-exports it, the rule-editor schemas are
untouched), `api/adapter.ts` (`IotAdapter` with optional `devices`, `profiles`, `credentials`, `attributes`, `alarms`,
`capabilities()`; `Page`, `IotApiError`, `IotCapabilities` with `NO_CAPABILITIES`), `api/live.ts` (`IotLive`, `iotTopics`,
`POLL_FALLBACK_MS`), `api/IotAdapterProvider.tsx` (provider, `useIotAdapter`, `useIotLive`, `useIotLiveState`,
`useIotCapabilities`, `useIotNotify`, `useIotText`, `useLiveOrPoll`), `messages.ts` (every text of the kit, `IotMessagesInput`),
`format.ts`. Demo: `app/theme/iot/_demo/demo-adapter.ts`, `demo-live.ts`, `demo-hrefs.ts`; the layout wraps the IoT theme in the
provider, mounts a `Toaster`, derives the sidebar `activeId` from the path and shows `AlarmBellMenu`.

**Decisions (ED).**
- **ED-K1 No 9.11 dependency.** `LiveSource` / `useResource` (phase 9.11) are not built, so `IotLive` is a narrow
  `subscribe({ kind, params, onLive, onSnapshot, onError }) → unsubscribe` plus `state` / `onState` (the shape NB's
  `IotLiveClient` already has) and views keep their own fetch state. It maps onto 9.11 when that lands.
- **ED-K2 Optional sub-APIs and nested providers.** A host provides the parts its modules own; an inner provider merges its
  adapter, capabilities and texts over the outer one's (NB: the alarm module's tab inside the device module's page).
- **ED-K3 Fail-closed capabilities.** Every capability is false until the host says otherwise (`capabilities` prop or
  `adapter.capabilities()`); the server still judges every call.
- **ED-K4 Texts through the provider.** Components take `messages?: IotMessagesInput` and read the provider's; no component
  hard-codes English that a host cannot replace (NB translates the whole kit from one dictionary walk).
- **ED-K5 Polling fallback in the views.** `useLiveOrPoll` re-reads every 30 s whenever the live source is absent or not `live`.
- **ED-K6 No browser storage in the demo adapter.** Mutations live for the page's life (the task's `sessionStorage` is not used):
  the demo then never keeps an issued secret anywhere.

**Left.** The other entity files (profile, key spec, RPC, OTA, asset, twin), the payload Zod per topic, `LiveConnectionNotice`,
resource hooks, the simulation controls and `/theme/iot/settings`, `/workspaces/[slug]`, the dashboard and workspace views,
`adapter.contract.ts` (`runIotAdapterContract`), downloads.
