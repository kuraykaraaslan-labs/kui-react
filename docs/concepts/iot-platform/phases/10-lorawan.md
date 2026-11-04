# IoT 10: LoRaWAN

**Goal:** the screens of the cloud LoRaWAN network server (NB `iot_lorawan`, owner decisions OD-46…OD-49): a gateways list with a map, a gateway detail with stats, a LoRa tab on the device detail (~~reception per gateway, RSSI/SNR history~~ latest reception per gateway, live — OD-103; frame counters, join state) and a live frames view, all adapter-driven and shown in the `/theme/iot` demo before NB vendors them.
**Effort:** M–L (~6–8 days).
**Depends on:** 00 (adapter, demo adapter, mock live source); 01 (device detail tabs, profile editor, add-device dialog); 02 (charts on telemetry); 9.1/9.2 (native `Chart` time axis and zoom, OD-15), 9.5 (rolling live window), 9.7 (`TimeRangePicker`), 9.8 (`MapView` live markers, clustering), 9.10 (`SchemaForm`, OD-16), 9.11 (`useResource`, `useLiveData`), 9.12 (`StatusIndicator`), 9.13 (QR scanner for TR005 device QR codes), 9.14 (CSV export).
**Demo routes:** `/theme/iot/lorawan/gateways` (table, `?view=map` for the map) · `/theme/iot/lorawan/gateways/[eui]` (tabs through `?tab=overview|stats|devices|connections|relays|credentials`) · `/theme/iot/lorawan/frames` · `/theme/iot/devices/[slug]?tab=lorawan` · `/theme/iot/device-profiles/[slug]` (LoRaWAN section) · `/theme/iot/lorawan/codecs`.
**NB consumer:** `docs/new-iot-platform/iot_lorawan/` (13 mounts the views; 08 defines the envelope ~~and the reception history~~ and the live latest reception, OD-103; 11 the gateway health keys).

