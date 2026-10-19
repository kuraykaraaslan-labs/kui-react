import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { effective, templateDefaults, validate } from '../settings/engine';
import type { WidgetViewProps } from '../kind';
import { CONTENT_VIDEO, CONTENT_VIDEO_KIND } from '../templates/content-video';
import { CONTENT_VIDEO_VIEW, isHls, videoSource } from '../views/ContentVideoView';
import { BUILTIN_VIEWS } from '../views';
import { builtinKind } from '../templates';
import { WidgetKitProvider } from '../WidgetKitContext';

const h = vi.hoisted(() => ({
  players: [] as Array<Record<string, unknown>>,
  hlsLoads: 0,
  adapterArgs: [] as unknown[],
  throwPlayer: false,
}));

// The real player needs a media element jsdom does not have: record what the widget hands it.
vi.mock('@kuraykaraaslan/kui-player/react', () => ({
  VideoPlayer: (p: Record<string, unknown>) => {
    if (h.throwPlayer) throw new Error('no media');
    h.players.push(p);
    return <div data-testid="player" data-src={String(p.src)} className={String(p.className)} />;
  },
}));
vi.mock('@kuraykaraaslan/kui-player', () => ({
  createHlsAdapter: (opts: unknown) => { h.adapterArgs.push(opts); return { name: 'hls' }; },
}));
vi.mock('hls.js', () => { h.hlsLoads += 1; return { default: class FakeHls {} }; });
vi.mock('@kuraykaraaslan/kui-player/locales', () => ({ tr: { play: 'Oynat' }, de: {}, es: {}, fr: {}, ar: {} }));

const props = (over: Partial<WidgetViewProps> & { settings?: Record<string, unknown> } = {}): WidgetViewProps => ({
  format: {}, data: {}, locale: 'en', ...over, settings: effective(CONTENT_VIDEO, over.settings),
});
const View = CONTENT_VIDEO_VIEW.View;
const last = () => h.players.at(-1)!;

beforeEach(() => {
  h.players = [];
  h.adapterArgs = [];
  h.throwPlayer = false;
});

describe('content.video template', () => {
  it('is a v1 builtin with valid defaults, a card without padding or buttons, and an optional source slot', () => {
    expect(CONTENT_VIDEO.version).toBe(1);
    expect(CONTENT_VIDEO.id).toBe('builtin:content.video');
    expect(validate(CONTENT_VIDEO, templateDefaults(CONTENT_VIDEO)).issues).toEqual([]);
    expect(CONTENT_VIDEO.cardDefaults).toEqual({ buttons: [], padding: 0 });
    expect(CONTENT_VIDEO_KIND.category).toBe('Content');
    expect(CONTENT_VIDEO_KIND.slots).toEqual([{ key: 'source', label: 'Video address', shape: 'scalar', required: false }]);
    expect(builtinKind('content.video')).toBe(CONTENT_VIDEO_KIND);
    expect(BUILTIN_VIEWS['content.video']).toBe(CONTENT_VIDEO_VIEW);
  });

  it('refuses a script, data or protocol-relative address for the video, the poster and a subtitle file', () => {
    const paths = (v: Record<string, unknown>) => validate(CONTENT_VIDEO, v).issues.map((i) => i.path);
    expect(paths({ src: 'javascript:alert(1)' })).toContain('src');
    expect(paths({ poster: 'data:image/png;base64,AAAA' })).toContain('poster');
    expect(paths({ subtitles: [{ label: 'EN', srclang: 'en', src: '//evil.example/x.vtt' }] })).toContain('subtitles.0.src');
    expect(paths({ src: 'https://cdn.example.com/v.mp4', poster: '/uploads/p.jpg', subtitles: [{ label: 'EN', srclang: 'en', src: '/uploads/en.vtt' }] })).toEqual([]);
  });
});

describe('videoSource / isHls', () => {
  it('a valid bound value wins over the settings; an invalid one falls back to them', () => {
    const s = { src: 'https://cdn.example.com/a.mp4' };
    expect(videoSource(s, {})).toBe('https://cdn.example.com/a.mp4');
    expect(videoSource(s, { source: { shape: 'scalar', value: ' https://cam.example.com/live.m3u8 ' } })).toBe('https://cam.example.com/live.m3u8');
    expect(videoSource(s, { source: { shape: 'scalar', value: 'javascript:alert(1)' } })).toBe('https://cdn.example.com/a.mp4');
    expect(videoSource(s, { source: { shape: 'scalar', value: 42 } })).toBe('https://cdn.example.com/a.mp4');
    expect(videoSource({}, {})).toBeNull();
  });

  it('rewrites an internal path through the host and checks the result again', () => {
    expect(videoSource({ src: '/uploads/a.mp4' }, {}, (u) => `/t/acme${u}`)).toBe('/t/acme/uploads/a.mp4');
    expect(videoSource({ src: '/uploads/a.mp4' }, {}, () => 'javascript:alert(1)')).toBeNull();
  });

  it('knows an HLS address by its extension, query or fragment allowed', () => {
    expect(isHls('https://x/live.m3u8')).toBe(true);
    expect(isHls('https://x/live.M3U8?token=1')).toBe(true);
    expect(isHls('https://x/live.m3u8#t=5')).toBe(true);
    expect(isHls('https://x/video.mp4')).toBe(false);
    expect(isHls('https://x/m3u8/video.mp4')).toBe(false);
  });
});

