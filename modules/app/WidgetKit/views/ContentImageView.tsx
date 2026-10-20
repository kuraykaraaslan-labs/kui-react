'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { IMAGE_LINK_CLASS, imageModel, imageSource, type ImageSettings as S } from './content-model';

export * from './content-model';

/** `content.image`: an image from an allow-listed address (internal path, https, http; never data:). */
export function ContentImageView({ settings, data, renderLink, resolveUrl }: WidgetViewProps) {
  const s = settings as S;
  const m = imageModel(s, data, resolveUrl, !!renderLink);
  if (!m) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">
        Set a valid image address in this widget’s settings.
      </p>
    );
  }
  const { caption, placement, link } = m;

  const captionEl = caption ? (
    caption.onImage ? (
      <span className={caption.className} style={caption.style as CSSProperties}>{caption.text}</span>
    ) : (
      <figcaption className={caption.className} style={caption.style as CSSProperties}>{caption.text}</figcaption>
    )
  ) : null;

  const picture = (
    <span className="group/img relative block h-full w-full overflow-hidden" style={m.pictureStyle as CSSProperties}>
      {/* A plain <img>: the source is an author-supplied address on any host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.src} alt={m.alt} loading="lazy" referrerPolicy="no-referrer" className={m.imgClass} style={m.imgStyle as CSSProperties} />
      {m.overlay && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: m.overlay }} />}
      {caption?.onImage && captionEl}
    </span>
  );

  let body: ReactNode = picture;
  if (link) {
    if (m.hostRendersLink && renderLink) body = renderLink(link.href, picture, IMAGE_LINK_CLASS);
    else body = <a href={link.href} className={IMAGE_LINK_CLASS} {...(m.anchor?.target ? { target: m.anchor.target } : {})} {...(m.anchor?.rel ? { rel: m.anchor.rel } : {})}>{picture}</a>;
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
