'use client';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { fill } from '../format';
import type { EsimAdapter } from './esim-adapter';
import type { EsimMessagesInput } from './messages';
import { esimErrorText, useEsimText } from './EsimText';
import { readActivationCode, type EsimOperation } from './types';

export interface EsimAddProfileFormProps {
  adapter: EsimAdapter;
  deviceId: string;
  /** Called with the started download; the form has already forgotten the codes. */
  onStarted: (op: EsimOperation) => void;
  onCancel: () => void;
  messages?: EsimMessagesInput;
  locale?: string;
}

/**
 * EsimAddProfileForm — "Add profile": the activation code (write-only: masked (the field's own Show), never stored by the view, cleared as soon as
 * the request is sent or the form closes), the confirmation code when the operator gave one, and whether to switch to the new profile
 * at once. The code is read far enough to show the profile server it goes to; Download asks through the ConfirmDialog first.
 */
export function EsimAddProfileForm({ adapter, deviceId, onStarted, onCancel, messages, locale }: EsimAddProfileFormProps) {
  const { m } = useEsimText(messages, locale);
  const id = useId();
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enable, setEnable] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => (code.trim() ? readActivationCode(code) : null), [code]);
  const codeError = code.trim() && !parsed ? m.add.codeInvalid : undefined;
  const needsConfirmation = !!parsed?.confirmationRequired && !confirmation.trim();
  const ready = !!parsed && !needsConfirmation;

  const forget = () => { setCode(''); setConfirmation(''); };

  async function submit() {
    if (!parsed) return;
    setBusy(true); setError(null);
    try {
      const op = await adapter.start(deviceId, {
        kind: 'download', activationCode: code.trim(), ...(confirmation.trim() ? { confirmationCode: confirmation.trim() } : {}),
        ...(enable ? { enable: true } : {}), confirm: true,
      });
      forget();
      setAsking(false);
      onStarted(op);
    } catch (e) {
      setError(esimErrorText(m, e));
      setAsking(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      data-esim-add=""
      autoComplete="off"
      onSubmit={(e) => { e.preventDefault(); if (ready) setAsking(true); }}
    >
      <p className="text-sm text-text-secondary">{m.add.intro}</p>
      <Input
        id={`${id}-code`}
        label={m.add.code}
        hint={parsed ? fill(m.add.goesTo, { host: parsed.host }) : m.add.codeHint}
        error={codeError}
        required
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        maxLength={259}
      />
      <Input
        id={`${id}-confirmation`}
        label={m.add.confirmation}
        hint={m.add.confirmationHint}
        error={needsConfirmation ? m.add.confirmationRequired : undefined}
        type="password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="off"
        maxLength={32}
      />
      <Checkbox id={`${id}-enable`} label={m.add.enable} hint={m.add.enableHint} checked={enable} onChange={(e) => setEnable(e.target.checked)} />
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { forget(); onCancel(); }} disabled={busy}>{m.common.cancel}</Button>
        <Button type="submit" variant="primary" disabled={!ready || busy}>{m.add.submit}</Button>
      </div>
      <ConfirmDialog
        open={asking}
        tone={enable ? 'danger' : 'warning'}
        title={fill(m.confirm.downloadTitle, { host: parsed?.host ?? '' })}
        message={m.confirm.downloadMessage}
        acknowledgement={enable ? m.confirm.downloadEnable : undefined}
        confirmLabel={m.confirm.downloadLabel}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void submit()}
      />
    </form>
  );
}

export interface EsimAddProfileDrawerProps extends EsimAddProfileFormProps {
  open: boolean;
}

/** The add form in its own drawer, for a host that shows the eSIM panel on a page (inside the eSIM drawer the form takes the drawer's place). */
export function EsimAddProfileDrawer({ open, onCancel, ...rest }: EsimAddProfileDrawerProps) {
  const { m } = useEsimText(rest.messages, rest.locale);
  return (
    <Drawer open={open} onClose={onCancel} title={m.add.title} closeLabel={m.common.close} className="w-full sm:max-w-lg">
      {open && <EsimAddProfileForm {...rest} onCancel={onCancel} />}
    </Drawer>
  );
}
