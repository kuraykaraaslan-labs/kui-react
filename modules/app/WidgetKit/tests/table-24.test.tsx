import { describe, it, expect } from 'vitest';
import { crc32 } from 'node:zlib';
import { render, within } from '@testing-library/react';
import { effective } from '../settings/engine';
import { columnName, toXlsxBytes, zipStored } from '../settings/xlsx';
import type { SlotData } from '../kind';
import { DATA_TABLE } from '../templates/data-table';
import { DATA_TABLE_VIEW, dropRepeats, ruleMatches, tableColumns } from '../views/DataTableView';

/** Reads a stored zip back: name → text, checking every CRC. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  let at = 0;
  while (v.getUint32(at, true) === 0x04034b50) {
    const crc = v.getUint32(at + 14, true);
    const size = v.getUint32(at + 18, true);
    const nameLen = v.getUint16(at + 26, true);
    const start = at + 30 + nameLen;
    const data = bytes.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out[dec.decode(bytes.subarray(at + 30, start))] = dec.decode(data);
    at = start + size;
  }
  return out;
}

describe('row colour rules against a sibling column', () => {
  const row = { level: 3, low: 5, armed: true, name: 'a' };
  it('compares with the row\'s own column', () => {
    expect(ruleMatches({ column: 'level', op: 'lt', valueFrom: 'column', valueColumn: 'low' }, row)).toBe(true);
    expect(ruleMatches({ column: 'level', op: 'gt', valueFrom: 'column', valueColumn: 'low' }, row)).toBe(false);
    expect(ruleMatches({ column: 'level', op: 'eq', valueFrom: 'column', valueColumn: 'low' }, { ...row, low: 3 })).toBe(true);
  });
  it('a missing other value never matches', () => {
    expect(ruleMatches({ column: 'level', op: 'lt', valueFrom: 'column', valueColumn: 'low' }, { level: 3, low: null })).toBe(false);
    expect(ruleMatches({ column: 'level', op: 'ne', valueFrom: 'column', valueColumn: 'low' }, { level: 3 })).toBe(false);
  });
  it('the gate column must be true', () => {
    const rule = { column: 'level', op: 'lt' as const, valueFrom: 'column' as const, valueColumn: 'low', gateColumn: 'armed' };
    expect(ruleMatches(rule, row)).toBe(true);
    expect(ruleMatches(rule, { ...row, armed: false })).toBe(false);
    expect(ruleMatches(rule, { ...row, armed: 'yes' })).toBe(true);
    expect(ruleMatches(rule, { ...row, armed: 0 })).toBe(false);
    expect(ruleMatches(rule, { level: 3, low: 5 })).toBe(false);
  });
  it('a rule without the new fields behaves as before', () => {
    expect(ruleMatches({ column: 'level', op: 'lt', value: '4' }, row)).toBe(true);
    expect(ruleMatches({ column: 'level', op: 'lt', value: '2' }, row)).toBe(false);
  });
});

const history: SlotData = {
  shape: 'table',
  columns: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'at', label: 'Time', type: 'date' },
    { key: 'state', label: 'State', type: 'text' },
  ],
  rows: [
    { name: 'p1', at: '2026-10-20T10:00:00Z', state: 'on' },
    { name: 'p1', at: '2026-10-20T10:01:00Z', state: 'on' },
    { name: 'p1', at: '2026-10-20T10:02:00Z', state: 'off' },
    { name: 'p1', at: '2026-10-20T10:03:00Z', state: 'off' },
    { name: 'p1', at: '2026-10-20T10:04:00Z', state: 'on' },
  ],
};

describe('history-shaped tables', () => {
  it('only changes drops a row equal to the one before it, ignoring dates', () => {
    const cols = tableColumns(history, effective(DATA_TABLE, {}));
    expect(dropRepeats(history.rows!, cols).map((r) => r.state)).toEqual(['on', 'off', 'on']);
  });
  it('is rendered, and left alone when off', () => {
    const View = DATA_TABLE_VIEW.View;
    const on = render(<View settings={effective(DATA_TABLE, { onlyChanges: true, maxRows: 50, search: false })} format={{}} data={{ rows: history }} locale="en" />);
    expect(within(on.container).getAllByRole('row')).toHaveLength(1 + 3);
    on.unmount();
    const off = render(<View settings={effective(DATA_TABLE, { maxRows: 50, search: false })} format={{}} data={{ rows: history }} locale="en" />);
    expect(within(off.container).getAllByRole('row')).toHaveLength(1 + 5);
  });
  it('the history layout puts the first date column first and keeps it in view; configured order wins', () => {
    expect(tableColumns(history, effective(DATA_TABLE, { historyLayout: true })).map((c) => c.key)).toEqual(['at', 'name', 'state']);
    expect(tableColumns(history, effective(DATA_TABLE, {})).map((c) => c.key)).toEqual(['name', 'at', 'state']);
    expect(tableColumns(history, effective(DATA_TABLE, { historyLayout: true, columns: [{ key: 'name' }, { key: 'at' }] })).map((c) => c.key)).toEqual(['name', 'at']);
    const View = DATA_TABLE_VIEW.View;
    const { container } = render(<View settings={effective(DATA_TABLE, { historyLayout: true })} format={{}} data={{ rows: history }} locale="en" />);
    expect(container.querySelector('th')?.className).toContain('sticky');
    expect(container.querySelector('tbody td')?.className).toContain('left-0');
  });
});

describe('xlsx export', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
  it('writes a valid stored zip with the parts of a workbook', () => {
    const files = unzip(toXlsxBytes([['Name', 'Level (m)'], ['A & B', '1.5'], ['=1+1', '007']], 'Pumps'));
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    expect(files['xl/workbook.xml']).toContain('name="Pumps"');
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">A &amp; B</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>1.5</v></c>');
    // a formula-looking text and a zero-padded code stay text
    expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">=1+1</t>');
    expect(sheet).toContain('<t xml:space="preserve">007</t>');
    // the header row is bold and always text
    expect(sheet).toContain('<c r="B1" s="1" t="inlineStr">');
  });
  it('strips characters XML cannot hold and a sheet name Excel refuses', () => {
    const files = unzip(toXlsxBytes([['a\u0001b']], 'a/b?c'));
    expect(files['xl/worksheets/sheet1.xml']).toContain('>ab</t>');
    expect(files['xl/workbook.xml']).toContain('name="a b c"');
  });
  it('zipStored keeps UTF-8 names and text', () => {
    expect(unzip(zipStored([['é.txt', 'İstanbul ✓']]))['é.txt']).toBe('İstanbul ✓');
  });
});
