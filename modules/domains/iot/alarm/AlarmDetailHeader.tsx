'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen, faCheck, faChevronDown, faClock, faHashtag, faMicrochip, faTowerBroadcast, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { DropdownMenu, type DropdownItem } from '@/modules/ui/DropdownMenu';
import { Modal } from '@/modules/ui/Modal';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage } from '../api/adapter';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, formatRelative, plural, type TimeInput } from '../format';
import type { AlarmSeverity, AlarmStatus } from '../types/alarm';
import type { IotMessagesInput } from '../messages';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { AlarmStatusPill } from './AlarmStatusPill';

/**
 * AlarmDetailHeader — an alarm page's header (phase 03 §3.1): severity and status, title and message, device link, opened
 * time, occurrences, flapping and the triggering topic, and the actions. `onAcknowledge(note?)` / `onClear(note?)` may return
 * a promise: the buttons show a pending state, every action is disabled while one runs, and the result is announced. "…with a
 * note" opens a note dialog first. Acknowledge shows only while OPEN, Clear unless RESOLVED, each only with its handler (pass
 * none for a viewer without the capability). Renamed under OD-9 (the old name is a deprecated alias in `index.ts`); `onResolve` is its old name for
 * `onClear`.
 *
 * Clear asks first, naming the alarm and saying that a rule whose condition still holds will not open it again until the condition has
 * been false once (the note dialog says the same). A handler may answer the words to announce (what the host did, e.g. "Nothing changed:
 * the alarm was already acknowledged"); a failure is announced with the host's words or the action's own (NB 41-ui-fixes/24 1.3, 1.7).
 * `onNavigate` opens the device in the host's router on a plain click.
 */
