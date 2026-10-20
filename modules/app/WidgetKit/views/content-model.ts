// What the content widgets (image, links, embed) draw, decided once and as plain data (no React): the address
// after the safety checks, the frame and caption styles, the link attributes. `Content*View.tsx` draws it;
// kui-ejs and KUInative vendor this file, so the three agree on every setting and on every address that is refused.

import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import type { SlotData } from '../kind';
import type { ContentViewMessages } from '../messages';
import { cssColor, fontStyle, tint } from '../settings/style';
import {
  expandAttrTemplate, hostImageSrc, hostLink, resolveEmbedUrl, resolveLink, toQuickLinks, embedSandbox, EMBED_REFERRER_POLICY,
  type QuickLink, type SafeLink,
} from './content-logic';

type Data = Record<string, SlotData | undefined>;

// ── content.image ───────────────────────────────────────────────────────────

export type ImageSettings = {
  src?: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  position?: string;
  radius?: number;
  background?: string;
  zoomOnHover?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  grayscale?: number;
  brightness?: number;
  caption?: string;
  captionPlacement?: 'overlay' | 'overlay-top' | 'below' | 'above';
  captionAlign?: 'start' | 'center' | 'end';
  captionFont?: FontValue;
  captionColor?: string;
  captionBackground?: string;
  href?: string;
  openInNewTab?: boolean;
};

const FITS = new Set(['cover', 'contain', 'fill', 'none']);
const POSITIONS = new Set(['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']);
const CAPTION_ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' } as const;
const clamp = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

/** The image's CSS filter from the greyscale and brightness settings, or undefined at the defaults. */
export function imageFilter(s: Pick<ImageSettings, 'grayscale' | 'brightness'>): string | undefined {
  const parts: string[] = [];
  const g = clamp(s.grayscale, 0, 100, 0);
  const b = clamp(s.brightness, 20, 200, 100);
  if (g > 0) parts.push(`grayscale(${g}%)`);
  if (b !== 100) parts.push(`brightness(${b}%)`);
  return parts.length ? parts.join(' ') : undefined;
}

/**
 * The image address: a bound value (the `source` slot, e.g. an attribute holding a plan's URL) when it passes the
 * allow-list, else the setting's address. Internal paths go through the host's `resolveUrl` and are checked again.
 */
export function imageSource(settings: Pick<ImageSettings, 'src'>, data: Data, resolveUrl?: (url: string) => string): string | null {
  const bound = data.source?.value;
  return (typeof bound === 'string' ? hostImageSrc(bound.trim(), resolveUrl) : null) ?? hostImageSrc(settings.src, resolveUrl);
}

export const IMAGE_LINK_CLASS = 'block h-full w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus';

export function imageModel(s: ImageSettings, data: Data, resolveUrl: ((url: string) => string) | undefined, hostRendersLinks: boolean) {
  const src = imageSource(s, data, resolveUrl);
  const raw = resolveLink(expandAttrTemplate(s.href, data.record?.record));
  // Internal navigation goes through the host's link renderer as is; a plain anchor gets the host-rewritten path.
  const link: SafeLink | null = raw && !raw.external && hostRendersLinks ? raw : hostLink(raw, resolveUrl);
  if (!src) return null;
  const radius = typeof s.radius === 'number' && s.radius > 0 ? s.radius : undefined;
  const overlayBase = cssColor(s.overlayColor);
  const overlay = overlayBase ? tint(overlayBase, clamp(s.overlayOpacity, 0, 100, 30)) : undefined;
  const text = typeof s.caption === 'string' && s.caption.trim() ? s.caption : null;
  const placement = s.captionPlacement ?? 'overlay';
  const onImage = placement === 'overlay' || placement === 'overlay-top';
  const align = CAPTION_ALIGN[s.captionAlign ?? 'start'] ?? CAPTION_ALIGN.start;
  const captionBg = cssColor(s.captionBackground);
  const captionStyle: StyleRecord = { ...(captionBg ? { background: captionBg } : {}), ...fontStyle(s.captionFont, s.captionColor) as StyleRecord };
  return {
    src, alt: s.alt ?? '', placement, link, hostRendersLink: !!link && !link.external && hostRendersLinks,
    // An external link opens in a new tab unless the setting says no; the rel is the same either way.
    anchor: link
      ? { target: link.external && s.openInNewTab !== false ? '_blank' : undefined, rel: link.external ? 'noopener noreferrer nofollow' : undefined }
      : null,
    pictureStyle: { borderRadius: radius, background: cssColor(s.background) } as StyleRecord,
    imgClass: ['block h-full w-full', s.zoomOnHover && 'transition-transform duration-300 ease-out group-hover/img:scale-105 motion-reduce:transition-none motion-reduce:group-hover/img:scale-100'].filter(Boolean).join(' '),
    imgStyle: {
      objectFit: FITS.has(s.fit ?? '') ? s.fit : 'cover',
      objectPosition: POSITIONS.has(s.position ?? '') ? s.position : 'center',
      filter: imageFilter(s),
    } as StyleRecord,
    overlay,
    caption: text
      ? {
        text, onImage, style: captionStyle,
        className: onImage
          ? ['absolute inset-x-0 px-3 py-2 text-[13px] font-medium leading-snug text-text-primary', !captionBg && 'bg-surface-base/75 backdrop-blur-sm', placement === 'overlay-top' ? 'top-0' : 'bottom-0', align].filter(Boolean).join(' ')
          : `shrink-0 px-3 py-1.5 text-xs text-text-secondary ${align}`,
      }
      : null,
  };
}

