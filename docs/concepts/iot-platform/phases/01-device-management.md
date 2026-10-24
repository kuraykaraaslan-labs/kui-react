# IoT 01: Device management

**Goal:** a device list and detail that are bound to the adapter (server paging, filters, live online state), a credentials panel, a device profile editor and an attributes editor, so an operator can register a device, give it credentials, shape what it sends and set what it should do.
**Effort:** L.
**Depends on:** 00; 9.9 (`KeyValueEditor`), 9.10 (`SchemaForm`), 9.11, 9.12 (`StatusIndicator`), 9.14 (CSV export).
**Demo routes:** `/theme/iot/devices` · `/theme/iot/devices/[slug]` (tabs through `?tab=overview|attributes|credentials|telemetry|alarms|rpc|events`) · `/theme/iot/device-profiles` · `/theme/iot/device-profiles/[slug]`.
**NB consumer:** `docs/new-iot-platform/iot_device/`, `docs/new-iot-platform/iot_device_profile/`, `docs/new-iot-platform/iot_pki/` (X.509 credential view).

## Adapter methods added

`devices.list/get/create/update/delete/bulk`, `profiles.list/get/create/update/delete/setDefault`, `credentials.get/regenerate/update`, `attributes.list(deviceId, scope)/save(deviceId, scope, diff)/delete`, `devices.events(deviceId, query)`. Live topics: `deviceState`, `attributes`.

Added by the owner decisions of 2026-10-04: `devices.activate(id)` (OD-1, quarantined → active), `devices.release(id, { confirmSerial })` (OD-24, phase 05 §5.4), `profiles.provisioningKeys.list(profileId)/rotate(profileId)/retire(keyId)/revoke(keyId, reason)`, `profiles.provisioningSettings.get/update(profileId)` (OD-1), `profiles.transport.get/update(profileId)` (`{ transport: 'roltek' | 'thingsboard'; prefixKeysWithTopic; maxTopicDepth; maxTopicLength; maxTopicsPerDevice }`, OD-25/OD-26), `profiles.topics(transport)` (the effective default topic table, so kui-react never hard-codes it). **→ DECISION OD-57 (owner, 2026-10-04):** `profiles.onlineRule.get/update(profileId)` (`{ onlineRule: 'LIVE_SOCKET' | 'UPLINK_WINDOW' | 'LAST_SEEN_ONLY'; expectedIntervalS?: number; onlineWindowFactor: number; allowed: rule[] }`, `allowed` lists the rules the profile's transport may use) — or the same fields inside the transport `FieldSchema` block; and `Device.online` becomes `true | false | null` (`null` = "last seen only"). **→ DECISION OD-63 (owner, 2026-10-04):** no transport-based defaults: `onlineRule` is `null` on a blank profile draft and required by `profiles.create` (the adapter returns `{ code: 'online_rule_required' }` without it); `allowed` only disables options, it never implies a selection; a template copy returns its stored rule with `source: 'template'`. **→ DECISION OD-79 / OD-88 (owner, 2026-10-04):** the profile response carries `alarmRulesEvaluated: boolean` (false when the tenant's edited root flow no longer reaches an alarm evaluation step) and `rootFlowRef` (id for the RulesetEditor link), both filled by NB `iot_automation`.

## 1.1 Device list

- [~] `DeviceListView` on `ServerDataTable` through `adapter.devices.list`: columns name/label, profile, type, status, connectivity (`StatusIndicator` with "since"), last activity, firmware, tags; sort and paging server-side.
  > **→ DECISION OD-31 / OD-32 (owner, 2026-10-04):** in NB the list, the connectivity/status badges, last seen, firmware and open-alarm count come from the `iot_device_status` view (one query per page; the dashboard query target is p95 < 300 ms). The view never fetches per-row telemetry or alarms to compute a badge; any extra column the adapter cannot serve from that view is opt-in.
- [~] `FilterBar`: status, connectivity, profile, type, gateway yes/no, tags; free-text search; filters live in the URL (shareable).
- [~] **→ DECISION OD-1 (owner, 2026-10-04):** devices created through a profile provisioning key land unclaimed/quarantined. The list gets a claim-state filter and a `DeviceClaimStateBadge` ("Quarantined — telemetry dropped until activated", "Unclaimed") in the status column; quarantined rows offer "Activate" (`canActivateDevice`), single and bulk.
  > **→ DECISION OD-75 (owner, 2026-10-04):** quarantined devices **count toward `MAX_DEVICES`**. The "n of n devices used" text (here, "Add device", phase 05 and the shared limit message of 10/11) includes them, and the quarantine badge tooltip says "Counts toward your device limit"; no UI text may say quarantined devices are free or uncounted.
