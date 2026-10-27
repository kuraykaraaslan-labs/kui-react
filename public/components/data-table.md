# DataTable

- **id:** `data-table`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Table/DataTable.tsx`
- **status:** stable
- **since:** 2025-03

Unified table with `mode="static" | "paginated" | "server" | "manual"` (manual: the host owns the rows and fetches from `onQueryChange`; server: `reloadKey`, debounced search, aborted stale requests, rows kept under a spinner while the next page loads, Retry). Live rows (`rowState` new / leaving, keyboard rows, `isRowSelectable`), columns with `hideBelow`, `sortKey`, `footer` and `width`, `multiSort`, active-filter chips with Clear all, date-range presets, `numberrange` fields and per-field `defaultValue`, a card shell (`variant="card"`, `title`, `headerActions`, `toolbarStart` / `toolbarEnd`, `density`, `bulkActions`), a card layout (`layout="cards"` + `renderCard`, with a Sort by select) and every string in `messages`. Multi-column sort (Shift+click), global search, per-column filter (text + select), pagination, unified loading/empty/error state, a filter panel (`filterFields`: select, multiselect, checkboxes, radio, checkbox, text, number, date, daterange, range, custom — sent to the server as `filterValues`), row selection keyed by row id (`selectable`, `rowId`, `selectedRowIds`, `onSelectionChange`), expandable detail rows (`renderExpanded`), `stickyHeader`, and `rowActions` (a per-row actions menu with id, href, hidden, disabledReason, destructive, group and order). Phase 11.16: `groupBy` + `renderGroupHeader` (a header row, or a heading before each group of cards), `isRowSelectionLocked` (ticked, disabled, not counted), `searchText` and per-column `searchValue` / `searchable: false`, `render(row, { index, id })`, empty cells sorted last, priority numbers only for a user-built multi-sort, and `required` / `placement: 'toolbar'` select and radio filter fields. An opt-in column chooser (`columnChooser`, with `Column.hideable` / `defaultHidden`) saves the viewer's choice on the device under `tableId`.

## Design tokens consumed

- `--border`
- `--secondary`
- `--surface-base`
- `--text-secondary`

## Variants

### Full example

```tsx
<DataTable
  caption="Users"
  searchPlaceholder="Search users…"
  pageSize={5}
  rows={users}
  columns={[
    { key: 'name',   header: 'Name' },
    { key: 'email',  header: 'Email' },
    { key: 'role',   header: 'Role' },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={...}>{r.status}</Badge> },
    { key: 'joined', header: 'Joined' },
  ]}
/>
```

### Sortable columns

```tsx
<DataTable
  rows={products}
  columns={[
    { key: 'name',  header: 'Product',  sortable: true },
    { key: 'price', header: 'Price',    sortable: true, align: 'right' },
  ]}
/>
```

### Server mode (mode="server")

```tsx
// Unified server-side data flow — the component owns sort/filter/pagination state
// and calls `fetchPage` whenever it changes.
<DataTable<User>
  mode="server"
  fetchPage={async ({ page, pageSize, sort, search, filters }) => {
    const res = await fetch(buildUrl({ page, pageSize, sort, search, filters }));
    const { rows, total } = await res.json();
    return { rows, total };
  }}
  pageSize={5}
  searchPlaceholder="Search users…"
  columns={[
    { key: 'name',  header: 'Name',  sortable: true },
    { key: 'email', header: 'Email', sortable: true, filter: { kind: 'text' } },
    { key: 'team',  header: 'Team',  sortable: true, filter: { kind: 'select', options: [
      { label: 'Platform', value: 'platform' },
      { label: 'Growth',   value: 'growth' },
    ] } },
  ]}
