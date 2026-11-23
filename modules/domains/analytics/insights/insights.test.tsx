import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { combineInsights, insightsDelta } from './combineInsights';
import { demoInsightsSnapshot } from './demo';
import { SiteInsightsView } from './SiteInsightsView';
import { InsightsSnapshotSchema, type InsightsSnapshot } from '../types';

const range = { start: '2026-11-01', end: '2026-11-03', days: 3 };
const search = (id: 'gsc' | 'bing' | 'yandex', over: Partial<Extract<InsightsSnapshot['sources'][number], { kind: 'search' }>> = {}) => ({
  id, kind: 'search' as const, label: id, state: 'ok' as const, message: '', fetchedAt: null,
  totals: {}, previousTotals: {}, days: [], topQueries: [], topPages: [], ...over,
});
const snap = (sources: InsightsSnapshot['sources']): InsightsSnapshot => ({ generatedAt: null, range, sources });

describe('combineInsights', () => {
  it('nothing connected: zeros, no engines, no analytics', () => {
    const c = combineInsights(snap([search('gsc', { state: 'off' })]));
    expect(c.totals).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    expect(c.byEngine).toEqual([]);
    expect(c.days).toEqual([]);
    expect(c.analytics).toBeNull();
  });

  it('adds clicks and impressions, recomputes CTR, weights position by impressions, shares clicks', () => {
    const c = combineInsights(snap([
      search('bing', { totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 4 } }),
      search('gsc', { totals: { clicks: 30, impressions: 900, ctr: 0.0333, position: 12 } }),
    ]));
    expect(c.totals.clicks).toBe(40);
    expect(c.totals.impressions).toBe(1000);
    expect(c.totals.ctr).toBeCloseTo(0.04);
    expect(c.totals.position).toBeCloseTo((4 * 100 + 12 * 900) / 1000);
    // fixed engine order, whatever the snapshot order
    expect(c.byEngine.map((e) => [e.id, e.share])).toEqual([['gsc', 0.75], ['bing', 0.25]]);
  });

  it('an engine without a position does not pull the average down', () => {
    const c = combineInsights(snap([
      search('gsc', { totals: { clicks: 1, impressions: 100, position: 8 } }),
      search('yandex', { totals: { clicks: 1, impressions: 300, position: 0 } }),
    ]));
    expect(c.totals.position).toBe(8);
  });

  it('days: union of dates, a missing engine date is a gap, analytics beside', () => {
    const c = combineInsights(snap([
      { id: 'ga4', kind: 'analytics', label: 'GA', state: 'ok', message: '', fetchedAt: null, totals: { views: 9 }, previousTotals: {}, days: [{ date: '2026-11-03', users: 2, sessions: 3, views: 9 }], topPages: [], channels: [] },
      search('gsc', { days: [{ date: '2026-11-02', clicks: 5, impressions: 50, ctr: 0.1, position: 3 }, { date: '2026-11-01', clicks: 4, impressions: 40, ctr: 0.1, position: 3 }] }),
      search('bing', { days: [{ date: '2026-11-02', clicks: 1, impressions: 9, ctr: 0.1, position: 2 }] }),
    ]));
    expect(c.days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(c.days[0]).toMatchObject({ clicks: 4, engines: { gsc: 4 }, views: 0 });
    expect(c.days[0].engines.bing).toBeUndefined();
    expect(c.days[1]).toMatchObject({ clicks: 6, impressions: 59, engines: { gsc: 5, bing: 1 } });
    expect(c.days[2]).toMatchObject({ clicks: 0, views: 9, users: 2 });
  });

  it('queries merge case-insensitively; pages merge search and analytics by path; sort orders', () => {
    const c = combineInsights(snap([
      { id: 'ga4', kind: 'analytics', label: 'GA', state: 'ok', message: '', fetchedAt: null, totals: { views: 1 }, previousTotals: {}, days: [], topPages: [{ key: '/a/', views: 50, users: 40 }, { key: '/b/', views: 70, users: 60 }], channels: [] },
      search('gsc', { totals: { clicks: 1 }, topQueries: [{ key: 'IoT Platform ', clicks: 5, impressions: 100, ctr: 0.05, position: 4 }, { key: 'scada', clicks: 5, impressions: 300, ctr: 0, position: 2 }], topPages: [{ key: '/a/', clicks: 9, impressions: 90, ctr: 0.1, position: 3 }] }),
      search('bing', { totals: { clicks: 1 }, topQueries: [{ key: 'iot platform', clicks: 3, impressions: 100, ctr: 0.03, position: 2 }], topPages: [{ key: '/c/', clicks: 2, impressions: 20, ctr: 0.1, position: 1 }] }),
    ]));
    expect(c.topQueries.map((q) => [q.key, q.clicks, q.engines])).toEqual([
      ['iot platform', 8, { gsc: 5, bing: 3 }],
      ['scada', 5, { gsc: 5 }],
    ]);
    expect(c.topQueries[0].position).toBeCloseTo(3);
    expect(c.topPages.map((p) => [p.key, p.views, p.clicks])).toEqual([['/b/', 70, 0], ['/a/', 50, 9], ['/c/', 0, 2]]);
  });

  it('an engine in error keeps counting with its last data; an off one never does', () => {
    const c = combineInsights(snap([
      search('gsc', { state: 'error', totals: { clicks: 7, impressions: 70 } }),
      search('bing', { state: 'off', totals: { clicks: 99, impressions: 999 } }),
    ]));
    expect(c.byEngine.map((e) => e.id)).toEqual(['gsc']);
    expect(c.totals.clicks).toBe(7);
  });

  it('keeps 25 rows at most', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ key: `q${i}`, clicks: i, impressions: 10, ctr: 0, position: 1 }));
    expect(combineInsights(snap([search('gsc', { totals: { clicks: 1 }, topQueries: many })])).topQueries).toHaveLength(25);
  });
});

