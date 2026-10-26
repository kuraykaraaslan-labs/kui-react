'use client';
import { Badge } from '@/modules/ui/Badge';
import { Pagination } from '@/modules/ui/Pagination';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { TabGroup } from '@/modules/ui/TabGroup';
import { Button } from '@/modules/ui/Button';
import { Stepper } from '@/modules/ui/Stepper';
import { TreeView } from '@/modules/ui/TreeView';
import { TabButton } from '@/modules/ui/TabButton';
import { ViewToggle, type ViewOrientation } from '@/modules/ui/ViewToggle';
import { useEffect, useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';

function BrokenCallLog(): React.ReactNode {
  throw new Error('telephony is unreachable');
}

function IsolatedTabsDemo() {
  const [reports, setReports] = useState<string[]>([]);
  return (
    <div className="w-full space-y-2">
      <TabGroup
        label="Contact"
        isolate
        onTabError={(tabId, error) => setReports((r) => [...r, `${tabId}: ${error.message}`])}
        tabs={[
          // Contributed tabs carry an order; the host's own tabs (no order) count as 0 and stay first.
          { id: 'calls', label: 'Calls', order: 20, lazy: true, content: <BrokenCallLog /> },
          { id: 'overview', label: 'Overview', content: <p className="text-sm text-text-secondary">Host tab: contact details.</p> },
          { id: 'tasks', label: 'Tasks', order: 10, lazy: true, content: <p className="text-sm text-text-secondary">Contributed by the tasks module.</p> },
        ]}
      />
      <p className="text-xs text-text-disabled">Reported: {reports.length ? reports.join(', ') : 'nothing yet (open Calls)'}</p>
      <Button size="xs" variant="ghost" onClick={() => setReports([])}>Clear log</Button>
    </div>
  );
}

function TabButtonDemo() {
  const [tab, setTab] = useState<'all' | 'active' | 'archived'>('all');
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <TabButton active={tab === 'all'}      onClick={() => setTab('all')}      count={42}>All</TabButton>
      <TabButton active={tab === 'active'}   onClick={() => setTab('active')}   count={18}>Active</TabButton>
      <TabButton active={tab === 'archived'} onClick={() => setTab('archived')} count={24}>Archived</TabButton>
    </div>
  );
}

function ViewToggleDemo() {
  const [view, setView] = useState<ViewOrientation>('horizontal');
  return <ViewToggle value={view} onChange={setView} />;
}

function ViewToggleCustomDemo() {
  const [view, setView] = useState<ViewOrientation>('vertical');
  return <ViewToggle value={view} onChange={setView} labels={{ horizontal: 'Yatay', vertical: 'Dikey' }} />;
}

function PaginationDemo() {
  const [page, setPage] = useState(1);
  return <Pagination page={page} totalPages={10} onPageChange={setPage} />;
}

function TreeViewDemo() {
  const [sel, setSel] = useState<string | undefined>();
  return (
    <TreeView
      label="File tree"
      selectedId={sel}
      onSelect={setSel}
      nodes={[
        { id: 'src', label: 'src', children: [
          { id: 'components', label: 'components', children: [
            { id: 'Button', label: 'Button.tsx' },
            { id: 'Input', label: 'Input.tsx' },
          ]},
          { id: 'utils', label: 'utils', children: [
            { id: 'cn', label: 'cn.ts' },
          ]},
        ]},
        { id: 'public', label: 'public', children: [
          { id: 'logo', label: 'logo.svg' },
        ]},
        { id: 'pkg', label: 'package.json' },
      ]}
    />
  );
}

