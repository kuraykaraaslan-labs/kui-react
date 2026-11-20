'use client';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { QrScanner } from '@/modules/ui/QrScanner/QrScanner';
import type { QrFrameDecoder } from '@/modules/ui/QrScanner/camera';
import type { QrScannerMessagesInput } from '@/modules/ui/QrScanner/messages';
import { mergeProvisioningMessages, type ProvisioningMessagesInput } from './messages';
import type { ClaimAnswer, ClaimCode, ClaimDone, ClaimPreview, ClaimProblem } from './types';

export type ClaimDeviceWizardProps = {
  /** The claim code in a scanned or pasted QR text, or null when the text is not one (nothing is sent then). */
  parseScan: (text: string) => ClaimCode | null;
  /** The typed serial and code, normalised, or the problem in words (nothing is sent then). */
  checkTyped: (serial: string, secret: string) => ClaimCode | { problem: string };
  /** The code as it is typed (grouping, upper case); default: as typed. */
  formatSecret?: (typed: string) => string;
  /** The dry run: what the device is, or why it cannot be added. Throws a refusal, which `describeError` words. */
  check: (code: ClaimCode) => Promise<ClaimAnswer>;
  /** Adds the device under `name` (null: the serial). */
  claim: (code: ClaimCode, opts: { name: string | null }) => Promise<ClaimAnswer>;
  describeError: (error: unknown) => ClaimProblem;
  /** Called once a device was added (not after a dry run). */
  onAdded?: (done: ClaimDone) => void;
  /** Where "Open the device" leads; without it there is no link. */
  deviceHref?: (done: ClaimDone) => string;
  /** The host's link (a router link); default a plain anchor. */
  renderLink?: (href: string, children: ReactNode) => ReactNode;
  /** The host's frame decoder for browsers without `BarcodeDetector` (see `QrScanner`). */
  decodeFrame?: QrFrameDecoder;
  placeholders?: { scanned?: string; serial?: string; secret?: string };
  /** The longest the typed code may grow, separators included (default 24). */
  maxSecretLength?: number;
  messages?: ProvisioningMessagesInput;
  scannerMessages?: QrScannerMessagesInput;
};

type Step = 'source' | 'capture' | 'confirm' | 'done';
type Source = 'scan' | 'type';

/**
 * ClaimDeviceWizard — "Add device" for a device that shows a claim QR and code on its own screen (NB `iot_provisioning` 04 §4.2,
 * OD-6 / OD-41 / OD-82), mobile-first: one column that holds at 360 px, the typed path always one tap away. Four steps:
 *
 *   1 source   scan the code on the device's screen, or type serial and code;
 *   2 capture  the camera (`QrScanner`, opened only on the person's press) with the QR's text field under it (pasted from the phone's
 *              camera app when there is no camera), or the serial and the code; a read code is checked at once;
 *   3 confirm  the dry run's answer (model, hardware, ready to add) and the device's name;
 *   4 done     the host's lines and a link to the device.
 *
 * The host owns the code's format (`parseScan`, `checkTyped`), the requests and the words of a refusal (`describeError`); the kit parses
 * nothing itself. The code lives only in this component's state for the two requests that carry it and is dropped when the claim is done
 * or the wizard restarts. Every request carries a sequence number: an answer that arrives after Back or Start over is dropped, and Back
 * and Start over wait while a request runs.
 */
