import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { ThingMarker } from '../views/viewer-model-logic';
import {
  disposeThingMeshes, hasPulsingThings, headingRadians, nearestThings, newThingMeshState, pickThing, pulseThingMeshes, syncThingMeshes,
  thingGeometry, thingMatrix, thingMeshName, type SceneLike,
} from '../views/viewer-things';

// The things layer against the real three.js (pure maths, no WebGL): the meshes it makes, how it writes instances in
// place, the pulse, the pick under a pointer and the labels' nearest set.

type Mesh = THREE.InstancedMesh & { count: number };
const sceneOf = () => {
  const children: THREE.Object3D[] = [];
  const scene: SceneLike & { children: THREE.Object3D[] } = {
    children,
    add: (o) => { children.push(o); return scene; },
    remove: (o) => { const i = children.indexOf(o); if (i >= 0) children.splice(i, 1); return scene; },
  };
  return scene;
};
const thing = (id: string, kind: ThingMarker['kind'], x: number, z: number, extra: Partial<ThingMarker> = {}): ThingMarker =>
  ({ id, kind, position: [x, 0, z], heading: 0, color: 'var(--primary)', alarm: false, size: 1, row: { id }, ...extra });
const ORIGIN = { x: 0, y: 0, z: 0 };
const hex = (css: string) => (css === 'var(--error)' ? '#ff0000' : css === 'var(--primary)' ? '#0000ff' : null);
const meshOf = (scene: { children: THREE.Object3D[] }, kind: ThingMarker['kind']) => scene.children.find((c) => c.name === thingMeshName(kind)) as Mesh | undefined;
const box = (g: THREE.BufferGeometry) => {
  const b = g as unknown as { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } };
  b.computeBoundingBox();
  return b.boundingBox;
};

describe('thing geometry', () => {
  it('every kind stands on the origin, one metre long, and is centred side to side', () => {
    for (const kind of ['box', 'sphere', 'cylinder', 'pin'] as const) {
      const b = box(thingGeometry(THREE, kind));
      expect(b.min.y, kind).toBeCloseTo(0, 5);
      expect(b.max.y, kind).toBeGreaterThan(0.4);
      expect(b.max.y, kind).toBeLessThanOrEqual(1.0001);
      expect(b.min.x + b.max.x, kind).toBeCloseTo(0, 5);
      expect(b.min.z + b.max.z, kind).toBeCloseTo(0, 5);
    }
    // a box is longer along its heading (−Z) than wide, so a heading reads
    const b = box(thingGeometry(THREE, 'box'));
    expect(b.max.z - b.min.z).toBeGreaterThan(b.max.x - b.min.x);
  });
  it('a heading is a clockwise turn seen from above: east turns the forward side (−Z) to +X', () => {
    expect(headingRadians(0)).toBe(-0);
    expect(headingRadians(90)).toBeCloseTo(-Math.PI / 2);
    expect(headingRadians(Number.NaN)).toBe(-0);
    const m = thingMatrix(THREE, thing('t', 'box', 0, 0, { heading: 90 }), ORIGIN, new THREE.Matrix4());
    const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(m);
    expect(forward.x).toBeCloseTo(1, 5);
    expect(forward.z).toBeCloseTo(0, 5);
  });
  it('the matrix places a thing in the scene frame (world minus the origin shift), scaled to its size', () => {
    const m = thingMatrix(THREE, thing('t', 'box', 10, -4, { size: 2 }), { x: 1, y: 0, z: 1 }, new THREE.Matrix4());
    const e = m.elements;
    expect([e[12], e[13], e[14]]).toEqual([9, 0, -5]);
    expect(e[0]).toBeCloseTo(2, 5);
    expect(e[5]).toBeCloseTo(2, 5);
  });
});