describe('content.video view', () => {
  it('asks for an address when there is none, and the card counts it as empty', () => {
    render(<View {...props()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Set a video address in this widget’s settings, or bind one.');
    expect(screen.queryByTestId('player')).toBeNull();
    expect(CONTENT_VIDEO_VIEW.isEmpty!({}, {})).toBe(true);
    expect(CONTENT_VIDEO_VIEW.isEmpty!({}, { src: 'https://x/v.mp4' })).toBe(false);
    expect(CONTENT_VIDEO_VIEW.isEmpty!({ source: { shape: 'scalar', value: 'https://x/v.mp4' } }, {})).toBe(false);
  });

  it('plays an MP4 without hls.js, with the safe defaults for a board of several players', async () => {
    render(<View {...props({ settings: { src: 'https://cdn.example.com/a.mp4', poster: '/uploads/p.jpg' } })} />);
    expect(await screen.findByTestId('player')).toHaveAttribute('data-src', 'https://cdn.example.com/a.mp4');
    expect(last()).toMatchObject({
      poster: '/uploads/p.jpg', adapters: [], autoPlay: false, startMuted: false, loop: false, autoHideControls: true,
      theme: 'minimal', mediaSession: false, enableCast: false, persist: false, title: undefined,
    });
    expect(String(last().className)).toContain('[&_video]:object-contain');
    expect(h.adapterArgs).toEqual([]);
  });

  it('loads hls.js only for a stream and hands the player an HLS adapter around it', async () => {
    render(<View {...props({ data: { source: { shape: 'scalar', value: 'https://cam.example.com/live.m3u8' } } })} />);
    expect(await screen.findByTestId('player')).toHaveAttribute('data-src', 'https://cam.example.com/live.m3u8');
    expect(last().adapters).toEqual([{ name: 'hls' }]);
    expect(h.adapterArgs).toHaveLength(1);
    expect(h.adapterArgs[0]).toMatchObject({ Hls: expect.any(Function) });
  });

  it('autoplay always starts muted (browsers refuse sound); cover, loop, title and style pass through', async () => {
    render(<View {...props({
      title: 'Line camera',
      settings: { src: 'https://x/v.mp4', autoPlay: true, loop: true, fit: 'cover', theme: 'cinema', showTitle: true, autoHideControls: false },
    })} />);
    await screen.findByTestId('player');
    expect(last()).toMatchObject({ autoPlay: true, startMuted: true, loop: true, theme: 'cinema', title: 'Line camera', autoHideControls: false });
    expect(String(last().className)).toContain('[&_video]:object-cover');
  });

  it('keeps only subtitle tracks with a label, a language and a safe file', async () => {
    render(<View {...props({ settings: { src: 'https://x/v.mp4', subtitles: [
      { label: 'English', srclang: 'en', src: '/subs/en.vtt' },
      { label: 'Bad', srclang: 'xx', src: 'javascript:alert(1)' },
      { label: '', srclang: 'de', src: '/subs/de.vtt' },
    ] } })} />);
    await screen.findByTestId('player');
    expect(last().subtitles).toEqual([{ label: 'English', srclang: 'en', src: '/subs/en.vtt' }]);
  });

  it("hands the player its own dictionary for the kit's language; English gets none", async () => {
    render(<View {...props({ locale: 'tr-TR', settings: { src: 'https://x/v.mp4' } })} />);
    await waitFor(() => expect(last().locale).toEqual({ play: 'Oynat' }));
    h.players = [];
    render(<View {...props({ locale: 'en', settings: { src: 'https://x/v2.mp4' } })} />);
    await screen.findAllByTestId('player');
    expect(last().locale).toBeUndefined();
  });

  it('shows the error text, not a broken card, when the player cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.throwPlayer = true;
    render(<View {...props({ settings: { src: 'https://x/v.mp4' } })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The video player could not start. no media');
  });

  it("uses the host's texts", () => {
    render(
      <WidgetKitProvider value={{ messages: { content: { videoEmpty: 'Bir video adresi girin.' } } }}>
        <View {...props()} />
      </WidgetKitProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Bir video adresi girin.');
  });
});
