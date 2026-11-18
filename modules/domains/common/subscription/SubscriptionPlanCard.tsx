'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarXmark, faCheck, faHourglassHalf, faRotate, faStar, faUserShield } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';

export type PlanInterval = 'MONTHLY' | 'YEARLY' | 'ONCE';

export type SubscriptionPlan = {
  planId: string;
  name: string;
  description?: string | null;
  /** Minor units in the currency's own digits (1900 = $19.00; 1000 = ¥1,000). */
  price: number;
  currency?: string;
  /** One of `PlanInterval`, or a host's own interval (`QUARTERLY`) with `intervalLabel` naming its unit. */
  interval?: PlanInterval | (string & {});
  features?: string[];
  isPopular?: boolean;
  isActive?: boolean;
};

export type SubscriptionPlanCardMessages = {
  popular: string;
  currentPlan: string;
  /** `{name}`: the plan's name. */
  choose: string;
  selected: string;
  processing: string;
  free: string;
  /** Accessible name of the struck-through list price beside a discount; `{price}`. */
  listPrice: string;
  perMonth: string;
  perYear: string;
  once: string;
  /** The interval switch's group name. */
  intervalLegend: string;
  /** `{date}` and `{amount}`; `renewsOnDate` when no amount is known. */
  renewsOn: string;
  renewsOnDate: string;
  /** A subscription that does not renew (cancelled, or an operator's assignment): `{date}`. */
  endsOn: string;
  /** `{date}` and `{amount}`; `trialEndsDate` when no amount is known. */
  trialEnds: string;
  trialEndsDate: string;
  assignedByOperator: string;
  cancelRenewal: string;
  cancelRenewalTitle: string;
  keepRenewal: string;
  /** The no-refund sentence, shown wherever a cancel is offered: `{date}` is the paid period's end. */
  cancelRenewalMessage: string;
  resumeRenewal: string;
};

export const SUBSCRIPTION_PLAN_CARD_MESSAGES: SubscriptionPlanCardMessages = {
  popular: 'Popular',
  currentPlan: 'Current Plan',
  choose: 'Choose {name}',
  selected: 'Selected',
  processing: 'Processing…',
  free: 'Free',
  listPrice: 'List price {price}',
  perMonth: '/ month',
  perYear: '/ year',
  once: 'one-time',
  intervalLegend: 'Billing interval',
  renewsOn: 'Renews on {date} for {amount}',
  renewsOnDate: 'Renews on {date}',
  endsOn: 'Ends on {date}',
  trialEnds: 'Trial ends on {date}; then {amount}',
  trialEndsDate: 'Trial ends on {date}',
  assignedByOperator: 'Assigned by the operator',
  cancelRenewal: 'Cancel renewal',
  cancelRenewalTitle: 'Cancel automatic renewal',
  keepRenewal: 'Keep renewal',
  cancelRenewalMessage: 'Cancelling stops the next renewal. You keep access until {date}. Payments already made are not refunded.',
  resumeRenewal: 'Resume renewal',
};

/** One choice of the card's interval switch (the same product on another billing term). */
export type PlanIntervalOption = {
  /** The interval, matched against `plan.interval` to mark the active one. */
  value: string;
  label: string;
  /** A short note beside the label, e.g. the saving "-17%". */
  badge?: string;
};

export type PlanRenewal = {
  /** The current period's end: the renewal date, or the day access ends. */
  date: Date | string;
  /** What the renewal charges, minor units in the plan's currency; omitted or null leaves the amount out. */
  amount?: number | null;
  /** True when the subscription does not renew (cancelled at period end, or an operator's assignment): "Ends on". */
  ends?: boolean;
};

export type PlanTrial = {
  endsOn: Date | string;
  /** What is charged when the trial ends, minor units; omitted or null leaves the amount out. */
  thenAmount?: number | null;
};

