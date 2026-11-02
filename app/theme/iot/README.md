# app/theme/iot

IoT platform theme demo — dashboard, workspaces, devices, rulesets, and alerts pages. Wires `modules/domains/iot/`.

The dashboard (`page.tsx` → `_components/IotDashboard.tsx`) is a `WidgetBoard` from `modules/app/WidgetKit`: every card is a
settings-template widget editable ThingsBoard-style (Edit → gear), each data slot is bound to a demo source from
`_components/iot-dashboard.data.ts` (built from `iot.data.ts`), and the whole board (every card, its settings and binding)
exports to and imports from one JSON file. Edits are kept in this browser (`localStorage`); "Reset demo" restores the layout.

## Files

```
_components/        IotDashboard.tsx, iot-dashboard.data.ts
alerts/
devices/
iot.data.ts
layout.tsx
page.tsx
recordings/         a camera's recordings day: RecordingTimeline over demo coverage, clips and events
rulesets/
workspaces/
```

## Parity

NextJS-only, no EJS counterpart.

## Conventions

1. `layout.tsx` is `'use client'`; pages default to Server Components.
2. Sample data in `iot.data.ts` — passed in as props.
3. Dynamic device/workspace/ruleset routes use `generateStaticParams`.
4. Compose `@/modules/domains/iot/` + `@/modules/ui/` + `@/modules/app/`; no in-theme duplicates.
5. `cn()` from `@/libs/utils/cn`; tokens from `app/globals.css`; icons via `<FontAwesomeIcon>`.
6. `<main id="main-content">` in layout for skip-link a11y.

See [/AGENTS.md](../../../AGENTS.md).
