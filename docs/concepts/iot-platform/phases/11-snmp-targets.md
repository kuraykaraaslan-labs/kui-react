# IoT 11: SNMP targets

**Goal:** the screens that turn SNMP agents (switches, UPSs, PDUs, printers, inverters) into platform devices (NB `iot_gateway/11`, owner decisions OD-45 and OD-59): an SNMP target list, a target editor (address, version and credentials, poll interval, who polls it), an OID → telemetry key mapping editor, a test poll that needs no MIB file, a view of received traps, and a plaintext warning for SNMPv2c. All adapter-driven and shown in the `/theme/iot` demo before NB vendors them.
**Effort:** M (~4–5 days).
**Depends on:** [00](00-api-adapter-layer.md) (adapter, demo adapter, mock live source); [01](01-device-management.md) (device detail tabs, profile editor, Online status group, "Add device" dialog); 9.9 (`KeyValueEditor`, enum maps), 9.10 (`SchemaForm`, OD-16), 9.11 (`useResource`, `useLiveData`), 9.12 (`StatusIndicator`), 9.14 (CSV export). See [`docs/phases/09-data-and-realtime-components.md`](../dev/phase-9-data-and-realtime-components.md).
**When:** after NB's 8 weeks (OD-45, OD-64), like [10](10-lorawan.md). (**→ OD-90:** the 8 weeks start only after NB's blockers are done, README calendar.)
**Demo routes:** `/theme/iot/snmp` (target list) · `/theme/iot/snmp/targets/new` · `/theme/iot/snmp/targets/[id]` (tabs through `?tab=target|mapping|test|traps`) · `/theme/iot/snmp/profiles/[slug]` (mapping editor of one SNMP profile) · `/theme/iot/snmp/traps` (trap receiver view) · `/theme/iot/devices/[slug]?tab=snmp` (the same target panel on the device detail) · (OD-78) the SNMP settings block in `/theme/iot/settings`.
**NB consumer:** `docs/new-iot-platform/iot_gateway/11-snmp-collector.md` (11.1 profile model and mapping, 11.2 router children, 11.3 cloud collector, v2c warning and test poll). **Router consumer:** `roltek-openwrt-dev` `docs/concepts/iot-platform/phases/07-gateway-mode.md` (SNMP child source, OD-59): the OpenWrt panel uses this phase as its **layout** reference for the targets it shows (KUI theme), the same way it follows [10](10-lorawan.md) for LoRaWAN.

> **→ DECISION OD-64 (owner, 2026-10-04):** the SNMP target panel is planned here, in kui-react, not as a one-off in NB (target list, OID → key mapping, v2c warning, test poll), after the 8 weeks. It replaces NB `iot_gateway/11`'s earlier proposal to add the panel to phase 01.
>
> **→ DECISION OD-59 (owner, 2026-10-04):** SNMP is polled **both ways**: a Roltek router polls agents in its LAN and reports them as **gateway children**, **and** the cloud polls **v2c and v3** directly. v2c only over a reachable path, preferably a VPN or tunnel, because the community string travels in plaintext; the UI warns. The router path is recommended where a router is on site. One target has exactly one poller.
>
> **→ DECISION OD-78 (owner, 2026-10-04):** refines OD-59: **cloud SNMPv2c is off by default**. A **tenant admin** enables it with a tenant setting, after a warning, and the change is written to the **audit log**; **v3 is always available** from the cloud. Router-polled v2c (LAN only) is not affected by the setting. UI: §11.2 "Version" (v2c disabled for the cloud until enabled) and §11.6 (the setting).

Background for the views (NB decisions, not re-decided here): an SNMP device has a device profile with transport `SNMP` whose `snmp` block holds the version defaults, poll timing and the **mapping** (OID rows, table rows, trap rows); the target (host, port, credentials, who polls) belongs to the device. The collector needs no MIB files: stored mappings are numeric OIDs; a tenant MIB index, if NB has one, only adds names and labels. Traps reach the platform through Roltek routers only (no public cloud trap listener, NB 11.3); a trap never raises an alarm by itself, it sets a key and an ordinary threshold rule decides (OD-29). **→ DECISION OD-79 / OD-87 / OD-88 (owner, 2026-10-04):** polled values and trap keys enter the cloud rule engine like any message: the default root flow saves them ("save telemetry") and its alarm evaluation applies the profile's rules; a tenant flow can raise alarms from them too. Nothing is stored unless a flow saves it.

