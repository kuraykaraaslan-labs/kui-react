# IoT 06: OTA

**Goal:** upload firmware and software packages, assign them to a profile or a device, and watch a rollout progress device by device.
**Effort:** M.
**Depends on:** 00, 01; 9.11, 9.12, 9.14.
**Demo routes:** `/theme/iot/firmware` · `/theme/iot/firmware/[id]` · `/theme/iot/firmware/rollouts/[id]`.
**NB consumer:** `docs/new-iot-platform/iot_ota/` (packages, assignment, rollout tracking); `docs/new-iot-platform/storage/` (package files).

## Adapter methods added

`ota.packages.list/get/create/delete`, `ota.packages.upload(file, meta, onProgress)`, `ota.assign({ packageId, target: { profileId } | { deviceIds } })`, `ota.rollouts.list/get/pause/resume/cancel`, `ota.rollouts.devices(rolloutId, query)`. Live topic: `otaRollout(rolloutId)`.

## 6.1 Packages

- [ ] `FirmwareListView`: title, version, type (firmware/software), profile, size, checksum (algorithm + short value), uploaded by/at, devices on it; filters by profile and type.
- [ ] Upload dialog: `FileInput`, title/version/type/profile, checksum computed in the browser (SHA-256 via WebCrypto) and shown before upload, upload progress, version format check against existing versions of the same profile.
- [ ] `FirmwareDetailView`: metadata, release notes, where it is assigned, devices currently on it.

## 6.2 Assignment

- [ ] Assign to a profile (the default for all its devices) or override per device (from the device detail too). A confirmation shows how many devices will update and which are offline.
- [ ] Staged rollout (batch size or percentage, pause between batches) is a **Should**: NB lists "OTA group rollout" in its cut order, so the UI hides it when the adapter reports no capability.
- [ ] **→ DECISION OD-7 (owner, 2026-10-04):** OTA over LTE/metered links is **off by default**. Profile (01 §1.4) and device detail carry a `fwAllowMetered` toggle ("Allow OTA over metered links", default off; the device value overrides the profile and shows "inherited from profile" when unset). The assign confirmation counts devices that will wait for a non-metered link, and states that an update never starts while the data quota is exhausted.
- [ ] **→ DECISION OD-13 (owner, 2026-10-04):** a Roltek router applies an update only with a cloud assignment **plus** its own approval setting (set on the router panel; a customer admin may approve there, OD-23). The device detail shows the router's approval setting read-only ("Updates need local approval" / "Auto-apply assigned updates") as reported by the device; the cloud UI never changes it. Router cloud is off by default (enabled on the router panel), so a never-connected router shows "Cloud not enabled on the device" instead of an OTA state.

## 6.3 Rollout progress

- [ ] `OtaRolloutView`: counts per state with a stacked `Progress` bar and a per-device table (device, from/to version, state, progress, last update, error). States follow NB `iot_ota`; the ThingsBoard OTA states are the reference (queued, initiated, downloading, downloaded, verified, updating, updated, failed).
- [ ] Live through the rollout topic; failed devices can be retried individually; pause/resume/cancel with confirmations.
- [ ] The device detail shows current and target firmware with the OTA state as a `StatusIndicator`.
- [ ] (OD-7, OD-13) Two waiting states beside the ThingsBoard reference set, shown in the rollout table and `OtaStateBadge` with a reason tooltip: "waiting for device approval" (OD-13) and "held: metered link / quota exhausted" (OD-7). The exact state names follow NB `iot_ota`.

## Showcase

New Domain entries: `FirmwareListView`, `FirmwareUploadDialog`, `OtaAssignDialog`, `OtaRolloutView`, `OtaStateBadge` (including the two waiting states), `OtaDevicePolicyPanel` (metered toggle + read-only device approval setting, OD-7/OD-13).

## Definition of done

- In the demo: upload a package, assign it to a profile, watch the mock rollout move devices through the states with one failure, retry it, see the device detail show the new version.
- (OD-7) A seeded LTE device with `fwAllowMetered` off stays "held: metered link" until the toggle is turned on for it; the toggle is off in a fresh profile.
- (OD-13) A seeded router with "needs local approval" stays "waiting for device approval" until the mock source reports its approval.

## 2026-11-03 — as built (next-boilerplate iot_ota 04)

`modules/domains/iot/ota/` (demo: `/theme/iot/firmware`, `/theme/iot/firmware/package?id=`), read through its own `OtaAdapter`
(`ota-adapter.ts`, the settings views' pattern) rather than `IotAdapter.ota`, so a host can hand-port the folder alone:

- `FirmwareListView` (one DataTable: sort, filters by status, type, profile and signature; header: "Signing keys" and "Upload firmware",
  both drawers), `FirmwareUploadDrawer` (SHA-256 in the browser shown before the upload, version check against the same name, usign `.sig`
  file / ESP32 signature inside / unsigned, progress), `SigningKeysDrawer` (public keys only; Revoke behind the ConfirmDialog).
- `FirmwareDetailView`: details with the signature and the key it verified with, release notes, assignments (DataTable, Remove confirmed),
  Assign / Retire / Offer again / Revoke / Delete (each confirmed), and `OtaRolloutView` (stacked state bar + per-device DataTable with
  "Try again"; live through `adapter.watch` when the host has one, else polling while a device is on its way).
- `OtaAssignDrawer`: profile, some devices (picked, or a profile's devices frozen now: NB's GROUP target) or one device; "Check" is a dry
  run whose counts and skip reasons are shown in words with the OD-7 / OD-13 rules, "Assign" confirms through the ConfirmDialog.
- `OtaStateBadge`: NB `iot_ota` state names; WAITING is neutral with its reason (`metered`, `quota_exhausted`, `approval`) in words and a
  tooltip. `OtaDevicePanel` (device Firmware tab: running version, current update, retry, "Allow updates over LTE" as same-as-profile /
  allowed / not allowed with a confirmation when allowing, the router-approval note, history) and `OtaProfilePanel` (profile Firmware tab:
  updates on/off, LTE, unsigned, time limits, tries, the profile's package and Assign).
- Phase 03 (waves, pause/resume/cancel) is not built in NB; the rollout view is per package until it is.
