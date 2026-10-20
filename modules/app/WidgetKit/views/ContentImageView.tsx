'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { expandAttrTemplate, hostImageSrc, hostLink, resolveLink } from './content-logic';
import { tint } from './ui';

type S = {
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
const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

/** The image's CSS filter from the greyscale and brightness settings, or undefined at the defaults. */
export function imageFilter(s: Pick<S, 'grayscale' | 'brightness'>): string | undefined {
  const parts: string[] = [];
  const g = num(s.grayscale, 0, 100, 0);
  const b = num(s.brightness, 20, 200, 100);
  if (g > 0) parts.push(`grayscale(${g}%)`);
  if (b !== 100) parts.push(`brightness(${b}%)`);
  return parts.length ? parts.join(' ') : undefined;
}

/**
 * The image address: a bound value (the `source` slot, e.g. an attribute holding a plan's URL) when it passes the
 * allow-list, else the setting's address. Internal paths go through the host's `resolveUrl` and are checked again.
 */
export function imageSource(settings: Pick<S, 'src'>, data: WidgetViewProps['data'], resolveUrl?: (url: string) => string): string | null {
  const bound = data.source?.value;
  return (typeof bound === 'string' ? hostImageSrc(bound.trim(), resolveUrl) : null) ?? hostImageSrc(settings.src, resolveUrl);
}

/** `content.image`: an image from an allow-listed address (internal path, https, http; never data:). */
export function ContentImageView({ settings, data, renderLink, resolveUrl }: WidgetViewProps) {
  const s = settings as S;
  const src = imageSource(s, data, resolveUrl);
  const raw = resolveLink(expandAttrTemplate(s.href, data.record?.record));
  // Internal navigation goes through the host's renderLink as is; a plain anchor gets the host-rewritten path.
  const link = raw && !raw.external && renderLink ? raw : hostLink(raw, resolveUrl);
  if (!src) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">
        Set a valid image address in this widget’s settings.
      </p>
    );
  }
  const radius = typeof s.radius === 'number' && s.radius > 0 ? s.radius : undefined;
  const overlayBase = cssColor(s.overlayColor);
  const overlay = overlayBase ? tint(overlayBase, num(s.overlayOpacity, 0, 100, 30)) : undefined;
  const caption = typeof s.caption === 'string' && s.caption.trim() ? s.caption : null;
  const placement = s.captionPlacement ?? 'overlay';
  const onImage = placement === 'overlay' || placement === 'overlay-top';
  const align = CAPTION_ALIGN[s.captionAlign ?? 'start'] ?? CAPTION_ALIGN.start;
  const captionBg = cssColor(s.captionBackground);
  const imgStyle: CSSProperties = {
    objectFit: FITS.has(s.fit ?? '') ? s.fit : 'cover',
    objectPosition: POSITIONS.has(s.position ?? '') ? s.position : 'center',
    filter: imageFilter(s),
  };

  const captionEl = caption ? (
    onImage ? (
      <span
        className={cn(
          'absolute inset-x-0 px-3 py-2 text-[13px] font-medium leading-snug text-text-primary',
          !captionBg && 'bg-surface-base/75 backdrop-blur-sm',
          placement === 'overlay-top' ? 'top-0' : 'bottom-0',
          align,
        )}
        style={{ ...(captionBg ? { background: captionBg } : {}), ...fontStyle(s.captionFont, s.captionColor) }}
      >
        {caption}
      </span>
    ) : (
      <figcaption
        className={cn('shrink-0 px-3 py-1.5 text-xs text-text-secondary', align)}
        style={{ ...(captionBg ? { background: captionBg } : {}), ...fontStyle(s.captionFont, s.captionColor) }}
      >
        {caption}
      </figcaption>
    )
  ) : null;

  const picture = (
    <span
      className="group/img relative block h-full w-full overflow-hidden"
      style={{ borderRadius: radius, background: cssColor(s.background) }}
    >
      {/* A plain <img>: the source is an author-supplied address on any host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={s.alt ?? ''}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn(
          'block h-full w-full',
          s.zoomOnHover && 'transition-transform duration-300 ease-out group-hover/img:scale-105 motion-reduce:transition-none motion-reduce:group-hover/img:scale-100',
        )}
        style={imgStyle}
      />
      {overlay && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: overlay }} />}
      {onImage && captionEl}
    </span>
  );

  const cls = 'block h-full w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus';
  let body: ReactNode = picture;
  if (link) {
    if (!link.external && renderLink) body = renderLink(link.href, picture, cls);
    else {
      body = (
        <a
          href={link.href}
          className={cls}
          {...(link.external && s.openInNewTab !== false ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
          {...(link.external && s.openInNewTab === false ? { rel: 'noopener noreferrer nofollow' } : {})}
        >
          {picture}
        </a>
      );
    }
  }

  return (
    <figure className="flex h-full min-h-0 flex-col">
      {placement === 'above' && captionEl}
      <div className="min-h-0 flex-1">{body}</div>
      {placement === 'below' && captionEl}
    </figure>
  );
}

export const CONTENT_IMAGE_VIEW: WidgetKindView = {
  View: ContentImageView,
  isEmpty: (data, settings) => imageSource(settings as S, data) === null,
};
