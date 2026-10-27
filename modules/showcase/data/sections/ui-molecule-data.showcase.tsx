'use client';

import { Badge } from '@/modules/ui/Badge';
import { Textarea } from '@/modules/ui/Textarea';
import { Table } from '@/modules/ui/Table';
import { DataTable } from '@/modules/ui/DataTable';
import { ContentScoreBar, type ScoreRule } from '@/modules/ui/ContentScoreBar';
import { AdvancedDataTable } from '@/modules/ui/AdvancedDataTable';
import { BulkActionTable } from '@/modules/ui/BulkActionTable';
import { Timeline } from '@/modules/ui/Timeline';
import { Input } from '@/modules/ui/Input';
import { KeyedTable } from '@/modules/ui/KeyedTable';
import { TypedConfirmDialog } from '@/modules/ui/TypedConfirmDialog';
import { useCallback, useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';
import type {
  DataTableFilterField,
  DataTableFilterValues,
  DataTableQuery,
  DataTableRowAction,
  DataTableRowId,
} from '@/modules/ui/Table/types';

type Company = { id: string; name: string; email: string; status: string; [key: string]: unknown };

const COMPANIES: Company[] = [
  { id: 'c1', name: 'Northwind Traders', email: 'buy@northwind.example', status: 'Active' },
  { id: 'c2', name: 'Contoso Ltd',       email: '',                       status: 'Active' },
  { id: 'c3', name: 'Fabrikam',          email: 'info@fabrikam.example',  status: 'Archived' },
];

/** KeyedTable demo: live rows (a new one highlighted, one fading out), keyboard row focus and selection. */
type Pump = { id: string; name: string; state: string; [key: string]: unknown };
const PUMPS: Pump[] = [
  { id: 'p1', name: 'Pump 1', state: 'Running' },
  { id: 'p2', name: 'Pump 2', state: 'Stopped' },
  { id: 'p3', name: 'Pump 3', state: 'Running' },
];
function KeyedTableDemo({ selectable = false }: { selectable?: boolean }) {
  const [rows, setRows] = useState<Pump[]>(PUMPS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState('Click a row, or focus one and press Enter');
  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <KeyedTable
        caption="Pumps"
        rows={rows}
        getRowKey={(r) => r.id}
        columns={[{ key: 'name', header: 'Name' }, { key: 'state', header: 'State', hideBelow: 'sm' }]}
        rowState={(r) => (r.id === 'p4' ? 'new' : r.state === 'Removed' ? 'leaving' : undefined)}
        onRowClick={(r) => setOpened(`Opened ${r.name}`)}
        selection={selectable ? { selected, onChange: setSelected, isSelectable: (r) => (r.state === 'Stopped' ? 'A stopped pump cannot be selected' : true) } : undefined}
      />
      <div className="flex gap-2 text-xs text-text-secondary">
        <button type="button" className="underline" onClick={() => setRows((r) => [{ id: 'p4', name: 'Pump 4', state: 'Running' }, ...r.filter((x) => x.id !== 'p4')])}>Add a live row</button>
        <button type="button" className="underline" onClick={() => setRows((r) => r.map((x) => (x.id === 'p1' ? { ...x, state: 'Removed' } : x)))}>Fade Pump 1</button>
        <span aria-live="polite">{selectable ? `${selected.size} selected` : opened}</span>
      </div>
    </div>
  );
}


/** TypedConfirmDialog demo: opens on a button; confirm unlocks when the phrase is typed. */
function TypedConfirmDemo({ phrase }: { phrase: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>Open</button>
      <span className="text-xs text-text-secondary" aria-live="polite">{done}</span>
      <TypedConfirmDialog
        open={open}
        title={`Confirm with ${phrase}`}
        description="This cannot be undone."
        phrase={phrase}
        label={`Type ${phrase} to confirm`}
        confirmLabel="Confirm"
        onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); setDone('Confirmed'); }}
      />
    </div>
  );
}

/** Sets an entry's registry snippet without a `sourceCode:` literal (the observability section's pattern). */
function withUsage(entry: Omit<ShowcaseComponent, 'sourceCode'>, usage: string): ShowcaseComponent {
  const out = { ...entry } as ShowcaseComponent;
  out.sourceCode = usage;
  return out;
}

/** Phase 11 demos: manual mode, live rows, filter chips / presets / number range, card shell, card layout. */
type Invoice = { id: string; customer: string; amount: number; status: string; issued: string; [key: string]: unknown };
const INVOICES: Invoice[] = Array.from({ length: 23 }, (_, i) => ({
  id: `INV-${1001 + i}`,
  customer: ['Northwind', 'Contoso', 'Fabrikam', 'Adatum', 'Tailspin'][i % 5],
  amount: 120 + ((i * 377) % 2400),
  status: ['Paid', 'Open', 'Overdue'][i % 3],
  issued: `2026-10-${String(1 + (i % 25)).padStart(2, '0')}`,
}));
const INVOICE_STATUS = [
  { label: 'Paid', value: 'Paid' },
  { label: 'Open', value: 'Open' },
  { label: 'Overdue', value: 'Overdue' },
];
const INVOICE_FIELDS: DataTableFilterField<Invoice>[] = [
  { id: 'status', label: 'Status', type: 'multiselect', options: INVOICE_STATUS },
  { id: 'amount', label: 'Amount', type: 'numberrange', min: 0 },
  { id: 'issued', label: 'Issued', type: 'daterange', presets: true },
];
const INVOICE_COLUMNS = [
  { key: 'id', header: 'Invoice', sortable: true },
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'status', header: 'Status', hideBelow: 'sm' as const, render: (r: Invoice) => <Badge variant={r.status === 'Paid' ? 'success' : r.status === 'Overdue' ? 'error' : 'warning'}>{r.status}</Badge> },
  { key: 'amount', header: 'Amount', sortable: true, align: 'right' as const, render: (r: Invoice) => r.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) },
];

