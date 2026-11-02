import { fill } from '../format';
import type { SettingsSchemaNode } from '../types/settings';
import type { SettingsMessages } from './messages';
import { localized, titleCase } from './settings-schema';

/**
 * What makes the firewall, Wi-Fi and LTE editors purpose-built (docs/concepts/iot-device-settings 05, D64) on top of the generic form: the
 * columns of their lists, which lists keep an order, a zone field that offers the zones the firewall has, an "active profile" that offers
 * the APN profiles, bands as checkboxes, a password shown only when the security needs one, and the warning on anything that opens a
 * service to the internet. Each hint is keyed by the property path inside the section and only applies when the device's manifest has
 * that property: the manifest stays the authority on what exists, and a section nobody wrote a preset for gets the generic form.
 */

export interface PresetContext {
  /** The values of the device's sections as they are being edited (the open section) or as they stand (the others). */
  sections: Record<string, Record<string, unknown> | null | undefined>;
  m: SettingsMessages;
  locale?: string;
}

export interface FieldHint {
  /** Offer these values (a select) instead of free text. */
  options?: (ctx: PresetContext, siblings: Record<string, unknown>) => string[] | undefined;
  /** A list of numbers or choices drawn as checkboxes. */
  widget?: 'checkboxes';
  /** Drawn only while this holds on the sibling values (a password only for a security that needs one). */
  visible?: (siblings: Record<string, unknown>) => boolean;
}

export interface ListPreset {
  /** The columns of the list's table, by property name (the first scalar properties otherwise). */
  columns?: string[];
  /** The order of the entries matters (firewall rules run top to bottom): the table offers Move up / Move down. */
  ordered?: boolean;
  /** A warning shown on the row, in the row's drawer and in the save confirmation. */
  warning?: (row: Record<string, unknown>, ctx: PresetContext) => string | null;
  /** Keeps a derived property in step with the row: a rule that opens a service to the internet is marked so (its class is then the
   * manifest's `dangerous`, with the typed confirmation); a person may still mark one by hand. */
  derive?: (row: Record<string, unknown>, ctx: PresetContext, item: SettingsSchemaNode) => Record<string, unknown>;
}

export interface SectionPreset {
  lists?: Record<string, ListPreset>;
  fields?: Record<string, FieldHint>;
}

// ── Labels ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A setting's label: the manifest's title (viewer's language), the kit's word for it, else its name made readable. */
export function fieldLabel(m: SettingsMessages, section: string, key: string, name: string, node: SettingsSchemaNode | undefined, locale?: string): string {
  return localized(node?.title, locale) ?? m.fields[`${section}.${key}`] ?? m.fields[name] ?? titleCase(name);
}

/** A choice in plain words: the kit's word for it at this property, then for the value, else the value. */
export function valueLabel(m: SettingsMessages, section: string, key: string, value: unknown): string {
  const v = String(value);
  return m.values[`${section}.${key}.${v}`] ?? m.values[v] ?? v;
}

// ── The firewall: zones and what reaches the internet ────────────────────────────────────────────────────────────────────

const WAN_NETWORKS = new Set(['wan', 'wan6', 'wwan', 'lte', 'mobile', 'modem']);

export interface ZoneInfo { name: string; wan: boolean }

/** The zones the firewall section has (as edited or as it stands); a zone is the internet side when its name or networks say so. */
export function zonesOf(firewall: Record<string, unknown> | null | undefined): ZoneInfo[] {
  const zones = Array.isArray(firewall?.zones) ? (firewall!.zones as Array<Record<string, unknown>>) : [];
  return zones.filter((z) => typeof z?.name === 'string').map((z) => {
    const nets = Array.isArray(z.networks) ? z.networks.map(String) : [];
    return { name: String(z.name), wan: WAN_NETWORKS.has(String(z.name)) || nets.some((n) => WAN_NETWORKS.has(n)) };
  });
}

export const isWanZone = (name: unknown, zones: ZoneInfo[]): boolean =>
  typeof name === 'string' && (zones.find((z) => z.name === name)?.wan ?? WAN_NETWORKS.has(name));

const enabled = (row: Record<string, unknown>) => row.enabled !== false;
const portText = (m: SettingsMessages, port: unknown) => (port === undefined || port === '' ? m.wan.anyPort : fill(m.wan.port, { port: String(port) }));

/**
 * A rule opens a service to the internet when it is on, accepts traffic from an internet-side zone, and is aimed at the router itself (no
 * destination zone) or names a port; a rule the device marks as such (`exposesWan`) always does.
 */