/>
```

### Row actions (rowActions)

```tsx
// A trailing column with one menu per row. Every per-row field takes a function of the row.
<DataTable<Company>
  rows={companies}
  columns={columns}
  rowActionsLabel={(row) => `Actions for ${row.name}`}
  rowActions={[
    { id: 'open', label: 'Open', href: (row) => `/companies/${row.id}` },
    { id: 'call', label: 'Call', group: 'contact', order: 10, onClick: (row) => call(row) },
    { id: 'sign', label: 'Send for signature', group: 'contact', order: 20,
      disabled: (row) => !row.email, disabledReason: (row) => (row.email ? undefined : 'Add an email address first') },
    { id: 'restore', label: 'Restore', hidden: (row) => row.status !== 'Archived' },
    { id: 'delete', label: 'Delete', group: 'danger', order: 1000, destructive: true, onClick: remove },
  ]}
/>
```

### Selection + expandable rows

```tsx
// Selection is keyed by row id (rowId, else row.id), so it survives sorting, search and paging.
// The header checkbox selects the rows shown; rows on other pages keep their state.
const [selected, setSelected] = useState<DataTableRowId[]>([]);

<DataTable<Member>
  rows={members}
  columns={columns}
  selectable
  selectedRowIds={selected}
  onSelectionChange={setSelected}
  // Rows that return null get no expand toggle.
  renderExpanded={(r) => (r.lastActive ? `Last active ${r.lastActive}` : null)}
/>
```

### Filter panel (filterFields)

```tsx
// A "Filters" button next to the search opens a panel of any mix of controls.
// Server mode sends the set fields to fetchPage as `filterValues` (JSON-safe:
// dates are YYYY-MM-DD, a date range is { from, to }, a range is [min, max]).
// Static / paginated modes match rows by row[field.id], or by the field's `match`.
<DataTable<Modem>
  mode="server"
  fetchPage={(args) => api.modems({ ...args.filterValues, page: args.page })}
  filterFields={[
    { id: 'profile',    label: 'Profile',    type: 'select',      options: profiles },
    { id: 'connection', label: 'Connection', type: 'multiselect', options: connections },
    { id: 'status',     label: 'Status',     type: 'checkboxes',  options: statuses },
    { id: 'gateway',    label: 'Gateway',    type: 'radio',       options: gateways },
    { id: 'signal',     label: 'Signal (%)', type: 'range', min: 0, max: 100 },
    { id: 'seen',       label: 'Last seen',  type: 'daterange' },
    { id: 'name',       label: 'Name contains', type: 'text' },
    { id: 'roaming',    label: 'Roaming only',  type: 'checkbox' },
    { id: 'site', label: 'Site', type: 'custom',
      render: ({ id, value, onChange }) => <SitePicker id={id} value={value} onChange={onChange} /> },
  ]}
  // Optional: filterValues / onFilterValuesChange (controlled), filtersLive, defaultFiltersOpen
  columns={columns}
/>
```

### Manual mode (mode="manual")

```tsx
// The host owns the rows and fetches from every reported query (also the first, on mount).
<DataTable<Invoice>
  mode="manual"
  rows={page.rows}
  total={page.total}
  loading={loading}
  error={error}
  onRetry={reload}
  multiSort={false}
  onQueryChange={(q) => load(q)} // { page, pageSize, sort, search, filters, filterValues }
  columns={[{ key: 'amount', header: 'Amount', sortable: true, sortKey: 'total_amount' }]}
/>
```

### Live rows (rowState, keyboard rows, isRowSelectable)

```tsx
<DataTable<Pump>
  mode="manual"
  rows={pumps}
  rowId={(r) => r.id}
  keyboardNavigation
  rowState={(r) => (r.isNew ? 'new' : r.removing ? 'leaving' : undefined)}
  selectable
  isRowSelectable={(r) => (r.state === 'Stopped' ? 'A stopped pump cannot be selected' : true)}
  rowSelectLabel={(r) => `Select ${r.name}`}
  columns={[{ key: 'name', header: 'Name' }, { key: 'state', header: 'State', hideBelow: 'sm' }]}