describe('syncThingMeshes', () => {
  it('makes one instanced mesh per kind, named, with headroom, and writes every instance', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    const resolve = vi.fn(hex);
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('b', 'box', 3, 0, { color: 'var(--error)' }), thing('c', 'pin', 5, 5)], ORIGIN, resolve);
    expect(scene.children.map((c) => c.name).sort()).toEqual([thingMeshName('box'), thingMeshName('pin')]);
    const b = meshOf(scene, 'box')!;
    expect(b.count).toBe(2);
    expect(state.byKind.get('box')!.capacity).toBe(16);
    expect(b.frustumCulled).toBe(false);
    expect(b.userData.rtcOptOut).toBe(true);
    const m = new THREE.Matrix4();
    b.getMatrixAt(1, m);
    expect(m.elements[12]).toBe(3);
    const c = new THREE.Color();
    b.getColorAt(1, c);
    expect(c.getHexString()).toBe('ff0000');
    // a colour resolves once per CSS text
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(b.instanceMatrix.needsUpdate).toBe(true);
  });
  it('writes a changed set in place: the same mesh, moved instances, a kind that left is gone, growth past the headroom rebuilds', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('c', 'pin', 5, 5)], ORIGIN, hex);
    const before = meshOf(scene, 'box')!;
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 7, 0)], ORIGIN, hex);
    expect(meshOf(scene, 'box')).toBe(before);
    expect(meshOf(scene, 'pin')).toBeUndefined();
    const m = new THREE.Matrix4();
    before.getMatrixAt(0, m);
    expect(m.elements[12]).toBe(7);
    const many = Array.from({ length: 40 }, (_, i) => thing(`t${i}`, 'box', i, 0));
    syncThingMeshes(THREE, scene, state, many, ORIGIN, hex);
    const grown = meshOf(scene, 'box')!;
    expect(grown).not.toBe(before);
    expect(grown.count).toBe(40);
    expect(state.byKind.get('box')!.capacity).toBe(64);
    expect(scene.children).toHaveLength(1);
    syncThingMeshes(THREE, scene, state, [], ORIGIN, hex);
    expect(scene.children).toHaveLength(0);
  });
  it('follows the origin shift', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'sphere', 100, 100)], { x: 100, y: 0, z: 100 }, hex);
    const m = new THREE.Matrix4();
    meshOf(scene, 'sphere')!.getMatrixAt(0, m);
    expect([m.elements[12], m.elements[13], m.elements[14]]).toEqual([0, 0, 0]);
  });
  it('disposes everything it made', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('c', 'cylinder', 5, 5)], ORIGIN, hex);
    disposeThingMeshes(scene, state);
    expect(scene.children).toHaveLength(0);
    expect(state.byKind.size).toBe(0);
    expect(state.geometries.size).toBe(0);
    expect(state.material).toBeNull();
  });
});

describe('the pulse', () => {
  it('rescales only the alarm things, and says when nothing pulses', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('b', 'box', 3, 0, { alarm: true, size: 2 })], ORIGIN, hex);
    expect(hasPulsingThings(state)).toBe(true);
    expect(pulseThingMeshes(THREE, state, ORIGIN, 1.5)).toBe(true);
    const m = new THREE.Matrix4();
    const mesh = meshOf(scene, 'box')!;
    mesh.getMatrixAt(0, m);
    expect(m.elements[0]).toBeCloseTo(1, 5);
    mesh.getMatrixAt(1, m);
    expect(m.elements[0]).toBeCloseTo(3, 5);
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0)], ORIGIN, hex);
    expect(hasPulsingThings(state)).toBe(false);
    expect(pulseThingMeshes(THREE, state, ORIGIN, 1.5)).toBe(false);
  });
});

describe('pickThing', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 30, 0.01);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const ndcOf = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return { x: p.x, y: p.y };
  };

  it('finds the thing under a pointer by its instance, and nothing where there is none', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('b', 'box', 6, 0), thing('c', 'pin', -6, 0)], ORIGIN, hex);
    expect(pickThing(THREE, camera, state, ndcOf(0, 0.25, 0))).toBe('a');
    expect(pickThing(THREE, camera, state, ndcOf(6, 0.25, 0))).toBe('b');
    expect(pickThing(THREE, camera, state, ndcOf(-6, 0.5, 0))).toBe('c');
    expect(pickThing(THREE, camera, state, ndcOf(3, 0, 3))).toBeNull();
    expect(pickThing(THREE, camera, newThingMeshState(), { x: 0, y: 0 })).toBeNull();
  });
  it('only drawn instances count: a thing that left the rows is not picked from the headroom', () => {
    const scene = sceneOf();
    const state = newThingMeshState();
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0), thing('b', 'box', 6, 0)], ORIGIN, hex);
    syncThingMeshes(THREE, scene, state, [thing('a', 'box', 0, 0)], ORIGIN, hex);
    expect(pickThing(THREE, camera, state, ndcOf(6, 0.25, 0))).toBeNull();
  });
});

describe('nearestThings', () => {
  it('keeps the labelled things nearest the eye, nearest first, up to the cap', () => {
    const things = [
      thing('far', 'box', 50, 0, { label: 'far' }), thing('near', 'box', 1, 0, { label: 'near' }),
      thing('mid', 'box', 10, 0, { label: 'mid' }), thing('unlabelled', 'box', 0, 0),
    ];
    expect(nearestThings(things, { x: 0, y: 0, z: 0 }, ORIGIN, 2).map((t) => t.id)).toEqual(['near', 'mid']);
    expect(nearestThings(things, { x: 0, y: 0, z: 0 }, ORIGIN, 10).map((t) => t.id)).toEqual(['far', 'near', 'mid']);
    // the eye and the things are in the scene frame: the origin shift applies to the things
    expect(nearestThings(things, { x: -50, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 1).map((t) => t.id)).toEqual(['far']);
  });
});
