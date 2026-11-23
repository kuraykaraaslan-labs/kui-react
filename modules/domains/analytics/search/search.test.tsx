import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SiteSearchReportSchema, type SiteSearchQueryRow, type SiteSearchReport } from '../types';
import { demoSearchReport } from './demo';
import { cleanSearchQuery, combineSearchReport, maskSearchQuery, mergeSearchQueries, searchReportRates, searchLanguageName } from './searchReport';
import { SearchQueryTable } from './SearchQueryTable';
import { SearchReportView } from './SearchReportView';

const row = (key: string, over: Partial<SiteSearchQueryRow> = {}): SiteSearchQueryRow => ({
  key, searches: 1, zeroResults: 0, clicks: 0, ctr: 0, lastSeen: null, language: 'en', ...over,
});

describe('cleanSearchQuery / maskSearchQuery (same rules as kui-search Query::clean)', () => {
  it('trims, collapses white space, lower-cases, cuts to 80 characters', () => {
    expect(cleanSearchQuery('  Modbus \t  RTU\n')).toBe('modbus rtu');
    expect(cleanSearchQuery('x'.repeat(120))).toHaveLength(80);
    expect(cleanSearchQuery('ÇİĞDEM Ünal')).toBe('çi̇ğdem ünal');
  });

  it('a query under two characters is not counted', () => {
    expect(cleanSearchQuery(' a ')).toBe('');
    expect(cleanSearchQuery('\u0000\u0007')).toBe('');
    expect(cleanSearchQuery('ab')).toBe('ab');
  });

  it('masks e-mail addresses, phone, card, account and long reference numbers', () => {
    expect(cleanSearchQuery('refund for Jane.Doe@example.com')).toBe('refund for [e-mail]');
    expect(cleanSearchQuery('call +1 (555) 010-2030 please')).toBe('call [phone] please');
    expect(cleanSearchQuery('card 4111 1111 1111 1111')).toBe('card [card number]');
    expect(cleanSearchQuery('DE89 3704 0044 0532 0130 00 transfer')).toBe('[bank account] transfer');
    expect(cleanSearchQuery('order 1002345 status')).toBe('order [number] status');
    expect(maskSearchQuery('rs485 port 502 on model 2120')).toBe('rs485 port 502 on model 2120');
  });

  it('masking runs before the cut, so a long e-mail never leaves a fragment', () => {
    const q = cleanSearchQuery(`${'a'.repeat(70)} someone.with.a.long.name@example.com`);
    expect(q).not.toContain('@');
    expect(q).not.toContain('someone');
  });
});

describe('mergeSearchQueries', () => {
  it('merges the same cleaned query: counts add, CTR recomputed, latest date, language of the biggest row', () => {
    const merged = mergeSearchQueries([
      row('Pricing ', { searches: 3, clicks: 1, lastSeen: '2026-11-02T10:00:00Z', language: 'de' }),
      row('pricing', { searches: 5, clicks: 4, zeroResults: 1, lastSeen: '2026-11-01T10:00:00Z', language: 'en' }),
      row('api', { searches: 5, clicks: 5 }),
    ]);
    expect(merged.map((r) => [r.key, r.searches, r.clicks, r.zeroResults, r.language, r.lastSeen])).toEqual([
      ['pricing', 8, 5, 1, 'en', '2026-11-02T10:00:00Z'],
      ['api', 5, 5, 0, 'en', null],
    ]);
    expect(merged[0].ctr).toBeCloseTo(5 / 8);
  });

  it('sorts by searches, then clicks, then the query, and keeps 25 rows', () => {
    const many = Array.from({ length: 40 }, (_, i) => row(`q${String(i).padStart(2, '0')}`, { searches: i % 3 }));
    const out = mergeSearchQueries(many);
    expect(out).toHaveLength(25);
    expect(out[0].key).toBe('q02');
    expect(mergeSearchQueries([row('bb', { searches: 2 }), row('aa', { searches: 2 }), row('cc', { searches: 2, clicks: 1 })]).map((r) => r.key)).toEqual(['cc', 'aa', 'bb']);
  });
});

