import * as THREE from 'three';
import type { WildBeast } from '../core/types';
import type { SpellId } from './Spells';

const HIT_RADIUS = 0.95;
const LIFETIME = 2;
const DEFAULT_RAY_RADIUS = 4;
const SPHERE_RADIUS = 0.12;

export interface ProjectileMeta {
  soft?: boolean;
  interrupt?: boolean;
  cone?: boolean;
}

interface LiveProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  spellId: SpellId;
  meta: ProjectileMeta;
  life: number;
  /** Cone projectiles use a slightly larger hit radius */
  hitRadius: number;
}

export type HitCallback = (beast: WildBeast, dmg: number, meta: ProjectileMeta) => void;

/**
 * Manages short-lived spell projectiles as small emissive spheres.
 * Ward is not a projectile — use `rayDamage` for ward pulse interrupt.
 */
export class ProjectileSystem {
  private projectiles: LiveProjectile[] = [];
  private geo = new THREE.SphereGeometry(SPHERE_RADIUS, 8, 8);
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Spawn a projectile at `origin` moving along `direction` (normalized internally).
   * Skip calling this for ward — ward is a melee pulse via `rayDamage`.
   */
  spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spellId: SpellId,
    speed: number,
    damage: number,
    color: number,
    meta: ProjectileMeta = {},
  ): void {
    if (spellId === 'ward') return;

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const dir = direction.clone();
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
    else dir.normalize();

    const hitRadius = meta.cone === true ? HIT_RADIUS * 1.6 : HIT_RADIUS;
    // Thorn cone is short-range; full 2s lifetime only for long bolts
    const life = meta.cone === true ? Math.min(LIFETIME, 0.45) : LIFETIME;

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(speed),
      damage,
      spellId,
      meta: { ...meta },
      life,
      hitRadius,
    });
  }

  /**
   * Advance projectiles; invoke `onHit` once per beast collision then remove.
   * Also removes projectiles that exceed the 2s lifetime.
   */
  update(dt: number, beasts: WildBeast[], onHit: HitCallback): void {
    const still: LiveProjectile[] = [];

    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.life <= 0) {
        this.disposeProjectile(p);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);

      let hit = false;
      for (const beast of beasts) {
        if (beast.state === 'captured' || beast.hp <= 0) continue;
        // Use live mesh position + chest height for reliable hits
        const chest = beast.mesh.position.clone();
        chest.y += 0.55;
        const dist = p.mesh.position.distanceTo(chest);
        if (dist <= p.hitRadius + beastScaleRadius(beast)) {
          onHit(beast, p.damage, p.meta);
          hit = true;
          break;
        }
      }

      if (hit) {
        this.disposeProjectile(p);
      } else {
        still.push(p);
      }
    }

    this.projectiles = still;
  }

  clear(): void {
    for (const p of this.projectiles) this.disposeProjectile(p);
    this.projectiles = [];
  }

  dispose(): void {
    this.clear();
    this.geo.dispose();
  }

  get count(): number {
    return this.projectiles.length;
  }

  private disposeProjectile(p: LiveProjectile): void {
    this.scene.remove(p.mesh);
    const mat = p.mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  }
}

function beastScaleRadius(beast: WildBeast): number {
  // Prefer mesh scale if available; fall back to a modest body radius
  const s = Math.max(beast.mesh.scale.x, beast.mesh.scale.z);
  return 0.4 * (s > 0 ? s : 1);
}

/**
 * Melee-range ward pulse / interrupt helper.
 * Finds the nearest living beast within `radius` (default 4) in front of the player.
 * Returns null if none are in the forward half-space cone-ish sector.
 */
export function rayDamage(
  origin: THREE.Vector3,
  forward: THREE.Vector3,
  beasts: WildBeast[],
  radius = DEFAULT_RAY_RADIUS,
): WildBeast | null {
  const dir = forward.clone();
  dir.y = 0;
  if (dir.lengthSq() < 1e-8) return null;
  dir.normalize();

  let best: WildBeast | null = null;
  let bestDist = radius;

  for (const beast of beasts) {
    if (beast.state === 'captured' || beast.hp <= 0) continue;

    const to = beast.position.clone().sub(origin);
    to.y = 0;
    const dist = to.length();
    if (dist > radius || dist < 1e-6) continue;

    // Must be in front (dot > 0) — wide forward sector for ward pulse
    const nd = to.normalize();
    if (nd.dot(dir) < 0.15) continue;

    if (dist < bestDist) {
      bestDist = dist;
      best = beast;
    }
  }

  return best;
}
