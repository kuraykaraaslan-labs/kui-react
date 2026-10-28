'use client';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';
import { cn } from '@/libs/utils/cn';
import { videoModel, videoSource, type VideoSettings } from './content-model';
import { useVideoPresence } from './video-presence';

export { isHls, videoSource, videoSourceHigh, type VideoSettings } from './content-model';

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
  const m = useKitMessages().content;
  const client = useSyncExternalStore(noop, () => true, () => false);
  const v = videoModel(settings as VideoSettings, data, resolveUrl, title, locale, m);
  // Hooks run before the early returns. In a board every video card that asks shares one group and one prompt.
  const presence = useVideoPresence(v.player?.presence ?? null, locale);
  if (!v.player) return <VideoStatus text={v.emptyText} />;
  if (!client) return <VideoStatus text={v.loadingText} />;
  return (
    <div className="h-full w-full overflow-hidden bg-black" data-testid="video-widget">
      <ContributionBoundary fallback={({ error }) => <VideoStatus error text={m.videoFailed(error.message ?? '')} />}>
        <Suspense fallback={<VideoStatus text={v.loadingText} />}>
          {/* A new address is a new player: no state carries over from the previous source. */}
          <ContentVideoPlayer key={`${v.player.src}|${v.player.sources?.[1]?.src ?? ''}`} {...v.player} presence={presence} />
        </Suspense>
      </ContributionBoundary>
    </div>
  );
}

export const CONTENT_VIDEO_VIEW: WidgetKindView = {
  View: ContentVideoView,
  isEmpty: (data, settings) => videoSource(settings as VideoSettings, data) === null,
};
