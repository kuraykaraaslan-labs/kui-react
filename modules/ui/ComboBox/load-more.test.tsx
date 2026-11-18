import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboBox } from './index';
import { MultiSelect } from '../MultiSelect';
import type { ComboBoxOption } from './types';

/** An IntersectionObserver the test scrolls by hand: `scrollToEnd()` tells every live observer its sentinel is in view. */
class FakeObserver {
  static all: FakeObserver[] = [];
  nodes: Element[] = [];
  constructor(private readonly cb: IntersectionObserverCallback) {
    FakeObserver.all.push(this);
  }
  observe(node: Element) {
    this.nodes.push(node);
  }
  unobserve() {}
  disconnect() {
    this.nodes = [];
  }
  takeRecords() {
    return [];
  }
}

function scrollToEnd() {
  act(() => {
    for (const io of FakeObserver.all) {
      if (io.nodes.length) io['cb']([{ isIntersecting: true, target: io.nodes[0] } as IntersectionObserverEntry], io as unknown as IntersectionObserver);
    }
  });
}

const opts = (...labels: string[]): ComboBoxOption[] => labels.map((l) => ({ value: l.toLowerCase(), label: l }));
const names = () => screen.queryAllByRole('option').map((o) => o.textContent);

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('load more (NB 41-ui-fixes/38 A4.5)', () => {
  it('ComboBox: fires on the first list, once its sentinel is drawn, for the search on screen', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async (q: string) => (q === '' ? opts('Apple', 'Banana') : []));
    const onLoadMore = vi.fn(async (_q: string) => opts('Cherry'));
    render(<ComboBox id="fruit" label="Fruit" options={[]} onChange={() => {}} onSearch={onSearch} onLoadMore={onLoadMore} debounceMs={0} />);
    await user.click(screen.getByRole('searchbox', { name: 'Fruit' }));
    await waitFor(() => expect(names()).toEqual(['Apple', 'Banana']));
    scrollToEnd();
    await waitFor(() => expect(names()).toEqual(['Apple', 'Banana', 'Cherry']));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore).toHaveBeenCalledWith('');
  });

  it('ComboBox: a page read for another search joins that search, not the list on screen', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async (q: string) => (q === '' ? opts('Apple', 'Banana') : opts('Blueberry')));
    let deliver: (page: ComboBoxOption[]) => void = () => {};
    const onLoadMore = vi.fn((_q: string) => new Promise<ComboBoxOption[]>((resolve) => { deliver = resolve; }));
    render(<ComboBox id="fruit" label="Fruit" options={[]} onChange={() => {}} onSearch={onSearch} onLoadMore={onLoadMore} debounceMs={0} />);
    const input = screen.getByRole('searchbox', { name: 'Fruit' });
    await user.click(input);
    await waitFor(() => expect(names()).toEqual(['Apple', 'Banana']));
    scrollToEnd(); // the page of the empty search is asked for ...
    expect(onLoadMore).toHaveBeenCalledWith('');
    await user.type(input, 'b'); // ... and the reader searches before it comes
    await waitFor(() => expect(names()).toEqual(['Blueberry']));
    await act(async () => deliver(opts('Cherry')));
    expect(names()).toEqual(['Blueberry']);
    await user.clear(input); // back to the empty search, from the cache: its page is there
    await waitFor(() => expect(names()).toEqual(['Apple', 'Banana', 'Cherry']));
    expect(onSearch.mock.calls.map((c) => c[0])).toEqual(['', 'b']);
  });

  it('MultiSelect: fires on the first list and passes the search on screen', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async (q: string) => (q === 'r' ? opts('Red', 'Rose') : opts('Blue')));
    const onLoadMore = vi.fn(async (_q: string) => opts('Ruby'));
    render(<MultiSelect id="tags" label="Tags" options={[]} value={[]} searchable onChange={() => {}} onSearch={onSearch} onLoadMore={onLoadMore} debounceMs={0} />);
    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    await waitFor(() => expect(names()).toEqual(['Blue']));
    await user.type(screen.getByRole('textbox', { name: 'Search…' }), 'r');
    await waitFor(() => expect(names()).toEqual(['Red', 'Rose']));
    scrollToEnd();
    await waitFor(() => expect(names()).toEqual(['Red', 'Rose', 'Ruby']));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore).toHaveBeenCalledWith('r');
  });
});
