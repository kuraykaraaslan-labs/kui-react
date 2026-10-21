/** URL-safe id from a name: lower case, accents removed, at most 28 characters. */
export function slug(text: string | undefined, fallback: string): string {
  const s = String(text ?? '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return s || fallback;
}

/** A unique id for a chain or similar: the slug of the name, then `-2`, `-3` … when taken. */
export function newId(used: Iterable<string>, name: string | undefined, fallback = 'item'): string {
  const has = used instanceof Set ? used : new Set(used);
  const base = slug(name, fallback);
  let id = base;
  for (let n = 2; has.has(id); n++) id = base.slice(0, 28 - String(n).length) + '-' + n;
  return id;
}

function nextFree(used: Set<string>, prefix: string, start: number): string {
  for (let i = start; ; i++) if (!used.has(prefix + i)) return prefix + i;
}

/** The next free node id of a list: n1, n2 … Never collides with ids that came from an import. */
export function newNodeId(nodes: { nodeId: string }[], prefix = 'n'): string {
  return nextFree(new Set(nodes.map((n) => n.nodeId)), prefix, nodes.length + 1);
}

/** The next free edge id of a list: e1, e2 … */
export function newEdgeId(edges: { edgeId: string }[], prefix = 'e'): string {
  return nextFree(new Set(edges.map((e) => e.edgeId)), prefix, edges.length + 1);
}

/** The next free group id of a list: g1, g2 … */
export function newGroupId(groups: { groupId: string }[]): string {
  return nextFree(new Set(groups.map((g) => g.groupId)), 'g', groups.length + 1);
}

/** Deep copy through JSON; undefined stays undefined. */
export function clone<T>(value: T): T {
  return value === undefined || value === null ? value : (JSON.parse(JSON.stringify(value)) as T);
}
