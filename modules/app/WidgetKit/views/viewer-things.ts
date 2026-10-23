// The things of viewer.model in three.js terms (no React, no DOM): one InstancedMesh per kind, the instance matrices
// and colours written in place when the rows change, the pulse of the alarm ones, the pick of the thing under a
// pointer, and the nearest things for the labels. The three.js module is handed in by the canvas (loaded lazily, the
// viewer's own instance), never imported here, so the file stays importable anywhere and testable with a stub scene.

import type * as THREE from 'three';
import type { ThingKind, ThingMarker } from './viewer-model-logic';

/** The three.js module (its classes), as the canvas loads it. */
export type ThreeLib = typeof import('three');
/** A point in the scene frame (the viewer subtracts its origin shift from every world position). */
export interface Point3 { x: number; y: number; z: number }
/** What the things layer needs of the scene: adding and removing its meshes. */
export interface SceneLike { add(object: THREE.Object3D): unknown; remove(object: THREE.Object3D): unknown }

interface KindMeshes {
  mesh: THREE.InstancedMesh;
  /** Instances allocated; the mesh is rebuilt only when a kind outgrows it. */
  capacity: number;
  /** The thing drawn by each instance, in instance order. */
  things: ThingMarker[];
}

export interface ThingMeshState {
  byKind: Map<ThingKind, KindMeshes>;
  geometries: Map<ThingKind, THREE.BufferGeometry>;
  material: THREE.MeshStandardMaterial | null;
  /** Resolved colours by CSS text (a theme token resolves once per theme, not once per thing). */
  colors: Map<string, THREE.Color>;
}

export const newThingMeshState = (): ThingMeshState => ({ byKind: new Map(), geometries: new Map(), material: null, colors: new Map() });

/** The name of a kind's mesh in the scene (the viewer's helpers are named the same way). */
export const thingMeshName = (kind: ThingKind) => `widget-kit:things:${kind}`;

/**
 * The unit shape of a kind: 1 m along its long side, standing on the origin (nothing below its point), looking down
 * −Z, which the heading then turns. A box is a little longer than wide so a heading reads; a pin is a cone on its tip.
 */
export function thingGeometry(three: ThreeLib, kind: ThingKind): THREE.BufferGeometry {
  switch (kind) {
    case 'sphere': return new three.SphereGeometry(0.5, 16, 12).translate(0, 0.5, 0);
    case 'cylinder': return new three.CylinderGeometry(0.4, 0.4, 1, 16).translate(0, 0.5, 0);
    case 'pin': return new three.ConeGeometry(0.35, 1, 12).rotateX(Math.PI).translate(0, 0.5, 0);
    default: return new three.BoxGeometry(0.6, 0.5, 1).translate(0, 0.25, 0);
  }
}

/** A heading in degrees (0 = north = −Z, clockwise seen from above) as the turn about the up axis. */
export const headingRadians = (deg: number): number => (-(Number.isFinite(deg) ? deg : 0) * Math.PI) / 180;

/** The instance matrix of a thing: placed in the scene frame, turned by its heading, scaled to its size (times `pulse`). */
export function thingMatrix(three: ThreeLib, t: ThingMarker, origin: Point3, out: THREE.Matrix4, pulse = 1): THREE.Matrix4 {
  const p = new three.Vector3(t.position[0] - origin.x, t.position[1] - origin.y, t.position[2] - origin.z);
  const q = new three.Quaternion().setFromAxisAngle(new three.Vector3(0, 1, 0), headingRadians(t.heading));
  const s = Math.max(0.01, t.size) * pulse;
  return out.compose(p, q, new three.Vector3(s, s, s));
}

/** A thing's colour as a three.js colour, resolved from its CSS text once (`resolve` turns a token into `#rrggbb`; null = white). */
function colorOf(three: ThreeLib, state: ThingMeshState, css: string, resolve: (css: string) => string | null): THREE.Color {
  const cached = state.colors.get(css);
  if (cached) return cached;
  const hex = resolve(css);
  const color = hex ? new three.Color(hex) : new three.Color(1, 1, 1);
  state.colors.set(css, color);
  return color;
}

/**
 * Writes the things into the scene: one instanced mesh per kind, allocated with headroom (a power of two, at least 16)
 * and rebuilt only when a kind outgrows it or disappears; every instance's position, heading, size and colour written
 * in place. `origin` is the viewer's origin shift (scene = world − origin); `resolve` turns a CSS colour into `#rrggbb`.
 */