/** The host owns the rows: it fetches (here: slices an array) from every reported query. */
function ManualModeDemo() {
  const [page, setPage] = useState<{ rows: Invoice[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [last, setLast] = useState<DataTableQuery | null>(null);
  const load = useCallback((q: DataTableQuery) => {
    setLast(q);
    setLoading(true);
    setTimeout(() => {
      let rows = INVOICES.filter((r) => !q.search || r.customer.toLowerCase().includes(q.search.toLowerCase()));
      const status = q.filterValues.status as string[] | undefined;
      if (status?.length) rows = rows.filter((r) => status.includes(r.status));
      const s = q.sort[0];
      if (s) rows = [...rows].sort((a, b) => String(a[s.key]).localeCompare(String(b[s.key]), undefined, { numeric: true }) * (s.dir === 'asc' ? 1 : -1));
      setPage({ rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length });
      setLoading(false);
    }, 400);
  }, []);
  return (
    <div className="w-full space-y-2">
      <DataTable<Invoice>
        mode="manual"
        caption="Invoices"
        rows={page.rows}
        total={page.total}
        loading={loading}
        pageSize={5}
        multiSort={false}
        filterFields={[INVOICE_FIELDS[0]]}
        onQueryChange={load}
        columns={INVOICE_COLUMNS}
      />
      <p className="text-xs text-text-secondary font-mono break-all">{last ? JSON.stringify(last) : '…'}</p>
    </div>
  );
}

/** Live rows: a new row highlighted, a leaving row fading, keyboard row focus, a refused selection. */
function LiveRowsDemo() {
  const [rows, setRows] = useState<Pump[]>(PUMPS);
  const [opened, setOpened] = useState('Focus a row and press Enter');
  return (
    <div className="w-full space-y-2">
      <DataTable<Pump>
        mode="manual"
        caption="Pumps"
        searchable={false}
        rows={rows}
        keyboardNavigation
        selectable
        isRowSelectable={(r) => (r.state === 'Stopped' ? 'A stopped pump cannot be selected' : true)}
        rowSelectLabel={(r) => `Select ${r.name}`}
        rowState={(r) => (r.id === 'p4' ? 'new' : r.state === 'Removed' ? 'leaving' : undefined)}
        onRowClick={(r) => setOpened(`Opened ${r.name}`)}
        columns={[{ key: 'name', header: 'Name' }, { key: 'state', header: 'State', hideBelow: 'sm' }]}
      />
      <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
        <button type="button" className="underline" onClick={() => setRows((r) => [{ id: 'p4', name: 'Pump 4', state: 'Running' }, ...r.filter((x) => x.id !== 'p4')])}>Add a live row</button>
        <button type="button" className="underline" onClick={() => setRows((r) => r.map((x) => (x.id === 'p1' ? { ...x, state: 'Removed' } : x)))}>Fade Pump 1</button>
        <span aria-live="polite">{opened}</span>
      </div>
    </div>
  );
}

/** Phase 11.16: group rows, a ticked-and-locked selection, search beyond the columns, an editable cell by index. */
type Permission = { id: string; name: string; group: string; module: string; note: string; [key: string]: unknown };
const PERMISSIONS: Permission[] = [
  { id: 'billing.read', name: 'Read invoices', group: 'Billing', module: 'invoice', note: 'list and open' },
  { id: 'users.invite', name: 'Invite users', group: 'Users', module: 'tenant_member', note: 'send an email invite' },
  { id: 'billing.refund', name: 'Refund', group: 'Billing', module: 'payment', note: 'money back to the card' },
  { id: 'users.remove', name: 'Remove users', group: 'Users', module: 'tenant_member', note: '' },
];
function GroupedLockedDemo() {
  const [limits, setLimits] = useState(['10', '5', '', '2']);
  const [selected, setSelected] = useState<DataTableRowId[]>([]);
  return (
    <div className="w-full">
      <DataTable<Permission>
        mode="static"
        caption="Permissions"
        rows={PERMISSIONS}
        rowId={(p) => p.id}
        groupBy={(p) => p.group}
        renderGroupHeader={(g, rows) => `${g} · ${rows.length}`}
        searchText={(p) => `${p.id} ${p.module} ${p.note}`}
        searchPlaceholder="Name, key, module or note…"
        selectable
        selectedRowIds={selected}
        onSelectionChange={setSelected}
        isRowSelectionLocked={(p) => p.id === 'billing.read'}
        rowSelectLabel={(p) => p.name}
        columns={[
          { key: 'name', header: 'Permission', sortable: true },
          { key: 'module', header: 'Module', sortable: true, hideBelow: 'sm' },
          {
            key: 'limit',
            header: 'Daily limit',
            searchable: false,
            render: (p, { index }) => (
              <Input id={`limit-${p.id}`} label={`Daily limit of ${p.name}`} hideLabel type="number"
                value={limits[index]} onChange={(e) => setLimits((l) => l.map((v, i) => (i === index ? e.target.value : v)))} />
            ),
          },
        ]}
      />
    </div>
  );
}

/** A required status choice in the toolbar (a server needs one status, never "any"). */
function RequiredToolbarFilterDemo() {
  return (
    <div className="w-full">
      <DataTable<Invoice>
        mode="static"
        caption="Invoices"
        rows={INVOICES}
        columns={INVOICE_COLUMNS}
        filterFields={[
          { id: 'status', label: 'Status', type: 'radio', required: true, placement: 'toolbar', defaultValue: 'Open',
            options: [{ value: 'Open', label: 'Open' }, { value: 'Paid', label: 'Paid' }, { value: 'Overdue', label: 'Overdue' }] },
          INVOICE_FIELDS[1],
        ]}
      />
    </div>
  );
}

/** The opt-in column chooser: the choice is saved in this browser under the table's `tableId`. */
function ColumnChooserDemo() {
  return (
    <div className="w-full">
      <DataTable<Member>
        mode="static"
        caption="Team members"
        rows={MEMBERS}
        columnChooser
        tableId="showcase.members"
        columns={[
          { key: 'name', header: 'Name', sortable: true, hideable: false },
          { key: 'role', header: 'Role', sortable: true },
          { key: 'status', header: 'Status' },
          { key: 'joined', header: 'Joined' },
          { key: 'lastActive', header: 'Last active', defaultHidden: true },
        ]}
      />
    </div>
  );
}

/** Filter chips, date-range presets, a number range and a field that starts set. */
function FilterChipsDemo() {
  return (
    <div className="w-full">
      <DataTable<Invoice>
        mode="paginated"
        caption="Invoices"
        pageSize={5}
        rows={INVOICES}
        filterFields={[{ ...INVOICE_FIELDS[0], defaultValue: ['Open', 'Overdue'] }, INVOICE_FIELDS[1], INVOICE_FIELDS[2]]}
        columns={INVOICE_COLUMNS}
      />
    </div>
  );
}

/** Card shell: title, subtitle, header actions, toolbar slots, compact rows, a totals footer. */
function CardShellDemo() {
  const rows = INVOICES.slice(0, 6);
  const sum = rows.reduce((n, r) => n + r.amount, 0);
  return (
    <div className="w-full">
      <DataTable<Invoice>
        mode="static"
        variant="card"
        density="compact"
        title="Latest invoices"
        subtitle={`${rows.length} invoices`}
        headerActions={<button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm">New invoice</button>}
        toolbarEnd={<button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm">Export</button>}
        rows={rows}
        columns={[
          { key: 'id', header: 'Invoice', sortable: true, footer: 'Total' },
          { key: 'customer', header: 'Customer', sortable: true, hideBelow: 'sm' },
          { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (r) => r.amount.toLocaleString('en-US'), footer: sum.toLocaleString('en-US') },
        ]}
      />
    </div>
  );
}

/** Card layout: the same toolbar, filters, sort and paging over a grid of cards. */
function CardLayoutDemo() {
  return (
    <div className="w-full">
      <DataTable<Invoice>
        mode="paginated"
        layout="cards"
        caption="Invoices"
        pageSize={6}
        cardMinWidth="12rem"
        rows={INVOICES}
        filterFields={[INVOICE_FIELDS[0]]}
        columns={INVOICE_COLUMNS}
        renderCard={(r) => (
          <article className="h-full rounded-lg border border-border bg-surface-raised p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-text-secondary">{r.id}</span>
              <Badge variant={r.status === 'Paid' ? 'success' : r.status === 'Overdue' ? 'error' : 'warning'}>{r.status}</Badge>
            </div>
            <p className="text-sm font-medium text-text-primary">{r.customer}</p>
            <p className="text-sm tabular-nums text-text-secondary">{r.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          </article>
        )}
      />
    </div>
  );
}

function RowActionsDemo() {
  const [log, setLog] = useState('Nothing run yet');
  const actions: DataTableRowAction<Company>[] = [
    { id: 'open', label: 'Open', href: (row) => `#company-${row.id}` },
    { id: 'call', label: 'Call', group: 'contact', order: 10, onClick: (row) => setLog(`Call ${row.name}`) },
    {
      id: 'sign',
      label: 'Send for signature',
      group: 'contact',
      order: 20,
      disabled: (row) => !row.email,
      disabledReason: (row) => (row.email ? undefined : 'Add an email address first'),
      onClick: (row) => setLog(`Send ${row.name} for signature`),
    },
    { id: 'restore', label: 'Restore', hidden: (row) => row.status !== 'Archived', onClick: (row) => setLog(`Restore ${row.name}`) },
    { id: 'delete', label: 'Delete', group: 'danger', order: 1000, destructive: true, onClick: (row) => setLog(`Delete ${row.name}`) },
  ];
  return (
    <div className="w-full space-y-2">
      <DataTable<Company>
        caption="Companies"
        mode="static"
        searchable={false}
        rows={COMPANIES}
        rowActions={actions}
        rowActionsLabel={(row) => `Actions for ${row.name}`}
        columns={[
          { key: 'name', header: 'Company' },
          { key: 'email', header: 'Email', render: (r) => r.email || '—' },
          { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'Active' ? 'success' : 'neutral'}>{r.status}</Badge> },
        ]}
      />
      <p className="text-xs text-text-secondary">{log}</p>
    </div>
  );
}
import type {
  DataTableFetchArgs,
  DataTableFetchResult,
} from '@/modules/ui/Table';
import { matchFilterField } from '@/modules/ui/Table/index';

type ServerUser = { id: string; name: string; email: string; team: string; joined: string; [key: string]: unknown };

const SERVER_USERS: ServerUser[] = Array.from({ length: 32 }, (_, i) => ({
  id:     `u-${i + 1}`,
  name:   ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank'][i % 8] + ` #${i + 1}`,
  email:  `user${i + 1}@example.com`,
  team:   ['Platform', 'Growth', 'Ops', 'Design'][i % 4],
  joined: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
}));

function ServerModeDemo() {
  const fetchPage = useCallback(
    (args: DataTableFetchArgs): Promise<DataTableFetchResult<ServerUser>> => {
      return new Promise((resolve) => {
        // Simulate latency.
        setTimeout(() => {
          let filtered = SERVER_USERS;
          const q = args.search.trim().toLowerCase();
          if (q) {
            filtered = filtered.filter((u) =>
              [u.name, u.email, u.team, u.joined]
                .some((v) => v.toLowerCase().includes(q)),
            );
          }
          if (args.sort.length) {
            const sorted = [...filtered].sort((a, b) => {
              for (const s of args.sort) {
                const av = String(a[s.key as keyof ServerUser] ?? '');
                const bv = String(b[s.key as keyof ServerUser] ?? '');
                const cmp = av.localeCompare(bv, undefined, { numeric: true });
                if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
              }
              return 0;
            });
            filtered = sorted;
          }
          const total = filtered.length;
          const start = (args.page - 1) * args.pageSize;
          resolve({
            rows: filtered.slice(start, start + args.pageSize),
            total,
          });
        }, 200);
      });
    },
    [],
  );

  return (
    <div className="w-full">
      <DataTable<ServerUser>
        mode="server"
        fetchPage={fetchPage}
        caption="Server-paged users"
        pageSize={5}
        searchPlaceholder="Search users…"
        columns={[
          { key: 'name',   header: 'Name',   sortable: true },
          { key: 'email',  header: 'Email',  sortable: true, filter: { kind: 'text', placeholder: 'Contains…' } },
          { key: 'team',   header: 'Team',   sortable: true, filter: { kind: 'select', options: [
            { label: 'Platform', value: 'platform' },
            { label: 'Growth',   value: 'growth' },
            { label: 'Ops',      value: 'ops' },
            { label: 'Design',   value: 'design' },
          ] } },
          { key: 'joined', header: 'Joined', sortable: true },
        ]}
      />
    </div>
  );
}

type Modem = {
  id: string; name: string; profile: string; connection: string; status: string;
  gateway: string; signal: number; roaming: boolean; seen: string; [key: string]: unknown;
};

const MODEMS: Modem[] = Array.from({ length: 24 }, (_, i) => ({
  id:         `m-${i + 1}`,
  name:       `Modem ${String(i + 1).padStart(2, '0')}`,
  profile:    ['Home', 'Office', 'Industrial'][i % 3],
  connection: ['LTE', '5G', 'Ethernet', 'Wi-Fi'][i % 4],
  status:     ['Online', 'Offline', 'Degraded'][i % 3 === 2 ? 2 : i % 5 === 0 ? 1 : 0],
  gateway:    `gw-${(i % 3) + 1}`,
  signal:     (i * 37) % 100,
  roaming:    i % 6 === 0,
  seen:       `2026-10-${String((i % 24) + 1).padStart(2, '0')}`,
}));

const MODEM_FILTERS: DataTableFilterField<Modem>[] = [
  { id: 'profile',    label: 'Profile',    type: 'select', options: ['Home', 'Office', 'Industrial'].map((v) => ({ label: v, value: v })) },
  { id: 'connection', label: 'Connection', type: 'multiselect', options: ['LTE', '5G', 'Ethernet', 'Wi-Fi'].map((v) => ({ label: v, value: v })) },
  { id: 'status',     label: 'Status',     type: 'checkboxes', options: ['Online', 'Offline', 'Degraded'].map((v) => ({ label: v, value: v })) },
  { id: 'gateway',    label: 'Gateway',    type: 'radio', options: [1, 2, 3].map((n) => ({ label: `GW ${n}`, value: `gw-${n}` })) },
  { id: 'signal',     label: 'Signal (%)', type: 'range', min: 0, max: 100, step: 5 },
  { id: 'seen',       label: 'Last seen',  type: 'daterange', locale: 'en' },
  { id: 'name',       label: 'Name contains', type: 'text', placeholder: 'e.g. 07' },
  { id: 'roaming',    label: 'Roaming only',  type: 'checkbox' },
];

function FilterPanelDemo() {
  const [sent, setSent] = useState<DataTableFilterValues>({});
  const fetchPage = useCallback(
    (args: DataTableFetchArgs): Promise<DataTableFetchResult<Modem>> => {
      setSent(args.filterValues);
      // A real backend gets `args.filterValues` as-is; the demo filters locally.
      const rows = MODEMS.filter((m) => MODEM_FILTERS.every((f) =>
        !(f.id in args.filterValues) || matchFilterField(f, m, args.filterValues[f.id])));
      const start = (args.page - 1) * args.pageSize;
      return new Promise((resolve) =>
        setTimeout(() => resolve({ rows: rows.slice(start, start + args.pageSize), total: rows.length }), 200));
    },
    [],
  );
  return (
    <div className="w-full space-y-2">
      <DataTable<Modem>
        mode="server"
        fetchPage={fetchPage}
        caption="Modems"
        pageSize={5}
        searchPlaceholder="Search modems…"
        filterFields={MODEM_FILTERS}
        defaultFiltersOpen
        columns={[
          { key: 'name',       header: 'Name' },
          { key: 'profile',    header: 'Profile' },
          { key: 'connection', header: 'Connection' },
          { key: 'status',     header: 'Status', render: (r) => <Badge variant={r.status === 'Online' ? 'success' : r.status === 'Degraded' ? 'warning' : 'neutral'}>{r.status}</Badge> },
          { key: 'gateway',    header: 'Gateway' },
          { key: 'signal',     header: 'Signal', align: 'right' },
        ]}
      />
      <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs text-text-secondary">
        filterValues sent to fetchPage: {JSON.stringify(sent)}
      </pre>
    </div>
  );
}

type Member = { id: string; name: string; role: string; status: string; joined: string; lastActive?: string; [key: string]: unknown };

const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice', role: 'Admin',  status: 'Active',   joined: '2023-01-15', lastActive: '2 days ago' },
  { id: 'm2', name: 'Bob',   role: 'Editor', status: 'Inactive', joined: '2022-06-10', lastActive: '30 days ago' },
  { id: 'm3', name: 'Carol', role: 'Viewer', status: 'Active',   joined: '2023-09-02' },
  { id: 'm4', name: 'Dave',  role: 'Editor', status: 'Active',   joined: '2024-03-01', lastActive: 'today' },
  { id: 'm5', name: 'Eve',   role: 'Viewer', status: 'Active',   joined: '2024-05-18', lastActive: 'yesterday' },
  { id: 'm6', name: 'Frank', role: 'Admin',  status: 'Pending',  joined: '2024-06-22' },
];

function SelectionDemo() {
  const [selected, setSelected] = useState<DataTableRowId[]>(['m2']);
  return (
    <div className="w-full space-y-2">
      <DataTable<Member>
        caption="Team members"
        pageSize={5}
        rows={MEMBERS}
        selectable
        selectedRowIds={selected}
        onSelectionChange={setSelected}
        renderExpanded={(r) => (r.lastActive ? `Joined ${r.joined} · Last active ${r.lastActive}` : null)}
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'role', header: 'Role', sortable: true },
          { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'Active' ? 'success' : r.status === 'Pending' ? 'warning' : 'neutral'}>{r.status}</Badge> },
        ]}
      />
      <p className="text-xs text-text-secondary">Selected ids: {selected.length ? selected.join(', ') : 'none'}</p>
    </div>
  );
}

