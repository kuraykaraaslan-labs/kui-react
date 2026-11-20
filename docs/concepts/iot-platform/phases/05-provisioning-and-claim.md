# IoT 05: Provisioning and claim

**Goal:** an installer scans the QR ~~label on a device~~ and claims it into the right site; an administrator sees the factory pool of pre-provisioned devices, imports batches ~~and prints claim labels~~.

> **→ DECISION OD-6 (owner, 2026-10-04):** there is **no printed label**. The claim QR and the grouped claim code are shown on the device's own local panel (Cloud page, behind login); the cloud UI scans that QR or the installer types serial + claim code. No label printing and no label-QR generation anywhere in kui-react.
>
> **→ DECISION OD-1 (owner, 2026-10-04):** devices bootstrap with the **profile provisioning key/secret** (ThingsBoard style); the claim secret is used only for customer claiming and never authenticates the first connection. Any UI that shows a profile's provisioning keys offers key rotation with key ids (`active` / `retired` / `revoked`), the provisioning rate limit and the `autoActivate` / quarantine state (01 §1.4 owns the profile UI; this phase shows key ids in the pool and the import).
>
> **→ DECISION OD-41 (owner, 2026-10-04):** every claim needs an **open claim window**, opened by a button on the device's local Cloud page and valid for **15 minutes**; logging into the panel does not open it. This phase covers the cloud side only (the device pages are built in the device repos: roltek-openwrt-dev `docs/concepts/iot-platform/phases/06`, roltek-esp32-dev `docs/concepts/iot-platform/phases/07`); see §5.1 for the wording.
>
> **→ DECISION OD-85 (owner, 2026-10-04):** the ThingsBoard mapping profile supports telemetry and attributes only; there is **no ThingsBoard claiming or device-provisioning API**. Claim, release and provisioning-key flows in this phase apply to devices on our own protocol; a device that speaks only the ThingsBoard scheme is added by hand (01 "Add device") or by import (§5.3), and nothing here mentions ThingsBoard claim or provision topics.
>
> **→ DECISION OD-24 (owner, 2026-10-04):** a device factory reset never changes cloud ownership. Another account's claim of an owned unit fails `not_claimable` ("owned by another account — ask the seller to release it") until the owner releases it; the owner's "Release device" action (typed confirmation, audited) returns the unit to the factory pool; a platform operator can force a release.

**Goal (as decided):** an installer scans the claim QR shown on the device's own panel, or types serial + claim code, and claims the device into the right site; an owner can release a device; an administrator sees the factory pool with provisioning key ids and claim/quarantine state and imports batches.
**Effort:** M.
**Depends on:** 00, 01, 08 (site picker; a flat workspace picker is enough until 08 lands); 9.13 (`QrScanner`, ~~`QrCode`~~), 9.14. (OD-6: `QrCode` is no longer needed for labels; the demo uses it only to stand in for the device panel's QR in §5.1.)
**Demo routes:** `/theme/iot/claim` (mobile-first) · `/theme/iot/provisioning` (factory pool) · `/theme/iot/provisioning/import`.
**NB consumer:** `docs/new-iot-platform/iot_provisioning/` (claim codes, QR claim, provisioning API, bulk CSV import adapter); `docs/new-iot-platform/data_import/` (IoT import contribution).

## Adapter methods added

`provisioning.parseClaim(text)` (decodes the QR payload; the format is owned by NB `_protocol`, kui-react never parses it itself), `provisioning.preview(claim)` (model, serial, firmware, already-claimed flag), `provisioning.claim(claim, { name, siteId, profileId? })`, `provisioning.pool(query)`, `provisioning.importPreview(file)`, `provisioning.importCommit(previewId)`, ~~`provisioning.labels(ids) => { url } | { blob }`~~ (struck by OD-6: no labels).

Added by the owner decisions of 2026-10-04: `provisioning.claimManual({ serial, claimCode })` (OD-6, typed entry without a QR), `devices.release(id, { confirmSerial })` (OD-24, owning tenant), `provisioning.forceRelease(serial, { reason })` (OD-24, platform operator), `devices.activate(id)` (OD-1 quarantine, shared with 01). Claim errors carry `code: 'not_claimable'` for a unit owned by another account (OD-24).

## 5.1 Claim screen

- [ ] `ClaimDeviceView`, a `StepFlow` sized for a phone: 1) scan (`QrScanner`, 9.13) or type the code, 2) confirm the device (preview card: model, serial, image from the profile), 3) name it and pick the site/asset, 4) done (next steps: "power it on", "open device", "claim another").
  > **→ DECISION OD-6 (owner, 2026-10-04):** step 1 says "Scan the QR on the device's panel (Cloud page)" with a short hint how to open it; "type the code" means **serial + claim code** (two fields, the code accepted with or without its group separators), sent through `provisioning.claimManual`. The wizard is otherwise unchanged.
