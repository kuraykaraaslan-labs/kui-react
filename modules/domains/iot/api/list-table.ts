import type { DataTableFilterValue, SortState } from '@/modules/ui/Table/types';
import type { IotListSort } from './adapter';

/*
 * The kit's list views on the DataTable's own toolbar (search, Filters panel, sortable headers, rows per page and pagination,
 * `mode="manual"`): the view keeps its adapter query and hands the table the parts it draws; these map between the two.
 */

/** Rows per page a list view offers (a host's API reads at most 100). */
export const LIST_PAGE_SIZES = [10, 20, 50, 100];

/** The table's sort as the adapter's: the first column, when it is one the view sorts by. */
export function toIotSort<K extends string>(sort: readonly SortState[], keys: readonly K[]): IotListSort<K> | undefined {
  const s = sort[0];
  return s && (keys as readonly string[]).includes(s.key) ? { key: s.key as K, dir: s.dir } : undefined;
}

/** The adapter's sort as the table's (none: the host's own order, no arrow). */
export function toTableSort(sort: IotListSort | undefined): SortState[] {
  return sort ? [{ key: sort.key, dir: sort.dir }] : [];
}

export function sameSort(a: IotListSort | undefined, b: IotListSort | undefined): boolean {
  return (a?.key ?? null) === (b?.key ?? null) && (a?.dir ?? null) === (b?.dir ?? null);
}

/** A single-choice filter value, or undefined when it is not set. */
export function choiceOf<V extends string>(v: DataTableFilterValue | undefined, allowed: readonly V[]): V | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as V) : undefined;
}

/** A host URL's `sort` value (`lastSeen:desc`) as the adapter's sort; a key outside `keys` or a bad direction is dropped. */
export function sortFromParam<K extends string>(value: string | null | undefined, keys: readonly K[]): IotListSort<K> | undefined {
  const [key, dir] = (value ?? '').split(':');
  return (keys as readonly string[]).includes(key) && (dir === 'asc' || dir === 'desc') ? { key: key as K, dir } : undefined;
}

/** The adapter's sort as a host URL's `sort` value. */
export function sortToParam(sort: IotListSort | undefined): string | undefined {
  return sort ? `${sort.key}:${sort.dir}` : undefined;
}

/** A host URL's rows-per-page value, when it is one the views offer. */
export function pageSizeFromParam(value: string | null | undefined): number | undefined {
  const n = Number(value);
  return LIST_PAGE_SIZES.includes(n) ? n : undefined;
}
