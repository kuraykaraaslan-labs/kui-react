import { z } from 'zod'
import { AppLanguageEnum } from '../common/I18nTypes'
import { IdSchema } from '../common/BaseTypes'

/* =========================================================
   ENUMS
========================================================= */

export const ForumVisibilityEnum = z.enum([
  'PUBLIC',
  'PRIVATE',
  'HIDDEN',
  'ARCHIVED',
])

export const TopicStatusEnum = z.enum([
  'OPEN',
  'LOCKED',
  'PINNED',
  'ARCHIVED',
  'DELETED',
])

export const PostStatusEnum = z.enum([
  'PUBLISHED',
  'PENDING_REVIEW',
  'HIDDEN',
  'DELETED',
  'SPAM',
])

export const ReactionTypeEnum = z.enum([
  'LIKE',
  'DISLIKE',
  'THANKS',
  'LAUGH',
  'CONFUSED',
])

export const ReportStatusEnum = z.enum([
  'OPEN',
  'REVIEWING',
  'RESOLVED',
  'REJECTED',
])

export const ForumMemberRoleEnum = z.enum([
  'OWNER',
  'ADMIN',
  'MODERATOR',
  'MEMBER',
  'BANNED',
])

/* =========================================================
   CATEGORY / FORUM
========================================================= */

export const ForumCategoryTranslationSchema = z.object({
  id: IdSchema,
  categoryId: IdSchema,
  lang: AppLanguageEnum,

  title: z.string(),
  description: z.string().nullable().optional(),
  slug: z.string(),
})

