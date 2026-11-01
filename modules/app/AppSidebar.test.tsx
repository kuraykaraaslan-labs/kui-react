import { describe, it, expect, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('hides the scrollbar only while collapsed (a classic one would take the narrow nav\'s width)', () => {
    const { rerender } = render(<AppSidebar navItems={ITEMS} collapsed searchable={false} />);
    const nav = () => screen.getByRole('navigation', { name: 'Sidebar navigation' });
    expect(nav()).toHaveClass('sidebar-scrollbar-none');
    rerender(<AppSidebar navItems={ITEMS} collapsed={false} searchable={false} />);
    expect(nav()).not.toHaveClass('sidebar-scrollbar-none');
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

    it('an active parent page shows its children (one click away)', () => {
      render(<AppSidebar navItems={TREE} activeId="guides" searchable={false} />);
      expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('button', { name: 'Collapse Guides' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('link', { name: 'Writing' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Plugins' })).not.toBeInTheDocument();
    });

    it('opens the branch of a parent page that becomes active (client-side navigation)', () => {
      const { rerender } = render(<AppSidebar navItems={TREE} activeId="intro" searchable={false} />);
      expect(screen.queryByRole('link', { name: 'Writing' })).not.toBeInTheDocument();
      rerender(<AppSidebar navItems={TREE} activeId="guides" searchable={false} />);
      expect(screen.getByRole('link', { name: 'Writing' })).toBeInTheDocument();
    });

    it('search finds a child by its own name and shows it under its parent', async () => {
      const user = userEvent.setup();
      render(<AppSidebar navItems={TREE} />);
      await user.type(screen.getByRole('searchbox', { name: 'Search navigation' }), 'writ');
      expect(screen.getByRole('link', { name: 'Writing' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Guides' })).toBeInTheDocument();
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

  describe('external items', () => {
    const LINKS = [
      { id: 'home', label: 'Home', href: '/home' },
      { id: 'site', label: 'kuray.dev', href: 'https://kuray.dev', external: true },
    ];
    const outsideIcon = (link: HTMLElement) => link.querySelector('svg.fa-arrow-up-right-from-square');

    it('opens in a new tab with noopener noreferrer, a trailing icon and a hidden note', () => {
      render(<AppSidebar navItems={LINKS} searchable={false} />);
      // jsdom drops the note's leading space (no CSS, so no block boundary); a browser reads it.
      const link = screen.getByRole('link', { name: /^kuray\.dev ?\(opens in a new tab\)$/ });
      expect(link).toHaveAttribute('href', 'https://kuray.dev');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(outsideIcon(link)).toHaveAttribute('aria-hidden', 'true');
      expect(outsideIcon(link)).toHaveClass('shrink-0', 'w-3', 'h-3', 'text-text-disabled');
      expect(link.querySelector('.sr-only')).toHaveTextContent('(opens in a new tab)');
      expect(link.className).toBe(screen.getByRole('link', { name: 'Home' }).className);
      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('target');
    });

    it('takes the hidden note from messages', () => {
      render(<AppSidebar navItems={LINKS} searchable={false} messages={{ opensInNewTab: '(new tab)' }} />);
      expect(screen.getByRole('link', { name: /^kuray\.dev ?\(new tab\)$/ })).toBeInTheDocument();
    });

    it('collapsed: no icon, the title carries the label and the note', () => {
      render(<AppSidebar navItems={LINKS} collapsed searchable={false} />);
      const link = screen.getByRole('link', { name: 'kuray.dev (opens in a new tab)' });
      expect(link).toHaveAttribute('title', 'kuray.dev (opens in a new tab)');
      expect(outsideIcon(link)).toBeNull();
      expect(link.querySelector('.sr-only')).toBeNull();
    });

    it('is never marked active and bypasses renderLink', () => {
      render(
        <AppSidebar
          navGroups={[{ label: 'Links', collapsible: true, items: LINKS }]}
          activeId="site"
          searchable={false}
          renderLink={(item, props) => <a data-router={item.id} {...props} />}
        />,
      );
      expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(screen.getByRole('button', { name: 'Links' }));
      const link = screen.getByRole('link', { name: /kuray\.dev/ });
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).not.toHaveAttribute('data-router');
      expect(link.className).not.toContain('bg-primary-subtle');
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('data-router', 'home');
    });

    it('without href the flag is ignored: a plain button', () => {
      render(<AppSidebar navItems={[{ id: 'x', label: 'Nowhere', external: true }]} searchable={false} />);
      expect(screen.getByRole('button', { name: 'Nowhere' })).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
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

