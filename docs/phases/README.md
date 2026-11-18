# Developer plan (docs/phases)

Phased improvement plan for the KUI showcase repositories. Phases 0-9 were produced from a code audit on **2026-09-15** and cover kui-react and kui-ejs, because most gaps are shared and several fixes only make sense if they land in both. Phase 10 (2026-10-11) also covers KUInative. This folder was `docs/dev/` until 2026-10-11; every KUI repo now keeps its phases in `docs/phases/`.

| Repo | Path key | Stack |
|---|---|---|
| kui-react (this repo) | `$KUIREACT_ROOT` | Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 |
| kui-ejs | `$KUIEJS_ROOT` | Express 4 · EJS 3 · TypeScript 5 · Tailwind CSS 4 |
| KUInative (from phase 9) | `$KUINATIVE_ROOT` | Expo · React Native · NativeWind |

Path keys resolve through `internal-ai-rules/LOCAL_PATHS.json`. Never hardcode absolute paths in these docs; the audit found five stale absolute paths in the repos already (see phase 0).

## How to use this folder

1. Read [2026-09-15-code-audit.md](../audits/2026-09-15-code-audit.md) first. It is the baseline: what was measured, how, and the raw numbers every phase refers to.
2. Work through the phases in order. Each phase lists its dependencies. A later phase never requires an earlier one to be 100 % done, but it assumes the earlier phase's *gates* (CI jobs, scripts) exist.
3. Tick a checkbox only when the task is merged on `main`. Append the short commit hash after the task text.
4. When a number quoted in a phase changes, re-run the command from the audit file and update both places. Do not edit numbers from memory.
5. If a task turns out to be wrong or unnecessary, strike it through and add one line saying why. Do not delete it; the reasoning is useful later.

## Phases

| # | File | Goal | Effort | Depends on |
|---|---|---|---|---|
| 0 | [00-hygiene.md](00-hygiene.md) | Zero-risk cleanups: stale paths, package metadata, gitignore, dependency placement, doc drift, repo hygiene files | S | none |
| 1 | [01-ci-and-gates.md](01-ci-and-gates.md) | CI on both repos, registry snapshot drift check, convention lint rules, debt thresholds, pre-commit hooks | M | 0 |
| 2 | [02-testing.md](02-testing.md) | Unit tests, route smoke tests, visual regression, automated a11y, registry consistency tests | M–L | 1 |
| 3 | [03-release-and-package.md](03-release-and-package.md) | Honest npm story: publish or retract, exports map, peer dependencies, build output, release tooling | M | 1 |
| 4 | [04-shared-tooling-and-parity.md](04-shared-tooling-and-parity.md) | One tooling package, one design-token source, generated parity matrix and editor-rule mirrors, version alignment | L | 1, 3 |
| 5 | [05-ejs-security-and-runtime.md](05-ejs-security-and-runtime.md) | CSP, CSRF, inline-script extraction, error pages, Express 5, caching, asset pipeline, static deploy for kui-ejs | M–L | 0, 1 |
| 6 | [06-architecture-refactors.md](06-architecture-refactors.md) | Source-of-truth fixes, browser-free snapshot, form system, standalone-package dedupe, Next.js app-level files, EJS locals contract | L | 1, 2 |
| 7 | [07-showcase-and-dx.md](07-showcase-and-dx.md) | Props editor, search, URL state, grid view, i18n foundation, sitemap/robots, dependency graph page | M | 4, 6 |
| 8 | [08-product.md](08-product.md) | `kui` CLI, registry props schema, MCP as a product, scope decisions recorded as ADRs | L | 4, 6, 7 |
| 9 | [09-data-and-realtime-components.md](09-data-and-realtime-components.md) | Generic data and realtime components: chart time axis, brush/zoom, gauge, heatmap, dashboard time-range picker, live map markers + clustering, key/value editor, schema form, live-data hooks, status indicator, QR, CSV export (first consumer: [docs/concepts/iot-platform/](../concepts/iot-platform/README.md)) | L | none hard (1, 2 recommended) |
| 10 | [10-ecosystem-gap-closure.md](10-ecosystem-gap-closure.md) | Gaps found against five reference libraries: palette presets, primitives (carousel, OTP, list, marquee, sortable, kbd, link), landing/commerce blocks, portfolio and agency themes, cross-repo drift (placement per use case, mirrors pixel-perfect, everything in the demo shell) | L | none hard (4.2, 4.4 help) |
| 11 | [11-data-table-adoption.md](11-data-table-adoption.md) | `DataTable` carries every next-boilerplate data page: host-owned (manual) mode, server mode for real APIs, live rows from `KeyedTable`, responsive/footer columns, filter chips and date presets, card layout, full messages; new `OrgChart`, `DescriptionList`, `BarList`; KUInative mirrors of board, gallery, chat, log viewer | L | none hard (4.4 helps) |
| 12 | [12-document-editor.md](12-document-editor.md) | Document editors for next-boilerplate's `document_editor` family: `DocumentEditor` on ProseMirror (Tiptap MIT packages only) with toolbar, page canvas and pagination, Word blocks and styles, review marks, locked islands and fidelity report, co-editing bindings and `CommentThreadPanel`; `MarkdownEditor` that keeps untouched blocks byte for byte; `CodeEditor` plain-text mode; later `PdfEditor` and `SlideEditor`. kui-react only (parity exceptions), except DEK-4's `CodeEditor` plain-text mode mirrored in kui-ejs | L | none hard (2, 7 used) |

Effort: **S** under a day, **M** a few days, **L** a week or more of focused work.

## Status legend

- `[ ]` not started · `[~]` in progress · `[x]` merged on `main` (add commit hash)
- Tags: `[react]` only kui-react · `[ejs]` only kui-ejs · `[both]` mirror the change in both repos · `+native` after a tag: also mirror in KUInative (`$KUINATIVE_ROOT/docs/phases/`; used from phase 9 on)

## Priorities if time is short

The five items below give the most protection per hour. They are all in phases 0 and 1.

1. CI on both repos (phase 1). Neither repo has a single workflow today.
2. Registry snapshot drift check in CI (phase 1). The deployed catalog silently goes stale otherwise.
3. Decide the npm question (phase 3). The package the README advertises does not exist on the registry.
4. Fix the stale path references and package metadata (phase 0). Cheap, and every AI agent reading the repos trips over them.
5. A test skeleton, even ten tests (phase 2). Zero tests today in either repo.

## Related documents

- [AGENTS.md](../../AGENTS.md): authoring rules that every task here must still satisfy.
- [docs/reference/feature-roadmap.md](../reference/feature-roadmap.md): the older feature roadmap. Phase 0 refreshes its coverage column; several rows there are marked missing but already shipped.
- [docs/research/versus/](../research/versus/): comparisons with other boilerplates. They currently describe kui-react as an installable npm package; phase 3 makes that true or removes the claim.
- `internal-ai-rules/KUI_Package_Rules`: how standalone `@kuraykaraaslan/kui-*` packages are structured. Relevant to phases 3, 4 and 6.
- `internal-ai-rules/UI_Interface_Rules_EJS`: the EJS rules that phase 5 brings kui-ejs into line with (CSRF, CSP, ModalModule).
