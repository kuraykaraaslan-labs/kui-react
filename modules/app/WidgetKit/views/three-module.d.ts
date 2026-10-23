// The part of three.js the viewer.model things layer uses, declared here because `three` ships no types and the kit
// does not depend on `@types/three`: three itself is reached as kui-viewer's own dependency (the same instance the
// viewer draws with), loaded lazily by the canvas. A resolved `@types/three` would take precedence over this file.
declare module 'three' {
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): this;
  }
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: { x: number; y: number; z: number }): this;
    clone(): this;
    sub(v: { x: number; y: number; z: number }): this;
    length(): number;
    project(camera: Camera): this;
    applyMatrix4(m: Matrix4): this;
  }
  export class Quaternion {
    constructor(x?: number, y?: number, z?: number, w?: number);
    setFromAxisAngle(axis: Vector3, angle: number): this;
  }
  export class Matrix4 {
    constructor();
    elements: number[];
    identity(): this;
    compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    copy(m: Matrix4): this;
  }
  export class Color {
    constructor(r?: number | string, g?: number, b?: number);
    r: number;
    g: number;
    b: number;
    set(color: number | string): this;
    getHexString(): string;
  }
  export class BufferGeometry {
    translate(x: number, y: number, z: number): this;
    rotateX(angle: number): this;
    rotateY(angle: number): this;
    setFromPoints(points: Vector3[]): this;
    computeBoundingSphere(): void;
    dispose(): void;
  }
  export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number);
  }
  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }
  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }
  export class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number);
  }
  export class ConeGeometry extends BufferGeometry {
    constructor(radius?: number, height?: number, radialSegments?: number);
  }
  export class Material {
    needsUpdate: boolean;
    dispose(): void;
  }
  export class MeshStandardMaterial extends Material {
    constructor(parameters?: { color?: number | string; roughness?: number; metalness?: number });
    color: Color;
  }
  export class MeshBasicMaterial extends Material {
    constructor(parameters?: { color?: number | string });
  }
  export class LineBasicMaterial extends Material {
    constructor(parameters?: { color?: number | string });
  }
  export class Object3D {
    name: string;
    visible: boolean;
    frustumCulled: boolean;
    userData: Record<string, unknown>;
    position: Vector3;
    matrixWorld: Matrix4;
    parent: Object3D | null;
    children: Object3D[];
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    lookAt(x: number | Vector3, y?: number, z?: number): void;
    updateMatrixWorld(force?: boolean): void;
  }
  export class Scene extends Object3D {
    constructor();
  }
  export class Group extends Object3D {
    constructor();
  }
  /** The grid helpers' kind: a raycaster matches a line within `params.Line.threshold` metres, so the pick skips them. */
  export class LineSegments extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
  }
  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    geometry: BufferGeometry;
    material: Material;
  }
  export class InstancedMesh extends Mesh {
    constructor(geometry: BufferGeometry, material: Material, count: number);
    count: number;
    instanceMatrix: { needsUpdate: boolean };
    instanceColor: { needsUpdate: boolean } | null;
    /** The bounds over the instances a raycast tests first; null = computed again on the next raycast. */
    boundingSphere: object | null;
    setMatrixAt(index: number, matrix: Matrix4): void;
    getMatrixAt(index: number, matrix: Matrix4): void;
    setColorAt(index: number, color: Color): void;
    getColorAt(index: number, color: Color): void;
    dispose(): this;
  }
  export class Camera extends Object3D {
    matrixWorldInverse: Matrix4;
    projectionMatrix: Matrix4;
  }
  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    fov: number;
    aspect: number;
    updateProjectionMatrix(): void;
  }
  export interface Intersection {
    distance: number;
    point: Vector3;
    object: Object3D;
    instanceId?: number;
  }
  export class Raycaster {
    constructor();
    setFromCamera(coords: Vector2, camera: Camera): void;
    intersectObjects(objects: Object3D[], recursive?: boolean): Intersection[];
  }
}