function TreeViewNavDemo() {
  const [sel, setSel] = useState<string | undefined>();
  return (
    <TreeView
      label="Settings navigation"
      selectedId={sel}
      onSelect={setSel}
      nodes={[
        { id: 'account', label: 'Account', children: [
          { id: 'profile', label: 'Profile' },
          { id: 'password', label: 'Password' },
          { id: 'notifications', label: 'Notifications' },
        ]},
        { id: 'workspace', label: 'Workspace', children: [
          { id: 'general', label: 'General' },
          { id: 'members', label: 'Members' },
          { id: 'billing', label: 'Billing' },
        ]},
        { id: 'integrations', label: 'Integrations' },
      ]}
    />
  );
}

function TreeViewFlatDemo() {
  const [sel, setSel] = useState<string>('ts');
  return (
    <TreeView
      label="Language selector"
      selectedId={sel}
      onSelect={setSel}
      nodes={[
        { id: 'ts', label: 'TypeScript' },
        { id: 'js', label: 'JavaScript' },
        { id: 'py', label: 'Python' },
        { id: 'go', label: 'Go' },
        { id: 'rs', label: 'Rust' },
      ]}
    />
  );
}

function TreeViewMultiSelectDemo() {
  const [ids, setIds] = useState<string[]>(['Card']);
  return (
    <TreeView
      label="Project files (multi-select + type-ahead)"
      selectionMode="multi"
      selectedIds={ids}
      onSelectionChange={setIds}
      nodes={[
        { id: 'docs', label: 'Documents', children: [
          { id: 'spec', label: 'spec.md' },
          { id: 'roadmap', label: 'roadmap.md' },
        ]},
        { id: 'src', label: 'src', children: [
          { id: 'Button', label: 'Button.tsx' },
          { id: 'Card', label: 'Card.tsx' },
          { id: 'Drawer', label: 'Drawer.tsx' },
          { id: 'TreeView', label: 'TreeView.tsx' },
        ]},
        { id: 'tests', label: 'tests', children: [
          { id: 'unit', label: 'unit' },
          { id: 'e2e', label: 'e2e' },
        ]},
      ]}
    />
  );
}

