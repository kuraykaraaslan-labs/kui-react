'use client';
import { cn } from '@/libs/utils/cn';
import { Avatar } from '@/modules/ui/Avatar';
import { JobTypeBadge } from './JobTypeBadge';
import { JobWorkModeBadge } from './JobWorkModeBadge';
import { JobExperienceBadge } from './JobExperienceBadge';
import { JobMeta } from './JobMeta';
import type { JobWithData } from '../types';

type JobCardProps = {
  job: JobWithData;
  href?: string;
  onClick?: () => void;
  showBadges?: boolean;
  className?: string;
};

export function JobCard({ job, href, onClick, showBadges = true, className }: JobCardProps) {
  const isInteractive = !!(href || onClick);

  const body = (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar
          src={job.company.logo ?? undefined}
          name={job.company.name}
          size="lg"
          className="rounded-xl flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-secondary truncate">{job.company.name}</p>
          <h3 className="text-base font-semibold text-text-primary line-clamp-2 leading-snug mt-0.5">
            {job.title}
          </h3>
        </div>
      </div>

      {showBadges && (
        <div className="flex flex-wrap gap-1.5">
          <JobTypeBadge type={job.type} size="sm" />
          <JobWorkModeBadge workMode={job.workMode} size="sm" />
          <JobExperienceBadge level={job.experienceLevel} size="sm" />
        </div>
      )}

      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 4 && (
            <span className="inline-block rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]">
              +{job.tags.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="border-t border-border pt-3">
        <JobMeta job={job} />
      </div>
    </div>
  );

  const baseClass = cn(
    'group rounded-xl border border-border bg-surface-raised flex flex-col overflow-hidden',
    isInteractive && 'hover:shadow-md hover:border-border-focus transition-all duration-200',
    className
  );

  if (href) {
    return <a href={href} className={baseClass}>{body}</a>;
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClass, 'text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus')}
      >
        {body}
      </button>
    );
  }
  return <div className={baseClass}>{body}</div>;
}
