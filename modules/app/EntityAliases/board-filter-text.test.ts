import { describe, it, expect } from 'vitest';
import { boardFilterText, defaultFormatDateTime, keyFilterText } from './board-filter-text';
import type { BoardParamInfo, KeyFilter, KeyFilterPredicate } from './types';

const params: BoardParamInfo[] = [{ key: 'limit', label: 'limit' }, { key: 'since', label: 'start time' }];
const opts = { params };

const telemetry = (p: KeyFilterPredicate[], operation: KeyFilter['operation'] = 'and'): KeyFilter => ({
  key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation, predicates: p,
});
const field = (p: KeyFilterPredicate[], valueType: KeyFilter['valueType'] = 'string'): KeyFilter => ({
  key: { type: 'field', name: 'name' }, valueType, operation: 'and', predicates: p,
});
const one = (kf: KeyFilter) => boardFilterText({ keyFilters: [kf] }, opts);

describe('boardFilterText', () => {
  it('joins key filters with "and"', () => {
    const status: KeyFilter = { key: { type: 'telemetry', name: 'status' }, valueType: 'string', operation: 'and', predicates: [{ op: 'eq', value: 'ACTIVE' }] };
    expect(boardFilterText({ keyFilters: [telemetry([{ op: 'gt', value: 30 }]), status] }, opts)).toBe(
      "temperature (latest) > 30 and status (latest) = 'ACTIVE'",
    );
  });

  it('says so when there is no key filter', () => {
    expect(boardFilterText({ keyFilters: [] }, opts)).toBe('No filter specified');
    expect(boardFilterText(null, opts)).toBe('No filter specified');
  });

  it('names the key by its type and scope', () => {
    const attr = (scope?: 'any' | 'client' | 'shared' | 'server'): KeyFilter => ({
      key: { type: 'attribute', name: 'active', ...(scope ? { scope } : {}) }, valueType: 'boolean', operation: 'and', predicates: [{ op: 'true' }],
    });
    expect(one(attr())).toBe('active (attribute) is true');
    expect(one(attr('any'))).toBe('active (attribute) is true');
    expect(one(attr('server'))).toBe('active (server attribute) is true');
    expect(one(attr('client'))).toBe('active (client attribute) is true');
    expect(one(attr('shared'))).toBe('active (shared attribute) is true');
    expect(one(field([{ op: 'set' }]))).toBe('name is set');
  });

  it('writes every number operation', () => {
    const cases: Array<[KeyFilterPredicate, string]> = [
      [{ op: 'eq', value: 30 }, 'temperature (latest) = 30'],
      [{ op: 'ne', value: 30 }, 'temperature (latest) ≠ 30'],
      [{ op: 'gt', value: 30 }, 'temperature (latest) > 30'],
      [{ op: 'gte', value: 30 }, 'temperature (latest) ≥ 30'],
      [{ op: 'lt', value: -5.5 }, 'temperature (latest) < -5.5'],
      [{ op: 'lte', value: 0 }, 'temperature (latest) ≤ 0'],
      [{ op: 'between', value: 10, to: 20 }, 'temperature (latest) between 10 and 20'],
      [{ op: 'in', values: ['1', '2'] }, 'temperature (latest) in (1, 2)'],
      [{ op: 'notIn', values: ['3'] }, 'temperature (latest) not in (3)'],
      [{ op: 'set' }, 'temperature (latest) is set'],
      [{ op: 'unset' }, 'temperature (latest) is not set'],
    ];
    for (const [p, text] of cases) expect(one(telemetry([p]))).toBe(text);
  });

  it('writes every string operation, quoting the values, with ignore case', () => {
    const cases: Array<[KeyFilterPredicate, string]> = [
      [{ op: 'eq', value: 'Pump 1' }, "name = 'Pump 1'"],
      [{ op: 'ne', value: 'Pump 1' }, "name ≠ 'Pump 1'"],
      [{ op: 'startsWith', value: 'Pump', ignoreCase: true }, "name starts with 'Pump' (ignore case)"],
      [{ op: 'endsWith', value: 'A' }, "name ends with 'A'"],
      [{ op: 'contains', value: 'mp' }, "name contains 'mp'"],
      [{ op: 'notContains', value: 'x' }, "name does not contain 'x'"],
      [{ op: 'in', values: ['A', 'B'], ignoreCase: true }, "name in ('A', 'B') (ignore case)"],
      [{ op: 'notIn', values: ['C'] }, "name not in ('C')"],
      [{ op: 'unset' }, 'name is not set'],
    ];
    for (const [p, text] of cases) expect(one(field([p]))).toBe(text);
  });

  it('writes the boolean operations', () => {
    const b = (p: KeyFilterPredicate): KeyFilter => ({ key: { type: 'telemetry', name: 'alarm' }, valueType: 'boolean', operation: 'and', predicates: [p] });
    expect(one(b({ op: 'true' }))).toBe('alarm (latest) is true');
    expect(one(b({ op: 'false' }))).toBe('alarm (latest) is false');
    expect(one(b({ op: 'eq', value: true }))).toBe('alarm (latest) = true');
    expect(one(b({ op: 'ne', value: false }))).toBe('alarm (latest) ≠ false');
  });

  it('writes a date-time as a locale-free UTC time, or with the host formatter', () => {
    const d: KeyFilter = { key: { type: 'field', name: 'createdTime' }, valueType: 'datetime', operation: 'and', predicates: [{ op: 'gte', value: '2026-10-24T10:30:00.000Z' }] };
    expect(one(d)).toBe('createdTime ≥ 2026-10-24 10:30 UTC');
    expect(boardFilterText({ keyFilters: [d] }, { params, formatDateTime: () => '24 Oct' })).toBe('createdTime ≥ 24 Oct');
    expect(defaultFormatDateTime('2026-10-24T10:30:00+03:00')).toBe('2026-10-24 10:30 +03:00');
    expect(defaultFormatDateTime('not a date')).toBe('not a date');
  });

  it("shows a dashboard parameter value as \"the dashboard's <label>\"", () => {
    expect(one(telemetry([{ op: 'gt', value: { $param: 'limit' } }]))).toBe("temperature (latest) > the dashboard's limit");
    expect(one(telemetry([{ op: 'between', value: 0, to: { $param: 'limit' } }]))).toBe("temperature (latest) between 0 and the dashboard's limit");
    // A parameter the board no longer has is shown by its key.
    expect(one(telemetry([{ op: 'gt', value: { $param: 'gone' } }]))).toBe("temperature (latest) > the dashboard's gone");
  });

  it("joins one key filter's predicates by its operation, with brackets around an \"or\" among several key filters", () => {
    const range = telemetry([{ op: 'lt', value: 0 }, { op: 'gt', value: 40 }], 'or');
    expect(one(range)).toBe('temperature (latest) < 0 or temperature (latest) > 40');
    expect(boardFilterText({ keyFilters: [range, field([{ op: 'startsWith', value: 'Pump' }])] }, opts)).toBe(
      "(temperature (latest) < 0 or temperature (latest) > 40) and name starts with 'Pump'",
    );
    expect(keyFilterText(telemetry([{ op: 'gt', value: 0 }, { op: 'lt', value: 40 }]), { ...opts, inGroup: true })).toBe(
      'temperature (latest) > 0 and temperature (latest) < 40',
    );
  });

  it('marks what is not filled in yet', () => {
    expect(one({ key: { type: 'telemetry', name: '' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt' }] })).toBe('? (latest) > ?');
    expect(one(field([{ op: 'in', values: [] }]))).toBe('name in (?)');
  });

  it('takes the wording from the messages', () => {
    const text = boardFilterText(
      { keyFilters: [telemetry([{ op: 'gt', value: { $param: 'limit' } }])] },
      { params, messages: { textOps: { gt: 'exceeds' }, textParamValue: (l) => `the board value '${l}'` } },
    );
    expect(text).toBe("temperature (latest) exceeds the board value 'limit'");
  });
});
