import { z } from 'zod'
import { IdSchema } from '../common/BaseTypes'

/* =========================================================
   ENUMS
========================================================= */

export const PlanIntervalEnum = z.enum(['MONTHLY', 'YEARLY', 'ONCE'])

export const ButtonVariantEnum = z.enum(['primary', 'secondary', 'ghost', 'outline', 'danger'])

/* =========================================================
   BUILDING BLOCKS
========================================================= */

export const CtaButtonSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: ButtonVariantEnum.optional(),
  external: z.boolean().optional(),
})

export const NavItemSchema = z.object({
  label: z.string(),
  href: z.string(),
  icon: z.string().optional(),
  badge: z.string().optional(),
})

export const FooterLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
})

export const FooterColumnSchema = z.object({
  title: z.string(),
  links: z.array(FooterLinkSchema),
})

/* =========================================================
   HERO SECTION
========================================================= */

export const HeroSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  subheadline: z.string().optional(),
  primaryCta: CtaButtonSchema.optional(),
  secondaryCta: CtaButtonSchema.optional(),
  image: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
})

/* =========================================================
   FEATURE
========================================================= */

export const FeatureSchema = z.object({
  featureId: IdSchema,
  icon: z.string().optional(),
  title: z.string(),
  description: z.string(),
  image: z.string().nullable().optional(),
})

/* =========================================================
   PRICING PLAN
   display-oriented; common/subscription/SubscriptionPlanCard
   uses its own local type for the management UI
========================================================= */

export const PricingPlanSchema = z.object({
  planId: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  currency: z.string().default('USD'),
  interval: PlanIntervalEnum.default('MONTHLY'),
  features: z.array(z.string()).default([]),
  isPopular: z.boolean().optional(),
  cta: CtaButtonSchema.optional(),
})

/* =========================================================
   PROMO (time-boxed campaign: banner, top strip, pricing ribbon)
========================================================= */

export const PromoToneEnum = z.enum(['primary', 'success', 'warning', 'info', 'neutral'])

export const PromoImageSchema = z.object({
  src: z.string(),
  /** Empty (the default) marks the image as decorative. */
  alt: z.string().optional(),
  /** A separate crop for phones (below the `sm` breakpoint). */
  mobileSrc: z.string().optional(),
})

export const PromoSchema = z.object({
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  headline: z.string(),
  body: z.string().optional(),
  cta: CtaButtonSchema.optional(),
  image: PromoImageSchema.optional(),
  /** ISO date-time the campaign ends; shows a countdown. */
  endsAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'endsAt must be an ISO date-time').optional(),
  couponCode: z.string().optional(),
  tone: PromoToneEnum.optional(),
})

/* =========================================================
   TESTIMONIAL
========================================================= */

export const TestimonialSchema = z.object({
  testimonialId: IdSchema,
  quote: z.string(),
  authorName: z.string(),
  authorTitle: z.string().nullable().optional(),
  authorAvatar: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyLogo: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
})

/* =========================================================
   FAQ
========================================================= */

export const FaqItemSchema = z.object({
  faqId: IdSchema,
  question: z.string(),
  answer: z.string(),
  category: z.string().nullable().optional(),
})

/* =========================================================
   STAT / SOCIAL PROOF
========================================================= */

export const StatSchema = z.object({
  statId: IdSchema,
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
})

/* =========================================================
   TEAM MEMBER
========================================================= */

export const SocialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
})

export const TeamMemberSchema = z.object({
  memberId: IdSchema,
  name: z.string(),
  role: z.string(),
  bio: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
})

/* =========================================================
   PARTNER / LOGO STRIP
========================================================= */

export const PartnerLogoSchema = z.object({
  partnerId: IdSchema,
  name: z.string(),
  logo: z.string(),
  url: z.string().nullable().optional(),
})

/* =========================================================
   HOW IT WORKS STEP
========================================================= */

export const HowItWorksStepSchema = z.object({
  stepId: IdSchema,
  order: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  image: z.string().nullable().optional(),
})

/* =========================================================
   TYPES
========================================================= */

export type PlanInterval = z.infer<typeof PlanIntervalEnum>
export type ButtonVariant = z.infer<typeof ButtonVariantEnum>
export type CtaButton = z.infer<typeof CtaButtonSchema>
export type NavItem = z.infer<typeof NavItemSchema>
export type FooterLink = z.infer<typeof FooterLinkSchema>
export type FooterColumn = z.infer<typeof FooterColumnSchema>
export type Hero = z.infer<typeof HeroSchema>
export type Feature = z.infer<typeof FeatureSchema>
export type PricingPlan = z.infer<typeof PricingPlanSchema>
export type Testimonial = z.infer<typeof TestimonialSchema>
export type FaqItem = z.infer<typeof FaqItemSchema>
export type Stat = z.infer<typeof StatSchema>
export type SocialLink = z.infer<typeof SocialLinkSchema>
export type TeamMember = z.infer<typeof TeamMemberSchema>
export type PartnerLogo = z.infer<typeof PartnerLogoSchema>
export type HowItWorksStep = z.infer<typeof HowItWorksStepSchema>
export type PromoTone = z.infer<typeof PromoToneEnum>
export type PromoImage = z.infer<typeof PromoImageSchema>
export type Promo = z.infer<typeof PromoSchema>
