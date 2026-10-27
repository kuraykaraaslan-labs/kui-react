// Builds the machine-readable component registry from the showcase data + menu.
//
// This is consumed in three places:
//   1. /api/registry — JSON over HTTP
//   2. /llms-full.txt — flattened markdown for AI agents
//   3. public/registry/components.json — static snapshot for offline AI agents
//
// Keep this file deterministic and side-effect-free so it can run on the server.

import { buildShowcaseData } from '@/modules/showcase/data/showcase.data';
import NAV_GROUPS from '@/modules/showcase/data/showcase.menu';
import type {
  Registry,
  RegistryComponent,
  RegistryLayer,
  RegistryTheme,
  RegistryToken,
} from './registry.types';

const REGISTRY_VERSION = '1.0.0';

const LAYER_DESCRIPTIONS: Record<RegistryLayer, string> = {
  ui:
    'modules/ui/ — Primitive, locally-stateful components (atoms + molecules). No business logic. Every file starts with \'use client\' and imports cn from @/libs/utils/cn.',
  app:
    'modules/app/ — Application-level patterns (organisms, page shells, forms, providers). May own local state and orchestrate ui-layer atoms.',
  domain:
    'modules/domains/<vertical>/ — Industry-vertical components that compose ui/ + app/. Each vertical exports a barrel index.ts and a types.ts with Zod schemas.',
  theme:
    'app/theme/<vertical>/ — Full multi-page demos wiring domain components into a realistic product experience. layout.tsx is client, page.tsx is server unless it owns state.',
  library:
    'External npm packages featured in the showcase (e.g. kui-viewer). filePath points to the showcase example, not first-party source; the `external` field carries homepage/npm/github links.',
};

const CONVENTIONS = {
  icons:
    'All icons MUST come from Font Awesome. Named imports only — never the whole set. Apply Tailwind classes via className (e.g. text-primary, w-4 h-4); never use the size prop with raw strings. aria-hidden="true" on decorative icons.',
  styling:
    'Tailwind CSS 4 with CSS-variable design tokens. Use cn() from @/libs/utils/cn for class composition — never raw template literals. Reference token names (bg-primary, text-text-secondary) — never hex.',
  types:
    'Define props inline with a local type. Domain layers use Zod schemas in types.ts. Components export named functions — never default exports (excluding next/dynamic wrappers).',
  accessibility:
    'Use semantic HTML. Apply aria-busy / aria-invalid / aria-describedby / aria-pressed / aria-expanded as relevant. ALWAYS include focus-visible:ring-2 focus-visible:ring-border-focus on interactive elements. Use disabled:opacity-50 disabled:cursor-not-allowed for disabled state.',
  fileNaming:
    'UI/Domain components: PascalCase .tsx. Showcase builders: kebab-case .showcase.tsx. Utilities: camelCase .ts. Domain directories: lowercase.',
  pathAlias:
    '@/ resolves to the project root. Import as: @/modules/ui/<Component>, @/modules/app/<Component>, @/modules/domains/<vertical>, @/libs/utils/cn.',
};

const DESIGN_TOKENS: RegistryToken[] = [
  { name: '--primary',         light: '#3b82f6', purpose: 'Primary actions' },
  { name: '--primary-hover',   light: '#2563eb', purpose: 'Hover state' },
  { name: '--primary-active',  light: '#1d4ed8', purpose: 'Active/pressed' },
  { name: '--primary-subtle',  light: '#eff6ff', purpose: 'Tinted backgrounds' },
  { name: '--primary-fg',      light: '#ffffff', purpose: 'Text on primary' },
  { name: '--secondary',       light: '#8b5cf6', purpose: 'Second palette colour (tints, charts)' },
  { name: '--accent',          light: '#7c3aed', purpose: 'Coloured alternative action (Button accent)' },
  { name: '--accent-fg',       light: '#ffffff', purpose: 'Text on accent' },
  { name: '--surface-base',    light: '#ffffff', purpose: 'Page background' },
  { name: '--surface-raised',  light: '#f9fafb', purpose: 'Cards' },
  { name: '--surface-overlay', light: '#f3f4f6', purpose: 'Hover overlays' },
  { name: '--surface-sunken',  light: '#e5e7eb', purpose: 'Inset areas' },
  { name: '--text-primary',    light: '#111827', purpose: 'Body text' },
  { name: '--text-secondary',  light: '#6b7280', purpose: 'Muted text' },
  { name: '--text-disabled',   light: '#9ca3af', purpose: 'Disabled text' },
  { name: '--text-inverse',    light: '#ffffff', purpose: 'Text on dark bg' },
  { name: '--border',          light: '#e5e7eb', purpose: 'Default borders' },
  { name: '--border-strong',   light: '#d1d5db', purpose: 'Emphasized borders' },
  { name: '--border-focus',    light: '#3b82f6', purpose: 'Focus rings' },
  { name: '--success',         light: '#22c55e', purpose: 'Success state' },
  { name: '--success-subtle',  light: '#f0fdf4', purpose: 'Success background' },
  { name: '--success-fg',      light: '#14532d', purpose: 'Text on success' },
  { name: '--warning',         light: '#f59e0b', purpose: 'Warning state' },
  { name: '--warning-subtle',  light: '#fffbeb', purpose: 'Warning background' },
  { name: '--error',           light: '#ef4444', purpose: 'Error/danger state' },
  { name: '--error-subtle',    light: '#fef2f2', purpose: 'Error background' },
  { name: '--info',            light: '#06b6d4', purpose: 'Informational state' },
  { name: '--info-subtle',     light: '#ecfeff', purpose: 'Info background' },
];

