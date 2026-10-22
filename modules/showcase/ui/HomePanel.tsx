'use client';
import Image from 'next/image';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket, faTerminal, faLayerGroup, faDiagramProject, faPalette,
} from '@fortawesome/free-solid-svg-icons';
import { faNodeJs, faCss3Alt, faJs } from '@fortawesome/free-brands-svg-icons';
import { BrandMark } from './BrandMark';
import { GithubButton } from './GithubButton';
import { FamilyPanel } from './FamilyPanel';
import { SHOWCASE_BRAND, SHOWCASE_LINKS } from '@/libs/config/showcase.config';

const stack = [
  { icon: faNodeJs,  brand: true,  label: 'Next.js',    value: '16.3.6' },
  { icon: faJs,      brand: true,  label: 'React',       value: '19' },
  { icon: faJs,      brand: true,  label: 'TypeScript',  value: '6' },
  { icon: faCss3Alt, brand: true,  label: 'Tailwind CSS',value: '4' },
];

const layers = [
  { num: '1', path: 'modules/ui/',       desc: 'Primitive components — atoms & molecules',    color: 'bg-info-subtle text-info-fg' },
  { num: '2', path: 'modules/app/',      desc: 'Application-level patterns — organisms',       color: 'bg-primary-subtle text-primary' },
  { num: '3', path: 'modules/domain/',   desc: 'Industry-specific domain components',          color: 'bg-success-subtle text-success-fg' },
  { num: '4', path: 'modules/showcase/', desc: 'Documentation & live preview system',          color: 'bg-warning-subtle text-warning-fg' },
  { num: '5', path: 'app/theme/',        desc: 'Full-page multi-product demos',                color: 'bg-error-subtle text-error-fg' },
];

const themes: { label: string; href: string; desc: string; screenshot: string }[] = [
  { label: 'AI Playground',   href: '/theme/ai',          desc: 'Chat & content generation interface',       screenshot: '/assets/img/screenshot-ai.png' },
  { label: 'API Docs',        href: '/theme/api-doc',     desc: 'Developer API documentation portal',        screenshot: '/assets/img/screenshot-api-doc.png' },
  { label: 'Blog',            href: '/theme/blog',        desc: 'Editorial content publishing',              screenshot: '/assets/img/screenshot-blog.png' },
  { label: 'E-commerce',      href: '/theme/commerce',    desc: 'Product catalog & checkout',                screenshot: '/assets/img/screenshot-commerce.png' },
  { label: 'Common Pages',    href: '/theme/common',      desc: 'Auth, account & shared UI patterns',        screenshot: '/assets/img/screenshot-common.png' },
  { label: 'Event Platform',  href: '/theme/event',       desc: 'Events, tickets & venue management',        screenshot: '/assets/img/screenshot-event.png' },
  { label: 'Fintech',         href: '/theme/fintech',     desc: 'Financial dashboard & transactions',        screenshot: '/assets/img/screenshot-fintech.png' },
  { label: 'Food Delivery',   href: '/theme/food',        desc: 'Restaurant ordering & delivery',            screenshot: '/assets/img/screenshot-food.png' },
  { label: 'Forum',           href: '/theme/forum',       desc: 'Community discussion & Q&A',                screenshot: '/assets/img/screenshot-forum.png' },
  { label: 'Jobs Board',      href: '/theme/jobs',        desc: 'Job listings & career portal',              screenshot: '/assets/img/screenshot-jobs.png' },
  { label: 'SaaS Landing',    href: '/theme/landing',     desc: 'Marketing site with pricing & hero',        screenshot: '/assets/img/screenshot-landing.png' },
  { label: 'Media Platform',  href: '/theme/media',       desc: 'Video & media streaming',                   screenshot: '/assets/img/screenshot-media.png' },
  { label: 'Real Estate',     href: '/theme/real-estate', desc: 'Property listings & search',                screenshot: '/assets/img/screenshot-real-estate.png' },
  { label: 'Travel',          href: '/theme/travel',      desc: 'Flight & hotel booking',                    screenshot: '/assets/img/screenshot-travel.png' },
  { label: 'Social',          href: '/theme/social',      desc: 'Social network with feed, chat & marketplace', screenshot: '/assets/img/screenshot-social.png' },
  { label: 'IoT Platform',    href: '/theme/iot',         desc: 'Device fleet, telemetry & rule engine',     screenshot: '/assets/img/screenshot-iot.png' },
  { label: 'NFT Marketplace', href: '/theme/nft',         desc: 'Collections, auctions & wallet connect',    screenshot: '/assets/img/screenshot-nft.png' },
  { label: 'Personalise',     href: '/theme/promozone',   desc: 'B2B promo catalog & quote requests',        screenshot: '/assets/img/screenshot-promozone.png' },
  { label: 'SCADA Console',   href: '/theme/scada',       desc: 'Home network diagram, devices & editor',    screenshot: '/assets/img/screenshot-scada.png' },
];

