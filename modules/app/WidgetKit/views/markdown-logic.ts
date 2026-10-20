// The pure logic of the markdown widget (no React): the settings, the parsed blocks with every `{{field}}` and link
// decided as plain data, the callout tone and the footer rows. `ContentMarkdownView.tsx` draws it; kui-ejs and KUInative
// vendor this file.

import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import type { SlotData } from '../kind';
import { cssColor, fontStyle, formatValue, type ValueFormat } from '../settings/style';
import { parseMarkdown, type MdBlock, type MdInline } from './markdown';
import { hostLink } from './content-logic';

export type MarkdownSettings = {
  layout?: 'plain' | 'callout';
  content?: string;
  calloutStyle?: 'info' | 'success' | 'warning' | 'error' | 'custom';
  calloutColor?: string;
  calloutBackground?: string;
  calloutIcon?: string;
  align?: 'start' | 'center' | 'end';
  verticalAlign?: 'top' | 'center' | 'bottom';
  textSize?: 'sm' | 'md' | 'lg';
  textFont?: FontValue;
  textColor?: string;
  headingFont?: FontValue;
  headingColor?: string;
  linkColor?: string;
  linkUnderline?: 'hover' | 'always';
  padding?: number;
  overflow?: 'scroll' | 'clamp';
  clampLines?: number;
  missingText?: string;
  showRecord?: boolean;
  recordKeys?: unknown;
};

const SIZE = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' } as const;
const ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' } as const;
const VALIGN = { top: 'justify-start', center: 'justify-center', bottom: 'justify-end' } as const;
/** The callout tones: theme tokens, so light and dark both work. */
const CALLOUT: Record<'info' | 'success' | 'warning' | 'error', { accent: string; background: string }> = {
  info: { accent: 'var(--info)', background: 'var(--info-subtle)' },
  success: { accent: 'var(--success)', background: 'var(--success-subtle)' },
  warning: { accent: 'var(--warning)', background: 'var(--warning-subtle)' },
  error: { accent: 'var(--error)', background: 'var(--error-subtle)' },
};
const MAX_FOOTER = 12;

