# Phase 11: DataTable adoption (next-boilerplate on one table)

**Goal:** make `DataTable` able to carry every data page of next-boilerplate (NB), so NB can drop its own
`ServerDataTable`, its raw `<table>` markup and its hand-rolled lists, and give every list sortable columns and
filters. Add the missing collection components the same inventory found (org chart, description list, bar list) and
bring the existing ones (Kanban board, image gallery, chat, log viewer, …) to KUInative.
**Effort:** L. Each numbered section is its own commit; 11.1–11.9 land before NB vendors the table.
**Depends on:** nothing hard. 4.4 (parity matrix) makes the mirror checks automatic.
**Repos:** kui-react first, then kui-ejs and KUInative in the same section (pixel-perfect per
[ADR 0003](../adr/0003-react-ejs-parity-contract.md)). Mirror plans: `$KUIEJS_ROOT/docs/phases/11-data-table-adoption.md`
and `$KUINATIVE_ROOT/docs/phases/11-data-table-adoption.md`.
**Origin:** NB table inventory of 2026-10-25 (`$NEXT_BOILERPLATE_ROOT/docs/phases/43-data-tables/README.md`): 471 routed
pages, 0 sortable columns, 262 `ServerDataTable` uses, 78 pages with raw tables, 69 with hand-rolled lists.

## Owner decisions (2026-10-25)

1. Every NB data page uses `DataTable`, with sortable columns and filters. No exceptions.
2. Small detail and report tables use it too (static mode); they need not switch on every feature.
3. Live tables (`KeyedTable`): `DataTable` learns live rows first, then the IoT views move to it.
4. A filter or sort gap found while moving NB is fixed here first, then mirrored.
5. Boards, galleries, the org chart, timelines, chat and catalog grids are built or improved in the KUI family
   (react, ejs, native, pixel-perfect). An existing component is improved and reused, never duplicated.

Owner decision 5 widens the phase-10 placement default ("KUInative only gets ui-layer primitives") for the components
listed in 11.10–11.13.

## Existence check (2026-10-25)

| Item | kui-react | kui-ejs | KUInative |
|---|---|---|---|
| `DataTable` (static / paginated / server, filter panel, selection, expand, row actions) | yes | yes | yes |
| `KeyedTable` (live rows, keyboard rows, retry) | yes | missing | missing |
| `KanbanBoard` | `app/KanbanBoard` | `app/KanbanBoard` | missing |
| `ImageGallery` | `app/ImageGallery` | `app/ImageGallery` | missing |
| `Timeline` | `ui/Timeline` | `ui/Timeline` | `ui/Timeline` |
| `TreeView` | yes | yes | yes |
| Chat (`domains/common/chat`) | yes | `domain/common/chat` | missing |
| `LogViewer` | yes | yes | missing |
| `FilterBar`, `DetailHeader`, `SectionCard` | yes | yes | missing |
| `StatCard` | yes | yes | yes |
| `OrgChart`, `DescriptionList`, `BarList` | missing | missing | missing |

## DataTable

### 11.1 `mode="manual"`: the host owns the rows `[both] +native`

The host passes `rows` and `total` and fetches itself; the table owns no data. It reports every change of the query
(`page`, `pageSize`, `sort`, `search`, `filterValues`) through `onQueryChange(query)`; `query` makes it controlled and
`defaultQuery` seeds it. `loading` keeps the rows on screen under an overlay, `error` + `onRetry` show the error row
with a retry button. Needed by live lists (IoT), by pages that merge socket updates into a fetched page, and by NB pages
that fetch through their own hooks.

### 11.2 Server mode for real APIs `[both] +native`

- `reloadKey`: any value; a change refetches the current page with the current query (after a create or delete).
- `searchDebounceMs` (default 300): the search box no longer fetches on every keystroke.
- `fetchPage` receives an `AbortSignal` (`args.signal`); a newer query aborts the older request.
- While a page loads, the previous rows, the header and the pagination stay mounted under a spinner overlay (focus on
  "Next page" survives; the layout does not jump). The empty "loading" row is only for the very first load.
- `onLoaded(result)`: the host can show the total in its page header.
- Error row with `onRetry` (refetch) in every mode.

### 11.3 Live rows (from `KeyedTable`) `[both] +native`

`rowState(row) → 'new' | 'leaving' | undefined` (highlight / fade), `rowClassName(row)`, keyboard rows (one row in the
tab order, Arrow Up/Down, Home/End, Enter/Space runs `onRowClick`; native: not applicable, recorded as an exception),
`isRowSelectable(row) → true | reason` (disabled checkbox with the reason as its title), `rowSelectLabel(row)`.
`KeyedTable` becomes a deprecated wrapper over `DataTable mode="manual"`; the IoT views move to `DataTable`.

