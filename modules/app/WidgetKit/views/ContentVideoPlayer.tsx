'use client';
// Its own chunk (ContentVideoView lazy-loads it): kui-player is only downloaded for a board that shows a video,
// and hls.js only for an HLS source.
import { useEffect, useState } from 'react';
import { VideoPlayer } from '@kuraykaraaslan/kui-player/react';
import { createHlsAdapter, type PresenceGroup } from '@kuraykaraaslan/kui-player';
import type { PartialDictionary } from '@kuraykaraaslan/kui-player/locales';
import { cn } from '@/libs/utils/cn';
import { playerLocale } from './video-player-locale';

type Adapter = ReturnType<typeof createHlsAdapter>;

const FIT = { contain: '[&_video]:object-contain', cover: '[&_video]:object-cover' } as const;

export function ContentVideoPlayer({
  src, hls, poster, title, autoPlay, startMuted, loop, autoHideControls, fit, theme, subtitles, locale, loadingText,
  sources, preferAlternateInFullscreen, stopWhenHidden, presence, loadOnPlay,
}: {
  src: string;
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
  /** Standard and High addresses of one stream, in the player's quality menu. */
  sources?: Array<{ label: string; src: string }>;
  preferAlternateInFullscreen?: boolean;
  /** A stream stops loading while out of view or in a hidden tab (the player's default); false keeps it running. */
  stopWhenHidden?: boolean;
  /** "Still watching?": the board's shared group, this card's own interval, or false (never; also while the group loads). */
  presence?: PresenceGroup | { everyMs: number; graceMs: number } | false;
  /** A stream requests nothing until play is pressed (autoPlay off); a video file is unaffected. */
  loadOnPlay?: boolean;
}) {
  // `null` while hls.js loads for a stream; `[]` for a source the browser plays itself.
  const [adapters, setAdapters] = useState<Adapter[] | null>(hls ? null : []);
  const [dictionary, setDictionary] = useState<PartialDictionary | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!hls) return;
    let live = true;
    import('hls.js')
      .then(({ default: Hls }) => { if (live) setAdapters([createHlsAdapter({ Hls })]); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e : new Error(String(e))); });
    return () => { live = false; };
  }, [hls]);

  useEffect(() => {
    let live = true;
    playerLocale(locale).then((d) => { if (live) setDictionary(d); }).catch(() => {});
    return () => { live = false; };
  }, [locale]);

  // Thrown during render so the view's boundary shows its error text.
  if (error) throw error;
  if (!adapters) {
    return <p role="status" className="flex h-full items-center justify-center text-sm text-white/70">{loadingText}</p>;
  }
  return (
    <VideoPlayer
      src={src}
      sources={sources}
      preferAlternateInFullscreen={preferAlternateInFullscreen}
      poster={poster}
      title={title}
      autoPlay={autoPlay}
      startMuted={startMuted}
      loop={loop}
      autoHideControls={autoHideControls}
      adapters={adapters}
      // Only a change from the player's default needs saying: it treats a stream's source as live by itself.
      live={hls && stopWhenHidden === false ? { stopWhenHidden: false } : undefined}
      presence={presence}
      loadOnPlay={loadOnPlay}
      subtitles={subtitles}
      theme={theme}
      locale={dictionary}
      // A board can hold several players: none of them claims the OS media keys, casts or writes to storage.
      mediaSession={false}
      enableCast={false}
      persist={false}
      className={cn('h-full w-full', FIT[fit])}
    />
  );
}
