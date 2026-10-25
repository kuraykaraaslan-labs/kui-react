import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppTopBar } from './AppTopBar';

describe('AppTopBar', () => {
  it('renders logo and children as before, with no region wrappers when unused', () => {
    const { container } = render(<AppTopBar logo={<span>Logo</span>}><span>child</span></AppTopBar>);
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(container.querySelector('[data-region]')).toBeNull();
    // min-w-0: in a narrow header the bar shrinks with it.
    expect(container.firstChild).toHaveClass('min-w-0', 'flex-1');
  });

  it('orders region items by order and leaves hidden ones out', () => {
    render(
      <AppTopBar
        end={[
          { id: 'user', node: <span>user</span>, order: 100 },
          { id: 'bell', node: <span>bell</span>, order: 10 },
          { id: 'lang', node: <span>lang</span> },
          { id: 'phone', node: <span>phone</span>, hidden: true },
        ]}
      />,
    );
    const end = document.querySelector('[data-region="end"]')!;
    expect(end.textContent).toBe('langbelluser');
    expect(screen.queryByText('phone')).not.toBeInTheDocument();
  });

  it('places start after the logo, then children, then end (pushed to the far end)', () => {
    const { container } = render(
      <AppTopBar logo={<span>Logo</span>} start={<span>switcher</span>} end={[{ id: 'bell', node: <span>bell</span> }]}>
        <span>search</span>
      </AppTopBar>,
    );
    expect(container.firstElementChild!.textContent).toBe('Logoswitchersearchbell');
    expect(document.querySelector('[data-region="end"]')!.className).toContain('ml-auto');
  });

  it('a region whose items are all hidden renders nothing', () => {
    const { container } = render(<AppTopBar end={[{ id: 'x', node: <span>x</span>, hidden: true }]} />);
    expect(container.querySelector('[data-region]')).toBeNull();
  });

  it('a region also takes a plain node array', () => {
    render(<AppTopBar start={[<span key="a">a</span>, <span key="b">b</span>]} />);
    expect(document.querySelector('[data-region="start"]')!.textContent).toBe('ab');
  });
});