export type AlarmDetailHeaderProps = {
  title: string;
  message?: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  deviceName?: string | null;
  deviceHref?: string;
  openedAt: TimeInput;
  occurrences?: number;
  flapping?: boolean;
  /** Opened from late readings (after an outage): a neutral mark beside the status. */
  backfilled?: boolean;
  type?: string;
  topic?: string | null;
  /** May answer the words to announce (what the host did); without them the action's own success words. */
  onAcknowledge?: (note?: string) => Promise<void | string> | void;
  onClear?: (note?: string) => Promise<void | string> | void;
  /** @deprecated the pre-OD-9 name of `onClear`. */
  onResolve?: (note?: string) => Promise<void | string> | void;
  onOpenRunbook?: () => void;
  /** Opens a link (the device) in the host's router on a plain click; without it the link navigates as a link. */
  onNavigate?: (href: string) => void;
  timeZone?: string;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

type Action = 'acknowledge' | 'clear';

export function AlarmDetailHeader({
  title, message, severity, status, deviceName, deviceHref, openedAt, occurrences, flapping, backfilled, type, topic,
  onAcknowledge, onClear, onResolve, onOpenRunbook, onNavigate, timeZone, locale, now, messages, className,
}: AlarmDetailHeaderProps) {
  const { m, locale: lang, timeZone: hostZone } = useIotText(messages, locale);
  const clearFn = onClear ?? onResolve;
  const [pending, setPending] = useState<Action | null>(null);
  const [noteFor, setNoteFor] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [announce, setAnnounce] = useState('');

  const canAck = !!onAcknowledge && status === 'OPEN';
  const canClear = !!clearFn && status !== 'RESOLVED';

  async function run(action: Action, text?: string) {
    const fn = action === 'acknowledge' ? onAcknowledge : clearFn;
    if (!fn) return;
    setPending(action);
    setAnnounce('');
    try {
      const said = await fn(text && text.trim() ? text.trim() : undefined);
      setAnnounce(typeof said === 'string' && said ? said : action === 'acknowledge' ? m.alarm.acknowledged : m.alarm.cleared);
    } catch (e) {
      setAnnounce(fill(m.alarm.failed, { message: errorMessage(e, action === 'acknowledge' ? m.alarm.acknowledgeFailed : m.alarm.clearFailed) }));
    } finally {
      setPending(null);
    }
  }

  function openNote(action: Action) {
    setNote('');
    setNoteFor(action);
  }

  /** Clear asks first: it names the alarm and says the rule will not open it again while its condition holds. */
  function askClear() {
    void confirmDialog({
      title: fill(m.alarm.clearConfirm, { title }),
      message: m.alarm.clearHint,
      tone: 'warning',
      confirmLabel: m.alarm.clear,
      cancelLabel: m.common.cancel,
      closeLabel: m.common.close,
    }).then((ok) => { if (ok) void run('clear'); });
  }

  async function submitNote() {
    const action = noteFor;
    setNoteFor(null);
    if (action) await run(action, note);
  }

  const menu: DropdownItem[] = [
    ...(canAck ? [{ id: 'ack-note', label: m.alarm.acknowledgeWithNote, onClick: () => openNote('acknowledge') }] : []),
    ...(canClear ? [{ id: 'clear-note', label: m.alarm.clearWithNote, onClick: () => openNote('clear') }] : []),
  ];

  return (
    <section
      className={cn('rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5', className)}
      aria-label={fill(m.alarm.ariaLabel, { title })}
      aria-busy={pending !== null || undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AlarmSeverityBadge severity={severity} />
        <AlarmStatusPill status={status} />
        {flapping && <Badge variant="warning" size="sm">{m.alarm.flapping}</Badge>}
        {backfilled && <Badge variant="neutral" size="sm">{m.alarm.backfilled}</Badge>}
      </div>

      <h1 className="mt-3 break-words text-xl font-bold leading-snug text-text-primary">{title}</h1>
      {message && <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{message}</p>}

      <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-text-secondary">
        {deviceName && (
          <div className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faMicrochip} className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">{m.alarm.device}</dt>
            <dd>
              {deviceHref ? (
                <a href={deviceHref} onClick={onNavigate ? (e) => { if (plainClick(e)) { e.preventDefault(); onNavigate(deviceHref); } } : undefined}
                  className="rounded font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  {deviceName}
                </a>
              ) : <span className="font-medium text-text-primary">{deviceName}</span>}
            </dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">{m.alarms.opened}</dt>
          <dd title={formatDateTime(openedAt, { locale: lang, timeZone: timeZone ?? hostZone })}>{fill(m.alarm.opened, { time: formatRelative(openedAt, { locale: lang, now }) })}</dd>
        </div>
        {occurrences !== undefined && occurrences > 1 && (
          <div className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faHashtag} className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>{plural(occurrences, { one: m.alarm.occurrences_one, other: m.alarm.occurrences }, lang)}</dd>
          </div>
        )}
        {type && (
          <div className="flex items-center gap-1.5">
            <dt>{m.alarm.type}:</dt>
            <dd><code className="font-mono">{type}</code></dd>
          </div>
        )}
        {topic && (
          <div className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faTowerBroadcast} className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">{m.alarm.topic}</dt>
            <dd><code className="font-mono">{topic}</code></dd>
          </div>
        )}
      </dl>

      {(canAck || canClear || onOpenRunbook) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canAck && (
            <Button
              variant="outline"
              size="sm"
              loading={pending === 'acknowledge'}
              disabled={pending !== null}
              onClick={() => void run('acknowledge')}
              iconLeft={<FontAwesomeIcon icon={faCheck} className="h-3 w-3" aria-hidden="true" />}
            >
              {m.alarm.acknowledge}
            </Button>
          )}
          {canClear && (
            <Button
              variant="primary"
              size="sm"
              loading={pending === 'clear'}
              disabled={pending !== null}
              onClick={askClear}
              iconLeft={<FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />}
            >
              {m.alarm.clear}
            </Button>
          )}
          {menu.length > 0 && (
            <DropdownMenu
              items={menu}
              trigger={(
                <Button variant="ghost" size="sm" disabled={pending !== null} aria-label={m.alarm.moreActions}
                  iconRight={<FontAwesomeIcon icon={faChevronDown} className="h-3 w-3" aria-hidden="true" />}>
                  {m.alarm.withNote}
                </Button>
              )}
            />
          )}
          {onOpenRunbook && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenRunbook}
              iconLeft={<FontAwesomeIcon icon={faBookOpen} className="h-3 w-3" aria-hidden="true" />}
            >
              {m.alarm.runbook}
            </Button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">{pending ? m.alarm.working : announce}</p>

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={m.alarm.noteTitle}
        closeLabel={m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNoteFor(null)}>{m.common.cancel}</Button>
            <Button variant="primary" size="sm" onClick={() => void submitNote()}>
              {noteFor === 'clear' ? m.alarm.clear : m.alarm.acknowledge}
            </Button>
          </div>
        )}
      >
        {noteFor === 'clear' && <p className="mb-3 text-sm text-text-secondary">{m.alarm.clearHint}</p>}
        <Textarea id="alarm-action-note" label={m.alarm.noteLabel} rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </section>
  );
}

/** A plain left click (no modifier): the host's router opens the link; any other click keeps the link's own behaviour. */
function plainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
