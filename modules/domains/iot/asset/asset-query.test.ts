import { describe, it, expect } from 'vitest';
import { assetQueryFromParams, assetQueryToParams } from './asset-query';

describe('the Sites & assets query in a URL', () => {
  it('reads the filters, the sort and the open drawers, and drops what the view does not know', () => {
    expect(assetQueryFromParams(new URLSearchParams('page=2&size=50&sort=alarms:desc&q=floor&kind=building&site=s1&alarmed=true&asset=a1&map=1'))).toEqual({
      page: 2, pageSize: 50, sort: { key: 'alarms', dir: 'desc' }, search: 'floor', kind: 'BUILDING', site: 's1', alarmed: true, asset: 'a1', map: true,
    });
    const odd = assetQueryFromParams(new URLSearchParams('page=-3&size=7&sort=path:asc&kind=a%20b&site=%3Cx%3E&alarmed=yes&map=true'));
    expect(odd).toEqual({ page: 1, pageSize: undefined, sort: undefined, search: undefined, kind: undefined, site: undefined, alarmed: undefined, asset: undefined, map: undefined });
  });

  it('writes only what differs from the defaults, and round-trips', () => {
    expect(assetQueryToParams({ page: 1, pageSize: 20 })).toBe('');
    const q = { page: 3, pageSize: 50, sort: { key: 'devices' as const, dir: 'asc' as const }, search: 'line', kind: 'LINE', site: 's1', alarmed: true, asset: 'a1', map: true };
    const s = assetQueryToParams(q);
    expect(s).toBe('?page=3&size=50&sort=devices%3Aasc&q=line&kind=LINE&site=s1&alarmed=true&asset=a1&map=1');
    expect(assetQueryFromParams(new URLSearchParams(s.slice(1)))).toEqual(q);
  });
});
