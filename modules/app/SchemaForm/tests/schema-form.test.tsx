import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SchemaForm } from '../SchemaForm';
import { SchemaFormProvider } from '../schema-form.context';
import { validateSchemaValues } from '../validate';
import { resolveVariants, variantOf, type FieldSchema } from '../types';

const schema: Record<string, FieldSchema> = {
  title: { label: 'Title', type: 'text', required: true },
  showIcon: { label: 'Show icon', type: 'boolean' },
  icon: { label: 'Icon name', type: 'text', showIf: { showIcon: true }, group: 'Appearance' },
  tags: { label: 'Tags', type: 'multi-select', options: ['a', 'b'] },
  items: { label: 'Items', type: 'repeater', fields: { name: { label: 'Name', type: 'text' } } },
  pic: { label: 'Picture', type: 'media' },
};

afterEach(() => vi.useRealTimers());

describe('SchemaForm', () => {
  it('hides showIf fields until the condition holds and groups the rest', () => {
    render(<SchemaForm schema={schema} values={{ title: 'x' }} onChange={() => {}} debounceMs={0} />);
    expect(screen.queryByLabelText('Icon name')).toBeNull();
    fireEvent.click(screen.getByLabelText('Enabled'));
    expect(screen.getByLabelText('Icon name')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
  });

  it('never draws a hidden field and hands its stored value back unchanged when another field is edited', () => {
    const onChange = vi.fn();
    const hiddenSchema: Record<string, FieldSchema> = {
      title: { label: 'Title', type: 'text' },
      map: { label: 'Element to item map', type: 'json', advanced: true, hidden: true },
    };
    render(<SchemaForm schema={hiddenSchema} values={{ title: 'a', map: { cb: 'i2' } }} onChange={onChange} debounceMs={0} />);
    expect(screen.queryByText('Element to item map')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'b' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'b', map: { cb: 'i2' } }));
  });

  it('debounces onChange', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} values={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Hi' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hi' }));
  });

  // next-boilerplate e2e run 1: a gauge's "Maximum 1100" and a chart's "Keys: auto" were lost when the form closed inside the debounce
  it('a pending edit is written when the form goes away, not lost with its timer', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { unmount } = render(<SchemaForm schema={schema} values={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: '1100' } });
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: '1100' }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a pending edit is written when the form loses focus, once', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} values={{}} onChange={onChange} />);
    const input = screen.getByLabelText(/Title/);
    fireEvent.change(input, { target: { value: 'auto' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'auto' }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders an injected override for an app-bound type', () => {
    const Media = ({ value }: { value: unknown }) => <div data-testid="media">{String(value)}</div>;
    render(<SchemaForm schema={schema} values={{ pic: 'u.png' }} onChange={() => {}} fieldOverrides={{ media: Media }} />);
    expect(screen.getByTestId('media').textContent).toBe('u.png');
  });

  it('takes overrides from the provider and degrades unknown types to text', () => {
    const Media = () => <div data-testid="ctx-media" />;
    render(
      <SchemaFormProvider fieldOverrides={{ media: Media }}>
        <SchemaForm schema={{ s: { label: 'Sym', type: 'symbol' }, pic: schema.pic }} values={{}} onChange={() => {}} />
      </SchemaFormProvider>,
    );
    expect(screen.getByTestId('ctx-media')).toBeTruthy();
    expect((screen.getByLabelText('Sym') as HTMLInputElement).type).toBe('text');
  });

  it('hands a searchable remote-select descriptor to the host override unchanged', () => {
    const seen: FieldSchema[] = [];
    const Remote = ({ field }: { field: FieldSchema }) => { seen.push(field); return <div data-testid="remote" />; };
    const device: FieldSchema = {
      label: 'Device', type: 'remote-select', endpoint: '/api/devices', dataKey: 'data',
      labelKey: 'name', valueKey: 'id', searchKey: 'q', lookupKey: 'id',
    };
    render(<SchemaForm schema={{ device }} values={{ device: 'd-1' }} onChange={() => {}} fieldOverrides={{ 'remote-select': Remote }} />);
    expect(screen.getByTestId('remote')).toBeTruthy();
    expect(seen.at(-1)).toMatchObject({ searchKey: 'q', lookupKey: 'id' });
  });

  it('degrades a searchable remote-select without an override to a text input', () => {
    render(<SchemaForm schema={{ device: { label: 'Device', type: 'remote-select', searchKey: 'q' } }} values={{ device: 'd-1' }} onChange={() => {}} />);
    expect((screen.getByLabelText('Device') as HTMLInputElement).value).toBe('d-1');
  });

  it('adds and edits repeater items', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SchemaForm schema={{ items: schema.items }} values={{}} onChange={onChange} debounceMs={0} />);
    fireEvent.click(screen.getByText('Add item'));
    expect(onChange).toHaveBeenLastCalledWith({ items: [{ name: '' }] });
  });

  it('keeps the repeater item buttons out of the item <summary> (no nested interactive controls)', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const values = { items: [{ name: 'First' }, { name: 'Second' }] };
    const { container } = render(<SchemaForm schema={{ items: schema.items }} values={values} onChange={onChange} debounceMs={0} />);
    for (const summary of container.querySelectorAll('summary')) {
      expect(summary.querySelector('button, a, input, select, textarea')).toBeNull();
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(onChange).toHaveBeenLastCalledWith({ items: [{ name: 'Second' }, { name: 'First' }] });
    // The form keeps the reordered list: removing the second item drops "First".
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[1]);
    expect(onChange).toHaveBeenLastCalledWith({ items: [{ name: 'Second' }] });
  });

  it('shows external errors', () => {
    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} errors={{ title: 'Title is required' }} />);
    expect(screen.getByRole('alert').textContent).toBe('Title is required');
  });
});

