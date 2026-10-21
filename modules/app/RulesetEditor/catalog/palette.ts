import { FLOW_INPUT } from '../graph/types';
import type { BlockDecl, Catalog, CatalogGroup } from './types';

export type PaletteGroup = CatalogGroup & { blocks: BlockDecl[] };

/**
 * Blocks a user can add, as palette groups in catalog order. Optionally filtered by a search text. The `trigger.flow_input`
 * block is never offered: every flow has its one fixed Flow input already.
 */
export function paletteGroups(catalog: Catalog, search = ''): PaletteGroup[] {
  const needle = search.trim().toLowerCase();
  const matches = (block: BlockDecl) =>
    !needle || [block.title, block.description ?? '', block.type].some((text) => text.toLowerCase().includes(needle));
  const visible = Object.values(catalog.blocks).filter((block) => !block.internal && block.type !== FLOW_INPUT && matches(block));
  const known = new Set(catalog.groups.map((group) => group.id));
  const groups: PaletteGroup[] = catalog.groups.map((group) => ({
    ...group,
    blocks: visible.filter((block) => block.group === group.id),
  }));
  // blocks of a group the catalog does not list still show up, at the end
  const stray = [...new Set(visible.filter((block) => !known.has(block.group ?? '')).map((block) => block.group ?? 'other'))];
  for (const id of stray) {
    groups.push({ id, label: id.charAt(0).toUpperCase() + id.slice(1), blocks: visible.filter((block) => (block.group ?? 'other') === id) });
  }
  return groups.filter((group) => group.blocks.length > 0);
}