export function syncThingMeshes(
  three: ThreeLib, scene: SceneLike, state: ThingMeshState, things: ThingMarker[], origin: Point3, resolve: (css: string) => string | null,
): void {
  // One material for every kind; the instance colours tint it (white, so a colour shows as itself).
  const material = state.material ?? new three.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
  state.material = material;
  const groups = new Map<ThingKind, ThingMarker[]>();
  for (const t of things) {
    const g = groups.get(t.kind);
    if (g) g.push(t); else groups.set(t.kind, [t]);
  }
  for (const [kind, km] of state.byKind) {
    if (groups.has(kind)) continue;
    scene.remove(km.mesh);
    km.mesh.dispose();
    state.byKind.delete(kind);
  }
  const m = new three.Matrix4();
  for (const [kind, list] of groups) {
    let km = state.byKind.get(kind);
    if (!km || km.capacity < list.length) {
      if (km) { scene.remove(km.mesh); km.mesh.dispose(); }
      let geometry = state.geometries.get(kind);
      if (!geometry) { geometry = thingGeometry(three, kind); state.geometries.set(kind, geometry); }
      const capacity = Math.max(16, 2 ** Math.ceil(Math.log2(list.length)));
      const mesh = new three.InstancedMesh(geometry, material, capacity);
      mesh.name = thingMeshName(kind);
      // The instances move with the data: a bounding sphere computed once would cull them later.
      mesh.frustumCulled = false;
      // The viewer's re-tiling moves its children by the shift; this layer places itself from the origin it is given.
      mesh.userData.rtcOptOut = true;
      scene.add(mesh);
      km = { mesh, capacity, things: [] };
      state.byKind.set(kind, km);
    }
    km.mesh.count = list.length;
    km.things = list;
    for (let i = 0; i < list.length; i++) {
      km.mesh.setMatrixAt(i, thingMatrix(three, list[i], origin, m));
      km.mesh.setColorAt(i, colorOf(three, state, list[i].color, resolve));
    }
    km.mesh.instanceMatrix.needsUpdate = true;
    if (km.mesh.instanceColor) km.mesh.instanceColor.needsUpdate = true;
    // A raycast tests the bounds over the instances first, and three computes them once: moved things need new ones.
    km.mesh.boundingSphere = null;
  }
}

/** Whether any drawn thing pulses (the canvas then runs a frame loop). */
export function hasPulsingThings(state: ThingMeshState): boolean {
  for (const km of state.byKind.values()) if (km.things.some((t) => t.alarm)) return true;
  return false;
}

/** Rescales the pulsing things to `pulse` (1 = their size); true when any changed. */
export function pulseThingMeshes(three: ThreeLib, state: ThingMeshState, origin: Point3, pulse: number): boolean {
  let any = false;
  const m = new three.Matrix4();
  for (const km of state.byKind.values()) {
    let touched = false;
    km.things.forEach((t, i) => {
      if (!t.alarm) return;
      km.mesh.setMatrixAt(i, thingMatrix(three, t, origin, m, pulse));
      touched = true;
    });
    if (touched) { km.mesh.instanceMatrix.needsUpdate = true; km.mesh.boundingSphere = null; any = true; }
  }
  return any;
}

/** The id of the thing under a pointer; `ndc` is the pointer in normalised device coordinates (−1..1, y up). */
export function pickThing(three: ThreeLib, camera: THREE.Camera, state: ThingMeshState, ndc: { x: number; y: number }): string | null {
  const kinds = [...state.byKind.values()];
  if (!kinds.length) return null;
  const ray = new three.Raycaster();
  ray.setFromCamera(new three.Vector2(ndc.x, ndc.y), camera);
  for (const hit of ray.intersectObjects(kinds.map((k) => k.mesh), false)) {
    const km = kinds.find((k) => k.mesh === hit.object);
    if (km && hit.instanceId !== undefined && hit.instanceId < km.things.length) return km.things[hit.instanceId].id;
  }
  return null;
}

/** Takes every mesh out of the scene and frees what the layer made. */
export function disposeThingMeshes(scene: SceneLike, state: ThingMeshState): void {
  for (const km of state.byKind.values()) { scene.remove(km.mesh); km.mesh.dispose(); }
  state.byKind.clear();
  for (const g of state.geometries.values()) g.dispose();
  state.geometries.clear();
  state.material?.dispose();
  state.material = null;
  state.colors.clear();
}

/** The `n` labelled things nearest the eye (both in the scene frame), nearest first. */
export function nearestThings(things: ThingMarker[], eye: Point3, origin: Point3, n: number): ThingMarker[] {
  const labelled = things.filter((t) => t.label);
  if (labelled.length <= n) return labelled;
  const d2 = (t: ThingMarker) => {
    const dx = t.position[0] - origin.x - eye.x;
    const dy = t.position[1] - origin.y - eye.y;
    const dz = t.position[2] - origin.z - eye.z;
    return dx * dx + dy * dy + dz * dz;
  };
  return labelled.map((t) => ({ t, d: d2(t) })).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.t);
}
