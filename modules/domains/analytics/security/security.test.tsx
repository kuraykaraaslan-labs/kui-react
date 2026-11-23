import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { demoSecuritySnapshot } from './demo';
import { DEFAULT_SECURITY_SUMMARY_MESSAGES as M } from './messages';
import { SecuritySnapshotSchema, type SecuritySnapshot } from './types';
import {
  countryLabel, dayValue, fillDays, emptyRefusalDay, keyLabel, neutralDelta, overviewDays, rangeDates, securityKpis,
  securityStatus, securityStatusText, shareRows, sortAlerts, viewChoices,
} from './summary';
import { SecuritySummaryView } from './SecuritySummaryView';
import { SecurityStatusLine } from './SecurityStatusLine';

const base = (over: Partial<SecuritySnapshot> = {}): SecuritySnapshot =>
  SecuritySnapshotSchema.parse({ range: { start: '2026-11-01', end: '2026-11-03', days: 3 }, ...over });

describe('contract', () => {
  it('fills every block from defaults: zeros, no days, server off', () => {
    const s = base();
    expect(s.refusals.total).toBe(0);
    expect(s.signIn.totals).toEqual({ failedPasswords: 0, failedSecondSteps: 0, lockouts: 0, recoveryCodesUsed: 0, staffSignIns: 0, enrolments: 0 });
    expect(s.server.state).toBe('off');
    expect(s.server.bans.days).toEqual([]);
    expect(s.recent).toEqual({ keep: 100, items: [] });
    expect(s.retentionMonths).toBe(13);
  });

  it('the demo parses as a snapshot and is deterministic', () => {
    const a = demoSecuritySnapshot();
    expect(SecuritySnapshotSchema.parse(a)).toEqual(a);
    expect(demoSecuritySnapshot()).toEqual(a);
    expect(a.refusals.days).toHaveLength(30);
    expect(a.refusals.total).toBe(a.refusals.days.reduce((s, d) => s + d.total, 0));
    // daily breakdowns add up to the day's total
    for (const d of a.refusals.days) {
      expect(Object.values(d.bySurface).reduce((s, n) => s + n, 0)).toBe(d.total);
      expect(Object.values(d.byReason).reduce((s, n) => s + n, 0)).toBe(d.total);
    }
  });

  it('the counters hold no address: only the recent list has IPs', () => {
    const s = demoSecuritySnapshot();
    const { recent, ...counters } = s;
    expect(JSON.stringify(counters)).not.toMatch(/\d+\.\d+\.\d+\.\d+|2001:db8/);
    expect(recent.items.every((r) => r.ip !== '')).toBe(true);
  });
});

describe('status', () => {
  const alert = (kind: 'integrity' | 'health', state: 'open' | 'resolved') => ({ kind, key: kind, title: '', state, openedAt: '2026-11-02T10:00:00Z', resolvedAt: state === 'resolved' ? '2026-11-02T11:00:00Z' : null });
  it('no server report: off; resolved alerts only: ok', () => {
    expect(securityStatus(base()).tone).toBe('off');
    expect(securityStatusText(securityStatus(base()), M)).toBe(M.statusOff);
    const ok = base({ server: { state: 'ok', lastReportAt: null, bans: { total: 0, days: [], byJail: [] }, alerts: [alert('health', 'resolved')] } });
    expect(securityStatus(ok)).toEqual({ tone: 'ok', integrityOpen: 0, healthOpen: 0 });
    expect(securityStatusText(securityStatus(ok), M)).toBe('No alerts open');
  });
  it('an open integrity alert is critical, a health alert a warning; words count both', () => {
    const s = base({ server: { state: 'ok', lastReportAt: null, bans: { total: 0, days: [], byJail: [] }, alerts: [alert('integrity', 'open'), alert('health', 'open'), alert('health', 'open')] } });
    const st = securityStatus(s);
    expect(st).toEqual({ tone: 'critical', integrityOpen: 1, healthOpen: 2 });
    expect(securityStatusText(st, M)).toBe('1 integrity alert open · 2 health alerts open');
    expect(securityStatus(demoSecuritySnapshot({ open: 'health' })).tone).toBe('warning');
    expect(securityStatusText(securityStatus(demoSecuritySnapshot({ open: 'health' })), M)).toBe('1 health alert open');
  });
  it('sortAlerts: open first, newest first', () => {
    const list = sortAlerts([
      { state: 'resolved', openedAt: '2026-11-03' }, { state: 'open', openedAt: '2026-11-01' }, { state: 'resolved', openedAt: '2026-11-05' }, { state: 'open', openedAt: '2026-11-04' },
    ]);
    expect(list.map((a) => `${a.state}:${a.openedAt}`)).toEqual(['open:2026-11-04', 'open:2026-11-01', 'resolved:2026-11-05', 'resolved:2026-11-03']);
  });
});

