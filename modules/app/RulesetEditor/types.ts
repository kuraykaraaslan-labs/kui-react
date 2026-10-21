import { z } from 'zod';

/** an id: any non-empty text (the same rule the domain types use) */
const IdSchema = z.string().min(1);

/* =========================================================
   RULE ENGINE
========================================================= */

export const RuleNodeTypeEnum = z.enum([
  'TRIGGER',    // Entry point — inbound MQTT / HTTP / schedule
  'FILTER',     // Boolean gate — passes or blocks messages
  'SWITCH',     // Multi-way router based on attribute / value
  'TRANSFORM',  // Reshapes or enriches payload inline
  'ACTION',     // Terminal side-effect (send alert, publish MQTT)
  'DELAY',      // Holds message for a configured duration
  'ALARM',      // Creates or clears a device alarm
  'ENRICHMENT', // Fetches external context and merges into message
  'REST_API',   // Outbound HTTP call to external service
  'SAVE_TS',    // Persists telemetry to the time-series database
  'PLACEHOLDER', // Imported node whose type does not exist here — keeps its wires, does nothing
]);

/** What an imported node was before it became a placeholder. */
export const RuleNodeOriginalSchema = z.object({
  /** original node type, e.g. `mqtt in` (Node-RED) or `MODBUS_READ` */
  type: z.string(),
  /** where it came from: `kui` (another kui-ruleset file), `node-red` or `roltek` (a roltek-automation-1 file) */
  source: z.enum(['kui', 'node-red', 'roltek']).optional(),
  /** the original settings, shown read-only */
  settings: z.unknown().optional(),
  /** input / output port ids, so the imported wires stay attached */
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
});

export const RuleNodeSchema = z.object({
  nodeId: IdSchema,
  /** a built-in type (see `RuleNodeTypeEnum`) or any block type of the catalog the editor is given */
  type: z.string(),
  label: z.string(),
  /** a note about the block, at most 500 characters; the `roltek-automation-1` file does not carry it yet (the export leaves it out and says so) */
  description: z.string().max(500).optional(),
  x: z.number(),
  y: z.number(),
  script: z.string().optional(),
  /** node settings (endpoint, credentials…); keys that look like secrets are left out of exports */
  config: z.record(z.string(), z.unknown()).optional(),
  /** the version of its block the node's settings were made for (`BlockDecl.version`); carried unchanged so a host can migrate an older node */
  v: z.number().int().min(1).optional(),
  /** a disabled node stops messages but keeps its wires */
  disabled: z.boolean().optional(),
  /** only for `PLACEHOLDER` nodes */
  original: RuleNodeOriginalSchema.optional(),
});

export const RuleEdgeSchema = z.object({
  edgeId: IdSchema,
  sourceNodeId: IdSchema,
  sourcePort: z.string(),
  targetNodeId: IdSchema,
  targetPort: z.string(),
});

/** A named, coloured frame around some nodes of a chain. */
export const RuleGroupSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  /** index of one of the eight group colours */
  color: z.number().int().min(0).max(7),
  nodeIds: z.array(z.string()),
});

export const RuleChainSchema = z.object({
  chainId: IdSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  active: z.boolean().default(false),
  nodes: z.array(RuleNodeSchema),
  edges: z.array(RuleEdgeSchema),
  groups: z.array(RuleGroupSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});


export type RuleNodeType = z.infer<typeof RuleNodeTypeEnum>;
export type RuleNode = z.infer<typeof RuleNodeSchema>;
export type RuleNodeOriginal = z.infer<typeof RuleNodeOriginalSchema>;
export type RuleEdge = z.infer<typeof RuleEdgeSchema>;
export type RuleGroup = z.infer<typeof RuleGroupSchema>;
export type RuleChain = z.infer<typeof RuleChainSchema>;
