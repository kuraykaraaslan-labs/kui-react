'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { JobStatusBadge } from '@/modules/domains/jobs/job/JobStatusBadge';
import { JobTypeBadge } from '@/modules/domains/jobs/job/JobTypeBadge';
import { JobWorkModeBadge } from '@/modules/domains/jobs/job/JobWorkModeBadge';
import { JobExperienceBadge } from '@/modules/domains/jobs/job/JobExperienceBadge';
import { JobMeta } from '@/modules/domains/jobs/job/JobMeta';
import { JobCard } from '@/modules/domains/jobs/job/JobCard';
import { JobApplyActions } from '@/modules/domains/jobs/job/JobApplyActions';
import { CompanyCard } from '@/modules/domains/jobs/company/CompanyCard';
import { ApplicationStatusBadge } from '@/modules/domains/jobs/application/ApplicationStatusBadge';
import type { JobWithData, Company } from '@/modules/domains/jobs/types';

/* ─── demo data ─── */

const DEMO_COMPANY: Company = {
  companyId: 'c-demo',
  name: 'Vercel',
  slug: 'vercel',
  description: 'Building tools that help developers ship fast. We power millions of frontend deployments worldwide.',
  logo: 'https://avatars.githubusercontent.com/u/14985020',
  website: 'https://vercel.com',
  industry: 'Developer Tools',
  size: '201–500',
  location: 'Remote',
  verified: true,
};

const DEMO_JOB: JobWithData = {
  jobId: 'j-demo',
  companyId: 'c-demo',
  categoryId: 'cat-01',
  title: 'Senior Frontend Engineer',
  slug: 'senior-frontend-engineer-vercel',
  description: 'Join our core product team to build the next generation of our frontend platform.',
  type: 'FULL_TIME',
  workMode: 'REMOTE',
  experienceLevel: 'SENIOR',
  location: 'Remote (Worldwide)',
  country: 'US',
  salaryMin: 160000,
  salaryMax: 220000,
  currency: 'USD',
  salaryVisible: true,
  positions: 2,
  tags: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
  status: 'PUBLISHED',
  applicationDeadline: new Date('2026-06-30'),
  views: 3412,
  applicationsCount: 128,
  publishedAt: new Date('2026-04-28'),
  company: { companyId: 'c-demo', name: 'Vercel', slug: 'vercel', logo: 'https://avatars.githubusercontent.com/u/14985020', verified: true },
  category: { categoryId: 'cat-01', title: 'Engineering', slug: 'engineering' },
};

const DEMO_JOB_DRAFT: JobWithData = {
  ...DEMO_JOB,
  jobId: 'j-demo-2',
  title: 'Product Designer',
  type: 'FULL_TIME',
  workMode: 'HYBRID',
  experienceLevel: 'MID',
  status: 'DRAFT',
  salaryVisible: false,
  tags: ['Figma', 'UX Research', 'Design Systems'],
  company: { companyId: 'c-demo-2', name: 'Linear', slug: 'linear', logo: 'https://avatars.githubusercontent.com/u/60321695', verified: true },
};

/* ─── builder ─── */

export function buildJobsDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'jobs-status-badge',
      title: 'JobStatusBadge',
      category: 'Domain',
      abbr: 'JS',
      description: 'Displays job listing status with semantic colour coding.',
      filePath: 'modules/domains/jobs/job/JobStatusBadge.tsx',
      sourceCode: `import { JobStatusBadge } from '@/modules/domains/jobs/job/JobStatusBadge';
<JobStatusBadge status="PUBLISHED" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED'] as const).map((s) => (
                <JobStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED'] as const).map((s) => (
  <JobStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status="PUBLISHED" size="sm" />
              <JobStatusBadge status="PUBLISHED" size="md" />
              <JobStatusBadge status="PUBLISHED" size="lg" />
            </div>
          ),
          code: `<JobStatusBadge status="PUBLISHED" size="sm" />