function inferLayer(filePath: string, isExternal: boolean): RegistryLayer {
  if (isExternal) return 'library';
  if (filePath.startsWith('modules/ui/')) return 'ui';
  if (filePath.startsWith('modules/app/')) return 'app';
  if (filePath.startsWith('modules/domains/')) return 'domain';
  return 'ui';
}

function inferDesignTokens(source: string): string[] {
  // Scan source for known token names referenced via Tailwind classes.
  const set = new Set<string>();
  for (const tok of DESIGN_TOKENS) {
    const tail = tok.name.replace(/^--/, '');
    if (source.includes(`bg-${tail}`) ||
        source.includes(`text-${tail}`) ||
        source.includes(`border-${tail}`) ||
        source.includes(`from-${tail}`) ||
        source.includes(`to-${tail}`) ||
        source.includes(`ring-${tail}`) ||
        source.includes(tok.name)) {
      set.add(tok.name);
    }
  }
  return [...set].sort();
}

function findMenuEntry(id: string): { abbr: string; status?: string; since?: string } | undefined {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.id === id) return { abbr: item.abbr, status: item.status, since: item.since };
    }
  }
  return undefined;
}

export function buildRegistry(): Registry {
  const showcase = buildShowcaseData();

  const components: RegistryComponent[] = showcase.map((c) => {
    const menu = findMenuEntry(c.id);
    const layer = inferLayer(c.filePath, Boolean(c.external));
    return {
      id: c.id,
      name: c.title,
      layer,
      category: c.category,
      filePath: c.filePath,
      abbr: c.abbr || menu?.abbr || '??',
      description: c.description,
      source: c.sourceCode,
      variants: c.variants
        .filter((v): v is typeof v & { code: string } => !!v.code)
        .map((v) => ({ title: v.title, code: v.code })),
      status: (c.status ?? (menu?.status as 'stable' | 'beta' | 'deprecated' | undefined) ?? 'stable'),
      since: c.since ?? menu?.since,
      whenToUse: c.whenToUse,
      whenNotToUse: c.whenNotToUse,
      composes: c.composes,
      relatedTo: c.relatedTo,
      a11y: c.a11y,
      designTokens: c.designTokens ?? inferDesignTokens(c.sourceCode),
      dependencies: c.dependencies,
      external: c.external,
    };
  });

  // Compute usedBy (inverse index from composes[]).
  const usedByMap = new Map<string, Set<string>>();
  for (const c of components) {
    for (const dep of c.composes ?? []) {
      if (!usedByMap.has(dep)) usedByMap.set(dep, new Set());
      usedByMap.get(dep)!.add(c.id);
    }
  }
  for (const c of components) {
    const set = usedByMap.get(c.id);
    if (set && set.size > 0) c.usedBy = [...set].sort();
  }

  // Extract themes from menu's 'Themes' group.
  const themes: RegistryTheme[] = [];
  for (const group of NAV_GROUPS) {
    if (group.label !== 'Themes') continue;
    for (const item of group.items) {
      themes.push({
        id: item.id,
        title: item.title,
        route: item.href ?? `/theme/${item.id}`,
        consumesDomain: item.id,
        since: item.since,
        status: (item.status as 'stable' | 'beta' | 'deprecated' | undefined) ?? 'stable',
      });
    }
  }

  return {
    $schema: 'https://kui-react.dev/schemas/registry-v1.json',
    name: 'kui-react',
    version: '0.1.0',
    registryVersion: REGISTRY_VERSION,
    generatedAt: new Date().toISOString(),
    description:
      'Machine-readable catalog of every component, theme, design token, and convention in the kui-react library. Consume this from an AI assistant to know what exists, where it lives, and how to use it.',
    layers: LAYER_DESCRIPTIONS,
    conventions: CONVENTIONS,
    designTokens: DESIGN_TOKENS,
    components,
    themes,
  };
}

/** Lightweight version of the registry that omits sourceCode + variant code,
 *  for use cases where the full source bloat is not needed (~5x smaller). */
export function buildRegistryIndex() {
  const full = buildRegistry();
  return {
    ...full,
    components: full.components.map(({ source, variants, ...rest }) => ({
      ...rest,
      variantCount: variants.length,
    })),
  };
}
