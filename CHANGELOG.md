# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `ParamForm` (RulesetEditor): `suggest({ key, spec, values, row? })` gives a text field its suggestions per field and per
  row of a `rules` field (`row` is `{ param, index, values }`), as strings or `{ value, label }`; a list replaces the
  spec's `suggest`, an empty list turns it off. A field's datalist now sits with the field, so a rules row field with its
  own `suggest` gets one too (it pointed at a list that was never rendered). Types `ParamSuggest`, `ParamSuggestField`,
  `ParamSuggestion` are exported.
- Extension surfaces (next-boilerplate phase 37, UI contributions and new extension surfaces):
  - `ContributionBoundary`: an exported error boundary for one contribution, with `fallback` (a node or
    `({ error, reset }) => node`, nothing by default), `onError(error, info)` and `resetKeys`. It replaces
    WidgetKit's private `ViewerBoundary` (same behaviour).
  - `UnavailableContribution`: the placeholder admins and editors see where a contribution cannot be shown.
    Reasons `disabled`, `unentitled`, `blocked`, `retired`, `banned`, `quarantined`, `failed`, `missing`,
    `no-access` (default icon, tone and English text each, exported as `UNAVAILABLE_REASONS`); sizes `inline`,
    `card`, `tab`, `node`; optional `title`, `label`, `detail`, `action` (label + `onClick` / `href`).
  - `WidgetCard`: state `unavailable` with an `unavailable` prop (reason, texts, action); the card keeps its
    title and drops its data buttons, stale badge and "Updated" footer.
  - `TabGroup`: `isolate` (group or per tab) wraps each panel in `ContributionBoundary` + `Suspense`, with
    `renderError`, `loadingFallback`, `onTabError`, `retryLabel`; tabs take `order` and a per-tab `lazy`.
  - `DropdownMenu` items: `id`, `href`, `order`, `group`, `hidden`, `disabledReason`; `portal` renders the open
    menu in `document.body`; helpers `arrangeMenuItems` and `mergeMenuItems`.
  - `UserMenu`: `extraItems` (and `items` + `mergeItems`) merge contributed items with Profile / Settings /
    Sign out, placed by group and order; `profileHref` / `settingsHref` / `signOutHref`, `onProfile` /
    `onSettings` / `onSignOut` and `labels` for the built-in items.
  - `AppTopBar`: `start` and `end` regions taking a node or ordered `{ id, node, order, hidden }` items.
  - `AppSidebar`: `header` slot above the nav groups (node or `({ collapsed }) => node`, as in
    next-boilerplate's fork); item `badge` takes any node besides a count (`AppDrawer` renders it too).
  - `DataTable`: `rowActions` (descriptors with `id`, `label`, `icon`, `onClick` / `href`, `hidden`,
    `disabled`, `disabledReason`, `destructive`, `group`, `order`; per-row fields may be functions of the row)
    in a trailing menu column, and `rowActionsLabel`; exported `DataTableRowAction`, `resolveRowActions`.
  - `CommandPalette`: commands take `group`, `order`, `hidden`; `registerCommands` (batch) and
    `commandGroupOf`; `CommandPalette`, the registry hooks and `DEMO_COMMANDS` are exported from the app barrel.
  - `libs/utils/orderItems`: `sortByOrder` / `groupByOrder`, the CSS-`order`-like ordering every surface uses.

- From next-boilerplate's `UserMenu` fork, which now uses this one (kui-ejs's `UserMenu` takes the same):
  - `UserMenu` `portal` renders the open menu in `document.body` (fixed under the trigger), so a sticky or
    clipping top bar cannot cut it off; `className` goes to the root.
  - `UserMenu` `user` takes a `SafeUser` or just what the menu shows (`UserMenuUser`: `email`, optional
    `userRole`, optional `userProfile` with `name` / `profilePicture`). Without a role the trigger shows the
    name alone, as kui-ejs already did.
  - The `UserMenu` chevron turns over while the menu is open (`group-aria-expanded:rotate-180` on the trigger
    `DropdownMenu` marks expanded).

- `RulesetEditor` / `FlowWorkspace`: `paramEditors`, the host's own param editor per block type, shown in the node
  panel in place of the generated form (`ParamEditorProps`: `params`, `onChange`, `disabled`, `node`, `decl`, `choices`).
- `WidgetKit` `PlacementCard`: `exportData`, an async source for the CSV export, so a host can
  write every page of a server-paged table's current filter instead of the page on screen.
- `Chart`: `GaugeChart` (half-donut, threshold bands, `role="meter"`), `HeatmapChart` (matrix), a
  continuous time axis with viewer-local drag-to-zoom on `LineChart` / `AreaChart`
  (`xAxis="time"`, alias `xScale`), and `stacked` on `BarChart` / `AreaChart` (phase 9 §9.1, §9.3, §9.4).
