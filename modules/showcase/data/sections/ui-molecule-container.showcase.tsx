'use client';

import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { Card } from '@/modules/ui/Card';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Slider } from '@/modules/ui/Slider';
import { StatCard } from '@/modules/ui/StatCard';
import type { ShowcaseComponent } from '../showcase.types';

function SliderDemo() {
  const slides = [
    <div key="a" className="h-40 bg-primary-subtle flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-primary">Slide 1</span></div>,
    <div key="b" className="h-40 bg-success-subtle flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-success-fg">Slide 2</span></div>,
    <div key="c" className="h-40 bg-warning-subtle flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-warning">Slide 3</span></div>,
  ];
  return <Slider slides={slides} />;
}

function SliderAutoPlayDemo() {
  const slides = [
    <div key="a" className="h-36 bg-primary flex items-center justify-center rounded-xl"><span className="text-base font-semibold text-white">Auto A</span></div>,
    <div key="b" className="h-36 bg-secondary flex items-center justify-center rounded-xl"><span className="text-base font-semibold text-white">Auto B</span></div>,
    <div key="c" className="h-36 bg-error flex items-center justify-center rounded-xl"><span className="text-base font-semibold text-white">Auto C</span></div>,
  ];
  return <Slider slides={slides} autoPlay autoPlayInterval={2000} />;
}

function SliderSwipeDemo() {
  // M1 — touch/mouse/pen swipe with velocity momentum.
  //
  // A drag past `dragThreshold` (default 50 px) advances exactly one slide,
  // but a *fast flick* (release velocity > 0.5 px/ms) carries through extra
  // slides — every additional 0.5 px/ms of velocity adds one more slide
  // of travel in the flick direction.
  //
  // When `loop={false}` and the gesture pulls past the first/last slide the
  // track rubber-bands (×0.4 dampening) but never escapes its bounds.
  const slides = [
    <div key="a" className="h-40 bg-gradient-to-br from-primary to-secondary flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-white">Swipe me</span></div>,
    <div key="b" className="h-40 bg-gradient-to-br from-success to-info flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-white">Flick fast</span></div>,
    <div key="c" className="h-40 bg-gradient-to-br from-warning to-error flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-white">Multi-skip</span></div>,
    <div key="d" className="h-40 bg-gradient-to-br from-info to-primary flex items-center justify-center rounded-xl"><span className="text-lg font-semibold text-white">Edge bounce</span></div>,
  ];
  return <Slider slides={slides} loop={false} dragThreshold={50} />;
}

