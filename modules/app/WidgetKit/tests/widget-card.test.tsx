import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetCard } from '../WidgetCard';

describe('WidgetCard unavailable state', () => {
  it('keeps the title and shows the placeholder instead of the body', () => {
    render(
      <WidgetCard title="Open calls" card={{}} state="unavailable" unavailable={{ reason: 'disabled' }}>
        <p>widget body</p>
      </WidgetCard>,
    );
    expect(screen.getByRole('heading', { name: 'Open calls' })).toBeInTheDocument();
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-reason', 'disabled');
    expect(note).toHaveAttribute('data-size', 'card');
    // The card is the frame: no second, dashed one inside it.
    expect(note.className).not.toContain('border-dashed');
    expect(screen.queryByText('widget body')).not.toBeInTheDocument();
  });

  it('defaults to reason missing', () => {
    render(<WidgetCard title="Old widget" card={{}} state="unavailable" />);
    expect(screen.getByRole('note')).toHaveAttribute('data-reason', 'missing');
  });

  it('runs the placeholder action', async () => {
    const user = userEvent.setup();
    const onEnable = vi.fn();
    render(
      <WidgetCard
        title="Open calls"
        card={{}}
        state="unavailable"
        unavailable={{ reason: 'disabled', action: { label: 'Enable telephony', onClick: onEnable } }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Enable telephony' }));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('hides the data buttons, the stale badge and the updated footer', () => {
    render(
      <WidgetCard
        title="Open calls"
        card={{ buttons: ['refresh', 'export', 'fullscreen'], showUpdated: 'time' }}
        state="unavailable"
        stale
        updatedAt={new Date()}
        onRefresh={() => {}}
        onExport={() => {}}
        onFullscreen={() => {}}
        unavailable={{ reason: 'quarantined' }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Full screen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Old data')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Updated/)).not.toBeInTheDocument();
  });

  it('carries the title into the placeholder when the card hides its title row', () => {
    render(<WidgetCard title="Open calls" card={{ showTitle: false }} state="unavailable" unavailable={{ reason: 'banned' }} />);
    expect(screen.getByRole('note')).toHaveTextContent('Open calls');
  });

  it('the other states are unchanged', () => {
    render(<WidgetCard title="Open calls" card={{}} state="ready"><p>widget body</p></WidgetCard>);
    expect(screen.getByText('widget body')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('WidgetCard badges', () => {
  it('shows the badges next to the title', () => {
    render(<WidgetCard title="Open calls" card={{}} badges={<span>Not refreshed</span>}><p>widget body</p></WidgetCard>);
    expect(screen.getByRole('heading', { name: 'Open calls' }).parentElement).toHaveTextContent('Not refreshed');
  });

  it('still shows them when the card hides its title row, with the old-data mark', () => {
    render(<WidgetCard title="Open calls" card={{ showTitle: false }} stale badges={<span>Not refreshed</span>}><p>widget body</p></WidgetCard>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Not refreshed')).toBeInTheDocument();
    expect(screen.getByText('Old data')).toBeInTheDocument();
  });

  it('a card without a title and without badges keeps no badge row', () => {
    const { container } = render(<WidgetCard card={{}} stale><p>widget body</p></WidgetCard>);
    expect(container.querySelector('header .flex.min-w-0.items-center')).toBeNull();
    expect(screen.getByText('Old data')).toBeInTheDocument();
  });
});

describe('WidgetCard header buttons', () => {
  it('hidden until hover from lg up they take no room; keyboard focus reveals them', () => {
    render(<WidgetCard title="Sites" card={{ buttons: ['refresh'] }} onRefresh={vi.fn()}><p>widget body</p></WidgetCard>);
    const group = screen.getByRole('button', { name: 'Refresh' }).parentElement!;
    const classes = group.className.split(' ');
    // At rest from lg up: no width, no gap before it, nothing drawn outside it.
    expect(classes).toEqual(expect.arrayContaining(['lg:max-w-0', 'lg:-ml-2', 'lg:overflow-hidden', 'lg:opacity-0']));
    // On hover and on focus inside the card: its full width, its focus rings unclipped.
    for (const on of ['lg:group-hover/wk:', 'lg:group-focus-within/wk:']) {
      expect(classes).toEqual(expect.arrayContaining([`${on}max-w-none`, `${on}ml-0`, `${on}overflow-visible`, `${on}opacity-100`]));
    }
    // A screen that cannot hover (a touch tablet at lg width) always shows them: Tailwind's hover variant needs (hover: hover).
    expect(classes).toEqual(expect.arrayContaining(['[@media(hover:none)]:max-w-none', '[@media(hover:none)]:ml-0', '[@media(hover:none)]:overflow-visible', '[@media(hover:none)]:opacity-100']));
    // Never removed from the tab order (no display: none, no visibility: hidden).
    expect(group.className).not.toMatch(/(^|\s)(lg:)?(hidden|invisible)(\s|$)/);
  });
});
