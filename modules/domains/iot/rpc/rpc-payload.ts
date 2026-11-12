/*
 * A catalog command's payload as a JSON template (NB 63-licensed-devices LD-8, P1-P4): the editor's checks and preview, the same rules as
 * the host's `iot_rpc.payload-template` so the drawer says what the host would refuse before saving. Not every MQTT device takes the
 * `{"method", "params"}` envelope; a command may write the whole payload, with `{{name}}` placeholders for its parameters and
 * `{{requestId}}` / `{{expirationTime}}`. A string that is only a placeholder becomes the typed value; inside a longer string the value is
 * text; an optional parameter not sent drops its key (or list element). Nothing is added to the template. Pure.
 */
import type { FieldSchema } from '@/modules/app/SchemaForm/types';
import { fill } from '../format';
import type { IotMessages } from '../messages';

/** The placeholders every template may use besides the command's parameters. */
export const RPC_RESERVED_PLACEHOLDERS = ['requestId', 'expirationTime'] as const;
/** The host's limit on a template, as JSON. */
export const RPC_PAYLOAD_TEMPLATE_MAX_BYTES = 4096;

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]{0,63})\s*\}\}/g;
const ONLY_PLACEHOLDER = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]{0,63})\s*\}\}$/;
const MAX_DEPTH = 16;

/** Every placeholder a template uses, in order of first appearance (string values only, never keys). */
export function rpcTemplatePlaceholders(template: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const x of v.matchAll(PLACEHOLDER)) if (!out.includes(x[1])) out.push(x[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(template);
  return out;
}

function depthOf(v: unknown): number {
  if (Array.isArray(v)) return 1 + Math.max(0, ...v.map(depthOf));
  if (v && typeof v === 'object') return 1 + Math.max(0, ...Object.values(v as Record<string, unknown>).map(depthOf));
  return 0;
}

/**
 * The template the editor's text stands for, or the problem the host would refuse it for: not JSON, larger than 4 KB, nested too deep,
 * a placeholder that is no parameter of the command, or a parameter named like a reserved placeholder.
 */
export function rpcTemplateOf(text: string, paramNames: readonly string[], m: Pick<IotMessages, 'rpcCatalog'>): { template: unknown } | { problem: string } {
  let template: unknown;
  try {
    template = JSON.parse(text);
  } catch {
    return { problem: m.rpcCatalog.jsonInvalid };
  }
  if (depthOf(template) > MAX_DEPTH) return { problem: fill(m.rpcCatalog.payloadTooDeep, { n: MAX_DEPTH }) };
  if (new TextEncoder().encode(JSON.stringify(template)).length > RPC_PAYLOAD_TEMPLATE_MAX_BYTES) {
    return { problem: fill(m.rpcCatalog.payloadTooLarge, { n: RPC_PAYLOAD_TEMPLATE_MAX_BYTES }) };
  }
  const clash = paramNames.find((k) => (RPC_RESERVED_PLACEHOLDERS as readonly string[]).includes(k));
  if (clash) return { problem: fill(m.rpcCatalog.payloadReservedParam, { name: clash }) };
  const unknown = rpcTemplatePlaceholders(template).filter((p) => !paramNames.includes(p) && !(RPC_RESERVED_PLACEHOLDERS as readonly string[]).includes(p));
  if (unknown.length) return { problem: fill(m.rpcCatalog.payloadUnknown, { names: unknown.map((p) => `{{${p}}}`).join(', ') }) };
  return { template };
}

const ABSENT = Symbol('absent');

/** The payload the device receives: the template with its placeholders filled (the host's `renderPayload`). */
export function renderRpcPayload(template: unknown, params: Record<string, unknown>, ctx: { requestId: number; expirationTime: number }): unknown {
  const values: Record<string, unknown> = { ...params, requestId: ctx.requestId, expirationTime: ctx.expirationTime };
  const valueOf = (name: string): unknown => (Object.hasOwn(values, name) && values[name] !== undefined ? values[name] : ABSENT);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const only = ONLY_PLACEHOLDER.exec(v);
      if (only) return valueOf(only[1]);
      return v.replace(PLACEHOLDER, (_x, name: string) => {
        const x = valueOf(name);
        return x === ABSENT ? '' : typeof x === 'string' ? x : JSON.stringify(x);
      });
    }
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== ABSENT);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const r = walk(x);
        if (r !== ABSENT) out[k] = r;
      }
      return out;
    }
    return v;
  };
  const rendered = walk(template);
  return rendered === ABSENT ? null : rendered;
}

/** A sample value per parameter for the preview: the field's default, else one of its type (a choice's first option). */
export function rpcSampleParams(schema: Record<string, FieldSchema>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(schema)) {
    if (f.value !== undefined) { out[k] = f.value; continue; }
    const first = (f.options ?? [])[0];
    switch (f.type) {
      case 'number': out[k] = typeof f.min === 'number' ? f.min : 1; break;
      case 'boolean': out[k] = true; break;
      case 'select': out[k] = first === undefined ? 'a' : typeof first === 'string' ? first : first.value; break;
      case 'multi-select': out[k] = first === undefined ? [] : [typeof first === 'string' ? first : first.value]; break;
      case 'json': out[k] = {}; break;
      default: out[k] = 'text';
    }
  }
  return out;
}

/** A first template: the envelope the platform sends today, written out, so a device that differs only a little is one edit away. */
export function rpcEnvelopeTemplate(method: string, paramNames: readonly string[]): string {
  const params = Object.fromEntries(paramNames.map((k) => [k, `{{${k}}}`]));
  return JSON.stringify({ method: method || 'namespace.verb', ...(paramNames.length ? { params } : {}), expirationTime: '{{expirationTime}}' }, null, 2);
}
