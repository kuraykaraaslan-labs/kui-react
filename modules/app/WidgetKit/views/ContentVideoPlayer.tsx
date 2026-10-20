'use client';
// Its own chunk (ContentVideoView lazy-loads it): kui-player is only downloaded for a board that shows a video,
// and hls.js only for an HLS source.
import { useEffect, useState } from 'react';
import { VideoPlayer } from '@kuraykaraaslan/kui-player/react';
import { createHlsAdapter } from '@kuraykaraaslan/kui-player';
import type { PartialDictionary } from '@kuraykaraaslan/kui-player/locales';
import { cn } from '@/libs/utils/cn';
import { playerLanguage } from './content-model';

type Adapter = ReturnType<typeof createHlsAdapter>;

const FIT = { contain: '[&_video]:object-contain', cover: '[&_video]:object-cover' } as const;

/** kui-player's own translations by the kit's locale (`playerLanguage`, the base language); English needs none. */
async function playerLocale(locale: string | undefined): Promise<PartialDictionary | undefined> {
  const lang = playerLanguage(locale);
  if (!lang) return undefined;
  const all = await import('@kuraykaraaslan/kui-player/locales');
  return all[lang];
}

export function ContentVideoPlayer({
  src, hls, poster, title, autoPlay, startMuted, loop, autoHideControls, fit, theme, subtitles, locale, loadingText,
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
      poster={poster}
      title={title}
      autoPlay={autoPlay}
      startMuted={startMuted}
      loop={loop}
      autoHideControls={autoHideControls}
      adapters={adapters}
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
