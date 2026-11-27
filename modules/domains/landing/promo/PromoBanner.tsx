'use client';
import { useId, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Countdown } from '@/modules/ui/Countdown';
import type { CountdownDateInput, CountdownLabels } from '@/modules/ui/Countdown';
import { PromoCoupon } from './PromoCoupon';
import type { CtaButton, Promo, PromoTone } from '../types';

export type PromoBannerLayout = 'banner' | 'strip' | 'ribbon';

export type PromoBannerMessages = {
  /** Close button of the strip. */
  dismiss: string;
  copy: string;
  copied: string;
  /** Text before the coupon code. */
  coupon: string;
};

export const DEFAULT_PROMO_BANNER_MESSAGES: Record<'en' | 'tr', PromoBannerMessages> = {
  en: { dismiss: 'Close offer', copy: 'Copy code', copied: 'Copied', coupon: 'Code' },
  tr: { dismiss: 'Kampanyayı kapat', copy: 'Kodu kopyala', copied: 'Kopyalandı', coupon: 'Kod' },
};

/** Token-only tone classes: a subtle surface, its border and the accent used by the eyebrow. Light and dark alike. */
export const PROMO_TONES: Record<PromoTone, { surface: string; accent: string }> = {
  primary: { surface: 'bg-primary-subtle border-primary/30', accent: 'text-primary' },
  success: { surface: 'bg-success-subtle border-success/30', accent: 'text-success-fg' },
  warning: { surface: 'bg-warning-subtle border-warning/40', accent: 'text-warning-fg' },
  info: { surface: 'bg-info-subtle border-info/30', accent: 'text-info-fg' },
  neutral: { surface: 'bg-surface-raised border-border', accent: 'text-text-secondary' },
};

export type PromoBannerProps = {
  promo: Promo;
  /** `banner`: image beside the text (stacks on phones). `strip`: a one-line top bar. `ribbon`: a badge for pricing cards. */
  layout?: PromoBannerLayout;
  /** Overrides `promo.tone` (default `primary`). */
  tone?: PromoTone;
  /** Strip only: shows a close button; the strip hides itself and calls this (store the choice, e.g. per campaign id). */
  onDismiss?: () => void;
  /** Server render time, passed to the Countdown so server and client match. */
  now?: CountdownDateInput;
  showSeconds?: boolean;
  /** Picks the default words (`tr*` Turkish, else English) for the banner and its countdown. */
  locale?: string;
  timeZone?: string;
  messages?: Partial<PromoBannerMessages>;
  countdownLabels?: Partial<CountdownLabels>;
  /** Called when the countdown reaches zero (hide or swap the campaign). */
  onEnd?: () => void;
  onCopyCode?: (code: string) => void;
  /** Heading level of the banner's headline (default 2). */
  headingLevel?: 2 | 3;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>;

function Cta({ cta, size }: { cta: CtaButton; size: 'sm' | 'md' }) {
  return (
    <Button
      as="a"
      href={cta.href}
      target={cta.external ? '_blank' : undefined}
      rel={cta.external ? 'noopener noreferrer' : undefined}
      size={size}
      variant="primary"
      data-part="cta"
    >
      {cta.label}
    </Button>
  );
}

export function PromoBanner({
  promo,
  layout = 'banner',
  tone,
  onDismiss,
  now,
  showSeconds = false,
  locale,
  timeZone,
  messages,
  countdownLabels,
  onEnd,
  onCopyCode,
  headingLevel = 2,
  className,
  ...rest
}: PromoBannerProps) {
  const headingId = useId();
  const [dismissed, setDismissed] = useState(false);
  const t = tone ?? promo.tone ?? 'primary';
  const toneClasses = PROMO_TONES[t];
  const m = { ...DEFAULT_PROMO_BANNER_MESSAGES[locale && /^tr(-|$)/i.test(locale) ? 'tr' : 'en'], ...messages };

  if (layout === 'ribbon') {
    return (
      <Badge variant={t} size="md" className={cn('font-semibold', className)} data-layout="ribbon" data-tone={t} {...rest}>
        {promo.headline}
      </Badge>
    );
  }

  const countdown = (variant: 'compact' | 'boxed', size: 'sm' | 'md') => promo.endsAt ? (
    <Countdown
      endsAt={promo.endsAt}
      now={now}
      showSeconds={showSeconds}
      variant={variant}
      size={size}
      locale={locale}
      timeZone={timeZone}
      labels={countdownLabels}
      onEnd={onEnd}
    />
  ) : null;

  const coupon = (size: 'sm' | 'md') => promo.couponCode ? (
    <PromoCoupon code={promo.couponCode} label={m.coupon} copyLabel={m.copy} copiedLabel={m.copied} size={size} onCopy={onCopyCode} />
  ) : null;

  if (layout === 'strip') {
    if (dismissed) return null;
    return (
      <div
        role="region"
        aria-label={promo.headline}
        className={cn('relative min-h-10 border-b px-4 py-2 text-sm text-text-primary', toneClasses.surface, onDismiss && 'pe-12', className)}
        data-layout="strip"
        data-tone={t}
        {...rest}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {promo.eyebrow && (
            <span className={cn('rounded-full bg-surface-base px-2 py-0.5 text-xs font-semibold', toneClasses.accent)} data-part="eyebrow">
              {promo.eyebrow}
            </span>
          )}
          <p className="font-semibold" data-part="headline">{promo.headline}</p>
          {promo.body && <p className="hidden text-text-secondary md:block" data-part="body">{promo.body}</p>}
          {countdown('compact', 'sm')}
          {coupon('sm')}
          {promo.cta && <Cta cta={promo.cta} size="sm" />}
        </div>
        {onDismiss && (
          <button
            type="button"
            aria-label={m.dismiss}
            onClick={() => { setDismissed(true); onDismiss(); }}
            className="absolute end-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            data-part="dismiss"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <section
      aria-labelledby={headingId}
      className={cn('overflow-hidden rounded-2xl border', toneClasses.surface, className)}
      data-layout="banner"
      data-tone={t}
      {...rest}
    >
      <div className={cn('grid items-center gap-6 p-6 sm:gap-8 sm:p-8', promo.image && 'sm:grid-cols-2')}>
        <div className="flex flex-col items-start gap-3" data-part="content">
          {promo.eyebrow && (
            <p className={cn('text-xs font-semibold uppercase tracking-wide', toneClasses.accent)} data-part="eyebrow">{promo.eyebrow}</p>
          )}
          <Heading id={headingId} className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl" data-part="headline">
            {promo.headline}
          </Heading>
          {promo.body && <p className="text-base text-text-secondary" data-part="body">{promo.body}</p>}
          {countdown('boxed', 'md')}
          {(promo.cta || promo.couponCode) && (
            <div className="flex flex-wrap items-center gap-3 pt-1" data-part="actions">
              {promo.cta && <Cta cta={promo.cta} size="md" />}
              {coupon('md')}
            </div>
          )}
        </div>
        {promo.image && (
          <div className="relative order-first aspect-[16/9] overflow-hidden rounded-xl bg-surface-sunken sm:order-last sm:aspect-[4/3]" data-part="media">
            <picture>
              {promo.image.mobileSrc && <source media="(max-width: 639px)" srcSet={promo.image.mobileSrc} />}
              <img
                src={promo.image.src}
                alt={promo.image.alt ?? ''}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          </div>
        )}
      </div>
    </section>
  );
}
