<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## AI agent quick reference

If you are an AI assistant working in this repo, **read these first**:

| Resource | Path | Purpose |
|---|---|---|
| Machine-readable catalog (JSON) | `GET /api/registry` | Every component, theme, design token, and convention. Full source inlined. |
| Lightweight index (JSON) | `GET /api/registry?index=1` | Same shape, no `source` field — ~5x smaller, fast for search. |
| JSON Schema | `public/schemas/registry-v1.json` (served at `/schemas/registry-v1.json`) | Validate registry payloads or codegen typed clients. |
| Offline snapshot (JSON) | `public/registry/components.json` (served at `/registry/components.json`) | Pre-built static catalog — works without a dev server. Refresh via `npm run registry:snapshot`. |
| Per-component markdown | `public/components/<id>.md` (served at `/components/<id>.md`) | One file per component for chunk-friendly retrieval. Index at `/components/_index.json`. |
| Concise overview | `public/llms.txt` (served at `/llms.txt`) | One-page TL;DR pointing here. |
| Long-form markdown dump | `GET /llms-full.txt` | Flattened markdown of the entire catalog — paste into a context window. |
| MCP server | `.mcp.json` + `scripts/mcp-server.mjs` | Zero-dep stdio MCP server exposing the registry to Claude Desktop, Cursor, Cline, Windsurf, Zed. Run with `npm run mcp:server`. |
| Editor rule mirrors | `.cursor/rules/kui-react.mdc`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.clinerules` | Per-tool views of this file so AI assistants behave consistently. AGENTS.md remains canonical when they drift. |
| Registry source of truth | [modules/registry/registry.ts](modules/registry/registry.ts) | Derives the catalog from showcase data + menu. |
| Type definitions | [modules/registry/registry.types.ts](modules/registry/registry.types.ts) | TypeScript types for the registry JSON. |

> ⚠️ **Keep the catalog in sync (REQUIRED).** Any time you **add, rename, or remove** a component (`modules/ui/`, `modules/app/`, `modules/domains/<vertical>/`), a theme (`app/theme/<vertical>/`), a showcase section file, or a `showcase.menu.ts` entry, you **must** rebuild the catalog before committing:
>
> ```bash
> npm run registry:snapshot
> ```
>
> This regenerates `public/registry/components.json` + `public/registry/components.index.json` + `public/components/*.md` from the showcase data. The script also runs automatically via the `prebuild` npm hook before `npm run build`, but commit the regenerated files so the catalog stays in lockstep with the code. A stale catalog is worse than no catalog — it misleads every AI agent that reads it.

**Search recipe:**
```ts
// "Find me every Card-like organism in commerce"
const reg = await fetch('/api/registry?index=1').then(r => r.json());
const matches = reg.components.filter(c =>
  c.layer === 'domain' &&
  c.filePath.includes('/commerce/') &&
  c.name.toLowerCase().includes('card')
);
```

**Dependency resolution:** the registry's `composes[]` lists every component ID a given entry depends on; `usedBy[]` is the inverse. Follow `composes[]` recursively to know what else to copy when porting a component.

**Convention check before writing code:** every component file must follow the rules in `## Component Authoring Rules` below (`'use client'`, `cn()`, named export, token-only styling, focus-visible ring, ARIA attributes).

---

# Project Architecture

**Stack:** Next.js 16.3.6 · React 19 · TypeScript 6 · Tailwind CSS 4 · App Router

## Module Layers

The codebase is divided into four module layers. Every layer builds on the one above it.

```
modules/
├── ui/         ← Primitive UI components (atoms & molecules)
├── app/        ← Application-level patterns (organisms & page shells)
├── domains/    ← Industry-vertical components (compose ui/ + app/)
├── registry/   ← Machine-readable catalog builder (AI-discoverability layer)
└── showcase/   ← Documentation & live preview system
```

---

## Layer 1 — `modules/ui/` (Atoms & Molecules)

Stateless or locally-stateful primitive components. No business logic, no external data fetching.

**Rule:** Every file in this layer must:
- Start with `'use client';`
- Import `cn` from `@/libs/utils/cn`
- Use CSS variable tokens (see Design Tokens below), not hardcoded colors
- Export a named function (not default export)
- Define all prop types inline or as a local `type`

### Atoms — single-element components

| Component | File | Key Props |
|-----------|------|-----------|
| Button | `Button.tsx` | `variant` (primary\|secondary\|ghost\|danger\|outline), `size` (xs–xl), `loading`, `iconLeft`, `iconRight`, `fullWidth` |
| Badge | `Badge.tsx` | `variant` (success\|error\|warning\|info\|neutral\|primary), `size`, `dismissible` |
| Avatar | `Avatar.tsx` | `src`, `alt`, `size`, fallback initials |
| Toggle | `Toggle.tsx` | `checked`, `onChange`, `label` |
| Checkbox | `Checkbox.tsx` | `checked`, `label`, `indeterminate` |
| Input | `Input.tsx` | `label`, `hint`, `error`, `clearable`, `type` (password shows toggle) |
| Textarea | `Textarea.tsx` | `label`, `hint`, `error`, `rows` |
| Select | `Select.tsx` | `label`, `options`, `error`, `messages` (no results, search, placeholder, required) |
| FileInput | `FileInput.tsx` | `accept`, `multiple`, `onFiles` |
| DatePicker | `DatePicker.tsx` | `value`, `onChange`, `min`, `max` |
| SkipLink | `SkipLink.tsx` | `href` — accessibility skip-to-content |
| LiveRegion | `LiveRegion.tsx` | `message`, `politeness` — ARIA live region |
| Spinner | `Spinner.tsx` | `size` (xs–xl) — CSS border-based loading indicator |
| BrandLogo | `BrandLogo.tsx` | `size` (sm–2xl) |
| Label | `Label.tsx` | `required`, `disabled` — form label wrapper |
| Progress | `Progress.tsx` | `value`, `variant`, `size`, `shape` (bar\|circle), `showLabel` |
| ScrollArea | `ScrollArea.tsx` | `orientation` (vertical\|horizontal\|both) |
| Separator | `Separator.tsx` | `orientation`, `decorative`, `label` |
| StarRating | `StarRating.tsx` | `value` (0–5), `readonly`, `onChange`, `size` |
| Statistic | `Statistic.tsx` | `label`, `value`, `precision`, `prefix`, `suffix`, `trend`, `loading` |

### Molecules — composed from atoms

| Component | File | Notes |
|-----------|------|-------|
| Card | `Card.tsx` | `variant` (raised\|flat\|outline), `title`, `subtitle`, `headerRight`, `footer`, `hoverable`, `loading` |
| AlertBanner | `AlertBanner.tsx` | `variant` matches semantic tokens, `title`, `message`, `action` |
| Modal | `Modal.tsx` | `open`, `onClose`, `title`, `size` (sm\|md\|lg\|xl\|full), `fullscreen`; ignores an Escape an inner control already handled |
| Drawer | `Drawer.tsx` | `open`, `onClose`, `side` (left\|right) |
| Tooltip | `Tooltip.tsx` | `content`, `placement` |
| Popover | `Popover.tsx` | `trigger`, `content`, `placement` |
| Toast | `Toast.tsx` | `variant`, `message`, `duration` |
| Pagination | `Pagination.tsx` | `page`, `total`, `pageSize`, `onChange` |
| Stepper | `Stepper.tsx` | `steps`, `currentStep` |
| TabGroup | `TabGroup.tsx` | `tabs` (`order`, `lazy`, `isolate` per tab), `defaultTab`, `onTabChange`, `lazy`, `isolate` (error boundary + Suspense per panel), `renderError`, `onTabError` |
| Breadcrumb | `Breadcrumb.tsx` | `items` (label + href, optional `icon`, `chip`, `tone`), `leading` (first crumb, never collapsed), `maxItems`, `separator`, `renderLink` |
| Callout | `Callout.tsx` | `variant` (note\|tip\|info\|warning\|danger), `title` (null hides), `icon` (null hides) — docs admonition, `<aside>` not `role="alert"` |
| TableOfContents | `TableOfContents.tsx` | `items` (`{id,text,depth}`), `minDepth`, `maxDepth`, `activeId` (else scroll-spy via `libs/hooks/useScrollSpy`), `offset` |
| DocPager | `DocPager.tsx` | `prev`, `next` (`{title,href}`), `labels`, `renderLink` |
| PageHeader | `PageHeader.tsx` | `title`, `subtitle`, `actions` |
| EmptyState | `EmptyState.tsx` | `icon`, `title`, `description`, `action` |
| ContributionBoundary | `ContributionBoundary.tsx` | `fallback` (node or `({ error, reset })`), `onError(error, info)`, `resetKeys` — isolates one contributed slot item / tab / widget / block |
| UnavailableContribution | `UnavailableContribution.tsx` | `reason` (disabled\|unentitled\|blocked\|retired\|banned\|quarantined\|failed\|missing\|no-access), `size` (inline\|card\|tab\|node), `title`, `label`, `detail`, `action` |
| Skeleton | `Skeleton.tsx` | Exports `SkeletonLine`, `SkeletonAvatar`, `SkeletonText`, `SkeletonCard` |
| Table | `Table.tsx` | `columns`, `rows` |
| DataTable | `DataTable.tsx` | `columns`, `rows`, `searchable`, `sortable`, `rowActions` (per-row menu: `id`, `label`, `onClick`/`href`, `hidden`, `disabled`, `disabledReason`, `destructive`, `group`, `order`), `selectable` + `rowId` / `selectedRowIds` / `onSelectionChange` (keyed by row id, header selects the rows shown), `renderExpanded` (detail rows), `stickyHeader` |
| AdvancedDataTable | `AdvancedDataTable.tsx` | **Deprecated**, to be removed: thin wrapper over DataTable `selectable` / `renderExpanded` (`_expanded` row field) / `stickyHeader`. Use DataTable |
| TreeView | `TreeView.tsx` | `nodes` (recursive), `onSelect` |
| ButtonGroup | `ButtonGroup.tsx` | `options`, `selected`, `onChange` |
| CheckboxGroup | `CheckboxGroup.tsx` | `options`, `values`, `onChange` |
| RadioGroup | `RadioGroup.tsx` | `options` (per option `hint`, `disabled`, `disabledReason`), `value`, `onChange` |
| MultiSelect | `MultiSelect.tsx` | `options`, `values`, `onChange`, searchable, `messages` (no results, search, remove, loading more) |
| ComboBox | `ComboBox.tsx` | `options`, `value`, `onChange`, async search; opens listing every option until the user types; `messages` (placeholder, no results, clear, loading, loading more) |
| TagInput | `TagInput.tsx` | `tags`, `onChange`, `suggestions` |
| SearchBar | `SearchBar.tsx` | `value`, `onChange`, `onClear`, `placeholder` |
| DateRangePicker | `DateRangePicker.tsx` | `start`, `end`, `onChange` |
| ContentScoreBar | `ContentScoreBar.tsx` | `score` (0–100), `label`, `thresholds` |
| DropdownMenu | `DropdownMenu.tsx` | `trigger`, `items` (label\|icon\|danger\|disabled\|separator\|heading, plus `id`\|`href`\|`group`\|`order`\|`hidden`\|`disabledReason`\|`selected`\|`trailing`), `align` (left\|right), `portal`, `groupLabels`, `search`, `header`, `footer`, `menuClassName`, controlled `open`/`onOpenChange`; arrow keys / Home / End; helpers `arrangeMenuItems`, `mergeMenuItems` |
| Slider | `Slider.tsx` | `slides`, `autoPlay`, `autoPlayInterval`, `showDots`, `showArrows`, `loop` — accessible carousel |
| Accordion | `Accordion.tsx` | `items`, `openIds`, `onChange`, `allowMultiple` |
| ColorPicker | `ColorPicker/` | `value`, `onChange`, `format` (hex\|rgb\|hsl) |
| Popconfirm | `Popconfirm.tsx` | `trigger`, `title`, `description`, `danger`, `onConfirm`, `onCancel` |
| TypedConfirmDialog | `TypedConfirmDialog.tsx` | `open`, `title`, `phrase` (typed exactly to unlock), `label`, `confirmLabel`, `danger`, `busy`, `onConfirm`, `onCancel` |
| RangeSlider | `RangeSlider.tsx` | `value`/`onChange`, `range` (single or `[min,max]`), `min`, `max`, `step` |
| BulkActionTable | `BulkActionTable.tsx` | `columns`, `rows`, `rowId`, `selected`, `onSelectedChange`, `actions` |
| KeyedTable | `KeyedTable.tsx` | `columns`, `rows`, `getRowKey`, `caption`, `onRowClick` (keyboard row focus), `rowState` (new / leaving), `selection`, `loading`, `error` + `onRetry`, `emptyText`, `messages` |
| ServerDataTable | `ServerDataTable.tsx` | `columns`, server-driven `rows`/`total`/`loading`, `onQueryChange` |
| StatCard | `StatCard.tsx` | `label`, `value`, `accent` |
| TabButton | `TabButton.tsx` | `active`, `onClick`, `count` |
| Timeline | `Timeline.tsx` | `items`, `groupByDay`, `timeZone`, `locale` |
| ViewToggle | `ViewToggle.tsx` | `value` (horizontal\|vertical), `onChange`, `labels` |

---

## Layer 2 — `modules/app/` (App Patterns / Organisms)

Full page-section components that combine multiple UI molecules into usable workflows. May manage local state. The canonical export list is [modules/app/index.ts](modules/app/index.ts); this table mirrors it.

### Shell + layout

| Component | File | What it does |
|-----------|------|-------------|
| AppShell | `AppShell.tsx` | Root layout: sidebar aside + sticky top bar + main content with mobile drawer |
| AppSidebar | `AppSidebar.tsx` | Collapsible sidebar nav with grouped items, count or node badges, `header` (above the nav groups) and `footer` slots |
| AppTopBar | `AppTopBar.tsx` | Flex wrapper for header content (logo + `start` / `end` regions of ordered items + custom children) |
| AppDrawer | `AppDrawer.tsx` | Slide-in drawer shell used inside `AppShell` mobile mode |
| AppFooter | `AppFooter.tsx` | Site footer: logo, version badge, status pill, nav, social, copyright |
| AppBreadcrumbs | `AppBreadcrumbs.tsx` | Breadcrumb trail with overflow collapse |
| SectionCard | `SectionCard.tsx` | Titled card section wrapper for grouping form/content blocks |
| ConditionalShell | `ConditionalShell.tsx` | Wraps children with `ShowcaseShell` except for paths under `/internal/` |

### Navigation + search

| Component | File | What it does |
|-----------|------|-------------|
| AppNav | `AppNav.tsx` | Horizontal nav bar with active-route highlighting |
| NavDrawer | `NavDrawer.tsx` | Trigger + slide-in drawer composite for off-canvas menus |
| GlobalSearch | `GlobalSearch.tsx` | Command-palette-style global search with result previews |
| AppCommandBar / CommandPalette | `CommandPalette/` | ⌘K palette: fuzzy command search, grouped results, keyboard-first; shared registry (`registerCommand(s)`, `useRegisterCommand`), commands carry `group` / `order` / `hidden`; sample commands only with `demo` |

### Overlays + menus

| Component | File | What it does |
|-----------|------|-------------|
| ContextMenu | `ContextMenu.tsx` | Right-click / long-press menu with submenus, separators, disabled items |

### Forms + flows

| Component | File | What it does |
|-----------|------|-------------|
| Form | `Form.tsx` | Form layout shell: title, description, error banner, 1/2-col grid, actions |
| FormField | `FormField.tsx` | Render-prop wrapper that wires react-hook-form to accessible label/hint/error markup |
| FormBuilder | `FormBuilder/` | Schema-driven form editor + renderer with field palette |
| FilterBar | `FilterBar.tsx` | Multi-field filter UI (text, select, date, checkbox) |
| StepFlow | `StepFlow.tsx` | Multi-step wizard with visual step indicator |
| StepShell | `StepShell.tsx` | Per-step layout wrapper used inside `StepFlow` |
| FileUploadSection | `FileUploadSection/` | Drag-and-drop zone with file list + per-file progress + preview parts |
| RichTextEditor | `RichTextEditor/` | Quill-based editor with toolbar, slash menu, mentions, image insert |

### Content + detail

| Component | File | What it does |
|-----------|------|-------------|
| DetailHeader | `DetailHeader.tsx` | Breadcrumbs + title + status badge + action buttons for detail views |
| ImageGallery | `ImageGallery/` | Thumbnail grid + lightbox with keyboard navigation |
| InlineAlert | `InlineAlert.tsx` | Inline banner alert (success / error / warning / info) |

### Data viz / planning

| Component | File | What it does |
|-----------|------|-------------|
| Calendar | `Calendar/` | Month / week / day / resource / agenda views with drag-create + RRULE recurrence — see `Calendar/PLAN.md` |
| Gantt | `Gantt/` | WBS tree + timeline bars + dependencies + critical path + export — see `Gantt/PLAN.MD` |
| KanbanBoard | `KanbanBoard/` | Column-based card board with drag-to-reorder + cross-column moves |

### Theming + a11y

| Component | File | What it does |
|-----------|------|-------------|
| ThemeSwitcher | `ThemeSwitcher.tsx` | Light / dark / system theme toggle |
| AccessibilityKit | `AccessibilityKit.tsx` | Re-exports `SkipLink` / `LiveRegion` / `Announcer` / `Tooltip` and adds `<FocusTrap>` + `useAnnounce()` + `<AnnouncerOutlet />` |

### States (loading / empty / error / 404 / splash)

| Component | File | What it does |
|-----------|------|-------------|
| LoadingState | `LoadingState.tsx` | Full-page loading overlay |
| EmptyErrorState | `EmptyErrorState.tsx` | Exports `ErrorState`, `NotFoundState`, `NoAccessState` |
| NotFoundPage | `NotFoundPage.tsx` | Full-page 404 with home / back actions |
| SplashScreen | `SplashScreen.tsx` | Branded boot splash with optional progress bar |
| MaintenancePage | `MaintenancePage.tsx` | Full-page maintenance screen with optional ETA countdown and status link |

### Notifications

| Component | File | What it does |
|-----------|------|-------------|
| NotificationSystem | `NotificationSystem.tsx` | Toast provider (`NotificationProvider`) + imperative `notify.*` / `toast` helpers |

### Collaboration

| Component | File | What it does |
|-----------|------|-------------|
| ShareDialog | `ShareDialog.tsx` | Share modal: copy link + email invite + permission picker + invitee list |
| CommentThread | `CommentThread.tsx` | Generic, domain-agnostic threaded comment list with reply form, like, and delete |
| MentionPicker | `MentionPicker.tsx` | `@`-trigger autocomplete picker (headless; keyboard navigation, anchor position) |

### Onboarding

| Component | File | What it does |
|-----------|------|-------------|
| OnboardingWizard | `OnboardingWizard.tsx` | Multi-step onboarding flow (dots/bar progress, page/modal mode, skip) |

---

## Layer 3 — `modules/domains/` (Industry Verticals)

Domain-specific components that compose UI + App layers for real-world use cases. Each vertical is a sub-directory with its own `index.ts` barrel + `types.ts` (Zod schemas). Import via the barrel: `import { ProductCard } from '@/modules/domains/commerce'`.

For the full and always-up-to-date list with every exported component, see the registry: `GET /api/registry` (filter by `layer === 'domain'`).

### Parity with kui-ejs (`$KUIEJS_ROOT`)

kui-react and kui-ejs are two implementations of the same design system (see `docs/adr/0003-react-ejs-parity-contract.md`). Parity is **not** all-or-nothing — the exceptions below are deliberate, not gaps to silently close:

- Shared verticals, kept in parity: `common`, `api-doc`.
- Shared themes without a domain vertical: `scada` (WidgetKit SCADA console; its diagram editor page is React-only, kui-ejs has Overview and Diagram).
- React-only by design (13 verticals): `ai`, `blog`, `commerce`, `event`, `fintech`, `food`, `forum`, `iot`, `jobs`, `landing`, `media`, `nft`, `real-estate`, `reviews`, `social`, `travel`.
- EJS-only by design: `invoice`, `modem`, `ups` — device/admin-panel demos with no React counterpart.
- App-layer exceptions: kui-ejs deliberately reverted `Gantt` and `FormBuilder` after shipping them ("moved out of scope" commits) — do not re-add without deciding scope first.

Before adding a component to only one repo, check whether it belongs in the other too. When it is deliberately one-sided, say so in the PR description; `docs/phases/04-shared-tooling-and-parity.md` tracks turning this into a generated, CI-checked matrix instead of a hand-maintained list.

| Vertical | Directory | Sample components |
|----------|-----------|-------------------|
| AI | `ai/` | `ModelCard`, `ChatMessage`, `ChatInputBar`, `UsageStatsCard` |
| API documentation | `api-doc/` | `EndpointRow`, `OperationPanel`, `SchemaViewer`, `ParameterTable` |
| Blog | `blog/` | `PostCard`, `PostContent`, `CommentForm`, `CategoryBadge` |
| Commerce | `commerce/` | `ProductCard`, `OrderCard`, `CartItem`, `StockStatusBadge` |
| Common (cross-domain) | `common/` | `LoginForm`, `UserMenu`, `PaymentMethodSelector`, `AddressForm` |
| Event | `event/` | `EventCard`, `TicketCard`, `SeatMapPicker`, `VenueCard` |
| Fintech | `fintech/` | `WalletCard`, `TransactionRow`, `CryptoPriceCard`, `PortfolioDonutChart` |
| Food | `food/` | `RestaurantCard`, `MenuItemCard`, `DeliveryStatusBadge` |
| Forum | `forum/` | `ForumCategoryCard`, `TopicRow`, `ReactionTypeBadge` |
| IoT | `iot/` | `DeviceCard`, `CloudWorkspaceCard`, `RulesetEditor`, `AlarmSeverityBadge`, `DeviceListView`, `AlarmListView`, `RpcConsoleView`, `DeviceProfileEditorView` |
| Jobs | `jobs/` | `JobCard`, `CompanyCard`, `JobMeta`, `ApplicationStatusBadge` |
| Landing | `landing/` | `HeroSection`, `PricingGrid`, `FeatureCard`, `FaqAccordion` |
| Media | `media/` | `VideoCard`, `ChannelCard`, `VideoStatusBadge` |
| NFT marketplace | `nft/` | `NftCard`, `NftDetailHeader`, `CollectionCard`, `RarityBadge` |
| Real estate | `real-estate/` | `PropertyCard`, `AgentCard`, `MortgageCalculator` |
| Reviews (cross-domain) | `reviews/` | `ReviewCard`, `ReviewSummaryCard`, `RatingDistribution`, `ReviewSubmitForm` |
| Social | `social/` | `PostCard`, `SocialProfileCard`, `MarketplaceListingCard` |
| Travel | `travel/` | `FlightCard`, `HotelCard`, `FlightSeatPicker`, `BookingStatusBadge` |

---

## Layer 4 — `modules/showcase/` (Documentation System)

Generates the live component browser.

```
modules/showcase/
├── data/
│   ├── showcase.types.ts        ← Type definitions
│   ├── showcase.data.tsx         ← Aggregator: calls all builder functions
│   └── sections/                 ← One builder file per category
│       ├── ui-atoms.showcase.tsx
│       ├── ui-molecules.showcase.tsx
│       ├── ui-organisms.showcase.tsx
│       ├── app-patterns.showcase.tsx
│       └── domain-*.showcase.tsx  (one per vertical)
└── ui/
    ├── ShowcaseShell.tsx
    ├── ShowcaseLayout.tsx
    ├── Sidebar.tsx
    ├── TopBar.tsx
    ├── ShowcaseSection.tsx
    ├── Widget.tsx
    ├── DarkModeToggle.tsx
    └── CopyButton.tsx
```

### Showcase Types

```typescript
type ShowcaseVariant = {
  title: string;
  preview: React.ReactNode;
  code: string;
  layout?: 'side' | 'stack';
};

type ShowcaseComponent = {
  id: string;
  title: string;
  category: 'Atom' | 'Molecule' | 'Organism' | 'App' | 'Domain';
  abbr: string;           // 2-letter abbreviation shown in sidebar
  description: string;
  filePath: string;       // relative path, e.g. 'modules/ui/Button.tsx'
  sourceCode: string;     // full source code as a string literal
  variants: ShowcaseVariant[];
};
```

### Adding a new component to the showcase

1. Create the component in the correct `modules/` layer.
2. Open the matching `sections/*.showcase.tsx` file (or create one for a new domain).
3. Add a `ShowcaseComponent` entry with at least 2 variants.
4. Import and spread the builder in `showcase.data.tsx`.
5. **Add the component to `showcase.menu.ts`** — the sidebar is driven by this static list, not auto-generated from the data. Without this step the component will not appear in the navigation.

---

## Layer 5 — `app/theme/` (Full-Page Demos)

Complete, multi-page site demos that wire domain components into a realistic product experience. Each theme is a self-contained Next.js route subtree with its own layout, pages, and any theme-specific shared data.

```
app/theme/
└── <vertical>/           ← one directory per demo (e.g. news/, shop/, saas/)
    ├── layout.tsx         ← site shell: header, nav, footer — default export
    ├── page.tsx           ← homepage / landing — default export
    ├── <section>/
    │   ├── page.tsx       ← section index page
    │   └── [slug]/
    │       └── page.tsx   ← dynamic detail page
    └── *.data.ts          ← static sample data shared across pages (no default export)
```

### Rules for theme pages

1. **`layout.tsx` is a Client Component** (`'use client'`) — it owns interactive shell state (mobile menu open, search value, etc.).
2. **`page.tsx` files are Server Components** by default — no `'use client'` unless the page itself manages state.
3. **Shared sample data lives in `*.data.ts`** files inside the theme directory, not inside components. Components receive data as props; pages import and pass it down.
4. **Do not duplicate domain components** — compose from `modules/domain/<vertical>/` and `modules/ui/`. Only create theme-local components for layout wiring that has no domain equivalent.
5. **Dynamic routes use `generateStaticParams`** to enumerate known slugs from the data file.
6. **`<main id="main-content">`** in `layout.tsx` — required for the skip-link accessibility pattern.
7. **No real data fetching** — themes use static sample data. `async` page components are allowed but only to `await params` (Next.js 16 async params API).

### Page anatomy

Each theme typically covers:

| Page | Route | Purpose |
|------|-------|---------|
| Homepage | `/theme/<v>/` | Hero / above-the-fold + content sections |
| Listing | `/theme/<v>/<section>/` | Filtered, paginated content index |
| Detail | `/theme/<v>/<section>/[slug]/` | Single item deep-dive |
| (optional) Dashboard | `/theme/<v>/dashboard/` | Authenticated-feel management view |

### Existing themes

One theme demo per domain vertical. For the live route + status of each, see the `themes[]` array in `/api/registry`.

| Theme | Route | Domain layer used |
|-------|-------|-------------------|
| AI workspace | `/theme/ai/` | `modules/domains/ai/` |
| API docs | `/theme/api-doc/` | `modules/domains/api-doc/` |
| Blog | `/theme/blog/` | `modules/domains/blog/` |
| Commerce | `/theme/commerce/` | `modules/domains/commerce/` |
| Common (auth/account) | `/theme/common/` | `modules/domains/common/` |
| Event tickets | `/theme/event/` | `modules/domains/event/` |
| Fintech dashboard | `/theme/fintech/` | `modules/domains/fintech/` |
| Food / restaurant | `/theme/food/` | `modules/domains/food/` |
| Forum | `/theme/forum/` | `modules/domains/forum/` |
| IoT platform | `/theme/iot/` | `modules/domains/iot/` |
| Jobs board | `/theme/jobs/` | `modules/domains/jobs/` |
| Landing page | `/theme/landing/` | `modules/domains/landing/` |
| Media (video) | `/theme/media/` | `modules/domains/media/` |
| NFT marketplace | `/theme/nft/` | `modules/domains/nft/` |
| Personalise (B2B promo catalog) | `/theme/promozone/` | theme-local components under `app/theme/promozone/` (no domain vertical yet) |
| Real estate | `/theme/real-estate/` | `modules/domains/real-estate/` |
| SCADA console (home network) | `/theme/scada/` | `modules/app/WidgetKit/` (`scada.scene`, `scada.symbol`, `SceneEditor`); no domain vertical |
| Social feed | `/theme/social/` | `modules/domains/social/` |
| Travel (flight + hotel) | `/theme/travel/` | `modules/domains/travel/` |

### Adding a new theme

**Required order — do not skip or reorder steps:**

1. **Types** — Define Zod schemas and TypeScript types in `modules/domain/<vertical>/types.ts`.
2. **Domain components** — Build all components under `modules/domain/<vertical>/`.
3. **Component showcase** — For each new domain component:
   - Add a `ShowcaseComponent` entry with at least 2 variants in `modules/showcase/data/sections/domain-<vertical>.showcase.tsx` (create the file if it does not exist).
   - Import and spread the builder in `modules/showcase/data/showcase.data.tsx`.
   - Add every component to `showcase.menu.ts` under a `'Domain'` category group — the sidebar will not show it otherwise.
4. **Theme pages** — Create `app/theme/<vertical>/` with `layout.tsx`, `page.tsx`, and sub-pages. All sample data goes in `<vertical>.data.ts`.
5. **Theme showcase entry** — Add a `ShowcaseComponent` entry (category `'Domain'`, or a dedicated `'Theme'` category if one exists) that links to the live theme route. Register it in `showcase.menu.ts` so it appears in the sidebar alongside the component entries for the same vertical.
6. **Register the theme** in the Existing themes table above.

---

## Design Tokens

CSS variables defined in `app/globals.css`. Use these in Tailwind classes — never hardcode hex values.

| Token | Value (light) | Purpose |
|-------|--------------|---------|
| `--primary` | `#3b82f6` | Primary actions |
| `--primary-hover` | `#2563eb` | Hover state |
| `--primary-active` | `#1d4ed8` | Active/pressed |
| `--primary-subtle` | `#eff6ff` | Tinted backgrounds |
| `--primary-fg` | `#ffffff` | Text on primary |
| `--secondary` | `#8b5cf6` | Secondary actions |
| `--surface-base` | `#ffffff` | Page background |
| `--surface-raised` | `#f9fafb` | Cards |
| `--surface-overlay` | `#f3f4f6` | Hover overlays |
| `--surface-sunken` | `#e5e7eb` | Inset areas |
| `--text-primary` | `#111827` | Body text |
| `--text-secondary` | `#6b7280` | Muted text |
| `--text-disabled` | `#9ca3af` | Disabled text |
| `--text-inverse` | `#ffffff` | Text on dark bg |
| `--border` | `#e5e7eb` | Default borders |
| `--border-strong` | `#d1d5db` | Emphasized borders |
| `--border-focus` | `#3b82f6` | Focus rings |
| `--success` | `#22c55e` | Success state |
| `--success-subtle` | `#f0fdf4` | Success background |
| `--success-fg` | `#14532d` | Text on success |
| `--warning` | `#f59e0b` | Warning state |
| `--warning-subtle` | `#fffbeb` | Warning background |
| `--error` | `#ef4444` | Error/danger state |
| `--error-subtle` | `#fef2f2` | Error background |
| `--info` | `#06b6d4` | Informational state |
| `--info-subtle` | `#ecfeff` | Info background |

Dark mode overrides are defined in `.dark { }` in the same file.

Tailwind maps these tokens via `@theme inline` — use them as `bg-primary`, `text-text-secondary`, `border-border-focus`, etc.

---

## Icons

**All icons must be sourced from Font Awesome.** Do not use inline SVGs, emoji, or other icon libraries.

### Installed packages

| Package | Purpose |
|---------|---------|
| `@fortawesome/react-fontawesome` | React component wrapper |
| `@fortawesome/fontawesome-svg-core` | Core SVG rendering engine |
| `@fortawesome/free-solid-svg-icons` | Solid icon set (primary) |
| `@fortawesome/free-brands-svg-icons` | Brand / logo icons |

### Usage

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

// Inside JSX:
<FontAwesomeIcon icon={faArrowRight} />
<FontAwesomeIcon icon={faGithub} className="text-text-secondary" />
```

### Rules

1. **Named imports only** — import the specific icon variable, never the whole set.
2. **`className` for styling** — use Tailwind classes (`text-primary`, `w-4 h-4`, etc.) on the `<FontAwesomeIcon>` element; do not use the `size` prop with raw strings like `"lg"`.
3. **`aria-hidden="true"`** on decorative icons; supply `aria-label` when the icon is the only content of a clickable element.
4. **No inline SVG** — if an icon is unavailable in Font Awesome Free, raise the requirement with the team rather than embedding custom SVG.
5. **No other icon libraries** — do not install or import `lucide-react`, `heroicons`, `react-icons`, or similar packages.

---

## Utilities

### `libs/utils/cn.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Always use `cn()` when building className strings. Never concatenate strings directly.

---

## Component Authoring Rules

1. **`'use client';`** at the top — all components are client components.
2. **Named exports** — no default exports.
3. **Inline or local types** — define prop types in the same file.
4. **`cn()` for classNames** — no template literals, no string concatenation.
5. **Token-only styling** — reference CSS variables; never use raw hex or RGB.
6. **Semantic HTML** — use `<button>` for actions, `<a>` for navigation, correct `<input type>`.
7. **ARIA attributes** — `aria-busy`, `aria-invalid`, `aria-describedby`, `aria-pressed`, `aria-expanded` where applicable.
8. **`focus-visible`** — always include `focus-visible:ring-2 focus-visible:ring-border-focus`.
9. **`disabled:opacity-50 disabled:cursor-not-allowed`** — standard disabled styling.
10. **Spread `...rest`** — pass remaining HTML attributes to the root element.
11. **No business logic in `ui/`** — data fetching, routing, and external calls belong in `app/` or `domain/`.

---

## Component Pattern Template

```typescript
'use client';
import { cn } from '@/libs/utils/cn';

type MyComponentVariant = 'primary' | 'secondary';

const variantClasses: Record<MyComponentVariant, string> = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-secondary text-secondary-fg hover:bg-secondary-hover',
};

type MyComponentProps = {
  variant?: MyComponentVariant;
  children?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export function MyComponent({
  variant = 'primary',
  children,
  className,
  ...rest
}: MyComponentProps) {
  return (
    <div
      className={cn(
        'rounded-md px-4 py-2 font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
```

---

## File Naming Conventions

| What | Convention | Example |
|------|------------|---------|
| UI component | PascalCase `.tsx` | `ButtonGroup.tsx` |
| Domain component | PascalCase `.tsx` | `ProductCard.tsx` |
| Showcase builder | kebab-case `.showcase.tsx` | `domain-ecommerce.showcase.tsx` |
| Utility | camelCase `.ts` | `cn.ts` |
| Domain directory | lowercase | `ecommerce/`, `fintech/` |

---

## Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@/` | Project root |
| `@/modules/ui/` | UI components (atoms + molecules) |
| `@/modules/app/` | App patterns (organisms + page shells) |
| `@/modules/domains/` | Domain components (industry verticals) |
| `@/modules/domains/<vertical>` | Single vertical's barrel — `import { ProductCard } from '@/modules/domains/commerce'` |
| `@/modules/registry/registry` | Build the AI-facing machine-readable catalog |
| `@/libs/utils/cn` | className utility |

---

## Quick Reference: Where to Put New Code

| What you're building | Where it goes |
|----------------------|---------------|
| Single-purpose UI element (button, badge, input) | `modules/ui/` |
| Composed UI widget (card, modal, table) | `modules/ui/` |
| Full page section or layout shell | `modules/app/` |
| Industry-specific component | `modules/domains/<vertical>/` |
| New industry vertical | `modules/domains/<vertical>/` + new `sections/domain-<vertical>.showcase.tsx` + add to `modules/domains/index.ts` namespace export |
| Showcase entry for existing component | `modules/showcase/data/sections/` matching file |
| New design token | `app/globals.css` + add to `DESIGN_TOKENS` in `modules/registry/registry.ts` |
