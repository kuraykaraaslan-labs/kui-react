'use client';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';
import { cn } from '@/libs/utils/cn';
import { hostImageSrc } from './content-logic';

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
export function videoSource(settings: VideoSettings, data: WidgetViewProps['data'], resolveUrl?: (url: string) => string): string | null {
  const bound = data.source?.value;
  return (typeof bound === 'string' ? hostImageSrc(bound.trim(), resolveUrl) : null) ?? hostImageSrc(settings.src, resolveUrl);
}

/** HLS by its extension (`.m3u8`, query and fragment allowed). */
export const isHls = (src: string) => /\.m3u8(?:[?#]|$)/i.test(src);

// kui-player (and hls.js for a stream) load only in the browser, only when a card shows a video.
const ContentVideoPlayer = lazy(() => import('./ContentVideoPlayer').then((m) => ({ default: m.ContentVideoPlayer })));

const noop = () => () => {};

function VideoStatus({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <p role={error ? 'alert' : 'status'}
      className={cn('flex h-full items-center justify-center p-4 text-center text-sm', error ? 'text-error' : 'text-text-secondary')}>
      {text}
    </p>
  );
}

/** `content.video`: kui-player filling the card, from the settings' address or a bound one. */
export function ContentVideoView({ settings, data, resolveUrl, title, locale }: WidgetViewProps) {
  const s = settings as VideoSettings;
  const m = useKitMessages().content;
  const client = useSyncExternalStore(noop, () => true, () => false);
  const src = videoSource(s, data, resolveUrl);
  if (!src) return <VideoStatus text={m.videoEmpty} />;
  if (!client) return <VideoStatus text={m.videoLoading} />;
  const subtitles = (Array.isArray(s.subtitles) ? s.subtitles : []).flatMap((t) => {
    const file = hostImageSrc(t?.src, resolveUrl);
    return file && t.label && t.srclang ? [{ label: t.label, srclang: t.srclang, src: file }] : [];
  });
  return (
    <div className="h-full w-full overflow-hidden bg-black" data-testid="video-widget">
      <ContributionBoundary fallback={({ error }) => <VideoStatus error text={m.videoFailed(error.message ?? '')} />}>
        <Suspense fallback={<VideoStatus text={m.videoLoading} />}>
          {/* A new address is a new player: no state carries over from the previous source. */}
          <ContentVideoPlayer
            key={src}
            src={src}
            hls={isHls(src)}
            poster={hostImageSrc(s.poster, resolveUrl) ?? undefined}
            title={s.showTitle && title ? title : undefined}
            // Browsers refuse to start a video with sound on their own: autoplay implies muted.
            autoPlay={s.autoPlay === true}
            startMuted={s.autoPlay === true || s.startMuted === true}
            loop={s.loop === true}
            autoHideControls={s.autoHideControls !== false}
            fit={s.fit === 'cover' ? 'cover' : 'contain'}
            theme={s.theme ?? 'minimal'}
            subtitles={subtitles}
            locale={locale}
            loadingText={m.videoLoading}
          />
        </Suspense>
      </ContributionBoundary>
    </div>
  );
}

export const CONTENT_VIDEO_VIEW: WidgetKindView = {
  View: ContentVideoView,
  isEmpty: (data, settings) => videoSource(settings as VideoSettings, data) === null,
};