describe('insightsDelta', () => {
  it('fraction change; lower-is-better flips good; nothing to compare is null', () => {
    expect(insightsDelta(120, 100)).toEqual({ change: 0.2, good: true });
    expect(insightsDelta(8, 10, true)).toEqual({ change: -0.2, good: true });
    expect(insightsDelta(12, 10, true)?.good).toBe(false);
    expect(insightsDelta(5, 5)).toEqual({ change: 0, good: null });
    expect(insightsDelta(5, undefined)).toBeNull();
    expect(insightsDelta(5, 0)).toBeNull();
  });
});

describe('demo snapshot', () => {
  it('matches the contract schema', () => {
    expect(InsightsSnapshotSchema.safeParse(demoInsightsSnapshot()).success).toBe(true);
    expect(InsightsSnapshotSchema.safeParse(demoInsightsSnapshot({ yandex: 'ok', bing: 'error' })).success).toBe(true);
  });
});

describe('SiteInsightsView', () => {
  it('overview: combined KPIs, engine share, top lists; a badge per source with its state', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} locale="en-US" />);
    expect(screen.getByRole('heading', { name: 'Site insights' })).toBeTruthy();
    expect(screen.getByText('Search clicks')).toBeTruthy();
    expect(screen.getByText('Share of search clicks')).toBeTruthy();
    expect(screen.getAllByText('Top queries').length).toBeGreaterThan(0);
    expect(screen.getByText(': Not connected')).toBeTruthy(); // Yandex, read with its name
  });

  it('a source that is not connected says so in its tab', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} defaultTab="yandex" />);
    expect(screen.getByText('Add this source in the settings to see its data here.')).toBeTruthy();
  });

  it('a failing source says why and keeps its last data', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot({ bing: 'error' })} defaultTab="bing" locale="en-US" />);
    expect(screen.getByText('The API answered 401: the key was refused.')).toBeTruthy();
    expect(screen.getByText(/Showing the last data that arrived/)).toBeTruthy();
  });

  it('nothing connected at all: the overview says so instead of empty charts', () => {
    const demo = demoInsightsSnapshot();
    render(<SiteInsightsView snapshot={{ ...demo, sources: demo.sources.map((s) => ({ ...s, state: 'off' as const })) }} />);
    expect(screen.getByText('Add this source in the settings to see its data here.')).toBeTruthy();
    expect(screen.queryByText('Share of search clicks')).toBeNull();
  });

  it('refresh calls the host; messages translate the words', () => {
    let calls = 0;
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} onRefresh={() => { calls++; }} messages={{ title: 'Website-Statistiken', refresh: 'Aktualisieren' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/ }));
    expect(calls).toBe(1);
    expect(screen.getByRole('heading', { name: 'Website-Statistiken' })).toBeTruthy();
  });

  it('a search tab switches the plotted metric', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} defaultTab="gsc" locale="en-US" />);
    const group = screen.getByRole('group', { name: 'Metric shown' });
    fireEvent.click(within(group).getByRole('button', { name: 'Impressions' }));
    expect(screen.getByText('Impressions per day')).toBeTruthy();
  });
});
