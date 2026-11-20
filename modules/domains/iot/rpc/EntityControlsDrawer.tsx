'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessages, IotMessagesInput } from '../messages';
import type { ControlSendResult, EntityControl, EntityControlsView } from '../types/rpc';
import { CommandBindingEditorDrawer } from './RpcCommandBindingsDrawer';
import { boundOf, boundText, controlParams, newPressKey, tierText, tierVariant } from './entity-controls';

/**
 * EntityControlsDrawer — "Controls" of one record (NB 42-telemetry/14; the IoT release's first declarer is the device itself, kind
 * `iot_device`, OD-226): each named control the record's kind declares, its tier and what is bound to it (the devices' names where the
 * viewer may read them, else how many, else "Not connected to any device").
 *
 * **Send** (disabled without `permitted`): a control with values asks for them first (checked here, judged again by the host); a control
 * that confirms asks through the ConfirmDialog, naming the record (a typed phrase for `typed`), and the send runs inside it; then the
 * result per device in words (Queued / Sent / Failed and why). Each press carries one idempotency key, kept for a retry of the same
 * press (an answer lost on the way is never a second command) and dropped once the host answered. `nothing_bound` reads "Not connected
 * to any device"; a sink that could not answer reads "Could not reach Device commands". With `canManageBindings` each control offers
 * "Bind a device…", the binding editor with the record and the control fixed.
 */
export type EntityControlsDrawerProps = {
  open: boolean;
  onClose: () => void;
  kind: string;
  entityId: string;
  /** The record's name (the confirmation names it). */
  recordName?: string | null;
  canManageBindings?: boolean;
  messages?: IotMessagesInput;
  locale?: string;
};

type Press = { control: string; key: string };

const sinkLabel = (sink: string, m: IotMessages) => (sink === 'iot_rpc' ? m.controls.sinkDeviceCommands : sink);

