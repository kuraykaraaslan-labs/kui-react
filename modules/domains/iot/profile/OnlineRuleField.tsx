'use client';
import { useId } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Input } from '@/modules/ui/Input';
import { useIotText } from '../api/IotAdapterProvider';
import { IOT_MESSAGES, type IotMessages, type IotMessagesInput } from '../messages';
import { fill, formatNumber } from '../format';
import {
  ONLINE_RULES, PROFILE_RANGES, onlineRuleBlock, onlineWindowSeconds, type OnlineRule, type ProfileTransport,
} from '../types/profile';

/**
 * OnlineRuleField — the "Online status" group of a device profile (OD-57; phase 01 §1.4, NB iot_device_profile 03 §3.2): "Live
 * connection", "Recent message" (expected interval × factor) and "Last seen only". OD-63: the group is required and starts EMPTY on a
 * blank profile; nothing is ever preselected from the transport. A rule the transport cannot serve is disabled with the reason, and
 * when the CHOSEN rule becomes impossible (the transport changed) the group keeps it, says why and reports the issue, so the form
 * blocks saving until another rule is picked. The interval and the factor show only for the window rule, with a live "offline after"
 * hint. A template copy tags its stored rule "from template". Draws its own radios: options need a disabled reason each.
 *
 * Laid out for its own width (a container query: one card per line in a drawer, three side by side on a page). Choosing "Recent
 * message" with no interval yet fills the shortest allowed one, and an out-of-range number says the allowed range with its error.
 */
export type OnlineRuleValue = { onlineRule: OnlineRule | null; expectedIntervalS: number | null; onlineWindowFactor: number };

export type OnlineRuleFieldProps = {
  value: OnlineRuleValue;
  transport: ProfileTransport;
  onChange?: (next: OnlineRuleValue) => void;
  /** The rule came from a platform template (OD-63 "from template"). */
  fromTemplate?: boolean;
  disabled?: boolean;
  /** Field errors by name (`onlineRule`, `expectedIntervalS`, `onlineWindowFactor`), already in words. */
  errors?: Partial<Record<'onlineRule' | 'expectedIntervalS' | 'onlineWindowFactor', string>>;
  messages?: IotMessagesInput;
  className?: string;
};

/** "3 h", "45 min", "90 s" for the offline hint: the host's unit texts (`units`) and the locale's decimals ("1,5 h"). */
export function formatSeconds(total: number, units: IotMessages['units'] = IOT_MESSAGES.units, locale?: string): string {
  const n = (v: number) => formatNumber(v, locale, 1);
  if (total % 86_400 === 0) return fill(units.days, { n: n(total / 86_400) });
  if (total >= 3_600) return fill(units.hours, { n: n(total / 3_600) });
  if (total >= 60) return fill(units.minutes, { n: n(total / 60) });
  return fill(units.seconds, { n: n(total) });
}

const numberOrNull = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

export function OnlineRuleField({ value, transport, onChange, fromTemplate, disabled, errors = {}, messages, className }: OnlineRuleFieldProps) {
  const { m, locale } = useIotText(messages);
  const id = useId();
  const chosenBlock = value.onlineRule ? onlineRuleBlock(value.onlineRule, transport) : null;
  const windowS = value.onlineRule === 'UPLINK_WINDOW' ? onlineWindowSeconds(value.expectedIntervalS, value.onlineWindowFactor) : null;
  const errorId = `${id}-error`;
  const error = errors.onlineRule ?? (chosenBlock ? m.issue.online_rule_not_allowed : undefined);
  const set = (patch: Partial<OnlineRuleValue>) => onChange?.({ ...value, ...patch });
  const pick = (rule: OnlineRule) => set(rule === 'UPLINK_WINDOW' && value.expectedIntervalS === null
    ? { onlineRule: rule, expectedIntervalS: PROFILE_RANGES.expectedIntervalS.min }
    : { onlineRule: rule });
  // the input hides its hint while it shows an error: an out-of-range error carries the range itself
  const withRange = (error: string | undefined, range: { min: number; max: number }) => (
    error && error === m.issue.out_of_range ? `${error} ${fill(m.limits.range, range)}` : error
  );
  const socketPossible = !onlineRuleBlock('LIVE_SOCKET', transport);

  return (
    <fieldset
      className={cn('@container space-y-3', className)}
      aria-required="true"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      disabled={disabled}
    >
      <legend className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
        <span>{m.online.legend} <span aria-hidden="true" className="text-error">*</span></span>
        {fromTemplate && value.onlineRule && <Badge variant="info" size="sm">{m.online.fromTemplate}</Badge>}
      </legend>
      {socketPossible && !value.onlineRule && <p className="text-xs text-text-secondary">{m.online.recommended}</p>}

      <div className="grid gap-2 @xl:grid-cols-3">
        {ONLINE_RULES.map((rule) => {
          const block = onlineRuleBlock(rule, transport);
          const checked = value.onlineRule === rule;
          const hintId = `${id}-${rule}-hint`;
          return (
            <label
              key={rule}
              className={cn(
                'flex items-start gap-2 rounded-lg border bg-surface-base p-3 text-sm transition-colors',
                'focus-within:ring-2 focus-within:ring-border-focus',
                checked && !block && 'border-primary bg-primary-subtle',
                checked && block && 'border-error bg-error-subtle',
                !checked && 'border-border',
                block || disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={`${id}-rule`}
                value={rule}
                checked={checked}
                disabled={!!block || disabled}
                onChange={() => pick(rule)}
                aria-describedby={hintId}
                className="mt-0.5 h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className={cn('min-w-0', block && 'opacity-60')}>
                <span className="block font-medium text-text-primary">{m.online[rule]}</span>
                <span id={hintId} className="mt-0.5 block text-xs text-text-secondary">
                  {block ? m.online[block] : m.online[`hint_${rule}`]}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}

      {value.onlineRule === 'UPLINK_WINDOW' && (
        <div className="grid gap-3 @md:grid-cols-2">
          <Input
            id={`${id}-interval`}
            type="number"
            label={m.online.interval}
            required
            min={PROFILE_RANGES.expectedIntervalS.min}
            max={PROFILE_RANGES.expectedIntervalS.max}
            step={1}
            value={value.expectedIntervalS ?? ''}
            error={withRange(errors.expectedIntervalS, PROFILE_RANGES.expectedIntervalS)}
            hint={fill(m.limits.range, PROFILE_RANGES.expectedIntervalS)}
            onChange={(e) => set({ expectedIntervalS: numberOrNull(e.target.value) })}
          />
          <Input
            id={`${id}-factor`}
            type="number"
            label={m.online.factor}
            min={PROFILE_RANGES.onlineWindowFactor.min}
            max={PROFILE_RANGES.onlineWindowFactor.max}
            step={0.1}
            value={Number.isFinite(value.onlineWindowFactor) ? value.onlineWindowFactor : ''}
            error={withRange(errors.onlineWindowFactor, PROFILE_RANGES.onlineWindowFactor)}
            hint={fill(m.limits.range, PROFILE_RANGES.onlineWindowFactor)}
            onChange={(e) => set({ onlineWindowFactor: Number(e.target.value) })}
          />
          {windowS !== null && (
            <p className="text-xs text-text-secondary @md:col-span-2" aria-live="polite">{fill(m.online.offlineAfter, { time: formatSeconds(windowS, m.units, locale) })}</p>
          )}
        </div>
      )}

      <p className="text-xs text-text-secondary">{m.online.inactivityNote}</p>
    </fieldset>
  );
}
