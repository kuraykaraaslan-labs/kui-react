# Phase 12: Document editors (Markdown, text, Word, PDF, slides)

**Goal:** give the KUI family a real document editor: a `DocumentEditor` on ProseMirror (through Tiptap's MIT packages)
with a page canvas good enough for Word documents, a `MarkdownEditor` that saves without reformatting what nobody touched,
a plain-text mode for `CodeEditor`, and later a `PdfEditor` and a `SlideEditor`. kui-react is the design source of truth;
next-boilerplate (NB) vendors these components for its `document_editor` family.
**Effort:** L. Each DEK section is its own commit series; DEK-1…DEK-4 are released before NB's `document_editor` 02.
**Depends on:** nothing hard. Phase 7 (i18n foundation) and phase 2 (tests) are used.
**Repos:** kui-react, plus kui-ejs for DEK-4 only (`CodeEditor` already exists there at parity, so its plain-text mode is
mirrored, 12.4). kui-ejs and KUInative get **no mirror** of the new components: they exist nowhere else (owner rule: no
component is created where it is absent unless asked). Parity exceptions are recorded (12.13).
**Origin:** NB planning talk of 2026-11-07, owner decisions OD-234…OD-244
(`$NEXT_BOILERPLATE_ROOT/docs/concepts/document-editor-platform/README.md`). Item ids `DEK-<n>` are cited by NB's
`docs/concepts/document-editor*/` folders; never renumber them.

## Owner decisions (2026-11-07)

1. The editor is built in kui-react on **ProseMirror through Tiptap's MIT-licensed packages only**: no `@tiptap-pro/*`, no
   Tiptap Cloud, no paid extension (OD-237).
2. `RichTextEditor` (Quill 2) stays as it is for form fields; it is not migrated in this phase.
3. Editors save on Save / Apply only; no component here saves or stores anything by itself (no `autosaveKey` behaviour in
   the new components; a host may keep a per-browser draft).
4. Merged screens are a header button plus a drawer, never tabs: the toolbar is one row of grouped menus with an overflow
   menu, not a ribbon with tabs.

## Existence check (2026-11-07)

| Item | kui-react | kui-ejs | KUInative |
|---|---|---|---|
| `RichTextEditor` (Quill 2: toolbar, mentions, slash commands, Markdown helpers, image insert, tables) | `modules/app/RichTextEditor/` | — | — |
| `CodeEditor` (engine-agnostic, find / replace, markers, completion, hover) | `modules/ui/CodeEditor/` | yes (parity) | — |
| `DiffViewer` | `modules/ui/DiffViewer/` | — | — |
| `AiHumanDraftEditor` | `modules/ui/AiHumanDraftEditor/` | — | — |
| Document editor, Markdown editor, PDF editor, slide editor | missing | missing | missing |

Why not extend `RichTextEditor`: Quill's Delta model has no strict schema for nested blocks, weak tables, no page layout
and no mature co-editing binding; an imported Word file needs a schema that refuses what it cannot represent. Quill stays
where it fits (short formatted fields).

## 12.0 Licences, packaging, styling (DEK-0)

Every library is MIT, Apache-2.0, BSD or ISC; fonts OFL-1.1 or Apache-2.0. Checked against each package's metadata at the
pinned version before the first commit; a CI check lists licences of the `./editor` dependency tree and fails on anything
else. An ESLint `no-restricted-imports` rule blocks `@tiptap-pro/*` and `@tiptap-cloud/*`.

| Package | Licence | Used by |
|---|---|---|
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit` and the MIT extensions (table, image, link, task list, underline, text style, highlight, text align, subscript, superscript, placeholder, character count, typography) | MIT | DEK-1…DEK-7 |
| `prosemirror-*` (through `@tiptap/pm`), `prosemirror-markdown` | MIT | DEK-1, DEK-3 |
| `markdown-it`, `markdown-it-footnote`, `markdown-it-task-lists` | MIT / MIT / ISC | DEK-3 |
| `yjs`, `y-prosemirror`, `y-protocols` | MIT | DEK-9 |
| `pdfjs-dist` | Apache-2.0 | DEK-10 |
| Fonts: Carlito, Liberation Sans / Serif / Mono **2.x only** (1.x was GPL), Noto Sans / Serif | OFL-1.1 | DEK-6 |
| Font: Caladea | Apache-2.0 | DEK-6 |

Packaging: a new subpath export **`./editor`** (and `./editor/pdf`, `./editor/slides`), so `.`, `./ui` and `./app` never pull
ProseMirror or pdf.js. The libraries are optional peer dependencies (`peerDependenciesMeta.optional`, as `quill` is today).
pdf.js loads its worker lazily. Styling is tokens only and icons are Font Awesome only (ADR-0004); the page canvas keeps
"paper" light in dark mode by default, with a host prop for dark paper.

## 12.1 DEK-1 — `DocumentEditor` core

`modules/app/DocumentEditor/` (new):

- **Value:** controlled `value` / uncontrolled `defaultValue` as ProseMirror JSON; `onChange(json, { docChanged, steps })`;
  never HTML strings in or out (hosts convert with the presets' parsers and serializers).
- **Presets:** `preset="markdown" | "word" | "plain-rich"` (`plain-rich` carries paragraph levels and the `carried`
  attribute of DEK-6 for slide text boxes) select the schema (nodes, marks) and the default toolbar; a host
  may pass extra Tiptap extensions. Schemas are strict: content that does not fit is refused by parse rules, never kept as
  raw HTML.
- **Handle (`ref`):** `getJSON()`, `setContent(json)`, `focus()`, `commands` (typed), `getStats()` (words, characters,
  pages when DEK-5 is on), `find(query, opts)`, `replace(…)`, `scrollToNode(id)`.
- **Paste and drop:** HTML is sanitised through the schema's parse rules (no `innerHTML` of foreign content); images on
  paste or drop call `onUploadImage(file) => Promise<{ src }>`; without it, image paste is refused with a message.
  `javascript:`, `vbscript:`, `data:` (except images given by the host) and `file:` links are dropped.
- **Remote media:** an image whose `src` is a remote URL renders as a placeholder until the host's
  `allowRemoteMedia(host)` returns true (NB DE-E14).
- **Read-only**, **history** (undo / redo), **input rules** (Markdown-style shortcuts, typography), **keyboard map** with
  platform-aware shortcuts, **i18n** (`messages` prop, en and tr defaults), **a11y** (`role="textbox"`,
  `aria-multiline`, labelled toolbar, focus order).
- **Performance budget:** typing latency p95 ≤ 50 ms on a 100-page document on a mid-range laptop (measured by a
  Playwright trace in CI, provisional threshold).

## 12.2 DEK-2 — Toolbar and chrome

- **Toolbar:** one row, grouped dropdown menus (Text, Paragraph, Insert, Table, Review) plus direct buttons for the most used
  actions; an overflow menu takes what does not fit; `role="toolbar"` with roving tab index. Configurable per preset and by
  the host.
- **Bubble menu** on a selection (bold, italic, link, comment when DEK-9 is on); **slash menu** for blocks (reusing
  `RichTextEditor`'s trigger keyboard pattern).
- **Find and replace bar** (Ctrl/Cmd+F / H): case, whole word, regular expression, replace one / all.
- **Outline** data (`getOutline()`) for a host drawer; **status bar** (words, characters, cursor, zoom, page x of y with
  DEK-5); **zoom** (50–200 %).
- **Phone width:** the toolbar scrolls horizontally; the bubble menu stays above the on-screen keyboard.

## 12.3 DEK-3 — Markdown

`modules/app/MarkdownEditor/` (new):

- **Visual** mode: `DocumentEditor` with the Markdown preset (CommonMark + GFM: tables with alignment, task lists,
  strikethrough, autolinks, footnotes); front matter and raw HTML as **locked blocks** (shown as code, never rendered);
  math and diagram fences as code blocks.
- **Source** mode: `CodeEditor` with Markdown highlighting; **source + preview** split with scroll sync by block; the preview
  renders through the same schema (no `markdown-it` HTML output with `html: true`).
- **Parse and serialise** with `markdown-it` + `prosemirror-markdown`:
  - **Block source map:** each top-level node keeps the source slice it came from; `serialize({ original })` writes
    unchanged blocks back byte for byte and serialises only changed or new ones.
  - **Style detection:** bullet, emphasis, strong, heading, fence, ordered-list numbering, line ending, trailing newline;
    changed blocks are written in the file's own style.
  - `serialize` reports `untouchedChanged: blockIndex[]` when a round trip would alter a block nobody edited, so the host
    can show a diff first (NB `document_editor` 03 §3.3).
- Value in and out is a Markdown **string** (`value`, `onChange(markdown)`), plus `mode` and `onModeChange`.

## 12.4 DEK-4 — Plain-text mode of `CodeEditor`

- `language="plaintext"`, soft-wrap toggle, go to line, regular-expression find / replace (existing M2 aids).
- Status bar slots for **encoding**, **line endings** (LF / CRLF / mixed) and **BOM**, given by the host (the component does
  not decode bytes); line and column.
- **Large-file mode:** virtualised lines above a threshold (default 20 000 lines); long lines wrapped, never truncated.
- kui-ejs parity: `CodeEditor` has an EJS sibling at parity, so the status bar slots and large-file mode are mirrored there
  in the same section (the existing parity contract, ADR-0003).

## 12.5 DEK-5 — Page canvas and pagination

- `pageLayout` prop: size (A4, A5, Letter, Legal, custom), orientation, margins, header and footer regions (first page
  different, odd / even different), page number fields, columns (1–3, equal width), section breaks that change any of these.
- **Live pagination** by measurement: after layout, line boxes are measured and page gaps (with the next page's header and
  the previous page's footer) are inserted as widget decorations at the line where a page overflows; tables split between
  rows (header rows repeat), images move whole; keep-with-next and widow / orphan control (2 lines) approximated. The
  document model is never changed by pagination.
- Page setup is **per section**: each section carries its own size, orientation, margins, columns and header / footer
  regions (default, first page, even page), as Word does.
- Print layout and browser **Print / Save as PDF** with the same page breaks (`@page` rules generated from `pageLayout`).
- **Page display list** (`getPageLayout()`): per page, the positioned glyph runs (text, font, size, colour), images (with
  crop and clip), vector paths, borders, fills, transforms and header / footer contents, measured from the laid-out pages. NB's host turns it into PDF bytes with
  `pdf-lib` in the browser (NB DEF-E6, OD-243: no server converter); kui-react itself does not depend on `pdf-lib`.
- Target, measured on NB's Word corpus: page breaks within one line of Word's own PDF on 90 % of pages (provisional; the
  number is reported, not assumed).

## 12.6 DEK-6 — Word blocks and styles

- **Styles as data:** paragraph and character styles with inheritance (`basedOn`), a style gallery menu, "update style to
  match", clear formatting.
- **Lists:** multi-level numbering definitions (decimal, letters, roman, bullets, legal 1.1.1), restart / continue.
- **Tables:** merge / split cells, column widths, row heights, header row repeat, cell shading and borders, alignment,
  nested tables (read and write; editing kept simple).
- **Images:** inline and wrapped (square, top-and-bottom, behind / in front shown as locked islands in v1), resize with
  aspect lock, alt text, captions.
- **Text:** fonts and sizes, colour, highlight, character spacing kept, sub / superscript, small caps, line and paragraph
  spacing, indents, tabs (left / centre / right / decimal stops), page and section breaks, non-breaking spaces.
- **References:** footnotes and endnotes, bookmarks, internal and external hyperlinks, table of contents and page number
  fields (updated on demand).
- **Carried properties:** every DEK-6 node and mark has a `carried` attribute holding properties the host's format
  understands but the editor does not (raw, opaque to the editor); it survives split, join, copy within the document and
  undo. NB's Word module stores unknown Word properties there (DEW-E5).
- **Fonts:** the bundled set of 12.0 with the metric-compatible mapping (Calibri → Carlito, Cambria → Caladea, Arial →
  Liberation Sans, Times New Roman → Liberation Serif, Courier New → Liberation Mono, fallback Noto); loaded on demand.

## 12.7 DEK-7 — Review marks

- Tracked insertions, deletions and formatting changes as marks with author, colour and time; **Track changes** on / off;
  accept / reject one, all, or by author; a "Final / Final with markup / Original" view switch (a toolbar control, not tabs).
- Each mark also carries a **move** flag (moved-from / moved-to) and the **raw old properties** of a formatting change, opaque
  to the editor, so a host can write them back (DEW-E26).
- Comment anchors as marks with a thread id (the threads themselves are the host's, DEK-9).

## 12.8 DEK-8 — Fidelity and safety UI

- **Locked island** nodes, **block and inline** (and, for slides, positioned objects with a transform: move, and resize for
  charts and embedded objects): an atom carrying an opaque payload the host gives, plus a label and a
  short text excerpt for screen readers and search (for example an unsupported Word
  part), shown as a labelled locked box with an optional fallback picture taken from the file; it can be moved or deleted as a unit, never edited
  inside.
- **Fidelity report** panel component: a list of `{ kind, count, action: 'kept' | 'simplified' | 'lost', detail }` with
  icons and a short explanation per kind, for a host drawer.
- **Protected banner** and **read-only banner** components with an action slot.

## 12.9 DEK-9 — Co-editing bindings and comments panel

- `collab` prop: `{ doc: Y.Doc, awareness, user: { id, name, color } }` wires `ySyncPlugin`, `yCursorPlugin` and
  `yUndoPlugin` (per-user undo); the component knows nothing about transport.
- **Presence** avatars component (names, colours, "n more").
- **`CommentThreadPanel`** (new, `modules/app/CommentThreadPanel/`): threads with replies, resolve / reopen, mentions
  through a host `searchMembers` callback, filters (open / resolved / detached, author), click-to-scroll to the anchor;
  data and persistence are the host's.

## 12.10 DEK-10 — `PdfEditor`

`modules/app/PdfEditor/` (new, `./editor/pdf`):

- **Fixed pdf.js options:** scripting off, `isEvalSupported: false`, XFA off, worker and font / cMap assets from the app's
  own origin (the CSP-safe set-up kui-viewer already uses in `designer-pdf.ts`, pdfjs-dist 6.4.299); a password prompt
  inside the component (the password never leaves the browser); the document's permissions (no modify, no annotate, no
  fill) reported to the host and honoured.
- Viewer on `pdfjs-dist`: virtualised pages, text layer (selection, search), zoom, fit width / page, rotation view,
  thumbnails component for a host drawer, outline (bookmarks) list.
- **Annotation tools:** highlight, underline, strikeout, sticky note, free text, ink, rectangle / ellipse / line / arrow,
  image stamp, signature placement box, placeable in a **read-only** view too, since anyone who can see a PDF may sign it (NB OD-244); the signing itself is the host's.
- **Several signature boxes at once** (NB signature requests, need N-R6): the host gives a list of recipients (`{ key, label,
  colour }`) and how many boxes each may have (NB: exactly one); the person places the boxes, each labelled with its recipient's
  name and drawn in its colour, movable, resizable and deletable, kept inside the page; output `{ id, recipientKey, pageIndex,
  rect }[]` in page user units (the page's `/MediaBox` coordinates after its `/Rotate`, as the edit model documents).
- **"Sign here" highlight** (N-R6): in a read-only view the host names one empty signature field (the current signer's); the
  component outlines it, scrolls to it on request ("Go to my box") and shows a "Sign here" marker beside it; other fields stay
  plain. Nothing is written by the component.
- **Forms:** AcroForm text, checkbox, radio, choice fields filled in place; XFA forms shown read-only with a notice.
- **Pages:** reorder by drag in thumbnails, rotate, delete, insert pages from another PDF (host gives the bytes), extract.
- **Redaction marks:** the user marks areas or text; the component outputs them; applying redaction is the host's (it must
  remove content, not cover it).
- Thumbnail tools for the host's Pages drawer (select, drag to reorder, rotate, delete, insert marker).
- Output: an **edit model** (annotations, form values, page operations, redaction marks, a signature box; its TypeScript shape is
  documented with the component and versioned) for the host to write into the PDF;
  the component never writes PDF bytes (NB DEF-E3).

## 12.11 DEK-11 — `SlideEditor`

`modules/app/SlideEditor/` (new, `./editor/slides`):

- **Canvas base (checked 2026-11-07):** kui-viewer has no 2D slide canvas (its designer is a Three.js building designer).
  The 2D base is kui-react's own SCADA scene editor helpers, which already do snapping and guides, zoom and pan, grouped
  undo and z-order (`modules/app/WidgetKit/views/scene-edit-snap.ts`, `scene-editor-state.ts`, `scene-edit-history.ts`,
  `scene-edit-logic.ts`). First step: lift them into a shared canvas module used by both, with no behaviour change for
  WidgetKit.
- Slide list (thumbnails, reorder, duplicate, hide), canvas with text boxes (`DocumentEditor` per text box, `plain-rich`
  preset), shapes, images, simple tables, layouts and masters given as data by the host, speaker notes, **Present** mode
  (full screen, keyboard, presenter view with notes and timer).
- **Slide display list** (`getSlideLayout()`): per slide, measured glyph runs, images with crop and clip, vector paths,
  fills, borders and transforms, the same shape as DEK-5's page display list, so NB's host writes slides to PDF with the
  same writer (NB DEF-E6).
- Output: a slide model for the host to write (NB `document_editor_slides`).

## 12.11a DEK-12 — Mentions, fill-in fields and the AI panel

- **Mention node** (inline atom chip) in every `DocumentEditor` preset: typing `@` opens a suggestion popup fed by a host
  callback `searchMentions(query) => Promise<{ type, id, label, href }[]>` (people and platform records, NB host 11); the
  chip stores `{ type, id, label }`, renders as a link, and shows "no access" without a label when the host says so on
  load. In Markdown it is written as a normal link; in Word as a hyperlink with the label.
- **Fill-in field node** (inline atom chip) for templates (NB `document_editor_template`): `{ key, label, type, required }`,
  a **Fields** panel component listing them, a "fill" mode that replaces each chip with a value the host gives and reports
  missing required fields.
- **The chip shows its kind** (NB need N-T8): a mention chip and a field chip look different (icon and style), and a field chip
  shows its kind (text, check, choice) with its key on hover, so a person never mistakes a template place for a link to a record.
- **The fill mode is optional:** NB fills templates on the file's bytes with each format's own filler (NB DET-E6), not in the
  component, so NB does not use the fill mode; it stays a component feature for other hosts and is not a release blocker for NB.
- **AI panel**: hooks to send the selection or the document to a host callback and show the answer as a proposed change
  with accept / reject (reusing `AiHumanDraftEditor`'s draft-versus-human view), never applied without a click.

## 12.11b DEK-13 — Watermark and restricted mode

- A **watermark** overlay prop on `DocumentEditor`, `PdfEditor` and `SlideEditor` (text such as the viewer's name, e-mail,
  date and label; tiled, semi-transparent, not selectable), also drawn into the browser print.
- A **restricted** mode prop: copy, cut, drag-out, print and the component's own export actions are disabled and the
  context menu is reduced; the component says this is a deterrent, not protection (the real protection is the host not
  handing out bytes, NB host 10).

## 12.12 Showcase, docs and tests

- Showcase sections: `app-document-editor.showcase.tsx` (Markdown, Word-like with page canvas, read-only, review marks,
  fidelity report, co-editing demo with two local `Y.Doc`s), `app-markdown-editor.showcase.tsx`, `app-pdf-editor`,
  `app-slide-editor` when they land; the registry entries and props schema (phase 8).
- Tests: vitest for commands, schemas, parse / serialise (CommonMark and GFM spec corpora for DEK-3, byte-identity for
  untouched blocks), the XSS corpus (paste, links, locked HTML); Playwright visual tests for the page canvas and pagination
  breaks; axe a11y checks; the typing-latency trace of 12.1.

## 12.13 Parity exceptions

`parity.exceptions.json` gains records for `DocumentEditor`, `MarkdownEditor`, `CommentThreadPanel`, `PdfEditor`,
`SlideEditor`: `presentIn: ["kui-react"]`, `absentIn: ["kui-ejs", "KUInative"]`, reason "New in phase 12 for NB's document
editor family (OD-234…OD-244); no counterpart; created elsewhere only on an owner request".

## Order and releases

| Step | Items | Release needed by |
|---|---|---|
| 1 | DEK-0, DEK-1, DEK-2 | NB `document_editor` 02 |
| 2 | DEK-3 | NB `document_editor` 03 (Markdown, the owner's first format) |
| 3 | DEK-4 (+ kui-ejs `CodeEditor` parity) | NB `document_editor` 04 |
| 4 | DEK-5, DEK-6, DEK-8 | NB `document_editor_word` 01–04 |
| 5 | DEK-7, DEK-9 | NB `document_editor` 06, `document_editor_word` 05 |
| 6 | DEK-10 | NB `document_editor_pdf`; its several boxes and "Sign here" highlight: NB `document_editor_sign_request` |
| 7 | DEK-11 | NB `document_editor_slides` |
| 8 | DEK-12 | NB `document_editor` 08 (AI help), 11 (mentions), `document_editor_template` |
| 9 | DEK-13 | NB `document_editor` 10 (labels, watermarks) |

Each step is tagged and released by the owner before NB vendors it (NB anchor Q3). Not before NB's IoT release (OD-236).

## Status

| Date | Event |
|---|---|
| 2026-11-07 | Phase written from the NB planning talk; nothing built. |
| 2026-11-08 | DEK-10 gains several labelled signature boxes and a "Sign here" highlight (NB need N-R6); DEK-12's chip shows its kind and the fill mode is optional for NB (NB need N-T8); nothing built. |
