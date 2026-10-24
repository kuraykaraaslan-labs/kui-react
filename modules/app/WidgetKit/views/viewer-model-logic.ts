// The pure logic of viewer.model (no React, no DOM): its settings, the shapes of a sensor marker and of a thing, the
// things built from table rows (one row = one object standing on its point, drawn as a simple instanced shape), and
// the rules that colour, hide, label, pulse, resize or lift markers and things from their rows or the board's
// parameters. `ViewerModelView.tsx` builds the markers (`buildSensors` needs the table's cell texts) and draws the
// card; `ViewerModelCanvas.tsx` draws the 3D scene with `viewer-things.ts`.

import { cssColor, rangeFor, type RangeEdges } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { SlotData } from '../kind';
import { matchValue, num, statusColor, type ValueColor } from './table-logic';
import { evaluateRules, type EffectSpec } from './scene-rules-logic';
import type { CameraPreset, PatchView, ScenePatch } from './scene-patch';

export type Row = Record<string, unknown>;

/** The simple shapes a thing is drawn as (one instanced mesh each). */
export const THING_KINDS = ['box', 'sphere', 'cylinder', 'pin'] as const;
export type ThingKind = (typeof THING_KINDS)[number];

export type ViewerModelSettings = {
  models?: Array<{ url?: string; label?: string; visible?: boolean }>;
  idColumn?: string;
  labelColumn?: string;
  xColumn?: string;
  yColumn?: string;
  zColumn?: string;
  coordinates?: 'z-up' | 'y-up';
  valueColumn?: string;
  unitColumn?: string;
  markerSize?: number;
  pulseAlarms?: boolean;
  colorBy?: 'fixed' | 'column' | 'ranges';
  markerColor?: string;
  colorColumn?: string;
  valueColors?: ValueColor[];
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  legend?: boolean;
  legendPosition?: 'bottomleft' | 'bottomright' | 'topleft' | 'topright';
  showSensorLabels?: boolean;
  labelContent?: 'label' | 'value' | 'both';
  tooltipTrigger?: 'hover' | 'click' | 'none';
  tooltipColumns?: string[];
  background?: string;
  showNavCube?: boolean;
  showGrid?: boolean;
  cameraPreset?: 'iso' | 'top' | 'front';
  autoFitOnLoad?: boolean;
  interactive?: boolean;
  scrollZoom?: boolean;
  // Version 2: things and rules.
  thingIdColumn?: string;
  thingKindColumn?: string;
  thingKind?: ThingKind;
  thingXColumn?: string;
  thingYColumn?: string;
  thingZColumn?: string;
  thingHeadingColumn?: string;
  thingLabelColumn?: string;
  thingSize?: number;
  thingSizeColumn?: string;
  showThingLabels?: boolean;
  rules?: unknown;
};
type S = ViewerModelSettings;

/** At most this many models: one card is a federated view, not a model library. */
export const MAX_MODELS = 8;
/** At most this many sensor markers: they are DOM nodes moved every camera frame. */
export const MAX_SENSORS = 200;
/** At most this many fields in a tooltip. */
export const MAX_TOOLTIP_FIELDS = 6;
/** At most this many things: instances of a handful of meshes, never a DOM node each. */
export const MAX_THINGS = 2000;
/** Only the nearest things carry a DOM label. */
export const MAX_THING_LABELS = 200;
/** A thing's long side when neither the settings nor the row say (metres). */
export const DEFAULT_THING_SIZE = 0.5;

export interface SensorMarker {
  id: string;
  /** World position (Y up, metres), before the viewer's own origin shift. */
  position: [number, number, number];
  label?: string;
  /** The formatted reading with its unit. */
  valueText?: string;
  color: string;
  /** The colour is the error tone (pulses when `pulseAlarms`), or a rule asked for the pulse. */
  alarm: boolean;
  /** A rule's size for this marker (px); absent = the `markerSize` setting. */
  size?: number;
  tooltip: { title: string; description?: string; fields: Array<{ label: string; value: string }> };
  /** The table row the marker came from (a click reports it). */
  row: Row;
}

export interface ThingMarker {
  id: string;
  kind: ThingKind;
  /** World position of the point the thing stands on (Y up, metres), before the viewer's own origin shift. */
  position: [number, number, number];
  /** Degrees, 0 = north (the model's +Y side, world −Z), clockwise seen from above. */
  heading: number;
  label?: string;
  color: string;
  /** Pulses (an alarm colour, or a rule asked for it). */
  alarm: boolean;
  /** The long side, in metres. */
  size: number;
  /** The table row the thing came from (a click reports it). */
  row: Row;
}

/** A point in the viewer's world (three.js, Y up). IFC model coordinates are Z up: (x, y, z) → (x, z, −y). */
export function toWorld(p: [number, number, number], coordinates: S['coordinates'] = 'z-up'): [number, number, number] {
  return coordinates === 'y-up' ? p : [p[0], p[2], -p[1]];
}

