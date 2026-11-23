import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { activeVitals, coreVitalsAssessment, vitalRating, vitalsFormFactors, vitalsFormat } from './vitals';
import { combineInsights } from './combineInsights';
import { demoInsightsSnapshot, demoVitalsSource } from './demo';
import { SiteInsightsView } from './SiteInsightsView';
import { InsightsVitalTile, VitalsDistributionBar } from './InsightsVitalTile';
import { InsightsSnapshotSchema, type InsightsSnapshot } from '../types';

const labels = { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' } as const;

describe('vitalRating', () => {
  it('good up to the first threshold, poor above the second, the threshold itself on the better side', () => {
    expect(vitalRating('lcp', 2500)).toBe('good');
    expect(vitalRating('lcp', 2501)).toBe('needs-improvement');
    expect(vitalRating('lcp', 4000)).toBe('needs-improvement');
    expect(vitalRating('lcp', 4001)).toBe('poor');
    expect(vitalRating('inp', 200)).toBe('good');
    expect(vitalRating('inp', 500)).toBe('needs-improvement');
    expect(vitalRating('inp', 501)).toBe('poor');
    expect(vitalRating('cls', 0.1)).toBe('good');
    expect(vitalRating('cls', 0.25)).toBe('needs-improvement');
    expect(vitalRating('cls', 0.26)).toBe('poor');
    expect(vitalRating('fcp', 1800)).toBe('good');
    expect(vitalRating('fcp', 3001)).toBe('poor');
    expect(vitalRating('ttfb', 800)).toBe('good');
    expect(vitalRating('ttfb', 1800)).toBe('needs-improvement');
    expect(vitalRating('ttfb', 1801)).toBe('poor');
  });

  it('no value, no rating', () => {
    expect(vitalRating('lcp', null)).toBeNull();
    expect(vitalRating('lcp', undefined)).toBeNull();
    expect(vitalRating('lcp', Number.NaN)).toBeNull();
    expect(vitalRating('lcp', -1)).toBeNull();
  });
});

describe('coreVitalsAssessment', () => {
  const v = (p75: number) => ({ p75, good: 1, needsImprovement: 0, poor: 0 });
  it('passes when LCP, INP and CLS are good; fails on any other rating', () => {
    expect(coreVitalsAssessment({ lcp: v(2000), inp: v(150), cls: v(0.05) })).toBe('passed');
    expect(coreVitalsAssessment({ lcp: v(2600), inp: v(150), cls: v(0.05) })).toBe('failed');
    expect(coreVitalsAssessment({ lcp: v(2000), inp: v(600), cls: v(0.05) })).toBe('failed');
  });
  it('without INP it is decided by LCP and CLS; without LCP or CLS there is none', () => {
    expect(coreVitalsAssessment({ lcp: v(2000), cls: v(0.05) })).toBe('passed');
    expect(coreVitalsAssessment({ lcp: v(2000), inp: v(150) })).toBeNull();
    expect(coreVitalsAssessment(undefined)).toBeNull();
  });
});

describe('vitalsFormat', () => {
  const f = vitalsFormat('en-US');
  it('milliseconds below a second, seconds with one decimal from there; CLS with two decimals', () => {
    expect(f.value('inp', 168)).toBe('168 ms');
    expect(f.value('ttfb', 999.4)).toBe('999 ms');
    expect(f.value('ttfb', 999.6)).toBe('1.0 s');
    expect(f.value('lcp', 2870)).toBe('2.9 s');
    expect(f.value('lcp', 4000)).toBe('4.0 s');
    expect(f.value('cls', 0.1)).toBe('0.10');
    expect(f.value('cls', 0.046)).toBe('0.05');
    expect(f.value('lcp', Number.NaN)).toBe('–');
  });
  it('shares in whole percent; the locale decides the separators', () => {
    expect(f.share(0.684)).toBe('68%');
    expect(vitalsFormat('de-DE').value('lcp', 2870)).toBe('2,9 s');
  });
});

describe('the vitals source', () => {
  it('the demo matches the contract schema, connected, failing and off', () => {
    for (const vitals of ['ok', 'error', 'off'] as const) {
      expect(InsightsSnapshotSchema.safeParse(demoInsightsSnapshot({ vitals })).success).toBe(true);
    }
  });

  it('form factors: the ones with data, in order; an all-devices-only source has just that', () => {
    expect(vitalsFormFactors(demoVitalsSource('ok', ['/']))).toEqual(['phone', 'desktop']);
    const only = { ...demoVitalsSource('ok'), originVitals: { all: { lcp: { p75: 2000, good: 0.8, needsImprovement: 0.15, poor: 0.05 } } }, urls: [], history: {} };
    expect(vitalsFormFactors(only)).toEqual(['all']);
    expect(vitalsFormFactors(demoVitalsSource('off'))).toEqual([]);
  });

  it('combineInsights ignores it: the same totals, engines and pages with or without it', () => {
    const withIt = demoInsightsSnapshot();
    const without: InsightsSnapshot = { ...withIt, sources: withIt.sources.filter((s) => s.kind !== 'vitals') };
    expect(combineInsights(withIt)).toEqual(combineInsights(without));
    expect(activeVitals(withIt)?.id).toBe('crux');
    expect(activeVitals(demoInsightsSnapshot({ vitals: 'off' }))).toBeNull();
  });
});

describe('InsightsVitalTile and the distribution bar', () => {
  it('the rating is words beside its icon; the bar names every share', () => {
    render(<InsightsVitalTile abbr="LCP" name="Largest Contentful Paint" value="2.9 s" rating="needs-improvement" shares={{ good: 0.68, needsImprovement: 0.21, poor: 0.11 }} labels={labels} formatShare={(x) => `${Math.round(x * 100)}%`} />);
    expect(screen.getByText('Needs improvement')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Good 68%, Needs improvement 21%, Poor 11%' })).toBeTruthy();
  });

  it('a part at zero draws nothing; no value says not enough data', () => {
    const { container } = render(<VitalsDistributionBar shares={{ good: 0.9, needsImprovement: 0.1, poor: 0 }} labels={labels} formatShare={(x) => `${Math.round(x * 100)}%`} />);
    expect(container.querySelectorAll('[role="img"] > span')).toHaveLength(2);
    render(<InsightsVitalTile abbr="INP" name="Interaction to Next Paint" labels={labels} formatShare={String} notEnoughData="Not enough data" />);
    expect(screen.getByText('Not enough data')).toBeTruthy();
  });
});

describe('SiteInsightsView: Core Web Vitals', () => {
  it('the tab: assessment, a tile per metric, the device switch changes them', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} defaultTab="crux" locale="en-US" />);
    expect(screen.getByText('Failed')).toBeTruthy(); // phones fail on LCP
    expect(screen.getAllByText('Largest Contentful Paint').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.9 s').length).toBeGreaterThan(0);
    const devices = screen.getByRole('group', { name: 'Device' });
    fireEvent.click(within(devices).getByRole('button', { name: 'Desktop' }));
    expect(screen.getByText('Passed')).toBeTruthy();
    expect(screen.getAllByText('1.7 s').length).toBeGreaterThan(0);
  });

  it('the pages table says when CrUX has too few visits', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} defaultTab="crux" locale="en-US" />);
    const table = screen.getAllByRole('table').find((t) => within(t).queryByText('/pricing/'));
    expect(table).toBeTruthy();
    expect(within(table as HTMLElement).getAllByText('Not enough data').length).toBeGreaterThan(0);
  });

  it('the history chart switches its metric', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot()} defaultTab="crux" locale="en-US" />);
    expect(screen.getAllByText('LCP over time (75th percentile)').length).toBeGreaterThan(0);
    const group = screen.getByRole('group', { name: 'Metric shown' });
    fireEvent.click(within(group).getByRole('button', { name: 'INP' }));
    expect(screen.getAllByText('INP over time (75th percentile)').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('LCP over time (75th percentile)')).toHaveLength(0);
  });

  it('the overview carries a line per device; an off source shows none and its tab says so', () => {
    const { unmount } = render(<SiteInsightsView snapshot={demoInsightsSnapshot()} locale="en-US" />);
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('Desktop')).toBeTruthy();
    unmount();
    render(<SiteInsightsView snapshot={demoInsightsSnapshot({ vitals: 'off' })} locale="en-US" defaultTab="crux" />);
    expect(screen.getByText('Add this source in the settings to see its data here.')).toBeTruthy();
  });

  it('only Core Web Vitals connected: the overview shows its summary, not the empty state', () => {
    const demo = demoInsightsSnapshot();
    render(<SiteInsightsView snapshot={{ ...demo, sources: demo.sources.map((s) => (s.kind === 'vitals' ? s : { ...s, state: 'off' as const })) }} locale="en-US" />);
    expect(screen.getByText('No search engine is connected yet.')).toBeTruthy();
    expect(screen.getByText('Phone')).toBeTruthy();
  });

  it('a failing CrUX fetch keeps its last data and says why', () => {
    render(<SiteInsightsView snapshot={demoInsightsSnapshot({ vitals: 'error' })} defaultTab="crux" locale="en-US" />);
    expect(screen.getByText('Chrome UX Report: HTTP 429 (Quota exceeded).')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });
});
