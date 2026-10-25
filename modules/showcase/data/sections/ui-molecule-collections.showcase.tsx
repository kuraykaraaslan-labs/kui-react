'use client';
import { useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Input } from '@/modules/ui/Input';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { BarList } from '@/modules/ui/BarList';
import { OrgChart, buildOrgTree, type OrgTreeNode } from '@/modules/ui/OrgChart';
import type { ShowcaseComponent } from '../showcase.types';

// Phase 11.10–11.12: collection components for detail pages, report breakdowns and org charts.

type Employee = { id: string; name: string; title: string; managerId: string | null; status: 'Active' | 'On leave' };
const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Ada Lovelace', title: 'Chief Executive', managerId: null, status: 'Active' },
  { id: 'e2', name: 'Grace Hopper', title: 'CTO', managerId: 'e1', status: 'Active' },
  { id: 'e3', name: 'Katherine Johnson', title: 'CFO', managerId: 'e1', status: 'Active' },
  { id: 'e4', name: 'Linus Torvalds', title: 'Platform Lead', managerId: 'e2', status: 'Active' },
  { id: 'e5', name: 'Margaret Hamilton', title: 'Flight Software', managerId: 'e2', status: 'On leave' },
  { id: 'e6', name: 'Barbara Liskov', title: 'Architect', managerId: 'e4', status: 'Active' },
  { id: 'e7', name: 'Dorothy Vaughan', title: 'Controller', managerId: 'e3', status: 'Active' },
];

