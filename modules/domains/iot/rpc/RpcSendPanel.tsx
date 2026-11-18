'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
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
  isRefusedRpcMethod, newRpcRequestKey, RPC_DEFAULT_WIRE_METHOD, rpcCustomMethodOf, rpcMaskPathsIn, withoutRpcPaths, type RpcCommand, type RpcPreset,
  type RpcSendInput,
} from '../types/rpc';
import type { IotMessagesInput } from '../messages';
import { rpcParamProblems, rpcParamsToSend, rpcVariantOf } from './rpc-params';

/**
 * RpcSendPanel — send a command to one device.
 *
 * NB rpc-wire-method: a command of the profile's catalog is sent as the catalog defines it, with one button: its parameters carry the
 * values the catalog gives them, and its one-way, timeout and persistence are the catalog's. The panel asks only for what the catalog
 * leaves open: a required parameter without a value, and a hidden value "Send again" could not fill back (it is never sent as the mask).
 * A command the viewer may not send is listed greyed with the reason; a high-impact command asks first, naming the device, the command and
 * every parameter sent (a typed phrase when the catalog sets `confirmText`), and stays open with the error when the send is refused.
 *
 * "Custom payload (one time)" (only with `canSendRaw`: raw RPC, the raw permission, always audited) takes a JSON the device receives
 * exactly as it is, sent once and never saved to the catalog; it is recorded under the `method` the JSON names (`rpcCustomMethodOf`).
 * Factory reset methods are never offered (OD-8). With `supported` false (OD-85) the panel is disabled with the reason.
 *
 * NB 41-ui-fixes/23 still holds: masked parameters are typed in password fields and never filled back (1.1, 1.2, C1, C7); the host's
 * refusals are shown on their fields (1.19); every send carries a `requestKey`, kept when a send got no answer so a retry is not run
 * twice, renewed after an answer or a change (1.4).
 */
export type RpcSendPanelProps = {
  commands: readonly RpcCommand[];
  /** The viewer may send a custom payload (raw RPC). */
  canSendRaw?: boolean;
  supported?: boolean;
  unsupportedReason?: string;
  /** The device is offline: warn when the command is not persistent. */
  deviceOnline?: boolean | null;
  /** The device's name, for the confirmation of a high-impact command. */
  deviceName?: string | null;
  /** The host's rule for a secret parameter name (`RpcCatalog.isSecretParam`): typed in a password field, hidden in the confirmation. */
  isSecretParam?: (name: string, raw: boolean) => boolean;
  /** Resolves once the host answered; rejects with what it refused (shown on the form, or in the open confirmation). */
  onSend: (input: RpcSendInput) => Promise<unknown>;
  /** Pre-fill ("Send again" of an earlier request: `rpcPresetOf`). A new object applies again. */
  preset?: RpcPreset | null;
  messages?: IotMessagesInput;
  className?: string;
};

const CUSTOM = '__custom__';
const MASK = '***';
/** What the custom payload box starts with: the envelope with the default method. */
export const RPC_CUSTOM_PAYLOAD_START = `{\n  "method": "${RPC_DEFAULT_WIRE_METHOD}",\n  "params": {}\n}`;

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
const parsedJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try { return { ok: true, value: JSON.parse(text) as unknown }; } catch { return { ok: false }; }
};
const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * The parameters the panel asks for (NB rpc-wire-method): a required one the catalog gives no value and the form holds none, and a
 * hidden one "Send again" left out; every other one is sent with the catalog's value.
 */
export function rpcAskedParams(schema: Record<string, FieldSchema>, values: Record<string, unknown>, reenter: readonly string[] = []): string[] {
  const sent = rpcParamsToSend(schema, values);
  const tops = new Set(reenter.map((p) => p.split('.')[0]!));
  return Object.entries(schema).filter(([k, declared]) => {
    if (tops.has(k)) return true;
    const f = rpcVariantOf(declared, sent);
    return !!f && !!f.required && f.value === undefined && isEmpty(sent[k]);
  }).map(([k]) => k);
}