// ── content.links ───────────────────────────────────────────────────────────

export type LinksLayout = 'list' | 'grid' | 'tiles' | 'buttons';
export type LinksSettings = {
  layout?: LinksLayout;
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
const ITEM_CLS: Record<LinksLayout, string> = {
  list: 'flex min-h-9 items-center gap-3 rounded-[var(--kui-link-radius,0.375rem)] px-2 py-1.5 bg-[color:var(--kui-link-bg,transparent)] hover:bg-[color:color-mix(in_srgb,var(--kui-link-accent)_8%,transparent)]',
  grid: 'flex h-full items-start gap-3 rounded-[var(--kui-link-radius,0.5rem)] border border-border bg-[color:var(--kui-link-bg,var(--surface-base))] p-3 hover:border-[color:var(--kui-link-accent)]',
  tiles: 'flex h-full flex-col items-center justify-center gap-2 rounded-[var(--kui-link-radius,0.5rem)] border border-border bg-[color:var(--kui-link-bg,var(--surface-base))] p-3 text-center hover:border-[color:var(--kui-link-accent)]',
  buttons: 'inline-flex h-9 items-center gap-2 rounded-[var(--kui-link-radius,0.375rem)] bg-[color:var(--kui-link-accent)] px-3 text-primary-fg hover:opacity-90',
};
const LINK_FOCUS = 'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const LAYOUTS = new Set<LinksLayout>(['list', 'grid', 'tiles', 'buttons']);

export interface LinkItem {
  link: QuickLink['link'];
  label: string;
  /** The `<a>` (or the host's renderer) gets this class. */
  className: string;
  /** Internal links go through the host's renderer when it has one; the others are plain anchors with these attributes. */
  viaHost: boolean;
  href: string;
  title?: string;
  newTab: boolean;
  rel?: string;
  liStyle: StyleRecord;
  liClass: string;
  icon: { name: string; tile: boolean; size: number; color?: string; style: StyleRecord } | null;
  labelClass: string;
  labelStyle: StyleRecord;
  mark: boolean;
  description: { text: string; className: string; style: StyleRecord } | null;
  innerClass: string;
}

export function linksModel(
  s: LinksSettings, data: Data, resolveUrl: ((url: string) => string) | undefined, hostRendersLinks: boolean,
) {
  const links = toQuickLinks(s.links, undefined, data.record?.record);
  const layout: LinksLayout = s.layout && LAYOUTS.has(s.layout) ? s.layout : 'list';
  if (links.length === 0) return { empty: true as const, layout };
  const buttons = layout === 'buttons';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const labelStyle = fontStyle(s.labelFont, buttons ? undefined : s.labelColor) as StyleRecord;
  const descStyle = fontStyle(s.descriptionFont, s.descriptionColor) as StyleRecord;
  const showDesc = !buttons && s.showDescription !== false;
  const cols = (layout === 'grid' || layout === 'tiles') && s.columns && s.columns !== 'auto' ? Number(s.columns) : null;
  const radius = typeof s.radius === 'number' ? s.radius : undefined;
  const className = `${ITEM_CLS[layout]} ${LINK_FOCUS}`;

  const items: LinkItem[] = [];
  for (const l of links) {
    const viaHost = !l.link.external && hostRendersLinks;
    const target = viaHost ? l.link : hostLink(l.link, resolveUrl);
    if (!target) continue;
    const newTab = l.link.external && s.openExternalInNewTab !== false;
    const color = cssColor(l.iconColor) ?? (buttons ? undefined : cssColor(s.iconColor));
    let icon: LinkItem['icon'] = null;
    if (l.icon) {
      icon = !buttons && s.iconStyle !== 'plain'
        ? { name: l.icon, tile: true, size: layout === 'tiles' ? Math.round(iconSize * 2.6) : Math.round(iconSize * 2), color, style: {} }
        : { name: l.icon, tile: false, size: iconSize, color, style: { width: iconSize, height: iconSize, fontSize: iconSize, color: color ?? (buttons ? undefined : 'var(--primary)') } };
    }
    items.push({
      link: l.link, label: l.label, className, viaHost, href: target.href,
      title: buttons && l.description ? l.description : undefined,
      newTab, rel: l.link.external ? 'noopener noreferrer nofollow' : undefined,
      liStyle: {
        '--kui-link-accent': cssColor(l.color) ?? cssColor(s.accentColor) ?? 'var(--primary)',
        ...(cssColor(s.itemColor) ? { '--kui-link-bg': cssColor(s.itemColor) } : {}),
        ...(radius !== undefined ? { '--kui-link-radius': `${radius}px` } : {}),
      },
      liClass: layout === 'list' && s.divider !== false ? 'py-0.5' : '',
      icon,
      innerClass: `min-w-0 ${layout === 'tiles' ? 'w-full' : 'flex-1'}`,
      labelClass: ['block truncate text-sm font-medium', !buttons && 'text-text-primary'].filter(Boolean).join(' '),
      labelStyle,
      mark: l.link.external && s.externalMark !== false,
      description: showDesc && l.description
        ? { text: l.description, className: `block text-xs text-text-secondary ${layout === 'tiles' ? 'line-clamp-2' : 'truncate'}`, style: descStyle }
        : null,
    });
  }
  return {
    empty: false as const, layout, buttons, items,
    ulClass: [
      'h-full min-h-0 overflow-auto',
      layout === 'list' && (s.divider === false ? 'space-y-1' : 'divide-y divide-border'),
      (layout === 'grid' || layout === 'tiles') && 'grid content-start gap-2',
      layout === 'grid' && !cols && 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
      layout === 'tiles' && !cols && 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]',
      buttons && 'flex flex-wrap content-start gap-2',
    ].filter(Boolean).join(' '),
    ulStyle: cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } as StyleRecord : undefined,
  };
}

