'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

type GiftVoucherProps = {
  title?: string;
  subtitle?: string;
  businessName: string;
  amounts: number[];
  currency?: string;
  /** The shop page or payment link; `amount=<n>` is added to it. */
  buyHref?: string;
  terms?: string;
  locale?: string;
  labels?: Partial<{ card: string; buy: string; amount: string }>;
  className?: string;
};

/** The buy address with `amount=` added (before any `#`). */
export function voucherHref(href: string, amount: number): string {
  const [path, hash = ''] = href.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}amount=${amount}${hash ? `#${hash}` : ''}`;
}

/**
 * A gift voucher: a card in the brand's colours with the business and the chosen amount, amount buttons (a radio
 * group), a buy link with the amount filled in and the terms under it. It sells nothing itself. Mirrors
 * next-boilerplate's dynamic_page Gift voucher block.
 */
export function GiftVoucher({ title, subtitle, businessName, amounts, currency = '', buyHref, terms, locale, labels, className }: GiftVoucherProps) {
  const list = amounts.filter((a) => a > 0).slice(0, 6);
  const [chosen, setChosen] = useState(0);
  const amount = list[Math.min(chosen, list.length - 1)];
  const fmt = (n: number) => { try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); } };
  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 @3xl:grid-cols-2">
        <div aria-hidden="true" className="relative aspect-[1.6] overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-6 text-primary-fg shadow-xl">
          <FontAwesomeIcon icon={faGift} className="absolute -right-4 -top-4 h-32 w-32 opacity-15" />
          <p className="text-sm font-semibold uppercase tracking-widest opacity-90">{labels?.card ?? 'Gift voucher'}</p>
          <p className="mt-1 text-lg font-bold">{businessName}</p>
          {amount !== undefined && <p className="absolute bottom-6 left-6 text-4xl font-bold tabular-nums">{currency}{fmt(amount)}</p>}
        </div>
        <div>
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
          {list.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label={labels?.amount ?? 'Voucher amount'}>
              {list.map((a, i) => (
                <button key={a} type="button" role="radio" aria-checked={i === chosen} onClick={() => setChosen(i)}
                  className={cn('rounded-lg border px-4 py-2 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    i === chosen ? 'border-primary bg-primary text-primary-fg' : 'border-border hover:border-primary')}>
                  {currency}{fmt(a)}
                </button>
              ))}
            </div>
          )}
          {buyHref && (
            <a href={amount !== undefined ? voucherHref(buyHref, amount) : buyHref}
              className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              {labels?.buy ?? 'Buy a voucher'}
            </a>
          )}
          {terms && <p className="mt-4 text-xs text-text-secondary">{terms}</p>}
        </div>
      </div>
    </section>
  );
}