export function RpcSendPanel({
  commands, canSendRaw = false, supported = true, unsupportedReason, deviceOnline, deviceName, isSecretParam, onSend, preset, messages, className,
}: RpcSendPanelProps) {
  const { m } = useIotText(messages);
  const offered = useMemo(() => commands.filter((c) => !isRefusedRpcMethod(c.method)), [commands]);
  const [method, setMethod] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [json, setJson] = useState(RPC_CUSTOM_PAYLOAD_START);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // the masked values "Send again" left out: asked for until the form is sent or another command is picked
  const [reenter, setReenter] = useState<readonly string[]>([]);
  const [requestKey, setRequestKey] = useState(newRpcRequestKey);
  // the parameters asked for, fixed when a command is picked (a field does not vanish while it is typed in)
  const [asked, setAsked] = useState<readonly string[]>([]);
  // null to begin with, so a preset given on mount applies too
  const [presetFor, setPresetFor] = useState<RpcPreset | null | undefined>(null);

  /** Any change of the form makes it another command: a new key. */
  const edited = () => { setRequestKey(newRpcRequestKey()); setSendError(null); };

  function pick(next: string, o: { values?: Record<string, unknown>; json?: string; reenter?: readonly string[] } = {}) {
    const c = offered.find((x) => x.method === next);
    const v = o.values ?? {};
    const r = o.reenter ?? [];
    setMethod(next);
    setValues(v);
    setJson(o.json ?? RPC_CUSTOM_PAYLOAD_START);
    setErrors({});
    setReenter(r);
    setAsked(c ? rpcAskedParams(c.paramsSchema, v, r) : []);
    edited();
  }

  if (preset !== presetFor) {
    setPresetFor(preset);
    if (preset) {
      const known = offered.some((c) => c.method === preset.method) && preset.payload === undefined;
      if (known) {
        // a catalog command again: the request's own params (a board's value, say) without the masked ones, which are asked for (1.1)
        pick(preset.method, { values: preset.params ? withoutRpcPaths(preset.params, preset.maskedPaths ?? []) : {}, reenter: preset.maskedPaths ?? [] });
      } else if (canSendRaw) {
        // a custom payload again (or a raw request of before: its method and params as the envelope); a masked value must be typed again
        const payload = preset.payload !== undefined ? preset.payload : { method: preset.method, ...(preset.params ? { params: preset.params } : {}) };
        pick(CUSTOM, { json: JSON.stringify(payload, null, 2), reenter: preset.payload !== undefined ? rpcMaskPathsIn(preset.payload) : (preset.maskedPaths ?? []).map((p) => `params.${p}`) });
      } else {
        pick('');
      }
    }
  }

  const command = offered.find((c) => c.method === method) ?? null;
  const isCustom = method === CUSTOM;
  const parsed = isCustom ? parsedJson(json) : null;
  const sendable = isCustom ? canSendRaw && !!json.trim() : !!command && command.sendable !== false;
  // the command's masked params and the names the host holds secret (C7)
  const maskedKeys = useMemo(
    () => new Set([...(command?.maskedParams ?? []), ...Object.keys(command?.paramsSchema ?? {}).filter((k) => isSecretParam?.(k, false))]),
    [command, isSecretParam],
  );
  const secret = useMemo(
    () => new Set([...maskedKeys].map((k) => command?.paramsSchema[k]).filter((f): f is FieldSchema => !!f)),
    [command, maskedKeys],
  );
  const askedSchema = useMemo(
    () => (command ? Object.fromEntries(asked.filter((k) => command.paramsSchema[k]).map((k) => [k, command.paramsSchema[k]!])) : {}),
    [command, asked],
  );
  // the hidden values "Send again" left out that are still not entered again (C1)
  const missing = reenter.filter((p) => !entered(valueAt(isCustom ? (parsed?.ok ? parsed.value : undefined) : values, p)));
  const tierLabel = (t: RpcCommand['tier']) => m.rpcCatalog[t] ?? t;

  /** The input to send, or null with the problems marked (the host's API checks the same). */
  function input(): RpcSendInput | null {
    const errs: Record<string, string> = {};
    if (isCustom) {
      if (!parsed?.ok) errs.__json = m.rpc.payloadInvalid;
      else if (missing.length) errs.__json = fill(m.rpc.reenterMasked, { names: missing.join(', ') });
      else if (isRefusedRpcMethod(rpcCustomMethodOf(parsed.value))) errs.__json = m.rpcCatalog.refused;
      setErrors(errs);
      if (Object.keys(errs).length || !parsed?.ok) return null;
      return { method: rpcCustomMethodOf(parsed.value), payload: parsed.value };
    }
    if (!command) return null;
    Object.assign(errs, rpcParamProblems(command.paramsSchema, values, m));
    // a hidden value left out by "Send again" is entered again before anything is sent, optional or not (C1)
    for (const p of missing) errs[p.split('.')[0]!] ??= m.rpc.reenterField;
    // a problem of a parameter the panel does not show (a catalog value the host would refuse) is named in one line
    const hidden = Object.keys(errs).filter((k) => !asked.includes(k));
    if (hidden.length) errs.__params = fill(m.rpc.catalogValueProblem, { names: hidden.map((k) => command.paramsSchema[k]?.label ?? k).join(', ') });
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    const params = Object.keys(command.paramsSchema).length ? rpcParamsToSend(command.paramsSchema, values) : undefined;
    return { method: command.method, ...(params ? { params } : {}) };
  }

  /** A refusal's field messages on their fields (1.19): `params.<key>` on the parameter, the payload's on the payload box. */
  function markFields(e: unknown) {
    if (!(e instanceof IotApiError) || !e.fieldErrors) return;
    const marked: Record<string, string> = {};
    for (const [k, text] of Object.entries(e.fieldErrors)) {
      if (isCustom && (k === 'payload' || k.startsWith('payload.'))) marked.__json ??= text;
      else if (k.startsWith('params.')) {
        const key = k.slice('params.'.length).split('.')[0]!;
        if (asked.includes(key)) marked[key] ??= text;
        else marked.__params ??= text;
      } else if (k === 'params') marked.__params ??= text;
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
    ...offered.map((c) => ({ value: c.method, label: c.sendable === false ? `${c.label} — ${fill(m.rpc.notAllowed, { tier: tierLabel(c.tier) })}` : c.label })),
    ...(canSendRaw ? [{ value: CUSTOM, label: m.rpc.customPayload }] : []),
  ];

  if (!supported) {
    return (
      <section className={cn('rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary', className)} aria-label={m.rpc.title}>
        {unsupportedReason ?? m.rpc.notSupported}
      </section>
    );
  }

  // what the confirmation names (1.6): the command and every parameter sent, a masked one as hidden
  const commandName = command ? command.label : '';
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
  const reenterNames = missing.map((p) => command?.paramsSchema[p.split('.')[0]!]?.label ?? p).join(', ');
  const persistent = isCustom ? false : !!command?.persistentDefault;

  return (
    <section className={cn('rounded-xl border border-border bg-surface-raised p-4 sm:p-5', className)} aria-label={m.rpc.title}>
      {offered.length === 0 && !canSendRaw ? (
        <p className="text-sm text-text-secondary">{m.rpc.noCommands}</p>
      ) : (
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); start(); }}>
          <Select id="rpc-command" label={m.rpc.command} value={method} onChange={(e) => pick(e.target.value)} options={options} />
          {command?.description && <p className="text-xs text-text-secondary">{command.description}</p>}
          {command && command.sendable === false && (
            <p role="note" className="text-xs text-warning-fg">{fill(m.rpc.notAllowed, { tier: tierLabel(command.tier) })}</p>
          )}
          {missing.length > 0 && (command || isCustom) && (
            <p role="note" className="text-xs text-warning-fg">{fill(m.rpc.reenterMasked, { names: reenterNames })}</p>
          )}
          {isCustom && (
            <Textarea id="rpc-custom-payload" label={m.rpc.customPayloadLabel} hint={m.rpc.customPayloadHint} rows={8} className="font-mono" value={json}
              error={errors.__json} onChange={(e) => { setJson(e.target.value); setErrors({}); edited(); }} />
          )}
          {errors.__params && <p role="alert" className="text-xs text-error">{errors.__params}</p>}
          {command && asked.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">{m.rpc.askedParams}</p>
              <SecretFields.Provider value={secret}>
                <SchemaForm schema={askedSchema} values={values} fieldOverrides={FIELD_OVERRIDES} errors={errors} debounceMs={0} messages={{ on: m.rules.on, off: m.rules.off }}
                  onChange={(v) => { setValues((cur) => ({ ...cur, ...v })); setErrors({}); edited(); }} />
              </SecretFields.Provider>
            </div>
          )}
          {deviceOnline === false && !persistent && (command || isCustom) && (
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