export function buildContainerData(): ShowcaseComponent[] {
  return [
    {
      id: 'card',
      title: 'Card',
      category: 'Organism',
      abbr: 'Ca',
      description: 'Content container with raised / flat / outline variants and default / compact density (compact: 16 px sides, for narrow side panels and embedded views). Supports title, subtitle, headerRight, footer slots and loading skeleton state.',
      filePath: 'modules/ui/Card.tsx',
      sourceCode: `import { cn } from '@/libs/utils/cn';

const densityClasses = {
  default: { header: 'px-6 py-4', body: 'px-6 py-4', footer: 'px-6 py-3' },
  compact: { header: 'px-4 py-3', body: 'px-4 py-3', footer: 'px-4 py-2.5' },
};

export function Card({ title, subtitle, headerRight, footer, children, variant = 'raised', density = 'default', className }) {
  const pad = densityClasses[density];
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', variant === 'raised' && 'bg-surface-raised shadow-sm', variant === 'flat' && 'bg-surface-base', variant === 'outline' && 'bg-transparent', className)}>
      {(title || headerRight) && (
        <div className={cn('flex items-start justify-between gap-3 border-b border-border', pad.header)}>
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}
      {children && <div className={pad.body}>{children}</div>}
      {footer && <div className={cn('border-t border-border bg-surface-base', pad.footer)}>{footer}</div>}
    </div>
  );
}`,
      playground: {
        controls: [
          { key: 'variant',   label: 'Variant',   type: 'select',  options: ['raised', 'flat', 'outline'] as const, default: 'raised' },
          { key: 'density',   label: 'Density',   type: 'select',  options: ['default', 'compact'] as const, default: 'default' },
          { key: 'title',     label: 'Title',     type: 'text',    default: 'User profile' },
          { key: 'subtitle',  label: 'Subtitle',  type: 'text',    default: 'Manage your account details' },
          { key: 'hoverable', label: 'Hoverable', type: 'boolean', default: false },
          { key: 'loading',   label: 'Loading',   type: 'boolean', default: false },
        ],
        render: (p) => (
          <div className="w-full max-w-sm">
            <Card
              variant={p.variant as React.ComponentProps<typeof Card>['variant']}
              density={p.density as React.ComponentProps<typeof Card>['density']}
              title={p.title as string}
              subtitle={p.subtitle as string}
              hoverable={p.hoverable as boolean}
              loading={p.loading as boolean}
            >
              <p className="text-sm text-text-secondary">Card body content goes here.</p>
            </Card>
          </div>
        ),
        generateCode: (p) => {
          const attrs: string[] = [];
          if (p.variant !== 'raised') attrs.push(`variant="${p.variant}"`);
          if (p.density !== 'default') attrs.push(`density="${p.density}"`);
          if (p.title)                attrs.push(`title="${p.title}"`);
          if (p.subtitle)             attrs.push(`subtitle="${p.subtitle}"`);
          if (p.hoverable)            attrs.push('hoverable');
          if (p.loading)              attrs.push('loading');
          const a = attrs.length ? '\n  ' + attrs.join('\n  ') + '\n' : '';
          return p.loading ? `<Card${a}/>` : `<Card${a}>\n  <p>Card body content.</p>\n</Card>`;
        },
      },
      variants: [
        {
          title: 'Raised',
          preview: (
            <div className="w-full max-w-sm">
              <Card title="User profile" subtitle="Manage your account details" headerRight={<Badge variant="success">Active</Badge>}>
                <p className="text-sm text-text-secondary">Card body content goes here.</p>
              </Card>
            </div>
          ),
          code: `<Card title="User profile" subtitle="Manage your account" headerRight={<Badge variant="success">Active</Badge>}>\n  <p>Card body content goes here.</p>\n</Card>`,
        },
        {
          title: 'With footer',
          preview: (
            <div className="w-full max-w-sm">
              <Card title="Confirm deletion" footer={<div className="flex gap-2"><Button variant="outline" size="sm">Cancel</Button><Button variant="danger" size="sm">Delete</Button></div>}>
                <p className="text-sm text-text-secondary">This action is irreversible.</p>
              </Card>
            </div>
          ),
          code: `<Card title="Confirm deletion" footer={<><Button variant="outline" size="sm">Cancel</Button><Button variant="danger" size="sm">Delete</Button></>}>\n  <p>This action is irreversible.</p>\n</Card>`,
        },
        {
          title: 'Flat',
          preview: (
            <div className="w-full max-w-sm">
              <Card variant="flat" title="Flat card">
                <p className="text-sm text-text-secondary">No shadow, uses page background color.</p>
              </Card>
            </div>
          ),
          code: `<Card variant="flat" title="Flat card">\n  <p>No shadow, uses page background color.</p>\n</Card>`,
        },
        {
          title: 'Outline',
          preview: (
            <div className="w-full max-w-sm">
              <Card variant="outline" title="Outline card">
                <p className="text-sm text-text-secondary">Transparent background, border only.</p>
              </Card>
            </div>
          ),
          code: `<Card variant="outline" title="Outline card">\n  <p>Transparent background, border only.</p>\n</Card>`,
        },
        {
          title: 'Clickable / hoverable',
          preview: (
            <div className="w-full max-w-sm space-y-3">
              <Card title="Clickable card" subtitle="Tap to navigate" onClick={() => alert('Card clicked!')} >
                <p className="text-sm text-text-secondary">This card is a button element with hover + focus ring.</p>
              </Card>
              <Card title="Hoverable only" subtitle="Hover for shadow" hoverable>
                <p className="text-sm text-text-secondary">Not clickable, just visually responsive.</p>
              </Card>
            </div>
          ),
          code: `<Card title="Clickable" onClick={() => navigate('/detail')}>...</Card>\n<Card title="Hoverable" hoverable>...</Card>`,
          layout: 'stack' as const,
        },
        {
          title: 'Loading skeleton',
          preview: (
            <div className="w-full max-w-sm">
              <Card loading />
            </div>
          ),
          code: `<Card loading />`,
        },
        {
          title: 'Compact (narrow panel)',
          preview: (
            <div className="w-full max-w-[360px]">
              <Card
                density="compact"
                title="Incident"
                subtitle="Where, what, how bad"
                headerRight={<Badge variant="error" size="sm">Flood</Badge>}
                footer={<div className="flex gap-2"><Button size="sm">Plan the response</Button></div>}
              >
                <p className="text-sm text-text-secondary">16 px sides instead of 24 px, for a 320-400 px side panel or an embedded view.</p>
              </Card>
            </div>
          ),
          code: `<Card density="compact" title="Incident" subtitle="Where, what, how bad" footer={<Button size="sm">Plan the response</Button>}>
  <p>16 px sides, for a narrow side panel.</p>
</Card>`,
        },
      ],
    },
    {
      id: 'page-header',
      title: 'PageHeader',
      category: 'Organism',
      abbr: 'Ph',
      description: 'Page title + subtitle + optional badge + action buttons. Supports 6 button variants (primary/secondary/accent/outline/danger/ghost; secondary is neutral, accent coloured); rendered as a link with href or as a button.',
      filePath: 'modules/ui/PageHeader.tsx',
      sourceCode: `import { cn } from '@/libs/utils/cn';

const variantMap = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface-overlay text-text-primary hover:bg-border-strong',
  accent:    'bg-accent text-accent-fg hover:bg-accent-hover',
  outline:   'border border-border text-text-primary hover:bg-surface-overlay',
  danger:    'bg-error text-text-inverse hover:opacity-90',
  ghost:     'bg-transparent text-text-primary hover:bg-surface-overlay',
};

export function PageHeader({ title, subtitle, badge, actions, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 pb-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary leading-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions?.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((action, i) => (
            <button key={i} type="button" onClick={action.onClick} disabled={action.disabled} className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50', variantMap[action.variant ?? 'primary'])}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}`,
      playground: {
        controls: [
          { key: 'title',       label: 'Title',        type: 'text',    default: 'Users' },
          { key: 'subtitle',    label: 'Subtitle',     type: 'text',    default: 'Manage your team members and their permissions.' },
          { key: 'showActions', label: 'Show actions', type: 'boolean', default: true },
        ],
        render: (p) => (
          <div className="w-full">
            <PageHeader
              title={p.title as string}
              subtitle={p.subtitle as string}
              actions={p.showActions ? [
                { label: 'Export', variant: 'outline' as const },
                { label: '+ Invite user', variant: 'primary' as const },
              ] : []}
            />
          </div>
        ),
        generateCode: (p) => {
          const lines = [`title="${p.title}"`, `subtitle="${p.subtitle}"`];
          if (p.showActions) lines.push(`actions={[{ label: 'Export', variant: 'outline' }, { label: '+ Invite user', variant: 'primary' }]}`);
          return `<PageHeader\n  ${lines.join('\n  ')}\n/>`;
        },
      },
      variants: [
        {
          title: 'With actions',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <PageHeader
                title="Users"
                subtitle="Manage your team members and their permissions."
                badge={<Badge variant="info">48 members</Badge>}
                actions={[
                  { label: 'Export', variant: 'outline' },
                  { label: '+ Invite user', variant: 'primary' },
                ]}
              />
            </div>
          ),
          code: `<PageHeader\n  title="Users"\n  subtitle="Manage your team members."\n  badge={<Badge variant="info">48 members</Badge>}\n  actions={[\n    { label: 'Export', variant: 'outline' },\n    { label: '+ Invite user', variant: 'primary' },\n  ]}\n/>`,
        },
        {
          title: 'Danger action',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <PageHeader
                title="Danger Zone"
                subtitle="Irreversible actions. Proceed with caution."
                actions={[
                  { label: 'Archive', variant: 'outline' },
                  { label: 'Delete project', variant: 'danger' },
                ]}
              />
            </div>
          ),
          code: `<PageHeader\n  title="Danger Zone"\n  subtitle="Irreversible actions."\n  actions={[\n    { label: 'Archive', variant: 'outline' },\n    { label: 'Delete project', variant: 'danger' },\n  ]}\n/>`,
        },
        {
          title: 'Minimal',
          layout: 'stack' as const,
          preview: (
            <div className="w-full">
              <PageHeader title="Settings" subtitle="Configure your workspace preferences." />
            </div>
          ),
          code: `<PageHeader title="Settings" subtitle="Configure your workspace preferences." />`,
        },
      ],
    },
    {
      id: 'slider',
      title: 'Slider',
      category: 'Molecule',
      abbr: 'Sl',
      description: 'Accessible carousel. Includes role="region" + aria-roledescription="carousel" and per-slide aria labels. Supports autoplay, arrow keys, and dot navigation.',
      filePath: 'modules/ui/Slider/index.tsx',
      sourceCode: `'use client';\nimport { useCallback, useState } from 'react';\nimport { cn } from '@/libs/utils/cn';\nimport { Track } from './parts/Track';\nimport { Slide } from './parts/Slide';\nimport { Arrows } from './parts/Arrows';\nimport { Dots } from './parts/Dots';\nimport { useDrag } from './hooks/useDrag';\nimport { useAutoPlay } from './hooks/useAutoPlay';\n\n// M1 — PointerEvent drag (touch+mouse+pen) with dragThreshold (50 px default),\n// velocity momentum (0.5 px/ms = +1 slide), and edge resistance (×0.4) when\n// loop is disabled. See modules/ui/Slider/hooks/useDrag.ts for the math.\nexport function Slider({ slides, autoPlay = false, autoPlayInterval = 4000, showDots = true, showArrows = true, loop = true, dragThreshold = 50, className, slideClassName, ariaLabel = 'Content slider' }) {\n  const [current, setCurrent] = useState(0);\n  const [isTransitioning, setIsTransitioning] = useState(false);\n  const total = slides.length;\n  const goTo = useCallback((index) => {\n    if (isTransitioning) return;\n    const target = loop ? ((index % total) + total) % total : Math.max(0, Math.min(index, total - 1));\n    if (target === current) return;\n    setIsTransitioning(true);\n    setCurrent(target);\n    setTimeout(() => setIsTransitioning(false), 350);\n  }, [current, isTransitioning, loop, total]);\n  const { dragState, handlers } = useDrag({ current, total, loop, dragThreshold, goTo });\n  useAutoPlay({ enabled: autoPlay, interval: autoPlayInterval, total, onTick: useCallback(() => { if (dragState.isDragging) return; setCurrent((c) => (c + 1) % total); }, [dragState.isDragging, total]) });\n  if (total === 0) return null;\n  const canPrev = loop || current > 0;\n  const canNext = loop || current < total - 1;\n  return (\n    <div className={cn('relative overflow-hidden rounded-xl', className)} role="region" aria-label={ariaLabel} aria-roledescription="carousel">\n      <Track current={current} isDragging={dragState.isDragging} offsetPx={dragState.offsetPx} pointerHandlers={handlers}>\n        {slides.map((slide, i) => (<Slide key={i} index={i} total={total} isActive={i === current} className={slideClassName}>{slide}</Slide>))}\n      </Track>\n      {showArrows && total > 1 && <Arrows canPrev={canPrev} canNext={canNext} onPrev={() => goTo(current - 1)} onNext={() => goTo(current + 1)} />}\n      {showDots && total > 1 && <Dots total={total} current={current} onSelect={goTo} />}\n    </div>\n  );\n}`,
      variants: [
        {
          title: 'Default',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <SliderDemo />
            </div>
          ),
          code: `<Slider\n  slides={[\n    <HeroSlide title="Slide 1" />,\n    <HeroSlide title="Slide 2" />,\n    <HeroSlide title="Slide 3" />,\n  ]}\n/>`,
        },
        {
          title: 'Auto-play',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <SliderAutoPlayDemo />
            </div>
          ),
          code: `<Slider slides={slides} autoPlay autoPlayInterval={2000} />`,
        },
        {
          title: 'Touch swipe + momentum',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <SliderSwipeDemo />
            </div>
          ),
          // M1 — momentum: a release velocity > 0.5 px/ms advances *more*
          // than one slide. Every additional 0.5 px/ms of velocity = +1
          // extra slide of travel. Below the dragThreshold the gesture
          // snaps back, and (because loop=false here) the track also
          // rubber-bands at the first and last slide with ×0.4 resistance.
          code: `<Slider\n  slides={slides}\n  loop={false}\n  dragThreshold={50}\n  // Drag past 50 px = 1 slide.\n  // Flick > 0.5 px/ms = +1 extra slide per 0.5 px/ms of release velocity.\n  // Edge resistance (×0.4) keeps you on the rails when loop is off.\n/>`,
        },
        {
          title: 'No arrows / no loop',
          layout: 'stack' as const,
          preview: (
            <div className="w-full max-w-md">
              <Slider
                loop={false}
                showArrows={false}
                slides={[
                  <div key="a" className="h-32 bg-surface-sunken flex items-center justify-center rounded-xl text-sm text-text-secondary">Slide 1 — dots only, no loop</div>,
                  <div key="b" className="h-32 bg-surface-sunken flex items-center justify-center rounded-xl text-sm text-text-secondary">Slide 2</div>,
                  <div key="c" className="h-32 bg-surface-sunken flex items-center justify-center rounded-xl text-sm text-text-secondary">Slide 3</div>,
                ]}
              />
            </div>
          ),
          code: `<Slider slides={slides} showArrows={false} loop={false} />`,
        },
      ],
    },

    {
      id: 'stat-card',
      title: 'StatCard',
      category: 'Organism',
      abbr: 'Sc',
      description: 'Compact metric display card with value, label, and optional accent color.',
      filePath: 'modules/ui/StatCard.tsx',
      sourceCode: `import { StatCard } from '@/modules/ui/StatCard';

<StatCard label="Total Users" value={1284} />
<StatCard label="Active"      value={947}  accent="text-success" />
<StatCard label="Cancelled"   value={12}   accent="text-error" />`,
      variants: [
        {
          title: 'Variants',
          layout: 'stack' as const,
          preview: (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Users"  value={1284} />
              <StatCard label="Active"       value={947}  accent="text-success" />
              <StatCard label="Transferred"  value={38}   accent="text-info" />
              <StatCard label="Cancelled"    value={12}   accent="text-error" />
            </div>
          ),
          code: `<StatCard label="Total Users" value={1284} />
<StatCard label="Active"      value={947}  accent="text-success" />
<StatCard label="Transferred" value={38}   accent="text-info" />
<StatCard label="Cancelled"   value={12}   accent="text-error" />`,
        },
      ],
    },
  ];
}
