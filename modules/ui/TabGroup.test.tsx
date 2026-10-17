import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy } from 'react';
import { TabGroup, type Tab } from './TabGroup';

const TABS: Tab[] = [
  { id: 'a', label: 'Alpha', content: 'Alpha content' },
  { id: 'b', label: 'Beta', content: 'Beta content' },
  { id: 'c', label: 'Gamma', content: 'Gamma content', disabled: true },
  { id: 'd', label: 'Delta', content: 'Delta content' },
];

describe('TabGroup', () => {
  it('renders every tab and activates the first one by default', () => {
    render(<TabGroup tabs={TABS} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Alpha' })).not.toHaveAttribute('hidden');
  });

  it('defaultTab picks the initially active tab', () => {
    render(<TabGroup tabs={TABS} defaultTab="b" />);
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a tab activates it and shows its panel', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} />);
    await user.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Beta content')).toBeVisible();
  });

  it('a disabled tab cannot be activated by click', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} />);
    await user.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowRight moves to the next tab, skipping a disabled one', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} defaultTab="b" />);
    screen.getByRole('tab', { name: 'Beta' }).focus();
    await user.keyboard('{ArrowRight}');
    // Gamma (index 2) is disabled — should land on Delta.
    expect(screen.getByRole('tab', { name: 'Delta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft wraps around from the first tab to the last', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} />);
    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Delta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Home jumps to the first enabled tab, End to the last enabled tab', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} defaultTab="b" />);
    screen.getByRole('tab', { name: 'Beta' }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Delta' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });

  it('only the active tab is in the roving tab order (tabIndex 0), the rest are -1', () => {
    render(<TabGroup tabs={TABS} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1');
  });

  it('lazy: a tab panel that has never been active renders nothing until first activated', async () => {
    const user = userEvent.setup();
    render(<TabGroup tabs={TABS} lazy />);
    expect(screen.queryByText('Beta content')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('Beta content')).toBeInTheDocument();
  });

  it('without lazy, every panel is rendered upfront (just hidden)', () => {
    render(<TabGroup tabs={TABS} />);
    // A panel with the native `hidden` attribute drops out of the
    // accessibility tree entirely (jsdom/dom-accessibility-api won't expose
    // its role even with Testing Library's `hidden: true` query option) —
    // query by id instead of by role to check it's still in the DOM.
    expect(screen.getByText('Beta content')).toBeInTheDocument();
    expect(document.getElementById('tabpanel-b')).toHaveAttribute('hidden');
  });

  it('the tablist has the given accessible label', () => {
    render(<TabGroup tabs={TABS} label="Settings sections" />);
    expect(screen.getByRole('tablist', { name: 'Settings sections' })).toBeInTheDocument();
  });

  it('a row of tabs wider than its box scrolls inside the tab list: tabs keep one line and do not shrink', () => {
    render(<TabGroup tabs={TABS} />);
    const list = screen.getByRole('tablist');
    expect(list).toHaveClass('overflow-x-auto', 'overflow-y-hidden');
    for (const tab of screen.getAllByRole('tab')) expect(tab).toHaveClass('shrink-0', 'whitespace-nowrap');
  });

  describe('order', () => {
    it('sorts tabs by order (missing counts as 0, ties keep array order)', () => {
      render(
        <TabGroup
          tabs={[
            { id: 'calls', label: 'Calls', content: 'calls', order: 20 },
            { id: 'overview', label: 'Overview', content: 'overview' },
            { id: 'pinned', label: 'Pinned', content: 'pinned', order: -1 },
            { id: 'notes', label: 'Notes', content: 'notes' },
            { id: 'tasks', label: 'Tasks', content: 'tasks', order: 10 },
          ]}
        />,
      );
      expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Pinned', 'Overview', 'Notes', 'Tasks', 'Calls']);
      // The first tab in display order is active by default.
      expect(screen.getByRole('tab', { name: 'Pinned' })).toHaveAttribute('aria-selected', 'true');
    });

    it('arrow keys follow the display order', async () => {
      const user = userEvent.setup();
      render(
        <TabGroup
          tabs={[
            { id: 'b', label: 'Second', content: 'b', order: 2 },
            { id: 'a', label: 'First', content: 'a', order: 1 },
          ]}
        />,
      );
      screen.getByRole('tab', { name: 'First' }).focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('falls back to the first tab when the active tab is removed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TabGroup tabs={TABS} />);
    await user.click(screen.getByRole('tab', { name: 'Delta' }));
    rerender(<TabGroup tabs={TABS.filter((t) => t.id !== 'd')} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Alpha content')).toBeVisible();
  });

  it('a tab-level lazy overrides the group (eager group, lazy contributed tab)', () => {
    render(
      <TabGroup
        tabs={[
          { id: 'a', label: 'Alpha', content: 'Alpha content' },
          { id: 'b', label: 'Beta', content: 'Beta content' },
          { id: 'x', label: 'Contributed', content: 'Contributed content', lazy: true },
        ]}
      />,
    );
    expect(screen.getByText('Beta content')).toBeInTheDocument();
    expect(screen.queryByText('Contributed content')).not.toBeInTheDocument();
  });

  describe('isolation', () => {
    afterEach(() => vi.restoreAllMocks());

    function Broken(): never {
      throw new Error('tab broke');
    }

    const WITH_BROKEN: Tab[] = [
      { id: 'a', label: 'Alpha', content: 'Alpha content' },
      { id: 'x', label: 'Broken', content: <Broken /> },
    ];

    it('an isolated tab that throws shows the failed placeholder; the other tabs keep working', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<TabGroup tabs={WITH_BROKEN} isolate />);
      expect(screen.getByText('Alpha content')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Broken' }));
      const panel = document.getElementById('tabpanel-x')!;
      expect(panel.querySelector('[data-reason="failed"]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Alpha' }));
      expect(screen.getByText('Alpha content')).toBeVisible();
    });

    it('a per-tab isolate flag works without the group flag', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<TabGroup tabs={[WITH_BROKEN[0], { ...WITH_BROKEN[1], isolate: true }]} />);
      expect(screen.getByText('Alpha content')).toBeInTheDocument();
    });

    it('renderError and onTabError let the host choose the fallback and report', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const onTabError = vi.fn();
      render(
        <TabGroup
          tabs={WITH_BROKEN}
          defaultTab="x"
          isolate
          onTabError={onTabError}
          renderError={({ tab, error }) => <p>{`${tab.label}: ${error.message}`}</p>}
        />,
      );
      expect(screen.getByText('Broken: tab broke')).toBeInTheDocument();
      expect(onTabError).toHaveBeenCalledWith('x', expect.any(Error), expect.objectContaining({ componentStack: expect.any(String) }));
    });

    it('an isolated tab that suspends shows the loading fallback, then its content', async () => {
      let resolve!: (m: { default: () => React.JSX.Element }) => void;
      const Lazy = lazy(() => new Promise<{ default: () => React.JSX.Element }>((r) => { resolve = r; }));
      render(
        <TabGroup
          isolate
          loadingFallback={<p>loading tab</p>}
          tabs={[{ id: 'l', label: 'Lazy', content: <Lazy /> }]}
        />,
      );
      expect(screen.getByText('loading tab')).toBeInTheDocument();
      resolve({ default: () => <p>lazy content</p> });
      expect(await screen.findByText('lazy content')).toBeInTheDocument();
    });

    it('without isolate, panels render their content bare (no extra wrappers)', () => {
      render(<TabGroup tabs={TABS} />);
      expect(document.getElementById('tabpanel-a')!.innerHTML).toBe('Alpha content');
    });
  });
});
