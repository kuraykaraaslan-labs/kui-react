# IoT 04: RPC console

**Goal:** send commands to a device and see what happened to them: one-way and two-way RPC, persistent (queued) RPC for offline devices, live status, response viewer and history.
**Effort:** M.
**Depends on:** 00, 01; 9.10 (`SchemaForm` for declared parameters), 9.11.
**Demo routes:** `/theme/iot/devices/[slug]?tab=rpc` · `/theme/iot/rpc` (fleet-wide RPC log).
**NB consumer:** `docs/new-iot-platform/iot_rpc/` (one-way/two-way RPC, persistent queue, timeouts, RPC console).

## Adapter methods added

`rpc.methods(deviceId)` (methods declared by the profile, with optional parameter schema and description), `rpc.send(deviceId, { method, params, oneway, timeoutMs, persistent, expirationTs? })`, `rpc.list(query)` (per device or fleet), `rpc.get(id)`, `rpc.cancel(id)` (queued only). Live topic: `rpc(deviceId)`.

> **→ DECISION OD-25 / OD-26 / OD-33 (owner, 2026-10-04):** RPC travels on the default topics `v1/rpc/req/{id}` → `v1/rpc/res/{id}` (server → device) and `v1/rpc/up/req/{id}` → `v1/rpc/up/res/{id}` (device → server); no brand name in topics; `v1/` is reserved. ~~Devices on a "ThingsBoard compatible" profile use the ThingsBoard mapping profile's `v1/devices/me/rpc/request/{id}` / `…/response/{id}` instead.~~ The console is topic-agnostic (it calls `rpc.send`); the request detail drawer shows the topic the request went out on (from the adapter), ~~so an integrator can debug both transports~~. Downlink happens only on default topics, never on any-topic paths.
>
> **→ DECISION OD-85 (owner, 2026-10-04):** the ThingsBoard mapping supports **telemetry and attributes only** — no ThingsBoard RPC (narrows OD-26 / OD-43). RPC reaches only devices that use the default `v1/rpc/…` topics. For a device connected on the ThingsBoard scheme the console is shown disabled with "RPC is not available for devices on the ThingsBoard compatible scheme; use shared attributes (Attributes tab) to send settings", and the adapter answers `rpc.send` for such a device with `{ code: 'rpc_not_supported' }`.

## 4.1 Send panel

- [~] `RpcSendPanel`: method combobox (declared methods first, free text allowed when the profile permits), parameters as `SchemaForm` (9.10) when the method declares a schema, otherwise a JSON `CodeEditor` with validation. **→ DECISION OD-16 (owner, 2026-10-04):** a declared parameter schema is `FieldSchema` (the single vocabulary, 9.10); a JSON Schema subset is accepted only through 9.10's `fromJsonSchema` adapter.
- [x] One-way / two-way toggle, timeout, "persistent" (deliver when the device comes back) with expiration; the panel warns when the device is offline and persistent is off.
- [ ] Templates: saved method + params pairs per profile (for Roltek routers, for example `reboot`, `ping`, a `ubus` call) defined by the profile, never hard-coded in the component.
- [x] Respects `canSendRpc`; destructive methods flagged by the profile (`reboot`, ~~`factory_reset`~~) need a `Popconfirm`.
  > **→ DECISION OD-8 (owner, 2026-10-04):** there is **no** remote factory-reset RPC; reboot and sysupgrade only. No template, preset, demo seed, showcase variant or confirmation list in kui-react contains `factory_reset` / `sys.factory_reset`; the destructive examples are `reboot` and the OTA-driven sysupgrade (phase 06, not a console RPC).
- [x] (OD-8) Demo adapter: `rpc.methods` for the seeded Roltek router profile declares `reboot`, `ping` and a read-only `ubus` call, and no factory-reset method.
- [~] (OD-85) `RpcSendPanel` disabled state for devices on the ThingsBoard compatible scheme (reason text above, link to the Attributes tab); the fleet log's "send" shortcut skips such devices; `rpc_not_supported` maps to the same text. The demo seeds one ThingsBoard-scheme device.
- [ ] (OD-80) The phase 07 control widgets (`iot.button`, `iot.switch`, `iot.slider`, `iot.setpoint` with an RPC target) send through the same `rpc.send` and appear in this request list with "sent by: dashboard <board> / widget <title>", so a control action is traceable here.

