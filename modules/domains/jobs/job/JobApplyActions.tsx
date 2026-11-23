'use client';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import type { JobWithData } from '../types';
import { jobApplyLinkName, resolveJobApplyMode } from './jobApply';

type JobApplyActionsProps = {
  job: Pick<JobWithData, 'applyMode' | 'applyLinks'>;
  /** Where "Apply now" goes (the form on the page, e.g. "#apply"). With neither this nor onApply there is no form. */
  applyHref?: string;
  onApply?: () => void;
  /** Texts, for the host's language. */
  applyLabel?: string;
  platformLabel?: (name: string) => string;
  newTabLabel?: string;
  /** The line under the platform buttons when applications are taken elsewhere only; null hides it. */
  note?: string | null;
  layout?: 'stack' | 'row';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * A job's apply buttons: "Apply now" to the host's form and/or "Apply on <platform>" for each place the job takes
 * applications (opens in a new tab). The first button is primary, the others outlined.
 * Mirrored in kui-wordpress-saas plugin/kui-jobs (the Job facts block).
 */
export function JobApplyActions({
  job,
  applyHref,
  onApply,
  applyLabel = 'Apply now',
  platformLabel = (name) => `Apply on ${name}`,
  newTabLabel = '(opens in a new tab)',
  note = 'Applications for this position are taken on the platform above.',
  layout = 'stack',
  size = 'md',
  className,
}: JobApplyActionsProps) {
  const links = job.applyLinks ?? [];
  const mode = resolveJobApplyMode(job.applyMode, links.length > 0, Boolean(applyHref || onApply));
  if (mode === 'NONE') return null;

  const showForm = mode === 'FORM' || mode === 'BOTH';
  const showLinks = mode === 'LINKS' || mode === 'BOTH';
  const stack = layout === 'stack';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className={cn('flex gap-2', stack ? 'flex-col' : 'flex-wrap')}>
        {showForm && (
          applyHref ? (
            <Button as="a" href={applyHref} variant="primary" size={size} fullWidth={stack}>{applyLabel}</Button>
          ) : (
            <Button variant="primary" size={size} fullWidth={stack} onClick={onApply}>{applyLabel}</Button>
          )
        )}
        {showLinks && links.map((link, i) => (
          <Button
            key={`${link.url}-${i}`}
            as="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            variant={showForm || i > 0 ? 'outline' : 'primary'}
            size={size}
            fullWidth={stack}
            iconRight={<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />}
          >
            {platformLabel(jobApplyLinkName(link))}
            <span className="sr-only"> {newTabLabel}</span>
          </Button>
        ))}
      </div>
      {mode === 'LINKS' && note && <p className="text-xs leading-relaxed text-text-secondary">{note}</p>}
    </div>
  );
}
