import { z } from 'zod'
import { AppLanguageEnum } from '../common/I18nTypes'
import { IdSchema } from '../common/BaseTypes'
import { CurrencySchema } from '../common/MoneyTypes'

/* =========================================================
   ENUMS
========================================================= */

export const JobStatusEnum = z.enum([
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED',
])

export const JobTypeEnum = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'FREELANCE',
  'INTERNSHIP',
])

export const JobWorkModeEnum = z.enum([
  'ONSITE',
  'REMOTE',
  'HYBRID',
])

export const JobExperienceLevelEnum = z.enum([
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'DIRECTOR',
])

/** How a job takes applications: on other platforms (LinkedIn, Indeed, an ATS), with a form here, or both. */
export const JobApplyModeEnum = z.enum([
  'LINKS',
  'FORM',
  'BOTH',
])

export const ApplicationStatusEnum = z.enum([
  'PENDING',
  'REVIEWING',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFERED',
  'REJECTED',
  'WITHDRAWN',
])

/* =========================================================
   COMPANY
========================================================= */

export const CompanySchema = z.object({
  companyId: IdSchema,

  name: z.string(),
  slug: z.string(),

  description: z.string().nullable().optional(),

  logo: z.string().nullable().optional(),
  website: z.url().nullable().optional(),

  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),

  location: z.string().nullable().optional(),

  verified: z.boolean().default(false),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   JOB CATEGORY / TAG
========================================================= */

export const JobCategorySchema = z.object({
  categoryId: IdSchema,

  title: z.string(),
  slug: z.string(),

  description: z.string().nullable().optional(),

  parentId: IdSchema.nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

export const JobTagSchema = z.object({
  tagId: IdSchema,

  name: z.string(),
  slug: z.string(),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   JOB
========================================================= */

/** One place a job takes applications elsewhere. `label` empty = the platform's name from the address. */
export const JobApplyLinkSchema = z.object({
  url: z.url(),
  label: z.string().nullable().optional(),
})

export const JobSchema = z.object({
  jobId: IdSchema,

  companyId: IdSchema,
  categoryId: IdSchema.nullable().optional(),

  title: z.string(),
  slug: z.string(),

  description: z.string(),
  responsibilities: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  benefits: z.string().nullable().optional(),

  type: JobTypeEnum.default('FULL_TIME'),
  workMode: JobWorkModeEnum.default('ONSITE'),
  experienceLevel: JobExperienceLevelEnum.default('MID'),

  location: z.string().nullable().optional(),
  country: z.string().nullable().optional(),

  salaryMin: z.number().nonnegative().nullable().optional(),
  salaryMax: z.number().nonnegative().nullable().optional(),
  currency: CurrencySchema,
  salaryVisible: z.boolean().default(true),

  positions: z.number().int().positive().default(1),

  tags: z.array(z.string()).default([]),

  status: JobStatusEnum.default('DRAFT'),

  applicationDeadline: z.coerce.date().nullable().optional(),

  /** Where applications go. Without it: FORM when there are no links, LINKS when there are (see resolveJobApplyMode). */
  applyMode: JobApplyModeEnum.optional(),
  applyLinks: z.array(JobApplyLinkSchema).max(6).optional(),

  views: z.number().int().nonnegative().default(0),
  applicationsCount: z.number().int().nonnegative().default(0),

  publishedAt: z.coerce.date().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   TRANSLATION
========================================================= */

export const JobTranslationSchema = z.object({
  id: IdSchema,
  jobId: IdSchema,
  lang: AppLanguageEnum,

  title: z.string(),
  slug: z.string(),
  description: z.string(),
})

/* =========================================================
   JOB WITH DATA
========================================================= */

export const JobWithDataSchema = JobSchema.extend({
  company: CompanySchema.pick({
    companyId: true,
    name: true,
    slug: true,
    logo: true,
    verified: true,
  }),

  category: JobCategorySchema.pick({
    categoryId: true,
    title: true,
    slug: true,
  }).nullable().optional(),

  translations: z.array(JobTranslationSchema).optional(),
})

/* =========================================================
   APPLICANT / PROFILE
========================================================= */

export const ApplicantProfileSchema = z.object({
  applicantId: IdSchema,

  userId: IdSchema.nullable().optional(),

  firstName: z.string(),
  lastName: z.string(),

  email: z.string().email(),
  phone: z.string().nullable().optional(),

  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),

  location: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

export const ResumeSchema = z.object({
  resumeId: IdSchema,

  applicantId: IdSchema,

  title: z.string(),
  fileUrl: z.string(),

  isDefault: z.boolean().default(false),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   APPLICATION
========================================================= */

export const JobApplicationSchema = z.object({
  applicationId: IdSchema,

  jobId: IdSchema,
  applicantId: IdSchema,

  resumeId: IdSchema.nullable().optional(),

  coverLetter: z.string().nullable().optional(),

  status: ApplicationStatusEnum.default('PENDING'),

  appliedAt: z.coerce.date().optional(),

  reviewedAt: z.coerce.date().nullable().optional(),

  notes: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   INTERVIEW
========================================================= */

export const InterviewTypeEnum = z.enum([
  'PHONE',
  'VIDEO',
  'ONSITE',
])

export const InterviewSchema = z.object({
  interviewId: IdSchema,

  applicationId: IdSchema,

  type: InterviewTypeEnum,

  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive(),

  location: z.string().nullable().optional(),
  meetingUrl: z.url().nullable().optional(),

  interviewerName: z.string().nullable().optional(),

  notes: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   JOB ALERTS / SAVED JOBS
========================================================= */

export const SavedJobSchema = z.object({
  savedJobId: IdSchema,

  jobId: IdSchema,
  userId: IdSchema,

  createdAt: z.coerce.date().optional(),
})

export const JobAlertSchema = z.object({
  alertId: IdSchema,

  userId: IdSchema,

  keywords: z.array(z.string()).default([]),
  location: z.string().nullable().optional(),
  jobType: JobTypeEnum.nullable().optional(),

  active: z.boolean().default(true),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   TYPES
========================================================= */

export type JobStatus = z.infer<typeof JobStatusEnum>
export type JobType = z.infer<typeof JobTypeEnum>
export type JobWorkMode = z.infer<typeof JobWorkModeEnum>
export type JobExperienceLevel = z.infer<typeof JobExperienceLevelEnum>
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>
export type JobApplyMode = z.infer<typeof JobApplyModeEnum>

export type Company = z.infer<typeof CompanySchema>
export type JobCategory = z.infer<typeof JobCategorySchema>
export type JobTag = z.infer<typeof JobTagSchema>

export type Job = z.infer<typeof JobSchema>
export type JobApplyLink = z.infer<typeof JobApplyLinkSchema>
export type JobWithData = z.infer<typeof JobWithDataSchema>
export type JobTranslation = z.infer<typeof JobTranslationSchema>

export type ApplicantProfile = z.infer<typeof ApplicantProfileSchema>
export type Resume = z.infer<typeof ResumeSchema>

export type JobApplication = z.infer<typeof JobApplicationSchema>

export type InterviewType = z.infer<typeof InterviewTypeEnum>
export type Interview = z.infer<typeof InterviewSchema>

export type SavedJob = z.infer<typeof SavedJobSchema>
export type JobAlert = z.infer<typeof JobAlertSchema>