export function buildNavigationData(): ShowcaseComponent[] {
  return [
    {
      id: 'pagination',
      title: 'Pagination',
      category: 'Organism',
      abbr: 'Pg',
      description: 'Page navigation control. Collapses large page counts with ellipsis; accessible via aria-label and aria-current="page".',
      filePath: 'modules/ui/Pagination.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

export function Pagination({ page, totalPages, onPageChange, className }) {
  // builds visible pages with ellipsis ...
  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Go to previous page" className="...">‹</button>
      {/* page buttons */}
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Go to next page" className="...">›</button>
    </nav>
  );
}`,
      variants: [
        {
          title: 'Default',
          preview: <PaginationDemo />,
          code: `const [page, setPage] = useState(1);\n<Pagination page={page} totalPages={10} onPageChange={setPage} />`,
        },
        {
          title: 'Sizes',
          preview: (() => {
            function SizesDemo() {
              const [p, setP] = useState(3);
              return (
                <div className="space-y-3">
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <Pagination key={s} page={p} totalPages={10} onPageChange={setP} size={s} />
                  ))}
                </div>
              );
            }
            return <SizesDemo />;
          })(),
          code: `<Pagination page={page} totalPages={10} onPageChange={setPage} size="sm" />\n<Pagination page={page} totalPages={10} onPageChange={setPage} size="lg" />`,
          layout: 'stack' as const,
        },
        {
          title: 'First / Last + Jump to page',
          preview: (() => {
            function FullDemo() {
              const [p, setP] = useState(5);
              return <Pagination page={p} totalPages={20} onPageChange={setP} showFirstLast showJumpTo />;
            }
            return <FullDemo />;
          })(),
          code: `<Pagination page={page} totalPages={20} onPageChange={setPage} showFirstLast showJumpTo />`,
          layout: 'stack' as const,
        },
      ],
    },
    {
      id: 'tab-group',
      title: 'TabGroup',
      category: 'Organism',
      abbr: 'Tg',
      description: 'Accessible tab navigation following the role="tablist" / role="tab" / role="tabpanel" ARIA pattern. Arrow-key navigation; tabIndex=-1 on inactive tabs. Optional per-tab isolation (error boundary + Suspense), `order` and per-tab `lazy` for tabs other modules contribute.',
      filePath: 'modules/ui/TabGroup.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useState } from 'react';

export function TabGroup({ tabs, defaultTab, label = 'Tabs', className }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? '');
  function handleKeyDown(e, index) {
    if (e.key === 'ArrowRight') setActive(tabs[(index + 1) % tabs.length].id);
    else if (e.key === 'ArrowLeft') setActive(tabs[(index - 1 + tabs.length) % tabs.length].id);
  }
  return (
    <div className={cn('w-full', className)}>
      <div role="tablist" aria-label={label} className="flex border-b border-border pb-3">
        {tabs.map((tab, i) => (
          <button key={tab.id} role="tab" id={\`tab-btn-\${tab.id}\`} aria-selected={tab.id === active} aria-controls={\`tabpanel-\${tab.id}\`} tabIndex={tab.id === active ? 0 : -1}
            onClick={() => setActive(tab.id)} onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', tab.id === active ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border')}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} id={\`tabpanel-\${tab.id}\`} role="tabpanel" aria-labelledby={\`tab-btn-\${tab.id}\`} tabIndex={0} hidden={tab.id !== active} className="py-4 focus-visible:outline-none">
          {tab.content}
        </div>
      ))}
    </div>
  );
}`,
      variants: [
        {
          title: 'Default',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <TabGroup
                label="Account settings"
                tabs={[
                  { id: 'profile', label: 'Profile', content: <p className="text-sm text-text-secondary">Profile settings content.</p> },
                  { id: 'security', label: 'Security', content: <p className="text-sm text-text-secondary">Security settings content.</p> },
                  { id: 'billing', label: 'Billing', content: <p className="text-sm text-text-secondary">Billing settings content.</p> },
                ]}
              />
            </div>
          ),
          code: `<TabGroup\n  label="Account settings"\n  tabs={[\n    { id: 'profile', label: 'Profile', content: <ProfileSettings /> },\n    { id: 'security', label: 'Security', content: <SecuritySettings /> },\n    { id: 'billing', label: 'Billing', content: <BillingSettings /> },\n  ]}\n/>`,
        },
        {
          title: 'Icons + badge + disabled',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <TabGroup
                label="Dashboard sections"
                tabs={[
                  { id: 'overview', label: 'Overview', icon: '📊', content: <p className="text-sm text-text-secondary">Overview content.</p> },
                  { id: 'analytics', label: 'Analytics', icon: '📈', badge: <Badge variant="primary" size="sm">New</Badge>, content: <p className="text-sm text-text-secondary">Analytics content.</p> },
                  { id: 'reports', label: 'Reports', icon: '📄', content: <p className="text-sm text-text-secondary">Reports content.</p> },
                  { id: 'settings', label: 'Settings', icon: '⚙', disabled: true, content: <p>Settings disabled.</p> },
                ]}
              />
            </div>
          ),
          code: `<TabGroup tabs={[\n  { id: 'overview', label: 'Overview', icon: <BarChart2 />, content: ... },\n  { id: 'analytics', label: 'Analytics', icon: <TrendingUp />, badge: <Badge>New</Badge>, content: ... },\n  { id: 'settings', label: 'Settings', disabled: true, content: ... },\n]} />`,
        },
        {
          title: 'Lazy panels',
          layout: 'stack' as const,
          preview: (() => {
            function LazyTabContent({ label, onMount }: { label: string; onMount: () => void }) {
              useEffect(() => { onMount(); }, [onMount]);
              return <p className="text-sm text-text-secondary">{label} mounted on first activation.</p>;
            }
            function LazyDemo() {
              const [log, setLog] = useState<string[]>(['Tab 1 mounted']);
              const addLog = (entry: string) => setLog((l) => l.includes(entry) ? l : [...l, entry]);
              return (
                <div className="w-full space-y-2">
                  <TabGroup
                    label="Lazy tabs"
                    lazy
                    tabs={[
                      { id: 't1', label: 'Tab 1', content: <p className="text-sm text-text-secondary">Always mounted (initial).</p> },
                      { id: 't2', label: 'Tab 2', content: <LazyTabContent label="Tab 2" onMount={() => addLog('Tab 2 mounted')} /> },
                      { id: 't3', label: 'Tab 3', content: <LazyTabContent label="Tab 3" onMount={() => addLog('Tab 3 mounted')} /> },
                    ]}
                  />
                  <p className="text-xs text-text-disabled">Mount log: {log.join(' → ')}</p>
                </div>
              );
            }
            return <LazyDemo />;
          })(),
          code: `// With lazy=true, panel content is only rendered when first activated:\n<TabGroup lazy tabs={[\n  { id: 'heavy', label: 'Heavy', content: <HeavyComponent /> },\n]} />`,
        },
        {
          title: 'Contributed tabs: isolate + order',
          layout: 'stack' as const,
          preview: <IsolatedTabsDemo />,
          code: `// Each isolated panel sits in an error boundary + Suspense: a throwing tab shows a
// "failed" placeholder with Retry (or renderError), the others keep working.
<TabGroup
  isolate
  onTabError={(tabId, error) => report(tabId, error)}
  tabs={[
    { id: 'overview', label: 'Overview', content: <Overview /> },             // host: order 0
    { id: 'tasks', label: 'Tasks', order: 10, lazy: true, content: <Tasks /> },
    { id: 'calls', label: 'Calls', order: 20, lazy: true, content: <CallLog /> },
  ]}
/>`,
        },
      ],
    },
    {
      id: 'breadcrumb',
      title: 'Breadcrumb',
      category: 'Organism',
      abbr: 'Bc',
      description: 'Hierarchical navigation trail wrapped in a nav landmark (ariaLabel, default "Breadcrumb"). Last item marked with aria-current="page" and aria-hidden separators. renderLink renders linked items through a router Link for client-side navigation. Items take an icon, a chip (pill) style and a status tone dot; `leading` puts a node (a page-menu button) first, never collapsed by maxItems.',
      filePath: 'modules/ui/Breadcrumb.tsx',
      sourceCode: `import { cn } from '@/libs/utils/cn';

export function Breadcrumb({ items, className, renderLink, ariaLabel = 'Breadcrumb' }) {
  const linkClass = 'text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded';
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {!isLast && item.href ? (
                <>{renderLink ? renderLink({ ...item, href: item.href }, linkClass) : <a href={item.href} className={linkClass}>{item.label}</a>}<span aria-hidden="true" className="text-text-disabled">›</span></>
              ) : (
                <span className={isLast ? 'text-text-primary font-medium' : 'text-text-secondary'} aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}`,
      variants: [
        {
          title: 'Default',
          preview: (
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Components', href: '/components' }, { label: 'Breadcrumb' }]} />
          ),
          code: `<Breadcrumb items={[\n  { label: 'Home', href: '/' },\n  { label: 'Components', href: '/components' },\n  { label: 'Breadcrumb' },\n]} />`,
        },
        {
          title: 'Long path',
          preview: (
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Users', href: '/users' }, { label: 'Settings', href: '/users/settings' }, { label: 'Permissions' }]} />
          ),
          code: `<Breadcrumb items={[\n  { label: 'Dashboard', href: '/' },\n  { label: 'Users', href: '/users' },\n  { label: 'Settings', href: '/users/settings' },\n  { label: 'Permissions' },\n]} />`,
        },
        {
          title: 'Custom separator',
          preview: (
            <Breadcrumb
              items={[{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog' }, { label: 'Post title' }]}
              separator={<span aria-hidden="true" className="text-text-disabled">/</span>}
            />
          ),
          code: `<Breadcrumb items={[...]} separator={<span>/</span>} />`,
        },
        {
          title: 'Overflow / ellipsis',
          preview: (
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Products', href: '/products' },
                { label: 'Electronics', href: '/products/electronics' },
                { label: 'Computers', href: '/products/electronics/computers' },
                { label: 'Laptops', href: '/products/electronics/computers/laptops' },
                { label: 'MacBook Pro 16"' },
              ]}
              maxItems={3}
            />
          ),
          code: `<Breadcrumb items={[/* 6 items */]} maxItems={3} />`,
        },
        {
          title: 'Router link',
          preview: (
            <Breadcrumb
              ariaLabel="Page trail"
              items={[{ label: 'Home', href: '/' }, { label: 'Reports', href: '/reports' }, { label: 'Q3' }]}
              renderLink={(item, className) => (
                <a href={item.href} className={className} onClick={(e) => e.preventDefault()}>{item.label}</a>
              )}
            />
          ),
          code: `import Link from 'next/link';\n\n<Breadcrumb\n  ariaLabel="Page trail"\n  items={[...]}\n  renderLink={(item, className) => (\n    <Link href={item.href} className={className}>{item.label}</Link>\n  )}\n/>`,
        },
        {
          title: 'Page path: leading menu, chips, tones',
          preview: (
            <Breadcrumb
              ariaLabel="Board pages"
              leading={
                <DropdownMenu
                  trigger={<Button variant="ghost" size="xs">Pages ▾</Button>}
                  items={[{ label: 'Overview', selected: true }, { label: 'Energy' }, { label: 'Line 1' }]}
                />
              }
              items={[
                { label: 'Overview', href: '#overview', chip: true },
                { label: 'Line 1', href: '#line-1', chip: true, tone: 'success' },
                { label: 'Pump room', chip: true, tone: 'warning' },
              ]}
            />
          ),
          code: `<Breadcrumb\n  ariaLabel="Board pages"\n  leading={<DropdownMenu trigger={<Button variant="ghost" size="xs">Pages ▾</Button>} items={pages} />}\n  items={[\n    { label: 'Overview', href: '/b/overview', chip: true },\n    { label: 'Line 1', href: '/b/line-1', chip: true, tone: 'success' },\n    { label: 'Pump room', chip: true, tone: 'warning' },\n  ]}\n/>`,
        },
      ],
    },
    {
      id: 'stepper',
      title: 'Stepper',
      category: 'Organism',
      abbr: 'St',
      description: 'Multi-step progress indicator with complete, active, warning, error, and pending states. Supports horizontal and vertical orientations.',
      filePath: 'modules/ui/Stepper.tsx',
      sourceCode: `import { cn } from '@/libs/utils/cn';\n\nexport function Stepper({ steps, orientation = 'horizontal' }) {\n  // renders step circles with connectors, supports complete/active/warning/error/pending states\n}`,
      variants: [
        {
          title: 'Horizontal',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <Stepper steps={[
                { label: 'Account', description: 'Personal info', state: 'complete' },
                { label: 'Billing', description: 'Payment method', state: 'active' },
                { label: 'Review', state: 'pending' },
                { label: 'Confirm', state: 'pending' },
              ]} />
            </div>
          ),
          code: `<Stepper steps={[\n  { label: 'Account', state: 'complete' },\n  { label: 'Billing', state: 'active' },\n  { label: 'Review', state: 'pending' },\n  { label: 'Confirm', state: 'pending' },\n]} />`,
        },
        {
          title: 'Vertical',
          layout: 'stack' as const,
          preview: (
            <Stepper orientation="vertical" steps={[
              { label: 'Create account', description: 'Enter your email and password', state: 'complete' },
              { label: 'Verify email', description: 'Check your inbox', state: 'error' },
              { label: 'Set up profile', state: 'pending' },
            ]} />
          ),
          code: `<Stepper orientation="vertical" steps={[\n  { label: 'Create account', state: 'complete' },\n  { label: 'Verify email', state: 'error' },\n  { label: 'Set up profile', state: 'pending' },\n]} />`,
        },
        {
          title: 'Steps that ran with a warning',
          layout: 'stack' as const,
          preview: (
            <Stepper orientation="vertical" steps={[
              { label: 'Hazard against the ground', description: '18 ha under water at 103.6 m', state: 'complete' },
              { label: 'Buildings reached', description: '10 of 22 buildings, 4,898 people to relocate', state: 'complete' },
              { label: 'Path analysis', description: 'First responders on site in 0.8 min', state: 'complete' },
              { label: 'Shelter allocation', description: '69 % housed on site; the rest to shelters off the site', state: 'warning' },
            ]} />
          ),
          code: `<Stepper orientation="vertical" steps={[\n  { label: 'Path analysis', state: 'complete' },\n  { label: 'Shelter allocation', description: '69 % housed on site', state: 'warning' },\n]} />`,
        },
      ],
    },
    {
      id: 'tree-view',
      title: 'TreeView',
      category: 'Organism',
      abbr: 'Tv',
      description: 'Collapsible tree with keyboard navigation, selection, and aria-tree roles.',
      filePath: 'modules/ui/TreeView/index.tsx',
      sourceCode: `'use client';\nimport { useTreeState } from './hooks/useTreeState';\nimport { useKeyboardNav } from './hooks/useKeyboardNav';\nimport { TreeNodeRow } from './parts/Node';\n\nexport function TreeView({ nodes, selectedId, selectedIds, onSelect, onSelectionChange, selectionMode = 'single', ... }) {\n  // M1: expand all / collapse all, single + multi (Cmd/Shift-click) selection,\n  //      arrow keys, Home/End, type-ahead jump, Space toggle, Enter activate.\n  // M2-M5: drag-drop, lazy load, virtualize, context menu, full ARIA polish.\n}`,
      variants: [
        {
          title: 'File tree',
          preview: <TreeViewDemo />,
          code: `function Demo() {\n  const [sel, setSel] = useState();\n  return (\n    <TreeView selectedId={sel} onSelect={setSel} label="Files"\n      nodes={[\n        { id: 'src', label: 'src', children: [\n          { id: 'Button', label: 'Button.tsx' },\n        ]},\n      ]}\n    />\n  );\n}`,
        },
        {
          title: 'Navigation menu',
          preview: <TreeViewNavDemo />,
          code: `function Demo() {\n  const [sel, setSel] = useState();\n  return (\n    <TreeView label="Settings navigation" selectedId={sel} onSelect={setSel}\n      nodes={[\n        { id: 'account', label: 'Account', children: [\n          { id: 'profile', label: 'Profile' },\n          { id: 'password', label: 'Password' },\n        ]},\n        { id: 'workspace', label: 'Workspace', children: [\n          { id: 'general', label: 'General' },\n          { id: 'billing', label: 'Billing' },\n        ]},\n        { id: 'integrations', label: 'Integrations' },\n      ]}\n    />\n  );\n}`,
        },
        {
          title: 'Flat list',
          preview: <TreeViewFlatDemo />,
          code: `function Demo() {\n  const [sel, setSel] = useState('ts');\n  return (\n    <TreeView label="Language selector" selectedId={sel} onSelect={setSel}\n      nodes={[\n        { id: 'ts', label: 'TypeScript' },\n        { id: 'js', label: 'JavaScript' },\n        { id: 'py', label: 'Python' },\n        { id: 'go', label: 'Go' },\n      ]}\n    />\n  );\n}`,
        },
        {
          title: 'Multi-select + type-ahead',
          preview: <TreeViewMultiSelectDemo />,
          code: `function Demo() {\n  const [ids, setIds] = useState<string[]>(['Card']);\n  return (\n    <TreeView\n      label="Project files"\n      selectionMode="multi"\n      selectedIds={ids}\n      onSelectionChange={setIds}\n      nodes={[\n        { id: 'docs', label: 'Documents', children: [\n          { id: 'spec', label: 'spec.md' },\n          { id: 'roadmap', label: 'roadmap.md' },\n        ]},\n        { id: 'src', label: 'src', children: [\n          { id: 'Button', label: 'Button.tsx' },\n          { id: 'Card', label: 'Card.tsx' },\n          { id: 'Drawer', label: 'Drawer.tsx' },\n          { id: 'TreeView', label: 'TreeView.tsx' },\n        ]},\n      ]}\n    />\n  );\n}\n\n// Try it:\n//  - Cmd/Ctrl-click       → toggle individual rows\n//  - Shift-click          → range-select between anchor and clicked row\n//  - Type "tre"           → focus jumps to "TreeView.tsx"\n//  - Cmd/Ctrl+A           → select all visible rows\n//  - Arrow keys / Home/End / Space / Enter — full keyboard nav.`,
        },
      ],
    },

    {
      id: 'tab-button',
      title: 'TabButton',
      category: 'Organism',
      abbr: 'TB',
      description: 'Pill-style tab button with active/inactive coloring and an optional count badge.',
      filePath: 'modules/ui/TabButton.tsx',
      sourceCode: `import { TabButton } from '@/modules/ui/TabButton';

<TabButton active={tab === 'all'}    onClick={() => setTab('all')}    count={42}>All</TabButton>
<TabButton active={tab === 'active'} onClick={() => setTab('active')} count={18}>Active</TabButton>`,
      variants: [
        {
          title: 'Interactive',
          layout: 'stack' as const,
          preview: <TabButtonDemo />,
          code: `const [tab, setTab] = useState('all');

<TabButton active={tab === 'all'}      onClick={() => setTab('all')}      count={42}>All</TabButton>
<TabButton active={tab === 'active'}   onClick={() => setTab('active')}   count={18}>Active</TabButton>
<TabButton active={tab === 'archived'} onClick={() => setTab('archived')} count={24}>Archived</TabButton>`,
        },
        {
          title: 'Without count',
          layout: 'stack' as const,
          preview: (
            <div className="flex items-center gap-1">
              <TabButton active onClick={() => {}}>Selected</TabButton>
              <TabButton active={false} onClick={() => {}}>Default</TabButton>
            </div>
          ),
          code: `<TabButton active onClick={...}>Selected</TabButton>
<TabButton active={false} onClick={...}>Default</TabButton>`,
        },
      ],
    },

    {
      id: 'view-toggle',
      title: 'ViewToggle',
      category: 'Organism',
      abbr: 'VT',
      description: 'Horizontal / vertical view toggle control; two-state icon selector. Emits a viewtoggle:change CustomEvent.',
      filePath: 'modules/ui/ViewToggle.tsx',
      sourceCode: `import { ViewToggle, type ViewOrientation } from '@/modules/ui/ViewToggle';

const [view, setView] = useState<ViewOrientation>('horizontal');

<ViewToggle value={view} onChange={setView} />

// With custom labels
<ViewToggle
  value={view}
  onChange={setView}
  labels={{ horizontal: 'Yatay', vertical: 'Dikey' }}
  ariaLabel="Görünüm seçenekleri"
/>`,
      variants: [
        {
          title: 'Default (EN labels)',
          layout: 'stack' as const,
          preview: <ViewToggleDemo />,
          code: `<ViewToggle value={view} onChange={setView} />`,
        },
        {
          title: 'Custom labels',
          layout: 'stack' as const,
          preview: <ViewToggleCustomDemo />,
          code: `<ViewToggle value={view} onChange={setView} labels={{ horizontal: 'Yatay', vertical: 'Dikey' }} />`,
        },
      ],
    },
  ];
}