describe('helpers', () => {
  it('shareRows: shares, largest first, ties in the fixed order, empty rows dropped', () => {
    const rows = shareRows([{ key: 'contact', count: 2 }, { key: 'signin', count: 2 }, { key: 'zzz', count: 4 }, { key: 'api', count: 0 }, { key: 'chat', count: 0, previous: 3 }], ['signin', 'contact']);
    expect(rows.map((r) => [r.key, r.share])).toEqual([['zzz', 0.5], ['signin', 0.25], ['contact', 0.25], ['chat', 0]]);
    expect(shareRows([])).toEqual([]);
  });
  it('rangeDates and fillDays: every day, missing ones empty, across a month end', () => {
    expect(rangeDates({ start: '2026-10-30', end: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(rangeDates({ start: '2026-11-02', end: '2026-11-01' })).toEqual([]);
    const filled = fillDays({ start: '2026-11-01', end: '2026-11-03' }, [{ date: '2026-11-02', total: 5, bySurface: { signin: 5 }, byReason: {} }], emptyRefusalDay);
    expect(filled.map((d) => d.total)).toEqual([0, 5, 0]);
  });
  it('dayValue reads all, a breakdown key or a plain metric', () => {
    const d = { date: 'x', total: 7, bySurface: { signin: 3 }, byReason: { country: 7 }, failedPasswords: 2 };
    expect(dayValue(d, 'all')).toBe(7);
    expect(dayValue(d, 'bySurface:signin')).toBe(3);
    expect(dayValue(d, 'bySurface:contact')).toBe(0);
    expect(dayValue(d, 'failedPasswords')).toBe(2);
  });
  it('viewChoices: All, known keys in order, then others', () => {
    expect(viewChoices([{ key: 'x-new', count: 1 }, { key: 'contact', count: 3 }, { key: 'signin', count: 1 }, { key: 'api', count: 0 }], 'bySurface', ['signin', 'contact', 'api']))
      .toEqual(['all', 'bySurface:signin', 'bySurface:contact', 'bySurface:x-new']);
  });
  it('neutralDelta: direction only, no verdict; nothing to compare is null', () => {
    expect(neutralDelta(12, 10)).toEqual({ change: 0.2, good: null });
    expect(neutralDelta(5, 0)).toBeNull();
    expect(neutralDelta(5, undefined)).toBeNull();
  });
  it('overviewDays adds passwords and second steps; KPIs include bans only with a server', () => {
    const s = base({
      refusals: { total: 4, days: [{ date: '2026-11-02', total: 4, bySurface: {}, byReason: {} }], bySurface: [], byReason: [], topCountries: [] },
      signIn: { totals: { failedPasswords: 3, failedSecondSteps: 1, lockouts: 0, recoveryCodesUsed: 0, staffSignIns: 2, enrolments: 0 }, previousTotals: { failedPasswords: 1 }, days: [{ date: '2026-11-01', failedPasswords: 3, failedSecondSteps: 1, lockouts: 0, recoveryCodesUsed: 0, staffSignIns: 2, enrolments: 0 }] },
    });
    expect(overviewDays(s)).toEqual([
      { date: '2026-11-01', refusals: 0, failedSignIns: 4, spam: 0 },
      { date: '2026-11-02', refusals: 4, failedSignIns: 0, spam: 0 },
      { date: '2026-11-03', refusals: 0, failedSignIns: 0, spam: 0 },
    ]);
    expect(securityKpis(s).map((k) => k.key)).toEqual(['refusals', 'failedSignIns', 'lockouts', 'spamCaught', 'staffSignIns']);
    expect(securityKpis(s)[1]).toEqual({ key: 'failedSignIns', current: 4, previous: 1 });
    expect(securityKpis(demoSecuritySnapshot()).map((k) => k.key)).toContain('bans');
  });
  it('labels: known keys translated, unknown keys as they are; countries by name', () => {
    expect(keyLabel(M, 'surface', 'signin')).toBe('Sign-in');
    expect(keyLabel(M, 'reason', 'country-cap')).toBe('Country cap');
    expect(keyLabel(M, 'surface', 'webhook')).toBe('webhook');
    expect(countryLabel('de', 'en-US', 'Unknown')).toBe('Germany');
    expect(countryLabel('', 'en-US', 'Unknown')).toBe('Unknown');
  });
});

describe('SecuritySummaryView', () => {
  it('shows the status line, KPIs and the overview chart table', () => {
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot({ open: 'integrity' })} locale="en-US" />);
    expect(screen.getByRole('status')).toHaveTextContent('1 integrity alert open');
    expect(screen.getByRole('heading', { name: 'Security summary' })).toBeInTheDocument();
    expect(screen.getAllByText('Refusals').length).toBeGreaterThan(0);
    expect(screen.getByText('Server bans')).toBeInTheDocument();
    expect(screen.getAllByText('Show the numbers as a table').length).toBeGreaterThan(0);
  });

  it('server off: the Server tab explains, the KPIs drop bans', () => {
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot({ server: 'off' })} locale="en-US" defaultTab="server" />);
    expect(screen.getByText('The server has not reported yet')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(M.statusOff);
  });

  it('the recent tab says the list holds IP addresses and shows them', () => {
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot()} locale="en-US" defaultTab="recent" />);
    expect(screen.getByText(/This list holds IP addresses: the last 100 refusals/)).toBeInTheDocument();
    expect(screen.getByText(/kept 13 months/)).toBeInTheDocument();
    expect(screen.getAllByText('203.0.113.24').length).toBeGreaterThan(0);
  });

  it('the refusals picker switches the chart to one action', () => {
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot()} locale="en-US" defaultTab="refusals" />);
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(within(select).getByRole('option', { name: 'By action: Sign-in' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'bySurface:signin' } });
    expect(select.value).toBe('bySurface:signin');
  });

  it('range buttons ask the host for a new range', () => {
    const asked: number[] = [];
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot()} locale="en-US" rangeOptions={[7, 30, 90]} onRangeChange={(d) => asked.push(d)} />);
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(asked).toEqual([7]);
  });

  it('quiet site: empty spam says so', () => {
    render(<SecuritySummaryView snapshot={demoSecuritySnapshot({ quiet: true })} locale="en-US" defaultTab="spam" />);
    expect(screen.getAllByText('Nothing recorded in this period.').length).toBeGreaterThan(0);
  });

  it('translated words reach the status line', () => {
    render(<SecurityStatusLine tone="ok" text="Keine offenen Warnungen" label="Status" />);
    expect(screen.getByRole('status')).toHaveTextContent('Status: Keine offenen Warnungen');
  });
});
