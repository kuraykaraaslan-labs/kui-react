'use client';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { Drawer } from '@/modules/ui/Drawer';
import { Tooltip } from '@/modules/ui/Tooltip';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { Popover } from '@/modules/ui/Popover';
import { Badge } from '@/modules/ui/Badge';
import { useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm action"
        description="Are you sure you want to proceed? This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This will permanently delete all selected items and their associated data.
        </p>
      </Modal>
    </div>
  );
}

function DrawerDemo({ side }: { side?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Open {side === 'left' ? 'Left' : 'Right'} Drawer</Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Settings"
        side={side}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Save</Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">Drawer content goes here.</p>
      </Drawer>
    </div>
  );
}

function DrawerRouteAwareDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Open Route-Aware Drawer</Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Route-aware drawer"
        side="right"
        closeOnRouteChange
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            The <code className="font-mono text-xs">closeOnRouteChange</code> prop is accepted in M1
            and reserved for the M6 router-events integration. For now it is a no-op stub so the
            public API stays stable across milestones.
          </p>
          <p>Body scroll is locked while this drawer is open (try scrolling the page behind it).</p>
        </div>
      </Drawer>
    </div>
  );
}

function ModalScrollableDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Scrollable Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Long Content" scrollable
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>OK</Button></>}
      >
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i} className="text-sm text-text-secondary">Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function ModalFullscreenDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="ghost" onClick={() => setOpen(true)}>Fullscreen Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Fullscreen Dialog" fullscreen
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <p className="text-sm text-text-secondary">This modal takes the full viewport.</p>
      </Modal>
    </div>
  );
}

function ModalSizesDemo() {
  const [size, setSize] = useState<'sm' | 'md' | 'lg' | null>(null);
  return (
    <div className="flex gap-2 flex-wrap">
      {(['sm', 'md', 'lg'] as const).map((s) => (
        <Button key={s} variant="outline" size="sm" onClick={() => setSize(s)}>Open {s.toUpperCase()}</Button>
      ))}
      {size && (
        <Modal open onClose={() => setSize(null)} title={`Modal — ${size.toUpperCase()}`} size={size}
          description="This demo shows the three available size variants."
          footer={<Button variant="primary" onClick={() => setSize(null)}>Close</Button>}>
          <p className="text-sm text-text-secondary">Max-width: {size === 'sm' ? '384px' : size === 'md' ? '448px' : '512px'}.</p>
        </Modal>
      )}
    </div>
  );
}

function ModalNestedDemo() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOuterOpen(true)}>Open Outer Modal</Button>
      <Modal
        open={outerOpen}
        onClose={() => setOuterOpen(false)}
        title="Outer dialog"
        description="Escape closes only the topmost overlay — try opening the nested one."
        footer={<Button onClick={() => setOuterOpen(false)}>Close outer</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Layered focus trap demo: pressing Escape with the nested modal open only
            dismisses the nested one, leaving this outer modal intact.
          </p>
          <Button variant="primary" onClick={() => setInnerOpen(true)}>Open Nested Modal</Button>
        </div>
      </Modal>
      <Modal
        open={innerOpen}
        onClose={() => setInnerOpen(false)}
        title="Nested dialog"
        size="sm"
        footer={<Button onClick={() => setInnerOpen(false)}>Close nested</Button>}
      >
        <p className="text-sm text-text-secondary">
          This nested modal owns the top focus layer. Tab cycles only within this panel.
        </p>
      </Modal>
    </div>
  );
}

function PopoverDemo() {
  return (
    <Popover
      trigger={<Button variant="outline">Open Popover</Button>}
      placement="bottom"
    >
      <div className="p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Popover title</p>
        <p className="text-xs text-text-secondary">Contextual content appears here.</p>
        <Button size="sm" variant="ghost" className="w-full">Action</Button>
      </div>
    </Popover>
  );
}

