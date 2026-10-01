import * as THREE from 'three';
import { at } from '../core/util';

export type TelegraphShape = 'circle' | 'cone';

type ActiveTelegraph = {
  /** Root object in the scene (mesh or orientation group) */
  root: THREE.Object3D;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  shape: TelegraphShape;
  /** Total fill duration before flash */
  duration: number;
  age: number;
  /** 0 = filling, 1 = danger flash */
  phase: 0 | 1;
  flashAge: number;
  baseColor: THREE.Color;
  /** Target world scale (circle radius or cone length; geo is unit-sized) */
  targetScale: number;
};

const FLASH_DURATION = 0.12;
const GROUND_Y = 0.06;

/**
 * Ground danger indicators for boss attacks.
 * Semi-transparent mesh grows (fill 0→1) over `duration`, then bright-flashes and removes.
 */
export class BossTelegraph {
  private scene: THREE.Scene;
  private active: ActiveTelegraph[] = [];

  /** Optional hook when any telegraph begins (Game can react — shake, toast, etc.) */
  onTelegraphStart?: (shape: TelegraphShape, duration: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get isActive(): boolean {
    return this.active.length > 0;
  }

  get count(): number {
    return this.active.length;
  }

  /**
   * Ground danger circle that grows from center then flashes.
   * @param center world position (y ignored — pinned to ground)
   * @param radius final radius in world units
   * @param duration fill time in seconds
   */
  showCircle(center: THREE.Vector3, radius: number, duration: number, color = 0xff4400): void {
    const geo = new THREE.CircleGeometry(1, 48);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, GROUND_Y, center.z);
    mesh.scale.setScalar(0.001);
    mesh.renderOrder = 2;
    this.scene.add(mesh);

    this.active.push({
      root: mesh,
      mesh,
      material,
      shape: 'circle',
      duration: Math.max(0.05, duration),
      age: 0,
      phase: 0,
      flashAge: 0,
      baseColor: new THREE.Color(color),
      targetScale: Math.max(0.05, radius),
    });
    this.onTelegraphStart?.('circle', duration);
  }

  /**
   * Ground danger sector (cone footprint) from origin along direction.
   * @param length radius of the sector
   * @param angle full cone angle in radians
   */
  showCone(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    angle: number,
    duration: number,
    color = 0xff6a00,
  ): void {
    const dir = direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    const half = Math.max(0.05, angle * 0.5);
    // Unit sector in XY; a=0 along -Y so after Rx(-90°) it faces local +Z
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    const segs = 28;
    for (let i = 0; i <= segs; i++) {
      const a = -half + (angle * i) / segs;
      shape.lineTo(Math.sin(a), -Math.cos(a));
    }
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    mesh.scale.setScalar(0.001);

    // Group yaws so local +Z faces `dir`
    const root = new THREE.Group();
    root.position.set(origin.x, GROUND_Y, origin.z);
    root.rotation.y = Math.atan2(dir.x, dir.z);
    root.add(mesh);
    this.scene.add(root);

    this.active.push({
      root,
      mesh,
      material,
      shape: 'cone',
      duration: Math.max(0.05, duration),
      age: 0,
      phase: 0,
      flashAge: 0,
      baseColor: new THREE.Color(color),
      targetScale: Math.max(0.05, length),
    });
    this.onTelegraphStart?.('cone', duration);
  }

  /** Animate fill 0→1, then danger flash, then remove. */
  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = at(this.active, i);
      if (t === undefined) continue;
      if (t.phase === 0) {
        t.age += dt;
        const fill = Math.min(1, t.age / t.duration);
        t.mesh.scale.setScalar(Math.max(0.001, fill * t.targetScale));
        // Opacity pulse while filling; ramps up slightly toward impact
        const pulse = 0.22 + 0.18 * Math.sin(t.age * 14) + fill * 0.2;
        t.material.opacity = Math.min(0.72, pulse);
        t.material.color.copy(t.baseColor);

        if (t.age >= t.duration) {
          t.phase = 1;
          t.flashAge = 0;
          t.mesh.scale.setScalar(t.targetScale);
          t.material.opacity = 0.92;
          t.material.color.setRGB(
            Math.min(1, t.baseColor.r + 0.45),
            Math.min(1, t.baseColor.g + 0.35),
            Math.min(1, t.baseColor.b + 0.25),
          );
        }
      } else {
        t.flashAge += dt;
        // Brief bright flash then fade out
        const f = t.flashAge / FLASH_DURATION;
        t.material.opacity = 0.92 * (1 - f);
        if (t.flashAge >= FLASH_DURATION) {
          this.disposeOne(t);
          this.active.splice(i, 1);
        }
      }
    }
  }

  clear(): void {
    for (const t of this.active) this.disposeOne(t);
    this.active.length = 0;
  }

  private disposeOne(t: ActiveTelegraph) {
    this.scene.remove(t.root);
    t.mesh.geometry.dispose();
    t.material.dispose();
  }
}
