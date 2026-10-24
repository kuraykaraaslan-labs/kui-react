import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { KeyFilterEditor, keyNameOptions } from './KeyFilterEditor';
import { demoAccess, DEMO_KEYS } from './demo-access';
import { DEFAULT_ALIAS_MESSAGES } from './messages';
import type { BoardParamInfo, EntityAliasesAccess, KeyFilter } from './types';
import type { KeyFilterErrors } from './validate-filters';

const params: BoardParamInfo[] = [{ key: 'limit', label: 'Limit' }, { key: 'max', label: 'Max' }];

const numberFilter: KeyFilter = { key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'gt', value: 30 }] };

function Harness({
  initial,
  onChange,
  entityType,
  access = demoAccess(),
  errors,
  boardParams = params,
}: {
  initial: KeyFilter;
  onChange?: (kf: KeyFilter) => void;
  entityType?: string;
  access?: EntityAliasesAccess;
  errors?: KeyFilterErrors;
  boardParams?: BoardParamInfo[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <KeyFilterEditor
      value={value}
      onChange={(kf) => { setValue(kf); onChange?.(kf); }}
      params={boardParams}
      entityType={entityType}
      access={access}
      errors={errors}
    />
  );
}

const optionLabels = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent);
const opSelect = () => screen.getByLabelText(/^Operation/) as HTMLSelectElement;
// "Value", not "Value type" or "Values".
const VALUE = /^Value(?!s| type)/;

describe('KeyFilterEditor: operations per value type', () => {
  it('offers only the operations of the value type', () => {
    render(<Harness initial={numberFilter} />);
    expect(optionLabels(opSelect())).toEqual([
      'Equal', 'Not equal', 'Greater than', 'Greater or equal', 'Less than', 'Less or equal', 'Between', 'In', 'Not in', 'Is set', 'Is not set',
    ]);
  });

  it('a boolean key offers is true / is false and needs no value for them', () => {
    render(<Harness initial={{ ...numberFilter, valueType: 'boolean', predicates: [{ op: 'true' }] }} />);
    expect(optionLabels(opSelect())).toEqual(['Equal', 'Not equal', 'Is true', 'Is false', 'Is set', 'Is not set']);
    expect(screen.queryByLabelText(VALUE)).toBeNull();
    fireEvent.change(opSelect(), { target: { value: 'eq' } });
    const value = screen.getByLabelText(VALUE) as HTMLSelectElement;
    expect(optionLabels(value)).toEqual(['Select a value', 'True', 'False']);
  });

  it('changing the value type converts the rows (an operation the new type lacks becomes its default)', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^Value type/), { target: { value: 'string' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, valueType: 'string', predicates: [{ op: 'startsWith' }] });
    expect(optionLabels(opSelect())).toContain('Starts with');
  });
});