describe('validateSchemaValues', () => {
  it('reports required and zod issues, skips hidden fields', () => {
    const s: Record<string, FieldSchema> = {
      title: { label: 'Title', type: 'text', required: true },
      n: { label: 'N', type: 'number', max: 3 },
      hidden: { label: 'H', type: 'text', required: true, showIf: { on: true } },
    };
    const e = validateSchemaValues(s, { n: 9, on: false });
    expect(e.title).toBe('Title is required');
    expect(e.n).toBeTruthy();
    expect(e.hidden).toBeUndefined();
    expect(validateSchemaValues(s, { title: 'x', n: 1 })).toEqual({});
  });

  it('draws option thumbnails in a cards select only through renderOptionPreview', () => {
    const s: Record<string, FieldSchema> = {
      look: { label: 'Look', type: 'select', display: 'cards', value: 'a', options: [
        { value: 'a', label: 'Alpha', preview: 'p-a' }, { value: 'b', label: 'Beta', preview: 'p-b' }, { value: 'c', label: 'Gamma' },
      ] },
    };
    const { unmount } = render(<SchemaForm schema={s} values={{}} onChange={() => {}} debounceMs={0} />);
    expect(screen.getByRole('radio', { name: 'Alpha' }).querySelector('i')).toBeNull();
    unmount();
    render(<SchemaForm schema={s} values={{}} onChange={() => {}} debounceMs={0}
      renderOptionPreview={(id) => (id === 'p-a' ? <i data-testid="thumb-a" /> : null)} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toContainElement(screen.getByTestId('thumb-a'));
    expect(screen.getAllByTestId(/^thumb-/)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveTextContent('Gamma');
  });

  it('a choice group has one tab stop and arrow keys, Home and End move the pick', () => {
    const onChange = vi.fn();
    const s: Record<string, FieldSchema> = {
      size: { label: 'Size', type: 'select', display: 'segmented', options: ['s', 'm', 'l'] },
    };
    render(<SchemaForm schema={s} values={{ size: 'm' }} onChange={onChange} debounceMs={0} />);
    const [sm, md, lg] = screen.getAllByRole('radio');
    expect([sm, md, lg].map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    fireEvent.keyDown(md, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith({ size: 's' });
    expect(sm).toHaveFocus();
    fireEvent.keyDown(sm, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith({ size: 'l' });
    fireEvent.keyDown(lg, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith({ size: 's' });
    fireEvent.keyDown(sm, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith({ size: 'l' });
  });
});

/**
 * next-boilerplate UI test 3 (#85, #199, #200, #213, #214): a device command's params as its catalog declares them. `key` is a required
 * select (one control on the device), `value` is typed by the control it sets (`variants`): a switch's on / off, a set-point's number in its
 * range, a button's nothing. The browser showed the only control while the form held none, and the value was a raw "{ }" box.
 */
describe('a command form: a required select and a value typed by its control', () => {
  const command: Record<string, FieldSchema> = {
    key: { label: 'Control', type: 'select', required: true, options: [{ value: 'calistir', label: 'Hattı çalıştır' }] },
    value: {
      label: 'Value', type: 'json',
      variants: { by: 'key', cases: { calistir: { label: 'Hattı çalıştır', type: 'boolean', required: true } } },
    },
  };
  const three: Record<string, FieldSchema> = {
    key: {
      label: 'Control', type: 'select', required: true,
      options: [{ value: 'calistir', label: 'Run the line' }, { value: 'cikis', label: 'Outlet set-point' }, { value: 'baslat', label: 'Start CIP' }],
    },
    value: {
      label: 'Value', type: 'json',
      variants: {
        by: 'key',
        cases: {
          calistir: { label: 'Run the line', type: 'boolean', required: true },
          cikis: { label: 'Outlet set-point', type: 'number', required: true, min: 1, max: 6, step: 0.1 },
          baslat: null,
        },
      },
    },
  };

  it('a required select shows an empty choice it cannot go back to until one is picked, so it never shows what it does not hold', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={command} values={{}} onChange={onChange} debounceMs={0} />);
    const select = screen.getByLabelText(/Control/) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect([...select.options].map((o) => [o.value, o.disabled])).toEqual([['', true], ['calistir', false]]);
    fireEvent.change(select, { target: { value: 'calistir' } });
    expect(onChange).toHaveBeenLastCalledWith({ key: 'calistir' });
    expect([...select.options].map((o) => o.value)).toEqual(['calistir']);
  });

  it('an optional select keeps its "-" for no choice', () => {
    render(<SchemaForm schema={{ k: { label: 'Kind', type: 'select', options: ['a', 'b'] } }} values={{}} onChange={() => {}} debounceMs={0} />);
    expect([...(screen.getByLabelText('Kind') as HTMLSelectElement).options].map((o) => [o.value, o.disabled])).toEqual([['', false], ['a', false], ['b', false]]);
  });

  it('the value waits for its control, then is an On / Off choice with nothing picked; picking Off holds false', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={command} values={{}} onChange={onChange} debounceMs={0} messages={{ on: 'Açık', off: 'Kapalı' }} />);
    expect(screen.queryByText('Value')).toBeNull();
    expect(screen.queryByPlaceholderText('{ }')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Control/), { target: { value: 'calistir' } });
    expect(screen.getByText('Value')).toBeTruthy();
    const on = screen.getByRole('radio', { name: 'Açık' });
    const off = screen.getByRole('radio', { name: 'Kapalı' });
    expect([on, off].map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    fireEvent.click(off);
    expect(onChange).toHaveBeenLastCalledWith({ key: 'calistir', value: false });
    expect(off.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByPlaceholderText('{ }')).toBeNull();
  });

  it('a set-point is a number in its range, a button takes nothing, and a new control starts its value over', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={three} values={{ key: 'cikis', value: 2.5 }} onChange={onChange} debounceMs={0} />);
    const number = screen.getByLabelText(/Value/) as HTMLInputElement;
    expect([number.type, number.min, number.max, number.value]).toEqual(['number', '1', '6', '2.5']);
    fireEvent.change(screen.getByLabelText(/Control/), { target: { value: 'baslat' } });
    expect(onChange).toHaveBeenLastCalledWith({ key: 'baslat' });
    expect(screen.queryByText('Value')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Control/), { target: { value: 'calistir' } });
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['On', 'Off']);
  });

  it('validation reads the case: a switch needs its on / off, a button needs nothing, a set-point stays in its range', () => {
    expect(validateSchemaValues(command, {})).toEqual({ key: 'Control is required' });
    expect(validateSchemaValues(command, { key: 'calistir' })).toEqual({ value: 'Value is required' });
    expect(validateSchemaValues(command, { key: 'calistir', value: false })).toEqual({});
    expect(validateSchemaValues(three, { key: 'baslat' })).toEqual({});
    expect(Object.keys(validateSchemaValues(three, { key: 'cikis', value: 9 }))).toEqual(['value']);
    expect(validateSchemaValues(three, { key: 'cikis', value: 4 })).toEqual({});
  });

  it('variantOf reads the case as the catalog check does; resolveVariants draws it under the declared label', () => {
    expect(variantOf(three.value, { key: 'cikis' })?.type).toBe('number');
    expect(variantOf(three.value, { key: 'baslat' })).toBeNull();
    expect(variantOf(three.value, { key: 'other' })).toBe(three.value);
    expect(resolveVariants(three, {})).toEqual({ key: three.key });
    expect(resolveVariants(three, { key: 'calistir' }).value).toMatchObject({ label: 'Value', type: 'boolean', display: 'segmented', required: true });
  });
});

// next-boilerplate UI test 3 #22 (y 150 became 149), #73 (a step of 5 became 6): the wheel over a focused number field scrolled it.
describe('a number field and the mouse wheel', () => {
  it('lets go of the focus on a wheel turn, so the wheel scrolls the panel and the number stays', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={{ y: { label: 'Y', type: 'number' } }} values={{ y: 150 }} onChange={onChange} />);
    const field = screen.getByLabelText('Y') as HTMLInputElement;
    field.focus();
    expect(document.activeElement).toBe(field);
    fireEvent.wheel(field, { deltaY: 100 });
    expect(document.activeElement).not.toBe(field);
    expect(field.value).toBe('150');
    expect(onChange).not.toHaveBeenCalled();
  });
});
