# kui-react

[![CI](https://github.com/kuraykaraaslan/kui-react/actions/workflows/ci.yml/badge.svg)](https://github.com/kuraykaraaslan/kui-react/actions/workflows/ci.yml)

A modular Next.js 16 / React 19 component library organised by atomic design — atoms → molecules → organisms → app patterns → industry-vertical domains → full-page theme demos. Every component is **copy-paste-ready** from the live showcase; no npm install required.

> **AI assistants:** start at `/llms.txt` or fetch `/api/registry` for a machine-readable catalog of every component. See the [AI agent quick reference](#ai-agent-quick-reference) below.

## Stack

Next.js 16.3.6 · React 19.3.0 · TypeScript 6 · Tailwind CSS 4 · App Router · ESLint 9 · Zustand · Zod · Leaflet · Chart.js · Font Awesome

## Quick start

```bash
npm install
npm run dev          # http://localhost:3002
```

## Ports

kui-react's dev server runs on **3002**, kui-ejs's on **3003** — chosen so
both can run side by side when comparing a component across the two
implementations (`docs/adr/0003-react-ejs-parity-contract.md`).

## Theme demos

Seventeen full-page demos — one per industry vertical — built entirely from the component library.

<table>
  <tr>
    <td align="center"><b>AI workspace</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-ai.png" alt="AI workspace" width="280"/></td>
    <td align="center"><b>API docs</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-api-doc.png" alt="API docs" width="280"/></td>
    <td align="center"><b>Blog</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-blog.png" alt="Blog" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>Commerce</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-commerce.png" alt="Commerce" width="280"/></td>
    <td align="center"><b>Common (auth / account)</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-common.png" alt="Common" width="280"/></td>
    <td align="center"><b>Event tickets</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-event.png" alt="Event tickets" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>Fintech dashboard</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-fintech.png" alt="Fintech dashboard" width="280"/></td>
    <td align="center"><b>Food / restaurant</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-food.png" alt="Food / restaurant" width="280"/></td>
    <td align="center"><b>Forum</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-forum.png" alt="Forum" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>IoT platform</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-iot.png" alt="IoT platform" width="280"/></td>
    <td align="center"><b>Jobs board</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-jobs.png" alt="Jobs board" width="280"/></td>
    <td align="center"><b>Landing page</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-landing.png" alt="Landing page" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>Media (video)</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-media.png" alt="Media / video" width="280"/></td>
    <td align="center"><b>NFT marketplace</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-nft.png" alt="NFT marketplace" width="280"/></td>
    <td align="center"><b>Real estate</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-real-estate.png" alt="Real estate" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>Social feed</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-social.png" alt="Social feed" width="280"/></td>
    <td align="center"><b>Travel</b><br/><img src="https://raw.githubusercontent.com/kuraykaraaslan/kui-react/main/public/assets/img/screenshot-travel.png" alt="Travel" width="280"/></td>
    <td></td>
  </tr>
</table>

---

## Module layers

```
modules/
├── ui/          ← primitive components (atoms + molecules)
├── app/         ← application patterns (shells, navigation, forms, states)
├── domains/     ← industry verticals (ai, blog, commerce, event, …)
├── registry/    ← AI-discoverability layer — machine-readable catalog builder
└── showcase/    ← Live preview site + interactive playground
app/theme/       ← full-page theme demos, one per domain vertical
libs/utils/      ← Shared utilities (e.g. cn)
```

Counts drift as components ship, so this README doesn't hardcode them — see the live registry: `GET /api/registry?index=1`, or the sidebar counts in the [showcase](https://next-js-components.kuray.dev). As of the last snapshot: 63 ui, 35 app, 217 domain components across 18 verticals, 18 full-page themes.

Every layer builds on the one above. Business logic stays in `domains/` / `app/`; `ui/` is pure presentation.

## Using a component (copy-paste path)

1. Browse the live showcase, pick a component.
2. Open the variant you want, copy its source from the **Source** tab.
3. Drop it into your project. If it imports `cn`, copy `libs/utils/cn.ts` too.
4. Read the component's `composes[]` field in the registry to know what other components it needs.

## Using a component (in-tree path)

```ts
import { Button, Card } from '@/modules/ui';                  // top-level barrel
import { AppShell, AppSidebar } from '@/modules/app';
import { ProductCard, OrderCard } from '@/modules/domains/commerce';
import { Commerce, Blog } from '@/modules/domains';           // namespace barrel
import { cn } from '@/libs/utils/cn';
```

## Styling setup

The package stylesheet carries the design tokens and Font Awesome's icon CSS. Import it after Tailwind:

```css
@import "tailwindcss";
@import "@kuraykaraaslan/kui-react/styles";
```

Font Awesome's CSS sits in Tailwind's `base` layer, so a size class on an icon (`w-4 h-4`, `size-5`) beats Font
Awesome's default `1em` box. Font Awesome also injects the same CSS at runtime, without a layer, and that copy beats
every Tailwind utility. Turn it off once, in client code that runs before the first icon renders (this repo does it in
`libs/config/fontawesome.ts`, imported by the root layout and `ConditionalShell`):

```ts
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;
```

## AI agent quick reference

This library ships a first-class machine-readable surface for AI tools — HTTP endpoints, static snapshots, an MCP server, and editor rule files for every major AI coding assistant.

### HTTP endpoints

| Resource | URL / Path | Purpose |
|---|---|---|
| Concise overview | [`/llms.txt`](public/llms.txt) | One-page TL;DR following the llms.txt convention |
| Full registry (JSON) | `GET /api/registry` | Every component with full source, variants, status, tokens |
| Index registry (JSON) | `GET /api/registry?index=1` | Same data minus `source` — ~5x smaller for search |
| Long-form markdown | `GET /llms-full.txt` | Flattened markdown of every component — paste into a context window |
| JSON Schema | [`/schemas/registry-v1.json`](public/schemas/registry-v1.json) | Validate registry payloads or generate typed clients |
| Offline JSON snapshot | [`/registry/components.json`](public/registry/components.json) | Pre-built static catalog — works without dev server (`npm run registry:snapshot`) |
| Per-component markdown | `/components/<id>.md` | One file per component — chunk-friendly retrieval |
| Component index | [`/components/_index.json`](public/components/_index.json) | id → filename map for the markdown chunks |
| Registry source | [`modules/registry/registry.ts`](modules/registry/registry.ts) | Derives the catalog from showcase data |

The registry includes for every component: id, layer, category, file path, description, status, since, full source, every variant, design tokens consumed, accessibility metadata, dependencies, and (where authored) when-to-use guidance.

### MCP server (Claude Desktop / Cursor / Cline / Windsurf / Zed)

Zero-dependency stdio MCP server defined in [`.mcp.json`](.mcp.json). Tools exposed:

- `list_components` · `get_component` · `search_components`
- `list_themes` · `get_conventions` · `list_design_tokens`
- `read_file` (sandboxed to the repository root)

The server reads `public/registry/components.json` so it works offline. Refresh with `npm run registry:snapshot`. Run standalone with `npm run mcp:server`.

### Editor rule files (canonical: [`AGENTS.md`](AGENTS.md))

| File | Tool |
|---|---|
| [`.cursor/rules/kui-react.mdc`](.cursor/rules/kui-react.mdc) | Cursor (modern) |
| [`.cursorrules`](.cursorrules) | Cursor (legacy) |
| [`.windsurfrules`](.windsurfrules) | Windsurf |
| [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | GitHub Copilot |
| [`.clinerules`](.clinerules) | Cline / Continue.dev |

## Adding a component

1. Choose the right layer (`ui/`, `app/`, or `domains/<vertical>/`).
2. Author the file. Follow the rules in [`AGENTS.md`](AGENTS.md): `'use client'`, named export, `cn()` for classNames, design tokens not raw hex, ARIA + focus-visible ring.
3. Add a showcase entry under `modules/showcase/data/sections/` with at least 2 variants.
4. Wire the builder into `modules/showcase/data/showcase.data.tsx`.
5. Register in `modules/showcase/data/showcase.menu.ts`.
6. (If new domain vertical) update `modules/domains/<vertical>/index.ts` barrel and add to `modules/domains/index.ts` namespace export.

## Adding a theme

See the **Adding a new theme** section in [`AGENTS.md`](AGENTS.md) for the required step order.

## Scripts

```bash
npm run dev                 # development server
npm run build               # production build
npm run start               # production server
npm run lint                # ESLint
npm run screenshots         # Puppeteer-based visual capture
npm run registry:snapshot   # write offline JSON + per-component markdown to public/
npm run mcp:server          # start the stdio MCP server (used by .mcp.json)
```

## Layout conventions

- `modules/ui/*.tsx` and `modules/app/*.tsx` start with `'use client';`.
- Domain files in `modules/domains/<vertical>/...` are client components too.
- Theme `layout.tsx` is a Client Component; `page.tsx` is a Server Component unless it owns local state.
- `<main id="main-content">` lives in `layout.tsx` for the skip-link accessibility pattern.
- All icons come from Font Awesome — no inline SVG, no other icon libraries.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the deeper authoring rules in [`AGENTS.md`](AGENTS.md). Pull requests should pass `npm run lint` and `tsc --noEmit`.

## License

Apache-2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
