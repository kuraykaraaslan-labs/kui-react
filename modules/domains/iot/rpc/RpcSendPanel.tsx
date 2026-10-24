'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Modal } from '@/modules/ui/Modal';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { TypedConfirmDialog } from '@/modules/ui/TypedConfirmDialog';
import { SchemaForm } from '@/modules/app/SchemaForm/SchemaForm';
import { validateSchemaValues } from '@/modules/app/SchemaForm/validate';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import { isRefusedRpcMethod, type RpcCommand, type RpcSendInput } from '../types/rpc';
import type { IotMessagesInput } from '../messages';

/**
 * RpcSendPanel — pick a command of the device profile's catalog, fill its declared parameters (`SchemaForm`, OD-16), choose
 * one-way, the answer timeout and persistent delivery with an expiry, and send. A command the viewer may not send is listed greyed
 * with the reason; a high-impact command asks first (a typed phrase when the catalog sets `confirmText`, else a confirmation
 * dialog); raw methods (outside the catalog) appear only with `canSendRaw` and take JSON params. Factory-reset methods are never
 * offered (OD-8). With `supported` false (OD-85) the panel is disabled with the reason.
 */
export type RpcSendPanelProps = {
  commands: readonly RpcCommand[];
  canSendRaw?: boolean;
  supported?: boolean;
  unsupportedReason?: string;
  /** The device is offline: warn when "persistent" is off. */
  deviceOnline?: boolean | null;
  onSend: (input: RpcSendInput) => Promise<void>;
  /** Pre-fill (re-run of an earlier request). */
  preset?: { method: string; params?: Record<string, unknown> } | null;
  messages?: IotMessagesInput;
  className?: string;
};

const RAW = '__raw__';

