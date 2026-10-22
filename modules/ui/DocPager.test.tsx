import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocPager } from './DocPager';

describe('DocPager', () => {
  it('links both neighbours with rel prev/next', () => {
    render(<DocPager prev={{ title: 'Install', href: '/install' }} next={{ title: 'Config', href: '/config' }} />);
    expect(screen.getByRole('link', { name: /Install/ })).toHaveAttribute('rel', 'prev');
    expect(screen.getByRole('link', { name: /Config/ })).toHaveAttribute('rel', 'next');
  });

  it('keeps the next card on the right when there is no previous page', () => {
    const { container } = render(<DocPager next={{ title: 'Config', href: '/config' }} />);
    const nav = container.querySelector('nav')!;
    expect(nav.children).toHaveLength(2);
    expect(nav.children[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing with no neighbours', () => {
    const { container } = render(<DocPager />);
    expect(container).toBeEmptyDOMElement();
  });

  it('delegates link rendering and uses custom labels', () => {
    render(
      <DocPager
        prev={{ title: 'Install', href: '/install' }}
        labels={{ previous: 'Back' }}
        renderLink={(link, className, children) => <a data-router href={link.href} className={className}>{children}</a>}
      />
    );
    const a = screen.getByRole('link', { name: /Back/ });
    expect(a).toHaveAttribute('data-router');
  });
});