// ── content.embed ───────────────────────────────────────────────────────────

export type EmbedSettings = {
  url?: string;
  aspect?: 'fill' | '16:9' | '4:3' | '1:1';
  zoom?: number;
  border?: boolean;
  borderColor?: string;
  radius?: number;
  background?: string;
  showToolbar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
  hintText?: string;
  openLabel?: string;
  refreshSeconds?: number | null;
  allowFullscreen?: boolean;
  sandboxAllow?: unknown;
};

const RATIOS: Record<string, string> = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1' };

export function embedModel(
  s: EmbedSettings, data: Data, embedHosts: readonly string[] | undefined, title: string | undefined, m: ContentViewMessages,
) {
  const result = resolveEmbedUrl(expandAttrTemplate(s.url, data.record?.record), embedHosts);
  if (!result.ok) {
    return { ok: false as const, text: result.reason === 'empty' ? m.embedEmpty : result.reason === 'notAllowed' ? m.embedRefused(result.host) : m.embedInvalid };
  }
  const ratio = s.aspect ? RATIOS[s.aspect] : undefined;
  const zoom = typeof s.zoom === 'number' && s.zoom >= 25 && s.zoom <= 200 ? s.zoom / 100 : 1;
  const radius = typeof s.radius === 'number' && s.radius > 0 ? s.radius : undefined;
  const hint = typeof s.hintText === 'string' ? s.hintText.trim() : '';
  const top = s.toolbarPosition === 'top';
  return {
    ok: true as const, url: result.url, host: result.host, top,
    frameBox: {
      background: cssColor(s.background),
      borderRadius: radius,
      ...(s.border ? { borderWidth: 1, borderStyle: 'solid', borderColor: cssColor(s.borderColor) ?? 'var(--border)' } : {}),
      ...(ratio ? { aspectRatio: ratio } : {}),
    } as StyleRecord,
    frameBoxClass: ['relative overflow-hidden', ratio ? 'max-h-full w-full' : 'h-full w-full'].join(' '),
    frameStyle: (zoom === 1 ? {} : { width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: '0 0' }) as StyleRecord,
    iframe: {
      title: title?.trim() ? title : m.embedTitle(result.host),
      sandbox: embedSandbox(s.sandboxAllow),
      allow: s.allowFullscreen === false ? undefined : 'fullscreen',
      allowFullScreen: s.allowFullscreen !== false,
      referrerPolicy: EMBED_REFERRER_POLICY,
    },
    refreshSeconds: typeof s.refreshSeconds === 'number' && Number.isFinite(s.refreshSeconds) && s.refreshSeconds > 0 ? Math.max(10, s.refreshSeconds) : null,
    toolbar: s.showToolbar !== false
      ? {
        className: `flex h-8 shrink-0 items-center gap-2 px-3 ${top ? 'border-b border-border' : 'border-t border-border'}`,
        hint,
        openLabel: typeof s.openLabel === 'string' && s.openLabel.trim() ? s.openLabel : m.open,
        opensInNewTab: m.opensInNewTab(result.host),
      }
      : null,
  };
}

