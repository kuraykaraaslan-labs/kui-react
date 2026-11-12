'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { SchemaForm } from '@/modules/app/SchemaForm/SchemaForm';
import { controlCls } from '@/modules/app/SchemaForm/fields/FieldControl';
import type { SchemaFieldOverrideProps } from '@/modules/app/SchemaForm/schema-form.context';
import type { FieldSchema } from '@/modules/app/SchemaForm/types';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import {
  isRefusedRpcMethod, newRpcRequestKey, RPC_SEND_LIMITS, withoutRpcPaths, type RpcCommand, type RpcPreset, type RpcSendInput,
} from '../types/rpc';
import type { IotMessagesInput } from '../messages';
import { rpcParamProblems, rpcParamsToSend } from './rpc-params';

/**
 * RpcSendPanel — pick a command of the device profile's catalog, fill its declared parameters (`SchemaForm`, OD-16), choose the answer
 * timeout and persistent delivery with an expiry, and send. A command the viewer may not send is listed greyed with the reason; a
 * high-impact command asks first, naming the device, the command and every parameter sent (a typed phrase when the catalog sets
 * `confirmText`, else a confirmation dialog), and stays open with the error when the send is refused; raw methods (outside the catalog)
 * appear only with `canSendRaw` and take JSON params and the one-way choice (a catalog command's one-way is the catalog's, shown). Factory
 * reset methods are never offered (OD-8). With `supported` false (OD-85) the panel is disabled with the reason.
 *
 * NB 41-ui-fixes/23: the masked parameters are typed in password fields and "Send again" never fills them back (1.1, 1.2); the form
 * checks what the host's API checks and shows its refusals on their fields (1.19); every send carries a `requestKey`, kept when a send got
 * no answer so a retry is not run twice, renewed after an answer or a change (1.4); the preset replays the request's own settings (N1).
 * A hidden value "Send again" left out is marked and the form is not sent until it is entered again (C1); a name the host holds secret
 * is a password field too (C7).
 */
export type RpcSendPanelProps = {
  commands: readonly RpcCommand[];
  canSendRaw?: boolean;
  supported?: boolean;
  unsupportedReason?: string;
  /** The device is offline: warn when "persistent" is off. */
  deviceOnline?: boolean | null;
  /** The device's name, for the confirmation of a high-impact command. */
  deviceName?: string | null;
  /** The host's rule for a secret parameter name (`RpcCatalog.isSecretParam`): typed in a password field, hidden in the confirmation. */
  isSecretParam?: (name: string, raw: boolean) => boolean;
  /** Resolves once the host answered; rejects with what it refused (shown on the form, or in the open confirmation). */
  onSend: (input: RpcSendInput) => Promise<unknown>;
  /** Pre-fill (re-run of an earlier request: `rpcPresetOf`). A new object applies again. */
  preset?: RpcPreset | null;
  messages?: IotMessagesInput;
  className?: string;
};

const RAW = '__raw__';
const MASK = '***';

/** The fields of the open command that are secrets: a password input (SchemaForm hands its overrides the field itself). */
const SecretFields = createContext<ReadonlySet<FieldSchema>>(new Set());

function TextOrSecret({ id, field, value, onChange }: SchemaFieldOverrideProps) {
  const secret = useContext(SecretFields).has(field);
  const str = typeof value === 'string' ? value : '';
  if (field.type === 'textarea' && !secret) {
    return (
      <textarea id={id} rows={3} value={str} placeholder={field.placeholder} maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)} className={cn(controlCls, 'resize-y')} />
    );
  }
  return (
    <input id={id} type={secret ? 'password' : 'text'} autoComplete={secret ? 'new-password' : undefined} value={str}
      placeholder={field.placeholder} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} className={controlCls} />
  );
}
const FIELD_OVERRIDES = { text: TextOrSecret, textarea: TextOrSecret };

/** A send that got no answer (or a server failure): it may have reached the host, so its key is kept for the retry. */
function unanswered(e: unknown): boolean {
  if (!(e instanceof IotApiError)) return true;
  return e.code === 'timeout' || e.code === 'unavailable' || e.code === 'unknown';
}

const showValue = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));
const valueAt = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((at, k) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[k] : undefined), o);
/** A hidden value entered again: something other than empty or the mask itself. */
const entered = (v: unknown) => v !== undefined && v !== null && v !== '' && v !== MASK;
const parsedJson = (text: string): unknown => { try { return JSON.parse(text || '{}'); } catch { return undefined; } };
const without = <T extends Record<string, string>>(o: T, key: string): T => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as T;

