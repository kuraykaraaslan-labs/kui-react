import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { effective } from '../settings/engine';
import type { SlotData } from '../kind';
import { STATE } from '../templates/state';
import { STATE_VIEW, evaluateState } from '../views/StateView';

const states = [
  { match: 'RUNNING', label: 'Running', color: '#00aa00' },
  { match: 'STOPPED', label: 'Stopped', color: '#cc0000', lit: false },
];

function lamp(value: unknown, stored: Record<string, unknown> = {}, meta?: SlotData['meta']) {
  const View = STATE_VIEW.View;
  const data: Record<string, SlotData> = { value: { shape: 'scalar', value: value as never, ...(meta ? { meta } : {}) } };
  return render(<View settings={effective(STATE, { layout: 'lamp', states, ...stored })} format={{}} data={data} locale="en" />);
}

describe('state lamp layout', () => {
  it('a matched state lights the lamp in its colour, with the word under it', () => {
    const { container } = lamp('RUNNING');
    const el = container.querySelector('[data-part="lamp"]')!;
    expect(el.getAttribute('data-lit')).toBe('true');
    expect((el.lastElementChild as HTMLElement).style.background).toContain('rgb(0, 170, 0)');
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('Running');
    expect(container.querySelector('[data-part="label"]')?.className).not.toContain('sr-only');
  });
  it('a rule can say the state is not lit; the dim colour is drawn', () => {
    expect(evaluateState('STOPPED', effective(STATE, { states })).lit).toBe(false);
    const { container } = lamp('STOPPED', { lampDim: '#222222' });
    const el = container.querySelector('[data-part="lamp"]')!;
    expect(el.getAttribute('data-lit')).toBe('false');
    expect((el.lastElementChild as HTMLElement).style.background).toContain('rgb(34, 34, 34)');
  });
  it('an unknown state is dim, never lit', () => {
    const { container } = lamp(null);
    expect(container.querySelector('[data-part="lamp"]')?.getAttribute('data-lit')).toBe('false');
  });
  it('the label can be hidden but stays for assistive technology', () => {
    const { container } = lamp('RUNNING', { lampLabel: false });
    expect(container.querySelector('[data-part="label"]')?.className).toContain('sr-only');
  });
  it('takes the state from the source value map when no rule matches', () => {
    const { container } = lamp('IDLE', {}, { valueMap: { IDLE: { label: 'Idle', color: '#ffaa00' } } });
    expect(container.querySelector('[data-part="label"]')?.textContent).toBe('Idle');
    expect(container.querySelector('[data-part="lamp"]')?.getAttribute('data-lit')).toBe('true');
  });
  it('the size is bounded', () => {
    const { container } = lamp('RUNNING', { lampSize: 80 });
    expect((container.querySelector('[data-part="lamp"]') as HTMLElement).style.width).toBe('80px');
  });
});
