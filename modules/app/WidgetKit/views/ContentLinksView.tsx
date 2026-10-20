'use client';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { linksModel, type LinkItem, type LinksSettings as S } from './content-model';
import { IconTile } from './ui';

/** `content.links`: quick links. Unsafe targets are dropped; internal paths go through the host's `renderLink`. */
export function ContentLinksView({ settings, data, renderLink, resolveUrl }: WidgetViewProps) {
  const s = settings as S;
  const m = useKitMessages().content;
  const model = useMemo(() => linksModel(s, data, resolveUrl, !!renderLink), [s, data, resolveUrl, renderLink]);
  if (model.empty) {
    return <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">{m.linksEmpty}</p>;
  }

  const item = (l: LinkItem): ReactNode => {
    const inner = (
      <>
        {l.icon && (l.icon.tile
          ? <IconTile name={l.icon.name} color={l.icon.color} size={l.icon.size} />
          : <SettingIcon name={l.icon.name} className="shrink-0" style={l.icon.style as CSSProperties} />)}
        <span className={l.innerClass}>
          <span className={l.labelClass} style={l.labelStyle as CSSProperties}>
            {l.label}
            {l.mark ? <span aria-hidden="true" className="ml-1 text-[0.8em] opacity-60">↗</span> : null}
          </span>
          {l.description && <span className={l.description.className} style={l.description.style as CSSProperties}>{l.description.text}</span>}
        </span>
      </>
    );
    if (l.viaHost && renderLink) return renderLink(l.link.href, inner, l.className);
    return (
      <a
        href={l.href}
        className={l.className}
        title={l.title}
        {...(l.newTab ? { target: '_blank' } : {})}
        {...(l.rel ? { rel: l.rel } : {})}
      >
        {inner}
        {l.newTab && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  };

  return (
    <ul className={model.ulClass} style={model.ulStyle as CSSProperties | undefined}>
      {model.items.map((l, i) => (
        <li key={`${l.link.href}-${i}`} style={l.liStyle as CSSProperties} className={l.liClass || undefined}>{item(l)}</li>
      ))}
    </ul>
  );
}

export const CONTENT_LINKS_VIEW: WidgetKindView = {
  View: ContentLinksView,
  isEmpty: (_data, settings) => !Array.isArray(settings.links) || settings.links.length === 0,
};