## 4.2 Request list and detail

- [x] `RpcRequestList`: method, status, sent by, created, delivered, completed, duration; status from the live topic. Status set follows NB `iot_rpc` (ThingsBoard's persistent RPC states are the reference: queued, sent, delivered, successful, timeout, expired, failed).
- [x] Row detail in a `Drawer`: request JSON, response JSON (two-way) with copy, error, the state transitions as a `Timeline`; "re-run" pre-fills the send panel; "cancel" for queued requests.
- [x] Fleet log (`/theme/iot/rpc`): the same list across devices with device/method/status filters.

## 4.3 Demo behaviour

- [x] The demo adapter answers declared methods with plausible responses after a delay, times out some on purpose, and queues requests for offline devices until the mock source brings them online.

## Showcase

New Domain entries: `RpcSendPanel`, `RpcRequestList`, `RpcRequestDetail`, `RpcConsoleView`.

## Definition of done

- In the demo: send a two-way call and read its response; send a persistent call to an offline device, see it queued, then delivered when the device comes online; a timed-out call shows its timeout state.
- (OD-8) No factory-reset method is offered anywhere in the console, its templates or the demo seed.
- (OD-85) The seeded ThingsBoard-scheme device shows the console disabled with the "not available" reason; no ThingsBoard RPC topic appears in any drawer, template or seed.

## 2026-10-24 — as built

> Built on branch `feat/iot-p2-screens` for NB IoT P2 (`iot-rpc/03`), on the adapter of phase 00. **ED** = engineering decision under
> the owner's delegation (owner may veto).

**Built.** `types/rpc.ts` (NB `iot_rpc` vocabulary: the eight statuses incl. `CANCELLED`, tiers, `RpcCommand` with `tier`, `highImpact`,
`confirmText`, `paramsSchema` as `FieldSchema`, `sendable`; `RpcRequest` with `outcome`; `isRefusedRpcMethod`), adapter `rpc.methods /
send / list / get / cancel / parseLive` and live topic `iotTopics.rpc(deviceId | '*', rpcId?)`, capability `canSendRpc`;
`RpcStatusBadge`, `RpcSendPanel` (SchemaForm params, one-way, timeout, persistent + expiry, offline warning, greyed tiers, raw only with
`canSendRaw`, typed confirmation for `confirmText`, click confirmation for other high-impact commands, OD-85 disabled state), 
`RpcRequestList`, `RpcRequestDetail` (answer, progress timeline, send again, cancel for QUEUED / SENT), `RpcConsoleView` (device console or
fleet log, live, 30 s polling fallback); the generic `modules/ui/TypedConfirmDialog` (phase 05 §5.4 needs it too). Demo: the device
page's Commands tab, `/theme/iot/rpc`, a Roltek router catalog in wire names (`sys.info`, `sys.ping`, `net.status`, `cfg.sync`,
`sys.reboot` with `REBOOT`, `diag.slow` that times out; no factory reset), a ThingsBoard-scheme device, persistent requests delivered when
the device comes back. Showcase, registry, tests (`rpc.test.tsx`, `TypedConfirmDialog.test.tsx`).

**Decisions (ED).**
- **ED-K16 Factory reset filtered in the panel too** (`isRefusedRpcMethod`), beside the host's refusal (OD-8: defence in depth).
- **ED-K17 Sendability comes from the host's catalog** (`sendable`, `canSendRaw`): the panel never guesses tiers from roles.
- **ED-K18 Live events carry the state only** (as NB publishes them); the detail reads params and answer with `get`.
- **ED-K19 No free-text method for an operator without raw RPC**; templates per profile wait for the profile editor (01 §1.4).

**Left.** Templates (saved method + params per profile), greying commands the device did not announce in its hello (NB has no
capabilities read for it yet), the topic in the detail drawer (NB does not expose it), the OD-80 control widgets.
