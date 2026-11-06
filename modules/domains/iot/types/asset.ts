import type { AlarmSeverity } from './alarm';
import type { DeviceRecord } from './device';

/*
 * Sites and assets (docs/concepts/iot-platform/phases/08; NB `iot_asset`, docs/concepts/iot-asset): the topology a tenant builds
 * (site → building → floor / line → machine) and where each device is placed.
 *
 * `kind` is free text, upper case (NB A-4): the suggested kinds drive the pickers and the icons; any other kind is shown with a
 * neutral icon. A device has at most one placement (NB A-3). Asset → asset parentage is the tree itself, never a relation.
 *
 * Self-contained (types and pure helpers only), like `device.ts`.
 */

export const SUGGESTED_ASSET_KINDS = ['SITE', 'BUILDING', 'FLOOR', 'ROOM', 'AREA', 'LINE', 'MACHINE', 'OTHER'] as const;
export type SuggestedAssetKind = (typeof SUGGESTED_ASSET_KINDS)[number];

export function isSuggestedAssetKind(kind: string): kind is SuggestedAssetKind {
  return (SUGGESTED_ASSET_KINDS as readonly string[]).includes(kind);
}

/**
 * The kinds with a label in the kit messages and an icon of their own: the suggested ones, and the ones the platform's own seeds and
 * solutions use beside them (a plant under a city's site, a farm's regions, a campus's zones, a depot). The pickers keep to the
 * suggested list; any other kind is still drawn with its own name.
 */
export const NAMED_ASSET_KINDS = [...SUGGESTED_ASSET_KINDS, 'PLANT', 'REGION', 'ZONE', 'DEPOT'] as const;
export type NamedAssetKind = (typeof NAMED_ASSET_KINDS)[number];

export function isNamedAssetKind(kind: string): kind is NamedAssetKind {
  return (NAMED_ASSET_KINDS as readonly string[]).includes(kind);
}

/** The kind a new child of `parentKind` starts with (a building under a site, a floor in a building, …); `OTHER` under a kind it does not know. Pure. */
export function defaultChildKind(parentKind: string | null | undefined): SuggestedAssetKind {
  switch ((parentKind ?? '').toUpperCase()) {
    case '': case 'REGION': return 'SITE';
    case 'SITE': case 'PLANT': return 'BUILDING';
    case 'BUILDING': return 'FLOOR';
    case 'FLOOR': return 'ROOM';
    case 'ROOM': case 'ZONE': case 'DEPOT': return 'AREA';
    case 'AREA': case 'LINE': return 'MACHINE';
    default: return 'OTHER';
  }
}

/** One node of the tree as the tree view draws it: its counts, and its children (all of them, or none when not loaded yet). */
export type AssetNode = {
  assetId: string;
  parentId: string | null;
  code: string;
  name: string;
  kind: string;
  lat?: number | null;
  lng?: number | null;
  /** Live child assets. */
  childCount: number;
  /** Devices placed directly on this node. */
  deviceCount: number;
  children: AssetNode[];
};

/** A node on a path (breadcrumbs, a device's placement). */
export type AssetCrumb = { assetId: string; code: string; name: string; kind: string };