## Adapter methods added

`snmp.targets.list(query)/get(id)/create(draft)/update(id, patch)/delete(id)`, `snmp.targets.activate(id)/deactivate(id)`, `snmp.targets.move(id, { polledBy })`, `snmp.targets.testPoll(idOrDraft, { oids? })`, `snmp.collector.info()` (cloud egress IPs, collector available yes/no), `snmp.pollers.list()` (the tenant's Roltek routers with gateway mode that can poll SNMP); `snmp.profiles.mapping.get(profileId)/update(profileId, mapping)` (returns the profile's `snmp` `FieldSchema` block plus the mapping rows), `snmp.profiles.expectedKeys(profileId, { sampleTargetId? })`; `snmp.traps.list(query)`; `snmp.oids.lookup(oids[])` (optional names from the tenant MIB index; an empty answer is normal). **→ DECISION OD-78 (owner, 2026-10-04):** `snmp.settings.get()` → `{ cloudV2cEnabled: boolean, changedBy?, changedAt? }` and `snmp.settings.update({ cloudV2cEnabled, acknowledgement })` (NB writes the audit record); `snmp.collector.info()` also returns `cloudV2cEnabled`.
Live topics: `snmpTarget('*' | id)` (reachable, last poll, last error, active), `snmpTraps({ scope: 'tenant' } | { targetId } | { pollerId })`.
Capabilities: `canManageSnmpTargets`, `canEditSnmpMapping`, `canViewSnmpTraps`. (OD-78) `canManageSnmpSettings` (tenant admin only).
Errors (standard `IotApiError` codes the views map to text): `limit_reached` (device limit, same as `devices.create`), `test_poll_failed` (with the poll error), `plaintext_ack_required`, `poller_conflict` (target active on another poller), `version_not_allowed` (v1, v3 `noAuthNoPriv`; **OD-78:** also v2c polled by the cloud while `cloudV2cEnabled` is false, with `reason: 'cloud_v2c_disabled'`).
Zod types in `modules/domains/iot/types/snmp.ts`: `SnmpTarget`, `SnmpCredentialState` (never a secret: v2c `{ communitySet: boolean }`, v3 `{ user, securityLevel, authProtocol, privProtocol, keysSet: boolean }`), `SnmpPolledBy` (`{ kind: 'cloud', path: 'VPN_TUNNEL' | 'DIRECT' }` | `{ kind: 'router', routerDeviceId, routerName }`), `SnmpMappingRow`, `SnmpTableMapping`, `SnmpTrapMapping`, `SnmpTestPollResult` (`ok`, `durationMs`, `varbinds: [{ oid, name?, type, value }]`, `error?`), `SnmpTrapRecord`.

## 11.1 Target list

- [ ] `SnmpTargetListView` on `ServerDataTable` (`/theme/iot/snmp`): columns name (device link), host:port (monospace, copy), version (`SnmpVersionBadge`: "v2c" / "v3 authPriv" / "v3 authNoPriv"), polled by (`SnmpPolledByChip`: "Cloud (VPN/tunnel)", "Cloud (direct)", "Router <name>"), profile, poll interval, state (`StatusIndicator`: reachable / unreachable since / disabled / not tested), last poll and its duration, last error (truncated, full text in a tooltip).
- [ ] `SnmpPlaintextBadge` ("Plaintext SNMP", error colour) on every v2c row polled from the cloud with `path = DIRECT`; a neutral "v2c" badge on v2c rows over a VPN/tunnel or a router.
- [ ] `FilterBar`: version, polled by (cloud / router, and which router), state, profile, "plaintext only"; free text on name and host; filters in the URL.
- [ ] Live: rows update from `snmpTarget('*')` (reachable flips, last poll, errors) without refetching.
- [ ] Targets configured **on a router's own panel** are listed with a "Configured on the router" tag and open read-only (NB 11.2).
- [ ] "Add SNMP target" opens the editor at `/theme/iot/snmp/targets/new`. Bulk actions (`BulkActionTable` pattern): activate, deactivate, export CSV (9.14, never secrets), delete (`Popconfirm`).
- [ ] Empty state: one line on the two ways ("Poll through a Roltek router on site (recommended) or from the cloud") with both actions.

## 11.2 Target editor