export const ForumCategorySchema = z.object({
  categoryId: IdSchema,

  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),

  sortOrder: z.number().int().nonnegative().default(0),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

export const ForumTranslationSchema = z.object({
  id: IdSchema,
  forumId: IdSchema,
  lang: AppLanguageEnum,

  title: z.string(),
  description: z.string().nullable().optional(),
  slug: z.string(),
})

export const ForumSchema = z.object({
  forumId: IdSchema,
  categoryId: IdSchema,

  parentForumId: IdSchema.nullable().optional(),

  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),

  visibility: ForumVisibilityEnum.default('PUBLIC'),

  sortOrder: z.number().int().nonnegative().default(0),

  topicCount: z.number().int().nonnegative().default(0),
  postCount: z.number().int().nonnegative().default(0),

  lastTopicId: IdSchema.nullable().optional(),
  lastPostId: IdSchema.nullable().optional(),
  lastPostAt: z.coerce.date().nullable().optional(),
  lastPostByUserId: IdSchema.nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   TOPIC
========================================================= */

export const ForumTopicSchema = z.object({
  topicId: IdSchema,
  forumId: IdSchema,

  authorId: IdSchema,

  title: z.string(),
  slug: z.string(),

  status: TopicStatusEnum.default('OPEN'),

  pinned: z.boolean().default(false),
  locked: z.boolean().default(false),

  viewCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),

  firstPostId: IdSchema.nullable().optional(),
  lastPostId: IdSchema.nullable().optional(),
  lastPostAt: z.coerce.date().nullable().optional(),
  lastPostByUserId: IdSchema.nullable().optional(),

  /** The accepted solution, marked by the topic's author or a moderator. Set = the topic is solved. */
  solutionPostId: IdSchema.nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   POST / REPLY
========================================================= */

export const ForumPostSchema = z.object({
  postId: IdSchema,
  topicId: IdSchema,
  forumId: IdSchema,

  authorId: IdSchema,

  parentPostId: IdSchema.nullable().optional(),

  content: z.string(),

  status: PostStatusEnum.default('PUBLISHED'),

  editCount: z.number().int().nonnegative().default(0),
  editedAt: z.coerce.date().nullable().optional(),
  editedByUserId: IdSchema.nullable().optional(),
  editReason: z.string().nullable().optional(),

  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

export const ForumPostRevisionSchema = z.object({
  revisionId: IdSchema,
  postId: IdSchema,

  content: z.string(),

  editedByUserId: IdSchema,
  editReason: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   ATTACHMENTS
========================================================= */

export const ForumAttachmentSchema = z.object({
  attachmentId: IdSchema,

  postId: IdSchema,
  uploadedByUserId: IdSchema,

  fileName: z.string(),
  originalName: z.string().nullable().optional(),

  mimeType: z.string(),
  size: z.number().int().nonnegative(),

  url: z.string(),

  downloadCount: z.number().int().nonnegative().default(0),

  createdAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   REACTIONS / BOOKMARKS / SUBSCRIPTIONS
========================================================= */

export const ForumReactionSchema = z.object({
  reactionId: IdSchema,

  postId: IdSchema,
  userId: IdSchema,

  type: ReactionTypeEnum.default('LIKE'),

  createdAt: z.coerce.date().optional(),
})

export const ForumBookmarkSchema = z.object({
  bookmarkId: IdSchema,

  userId: IdSchema,
  topicId: IdSchema,

  createdAt: z.coerce.date().optional(),
})

export const ForumSubscriptionSchema = z.object({
  subscriptionId: IdSchema,

  userId: IdSchema,

  forumId: IdSchema.nullable().optional(),
  topicId: IdSchema.nullable().optional(),

  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   READ TRACKING
========================================================= */

export const ForumReadStateSchema = z.object({
  readStateId: IdSchema,

  userId: IdSchema,

  forumId: IdSchema.nullable().optional(),
  topicId: IdSchema.nullable().optional(),

  lastReadPostId: IdSchema.nullable().optional(),
  lastReadAt: z.coerce.date(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   MODERATION
========================================================= */

export const ForumReportSchema = z.object({
  reportId: IdSchema,

  postId: IdSchema.nullable().optional(),
  topicId: IdSchema.nullable().optional(),
  reportedUserId: IdSchema.nullable().optional(),

  reportedByUserId: IdSchema,

  reason: z.string(),
  details: z.string().nullable().optional(),

  status: ReportStatusEnum.default('OPEN'),

  reviewedByUserId: IdSchema.nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
})

export const ForumModerationLogSchema = z.object({
  moderationLogId: IdSchema,

  moderatorUserId: IdSchema,

  forumId: IdSchema.nullable().optional(),
  topicId: IdSchema.nullable().optional(),
  postId: IdSchema.nullable().optional(),
  targetUserId: IdSchema.nullable().optional(),

  action: z.string(),
  reason: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   MEMBERSHIP / PERMISSIONS
========================================================= */

export const ForumMemberSchema = z.object({
  forumMemberId: IdSchema,

  forumId: IdSchema,
  userId: IdSchema,

  role: ForumMemberRoleEnum.default('MEMBER'),

  canCreateTopic: z.boolean().default(true),
  canReply: z.boolean().default(true),
  canUploadAttachment: z.boolean().default(true),
  canModerate: z.boolean().default(false),

  joinedAt: z.coerce.date().optional(),
  bannedAt: z.coerce.date().nullable().optional(),
})

export const ForumBanSchema = z.object({
  banId: IdSchema,

  forumId: IdSchema.nullable().optional(),
  userId: IdSchema.nullable().optional(),

  ipAddress: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),

  reason: z.string().nullable().optional(),

  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),

  createdByUserId: IdSchema,
  createdAt: z.coerce.date().optional(),
})

/* =========================================================
   USER PROFILE EXTENSION
========================================================= */

export const ForumUserProfileSchema = z.object({
  forumProfileId: IdSchema,
  userId: IdSchema,

  username: z.string(),
  name: z.string().nullable().optional(),

  avatar: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),

  bio: z.string().nullable().optional(),

  postCount: z.number().int().nonnegative().default(0),
  reputation: z.number().int().default(0),

  title: z.string().nullable().optional(),

  showOnlineStatus: z.boolean().default(true),

  lastSeenAt: z.coerce.date().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
})

/* =========================================================
   WITH DATA
========================================================= */

export const ForumWithDataSchema = ForumSchema.extend({
  translations: z.array(ForumTranslationSchema).optional(),
})

export const ForumTopicWithDataSchema = ForumTopicSchema.extend({
  forum: ForumSchema.pick({
    forumId: true,
    title: true,
    slug: true,
  }),

  firstPost: ForumPostSchema.nullable().optional(),
  lastPost: ForumPostSchema.nullable().optional(),
})

export const ForumPostWithDataSchema = ForumPostSchema.extend({
  attachments: z.array(ForumAttachmentSchema).optional(),
  reactions: z.array(ForumReactionSchema).optional(),
})

/* =========================================================
   TYPES
========================================================= */

export type ForumVisibility = z.infer<typeof ForumVisibilityEnum>
export type TopicStatus = z.infer<typeof TopicStatusEnum>
export type ForumPostStatus = z.infer<typeof PostStatusEnum>
export type ReactionType = z.infer<typeof ReactionTypeEnum>
export type ReportStatus = z.infer<typeof ReportStatusEnum>
export type ForumMemberRole = z.infer<typeof ForumMemberRoleEnum>

export type ForumCategoryTranslation = z.infer<typeof ForumCategoryTranslationSchema>
export type ForumCategory = z.infer<typeof ForumCategorySchema>

export type ForumTranslation = z.infer<typeof ForumTranslationSchema>
export type Forum = z.infer<typeof ForumSchema>
export type ForumWithData = z.infer<typeof ForumWithDataSchema>

export type ForumTopic = z.infer<typeof ForumTopicSchema>
export type ForumTopicWithData = z.infer<typeof ForumTopicWithDataSchema>

export type ForumPost = z.infer<typeof ForumPostSchema>
export type ForumPostWithData = z.infer<typeof ForumPostWithDataSchema>
export type ForumPostRevision = z.infer<typeof ForumPostRevisionSchema>

export type ForumAttachment = z.infer<typeof ForumAttachmentSchema>

export type ForumReaction = z.infer<typeof ForumReactionSchema>
export type ForumBookmark = z.infer<typeof ForumBookmarkSchema>
export type ForumSubscription = z.infer<typeof ForumSubscriptionSchema>
export type ForumReadState = z.infer<typeof ForumReadStateSchema>

export type ForumReport = z.infer<typeof ForumReportSchema>
export type ForumModerationLog = z.infer<typeof ForumModerationLogSchema>

export type ForumMember = z.infer<typeof ForumMemberSchema>
export type ForumBan = z.infer<typeof ForumBanSchema>

export type ForumUserProfile = z.infer<typeof ForumUserProfileSchema>
