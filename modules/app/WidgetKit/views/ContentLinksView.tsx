'use client';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle } from '../settings/style';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { hostLink, toQuickLinks, type QuickLink } from './content-logic';
import { IconTile } from './ui';

type Layout = 'list' | 'grid' | 'tiles' | 'buttons';
type S = {
  layout?: Layout;
  columns?: 'auto' | '1' | '2' | '3' | '4' | '6';
  links?: unknown;
  showDescription?: boolean;
  divider?: boolean;
  itemColor?: string;
  accentColor?: string;
  radius?: number | null;
  labelFont?: FontValue;
  labelColor?: string;
  descriptionFont?: FontValue;
  descriptionColor?: string;
  iconStyle?: 'tile' | 'plain';
  iconColor?: string;
  iconSize?: number;
  externalMark?: boolean;
  openExternalInNewTab?: boolean;
};

// The accent (and item fill) reach the classes as CSS variables, so hover works without script.
const ITEM_CLS: Record<Layout, string> = {
  list: 'flex min-h-9 items-center gap-3 rounded-[var(--kui-link-radius,0.375rem)] px-2 py-1.5 bg-[color:var(--kui-link-bg,transparent)] hover:bg-[color:color-mix(in_srgb,var(--kui-link-accent)_8%,transparent)]',
  grid: 'flex h-full items-start gap-3 rounded-[var(--kui-link-radius,0.5rem)] border border-border bg-[color:var(--kui-link-bg,var(--surface-base))] p-3 hover:border-[color:var(--kui-link-accent)]',
  tiles: 'flex h-full flex-col items-center justify-center gap-2 rounded-[var(--kui-link-radius,0.5rem)] border border-border bg-[color:var(--kui-link-bg,var(--surface-base))] p-3 text-center hover:border-[color:var(--kui-link-accent)]',
  buttons: 'inline-flex h-9 items-center gap-2 rounded-[var(--kui-link-radius,0.375rem)] bg-[color:var(--kui-link-accent)] px-3 text-primary-fg hover:opacity-90',
};
const FOCUS = 'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const LAYOUTS = new Set<Layout>(['list', 'grid', 'tiles', 'buttons']);

/** `content.links`: quick links. Unsafe targets are dropped; internal paths go through the host's `renderLink`. */
export function ContentLinksView({ settings, renderLink, resolveUrl }: WidgetViewProps) {
  const s = settings as S;
  const m = useKitMessages().content;
  const links = useMemo(() => toQuickLinks(s.links), [s.links]);
  const layout: Layout = s.layout && LAYOUTS.has(s.layout) ? s.layout : 'list';
  if (links.length === 0) {
    return <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">{m.linksEmpty}</p>;
  }
  const buttons = layout === 'buttons';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const labelStyle = fontStyle(s.labelFont, buttons ? undefined : s.labelColor);
  const descStyle = fontStyle(s.descriptionFont, s.descriptionColor);
  const showDesc = !buttons && s.showDescription !== false;
  const cols = (layout === 'grid' || layout === 'tiles') && s.columns && s.columns !== 'auto' ? Number(s.columns) : null;
  const radius = typeof s.radius === 'number' ? s.radius : undefined;

  const icon = (l: QuickLink): ReactNode => {
    if (!l.icon) return null;
    const color = cssColor(l.iconColor) ?? (buttons ? undefined : cssColor(s.iconColor));
    if (!buttons && s.iconStyle !== 'plain') {
      const tile = layout === 'tiles' ? Math.round(iconSize * 2.6) : Math.round(iconSize * 2);
      return <IconTile name={l.icon} color={color} size={tile} />;
    }
    return (
      <SettingIcon name={l.icon} className="shrink-0"
        style={{ width: iconSize, height: iconSize, fontSize: iconSize, color: color ?? (buttons ? undefined : 'var(--primary)') }} />
    );
  };

  const item = (l: QuickLink): ReactNode => {
    const mark = l.link.external && s.externalMark !== false
      ? <span aria-hidden="true" className="ml-1 text-[0.8em] opacity-60">↗</span> : null;
    const inner = (
      <>
        {icon(l)}
        <span className={cn('min-w-0', layout === 'tiles' ? 'w-full' : 'flex-1')}>
          <span className={cn('block truncate text-sm font-medium', !buttons && 'text-text-primary')} style={labelStyle}>{l.label}{mark}</span>
          {showDesc && l.description && (
            <span className={cn('block text-xs text-text-secondary', layout === 'tiles' ? 'line-clamp-2' : 'truncate')} style={descStyle}>
              {l.description}
            </span>
          )}
        </span>
      </>
    );
    const cls = cn(ITEM_CLS[layout], FOCUS);
    if (!l.link.external && renderLink) return renderLink(l.link.href, inner, cls);
    const target = hostLink(l.link, resolveUrl);
    if (!target) return null;
    const newTab = l.link.external && s.openExternalInNewTab !== false;
    return (
      <a
        href={target.href}
        className={cls}
        title={buttons && l.description ? l.description : undefined}
        {...(newTab ? { target: '_blank' } : {})}
        {...(l.link.external ? { rel: 'noopener noreferrer nofollow' } : {})}
      >
        {inner}
        {newTab && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  };

  const vars = (l: QuickLink) => ({
    '--kui-link-accent': cssColor(l.color) ?? cssColor(s.accentColor) ?? 'var(--primary)',
    ...(cssColor(s.itemColor) ? { '--kui-link-bg': cssColor(s.itemColor) } : {}),
    ...(radius !== undefined ? { '--kui-link-radius': `${radius}px` } : {}),
  }) as CSSProperties;

  return (
    <ul
      className={cn(
        'h-full min-h-0 overflow-auto',
        layout === 'list' && (s.divider === false ? 'space-y-1' : 'divide-y divide-border'),
        (layout === 'grid' || layout === 'tiles') && 'grid content-start gap-2',
        layout === 'grid' && !cols && 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
        layout === 'tiles' && !cols && 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]',
        buttons && 'flex flex-wrap content-start gap-2',
      )}
      style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
    >
      {links.map((l, i) => (
        <li key={`${l.link.href}-${i}`} style={vars(l)} className={cn(layout === 'list' && s.divider !== false && 'py-0.5')}>{item(l)}</li>
      ))}
    </ul>
  );
}

export const CONTENT_LINKS_VIEW: WidgetKindView = {
  View: ContentLinksView,
  isEmpty: (_data, settings) => !Array.isArray(settings.links) || settings.links.length === 0,
};