function AdvancedTableDemo() {
  const rows = [
    { name: 'Alice', role: 'Admin', status: 'Active', _expanded: <p className="text-sm">Joined 2023-01-15 · Last active 2 days ago</p> },
    { name: 'Bob', role: 'Editor', status: 'Inactive', _expanded: <p className="text-sm">Joined 2022-06-10 · Last active 30 days ago</p> },
    { name: 'Carol', role: 'Viewer', status: 'Active' },
    { name: 'Dave', role: 'Editor', status: 'Active', _expanded: <p className="text-sm">Joined 2024-03-01 · Last active today</p> },
  ];
  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'role', header: 'Role' },
    { key: 'status', header: 'Status' },
  ] as const;
  return (
    <div className="w-full">
      <AdvancedDataTable
        columns={cols as never}
        rows={rows as never}
        selectable
        caption="Team members"
      />
    </div>
  );
}

export function buildDataData(): ShowcaseComponent[] {
  return [
    {
      id: 'table',
      title: 'Table',
      category: 'Organism',
      abbr: 'Tb',
      description: 'Responsive table. scope="col" headers, hover row highlight, empty-state message, and custom cell render support.',
      filePath: 'modules/ui/Table/Table.tsx',
      sourceCode: `import { cn } from '@/libs/utils/cn';

export function Table({ columns, rows, caption, emptyMessage = 'No results found.', className }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-sunken border-b border-border">
          <tr>{columns.map((col) => <th key={col.key} scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider text-left">{col.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-base">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-text-secondary">{emptyMessage}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-overlay transition-colors">
              {columns.map((col) => <td key={col.key} className="px-4 py-3 text-text-primary">{col.render ? col.render(row) : String(row[col.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`,
      variants: [
        {
          title: 'With data',
          layout: 'stack' as const,
          preview: (
            <Table
              caption="Users table"
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role' },
                { key: 'status', header: 'Status', render: (row) => <Badge variant={row.status === 'Active' ? 'success' : 'neutral'}>{String(row.status)}</Badge> },
              ]}
              rows={[
                { name: 'Jane Doe', email: 'jane@example.com', role: 'Admin', status: 'Active' },
                { name: 'John Smith', email: 'john@example.com', role: 'Member', status: 'Inactive' },
              ]}
            />
          ),
          code: `<Table\n  columns={[\n    { key: 'name', header: 'Name' },\n    { key: 'email', header: 'Email' },\n    { key: 'status', header: 'Status', render: (row) => <Badge variant={row.status === 'Active' ? 'success' : 'neutral'}>{row.status}</Badge> },\n  ]}\n  rows={[{ name: 'Jane Doe', email: 'jane@example.com', status: 'Active' }]}\n/>`,
        },
        {
          title: 'Empty state',
          preview: (
            <Table
              caption="Empty table"
              columns={[{ key: 'name', header: 'Name' }, { key: 'email', header: 'Email' }]}
              rows={[]}
              emptyMessage="No users found. Invite your team to get started."
            />
          ),
          code: `<Table columns={[...]} rows={[]} emptyMessage="No users found." />`,
        },
        {
          title: 'Sortable columns',
          layout: 'stack' as const,
          preview: (
            <Table
              caption="Sortable users table"
              columns={[
                { key: 'name',  header: 'Name',  sortable: true },
                { key: 'email', header: 'Email', sortable: true },
                { key: 'role',  header: 'Role',  sortable: true },
              ]}
              rows={[
                { name: 'Zara Kim',    email: 'zara@example.com',  role: 'Admin' },
                { name: 'Alice Brown', email: 'alice@example.com', role: 'Member' },
                { name: 'Bob Lee',     email: 'bob@example.com',   role: 'Viewer' },
              ]}
            />
          ),
          code: `<Table\n  columns={[\n    { key: 'name', header: 'Name', sortable: true },\n    { key: 'role', header: 'Role', sortable: true },\n  ]}\n  rows={rows}\n/>`,
        },
      ],
    },
    {
      id: 'data-table',
      title: 'DataTable',
      category: 'Organism',
      abbr: 'Dt',
      description: 'Unified table with `mode="static" | "paginated" | "server" | "manual"` (manual: the host owns the rows and fetches from `onQueryChange`; server: `reloadKey`, debounced search, aborted stale requests, rows kept under a spinner while the next page loads, Retry). Live rows (`rowState` new / leaving, keyboard rows, `isRowSelectable`), columns with `hideBelow`, `sortKey`, `footer` and `width`, `multiSort`, active-filter chips with Clear all, date-range presets, `numberrange` fields and per-field `defaultValue`, a card shell (`variant="card"`, `title`, `headerActions`, `toolbarStart` / `toolbarEnd`, `density`, `bulkActions`), a card layout (`layout="cards"` + `renderCard`, with a Sort by select) and every string in `messages`. Multi-column sort (Shift+click), global search, per-column filter (text + select), pagination, unified loading/empty/error state, a filter panel (`filterFields`: select, multiselect, checkboxes, radio, checkbox, text, number, date, daterange, range, custom — sent to the server as `filterValues`), row selection keyed by row id (`selectable`, `rowId`, `selectedRowIds`, `onSelectionChange`), expandable detail rows (`renderExpanded`), `stickyHeader`, and `rowActions` (a per-row actions menu with id, href, hidden, disabledReason, destructive, group and order). Phase 11.16: `groupBy` + `renderGroupHeader` (a header row, or a heading before each group of cards), `isRowSelectionLocked` (ticked, disabled, not counted), `searchText` and per-column `searchValue` / `searchable: false`, `render(row, { index, id })`, empty cells sorted last, priority numbers only for a user-built multi-sort, and `required` / `placement: \'toolbar\'` select and radio filter fields. An opt-in column chooser (`columnChooser`, with `Column.hideable` / `defaultHidden`) saves the viewer\'s choice on the device under `tableId`.',
      filePath: 'modules/ui/Table/DataTable.tsx',
      sourceCode: `'use client';
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
}`,
      variants: [
        {
          title: 'Full example',
          layout: 'stack' as const,
          preview: (() => {
            type User = { name: string; email: string; role: string; status: string; joined: string };
            const USERS: User[] = [
              { name: 'Alice Martin',   email: 'alice@example.com',   role: 'Admin',   status: 'Active',   joined: '2024-01-15' },
              { name: 'Bob Johnson',    email: 'bob@example.com',     role: 'Member',  status: 'Active',   joined: '2024-02-20' },
              { name: 'Carol Williams', email: 'carol@example.com',   role: 'Editor',  status: 'Inactive', joined: '2024-03-10' },
              { name: 'David Brown',    email: 'david@example.com',   role: 'Member',  status: 'Active',   joined: '2024-04-05' },
              { name: 'Eve Davis',      email: 'eve@example.com',     role: 'Admin',   status: 'Active',   joined: '2024-05-18' },
              { name: 'Frank Wilson',   email: 'frank@example.com',   role: 'Member',  status: 'Pending',  joined: '2024-06-22' },
              { name: 'Grace Moore',    email: 'grace@example.com',   role: 'Editor',  status: 'Active',   joined: '2024-07-01' },
              { name: 'Hank Taylor',    email: 'hank@example.com',    role: 'Member',  status: 'Inactive', joined: '2024-08-14' },
            ];
            return (
              <div className="w-full">
                <DataTable<User>
                  caption="Users"
                  searchPlaceholder="Search users…"
                  pageSize={5}
                  rows={USERS}
                  columns={[
                    { key: 'name',   header: 'Name'   },
                    { key: 'email',  header: 'Email'  },
                    { key: 'role',   header: 'Role'   },
                    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'Active' ? 'success' : r.status === 'Pending' ? 'warning' : 'neutral'}>{r.status}</Badge> },
                    { key: 'joined', header: 'Joined' },
                  ]}
                />
              </div>
            );
          })(),
          code: `<DataTable\n  caption="Users"\n  searchPlaceholder="Search users…"\n  pageSize={5}\n  rows={users}\n  columns={[\n    { key: 'name',   header: 'Name' },\n    { key: 'email',  header: 'Email' },\n    { key: 'role',   header: 'Role' },\n    { key: 'status', header: 'Status', render: (r) => <Badge variant={...}>{r.status}</Badge> },\n    { key: 'joined', header: 'Joined' },\n  ]}\n/>`,
        },
        {
          title: 'Sortable columns',
          layout: 'stack' as const,
          preview: (() => {
            type Product = { name: string; category: string; price: string; stock: string };
            const PRODUCTS: Product[] = [
              { name: 'Widget A', category: 'Tools',       price: '29.99',  stock: '150' },
              { name: 'Gadget B', category: 'Electronics', price: '99.00',  stock: '42'  },
              { name: 'Part C',   category: 'Tools',       price: '9.50',   stock: '500' },
              { name: 'Device D', category: 'Electronics', price: '249.00', stock: '18'  },
              { name: 'Item E',   category: 'Misc',        price: '14.75',  stock: '200' },
            ];
            return (
              <div className="w-full">
                <DataTable<Product>
                  caption="Products"
                  pageSize={5}
                  rows={PRODUCTS}
                  columns={[
                    { key: 'name',     header: 'Product',  sortable: true },
                    { key: 'category', header: 'Category', sortable: true },
                    { key: 'price',    header: 'Price',    sortable: true, align: 'right' },
                    { key: 'stock',    header: 'Stock',    sortable: true, align: 'right' },
                  ]}
                />
              </div>
            );
          })(),
          code: `<DataTable\n  rows={products}\n  columns={[\n    { key: 'name',  header: 'Product',  sortable: true },\n    { key: 'price', header: 'Price',    sortable: true, align: 'right' },\n  ]}\n/>`,
        },
        {
          title: 'Server mode (mode="server")',
          layout: 'stack' as const,
          preview: <ServerModeDemo />,
          code: `// Unified server-side data flow — the component owns sort/filter/pagination state\n// and calls \`fetchPage\` whenever it changes.\n<DataTable<User>\n  mode="server"\n  fetchPage={async ({ page, pageSize, sort, search, filters }) => {\n    const res = await fetch(buildUrl({ page, pageSize, sort, search, filters }));\n    const { rows, total } = await res.json();\n    return { rows, total };\n  }}\n  pageSize={5}\n  searchPlaceholder="Search users…"\n  columns={[\n    { key: 'name',  header: 'Name',  sortable: true },\n    { key: 'email', header: 'Email', sortable: true, filter: { kind: 'text' } },\n    { key: 'team',  header: 'Team',  sortable: true, filter: { kind: 'select', options: [\n      { label: 'Platform', value: 'platform' },\n      { label: 'Growth',   value: 'growth' },\n    ] } },\n  ]}\n/>`,
        },
        {
          title: 'Row actions (rowActions)',
          layout: 'stack' as const,
          preview: <RowActionsDemo />,
          code: `// A trailing column with one menu per row. Every per-row field takes a function of the row.
<DataTable<Company>
  rows={companies}
  columns={columns}
  rowActionsLabel={(row) => \`Actions for \${row.name}\`}
  rowActions={[
    { id: 'open', label: 'Open', href: (row) => \`/companies/\${row.id}\` },
    { id: 'call', label: 'Call', group: 'contact', order: 10, onClick: (row) => call(row) },
    { id: 'sign', label: 'Send for signature', group: 'contact', order: 20,
      disabled: (row) => !row.email, disabledReason: (row) => (row.email ? undefined : 'Add an email address first') },
    { id: 'restore', label: 'Restore', hidden: (row) => row.status !== 'Archived' },
    { id: 'delete', label: 'Delete', group: 'danger', order: 1000, destructive: true, onClick: remove },
  ]}
/>`,
        },
        {
          title: 'Selection + expandable rows',
          layout: 'stack' as const,
          preview: <SelectionDemo />,
          code: `// Selection is keyed by row id (rowId, else row.id), so it survives sorting, search and paging.
// The header checkbox selects the rows shown; rows on other pages keep their state.
const [selected, setSelected] = useState<DataTableRowId[]>([]);

<DataTable<Member>
  rows={members}
  columns={columns}
  selectable
  selectedRowIds={selected}
  onSelectionChange={setSelected}
  // Rows that return null get no expand toggle.
  renderExpanded={(r) => (r.lastActive ? \`Last active \${r.lastActive}\` : null)}
/>`,
        },
        {
          title: 'Filter panel (filterFields)',
          layout: 'stack' as const,
          preview: <FilterPanelDemo />,
          code: `// A "Filters" button next to the search opens a panel of any mix of controls.
// Server mode sends the set fields to fetchPage as \`filterValues\` (JSON-safe:
// dates are YYYY-MM-DD, a date range is { from, to }, a range is [min, max]).
// Static / paginated modes match rows by row[field.id], or by the field's \`match\`.
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
/>`,
        },
        {
          title: 'Manual mode (mode="manual")',
          layout: 'stack' as const,
          preview: <ManualModeDemo />,
          code: `// The host owns the rows and fetches from every reported query (also the first, on mount).
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
/>`,
        },
        {
          title: 'Live rows (rowState, keyboard rows, isRowSelectable)',
          layout: 'stack' as const,
          preview: <LiveRowsDemo />,
          code: `<DataTable<Pump>
  mode="manual"
  rows={pumps}
  rowId={(r) => r.id}
  keyboardNavigation
  rowState={(r) => (r.isNew ? 'new' : r.removing ? 'leaving' : undefined)}
  selectable
  isRowSelectable={(r) => (r.state === 'Stopped' ? 'A stopped pump cannot be selected' : true)}
  rowSelectLabel={(r) => \`Select \${r.name}\`}
  columns={[{ key: 'name', header: 'Name' }, { key: 'state', header: 'State', hideBelow: 'sm' }]}
/>`,
        },
        {
          title: 'Filter chips, date presets, number range',
          layout: 'stack' as const,
          preview: <FilterChipsDemo />,
          code: `<DataTable<Invoice>
  rows={invoices}
  filterFields={[
    { id: 'status', label: 'Status', type: 'multiselect', options, defaultValue: ['Open', 'Overdue'] },
    { id: 'amount', label: 'Amount', type: 'numberrange', min: 0 },
    { id: 'issued', label: 'Issued', type: 'daterange', presets: true },
  ]}
  // Applied filters show as removable chips under the toolbar, with "Clear all".
  columns={columns}
/>`,
        },
        {
          title: 'Card shell, footer, responsive columns',
          layout: 'stack' as const,
          preview: <CardShellDemo />,
          code: `<DataTable<Invoice>
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
/>`,
        },
        {
          title: 'Card layout (layout="cards")',
          layout: 'stack' as const,
          preview: <CardLayoutDemo />,
          code: `<DataTable<Invoice>
  layout="cards"
  cardMinWidth="12rem"
  rows={invoices}
  columns={columns} // the sortable columns feed the "Sort by" select
  filterFields={[{ id: 'status', label: 'Status', type: 'multiselect', options }]}
  renderCard={(r, { actions, selected, toggleSelected }) => <InvoiceCard invoice={r} menu={actions} />}
/>`,
        },
        {
          title: 'Groups, locked selection, search beyond columns (groupBy, isRowSelectionLocked, searchText)',
          layout: 'stack' as const,
          preview: <GroupedLockedDemo />,
          code: `<DataTable<Permission>
  mode="static"
  rows={permissions}
  groupBy={(p) => p.group}                       // a header row per group, sorted within it
  renderGroupHeader={(g, rows) => \`\${g} · \${rows.length}\`}
  searchText={(p) => \`\${p.id} \${p.module} \${p.note}\`} // matched without a hidden column
  selectable
  isRowSelectionLocked={(p) => granted.has(p.id)} // ticked, disabled, not counted
  columns={[
    { key: 'name', header: 'Permission', sortable: true },
    { key: 'limit', header: 'Daily limit', searchable: false,
      render: (p, { index }) => <Input id={\`limit-\${p.id}\`} label="Daily limit" hideLabel value={limits[index]} … /> },
  ]}
/>
// Empty cells sort last in both directions; a default multi-column sort shows no priority numbers.`,
        },
        {
          title: 'Required choice in the toolbar (required, placement)',
          layout: 'stack' as const,
          preview: <RequiredToolbarFilterDemo />,
          code: `filterFields={[
  // no "Any", no chip, not counted on Filters, applied at once, kept by Clear all and Reset
  { id: 'status', label: 'Status', type: 'radio', required: true, placement: 'toolbar', defaultValue: 'Open', options },
  { id: 'amount', label: 'Amount', type: 'numberrange' },
]}`,
        },
        {
          title: 'Column chooser (columnChooser, tableId)',
          layout: 'stack' as const,
          preview: <ColumnChooserDemo />,
          code: `// Opt-in: a "Columns" button in the toolbar. The viewer's choice is saved on this device
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
/>`,
        },
        {
          title: 'Sticky header (stickyHeader)',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <DataTable
                caption="Sticky header table"
                mode="static"
                searchable={false}
                stickyHeader
                columns={[{ key: 'n', header: 'Name' }, { key: 'v', header: 'Value', align: 'right' }]}
                rows={Array.from({ length: 12 }, (_, i) => ({ n: `Row ${i + 1}`, v: i * 10 }))}
              />
            </div>
          ),
          code: `<DataTable mode="static" searchable={false} stickyHeader columns={columns} rows={rows} />`,
        },
      ],
    },
    {
      id: 'advanced-data-table',
      title: 'AdvancedDataTable',
      category: 'Organism',
      abbr: 'At',
      description: 'Deprecated: use DataTable with `selectable`, `renderExpanded` and `stickyHeader`. Thin wrapper kept until removal; row selection (with indeterminate header), expandable rows, and optional sticky header.',
      filePath: 'modules/ui/Table/index.tsx',
      sourceCode: `'use client';\nimport { cn } from '@/libs/utils/cn';\nimport { useState } from 'react';\n\nexport function AdvancedDataTable({ columns, rows, selectable, stickyHeader, onSelectionChange }) {\n  // row selection with indeterminate header, expandable rows, sticky header\n}`,
      variants: [
        {
          title: 'Selectable + Expandable',
          layout: 'stack' as const,
          preview: <AdvancedTableDemo />,
          code: `<AdvancedDataTable\n  columns={[{ key: 'name', header: 'Name' }, ...]}\n  rows={rows}\n  selectable\n/>`,
        },
        {
          title: 'Sticky Header',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <AdvancedDataTable
                columns={[{ key: 'n', header: 'Name' }, { key: 'v', header: 'Value' }] as never}
                rows={Array.from({ length: 10 }, (_, i) => ({ n: `Row ${i + 1}`, v: i * 10 }))}
                stickyHeader
                caption="Sticky header table"
              />
            </div>
          ),
          code: `<AdvancedDataTable columns={columns} rows={rows} stickyHeader />`,
        },
      ],
    },
    {
      id: 'content-score-bar',
      title: 'ContentScoreBar',
      category: 'Organism',
      abbr: 'Cs',
      description: 'Rule-based content quality score with Good ≥70 / Fair ≥40 / Poor <40 tier system. Each rule shown as a chip with passed/total count. role="progressbar" + aria-valuenow.',
      filePath: 'modules/ui/ContentScoreBar.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useMemo } from 'react';

const tierMap = {
  great: { bar: 'bg-success', text: 'text-success-fg', bg: 'bg-success-subtle', border: 'border-success', label: 'Good' },
  ok:    { bar: 'bg-warning', text: 'text-warning-fg', bg: 'bg-warning-subtle', border: 'border-warning', label: 'Fair' },
  poor:  { bar: 'bg-error',   text: 'text-error-fg',   bg: 'bg-error-subtle',   border: 'border-error',   label: 'Poor' },
};

export function ContentScoreBar({ value, rules, label, className }) {
  const { score, results } = useMemo(() => {
    let earned = 0, total = 0;
    const results = rules.map((rule) => { const pass = rule.check(value); if (pass) earned += rule.points; total += rule.points; return { label: rule.label, pass, hint: rule.hint }; });
    return { score: total > 0 ? Math.round((earned / total) * 100) : 0, results };
  }, [value, rules]);
  const tier = score >= 70 ? 'great' : score >= 40 ? 'ok' : 'poor';
  const t = tierMap[tier];
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', t.bg, t.border, className)}>
      <div className="flex items-center gap-2">
        {label && <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={cn('text-xs font-medium', t.text)}>{t.label}</span>
          <span className={cn('text-sm font-bold tabular-nums', t.text)}>{score}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', t.bar)} style={{ width: \`\${score}%\` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {results.map((r, i) => <span key={i} title={r.hint} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', r.pass ? cn(t.bg, t.text, 'border', t.border) : 'bg-surface-sunken text-text-disabled border border-border')}>{r.pass && <span aria-hidden="true">✓</span>}{r.label}</span>)}
      </div>
      <p className="text-xs text-text-secondary">{results.filter(r => r.pass).length} / {results.length} rules passed</p>
    </div>
  );
}`,
      variants: [
        {
          title: 'Live evaluation',
          layout: 'stack' as const,
          preview: (() => {
            const RULES: ScoreRule[] = [
              { label: 'Min 20 chars',   check: (v) => v.length >= 20,                            points: 20 },
              { label: 'Has number',     check: (v) => /\d/.test(v),                               points: 20 },
              { label: 'Has uppercase',  check: (v) => /[A-Z]/.test(v),                            points: 20 },
              { label: 'Has keyword',    check: (v) => /next|react|typescript/i.test(v),            points: 20, hint: 'Include "Next", "React", or "TypeScript"' },
              { label: 'Min 5 words',    check: (v) => v.trim().split(/\s+/).filter(Boolean).length >= 5, points: 20 },
            ];
            function Demo() {
              const [text, setText] = useState('Build with Next.js and TypeScript');
              return (
                <div className="w-full max-w-sm space-y-2">
                  <Textarea id="sc-csb-input" label="Content" rows={2} value={text} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} placeholder="Type your content…" />
                  <ContentScoreBar value={text} rules={RULES} label="Quality score" />
                </div>
              );
            }
            return <Demo />;
          })(),
          code: `const rules = [\n  { label: 'Min 20 chars', check: (v) => v.length >= 20, points: 20 },\n  { label: 'Has keyword',  check: (v) => /react/i.test(v), points: 20, hint: 'Include "React"' },\n  // ...\n];\n<ContentScoreBar value={content} rules={rules} label="Quality score" />`,
        },
        {
          title: 'All tiers',
          layout: 'stack' as const,
          preview: (() => {
            const makeRules = (pass: number, total: number): ScoreRule[] =>
              Array.from({ length: total }, (_, i) => ({
                label: `Rule ${i + 1}`,
                check: () => i < pass,
                points: 1,
              }));
            return (
              <div className="w-full max-w-sm space-y-3">
                <ContentScoreBar value="" rules={makeRules(5, 5)} label="Good (100%)" />
                <ContentScoreBar value="" rules={makeRules(3, 5)} label="Fair (60%)" />
                <ContentScoreBar value="" rules={makeRules(1, 5)} label="Poor (20%)" />
              </div>
            );
          })(),
          code: `// Good tier  (score ≥ 70)\n<ContentScoreBar value="" rules={allPassRules} label="Good (100%)" />\n\n// Fair tier  (40 ≤ score < 70)\n<ContentScoreBar value="" rules={halfPassRules} label="Fair (60%)" />\n\n// Poor tier  (score < 40)\n<ContentScoreBar value="" rules={onePassRules}  label="Poor (20%)" />`,
        },
        {
          title: 'Password strength',
          layout: 'stack' as const,
          preview: (() => {
            const PWD_RULES: ScoreRule[] = [
              { label: 'Min 8 chars',   check: (v) => v.length >= 8,           points: 25 },
              { label: 'Uppercase',     check: (v) => /[A-Z]/.test(v),         points: 25 },
              { label: 'Number',        check: (v) => /\d/.test(v),             points: 25 },
              { label: 'Special char',  check: (v) => /[^A-Za-z0-9]/.test(v),  points: 25 },
            ];
            function PwdDemo() {
              const [pwd, setPwd] = useState('Hello1');
              return (
                <div className="w-full max-w-sm space-y-2">
                  <input
                    type="password"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Enter password…"
                    className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  />
                  <ContentScoreBar value={pwd} rules={PWD_RULES} label="Password strength" />
                </div>
              );
            }
            return <PwdDemo />;
          })(),
          code: `const rules = [\n  { label: 'Min 8 chars',  check: (v) => v.length >= 8,          points: 25 },\n  { label: 'Uppercase',    check: (v) => /[A-Z]/.test(v),        points: 25 },\n  { label: 'Number',       check: (v) => /\\d/.test(v),            points: 25 },\n  { label: 'Special char', check: (v) => /[^A-Za-z0-9]/.test(v), points: 25 },\n];\n<ContentScoreBar value={password} rules={rules} label="Password strength" />`,
        },
      ],
    },
    {
      id: 'bulk-action-table',
      title: 'BulkActionTable',
      category: 'Organism',
      abbr: 'Bt',
      description:
        'Table with **id-keyed** row selection and a bulk-action bar. `DataTable`’s own `selectable` prop keys selection by array index and only works in the deprecated legacy view, so selections there follow the wrong rows once anything sorts or paginates.',
      filePath: 'modules/ui/BulkActionTable.tsx',
      sourceCode: `'use client';
// Id-keyed row selection plus a bulk-action bar. Selection survives sort,
// filter and pagination because it is keyed on the row's own id, never on its
// position in the array.
export function BulkActionTable({ columns, rows, rowId, selected, onSelectedChange, actions = [], isRowSelectable, totalMatching, onSelectAllMatching }) {
  const selectedSet = new Set(selected);
  const selectableRows = rows.filter((r) => (isRowSelectable ? isRowSelectable(r) === true : true));
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every((r) => selectedSet.has(rowId(r)));

  function toggleAllVisible() {
    const next = new Set(selectedSet);
    // Deselect only what is visible: a selection made on page 1 must survive
    // clearing page 2.
    for (const row of selectableRows) allVisibleSelected ? next.delete(rowId(row)) : next.add(rowId(row));
    onSelectedChange([...next]);
  }

  // \`indeterminate\` is a DOM property, not an attribute — without the ref a
  // partial selection looks identical to none.
  const headerCheckbox = (
    <input type="checkbox" checked={allVisibleSelected}
      ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && selectableRows.some((r) => selectedSet.has(rowId(r))); }}
      onChange={toggleAllVisible} aria-label="Select all rows on this page" />
  );

  return (
    <div>
      {selected.length > 0 && (
        <div role="region" aria-label="Bulk actions">
          <span>{selected.length} selected</span>
          {totalMatching > rows.length && (
            <button onClick={onSelectAllMatching}>Select all {totalMatching} matching</button>
          )}
          {actions.map((a) => <button key={a.key} onClick={() => a.onAction([...selected])}>{a.label}</button>)}
        </div>
      )}
      <Table columns={[{ key: '__selection', header: headerCheckbox, render: rowCheckbox }, ...columns]} rows={rows} />
    </div>
  );
}`,
      variants: [
        {
          title: 'Selection and actions',
          layout: 'stack' as const,
          preview: (() => {
            type Row = { id: string; company: string; country: string; stage: string; [key: string]: unknown };
            const ROWS: Row[] = [
              { id: 'c1', company: 'Northwind Traders', country: 'DE', stage: 'new' },
              { id: 'c2', company: 'Contoso Ltd',       country: 'GB', stage: 'contacted' },
              { id: 'c3', company: 'Fabrikam',          country: 'NL', stage: 'replied' },
              { id: 'c4', company: 'Adventure Works',   country: 'TR', stage: 'new' },
            ];
            function Demo() {
              const [selected, setSelected] = useState<string[]>(['c1']);
              return (
                <div className="w-full">
                  <BulkActionTable<Row, string>
                    rows={ROWS}
                    rowId={(r) => r.id}
                    selected={selected}
                    onSelectedChange={setSelected}
                    columns={[
                      { key: 'company', header: 'Company' },
                      { key: 'country', header: 'Country' },
                      { key: 'stage',   header: 'Stage' },
                    ]}
                    actions={[
                      { key: 'enrich', label: 'Enrich', onAction: () => undefined },
                      { key: 'remove', label: 'Remove', destructive: true, onAction: () => setSelected([]) },
                    ]}
                  />
                </div>
              );
            }
            return <Demo />;
          })(),
          code: `<BulkActionTable\n  rows={companies}\n  rowId={(c) => c.companyId}\n  selected={selected}\n  onSelectedChange={setSelected}\n  columns={columns}\n  actions={[{ key: 'enrich', label: 'Enrich', onAction: enrich }]}\n/>`,
        },
        {
          title: 'Unselectable rows, and select-all-matching',
          layout: 'stack' as const,
          preview: (() => {
            type Row = { id: string; company: string; reason: string; [key: string]: unknown };
            const ROWS: Row[] = [
              { id: 'c1', company: 'Northwind Traders', reason: '' },
              { id: 'c2', company: 'Contoso Ltd',       reason: 'Suppressed — replied "stop"' },
              { id: 'c3', company: 'Fabrikam',          reason: '' },
            ];
            function Demo() {
              const [selected, setSelected] = useState<string[]>([]);
              return (
                <div className="w-full">
                  <BulkActionTable<Row, string>
                    rows={ROWS}
                    rowId={(r) => r.id}
                    selected={selected}
                    onSelectedChange={setSelected}
                    isRowSelectable={(r) => (r.reason ? r.reason : true)}
                    totalMatching={1240}
                    onSelectAllMatching={() => undefined}
                    columns={[
                      { key: 'company', header: 'Company' },
                      { key: 'reason',  header: 'Why not selectable' },
                    ]}
                    actions={[{ key: 'email', label: 'Email', onAction: () => undefined }]}
                  />
                </div>
              );
            }
            return <Demo />;
          })(),
          code: `<BulkActionTable\n  isRowSelectable={(c) => (c.suppressed ? 'Suppressed' : true)}\n  totalMatching={total}\n  onSelectAllMatching={selectEverything}\n  …\n/>`,
        },
      ],
    },
    {
      id: 'timeline',
      title: 'Timeline',
      category: 'Organism',
      abbr: 'Tl',
      description:
        'Chronological activity feed with sticky day headings, `order` (newest or oldest first), step `status` (done, current, upcoming: a hollow marker) and undated entries (no or invalid `at`: drawn last without a time, never a RangeError). Grouping uses the viewer’s local day via `Intl`, not the raw ISO date — an event at 23:50 UTC otherwise lands under the wrong heading for anyone east or west of the server. A day heading lines up with the events’ text, keeps a gap above the first marker and is drawn in the timeline’s `surface` (`raised` inside a card), so it never reads as a band of another colour; the last event leaves no space under it.',
      filePath: 'modules/ui/Timeline.tsx',
      sourceCode: `'use client';
// Chronological feed with sticky day headings.
export function Timeline({ items, timeZone, locale, groupByDay = true, emptyMessage = 'Nothing here yet.' }) {
  if (items.length === 0) return <p>{emptyMessage}</p>;

  // Grouping uses the VIEWER's local day. An event at 23:50 UTC belongs to a
  // different day depending on who is looking, and grouping on the raw ISO
  // date puts it under the wrong heading for anyone east or west of the server.
  const dayFormat  = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // hourCycle, not hour12:false — the latter renders midnight as hour "24".
  const timeFormat = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  // Grouping is computed BEFORE rendering. React 19 may restart a render, and
  // a closure variable mutated inside map() survives the restart and puts the
  // day headings in the wrong places.
  const sorted   = [...items].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const rendered = sorted.map((item, i) => ({
    item,
    day: dayFormat.format(new Date(item.at)),
    showDay: groupByDay && dayFormat.format(new Date(item.at)) !== (i === 0 ? null : dayFormat.format(new Date(sorted[i - 1].at))),
  }));

  return (
    <ol>
      {rendered.map(({ item, day, showDay }) => (
        <Fragment key={item.id}>
          {showDay && <li className="sticky top-0">{day}</li>}
          <li>
            <span className={TONE_CLASS[item.tone ?? 'default']}>{item.icon}</span>
            <span>{item.title}</span>
            <time dateTime={new Date(item.at).toISOString()}>{timeFormat.format(new Date(item.at))}</time>
            {item.body && <div>{item.body}</div>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}`,
      variants: [
        {
          title: 'Grouped by day',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-lg">
              <Timeline
                items={[
                  { id: '1', at: '2026-08-25T09:12:00Z', title: 'Email sent', body: 'Re: shipping integration', tone: 'info' },
                  { id: '2', at: '2026-08-25T14:40:00Z', title: 'Reply received', body: '“Interesting — can you send details?”', tone: 'success' },
                  { id: '3', at: '2026-08-24T16:05:00Z', title: 'Call completed', body: '4m 12s · reached the right person', tone: 'default' },
                  { id: '4', at: '2026-08-24T10:00:00Z', title: 'Enriched', body: '18 employees · logistics software', tone: 'default' },
                ]}
              />
            </div>
          ),
          code: `<Timeline\n  items={activities.map((a) => ({\n    id: a.activityId,\n    at: a.occurredAt,\n    title: a.type,\n    body: a.summary,\n  }))}\n/>`,
        },
        {
          title: 'Empty, and ungrouped',
          layout: 'stack' as const,
          preview: (
            <div className="flex w-full max-w-lg flex-col gap-6">
              <Timeline items={[]} emptyMessage="No activity on this company yet." />
              <Timeline
                groupByDay={false}
                items={[
                  { id: '1', at: '2026-08-25T09:12:00Z', title: 'Bounced', tone: 'error' },
                  { id: '2', at: '2026-08-25T08:00:00Z', title: 'Queued', tone: 'warning' },
                ]}
              />
            </div>
          ),
          code: `<Timeline items={[]} emptyMessage="No activity yet." />\n<Timeline items={items} groupByDay={false} />`,
        },
        {
          title: 'Process steps: oldest first, current and upcoming, undated',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-lg">
              <Timeline
                order="oldest"
                groupByDay={false}
                items={[
                  { id: 'sent', at: '2026-08-24T10:00:00Z', title: 'Invitation sent', status: 'done', tone: 'info' },
                  { id: 'opened', at: '2026-08-25T09:30:00Z', title: 'Opened', status: 'current', tone: 'success' },
                  { id: 'expires', at: '2026-08-31T10:00:00Z', title: 'Expires', status: 'upcoming' },
                  { id: 'accepted', at: null, title: 'Accepted', status: 'upcoming', body: 'Not yet' },
                ]}
              />
            </div>
          ),
          code: `<Timeline
  order="oldest"                 // default "newest"
  items={[
    { id: 'sent', at: sentAt, title: 'Invitation sent', status: 'done' },
    { id: 'opened', at: openedAt, title: 'Opened', status: 'current' },  // aria-current="step"
    { id: 'expires', at: expiresAt, title: 'Expires', status: 'upcoming' }, // hollow, muted
    { id: 'accepted', at: null, title: 'Accepted', status: 'upcoming' },   // undated: last, no time
  ]}
/>`,
        },
        {
          title: 'Inside a card: surface="raised"',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
              <Timeline
                surface="raised"
                items={[
                  { id: '1', at: '2026-08-25T14:40:00Z', title: 'Acknowledged by Alex', body: 'Valve closed, watching the pressure.', tone: 'warning' },
                  { id: '2', at: '2026-08-25T14:31:00Z', title: 'Severity raised: Major → Critical', tone: 'warning' },
                  { id: '3', at: '2026-08-24T22:05:00Z', title: 'Opened by the platform', tone: 'error' },
                ]}
              />
              <p className="border-t border-border pt-4 text-sm text-text-secondary">What follows the timeline starts right after its last event.</p>
            </div>
          ),
          code: `<section className="rounded-xl border border-border bg-surface-raised p-4">\n  <Timeline items={events} surface="raised" />\n</section>`,
        },
      ],
    },
    withUsage({
      id: 'keyed-table',
      title: 'KeyedTable',
      category: 'Molecule',
      abbr: 'KT',
      description: 'A rows-in, events-out table for data that changes under the viewer: stable row keys, keyboard row focus (Arrow keys, Home/End, Enter), a per-row state (new = highlighted, leaving = fading), optional selection checkboxes, loading / error (retry) / empty states, and columns that hide below a breakpoint.',
      filePath: 'modules/ui/KeyedTable.tsx',
      since: '2026-10',
      variants: [
        { title: 'Live rows and row click', layout: 'stack', preview: <KeyedTableDemo />, code: `<KeyedTable caption="Pumps" rows={rows} getRowKey={(r) => r.id} columns={columns} rowState={(r) => (r.isNew ? 'new' : undefined)} onRowClick={open} />` },
        { title: 'Selection with a refused row', layout: 'stack', preview: <KeyedTableDemo selectable />, code: `<KeyedTable … selection={{ selected, onChange: setSelected, isSelectable: (r) => r.ok || 'Why not' }} />` },
        { title: 'Error with retry, and loading', layout: 'stack', preview: (
          <div className="flex w-full max-w-lg flex-col gap-3">
            <KeyedTable caption="Failed" rows={[] as Pump[]} getRowKey={(r) => r.id} columns={[{ key: 'name', header: 'Name' }]} error="The pumps could not be read." onRetry={() => undefined} />
            <KeyedTable caption="Loading" rows={[] as Pump[]} getRowKey={(r) => r.id} columns={[{ key: 'name', header: 'Name' }]} loading />
          </div>
        ), code: `<KeyedTable … error="The pumps could not be read." onRetry={reload} />\n<KeyedTable … loading />` },
      ],
    }, `import { KeyedTable } from '@/modules/ui/KeyedTable';
<KeyedTable caption="Devices" rows={rows} getRowKey={(r) => r.id} columns={columns} onRowClick={open}
  rowState={(r) => (fresh.has(r.id) ? 'new' : undefined)} selection={{ selected, onChange }} loading={loading} error={error} onRetry={reload} />`),
    withUsage({
      id: 'typed-confirm-dialog',
      title: 'TypedConfirmDialog',
      category: 'Molecule',
      abbr: 'TY',
      description: 'A confirmation that needs the user to type an exact phrase (a serial, a command word) before confirming: stronger than Popconfirm for actions that cannot be undone.',
      filePath: 'modules/ui/TypedConfirmDialog.tsx',
      since: '2026-10',
      variants: [
        { title: 'A command word', layout: 'side', preview: <TypedConfirmDemo phrase="REBOOT" />, code: `<TypedConfirmDialog open title="Reboot?" phrase="REBOOT" label="Type REBOOT" confirmLabel="Reboot" onConfirm={go} onCancel={close} />` },
        { title: 'A serial number', layout: 'side', preview: <TypedConfirmDemo phrase="RT-24-000912" />, code: `<TypedConfirmDialog open title="Release device?" phrase={device.serial} … />` },
      ],
    }, `import { TypedConfirmDialog } from '@/modules/ui/TypedConfirmDialog';
<TypedConfirmDialog open={open} title="Release device?" phrase={serial} label={\`Type \${serial} to confirm\`} confirmLabel="Release" onConfirm={release} onCancel={close} />`),
  ];
}
