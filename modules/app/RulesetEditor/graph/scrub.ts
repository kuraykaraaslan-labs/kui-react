import type { Catalog } from '../catalog/types';
import { isSecretKey } from '../secrets';
import { stable } from './history';
import type { GraphNode } from './types';

/**
 * Secrets stay out of what leaves the editor's memory: the copied clip (clipboard) and the browser draft
 * (`localStorage`). A secret key (`isSecretKey`, or a param the catalog declares as `secret`) loses its value; a
 * `{ "$secret": true }` marker, which says "keep what is stored", stays, as in the exports.
 */

/** whether `key` of a node of `type` holds a secret */
export type SecretTest = (type: string, key: string) => boolean;

/** secrets by key name only */
export const secretByName: SecretTest = (_type, key) => isSecretKey(key);

/** secrets by key name, plus every param the catalog declares with the type `secret` */
export function secretTestOf(catalog: Pick<Catalog, 'blocks'> | undefined): SecretTest {
  if (!catalog) return secretByName;
  return (type, key) => isSecretKey(key) || catalog.blocks[type]?.params?.[key]?.type === 'secret';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isMarker(v: unknown): boolean {
  return isRecord(v) && v.$secret === true;
}

function empty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** deep copy without the values of secret keys; the keys of nested objects are judged by name only */
function omit(value: unknown, test: (key: string) => boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => omit(v, isSecretKey));
  if (!isRecord(value) || isMarker(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (test(key) && !empty(v) && !isMarker(v)) continue;
    out[key] = omit(v, isSecretKey);
  }
  return out;
}

/** a node without its secret values (a copy; the node is not changed) */
export function scrubNode<N extends GraphNode>(node: N, test: SecretTest = secretByName): N {
  const out = { ...node };
  if (node.config) out.config = omit(node.config, (key) => test(node.type, key)) as Record<string, unknown>;
  if (node.original?.settings !== undefined) out.original = { ...node.original, settings: omit(node.original.settings, isSecretKey) };
  return out;
}

/**
 * The snapshot of an editor state (`snapshotOf`) with every node scrubbed. A text that
 * is not a snapshot of nodes, or has no secret in it, comes back as it is.
 */
export function scrubSnapshot(snapshot: string, test: SecretTest = secretByName): string {
  let raw: unknown;
  try { raw = JSON.parse(snapshot); } catch { return snapshot; }
  if (!isRecord(raw)) return snapshot;
  const nodes = (list: unknown) => (Array.isArray(list) ? list.map((n) => (isRecord(n) && typeof n.type === 'string' ? scrubNode(n as GraphNode, test) : n)) : list);
  const out = stable({ ...raw, nodes: nodes(raw.nodes) });
  return out === stable(raw) ? snapshot : out;
}
