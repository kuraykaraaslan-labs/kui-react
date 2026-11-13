'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCircleCheck, faClock, faPaperPlane, faRotateRight, faTruck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Timeline, type TimelineItem } from '@/modules/ui/Timeline';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, toDate } from '../format';
import { RPC_OPEN_STATUSES, type RpcRequest } from '../types/rpc';
import type { IotMessages, IotMessagesInput } from '../messages';
import { RpcStatusBadge } from './RpcStatusBadge';

/**
 * RpcRequestDetail — one request in a `Drawer`: status and outcome, the request (params as stored, masked where the catalog says so),
 * the answer or why it did not succeed (in the viewer's words, with what the device said), the progress as a `Timeline` (created, sent,
 * delivered, completed, late answer; to the second, with the zone), "Send again" (pre-fills the send panel) and "Cancel command" for a
 * request that has not reached the device (QUEUED or SENT). The host offers both only to a viewer who may use them; cancelling a SENT
 * request asks first, since the device may already have it (NB 41-ui-fixes/23 1.7).
 *
 * `RpcRequestDetailBody` is the same content without the drawer: the device console shows it inside its History modal (NB 63
 * licensed-devices, the History modal), so a request opened from the history never stacks a drawer over the modal.
 */
export type RpcRequestDetailProps = {
  request: RpcRequest | null;
  open: boolean;
  onClose: () => void;
  onCancel?: (rpcId: string) => Promise<void> | void;
  onRerun?: (request: RpcRequest) => void;
  /** False while the request's full read (its params) has not arrived: "Send again" waits for it (NB 41-ui-fixes/23 C12). */
  rerunReady?: boolean;
  locale?: string;
  messages?: IotMessagesInput;
};

const json = (v: unknown) => JSON.stringify(v, null, 2);

/** Why a request did not succeed, in the viewer's words: its reason's text, else the host's own words. */
export function rpcErrorText(r: Pick<RpcRequest, 'error' | 'errorReason'>, m: Pick<IotMessages, 'rpcError'>): string | null {
  const known = r.errorReason ? (m.rpcError as Record<string, string>)[r.errorReason] : undefined;
  return known ?? r.error ?? null;
}

export function RpcRequestDetail({ request, open, onClose, onCancel, onRerun, rerunReady = true, locale, messages }: RpcRequestDetailProps) {
  const { m } = useIotText(messages, locale);
  return (
    <Drawer open={open} onClose={onClose} title={request ? fill(m.rpc.detail, { method: request.method }) : m.rpc.title} closeLabel={m.common.close}>
      {request && <RpcRequestDetailBody key={request.rpcId} request={request} onCancel={onCancel} onRerun={onRerun} rerunReady={rerunReady} locale={locale} messages={messages} />}
    </Drawer>
  );
}

export type RpcRequestDetailBodyProps = Omit<RpcRequestDetailProps, 'request' | 'open' | 'onClose'> & { request: RpcRequest };

