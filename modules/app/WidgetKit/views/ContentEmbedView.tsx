'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/libs/utils/cn';
import { cssColor } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { EMBED_REFERRER_POLICY, embedSandbox, expandAttrTemplate, resolveEmbedUrl } from './content-logic';
import { Meta } from './ui';
import { useKitMessages, useWidgetKit } from '../WidgetKitContext';

type S = {
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

/** Bumps every `seconds` (min 10), so the frame can be re-mounted; `null` = never. */
function useReloadTick(seconds: unknown): number {
  const [tick, setTick] = useState(0);
  const every = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.max(10, seconds) : null;
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
  const record = data.record?.record;
  const result = useMemo(() => resolveEmbedUrl(expandAttrTemplate(s.url, record), embedHosts), [s.url, record, embedHosts]);
  const tick = useReloadTick(s.refreshSeconds);
  if (!result.ok) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-secondary">
        {result.reason === 'empty'
          ? m.embedEmpty
          : result.reason === 'notAllowed'
            ? m.embedRefused(result.host)
            : m.embedInvalid}
      </p>
    );
  }
  const ratio = s.aspect ? RATIOS[s.aspect] : undefined;
  const zoom = typeof s.zoom === 'number' && s.zoom >= 25 && s.zoom <= 200 ? s.zoom / 100 : 1;
  const radius = typeof s.radius === 'number' && s.radius > 0 ? s.radius : undefined;
  const frameBox: CSSProperties = {
    background: cssColor(s.background),
    borderRadius: radius,
    ...(s.border ? { borderWidth: 1, borderStyle: 'solid', borderColor: cssColor(s.borderColor) ?? 'var(--border)' } : {}),
    ...(ratio ? { aspectRatio: ratio } : {}),
  };
  const frameStyle: CSSProperties = zoom === 1 ? {} : {
    width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: '0 0',
  };
  const hint = typeof s.hintText === 'string' ? s.hintText.trim() : '';
  const toolbar = s.showToolbar !== false ? (
    <div className={cn('flex h-8 shrink-0 items-center gap-2 px-3', s.toolbarPosition === 'top' ? 'border-b border-border' : 'border-t border-border')}>
      <Meta className="shrink-0 font-medium text-text-secondary">{result.host}</Meta>
      {hint && <span className="min-w-0 flex-1 truncate" title={hint}><Meta>{hint}</Meta></span>}
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {typeof s.openLabel === 'string' && s.openLabel.trim() ? s.openLabel : m.open}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> {m.opensInNewTab(result.host)}</span>
      </a>
    </div>
  ) : null;
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {s.toolbarPosition === 'top' && toolbar}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className={cn('relative overflow-hidden', ratio ? 'max-h-full w-full' : 'h-full w-full')} style={frameBox}>
          <iframe
            key={tick}
            src={result.url}
            title={title?.trim() ? title : m.embedTitle(result.host)}
            sandbox={embedSandbox(s.sandboxAllow)}
            allow={s.allowFullscreen === false ? undefined : 'fullscreen'}
            allowFullScreen={s.allowFullscreen !== false}
            referrerPolicy={EMBED_REFERRER_POLICY}
            loading="lazy"
            className="absolute inset-0 block h-full w-full border-0"
            style={frameStyle}
          />
        </div>
      </div>
      {s.toolbarPosition !== 'top' && toolbar}
    </div>
  );
}

export const CONTENT_EMBED_VIEW: WidgetKindView = {
  View: ContentEmbedView,
  isEmpty: (_data, settings) => typeof settings.url !== 'string' || settings.url.trim() === '',
};