- [ ] `SnmpTargetEditorView` (`/theme/iot/snmp/targets/new`, `/theme/iot/snmp/targets/[id]?tab=target`), also mounted as the device detail tab `?tab=snmp` for devices whose profile transport is `SNMP` (phase 01 tab list gains `snmp`). `DetailHeader` on an existing target: name, host, `SnmpVersionBadge`, `SnmpPolledByChip`, `StatusIndicator`; actions: test poll, activate/deactivate, move, delete.
- [ ] Fields, rendered with `SchemaForm` (9.10) from the block the adapter returns so NB can add fields without a kui-react release:
  - **Device:** name, SNMP profile (select, link to its mapping), optional site (phase 08 picker when present).
  - **Address:** host (IPv4, IPv6 or DNS name; validated), port (default 161).
  - **Version:** `v2c` | `v3` (radio). v1 is not offered (NB: v1 is never polled; v1 **traps** are accepted on routers).
    **→ DECISION OD-78 (owner, 2026-10-04):** v3 is always available (and preselected for cloud-polled targets). While the tenant's `cloudV2cEnabled` is false (the default), the `v2c` option is **disabled when "Polled by" is the cloud**, with the reason "SNMPv2c from the cloud is off for this account. A tenant admin can enable it in SNMP settings." (link to §11.6 for `canManageSnmpSettings`, plain text otherwise); it stays enabled for router-polled targets. Switching "Polled by" from a router to the cloud on a v2c draft keeps the values but blocks Save with the same reason.
  - **v2c credentials:** community (password field; after save shown only as "set", with "Replace").
  - **v3 credentials:** user name; security level `authPriv` (default) | `authNoPriv` (inline warning "messages are signed but not encrypted") — `noAuthNoPriv` is not offered; auth protocol `SHA-256` / `SHA-512` / `SHA-1 (legacy)`; auth key; priv protocol `AES-128` / `AES-256` (hint: "AES-256 only if the agent supports it"); priv key. Keys are write-only like the community.
  - **Poll interval:** seconds with a unit suffix (min 10, placeholder = the profile's `pollIntervalS`, empty = use the profile's value), timeout and retries collapsed under "Advanced" with the profile values as placeholders.
  - **Polled by** (`SnmpPolledBySelector`): **"A Roltek router on site"** (select from `snmp.pollers.list()`; recommended badge; hint "community strings and keys stay in your LAN, traps work, polling continues during an internet outage") | **"The cloud"** with a second choice **path**: "Through a VPN or tunnel" (recommended) | "Directly over the internet". The cloud option shows the collector's egress IPs from `snmp.collector.info()` with copy ("allow these addresses in your firewall or VPN"). When the tenant has no router with gateway mode, the router option is disabled with that reason; when NB reports no cloud collector, the cloud option is disabled with that reason.
- [ ] **v2c plaintext warning banner** (`SnmpPlaintextWarning`, the generic `AlertBanner`, no one-off component): shown persistently whenever version = v2c, in the editor and on the device detail header:
  - over a router or a VPN/tunnel path: a warning-coloured banner "SNMPv2c sends the community string in plaintext. Poll only over a VPN or tunnel, or use SNMPv3 (authPriv), or poll through a Roltek router on site.";
  - with path "Directly over the internet": the same text as an **error-coloured** callout plus a required checkbox "I understand the community string crosses the internet in plaintext"; Save stays disabled until it is checked; the adapter sends the acknowledgement with the save (NB audits it with user and target) and returns `plaintext_ack_required` if it is missing;
  - when a router with gateway mode exists, the banner carries the action "Poll through router <name> instead" (prefills "Polled by").
- [ ] **Save = test first:** Save runs `snmp.targets.testPoll` with the draft (11.4). Success → the target is saved **active**. Failure → a dialog shows the poll error and offers "Save disabled" (saved with `active = false` and the error, NB 11.3 rule) or "Back to the form". Router-polled targets are tested by the router (the result arrives from it; "waiting for router <name>" while pending, timeout shown as a failure).
- [ ] **Move between pollers** ("Move" action, `Popconfirm`): explains "the target is deactivated on <old> before it is activated on <new>; one target has one poller"; shows progress (deactivated → tested → active) from the live topic; `poller_conflict` shows the NB error text.
- [ ] Device limit: creating a target creates a device, so `limit_reached` shows the shared "n of n devices used" message of phase 01 "Add device".
- [ ] Secrets never come back: after save the credential fields show "set" with "Replace"; no reveal action exists (NB: community strings and v3 keys never appear in API responses, logs or attributes).
- [ ] Router-configured targets (11.1) open in the same editor read-only, with "Configured on the router <name>; change it there".