describe('KeyFilterEditor: value inputs', () => {
  it('between reads a value and a "to"; in / not in read value chips; is set reads nothing', () => {
    render(<Harness initial={{ ...numberFilter, predicates: [{ op: 'between', value: 1, to: 5 }] }} />);
    expect((screen.getByLabelText(VALUE) as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText(/^To/) as HTMLInputElement).value).toBe('5');
    fireEvent.change(opSelect(), { target: { value: 'in' } });
    expect(screen.getByText('Values')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^To/)).toBeNull();
    fireEvent.change(opSelect(), { target: { value: 'set' } });
    expect(screen.queryByLabelText(VALUE)).toBeNull();
    expect(screen.queryByText('Values')).toBeNull();
  });

  it('a number value is stored as a number', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(VALUE), { target: { value: '42.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, predicates: [{ op: 'gt', value: 42.5 }] });
  });

  it('ignore case is offered for text comparisons only', () => {
    const onChange = vi.fn();
    const text: KeyFilter = { key: { type: 'field', name: 'name' }, valueType: 'string', operation: 'and', predicates: [{ op: 'startsWith', value: 'Pump' }] };
    render(<Harness initial={text} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Ignore case'));
    expect(onChange).toHaveBeenLastCalledWith({ ...text, predicates: [{ op: 'startsWith', value: 'Pump', ignoreCase: true }] });
    fireEvent.change(opSelect(), { target: { value: 'set' } });
    expect(screen.queryByLabelText('Ignore case')).toBeNull();
  });

  it('a value can read a dashboard parameter: { $param: key }', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    const toggle = screen.getByRole('button', { name: 'Use a dashboard parameter: Value' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, predicates: [{ op: 'gt', value: { $param: 'limit' } }] });
    const select = screen.getByLabelText(VALUE) as HTMLSelectElement;
    expect(optionLabels(select)).toEqual(['Select a parameter', 'Limit', 'Max']);
    fireEvent.change(select, { target: { value: 'max' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, predicates: [{ op: 'gt', value: { $param: 'max' } }] });
    // Back to a fixed value: the value is cleared.
    fireEvent.click(screen.getByRole('button', { name: 'Use a dashboard parameter: Value' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, predicates: [{ op: 'gt' }] });
  });

  it('cannot switch to a parameter on a board without parameters', () => {
    render(<Harness initial={numberFilter} boardParams={[]} />);
    expect(screen.getByRole('button', { name: 'Use a dashboard parameter: Value' })).toBeDisabled();
  });
});

describe('KeyFilterEditor: key', () => {
  it('shows the attribute scope only for an attribute key', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    expect(screen.queryByLabelText(/^Attribute scope/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Key type/), { target: { value: 'attribute' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, key: { type: 'attribute', name: 'temperature', scope: 'any' } });
    expect(optionLabels(screen.getByLabelText(/^Attribute scope/))).toEqual(['Any scope', 'Client', 'Shared', 'Server']);
    fireEvent.change(screen.getByLabelText(/^Key type/), { target: { value: 'field' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, key: { type: 'field', name: 'temperature' } });
  });

  it('without an entity type the key name is typed', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^Key name/), { target: { value: 'humidity' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, key: { type: 'telemetry', name: 'humidity' } });
  });

  it("suggests the entity type's keys and presets the value type from the chosen key", async () => {
    const onChange = vi.fn();
    const access = demoAccess();
    const spy = vi.spyOn(access, 'entityKeys');
    const text: KeyFilter = { key: { type: 'telemetry', name: '' }, valueType: 'string', operation: 'and', predicates: [{ op: 'startsWith' }] };
    render(<Harness initial={text} onChange={onChange} entityType="iot_device" access={access} />);
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'temp' } });
    fireEvent.click(await screen.findByRole('button', { name: /^temperature/ }));
    expect(spy).toHaveBeenCalledWith('iot_device', 'temp');
    expect(onChange).toHaveBeenLastCalledWith({ key: { type: 'telemetry', name: 'temperature' }, valueType: 'number', operation: 'and', predicates: [{ op: 'eq' }] });
  });

  it('offers a typed name the host does not know', async () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} entityType="iot_device" />);
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'flowRate' } });
    fireEvent.click(await screen.findByRole('button', { name: /flowRate.*Use this name/ }));
    expect(onChange).toHaveBeenLastCalledWith({ ...numberFilter, key: { type: 'telemetry', name: 'flowRate' } });
  });

  it('shows the errors under their fields', () => {
    render(<Harness initial={{ ...numberFilter, predicates: [{ op: 'gt' }] }} errors={{ 'key.name': 'required', 'predicates.0.value': 'required' }} />);
    expect(screen.getByText('Key name is required.')).toBeInTheDocument();
    expect(screen.getByText('A value is required.')).toBeInTheDocument();
  });

  it('joins several conditions by the chosen operation and caps them at 4', () => {
    const onChange = vi.fn();
    render(<Harness initial={numberFilter} onChange={onChange} />);
    expect(screen.queryByLabelText(/^Conditions are joined by/)).toBeNull();
    const add = screen.getByRole('button', { name: 'Add condition' });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(add);
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Conditions are joined by/), { target: { value: 'or' } });
    expect(onChange.mock.lastCall?.[0].operation).toBe('or');
    expect(screen.getAllByText('or')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove condition 4' }));
    expect(add).not.toBeDisabled();
  });
});

describe('keyNameOptions', () => {
  it('keeps the keys of the chosen type and scope, one per name, the typed text first', () => {
    const m = DEFAULT_ALIAS_MESSAGES;
    const attrs = keyNameOptions(DEMO_KEYS.iot_device, '', 'attribute', 'any', m).options.map((o) => o.value);
    expect(attrs).toEqual(['active', 'lastActivityTime', 'firmwareVersion', 'threshold']);
    expect(keyNameOptions(DEMO_KEYS.iot_device, '', 'attribute', 'server', m).options.map((o) => o.value)).toEqual(['active', 'lastActivityTime']);
    const typed = keyNameOptions(DEMO_KEYS.iot_device, 'rpm', 'telemetry', undefined, m).options;
    expect(typed[0]).toEqual({ value: 'rpm', label: 'rpm', description: 'Use this name' });
    expect(keyNameOptions(DEMO_KEYS.iot_device, 'status', 'telemetry', undefined, m).options.filter((o) => o.value === 'status')).toHaveLength(1);
    expect(keyNameOptions(DEMO_KEYS.iot_device, '', 'telemetry', undefined, m).options[0].description).toBe('Temperature · Number');
  });
});
