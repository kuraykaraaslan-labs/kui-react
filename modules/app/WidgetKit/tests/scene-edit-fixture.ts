// A small diagram and helpers shared by the scene editor tests (not a test file).
import type { SceneSettings } from '../views/scada-scene-logic';

/** Freezes a value and everything under it, so an edit that writes into its input throws. */
export function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Three symbols in a row joined by two pipes, a title, a zone, a divider, and three rules that name symbols. */
export function smallScene(): SceneSettings {
  return deepFreeze({
    width: 1000, height: 600, scale: 0.6,
    elements: [
      { id: 'tank1', symbol: 'home.tv', x: 100, y: 200, label: 'Feed' },
      { id: 'pump1', symbol: 'home.router', x: 300, y: 200, turn: '0' },
      { id: 'valve1', symbol: 'home.plug.smart', x: 500, y: 200 },
    ],
    links: [
      { from: 'tank1.r', to: 'pump1.l', kind: 'pipe' },
      { from: 'pump1.r', to: 'valve1.l:0.5', kind: 'pipe', id: 'line1' },
    ],
    shapes: [
      { kind: 'text', x: 500, y: 40, text: 'Plant', size: 'l' },
      { kind: 'zone', x: 40, y: 80, w: 560, h: 240, text: 'Zone A' },
      { kind: 'divider', x: 40, y: 400, w: 400, h: 0 },
    ],
    rules: [
      { target: 'pump1', of: '', key: 'running' },
      { target: '*', of: '', key: 'status' },
      { target: 'valve1', of: 'tank1', key: 'value', of2: 'pump1', key2: 'running' },
      { target: 'line1', of: '', key: 'running' },
    ],
  } as SceneSettings);
}
