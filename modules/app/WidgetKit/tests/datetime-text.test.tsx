import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { effective } from '../settings/engine';
import { formatDateTimeText } from '../settings/style';
import type { SlotData } from '../kind';
import { STATE } from '../templates/state';
import { STAT_VALUE } from '../templates/stat-value';
import { STATE_VIEW, evaluateState, stateModel } from '../views/StateView';
import { STAT_VALUE_VIEW, statValueModel } from '../views/StatValueView';

// next-boilerplate e2e run 1 (E12, S04-J13-2): a State card read "2026-10-31T08:03:59.266Z" for the last cleaning. A device stores a time as text; a State or
// Stat card shows it as a date and time in the viewer's language.
const ISO = '2026-10-31T08:03:59.266Z';
const shown = (locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(ISO));
const scalar = (value: unknown): Record<string, SlotData> => ({ value: { shape: 'scalar', value: value as never } });

describe('formatDateTimeText', () => {
  it('an ISO date and time (Z, an offset, local, seconds or not) is a date and time in the viewer\'s language', () => {
    expect(formatDateTimeText(ISO, 'en')).toBe(shown('en'));
    expect(formatDateTimeText(ISO, 'tr')).toBe(shown('tr'));
    expect(formatDateTimeText(ISO, 'tr')).not.toBe(formatDateTimeText(ISO, 'en'));
    expect(formatDateTimeText(` ${ISO} `, 'en')).toBe(shown('en'));
    for (const v of ['2026-10-31T08:03:59+03:00', '2026-10-31T08:03:59+0300', '2026-10-31T08:03', '2026-10-31T08:03:59']) {
      expect(formatDateTimeText(v, 'en'), v).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(v)));
    }
  });

  it('anything else is null: a number, a date or a time alone, a word, an impossible date, a long text, nothing', () => {
    for (const v of [1730361839266, '2026-10-31', '08:03', 'RUNNING', '2026-13-45T08:03:00Z', `${ISO}${' '.repeat(40)}x`, `${ISO}x`, '', null, undefined, true, {}]) {
      expect(formatDateTimeText(v, 'en'), String(v)).toBeNull();
    }
  });
});

describe('a State card', () => {
  it('names an unmatched time by its date and time, and a rule still matches the value as sent', () => {
    const s = effective(STATE, {});
    expect(evaluateState(ISO, s, false, 'Unknown', undefined, undefined, 'en').label).toBe(shown('en'));
    expect(evaluateState(ISO, s, false, 'Unknown', undefined, undefined, 'tr').label).toBe(shown('tr'));
    // a rule with no label of its own shows the value: the time, as a time
    expect(evaluateState(ISO, effective(STATE, { states: [{ match: ISO, color: '#00aa00' }] }), false, 'Unknown', undefined, undefined, 'en')).toMatchObject({ label: shown('en'), matched: true });
    // the card's own fallback words still win; any other text is as it was
    expect(evaluateState(ISO, effective(STATE, { fallbackLabel: 'Cleaned' }), false, 'Unknown', undefined, undefined, 'en').label).toBe('Cleaned');
    expect(evaluateState('RUNNING', s, false, 'Unknown', undefined, undefined, 'en').label).toBe('RUNNING');
  });

  it('draws the time in the state\'s place and in the raw value part', () => {
    const View = STATE_VIEW.View;
    const { container } = render(<View settings={effective(STATE, { showValue: true })} format={{}} data={scalar(ISO)} locale="en" />);
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe(shown('en'));
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe(shown('en'));
    expect(container.textContent).not.toContain(ISO);
    expect(stateModel(effective(STATE, { showValue: true }) as never, scalar(42), false, 'Unknown', undefined, 'en').valueText).toBe('42');
  });
});

describe('a Stat card', () => {
  it('shows a time sent as text as a date and time with no unit, where it showed a dash; a number as before', () => {
    expect(statValueModel({}, { unit: 'kWh', decimals: 1 }, scalar(ISO), 'tr')).toMatchObject({ metricText: shown('tr'), metricUnit: undefined, value: null });
    expect(statValueModel({}, { unit: 'kWh', decimals: 1 }, scalar(12.34), 'en')).toMatchObject({ metricText: '12.3', metricUnit: 'kWh' });
    // any other text is as it was (a dash: the Stat card shows numbers)
    expect(statValueModel({}, {}, scalar('RUNNING'), 'en').metricText).toBe('—');
    const View = STAT_VALUE_VIEW.View;
    const { container } = render(<View settings={effective(STAT_VALUE, {})} format={{}} data={scalar(ISO)} locale="en" />);
    expect(container.textContent).toContain(shown('en'));
    expect(container.textContent).not.toContain(ISO);
  });
});