export type SubscriptionPlanCardProps = {
  plan: SubscriptionPlan;
  isCurrent?: boolean;
  /** The plan picked for the next step: its button reads "Selected" (`aria-pressed`). */
  isSelected?: boolean;
  /** Without it the card has no button: a card with nothing to do shows no dead control. */
  onSelect?: (planId: string) => void;
  /** This card's checkout is starting. */
  loading?: boolean;
  /** Another action is running: the button cannot start a second one. */
  disabled?: boolean;
  /** The button's label in place of "Choose {name}" (the host's "Upgrade to …" / "Switch to …"). */
  actionLabel?: string;
  /** Shown in place of the button (e.g. "Assigned by your workspace plan" on a free plan nobody buys). */
  actionNote?: React.ReactNode;
  /** BCP 47 locale for prices and dates. Default `en-US`. */
  locale?: string;
  /** The unit after the price ("/month", "/ay"); defaults from `plan.interval`. */
  intervalLabel?: string;
  /** Two or more terms of the same product: the card shows a switch between them. */
  intervalOptions?: PlanIntervalOption[];
  onIntervalChange?: (value: string) => void;
  /** A discounted price (minor units): the list price is struck through beside it, `note` under it. */
  discount?: { amount: number; note?: React.ReactNode };
  /** A line under the price (a tax-inclusive view, a monthly equivalent, a saving). */
  priceNote?: React.ReactNode;
  /** The renewal line: "Renews on {date} for {amount}", or "Ends on {date}" when `ends`. */
  renewal?: PlanRenewal;
  /** The trial line: "Trial ends on {date}; then {amount}". */
  trial?: PlanTrial;
  /** The subscription was given by the platform operator, not bought (it ends at its term and is never charged). */
  assignedByOperator?: boolean;
  /**
   * Offers "Cancel renewal" on a renewing plan. The ConfirmDialog states the no-refund rule before it is called; a
   * rejected promise keeps the dialog open with the error.
   */
  onCancelRenewal?: () => void | Promise<void>;
  /** Offers "Resume renewal" on a plan that ends (never on an operator's assignment). */
  onResumeRenewal?: () => void | Promise<void>;
  messages?: Partial<SubscriptionPlanCardMessages>;
  className?: string;
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

/** The currency's minor-unit digits (2 for USD and TRY, 0 for JPY, 3 for KWD). */
function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** A minor-unit amount in the currency's own digits; a whole amount without decimals ("$19", "₺1.499", "¥1,000"). */
function formatMinor(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency);
  const major = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(major) ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency}`;
  }
}

/** A date to show; a bare `YYYY-MM-DD` is that calendar day wherever the reader is (not UTC midnight). */
function formatDay(value: Date | string, locale: string): string {
  const day = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const d = value instanceof Date ? value : day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function unitOf(interval: string, m: SubscriptionPlanCardMessages): string {
  if (interval === 'MONTHLY') return m.perMonth;
  if (interval === 'YEARLY') return m.perYear;
  if (interval === 'ONCE') return m.once;
  return `/ ${interval.toLowerCase()}`;
}

const linkButton =
  'rounded-sm text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * SubscriptionPlanCard — one plan: name, price (locale-aware, "Free" at zero, a struck list price beside a discount),
 * an optional interval switch, a price note, the renewal and trial lines, the "Assigned by the operator" badge, the
 * features and one action. On a renewing plan `onCancelRenewal` adds "Cancel renewal", confirmed in a ConfirmDialog that
 * says the subscriber keeps access to the period end and that payments already made are not refunded.
 */
export function SubscriptionPlanCard({
  plan,
  isCurrent = false,
  isSelected = false,
  onSelect,
  loading = false,
  disabled = false,
  actionLabel,
  actionNote,
  locale = 'en-US',
  intervalLabel,
  intervalOptions,
  onIntervalChange,
  discount,
  priceNote,
  renewal,
  trial,
  assignedByOperator = false,
  onCancelRenewal,
  onResumeRenewal,
  messages,
  className,
}: SubscriptionPlanCardProps) {
  const m = { ...SUBSCRIPTION_PLAN_CARD_MESSAGES, ...messages };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<'cancel' | 'resume' | null>(null);
  const [error, setError] = useState<string | undefined>();

  const interval = plan.interval ?? 'MONTHLY';
  const currency = plan.currency ?? 'USD';
  const money = (minor: number) => formatMinor(minor, currency, locale);
  const isFree = plan.price === 0;
  const shown = discount && !isFree ? discount.amount : plan.price;
  const highlighted = plan.isPopular || isSelected || isCurrent;
  const options = intervalOptions ?? [];

  const renewalDate = renewal ? formatDay(renewal.date, locale) : '';
  const renewalText = !renewal
    ? null
    : renewal.ends
      ? fill(m.endsOn, { date: renewalDate })
      : renewal.amount != null
        ? fill(m.renewsOn, { date: renewalDate, amount: money(renewal.amount) })
        : fill(m.renewsOnDate, { date: renewalDate });
  const trialText = !trial
    ? null
    : trial.thenAmount != null
      ? fill(m.trialEnds, { date: formatDay(trial.endsOn, locale), amount: money(trial.thenAmount) })
      : fill(m.trialEndsDate, { date: formatDay(trial.endsOn, locale) });
  const canCancel = !!onCancelRenewal && !!renewal && !renewal.ends && !assignedByOperator;
  const canResume = !!onResumeRenewal && !!renewal?.ends && !assignedByOperator;

  async function run(kind: 'cancel' | 'resume', fn: () => void | Promise<void>) {
    setBusy(kind);
    setError(undefined);
    try {
      await fn();
      if (kind === 'cancel') setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 transition-shadow',
        highlighted
          ? 'border-primary shadow-md shadow-primary/10'
          : 'border-border shadow-sm hover:shadow-md',
        className,
      )}
    >
      {plan.isPopular && !isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-fg">
          <FontAwesomeIcon icon={faStar} className="w-2.5 h-2.5" aria-hidden="true" />
          {m.popular}
        </span>
      )}

      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-success px-3 py-0.5 text-xs font-semibold text-white">
          <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" aria-hidden="true" />
          {m.currentPlan}
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">{plan.name}</h3>
        {plan.description && (
          <p className="mt-1 text-xs text-text-secondary">{plan.description}</p>
        )}
        {assignedByOperator && (
          <Badge variant="info" size="sm" className="mt-2 gap-1">
            <FontAwesomeIcon icon={faUserShield} className="w-3 h-3" aria-hidden="true" />
            {m.assignedByOperator}
          </Badge>
        )}
      </div>

      {options.length > 1 && (
        <div
          role="group"
          aria-label={m.intervalLegend}
          className="mb-4 inline-flex self-start overflow-hidden rounded-md border border-border divide-x divide-border"
        >
          {options.map((o) => {
            const active = o.value === interval;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => { if (!active) onIntervalChange?.(o.value); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
                  active ? 'bg-surface-overlay font-semibold text-text-primary' : 'bg-surface-base text-text-secondary hover:bg-surface-overlay',
                )}
              >
                {o.label}
                {o.badge && <span className="ml-1.5 text-xs font-semibold text-success-fg">{o.badge}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-wrap items-baseline gap-1">
          {discount && !isFree && (
            <s className="text-base text-text-secondary tabular-nums" aria-label={fill(m.listPrice, { price: money(plan.price) })}>
              {money(plan.price)}
            </s>
          )}
          <span className="text-3xl font-bold text-text-primary tracking-tight tabular-nums">
            {shown === 0 ? m.free : money(shown)}
          </span>
          {!isFree && <span className="text-sm text-text-secondary">{intervalLabel ?? unitOf(interval, m)}</span>}
        </div>
        {discount?.note && !isFree && <p className="text-xs font-medium text-success">{discount.note}</p>}
        {priceNote && <div className="mt-1 text-xs text-text-secondary">{priceNote}</div>}
      </div>

      {(renewalText || trialText) && (
        <div className="mb-6 space-y-1.5 rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary" data-part="renewal">
          {trialText && (
            <p className="flex items-start gap-2">
              <FontAwesomeIcon icon={faHourglassHalf} className="w-3.5 h-3.5 mt-0.5 text-info shrink-0" aria-hidden="true" />
              <span>{trialText}</span>
            </p>
          )}
          {renewalText && (
            <p className="flex items-start gap-2">
              <FontAwesomeIcon
                icon={renewal!.ends ? faCalendarXmark : faRotate}
                className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', renewal!.ends ? 'text-warning' : 'text-success')}
                aria-hidden="true"
              />
              <span>{renewalText}</span>
            </p>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => { setError(undefined); setConfirmOpen(true); }}
              className={cn(linkButton, 'text-error')}
            >
              {m.cancelRenewal}
            </button>
          )}
          {canResume && (
            <>
              <button
                type="button"
                disabled={busy === 'resume'}
                aria-busy={busy === 'resume' || undefined}
                onClick={() => void run('resume', onResumeRenewal!)}
                className={cn(linkButton, 'text-primary')}
              >
                {m.resumeRenewal}
              </button>
              {error && <p role="alert" className="text-xs text-error">{error}</p>}
            </>
          )}
        </div>
      )}

      {plan.features && plan.features.length > 0 && (
        <ul className="mb-6 flex-1 space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-text-primary">
              <FontAwesomeIcon
                icon={faCheck}
                className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {actionNote ? (
        <div className="mt-auto text-center text-xs text-text-secondary">{actionNote}</div>
      ) : onSelect && !isCurrent ? (
        <button
          type="button"
          disabled={loading || disabled}
          aria-pressed={isSelected}
          aria-busy={loading || undefined}
          onClick={() => onSelect(plan.planId)}
          className={cn(
            'mt-auto w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isSelected
              ? 'border border-primary bg-surface-base text-primary hover:bg-primary-subtle'
              : 'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active',
          )}
        >
          {loading ? m.processing : isSelected ? m.selected : (actionLabel ?? fill(m.choose, { name: plan.name }))}
        </button>
      ) : null}

      {canCancel && (
        <ConfirmDialog
          open={confirmOpen}
          tone="warning"
          title={m.cancelRenewalTitle}
          message={fill(m.cancelRenewalMessage, { date: renewalDate })}
          confirmLabel={m.cancelRenewal}
          cancelLabel={m.keepRenewal}
          busy={busy === 'cancel'}
          error={error}
          onConfirm={() => void run('cancel', onCancelRenewal!)}
          onCancel={() => { if (busy !== 'cancel') setConfirmOpen(false); }}
        />
      )}
    </div>
  );
}
