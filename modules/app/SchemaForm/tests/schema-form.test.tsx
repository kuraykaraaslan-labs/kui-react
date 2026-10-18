import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SchemaForm } from '../SchemaForm';
import { SchemaFormProvider } from '../schema-form.context';
import { validateSchemaValues } from '../validate';
import type { FieldSchema } from '../types';

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

  it('debounces onChange', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} values={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Hi' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hi' }));
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
