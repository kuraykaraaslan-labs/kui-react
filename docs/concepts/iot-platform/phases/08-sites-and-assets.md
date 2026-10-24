# IoT 08: Sites and assets

**Goal:** model where devices are: a site → building → floor/line → asset hierarchy, with device placement, health roll-up per node and a site map.
**Effort:** M.
**Depends on:** 00, 01; 9.8 (live `MapView`), 9.9 (`KeyValueEditor`), 9.12.
**Demo routes:** `/theme/iot/assets` (tree + site map) · `/theme/iot/assets/[id]` (asset detail with placed devices).
**NB consumer:** `docs/new-iot-platform/iot_asset/` (hierarchy, device links, relation graph). NB's existing `asset` module (custody register) is unrelated and stays separate; the UI says "Sites & assets", never just "Assets", to avoid the clash.

## Adapter methods added

`assets.tree(rootId?)`, `assets.get/create/update/delete/move(id, newParentId)`, `assets.devices(id, { recursive })`, `assets.placeDevice(assetId, deviceId)`, `assets.unplaceDevice`, `assets.rollup(id)` (device count, online count, worst open alarm severity; **→ DECISION OD-9 (owner, 2026-10-04):** "worst" follows the five-level order CRITICAL > MAJOR > MINOR > WARNING > INFO from phase 03's `alarm-severity.ts`). Live: reuses `deviceState` and `alarms` topics; the roll-up recomputes client-side from them. (**→ DECISION OD-31 (owner, 2026-10-04):** the initial roll-up in NB comes from `iot_device_status` and `iot_open_alarms`, one query per tree level, never per device. These are live-stream topic names of the adapter, not device MQTT topics.)

## 8.1 Hierarchy tree

- [~] `AssetTree` on `TreeView`: node types (site, building, floor, line, asset) with icons, a badge for device count, and a roll-up `StatusIndicator` (worst open alarm wins) per node; lazy-loads children.
- [~] Create, rename, delete (with a "move children to parent" option), drag-and-drop reparent with keyboard alternative ("Move to…" dialog). → 2026-10-24: create, rename, delete and "Move to…" built; drag-and-drop and "move children to parent" left (end block)
- [x] Search in the tree with path highlighting. → 2026-10-24: hits kept in place with their ancestors, all expanded (end block)

## 8.2 Asset detail and device placement

- [~] `AssetDetailView`: header with type and path breadcrumb, attributes through `KeyValueEditor` (9.9), location (lat/lng picked on a `MapView`, optional for indoor nodes), placed devices table (phase 01 device table, filtered), "place device" picker (search unplaced devices, multi-select), unplace.
- [ ] Child nodes summary cards with their roll-ups.
- [ ] Link to the twin view when the asset has a model (phase 09).

## 8.3 Site map

- [ ] `SiteMapView`: `MapView` (9.8) with one marker per site/asset that has a location; marker variant = roll-up status; clustering on; live; click selects the node in the tree.
- [ ] Outdoor gateways with their own location appear as device markers on the same map (this is the 2D counterpart of kui-viewer phase 28's site-map mode).

## Showcase

New Domain entries: `AssetTree`, `AssetDetailView`, `DevicePlacementPicker`, `SiteMapView`, `AssetRollupBadge`.

## Definition of done

- In the demo: build a site → building → line path, place two devices on the line, see the line, building and site turn red when a mock alarm opens on one of them and recover when it clears; drag the line to another building.

## 2026-10-24 — as built: sites and assets (8.1, 8.2)

> Built for next-boilerplate's new `iot_asset` module (NB `docs/concepts/iot-asset/phases/03`), kui-react first, on
> `feat/iot-p2-screens`; vendored into NB's IoT kit the same day.

**Types and adapter.** `types/asset.ts`: `AssetNode` (tree: counts, children), `AssetRecord` (ancestors root first, own and inherited
time zone, attributes), `AssetCrumb`, `AssetInput`, `PlacedDevice`, `DevicePlacement`, `AssetRelation`, the suggested kinds (`SITE`,
`BUILDING`, `FLOOR`, `ROOM`, `AREA`, `LINE`, `MACHINE`, `OTHER`; kinds are free, NB A-4) and pure helpers (`flattenAssets`,
`subtreeIds`, `assetPath`, `filterAssets`, `withoutAssets`, `devicesBelow`). `IotAdapter.assets` (`IotAssetsApi`): `tree`, `get`,
`create`, `update`, `move`, `remove`, `devices(id, { page, pageSize, recursive })`, `place(id, deviceIds)`, `placement(deviceId)`,
`setPlacement(deviceId, id | null)`, optional `relations` / `createRelation` / `removeRelation`. Capabilities `canManageAssets`,
`canPlaceDevices` (fail closed). Texts: groups `assetKind`, `assets`, `asset`, `placement`.

**Components (`modules/domains/iot/asset/`).** `AssetKindBadge` (icon and label; a free kind gets the neutral cube and its own name),
`AssetBreadcrumb` (the path with kind icons and links), `AssetTree` (the generic `TreeView` with search), `AssetPicker` (a searchable
tree returning one asset, `excluded` subtrees left out, optional "Top level"), `MoveAssetDialog` (cycle prevention: the asset and its
subtree are never offered), `AssetFormDrawer` (create / edit: name, kind with "another kind", code derived by the host when empty,
description, time zone, coordinates; only changed fields sent), `PlacedDeviceTable` (`DeviceOnlineDot`, `DeviceAddress`, the node a
device sits on, Remove placement), `PlaceDevicesDialog` (search, tick, place in one call; a device placed here is locked),
`AssetRelationTable`, `AssetDetailView` (path, header with Add child / Edit / Move to… / Delete, tabs Overview, Devices, Child assets,
Relations; a refused delete shows the host's reason), `AssetsView` (the page: tree left, detail right, New site),
`DevicePlacementPicker` and `DevicePlacementPanel` (the device page's Placement tab).

**Demo and showcase.** `/theme/iot/assets` (`?asset=`, `&tab=`), the sidebar entry "Sites & assets", the device page's Placement tab
(the placeholder is gone). `_demo/demo-assets.ts` keeps an in-memory tree (`DEMO_ASSETS` in `iot.data.ts`: Berlin plant → Hall A / Hall B
→ lines → machines, and the logistics hub; a free kind `ROOFTOP`) with NB's rules: no move under a descendant, no delete with
children, one placement per device, unique codes; the demo device delete refuses a placed device, like NB's reference check. Showcase:
11 entries (`iot-asset-*`, `iot-assets-view`, `iot-placed-device-table`, `iot-move-asset-dialog`, `iot-place-devices-dialog`,
`iot-device-placement-panel`), free abbreviations.

**Decisions (ED).**
- **ED-K27 No `modules/ui` change.** `TreeView` has no `renderNode`, `onMove` or `onLoadChildren` yet (its M2 / M3 / M5 items), so
  the tree rows carry the name only: kind icons and device counts are on the detail, the path and the child cards; moves go through
  "Move to…" (the keyboard alternative the plan asks for anyway). Changing `TreeView` needs kui-ejs / KUInative parity: owner item.
- **ED-K28 The view prevents cycles, the host refuses them too.** The picker leaves the subtree out; a host refusal is shown in the dialog.
- **ED-K29 Code optional on create.** The host derives it from the name; the form explains that a later change rewrites the paths below.
- **ED-K30 Roll-up, site map and alarms are not in this round.** The tree shows direct device counts; the worst open alarm per node and
  the `SiteMapView` wait (end of this block).

**Tests.** `asset/asset.test.tsx` (13): helpers; the kind badge; the tree's search, no-match and empty state; the Move dialog never
offering the subtree, the top level and a host refusal; the detail's path, inherited time zone, attributes, devices with state and
address, Remove placement, a refused delete's reason, no actions without capabilities; the form (custom kind upper-cased, no code,
coordinates checked); Place devices; the placement panel. `app/theme/iot/_demo/demo-assets.test.ts` (3): the demo's rules.

**Left.** Drag-and-drop reparent and kind icons / count badges in tree rows (generic `TreeView` work, ED-K27); lazy children (the host
bounds the tree at 5 000 nodes); the alarm roll-up per node (8.1, OD-9 order) and live roll-up; `SiteMapView` (8.3; NB's dashboard
source `iot_asset.tree` already gives sites with coordinates to a map widget); attributes edited through `KeyValueEditor` (9.9) and the
location picked on a map; "delete with move children to parent"; creating free relations from the UI (the table lists and removes);
the twin link (phase 09).