> **→ DECISION OD-53…OD-57, OD-60 (owner, 2026-10-04):** ~~a Roltek gateway may also run in **mixed mode** — its own local LNS for its devices plus the cloud LNS for every other device (OD-53, gateway list/detail below);~~ LoRa gateways and LoRa devices count as devices and uplinks as messages (OD-54: "Add gateway" can hit the device limit); first release LoRaWAN 1.0.x + EU868 only (OD-55: the profile panel offers nothing else); RX1 delay 5 s by default for cloud profiles (OD-56); "online" is a generic device-profile setting (OD-57: the LoRa profile panel no longer owns the expected interval, phase 01 §1.4 does); Basics Station CUPS is later and optional (OD-60: §10.8, marked later).
>
> **→ DECISION OD-86 (owner, 2026-10-04):** **no mixed mode** — a gateway (and its devices) is either **cloud** (the roaming "mesh" of the cloud LNS) or **local** (its own LNS); this **reverses OD-53**. Every mixed-mode item below (type, badge variant, filter value, `LoraMixedModeCard`, device hints, demo gateway, showcase entries, acceptance criterion) is struck; switching a gateway between cloud and local stays on the router's own panel.
>
> **→ DECISION OD-83 (owner, 2026-10-04):** customer-writable codecs exist **only for LoRaWAN** (decoder and encoder per profile) in **roltek-lns's existing codec format** (declarative `tlv` / `layout` tables, `feed/roltek-lns/CODEC-CATALOG.md` in `roltek-openwrt-dev`), not the TTN Device Repository / TTN JavaScript format. LoRa uplinks go from the cloud LNS **straight into the rule engine** (NB `iot_automation`, README §Cloud rule engine in the MVP); other non-native data is decoded on the router or in a flow's script block, so no converter UI exists for MQTT, HTTP or BLE.
>
> **→ DECISION OD-90 (owner, 2026-10-04):** "after wk 8" (README order table) counts from the start of NB's 8 weeks, which begin only after NB's blockers are done.
>
> **→ DECISION OD-103 (owner, 2026-10-04):** **no LoRa reception-history table** in NB (OD-87 holds: only a flow's save nodes store data). The device LoRa tab shows only the **latest reception, live** (one row per receiving gateway of the last uplink, from `loraFrames({ deviceId })`); RSSI/SNR history exists only if a tenant flow saves the `lora.*` keys, and then it is shown by the ordinary telemetry charts (phase 02), not by a LoRa-specific chart. The gateway "Devices heard" tab likewise lists only devices in the recent live frames. Struck below: `lorawan.devices.reception`, the hourly rollup, the range-based reception columns and `LoraSignalHistoryChart`.
>
> **→ DECISION OD-106 (owner, 2026-10-04):** the **first LoRa release is decoder only**. Downlinks are sent as raw hex/base64 ("Send downlink", `lora.downlink`); the encoder (command templates in the roltek-lns format) comes **later**. OD-83's "decoder and encoder per profile" applies to that later release; the encoder items of 10.7 are kept, marked later.

Background for the views (NB decisions, not re-decided here): a gateway connects over the **Roltek link** or **Basics Station** (OD-49), in **cloud mode** or **local mode** (OD-47) ~~(**OD-53:** or **mixed mode**)~~ (**OD-86:** never both); the cloud de-duplicates an uplink heard by several gateways and lists every receiving gateway in `metadata.rx[]` (gateway, RSSI, SNR, frequency, DR, time, relay path) and sends each downlink through the best gateway (OD-46); only the tenant's own gateways count (OD-48). The OpenWrt panel (`roltek-openwrt-dev` `docs/phases/39-lorawan/`) uses kui-react as its **layout** reference for the same ideas (packet row, duty-cycle gauge, destination status card); its components live in `modules/domains/iot/lorawan/` here so both follow one design.

## Adapter methods added

`lorawan.gateways.list(query)/get(id)/create/update/delete`, `lorawan.gateways.credentials.issue(id, { kind: 'token' | 'certificate', csr? })/rotate(id)`, `lorawan.gateways.stationConfig(id)` (file download), `lorawan.gateways.stats(id, range)`, ~~`lorawan.gateways.devicesHeard(id, range)`~~ `lorawan.gateways.devicesHeard(id)` (recent live frames only, OD-103), `lorawan.gateways.connections(id, query)`, `lorawan.gateways.pendingRelays(id)/acceptRelay(id, eui)`; `lorawan.devices.get(deviceId)` (LoRa state), ~~`lorawan.devices.reception(deviceId, range, gatewayId?)`~~ (OD-103: struck; the latest reception comes from `loraFrames({ deviceId })` and the last frame of `lorawan.devices.frames`), `lorawan.devices.frames(deviceId, query)`, `lorawan.devices.resetSession(deviceId)`, `lorawan.devices.revealKeys(deviceId)`; `lorawan.frames.list(query)`; `lorawan.profiles.settings.get/update(profileId)` (returns a `FieldSchema` block); `lorawan.codecs.list/get/save/delete/test`.
Live topics: `loraFrames({ scope: 'tenant' } | { gatewayId } | { deviceId })`, `loraGateway('*' | id)`.
Capabilities: `canManageGateways`, `canRevealLoraKeys`, `canManageCodecs`, `canViewFrames`.
~~**→ DECISION OD-53 (owner, 2026-10-04):** `LoraGateway.mode` is `'cloud' | 'local' | 'mixed'`; a mixed gateway carries `localBlock` (DevAddr prefix, e.g. `01005000/20`) and `LoraGatewayStats.local` (`devices`, `uplinksLocal`, `uplinksForwarded`, `ownBlockUnknown`, `downlinksLocal`; absent for other modes).~~ **→ DECISION OD-86 (owner, 2026-10-04):** `LoraGateway.mode` is `'cloud' | 'local'`; no `localBlock`, no `LoraGatewayStats.local`. **OD-54:** `lorawan.gateways.create` and `acceptRelay` can fail with the adapter's standard limit error (`{ code: 'limit_reached', used, limit }`, the same one `devices.create` returns).
Zod types in `modules/domains/iot/types/lorawan.ts`: `LoraGateway`, `LoraGatewayStats`, `LoraRx` (the NB `metadata.rx[]` entry without the internal context), `LoraDeviceState`, `LoraReceptionRow` (**OD-103:** one gateway of the latest uplink: gateway, time, RSSI, SNR, DR, relay path, chosen for downlink; no range aggregates), `LoraFrame` (with `result`: `processed` | `merged` | `late` | `buffered` | `dropped` and a `reason`).

## 10.1 Gateways list

- [ ] `LoraGatewayListView` on `ServerDataTable`: columns name, EUI (monospace, copy), protocol (`LoraProtocolBadge`: "Roltek link" / "Basics Station"), mode (`LoraGatewayModeBadge`: "Cloud" / "Local LNS"), status (`StatusIndicator`: connected since / last seen), round trip (ms, amber above 800), uplinks and downlinks in the last hour, highest duty-cycle use, region, location set yes/no.
- [ ] `FilterBar`: status, protocol, mode, region, "has location"; free text on name/EUI; filters in the URL.
- [ ] Live: rows update from `loraGateway('*')` (connect, disconnect, stats deltas) without refetching.
- [ ] "Add gateway" dialog (third-party gateways only): EUI (16 hex, validated), name, auth "Token" (default) or "Client certificate" (CSR upload or "generate"); on success the token is shown **once** with copy and a "Download Basics Station config" button. Roltek gateways are not added by hand: the empty state and a hint explain that a claimed Roltek router appears here when it is switched to cloud mode on its own panel.
- [ ] An EUI already registered elsewhere shows the NB error ("This EUI is registered to another account") without any detail.
- [ ] Unlimited gateways (OD-46): no quota bar; paging handles large lists.
- [ ] **→ DECISION OD-54 (owner, 2026-10-04):** gateways count toward the tenant's device limit: when `create` returns `limit_reached`, the dialog shows the same "n of n devices used" message and upgrade hint as phase 01 "Add device" (shared component, no LoRa-specific text). Still no gateway quota bar.
- [ ] ~~**→ DECISION OD-53 (owner, 2026-10-04):** `LoraGatewayModeBadge` gets a third variant **"Local LNS + cloud"** (mixed), visually the local badge with a cloud mark; the mode filter offers Cloud / Local LNS / Local LNS + cloud.~~ **→ DECISION OD-86 (owner, 2026-10-04):** struck; `LoraGatewayModeBadge` has two variants ("Cloud", "Local LNS") and the mode filter offers Cloud / Local LNS only.

## 10.2 Gateway map

- [ ] `LoraGatewayMapView` (same route, `?view=map`, `ViewToggle` with the table): `MapView` markers coloured by state (connected / disconnected / never connected), clustering, a popover with name, protocol, mode, round trip and uplinks/h, link to the detail.
- [ ] Relay gateways drawn with a dashed line to their border; pending relays as hollow markers.
- [ ] "Show coverage of a device": pick a device → lines from its last uplink's receiving gateways, thickness by SNR, the gateway chosen for the last downlink highlighted. Live: lines move when the device roams (`loraFrames({ deviceId })`).
- [ ] Gateways without a location are listed in a side panel ("No location"), never drawn at 0,0.

## 10.3 Gateway detail

- [ ] `LoraGatewayDetailView`: `DetailHeader` (name, EUI with copy, `LoraProtocolBadge`, `LoraGatewayModeBadge`, `StatusIndicator`; actions: edit, rotate credentials, download Station config (Basics Station only), delete with `Popconfirm`) and `TabGroup`, tab in the URL.
- [ ] **Overview:** identity card (model, firmware, Station or Roltek version, region, protocol, connected since, location with a small map); KPI `StatCard`s: round trip, uplinks/h, share of uplinks where it was the only gateway, downlinks served, TX failure %, temperature and offline-buffer depth (Roltek link only).
- [ ] ~~**→ DECISION OD-53 (owner, 2026-10-04) — mixed-mode display:** for `mode = 'mixed'` the Overview adds a `LoraMixedModeCard`: a one-line explanation ("Devices registered on this gateway stay on its local LNS; every other device is sent to the cloud"), the local DevAddr block, local devices count (link to the router's children list), uplinks handled locally vs forwarded to the cloud (a two-segment bar over the selected range), "own-block unknown" drops, local downlinks, and the number of devices moved to the cloud that still use a local address. The Stats tab gains "local vs forwarded uplinks" as a stacked series and shows the duty-cycle meter with the gateway's **reported** use (local + cloud), labelled so. The header's mode badge uses the "Local LNS + cloud" variant. Local and cloud modes show no such card.~~ **→ DECISION OD-86 (owner, 2026-10-04):** struck; there is no `LoraMixedModeCard` and no "local vs forwarded" series; the Overview is the same for cloud and local gateways.
- [ ] **Stats:** native `Chart` series over a `TimeRangePicker` range: uplinks and downlinks, round trip, TX results (sent / failed by reason / unknown), `LoraDutyCycleMeter` per sub-band (used % of the hourly budget, warning at 80 %). Metrics a Basics Station gateway does not report render as an empty state "Not reported by this gateway", never as zero.
- [ ] ~~**Devices heard:** table from the hourly reception rollup: device, last heard, frames, avg/min/max RSSI, avg SNR, share chosen for downlink; row → device LoRa tab.~~
  **→ DECISION OD-103 (owner, 2026-10-04):** **Devices heard** lists the devices in the gateway's recent live frames (no rollup, no range): device, last heard, last RSSI/SNR, chosen for the last downlink yes/no; updates live from `loraFrames({ gatewayId })`; row → device LoRa tab.
- [ ] **Connections:** `Timeline` of connect / disconnect / taken over / kicked with reasons.
- [ ] **Relays** (border gateways only): accepted relays (EUI, last heartbeat, link RSSI/SNR, hops) and pending ones with "Accept" (`canManageGateways`).
- [ ] **Credentials:** token (masked, rotate) or certificate (subject, fingerprint, validity, issuer; never a private key); Roltek gateways show "Authenticated with the router's device certificate" and a link to the router device.
  **→ DECISION OD-60 (owner, 2026-10-04):** for Basics Station gateways the tab says "Configure the gateway once with the LNS URL and token (Download Basics Station config)"; rotating the token warns "the gateway stays disconnected until you put the new token on it". No CUPS fields (§10.8 is later).

## 10.4 Device LoRa tab

- [ ] `LoraDeviceTab` at `/theme/iot/devices/[slug]?tab=lorawan` (registered as a device tab, phase 01 tab list gains `lorawan` for devices whose profile transport is LoRaWAN):
  - **Identity and join state card:** DevEUI, JoinEUI, DevAddr, class, MAC version, region, LNS (`LoraGatewayModeBadge` "Cloud LNS" / "Local LNS" with the owning router), codec, last join; `LoraJoinStateBadge` with the NB states: never joined, join MIC failed (wrong AppKey?), DevNonce replay, joined, silent (no uplink for N × the expected interval), offline.
    **→ DECISION OD-57 (owner, 2026-10-04):** "N × the expected interval" is the profile's generic online rule (phase 01 §1.4 "Online status": expected interval × factor); for a `LAST_SEEN_ONLY` profile the badge never shows "silent"/"offline", only "last seen". ~~**→ DECISION OD-53:** a device on the local LNS of a mixed gateway shows "Local LNS" with the router and a "mixed gateway" hint; a cloud device that is still on a local address after a move shows "Cloud LNS — rejoin pending for a cloud address".~~ **→ DECISION OD-86 (owner, 2026-10-04):** no mixed gateways, so no "mixed gateway" hint; the LNS line shows only "Cloud LNS" or "Local LNS" with the owning router.
  - **Frame counters:** `LoraFrameCounters`: FCnt up, FCnt down, last confirmed uplink and whether it was ACKed, retransmissions seen, frames missed (FCnt gaps) in the range, ADR state (current DR / TX power, last change).
  - ~~**Reception per gateway:** `LoraReceptionTable`: gateway, last heard, frames in range, avg/min/max RSSI, avg SNR, last DR, times chosen for downlink, `LoraRelayPathChip` when heard through a relay; sorted by last heard so roaming is visible at a glance.~~
  - ~~**RSSI / SNR history:** `LoraSignalHistoryChart` (native `Chart`, 9.1/9.2): one series per gateway (top 5 by frames, the rest folded into "other gateways"), RSSI/SNR toggle, zoom; ADR changes and joins as annotations; range from the shared `TimeRangePicker`.~~
  - **→ DECISION OD-103 (owner, 2026-10-04) — Latest reception:** `LoraReceptionTable` shows the **last uplink only**, live: one row per receiving gateway (gateway, time, RSSI, SNR, DR, frequency, chosen for downlink, `LoraRelayPathChip` when heard through a relay), replaced on every new uplink from `loraFrames({ deviceId })`; no range, no averages. Below it a one-line note: "Reception history is kept only if one of your flows saves the `lora.*` keys" with a link to the device's telemetry charts (phase 02) when such keys exist. No `LoraSignalHistoryChart`.
  - **Recent frames:** this device's `LoraFrameRow`s (same component as 10.5) with live updates.
  - **Downlink queue:** pending LoRa downlinks (link to the phase 04 RPC console with `lora.downlink` prefilled). **OD-106:** "Send downlink" takes FPort, confirmed, and the payload as raw hex or base64 only; no command picker until the encoder release.
- [ ] Actions: "Reset session" (`Popconfirm`: "the device must join again"), "Reveal keys" (`canRevealLoraKeys`, announces that the reveal is audited), "Send downlink".
- [ ] Phase 01 "Add device" dialog: when the chosen profile is LoRaWAN, show DevEUI, JoinEUI, AppKey or "use the profile's key", class, codec, and "Scan device QR" (TR005 `LW:D0:…` through 9.13) that fills DevEUI/JoinEUI.

## 10.5 Live frames view

- [ ] `LoraLiveFramesView` at `/theme/iot/lorawan/frames`: a capped (1 000 rows) live list of `LoraFrameRow`: time, direction/type (uplink, confirmed uplink, join request, join accept, downlink), device (DevEUI or DevAddr → device link), FCnt, FPort, DR and frequency, receiving gateways (count + best RSSI/SNR, `LoraRelayPathChip`), result (`processed`, `merged` copy count, `late`, `buffered`, `dropped` with the reason: unknown DevAddr, MIC failed, replay, foreign device — the last one never shows foreign ids), decoded preview.
- [ ] Filters: gateway, device, type, result; pause/resume (paused rows keep arriving in a counter, not in the list); row → `Drawer` with the full `rx[]` table, decoded keys, MAC commands, raw hex.
- [ ] Export the visible rows as JSON/CSV (9.14).
- [ ] Live through `loraFrames({ scope: 'tenant' })`; the first paint comes from `lorawan.frames.list` (last frames).

## 10.6 Profile LoRaWAN section

- [ ] `LoraProfileSettingsPanel` in the phase 01 profile editor for LoRaWAN profiles: the `FieldSchema` block the adapter returns (region, class, RX1 delay, RX2, ADR limits, de-dup window, shared AppKey masked, pairing mode with a countdown, codec, ~~expected uplink interval,~~ "store radio keys"), so NB can add fields without a kui-react release. The "Transport / mapping" section of phase 01 is replaced by "LoRaWAN" for these profiles (no topic table).
- [ ] **→ DECISION OD-57 (owner, 2026-10-04):** the expected interval is no longer a LoRa field: the profile's generic "Online status" group (phase 01 §1.4) stays visible for LoRaWAN profiles ~~with "Recent message" preselected~~ and "Live connection" disabled ("LoRaWAN devices have no live connection"); the LoRa panel shows the effective rule as one read-only line with a link to that group.
  **→ DECISION OD-63 (owner, 2026-10-04):** nothing is preselected for LoRaWAN either: a blank LoRaWAN profile starts with no rule and must choose "Recent message" or "Last seen only" (phase 01 §1.4); a profile from a LoRaWAN template shows the template's stored rule. Until a rule is chosen, the LoRa panel's read-only line says "Online rule not chosen yet" with the same link.
- [ ] **→ DECISION OD-55 / OD-56 (owner, 2026-10-04):** region shows EU868 only and MAC version 1.0.2 / 1.0.3 / 1.0.4 only (the adapter's schema lists the allowed values; no hard-coded "coming soon" entries); RX1 delay defaults to 5 s with the hint "cloud default; sent to the device when it joins; shorter delays only for low-latency gateways".
  **→ DECISION OD-61 (owner, 2026-10-04):** the next region is AS923 (AS923-1…4). Nothing changes here now: the region select already shows only what the adapter's schema lists, so AS923-1…4 appear when NB enables them; no "coming soon" entry is added.

## 10.7 Codec library

> **→ DECISION OD-83 (owner, 2026-10-04):** the codec format is **roltek-lns's existing format** (declarative `tlv` / `layout` JSON tables, the same files the router's LNS uses), which the table below already follows; no TTN Device Repository format, no TTN-style JavaScript `decodeUplink`/`encodeDownlink`, no TTN import. Codecs are per profile and cover the **decoder and the encoder** (**→ OD-106:** decoder only in the first release; the encoder comes later); customer-writable codecs exist only here (LoRaWAN). ⚠️ roltek-lns decodes uplinks only today (downlinks are hex, `encodeDownlink` not used, its README "Known limits"); the encoder half of the format has to be defined there first.

- [ ] `LoraCodecLibraryView` at `/theme/iot/lorawan/codecs`: table of built-in and tenant codecs (id, title, vendor, models, FPorts, kind `tlv`/`layout`, origin, verified, devices using it); detail with the table JSON (monospace field with validation errors from the adapter), "Save a copy" for built-ins, and a test bench (FPort + hex → decoded keys, warnings, errors) plus the codec's own test vectors with pass/fail.
- [ ] No script editing: the UI never offers a JavaScript codec (NB decision LW10, same rule as the gateway).
- [ ] ~~(OD-83) Encoder side: when roltek-lns defines the encoder tables, the codec detail gets an "Encoder" section in the same format and the test bench a reverse mode (keys → FPort + hex); until then the section shows "Downlinks are sent as hex" and `lorawan.codecs.test` covers uplinks only. The profile's codec select (10.6) picks one codec for both directions.~~
  **→ DECISION OD-106 (owner, 2026-10-04):** release one is decoder only: the codec detail shows a single line "Downlinks are sent as raw hex or base64" (no "Encoder" section), `lorawan.codecs.test` covers uplinks only, and the profile's codec select (10.6) picks the decoder only.
- [ ] **Later (OD-106):** when roltek-lns defines the encoder tables, the codec detail gets an "Encoder" section in the same format, the test bench a reverse mode (keys → FPort + hex), and the profile's codec select covers both directions.
- [ ] (OD-83) The live frames view's decoded preview (10.5) and the device LoRa tab say where the decoded keys go: "decoded keys enter your flows (rule engine)"; nothing here stores them directly (OD-87: only a flow's "save telemetry" does).

## 10.8 Basics Station CUPS (later, optional)

**→ DECISION OD-60 (owner, 2026-10-04; planner's default, owner may change):** **later and optional — not part of this phase's definition of done.** Packet forwarding needs no gateway management: a Basics Station gateway is configured once with the LNS URL and token (10.1 "Download Basics Station config", 10.3 Credentials). CUPS would only add remote rotation of the gateway's credentials and LNS URI; firmware through CUPS would be vendor-signed only.

When it is scheduled (no tasks now), the design lands here first: a "Remote management (CUPS)" card on the Basics Station gateway's Credentials tab (CUPS URI, CUPS credential state, last CUPS check-in, pending credential/URI update with its status), a "Rotate remotely" action that replaces the manual-token warning of 10.3, and a read-only "vendor firmware offered" row (signed package name and signer; no upload of unsigned firmware). Adapter methods would be `lorawan.gateways.cups.get/rotate(id)`; none exist yet.

## Demo data

The demo adapter seeds: ~~6~~ ~~7~~ 6 gateways (**OD-86**) (3 Roltek link with locations, 2 Basics Station, 1 local-mode router~~, **1 mixed-mode router (OD-53) with 6 local devices and a forwarded/local traffic mix**~~), one border with one accepted and one pending relay, 20 LoRa devices heard by 1–4 gateways each, one device that roams along a path every few minutes, and a mock `loraFrames` source that emits multi-gateway copies, late copies, a buffered burst after a simulated outage, and dropped frames of each reason.

## Showcase

New Domain entries (each with a data and an empty/error variant): `LoraGatewayListView`, `LoraGatewayMapView`, `LoraGatewayDetailView`, `LoraDutyCycleMeter`, `LoraProtocolBadge`, `LoraGatewayModeBadge` (cloud, local~~, **mixed — OD-53**~~; OD-86), ~~`LoraMixedModeCard` (**OD-53**),~~ `LoraJoinStateBadge`, `LoraFrameCounters`, `LoraReceptionTable` (latest reception, OD-103), ~~`LoraSignalHistoryChart`~~ (OD-103), `LoraFrameRow`, `LoraRelayPathChip`, `LoraLiveFramesView`, `LoraDeviceTab`, `LoraProfileSettingsPanel`, `LoraCodecLibraryView`.

## Definition of done

- In the demo: add a Basics Station gateway, copy its token once, download its config; see the 6 seeded gateways on the map with the right colours and the relay line.
- Open the roaming device: its reception table and the map coverage lines change as it moves~~, and the RSSI/SNR chart shows a series per gateway~~ (OD-103: the table shows only the latest uplink's gateways and is replaced live on each uplink; no RSSI/SNR history chart).
- The live frames view shows a frame merged from 3 gateways with a 3-row `rx[]` in its drawer, a late copy, and a dropped "MIC failed" frame; pause and filters work and survive navigation.
- A Basics Station gateway's stats tab shows "Not reported by this gateway" for temperature and buffer, not zero.
- ~~(OD-53) The seeded mixed gateway shows the "Local LNS + cloud" badge in the list, map popover and header, and its Overview shows `LoraMixedModeCard` with the local block and the local-vs-forwarded bar; local and cloud gateways show no such card.~~
- (OD-86) No mixed mode anywhere: `LoraGatewayModeBadge` has only "Cloud" and "Local LNS", the mode filter has only those two values, `LoraGateway.mode` accepts only `'cloud' | 'local'`, and no `LoraMixedModeCard` or mixed showcase variant exists.
- (OD-83) The codec library shows the seeded roltek-lns `tlv`/`layout` codecs with a passing test vector; no TTN import or JavaScript codec field exists; ~~until roltek-lns has encoder tables the encoder section reads "Downlinks are sent as hex".~~ (OD-106) no encoder section exists, the codec detail reads "Downlinks are sent as raw hex or base64", and "Send downlink" accepts hex and base64.
- (OD-54) "Add gateway" on a demo tenant at its device limit shows the shared "n of n devices used" message.
- (OD-57) A LoRaWAN demo profile shows "Recent message" selected and "Live connection" disabled in the Online status group; the LoRa panel links to it. (**OD-63:** the seeded demo profile stores that rule; a new blank LoRaWAN profile starts with nothing selected and cannot be saved until a rule is chosen.)
- (OD-60) The Basics Station Credentials tab has no CUPS fields; §10.8 has no route and no demo entry.
- Every route above renders from the demo adapter (no `iot.data.ts` import in a page), has loading/empty/error states reachable from `/theme/iot/settings`, and is in the route smoke test.

## 2026-11-04 — Map, device and profile tabs, codec library (`feat/lora-codecs-ui`; NB iot_lorawan 13, iot_lorawan_codecs 05)

Built in `modules/domains/iot/lorawan/`, shown on `/theme/iot/lorawan` (header buttons "Map" and "Codecs" open wide drawers, owner rule:
no tabs or nested menus; the two tab cards show the device and profile tabs):

- **10.2** `LoraGatewayMap` on the kit's one map (`MapCanvas`, the Sites & assets map): pins by state (online, offline, never connected),
  tooltips with round trip and EUI, a click opens the gateway; gateways without a location are listed beside the map (a DataTable), never at
  0,0, with "Place on the map" (the pin starts in the middle of the placed ones and is dragged into place; `onMove` saves). Relay lines and the
  device coverage view wait for relays (NB 10) and are not built.
- **10.4** `LoraDevicePanel` (the device tab): identity and join state, frame counters, the codec choice, the latest reception only (OD-103),
  recent frames, "Reset session" for the host's ConfirmDialog. The downlink queue and "Send downlink" stay with the RPC console.
- **10.6** `LoraProfilePanel` (the profile tab): radio (EU868 only, OD-55; RX1 delay 5 s default, OD-56), ADR range, de-dup window, the
  profile's codec, radio keys, any JoinEUI, the shared AppKey write-only, the online rule read-only (OD-57 / OD-63). A plain form, no accordion.
- **10.7** `LoraCodecTable` (library and own codecs, server or browser mode), `LoraCodecDetail` (facts, decoder-only line OD-106, test bench,
  keys it decodes, revisions, the table read-only; Save a copy / Edit / Delete / Withdraw / Restore are the host's), `LoraCodecEditor` (id
  `t.<slug>`, the table as JSON, Check with every own vector pass / fail, Publish, refusals in words) and `LoraCodecBench`. No JavaScript codec
  anywhere (OD-83).