- [ ] (OD-75) The device-limit usage line in the list header counts quarantined devices and offers a filter link "n quarantined" so an admin can review them (activating keeps the count; only deleting frees capacity); the demo seeds a tenant one device below its limit with one quarantined device, so the next "Add device" shows `limit_reached`.
- [ ] `ViewToggle` between table and the existing `DeviceCard` grid.
- [x] Live: rows update their connectivity from `topics.deviceState('*')` without refetching the page.
- [x] **→ DECISION OD-57 (owner, 2026-10-04):** "online" follows the device profile's online rule, so the connectivity column has three looks: live connection (online/offline "since", today's `StatusIndicator`), recent message (online/offline with the tooltip "online = a message within <interval × factor>"), and last seen only (`online = null`: a neutral "Last seen 3 h ago", never a red "offline"). The connectivity filter gets a third value "Last seen only". The device detail header follows the same rule.
- [ ] Bulk actions (`BulkActionTable` pattern): assign profile, add/remove tag, delete (with `Popconfirm`), export CSV (9.14).
- [x] "Add device" dialog: name, label, profile, gateway flag, optional pre-set credentials type; on success shows the credentials once (1.3) and links to the detail.

## 1.2 Device detail

- [x] `DeviceDetailView`: `DetailHeader` (name, label, profile link, `DeviceStatusBadge`, connectivity `StatusIndicator`, actions: edit, copy id, delete) and `TabGroup` with the tabs listed above. The tab is in the URL.
- [~] **→ DECISION OD-1 / OD-24 (owner, 2026-10-04):** the header also shows `DeviceClaimStateBadge` (quarantined/unclaimed) with "Activate" when quarantined, and a "Release device" action (`canReleaseDevice`) that opens the phase 05 §5.4 `ReleaseDeviceDialog` (typed confirmation). There is no factory-reset action (OD-8).
- [~] Overview: info list (today's left column), latest values preview (top 6 keys from phase 02's latest-values component), open alarms (phase 03 list filtered to this device), gateway children when `role = GATEWAY`.
- [~] Events tab: lifecycle and connectivity events (created, credentials changed, connected, disconnected, profile changed) as a `Timeline`, paged.
- [~] Telemetry, Alarms and RPC tabs host the phase 02, 03 and 04 views; until those land they show a link to the old metrics route.

## 1.3 Credentials panel

- [x] `DeviceCredentialsPanel`: type selector (`ACCESS_TOKEN`, `MQTT_BASIC` with client id/username/password, `X509` showing subject, fingerprint, validity and issuer from `iot_pki`, never a private key).
- [~] Secrets masked by default; reveal requires `canViewCredentials` and is announced; copy buttons; regenerate behind `Popconfirm` ("the device disconnects until it is updated").
- [ ] `ConnectionSnippet`: ready-to-paste examples (`mosquitto_pub` to ~~`v1/devices/me/telemetry`~~ `v1/telemetry`, `curl` to the HTTP API) generated from the credentials and the host/port the adapter reports. Topic and endpoint strings come from one constants file mirroring NB `docs/new-iot-platform/_protocol/` so they cannot drift silently.
  > **→ DECISION OD-25 / OD-26 / OD-33 (owner, 2026-10-04):** the snippet follows the device's profile transport: "Roltek default" shows the default topics (`v1/telemetry`, `v1/attributes`, `v1/rpc/req/{id}`, …; no brand name in topics, OD-33) plus one any-topic example (e.g. `sensors/hall-2/temp`, which arrives with `metadata.topic`); "ThingsBoard compatible" (the mapping profile, OD-26) shows the ThingsBoard v1 topics (`v1/devices/me/telemetry`, …) instead. **→ DECISION OD-85 (owner, 2026-10-04):** the ThingsBoard mapping supports **telemetry and attributes only** (`v1/devices/me/telemetry`, `v1/devices/me/attributes` and its attribute request/response topics); the snippet never shows ThingsBoard RPC, claim, provisioning or gateway API topics, because NB does not accept them. Roltek default HTTP paths follow NB `_protocol` 01. The constants file holds both topic sets, keyed by transport.
  > **→ DECISION OD-43 (owner, 2026-10-04):** a profile may enable both schemes; the snippet then shows both sets (Roltek default first). **→ DECISION OD-44 (owner, 2026-10-04):** the `curl` example uses the default HTTP API: `curl -H "Authorization: Bearer <token>" https://<host>/api/v1/telemetry` — the token never in the URL; the TB form `…/api/v1/<token>/telemetry` is shown only when the profile enables ThingsBoard. **→ DECISION OD-34:** the any-topic example's note says the topic is visible live (and in rules/webhooks) but is not stored with history.