/** `uptimeHours` / `serial_number` -> "Uptime hours" / "Serial number". */
export function keyLabel(key: string): string {
  const words = key.split('.').pop()!.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

/** The footer's keys: the chosen ones, else every scalar of the record (capped). */
export function footerKeys(record: Record<string, unknown>, chosen: unknown): string[] {
  const picked = Array.isArray(chosen) ? chosen.filter((k): k is string => typeof k === 'string' && k !== '') : [];
  if (picked.length) return picked.slice(0, MAX_FOOTER);
  return Object.keys(record)
    .filter((k) => ['string', 'number', 'boolean'].includes(typeof record[k]))
    .slice(0, MAX_FOOTER);
}

/** A record value by key (`a.b` reads nested objects). */
function readField(record: Record<string, unknown>, key: string): unknown {
  let cur: unknown = record;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** A record value as text: numbers through `$format`; anything not a scalar is missing. */
export function fieldText(value: unknown, format: ValueFormat, missing: string, locale?: string): string {
  if (typeof value === 'number') return Number.isFinite(value) ? formatValue(value, format, {}, locale) : missing;
  if (typeof value === 'string') return value === '' ? missing : value;
  if (typeof value === 'boolean') return String(value);
  return missing;
}

/** A `{{key}}` placeholder's text: `param_<name>` reads board params, anything else the record. Unbound = literal. */
function placeholder(key: string, ctx: { record?: Record<string, unknown>; params?: Record<string, unknown>; format: ValueFormat; missing: string; locale?: string }): string {
  if (key.startsWith('param_')) {
    return ctx.params ? fieldText(ctx.params[key.slice(6)], ctx.format, ctx.missing, ctx.locale) : `{{${key}}}`;
  }
  return ctx.record ? fieldText(readField(ctx.record, key), ctx.format, ctx.missing, ctx.locale) : `{{${key}}}`;
}

/** An inline node with every placeholder written out and every link and action decided. */
export type InlineView =
  | { t: 'text'; text: string }
  | { t: 'strong' | 'em'; children: InlineView[] }
  | { t: 'code'; text: string; className: string }
  | { t: 'action'; id: string; children: InlineView[]; className: string; style?: StyleRecord }
  | { t: 'link'; href: string; internalViaHost: boolean; className: string; style?: StyleRecord; attrs: { target?: string; rel?: string }; children: InlineView[] };

export type BlockView =
  | { t: 'heading'; className: string; style: StyleRecord; children: InlineView[] }
  | { t: 'paragraph'; className: string; children: InlineView[] }
  | { t: 'quote'; className: string; children: InlineView[] }
  | { t: 'code'; className: string; text: string }
  | { t: 'hr'; className: string }
  | { t: 'ul' | 'ol'; className: string; items: Array<{ className: string; children: InlineView[] }> };

export interface MarkdownHost {
  resolveUrl?: (url: string) => string;
  /** The host draws internal links itself (kui-react's `renderLink`). */
  hostRendersLinks?: boolean;
  params?: Record<string, unknown>;
  /** The host handles `[label](action:id)` clicks; without it an action is just its text. */
  handlesActions?: boolean;
}

/** Everything the markdown widget draws, decided once. */
export function markdownModel(s: MarkdownSettings, format: ValueFormat, data: Record<string, SlotData | undefined>, locale: string | undefined, host: MarkdownHost = {}) {
  const content = typeof s.content === 'string' ? s.content : '';
  const blocks: MdBlock[] = parseMarkdown(content);
  const raw = data.record?.record;
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : undefined;
  const linkColor = cssColor(s.linkColor);
  const missing = typeof s.missingText === 'string' ? s.missingText : '—';
  const linkStyle: StyleRecord | undefined = linkColor ? { color: linkColor } : undefined;
  const underline = s.linkUnderline === 'always' ? 'underline' : 'hover:underline';
  const ctx = { record, params: host.params && typeof host.params === 'object' ? host.params : undefined, format, missing, locale };

  const inline = (nodes: MdInline[]): InlineView[] => nodes.flatMap((n): InlineView[] => {
    switch (n.t) {
      case 'text': return [{ t: 'text', text: n.text }];
      case 'field': return [{ t: 'text', text: placeholder(n.key, ctx) }];
      case 'strong': return [{ t: 'strong', children: inline(n.children) }];
      case 'em': return [{ t: 'em', children: inline(n.children) }];
      case 'code': return [{ t: 'code', text: n.text, className: 'rounded bg-surface-overlay px-1 py-0.5 font-mono text-[0.85em]' }];
      case 'action': {
        // Only clickable when the host handles element clicks; otherwise just its text, never an inert-looking control.
        const children = inline(n.children);
        if (!host.handlesActions) return children;
        return [{ t: 'action', id: n.id, children, style: linkStyle, className: cn('cursor-pointer rounded-sm text-primary underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', underline) }];
      }
      case 'link': {
        const className = cn('rounded-sm text-primary underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', underline);
        const children = inline(n.children);
        if (!n.external && host.hostRendersLinks) return [{ t: 'link', href: n.href, internalViaHost: true, className, style: linkStyle, attrs: {}, children }];
        const href = hostLink({ href: n.href, external: n.external }, host.resolveUrl)?.href;
        if (!href) return children;
        return [{ t: 'link', href, internalViaHost: false, className, style: linkStyle, attrs: n.external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}, children }];
      }
    }
  });

  const headingStyle = fontStyle(s.headingFont, s.headingColor) as StyleRecord;
  const views: BlockView[] = blocks.map((b): BlockView => {
    switch (b.t) {
      case 'heading': return { t: 'heading', className: cn('font-semibold leading-snug', b.level <= 2 ? 'text-[1.15em]' : 'text-[1em]'), style: headingStyle, children: inline(b.children) };
      case 'paragraph': return { t: 'paragraph', className: 'leading-relaxed', children: inline(b.children) };
      case 'quote': return { t: 'quote', className: 'border-l-2 border-border pl-3 text-text-secondary', children: inline(b.children) };
      case 'code': return { t: 'code', className: 'overflow-x-auto rounded-md bg-surface-overlay p-2 text-left font-mono text-xs', text: b.text };
      case 'hr': return { t: 'hr', className: 'border-border' };
      case 'ul':
      case 'ol':
        return { t: b.t, className: cn(b.t === 'ul' ? 'list-disc' : 'list-decimal', 'space-y-1 pl-5 text-left marker:text-text-secondary'), items: b.items.map((it) => ({ className: 'leading-relaxed', children: inline(it) })) };
    }
  });

  const callout = s.layout === 'callout';
  const tone = s.calloutStyle === 'custom'
    ? { accent: cssColor(s.calloutColor) ?? 'var(--primary)', background: cssColor(s.calloutBackground) ?? 'var(--primary-subtle)' }
    : CALLOUT[s.calloutStyle ?? 'info'] ?? CALLOUT.info;
  const clamp = s.overflow === 'clamp' && typeof s.clampLines === 'number' && s.clampLines >= 1 ? Math.floor(s.clampLines) : null;
  const padding = typeof s.padding === 'number' && s.padding > 0 ? s.padding : undefined;
  const footer = s.showRecord && record ? footerKeys(record, s.recordKeys) : [];
  return {
    blocks: views, callout, tone,
    textClass: cn('min-w-0 space-y-2 break-words', SIZE[s.textSize ?? 'md'] ?? SIZE.md, ALIGN[s.align ?? 'start'] ?? ALIGN.start),
    textStyle: clamp ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: clamp, overflow: 'hidden' } as StyleRecord : undefined,
    rootClass: cn('flex h-full min-h-0 flex-col text-text-primary', clamp ? 'overflow-hidden' : 'overflow-auto'),
    rootStyle: { ...fontStyle(s.textFont, s.textColor) as StyleRecord, padding },
    alignClass: cn('flex flex-[1_0_auto] flex-col', VALIGN[s.verticalAlign ?? 'top'] ?? VALIGN.top),
    calloutIcon: s.calloutIcon ? { name: s.calloutIcon, color: tone.accent } : null,
    footer: footer.map((k) => ({ label: keyLabel(k), value: fieldText(record ? readField(record, k) : undefined, format, missing, locale) })),
  };
}
