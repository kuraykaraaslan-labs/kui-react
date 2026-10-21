// The English texts of the diagram editor's panels (palette, inspector, rules, problems, what-if). Pure: no React. Each
// panel takes an optional `messages` prop of the same shape (any part of it) so a host can show them in its language;
// whatever it leaves out stays English. A text that interpolates is a function of its values.

import type { ScadaFamily } from './scada-logic';
import type { SceneSector } from './scada-aliases';

export type DeepPartial<T> = T extends (...a: never[]) => unknown ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** `defaults` with every key `over` sets laid over it (objects merge, anything else replaces; `undefined` keeps the default). */
export function mergeMessages<T extends object>(defaults: T, over?: DeepPartial<T>): T {
  if (!over) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' ? mergeMessages(d as object, v as DeepPartial<object>) : v;
  }
  return out as T;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

export interface PaletteMessages {
  title: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  familyGroup: string;
  sectorGroup: string;
  allFamilies: string;
  allSectors: string;
  recent: string;
  list: string;
  /** The live count under the search ("12 symbols"). */
  count: (n: number) => string;
  none: string;
  /** What a tile does on a click or Enter ("Add Motor pump"). */
  add: (name: string) => string;
  hint: string;
  families: Record<ScadaFamily, string>;
  sectors: Record<SceneSector, string>;
}

export const DEFAULT_PALETTE_MESSAGES: PaletteMessages = {
  title: 'Symbols',
  search: 'Search symbols',
  searchPlaceholder: 'Search: pump, breaker, heat exchanger...',
  clearSearch: 'Clear the search',
  familyGroup: 'Family',
  sectorGroup: 'Sector',
  allFamilies: 'All families',
  allSectors: 'All sectors',
  recent: 'Recent',
  list: 'Symbols',
  count: (n) => (n === 1 ? '1 symbol' : `${n} symbols`),
  none: 'No symbol matches. Try another word, or clear the family and sector.',
  add: (name) => `Add ${name}`,
  hint: 'Click or press Enter to add at the centre of the view, or drag onto the canvas.',
  families: {
    process: 'Process', water: 'Water', network: 'Water network', wastewater: 'Wastewater', oil: 'Drilling and oil', energy: 'Energy',
    sld: 'Single-line', hvac: 'HVAC', isa: 'Instruments (ISA)', instrument: 'Gauges', telecom: 'Telecom', food: 'Food and drink',
    factory: 'Factory', mining: 'Mining', agri: 'Agriculture', city: 'City', line: 'Strip line', connection: 'Connections',
  },
  sectors: {
    process: 'Process', water: 'Water', wastewater: 'Wastewater', oilgas: 'Oil and gas', power: 'Electrical', energy: 'Energy', hvac: 'HVAC',
    instrumentation: 'Instrumentation', telecom: 'Telecom', food: 'Food and drink', factory: 'Factory', mining: 'Mining', agriculture: 'Agriculture', city: 'City',
  },
};