<JobStatusBadge status="PUBLISHED" size="md" />
<JobStatusBadge status="PUBLISHED" size="lg" />`,
        },
      ],
    },
    {
      id: 'jobs-type-badge',
      title: 'JobTypeBadge',
      category: 'Domain',
      abbr: 'JT',
      description: 'Colour-coded badge for employment type (full-time, contract, etc.).',
      filePath: 'modules/domains/jobs/job/JobTypeBadge.tsx',
      sourceCode: `import { JobTypeBadge } from '@/modules/domains/jobs/job/JobTypeBadge';
<JobTypeBadge type="FULL_TIME" />`,
      variants: [
        {
          title: 'All types',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'] as const).map((t) => (
                <JobTypeBadge key={t} type={t} />
              ))}
            </div>
          ),
          code: `{(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'] as const).map((t) => (
  <JobTypeBadge key={t} type={t} />
))}`,
        },
      ],
    },
    {
      id: 'jobs-work-mode-badge',
      title: 'JobWorkModeBadge',
      category: 'Domain',
      abbr: 'WM',
      description: 'Icon + label badge for work location mode (remote, hybrid, on-site).',
      filePath: 'modules/domains/jobs/job/JobWorkModeBadge.tsx',
      sourceCode: `import { JobWorkModeBadge } from '@/modules/domains/jobs/job/JobWorkModeBadge';
<JobWorkModeBadge workMode="REMOTE" />`,
      variants: [
        {
          title: 'All modes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['REMOTE', 'HYBRID', 'ONSITE'] as const).map((m) => (
                <JobWorkModeBadge key={m} workMode={m} />
              ))}
            </div>
          ),
          code: `{(['REMOTE', 'HYBRID', 'ONSITE'] as const).map((m) => (
  <JobWorkModeBadge key={m} workMode={m} />
))}`,
        },
      ],
    },
    {
      id: 'jobs-experience-badge',
      title: 'JobExperienceBadge',
      category: 'Domain',
      abbr: 'JE',
      description: 'Experience level badge mapping seniority to a semantic colour.',
      filePath: 'modules/domains/jobs/job/JobExperienceBadge.tsx',
      sourceCode: `import { JobExperienceBadge } from '@/modules/domains/jobs/job/JobExperienceBadge';
<JobExperienceBadge level="SENIOR" />`,
      variants: [
        {
          title: 'All levels',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR'] as const).map((l) => (
                <JobExperienceBadge key={l} level={l} />
              ))}
            </div>
          ),
          code: `{(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR'] as const).map((l) => (
  <JobExperienceBadge key={l} level={l} />
))}`,
        },
      ],
    },
    {
      id: 'jobs-application-status-badge',
      title: 'ApplicationStatusBadge',
      category: 'Domain',
      abbr: 'AS',
      description: 'Tracks an application\'s lifecycle from Pending through Offered or Rejected.',
      filePath: 'modules/domains/jobs/application/ApplicationStatusBadge.tsx',
      sourceCode: `import { ApplicationStatusBadge } from '@/modules/domains/jobs/application/ApplicationStatusBadge';
<ApplicationStatusBadge status="SHORTLISTED" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'] as const).map((s) => (
                <ApplicationStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'] as const).map((s) => (
  <ApplicationStatusBadge key={s} status={s} />
))}`,
        },
      ],
    },
    {
      id: 'jobs-job-meta',
      title: 'JobMeta',
      category: 'Domain',
      abbr: 'JM',
      description: 'Inline metadata row: location, salary range, open positions, and posted date.',
      filePath: 'modules/domains/jobs/job/JobMeta.tsx',
      sourceCode: `import { JobMeta } from '@/modules/domains/jobs/job/JobMeta';