- [ ] Error states with plain wording and a next action: code expired, device already claimed (by this tenant: link to it; by another: ~~contact support~~), wrong code, rate-limited (shows when to retry), offline.
  > **→ DECISION OD-41 (owner, 2026-10-04):** step 1's hint adds "then press **Open claim window** on that page (valid 15 minutes)"; a new error state for `press_claim_button`: "The claim window on the device is closed. Open the device's Cloud page, press Open claim window, then try again within 15 minutes." with a retry button. `DevicePanelQrMock` gets an "Open claim window" button with a 15-minute countdown, and the demo claim fails with that state until it is pressed.
  > **→ DECISION OD-24 (owner, 2026-10-04):** "already claimed by another account" is the `not_claimable` state: "This device is owned by another account. Ask the seller (or previous owner) to release it in their cloud account, then try again." No support link as the primary action; a secondary "How release works" help link.
- [ ] Works without a camera (manual entry) and with camera permission denied (instructions).
  > **→ DECISION OD-82 (owner, 2026-10-04):** mobile in the MVP is **responsive web + PWA** (camera QR scan, push); a native app comes later (expo-react-native-boilerplate + KUInative). The claim flow is the main PWA use case, so the camera QR scan must work **inside the installed PWA** (standalone display mode on Android Chrome and iOS Safari), not only in a browser tab.
- [ ] (OD-82) `ClaimDeviceView` in the installed PWA: `QrScanner` (9.13) opens the rear camera in standalone mode, handles the standalone-specific permission states (iOS asks again per session; a denied permission shows how to re-enable it for the installed app), and falls back to serial + claim code; the layout fits a 360 px viewport with the scan step full-width and the primary action reachable by thumb.
- [ ] (OD-82) After a successful claim the done step offers "Notify me when it comes online" when the host reports web push is available (an `onRequestPush` prop; NB `notification` owns the subscription); hidden otherwise.

## 5.2 Factory pool

- [ ] `FactoryPoolView`: pre-provisioned devices not yet claimed: serial, model, batch, MAC, created, claim status, claimed by/at; filters by batch and status; CSV export (9.14).
- [ ] ~~Claim labels: select rows, render a printable sheet of `QrCode` labels (9.13) with serial and model (`@media print` layout); or download a PDF/ZIP when the adapter returns one.~~ **→ DECISION OD-6 (owner, 2026-10-04):** no printed labels; struck.
- [ ] Revoke an unclaimed claim code (Should).
- [ ] (OD-1) Pool columns gain `provision_key_id` (the key the batch was written with, with its state badge `active` / `retired` / `revoked`) and the lifecycle state (`MANUFACTURED`, `PROVISIONED` = quarantined in the pool, claimed, retired); a filter by key id and state. Units of a `revoked` key are flagged "needs re-allow" (platform-operator RMA path; the re-allow action itself is Should and shown only with a platform-operator capability).
- [ ] (OD-1) `DeviceClaimStateBadge` (shared with 01) on every pool row and in the claim preview card: "Unclaimed — in factory pool" / "Quarantined".
- [ ] (OD-24) Platform-operator "Force release" row action (`canForceRelease`): reason field (support, RMA, dispute) + typed confirmation of the serial; the unit returns to the pool as PROVISIONED with "presence required" shown on the row.

## 5.4 Release device (OD-24)

- [ ] `ReleaseDeviceDialog`, opened from the device detail header (01 §1.2) and the device list row menu, for the owning tenant admin (`canReleaseDevice`): explains the effect ("the device leaves this account, its connection is closed, it returns to the factory pool; anyone holding it can claim it after confirming presence on the device"), then a typed confirmation of the device **serial** (a `Modal` with an `Input` that must match; the confirm button stays disabled until it does). kui-react has no typed-confirmation component today (only `Popconfirm` and `Modal`); the generic part is planned as phase 9.15 (`requireText` on a confirm `Modal`), not an IoT one-off. On success: toast, the device disappears from the list, audit note.
- [ ] Copy makes clear that a local factory reset does **not** release a device: shown once in the dialog and in the `not_claimable` help text.
- [ ] Demo: releasing a seeded device moves it into the demo factory pool; claiming it back from another demo workspace then succeeds.

