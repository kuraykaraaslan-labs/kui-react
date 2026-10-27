import Link from 'next/link';
import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { JobCard } from '@/modules/domains/jobs/job/JobCard';
import { CompanyCard } from '@/modules/domains/jobs/company/CompanyCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faLocationDot,
  faArrowRight,
  faBriefcase,
  faBuilding,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { JOBS, COMPANIES, JOB_CATEGORIES, FEATURED_JOB } from './jobs.data';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES['jobs'] },
};

const STATS = [
  { label: 'Open Roles',  value: '12,400+', icon: faBriefcase },
  { label: 'Companies',   value: '3,800+',  icon: faBuilding },
  { label: 'Hired This Month', value: '940+', icon: faUsers },
];

export default function JobsThemePage() {
  const latestJobs = JOBS.slice(0, 6);
  const featuredCompanies = COMPANIES.slice(0, 4);

  return (
    <div className="bg-surface-base text-text-primary">
      <style>{`
        @keyframes jobs-fade {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes jobs-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-12px); }
        }
      `}</style>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(55%_55%_at_30%_-5%,_var(--primary-subtle),_transparent_70%)]" />
          <div className="absolute -top-20 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl motion-safe:animate-[jobs-float_18s_ease-in-out_infinite]" />
          <div className="absolute top-40 -left-20 h-80 w-80 rounded-full bg-secondary/10 blur-3xl motion-safe:animate-[jobs-float_24s_ease-in-out_infinite]" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20">
          <div className="max-w-3xl mx-auto text-center space-y-6 motion-safe:animate-[jobs-fade_0.8s_ease-out]">
            <Badge variant="primary" size="sm">8 new roles added today</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight tracking-tight">
              Find your next<br />
              <span className="text-primary">dream role</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
              Browse thousands of curated positions from top tech companies. Remote, hybrid, and on-site.
            </p>

            {/* Search bar */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
              <div className="flex-1 relative">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Job title or skill…"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-raised text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus transition"
                />
              </div>
              <div className="relative sm:w-52">
                <FontAwesomeIcon
                  icon={faLocationDot}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Location or Remote"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-raised text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus transition"
                />
              </div>
              <Button variant="primary" size="lg" className="shrink-0 px-6">Search</Button>
            </div>

            {/* Popular searches */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {JOB_CATEGORIES.map((cat) => (
                <Link
                  key={cat.categoryId}
                  href={`/theme/jobs/jobs?category=${cat.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-border bg-surface-raised text-text-secondary hover:border-border-focus hover:text-text-primary transition-colors"
                >
                  {cat.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-border bg-surface-raised">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="grid grid-cols-3 divide-x divide-border">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-4 text-center">
                <FontAwesomeIcon icon={stat.icon} className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="text-2xl font-bold text-text-primary">{stat.value}</span>
                <span className="text-xs text-text-secondary">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured job ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary">Featured Role</h2>
          <Badge variant="success" dot>Hot</Badge>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary-subtle p-6 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">Featured</Badge>
              <Badge variant="success" size="sm">Hiring Now</Badge>
            </div>
            <h3 className="text-2xl font-bold text-text-primary">{FEATURED_JOB.title}</h3>
            <p className="text-text-secondary text-sm leading-relaxed max-w-2xl">{FEATURED_JOB.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {FEATURED_JOB.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 pt-2">
              <div className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{FEATURED_JOB.company.name}</span>
                {' · '}
                {FEATURED_JOB.location}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-text-primary">
                ${(FEATURED_JOB.salaryMin! / 1000).toFixed(0)}k–${(FEATURED_JOB.salaryMax! / 1000).toFixed(0)}k
              </div>
              <div className="text-xs text-text-secondary">per year</div>
            </div>
            <Button as="a" variant="primary" href={`/theme/jobs/jobs/${FEATURED_JOB.slug}`} iconRight={<FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" />}>
              Apply Now
            </Button>
            <Button variant="outline" size="sm" className="text-center">Save</Button>
          </div>
        </div>
      </section>

      {/* ── Latest jobs ── */}
      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary">Latest Jobs</h2>
          <Link href="/theme/jobs/jobs" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            View all <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latestJobs.map((job) => (
            <JobCard
              key={job.jobId}
              job={job}
              href={`/theme/jobs/jobs/${job.slug}`}
            />
          ))}
        </div>
      </section>

      {/* ── Top companies ── */}
      <section className="bg-surface-raised border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-primary">Top Hiring Companies</h2>
            <Link href="/theme/jobs" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              All companies <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCompanies.map((company) => {
              const count = JOBS.filter((j) => j.companyId === company.companyId).length;
              return (
                <CompanyCard
                  key={company.companyId}
                  company={company}
                  jobCount={count}
                  href={`/theme/jobs`}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-2xl bg-primary px-8 py-10 text-center space-y-4">
          <h2 className="text-2xl font-bold text-primary-fg">Ready to hire top talent?</h2>
          <p className="text-primary-fg/80 max-w-md mx-auto text-sm leading-relaxed">
            Post your job to reach thousands of qualified candidates. Get your first listing free.
          </p>
          <Button variant="accent" size="lg">Post a Job — It&apos;s Free</Button>
        </div>
      </section>
    </div>
  );
}