<JobMeta job={job} />`,
      variants: [
        {
          title: 'With salary',
          layout: 'stack',
          preview: <JobMeta job={DEMO_JOB} />,
          code: `<JobMeta job={job} />`,
        },
        {
          title: 'Salary hidden',
          layout: 'stack',
          preview: <JobMeta job={{ ...DEMO_JOB, salaryVisible: false }} />,
          code: `<JobMeta job={{ ...job, salaryVisible: false }} />`,
        },
      ],
    },
    {
      id: 'jobs-job-card',
      title: 'JobCard',
      category: 'Domain',
      abbr: 'JC',
      description: 'Summarises a job posting with company logo, title, badges, tags, and meta.',
      filePath: 'modules/domains/jobs/job/JobCard.tsx',
      sourceCode: `import { JobCard } from '@/modules/domains/jobs/job/JobCard';
<JobCard job={job} href="/jobs/slug" />`,
      variants: [
        {
          title: 'With link',
          preview: (
            <div className="max-w-sm">
              <JobCard job={DEMO_JOB} href="#" />
            </div>
          ),
          code: `<JobCard job={job} href="/jobs/slug" />`,
        },
        {
          title: 'No badges',
          preview: (
            <div className="max-w-sm">
              <JobCard job={DEMO_JOB_DRAFT} showBadges={false} />
            </div>
          ),
          code: `<JobCard job={job} showBadges={false} />`,
        },
        {
          title: 'Opens a job board (new tab)',
          preview: (
            <div className="max-w-sm">
              <JobCard job={DEMO_JOB} href="https://www.linkedin.com/jobs/" external />
            </div>
          ),
          code: `<JobCard job={job} href={job.applyLinks[0].url} external />`,
        },
      ],
    },
    {
      id: 'jobs-apply-actions',
      title: 'JobApplyActions',
      category: 'Domain',
      abbr: 'JA',
      description: 'A job\'s apply buttons: "Apply on <platform>" for each job board or ATS the job is posted on (new tab, named from the address) and/or "Apply now" to the host\'s form. The first button is primary.',
      filePath: 'modules/domains/jobs/job/JobApplyActions.tsx',
      sourceCode: `import { JobApplyActions } from '@/modules/domains/jobs/job/JobApplyActions';
<JobApplyActions job={job} />`,
      variants: [
        {
          title: 'Applications elsewhere only',
          preview: (
            <div className="max-w-xs">
              <JobApplyActions job={{ applyLinks: [{ url: 'https://www.linkedin.com/jobs/' }, { url: 'https://boards.greenhouse.io/' }] }} />
            </div>
          ),
          code: `<JobApplyActions job={{ applyLinks: [{ url: 'https://www.linkedin.com/jobs/view/…' }, { url: 'https://boards.greenhouse.io/…' }] }} />`,
        },
        {
          title: 'Form and a platform, in a row',
          preview: (
            <JobApplyActions job={{ applyMode: 'BOTH', applyLinks: [{ url: 'https://www.indeed.com/' }] }} applyHref="#apply" layout="row" />
          ),
          code: `<JobApplyActions job={{ applyMode: 'BOTH', applyLinks: [{ url: 'https://www.indeed.com/…' }] }} applyHref="#apply" layout="row" />`,
        },
      ],
    },
    {
      id: 'jobs-company-card',
      title: 'CompanyCard',
      category: 'Domain',
      abbr: 'CC',
      description: 'Company profile card showing logo, name, industry, location, and open job count.',
      filePath: 'modules/domains/jobs/company/CompanyCard.tsx',
      sourceCode: `import { CompanyCard } from '@/modules/domains/jobs/company/CompanyCard';
<CompanyCard company={company} jobCount={5} href="/companies/slug" />`,
      variants: [
        {
          title: 'Verified with job count',
          preview: (
            <div className="max-w-sm">
              <CompanyCard company={DEMO_COMPANY} jobCount={3} href="#" />
            </div>
          ),
          code: `<CompanyCard company={company} jobCount={3} href="/companies/slug" />`,
        },
        {
          title: 'Unverified, no count',
          preview: (
            <div className="max-w-sm">
              <CompanyCard company={{ ...DEMO_COMPANY, verified: false, description: null }} />
            </div>
          ),
          code: `<CompanyCard company={{ ...company, verified: false }} />`,
        },
      ],
    },
  ];
}
