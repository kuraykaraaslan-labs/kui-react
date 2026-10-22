# app/theme/scada

SCADA theme demo: "Hearth", a calm operator console for a home network. It is built from WidgetKit's process
widgets (`scada.scene`, `scada.symbol`) and the four home symbols (`home.tv`, `home.router`, `home.plug.smart`,
`home.camera.security`); there is no domain vertical behind it.

| Page | Route | What it shows |
|------|-------|---------------|
| Overview | `/theme/scada` | Status tiles (`StatCard`), the "Home network" diagram, the recent events (`data.feed`), the four devices with their readings and one card per symbol state (idle, running, warning, critical) |
| Diagram | `/theme/scada/diagram` | The diagram across the page and a legend: each symbol in each state |
| Diagram editor | `/theme/scada/editor` | `SceneEditor` on the "Home network" diagram (`?scene=empty` starts blank) |

Every card is a `PlacementCard` (`_components/ScadaPlacement.tsx`) of a builtin kind, drawn from the data in
`scada.data.ts`: WidgetKit's `HOME_SCENE` sample and the tiles, devices, events and legend read from its rows. The
clock is fixed (`SCADA_NOW`), so relative times are the same on the server, in the browser and in kui-ejs.

## Files

```
_components/   ScadaOverview.tsx, ScadaDiagram.tsx, ScadaPlacement.tsx, SceneEditorDemo.tsx
diagram/       page.tsx
editor/        page.tsx
layout.tsx     AppShell + AppSidebar (Monitor / Engineer groups, user menu in the footer) + top bar
page.tsx       Overview
scada.data.ts
```

`SceneEditorDemo.tsx` is also the IoT theme's `/theme/iot/scene-editor` page.

## Parity

kui-ejs has the same theme at `$KUIEJS_ROOT/views/theme/scada/` (Overview and Diagram, same data in
`src/data/scada.data.ts`, same partials). Difference by design: kui-ejs has no scene editor, so its sidebar has no
Engineer group and its Diagram page no "Edit diagram" action.

## Conventions

1. `layout.tsx` is `'use client'`; pages are Server Components that render one client component each (WidgetKit
   cards take templates with functions, which cannot cross the server boundary as props).
2. Sample data in `scada.data.ts`, passed down as props; no fetching.
3. Compose `@/modules/app/WidgetKit` + `@/modules/app/` + `@/modules/ui/`; no in-theme duplicates.
4. `cn()` from `@/libs/utils/cn`; tokens from `app/globals.css`; icons via `<FontAwesomeIcon>`.

See [/AGENTS.md](../../../AGENTS.md).