## 5.3 Bulk import

- [ ] `ProvisioningImportView`: upload CSV (`FileInput`), column mapping, a preview table with per-row validation errors from `importPreview`, commit, then a result summary. Same flow as NB's `data_import`, so the vendored view plugs into NB's import adapter.
- [ ] (OD-1) The import maps a `provision_key_id` column (required for factory batches) and validates it against the profile's keys (unknown or `revoked` key → row error); serials follow OD-5's opaque format (e.g. `RT420-2610-000123`, 6–32 chars `[A-Z0-9-]`).

## Showcase

New Domain entries: `ClaimDeviceView`, `DeviceClaimPreviewCard`, `FactoryPoolView`, ~~`ClaimLabelSheet`~~ (struck, OD-6), `ProvisioningImportView`. Added by the owner decisions of 2026-10-04: `ReleaseDeviceDialog` (OD-24), `DeviceClaimStateBadge` (OD-1, shared with 01), `ClaimErrorState` variants including `not_claimable` (OD-24), `DevicePanelQrMock` (demo-only stand-in for the router panel's Cloud page QR, built from `QrCode`; not exported for NB).

## Definition of done

- ~~In the demo on a phone-width viewport: scan a QR code shown on another screen (the pool's label sheet), claim the device into a site, see it appear in the device list and go online through the mock source.~~
- (OD-6) In the demo on a phone-width viewport: scan the QR shown by `DevicePanelQrMock` on another screen **or** type serial + claim code, claim the device into a site, see it appear in the device list and go online through the mock source.
- Each claim error state is reachable with a seeded code, including `not_claimable` ("owned by another account — ask the seller to release it", OD-24).
- (OD-24) Release a device with typed serial confirmation; it leaves the list, appears in the pool, and can be claimed again.
- (OD-1) Pool rows show `provision_key_id` with its state and the quarantine/unclaimed badge.
- (OD-6) No label sheet, label PDF or `provisioning.labels` call exists in kui-react.
- (OD-41) In the demo, a claim before pressing "Open claim window" on `DevicePanelQrMock` shows the `press_claim_button` state; after pressing it the claim succeeds; the countdown shows 15:00.
- (OD-82) On an Android phone and an iPhone, the camera QR scan of `/theme/iot/claim` reads `DevicePanelQrMock` from another screen and the claim completes; with camera permission denied the instructions and manual entry work. The same check in **standalone mode** runs on NB's installed PWA with the vendored `ClaimDeviceView` (kui-react's demo ships no manifest or service worker; README §Parity, OD-82) and is recorded as NB's acceptance item.

## 2026-11-20 — as built (`feat/qr-scanner-claim`)

- **`ClaimDeviceWizard`** (`modules/domains/iot/provisioning/`, the plan's `ClaimDeviceView`, named as next-boilerplate's 04 names it): the
  four steps (source, code, confirm, done) sized for a phone; the scan path is `QrScanner` (9.13) with the QR text field under it, a read
  code checked at once; the typed path is serial + claim code. The host owns the code format and the requests (`parseScan`, `checkTyped`,
  `check`, `claim`, `describeError`): the kit parses nothing itself, as this phase requires. Request sequencing: an answer after Back /
  Start over is dropped. A retryable refusal (OD-41's closed claim window) offers Try again. The site / asset picker of step 3 is not in the
  kit wizard (NB places a claimed device on its Placement tab, `iot_asset`); the done step's push offer (`onRequestPush`) is not built.
- **`ReleaseDeviceDialog`** (OD-24): `ConfirmDialog` (danger) with the effect lines (the host may pass its own), an optional reason and the
  serial typed again.
- Demo `/theme/iot/claim`: the wizard against fixtures, a `DevicePanelQrMock` (the claim QR from `qrcode`, the grouped code, Open claim
  window with its 15-minute countdown; the claim answers the closed-window state until it is pressed) and the release dialog.
- Not built here: `FactoryPoolView`, `DeviceClaimStateBadge`, `ProvisioningImportView` (NB has its own factory console and the import
  wizard). Parity: `iot-provisioning-claim` in `parity.exceptions.json`. Tests: `modules/domains/iot/provisioning/provisioning.test.tsx`.
