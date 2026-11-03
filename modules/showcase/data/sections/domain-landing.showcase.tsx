'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { AnnouncementBar } from '@/modules/domains/landing/nav/AnnouncementBar';
import { MegaMenu, useMegaMenu } from '@/modules/domains/landing/nav/MegaMenu';
import { HeroSection } from '@/modules/domains/landing/hero/HeroSection';
import { FeatureCard } from '@/modules/domains/landing/feature/FeatureCard';
import { FeatureGrid } from '@/modules/domains/landing/feature/FeatureGrid';
import { PricingPlanCard } from '@/modules/domains/landing/pricing/PricingPlanCard';
import { PricingGrid } from '@/modules/domains/landing/pricing/PricingGrid';
import { TestimonialCard } from '@/modules/domains/landing/testimonial/TestimonialCard';
import { TestimonialGrid } from '@/modules/domains/landing/testimonial/TestimonialGrid';
import { FaqAccordion } from '@/modules/domains/landing/faq/FaqAccordion';
import { StatsBar } from '@/modules/domains/landing/stat/StatsBar';
import { TeamMemberCard } from '@/modules/domains/landing/team/TeamMemberCard';
import { PartnerLogosStrip } from '@/modules/domains/landing/partner/PartnerLogosStrip';
import { HowItWorksSection } from '@/modules/domains/landing/how-it-works/HowItWorksSection';
import { OpeningHours, type OpeningHoursRow } from '@/modules/domains/landing/hours/OpeningHours';
import { ListingCards, type Listing } from '@/modules/domains/landing/listing/ListingCards';
import { Timetable, type TimetableSession } from '@/modules/domains/landing/schedule/Timetable';
import { ImageMarks } from '@/modules/domains/landing/media/ImageMarks';
import { faBed, faBath, faRulerCombined, faUsers, faGasPump, faGear, faCalendar } from '@fortawesome/free-solid-svg-icons';
import {
  faBullhorn, faTag,
  faRocket, faCodeBranch, faChartLine, faPlug,
  faBook, faRss, faClockRotateLeft, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import type {
  Hero,
  Feature,
  PricingPlan,
  Testimonial,
  FaqItem,
  Stat,
  TeamMember,
  PartnerLogo,
  HowItWorksStep,
} from '@/modules/domains/landing/types';

/* ─── demo data ─── */

const HOURS_SHOP: OpeningHoursRow[] = [
  ...(['mo', 'tu', 'we', 'th', 'fr'] as const).map((day) => ({ day, open: '09:00', close: '18:00' })),
  { day: 'sa', open: '10:00', close: '16:00' },
  { day: 'su', closed: true },
];

const HOURS_RESTAURANT: OpeningHoursRow[] = [
  { day: 'tu', open: '12:00', close: '15:00' }, { day: 'tu', open: '18:00', close: '23:00' },
  { day: 'we', open: '12:00', close: '23:00' }, { day: 'th', open: '12:00', close: '23:00' },
  { day: 'fr', open: '12:00', close: '01:00' }, { day: 'sa', open: '12:00', close: '01:00' },
  { day: 'su', open: '12:00', close: '22:00' },
];

const LISTINGS_ESTATE: Listing[] = [
  { title: '3+1 flat with a sea view', price: '₺8,450,000', location: 'Karşıyaka, İzmir', status: 'For sale', href: '#', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', facts: [{ icon: faBed, text: '3 bedrooms' }, { icon: faBath, text: '2 bathrooms' }, { icon: faRulerCombined, text: '135 m²' }] },
  { title: '2+1 flat near the metro', price: '₺32,000', period: '/ month', location: 'Bornova, İzmir', status: 'For rent', href: '#', imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80', facts: [{ icon: faBed, text: '2 bedrooms' }, { icon: faRulerCombined, text: '95 m²' }] },
  { title: 'Detached house with a garden', location: 'Urla, İzmir', status: 'Sold', imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', facts: [{ icon: faBed, text: '4 bedrooms' }, { icon: faRulerCombined, text: '210 m²' }] },
];
const LISTINGS_ROOMS: Listing[] = [
  { title: 'Double room, sea view', price: '€89', period: '/ night', href: '#', imageUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80', facts: [{ icon: faUsers, text: '2 guests' }, { icon: faBed, text: 'Double bed' }] },
  { title: 'Suite with a terrace', price: '€149', period: '/ night', status: 'Booked', imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80', facts: [{ icon: faUsers, text: '2 guests' }, { icon: faBed, text: 'King bed' }] },
];
const LISTINGS_CARS: Listing[] = [
  { title: 'Hatchback 1.5, 2021', price: '₺1,190,000', location: '48,000 km', status: 'For sale', href: '#', imageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', facts: [{ icon: faGasPump, text: 'Diesel' }, { icon: faGear, text: 'Automatic' }, { icon: faCalendar, text: '2021' }] },
  { title: 'Estate 1.6, 2019', price: '₺925,000', location: '91,000 km', status: 'Reserved', imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', facts: [{ icon: faGasPump, text: 'Petrol' }, { icon: faGear, text: 'Manual' }] },
];
const TIMETABLE_GYM: TimetableSession[] = [
  { day: 0, start: '07:00', end: '08:00', name: 'Spin', who: 'Ayşe', where: 'Studio 1' },
  { day: 0, start: '19:00', end: '20:00', name: 'Yoga', who: 'Ece', where: 'Studio 2' },
  { day: 1, start: '18:30', end: '19:30', name: 'Strength', who: 'Mert', where: 'Gym floor' },
  { day: 2, start: '07:00', end: '08:00', name: 'Spin', who: 'Ayşe', where: 'Studio 1' },
  { day: 3, start: '19:00', end: '20:00', name: 'Pilates', who: 'Ece', where: 'Studio 2' },
  { day: 5, start: '10:00', end: '11:00', name: 'HIIT', who: 'Mert', where: 'Studio 1' },
];

const HERO_WITH_IMAGE: Hero = {
  eyebrow: 'Now in public beta',
  headline: 'Ship better products, faster.',
  subheadline: 'Velox gives your team a single workspace for planning, building, and shipping.',
  primaryCta: { label: 'Start for free', href: '#' },
  secondaryCta: { label: 'Watch demo', href: '#' },
  image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
};

const HERO_NO_IMAGE: Hero = {
  eyebrow: 'New feature',
  headline: 'The fastest way to go from idea to production.',
  subheadline: 'Automated deployments, real-time analytics, and 100+ integrations in one platform.',
  primaryCta: { label: 'Get started', href: '#' },
  secondaryCta: { label: 'View docs', href: '#', external: true },
};

const FEATURES: Feature[] = [
  { featureId: 'f1', icon: 'bolt',         title: 'Blazing fast deploys', description: 'Push to production in under 60 seconds with zero-downtime rolling releases.' },
  { featureId: 'f2', icon: 'shield-halved',title: 'SOC 2 compliant',      description: 'Enterprise-grade security with end-to-end encryption and audit logs.' },
  { featureId: 'f3', icon: 'chart-line',   title: 'Real-time analytics',  description: 'Monitor performance, errors, and user behaviour from a single pane of glass.' },
  { featureId: 'f4', icon: 'code-branch',  title: 'Git-native workflow',  description: 'Connect any repo. Preview branches auto-deploy and expire on merge.' },
  { featureId: 'f5', icon: 'users',        title: 'Team collaboration',   description: 'Built-in review flows, comments, and approval gates — no extra tooling.' },
  { featureId: 'f6', icon: 'plug',         title: '100+ integrations',    description: 'Slack, GitHub, Jira, PagerDuty, and more — connect your stack in minutes.' },
];

const PLAN_FREE: PricingPlan = {
  planId: 'starter',
  name: 'Starter',
  description: 'Perfect for indie hackers and small projects.',
  price: 0,
  currency: 'USD',
  interval: 'MONTHLY',
  features: ['1 project', '3 team members', '1 GB storage', 'Community support'],
  cta: { label: 'Get started free', href: '#' },
};

const PLAN_PRO: PricingPlan = {
  planId: 'pro',
  name: 'Pro',
  description: 'For growing teams that need more power.',
  price: 29,
  currency: 'USD',
  interval: 'MONTHLY',
  features: ['Unlimited projects', '10 team members', '50 GB storage', 'Priority support', 'Custom domains'],
  isPopular: true,
  cta: { label: 'Start free trial', href: '#' },
};

const PLAN_SCALE: PricingPlan = {
  planId: 'scale',
  name: 'Scale',
  description: 'For larger teams with advanced needs.',
  price: 99,
  currency: 'USD',
  interval: 'MONTHLY',
  features: ['Unlimited everything', 'Dedicated support', 'SSO & SAML', 'SLA guarantee'],
  cta: { label: 'Talk to sales', href: '#' },
};

const PLAN_PRO_YEARLY: PricingPlan = { ...PLAN_PRO, planId: 'pro-y', price: 23, interval: 'YEARLY' };
const PLAN_FREE_YEARLY: PricingPlan = { ...PLAN_FREE, planId: 'starter-y', interval: 'YEARLY' };
const PLAN_SCALE_YEARLY: PricingPlan = { ...PLAN_SCALE, planId: 'scale-y', price: 79, interval: 'YEARLY' };

const TESTIMONIAL_FULL: Testimonial = {
  testimonialId: 't1',
  quote: 'Velox cut our deployment pipeline from 20 minutes to under 60 seconds. The team adopted it the same afternoon.',
  authorName: 'Sarah Chen',
  authorTitle: 'CTO',
  companyName: 'Luminary Labs',
  rating: 5,
};

const TESTIMONIAL_MINIMAL: Testimonial = {
  testimonialId: 't2',
  quote: "We evaluated six platforms. Velox was the only one that didn't require us to rewrite our CI config from scratch.",
  authorName: 'Marcus Webb',
  authorTitle: 'Lead Engineer',
  companyName: 'Stackable',
};

const TESTIMONIALS: Testimonial[] = [
  TESTIMONIAL_FULL,
  TESTIMONIAL_MINIMAL,
  { testimonialId: 't3', quote: 'The branch preview feature alone saves us three back-and-forth review cycles per sprint.', authorName: 'Priya Kapoor', authorTitle: 'Head of Product', companyName: 'Nodo', rating: 5 },
  { testimonialId: 't4', quote: "Analytics are finally in one place. I stopped stitching dashboards together at 2 AM.", authorName: 'Tom Alvarez', authorTitle: 'Founding Engineer', companyName: 'Warpgate', rating: 4 },
  { testimonialId: 't5', quote: 'SOC 2 compliance was a blocker for our enterprise sales. Velox resolved that in a week.', authorName: 'Amira Hassan', authorTitle: 'VP Engineering', companyName: 'ClearBridge', rating: 5 },
];

const FAQ_ITEMS: FaqItem[] = [
  { faqId: 'q1', question: 'How does the free trial work?', answer: 'You get 14 days of the Pro plan with no credit card required. At the end of your trial you can downgrade to Starter or pick a paid plan.' },
  { faqId: 'q2', question: 'Can I change my plan at any time?', answer: 'Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the start of your next billing cycle.' },
  { faqId: 'q3', question: 'Which git providers do you support?', answer: 'GitHub, GitLab, and Bitbucket. Self-hosted GitLab is available on the Scale plan.' },
  { faqId: 'q4', question: 'Is there a limit on build minutes?', answer: 'Starter includes 500 min/month, Pro 5 000 min/month, and Scale is unlimited.' },
];

const STATS: Stat[] = [
  { statId: 's1', value: '5 000+', label: 'Teams shipped',   description: 'Across 90 countries' },
  { statId: 's2', value: '99.98%', label: 'Uptime SLA',      description: 'Last 12 months' },
  { statId: 's3', value: '<60s',   label: 'Avg. deploy',     description: 'p95 across regions' },
  { statId: 's4', value: '4.9/5',  label: 'Customer rating', description: '800+ reviews' },
];

const TEAM: TeamMember[] = [
  { memberId: 'm1', name: 'Elena Markov', role: 'CEO & Co-founder', bio: 'Ex-Vercel, ex-Stripe.', socialLinks: [{ platform: 'twitter', url: '#' }, { platform: 'linkedin', url: '#' }] },
  { memberId: 'm2', name: 'David Park',   role: 'CTO & Co-founder', bio: 'Infrastructure at Shopify.', socialLinks: [{ platform: 'github', url: '#' }] },
  { memberId: 'm3', name: 'Fatima Al-Rashid', role: 'Head of Design', bio: 'Ex-Linear.',          socialLinks: [{ platform: 'twitter', url: '#' }] },
  { memberId: 'm4', name: 'Lucas Brandt', role: 'Head of Growth',   bio: 'PLG specialist.',       socialLinks: [{ platform: 'linkedin', url: '#' }] },
];

const PARTNERS: PartnerLogo[] = [
  { partnerId: 'p1', name: 'GitHub',     logo: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg' },
  { partnerId: 'p2', name: 'Stripe',     logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
  { partnerId: 'p3', name: 'Cloudflare', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Cloudflare_Logo.svg' },
  { partnerId: 'p4', name: 'Datadog',    logo: 'https://imgix.datadoghq.com/img/about/presskit/logo-v/dd_vertical_purple.png' },
];

const STEPS: HowItWorksStep[] = [
  { stepId: 'h1', order: 1, icon: 'plug',                 title: 'Connect your repo',       description: 'Link GitHub, GitLab, or Bitbucket in under 30 seconds. No YAML required.' },
  { stepId: 'h2', order: 2, icon: 'wand-magic-sparkles',  title: 'Auto-detect your stack',  description: 'Velox reads your repo and configures the right build pipeline automatically.' },
  { stepId: 'h3', order: 3, icon: 'rocket',               title: 'Ship on every push',      description: 'Every branch gets a preview URL. Merge to main and go live instantly.' },
];

/* ─── demo wrappers ─── */

function HeroWithImageDemo() {
  return <HeroSection hero={HERO_WITH_IMAGE} />;
}
function HeroNoImageDemo() {
  return <div className="bg-surface-base"><HeroSection hero={HERO_NO_IMAGE} /></div>;
}

function FeatureCardDefaultDemo() {
  return (
    <div className="p-6 max-w-xs">
      <FeatureCard feature={FEATURES[0]} />
    </div>
  );
}
function FeatureCardInlineDemo() {
  return (
    <div className="p-6 max-w-sm space-y-4">
      {FEATURES.slice(0, 3).map((f) => <FeatureCard key={f.featureId} feature={f} layout="inline" />)}
    </div>
  );
}

function FeatureGridCardsDemo() {
  return (
    <FeatureGrid
      eyebrow="Everything you need"
      title="Built for teams that move fast"
      subtitle="No more juggling five tabs."
      features={FEATURES}
      columns={3}
    />
  );
}
function FeatureGridInlineDemo() {
  return (
    <FeatureGrid
      title="Core capabilities"
      features={FEATURES.slice(0, 4)}
      layout="inline"
      columns={2}
    />
  );
}

function PricingPlanCardPopularDemo() {
  return (
    <div className="p-6 max-w-xs">
      <PricingPlanCard plan={PLAN_PRO} />
    </div>
  );
}
function PricingPlanCardAllDemo() {
  return (
    <div className="p-6 grid sm:grid-cols-3 gap-4 max-w-3xl">
      <PricingPlanCard plan={PLAN_FREE} />
      <PricingPlanCard plan={PLAN_PRO} />
      <PricingPlanCard plan={PLAN_SCALE} />
    </div>
  );
}

function PricingGridMonthlyDemo() {
  return (
    <PricingGrid
      eyebrow="Simple pricing"
      title="Start free, scale when ready"
      plans={[PLAN_FREE, PLAN_PRO, PLAN_SCALE]}
      showIntervalToggle={false}
    />
  );
}
function PricingGridWithToggleDemo() {
  return (
    <PricingGrid
      eyebrow="Simple pricing"
      title="Start free, scale when ready"
      subtitle="Switch between monthly and yearly billing."
      plans={[PLAN_FREE, PLAN_PRO, PLAN_SCALE, PLAN_FREE_YEARLY, PLAN_PRO_YEARLY, PLAN_SCALE_YEARLY]}
      showIntervalToggle
    />
  );
}

function TestimonialCardFullDemo() {
  return (
    <div className="p-6 max-w-sm">
      <TestimonialCard testimonial={TESTIMONIAL_FULL} />
    </div>
  );
}
function TestimonialCardMinimalDemo() {
  return (
    <div className="p-6 max-w-sm">
      <TestimonialCard testimonial={TESTIMONIAL_MINIMAL} />
    </div>
  );
}

function TestimonialGridDemo() {
  return (
    <TestimonialGrid
      eyebrow="What teams say"
      title="Loved by engineers worldwide"
      testimonials={TESTIMONIALS}
    />
  );
}

function FaqAccordionSingleDemo() {
  return (
    <FaqAccordion
      eyebrow="FAQ"
      title="Common questions"
      items={FAQ_ITEMS}
    />
  );
}
function FaqAccordionMultiDemo() {
  return (
    <FaqAccordion
      title="Common questions"
      items={FAQ_ITEMS}
      allowMultiple
    />
  );
}

function StatsBarBandDemo() {
  return <StatsBar stats={STATS} variant="band" />;
}
function StatsBarCardsDemo() {
  return (
    <div className="p-6">
      <StatsBar stats={STATS} variant="cards" />
    </div>
  );
}

function TeamMemberCardWithSocialDemo() {
  return (
    <div className="p-6 grid sm:grid-cols-2 gap-4 max-w-md">
      <TeamMemberCard member={TEAM[0]} />
      <TeamMemberCard member={TEAM[1]} />
    </div>
  );
}
function TeamMemberCardGridDemo() {
  return (
    <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {TEAM.map((m) => <TeamMemberCard key={m.memberId} member={m} />)}
    </div>
  );
}

function PartnerLogosStripDemo() {
  return (
    <PartnerLogosStrip label="Trusted by teams at" partners={PARTNERS} />
  );
}
function PartnerLogosNoLabelDemo() {
  return <PartnerLogosStrip partners={PARTNERS} />;
}

function HowItWorksHorizontalDemo() {
  return (
    <HowItWorksSection
      eyebrow="Getting started"
      title="From repo to production in 3 steps"
      steps={STEPS}
      layout="horizontal"
    />
  );
}
function HowItWorksVerticalDemo() {
  return (
    <HowItWorksSection
      title="How it works"
      steps={STEPS}
      layout="vertical"
    />
  );
}

/* ─── AnnouncementBar demos ─── */

function AnnouncementBarDefaultDemo() {
  return (
    <AnnouncementBar
      icon={faBullhorn}
      message={<><span className="font-semibold">Velox 2.0 is here</span> — faster builds, smarter branch previews.</>}
      cta={{ label: 'Read the announcement', href: '#' }}
    />
  );
}

function AnnouncementBarNoDismissDemo() {
  return (
    <AnnouncementBar
      icon={faTag}
      message="Black Friday — 40% off all plans this week only."
      cta={{ label: 'Claim offer', href: '#' }}
      dismissible={false}
    />
  );
}

/* ─── MegaMenu demos ─── */

const DEMO_PRODUCT_ITEMS = [
  { icon: faRocket,     label: 'Deployments',     description: 'Zero-downtime rolling releases',   href: '#' },
  { icon: faCodeBranch, label: 'Branch Previews', description: 'Auto-deploy on every push',        href: '#' },
  { icon: faChartLine,  label: 'Analytics',       description: 'Performance & error monitoring',   href: '#' },
  { icon: faPlug,       label: 'Integrations',    description: '100+ tools in one click',          href: '#' },
];

const DEMO_RESOURCES_ITEMS = [
  { icon: faBook,            label: 'Documentation', description: 'Guides and API references', href: '#' },
  { icon: faRss,             label: 'Blog',          description: 'News and engineering posts', href: '#' },
  { icon: faClockRotateLeft, label: 'Changelog',     description: 'Every release, documented', href: '#' },
  { icon: faCircleCheck,     label: 'System Status', description: 'Live uptime & incidents',   href: '#' },
];

function MegaMenuProductDemo() {
  const { openId, open, scheduleClose } = useMegaMenu();
  return (
    <div className="flex justify-center py-8" style={{ minHeight: 340 }}>
      <MegaMenu.Root id="product" openId={openId} onOpen={open} onScheduleClose={scheduleClose}>
        <MegaMenu.Trigger label="Product" isOpen={openId === 'product'} />
        {openId === 'product' && (
          <MegaMenu.Panel id="product" onOpen={open} onScheduleClose={scheduleClose} width="w-[560px]" align="left">
            <div className="grid grid-cols-[1fr_176px]">
              <MegaMenu.Section label="Platform">
                {DEMO_PRODUCT_ITEMS.map((item) => (
                  <MegaMenu.Item key={item.label} {...item} iconVariant="primary" />
                ))}
                <MegaMenu.Footer label="See all features" href="#" />
              </MegaMenu.Section>
              <MegaMenu.FeaturedCard
                eyebrow="What's new"
                title="Velox 2.0"
                description="Faster builds, smarter previews, zero-config monorepo."
                secondaryCta={{ label: 'Read announcement', href: '#' }}
                primaryCta={{ label: 'Start free', href: '#' }}
              />
            </div>
          </MegaMenu.Panel>
        )}
      </MegaMenu.Root>
    </div>
  );
}

function MegaMenuResourcesDemo() {
  const { openId, open, scheduleClose } = useMegaMenu();
  return (
    <div className="flex justify-center py-8" style={{ minHeight: 260 }}>
      <MegaMenu.Root id="resources" openId={openId} onOpen={open} onScheduleClose={scheduleClose}>
        <MegaMenu.Trigger label="Resources" isOpen={openId === 'resources'} />
        {openId === 'resources' && (
          <MegaMenu.Panel id="resources" onOpen={open} onScheduleClose={scheduleClose} width="w-[380px]" align="center">
            <MegaMenu.Section label="Resources">
              <div className="grid grid-cols-2 gap-0.5">
                {DEMO_RESOURCES_ITEMS.map((item) => (
                  <MegaMenu.Item key={item.label} {...item} iconVariant="neutral" />
                ))}
              </div>
            </MegaMenu.Section>
          </MegaMenu.Panel>
        )}
      </MegaMenu.Root>
    </div>
  );
}

/* ─── builder ─── */

export function buildLandingDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'landing-hero-section',
      title: 'HeroSection',
      category: 'Domain',
      abbr: 'HS',
      description: 'Full-width landing hero with eyebrow label, headline, subheadline, dual CTAs, and an optional right-column image. Gradient blobs are applied in-component.',
      filePath: 'modules/domains/landing/hero/HeroSection.tsx',
      sourceCode: `'use client';
import { HeroSection } from '@/modules/domains/landing/hero/HeroSection';

const hero = {
  eyebrow: 'Now in public beta',
  headline: 'Ship better products, faster.',
  subheadline: 'One workspace for planning, building, and shipping.',
  primaryCta:   { label: 'Start for free', href: '/signup' },
  secondaryCta: { label: 'Watch demo',     href: '#demo'   },
  image: '/hero.png',
};

<HeroSection hero={hero} />`,
      variants: [
        { title: 'With image', layout: 'stack', preview: <HeroWithImageDemo />, code: `<HeroSection hero={{ headline: 'Ship better products, faster.', primaryCta: { label: 'Start for free', href: '#' }, image: '/hero.png' }} />` },
        { title: 'Text only', layout: 'stack', preview: <HeroNoImageDemo />, code: `<HeroSection hero={{ eyebrow: 'New feature', headline: 'The fastest way to go from idea to production.', primaryCta: { label: 'Get started', href: '#' } }} />` },
      ],
    },
    {
      id: 'landing-feature-card',
      title: 'FeatureCard',
      category: 'Domain',
      abbr: 'FC',
      description: 'Single feature item with Font Awesome icon, title, and description. layout="card" renders a raised card with hover border; layout="inline" renders a compact horizontal row.',
      filePath: 'modules/domains/landing/feature/FeatureCard.tsx',
      sourceCode: `'use client';
import { FeatureCard } from '@/modules/domains/landing/feature/FeatureCard';

// Card layout (default)
<FeatureCard feature={{ featureId: 'f1', icon: 'bolt', title: 'Fast deploys', description: 'Push in under 60s.' }} />

// Inline layout
<FeatureCard feature={feature} layout="inline" />`,
      variants: [
        { title: 'Card layout', preview: <FeatureCardDefaultDemo />, code: `<FeatureCard feature={{ featureId: 'f1', icon: 'bolt', title: 'Fast deploys', description: 'Push in under 60s.' }} />` },
        { title: 'Inline layout', layout: 'stack', preview: <FeatureCardInlineDemo />, code: `<FeatureCard feature={feature} layout="inline" />` },
      ],
    },
    {
      id: 'landing-feature-grid',
      title: 'FeatureGrid',
      category: 'Domain',
      abbr: 'FG',
      description: 'Section wrapper that renders a heading block and a responsive grid of FeatureCard components. columns prop controls breakpoints; layout prop is passed down to each card.',
      filePath: 'modules/domains/landing/feature/FeatureGrid.tsx',
      sourceCode: `'use client';
import { FeatureGrid } from '@/modules/domains/landing/feature/FeatureGrid';

<FeatureGrid
  eyebrow="Everything you need"
  title="Built for teams that move fast"
  subtitle="One platform for the entire workflow."
  features={features}
  columns={3}
/>`,
      variants: [
        { title: '3-column cards', layout: 'stack', preview: <FeatureGridCardsDemo />, code: `<FeatureGrid title="Built for teams" features={features} columns={3} />` },
        { title: '2-column inline', layout: 'stack', preview: <FeatureGridInlineDemo />, code: `<FeatureGrid title="Core capabilities" features={features} layout="inline" columns={2} />` },
      ],
    },
    {
      id: 'landing-pricing-plan-card',
      title: 'PricingPlanCard',
      category: 'Domain',
      abbr: 'PP',
      description: 'Marketing-oriented pricing card with formatted price, interval label, feature checklist, and a CTA link. isPopular adds a "Most Popular" badge and primary border highlight.',
      filePath: 'modules/domains/landing/pricing/PricingPlanCard.tsx',
      sourceCode: `'use client';
import { PricingPlanCard } from '@/modules/domains/landing/pricing/PricingPlanCard';

// Popular plan (highlighted)
<PricingPlanCard plan={{ planId: 'pro', name: 'Pro', price: 29, interval: 'MONTHLY', isPopular: true, features: ['...'], cta: { label: 'Start trial', href: '#' } }} />`,
      variants: [
        { title: 'Popular plan', preview: <PricingPlanCardPopularDemo />, code: `<PricingPlanCard plan={{ ...plan, isPopular: true }} />` },
        { title: 'All plans', layout: 'stack', preview: <PricingPlanCardAllDemo />, code: `<PricingPlanCard plan={freePlan} />\n<PricingPlanCard plan={{ ...proPlan, isPopular: true }} />\n<PricingPlanCard plan={scalePlan} />` },
      ],
    },
    {
      id: 'landing-pricing-grid',
      title: 'PricingGrid',
      category: 'Domain',
      abbr: 'PG',
      description: 'Pricing section that wraps PricingPlanCard in a responsive grid. showIntervalToggle renders a Monthly/Yearly switch and filters plans by the selected interval.',
      filePath: 'modules/domains/landing/pricing/PricingGrid.tsx',
      sourceCode: `'use client';
import { PricingGrid } from '@/modules/domains/landing/pricing/PricingGrid';

// With interval toggle — provide monthly AND yearly plan variants
<PricingGrid
  title="Start free, scale when ready"
  plans={[...monthlyPlans, ...yearlyPlans]}
  showIntervalToggle
/>`,
      variants: [
        { title: 'Monthly only', layout: 'stack', preview: <PricingGridMonthlyDemo />, code: `<PricingGrid title="Pricing" plans={monthlyPlans} showIntervalToggle={false} />` },
        { title: 'With interval toggle', layout: 'stack', preview: <PricingGridWithToggleDemo />, code: `<PricingGrid title="Pricing" plans={[...monthlyPlans, ...yearlyPlans]} showIntervalToggle />` },
      ],
    },
    {
      id: 'landing-testimonial-card',
      title: 'TestimonialCard',
      category: 'Domain',
      abbr: 'TC',
      description: 'Customer quote card with optional star rating, author initials fallback avatar, name, title, company, and company logo. All fields except quote and authorName are optional.',
      filePath: 'modules/domains/landing/testimonial/TestimonialCard.tsx',
      sourceCode: `'use client';
import { TestimonialCard } from '@/modules/domains/landing/testimonial/TestimonialCard';

<TestimonialCard testimonial={{
  testimonialId: 't1',
  quote: 'Velox cut our deploy time from 20 min to 60 s.',
  authorName: 'Sarah Chen',
  authorTitle: 'CTO',
  companyName: 'Luminary Labs',
  rating: 5,
}} />`,
      variants: [
        { title: 'With rating & company', preview: <TestimonialCardFullDemo />, code: `<TestimonialCard testimonial={{ ...testimonial, rating: 5 }} />` },
        { title: 'Minimal', preview: <TestimonialCardMinimalDemo />, code: `<TestimonialCard testimonial={{ testimonialId: 't1', quote: '...', authorName: 'Marcus Webb' }} />` },
      ],
    },
    {
      id: 'landing-testimonial-grid',
      title: 'TestimonialGrid',
      category: 'Domain',
      abbr: 'TG',
      description: 'Masonry columns grid of TestimonialCard components with a centred heading block. Uses CSS columns for the masonry effect — cards automatically balance across columns.',
      filePath: 'modules/domains/landing/testimonial/TestimonialGrid.tsx',
      sourceCode: `'use client';
import { TestimonialGrid } from '@/modules/domains/landing/testimonial/TestimonialGrid';

<TestimonialGrid
  eyebrow="What teams say"
  title="Loved by engineers worldwide"
  testimonials={testimonials}
/>`,
      variants: [
        { title: 'Masonry grid', layout: 'stack', preview: <TestimonialGridDemo />, code: `<TestimonialGrid title="What teams say" testimonials={testimonials} />` },
      ],
    },
    {
      id: 'landing-faq-accordion',
      title: 'FaqAccordion',
      category: 'Domain',
      abbr: 'FA',
      description: 'Accessible accordion for FAQ items using aria-expanded + aria-controls. By default only one item is open at a time; allowMultiple enables concurrent open items. First item is pre-opened.',
      filePath: 'modules/domains/landing/faq/FaqAccordion.tsx',
      sourceCode: `'use client';
import { FaqAccordion } from '@/modules/domains/landing/faq/FaqAccordion';

// Single open (default)
<FaqAccordion title="Common questions" items={faqItems} />

// Multiple open
<FaqAccordion title="Common questions" items={faqItems} allowMultiple />`,
      variants: [
        { title: 'Single open', layout: 'stack', preview: <FaqAccordionSingleDemo />, code: `<FaqAccordion eyebrow="FAQ" title="Common questions" items={faqItems} />` },
        { title: 'Allow multiple open', layout: 'stack', preview: <FaqAccordionMultiDemo />, code: `<FaqAccordion title="Common questions" items={faqItems} allowMultiple />` },
      ],
    },
    {
      id: 'landing-stats-bar',
      title: 'StatsBar',
      category: 'Domain',
      abbr: 'SB',
      description: 'Social proof stats display in two variants. band renders a full-width <dl> grid with dividers; cards renders a grid of bordered stat cards.',
      filePath: 'modules/domains/landing/stat/StatsBar.tsx',
      sourceCode: `'use client';
import { StatsBar } from '@/modules/domains/landing/stat/StatsBar';

// Full-width band (default)
<StatsBar stats={stats} />

// Card grid
<StatsBar stats={stats} variant="cards" />`,
      variants: [
        { title: 'Band variant', layout: 'stack', preview: <StatsBarBandDemo />, code: `<StatsBar stats={stats} variant="band" />` },
        { title: 'Cards variant', layout: 'stack', preview: <StatsBarCardsDemo />, code: `<StatsBar stats={stats} variant="cards" />` },
      ],
    },
    {
      id: 'landing-team-member-card',
      title: 'TeamMemberCard',
      category: 'Domain',
      abbr: 'TM',
      description: 'Centered team card showing avatar (or initials fallback), name, role, optional bio, and social link icons for LinkedIn, X (Twitter), and GitHub.',
      filePath: 'modules/domains/landing/team/TeamMemberCard.tsx',
      sourceCode: `'use client';
import { TeamMemberCard } from '@/modules/domains/landing/team/TeamMemberCard';

<TeamMemberCard member={{
  memberId: 'm1',
  name: 'Elena Markov',
  role: 'CEO & Co-founder',
  bio: 'Ex-Vercel, ex-Stripe.',
  socialLinks: [
    { platform: 'twitter',  url: 'https://x.com/elena' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/elena' },
  ],
}} />`,
      variants: [
        { title: 'Two cards', layout: 'stack', preview: <TeamMemberCardWithSocialDemo />, code: `<TeamMemberCard member={member} />` },
        { title: 'Four-column grid', layout: 'stack', preview: <TeamMemberCardGridDemo />, code: `{team.map((m) => <TeamMemberCard key={m.memberId} member={m} />)}` },
      ],
    },
    {
      id: 'landing-partner-logos-strip',
      title: 'PartnerLogosStrip',
      category: 'Domain',
      abbr: 'PL',
      description: 'Horizontal strip of grayscale partner logos. On hover the logo transitions to full colour. Logos with a url prop are wrapped in an accessible <a>.',
      filePath: 'modules/domains/landing/partner/PartnerLogosStrip.tsx',
      sourceCode: `'use client';
import { PartnerLogosStrip } from '@/modules/domains/landing/partner/PartnerLogosStrip';

<PartnerLogosStrip
  label="Trusted by teams at"
  partners={[
    { partnerId: 'p1', name: 'GitHub', logo: '/logos/github.svg', url: 'https://github.com' },
  ]}
/>`,
      variants: [
        { title: 'With label', layout: 'stack', preview: <PartnerLogosStripDemo />, code: `<PartnerLogosStrip label="Trusted by teams at" partners={partners} />` },
        { title: 'Without label', layout: 'stack', preview: <PartnerLogosNoLabelDemo />, code: `<PartnerLogosStrip partners={partners} />` },
      ],
    },
    {
      id: 'landing-how-it-works',
      title: 'HowItWorksSection',
      category: 'Domain',
      abbr: 'HW',
      description: 'Process steps section in two layouts. horizontal shows numbered/icon circles in a row connected by a dashed line. vertical stacks them with a timeline connector.',
      filePath: 'modules/domains/landing/how-it-works/HowItWorksSection.tsx',
      sourceCode: `'use client';
import { HowItWorksSection } from '@/modules/domains/landing/how-it-works/HowItWorksSection';

// Horizontal (default)
<HowItWorksSection
  eyebrow="Getting started"
  title="From repo to production in 3 steps"
  steps={steps}
  layout="horizontal"
/>

// Vertical timeline
<HowItWorksSection title="How it works" steps={steps} layout="vertical" />`,
      variants: [
        { title: 'Horizontal layout', layout: 'stack', preview: <HowItWorksHorizontalDemo />, code: `<HowItWorksSection title="3 simple steps" steps={steps} layout="horizontal" />` },
        { title: 'Vertical timeline', layout: 'stack', preview: <HowItWorksVerticalDemo />, code: `<HowItWorksSection title="How it works" steps={steps} layout="vertical" />` },
      ],
    },
    {
      id: 'landing-announcement-bar',
      title: 'AnnouncementBar',
      category: 'Domain',
      abbr: 'AB',
      description: 'Dismissible top-of-page banner for promotions and announcements. Supports an optional icon, rich message content, a CTA link, and a dismiss button. Renders null once dismissed.',
      filePath: 'modules/domains/landing/nav/AnnouncementBar.tsx',
      sourceCode: `'use client';
import { AnnouncementBar } from '@/modules/domains/landing/nav/AnnouncementBar';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';

<AnnouncementBar
  icon={faBullhorn}
  message={<><span className="font-semibold">Velox 2.0 is here</span> — faster builds, smarter branch previews.</>}
  cta={{ label: 'Read the announcement', href: '#' }}
/>

// Non-dismissible promotional bar
<AnnouncementBar
  message="Black Friday — 40% off all plans this week only."
  cta={{ label: 'Claim offer', href: '#' }}
  dismissible={false}
/>`,
      variants: [
        { title: 'Default (dismissible)', layout: 'stack', preview: <AnnouncementBarDefaultDemo />, code: `<AnnouncementBar icon={faBullhorn} message={<><span className="font-semibold">Velox 2.0 is here</span> — faster builds, smarter previews.</>} cta={{ label: 'Read the announcement', href: '#' }} />` },
        { title: 'Non-dismissible promo', layout: 'stack', preview: <AnnouncementBarNoDismissDemo />, code: `<AnnouncementBar message="Black Friday — 40% off all plans." cta={{ label: 'Claim offer', href: '#' }} dismissible={false} />` },
      ],
    },
    {
      id: 'landing-mega-menu',
      title: 'MegaMenu',
      category: 'Domain',
      abbr: 'MM',
      description: 'Compound component for hover-activated mega menus. Composed of MegaMenu.Root, Trigger, Panel, Section, Item, Footer, and FeaturedCard sub-components. Use useMegaMenu() to share open/close state across multiple menus. Includes an invisible hover bridge that prevents the gap between the trigger and panel from closing the menu.',
      filePath: 'modules/domains/landing/nav/MegaMenu.tsx',
      sourceCode: `'use client';
import { MegaMenu, useMegaMenu } from '@/modules/domains/landing/nav/MegaMenu';

function Nav() {
  const { openId, open, scheduleClose, close } = useMegaMenu();
  return (
    <MegaMenu.Root id="product" openId={openId} onOpen={open} onScheduleClose={scheduleClose}>
      <MegaMenu.Trigger label="Product" isOpen={openId === 'product'} />
      {openId === 'product' && (
        <MegaMenu.Panel id="product" onOpen={open} onScheduleClose={scheduleClose} width="w-[560px]">
          <div className="grid grid-cols-[1fr_176px]">
            <MegaMenu.Section label="Platform">
              {items.map((item) => (
                <MegaMenu.Item key={item.label} {...item} iconVariant="primary" onClick={close} />
              ))}
              <MegaMenu.Footer label="See all features" href="/features" onClick={close} />
            </MegaMenu.Section>
            <MegaMenu.FeaturedCard
              eyebrow="What's new"
              title="Velox 2.0"
              description="Faster builds, smarter previews."
              primaryCta={{ label: 'Start free', href: '/pricing', onClick: close }}
            />
          </div>
        </MegaMenu.Panel>
      )}
    </MegaMenu.Root>
  );
}`,
      variants: [
        { title: 'Product menu (with FeaturedCard)', layout: 'stack', preview: <MegaMenuProductDemo />, code: `<MegaMenu.Root id="product" openId={openId} onOpen={open} onScheduleClose={scheduleClose}>\n  <MegaMenu.Trigger label="Product" isOpen={openId === 'product'} />\n  {openId === 'product' && (\n    <MegaMenu.Panel id="product" onOpen={open} onScheduleClose={scheduleClose} width="w-[560px]">\n      ...\n    </MegaMenu.Panel>\n  )}\n</MegaMenu.Root>` },
        { title: 'Resources menu (2-column grid)', layout: 'stack', preview: <MegaMenuResourcesDemo />, code: `<MegaMenu.Section label="Resources">\n  <div className="grid grid-cols-2 gap-0.5">\n    {items.map((item) => <MegaMenu.Item key={item.label} {...item} iconVariant="neutral" />)}\n  </div>\n</MegaMenu.Section>` },
      ],
    },
    {
      id: 'landing-opening-hours',
      title: 'OpeningHours',
      category: 'Domain',
      abbr: 'OH',
      description: "A business's weekly opening hours: split days, spans past midnight, today marked and an \"open now\" line in the business's own time zone.",
      filePath: 'modules/domains/landing/hours/OpeningHours.tsx',
      sourceCode: `import { OpeningHours } from '@/modules/domains/landing/hours/OpeningHours';
<OpeningHours hours={hours} timeZone="Europe/Istanbul" />`,
      variants: [
        {
          title: 'Card with "open now"',
          preview: <div className="max-w-md"><OpeningHours hours={HOURS_SHOP} timeZone="Europe/Istanbul" note="Closed on public holidays." /></div>,
          code: `<OpeningHours hours={hours} timeZone="Europe/Istanbul" note="Closed on public holidays." />`,
        },
        {
          title: 'Plain, split day and late nights',
          preview: <div className="max-w-md"><OpeningHours variant="plain" title="Kitchen hours" hours={HOURS_RESTAURANT} timeZone="Europe/Istanbul" /></div>,
          code: `<OpeningHours variant="plain" title="Kitchen hours" hours={[{ day: 'tu', open: '12:00', close: '15:00' }, { day: 'tu', open: '18:00', close: '23:00' }]} />`,
        },
        {
          title: 'Turkish labels, no status',
          preview: (
            <div className="max-w-md">
              <OpeningHours
                title="Çalışma saatleri" hours={HOURS_SHOP} showStatus={false}
                labels={{ closed: 'Kapalı', mo: 'Pazartesi', tu: 'Salı', we: 'Çarşamba', th: 'Perşembe', fr: 'Cuma', sa: 'Cumartesi', su: 'Pazar' }}
              />
            </div>
          ),
          code: `<OpeningHours title="Çalışma saatleri" showStatus={false} labels={{ closed: 'Kapalı', mo: 'Pazartesi' /* … */ }} hours={hours} />`,
        },
      ],
    },
    {
      id: 'landing-listing-cards',
      title: 'ListingCards',
      category: 'Domain',
      abbr: 'LC',
      description: 'Website listing cards for a property, a vehicle or a room: picture, status, a free-text price and period, location and key facts. A sold or booked listing stays, dimmed.',
      filePath: 'modules/domains/landing/listing/ListingCards.tsx',
      sourceCode: `import { ListingCards } from '@/modules/domains/landing/listing/ListingCards';
<ListingCards title="Current listings" listings={listings} footnote="Authorisation certificate no. 3500123" />`,
      variants: [
        {
          title: 'Estate agent, with the authorisation footnote',
          preview: <ListingCards title="Current listings" listings={LISTINGS_ESTATE} footnote="Ege Emlak · Real estate authorisation certificate no. 3500123 · Prices exclude VAT." />,
          code: `<ListingCards title="Current listings" listings={[{ title: '3+1 flat with a sea view', price: '₺8,450,000', status: 'For sale', facts: [{ icon: faBed, text: '3 bedrooms' }] }]} footnote="…" />`,
        },
        {
          title: 'Hotel rooms, wide pictures, two columns',
          preview: <ListingCards title="Rooms" listings={LISTINGS_ROOMS} columns={2} imageShape="wide" linkLabel="Ask for dates" />,
          code: `<ListingCards title="Rooms" columns={2} imageShape="wide" linkLabel="Ask for dates" listings={[{ title: 'Double room', price: '€89', period: '/ night' }]} />`,
        },
        {
          title: 'Cars for sale, with marks on the picture',
          preview: <ListingCards listings={LISTINGS_CARS.map((l, i) => (i === 0 ? { ...l, marks: ['360° view'] } : l))} columns={2} imageShape="wide" />,
          code: `<ListingCards columns={2} imageShape="wide" listings={[{ title: 'Hatchback 1.5, 2021', marks: ['360° view'], status: 'For sale' }]} />`,
        },
      ],
    },
    {
      id: 'landing-timetable',
      title: 'Timetable',
      category: 'Domain',
      abbr: 'TT',
      description: 'A weekly class or lesson timetable: a column per day, time, class, who and where, with chips that filter by class.',
      filePath: 'modules/domains/landing/schedule/Timetable.tsx',
      sourceCode: `import { Timetable } from '@/modules/domains/landing/schedule/Timetable';
<Timetable title="This week" sessions={[{ day: 0, start: '07:00', end: '08:00', name: 'Spin', who: 'Ayşe' }]} />`,
      variants: [
        {
          title: 'Gym week with a class filter',
          preview: <Timetable title="This week" sessions={TIMETABLE_GYM} note="Book your place at the front desk or in the app." />,
          code: `<Timetable title="This week" sessions={sessions} note="Book your place at the front desk." />`,
        },
        {
          title: 'Turkish, empty days left out',
          preview: <Timetable sessions={TIMETABLE_GYM} hideEmptyDays days={['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']} labels={{ all: 'Tümü', none: 'Ders yok', filter: 'Dersleri göster' }} />,
          code: `<Timetable sessions={sessions} hideEmptyDays days={['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']} labels={{ all: 'Tümü', none: 'Ders yok' }} />`,
        },
      ],
    },
    {
      id: 'landing-image-marks',
      title: 'ImageMarks',
      category: 'Domain',
      abbr: 'IM',
      description: 'Large marks set into a picture (2D, 3D, Map, Live), so a card says what kind of screen it shows. Dark glass, white text, real text for screen readers.',
      filePath: 'modules/domains/landing/media/ImageMarks.tsx',
      sourceCode: `import { ImageMarks } from '@/modules/domains/landing/media/ImageMarks';
<div className="relative"><img src="…" alt="" /><ImageMarks marks={['2D', '3D']} /></div>`,
      variants: [
        {
          title: 'On a screenshot, large and medium',
          preview: (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl"><img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80" alt="" className="aspect-[16/10] w-full object-cover" /><ImageMarks marks={['2D', '3D']} /></div>
              <div className="relative overflow-hidden rounded-xl"><img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80" alt="" className="aspect-[16/10] w-full object-cover" /><ImageMarks marks={['Map', 'Live']} size="md" position="top-left" /></div>
            </div>
          ),
          code: `<ImageMarks marks={['2D', '3D']} />\n<ImageMarks marks={['Map', 'Live']} size="md" position="top-left" />`,
        },
      ],
    },
  ];
}