## 11.3 Mapping editor (OID → telemetry key)

- [x] `SnmpMappingEditor` at `/theme/iot/snmp/profiles/[slug]`, also the "SNMP" section of the phase 01 profile editor for profiles with transport `SNMP` (replaces the "Transport / mapping" topic table there, as LoRaWAN does in [10](10-lorawan.md) §10.6); the target editor's `?tab=mapping` shows the profile's mapping read-only with "Edit in profile <name>" (`canEditSnmpMapping`).
- [x] **Scalar rows** (`SnmpMappingRow` table editor): OID (numeric, validated; name from `snmp.oids.lookup` shown beside it when known), key (validated against the profile's key rules), kind `telemetry` | `attribute`, **type** `gauge` | `counter32` | `counter64` | `timeticks` | `string` | `enum` | `ipaddr`, **scale** (multiplier, e.g. `0.1`; with a live "raw 235 → 23.5" preview from the last test poll), unit, **rate** toggle (only for counters: "per second, first sample after start is skipped, wrap handled"), enum map (9.9 `KeyValueEditor`, only for `enum`), optional per-row interval.
- [x] **Table rows** (`SnmpTableMappingEditor`): base OID, index by (a column OID or "index"), columns (each like a scalar row), row cap (default 64); a preview "keys look like `if.in_bps.eth0`".
- [x] **Trap rows** (`SnmpTrapMappingEditor`): trap OID, key, value ("1" or "from varbind"), varbind → key rows. A hint: "a trap sets a key; add an alarm rule on that key to raise an alarm".
- [x] **Expected key count** before save (`snmp.profiles.expectedKeys`, optionally against a sample target): "this mapping produces ~412 keys per device" with a warning above the profile's key limit (NB risk: a 48-port switch × 10 columns).
- [x] "Add from test poll": rows of a test-poll result (11.4) can be added to the mapping in one click with OID, a suggested key and the detected type.
- [x] Templates: profiles copied from NB's SNMP templates (MIB-II + IF-MIB, HOST-RESOURCES-MIB, UPS-MIB, Printer-MIB) open with their rows and the "from template" hint of phase 01; editing makes it the tenant's own mapping.
- [x] The profile's Online status group (phase 01 §1.4, OD-57/OD-63) stays visible for SNMP profiles; nothing is preselected (OD-63); for cloud-polled targets "Live connection" is disabled with the reason "the cloud polls this device; there is no connection to hold".

> **Built 2026-11-04 (NB iot_gateway 11, the profile's SNMP tab).** `modules/domains/iot/snmp`: `SnmpMappingEditor` (values, tables and traps,
> each a kit DataTable whose row opens a drawer; a table's columns are edited in the same drawer, never a drawer over a drawer; Remove asks
> through the kit ConfirmDialog), `SnmpMappingView` (the draft with one Save, a refused save marks the rows the host named, the test poll in a
> drawer from the header) and the pure rules in `snmp/types.ts`, which mirror NB's `snmp.profile.ts` (numeric OIDs, the key rule
> `^[A-Za-z][A-Za-z0-9_.:-]{0,95}$`, rate only on counters, enum maps, duplicate keys and OIDs, the key budget 200 telemetry / 50 attributes).
> Adapted to NB: the editor is mounted as the profile page's SNMP tab (NB has no SNMP target screen yet, so no `?tab=mapping` on a target);
> a table has no separate base OID (each column OID is walked); no per-row interval (OD-65: profile-only); no `snmp.oids.lookup` name beside an
> OID (OD-66); the expected key count is computed from the draft as NB's `keyBudget` does (no sample target). The Online status item is
> covered by the profile editor: a polled transport allows only "Last seen only", the other rules disabled with the reason.

## 11.4 Test poll (MIB-free)