- `MapCanvas` (card-less map, `tiles` prop) and `tiles` / `loadingLabel` on `MapView`; the loading
  label is now English ("Loading map…").
- `TimeWindowPicker` (relative presets, absolute UTC range, interval, aggregation).
- Async controls (phase 9 §9.16): `useAsyncControl`, `ControlTile`, `ControlButton`, `ControlSwitch`,
  `ControlSlider`, `ControlSetpoint`; `Toggle` gains `pending` / `mismatch` / `describedBy`;
  `RangeSlider` (single) gains `onCommit` / `pending` / `commitIdleMs`.

### Changed

- `TabGroup`: a row of tabs wider than its box (many tabs, a phone) scrolls sideways inside the tab list
  (`overflow-x-auto`, tabs `shrink-0 whitespace-nowrap`) instead of widening the page; the focus ring is drawn inset
  so the scroll box does not clip it. Keyboard and ARIA are unchanged. kui-ejs's `TabGroup` partial has the same
  change; KUInative's already scrolls (a horizontal `ScrollView`).
- `CommandPalette` no longer lists sample commands by default: pass `demo` (or your own `items`). Keyboard
  navigation now follows the on-screen group order. `CommandItem.category` is optional (alias of `group`).
- `AppSidebarNavItem.badge` widened from `number` to `number | ReactNode`; code that reads it as a number
  needs a `typeof` check.
- `package.json` gained `license`, `repository`, `homepage`, `bugs`, `engines`, `keywords`. The
  package has been resolvable from `package.json` alone since 1.0.0 but shipped without this
  metadata until now.
- `@types/leaflet` moved from `dependencies` to `devDependencies` — it was only ever needed to
  build this repo's own `MapView`/`VenueLeafletMap` components, not by consumers of the
  published package.

### Fixed

- `SchemaForm` repeater items: the Up / Down / Remove buttons sat inside the item's `<summary>`, an interactive
  element, which axe reports as a serious `nested-interactive` violation (the widget-kit showcase failed its a11y
  check). They now sit over the summary's right end instead of inside it; the header looks and works the same.
