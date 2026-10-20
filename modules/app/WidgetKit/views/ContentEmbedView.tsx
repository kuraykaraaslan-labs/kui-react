'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { embedModel, type EmbedSettings as S } from './content-model';
import { Meta } from './ui';
import { useKitMessages, useWidgetKit } from '../WidgetKitContext';

/** Bumps every `seconds` (min 10), so the frame can be re-mounted; `null` = never. */
function useReloadTick(every: number | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (every === null) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), every * 1000);
    return () => clearInterval(id);
  }, [every]);
  return tick;
}

/**
 * `content.embed`: an external page in a hardened frame. The URL passes `resolveEmbedUrl` (https only,
 * no credentials, default port, no private / loopback / single-label host); the frame is sandboxed
 * without `allow-same-origin` (opaque origin; a setting may only switch permissions off), sends no
 * referrer and loads lazily. When the host names the sites it allows (`WidgetKitHost.embedHosts`), a
 * site not on that list is refused too. A refused URL renders an explanation, never a frame. Whether the SITE
 * allows framing cannot be read from a sandboxed cross-origin frame, so the address bar says what a
 * blank frame means and offers the page in a new tab.
 */
export function ContentEmbedView({ settings, data, title }: WidgetViewProps) {
  const s = settings as S;
  const { embedHosts } = useWidgetKit();
  const m = useKitMessages().content;
  const model = useMemo(() => embedModel(s, data, embedHosts, title, m), [s, data, embedHosts, title, m]);
  const tick = useReloadTick(model.ok ? model.refreshSeconds : null);
  if (!model.ok) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">{model.text}</p>
    );
  }
  const { toolbar } = model;
  const bar = toolbar ? (
    <div className={toolbar.className}>
      <Meta className="shrink-0 font-medium text-text-secondary">{model.host}</Meta>
      {toolbar.hint && <span className="min-w-0 flex-1 truncate" title={toolbar.hint}><Meta>{toolbar.hint}</Meta></span>}
      <a
        href={model.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {toolbar.openLabel}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> {toolbar.opensInNewTab}</span>
      </a>
    </div>
  ) : null;
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {model.top && bar}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className={model.frameBoxClass} style={model.frameBox as CSSProperties}>
          <iframe
            key={tick}
            src={model.url}
            title={model.iframe.title}
            sandbox={model.iframe.sandbox}
            allow={model.iframe.allow}
            allowFullScreen={model.iframe.allowFullScreen}
            referrerPolicy={model.iframe.referrerPolicy as React.HTMLAttributeReferrerPolicy}
            loading="lazy"
            className="absolute inset-0 block h-full w-full border-0"
            style={model.frameStyle as CSSProperties}
          />
        </div>
      </div>
      {!model.top && bar}
    </div>
  );
}

export const CONTENT_EMBED_VIEW: WidgetKindView = {
  View: ContentEmbedView,
  isEmpty: (_data, settings) => typeof settings.url !== 'string' || settings.url.trim() === '',
};
