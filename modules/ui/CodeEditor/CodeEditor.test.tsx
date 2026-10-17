import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeEditor } from './index';
import type { CodeEditorProps } from './types';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Controlled(props: Partial<CodeEditorProps> & { initial?: string; onValue?: (v: string) => void }) {
  const { initial = '', onValue, ...rest } = props;
  const [v, setV] = useState(initial);
  return <CodeEditor id="ce" label="Code" value={v} onChange={(n) => { setV(n); onValue?.(n); }} {...rest} />;
}

const box = () => screen.getByLabelText('Code') as HTMLTextAreaElement;

describe('CodeEditor M2: keys', () => {
  it('indents with Tab and lets Esc then Tab leave the field', () => {
    render(<Controlled initial="ab" language="js" />);
    const ta = box();
    ta.setSelectionRange(1, 1);
    fireEvent.keyDown(ta, { key: 'Tab' });
    expect(ta.value).toBe('a  b');
    fireEvent.keyDown(ta, { key: 'Escape' });
    const e = fireEvent.keyDown(ta, { key: 'Tab' });
    expect(e).toBe(true); // not prevented: the focus moves on
    expect(ta.value).toBe('a  b');
  });

  it('toggles a line comment, auto-indents on Enter and closes brackets', () => {
    render(<Controlled initial="if (x) {}" language="js" />);
    const ta = box();
    ta.setSelectionRange(8, 8);
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(ta.value).toBe('if (x) {\n  \n}');
    ta.setSelectionRange(0, 0);
    fireEvent.keyDown(ta, { key: '/', ctrlKey: true });
    expect(ta.value.split('\n')[0]).toBe('// if (x) {');
    ta.setSelectionRange(ta.value.length, ta.value.length);
    fireEvent.keyDown(ta, { key: '[' });
    expect(ta.value.endsWith('}[]')).toBe(true);
  });

  it('changes nothing with the keys when read only', () => {
    render(<Controlled initial="ab" readonly />);
    const ta = box();
    fireEvent.keyDown(ta, { key: 'Tab' });
    expect(ta.value).toBe('ab');
  });
});

describe('CodeEditor M2: toolbar, find and format', () => {
  it('formats with the toolbar and replaces through the find bar', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="a.b.a" showToolbar format={(v) => v.toUpperCase()} />);
    await user.click(screen.getByRole('button', { name: 'Format the code' }));
    expect(box().value).toBe('A.B.A');
    await user.click(screen.getByRole('button', { name: 'Find and replace' }));
    await user.type(screen.getByLabelText('Find'), 'a');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Replace with'), 'x');
    await user.click(screen.getByRole('button', { name: 'Replace all' }));
    expect(box().value).toBe('x.B.x');
  });

  it('opens the find bar with Ctrl+F in the field', () => {
    render(<Controlled initial="abc" />);
    fireEvent.keyDown(box(), { key: 'f', ctrlKey: true });
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('goes full screen and back', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlled initial="x" showToolbar />);
    await user.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(container.querySelector('[data-kui-codeeditor]')).toHaveAttribute('data-fullscreen');
    await user.click(screen.getByRole('button', { name: 'Leave full screen' }));
    expect(container.querySelector('[data-kui-codeeditor]')).not.toHaveAttribute('data-fullscreen');
  });
});

describe('CodeEditor M3: diagnostics, completion, hover', () => {
  it('lists the markers under the field, marks their lines and jumps to one', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlled initial={'a\nbb\nc'} markers={[{ line: 2, column: 2, severity: 'error', message: 'bad b', source: 'check' }, { line: 1, severity: 'warning', message: 'meh' }]} />);
    const list = screen.getByRole('list', { name: 'Problems in the code' });
    expect(list.textContent).toBe('Line 1: mehLine 2, column 2: bad b (check)');
    expect(container.querySelector('[data-kui-codeeditor-gutter] [data-marker="error"]')).toHaveTextContent('2');
    expect(container.querySelector('[data-kui-codeeditor-tints] [data-line="2"]')).not.toBeNull();
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', { name: /bad b/ }));
    expect(box().selectionStart).toBe(3);
  });

  it('suggests while a name is typed and inserts the picked one', async () => {
    const getSuggestions = vi.fn(() => [{ label: 'msg.payload' }, { label: 'msg.metadata', detail: 'object' }, { label: 'node.send', insertText: 'node.send(' }]);
    render(<Controlled initial="" getSuggestions={getSuggestions} />);
    const ta = box();
    ta.focus();
    fireEvent.keyDown(ta, { key: 'm' });
    fireEvent.change(ta, { target: { value: 'msg.', selectionStart: 4 } });
    ta.setSelectionRange(4, 4);
    const list = await screen.findByRole('listbox', { name: 'Suggestions' });
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(getSuggestions).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'msg.' }));
    fireEvent.keyDown(ta, { key: 'ArrowDown' });
    expect(ta).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-1$/));
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(ta.value).toBe('msg.metadata');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens the list with Ctrl+Space and closes it with Escape', async () => {
    render(<Controlled initial="no" getSuggestions={() => [{ label: 'node.send' }]} />);
    const ta = box();
    ta.setSelectionRange(2, 2);
    fireEvent.keyDown(ta, { key: ' ', ctrlKey: true });
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
