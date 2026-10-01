import * as THREE from 'three';
import { at, shift } from '../core/util';

interface Decal {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
}

const DECAL_LIFE = 4;
const DECAL_Y = 0.02;
const MAX_DECALS = 48;

/**
 * Ground scorchmarks / magic burn rings at impact points.
 * Flat transparent discs that fade out over ~4s.
 */
export class ImpactDecals {
  private scene: THREE.Scene;
  private decals: Decal[] = [];
  private geo = new THREE.CircleGeometry(0.55, 20);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Spawn a scorchmark / magic burn on the ground. */
  spawn(position: THREE.Vector3, normal: THREE.Vector3, color: number): void {
    while (this.decals.length >= MAX_DECALS) {
      const oldest = shift(this.decals);
      if (oldest === undefined) break;
      this.disposeDecal(oldest);
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(this.geo, material);
    mesh.position.set(position.x, DECAL_Y, position.z);

    // Lay flat on ground; bias with impact normal if non-vertical
    mesh.rotation.x = -Math.PI / 2;
    if (normal.lengthSq() > 0.0001) {
      const n = normal.clone().normalize();
      // Slight tilt only when hitting non-flat surfaces
      if (Math.abs(n.y) < 0.98) {
        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, n);
        mesh.quaternion.copy(q);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.copy(position).addScaledVector(n, 0.02);
      }
    }

    // Soft ring scale variation
    const s = 0.7 + Math.random() * 0.55;
    mesh.scale.setScalar(s);
    mesh.renderOrder = 1;

    this.scene.add(mesh);
    this.decals.push({ mesh, material, age: 0, life: DECAL_LIFE });
  }

  update(dt: number): void {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = at(this.decals, i);
      if (d === undefined) continue;
      d.age += dt;
      const t = d.age / d.life;
      if (t >= 1) {
        this.disposeDecal(d);
        this.decals.splice(i, 1);
        continue;
      }
      // Hold solid briefly, then ease-out fade
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      d.material.opacity = 0.75 * Math.max(0, fade * fade);
    }
  }

  clear(): void {
    for (const d of this.decals) this.disposeDecal(d);
    this.decals.length = 0;
  }

  private disposeDecal(d: Decal): void {
    this.scene.remove(d.mesh);
    d.material.dispose();
  }
}
