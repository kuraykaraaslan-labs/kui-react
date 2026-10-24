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
  childCount: number;
  deviceCount: number;
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

/** A device placed under an asset, with the node it sits on (the asset itself or a descendant). */
export type PlacedDevice = { device: DeviceRecord; placement: AssetCrumb };

/** Where a device is: its node and the node's ancestors, root first; `assetId` null when it is not placed. */
export type DevicePlacement = { assetId: string | null; path: AssetCrumb[] };

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
