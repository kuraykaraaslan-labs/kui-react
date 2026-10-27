import { ASSET_SORT_KEYS, type AssetListQuery } from '../api/adapter';
import { pageSizeFromParam, sortFromParam, sortToParam } from '../api/list-table';

/*
 * The Sites & assets page's query in a host URL (shareable, like the device list): `page`, `size` (when not the default), `sort`
 * (`devices:desc`), `q`, `kind`, `site`, `alarmed=true`, and the open drawers, `asset=<id>` and `map=1`. Pure; a value the view does not
 * know is dropped. `asset` is also the old tree page's deep link (`?asset=<id>`), which now opens that asset's drawer.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const KIND = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;

/** The query a host URL names (`page` from 1; the rows per page only when the view offers that size). */
export function assetQueryFromParams(sp: URLSearchParams): Partial<AssetListQuery> {
  const id = (k: string) => { const v = sp.get(k); return v && ID.test(v) ? v : undefined; };
  const kind = sp.get('kind');
  return {
    page: Math.max(1, Number(sp.get('page')) || 1),
    pageSize: pageSizeFromParam(sp.get('size')),
    sort: sortFromParam(sp.get('sort'), ASSET_SORT_KEYS),
    search: sp.get('q')?.trim() || undefined,
    kind: kind && KIND.test(kind) ? kind.toUpperCase() : undefined,
    site: id('site'),
    alarmed: sp.get('alarmed') === 'true' ? true : undefined,
    asset: id('asset'),
    map: sp.get('map') === '1' ? true : undefined,
  };
}

/** The query as a host URL's search part (`?…`, or '' when it says nothing); `defaultPageSize` is left out. */
export function assetQueryToParams(q: AssetListQuery, defaultPageSize = 20): string {
  const p = new URLSearchParams();
  if (q.page > 1) p.set('page', String(q.page));
  if (q.pageSize !== defaultPageSize) p.set('size', String(q.pageSize));
  const sort = sortToParam(q.sort);
  if (sort) p.set('sort', sort);
  if (q.search) p.set('q', q.search);
  if (q.kind) p.set('kind', q.kind);
  if (q.site) p.set('site', q.site);
  if (q.alarmed) p.set('alarmed', 'true');
  if (q.asset) p.set('asset', q.asset);
  if (q.map) p.set('map', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}