/>
```

### Filter chips, date presets, number range

```tsx
<DataTable<Invoice>
  rows={invoices}
  filterFields={[
    { id: 'status', label: 'Status', type: 'multiselect', options, defaultValue: ['Open', 'Overdue'] },
    { id: 'amount', label: 'Amount', type: 'numberrange', min: 0 },
    { id: 'issued', label: 'Issued', type: 'daterange', presets: true },
  ]}
  // Applied filters show as removable chips under the toolbar, with "Clear all".
  columns={columns}
/>
```

### Card shell, footer, responsive columns

```tsx
<DataTable<Invoice>
  mode="static"
  variant="card"
  density="compact"
  title="Latest invoices"
  subtitle="6 invoices"
  headerActions={<Button>New invoice</Button>}
  toolbarEnd={<Button variant="outline">Export</Button>}
  rows={rows}
  columns={[
    { key: 'id', header: 'Invoice', footer: 'Total' },
    { key: 'customer', header: 'Customer', hideBelow: 'sm' },
    { key: 'amount', header: 'Amount', align: 'right', footer: total },
  ]}
/>
```

### Card layout (layout="cards")

```tsx
<DataTable<Invoice>
  layout="cards"
  cardMinWidth="12rem"
  rows={invoices}
  columns={columns} // the sortable columns feed the "Sort by" select
  filterFields={[{ id: 'status', label: 'Status', type: 'multiselect', options }]}
  renderCard={(r, { actions, selected, toggleSelected }) => <InvoiceCard invoice={r} menu={actions} />}
/>
```

### Groups, locked selection, search beyond columns (groupBy, isRowSelectionLocked, searchText)

```tsx
<DataTable<Permission>
  mode="static"
  rows={permissions}
  groupBy={(p) => p.group}                       // a header row per group, sorted within it
  renderGroupHeader={(g, rows) => `${g} · ${rows.length}`}
  searchText={(p) => `${p.id} ${p.module} ${p.note}`} // matched without a hidden column
  selectable
  isRowSelectionLocked={(p) => granted.has(p.id)} // ticked, disabled, not counted
  columns={[
    { key: 'name', header: 'Permission', sortable: true },
    { key: 'limit', header: 'Daily limit', searchable: false,
      render: (p, { index }) => <Input id={`limit-${p.id}`} label="Daily limit" hideLabel value={limits[index]} … /> },
  ]}
/>
// Empty cells sort last in both directions; a default multi-column sort shows no priority numbers.
```

### Required choice in the toolbar (required, placement)

```tsx
filterFields={[
  // no "Any", no chip, not counted on Filters, applied at once, kept by Clear all and Reset
  { id: 'status', label: 'Status', type: 'radio', required: true, placement: 'toolbar', defaultValue: 'Open', options },
  { id: 'amount', label: 'Amount', type: 'numberrange' },
]}
```

### Column chooser (columnChooser, tableId)

```tsx
// Opt-in: a "Columns" button in the toolbar. The viewer's choice is saved on this device
// (localStorage) under tableId and comes back on the next visit; Reset returns to the defaults.
<DataTable<Member>
  rows={members}
  columnChooser
  tableId="team.members"
  columns={[
    { key: 'name', header: 'Name', hideable: false },          // always shown, not in the chooser
    { key: 'role', header: 'Role' },
    { key: 'lastActive', header: 'Last active', defaultHidden: true }, // hidden until shown
  ]}
/>
```

### Sticky header (stickyHeader)

```tsx
<DataTable mode="static" searchable={false} stickyHeader columns={columns} rows={rows} />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useMemo, useState } from 'react';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';

export function DataTable({ columns, rows, caption, searchable = true, searchPlaceholder = 'Search…', pageSize: defaultPageSize = 10, pageSizeOptions = [5,10,25,50], emptyMessage = 'No results found.', className }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => columns.some((col) => !col.render && String(row[col.key] ?? '').toLowerCase().includes(q)));
  }, [rows, search, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={searchPlaceholder} className="flex-1 min-w-40" />
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-border bg-surface-base px-2 py-1.5 text-sm">
            {pageSizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      {/* table body ... */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-text-secondary">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length}</p>
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </div>
    </div>
  );
}
```
