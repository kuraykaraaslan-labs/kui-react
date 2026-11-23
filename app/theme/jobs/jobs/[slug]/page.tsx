import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { Button } from '@/modules/ui/Button';
import { Avatar } from '@/modules/ui/Avatar';
import { JobStatusBadge } from '@/modules/domains/jobs/job/JobStatusBadge';
import { JobTypeBadge } from '@/modules/domains/jobs/job/JobTypeBadge';
import { JobWorkModeBadge } from '@/modules/domains/jobs/job/JobWorkModeBadge';
import { JobExperienceBadge } from '@/modules/domains/jobs/job/JobExperienceBadge';
import { JobMeta } from '@/modules/domains/jobs/job/JobMeta';
import { JobCard } from '@/modules/domains/jobs/job/JobCard';
import { JobApplyActions } from '@/modules/domains/jobs/job/JobApplyActions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faBookmark,
  faCircleCheck,
  faShare,
  faCalendarDays,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { JOBS } from '../../jobs.data';

export async function generateStaticParams() {
  return JOBS.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = JOBS.find((j) => j.slug === slug);
  return { title: buildPageTitle(job?.title ?? slug, THEME_TITLES['jobs']) };
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = JOBS.find((j) => j.slug === slug);
  if (!job) notFound();

  const relatedJobs = JOBS
    .filter((j) => j.jobId !== job.jobId && j.categoryId === job.categoryId)
    .slice(0, 3);

  const deadline = job.applicationDeadline
    ? new Date(job.applicationDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-surface-base text-text-primary">
      {/* Sub-header */}
      <div className="border-b border-border bg-surface-raised">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/theme/jobs' },
              { label: 'Jobs', href: '/theme/jobs/jobs' },
              { label: job.title },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-8 items-start">
          {/* ── Main content ── */}
          <article className="flex-1 min-w-0 space-y-8">
            {/* Header */}
            <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-5">
              <div className="flex items-start gap-4">
                <Avatar
                  src={job.company.logo ?? undefined}
                  name={job.company.name}
                  size="xl"
                  className="rounded-xl shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-secondary">{job.company.name}</span>
                    {job.company.verified && (
                      <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-primary" aria-label="Verified" />
                    )}
                    <JobStatusBadge status={job.status} size="sm" />
                  </div>
                  <h1 className="text-2xl font-bold text-text-primary mt-1 leading-tight">{job.title}</h1>
                  <JobMeta job={job} className="mt-2" />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <JobTypeBadge type={job.type} />
                <JobWorkModeBadge workMode={job.workMode} />
                <JobExperienceBadge level={job.experienceLevel} />
              </div>

              {job.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-surface-sunken text-xs text-text-secondary font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1 border-t border-border">
                <JobApplyActions job={job} applyHref="#apply" applyLabel="Apply Now" layout="row" note={null} className="flex-1" />
                <Button variant="outline" size="md" iconOnly aria-label="Save job">
                  <FontAwesomeIcon icon={faBookmark} className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button variant="outline" size="md" iconOnly aria-label="Share job">
                  <FontAwesomeIcon icon={faShare} className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Description */}
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">About the role</h2>
              <p className="text-text-secondary leading-relaxed">{job.description}</p>
            </section>

            {job.responsibilities && (
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">Responsibilities</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{job.responsibilities}</p>
              </section>
            )}

            {job.requirements && (
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">Requirements</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{job.requirements}</p>
              </section>
            )}

            {job.benefits && (
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-3">Benefits & Perks</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{job.benefits}</p>
              </section>
            )}

            {/* Related jobs */}
            {relatedJobs.length > 0 && (
              <section className="pt-4 border-t border-border">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Similar Roles</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedJobs.map((j) => (
                    <JobCard key={j.jobId} job={j} href={`/theme/jobs/jobs/${j.slug}`} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-5 w-72 shrink-0">
            {/* Quick apply card */}
            <div id="apply" className="rounded-xl border border-border bg-surface-raised p-5 space-y-4 scroll-mt-24">
              <h2 className="font-semibold text-text-primary">Quick Apply</h2>
              {job.salaryVisible && job.salaryMin && job.salaryMax && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">Salary Range</p>
                  <p className="text-xl font-bold text-text-primary">
                    ${(job.salaryMin / 1000).toFixed(0)}k–${(job.salaryMax / 1000).toFixed(0)}k
                    <span className="text-sm font-normal text-text-secondary"> /yr</span>
                  </p>
                </div>
              )}
              {deadline && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Deadline: <span className="font-medium text-text-primary">{deadline}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <FontAwesomeIcon icon={faUsers} className="w-4 h-4 shrink-0" aria-hidden="true" />
                {job.applicationsCount} applicants
              </div>
              <JobApplyActions job={job} applyHref="#apply" applyLabel="Apply Now" />
              <Button variant="outline" fullWidth size="sm">Save for Later</Button>
            </div>

            {/* Company card */}
            <div className="rounded-xl border border-border bg-surface-raised p-5 space-y-3">
              <h2 className="font-semibold text-text-primary">About the Company</h2>
              <div className="flex items-center gap-3">
                <Avatar src={job.company.logo ?? undefined} name={job.company.name} size="md" className="rounded-lg" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-text-primary text-sm">{job.company.name}</span>
                    {job.company.verified && (
                      <FontAwesomeIcon icon={faCircleCheck} className="w-3.5 h-3.5 text-primary" aria-label="Verified" />
                    )}
                  </div>
                  {job.location && <p className="text-xs text-text-secondary mt-0.5">{job.location}</p>}
                </div>
              </div>
              <Button variant="outline" size="sm" fullWidth>View Company Profile</Button>
            </div>

            {/* Back */}
            <Link
              href="/theme/jobs/jobs"
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" aria-hidden="true" />
              Back to all jobs
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
