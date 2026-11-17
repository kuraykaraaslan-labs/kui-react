'use client';
import { cn } from '@/libs/utils/cn';
import type { CardBrand } from './cardBrand';

/** The scheme colours of the brand chip (brand identity, not theme tokens: a VISA chip is VISA blue in every theme). */
const BRAND_COLOR: Record<CardBrand, string> = {
  VISA:       'bg-blue-600',
  MASTERCARD: 'bg-orange-500',
  AMEX:       'bg-teal-600',
  DISCOVER:   'bg-orange-400',
  JCB:        'bg-blue-600',
  TROY:       'bg-cyan-600',
  MIR:        'bg-green-600',
  UNIONPAY:   'bg-red-600',
  UNKNOWN:    'bg-gray-500',
};

const BRAND_LABEL: Record<CardBrand, string> = {
  VISA: 'VISA', MASTERCARD: 'MC', AMEX: 'AMEX', DISCOVER: 'DISC', JCB: 'JCB', TROY: 'TROY', MIR: 'MIR', UNIONPAY: 'UNIONPAY', UNKNOWN: '••',
};

/** The full scheme name, for the chip's accessible name (the chip itself shows the short mark). */
const BRAND_NAME: Record<CardBrand, string> = {
  VISA: 'Visa', MASTERCARD: 'Mastercard', AMEX: 'American Express', DISCOVER: 'Discover', JCB: 'JCB', TROY: 'TROY', MIR: 'Mir',
  UNIONPAY: 'UnionPay', UNKNOWN: 'Card',
};

/** The scheme's full name ("Visa", "American Express"); "Card" for an unknown brand. */
export function cardBrandName(brand: CardBrand | null | undefined): string {
  return (brand && BRAND_NAME[brand]) || BRAND_NAME.UNKNOWN;
}

export type CardBrandBadgeProps = {
  brand: CardBrand;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

/**
 * CardBrandBadge — the small scheme chip of a saved card (VISA, MC, AMEX, TROY …), shared by `SavedCardSelector` and
 * `PaymentMethodList`. An unknown or missing brand falls back to the grey `••` chip.
 */
export function CardBrandBadge({ brand, className, ...rest }: CardBrandBadgeProps) {
  const known: CardBrand = BRAND_LABEL[brand] ? brand : 'UNKNOWN';
  return (
    <span
      role="img"
      aria-label={BRAND_NAME[known]}
      className={cn(
        'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide shrink-0',
        BRAND_COLOR[known],
        className,
      )}
      {...rest}
    >
      {BRAND_LABEL[known]}
    </span>
  );
}