export function RpcSendPanel({
  commands, canSendRaw = false, supported = true, unsupportedReason, deviceOnline, onSend, preset, messages, className,
}: RpcSendPanelProps) {
  const { m } = useIotText(messages);
  const offered = useMemo(() => commands.filter((c) => !isRefusedRpcMethod(c.method)), [commands]);
  const [method, setMethod] = useState('');
  const [raw, setRaw] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [json, setJson] = useState('{}');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oneway, setOneway] = useState<boolean | null>(null);
  const [timeoutS, setTimeoutS] = useState('');
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [expiresMin, setExpiresMin] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [presetFor, setPresetFor] = useState(preset);

  if (preset !== presetFor) {
    setPresetFor(preset);
    if (preset) {
      const known = offered.some((c) => c.method === preset.method);
      setMethod(known ? preset.method : canSendRaw ? RAW : '');
      setRaw(known ? '' : preset.method);
      setValues(preset.params ?? {});
      setJson(JSON.stringify(preset.params ?? {}, null, 2));
    }
  }

  const command = offered.find((c) => c.method === method) ?? null;
  const isRaw = method === RAW;
  const sendable = isRaw ? canSendRaw && !!raw.trim() && !isRefusedRpcMethod(raw) : !!command && command.sendable !== false;
  const effOneway = oneway ?? command?.oneway ?? false;
  const effPersistent = persistent ?? command?.persistentDefault ?? false;

  function pick(next: string) {
    setMethod(next);
    setValues({});
    setJson('{}');
    setErrors({});
    setOneway(null);
    setPersistent(null);
    setTimeoutS('');
  }

  function input(): RpcSendInput | null {
    let params: Record<string, unknown> | undefined;
    if (isRaw) {
      try {
        const v = JSON.parse(json || '{}');
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
        params = v;
      } catch {
        setErrors({ __json: m.rpc.paramsInvalid });
        return null;
      }
    } else if (command) {
      const e = validateSchemaValues(command.paramsSchema, values);
      if (Object.keys(e).length) { setErrors(e); return null; }
      params = Object.keys(command.paramsSchema).length ? values : undefined;
    }
    const t = Number(timeoutS);
    const exp = Number(expiresMin);
    return {
      method: isRaw ? raw.trim() : method,
      ...(params ? { params } : {}),
      ...(oneway !== null ? { oneway } : {}),
      ...(timeoutS && t > 0 ? { timeoutMs: Math.round(t * 1000) } : {}),
      ...(persistent !== null ? { persistent } : {}),
      ...(effPersistent && expiresMin && exp > 0 ? { expiresInS: Math.round(exp * 60) } : {}),
    };
  }

  async function send(extra: Pick<RpcSendInput, 'confirm' | 'confirmText'> = {}) {
    const i = input();
    if (!i) return;
    setBusy(true);
    try {
      await onSend({ ...i, ...extra });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (command?.highImpact) { if (input()) setConfirming(true); return; }
    void send();
  }

  const options = [
    { value: '', label: m.rpc.chooseCommand },
    ...offered.map((c) => ({ value: c.method, label: c.sendable === false ? `${c.label} (${c.method}) — ${fill(m.rpc.notAllowed, { tier: c.tier })}` : `${c.label} (${c.method})` })),
    ...(canSendRaw ? [{ value: RAW, label: m.rpc.rawMethod }] : []),
  ];

  if (!supported) {
    return (
      <section className={cn('rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary', className)} aria-label={m.rpc.title}>
        {unsupportedReason ?? m.rpc.notSupported}
      </section>
    );
  }

  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)} aria-label={m.rpc.title}>
      {offered.length === 0 && !canSendRaw ? (
        <p className="text-sm text-text-secondary">{m.rpc.noCommands}</p>
      ) : (
        <>
          <Select id="rpc-command" label={m.rpc.command} value={method} onChange={(e) => pick(e.target.value)} options={options} />
          {command?.description && <p className="text-xs text-text-secondary">{command.description}</p>}
          {command && command.sendable === false && (
            <p role="note" className="text-xs text-warning-fg">{fill(m.rpc.notAllowed, { tier: command.tier })}</p>
          )}
          {isRaw && (
            <>
              <Input id="rpc-raw-method" label={m.rpc.rawMethodLabel} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="namespace.verb" />
              <Textarea id="rpc-raw-params" label={m.rpc.paramsJson} rows={4} className="font-mono" value={json} error={errors.__json}
                onChange={(e) => { setJson(e.target.value); setErrors({}); }} />
            </>
          )}
          {command && (Object.keys(command.paramsSchema).length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">{m.rpc.params}</p>
              <SchemaForm schema={command.paramsSchema} values={values} onChange={(v) => { setValues(v); setErrors({}); }} errors={errors} debounceMs={0} />
            </div>
          ) : <p className="text-xs text-text-secondary">{m.rpc.noParams}</p>)}
          {(command || isRaw) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Checkbox id="rpc-oneway" label={m.rpc.oneway} checked={effOneway} onChange={(e) => setOneway(e.target.checked)} />
              {!effOneway && (
                <Input id="rpc-timeout" type="number" min={1} max={600} label={m.rpc.timeout} value={timeoutS}
                  placeholder={command?.defaultTimeoutMs ? String(command.defaultTimeoutMs / 1000) : undefined} onChange={(e) => setTimeoutS(e.target.value)} />
              )}
              <Checkbox id="rpc-persistent" label={m.rpc.persistent} checked={effPersistent} onChange={(e) => setPersistent(e.target.checked)} />
              {effPersistent && (
                <Input id="rpc-expires" type="number" min={1} label={m.rpc.expires} value={expiresMin} onChange={(e) => setExpiresMin(e.target.value)} />
              )}
            </div>
          )}
          {deviceOnline === false && !effPersistent && (command || isRaw) && (
            <p className="flex items-center gap-1.5 text-xs text-warning-fg">
              <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" aria-hidden="true" />{m.rpc.offlineWarning}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" loading={busy && !confirming} disabled={!sendable || busy} onClick={start}
              iconLeft={<FontAwesomeIcon icon={faPaperPlane} className="h-3 w-3" aria-hidden="true" />}>
              {busy ? m.rpc.sending : m.rpc.send}
            </Button>
          </div>
        </>
      )}

      {command?.highImpact && command.confirmText ? (
        <TypedConfirmDialog
          open={confirming}
          title={fill(m.rpc.confirmTitle, { method: command.method })}
          description={m.rpc.confirmHint}
          phrase={command.confirmText}
          label={fill(m.rpc.typeToConfirm, { phrase: command.confirmText })}
          confirmLabel={m.rpc.send}
          cancelLabel={m.common.cancel}
          closeLabel={m.common.close}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void send({ confirm: true, confirmText: command.confirmText ?? undefined })}
        />
      ) : (
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title={fill(m.rpc.confirmTitle, { method: command?.method ?? '' })}
          closeLabel={m.common.close}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{m.common.cancel}</Button>
              <Button variant="danger" size="sm" loading={busy} onClick={() => void send({ confirm: true })}>{m.rpc.send}</Button>
            </div>
          )}
        >
          <p className="text-sm text-text-secondary">{m.rpc.confirmHint}</p>
        </Modal>
      )}
    </section>
  );
}
