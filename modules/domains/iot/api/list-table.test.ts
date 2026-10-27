import { describe, it, expect } from 'vitest';
import { DEVICE_SORT_KEYS } from './adapter';
import { choiceOf, pageSizeFromParam, sameSort, sortFromParam, sortToParam, toIotSort, toTableSort } from './list-table';

describe('list views on the DataTable toolbar', () => {
  it('maps the table sort onto the adapter sort: the first column only, and only a column the view sorts by', () => {
    expect(toIotSort([{ key: 'lastSeen', dir: 'desc' }, { key: 'name', dir: 'asc' }], DEVICE_SORT_KEYS)).toEqual({ key: 'lastSeen', dir: 'desc' });
    expect(toIotSort([{ key: 'profile', dir: 'asc' }], DEVICE_SORT_KEYS)).toBeUndefined();
    expect(toIotSort([], DEVICE_SORT_KEYS)).toBeUndefined();
    expect(toTableSort({ key: 'name', dir: 'asc' })).toEqual([{ key: 'name', dir: 'asc' }]);
    expect(toTableSort(undefined)).toEqual([]);
    expect(sameSort(undefined, undefined)).toBe(true);
    expect(sameSort({ key: 'name', dir: 'asc' }, { key: 'name', dir: 'desc' })).toBe(false);
  });

  it('reads a host URL: a sort outside the keys, a bad direction or an odd page size is dropped', () => {
    expect(sortFromParam('lastSeen:desc', DEVICE_SORT_KEYS)).toEqual({ key: 'lastSeen', dir: 'desc' });
    expect(sortFromParam('serial:asc', DEVICE_SORT_KEYS)).toBeUndefined();
    expect(sortFromParam('name:up', DEVICE_SORT_KEYS)).toBeUndefined();
    expect(sortFromParam(null, DEVICE_SORT_KEYS)).toBeUndefined();
    expect(sortToParam({ key: 'name', dir: 'asc' })).toBe('name:asc');
    expect(pageSizeFromParam('50')).toBe(50);
    expect(pageSizeFromParam('7')).toBeUndefined();
    expect(pageSizeFromParam(null)).toBeUndefined();
    expect(choiceOf('online', ['online', 'offline'] as const)).toBe('online');
    expect(choiceOf('x', ['online', 'offline'] as const)).toBeUndefined();
    expect(choiceOf(['online'], ['online'] as const)).toBeUndefined();
  });
});
