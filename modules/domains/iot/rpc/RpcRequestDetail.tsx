'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCircleCheck, faClock, faPaperPlane, faRotateRight, faTruck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Timeline, type TimelineItem } from '@/modules/ui/Timeline';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, toDate } from '../format';
import { RPC_OPEN_STATUSES, type RpcRequest } from '../types/rpc';
import type { IotMessagesInput } from '../messages';
import { RpcStatusBadge } from './RpcStatusBadge';

/**
 * RpcRequestDetail — one request in a `Drawer`: status and outcome, the request (params as stored, masked where the catalog says so),
 * the answer or the error, the progress as a `Timeline` (created, sent, delivered, completed, late answer), "Send again" (pre-fills
 * the send panel) and "Cancel command" for a request that has not reached the device (QUEUED or SENT).
 */
export type RpcRequestDetailProps = {
  request: RpcRequest | null;
  open: boolean;
  onClose: () => void;
  onCancel?: (rpcId: string) => Promise<void> | void;
  onRerun?: (request: RpcRequest) => void;
  locale?: string;
  messages?: IotMessagesInput;
};

const json = (v: unknown) => JSON.stringify(v, null, 2);

export function RpcRequestDetail({ request, open, onClose, onCancel, onRerun, locale, messages }: RpcRequestDetailProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const r = request;
  const steps: TimelineItem[] = r ? [
    { id: 'c', at: toDate(r.createdAt) ?? new Date(0), title: m.rpc.QUEUED, icon: <FontAwesomeIcon icon={faClock} className="h-3 w-3" aria-hidden="true" /> },
    ...(r.sentAt ? [{ id: 's', at: toDate(r.sentAt)!, title: m.rpc.SENT, tone: 'info' as const, icon: <FontAwesomeIcon icon={faPaperPlane} className="h-3 w-3" aria-hidden="true" /> }] : []),
    ...(r.deliveredAt ? [{ id: 'd', at: toDate(r.deliveredAt)!, title: m.rpc.DELIVERED, tone: 'info' as const, icon: <FontAwesomeIcon icon={faTruck} className="h-3 w-3" aria-hidden="true" /> }] : []),
    ...(r.completedAt ? [{
      id: 'e', at: toDate(r.completedAt)!, title: m.rpc[r.status] ?? r.status,
      tone: r.status === 'SUCCESSFUL' ? 'success' as const : r.status === 'FAILED' ? 'error' as const : 'warning' as const,
      icon: <FontAwesomeIcon icon={r.status === 'SUCCESSFUL' ? faCircleCheck : r.status === 'CANCELLED' ? faBan : faXmark} className="h-3 w-3" aria-hidden="true" />,
    }] : []),
    ...(r.lateResponseAt ? [{ id: 'l', at: toDate(r.lateResponseAt)!, title: m.rpc.late, tone: 'warning' as const }] : []),
  ] : [];
  const cancellable = !!r && (r.status === 'QUEUED' || r.status === 'SENT') && RPC_OPEN_STATUSES.includes(r.status);
  return (
    <Drawer open={open} onClose={onClose} title={r ? fill(m.rpc.detail, { method: r.method }) : m.rpc.title} closeLabel={m.common.close}>
      {r && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <RpcStatusBadge status={r.status} outcome={r.outcome} size="md" />
            {r.outcome && <span className="text-xs text-text-secondary">{m.rpc[r.outcome]}</span>}
          </div>
          <section aria-label={m.rpc.request}>
            <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{m.rpc.request}</h3>
            <pre className="max-h-48 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs">{json({ method: r.method, params: r.params ?? {} })}</pre>
          </section>
          <section aria-label={m.rpc.response}>
            <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{r.error ? m.rpc.error : m.rpc.response}</h3>
            {r.error ? <p className="rounded-md bg-error-subtle p-2 text-error-fg">{r.error}</p>
              : r.response !== undefined && r.response !== null ? <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs">{json(r.response)}</pre>
                : <p className="text-text-secondary">{m.rpc.noResponse}</p>}
          </section>
          <section aria-label={m.rpc.timeline}>
            <h3 className="mb-1 text-xs font-semibold uppercase text-text-secondary">{m.rpc.timeline}</h3>
            <Timeline items={steps} groupByDay={false} locale={lang} />
          </section>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {onRerun && <Button variant="outline" size="sm" onClick={() => onRerun(r)} iconLeft={<FontAwesomeIcon icon={faRotateRight} className="h-3 w-3" aria-hidden="true" />}>{m.rpc.rerun}</Button>}
            {onCancel && cancellable && <Button variant="danger" size="sm" onClick={() => void onCancel(r.rpcId)} iconLeft={<FontAwesomeIcon icon={faBan} className="h-3 w-3" aria-hidden="true" />}>{m.rpc.cancel}</Button>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