function OrgChartDemo() {
  const [query, setQuery] = useState('');
  const roots = buildOrgTree(EMPLOYEES, (e) => e.id, (e) => e.managerId);
  const q = query.trim().toLowerCase();
  return (
    <div className="w-full space-y-3">
      <Input id="org-demo-search" label="Find a person" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name…" />
      <OrgChart<OrgTreeNode<Employee>>
        ariaLabel="Organisation"
        roots={roots}
        getId={(n) => n.node.id}
        getChildren={(n) => n.children}
        defaultExpandedDepth={1}
        highlight={q.length > 1 ? (n) => n.node.name.toLowerCase().includes(q) : undefined}
        onNodeClick={() => {}}
        renderNode={(n, { childCount }) => (
          <div className="w-48 rounded-lg border border-border bg-surface-raised p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-text-primary">{n.node.name}</span>
              <Badge variant={n.node.status === 'Active' ? 'success' : 'warning'} size="sm">{n.node.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{n.node.title}</p>
            {childCount > 0 && <p className="mt-1 text-xs text-text-disabled">{childCount} direct report(s)</p>}
          </div>
        )}
      />
    </div>
  );
}

export function buildCollectionsData(): ShowcaseComponent[] {
  return [
    {
      id: 'description-list',
      title: 'DescriptionList',
      category: 'Molecule',
      abbr: 'Dl',
      description: 'Label/value pairs of one record for detail pages: inline (label left, value right) or stacked, 1–3 columns that collapse on a phone, a dash for empty values, monospace values and a copy button for ids and keys, wide items that span the grid.',
      filePath: 'modules/ui/DescriptionList.tsx',
      sourceCode: `<DescriptionList
  columns={2}
  items={[
    { label: 'Invoice', value: 'INV-1001', mono: true, copyValue: 'INV-1001' },
    { label: 'Status', value: <Badge variant="success">Paid</Badge> },
    { label: 'Customer', value: 'Northwind Traders' },
    { label: 'Due', value: '' }, // shows —
    { label: 'Notes', value: longText, wide: true },
  ]}
/>`,
      variants: [
        {
          title: 'Inline (key/value sheet)',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <DescriptionList
                items={[
                  { label: 'API key', value: 'kui_live_8f2c…a91b', mono: true, copyValue: 'kui_live_8f2ca91b' },
                  { label: 'Scope', value: 'orders:read, invoices:read' },
                  { label: 'Created', value: '12 Oct 2026', hint: 'by Ada Lovelace' },
                  { label: 'Last used', value: '' },
                ]}
              />
            </div>
          ),
          code: `<DescriptionList items={[{ label: 'API key', value: key, mono: true, copyValue: key }, …]} />`,
        },
        {
          title: 'Stacked, two columns',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <DescriptionList
                layout="stacked"
                columns={2}
                items={[
                  { label: 'Invoice', value: 'INV-1001', mono: true },
                  { label: 'Status', value: <Badge variant="success">Paid</Badge> },
                  { label: 'Customer', value: 'Northwind Traders' },
                  { label: 'Total', value: '$1,240.00' },
                  { label: 'Notes', value: 'Delivered to the Izmir warehouse; the second pallet ships on Monday.', wide: true },
                ]}
              />
            </div>
          ),
          code: `<DescriptionList layout="stacked" columns={2} items={items} />`,
        },
      ],
    },
    {
      id: 'bar-list',
      title: 'BarList',
      category: 'Molecule',
      abbr: 'Bl',
      description: 'A ranked breakdown for report pages: label, a bar to scale and the value, sorted by value (or label, or as given), optional share of the total, a row limit, links per row and an empty message.',
      filePath: 'modules/ui/BarList.tsx',
      sourceCode: `<BarList
  showPercent
  valueFormatter={(v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
  items={[
    { label: 'Web', value: 48210, href: '/reports/channel/web' },
    { label: 'Mobile', value: 31950 },
    { label: 'Marketplace', value: 12400, barClassName: 'bg-warning' },
  ]}
/>`,
      variants: [
        {
          title: 'Revenue by channel',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <BarList
                ariaLabel="Revenue by channel"
                showPercent
                valueFormatter={(v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                items={[
                  { label: 'Web', value: 48210 },
                  { label: 'Mobile', value: 31950 },
                  { label: 'Marketplace', value: 12400, barClassName: 'bg-warning' },
                  { label: 'Point of sale', value: 8700 },
                ]}
              />
            </div>
          ),
          code: `<BarList showPercent valueFormatter={money} items={rows} />`,
        },
        {
          title: 'With counts and a limit',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <BarList
                limit={3}
                items={[
                  { label: 'Abandoned', value: 412, meta: '38 carts', barClassName: 'bg-error' },
                  { label: 'Converted', value: 1180, meta: '96 carts', barClassName: 'bg-success' },
                  { label: 'Open', value: 260, meta: '21 carts' },
                  { label: 'Expired', value: 40, meta: '4 carts' },
                ]}
              />
            </div>
          ),
          code: `<BarList limit={3} items={rows.map((r) => ({ label: r.status, value: r.value, meta: \`\${r.count} carts\` }))} />`,
        },
      ],
    },
    {
      id: 'org-chart',
      title: 'OrgChart',
      category: 'Organism',
      abbr: 'Oc',
      description: 'A top-down tree of the host\'s own cards joined by connector lines: nested or flat data (buildOrgTree), collapsible subtrees, highlight that opens the path to every match (search), zoom, and a keyboard tree (Up parent, Down first child, Left/Right siblings, Enter clicks, * opens all children).',
      filePath: 'modules/ui/OrgChart.tsx',
      sourceCode: `const roots = buildOrgTree(employees, (e) => e.id, (e) => e.managerId);

<OrgChart
  roots={roots}
  getId={(n) => n.node.id}
  getChildren={(n) => n.children}
  defaultExpandedDepth={2}
  highlight={query ? (n) => n.node.name.toLowerCase().includes(query) : undefined}
  onNodeClick={(n) => router.push(\`/employees/\${n.node.id}\`)}
  renderNode={(n) => <EmployeeCard employee={n.node} />}
/>`,
      variants: [
        {
          title: 'With search',
          layout: 'stack' as const,
          preview: <OrgChartDemo />,
          code: `<OrgChart roots={roots} getId={…} getChildren={…} highlight={match} renderNode={(n) => <EmployeeCard … />} />`,
        },
      ],
    },
  ];
}
