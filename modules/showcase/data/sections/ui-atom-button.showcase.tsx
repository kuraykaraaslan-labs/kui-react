'use client';
import { Button } from '@/modules/ui/Button';
import type { ShowcaseComponent } from '../showcase.types';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

function ButtonLoadingDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" loading>
        Saving…
      </Button>
      <Button variant="outline" loading>
        Loading details
      </Button>
    </div>
  );
}

export function buildButtonData(): ShowcaseComponent[] {
  return [
    {
      id: 'button',
      title: 'Button',
      category: 'Atom',
      abbr: 'Bt',
      description: 'Core interactive element. Supports 6 visual styles (variants) and 5 sizes: secondary is the neutral alternative (Cancel, Back), accent the coloured one (a brand\'s second colour). disabled, loading and selected states are built-in.',
      filePath: 'modules/ui/Button.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface-overlay text-text-primary hover:bg-border-strong',
  accent:    'bg-accent text-accent-fg hover:bg-accent-hover',
  ghost:     'bg-transparent text-text-primary hover:bg-surface-overlay',
  danger:    'bg-error text-text-inverse hover:opacity-90',
  outline:   'border border-border text-text-primary hover:bg-surface-overlay',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-lg',
};

export function Button({ children, variant = 'primary', size = 'md', disabled, loading, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant], sizeClasses[size]
      )}
      {...props}
    >
      {children}
    </button>
  );
}`,
      playground: {
        controls: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['primary', 'secondary', 'accent', 'ghost', 'danger', 'outline'] as const, default: 'primary' },
          { key: 'size',    label: 'Size',    type: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] as const,                    default: 'md' },
          { key: 'label',   label: 'Label',   type: 'text',    default: 'Click me' },
          { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
          { key: 'loading',  label: 'Loading',  type: 'boolean', default: false },
          { key: 'fullWidth', label: 'Full Width', type: 'boolean', default: false },
          { key: 'selected',  label: 'Selected',  type: 'boolean', default: false },
        ],
        render: (p) => (
          <Button
            variant={p.variant as ButtonVariant}
            size={p.size as ButtonSize}
            disabled={p.disabled as boolean}
            loading={p.loading as boolean}
            fullWidth={p.fullWidth as boolean}
            selected={p.selected as boolean}
          >
            {p.label as string}
          </Button>
        ),
        generateCode: (p) => {
          const attrs: string[] = [];
          if (p.variant !== 'primary')  attrs.push(`variant="${p.variant}"`);
          if (p.size !== 'md')          attrs.push(`size="${p.size}"`);
          if (p.disabled)               attrs.push('disabled');
          if (p.loading)                attrs.push('loading');
          if (p.fullWidth)              attrs.push('fullWidth');
          if (p.selected)               attrs.push('selected');
          const a = attrs.length ? ' ' + attrs.join(' ') : '';
          return `<Button${a}>${p.label}</Button>`;
        },
      },
      variants: [
        { title: 'Primary', preview: <Button variant="primary">Primary</Button>, code: `<Button variant="primary">Primary</Button>` },
        { title: 'Secondary', preview: <Button variant="secondary">Secondary</Button>, code: `<Button variant="secondary">Secondary</Button>` },
        { title: 'Accent', preview: <Button variant="accent">Accent</Button>, code: `<Button variant="accent">Accent</Button>` },
        { title: 'Ghost', preview: <Button variant="ghost">Ghost</Button>, code: `<Button variant="ghost">Ghost</Button>` },
        { title: 'Danger', preview: <Button variant="danger">Danger</Button>, code: `<Button variant="danger">Danger</Button>` },
        { title: 'Outline', preview: <Button variant="outline">Outline</Button>, code: `<Button variant="outline">Outline</Button>` },
        { title: 'Disabled', preview: <Button variant="primary" disabled>Disabled</Button>, code: `<Button variant="primary" disabled>Disabled</Button>` },
        {
          title: 'Sizes',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              {(['xs','sm','md','lg','xl'] as const).map((s) => <Button key={s} variant="primary" size={s}>{s.toUpperCase()}</Button>)}
            </div>
          ),
          code: `<Button size="xs">XS</Button>\n<Button size="sm">SM</Button>\n<Button size="md">MD</Button>\n<Button size="lg">LG</Button>\n<Button size="xl">XL</Button>`,
        },
        {
          title: 'Icon left / right',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" iconLeft="⬇">Download</Button>
              <Button variant="outline" iconRight="→">Next</Button>
              <Button variant="secondary" iconLeft="✉" iconRight="↗">Send</Button>
            </div>
          ),
          code: `<Button iconLeft="⬇">Download</Button>\n<Button variant="outline" iconRight="→">Next</Button>`,
        },
        {
          title: 'Icon only',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              {(['primary', 'outline', 'ghost', 'danger'] as const).map((v) => (
                <Button key={v} variant={v} iconOnly aria-label="Delete item">✕</Button>
              ))}
            </div>
          ),
          code: `<Button iconOnly aria-label="Delete item">✕</Button>`,
        },
        {
          title: 'Full width',
          layout: 'stack' as const,
          preview: (
            <div className="w-full space-y-2">
              <Button variant="primary" fullWidth>Full-width primary</Button>
              <Button variant="outline" fullWidth>Full-width outline</Button>
            </div>
          ),
          code: `<Button fullWidth>Full-width</Button>`,
        },
        {
          title: 'Selected / active state',
          preview: (
            <div className="flex gap-2">
              <Button variant="outline" selected>Selected</Button>
              <Button variant="outline">Default</Button>
            </div>
          ),
          code: `<Button variant="outline" selected>Selected</Button>`,
        },
        {
          title: 'Loading state',
          preview: <ButtonLoadingDemo />,
          code: `<Button variant="primary" loading>Saving…</Button>`,
        },
      ],
    },
  ];
}