- [x] `SnmpTestPollPanel` (`?tab=test` on a target, and inline in the editor before save): runs `snmp.targets.testPoll` with the default system OIDs (`sysUpTime.0`, `sysObjectID.0`, `sysDescr.0`, `sysName.0`) or the OIDs the user types / pastes (numeric, one per line) or "all OIDs of this profile's mapping".
- [x] Result table: OID, name (only when the adapter knows it; never required), SNMP type, raw value, and for mapped OIDs the mapped key with the scaled value; poll duration; per-OID errors (`noSuchObject`, `noSuchInstance`, timeout, auth failure for v3 shown as "authentication failed (check user and keys)", not the agent's raw text).
- [x] Works with **no MIB file** anywhere: numeric OIDs in, numeric OIDs out. A one-line note says so.
- [ ] "Who ran it": "tested from the cloud collector (egress IP x)" or "tested by router <name>".
- [x] Rate limit feedback: when NB refuses a test poll because of the per-target or per-tenant rate limit, the panel shows the retry time instead of an error.

> **Built 2026-11-04 (NB iot_gateway 11).** `SnmpTestPollPanel`: a device of the profile (one bound to an SNMP endpoint; the host polls with
> the endpoint's stored credentials), typed or pasted numeric OIDs (at most 64), the system group or the draft's values; a kit DataTable of the
> answer (OID, the host's name when it has one, SNMP type, raw value, the mapped key with the scaled value, per-OID exceptions), the duration,
> the endpoint's warnings, failures in words, a rate limit as "try again in n s" (`SnmpTestPollRetry`), and "Add to mapping" with a suggested
> key and the detected type. Not built: "Who ran it" (NB polls from the cloud collector only; its egress addresses are not served yet).

## 11.5 Trap receiver view

- [ ] `SnmpTrapListView` at `/theme/iot/snmp/traps` and as `?tab=traps` on a target: a capped (1 000 rows) live list from `snmpTraps({ scope: 'tenant' })` / `({ targetId })`: time, source agent (target link, or "unknown agent <ip>" when no target matches), receiving router, version (v1 / v2c / v3), trap OID (with name if known), varbinds count, mapping result (`mapped` → the keys it set, `unmapped`, `dropped` with the reason).
- [ ] Filters: router, target, trap OID, result; pause/resume (paused rows counted, not inserted); row → `Drawer` with all varbinds (OID, type, value) and the keys set; first paint from `snmp.traps.list`.
- [ ] "Map this trap" on an unmapped row prefills a trap row in the profile's mapping editor (11.3).
- [ ] An explanation line at the top: "Traps are received by your Roltek routers (UDP 162 in the LAN). The cloud has no public trap listener." When the tenant has no router with gateway mode, the view shows that as its empty state.
- [ ] v2c traps carry the same plaintext warning mark as v2c targets (`SnmpPlaintextBadge` on the row's version).

## 11.6 Cloud SNMPv2c tenant setting (OD-78)

**→ DECISION OD-78 (owner, 2026-10-04):** cloud SNMPv2c is off by default; a tenant admin enables it with a warning and an audit record; v3 is always available.

- [ ] `SnmpSettingsPanel` (tenant-level block, `canManageSnmpSettings`; in the demo inside `/theme/iot/settings`, beside the OD-10 alarm block): a `Toggle` "Allow SNMPv2c polling from the cloud", **off by default**, with the state line "Off — cloud targets must use SNMPv3" or "On since <date>, enabled by <user>".
- [ ] Turning it **on** opens a confirm `Modal` with the warning (the generic `AlertBanner`, error tone): "SNMPv2c sends the community string in plaintext. From the cloud it crosses the internet unless you poll over a VPN or tunnel. SNMPv3 (authPriv) or a Roltek router on site is safer." plus a required checkbox "I understand and accept this for the whole account"; confirm stays disabled until it is checked. On success a toast says "Recorded in the audit log"; the acknowledgement travels with `snmp.settings.update` and NB writes the audit record (user, time, old/new value).
- [ ] Turning it **off** asks for confirmation and states how many cloud-polled v2c targets exist ("3 cloud targets use SNMPv2c"); what happens to them follows NB `iot_gateway/11` (the panel shows the adapter's answer, e.g. "they will be deactivated"); the change is audited the same way.
- [ ] The setting gates §11.2: the `v2c` option for cloud polling, "Move" of a v2c target from a router to the cloud (blocked with the same reason while off), and `version_not_allowed` / `cloud_v2c_disabled` mapped to that reason text. Router-polled v2c and v2c traps on routers are never gated.
- [ ] Users without `canManageSnmpSettings` see the setting read-only with "Ask a tenant admin".

## Demo data

The demo adapter seeds: 2 Roltek routers with gateway mode (one with 4 router-polled targets including one "configured on the router", one with none), 3 cloud-polled targets (v3 `authPriv` over a VPN/tunnel, v2c over a VPN/tunnel, v2c **direct** with the acknowledgement on record), 1 disabled target whose test poll failed (timeout), SNMP profiles copied from the four NB templates plus one tenant profile with a 48-port IF-MIB table (to show the expected key count warning), a mock test-poll responder (deterministic values for the system OIDs and the template OIDs; an "auth failed" agent and a "timeout" agent), and a mock `snmpTraps` source (UPS on-battery and back, link down/up, one unknown agent, one unmapped trap). Secrets in the demo are placeholders and never rendered.
**→ DECISION OD-78 (owner, 2026-10-04):** the demo tenant starts with cloud v2c **enabled** and one seeded audit entry (so the two seeded cloud v2c targets are valid); a second seeded demo workspace with the setting **off** (the default) has no cloud v2c target and shows the gated editor.

## Showcase

New Domain entries (each with a data and an empty/error variant): `SnmpTargetListView`, `SnmpTargetEditorView`, `SnmpPolledBySelector` (router, cloud VPN, cloud direct), `SnmpPlaintextWarning` (warning and error variants), `SnmpPlaintextBadge`, `SnmpVersionBadge`, `SnmpPolledByChip`, `SnmpMappingEditor`, `SnmpTableMappingEditor`, `SnmpTrapMappingEditor`, `SnmpTestPollPanel` (success, partial errors, failure), `SnmpTrapListView`. (OD-78) `SnmpSettingsPanel` (off, enabling with the warning, on with audit line, read-only).

## NB follow-ups (reported, not decided here)

- ~~A per-target poll-interval override next to the profile's `pollIntervalS` (11.2 "Poll interval"); if NB keeps the interval profile-only, the field becomes read-only with a link to the profile.~~ **→ DECISION OD-65 (owner, 2026-10-04):** profile-only. The target editor shows the profile's interval **read-only** with a link to the profile; no override field.
- `snmp.oids.lookup` depends on NB's optional tenant MIB index (NB 11.1 "MIB upload"); the MIB upload screen itself is not part of this phase. **→ DECISION OD-66 (owner, 2026-10-04):** MIB upload comes in a later release; the first release uses hand-typed numeric OIDs with the MIB-free test poll (11.4), and `snmp.oids.lookup` returns labels only from the built-in templates.

## Definition of done

- In the demo: add a cloud-polled v3 target over a VPN/tunnel; the test poll runs on Save and the target becomes active; its credentials show only "set" afterwards.
- (OD-78) In the second demo workspace (setting **off**): a cloud-polled draft has `v2c` disabled with the "off for this account" reason, router-polled drafts can still choose v2c, and moving a router v2c target to the cloud is blocked. Enable the setting as a tenant admin: the warning modal requires the checkbox, the toast confirms the audit record, and the state line names the user and date; a non-admin sees the setting read-only.
- (On a tenant with cloud v2c enabled) switch a draft to v2c: the warning banner appears; choose "Directly over the internet": the banner turns error-coloured and Save stays disabled until the acknowledgement is checked; the saved row shows the "Plaintext SNMP" badge in the list and on the device detail.
- Save a target against the "timeout" agent: the failure dialog offers "Save disabled", and the row shows disabled with the error.
- Move a cloud target to a router: the progress shows deactivated → tested → active, and the list's "Polled by" changes; the router-configured target opens read-only.
- In a profile's mapping editor: add a scalar row with type `gauge` and scale `0.1` and see the scaled preview; add a counter with rate on; add rows from a test poll in one click; the 48-port profile shows the expected key count warning.
- Test poll a target with typed numeric OIDs and no MIB: the table shows OID, type and value; the "auth failed" agent shows the friendly v3 message.
- The trap view shows the seeded UPS traps as `mapped` with the keys they set, the unknown agent and the unmapped trap; "Map this trap" prefills a trap row; pause and filters work and survive navigation.
- A new blank SNMP profile has no online rule preselected (OD-63) and "Live connection" is disabled for cloud-polled use.
- Every route above renders from the demo adapter (no `iot.data.ts` import in a page), has loading/empty/error states reachable from `/theme/iot/settings`, is in the route smoke test, and shows no console errors.