export function ClaimDeviceWizard({
  parseScan, checkTyped, formatSecret = (s) => s, check, claim, describeError, onAdded, deviceHref, renderLink, decodeFrame,
  placeholders, maxSecretLength = 24, messages, scannerMessages,
}: ClaimDeviceWizardProps) {
  const m = mergeProvisioningMessages(messages).claim;
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source>('scan');
  const [scanned, setScanned] = useState('');
  const [serial, setSerial] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState<ClaimCode | null>(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [done, setDone] = useState<ClaimDone | null>(null);
  const [problem, setProblem] = useState<ClaimProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const restart = () => {
    seq.current += 1;
    setBusy(false);
    setStep('source'); setScanned(''); setSerial(''); setSecret(''); setCode(null); setName(''); setPreview(null); setDone(null); setProblem(null);
  };

  const finish = (d: ClaimDone) => {
    setDone(d); setStep('done'); setSecret(''); setScanned(''); setCode(null);
    onAdded?.(d);
  };

  /** Runs one request; its answer counts only while no newer request or restart came after it. */
  const run = async (request: () => Promise<ClaimAnswer>, onReady?: (p: ClaimPreview) => void) => {
    const mine = ++seq.current;
    setBusy(true);
    setProblem(null);
    try {
      const r = await request();
      if (mine !== seq.current) return;
      if (r.status === 'done') finish(r.done);
      else if (r.status === 'ready' && onReady) onReady(r.preview);
      else setProblem({ text: m.inProgress });
    } catch (e) {
      if (mine === seq.current) setProblem(describeError(e));
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  };

  /** The code of the capture step, or a problem shown here (nothing is sent). */
  const captured = (scanText?: string): ClaimCode | null => {
    if (source === 'scan' || scanText !== undefined) {
      const parsed = parseScan(scanText ?? scanned);
      if (!parsed) setProblem({ text: m.notACode });
      return parsed;
    }
    const typed = checkTyped(serial, secret);
    if ('problem' in typed) { setProblem({ text: typed.problem }); return null; }
    return typed;
  };

  const runCheck = async (scanText?: string) => {
    const c = captured(scanText);
    if (!c) return;
    await run(() => check(c), (p) => { setCode(c); setSerial(c.serial); setSecret(''); setPreview(p); setStep('confirm'); });
  };

  const add = async () => {
    if (!code) return;
    const c = code;
    await run(() => claim(c, { name: name.trim() || null }));
  };

  const onScanned = (text: string) => {
    setScanned(text);
    void runCheck(text);
  };

  const steps: Array<[Step, string]> = [['source', m.stepSource], ['capture', m.stepCapture], ['confirm', m.stepConfirm], ['done', m.stepDone]];
  const at = steps.findIndex(([s]) => s === step);
  const link = (href: string, children: ReactNode) => (renderLink
    ? renderLink(href, children)
    : <a className="text-sm font-medium text-primary underline" href={href}>{children}</a>);

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-2 text-xs" aria-label={m.steps}>
        {steps.map(([s, label], i) => (
          <li key={s} aria-current={i === at ? 'step' : undefined}
            className={cn('flex-1 rounded-md px-2 py-1 text-center', i === at ? 'bg-primary text-primary-fg' : i < at ? 'bg-primary-subtle text-primary' : 'bg-surface-sunken text-text-secondary')}>
            {label}
          </li>
        ))}
      </ol>

      {problem && (
        <Callout variant={problem.retry ? 'warning' : 'danger'} role="alert">
          <p>{problem.text}</p>
          {problem.retry && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void (step === 'confirm' ? add() : runCheck())} loading={busy}>
              {m.retry}
            </Button>
          )}
        </Callout>
      )}

      {step === 'source' && (
        <div className="space-y-3">
          <Button fullWidth size="lg" onClick={() => { setSource('scan'); setStep('capture'); }}>{m.sourceScan}</Button>
          <Button fullWidth size="lg" variant="outline" onClick={() => { setSource('type'); setStep('capture'); }}>{m.sourceType}</Button>
          <p className="text-sm text-text-secondary">{m.sourceHelp}</p>
        </div>
      )}

      {step === 'capture' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void runCheck(); }}>
          <Callout variant="info">{source === 'scan' ? m.scanHint : m.typeHint}</Callout>
          {source === 'scan' ? (
            <QrScanner onResult={onScanned} decodeFrame={decodeFrame} messages={scannerMessages}
              manual={(
                <Input id="claim-scanned" label={m.scanned} hint={m.scannedHint} value={scanned} autoComplete="off" spellCheck={false}
                  placeholder={placeholders?.scanned} onChange={(e) => setScanned(e.target.value)} />
              )} />
          ) : (
            <>
              <Input id="claim-serial" label={m.serial} value={serial} autoComplete="off" spellCheck={false}
                placeholder={placeholders?.serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} />
              <Input id="claim-code" label={m.code} value={secret} autoComplete="off" spellCheck={false}
                placeholder={placeholders?.secret} onChange={(e) => setSecret(formatSecret(e.target.value).slice(0, maxSecretLength))} />
            </>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={restart}>{m.back}</Button>
            {source === 'scan' && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setSource('type'); setProblem(null); }}>{m.switchType}</Button>
            )}
            <Button type="submit" className="ml-auto" loading={busy}>{m.check}</Button>
          </div>
        </form>
      )}

      {step === 'confirm' && preview && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <p className="text-sm text-text-secondary">{m.ready}</p>
            <p className="font-mono text-lg text-text-primary">{preview.serial}</p>
            <p className="text-sm text-text-secondary">{preview.model}{preview.hw ? ` · ${preview.hw}` : ''}</p>
          </div>
          <Input id="claim-name" label={m.name} value={name} maxLength={128} placeholder={preview.serial} hint={m.nameHint}
            onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={restart}>{m.startOver}</Button>
            <Button type="submit" className="ml-auto" loading={busy}>{m.add}</Button>
          </div>
        </form>
      )}

      {step === 'done' && done && (
        <div className="space-y-3">
          <Callout variant="tip">
            {(done.notes.length ? done.notes : [m.added]).map((line, i) => <p key={i} className={cn(i > 0 && 'mt-1')}>{line}</p>)}
          </Callout>
          <div className="flex gap-2">
            {deviceHref && link(deviceHref(done), m.open)}
            <Button className="ml-auto" variant="outline" size="sm" onClick={restart}>{m.another}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
