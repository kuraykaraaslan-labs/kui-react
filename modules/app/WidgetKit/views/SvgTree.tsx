import { createElement, type ReactNode } from 'react';
import type { SvgNode } from './svg-node';

/** `stroke-width` → `strokeWidth`; `aria-*` and `data-*` keep their hyphen. */
const reactName = (k: string) => (/^(aria|data)-/.test(k) ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()));

/** The nodes of a symbol, scene or dial as React elements (the same tree kui-ejs writes as markup). */
export function SvgTree({ nodes }: { nodes: SvgNode[] }): ReactNode {
  return nodes.map((n, i) => {
    const props: Record<string, unknown> = { key: i };
    for (const [k, v] of Object.entries(n.a ?? {})) props[reactName(k)] = v;
    const kids = n.s !== undefined ? n.s : n.c ? <SvgTree nodes={n.c} /> : undefined;
    return createElement(n.t, props, kids);
  });
}
