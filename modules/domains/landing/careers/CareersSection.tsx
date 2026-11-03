'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faBriefcase } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type CareerRole = { title: string; team?: string; location?: string; type?: string; description?: string; href?: string };

type CareersSectionProps = {
  title?: string;
  subtitle?: string;
  roles: CareerRole[];
  /** The open application link, shown under the list (also with no openings). */
  generalHref?: string;
  labels?: Partial<{ apply: string; general: string; all: string; none: string; filter: string }>;
  className?: string;
};

/**
 * A website's open positions: each with its team, place, contract, a line and an apply link; chips filter by team
 * when there are several, and an open application stays offered with no openings. The record-shaped JobCard (jobs
 * domain) stays for job boards. Mirrors next-boilerplate's dynamic_page Careers block.
 */
export function CareersSection({ title, subtitle, roles, generalHref, labels, className }: CareersSectionProps) {
  const list = roles.filter((r) => r.title?.trim());
  const teams = [...new Set(list.map((r) => r.team).filter((x): x is string => Boolean(x)))];
  const [team, setTeam] = useState<string | null>(null);
  const shown = team ? list.filter((r) => r.team === team) : list;
  const chip = (label: string, value: string | null) => (
    <button key={label} type="button" aria-pressed={team === value} onClick={() => setTeam(value)}
      className={cn('rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        team === value ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-raised hover:border-primary')}>
      {label}
    </button>
  );
  return (
    <section className={cn('w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      {teams.length > 1 && (
        <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label={labels?.filter ?? 'Filter by team'}>
          {chip(labels?.all ?? 'All teams', null)}
          {teams.map((x) => chip(x, x))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-center text-text-secondary">{labels?.none ?? 'No open positions right now.'}</p>
      ) : (
        <ul className="mx-auto flex max-w-4xl flex-col gap-3">
          {shown.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-raised p-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                  {r.team && <span>{r.team}</span>}
                  {r.location && <span className="inline-flex items-center gap-1.5"><FontAwesomeIcon icon={faLocationDot} className="h-3 w-3" aria-hidden="true" />{r.location}</span>}
                  {r.type && <span className="inline-flex items-center gap-1.5"><FontAwesomeIcon icon={faBriefcase} className="h-3 w-3" aria-hidden="true" />{r.type}</span>}
                </p>
                {r.description && <p className="mt-2 text-sm text-text-secondary">{r.description}</p>}
              </div>
              {r.href && (
                <a href={r.href} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  {labels?.apply ?? 'Apply'}<span className="sr-only">: {r.title}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {generalHref && <p className="mt-8 text-center"><a href={generalHref} className="font-semibold text-primary hover:underline">{labels?.general ?? 'Send an open application'}</a></p>}
    </section>
  );
}
