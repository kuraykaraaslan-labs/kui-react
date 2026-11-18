'use client';
import { cn } from '@/libs/utils/cn';
import type { CardBrand } from './cardBrand';

const BRAND_STYLE: Record<CardBrand, { label: string; gradient: string }> = {
  VISA: {
    label: 'VISA',
    gradient: 'from-[#1A1F71] to-[#0A0F3D]',
  },
  MASTERCARD: {
    label: 'Mastercard',
    gradient: 'from-[#EB001B] via-[#F79E1B] to-[#FF5F00]',
  },
  AMEX: {
    label: 'AMEX',
    gradient: 'from-[#2E77BC] to-[#006FCF]',
  },
  DISCOVER: {
    label: 'Discover',
    gradient: 'from-[#F58220] to-[#111827]',
  },
  TROY: {
    label: 'TROY',
    gradient: 'from-[#00AEEF] via-[#003B71] to-[#111827]',
  },
  MIR: {
    label: 'MIR',
    gradient: 'from-[#00A551] via-[#0072BC] to-[#111827]',
  },
  UNIONPAY: {
    label: 'UnionPay',
    gradient: 'from-[#E21836] via-[#00447C] to-[#007A3D]',
  },
  JCB: {
    label: 'JCB',
    gradient: 'from-[#0B5CAD] via-[#D71920] to-[#009A44]',
  },
  UNKNOWN: {
    label: '',
    gradient: 'from-[#4B5563] to-[#111827]',
  },
};

/**
 * The number as it is typed, padded with dots to 16 (AMEX 15) and grouped by four (AMEX 4-6-5). A 17–19 digit card
 * (Maestro, UnionPay, some TROY) shows every digit instead of losing the last ones.
 */
export function maskCardNumber(raw: string, brand: CardBrand): string {
  const digits = raw.replace(/\D/g, '');
  if (brand === 'AMEX') {
    const d = digits.padEnd(15, '•');
    return `${d.slice(0, 4)} ${d.slice(4, 10)} ${d.slice(10, 15)}`;
  }
  return (digits.padEnd(16, '•').match(/.{1,4}/g) ?? []).join(' ');
}

export type CreditCardVisualMessages = {
  cardHolder: string;
  expires: string;
  cvv: string;
};

export const CREDIT_CARD_VISUAL_MESSAGES: CreditCardVisualMessages = {
  cardHolder: 'Card Holder',
  expires: 'Expires',
  cvv: 'CVV',
};

type CreditCardVisualProps = {
  cardNumber?: string;
  cardholderName?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  brand?: CardBrand;
  flipped?: boolean;
  /** The three labels on the card (translations). */
  messages?: Partial<CreditCardVisualMessages>;
  className?: string;
};

export function CreditCardVisual({
  cardNumber = '',
  cardholderName = '',
  expiryMonth = 'MM',
  expiryYear = 'YY',
  cvv = '',
  brand = 'UNKNOWN',
  flipped = false,
  messages,
  className,
}: CreditCardVisualProps) {
  const m = { ...CREDIT_CARD_VISUAL_MESSAGES, ...messages };
  const { label, gradient } = BRAND_STYLE[brand] ?? BRAND_STYLE.UNKNOWN;
  const long = cardNumber.replace(/\D/g, '').length > 16;

  return (
    <div
      className={cn('w-72 h-44 select-none', className)}
      style={{ perspective: '1000px' }}
      aria-hidden="true"
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front */}
        <div
          className={cn('absolute inset-0 rounded-2xl bg-gradient-to-br p-5 flex flex-col justify-between shadow-xl text-white', gradient)}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex justify-between items-start">
            <div className="flex gap-1">
              {/* The chip, on the warning token (no raw palette colours). */}
              <div className="w-8 h-6 rounded bg-warning/80" />
              <div className="w-8 h-6 rounded bg-warning/50 -ml-3" />
            </div>
            {label && <span className="text-sm font-bold tracking-widest opacity-90">{label}</span>}
          </div>
          {/* A 17–19 digit number is set smaller so it stays on the card. */}
          <p className={cn('font-mono tracking-widest', long ? 'text-sm' : 'text-lg')}>{maskCardNumber(cardNumber, brand)}</p>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[9px] uppercase opacity-60 mb-0.5">{m.cardHolder}</p>
              <p className="text-xs font-medium tracking-wide uppercase truncate max-w-[10rem]">
                {cardholderName || '••••• •••••'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase opacity-60 mb-0.5">{m.expires}</p>
              <p className="text-xs font-medium font-mono">{expiryMonth}/{expiryYear}</p>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className={cn('absolute inset-0 rounded-2xl bg-gradient-to-br shadow-xl overflow-hidden text-white', gradient)}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="mt-7 h-10 bg-black/60 w-full" />
          <div className="px-5 mt-4 flex items-center justify-end gap-3">
            <div className="flex-1 h-6 bg-white/20 rounded" />
            <div className="bg-surface-raised rounded px-3 py-1 text-right min-w-[3.5rem]">
              <p className="text-[9px] text-text-secondary mb-0.5">{m.cvv}</p>
              <p className="font-mono text-sm text-text-primary tracking-widest">
                {cvv ? '•'.repeat(cvv.length) : '•••'}
              </p>
            </div>
          </div>
          {label && (
            <p className="absolute bottom-4 right-5 text-sm font-bold tracking-widest opacity-80">{label}</p>
          )}
        </div>
      </div>
    </div>
  );
}
