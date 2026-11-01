'use client';
import { useEffect, useState } from 'react';
import { Select } from '@/modules/ui/Select';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Callout } from '@/modules/ui/Callout';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import type { RuleMode } from '../types/rules';
import { manualBanner } from './rule-format';

/**
 * ModeSwitch — Manual / Auto of a place (docs/concepts/iot-rules 04, OD-210). Two buttons and, in Manual, a banner saying since when,
 * by whom and until when. Going to Manual asks first (what stops, an optional end and a reason); going back to Auto asks too, lists the
 * rules whose trigger holds right now and offers "Apply the rules now" (on by default). A place under a Manual asset shows
 * "Manual (set on <name>)" and cannot go to Auto itself. Without `canSwitch` it only shows the mode.
 */
export type ModeSwitchProps = {
  placeName: string;
  mode: RuleMode;
  canSwitch: boolean;
  busy?: boolean;
  /** Epoch ms of the host's clock (the banner and the options are relative to it). */
  now: number;
  onManual: (input: { until: number | null; reason: string | null }) => Promise<void>;
  onAuto: (input: { applyNow: boolean }) => Promise<void>;
  /** The rules whose trigger holds now, in words, for the dialog back to Auto; absent or failing: no list. */
  loadHolding?: () => Promise<string[]>;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

type UntilKey = 'never' | '30' | '60' | '240';

export function ModeSwitch({ placeName, mode, canSwitch, busy = false, now, onManual, onAuto, loadHolding, locale, messages, className }: ModeSwitchProps) {
  const { m } = useIotText(messages);
  const [dialog, setDialog] = useState<'manual' | 'auto' | null>(null);
  const [until, setUntil] = useState<UntilKey>('never');
  const [reason, setReason] = useState('');
  const [applyNow, setApplyNow] = useState(true);
  const [holding, setHolding] = useState<string[] | null>(null);
  const [failed, setFailed] = useState<string | undefined>();
  const [working, setWorking] = useState(false);
  const manual = mode.mode === 'manual';
  const followsAbove = !manual && mode.effective === 'manual';

  // the rules that would run now are read when the dialog to Auto opens; the list is cleared by `open('auto')`, never inside the effect
  useEffect(() => {
    if (dialog !== 'auto' || !loadHolding) return;
    let alive = true;
    loadHolding().then((l) => { if (alive) setHolding(l); }, () => { if (alive) setHolding([]); });
    return () => { alive = false; };
  }, [dialog, loadHolding]);

  const open = (which: 'manual' | 'auto') => {
    if (which === 'auto') setHolding(null);
    setDialog(which);
  };
  const close = () => { setDialog(null); setFailed(undefined); setWorking(false); };
  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    setFailed(undefined);
    try { await fn(); close(); } catch (e) { setFailed(e instanceof Error ? e.message : String(e)); setWorking(false); }
  };

  const untilOptions = [
    { value: 'never', label: m.rules.untilNever }, { value: '30', label: m.rules.until30 }, { value: '60', label: m.rules.until60 }, { value: '240', label: m.rules.until240 },
  ];
  const seg = (active: boolean) => cn(
    'px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50',
    active ? 'bg-primary text-primary-fg' : 'bg-surface-base text-text-primary hover:bg-surface-overlay',
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div role="radiogroup" aria-label={fill(m.rules.modeLabel, { name: placeName })} className="inline-flex self-start overflow-hidden rounded-md border border-border">
        <button type="button" role="radio" aria-checked={!manual} disabled={!canSwitch || busy || followsAbove || !manual} onClick={() => open('auto')} className={seg(!manual)}>{m.rules.modeAuto}</button>
        <button type="button" role="radio" aria-checked={manual} disabled={!canSwitch || busy || manual} onClick={() => open('manual')} className={cn(seg(manual), 'border-l border-border')}>{m.rules.modeManual}</button>
      </div>

      {manual ? <Callout variant="warning" title={null}>{manualBanner(m.rules, mode, now, locale)}{mode.reason ? ` · ${mode.reason}` : ''}</Callout> : null}
      {followsAbove ? (
        <Callout variant="warning" title={null}>
          {fill(m.rules.manualFollows, { name: mode.setOn?.name ?? placeName })}. {fill(m.rules.manualFollowsHint, { name: mode.setOn?.name ?? placeName })}
        </Callout>
      ) : null}

      <ConfirmDialog
        open={dialog === 'manual'}
        title={m.rules.toManual}
        message={fill(m.rules.toManualBody, { name: placeName })}
        tone="warning"
        confirmLabel={m.rules.toManualConfirm}
        cancelLabel={m.rules.cancel}
        busy={working}
        error={failed}
        details={(
          <div className="flex flex-col gap-3">
            <Select id="rules-manual-until" label={m.rules.manualUntilLabel} value={until} options={untilOptions} onChange={(e) => setUntil((e.target as HTMLSelectElement).value as UntilKey)} />
            <label className="flex flex-col gap-1 text-sm text-text-primary">
              {m.rules.reasonLabel}
              <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-border bg-surface-base px-3 py-2 text-sm" />
            </label>
          </div>
        )}
        onCancel={close}
        onConfirm={() => void run(() => onManual({ until: until === 'never' ? null : now + Number(until) * 60_000, reason: reason.trim() || null }))}
      />

      <ConfirmDialog
        open={dialog === 'auto'}
        title={m.rules.toAutoTitle}
        message={fill(m.rules.toAutoBody, { name: placeName })}
        confirmLabel={m.rules.toAutoConfirm}
        cancelLabel={m.rules.cancel}
        busy={working}
        error={failed}
        details={(
          <div className="flex flex-col gap-3">
            <Checkbox id="rules-apply-now" label={m.rules.toAutoApply} checked={applyNow} onChange={(e) => setApplyNow((e.target as HTMLInputElement).checked)} />
            <p className="text-xs text-text-secondary">{m.rules.toAutoApplyHint}</p>
            {applyNow && holding !== null ? (
              holding.length
                ? <div><p className="text-sm font-medium text-text-primary">{m.rules.toAutoHolding}</p><ul className="list-disc pl-5 text-sm text-text-primary">{holding.map((h) => <li key={h}>{h}</li>)}</ul></div>
                : <p className="text-sm text-text-secondary">{m.rules.toAutoNone}</p>
            ) : null}
          </div>
        )}
        onCancel={close}
        onConfirm={() => void run(() => onAuto({ applyNow }))}
      />
    </div>
  );
}
