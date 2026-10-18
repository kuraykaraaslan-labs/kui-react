import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InlineEditList, type InlineEditItem, type InlineEditChange } from './index';

const start: InlineEditItem[] = [
  { id: 'a', text: 'eu-west' },
  { id: 'b', text: 'us-east' },
  { id: 'c', text: 'ap-south' },
];

type Props = Partial<React.ComponentProps<typeof InlineEditList<InlineEditItem>>>;

function Harness({ initial = start, onChange, ...rest }: Props & { initial?: InlineEditItem[]; onChange?: (n: InlineEditItem[], c: InlineEditChange<InlineEditItem>) => void | Promise<void> }) {
  const [items, setItems] = useState(initial);
  return (
    <>
      <InlineEditList
        items={items}
        onChange={async (next, change) => {
          await onChange?.(next, change);
          setItems(next);
        }}
        {...rest}
      />
      <pre data-testid="texts">{items.map((i) => i.text).join(',')}</pre>
    </>
  );
}
const texts = () => screen.getByTestId('texts').textContent;
const rows = () => screen.getAllByRole('listitem');

describe('InlineEditList', () => {
  it('lists the items with a roving tabindex', () => {
    render(<Harness />);
    expect(rows()).toHaveLength(3);
    expect(rows().filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'List' })).toBeInTheDocument();
  });

  it('edits a row in place: Enter opens the editor, Enter saves', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(rows()[0], { key: 'Enter' });
    const input = screen.getByRole('textbox', { name: 'Edit eu-west' });
    fireEvent.change(input, { target: { value: 'eu-central' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(texts()).toBe('eu-central,us-east,ap-south'));
    expect(onChange).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ type: 'edit', id: 'a' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(rows()[0]).toHaveAttribute('data-state', 'saved');
  });

  it('cancels with Escape and returns focus to the row', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit us-east' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'changed' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(texts()).toBe('eu-west,us-east,ap-south');
    await waitFor(() => expect(document.activeElement).toBe(rows()[1]));
  });

  it('shows a validation message on the row and keeps the editor open', async () => {
    render(<Harness validate={(d, { items }) => (items.some((i) => i.id !== d.id && i.text === d.text) ? 'Already in the list.' : null)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit eu-west' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'us-east' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Already in the list.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(texts()).toBe('eu-west,us-east,ap-south');
    fireEvent.change(input, { target: { value: 'sa-east' } });
    expect(screen.queryByRole('alert')).toBeNull(); // typing clears the message
  });

  it('refuses an empty value by default', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit eu-west' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This field is required.');
  });

  it('supports an async validator', async () => {
    render(<Harness validate={async (d) => { await Promise.resolve(); return d.text === 'taken' ? 'Name is taken.' : null; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is taken.');
  });

  it('adds an item at the end', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled(); // one editor at a time
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'sa-east' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(texts()).toBe('eu-west,us-east,ap-south,sa-east'));
    expect(onChange).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ type: 'add' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added sa-east.');
  });

  it('cancelling an add leaves the list alone', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rows()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled();
  });

  it('removes with the button and with Delete', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove us-east' }));
    await waitFor(() => expect(texts()).toBe('eu-west,ap-south'));
    expect(screen.getByRole('status')).toHaveTextContent('Removed us-east.');
    fireEvent.keyDown(rows()[0], { key: 'Delete' });
    await waitFor(() => expect(texts()).toBe('ap-south'));
  });

  it('reorders with Alt + arrows and the buttons, keeping focus on the moved row', async () => {
    render(<Harness />);
    fireEvent.keyDown(rows()[0], { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(texts()).toBe('us-east,eu-west,ap-south'));
    expect(screen.getByRole('status')).toHaveTextContent('Moved eu-west to position 2 of 3.');
    await waitFor(() => expect(document.activeElement).toBe(rows()[1]));
    fireEvent.click(screen.getByRole('button', { name: 'Move eu-west up' }));
    await waitFor(() => expect(texts()).toBe('eu-west,us-east,ap-south'));
  });

  it('does not move past the ends', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Move eu-west up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move ap-south down' })).toBeDisabled();
    fireEvent.keyDown(rows()[0], { key: 'ArrowUp', altKey: true });
    expect(texts()).toBe('eu-west,us-east,ap-south');
  });

  it('moves focus between rows with the arrow keys, Home and End', async () => {
    render(<Harness />);
    fireEvent.keyDown(rows()[0], { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(rows()[1]));
    fireEvent.keyDown(rows()[1], { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(rows()[2]));
    expect(rows()[2].tabIndex).toBe(0);
    fireEvent.keyDown(rows()[2], { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(rows()[0]));
  });

  it('shows a saving state while an async save runs, then the saved mark', async () => {
    let release: () => void = () => {};
    render(<Harness onChange={() => new Promise<void>((r) => { release = r; })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit eu-west' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'eu-north' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled());
    expect(screen.getByRole('textbox')).toBeDisabled();
    release();
    await waitFor(() => expect(texts()).toBe('eu-north,us-east,ap-south'));
    expect(rows()[0]).toHaveAttribute('data-state', 'saved');
  });

  it('a rejected save keeps the editor open and shows the error on the row', async () => {
    render(<Harness onChange={() => Promise.reject(new Error('Server said no'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit eu-west' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'eu-north' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(texts()).toBe('eu-west,us-east,ap-south');
    expect(screen.getByRole('textbox')).toHaveValue('eu-north'); // the draft is not lost
    expect(screen.getByRole('alert')).toHaveTextContent('Server said no');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  });

  it('a rejected remove leaves the row and shows why', async () => {
    render(<Harness onChange={() => Promise.reject(new Error('Locked by another user'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove us-east' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Locked by another user');
    expect(texts()).toBe('eu-west,us-east,ap-south');
    expect(within(rows()[1]).getByRole('button', { name: 'Remove us-east' })).toBeEnabled();
  });

  it('respects maxItems, readOnly and disabled', () => {
    const { rerender } = render(<Harness maxItems={3} />);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
    expect(screen.getByText('At most 3 items.')).toBeInTheDocument();
    rerender(<Harness readOnly />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<Harness disabled />);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit eu-west' })).toBeNull();
  });

  it('renders custom row content and a custom editor', async () => {
    type Header = InlineEditItem & { value: string };
    const headers: Header[] = [{ id: 'h1', text: 'X-Env', value: 'prod' }];
    function Custom() {
      const [items, setItems] = useState(headers);
      return (
        <InlineEditList<Header>
          items={items}
          onChange={(n) => setItems(n)}
          createItem={() => ({ id: 'new', text: '', value: '' })}
          renderItem={(i) => <span>{i.text}: <b>{i.value}</b></span>}
          renderEditor={({ draft, update, inputProps }) => (
            <div>
              <input {...inputProps} value={draft.text} onChange={(e) => update({ text: e.target.value })} />
              <input aria-label="Header value" value={draft.value} onChange={(e) => update({ value: e.target.value })} />
            </div>
          )}
        />
      );
    }
    render(<Custom />);
    expect(screen.getByText('prod')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit X-Env' }));
    fireEvent.change(screen.getByLabelText('Header value'), { target: { value: 'staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('staging')).toBeInTheDocument());
  });

  it('shows an empty message and takes text from messages', () => {
    render(<Harness initial={[]} messages={{ empty: 'Rien.', add: 'Ajouter' }} />);
    expect(screen.getByText('Rien.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });
});