- `AppSidebar` (from next-boilerplate's fork): an active `href` item is marked `aria-current="page"`, as a
  button item already was; collapsed, the nav drops the scrollbar gutter that `.sidebar-scrollbar-hover`
  reserves, so the icon-only items sit centered. kui-ejs's AppSidebar meant to mark both but wrote the
  attribute through escaped output (`aria-current=&#34;page&#34;`); it is fixed there in the same change set,
  and its nav reserves no gutter.
- `usePresence` (Modal, Drawer, Popover): an overlay opened within 250 ms of mounting could stay unmounted
  while open, because the mount-time close timer's update landed after the open click's. The timer now only
  runs while closing and only moves `closing` on. (This was the flaky `CommandPalette` focus test.)
- Four components (`FileInput`, `EmptyErrorState`, `FileUploadSection`, `LoadingState`) were
  missing the `'use client'` directive required by every file in `modules/ui`/`modules/app`.

### Docs

- `AGENTS.md`: filled in the domain-vertical table (`nft`, `reviews` were shipped but
  undocumented), the theme table (`nft`, `promozone`), and the ui atoms/molecules tables (17
  components that existed but had no row).
- `docs/reference/feature-roadmap.md`: six rows (#11, #13, #14, #16, #17, #20) were marked "not implemented" for
  features that had already shipped (`useA11yCheck`, `announce()`, `useBreakpoint`,
  `modules/ui/index.ts`, `lazy.tsx`, `isBrowser`); coverage and the summary table are
  recomputed.
- Fixed stale absolute-path references (`/home/kuray/00_Config_and_AI_Rules`,
  `/home/kuray/02_EJS_Components`, a dead GitHub URL) across `AGENTS.md` and module READMEs.
- Added `docs/adr/` with the first four architecture decision records, and
  `docs/phases/` with a phased improvement plan (see `docs/phases/README.md`).
- Added standard repo hygiene files: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/CODEOWNERS`,
  issue templates, a PR template.

## [1.0.1] — 2026-06-11

### Added

- README theme-demo screenshot gallery, for the npm registry page.

## [1.0.0] — 2026-06-07

### Added

- **Library build.** `tsup` builds `index.ts`, `modules/ui/index.ts`, `modules/app/index.ts`,
  and `modules/domains/common/index.ts` to ESM + CJS with type declarations, published as
  `@kuraykaraaslan/kui-react`. `npm run build:lib`; `prepare` runs it on install.

- **`LanguageSwitcher` and `I18nTypes` no longer guess a country from a language code.** The
  old heuristic was `lang.toUpperCase()`, which is correct only where a language code happens
  to coincide with the country code of a place that speaks it — a mostly-European accident.
  Elsewhere it either produced a non-country (`ja`→`JA`, `ko`→`KO`, `zh`→`ZH`; the emoji is two
  meaningless letters and `flagcdn.com/w40/ja.png` is a 404) or, worse, a real but wrong
  country: `ky` (Kyrgyz) → `KY`, the **Cayman Islands**, when Kyrgyzstan is `KG`. That second
  class is silent — nothing throws, nothing 404s, and the wrong flag looks deliberate.
  `langToRegion()` is now an explicit map and returns `null` for languages it does not know, so
  an unmapped language renders with **no** flag rather than somebody else's.
- **`getOgLocale` no longer emits a wrong territory.** It returns the bare language (`ky`)
  instead of a fabricated pair (`ky_KY`) when the region is unknown.
- **`getLangFlagUrl` is now `string | null`** instead of returning a URL that either 404s or
  loads the wrong country's flag. **Breaking** for any caller that assumed a string.
- **`LanguageSwitcher` no longer keeps its own second copy of the mapping.** It had a private
  five-entry `langToCountry` (`en, tr, de, fr, ar`) and fell through to the heuristic for
  everything else; it now reads the one map in `I18nTypes`. The `icon: … as any` cast went with
  it — `DropdownItem.icon` is `React.ReactNode`, so the cast was never needed and its comment
  ("DropdownMenu string bekliyor") was wrong.

## 2026-05-17 — 10 new theme pages + 27 new domain components

### Added — Theme routes

- **10 new routes across 5 themes:**
  - Media: `studio`, `playlists/[slug]`
  - Forum: `users/[username]`, `topics/new`
  - Food: `orders/[orderId]`, `cuisines/[slug]`
  - IoT: `devices/[slug]/metrics`, `alerts/[id]`
  - Fintech: `portfolio`, `cards`

### Added — Domain components (27 total, all with ≥2 showcase variants)

- **Media (5):** `ChannelStatsCard`, `VideoPerformanceRow`, `WatchTimeChart`, `PlaylistHeaderCard`, `PlaylistVideoRow`
- **Forum (5):** `ForumUserCard`, `ReputationBar`, `BadgeShelf`, `UserActivityRow`, `PostComposer`
- **Food (6):** `OrderTrackingTimeline`, `CourierCard`, `EtaCountdownCard`, `CuisineHeroBanner`, `CuisineTagChip`, `FeaturedDishCard`
- **IoT (5):** `MetricSparklineCard`, `TelemetryTimeSeriesChart`, `LogStreamRow`, `AlertDetailHeader`, `AlertEventTimeline`
- **Fintech (6):** `PortfolioHoldingRow`, `AssetAllocationCard`, `PerformanceSparkline`, `PaymentCardTile`, `CardLimitMeter`, `CardActionMenu`

### Added — AI-discoverability layer

- **Machine-readable component registry** at `modules/registry/registry.ts`, exposed via:
  - `GET /api/registry` — full registry JSON (every component, theme, design token, convention).
  - `GET /api/registry?index=1` — index-only variant without source code (~5x smaller).
  - `GET /llms-full.txt` — long-form markdown dump of the entire catalog.
- **`public/llms.txt`** — concise [llms.txt convention](https://llmstxt.org/) overview pointing AI agents at the registry and conventions.
- **AGENTS.md upgrade** — top-of-file "AI agent quick reference" section with the registry URLs and search recipe; fixed outdated domain/theme tables (now reflects all 16 verticals + 16 themes).
- **Extended `ShowcaseComponent` schema** with optional AI-facing fields (`whenToUse`, `whenNotToUse`, `composes`, `relatedTo`, `a11y`, `designTokens`, `dependencies`) — backward compatible.

### Added — Modularity (barrel exports)

- `index.ts` barrel exports for all 16 domain verticals: `import { ProductCard } from '@/modules/domains/commerce'`.
- Top-level domain barrel at `modules/domains/index.ts` with namespaced re-exports: `import { Commerce, Blog } from '@/modules/domains'`.
- `modules/app/index.ts` barrel covering all 25 app patterns.

### Added — Showcase coverage

- `BrandLogo` showcase entry in atoms.
- `AppBreadcrumbs`, `AppFooter`, `ThemeSwitcher` showcase entries in app patterns (new `app-extras.showcase.tsx` builder).

### Fixed — Convention hygiene

- `modules/ui/BrandLogo.tsx` now starts with `'use client';` per AGENTS.md rule.
- Removed unnecessary `'use client'` from `app/theme/ai/page.tsx` and `app/theme/social/page.tsx` (server-default; layout already owns client state). Travel page kept as client (uses `useState`).
- Resolved sidebar abbreviation collisions: `Sl`, `Cb`, `Sc`/`SC` are now globally unique. `Slider` re-categorised from `Molecule` to `Organism`.

### Removed

- Empty placeholder theme directories: `app/theme/builder/`, `app/theme/gis/`, `app/theme/festival/`.

## [0.1.0] — 2025-09 onwards

Initial public version. See `git log` for history prior to this changelog.