/** A row's own colour under the colour settings (a status column with its words, or ranges on the reading); undefined = the fixed colour. */
export function rowColor(row: Row, s: S): string | undefined {
  if ((s.colorBy ?? 'column') === 'column') {
    if (!s.colorColumn) return undefined;
    const raw = row[s.colorColumn];
    return cssColor(matchValue(raw, s.valueColors)?.color) ?? statusColor(raw);
  }
  if (s.colorBy === 'ranges' && s.valueColumn) return cssColor(rangeFor(row[s.valueColumn], s.ranges, s.rangeEdges ?? 'from')?.color);
  return undefined;
}

export const isThingKind = (v: unknown): v is ThingKind => typeof v === 'string' && (THING_KINDS as readonly string[]).includes(v);

const positive = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== null && n > 0 ? n : undefined;
};

/**
 * Table rows → things. A row without three finite coordinates is skipped (never placed at the origin); its kind comes
 * from the kind column (any case) or the fixed kind, its colour the way a marker's does, its size from the size column
 * or the fixed size. Capped at `MAX_THINGS`; past it the rest are not drawn.
 */
export function buildThings(slot: SlotData | undefined, settings: Sparse): { things: ThingMarker[]; rows: Map<string, Row> } {
  const s = settings as S;
  const fixedKind: ThingKind = isThingKind(s.thingKind) ? s.thingKind : 'box';
  const fixedSize = positive(s.thingSize) ?? DEFAULT_THING_SIZE;
  const fixedColor = cssColor(s.markerColor) ?? 'var(--primary)';
  const idCol = s.thingIdColumn;
  const kindCol = s.thingKindColumn;
  const things: ThingMarker[] = [];
  const rows = new Map<string, Row>();
  (slot?.rows ?? []).forEach((row, i) => {
    if (things.length >= MAX_THINGS) return;
    const x = num(row[s.thingXColumn || 'x']);
    const y = num(row[s.thingYColumn || 'y']);
    const z = num(row[s.thingZColumn || 'z']);
    if (x === null || y === null || z === null) return;
    const rawId = idCol && row[idCol] != null && row[idCol] !== '' ? String(row[idCol]) : String(i);
    const id = rows.has(rawId) ? `${rawId}#${i}` : rawId;
    rows.set(id, row);
    const kindWord = kindCol && typeof row[kindCol] === 'string' ? (row[kindCol] as string).trim().toLowerCase() : undefined;
    const label = s.thingLabelColumn && row[s.thingLabelColumn] != null && row[s.thingLabelColumn] !== '' ? String(row[s.thingLabelColumn]) : undefined;
    const color = rowColor(row, s) ?? fixedColor;
    things.push({
      id,
      kind: isThingKind(kindWord) ? kindWord : fixedKind,
      position: toWorld([x, y, z], s.coordinates),
      heading: num(s.thingHeadingColumn ? row[s.thingHeadingColumn] : undefined) ?? 0,
      ...(label !== undefined ? { label } : {}),
      color,
      alarm: color === 'var(--error)',
      size: (s.thingSizeColumn ? positive(row[s.thingSizeColumn]) : undefined) ?? fixedSize,
      row,
    });
  });
  return { things, rows };
}

// ── Rules on markers and things ───────────────────────────────────────────────

/** The viewer's rule effects: a colour, hidden, a label with tokens, a pulse, a size (px for a marker, m for a thing) and a lift (m). */
export const VIEWER_RULE_EFFECTS: EffectSpec = {
  color: { kind: 'color' },
  hidden: { kind: 'flag' },
  pulse: { kind: 'flag' },
  size: { kind: 'number', min: 0, max: 10_000 },
  dz: { kind: 'number', min: -100_000, max: 100_000 },
  label: { kind: 'label' },
};

/** What the viewer's rules decided for one marker or thing. A missing key means "no rule said anything". */
export interface ViewerEffects {
  color?: string;
  hidden?: boolean;
  pulse?: boolean;
  size?: number;
  dz?: number;
  /** The text with its tokens already filled in. */
  label?: string;
}

const lift = (p: [number, number, number], dz: number | undefined): [number, number, number] => (dz ? [p[0], p[1] + dz, p[2]] : p);

/**
 * Markers and things with per-id effects laid over them (the rules' or a patch's): a hidden one is gone, a coloured one
 * takes the colour (and pulses only when told so or the colour is the error tone), a labelled one shows the text, a
 * sized one its size, a lifted one stands `dz` metres higher. An id with no effects is returned as it was.
 */