export function RpcSendPanel({
  commands, canSendRaw = false, supported = true, unsupportedReason, deviceOnline, deviceName, isSecretParam, onSend, preset, messages, className,
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // the masked values "Send again" left out: asked for until the form is sent or another command is picked
  const [reenter, setReenter] = useState<readonly string[]>([]);
  const [requestKey, setRequestKey] = useState(newRpcRequestKey);
  // null to begin with, so a preset given on mount applies too
  const [presetFor, setPresetFor] = useState<RpcPreset | null | undefined>(null);

  /** Any change of the form makes it another command: a new key. */
  const edited = () => { setRequestKey(newRpcRequestKey()); setSendError(null); };

  function reset(next: string) {
    setMethod(next);
    setRaw('');
    setValues({});
    setJson('{}');
    setErrors({});
    setOneway(null);
    setPersistent(null);
    setTimeoutS('');
    setExpiresMin('');
    setReenter([]);
    edited();
  }

  if (preset !== presetFor) {
    setPresetFor(preset);
    if (preset) {
      // the request's own settings replace what the form held (N1); its masked values are left out and asked for (1.1)
      const known = offered.some((c) => c.method === preset.method);
      const params = preset.params ? withoutRpcPaths(preset.params, preset.maskedPaths ?? []) : {};
      reset(known ? preset.method : canSendRaw ? RAW : '');
      setRaw(known ? '' : preset.method);
      setValues(params);
      setJson(JSON.stringify(params, null, 2));
      setOneway(known || preset.oneway === undefined ? null : preset.oneway);
      setPersistent(preset.persistent ?? null);
      setTimeoutS(preset.timeoutMs ? String(preset.timeoutMs / 1000) : '');
      setExpiresMin(preset.persistent && preset.expiresInS ? String(Math.max(1, Math.round(preset.expiresInS / 60))) : '');
      setReenter(preset.maskedPaths ?? []);
    }
  }

  const command = offered.find((c) => c.method === method) ?? null;
  const isRaw = method === RAW;
  const sendable = isRaw ? canSendRaw && !!raw.trim() && !isRefusedRpcMethod(raw) : !!command && command.sendable !== false;
  // a catalog command's one-way is the catalog's (the host decides it so): only a raw method chooses it (1.5)
  const effOneway = isRaw ? (oneway ?? false) : (command?.oneway ?? false);
  const effPersistent = persistent ?? command?.persistentDefault ?? false;
  // the command's masked params and the names the host holds secret (C7)
  const maskedKeys = useMemo(
    () => new Set([...(command?.maskedParams ?? []), ...Object.keys(command?.paramsSchema ?? {}).filter((k) => isSecretParam?.(k, false))]),
    [command, isSecretParam],
  );
  const secret = useMemo(
    () => new Set([...maskedKeys].map((k) => command?.paramsSchema[k]).filter((f): f is FieldSchema => !!f)),
    [command, maskedKeys],
  );
  // the hidden values "Send again" left out that are still not entered again (C1)
  const missing = reenter.filter((p) => !entered(valueAt(isRaw ? parsedJson(json) : values, p)));
  const tierLabel = (t: RpcCommand['tier']) => m.rpcCatalog[t] ?? t;

  /** The input to send, or null with the problems marked (the host's API checks the same). */
  function input(): RpcSendInput | null {
    const errs: Record<string, string> = {};
    let params: Record<string, unknown> | undefined;
    if (isRaw) {
      try {
        const v = JSON.parse(json || '{}') as unknown;
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
        params = v as Record<string, unknown>;
      } catch {
        errs.__json = m.rpc.paramsInvalid;
      }
    } else if (command) {
      Object.assign(errs, rpcParamProblems(command.paramsSchema, values, m));
      params = Object.keys(command.paramsSchema).length ? rpcParamsToSend(command.paramsSchema, values) : undefined;
    }
    // a hidden value left out by "Send again" is entered again before anything is sent, optional or not (C1)
    if (missing.length) {
      if (isRaw || !command) errs.__json ??= fill(m.rpc.reenterMasked, { names: missing.join(', ') });
      else for (const p of missing) errs[p.split('.')[0]!] ??= m.rpc.reenterField;
    }
    const t = Number(timeoutS);
    if (!effOneway && timeoutS && !(t >= RPC_SEND_LIMITS.timeoutMinS && t <= RPC_SEND_LIMITS.timeoutMaxS)) {
      errs.timeout = fill(m.rpc.timeoutRange, { min: RPC_SEND_LIMITS.timeoutMinS, max: RPC_SEND_LIMITS.timeoutMaxS });
    }
    const exp = Number(expiresMin);
    const maxMin = RPC_SEND_LIMITS.expiryMaxS / 60;
    if (effPersistent && expiresMin && !(exp >= 1 && exp <= maxMin)) errs.expires = fill(m.rpc.expiresRange, { max: maxMin });
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    return {
      method: isRaw ? raw.trim() : method,
      ...(params ? { params } : {}),
      ...(isRaw && oneway !== null ? { oneway } : {}),
      ...(!effOneway && timeoutS ? { timeoutMs: Math.round(t * 1000) } : {}),
      ...(persistent !== null ? { persistent } : {}),
      ...(effPersistent && expiresMin ? { expiresInS: Math.round(exp * 60) } : {}),
    };
  }

  /** A refusal's field messages on their fields: `params.<key>` on the parameter, the timeout and the expiry on theirs (1.19). */
  function markFields(e: unknown) {
    if (!(e instanceof IotApiError) || !e.fieldErrors) return;
    const marked: Record<string, string> = {};
    for (const [k, text] of Object.entries(e.fieldErrors)) {
      if (k.startsWith('params.')) marked[isRaw ? '__json' : k.slice('params.'.length).split('.')[0]!] ??= text;
      else if (k === 'params') marked[isRaw ? '__json' : '__params'] ??= text;
      else if (k === 'timeoutMs') marked.timeout = text;
      else if (k === 'expiresInS') marked.expires = text;
    }
    if (Object.keys(marked).length) setErrors((cur) => ({ ...cur, ...marked }));
  }

  async function send(inDialog: boolean, extra: Pick<RpcSendInput, 'confirm' | 'confirmText'> = {}) {
    const i = input();
    if (!i) { if (inDialog) setConfirming(false); return; }
    setBusy(true);
    setSendError(null);
    setConfirmError(null);
    try {
      await onSend({ ...i, ...extra, requestKey });
      setConfirming(false);
      setReenter([]);
      setRequestKey(newRpcRequestKey());
    } catch (e) {
      // no answer: the same key again, so a send the host already ran is not run twice; an answer: a new key for the next try
      const lost = unanswered(e);
      if (!lost) setRequestKey(newRpcRequestKey());
      // no answer: the host's words when it said why (a server failure), else "it may have been sent"
      const text = lost ? errorMessage(e, m.rpc.maybeSent) : errorMessage(e, m.rpc.sendError);
      if (inDialog) setConfirmError(text);
      else setSendError(text);
      markFields(e);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (busy || !sendable) return;
    if (command?.highImpact) {
      if (input()) { setConfirmError(null); setConfirming(true); }
      return;
    }
    void send(false);
  }

  const options = [
    { value: '', label: m.rpc.chooseCommand },
    ...offered.map((c) => ({ value: c.method, label: c.sendable === false ? `${c.label} (${c.method}) — ${fill(m.rpc.notAllowed, { tier: tierLabel(c.tier) })}` : `${c.label} (${c.method})` })),
    ...(canSendRaw ? [{ value: RAW, label: m.rpc.rawMethod }] : []),
  ];

  if (!supported) {
    return (
      <section className={cn('rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary', className)} aria-label={m.rpc.title}>
        {unsupportedReason ?? m.rpc.notSupported}
      </section>
    );
  }

  // what the confirmation names (1.6): the command and every parameter sent, a masked one as hidden
  const commandName = command ? `${command.label} (${command.method})` : '';
  const sent = command && Object.keys(command.paramsSchema).length ? rpcParamsToSend(command.paramsSchema, values) : {};
  const confirmDetails = command ? (
    Object.keys(sent).length ? (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-text-primary">{m.rpc.confirmParams}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {Object.entries(sent).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-secondary">{command.paramsSchema[k]?.label ?? k}</dt>
              <dd className="break-all font-mono text-xs text-text-primary">
                {maskedKeys.has(k) || v === MASK ? <span className="font-sans text-text-secondary">{m.rpc.hiddenValue}</span> : showValue(v)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    ) : <p className="text-sm text-text-secondary">{m.rpc.confirmNoParams}</p>
  ) : undefined;
  const reenterNames = missing.map((p) => command?.paramsSchema[p]?.label ?? p).join(', ');

  return (
    <section className={cn('rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)} aria-label={m.rpc.title}>
      {offered.length === 0 && !canSendRaw ? (
        <p className="text-sm text-text-secondary">{m.rpc.noCommands}</p>
      ) : (
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); start(); }}>
          <Select id="rpc-command" label={m.rpc.command} value={method} onChange={(e) => reset(e.target.value)} options={options} />
          {command?.description && <p className="text-xs text-text-secondary">{command.description}</p>}
          {command && command.sendable === false && (
            <p role="note" className="text-xs text-warning-fg">{fill(m.rpc.notAllowed, { tier: tierLabel(command.tier) })}</p>
          )}
          {missing.length > 0 && (command || isRaw) && (
            <p role="note" className="text-xs text-warning-fg">{fill(m.rpc.reenterMasked, { names: reenterNames })}</p>
          )}
          {isRaw && (
            <>
              <Input id="rpc-raw-method" label={m.rpc.rawMethodLabel} value={raw} onChange={(e) => { setRaw(e.target.value); edited(); }} placeholder="namespace.verb" />
              <Textarea id="rpc-raw-params" label={m.rpc.paramsJson} rows={4} className="font-mono" value={json} error={errors.__json}
                onChange={(e) => { setJson(e.target.value); setErrors({}); edited(); }} />
            </>
          )}
          {command && (Object.keys(command.paramsSchema).length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">{m.rpc.params}</p>
              {errors.__params && <p role="alert" className="text-xs text-error">{errors.__params}</p>}
              <SecretFields.Provider value={secret}>
                <SchemaForm schema={command.paramsSchema} values={values} fieldOverrides={FIELD_OVERRIDES} errors={errors} debounceMs={0}
                  onChange={(v) => { setValues(v); setErrors({}); edited(); }} />
              </SecretFields.Provider>
            </div>
          ) : <p className="text-xs text-text-secondary">{m.rpc.noParams}</p>)}
          {(command || isRaw) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {isRaw ? (
                <Checkbox id="rpc-oneway" label={m.rpc.oneway} checked={effOneway} onChange={(e) => { setOneway(e.target.checked); edited(); }} />
              ) : command?.oneway ? (
                <p className="text-xs text-text-secondary sm:col-span-2">{m.rpc.onewayFixed}</p>
              ) : null}
              {!effOneway && (
                <Input id="rpc-timeout" type="number" min={RPC_SEND_LIMITS.timeoutMinS} max={RPC_SEND_LIMITS.timeoutMaxS} label={m.rpc.timeout} value={timeoutS}
                  error={errors.timeout} placeholder={command?.defaultTimeoutMs ? String(command.defaultTimeoutMs / 1000) : undefined}
                  onChange={(e) => { setTimeoutS(e.target.value); setErrors((cur) => without(cur, 'timeout')); edited(); }} />
              )}
              <Checkbox id="rpc-persistent" label={m.rpc.persistent} checked={effPersistent} onChange={(e) => { setPersistent(e.target.checked); edited(); }} />
              {effPersistent && (
                <Input id="rpc-expires" type="number" min={1} max={RPC_SEND_LIMITS.expiryMaxS / 60} label={m.rpc.expires} value={expiresMin} error={errors.expires}
                  onChange={(e) => { setExpiresMin(e.target.value); setErrors((cur) => without(cur, 'expires')); edited(); }} />
              )}
            </div>
          )}
          {deviceOnline === false && !effPersistent && (command || isRaw) && (
            <p className="flex items-center gap-1.5 text-xs text-warning-fg">
              <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" aria-hidden="true" />{m.rpc.offlineWarning}
            </p>
          )}
          {sendError && <p role="alert" className="text-sm text-error">{sendError}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={busy && !confirming} disabled={!sendable || busy}
              iconLeft={<FontAwesomeIcon icon={faPaperPlane} className="h-3 w-3" aria-hidden="true" />}>
              {busy ? m.rpc.sending : m.rpc.send}
            </Button>
          </div>
        </form>
      )}

      {/* outside the form: a submit inside the dialog must not reach the panel's form */}
      <ConfirmDialog
        open={confirming}
        title={deviceName ? fill(m.rpc.confirmTitleDevice, { command: commandName, device: deviceName }) : fill(m.rpc.confirmTitle, { method: commandName })}
        message={m.rpc.confirmHint}
        details={confirmDetails}
        tone="danger"
        phrase={command?.highImpact && command.confirmText ? command.confirmText : undefined}
        phraseLabel={command?.confirmText ? fill(m.rpc.typeToConfirm, { phrase: command.confirmText }) : undefined}
        confirmLabel={m.rpc.send}
        cancelLabel={m.common.cancel}
        closeLabel={m.common.close}
        busy={busy}
        error={confirmError ?? undefined}
        onCancel={() => { setConfirming(false); setConfirmError(null); }}
        onConfirm={() => void send(true, command?.highImpact && command.confirmText ? { confirm: true, confirmText: command.confirmText } : { confirm: true })}
      />
    </section>
  );
}
