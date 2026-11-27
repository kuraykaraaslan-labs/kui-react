'use client';
import { PromoBanner } from '@/modules/domains/landing/promo/PromoBanner';
import { PricingPlanCard } from '@/modules/domains/landing/pricing/PricingPlanCard';
import type { Promo } from '@/modules/domains/landing/types';
import type { ShowcaseComponent } from '../showcase.types';

// A fixed end date keeps the server and client renders equal; the countdown ticks on the client.
const ENDS_AT = '2027-01-01T00:00:00Z';

const IMAGE = '/assets/img/screenshot-landing.png';

const SUMMER: Promo = {
  id: 'summer-2026',
  eyebrow: 'Summer sale',
  headline: '20% off your first year',
  body: 'Every yearly plan, for new workspaces. Ends at midnight on 31 December.',
  cta: { label: 'See plans', href: '#pricing' },
  image: { src: IMAGE, alt: '' },
  endsAt: ENDS_AT,
  couponCode: 'SUMMER20',
};

export function buildLandingPromoData(): ShowcaseComponent[] {
  return [
    {
      id: 'landing-promo-banner',
      title: 'PromoBanner',
      category: 'Domain',
      abbr: 'Pm',
      description:
        'A time-boxed campaign in three layouts: `banner` (image beside the text, stacks on phones, image box keeps its aspect ratio so a late banner does not shift the page), `strip` (a one-line top bar, closable through `onDismiss`) and `ribbon` (a badge for pricing cards). Eyebrow, headline, body, a button, a Countdown to `endsAt` and a coupon code with a copy button, in the primary, success, warning, info or neutral tone.',
      filePath: 'modules/domains/landing/promo/PromoBanner.tsx',
      since: '2026-11',
      whenToUse: 'Marketing campaigns and limited offers on a public site: above the header, between sections, on a pricing plan.',
      whenNotToUse: 'Product or system notices (use AlertBanner or AnnouncementBar), cookie or consent notices.',
      composes: ['button', 'badge', 'countdown'],
      relatedTo: ['landing-announcement-bar', 'landing-pricing-plan-card', 'landing-hero-section'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['Region (banner, strip)', 'Timer (aria-live off)', 'Status (copied)'],
        notes: 'The banner is a section named by its heading; the strip a region named by its headline. The close and copy buttons have names; a copy is announced through a polite status line.',
      },
      designTokens: ['--primary-subtle', '--success-subtle', '--warning-subtle', '--info-subtle', '--surface-raised', '--border-strong', '--text-primary', '--text-secondary'],
      sourceCode: `import { PromoBanner } from '@/modules/domains/landing';

<PromoBanner promo={campaign} />
<PromoBanner promo={campaign} layout="strip" onDismiss={() => remember(campaign.id)} />
<PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" tone="warning" />`,
      variants: [
        {
          title: 'Banner (image, countdown, coupon)',
          layout: 'stack',
          preview: <PromoBanner promo={SUMMER} className="w-full" />,
          code: `<PromoBanner promo={{
  eyebrow: 'Summer sale',
  headline: '20% off your first year',
  body: 'Every yearly plan, for new workspaces.',
  cta: { label: 'See plans', href: '/pricing' },
  image: { src: '/promo.jpg', mobileSrc: '/promo-phone.jpg' },
  endsAt: '2027-01-01T00:00:00Z',
  couponCode: 'SUMMER20',
}} />`,
        },
        {
          title: 'Banner tones (no image)',
          layout: 'stack',
          preview: (
            <div className="flex w-full flex-col gap-4">
              <PromoBanner promo={{ eyebrow: 'Black Friday', headline: 'Two months free on Pro', cta: { label: 'Upgrade', href: '#' } }} tone="warning" />
              <PromoBanner promo={{ eyebrow: 'New region', headline: 'Now hosted in Frankfurt', body: 'Move your workspace in one click.' }} tone="info" headingLevel={3} />
              <PromoBanner promo={{ headline: 'Yaz kampanyası', couponCode: 'YAZ20', endsAt: ENDS_AT }} tone="neutral" locale="tr" headingLevel={3} />
            </div>
          ),
          code: `<PromoBanner promo={promo} tone="warning" />\n<PromoBanner promo={promo} tone="info" headingLevel={3} />\n<PromoBanner promo={promo} tone="neutral" locale="tr" />`,
        },
        {
          title: 'Strip (top bar, closable)',
          layout: 'stack',
          preview: (
            <div className="flex w-full flex-col gap-3">
              <PromoBanner promo={SUMMER} layout="strip" onDismiss={() => {}} />
              <PromoBanner promo={{ headline: 'Free shipping this weekend', cta: { label: 'Shop now', href: '#' } }} layout="strip" tone="success" />
            </div>
          ),
          code: `<PromoBanner promo={campaign} layout="strip" onDismiss={() => localStorage.setItem('promo:' + campaign.id, '1')} />`,
        },
        {
          title: 'Ribbon (pricing cards)',
          preview: (
            <div className="flex flex-col items-start gap-4">
              <div className="flex flex-wrap gap-2">
                <PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" />
                <PromoBanner promo={{ headline: 'Last 3 days' }} layout="ribbon" tone="warning" />
                <PromoBanner promo={{ headline: 'Free setup' }} layout="ribbon" tone="success" />
              </div>
              <div className="relative w-72">
                <PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" tone="warning" className="absolute -top-3 end-4 z-10" />
                <PricingPlanCard plan={{ planId: 'pro', name: 'Pro', price: 29, currency: 'USD', interval: 'MONTHLY', features: ['Unlimited projects', 'Priority support'] }} />
              </div>
            </div>
          ),
          code: `<PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" tone="warning" />`,
        },
      ],
    },
  ];
}
