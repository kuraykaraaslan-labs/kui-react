import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { effective, migrate, templateDefaults, validate } from '../settings/engine';
import type { WidgetViewProps } from '../kind';
import { CONTENT_VIDEO, CONTENT_VIDEO_KIND } from '../templates/content-video';
import { CONTENT_VIDEO_VIEW, isHls, videoSource, videoSourceHigh } from '../views/ContentVideoView';
import { PRESENCE_GRACE_MS, videoModel, videoPresence } from '../views/content-model';
import { VideoPresenceBoard } from '../views/video-presence';
import { BUILTIN_VIEWS } from '../views';
import { builtinKind } from '../templates';
import { WidgetKitProvider } from '../WidgetKitContext';
import { WidgetBoard } from '../WidgetBoard';
import { DEFAULT_WIDGET_KIT_MESSAGES as MSG } from '../messages';
import type { BoardDocument } from '../settings/board';

const h = vi.hoisted(() => ({
  players: [] as Array<Record<string, unknown>>,
  hlsLoads: 0,
  adapterArgs: [] as unknown[],
  throwPlayer: false,
  groups: [] as Array<{ options: { everyMs: number; graceMs: number } }>,
  prompts: [] as Array<{ group: unknown; locale: unknown }>,
}));

// The real player needs a media element jsdom does not have: record what the widget hands it.
vi.mock('@kuraykaraaslan/kui-player/react', () => ({
  VideoPlayer: (p: Record<string, unknown>) => {
    if (h.throwPlayer) throw new Error('no media');
    h.players.push(p);
    return <div data-testid="player" data-src={String(p.src)} className={String(p.className)} />;
  },
  // The shared group and its page-level prompt: record what the board makes, draw a marker for the prompt.
  createPresenceGroup: (options: { everyMs: number; graceMs: number }) => { const g = { options }; h.groups.push(g); return g; },
  PresencePrompt: (p: { group: unknown; locale: unknown }) => { h.prompts.push(p); return <div data-testid="presence-prompt" />; },
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
  h.groups = [];
  h.prompts = [];
});

describe('content.video template', () => {
  it('is a v2 builtin with valid defaults, a card without padding or buttons, and two optional address slots', () => {
    expect(CONTENT_VIDEO.version).toBe(2);
    expect(CONTENT_VIDEO.id).toBe('builtin:content.video');
    expect(validate(CONTENT_VIDEO, templateDefaults(CONTENT_VIDEO)).issues).toEqual([]);
    expect(CONTENT_VIDEO.cardDefaults).toEqual({ buttons: [], padding: 0 });
    expect(CONTENT_VIDEO_KIND.category).toBe('Content');
    expect(CONTENT_VIDEO_KIND.slots).toEqual([
      { key: 'source', label: 'Video address', shape: 'scalar', required: false },
      { key: 'sourceHigh', label: 'Higher quality address', shape: 'scalar', required: false },
    ]);
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

describe('content.video template v2: the Live options', () => {
  it('adds the Live group with presenceMinutes (5 / 10 / 15 / off, default 5) and stopWhenHidden (default on)', () => {
    const f = CONTENT_VIDEO.fields;
    expect(f.presenceMinutes).toMatchObject({ type: 'select', value: '5', group: 'live', since: 2, label: "Ask 'still watching?' every" });
    expect(f.presenceMinutes.options?.map((o) => (typeof o === 'string' ? o : o.value))).toEqual(['5', '10', '15', 'off']);
    expect(f.stopWhenHidden).toMatchObject({ type: 'boolean', value: true, group: 'live', since: 2, label: 'Stop the stream when the card is out of view' });
    expect(CONTENT_VIDEO.groups.find((g) => g.id === 'live')).toMatchObject({ label: 'Live', since: 2 });
    // The whole v1 field set is unchanged.
    for (const k of ['src', 'poster', 'autoPlay', 'startMuted', 'loop', 'autoHideControls', 'fit', 'theme', 'showTitle', 'subtitles']) expect(f[k].since).toBe(1);
    expect(f.autoPlay.description).toContain('for a live stream nothing is loaded until play is pressed when this is off');
    expect(templateDefaults(CONTENT_VIDEO)).toMatchObject({ presenceMinutes: '5', stopWhenHidden: true, autoPlay: false });
  });

  it('only accepts the four intervals', () => {
    const paths = (v: Record<string, unknown>) => validate(CONTENT_VIDEO, v).issues.map((i) => i.path);
    expect(paths({ presenceMinutes: '7' })).toContain('presenceMinutes');
    expect(paths({ presenceMinutes: 5 })).toContain('presenceMinutes');
    for (const ok of ['5', '10', '15', 'off']) expect(paths({ presenceMinutes: ok })).toEqual([]);
  });

  it('migrates v1 to v2 by adding the defaults, and keeps what the author set', () => {
    const v1 = { autoPlay: true, loop: true, fit: 'cover' };
    const res = migrate(CONTENT_VIDEO, v1, 1);
    expect(res.version).toBe(2);
    expect(res.applied).toHaveLength(1);
    expect(res.applied[0]).toMatchObject({ from: 1, to: 2 });
    expect(res.values).toEqual({ ...v1, presenceMinutes: '5', stopWhenHidden: true });
    // A v1 board is not changed by reading it again, and an author's v2 choice is never overwritten.
    expect(migrate(CONTENT_VIDEO, res.values, 2).values).toBe(res.values);
    expect(migrate(CONTENT_VIDEO, { presenceMinutes: 'off', stopWhenHidden: false }, 1).values).toEqual({ presenceMinutes: 'off', stopWhenHidden: false });
    expect(migrate(CONTENT_VIDEO, {}, 1).values).toEqual({ presenceMinutes: '5', stopWhenHidden: true });
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

describe('videoSourceHigh', () => {
  it('is the bound higher quality address when it passes the same allow-list, and nothing else', () => {
    expect(videoSourceHigh({})).toBeNull();
    expect(videoSourceHigh({ sourceHigh: { shape: 'scalar', value: ' https://cam.example.com/main.m3u8 ' } })).toBe('https://cam.example.com/main.m3u8');
    expect(videoSourceHigh({ sourceHigh: { shape: 'scalar', value: 'javascript:alert(1)' } })).toBeNull();
    expect(videoSourceHigh({ sourceHigh: { shape: 'scalar', value: 7 } })).toBeNull();
    expect(videoSourceHigh({ sourceHigh: { shape: 'scalar', value: '/cams/main.m3u8' } }, (u) => `/t/acme${u}`)).toBe('/t/acme/cams/main.m3u8');
  });
});

describe('videoPresence / videoModel: the live options', () => {
  it('turns the interval into the player option for a stream; off, a video file or an unknown value', () => {
    expect(PRESENCE_GRACE_MS).toBe(30_000);
    expect(videoPresence('5', true)).toEqual({ everyMs: 300_000, graceMs: 30_000 });
    expect(videoPresence('10', true)).toEqual({ everyMs: 600_000, graceMs: 30_000 });
    expect(videoPresence('15', true)).toEqual({ everyMs: 900_000, graceMs: 30_000 });
    expect(videoPresence('off', true)).toBeNull();
    expect(videoPresence('5', false)).toBeNull(); // a video file has an end: it is never asked
    expect(videoPresence(undefined, true)).toEqual({ everyMs: 300_000, graceMs: 30_000 }); // a model built without the setting
    expect(videoPresence('toString', true)).toEqual({ everyMs: 300_000, graceMs: 30_000 });
  });

  const stream = (extra: Record<string, unknown> = {}) => ({ source: { shape: 'scalar' as const, value: 'https://cam.example.com/1/live.m3u8' }, ...extra });
  const model = (settings: Record<string, unknown>, data: WidgetViewProps['data']) =>
    videoModel(effective(CONTENT_VIDEO, settings), data, undefined, undefined, 'en', MSG.content).player!;

  it('carries presence and stopWhenHidden from the settings', () => {
    expect(model({}, stream())).toMatchObject({ presence: { everyMs: 300_000, graceMs: 30_000 }, stopWhenHidden: true });
    expect(model({ presenceMinutes: '15', stopWhenHidden: false }, stream())).toMatchObject({ presence: { everyMs: 900_000 }, stopWhenHidden: false });
    expect(model({ presenceMinutes: 'off' }, stream()).presence).toBeNull();
  });

  it('passes Standard and High, and prefers High in full screen, only when both addresses are set', () => {
    const both = model({}, stream({ sourceHigh: { shape: 'scalar', value: 'https://cam.example.com/1/main.m3u8' } }));
    expect(both.src).toBe('https://cam.example.com/1/live.m3u8');
    expect(both.sources).toEqual([
      { label: 'Standard', src: 'https://cam.example.com/1/live.m3u8' },
      { label: 'High', src: 'https://cam.example.com/1/main.m3u8' },
    ]);
    expect(both.preferAlternateInFullscreen).toBe(true);
    // Only the source: unchanged behaviour. A refused or identical higher address counts as none.
    const alone = (data: WidgetViewProps['data']) => videoModel(effective(CONTENT_VIDEO, {}), data, undefined, undefined, 'en', MSG.content).player!;
    for (const data of [
      stream(),
      stream({ sourceHigh: { shape: 'scalar', value: 'javascript:alert(1)' } }),
      stream({ sourceHigh: stream().source }),
    ]) {
      expect(alone(data).sources).toBeUndefined();
      expect(alone(data).preferAlternateInFullscreen).toBe(false);
    }
    // A higher address alone plays nothing.
    expect(videoModel(effective(CONTENT_VIDEO, {}), { sourceHigh: stream().source }, undefined, undefined, 'en', MSG.content).player).toBeNull();
  });

  it('is a stream when either address is HLS, and uses the host texts for the two labels', () => {
    const mixed = videoModel(
      effective(CONTENT_VIDEO, { src: 'https://cdn.example.com/a.mp4' }),
      { sourceHigh: { shape: 'scalar', value: 'https://cdn.example.com/a.m3u8' } }, undefined, undefined, 'en',
      { ...MSG.content, videoQualityStandard: 'Standart', videoQualityHigh: 'Yüksek' },
    ).player!;
    expect(mixed.hls).toBe(true);
    expect(mixed.sources?.map((x) => x.label)).toEqual(['Standart', 'Yüksek']);
    expect(model({ src: 'https://cdn.example.com/a.mp4' }, {}).hls).toBe(false);
  });
});

describe('content.video view: sources, stopWhenHidden and the presence option of a card on its own', () => {
  const cam = (n: number) => `https://cam.example.com/${n}/live.m3u8`;
  const slot = (value: string) => ({ shape: 'scalar' as const, value });

  it('hands the player both addresses and the full screen rule; a lone source behaves as before', async () => {
    render(<View {...props({ data: { source: slot(cam(1)), sourceHigh: slot('https://cam.example.com/1/main.m3u8') } })} />);
    await screen.findByTestId('player');
    expect(last()).toMatchObject({
      src: cam(1), preferAlternateInFullscreen: true,
      sources: [{ label: 'Standard', src: cam(1) }, { label: 'High', src: 'https://cam.example.com/1/main.m3u8' }],
    });
    h.players = [];
    cleanup();
    render(<View {...props({ data: { source: slot(cam(2)) } })} />);
    await screen.findByTestId('player');
    expect(last().sources).toBeUndefined();
    expect(last().preferAlternateInFullscreen).toBe(false);
  });

  it('a new higher quality address is a new player', async () => {
    const { rerender } = render(<View {...props({ data: { source: slot(cam(1)), sourceHigh: slot('https://cam.example.com/1/main.m3u8') } })} />);
    await screen.findByTestId('player');
    const before = h.players.length;
    rerender(<View {...props({ data: { source: slot(cam(1)), sourceHigh: slot('https://cam.example.com/1/hd.m3u8') } })} />);
    await waitFor(() => expect(last().sources).toEqual([{ label: 'Standard', src: cam(1) }, { label: 'High', src: 'https://cam.example.com/1/hd.m3u8' }]));
    expect(h.players.length).toBeGreaterThan(before);
  });

  it('keeps the stream loading while hidden only when the setting is off; the player default otherwise', async () => {
    render(<View {...props({ data: { source: slot(cam(1)) } })} />);
    await screen.findByTestId('player');
    expect(last().live).toBeUndefined();
    cleanup();
    render(<View {...props({ settings: { stopWhenHidden: false }, data: { source: slot(cam(2)) } })} />);
    await screen.findByTestId('player');
    expect(last().live).toEqual({ stopWhenHidden: false });
    cleanup();
    render(<View {...props({ settings: { src: 'https://cdn.example.com/a.mp4', stopWhenHidden: false } })} />);
    await screen.findByTestId('player');
    expect(last().live).toBeUndefined(); // a video file is never live
  });

  it('outside a board a stream asks on its own, at the chosen interval; off and a video file never ask; no group is made', async () => {
    for (const [settings, data, expected] of [
      [{}, { source: slot(cam(1)) }, { everyMs: 300_000, graceMs: 30_000 }],
      [{ presenceMinutes: '10' }, { source: slot(cam(1)) }, { everyMs: 600_000, graceMs: 30_000 }],
      [{ presenceMinutes: 'off' }, { source: slot(cam(1)) }, false],
      [{ src: 'https://cdn.example.com/a.mp4' }, {}, false],
    ] as const) {
      h.players = [];
      cleanup();
      render(<View {...props({ settings, data })} />);
      await screen.findByTestId('player');
      expect(last().presence, JSON.stringify(settings)).toEqual(expected);
    }
    expect(h.groups).toEqual([]);
    expect(screen.queryByTestId('presence-prompt')).toBeNull();
  });
});

describe('a board shares one "Still watching?" between its video cards', () => {
  const cam = (n: number) => `https://cam.example.com/${n}/live.m3u8`;
  type Minutes = '5' | '10' | '15' | 'off';
  const wall = (minutes: Minutes[], locale = 'en') => (
    <VideoPresenceBoard>
      {minutes.map((presenceMinutes, i) => (
        <View key={i} {...props({ locale, settings: { presenceMinutes }, data: { source: { shape: 'scalar', value: cam(i) } } })} />
      ))}
    </VideoPresenceBoard>
  );
  /** What the card of camera `n` was last given as its `presence`. */
  const presenceOf = (n: number) => h.players.filter((p) => p.src === cam(n)).at(-1)?.presence;

  it('twelve cameras: one group, one prompt, every player joins the same group', async () => {
    render(wall(Array(12).fill('5')));
    await waitFor(() => expect(screen.getAllByTestId('player')).toHaveLength(12));
    await screen.findByTestId('presence-prompt');
    await waitFor(() => { for (let n = 0; n < 12; n++) expect(presenceOf(n)).toBe(h.groups[0]); });
    expect(h.groups).toHaveLength(1);
    expect(h.groups[0].options).toEqual({ everyMs: 300_000, graceMs: 30_000 });
    expect(screen.getAllByTestId('presence-prompt')).toHaveLength(1);
    expect(h.prompts.at(-1)!.group).toBe(h.groups[0]);
  });

  it('a card with it off never joins; the others share the shortest interval', async () => {
    render(wall(['10', '5', 'off', '15']));
    await screen.findByTestId('presence-prompt');
    await waitFor(() => expect(presenceOf(0)).toBe(h.groups[0]));
    expect(h.groups).toHaveLength(1);
    expect(h.groups[0].options.everyMs).toBe(300_000);
    expect([presenceOf(1), presenceOf(3)]).toEqual([h.groups[0], h.groups[0]]);
    expect(presenceOf(2)).toBe(false);
  });

  it('switching every card to off removes the prompt and the group; no group is made while all are off', async () => {
    const { rerender } = render(wall(['off', 'off']));
    await waitFor(() => expect(screen.getAllByTestId('player')).toHaveLength(2));
    expect(h.groups).toEqual([]);
    expect(screen.queryByTestId('presence-prompt')).toBeNull();
    rerender(wall(['5', '5']));
    await screen.findByTestId('presence-prompt');
    await waitFor(() => expect(presenceOf(1)).toBe(h.groups[0]));
    rerender(wall(['off', 'off']));
    await waitFor(() => expect(screen.queryByTestId('presence-prompt')).toBeNull());
    await waitFor(() => { expect(presenceOf(0)).toBe(false); expect(presenceOf(1)).toBe(false); });
  });

  it('follows the shortest interval when the card that asked soonest leaves or changes', async () => {
    const { rerender } = render(wall(['5', '15']));
    await screen.findByTestId('presence-prompt');
    await waitFor(() => expect(presenceOf(1)).toBe(h.groups[0]));
    rerender(wall(['15', '15']));
    await waitFor(() => expect(h.groups.at(-1)!.options.everyMs).toBe(900_000));
    const second = h.groups.at(-1);
    await waitFor(() => { expect(presenceOf(0)).toBe(second); expect(presenceOf(1)).toBe(second); });
    expect(screen.getAllByTestId('presence-prompt')).toHaveLength(1);
  });

  it('a video file in a board takes no part', async () => {
    render(
      <VideoPresenceBoard>
        <View {...props({ settings: { src: 'https://cdn.example.com/a.mp4' } })} />
      </VideoPresenceBoard>,
    );
    await screen.findByTestId('player');
    expect(last().presence).toBe(false);
    expect(h.groups).toEqual([]);
  });

  it("asks in the viewer's language", async () => {
    render(wall(['5'], 'tr-TR'));
    await waitFor(() => expect(h.prompts.at(-1)?.locale).toEqual({ play: 'Oynat' }));
  });

  it('WidgetBoard puts its video cards in one group', async () => {
    const placement = (id: string, y: number) => ({ id, type: 'content.video', title: id, x: 0, y, w: 6, h: 4, settings: {} });
    const doc: BoardDocument = {
      format: 'widgetkit.board', version: 1, templates: {}, board: { title: 'Cameras', settings: {} },
      placements: [placement('a', 0), placement('b', 4), placement('c', 8)],
    };
    const data = Object.fromEntries(['a', 'b', 'c'].map((id, i) => [id, { source: { shape: 'scalar' as const, value: cam(i) } }]));
    render(<WidgetBoard doc={doc} kinds={[CONTENT_VIDEO_KIND]} views={{ 'content.video': CONTENT_VIDEO_VIEW }} data={data} />);
    await waitFor(() => expect(screen.getAllByTestId('player')).toHaveLength(3));
    await screen.findByTestId('presence-prompt');
    await waitFor(() => { for (let n = 0; n < 3; n++) expect(presenceOf(n)).toBe(h.groups[0]); });
    expect(h.groups).toHaveLength(1);
    expect(h.groups[0].options.everyMs).toBe(300_000);
  });

  it('an old v1 card of a board is asked every 5 minutes after it is read (the migration adds the default)', async () => {
    const v1 = { id: 'a', type: 'content.video', title: 'a', x: 0, y: 0, w: 6, h: 4, settings: { loop: true, $v: { 'builtin:content.video': 1 } } };
    const doc: BoardDocument = { format: 'widgetkit.board', version: 1, templates: {}, board: { title: 'Old', settings: {} }, placements: [v1] };
    render(<WidgetBoard doc={doc} kinds={[CONTENT_VIDEO_KIND]} views={{ 'content.video': CONTENT_VIDEO_VIEW }} data={{ a: { source: { shape: 'scalar', value: cam(0) } } }} />);
    await screen.findByTestId('presence-prompt');
    expect(h.groups[0].options.everyMs).toBe(300_000);
    expect(last()).toMatchObject({ loop: true });
  });
});
