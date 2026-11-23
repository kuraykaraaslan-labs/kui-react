import { z } from 'zod'
import { InsightsRangeSchema } from '../types'

/* =========================================================
   SECURITY SUMMARY — what a site's protections refused, blocked and noticed over a range of days.
   The host counts events per day (no IP address in any counter) and builds one snapshot; the view
   only reads it. The WordPress port (kui-wordpress-saas plugin/kui-shield, Dashboard › Security)
   produces exactly this shape.
========================================================= */

const count = z.number().nonnegative().default(0)
/** Counts by key (a surface, a reason, a jail): `{ signin: 4, contact: 1 }`. */
const counts = z.record(z.string(), z.number().nonnegative()).default({})

/** One key's count in the range and in the previous range of the same length. */
export const SecurityCountRowSchema = z.object({
  key: z.string(),
  count,
  previous: z.number().nonnegative().optional(),
})

/**
 * Geo-IP refusals (kui-shield): surfaces are `signin`, `register`, `contact`, `forum`, `comment`, `api`, `chat`,
 * `quote`, `newsletter`; reasons are `country`, `address-limit`, `country-cap`, `staff-country`. A country is an ISO
 * 3166-1 alpha-2 code ('' = unknown).
 */
export const SecurityRefusalDaySchema = z.object({ date: z.string(), total: count, bySurface: counts, byReason: counts })
export const SecurityRefusalsSchema = z.object({
  total: count,
  previousTotal: z.number().nonnegative().optional(),
  days: z.array(SecurityRefusalDaySchema).default([]),
  bySurface: z.array(SecurityCountRowSchema).default([]),
  byReason: z.array(SecurityCountRowSchema).default([]),
  topCountries: z.array(SecurityCountRowSchema).default([]),
})

/** Sign-in security: failed passwords and second steps, second-step lockouts, recovery codes used, staff sign-ins. */
export const SecuritySignInCountsSchema = z.object({
  failedPasswords: count,
  failedSecondSteps: count,
  lockouts: count,
  recoveryCodesUsed: count,
  staffSignIns: count,
  enrolments: count,
})
export const SecuritySignInDaySchema = SecuritySignInCountsSchema.extend({ date: z.string() })
export const SecuritySignInSchema = z.object({
  totals: SecuritySignInCountsSchema.prefault({}),
  previousTotals: SecuritySignInCountsSchema.partial().default({}),
  days: z.array(SecuritySignInDaySchema).default([]),
})

/**
 * Spam the forms caught: kinds are `honeypot` (the hidden field was filled), `too-fast` (sent under the minimum fill
 * time), `bot-trap` (no or a forged signed timestamp), `disposable-email` and `rate-limit`; surfaces as above.
 */
export const SecuritySpamDaySchema = z.object({ date: z.string(), total: count, byKind: counts, bySurface: counts })
export const SecuritySpamSchema = z.object({
  total: count,
  previousTotal: z.number().nonnegative().optional(),
  days: z.array(SecuritySpamDaySchema).default([]),
  byKind: z.array(SecurityCountRowSchema).default([]),
  bySurface: z.array(SecurityCountRowSchema).default([]),
})

export const SecurityAlertKindEnum = z.enum(['integrity', 'health'])
export const SecurityAlertStateEnum = z.enum(['open', 'resolved'])
/** A server alert: file integrity, or a health check (`svc-nginx`, `disk`, `backup`, `cert-<host>` …). */
export const SecurityAlertSchema = z.object({
  kind: SecurityAlertKindEnum,
  key: z.string(),
  title: z.string().default(''),
  state: SecurityAlertStateEnum,
  openedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
})

export const SecurityBanDaySchema = z.object({ date: z.string(), total: count, byJail: counts })
/** `off`: the server has never reported (the bridge scripts are not installed). */
export const SecurityServerStateEnum = z.enum(['ok', 'off'])
export const SecurityServerSchema = z.object({
  state: SecurityServerStateEnum,
  lastReportAt: z.string().nullable().default(null),
  bans: z
    .object({
      total: count,
      previousTotal: z.number().nonnegative().optional(),
      days: z.array(SecurityBanDaySchema).default([]),
      byJail: z.array(SecurityCountRowSchema).default([]),
    })
    .prefault({}),
  alerts: z.array(SecurityAlertSchema).default([]),
})

/** The short incident list kept beside the counters. It holds IP addresses (the counters never do). */
export const SecurityRecentRefusalSchema = z.object({
  at: z.string(),
  surface: z.string(),
  reason: z.string(),
  country: z.string().default(''),
  ip: z.string().default(''),
})
export const SecurityRecentSchema = z.object({
  /** How many lines the list keeps; older ones drop off. */
  keep: z.number().int().positive().default(100),
  items: z.array(SecurityRecentRefusalSchema).default([]),
})

export const SecuritySnapshotSchema = z.object({
  generatedAt: z.string().nullable().default(null),
  range: InsightsRangeSchema,
  previousRange: InsightsRangeSchema.optional(),
  /** How long the daily counters are kept, in months. */
  retentionMonths: z.number().int().positive().default(13),
  refusals: SecurityRefusalsSchema.prefault({}),
  signIn: SecuritySignInSchema.prefault({}),
  spam: SecuritySpamSchema.prefault({}),
  server: SecurityServerSchema.prefault({ state: 'off' }),
  recent: SecurityRecentSchema.prefault({}),
})

/* =========================================================
   TYPES
========================================================= */

export type SecurityCountRow = z.infer<typeof SecurityCountRowSchema>
export type SecurityRefusalDay = z.infer<typeof SecurityRefusalDaySchema>
export type SecurityRefusals = z.infer<typeof SecurityRefusalsSchema>
export type SecuritySignInCounts = z.infer<typeof SecuritySignInCountsSchema>
export type SecuritySignInDay = z.infer<typeof SecuritySignInDaySchema>
export type SecuritySignIn = z.infer<typeof SecuritySignInSchema>
export type SecuritySpamDay = z.infer<typeof SecuritySpamDaySchema>
export type SecuritySpam = z.infer<typeof SecuritySpamSchema>
export type SecurityAlertKind = z.infer<typeof SecurityAlertKindEnum>
export type SecurityAlert = z.infer<typeof SecurityAlertSchema>
export type SecurityBanDay = z.infer<typeof SecurityBanDaySchema>
export type SecurityServer = z.infer<typeof SecurityServerSchema>
export type SecurityRecentRefusal = z.infer<typeof SecurityRecentRefusalSchema>
export type SecuritySnapshot = z.infer<typeof SecuritySnapshotSchema>

/** Known keys in their fixed display order (an unknown key from a newer producer is shown after them, by its key). */
export const SECURITY_SURFACES = ['signin', 'register', 'contact', 'forum', 'comment', 'api', 'chat', 'quote', 'newsletter'] as const
export const REFUSAL_REASONS = ['country', 'address-limit', 'country-cap', 'staff-country'] as const
export const SPAM_KINDS = ['honeypot', 'too-fast', 'bot-trap', 'disposable-email', 'rate-limit'] as const
export const SIGN_IN_METRICS = ['failedPasswords', 'failedSecondSteps', 'lockouts', 'recoveryCodesUsed', 'staffSignIns', 'enrolments'] as const
export type SignInMetric = (typeof SIGN_IN_METRICS)[number]