/** One request's status, request, answer, progress and actions, without a frame of its own. */
export function RpcRequestDetailBody({ request, onCancel, onRerun, rerunReady = true, locale, messages }: RpcRequestDetailBodyProps) {
  const { m, locale: lang, timeZone } = useIotText(messages, locale);
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const r = request;
  const steps: TimelineItem[] = [
    { id: 'c', at: toDate(r.createdAt) ?? new Date(0), title: m.rpc.QUEUED, icon: <FontAwesomeIcon icon={faClock} className="h-3 w-3" aria-hidden="true" /> },
    ...(r.sentAt ? [{ id: 's', at: toDate(r.sentAt)!, title: m.rpc.SENT, tone: 'info' as const, icon: <FontAwesomeIcon icon={faPaperPlane} className="h-3 w-3" aria-hidden="true" /> }] : []),
    ...(r.deliveredAt ? [{ id: 'd', at: toDate(r.deliveredAt)!, title: m.rpc.DELIVERED, tone: 'info' as const, icon: <FontAwesomeIcon icon={faTruck} className="h-3 w-3" aria-hidden="true" /> }] : []),
    ...(r.completedAt ? [{
      id: 'e', at: toDate(r.completedAt)!, title: m.rpc[r.status] ?? r.status,
      tone: r.status === 'SUCCESSFUL' ? 'success' as const : r.status === 'FAILED' ? 'error' as const : 'warning' as const,
      icon: <FontAwesomeIcon icon={r.status === 'SUCCESSFUL' ? faCircleCheck : r.status === 'CANCELLED' ? faBan : faXmark} className="h-3 w-3" aria-hidden="true" />,
    }] : []),
    ...(r.lateResponseAt ? [{ id: 'l', at: toDate(r.lateResponseAt)!, title: m.rpc.late, tone: 'warning' as const }] : []),
  ];
  const cancellable = (r.status === 'QUEUED' || r.status === 'SENT') && RPC_OPEN_STATUSES.includes(r.status);
  const errorText = rpcErrorText(r, m);

  async function cancel(rpcId: string) {
    setCancelling(true);
    try {
      await onCancel?.(rpcId);
    } finally {
      setCancelling(false);
      setAsking(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <RpcStatusBadge status={r.status} outcome={r.outcome} size="md" />
        {r.outcome && <span className="text-xs text-text-secondary">{m.rpc[r.outcome]}</span>}
      </div>
      <section aria-label={m.rpc.request}>
        <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{m.rpc.request}</h3>
        <pre className="max-h-48 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs">{json({ method: r.method, params: r.params ?? {} })}</pre>
        {r.payload !== undefined && r.payload !== null && (
          <>
            <h4 className="mb-1 mt-2 text-xs font-medium text-text-secondary">{m.rpc.payloadSent}</h4>
            <pre className="max-h-48 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs">{json(r.payload)}</pre>
          </>
        )}
      </section>
      <section aria-label={errorText ? m.rpc.error : m.rpc.response}>
        <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{errorText ? m.rpc.error : m.rpc.response}</h3>
        {errorText ? (
          <div className="space-y-1 rounded-md bg-error-subtle p-2 text-error-fg">
            <p>{errorText}</p>
            {r.errorDetail && <p className="text-xs">{fill(m.rpc.deviceSaid, { detail: r.errorDetail })}</p>}
          </div>
        ) : r.response !== undefined && r.response !== null ? <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs">{json(r.response)}</pre>
          : <p className="text-text-secondary">{m.rpc.noResponse}</p>}
      </section>
      <section aria-label={m.rpc.timeline}>
        <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{m.rpc.timeline}</h3>
        <Timeline items={steps} groupByDay={false} locale={lang} timeZone={timeZone} timePrecision="seconds" showTimeZone />
      </section>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        {onRerun && <Button variant="outline" size="sm" disabled={!rerunReady} onClick={() => onRerun(r)} iconLeft={<FontAwesomeIcon icon={faRotateRight} className="h-3 w-3" aria-hidden="true" />}>{m.rpc.rerun}</Button>}
        {onCancel && cancellable && (
          <Button variant="danger" size="sm" loading={cancelling} disabled={cancelling}
            onClick={() => (r.status === 'SENT' ? setAsking(true) : void cancel(r.rpcId))}
            iconLeft={<FontAwesomeIcon icon={faBan} className="h-3 w-3" aria-hidden="true" />}>
            {cancelling ? m.rpc.cancelling : m.rpc.cancel}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={asking}
        title={fill(m.rpc.cancelSentTitle, { method: r.method })}
        message={m.rpc.cancelSentHint}
        tone="warning"
        confirmLabel={m.rpc.cancel}
        cancelLabel={m.common.close}
        closeLabel={m.common.close}
        busy={cancelling}
        onCancel={() => setAsking(false)}
        onConfirm={() => void cancel(r.rpcId)}
      />
    </div>
  );
}
