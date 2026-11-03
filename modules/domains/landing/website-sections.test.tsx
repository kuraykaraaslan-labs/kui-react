import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { EventDates, sortedDates } from './events/EventDates';
import { CareersSection } from './careers/CareersSection';
import { Downloads, fileKind } from './downloads/Downloads';
import { Certificates } from './trust/Certificates';
import { GiftVoucher, voucherHref } from './gift/GiftVoucher';
import { QrCodes, qrTargets } from './media/QrCodes';
import { NewsletterSignup } from './newsletter/NewsletterSignup';
import { ReviewsStrip } from './reviews/ReviewsStrip';

afterEach(cleanup);

describe('website sections (mirrors of the dynamic_page blocks)', () => {
  it('EventDates sorts, drops past dates and keeps a sold-out row without its link', async () => {
    expect(sortedDates([{ date: '2031-02-01', title: 'B' }, { date: 'x', title: 'Bad' }, { date: '2031-01-01', title: 'A' }]).map((d) => d.title)).toEqual(['A', 'B']);
    render(<EventDates dates={[{ date: '2020-01-01', title: 'Old' }, { date: '2031-05-01', title: 'Arena', status: 'Sold out', href: '/t/1' }, { date: '2031-06-01', title: 'Club', href: '/t/2' }]} />);
    await waitFor(() => expect(screen.queryByText('Old')).toBeNull());
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Tickets: Club, 2031-06-01' })).toHaveAttribute('href', '/t/2');
  });

  it('CareersSection filters by team and keeps the open application', () => {
    render(<CareersSection roles={[{ title: 'Chef', team: 'Kitchen', href: '/apply' }, { title: 'Host', team: 'Floor' }]} generalHref="/contact" />);
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
    expect(screen.queryByText('Host')).toBeNull();
    expect(screen.getByRole('link', { name: 'Apply: Chef' })).toHaveAttribute('href', '/apply');
    expect(screen.getByRole('link', { name: 'Send an open application' })).toHaveAttribute('href', '/contact');
  });

  it('Downloads names the file and its kind, and refuses unsafe links', () => {
    expect(fileKind('/a/b.PDF?x')).toBe('pdf');
    render(<Downloads files={[{ title: 'Bad', href: 'javascript:alert(1)' }, { title: 'Catalogue', href: '/c.pdf', size: '2 MB' }]} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Download: Catalogue, PDF' })).toHaveAttribute('download');
  });

  it('Certificates shows the issuer and number and links only an http(s) register', () => {
    render(<Certificates items={[{ title: 'ISO 9001', issuer: 'Bureau', year: '2025', number: 'Q-1', verifyHref: 'https://reg.test/q-1' }, { title: 'Award', verifyHref: 'javascript:x' }]} />);
    expect(screen.getByText('Bureau · 2025')).toBeInTheDocument();
    expect(screen.getByText('No. Q-1')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('GiftVoucher chooses an amount and buys it', () => {
    expect(voucherHref('/shop?x=1#v', 50)).toBe('/shop?x=1&amount=50#v');
    render(<GiftVoucher businessName="Serene" currency="€" amounts={[50, 100]} buyHref="/shop" locale="en" />);
    fireEvent.click(screen.getByRole('radio', { name: '€100' }));
    expect(screen.getByRole('link', { name: 'Buy a voucher' })).toHaveAttribute('href', '/shop?amount=100');
  });

  it('QrCodes draws one code per table as an image, and nothing for an unsafe address', async () => {
    expect(qrTargets('/menu', 2).map((t) => t.url)).toEqual(['/menu?table=1', '/menu?table=2']);
    const { container, rerender } = render(<QrCodes url="/menu" tables={2} />);
    expect(await screen.findByRole('img', { name: 'QR code for Table 1' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/));
    rerender(<QrCodes url="javascript:alert(1)" />);
    expect(container.innerHTML).toBe('');
  });

  it('NewsletterSignup needs consent before it subscribes', async () => {
    const onSubscribe = vi.fn(async () => true);
    render(<NewsletterSignup onSubscribe={onSubscribe} privacyHref="/privacy" />);
    fireEvent.change(screen.getByLabelText('E-mail address'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('tick the box');
    expect(onSubscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(onSubscribe).toHaveBeenCalledWith('a@b.co');
  });

  it('ReviewsStrip shows the score with its source and links to it', () => {
    render(<ReviewsStrip title="Reviews" score={4.8} count={120} source="google" profileHref="https://g.test/r" reviews={[{ name: 'Ada', rating: 5, text: 'Lovely' }]} />);
    expect(screen.getByText('120 reviews · Google')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read all on Google' })).toHaveAttribute('href', 'https://g.test/r');
    expect(screen.getByText('“Lovely”')).toBeInTheDocument();
  });
});
