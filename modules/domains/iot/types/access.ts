/*
 * Restricted IoT access (NB restricted IoT access): a tenant limits a member to the IoT sites, assets and devices granted to them, or
 * to a group they are in. A grant on an ASSET opens that node and everything below it (its child assets and the devices placed on
 * them); a grant on a DEVICE opens that device. Members whose role holds the "see every IoT site and device" permission, and members
 * of the "Full IoT view" group, see everything without a grant. Only an administrator who sees everything manages grants.
 *
 * Self-contained (types only), like `asset.ts`.
 */

/** Who a grant is for: one member (`USER`) or a group (`GROUP`, its members). */
export const ACCESS_SUBJECT_TYPES = ['USER', 'GROUP'] as const;
export type IotAccessSubjectType = (typeof ACCESS_SUBJECT_TYPES)[number];

/** What a grant opens: a site or asset and everything below it (`ASSET`), or one device (`DEVICE`). */
export const ACCESS_TARGET_TYPES = ['ASSET', 'DEVICE'] as const;
export type IotAccessTargetType = (typeof ACCESS_TARGET_TYPES)[number];

/** One grant: a member or a group may see a site or asset (and everything below it) or a device. */
export type IotAccessGrant = {
  grantId: string;
  subjectType: IotAccessSubjectType;
  subjectId: string;
  /** The subject's name: a group's label (a host may fill a member's name too); null: the view shows the subject's id. */
  subjectLabel: string | null;
  targetType: IotAccessTargetType;
  targetId: string;
  /** The site's, asset's or device's name; null when it no longer exists (the view says "Removed"). */
  targetName: string | null;
  /** Who gave it (the host's user id or name). */
  createdBy: string | null;
  createdAt: Date | string;
};

/** What `createGrant` sends. */
export type IotAccessGrantInput = {
  subjectType: IotAccessSubjectType;
  subjectId: string;
  targetType: IotAccessTargetType;
  targetId: string;
};

/** A page of grants, narrowed by any of the filters (one subject's grants, one target's grants). `page` is 1-based. */
export type IotAccessGrantQuery = {
  page: number;
  pageSize: number;
  subjectType?: IotAccessSubjectType;
  subjectId?: string;
  targetType?: IotAccessTargetType;
  targetId?: string;
};

/**
 * A member or a group a grant can be for, as the host's subject search answers it (the host merges its members and groups).
 * `hint`: a second line under the label (a member's e-mail, "Group").
 */
export type IotAccessSubject = {
  type: IotAccessSubjectType;
  id: string;
  label: string;
  hint?: string | null;
};

/** One kind of target a member sees: everything (`all`, through their role or the Full IoT view group), or `count` of them (`ids`). */
export type IotAccessScope = {
  all: boolean;
  /** How many they see; null when `all` (or when the host did not count them: the view then counts `ids`). */
  count: number | null;
  ids: string[];
};

/**
 * What one member sees now, for the preview: their sites and assets (an asset grant counts the node and everything below it) and
 * their devices, and how many grants they hold directly. `member` false: the user is not a member of the workspace (any more).
 */
export type IotEffectiveAccess = {
  member: boolean;
  assets: IotAccessScope;
  devices: IotAccessScope;
  grants: { assets: number; devices: number };
};
