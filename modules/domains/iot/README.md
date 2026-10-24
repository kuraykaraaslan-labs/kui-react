# modules/domains/iot

IoT platform domain — device fleet management, telemetry, rulesets, alarms, and workspace components.

## Subdirectories

```
alarm/      alarm components and views (OD-9: Alarm, five severities; alarm-severity.ts is the one severity table)
asset/      sites and assets: the tree, the asset detail, device placement (phase 08; NB iot_asset)
api/        the adapter contract, the live contract and IotAdapterProvider (docs/concepts/iot-platform/phases/00)
device/     device components and views (the Log timeline and useDeviceLog; DeviceQuickView, the list's drawer)
profile/    device profile list, editor and its sections (online rule, auth modes, transport policy, topic schemes, rate limits, key schemas)
ruleset/
telemetry/
types/      platform entities, one file per entity (alarm.ts, alarm-rule.ts, asset.ts, device.ts, profile.ts, rpc.ts); ../types.ts re-exports them
workspace/
format.ts   relative / absolute time helpers
messages.ts every text of the alarm and device components (IotMessagesInput for a host's translations)
index.ts
types.ts
```

Views (`DeviceListView`, `DeviceDetailView`, `AlarmListView`, `AlarmDetailView`, `AlarmBellMenu`, `RpcConsoleView`, `DeviceProfileListView`,
`DeviceProfileEditorView`, `AlarmRuleSetEditor`, `RpcCommandCatalogEditor`, `AssetsView`, `AssetDetailView`, `DevicePlacementPanel`) read only through the adapter of
the nearest `IotAdapterProvider`; leaf components take data and callbacks (`DeviceQuickView` is opened by `DeviceListView` on a row
click, its device kept in the host's URL through `onQueryChange(query, how)` / `initialQuery.device`). Vendored into next-boilerplate's IoT kit
(`modules/iot_device_profile/ui/kui/iot/`), so they import generic pieces from `modules/ui` only and never the vertical's
`types.ts` barrel (it pulls the rule editor in).

## Rule chain editor

`ruleset/` holds the rule chain editor, its block catalog, param forms, undo, groups, flows that run each other, validation and the
import / export formats. See [ruleset/README.md](ruleset/README.md).

## Parity

NextJS-only, no EJS counterpart.

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. Id/Status types reused from `@/modules/domains/common`.

See [/AGENTS.md](../../../AGENTS.md).
