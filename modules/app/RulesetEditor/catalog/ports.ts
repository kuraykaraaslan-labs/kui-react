import type { BlockDecl, Catalog, NodePorts, OutputsSpec, PortDef } from './types';
import type { ParamValues } from './params';
import { splitPinNames } from './outputs';

const DEFAULT_MAX_PORTS = 16;

function portOf(decl: BlockDecl | undefined, id: string, label?: string): PortDef {
  return { id, label: decl?.port_labels?.[id] ?? label ?? id };
}

/** Output port ids of a declaration for these param values. */
export function outputIds(outputs: OutputsSpec | undefined, params: ParamValues): string[] {
  if (!outputs) return [];
  if (Array.isArray(outputs)) return outputs;
  const max = outputs.max ?? DEFAULT_MAX_PORTS;
  const prefix = outputs.prefix ?? 'o';
  let count: number;
  if ('count' in outputs) {
    count = parseInt(String(params[outputs.count]), 10) || 1;
  } else {
    const list = params[outputs.dynamic];
    count = Array.isArray(list) ? list.length : 0;
  }
  const ids: string[] = [];
  for (let i = 0; i < count && i < max; i++) ids.push(`${prefix}${i}`);
  return ids.concat('extra' in outputs ? outputs.extra ?? [] : []);
}

/** Display name of a generated port: the label of a rule row, or an entry of the comma list a pins param holds (by position: an empty entry leaves its port unnamed, as the runtime does). */
function generatedLabel(decl: BlockDecl, params: ParamValues, index: number): string | undefined {
  const outputs = decl.outputs;
  if (!outputs || Array.isArray(outputs)) return undefined;
  if ('dynamic' in outputs) {
    const row = (params[outputs.dynamic] as { label?: unknown }[] | undefined)?.[index];
    return typeof row?.label === 'string' && row.label ? row.label : undefined;
  }
  const pinsKey = decl.params?.[outputs.count]?.pins;
  return pinsKey ? splitPinNames(params[pinsKey])[index] || undefined : undefined;
}

/**
 * The ports of a node: fixed or generated outputs, plus an error output for every node with an input
 * when the catalog has errorPort. An unknown type gets one input and one out port.
 */
export function resolvePorts(catalog: Catalog, type: string, params: ParamValues = {}): NodePorts {
  const decl = catalog.blocks[type];
  if (!decl) return { inputs: [{ id: 'in', label: 'in' }], outputs: [{ id: 'out', label: 'out' }] };
  const inputs: PortDef[] = decl.inputs === 0 ? [] : [{ id: 'in', label: decl.port_labels?.in ?? 'in' }];
  const generated = !!decl.outputs && !Array.isArray(decl.outputs);
  const ids = outputIds(decl.outputs, params);
  const outputs = ids.map((id, i) => portOf(decl, id, generated ? generatedLabel(decl, params, i) : undefined));
  if (catalog.errorPort && inputs.length && !ids.includes('error')) outputs.push(portOf(decl, 'error'));
  return { inputs, outputs };
}

/** The part of a node that decides its ports. */
export type PortNode = {
  type: string;
  config?: ParamValues;
  original?: { inputs?: string[]; outputs?: string[] };
};

const toDef = (id: string): PortDef => ({ id, label: id });

/**
 * Ports of a node in a graph. An unsupported node (a placeholder from an import) keeps the ports
 * its wires use; every other node follows its block declaration and its params.
 */
export function nodePortsOf(catalog: Catalog, node: PortNode): NodePorts {
  if (node.type === 'PLACEHOLDER' || node.type === 'unsupported') {
    return {
      inputs: (node.original?.inputs ?? ['in']).map(toDef),
      outputs: (node.original?.outputs ?? []).map(toDef),
    };
  }
  return resolvePorts(catalog, node.type, node.config ?? {});
}
