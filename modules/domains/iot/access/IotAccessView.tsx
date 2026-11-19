'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserShield } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { EmptyState } from '@/modules/ui/EmptyState';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { IotAccessSubject } from '../types/access';
import { AccessSubjectPicker } from './AccessSubjectPicker';
import { SubjectAccessPanel } from './SubjectAccessPanel';

/**
 * IotAccessView — the IoT access page (restricted IoT access): a member or group picker on top (`access.searchSubjects`), then the
 * chosen one's `SubjectAccessPanel` (for a member, what they see now; their grants; with `canManageAccess`, add and remove). Before a
 * pick, an empty state says what the page is for. The pick is the view's own state; a host that keeps it in its URL passes
 * `subject` / `onSubjectChange` (controlled) or `defaultSubject`. Draws nothing without `adapter.access`.
 */
export type IotAccessViewProps = {
  /** Controlled: the member or group shown. */
  subject?: IotAccessSubject | null;
  /** Uncontrolled: the member or group shown first. */
  defaultSubject?: IotAccessSubject | null;
  onSubjectChange?: (subject: IotAccessSubject | null) => void;
  messages?: IotMessagesInput;
  className?: string;
};

export function IotAccessView({ subject: controlled, defaultSubject = null, onSubjectChange, messages, className }: IotAccessViewProps) {
  const api = useIotAdapter().access;
  const { m } = useIotText(messages);
  const [own, setOwn] = useState<IotAccessSubject | null>(defaultSubject);
  const subject = controlled !== undefined ? controlled : own;

  if (!api) return null;

  function pick(next: IotAccessSubject | null) {
    if (controlled === undefined) setOwn(next);
    onSubjectChange?.(next);
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="iot-access-view">
      <AccessSubjectPicker value={subject} onChange={pick} className="max-w-md" messages={messages} />
      {subject ? (
        <SubjectAccessPanel key={`${subject.type}:${subject.id}`} subject={subject} messages={messages} />
      ) : (
        <EmptyState
          icon={<FontAwesomeIcon icon={faUserShield} aria-hidden="true" />}
          title={m.access.viewEmptyTitle}
          description={m.access.viewEmpty}
        />
      )}
    </div>
  );
}