/** One asset as its detail page shows it. */
export type AssetRecord = {
  assetId: string;
  parentId: string | null;
  code: string;
  name: string;
  kind: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Its own time zone; `effectiveTimezone` is the one it inherits from the nearest ancestor that has one. */
  timezone?: string | null;
  effectiveTimezone?: string | null;
  attributes: Record<string, unknown>;
  /** Root first, the asset itself not included. */
  ancestors: AssetCrumb[];
  /** The ancestor its inherited zone comes from; null: its own zone or none; absent: the host does not say (then the nearest ancestor is not assumed). */
  timezoneFrom?: { assetId: string; name: string } | null;
  childCount: number;
  /** Devices placed directly on it (the placements a delete ends). */
  deviceCount: number;
  /** Its other relations (either end, any type but those placements), which a delete removes too; absent: the host does not count them. */
  relationCount?: number;
  /** The board that shows this asset ("Open dashboard"); null or absent: none. */
  defaultDashboardId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type AssetInput = {
  name: string;
  kind: string;
  /** Omitted: derived from the name by the host. */
  code?: string;
  parentId?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  timezone?: string | null;
  attributes?: Record<string, unknown>;
};

/**
 * One row of the Sites & assets table (owner 2026-10-27, option B): the node, its place (the ancestors, root first), its direct
 * children, the devices placed on it or below, and the active alarms of those devices and of the node and its descendants.
 * `alarmCount` and `worstSeverity` are null when the host shows no alarms (no alarm module, or a viewer who may not read them).
 */
export type AssetRow = {
  assetId: string;
  parentId: string | null;
  code: string;
  name: string;
  kind: string;
  lat?: number | null;
  lng?: number | null;
  location: Array<{ assetId: string; name: string }>;
  childCount: number;
  deviceCount: number;
  alarmCount: number | null;
  worstSeverity: AlarmSeverity | null;
};

/** A site (a top-level node) as the map draws it: its nodes, devices and active alarms per severity (null: alarms not shown). */
export type AssetSite = {
  assetId: string;
  code: string;
  name: string;
  kind: string;
  lat?: number | null;
  lng?: number | null;
  assetCount: number;
  deviceCount: number;
  alarmCount: number | null;
  worstSeverity: AlarmSeverity | null;
  alarmsBySeverity: Partial<Record<AlarmSeverity, number>> | null;
};

/** The page's KPI row and its sites. `alarms` false: the host shows no alarm counts (the KPI and the column are hidden). */
export type AssetSummary = {
  sites: number;
  sitesLocated: number;
  assets: number;
  devices: number;
  placedDevices: number;
  /** The tenant's active alarms, whatever they are raised on (a device placed nowhere too); of them critical and unacknowledged. */
  activeAlarms: number | null;
  criticalAlarms?: number | null;
  unacknowledgedAlarms?: number | null;
  sitesWithAlarms: number | null;
  /** The kinds the tenant's nodes use (the Kind filter offers them besides the suggested ones). */
  kinds?: string[];
  /** Most severe and most alarms first. */
  siteList: AssetSite[];
  sitesTruncated: boolean;
  /** The host counted only part of a very large set of active alarms: the per-site and per-row counts are partial. */
  alarmsTruncated?: boolean;
  alarms: boolean;
};

/** The Kind filter's choices: the suggested kinds, then the other kinds in use and the one asked for, each once. Pure. */
export function assetKindChoices(inUse: readonly string[] = [], current?: string): string[] {
  const out: string[] = [...SUGGESTED_ASSET_KINDS];
  for (const k of [...[...inUse].sort(), ...(current ? [current] : [])]) if (!out.includes(k)) out.push(k);
  return out;
}

/** A device placed under an asset, with the node it sits on (the asset itself or a descendant). */
export type PlacedDevice = { device: DeviceRecord; placement: AssetCrumb };

/**
 * Where a device is: the asset it is placed on (`null`: nowhere) and that asset's path, root first. `deviceName`: the device's name when
 * the host gives it (the remove confirm names it, NB 41-ui-fixes/26 1.11).
 */
export type DevicePlacement = { assetId: string | null; path: AssetCrumb[]; deviceName?: string | null };

export const RELATION_ENTITY_TYPES = ['ASSET', 'DEVICE'] as const;
export type RelationEntityType = (typeof RELATION_ENTITY_TYPES)[number];
/** The standard relation types the forms offer first; free upper-case types are allowed too. */
export const STANDARD_RELATION_TYPES = ['CONTAINS', 'MANAGES', 'FEEDS', 'MONITORS'] as const;

export type AssetRelation = {
  relationId: string;
  fromType: RelationEntityType;
  fromId: string;
  toType: RelationEntityType;
  toId: string;
  type: string;
  fromName?: string | null;
  toName?: string | null;
  createdAt?: Date | null;
};

export type AssetRelationInput = {
  fromType: RelationEntityType;
  fromId: string;
  toType: RelationEntityType;
  toId: string;
  type: string;
};

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every node of a tree, depth first. */
export function flattenAssets(nodes: readonly AssetNode[]): AssetNode[] {
  const out: AssetNode[] = [];
  const walk = (n: AssetNode) => { out.push(n); n.children.forEach(walk); };
  nodes.forEach(walk);
  return out;
}

/** The ids of a node and of everything under it (what a "Move to" picker must not offer: a cycle). */
export function subtreeIds(nodes: readonly AssetNode[], assetId: string): Set<string> {
  const node = flattenAssets(nodes).find((n) => n.assetId === assetId);
  return new Set(node ? flattenAssets([node]).map((n) => n.assetId) : [assetId]);
}

/** The path of a node in a tree (root first, the node last), or [] when it is not in it. */
export function assetPath(nodes: readonly AssetNode[], assetId: string): AssetNode[] {
  const walk = (list: readonly AssetNode[], trail: AssetNode[]): AssetNode[] | null => {
    for (const n of list) {
      const next = [...trail, n];
      if (n.assetId === assetId) return next;
      const hit = walk(n.children, next);
      if (hit) return hit;
    }
    return null;
  };
  return walk(nodes, []) ?? [];
}

/**
 * The tree reduced to the nodes whose name or code contains `search` (case-insensitive) and their ancestors, so a hit is always
 * shown in its place. An empty search returns the tree as it is; `matches` names the hits (for highlighting and auto-expansion).
 */
export function filterAssets(nodes: readonly AssetNode[], search: string): { nodes: AssetNode[]; matches: Set<string> } {
  const q = search.trim().toLowerCase();
  const matches = new Set<string>();
  if (!q) return { nodes: [...nodes], matches };
  const walk = (list: readonly AssetNode[]): AssetNode[] => list.flatMap((n) => {
    const children = walk(n.children);
    const hit = n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q);
    if (hit) matches.add(n.assetId);
    return hit || children.length ? [{ ...n, children }] : [];
  });
  return { nodes: walk(nodes), matches };
}

/** The tree without the given ids and everything under them (a "Move to" picker: no node under itself). */
export function withoutAssets(nodes: readonly AssetNode[], excluded: ReadonlySet<string>): AssetNode[] {
  return nodes.filter((n) => !excluded.has(n.assetId)).map((n) => ({ ...n, children: withoutAssets(n.children, excluded) }));
}

/** Total devices on a node and below it (from the tree's direct counts). */
export function devicesBelow(node: AssetNode): number {
  return node.deviceCount + node.children.reduce((s, c) => s + devicesBelow(c), 0);
}

/** The sites the map can draw (with a location), in the order given. */
export function locatedSites<T extends { lat?: number | null; lng?: number | null }>(sites: readonly T[]): Array<T & { lat: number; lng: number }> {
  return sites.filter((s): s is T & { lat: number; lng: number } => typeof s.lat === 'number' && typeof s.lng === 'number' && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

/** A site's map colour from its worst active alarm: critical / major red, minor / warning amber, info blue, none green; unknown neutral. */
export function siteTone(site: Pick<AssetSite, 'alarmCount' | 'worstSeverity'>): 'error' | 'warning' | 'info' | 'success' | 'neutral' {
  if (site.alarmCount === null) return 'neutral';
  switch (site.worstSeverity) {
    case 'CRITICAL': case 'MAJOR': return 'error';
    case 'MINOR': case 'WARNING': return 'warning';
    case 'INFO': return 'info';
    default: return 'success';
  }
}
