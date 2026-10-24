# modules/app

App-level patterns (organisms + page shells). Composes `modules/ui/` primitives into reusable page sections, layouts, and workflows. May own local state. No domain-specific business logic.

## Files

Canonical list is [index.ts](index.ts). See [/AGENTS.md](../../AGENTS.md#layer-2--modulesapp-app-patterns--organisms) for the grouped reference with descriptions.

Top-level `.tsx` files cover shell, navigation, forms, content, states, notifications, theming, a11y, and collaboration organisms. Larger features that needed splitting per the 250-LoC rule live in their own folders:

- [Calendar/](Calendar/) — multi-view scheduler (see [PLAN.md](Calendar/PLAN.md))
- [CommandPalette/](CommandPalette/) — ⌘K palette (exposed as `AppCommandBar`)
- [EntityAliases/](EntityAliases/) — dashboard entity alias editor, the ThingsBoard model (see its [README](EntityAliases/README.md))
- [FileUploadSection/](FileUploadSection/) — drag-drop uploader + parts
- [FormBuilder/](FormBuilder/) — schema-driven form editor + renderer
- [Gantt/](Gantt/) — WBS + timeline + dependencies (see [PLAN.MD](Gantt/PLAN.MD))
- [ImageGallery/](ImageGallery/) — grid + lightbox
- [KanbanBoard/](KanbanBoard/) — drag-and-drop column board
- [RichTextEditor/](RichTextEditor/) — Quill-based editor + toolbar + popups

## Parity

NextJS-first. The following organisms have pixel-parity EJS partials under `$KUIEJS_ROOT/modules/app/`:

- `MaintenancePage.tsx` ↔ `MaintenancePage.ejs`
- `ShareDialog.tsx` ↔ `ShareDialog.ejs`
- `CommentThread.tsx` ↔ `CommentThread.ejs` (recursive via self-include)
- `MentionPicker.tsx` ↔ `MentionPicker.ejs` (server-render + inline keyboard handler)
- `OnboardingWizard.tsx` ↔ `OnboardingWizard.ejs` (server-rendered, `?step=N` query)

EJS layouts under `views/layouts/` and `views/theme/common/` cover the remaining shells.

## Conventions

1. `'use client';` at top.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. Compose `modules/ui/` primitives — never re-implement atoms.
7. No fetch/router calls in component bodies — accept data and callbacks as props.

See [/AGENTS.md](../../AGENTS.md) for the full authoring contract.