### 11.4 Columns `[both] +native`

- `hideBelow: 'sm' | 'md' | 'lg'` (phone widths need no horizontal scroll; native: columns with `hideBelow` move into
  the row's detail).
- `sortKey`: the field sent to the server when it differs from `key`.
- `footer`: a footer cell per column (totals of invoice lines, report sums).
- `width` (CSS width of the column).

### 11.5 Sorting `[both] +native`

`multiSort` (default `true`; `false` = clicking another column replaces the sort, shift does nothing),
`defaultSort` alias of `initialSort`, sort state in the query of 11.1. A sortable header is a `<button>` inside the
`<th>` (keyboard reachable; today it is a clickable `<th>`).

### 11.6 Filters (owner decision 4) `[both] +native`

- **Active filter chips** under the toolbar: one removable chip per applied value (`Status: Paid ✕`, `Created:
  1–15 Oct ✕`) and "Clear all". Chips also show per-column header filters.
- **Date-range presets** on `daterange` fields: `presets: true` gives Today, Last 7 days, Last 30 days, This month,
  Last month; `presets` can also be a list of `{ label, from, to }`.
- **`numberrange`** field: two number inputs (min, max) for unbounded values (amounts); `range` stays the bounded
  slider.
- `filterFields[].defaultValue` for a field that starts set (for example "Status: Open").

### 11.7 Shell, layout, density `[both] +native`

- `title`, `subtitle`, `headerActions`: the card header NB's `ServerDataTable` has today.
- `toolbarStart` / `toolbarEnd`: extra controls inside the toolbar (a bulk-action button, a view switch).
- `variant: 'plain' | 'card'` (card = the raised, bordered shell); `density: 'comfortable' | 'compact'`.
- `bulkActions(selectedRows) → ReactNode`: rendered in the selection summary bar.

### 11.8 Card layout `[both] +native`

`layout="cards"` + `renderCard(row, { selected, toggleSelected })` + `cardMinWidth` (default 16rem): the same toolbar,
filters, sort and pagination over a responsive card grid. With no header row, a "Sort by" select built from the
sortable columns (field + direction) appears in the toolbar. For catalog pages (integrations, templates, plugins,
marketplace listings, storefront, widget library).

### 11.9 Messages `[both] +native`

Every visible string comes from `messages`: `showingRange` ("Showing {start}–{end} of {total}"), `noResults`,
`noResultsFor` ("No results for “{search}”"), `filteredFrom`, `retry`, `sortBy`, `ascending`, `descending`,
`clearAll`, `activeFilters`, the date presets, and the `Pagination` labels (passed through). No English literal is
left in the table's JSX.

## Collection components (owner decision 5)

### 11.10 `OrgChart` `[both] +native`

Tree of nodes (`id`, `parentId`, `render`), top-down with connector lines, collapsible subtrees, keyboard navigation
(tree pattern), zoom-to-fit on wide trees, `search` that expands to and highlights a match. Native: vertical indented
tree with the same node card.

### 11.11 `DescriptionList` `[both] +native`

Label/value pairs for detail pages: `items: { label, value, hint?, copyable? }[]`, `columns: 1 | 2 | 3`, `layout:
'stacked' | 'inline'`, empty value placeholder. Replaces the hand-made `Row` / `Record` helpers in NB detail pages.

### 11.12 `BarList` `[both] +native`

Ranked label + horizontal bar + value list for report breakdowns (`items: { label, value, href?, color? }[]`,
`valueFormatter`, `max`, `showPercent`), sortable by value or label.

### 11.13 KUInative mirrors of existing components `[native]`

`KanbanBoard`, `ImageGallery`, chat (`domains/common/chat`), `LogViewer`, `FilterBar`, `DetailHeader`, `SectionCard`
ported pixel-perfect from kui-react (touch interactions: long-press to drag on the board).

### 11.14 Existing components NB will lean on `[both] +native`

Checked while moving NB and improved here, not in NB: `KanbanBoard` (server-driven columns, card count and sum per
column, move callback that can be rejected), `ImageGallery` (selection, filters and sort through the 11.6 filter
panel), `Timeline` (grouping by day, load more).

### 11.15 `ChatThread` `[react] ejs, native open`

NB had three home-made threads (AI chat box, support ticket replies, team messaging) and no kit piece that fit:
`ConversationTimeline` is an AI investigation trace and `Timeline` runs newest first. `ui/ChatThread` is a controlled
thread: `items` (`id`, `author { name, avatarUrl?, avatar? }`, `side` own/other/system, `body`, `at`, `time?`, `status?`,
`delivery?`, `attachments?`, `actions?`) shown oldest first; it sticks to the bottom while the reader is there and shows a
"New messages" button once they scroll up (their own message always scrolls down); `hasOlder` + `loadingOlder` +
`onLoadOlder` keep the reading position when the older page lands; `pending` streams the last message; `typing` says
who is typing; `daySeparators`, `emptyMessage`, `loading`, a `composer` slot, `role="log"` with one article per message;
every string from `messages` (`DEFAULT_CHAT_THREAD_MESSAGES`). The list prop is `items` because `messages` holds the
strings, as on `DataTable`. `ChatBubble` / `ChatTypingIndicator` are its parts: the social `MessageBubble` and
`TypingIndicator` are now adapters over them, and `domains/common/chat/ChatBox` draws its list with `ChatThread`.
Mirrors: KUInative 26f706e (with 11.13); kui-ejs 02667c8 (`ui/ChatThread`, and `domain/common/chat/ChatBox` draws with it).

### 11.16 Gaps NB's migration hit `[both] +native` (2026-10-26)

From NB `docs/phases/43-data-tables/README.md` "Open after stage D/F" and the stage E reports. Kanban and IoT items are
kui-react only (kui-ejs / KUInative have no board and no IoT vertical).

- [x] 1. `Input` / `Select` `hideLabel`: the label is screen-reader only and stays the accessible name (editable cells).
- [x] 2. Static sort: empty values (`null`, `undefined`, `''`) last in both directions; numbers and dates by value.
- [x] 3. Search beyond columns: table `searchText(row)`, column `searchValue(row)` and `searchable: false`.
- [x] 4. `groupBy(row)` + `renderGroupHeader(group, rows)`: a full-width header row per group; static / paginated keep
  groups in first-seen order and sort within each; manual / server group the page.
- [x] 5. `Column.render(row, { index, id })`: the row's position in `rows` (server: in the page) and its id.
- [x] 6. `isRowSelectionLocked(row)`: ticked and disabled, outside the "n selected" count, `bulkActions` and select-all.
- [x] 7. Sort priority numbers only once the user builds a multi-column sort (a default one shows plain headings).
- [x] 8. Timeline: an entry with no or an invalid `at` is undated (last, no time, optional `undatedLabel` heading).
- [x] 9. Timeline item `status`: `done` | `current` (`aria-current="step"`) | `upcoming` (hollow dashed marker, muted).
- [x] 10. Timeline `order`: `newest` (default) | `oldest`.
- [x] 11. KanbanBoard `reorderWithinColumn` (default `true`).
- [x] 12. KanbanBoard: `onCardMove` returning or resolving `false` reverts the card, like a throw; documented.
- [x] 13. IoT `AlarmDetailView` "Related" aside draws through `DescriptionList`.
- [x] 14. The ten IoT views of b6c7216 pass `variant="plain"`; `PlaceDevicesDialog` uses `isRowSelectionLocked`.
- [x] 15. `state="loading"` says "Loading…" once (`Spinner` `label={null}` beside the visible message).
- [x] 16. `groupBy` in `layout="cards"`: a heading and its own list per group.
- [x] 17. (with 3) a column can opt out of search; `searchText` needs no hidden helper column.
- [x] 18. Filter fields: `required` select / radio (no "Any", no chip, not counted, kept by Clear all, Reset returns to
  its default) and `placement: 'toolbar'` (radio as a segmented group, select with a hidden label, applied at once).
- Mirrors: kui-ejs 986f3d6 (1–10, 15–18; Kanban and IoT have no kui-ejs counterpart); KUInative see its phase 11 file.

## Done when

- [x] 11.1–11.9 in kui-react with tests and showcase sections; `npm run registry:snapshot` run. 280c17d
- [ ] 11.1–11.9 mirrored in kui-ejs (031e3a5, branch) and KUInative (in progress); parity exceptions recorded 1d93042.
- [x] 11.10–11.12 in all three (kui-react 06a2314; kui-ejs afe06ff, KUInative 5d35d2f); 11.13 in KUInative (SectionCard / DetailHeader / FilterBar a10043b, KanbanBoard 9bff596, ImageGallery + ContextMenu aad00f7, LogViewer 9d84396, chat as ChatThread 26f706e).
- [ ] 11.14 as NB needs them (KanbanBoard ea65f6a, Timeline load more; ImageGallery: the media library uses DataTable `layout="cards"`, no change needed).
- [ ] `KeyedTable` deprecated, IoT views on `DataTable`.
- [x] 11.15 `ChatThread` in kui-react (8a20a5b), kui-ejs (02667c8, ChatBox draws with it) and KUInative (26f706e).