export function applyViewerEffects(
  sensors: SensorMarker[], things: ThingMarker[], fx: ReadonlyMap<string, ViewerEffects>,
): { sensors: SensorMarker[]; things: ThingMarker[] } {
  if (fx.size === 0) return { sensors, things };
  const alarmOf = (e: ViewerEffects, color: string, was: boolean) => e.pulse ?? (e.color !== undefined ? color === 'var(--error)' : was);
  return {
    sensors: sensors.flatMap((m) => {
      const e = fx.get(m.id);
      if (!e) return [m];
      if (e.hidden) return [];
      const color = e.color ?? m.color;
      return [{
        ...m, color, alarm: alarmOf(e, color, m.alarm), position: lift(m.position, e.dz),
        ...(e.label !== undefined ? { label: e.label } : {}),
        ...(e.size !== undefined ? { size: e.size } : {}),
      }];
    }),
    things: things.flatMap((t) => {
      const e = fx.get(t.id);
      if (!e) return [t];
      if (e.hidden) return [];
      const color = e.color ?? t.color;
      return [{
        ...t, color, alarm: alarmOf(e, color, t.alarm), position: lift(t.position, e.dz),
        ...(e.label !== undefined ? { label: e.label } : {}),
        ...(e.size !== undefined && e.size > 0 ? { size: e.size } : {}),
      }];
    }),
  };
}

/**
 * The markers and things after the rules (`applyViewerEffects`). The rows of both tables are the rule context (a
 * thing and a marker with the same id share it); `params` are the effective board parameters.
 */
export function applyViewerRules(
  sensors: SensorMarker[], things: ThingMarker[], rules: unknown, params?: Record<string, unknown>,
): { sensors: SensorMarker[]; things: ThingMarker[] } {
  if (!Array.isArray(rules) || rules.length === 0 || (sensors.length === 0 && things.length === 0)) return { sensors, things };
  const rows = new Map<string, Row>();
  for (const t of things) rows.set(t.id, t.row);
  for (const m of sensors) rows.set(m.id, m.row);
  // `things:*` names the things (a marker that shares a thing's id shares its effects, as it shares its row).
  const fx = evaluateRules<ViewerEffects>(rules, {
    rows, params: params ?? {}, targets: [...rows.keys()], thingIds: things.map((t) => t.id), effects: VIEWER_RULE_EFFECTS,
  });
  return applyViewerEffects(sensors, things, fx);
}

// ── The scene patch (phase 35, E15) ──────────────────────────────────────────

/**
 * A patch's overrides on markers and things, applied after the rules so a script wins over a rule: colour, hidden,
 * label (plain text), pulse, size and lift, by id. The 2D effects and a designer item's `params` mean nothing here.
 * The patch's things replace the things table's rows before this (`buildThings` over `patch.things`).
 */
export function applyViewerPatch(
  sensors: SensorMarker[], things: ThingMarker[], patch: ScenePatch | null | undefined,
): { sensors: SensorMarker[]; things: ThingMarker[] } {
  const objects = patch?.objects;
  if (!objects) return { sensors, things };
  const fx = new Map<string, ViewerEffects>();
  for (const [id, o] of Object.entries(objects)) {
    const e: ViewerEffects = {};
    if (o.color !== undefined) e.color = o.color;
    if (o.hidden !== undefined) e.hidden = o.hidden;
    if (o.label !== undefined) e.label = o.label;
    if (o.pulse !== undefined) e.pulse = o.pulse;
    if (o.size !== undefined) e.size = o.size;
    if (o.dz !== undefined) e.dz = o.dz;
    if (Object.keys(e).length) fx.set(id, e);
  }
  return applyViewerEffects(sensors, things, fx);
}

/** What the viewer's camera does for a patch's view: a preset, or a target (model coordinates) and a distance (metres). */
export type ViewerView = { preset: CameraPreset } | { target: [number, number, number]; distance: number };

/** The 3D part of a patch's view (a 2D fit or region means nothing to the viewer): null when there is none. */
export function viewerView(view: PatchView | undefined): ViewerView | null {
  if (!view || typeof view !== 'object') return null;
  if ('preset' in view) return { preset: view.preset };
  if ('target' in view) return { target: view.target, distance: view.distance };
  return null;
}

/** A stable key for a view, so the canvas moves the camera when the view changes and never on every frame. */
export const viewerViewKey = (view: ViewerView | null): string => (view ? JSON.stringify(view) : '');

/**
 * Where the camera goes for a target and a distance: the target (model coordinates, through `toWorld`) becomes the
 * orbit centre and the camera stands `distance` metres from it along `dir` (the current view direction, so the
 * viewer's angle is kept; a zero direction falls back to the isometric one). World coordinates (Y up).
 */
export function cameraForTarget(
  target: [number, number, number], distance: number, dir: [number, number, number], coordinates: S['coordinates'] = 'z-up',
): { position: [number, number, number]; target: [number, number, number] } {
  const centre = toWorld(target, coordinates);
  const len = Math.hypot(...dir);
  const d = len > 1e-9 ? dir.map((v) => v / len) : [1, 0.75, 1].map((v) => v / Math.hypot(1, 0.75, 1));
  return { position: [centre[0] + d[0] * distance, centre[1] + d[1] * distance, centre[2] + d[2] * distance], target: centre };
}