export function EntityControlsDrawer({ open, onClose, kind, entityId, recordName, canManageBindings = false, messages, locale }: EntityControlsDrawerProps) {
  const api = useIotAdapter().entityControls;
  const { m } = useIotText(messages, locale);
  const uid = useId();
  const [view, setView] = useState<EntityControlsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState<{ control: EntityControl; raw: Record<string, string | boolean>; problems: Record<string, string> } | null>(null);
  const [result, setResult] = useState<{ control: EntityControl; res: ControlSendResult } | null>(null);
  const [sendError, setSendError] = useState<{ control: string; text: string } | null>(null);
  const [binding, setBinding] = useState<EntityControl | null>(null);
  const press = useRef<Press | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.describe(kind, entityId, ctrl.signal).then((v) => { setView(v); setLoadError(null); }, (e: unknown) => {
      if (!ctrl.signal.aborted) setLoadError(errorMessage(e, m.controls.loadFailed));
    });
    return () => ctrl.abort();
  }, [open, api, kind, entityId, attempt, m]);

  // a closed drawer forgets the press, the answer and the values
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) { setAsking(null); setResult(null); setSendError(null); press.current = null; }
  }

  const keyFor = (control: string): string => {
    if (press.current?.control !== control) press.current = { control, key: newPressKey() };
    return press.current.key;
  };

  const doSend = async (c: EntityControl, params: Record<string, unknown>, confirmText?: string) => {
    if (!api) return;
    const key = keyFor(c.name);
    const res = await api.send(kind, entityId, c.name, {
      ...(Object.keys(params).length ? { params } : {}), ...(c.confirmation !== 'none' ? { confirmed: true } : {}), ...(confirmText ? { confirmText } : {}),
    }, key);
    // the host answered: the next press is a new one
    press.current = null;
    setResult({ control: c, res });
    setSendError(null);
    setAsking(null);
  };

  const start = async (c: EntityControl, params: Record<string, unknown>) => {
    if (sending.current) return;
    sending.current = true;
    setSendError(null);
    try {
      if (c.confirmation === 'none') {
        await doSend(c, params);
        return;
      }
      const name = recordName || m.controls.title;
      await confirmDialog({
        title: fill(m.controls.confirmTitle, { control: c.label, name }),
        message: fill(m.controls.confirmMessage, { control: c.label }),
        tone: c.tier === 'critical' ? 'danger' : 'warning',
        confirmLabel: c.label,
        cancelLabel: m.controls.cancel,
        ...(c.confirmation === 'typed' && c.confirmText ? { phrase: c.confirmText, phraseLabel: fill(m.controls.typedLabel, { phrase: c.confirmText }) } : {}),
        // the dialog lets Send through only once the phrase is typed exactly, so the phrase is what was typed
        action: () => doSend(c, params, c.confirmation === 'typed' ? c.confirmText : undefined),
        errorMessage: (e) => errorMessage(e, m.controls.sendFailed),
      });
    } catch (e) {
      // the press stays: a retry sends the same key, so an answer lost on the way is never a second command (a refusal sent nothing)
      setSendError({ control: c.name, text: errorMessage(e, m.controls.sendFailed) });
    } finally {
      sending.current = false;
    }
  };

  const onSendClick = (c: EntityControl) => {
    setResult(null);
    if (Object.keys(c.params ?? {}).length) {
      setAsking({ control: c, raw: Object.fromEntries(Object.entries(c.params).map(([k, p]) => [k, p.type === 'boolean' ? false : ''])), problems: {} });
      return;
    }
    void start(c, {});
  };

  const submitParams = () => {
    if (!asking) return;
    const { params, problems } = controlParams(asking.control, asking.raw, m);
    if (Object.keys(problems).length) { setAsking({ ...asking, problems }); return; }
    void start(asking.control, params);
  };

  if (!api) return null;
  return (
    <>
      <Drawer open={open} onClose={onClose} title={m.controls.title} closeLabel={m.common.close} className="max-w-xl">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{m.controls.intro}</p>
          {loadError && (
            <div role="alert" className="flex items-center gap-3 text-sm text-error-fg">
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>{m.common.retry}</Button>
            </div>
          )}
          {!view && !loadError && <p className="text-sm text-text-secondary">{m.common.loading}</p>}
          {view && !view.controls.length && <p className="text-sm text-text-secondary">{m.controls.empty}</p>}
          {view && view.controls.length > 0 && !view.permitted && <p className="text-sm text-text-secondary">{m.controls.notPermitted}</p>}
          {view && view.failedSinks.length > 0 && (
            <p role="status" className="text-sm text-warning-fg">{view.failedSinks.map((s) => fill(m.controls.sinkFailed, { sink: sinkLabel(s, m) })).join(' · ')}</p>
          )}
          <ul className="divide-y divide-border-default">
            {view?.controls.map((c) => {
              const bound = boundOf(view, c.name);
              return (
                <li key={c.name} className="space-y-2 py-3" data-control={c.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        {c.label}
                        <Badge variant={tierVariant(c.tier)} size="sm">{tierText(c.tier, m)}</Badge>
                      </p>
                      {c.description && <p className="text-xs text-text-secondary">{c.description}</p>}
                      <p className="text-xs text-text-secondary">{boundText(view, c.name, m)}</p>
                    </div>
                    <div className="flex gap-2">
                      {canManageBindings && <Button variant="outline" size="sm" onClick={() => setBinding(c)}>{m.controls.bindDevice}</Button>}
                      <Button variant="primary" size="sm" disabled={!view.permitted || bound.count === 0} onClick={() => onSendClick(c)}
                        aria-label={`${m.controls.send}: ${c.label}`}>
                        {m.controls.send}
                      </Button>
                    </div>
                  </div>
                  {asking?.control.name === c.name && (
                    <form noValidate className="space-y-2 rounded-md border border-border-default p-3" onSubmit={(e) => { e.preventDefault(); submitParams(); }}>
                      <p className="text-sm font-medium">{fill(m.controls.paramsTitle, { control: c.label })}</p>
                      {Object.entries(c.params).map(([k, p]) => {
                        const id = `${uid}-${c.name}-${k}`;
                        const err = asking.problems[k];
                        const setRaw = (v: string | boolean) => setAsking({ ...asking, raw: { ...asking.raw, [k]: v }, problems: { ...asking.problems, [k]: '' } });
                        if (p.type === 'boolean') return <Checkbox key={k} id={id} label={p.label} checked={asking.raw[k] === true} onChange={(e) => setRaw(e.target.checked)} />;
                        if (p.type === 'select') {
                          return <Select key={k} id={id} label={p.label} required={p.required} error={err || undefined} value={String(asking.raw[k] ?? '')}
                            placeholder={p.label} options={p.options.map((o) => ({ value: o.value, label: o.label }))} onChange={(e) => setRaw(e.target.value)} />;
                        }
                        return <Input key={k} id={id} label={'unit' in p && p.unit ? `${p.label} (${p.unit})` : p.label} required={p.required} error={err || undefined}
                          inputMode={p.type === 'text' ? undefined : 'decimal'} value={String(asking.raw[k] ?? '')} onChange={(e) => setRaw(e.target.value)} />;
                      })}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => setAsking(null)}>{m.controls.cancel}</Button>
                        <Button variant="primary" size="sm" type="submit">{m.controls.send}</Button>
                      </div>
                    </form>
                  )}
                  {sendError?.control === c.name && <p role="alert" className="text-sm text-error-fg">{sendError.text}</p>}
                  {result?.control.name === c.name && <ControlResult res={result.res} m={m} />}
                </li>
              );
            })}
          </ul>
        </div>
      </Drawer>
      <CommandBindingEditorDrawer
        open={!!binding}
        binding={null}
        fixed={{ targetKind: kind, targetEntityId: entityId, targetLabel: recordName ?? null, control: binding?.name ?? '' }}
        canManage={canManageBindings}
        onClose={() => setBinding(null)}
        onSaved={() => { setBinding(null); setAttempt((n) => n + 1); }}
        messages={messages}
        locale={locale}
      />
    </>
  );
}

function ControlResult({ res, m }: { res: ControlSendResult; m: IotMessages }) {
  return (
    <div role="status" className="space-y-1 rounded-md bg-surface-overlay p-3 text-sm">
      <p className="font-medium">{m.controls.result}</p>
      {res.outcome === 'nothing_bound'
        ? <p>{m.controls.notConnected}</p>
        : (
          <ul className="space-y-1">
            {res.targets.map((t) => (
              <li key={`${t.sink}-${t.targetId}`} className="flex flex-wrap items-center gap-2">
                <Badge variant={t.outcome === 'failed' ? 'error' : t.outcome === 'sent' ? 'success' : 'info'} size="sm">
                  {(m.controls as Record<string, string>)[`outcome_${t.outcome}`] ?? t.outcome}
                </Badge>
                <span>{t.label}</span>
                {t.outcome === 'failed' && (t.message || t.reason) && <span className="text-text-secondary">— {t.message || t.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      {res.failedSinks.map((s) => <p key={s} className="text-warning-fg">{fill(m.controls.sinkFailed, { sink: sinkLabel(s, m) })}</p>)}
    </div>
  );
}