export function ruleExposesWan(row: Record<string, unknown>, zones: ZoneInfo[]): boolean {
  if (!enabled(row)) return false;
  if (row.exposesWan === true) return true;
  return row.target === 'ACCEPT' && isWanZone(row.src, zones) && (row.dest === undefined || row.dest === '' || row.destPort !== undefined);
}

/** A port forward is from the internet side unless it names another source zone. */
export function redirectExposesWan(row: Record<string, unknown>, zones: ZoneInfo[]): boolean {
  if (!enabled(row)) return false;
  return row.src === undefined || row.src === '' || isWanZone(row.src, zones);
}

const zoneOptions = (ctx: PresetContext) => {
  const names = zonesOf(ctx.sections.firewall).map((z) => z.name);
  return names.length ? names : undefined;
};

// ── The presets ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const SECURITY_NEEDS_KEY = (s: Record<string, unknown>) => s.security === undefined || s.security !== 'open';
const AUTH_NEEDS_PASSWORD = (s: Record<string, unknown>) => s.auth !== undefined && s.auth !== 'none';

export const SECTION_PRESETS: Record<string, SectionPreset> = {
  firewall: {
    lists: {
      zones: { columns: ['name', 'input', 'forward', 'masquerade'] },
      forwardings: { columns: ['src', 'dest'] },
    },
    fields: { 'forwardings.src': { options: zoneOptions }, 'forwardings.dest': { options: zoneOptions } },
  },
  firewall_rules: {
    lists: {
      rules: {
        columns: ['name', 'src', 'dest', 'proto', 'destPort', 'target', 'enabled'],
        ordered: true,
        warning: (row, ctx) => (ruleExposesWan(row, zonesOf(ctx.sections.firewall)) ? fill(ctx.m.wan.rule, { what: portText(ctx.m, row.destPort) }) : null),
        derive: (row, ctx, item) => (item.properties?.exposesWan
          ? (ruleExposesWan({ ...row, exposesWan: false }, zonesOf(ctx.sections.firewall)) ? { ...row, exposesWan: true } : row)
          : row),
      },
    },
    fields: { 'rules.src': { options: zoneOptions }, 'rules.dest': { options: zoneOptions } },
  },
  firewall_redirects: {
    lists: {
      redirects: {
        columns: ['name', 'proto', 'srcDport', 'destIp', 'destPort', 'enabled'],
        ordered: true,
        warning: (row, ctx) => (redirectExposesWan(row, zonesOf(ctx.sections.firewall)) ? fill(ctx.m.wan.redirect, { what: portText(ctx.m, row.srcDport ?? row.destPort) }) : null),
        derive: (row, ctx, item) => (item.properties?.exposesWan
          ? (redirectExposesWan(row, zonesOf(ctx.sections.firewall)) ? { ...row, exposesWan: true } : row)
          : row),
      },
    },
    fields: { 'redirects.src': { options: zoneOptions }, 'redirects.dest': { options: zoneOptions } },
  },
  wifi: {
    lists: {
      radios: { columns: ['band', 'channel', 'width'] },
      ssids: { columns: ['ssid', 'band', 'security', 'hidden', 'guest'] },
    },
    fields: { 'ssids.key': { visible: SECURITY_NEEDS_KEY } },
  },
  lte: {
    lists: {
      apns: { columns: ['name', 'apn', 'auth', 'ipType'] },
    },
    fields: {
      activeApn: {
        options: (ctx) => {
          const apns = Array.isArray(ctx.sections.lte?.apns) ? (ctx.sections.lte!.apns as Array<Record<string, unknown>>) : [];
          const names = apns.map((a) => a?.name).filter((n): n is string => typeof n === 'string' && n !== '');
          return names.length ? names : undefined;
        },
      },
      bands: { widget: 'checkboxes' },
      'apns.password': { visible: AUTH_NEEDS_PASSWORD },
      'apns.username': { visible: AUTH_NEEDS_PASSWORD },
    },
  },
};

export const presetFor = (section: string): SectionPreset => SECTION_PRESETS[section] ?? {};

/** Every warning of a section's values (the lists with a `warning`), for the save confirmation. */
export function sectionWarnings(section: string, values: Record<string, unknown>, ctx: PresetContext): string[] {
  const preset = presetFor(section);
  const out: string[] = [];
  for (const [key, list] of Object.entries(preset.lists ?? {})) {
    if (!list.warning) continue;
    const rows = values[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const w = row && typeof row === 'object' ? list.warning(row as Record<string, unknown>, ctx) : null;
      if (w) out.push(`${typeof (row as Record<string, unknown>).name === 'string' ? `${(row as Record<string, unknown>).name}: ` : ''}${w}`);
    }
  }
  return out;
}