// ── content.video ───────────────────────────────────────────────────────────

export type VideoSettings = {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  startMuted?: boolean;
  loop?: boolean;
  autoHideControls?: boolean;
  fit?: 'contain' | 'cover';
  theme?: 'minimal' | 'broadcast' | 'cinema';
  showTitle?: boolean;
  subtitles?: Array<{ label?: string; srclang?: string; src?: string }>;
};

/**
 * The address to play: a bound value (the `source` slot, e.g. a camera's stream address) when it
 * passes the media allow-list, else the settings' address. Internal paths go through the host's
 * `resolveUrl` and are checked again. `null` = nothing playable.
 */
export function videoSource(settings: VideoSettings, data: Data, resolveUrl?: (url: string) => string): string | null {
  const bound = data.source?.value;
  return (typeof bound === 'string' ? hostImageSrc(bound.trim(), resolveUrl) : null) ?? hostImageSrc(settings.src, resolveUrl);
}

/** HLS by its extension (`.m3u8`, query and fragment allowed). */
export const isHls = (src: string) => /\.m3u8(?:[?#]|$)/i.test(src);

/** The languages kui-player ships its own translations for (English needs none). */
export const PLAYER_LANGUAGES = ['tr', 'de', 'es', 'fr', 'ar'] as const;

/** kui-player's translation to use for a locale (its base language), or undefined for English and unknown languages. */
export function playerLanguage(locale: string | undefined): (typeof PLAYER_LANGUAGES)[number] | undefined {
  const lang = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return (PLAYER_LANGUAGES as readonly string[]).includes(lang) ? (lang as (typeof PLAYER_LANGUAGES)[number]) : undefined;
}

/** The props of the player (`player`), or null when there is nothing playable (`emptyText` is then drawn instead). */
export interface VideoPlayerProps {
  src: string;
  /** The source is an HLS stream (a platform without native HLS loads a library for it). */
  hls: boolean;
  poster?: string;
  title?: string;
  autoPlay: boolean;
  startMuted: boolean;
  loop: boolean;
  autoHideControls: boolean;
  fit: 'contain' | 'cover';
  theme: 'minimal' | 'broadcast' | 'cinema';
  subtitles: Array<{ label: string; srclang: string; src: string }>;
  locale?: string;
  loadingText: string;
  /** kui-player's own translation for the locale. */
  language?: (typeof PLAYER_LANGUAGES)[number];
}

/**
 * Everything content.video draws: the player's props, or the empty text. A bound `source` wins over the typed address
 * when it passes the media allow-list; a subtitle track needs a label, a language and an allowed address. Autoplay
 * implies muted (browsers refuse to start a video with sound on their own). A new `src` is a new player.
 */
export function videoModel(
  s: VideoSettings, data: Data, resolveUrl: ((url: string) => string) | undefined, title: string | undefined,
  locale: string | undefined, m: Pick<ContentViewMessages, 'videoEmpty' | 'videoLoading'>,
) {
  const src = videoSource(s, data, resolveUrl);
  const player: VideoPlayerProps | null = src === null ? null : {
    src,
    hls: isHls(src),
    poster: hostImageSrc(s.poster, resolveUrl) ?? undefined,
    title: s.showTitle && title ? title : undefined,
    autoPlay: s.autoPlay === true,
    startMuted: s.autoPlay === true || s.startMuted === true,
    loop: s.loop === true,
    autoHideControls: s.autoHideControls !== false,
    fit: s.fit === 'cover' ? 'cover' : 'contain',
    theme: s.theme ?? 'minimal',
    subtitles: (Array.isArray(s.subtitles) ? s.subtitles : []).flatMap((t) => {
      const file = hostImageSrc(t?.src, resolveUrl);
      return file && t.label && t.srclang ? [{ label: t.label, srclang: t.srclang, src: file }] : [];
    }),
    locale,
    loadingText: m.videoLoading,
    language: playerLanguage(locale),
  };
  return { empty: player === null, emptyText: m.videoEmpty, loadingText: m.videoLoading, player };
}
