'use client';
import { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalculator } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type QuoteInput = { label: string; unit?: string; min: number; max: number; step?: number; value?: number; /** Price per unit. */ rate: number };
export type QuoteExtra = { label: string; price: number };

type QuoteCalculatorProps = {
  title?: string;
  subtitle?: string;
  inputs: QuoteInput[];
  extras?: QuoteExtra[];
  baseFee?: number;
  /** Prefix of every amount ("€", "$"); none by default. */
  currency?: string;
  /** Round the estimate to this step. Default 1. */
  roundTo?: number;
  /** BCP 47 locale for the numbers. Default: the browser's. */
  locale?: string;
  /** The quote form; `estimate=<n>` is added to it. */
  ctaHref?: string;
  note?: string;
  /** Visible words, for another language; English by default. */
  labels?: Partial<{ estimate: string; base: string; extras: string; cta: string }>;
  className?: string;
};

/** baseFee + Σ value × rate + the chosen extras, rounded to `roundTo`, never below 0. */
export function quoteEstimate(baseFee: number, inputs: QuoteInput[], values: number[], extras: QuoteExtra[], chosen: boolean[], roundTo = 1): number {
  const sum = Math.max(0, baseFee)
    + inputs.reduce((a, inp, i) => a + (values[i] ?? inp.value ?? inp.min) * Math.max(0, inp.rate), 0)
    + extras.reduce((a, x, i) => a + (chosen[i] ? Math.max(0, x.price) : 0), 0);
  const r = roundTo > 0 ? roundTo : 1;
  return Math.max(0, Math.round(sum / r) * r);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A quote calculator: a mover's m² and floors, a cleaner's m², a printer's copies. Sliders and extras add up to an
 * estimate with the sum written out, and a button takes the visitor to the quote form with the estimate in the
 * address. It always says "estimate". Mirrors next-boilerplate's dynamic_page Quote calculator block.
 */
export function QuoteCalculator({
  title, subtitle, inputs, extras = [], baseFee = 0, currency = '', roundTo = 1, locale, ctaHref, note, labels, className,
}: QuoteCalculatorProps) {
  const uid = useId();
  const [values, setValues] = useState<number[]>(() => inputs.map((i) => clamp(i.value ?? i.min, i.min, Math.max(i.min, i.max))));
  const [chosen, setChosen] = useState<boolean[]>(() => extras.map(() => false));
  if (inputs.length === 0) return null;
  const fmt = (n: number) => { try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); } };
  const money = (n: number) => `${currency}${fmt(n)}`;
  const total = quoteEstimate(baseFee, inputs, values, extras, chosen, roundTo);
  const parts = [
    ...(baseFee > 0 ? [`${labels?.base ?? 'Base'} ${money(baseFee)}`] : []),
    ...inputs.map((inp, i) => (inp.rate > 0 && values[i] > 0 ? `${fmt(values[i])}${inp.unit ? ` ${inp.unit}` : ''} × ${money(inp.rate)}` : '')).filter(Boolean),
    ...extras.filter((_, i) => chosen[i]).map((x) => `${x.label} ${money(x.price)}`),
  ];
  const link = ctaHref ? `${ctaHref}${ctaHref.includes('?') ? '&' : '?'}estimate=${total}` : '';

  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      <div className="mx-auto grid max-w-5xl items-start gap-8 @3xl:grid-cols-[1.3fr_1fr]">
        <div>
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
            <FontAwesomeIcon icon={faCalculator} className="h-5 w-5" aria-hidden="true" />
          </span>
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
          <div className="mt-6 flex flex-col gap-5">
            {inputs.map((inp, i) => {
              const id = `${uid}-${i}`;
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-4">
                    <label htmlFor={id} className="text-sm font-medium">{inp.label}</label>
                    <output htmlFor={id} className="text-sm font-semibold tabular-nums text-primary">{fmt(values[i])}{inp.unit ? ` ${inp.unit}` : ''}</output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={inp.min}
                    max={Math.max(inp.min, inp.max)}
                    step={inp.step && inp.step > 0 ? inp.step : 1}
                    value={values[i]}
                    onChange={(e) => { const v = Number(e.target.value); setValues((prev) => prev.map((x, k) => (k === i ? v : x))); }}
                    className="mt-2 w-full accent-primary"
                  />
                </div>
              );
            })}
            {extras.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{labels?.extras ?? 'Extras'}</legend>
                <div className="flex flex-col gap-2">
                  {extras.map((x, i) => (
                    <label key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={chosen[i]} onChange={(e) => setChosen((prev) => prev.map((c, k) => (k === i ? e.target.checked : c)))} className="h-4 w-4 accent-primary" />
                        {x.label}
                      </span>
                      <span className="tabular-nums text-text-secondary">+{money(x.price)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-6 shadow-sm @3xl:sticky @3xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{labels?.estimate ?? 'Estimate'}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums" aria-live="polite">{money(total)}</p>
          {parts.length > 0 && <p className="mt-3 text-xs leading-relaxed text-text-secondary">{parts.join(' + ')}</p>}
          {link && (
            <a
              href={link}
              className="mt-5 flex justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {labels?.cta ?? 'Get an exact quote'}
            </a>
          )}
          {note && <p className="mt-4 text-xs text-text-secondary">{note}</p>}
        </div>
      </div>
    </section>
  );
}
