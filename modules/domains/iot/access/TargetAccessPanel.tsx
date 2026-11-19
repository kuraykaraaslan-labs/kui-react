'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Modal } from '@/modules/ui/Modal';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { errorMessage } from '../api/adapter';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import type { IotAccessSubject, IotAccessTargetType } from '../types/access';
import { AccessGrantTable } from './AccessGrantTable';
import { AccessSubjectPicker } from './AccessSubjectPicker';
import { useAccessGrants } from './useAccessGrants';

/**
 * TargetAccessPanel — "Who can see this" for one site or asset (`targetType="ASSET"`) or one device (restricted IoT access): the
 * members and groups given it, one DataTable page at a time (`access.listGrants` narrowed to the target), each with a Member / Group
 * badge and when it was given. A Callout says who sees it anyway (members whose role sees every site and device, the Full IoT view
 * group) and, for an asset, that access includes everything below it. With `canManageAccess`: "Give access" (a dialog with the
 * member or group picker, then `access.createGrant`) and Remove on each row (asks first). Without it the list is read-only. Draws
 * nothing without `adapter.access`.
 */
export type TargetAccessPanelProps = {
  targetType: IotAccessTargetType;
  targetId: string;
  /** The site's, asset's or device's name, for the texts. */
  targetName: string;
  /** Any change of the grants (given or removed), for a host that shows counts elsewhere. */
  onChanged?: () => void;
  messages?: IotMessagesInput;
  className?: string;
};

export function TargetAccessPanel({ targetType, targetId, targetName, onChanged, messages, className }: TargetAccessPanelProps) {
  const api = useIotAdapter().access;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText(messages);
  const a = m.access;
  const grants = useAccessGrants(api, { targetType, targetId }, a.loadError);
  const [giving, setGiving] = useState(false);
  const [subject, setSubject] = useState<IotAccessSubject | null>(null);
  const [busy, setBusy] = useState(false);
  const [giveError, setGiveError] = useState<string | null>(null);

  if (!api) return null;
  const canManage = caps.canManageAccess;

  function openGive() {
    setSubject(null);
    setGiveError(null);
    setGiving(true);
  }

  async function give() {
    if (!api || !subject) return;
    setBusy(true);
    setGiveError(null);
    try {
      await api.createGrant({ subjectType: subject.type, subjectId: subject.id, targetType, targetId });
      notify({ tone: 'success', message: a.given });
      setGiving(false);
      void grants.load();
      onChanged?.();
    } catch (e) {
      setGiveError(errorMessage(e, a.giveFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn('space-y-3', className)} aria-label={a.targetTitle} data-testid="iot-target-access">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{a.targetTitle}</h3>
        {canManage && (
          <Button variant="primary" size="sm" onClick={openGive}
            iconLeft={<FontAwesomeIcon icon={faUserPlus} className="h-3 w-3" aria-hidden="true" />}>
            {a.give}
          </Button>
        )}
      </div>

      <Callout variant="info" title={a.anywayTitle} className="my-0">
        <p>{a.anywayBody}</p>
        <p className="mt-1">{targetType === 'ASSET' ? a.assetBelow : a.deviceAbove}</p>
      </Callout>

      <AccessGrantTable
        by="target"
        rows={grants.rows}
        total={grants.total}
        paging={grants.paging}
        error={grants.error}
        onRetry={() => void grants.load()}
        onQueryChange={grants.onQueryChange}
        canManage={canManage}
        onRemoved={() => { grants.removedOne(); onChanged?.(); }}
        caption={fill(a.targetCaption, { name: targetName })}
        emptyMessage={a.targetEmpty}
        names={{ target: targetName }}
        messages={messages}
      />

      {canManage && (
        <Modal
          open={giving}
          onClose={() => setGiving(false)}
          title={fill(a.giveTitle, { name: targetName })}
          description={fill(targetType === 'ASSET' ? a.giveAssetHint : a.giveDeviceHint, { name: targetName })}
          closeLabel={m.common.close}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setGiving(false)}>{m.common.cancel}</Button>
              <Button variant="primary" size="sm" loading={busy} disabled={!subject} onClick={() => void give()}>{a.give}</Button>
            </div>
          )}
        >
          <div className="space-y-2">
            {giveError && <p role="alert" className="text-sm text-error">{giveError}</p>}
            <AccessSubjectPicker value={subject} onChange={setSubject} messages={messages} />
          </div>
        </Modal>
      )}
    </section>
  );
}