export function HomePanel() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-2">

      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <BrandMark className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary leading-tight">{SHOWCASE_BRAND.name}</h1>
            <p className="text-sm text-text-secondary">{SHOWCASE_BRAND.tagline}</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
          A production-ready component library built with Next.js and React. A layered design system and
          component architecture for real-world applications across multiple industry verticals.
        </p>
      </div>

      {/* Quick start + scripts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        <div className="rounded-xl border border-border bg-surface-raised p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faRocket} className="text-primary w-4" aria-hidden="true" />
            Quick Start
          </h2>
          <div className="space-y-2 text-xs font-mono">
            {['npm install', 'npm run dev'].map((cmd) => (
              <div key={cmd} className="flex items-center gap-2 bg-surface-sunken rounded-lg px-3 py-2">
                <span className="text-text-disabled select-none">$</span>
                <span className="text-text-primary">{cmd}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-3">
            Server starts at{' '}
            <span className="font-mono text-primary">http://localhost:3000</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faTerminal} className="text-primary w-4" aria-hidden="true" />
            Scripts
          </h2>
          <ul className="space-y-1.5 text-xs">
            {[
              { cmd: 'npm run dev',   desc: 'development server' },
              { cmd: 'npm run build', desc: 'production build' },
              { cmd: 'npm start',     desc: 'production server' },
              { cmd: 'npm run lint',  desc: 'lint checks' },
            ].map(({ cmd, desc }) => (
              <li key={cmd} className="flex items-start gap-2">
                <code className="font-mono bg-surface-sunken text-text-primary rounded px-1.5 py-0.5 shrink-0">
                  {cmd}
                </code>
                <span className="text-text-secondary pt-0.5">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tech stack */}
      <div className="rounded-xl border border-border bg-surface-raised p-5 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faLayerGroup} className="text-primary w-4" aria-hidden="true" />
          Tech Stack
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stack.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-lg bg-surface-overlay px-3 py-2.5">
              <FontAwesomeIcon icon={s.icon} className="text-primary w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{s.label}</p>
                <p className="text-[10px] text-text-secondary">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Layer architecture */}
      <div className="rounded-xl border border-border bg-surface-raised p-5 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faDiagramProject} className="text-primary w-4" aria-hidden="true" />
          Module Layers
        </h2>
        <div className="space-y-2">
          {layers.map((l) => (
            <div key={l.num} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-surface-overlay">
              <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0', l.color)}>
                {l.num}
              </span>
              <code className="text-xs font-mono text-text-primary shrink-0">{l.path}</code>
              <span className="text-xs text-text-secondary truncate">{l.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-secondary mt-3">
          Each layer builds on the one above it. Keep business logic in domain/app layers; ui components stay generic.
        </p>
      </div>

      {/* KUI family */}
      <FamilyPanel current="react" />

      {/* Themes */}
      <div className="rounded-xl border border-border bg-surface-raised p-5 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faPalette} className="text-primary w-4" aria-hidden="true" />
          Live Themes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className={cn(
                'group flex flex-col rounded-lg border border-border bg-surface-base overflow-hidden transition-colors',
                'hover:border-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
              )}
            >
              <div className="relative w-full aspect-video overflow-hidden bg-surface-sunken">
                <Image
                  src={t.screenshot}
                  alt={t.label}
                  fill
                  className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
              <div className="flex flex-col gap-1 px-4 py-3">
                <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{t.label}</span>
                <span className="text-xs text-text-secondary">{t.desc}</span>
                <span className="text-[10px] font-mono text-text-disabled mt-0.5">{t.href}</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary">
          Built by{' '}
          <a
            href={SHOWCASE_LINKS.author.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
          >
            {SHOWCASE_LINKS.author.name}
          </a>
          {' '}&middot; Licensed under 0BSD
        </p>
        <GithubButton />
      </div>

    </div>
  );
}
