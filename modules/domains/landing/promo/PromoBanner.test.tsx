import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PromoBanner } from './PromoBanner';
import { PromoSchema, type Promo } from '../types';

const promo: Promo = {
  id: 'summer',
  eyebrow: 'Summer sale',
  headline: '20% off the first year',
  body: 'On every yearly plan, for new workspaces.',
  cta: { label: 'See plans', href: '/pricing?utm_campaign=summer' },
  image: { src: '/promo.jpg', mobileSrc: '/promo-m.jpg', alt: '' },
  endsAt: '2026-12-01T00:00:00Z',
  couponCode: 'SUMMER20',
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('PromoSchema', () => {
  it('accepts a campaign and rejects an unreadable end date or an unknown tone', () => {
    expect(PromoSchema.parse(promo)).toEqual(promo);
    expect(PromoSchema.safeParse({ headline: 'x', endsAt: 'soon' }).success).toBe(false);
    expect(PromoSchema.safeParse({ headline: 'x', tone: 'pink' }).success).toBe(false);
  });
});

describe('PromoBanner', () => {
  it('banner: a section named by its heading, with eyebrow, body, countdown, button, coupon and a reserved-ratio image', () => {
    vi.useFakeTimers({ now: new Date('2026-11-28T19:47:30Z'), toFake: ['Date'] });
    const { container } = render(<PromoBanner promo={promo} tone="success" />);
    const section = screen.getByRole('region', { name: '20% off the first year' });
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveAttribute('data-layout', 'banner');
    expect(section).toHaveAttribute('data-tone', 'success');
    expect(section).toHaveClass('bg-success-subtle');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('20% off the first year');
    expect(screen.getByText('Summer sale')).toHaveClass('text-success-fg');
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing?utm_campaign=summer');
    expect(container.querySelector('[data-variant="boxed"]')).not.toBeNull();
    expect(screen.getByText('SUMMER20').tagName).toBe('CODE');
    const media = container.querySelector('[data-part="media"]')!;
    expect(media).toHaveClass('aspect-[16/9]', 'sm:aspect-[4/3]');
    expect(media.querySelector('source')).toHaveAttribute('srcset', '/promo-m.jpg');
    expect(media.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('banner without image or extras keeps one column and draws no empty parts', () => {
    const { container } = render(<PromoBanner promo={{ headline: 'Just text' }} headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Just text');
    expect(container.querySelector('[data-part="media"], [data-part="actions"], [data-variant]')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'primary');
  });

  it('strip: a one-line region with a compact countdown; the close button hides it and calls onDismiss', () => {
    const onDismiss = vi.fn();
    const { container } = render(<PromoBanner promo={promo} layout="strip" tone="warning" onDismiss={onDismiss} locale="tr" />);
    const strip = screen.getByRole('region', { name: '20% off the first year' });
    expect(strip).toHaveAttribute('data-layout', 'strip');
    expect(container.querySelector('[data-variant="compact"][data-size="sm"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Kampanyayı kapat' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('strip without onDismiss has no close button', () => {
    render(<PromoBanner promo={promo} layout="strip" />);
    expect(screen.queryByRole('button', { name: 'Close offer' })).toBeNull();
  });

  it('ribbon: just the text as a tone badge', () => {
    const { container } = render(<PromoBanner promo={{ ...promo, tone: 'info' }} layout="ribbon" />);
    const ribbon = container.firstElementChild!;
    expect(ribbon.tagName).toBe('SPAN');
    expect(ribbon).toHaveAttribute('data-layout', 'ribbon');
    expect(ribbon).toHaveClass('bg-info-subtle', 'text-info-fg');
    expect(ribbon).toHaveTextContent('20% off the first year');
    expect(container.querySelector('code, a, img')).toBeNull();
  });

  it('copies the coupon code, announces it and resets after 1.5 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const onCopyCode = vi.fn();
    render(<PromoBanner promo={promo} onCopyCode={onCopyCode} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy code' })); });
    expect(writeText).toHaveBeenCalledWith('SUMMER20');
    expect(onCopyCode).toHaveBeenCalledWith('SUMMER20');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
