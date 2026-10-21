import type { BlockDecl, BlockRisk, BlockVisual, Catalog, CatalogGroup, OutputsSpec, ParamSpec } from './types';

/** one block as it is written in a blocks.d file of roltek-automation-1 */
export type RawBlock = Partial<Omit<BlockDecl, 'params' | 'outputs'>> & {
  type: string;
  params?: Record<string, ParamSpec>;
  outputs?: OutputsSpec;
  icon?: string;
};

export type RawBlockFile = { blocks: RawBlock[] };

const NO_INPUT = new Set(['trigger', 'config', 'note']);

const DEFAULT_OUTPUTS: Record<string, string[]> = {
  trigger: ['out'], cond: ['yes', 'no'], logic: ['out'], action: ['out'], ui: ['out'], config: [], flow: [], note: [],
};

/** header tint and icon colour per category, in kui tokens */
const CATEGORY_VISUAL: Record<string, BlockVisual> = {
  trigger: { iconColor: 'text-primary', headerBg: 'bg-primary-subtle' },
  cond: { iconColor: 'text-warning', headerBg: 'bg-warning-subtle' },
  logic: { iconColor: 'text-secondary', headerBg: 'bg-secondary-subtle' },
  action: { iconColor: 'text-success-fg', headerBg: 'bg-success-subtle' },
  ui: { iconColor: 'text-info', headerBg: 'bg-info-subtle' },
  flow: { iconColor: 'text-secondary', headerBg: 'bg-secondary-subtle' },
};
const RISKY_VISUAL: BlockVisual = { iconColor: 'text-error', headerBg: 'bg-error-subtle' };
const RISKY = new Set<BlockRisk>(['external', 'control', 'system', 'code']);

export const ROLTEK_GROUPS: CatalogGroup[] = [
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'function', label: 'Function' },
  { id: 'network', label: 'Network' },
  { id: 'storage', label: 'Storage' },
  { id: 'lora', label: 'LoRa' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'debug', label: 'Debug' },
  { id: 'flow', label: 'Flows' },
];

export function categoryOf(type: string): string {
  return type.split('.')[0];
}

/** Visual of a block: red header for risky blocks, otherwise the tint of its category. */
export function visualOf(decl: Pick<BlockDecl, 'type' | 'category' | 'risk' | 'visual'>): BlockVisual {
  if (decl.visual?.headerBg) return decl.visual;
  const base = decl.risk && RISKY.has(decl.risk) ? RISKY_VISUAL : CATEGORY_VISUAL[decl.category ?? categoryOf(decl.type)] ?? CATEGORY_VISUAL.logic;
  return { ...base, ...decl.visual };
}

function fillBlock(raw: RawBlock): BlockDecl {
  const category = raw.category ?? categoryOf(raw.type);
  const { icon, ...rest } = raw;
  const decl: BlockDecl = {
    ...rest,
    type: raw.type,
    title: raw.title ?? raw.type,
    category,
    group: raw.group ?? (category === 'trigger' ? 'input' : category === 'action' ? 'output' : 'function'),
    inputs: raw.inputs ?? (NO_INPUT.has(category) ? 0 : 1),
    outputs: raw.outputs ?? DEFAULT_OUTPUTS[category] ?? ['out'],
    params: raw.params ?? {},
    visual: { ...raw.visual, iconName: icon ?? raw.visual?.iconName },
  };
  decl.visual = visualOf(decl);
  // the code of the router's script block uses the automation script API: its field shows the signature, its help lists the API
  const code = decl.params?.code;
  if (raw.type === 'logic.script' && code?.type === 'code' && code.lang === 'js' && !code.api) decl.params = { ...decl.params, code: { ...code, api: 'automation-script' } };
  return decl;
}

/**
 * Builds a catalog from block declarations in the roltek-automation-1 shape (the contents of the
 * blocks.d files). Missing fields get the defaults the router gives them: category from the type
 * prefix, inputs and outputs per category, a tinted visual.
 */
export function catalogFromBlocks(files: (RawBlockFile | RawBlock[])[], options: { groups?: CatalogGroup[] } = {}): Catalog {
  const blocks: Record<string, BlockDecl> = {};
  for (const file of files) {
    for (const raw of Array.isArray(file) ? file : file.blocks) blocks[raw.type] = fillBlock(raw);
  }
  return { blocks, groups: options.groups ?? ROLTEK_GROUPS, errorPort: true };
}
