import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSidebar } from './AppSidebar';

const ITEMS = [
  { id: 'inbox', label: 'Inbox', badge: 3 },
  { id: 'zero', label: 'Zero', badge: 0 },
  { id: 'status', label: 'Status', badge: <span data-testid="dot">live</span> },
];

// jsdom has no matchMedia; report a desktop viewport (min-width: 1024px).
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('AppSidebar', () => {
  it('renders a number badge above 0 and hides 0', () => {
    render(<AppSidebar navItems={ITEMS} searchable={false} />);
    expect(screen.getByRole('button', { name: /Inbox/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /Zero/ })).not.toHaveTextContent('0');
  });

  it('renders a node badge as given', () => {
    render(<AppSidebar navItems={ITEMS} searchable={false} />);
    expect(screen.getByTestId('dot')).toHaveTextContent('live');
  });

  it('renders the header above the nav groups', () => {
    const { container } = render(<AppSidebar navItems={ITEMS} header={<div>Workspace switcher</div>} />);
    const header = screen.getByText('Workspace switcher');
    const nav = screen.getByRole('navigation', { name: 'Sidebar navigation' });
    expect(header.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('nav')!.contains(header)).toBe(false);
  });

  it('a header function receives the collapsed state', () => {
    render(<AppSidebar navItems={ITEMS} collapsed header={({ collapsed }) => <span>{collapsed ? 'narrow' : 'wide'}</span>} />);
    expect(screen.getByText('narrow')).toBeInTheDocument();
  });

  it('renders no header wrapper without a header', () => {
    render(<AppSidebar navItems={ITEMS} searchable={false} />);
    expect(screen.queryByText('Workspace switcher')).not.toBeInTheDocument();
  });

  it('marks the active item as the current page, link or button', () => {
    render(
      <AppSidebar
        navItems={[
          { id: 'home', label: 'Home', href: '/home' },
          { id: 'reports', label: 'Reports', href: '/reports' },
          { id: 'inbox', label: 'Inbox' },
        ]}
        activeId="home"
        searchable={false}
      />,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Reports' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Inbox' })).not.toHaveAttribute('aria-current');
  });

  it('an active button item is the current page too', () => {
    render(<AppSidebar navItems={[{ id: 'inbox', label: 'Inbox' }]} activeId="inbox" searchable={false} />);
    expect(screen.getByRole('button', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page');
  });

  it('drops the reserved scrollbar gutter only while collapsed, so icons stay centered', () => {
    const { rerender } = render(<AppSidebar navItems={ITEMS} collapsed searchable={false} />);
    const nav = () => screen.getByRole('navigation', { name: 'Sidebar navigation' });
    expect(nav().style.scrollbarGutter).toBe('auto');
    rerender(<AppSidebar navItems={ITEMS} collapsed={false} searchable={false} />);
    expect(nav().style.scrollbarGutter || '').toBe('');
  });

  describe('nested items', () => {
    const TREE = [
      { id: 'intro', label: 'Introduction', href: '/docs' },
      {
        id: 'guides', label: 'Guides', href: '/docs/guides',
        children: [
          { id: 'writing', label: 'Writing', href: '/docs/guides/writing' },
          { id: 'advanced', label: 'Advanced', children: [{ id: 'plugins', label: 'Plugins', href: '/docs/guides/advanced/plugins' }] },
        ],
      },
      { id: 'ref', label: 'Reference', children: [{ id: 'api', label: 'API', href: '/docs/api' }] },
    ];

    it('starts collapsed, except the branch that holds the active item', () => {
      render(<AppSidebar navItems={TREE} activeId="plugins" searchable={false} />);
      expect(screen.getByRole('link', { name: 'Plugins' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('button', { name: 'Collapse Guides' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Reference' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: 'API' })).not.toBeInTheDocument();
    });

    it('a parent page keeps its link and gets a separate toggle; a parent without one toggles itself', async () => {
      const user = userEvent.setup();
      render(<AppSidebar navItems={TREE} searchable={false} />);
      expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/guides');
      await user.click(screen.getByRole('button', { name: 'Expand Guides' }));
      expect(screen.getByRole('link', { name: 'Writing' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Guides' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Reference' }));
      expect(screen.getByRole('link', { name: 'API' })).toBeInTheDocument();
    });

    it('defaultExpanded opens a branch', () => {
      render(<AppSidebar navItems={[{ ...TREE[2], defaultExpanded: true }]} searchable={false} />);
      expect(screen.getByRole('link', { name: 'API' })).toBeInTheDocument();
    });

    it('search keeps the branch down to a matching descendant, opened', async () => {
      const user = userEvent.setup();
      render(<AppSidebar navItems={TREE} />);
      await user.type(screen.getByRole('searchbox', { name: 'Search navigation' }), 'plug');
      expect(screen.getByRole('link', { name: 'Plugins' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Guides' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Writing' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Introduction' })).not.toBeInTheDocument();
    });

    it('icon-only mode shows top-level items only and lights up the one holding the active page', () => {
      render(<AppSidebar navItems={TREE} activeId="plugins" collapsed />);
      expect(screen.queryByRole('link', { name: 'Plugins' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Guides' }).className).toContain('bg-primary-subtle');
    });

    it('opens the new active branch when activeId changes (client-side navigation)', () => {
      const { rerender } = render(<AppSidebar navItems={TREE} activeId="intro" searchable={false} />);
      expect(screen.queryByRole('link', { name: 'API' })).not.toBeInTheDocument();
      rerender(<AppSidebar navItems={TREE} activeId="api" searchable={false} />);
      expect(screen.getByRole('link', { name: 'API' })).toHaveAttribute('aria-current', 'page');
    });

    it('marks a collapsible group active through a nested item', () => {
      render(<AppSidebar navGroups={[{ label: 'Docs', collapsible: true, items: TREE }]} activeId="api" searchable={false} />);
      expect(screen.getByRole('button', { name: 'Docs' })).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('renderLink renders linked items with the props it is given', () => {
    render(
      <AppSidebar
        navItems={[{ id: 'home', label: 'Home', href: '/home' }, { id: 'inbox', label: 'Inbox' }]}
        activeId="home"
        searchable={false}
        renderLink={(item, props) => <a data-router={item.id} {...props} />}
      />,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('data-router', 'home');
    expect(link).toHaveAttribute('href', '/home');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Inbox' })).not.toHaveAttribute('data-router');
  });

  it('puts headerClassName and footerClassName on the slot wrappers', () => {
    render(<AppSidebar navItems={ITEMS} header={<span>Top</span>} headerClassName="md:hidden" footer={<span>Bottom</span>} footerClassName="xl:hidden" />);
    expect(screen.getByText('Top').parentElement).toHaveClass('md:hidden', 'border-b');
    expect(screen.getByText('Bottom').parentElement).toHaveClass('xl:hidden', 'border-t');
  });

  it('draws no header strip for a false header', () => {
    const strips = (header?: false) =>
      render(<AppSidebar navItems={ITEMS} searchable={false} header={header} />).container.querySelectorAll('.border-b').length;
    expect(strips(false)).toBe(strips());
  });
});