describe('searchReportRates / combineSearchReport', () => {
  it('rates are fractions of searches, zero without searches', () => {
    expect(searchReportRates({ searches: 200, zeroResult: 20, clicks: 90 })).toEqual({ zeroRate: 0.1, clickThrough: 0.45 });
    expect(searchReportRates({})).toEqual({ zeroRate: 0, clickThrough: 0 });
  });

  it('no previous searches means nothing to compare with', () => {
    const r = demoSearchReport();
    expect(combineSearchReport({ ...r, previousTotals: {} }).previous).toBeNull();
    expect(combineSearchReport({ ...r, previousTotals: { searches: 0 } }).previous).toBeNull();
    expect(combineSearchReport(r).previous?.zeroRate).toBeCloseTo(0.122, 2);
  });

  it('languages get their share of the searches; days and results are sorted', () => {
    const r: SiteSearchReport = {
      ...demoSearchReport({ days: 3 }),
      days: [{ date: '2026-11-03', searches: 1, searchers: 1, zeroResult: 0, clicks: 0 }, { date: '2026-11-01', searches: 2, searchers: 1, zeroResult: 1, clicks: 1 }],
      languages: [{ key: 'de', searches: 1, zeroResults: 1, clicks: 0 }, { key: 'en', searches: 3, zeroResults: 0, clicks: 2 }],
      topClicked: [{ url: '/b/', title: '', clicks: 2, fromQueries: [] }, { url: '/a/', title: '', clicks: 2, fromQueries: [] }, { url: '/c/', title: '', clicks: 5, fromQueries: [] }],
    };
    const c = combineSearchReport(r);
    expect(c.days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-03']);
    expect(c.languages.map((l) => [l.key, l.share, l.zeroRate])).toEqual([['en', 0.75, 0], ['de', 0.25, 1]]);
    expect(c.topClicked.map((x) => x.url)).toEqual(['/c/', '/a/', '/b/']);
  });

  it('language names come from Intl in the reader\'s language', () => {
    expect(searchLanguageName('de', 'en-US', '?')).toBe('German');
    expect(searchLanguageName('', 'en-US', 'Unknown')).toBe('Unknown');
  });
});

describe('demo report', () => {
  it('matches the contract schema, also when empty and over 7 days', () => {
    expect(SiteSearchReportSchema.safeParse(demoSearchReport()).success).toBe(true);
    expect(SiteSearchReportSchema.safeParse(demoSearchReport({ empty: true })).success).toBe(true);
    const week = demoSearchReport({ days: 7 });
    expect(week.days).toHaveLength(7);
    expect(week.range).toEqual({ start: '2026-11-16', end: '2026-11-22', days: 7 });
  });

  it('every listed zero-result query found nothing on every search, and the masked ones stay masked', () => {
    const r = demoSearchReport();
    expect(r.zeroResultQueries.length).toBeGreaterThan(0);
    expect(r.zeroResultQueries.every((q) => q.zeroResults === q.searches)).toBe(true);
    expect(r.topQueries.some((q) => q.key === '[e-mail]')).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/@/);
  });
});

describe('SearchReportView', () => {
  it('KPIs, chart, lists and the privacy line', () => {
    render(<SearchReportView report={demoSearchReport()} locale="en-US" />);
    expect(screen.getByRole('heading', { name: 'Site search' })).toBeTruthy();
    expect(screen.getAllByText('Searchers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Found nothing').length).toBeGreaterThan(1);
    expect(screen.getByText('Click-through')).toBeTruthy();
    expect(screen.getAllByText('Searches per day').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Searches that found nothing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Most opened results').length).toBeGreaterThan(0);
    expect(screen.getAllByText('German').length).toBeGreaterThan(0);
    expect(screen.getByText(/kept 90 days/)).toBeTruthy();
  });

  it('the no-results rate falls, which is good: the tile says lower is better', () => {
    render(<SearchReportView report={demoSearchReport()} locale="en-US" />);
    expect(screen.getByText('(lower is better)')).toBeTruthy();
  });

  it('nobody searched yet: an empty state instead of empty charts', () => {
    render(<SearchReportView report={demoSearchReport({ empty: true })} locale="en-US" />);
    expect(screen.getByText('No searches yet')).toBeTruthy();
    expect(screen.queryByText('Searches per day')).toBeNull();
  });

  it('the period picker asks the host for another range; messages translate the words', () => {
    const asked: number[] = [];
    render(<SearchReportView report={demoSearchReport()} locale="de-DE" onRangeChange={(d) => asked.push(d)} messages={{ title: 'Website-Suche', rangeDays: '{days} Tage' }} />);
    expect(screen.getByRole('heading', { name: 'Website-Suche' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Period' })).getByRole('button', { name: '7 Tage' }));
    expect(asked).toEqual([7]);
  });

  it('result paths link to the site when siteUrl is given', () => {
    render(<SearchReportView report={demoSearchReport()} locale="en-US" siteUrl="https://example.com/" />);
    const link = screen.getByRole('link', { name: /Pricing/ });
    expect(link.getAttribute('href')).toBe('https://example.com/pricing/');
  });
});

describe('SearchQueryTable', () => {
  it('a query that never found anything carries the tag (icon and words)', () => {
    render(<SearchQueryTable rows={[row('status page', { searches: 4, zeroResults: 4 }), row('pricing', { searches: 9, clicks: 5 })]} locale="en-US" />);
    expect(screen.getAllByText('nothing found')).toHaveLength(1);
  });

  it('the zero-result list has no click columns; sorting by searches goes up, then down', () => {
    render(<SearchQueryTable kind="zero" rows={[row('aa', { searches: 1, zeroResults: 1 }), row('bb', { searches: 7, zeroResults: 7 })]} locale="en-US" />);
    const table = screen.getByRole('table');
    expect(within(table).queryByText('CTR')).toBeNull();
    const sortBy = () => fireEvent.click(within(table).getByRole('button', { name: /Searches/ }));
    const firstCell = () => within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;
    sortBy();
    expect(firstCell()).toBe('aa');
    sortBy();
    expect(firstCell()).toBe('bb');
  });
});
