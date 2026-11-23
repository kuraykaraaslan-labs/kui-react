'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faFlag } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { InlineAlert } from '@/modules/app/InlineAlert';
import { Modal } from '@/modules/ui/Modal';
import { RadioGroup } from '@/modules/ui/RadioGroup';
import { Textarea } from '@/modules/ui/Textarea';
import { MODERATION_REPORT_NOTE_MAX, ModerationReportReasonEnum, type ModerationReportInput, type ModerationReportReason } from '../types';
import { DEFAULT_FORUM_MODERATION_MESSAGES, fillModeration, type ForumModerationMessages } from './messages';

type ReportPostDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Sends the report; a rejected promise keeps the dialog open with an error. */
  onSubmit: (input: ModerationReportInput) => void | Promise<void>;
  /** Any subset of the words. */
  messages?: Partial<ForumModerationMessages>;
  className?: string;
};

/**
 * The member's Report dialog: a reason (spam, abuse or harassment, off-topic, personal data, something else) and an
 * optional note for the moderators (up to MODERATION_REPORT_NOTE_MAX characters). After sending it says
 * "Reported, thank you" until it is closed. The author is never told who reported.
 */
export function ReportPostDialog({ open, onClose, onSubmit, messages, className }: ReportPostDialogProps) {
  const m = useMemo(() => ({ ...DEFAULT_FORUM_MODERATION_MESSAGES, ...messages }), [messages]);
  const uid = useId();
  const [reason, setReason] = useState<ModerationReportReason | ''>('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const [error, setError] = useState('');

  const close = () => {
    if (phase === 'sending') return;
    onClose();
    // The next opening starts empty; a finished report stays finished for the button.
    setReason('');
    setNote('');
    setError('');
    if (phase === 'done') setPhase('form');
  };

  const send = async () => {
    if (!reason || phase !== 'form') return;
    setPhase('sending');
    setError('');
    try {
      await onSubmit({ reason, note: note.trim().slice(0, MODERATION_REPORT_NOTE_MAX) });
      setPhase('done');
    } catch {
      setError(m.sendFailed);
      setPhase('form');
    }
  };

  const options = ModerationReportReasonEnum.options.map((r) => ({
    value: r,
    label: m[`reason_${r}`],
    hint: m[`hint_${r}`],
  }));

  const done = phase === 'done';
  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? m.thanksTitle : m.reportPost}
      description={done ? undefined : m.reportIntro}
      closeLabel={m.close}
      size="md"
      scrollable
      className={cn('max-h-[calc(100dvh-2rem)]', className)}
      footer={
        done ? (
          <Button onClick={close}>{m.close}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={phase === 'sending'}>{m.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => void send()}
              disabled={!reason || phase === 'sending'}
              loading={phase === 'sending'}
              iconLeft={<FontAwesomeIcon icon={faFlag} className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {phase === 'sending' ? m.sending : m.send}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex items-start gap-3" role="status">
          <FontAwesomeIcon icon={faCircleCheck} className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm text-text-primary">{m.thanksText}</p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <RadioGroup
            name={`${uid}-reason`}
            legend={m.reasonLegend}
            options={options}
            value={reason}
            onChange={(v) => setReason(v as ModerationReportReason)}
            variant="card"
            disabled={phase === 'sending'}
          />
          <Textarea
            id={`${uid}-note`}
            label={m.noteLabel}
            rows={3}
            maxLength={MODERATION_REPORT_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint={fillModeration(m.noteCount, { count: note.length, max: MODERATION_REPORT_NOTE_MAX })}
            disabled={phase === 'sending'}
          />
          {error && <InlineAlert variant="error" message={error} />}
        </form>
      )}
    </Modal>
  );
}

type ReportPostButtonProps = {
  /** The member already reported this post (from the host): the button says so and does nothing. */
  reported?: boolean;
  onReport: (input: ModerationReportInput) => void | Promise<void>;
  messages?: Partial<ForumModerationMessages>;
  size?: 'xs' | 'sm';
  className?: string;
};

/**
 * "Report" under a post, for signed-in members on other people's posts (the host decides where it shows). Opens
 * ReportPostDialog; once sent, or when `reported`, it reads "Reported" and is inert.
 */
export function ReportPostButton({ reported = false, onReport, messages, size = 'xs', className }: ReportPostButtonProps) {
  const m = useMemo(() => ({ ...DEFAULT_FORUM_MODERATION_MESSAGES, ...messages }), [messages]);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const doneRef = useRef<HTMLSpanElement>(null);
  const done = reported || sent;

  // The Report button is gone once the dialog closes after sending: keep keyboard focus here, not on the page.
  useEffect(() => {
    if (sent && !open) doneRef.current?.focus();
  }, [sent, open]);

  if (done && !open) {
    return (
      <span
        ref={doneRef}
        tabIndex={-1}
        className={cn('inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-text-secondary', className)}
        title={m.reportedAlready}
      >
        <FontAwesomeIcon icon={faCircleCheck} className="h-3 w-3 text-success" aria-hidden="true" />
        {m.reported}
        <span className="sr-only">: {m.reportedAlready}</span>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className={cn('text-text-secondary', className)}
        iconLeft={<FontAwesomeIcon icon={faFlag} className="h-3 w-3" aria-hidden="true" />}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {m.report}
      </Button>
      <ReportPostDialog
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        onSubmit={async (input) => {
          await onReport(input);
          setSent(true);
        }}
      />
    </>
  );
}