function PopoverFocusTrapDemo() {
  return (
    <Popover
      trigger={<Button variant="outline">Focus-trapped Popover</Button>}
      placement="bottom"
      focusTrap
    >
      <form
        className="p-4 space-y-3 w-64"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="text-sm font-semibold text-text-primary">Quick edit</p>
        <input
          type="text"
          placeholder="Title"
          className="w-full rounded-md border border-border bg-surface-base px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        <input
          type="text"
          placeholder="Tag"
          className="w-full rounded-md border border-border bg-surface-base px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm">Cancel</Button>
          <Button type="submit" variant="primary" size="sm">Save</Button>
        </div>
      </form>
    </Popover>
  );
}

export function buildOverlayData(): ShowcaseComponent[] {
  return [
    {
      id: 'modal',
      title: 'Modal',
      category: 'Organism',
      abbr: 'Md',
      description: 'Focus-trapped dialog. Closes on Escape and backdrop click. Requires role="dialog" + aria-modal + aria-labelledby; supports sm/md/lg/xl/full sizes (full = viewport width less the gutter; fullscreen fills the viewport). An Escape an inner control already handled (an open ComboBox / Select list) closes that control, not the dialog. Uses the shared Overlays focus-trap, scroll-lock and presence hooks; nested modals are layer-aware so Escape only dismisses the topmost panel.',
      filePath: 'modules/ui/Overlays/Modal/index.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef } from 'react';

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const panelRef = useRef(null);
  useEffect(() => { if (!open) return; const prev = document.activeElement; panelRef.current?.focus(); return () => prev?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const onKey = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open, onClose]);
  if (!open) return null;
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} className={cn('relative z-10 w-full rounded-xl border border-border bg-surface-raised shadow-xl flex flex-col focus-visible:outline-none', sizeClass, className)}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border">
          <h2 id="modal-title" className="text-base font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded">✕</button>
        </div>
        {children && <div className="px-6 py-4 flex-1">{children}</div>}
        {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}`,
      variants: [
        {
          title: 'Confirmation dialog',
          preview: <ModalDemo />,
          code: `const [open, setOpen] = useState(false);\n<Button variant="primary" onClick={() => setOpen(true)}>Open Modal</Button>\n<Modal open={open} onClose={() => setOpen(false)} title="Confirm action"\n  description="Are you sure you want to proceed?"\n  footer={<><Button variant="outline">Cancel</Button><Button variant="danger">Delete</Button></>}>\n  <p>This will permanently delete all selected items.</p>\n</Modal>`,
        },
        {
          title: 'Sizes (sm / md / lg)',
          preview: <ModalSizesDemo />,
          code: `<Modal open={open} onClose={onClose} title="Small" size="sm">...</Modal>\n<Modal open={open} onClose={onClose} title="Medium" size="md">...</Modal>\n<Modal open={open} onClose={onClose} title="Large" size="lg">...</Modal>`,
        },
        {
          title: 'Scrollable body',
          preview: <ModalScrollableDemo />,
          code: `<Modal open={open} onClose={onClose} title="Long Content" scrollable\n  footer={<Button>OK</Button>}>\n  {/* long content scrolls inside */}\n</Modal>`,
        },
        {
          title: 'Fullscreen',
          preview: <ModalFullscreenDemo />,
          code: `<Modal open={open} onClose={onClose} title="Fullscreen Dialog" fullscreen>...</Modal>`,
        },
        {
          title: 'Nested modals (layer-aware Escape)',
          preview: <ModalNestedDemo />,
          code: `// Opens a second modal on top — Escape only dismisses the inner one.\nconst [outer, setOuter] = useState(false);\nconst [inner, setInner] = useState(false);\n<Modal open={outer} onClose={() => setOuter(false)} title="Outer">\n  <Button onClick={() => setInner(true)}>Open Nested</Button>\n</Modal>\n<Modal open={inner} onClose={() => setInner(false)} title="Nested" size="sm">\n  ...\n</Modal>`,
        },
      ],
    },
    {
      id: 'drawer',
      title: 'Drawer',
      category: 'Organism',
      abbr: 'Dr',
      description: 'Side panel sliding in from the screen edge. Left / right placement with focus management and Escape close. Body scroll is locked while open via the shared Overlays useScrollLock hook (iOS rubber-band safe). Accepts closeOnRouteChange (M6 stub).',
      filePath: 'modules/ui/Overlays/Drawer/index.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef } from 'react';

export function Drawer({ open, onClose, title, side = 'right', children, footer, className }) {
  // focus trap + Escape key handler
  return (
    <div className={cn('fixed inset-0 z-50 flex', !open && 'pointer-events-none')} aria-modal="true" role="dialog" aria-label={title}>
      <div className={cn('absolute inset-0 bg-black/50 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} aria-hidden="true" />
      <div className={cn('relative flex flex-col w-80 max-w-full h-full bg-surface-raised shadow-xl transition-transform duration-200 focus-visible:outline-none', side === 'right' ? 'ml-auto border-l border-border' : 'mr-auto border-r border-border', open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full', className)}>
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close drawer" className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="px-4 py-4 border-t border-border shrink-0 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}`,
      variants: [
        {
          title: 'Right drawer',
          preview: <DrawerDemo side="right" />,
          code: `const [open, setOpen] = useState(false);\n<Button variant="outline" onClick={() => setOpen(true)}>Open Drawer</Button>\n<Drawer open={open} onClose={() => setOpen(false)} title="Settings" side="right"\n  footer={<><Button variant="outline">Cancel</Button><Button variant="primary">Save</Button></>}>\n  <p>Drawer content goes here.</p>\n</Drawer>`,
        },
        {
          title: 'Left drawer',
          preview: <DrawerDemo side="left" />,
          code: `<Drawer open={open} onClose={() => setOpen(false)} title="Navigation" side="left">...</Drawer>`,
        },
        {
          title: 'Route-aware close (M6 stub)',
          preview: <DrawerRouteAwareDemo />,
          code: `// closeOnRouteChange is accepted in M1 and reserved for M6 router-events integration.\n<Drawer\n  open={open}\n  onClose={() => setOpen(false)}\n  title="Route-aware drawer"\n  side="right"\n  closeOnRouteChange\n>\n  ...\n</Drawer>`,
        },
      ],
    },
    {
      id: 'tooltip',
      title: 'Tooltip',
      category: 'Organism',
      abbr: 'Tt',
      description: 'Short hint shown on hover and focus. Accessible via role="tooltip" + aria-describedby. Supports 4 placements, 3 themes, optional arrow, and configurable delay.',
      filePath: 'modules/ui/Tooltip.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useRef, useState } from 'react';

export function Tooltip({ content, placement = 'top', children, className }) {
  const [visible, setVisible] = useState(false);
  const id = useRef(\`tooltip-\${Math.random().toString(36).slice(2)}\`).current;
  const placementClass = { top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5', bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5', left: 'right-full top-1/2 -translate-y-1/2 mr-1.5', right: 'left-full top-1/2 -translate-y-1/2 ml-1.5' }[placement];
  return (
    <span className={cn('relative inline-flex items-center', className)} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}>
      <span aria-describedby={id}>{children}</span>
      <span id={id} role="tooltip" className={cn('absolute z-50 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium shadow-md bg-surface-overlay text-text-primary border border-border transition-opacity duration-150 pointer-events-none', placementClass, visible ? 'opacity-100' : 'opacity-0')}>{content}</span>
    </span>
  );
}`,
      playground: {
        controls: [
          { key: 'content',   label: 'Content',   type: 'text',   default: 'Helpful tooltip text' },
          { key: 'placement', label: 'Placement', type: 'select', options: ['top', 'bottom', 'left', 'right'] as const, default: 'top' },
          { key: 'theme',     label: 'Theme',     type: 'select', options: ['default', 'dark', 'light'] as const, default: 'default' },
          { key: 'arrow',     label: 'Arrow',     type: 'boolean', default: false },
        ],
        render: (p) => (
          <Tooltip
            content={p.content as string}
            placement={p.placement as React.ComponentProps<typeof Tooltip>['placement']}
            theme={p.theme as React.ComponentProps<typeof Tooltip>['theme']}
            arrow={p.arrow as boolean}
          >
            <Button variant="outline" size="sm">Hover me</Button>
          </Tooltip>
        ),
        generateCode: (p) => {
          const attrs: string[] = [`content="${p.content}"`];
          if (p.placement !== 'top')    attrs.push(`placement="${p.placement}"`);
          if (p.theme !== 'default')    attrs.push(`theme="${p.theme}"`);
          if (p.arrow)                  attrs.push('arrow');
          return `<Tooltip ${attrs.join(' ')}>\n  <Button variant="outline">Hover me</Button>\n</Tooltip>`;
        },
      },
      variants: [
        {
          title: 'Placements',
          preview: (
            <div className="flex flex-wrap items-center justify-center gap-6 py-4">
              {(['top','bottom','left','right'] as const).map((p) => (
                <Tooltip key={p} content={`Tooltip ${p}`} placement={p}>
                  <Button variant="outline" size="sm">{p.charAt(0).toUpperCase() + p.slice(1)}</Button>
                </Tooltip>
              ))}
            </div>
          ),
          code: `<Tooltip content="Help text" placement="top">\n  <Button variant="outline" size="sm">Hover me</Button>\n</Tooltip>`,
        },
        {
          title: 'Themes',
          preview: (
            <div className="flex flex-wrap items-center justify-center gap-4 py-4">
              <Tooltip content="Default theme" theme="default">
                <Button variant="outline" size="sm">Default</Button>
              </Tooltip>
              <Tooltip content="Dark theme" theme="dark">
                <Button variant="outline" size="sm">Dark</Button>
              </Tooltip>
              <Tooltip content="Light theme" theme="light">
                <Button variant="outline" size="sm">Light</Button>
              </Tooltip>
            </div>
          ),
          code: `<Tooltip content="Dark theme" theme="dark"><Button>Dark</Button></Tooltip>`,
        },
        {
          title: 'Arrow + Delay',
          preview: (
            <div className="flex flex-wrap items-center justify-center gap-4 py-4">
              <Tooltip content="With arrow" arrow placement="top">
                <Button variant="outline" size="sm">Arrow</Button>
              </Tooltip>
              <Tooltip content="500ms delay" delay={500} placement="bottom">
                <Button variant="outline" size="sm">Delayed</Button>
              </Tooltip>
              <Tooltip content="Arrow + dark + delay" arrow theme="dark" delay={300} placement="right">
                <Button variant="outline" size="sm">Combined</Button>
              </Tooltip>
            </div>
          ),
          code: `<Tooltip content="With arrow" arrow placement="top">\n  <Button>Arrow</Button>\n</Tooltip>\n<Tooltip content="500ms delay" delay={500}>\n  <Button>Delayed</Button>\n</Tooltip>`,
        },
      ],
    },
    {
      id: 'dropdown-menu',
      title: 'DropdownMenu',
      category: 'Organism',
      abbr: 'Dm',
      description: 'Accessible dropdown using role="menu" + role="menuitem". Closes on Escape and outside click. Supports left/right alignment, icons, separators, danger and disabled items, and arrow-key navigation. Items take an optional id, href, group, order, hidden and disabledReason so other modules can contribute entries; `portal` escapes clipping parents. Page-menu extras: heading entries (or `groupLabels` per group), `selected` and `trailing` items, a `search` box once the list is long, a `footer`, `menuClassName`, and controlled `open` / `onOpenChange`.',
      filePath: 'modules/ui/DropdownMenu.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef, useState } from 'react';

export function DropdownMenu({ trigger, items, align = 'left', className }) {
  const [open, setOpen] = useState(false);
  // outside click + Escape handlers
  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((p) => !p)} aria-haspopup="menu" aria-expanded={open}>{trigger}</div>
      {open && (
        <div role="menu" className={cn('absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-surface-raised shadow-lg py-1', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((item, i) => item.type === 'separator' ? <div key={i} role="separator" className="my-1 border-t border-border" /> : (
            <button key={i} role="menuitem" type="button" disabled={item.disabled} onClick={() => { item.onClick?.(); setOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:bg-surface-overlay', item.danger ? 'text-error hover:bg-error-subtle' : 'text-text-primary hover:bg-surface-overlay', item.disabled && 'opacity-50 cursor-not-allowed')}>
              {item.icon && <span aria-hidden="true">{item.icon}</span>}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}`,
      variants: [
        {
          title: 'Default',
          preview: (
            <DropdownMenu
              trigger={<Button variant="outline" size="sm">Actions ▾</Button>}
              items={[
                { label: 'Edit', icon: '✏' },
                { label: 'Duplicate', icon: '⧉' },
                { type: 'separator' },
                { label: 'Delete', icon: '🗑', danger: true },
              ]}
            />
          ),
          code: `<DropdownMenu\n  trigger={<Button variant="outline" size="sm">Actions ▾</Button>}\n  items={[\n    { label: 'Edit', icon: '✏' },\n    { label: 'Duplicate', icon: '⧉' },\n    { type: 'separator' },\n    { label: 'Delete', icon: '🗑', danger: true },\n  ]}\n/>`,
        },
        {
          title: 'Right-aligned',
          preview: (
            <div className="flex justify-end w-full max-w-xs">
              <DropdownMenu
                align="right"
                trigger={<Button variant="ghost" size="sm">⋮</Button>}
                items={[
                  { label: 'View details' },
                  { label: 'Export', icon: '↗' },
                  { label: 'Archive', disabled: true },
                  { type: 'separator' },
                  { label: 'Remove', danger: true },
                ]}
              />
            </div>
          ),
          code: `<DropdownMenu align="right"\n  trigger={<Button variant="ghost" size="sm">⋮</Button>}\n  items={[{ label: 'View details' }, { label: 'Remove', danger: true }]}\n/>`,
        },
        {
          title: 'Contributed items: group, order, hidden, href, disabledReason',
          preview: (
            <DropdownMenu
              trigger={<Button variant="outline" size="sm">Contact ▾</Button>}
              items={[
                { id: 'delete', label: 'Delete', group: 'danger', order: 1000, danger: true },
                { id: 'edit', label: 'Edit', group: 'record', order: 10 },
                { id: 'call', label: 'Call', group: 'contact', order: 20, href: '#call' },
                { id: 'sign', label: 'Send for signature', group: 'contact', order: 30, disabled: true, disabledReason: 'Add an email address first' },
                { id: 'campaign', label: 'Add to campaign', group: 'contact', order: 40, hidden: true },
              ]}
            />
          ),
          code: `// Items sort by group (ranked by their lowest order) and order; a separator splits groups.
<DropdownMenu
  trigger={<Button variant="outline" size="sm">Contact ▾</Button>}
  items={[
    { id: 'edit', label: 'Edit', group: 'record', order: 10 },
    { id: 'call', label: 'Call', group: 'contact', order: 20, href: '/calls/new?to=…' },
    { id: 'sign', label: 'Send for signature', group: 'contact', order: 30, disabled: true, disabledReason: 'Add an email address first' },
    { id: 'campaign', label: 'Add to campaign', group: 'contact', order: 40, hidden: !canMarket },
    { id: 'delete', label: 'Delete', group: 'danger', order: 1000, danger: true },
  ]}
/>
// Merge contributed items into a base list (same id replaces in place):
const items = mergeMenuItems(baseItems, contributedItems);`,
        },
        {
          title: 'Page menu: group headings, selected, trailing, search, footer',
          preview: (
            <DropdownMenu
              trigger={<Button variant="outline" size="sm">Pages ▾</Button>}
              menuClassName="w-72"
              groupLabels={{ pages: 'Pages', drill: 'Drill-downs' }}
              search={{ placeholder: 'Find a page', emptyText: 'No page matches' }}
              footer={<a href="#pages" className="block px-3 py-2 text-sm text-primary hover:bg-surface-overlay">Manage pages</a>}
              items={[
                { id: 'overview', label: 'Overview', group: 'pages', selected: true, trailing: <Badge variant="neutral" size="sm">Home</Badge> },
                { id: 'energy', label: 'Energy', group: 'pages' },
                { id: 'water', label: 'Water', group: 'pages' },
                { id: 'alarms', label: 'Alarms', group: 'pages', trailing: <Badge variant="error" size="sm">3</Badge> },
                { id: 'line-1', label: 'Line 1', group: 'drill' },
                { id: 'line-2', label: 'Line 2', group: 'drill' },
                { id: 'pump', label: 'Pump room', group: 'drill' },
                { id: 'boiler', label: 'Boiler', group: 'drill' },
              ]}
            />
          ),
          code: `// Headings come from groupLabels; the search box shows from 8 entries (search.minItems).
// Arrow keys, Home and End move between items; Enter in the box picks the first match.
const [open, setOpen] = useState(false); // optional: controlled, e.g. for a keyboard shortcut
<DropdownMenu
  open={open}
  onOpenChange={setOpen}
  trigger={<Button variant="outline" size="sm">Pages ▾</Button>}
  menuClassName="w-72"
  groupLabels={{ pages: 'Pages', drill: 'Drill-downs' }}
  search={{ placeholder: 'Find a page', emptyText: 'No page matches' }}
  footer={<a href="/pages">Manage pages</a>}
  items={[
    { id: 'overview', label: 'Overview', group: 'pages', selected: true, trailing: <Badge size="sm">Home</Badge> },
    { id: 'energy', label: 'Energy', group: 'pages' },
    { id: 'line-1', label: 'Line 1', group: 'drill' },
    // … or plain lists with { type: 'heading', label: 'Pages' } entries
  ]}
/>`,
        },
      ],
    },
    {
      id: 'popover',
      title: 'Popover',
      category: 'Organism',
      abbr: 'Po',
      description: 'Anchor-based contextual panel. Closes on outside click (capture-phase pointerdown) and Escape, layered with sibling overlays. Supports top/bottom/left/right placement. Built-in focus trap (focusTrap prop) keeps Tab cycling inside the panel. `shrinkTrigger` caps the trigger wrapper at its container\'s width, so a `max-w-full` / `truncate` trigger shrinks instead of overflowing.',
      filePath: 'modules/ui/Overlays/Popover/index.tsx',
      sourceCode: `'use client';\nimport { cn } from '@/libs/utils/cn';\nimport { useEffect, useRef, useState } from 'react';\n\nexport function Popover({ trigger, children, placement = 'bottom' }) {\n  // manages open state, outside-click + Escape close, focus management\n}`,
      variants: [
        {
          title: 'Bottom (default)',
          preview: <PopoverDemo />,
          code: `<Popover trigger={<Button variant="outline">Open</Button>} placement="bottom">\n  <div className="p-4">\n    <p className="text-sm font-semibold">Title</p>\n    <p className="text-xs text-text-secondary">Content goes here.</p>\n  </div>\n</Popover>`,
        },
        {
          title: 'Placements',
          layout: 'stack' as const,
          preview: (
            <div className="flex flex-wrap gap-3 items-center justify-center py-8">
              {(['top', 'bottom', 'left', 'right'] as const).map((p) => (
                <Popover key={p} placement={p} trigger={<Button variant="outline" size="sm">{p}</Button>}>
                  <div className="p-3 text-xs text-text-secondary">Popover on {p}</div>
                </Popover>
              ))}
            </div>
          ),
          code: `<Popover placement="top" trigger={<Button>Top</Button>}><div>...</div></Popover>\n<Popover placement="right" trigger={<Button>Right</Button>}><div>...</div></Popover>`,
        },
        {
          title: 'Focus trap inside Popover',
          preview: <PopoverFocusTrapDemo />,
          code: `<Popover focusTrap placement="bottom" trigger={<Button>Quick edit</Button>}>\n  <form onSubmit={(e) => e.preventDefault()} className="p-4 space-y-3 w-64">\n    <input type="text" placeholder="Title" />\n    <input type="text" placeholder="Tag" />\n    <Button type="submit">Save</Button>\n  </form>\n</Popover>`,
        },
      ],
    },
  ];
}
