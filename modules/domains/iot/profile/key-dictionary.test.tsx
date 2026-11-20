import { describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { blankProfileDraft, parseValueMap, profileDraftIssues, telemetryKeyIssues, valueMapText, type TelemetryKeySpec } from '../types/profile';
import { TelemetryKeySchemaTable, clean } from './TelemetryKeySchemaTable';

// NB iot-dashboard 07: the key dictionary on a profile's telemetry keys (scale, words), edited in the key table.
describe('key dictionary', () => {
  it('parses words typed as value=word, keeps a broken pair for the form to refuse, and one value per spelling', () => {
    expect(parseValueMap('0=Closed, 1=Open')).toEqual({ 0: 'Closed', 1: 'Open' });
    expect(parseValueMap('true = On; false = Off\nERR=Fault')).toEqual({ true: 'On', false: 'Off', ERR: 'Fault' });
    expect(parseValueMap('  ')).toBeUndefined();
    expect(parseValueMap('0=Closed, 1')).toEqual({ 0: 'Closed', 1: '' });
    expect(parseValueMap('on=A, ON=B')).toEqual({ ON: 'B' });
    expect(valueMapText({ 0: 'Closed', 1: 'Open' })).toBe('0=Closed, 1=Open');
    expect(valueMapText(undefined)).toBe('');
  });

  it('refuses a factor of 0, a scale on a non-number, a broken word and both on one key', () => {
    expect(telemetryKeyIssues({ key: 'a', scale: { factor: 0.1 } }, '')).toEqual({});
    expect(telemetryKeyIssues({ key: 'a', type: 'integer', scale: { factor: 2, offset: -40 } }, '')).toEqual({});
    expect(telemetryKeyIssues({ key: 'a', scale: { factor: 0 } }, '')).toEqual({ scale: 'invalid_value' });
    expect(telemetryKeyIssues({ key: 'a', scale: { factor: Number.NaN } }, '')).toEqual({ scale: 'invalid_value' });
    expect(telemetryKeyIssues({ key: 'a', type: 'boolean', scale: { factor: 2 } }, '')).toEqual({ scale: 'scale_needs_number' });
    expect(telemetryKeyIssues({ key: 'a', valueMap: { 0: 'Closed', 1: '' } }, '')).toEqual({ valueMap: 'invalid_value_map' });
    expect(telemetryKeyIssues({ key: 'a', valueMap: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [String(i), 'w'])) }, '')).toEqual({ valueMap: 'too_many_words' });
    expect(telemetryKeyIssues({ key: 'a', scale: { factor: 2 }, valueMap: { 0: 'Off' } }, '')).toEqual({ scale: 'scale_and_value_map' });
    const issues = profileDraftIssues({ ...blankProfileDraft('x'), telemetrySchema: [{ key: 'door', valueMap: { 0: 'Closed', 1: 'Open' } }, { key: 'x', scale: { factor: 0 } }] });
    expect(Object.keys(issues).filter((k) => k.startsWith('telemetrySchema'))).toEqual(['telemetrySchema.1.scale']);
  });

  it('clean keeps a scale and words, drops an offset of 0 and an empty map', () => {
    expect(clean({ key: 'a', scale: { factor: 0.1, offset: 0 } })).toEqual({ key: 'a', scale: { factor: 0.1 } });
    expect(clean({ key: 'a', scale: { factor: 2, offset: -40 }, quantity: { id: 'q', version: '1' } })).toEqual({ key: 'a', scale: { factor: 2, offset: -40 }, quantity: { id: 'q', version: '1' } });
    expect(clean({ key: 'a', valueMap: {} })).toEqual({ key: 'a' });
  });

  it('edits a scale and words in the key table; a words cell keeps what is typed until it parses', async () => {
    const user = userEvent.setup();
    const seen: TelemetryKeySpec[][] = [];
    function Tele() {
      const [v, setV] = useState<TelemetryKeySpec[]>([{ key: 'battery', type: 'number' }, { key: 'door', type: 'integer' }]);
      return <TelemetryKeySchemaTable value={v} onChange={(next) => { seen.push(next); setV(next); }} />;
    }
    render(<Tele />);
    await user.type(screen.getByLabelText('Multiply by battery'), '0.4');
    expect(seen.at(-1)?.[0]).toEqual({ key: 'battery', type: 'number', scale: { factor: 0.4 } });
    await user.type(screen.getByLabelText('Then add battery'), '5');
    expect(seen.at(-1)?.[0]).toEqual({ key: 'battery', type: 'number', scale: { factor: 0.4, offset: 5 } });
    // an offset alone adds to a factor of 1; both empty is no scale
    await user.clear(screen.getByLabelText('Multiply by battery'));
    expect(seen.at(-1)?.[0]).toEqual({ key: 'battery', type: 'number', scale: { factor: 1, offset: 5 } });
    await user.clear(screen.getByLabelText('Then add battery'));
    await user.clear(screen.getByLabelText('Multiply by battery'));
    expect(seen.at(-1)?.[0]).toEqual({ key: 'battery', type: 'number' });

    const words = screen.getByLabelText('Words door');
    expect(words).toHaveAttribute('placeholder', '0=Closed, 1=Open');
    await user.type(words, '0=Closed, 1=');
    expect(words).toHaveValue('0=Closed, 1=');
    expect(seen.at(-1)?.[1]).toEqual({ key: 'door', type: 'integer', valueMap: { 0: 'Closed', 1: '' } });
    await user.type(words, 'Open');
    expect(seen.at(-1)?.[1]).toEqual({ key: 'door', type: 'integer', valueMap: { 0: 'Closed', 1: 'Open' } });
    cleanup();

    render(<TelemetryKeySchemaTable value={[{ key: 'battery', scale: { factor: 0.4, offset: 5 } }, { key: 'door', valueMap: { 0: 'Closed', 1: 'Open' } }]} readOnly />);
    expect(screen.getByRole('cell', { name: '× 0.4 + 5' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0=Closed, 1=Open' })).toBeInTheDocument();
  });
});