## 1.4 Device profile editor

- [~] `DeviceProfileListView` (table: name, default flag, device count, transport, provisioning strategy) and `DeviceProfileEditorView` with sections: (built 2026-10-24, see the profile end block; image, default dashboard, template diff and OTA wait for their host fields)
  - General: name, description, image, default flag, default dashboard (phase 07 link).
    > **→ DECISION OD-102 (owner, 2026-10-04):** a **per-profile root flow is in the MVP** (ThingsBoard style). The General section gets a **"Root flow"** field: a select of the tenant's flows from the host (`automation.flows.list`, kind `flow`) with the empty option "Tenant root flow (default)" and an "Open in editor" link; disabled with a reason when the host says the user cannot manage flows. A profile without a root flow falls back to the tenant root flow (OD-88). NB side: `iot_device_profile/00` §0.1 `rootFlowId`, `iot_automation/04` §4.5.
  - [ ] (OD-102) Demo: two fixture profiles, one with a root flow and one on the tenant default, both visible in `/theme/iot`; the select round-trips through the mock adapter.
  - Transport: ~~MQTT topic filters (ThingsBoard v1 defaults shown read-only, Roltek `v1/roltek/*` extensions listed), payload type.~~
    > **→ DECISION OD-25 / OD-26 / OD-33 (owner, 2026-10-04):** our own protocol with default topics under the plain `v1/` prefix; ThingsBoard v1 survives only as a built-in mapping profile. The Transport section becomes `ProfileTransportPanel`:
    > - **Transport / mapping selector:** "Roltek default" (default) | "ThingsBoard compatible" (mapping profile for legacy DC620 firmware and third-party ThingsBoard devices; **→ OD-85:** telemetry and attributes only — the option's hint says "no RPC, claiming, provisioning or gateway API for these devices"). Below it, a read-only table of the effective default topics for the chosen transport (the OD-25 table: purpose, direction, topic), so an integrator sees exactly what the device must use. Changing the transport on a profile with devices warns that connected devices on the other topic set will be refused after reconnect.
    > - **Any-topic ingestion** (both transports): an explanation line ("any other topic the device publishes to is ~~stored as telemetry with its topic~~ accepted as telemetry; non-JSON payloads become a `raw` value; `v1/` is reserved"), then the settings:
    >   **→ DECISION OD-87 / OD-88 (owner, 2026-10-04):** only rule-engine nodes save data, so the line reads "… is accepted as telemetry and saved by your default flow's 'save telemetry' step (the topic itself is never saved)", with a link to the tenant's default root flow in the RulesetEditor (README §Cloud rule engine in the MVP).
    >   - "Prefix keys with the topic" toggle — **default off**, which means the same key on two topics is last-write-wins; on, keys are stored as `<topic>/<key>` (the exact separator follows NB `iot_telemetry`). The hint shows an example of both.
    >   - Topic limits: max topic depth (levels), max topic length (characters), max distinct topics per device. Number inputs with the NB defaults as placeholders and a hint that the limits protect the key dictionary; a device over the limit gets its extra topics refused (shown in the device Events tab).
    >   - **→ DECISION OD-33 (owner, 2026-10-04):** no brand name in topics; defaults under `v1/`; `v1/` is reserved. The limits block states it: "Topics under `v1/` are reserved: an unknown `v1/…` topic is rejected with an error, never stored as telemetry. ThingsBoard topics (~~`v1/devices/me/*`, `v1/gateway/*`~~ **→ OD-85:** the telemetry and attribute topics under `v1/devices/me/` only; no `v1/gateway/*`, RPC, claim or provision topics) are accepted only when this profile's transport is 'ThingsBoard compatible'." Rejected topics appear in the device Events tab with the reason (reserved namespace, over a limit).
    > - Payload type stays (JSON).
    > All of it is a `FieldSchema` block (OD-16) the adapter returns, so NB can add or rename settings without a kui-react release.
    > **→ DECISION OD-43 (owner, 2026-10-04):** the "Transport / mapping selector" becomes a **multi-select** (two checkboxes "Roltek default" and "ThingsBoard compatible", at least one checked; NB field `topicSchemes`). With both checked the read-only topic table lists both sets with a "Scheme" column, and the hint says "old and new firmware can share this profile; downlink follows what the device subscribed to" (**→ OD-85:** for a device on the ThingsBoard scheme, downlink is shared-attribute updates only; RPC reaches only devices on the default topics, phase 04). Unchecking a scheme on a profile with devices keeps the existing warning. It renders with the `multi-select` field type of 9.10 `FieldSchema` (already in the planned field set; no one-off control).
    > **→ DECISION OD-35 (owner, 2026-10-04):** the topic-limit placeholders are decided defaults (depth 8, length 128, 50 distinct topics per device), raisable per profile; a fourth field "Max raw payload" (default 4 KB) is added. The hint "protect the key dictionary" stays (OD-34: there is no topic dictionary).
    > **→ DECISION OD-44 (owner, 2026-10-04):** a one-line note under the selector: "HTTP devices use `/api/v1/…` with a bearer token header; token-in-URL routes exist only with ThingsBoard compatible".
    > **→ DECISION OD-57 (owner, 2026-10-04):** an **"Online status"** group at the end of the Transport section, for every profile: a radio group "Live connection" (~~default for MQTT:~~ online while the device holds its connection) / "Recent message" (online while the last message is younger than expected interval × factor) / "Last seen only" (no online/offline, the list shows "last seen"); for "Recent message" a duration input "Expected interval" (required) and a number input "Factor" (default 3, 1.5–10) appear, with a live hint "Shown offline after 3 h without a message". Options the profile's transport cannot use are disabled with the reason from `allowed` (e.g. LoRaWAN: "LoRaWAN devices have no live connection"). A one-line note separates it from inactivity ("Inactivity alarms are configured separately"). Rendered from `FieldSchema` (OD-16): the rule is a `select` (shown as a radio group if 9.10 offers that display option; adding it there is the kui-react change, not a one-off here), the interval a `number` in seconds with a unit suffix (or the `duration` field type if 9.10 adds it, see its `blocks.d` mapping note), the factor a `number`, and the interval/factor visibility a `showIf`. NB: `iot_device_profile/01` §1.1c, `03` §3.2.
    > **→ DECISION OD-63 (owner, 2026-10-04):** the form **requires an explicit choice**: on "New blank" the group renders with **no option selected** for every transport (MQTT included), marked required, with the helper "Choose how this profile decides online"; the editor's Save button stays disabled and the group shows the field error until a rule is picked. Nothing is preselected from the transport, and switching the transport never changes the selection: if the chosen rule becomes disabled, the group shows the reason and Save stays blocked until another rule is chosen. A profile created from a template shows the template's stored rule with a small "from template" tag; an existing profile shows its stored rule. The `FieldSchema` field is `required: true` with no `default` (the `select`/radio display of 9.10 must support an empty required value; if it does not yet, that is the 9.10 change, not a one-off here).
  - Telemetry keys: `TelemetryKeySchemaEditor`, a table editor of `TelemetryKeySpec` rows (key, type, unit, precision, label, expected min/max). Phases 02 and 07 read units, precision and ranges from here instead of hard-coding them.
  - Alarm rules: threshold rules ~~per NB decision P6~~ (~~**→ DECISION OD-29 (owner, 2026-10-04):** P6 confirmed — MVP alarms are profile threshold rules, no canvas; the cloud flow editor and executor come after the 8 weeks, format `roltek-automation-1`~~) (key, condition, severity, duration, clear condition, runbook text). The editor is a list of rule cards~~; no canvas~~.
    > **→ DECISION OD-79 / OD-88 (owner, 2026-10-04):** supersedes OD-29 / P6. The cloud rule engine (RulesetEditor + NB `iot_automation`, `roltek-automation-1`) is **in the MVP**. The profile's rule cards stay as the profile's alarm rules; they are evaluated by the **"alarm evaluation" step of the tenant's default root flow** (save telemetry + save attributes + alarm evaluation), which the tenant can edit. The section therefore gains a one-line note "Evaluated by the default flow's alarm evaluation step" with a link to that flow in the RulesetEditor, and a warning when the adapter reports that the tenant's root flow no longer reaches an alarm evaluation step ("these rules are not evaluated"). Alarms that need more than a threshold are built as flows, not as new rule-card types. README §Cloud rule engine in the MVP. Rules can be "tested" against the last hour of demo telemetry and show how many alarms they would have raised. **→ DECISION OD-9 (owner, 2026-10-04):** the severity select offers the five levels `CRITICAL`/`MAJOR`/`MINOR`/`WARNING`/`INFO` from the phase 03 `alarm-severity.ts` table. **→ DECISION OD-25 (owner, 2026-10-04):** each rule card has an optional "Only from topic" condition on `metadata.topic` (exact or `+`/`#` pattern; empty = any topic), see phase 03.
  - Provisioning: strategy (disabled, allow create, pre-provisioned only), ~~key and secret (masked, regenerate)~~.
    > **→ DECISION OD-1 (owner, 2026-10-04):** devices first connect with the **profile provisioning key/secret** (ThingsBoard style), never with the claim secret. The Provisioning section becomes `ProvisioningKeysPanel` + settings:
    > - Key table: `provision_key_id`, state badge `active` / `retired` / `revoked`, created/retired/revoked dates, devices provisioned with it. The secret is masked; reveal follows `canViewCredentials`.
    > - "Rotate key" (`canManageProvisioningKeys`, `Popconfirm`): creates a new `active` key, the previous one becomes `retired` (still accepted for serials imported with it); the new secret is shown once with copy. "Revoke" (leak) needs a typed confirmation of the key id and a reason, and warns that affected serials need a platform-operator re-allow.
    > - Settings: provisioning rate limit per key (successful provisions per hour, default 60), `autoActivate` toggle (default **off**: devices created by this profile land `QUARANTINED` until activated) with a one-line explanation of the risk.
    > - Strategy `ROLTEK_FACTORY` (platform-owned Roltek factory profiles) is shown read-only to tenants; its keys are visible only to platform operators.
    >
    > **→ DECISION OD-85 (owner, 2026-10-04):** this provisioning is our own protocol. A profile whose only scheme is "ThingsBoard compatible" gets no ThingsBoard device-provisioning or claiming API: its Provisioning section shows "Devices on the ThingsBoard scheme are added by hand or by import" and offers no provisioning-key strategy for that scheme.
  - OTA: default firmware and software package (links to phase 06). **→ DECISION OD-7 (owner, 2026-10-04):** an "Allow OTA over metered links (LTE)" toggle (`fwAllowMetered`, default **off**) with the hint "never applied while the data quota is exhausted"; the device detail can override it per device.
- [ ] (not done, ED-K21) Settings blocks that are declarative (transport options, provisioning) render with `SchemaForm` (9.10) from a schema the adapter returns, so NB can add fields without a kui-react release. **→ DECISION OD-16 (owner, 2026-10-04):** that schema is the `FieldSchema` vocabulary (moved from NB `common/ui/schema-form` into kui-react 9.10); no IoT-specific schema format.
- [~] Unsaved-change guard and a diff summary before save. (built: one draft over the own tabs with an "Unsaved changes" bar, Discard and a Save that sends only the changed fields; no field-level diff summary)

## 1.5 Attributes editor

- [~] `DeviceAttributesPanel` with three scope tabs: Server (editable), Shared (editable, pushed to the device), Client (read-only, reported by the device).
- [ ] Rows render through `KeyValueEditor` (9.9) with typed values, "last updated" per row, and the diff sent through `attributes.save(deviceId, scope, diff)`.
- [~] Shared attributes show desired vs reported: a sync `StatusIndicator` per key (in sync, pending, device reported a different value) from the `attributes` live topic.
- [ ] Bulk JSON paste and copy.

## Showcase

New Domain entries: `DeviceCredentialsPanel`, `ConnectionSnippet`, `DeviceAttributesPanel`, `TelemetryKeySchemaEditor`, `AlarmRuleCard`, `DeviceProfileEditorView`, `DeviceListView`, `DeviceDetailView` (each with a data and an empty/error variant). Added by the owner decisions of 2026-10-04: `ProvisioningKeysPanel` (active/retired/revoked rows, rotate pending), `DeviceClaimStateBadge` (quarantined, unclaimed, active) and `ProfileTransportPanel` (Roltek default and ThingsBoard compatible variants, OD-25/OD-26).

## Definition of done

- In the demo: add a device, copy its token, see it flip online when the mock live source "connects" it, edit a shared attribute and watch it go pending then in sync.
- A profile edit (a unit or a range) changes how the device's latest values and the gauge widget render without code changes.
- Filters and the active tab survive a reload through the URL.
- (OD-1) Rotate a profile's provisioning key: the old key turns `retired`, the new secret is shown once; revoke a key with typed confirmation; toggle `autoActivate` and the rate limit; a quarantined seeded device shows its badge and becomes active after "Activate".
- (OD-7) The profile's metered-OTA toggle is off by default and a per-device override is visible on the device detail.
- (OD-25/OD-26/OD-33) In the demo on `/theme/iot/device-profiles/[slug]`: switch a profile between "Roltek default" and "ThingsBoard compatible" and see the topic table and the device's `ConnectionSnippet` change (`v1/telemetry` vs `v1/devices/me/telemetry`); the "Prefix keys with the topic" toggle is off by default; the three topic-limit fields validate (positive integers) and carry the reserved-`v1/` hint; a seeded device shows one "topic rejected: reserved namespace" event.
- (OD-43/OD-35/OD-44) Check both schemes on a demo profile: the topic table shows both sets, the `ConnectionSnippet` shows both, and unchecking both is impossible; the limit fields show 8 / 128 / 50 / 4 KB; the `curl` snippet uses the `Authorization: Bearer` header.
- (OD-57) On a demo profile switch Online status between the three rules: interval and factor appear only for "Recent message", the hint updates, and a seeded HTTP device on that profile flips online on a mock message and offline after the window; on "Last seen only" the list shows "Last seen …" (no red offline) and the connectivity filter's "Last seen only" value finds it; a LoRaWAN demo profile has "Live connection" disabled with the reason.
- (OD-63) "New blank" profile in the demo, for MQTT, HTTP and LoRaWAN each: the Online status group starts with nothing selected, Save is disabled with the "Choose how this profile decides online" error until a rule is picked, and switching the transport keeps the selection (or blocks Save with the reason when the rule becomes disabled); a profile created from a demo template shows the template's rule with the "from template" tag.
- (OD-31) The device list issues one list query per page (no per-row requests), checked in the demo adapter's call log.
- (OD-75) On the demo tenant one device below its limit, with one quarantined device: the usage line counts the quarantined device, "Add device" hits `limit_reached`; activating it leaves the count unchanged, deleting it frees one slot.
- (OD-85) A "ThingsBoard compatible" demo profile shows only telemetry and attribute topics in the topic table and the `ConnectionSnippet` (no `v1/gateway/*`, RPC, claim or provision topic anywhere), and its option hint names what is not supported.
- (OD-79/OD-88) The alarm-rules section links to the default root flow; with the demo switch "root flow without alarm evaluation" on, it shows the "these rules are not evaluated" warning.

## 2026-10-24 — as built

> Built on branch `feat/iot-p2-screens` (with 00 and 03), the device half of NB IoT P2 slice 6a (`iot-device/05`). `[~]` = built
> as far as the NB device API goes today. **ED** = engineering decision under the owner's delegation (owner may veto).

**Components** (`modules/domains/iot/device/`): `DeviceOnlineDot`, `DeviceConnectionBadge` (online / offline / last seen only,
OD-57; Quarantined and Disabled first, OD-1, OD-75 tooltip), `DeviceDetailHeader` (actions slot only; no factory reset, OD-8),
`DeviceCredentialPanel` + `IssuedSecretNotice` (show-once secret, masked until Show, copy, rotate behind `Popconfirm`, X.509
fingerprint and expiry), `DeviceAttributeTable` (three scope tabs, lazy; inline JSON edit validated before any request; secret keys
write-only; the shared tab's sync badge), `DesiredReportedBadge`, `DeviceConnectionTimeline` (on `Timeline`), `DeviceTable` (the
dashboard body, 07), `DeviceListView`, `DeviceDetailView`, `NewDeviceDrawer`; `DeviceStatusBadge` gained `QUARANTINED`. New generic
piece `modules/ui/KeyedTable` (stable keys, keyboard row focus, row state new / leaving, selection, loading / error / empty) and
`TabGroup.onTabChange`. Demo: `/theme/iot/devices` (filters in the URL) and `/theme/iot/devices/[slug]` (tab in `?tab=`; Alarms tab
real, Telemetry / RPC / OTA / Placement placeholders). Tests: `device.test.tsx`, `views.test.tsx`, `modules/ui/KeyedTable.test.tsx`.

**Decisions (ED).**
- **ED-K7 `DeviceRecord` beside the demo `Device`.** The adapter shape keeps the registry status (`ACTIVE` / `QUARANTINED` /
  `DISABLED`) apart from `online` (true / false / null); the demo `DeviceSchema` only gained optional NB fields.
- **ED-K8 `KeyedTable` instead of `ServerDataTable` for the lists.** `ServerDataTable` has no selection and no keyboard row focus
  (DataTable M4/M6), both needed here (bulk Activate, bulk acknowledge, dashboard rows); the generic piece is in `modules/ui`.
- **ED-K9 Attribute values edited as JSON in a `Textarea`.** `CodeEditor` (a large tree with its engines) is not used for a one-value
  edit; the value is validated as JSON before any request.
- **ED-K10 "New device" has no credential-type field.** NB's create API issues an access token; MQTT basic and X.509 are set on the
  Credentials tab (no API change for a UI convenience).

**Left.** Bulk assign / tag / delete and CSV export, the card grid toggle, the device-limit usage line (OD-75), `ConnectionSnippet`,
the profile list and editor (1.4) and its provisioning keys, transport and online-rule blocks, the Events tab beyond connections,
the Release device dialog (`TypedConfirmDialog`, phase 05 §5.4), the desired/reported view's server side (NB iot_device 04 §4.3).

## 2026-10-24 — as built: device profile screens (1.4)

> Built on branch `feat/iot-p2-screens` for NB `iot_device_profile` 03 (IoT P2, slice 6b), on the adapter of phase 00. **ED** =
> engineering decision under the owner's delegation (owner may veto).

**Types** (`types/profile.ts`, `types/alarm-rule.ts`; `types/rpc.ts` gained `RpcCatalogCommand` and `RpcCommandInput`): the profile in
NB's field names, the protocol defaults (`blankProfileDraft`: the online rule left EMPTY, OD-63), the host's rules mirrored line for line
(`parseLimitString`, `PROFILE_RANGES`, `onlineRuleBlock` / `allowedOnlineRules` that only forbid, `isNetwork`, key rules,
`profileDraftIssues`), `profilePatch` (only the changed fields; one rate-limit family on its own); the alarm rule shapes of NB
`iot_alarm` with `describeCondition` and `alarmRuleIssues`.

**Adapter** (`api/adapter.ts`): `profiles.list / get / create / update / remove / setDefault / usage / transports`, `alarmRules.list /
replace`, `rpcCatalog.list / create / update / remove / exportAll / importAll`; capabilities `canManageProfiles`,
`canManageAlarmRules`, `canManageRpcCommands` (fail closed).

**Components** (`profile/`): `DeviceProfileListView` (search, transport and online-rule filters, the default first, device counts from
`usage` every 30 s, New profile, Make default, delete naming what still uses the profile; the host refuses the default and a profile in
use and its answer is shown), `DeviceProfileEditorView` (General, Transport & auth, Online status, Limits, Telemetry keys, Configuration
keys, Provisioning on ONE draft with one Save; an error dot on the tab that holds an issue; read-only without the capability; the host's
contributed `extraTabs` after the own ones), `NewDeviceProfileDrawer` (explicit online rule, Create disabled until one is chosen for
every transport), `OnlineRuleField` (OD-57 / OD-63: required, empty on a new profile, a rule the transport cannot serve disabled with the
reason, a chosen one that became impossible kept, marked and blocking; interval and factor only for the window rule with the live
"offline after" hint; "from template"), `AuthModeSelector` (three modes, MQTT basic is always username + password, no client-ID-only
option, OD-163; locked mode for X.509-only templates), `TransportPolicyCard` (transport, TLS only / plain MQTT with the risk said,
OD-160; URL tokens with the HTTP-only warning, OD-161; allowed networks with the invalid entries named), `ProtocolMappingCard` (topic
schemes, both allowed, never none, ThingsBoard = telemetry and attributes only, OD-43 / OD-85; custom topics 8 / 128 / 50 / 4 KB,
OD-35), `RateLimitEditor` (count : seconds windows per family, at most four, growing; an invalid family kept as typed and marked),
`TelemetryKeySchemaTable` and `CfgSchemaTable` (editable; read-only with "from firmware" when `profile.json` describes the keys, P-4),
`ProvisioningSettingsCard` (strategy; the keys are a disabled placeholder until the host has them), `DeviceProfileCard`. Contributed-tab
bodies: `alarm/AlarmRuleSetEditor` + `alarm/AlarmRuleDrawer` (rule cards, threshold or device-offline rule, form or JSON, Save rules
replaces the set) and `rpc/RpcCommandCatalogEditor` (add, edit without the method, remove, export, import after typing REPLACE, never a
factory reset).

**Demo:** `/theme/iot/profiles` (filters in the URL) and `/theme/iot/profiles/[slug]` (tab in `?tab=`; Alarm rules and Commands real,
Firmware and Flows placeholders), "Device profiles" in the sidebar, the device header links its profile. Five demo profiles: the
default, a Roltek template copy (X.509 only, schemas from firmware), LoRaWAN on last seen only, ThingsBoard topics with plain MQTT, HTTP
on the recent-message rule with URL tokens. Showcase: 15 entries (free abbreviations, collisions stay 102). Tests: `profile/profile.test.tsx`
(21), `alarm/alarm-rules.test.tsx` (4), `rpc/rpc-catalog.test.tsx` (4).

**Decisions (ED).**
- **ED-K20 One draft, one Save.** The own tabs edit one draft; a contributed tab saves on its own (its host route is separate). The
  form refuses what the host refuses and still shows the host's own refusal.
- **ED-K21 Online status drawn by `OnlineRuleField`, not `SchemaForm`.** `FieldOption` has no per-option disabled reason, and adding one
  changes a file next-boilerplate vendors byte for byte outside its IoT modules; the field draws its own radios. The generic
  `RadioGroup` is not extended either (it exists in kui-ejs and KUInative too; a parity change outside this slice).
- **ED-K22 Alarm rules as form or JSON.** The form draws one comparison per severity (the common shape) and keeps the fields it does not
  draw; a combined condition opens as JSON. A visual condition builder waits for the rule-card design of §1.4.
- **ED-K23 Provisioning keys as a disabled placeholder.** No key, secret or button is drawn until the host has key management (NB
  `iot_provisioning`, P3).

**Left.** Image, default dashboard, template update banner with `DiffViewer`, the OTA metered toggle (no host fields yet); the
`SchemaForm`-driven settings blocks; a field-level diff before save; `ConnectionSnippet`; the topic table per scheme; the provisioning
key list, rotation and revocation (OD-1) with the host's service.

## 2026-10-24 — as built: the device Log tab and the quick view (1.1, 1.2)

> Owner request, 2026-10-24 (through next-boilerplate `iot-device/05`): the Connections tab becomes **Log**, one timeline of everything
> that happened to the device; and a device opens as a drawer from the list so moving between devices is faster. Commit `b12233f`
> on `feat/iot-p2-screens`, vendored by next-boilerplate the same day.

**Adapter.** `IotDevicesApi.log?(deviceId, { page, pageSize, source? })` answers `Page<DeviceLogEntry>` (`types/device.ts`:
`{ id, at, source: 'connection' | 'audit', kind, actor?, remoteIp?, transport?, reason?, detail?, metadata? }`; an audit entry's
`kind` is the host's action, e.g. `iot_device.device.updated`). Optional: `connections()` stays required and a host without `log` shows
connection lines only (no Changes chip). `DeviceListQuery.device` is the quick view's device; `list` never receives it.

**Components.** `device/DeviceLogTimeline.tsx`: connection lines (icon per kind, `DeviceAddress` for the IP and transport, the reason) and
changes (an icon and title per known action in `DEVICE_LOG_ACTIONS`, any other drawn neutral as "Change: <action>"; "by <name>",
"by a team member" without a name, "by the system" without an actor; `auditSummary` makes one line of names only: changed fields,
status from → to, scope and keys, credential type, command, alarm type). A chip row All / Connections / Changes (`aria-pressed`), paging
by the host, `compact` for short lists. `device/useDeviceLog.ts` reads page by page, shows nothing of a previous device or filter while
the first page loads, and drops an id it already shows when pages shift. `DeviceDetailView`: tab id `log`, label "Log" (order 30);
`tab="connections"` opens it.

`device/DeviceQuickView.tsx`: the existing `modules/ui/Drawer` (unchanged; widened through `className`), its header with the name, the
position ("2 of 20") and Previous / Next; the body with the connection badge, IP, profile, firmware, last activity and the five newest
log lines (re-read when the live state reports a new connect or disconnect); footer Copy ID and Open full page, and Open the log
(`?tab=log`). `DeviceListView` opens it on a row click (`KeyedTable.onRowClick`; the name link still goes to the page, Enter on a row
opens it too), highlights the open row, and moves with ↑ / ↓ (a document listener while open; ignored in form fields) and the buttons
through the current page. Esc closes (the Drawer's focus trap); focus returns to the row of the device last shown. Live `deviceState`
patches the drawer like the row. `onQueryChange(query, how)`: `push` when the drawer opens, `replace` otherwise; a changed
`initialQuery.device` (Back, Forward, a link) opens or closes it; a device not on the page is read alone (`get`), without neighbours.

**Not drawn: latest telemetry values.** The adapter has no latest-values call; the section is left out of the quick view until one
exists (the device page's Telemetry tab has them).

**Demo and showcase.** The demo adapter keeps an audit history per device (Ada Lovelace and Alex Müller) and adds rows for its own
changes (create, activate, rotate, attribute save and delete, command send and cancel, alarm acknowledge and clear); `/theme/iot/devices`
keeps `?device=` in the URL (push on open). Showcase entries `iot-device-log-timeline` (DG) and `iot-device-quick-view` (DQ); registry
snapshot 382 components.

**Decisions (ED).**
- **ED-K24 `log` optional, `connections` kept.** A host that has only the connection log keeps working; the Log tab narrows to it.
- **ED-K25 Drawer unchanged.** Width through `className`, arrow keys through a document listener in the quick view; no change in
  `modules/ui` (no kui-ejs / KUInative parity work).
- **ED-K26 Back closes the drawer.** Opening is the only history step; moving between devices and filtering replace the URL.

**Tests.** `device/device-log.test.tsx` (12): the timeline, its summary and chips, compact; the Log tab through the adapter and its
filter, the `connections` alias, a host without `log`; the quick view's row click (not the name link), header and recent lines, push of
`?device`, ↑ / ↓ and Previous / Next with replace, Esc with focus on the row last shown, `initialQuery.device` opening and closing it and
a device off the page, live updates. `npx vitest run modules/domains/iot`: 8 files, 102 passed.
