import * as THREE from 'three';
import type { WildBeast } from '../core/types';

/**
 * Accurate third-person aim:
 * 1) Ray from camera through reticle (screen center)
 * 2) Optional soft lock if a beast is near the ray
 * 3) Fire direction = from muzzle tip TO aim point (so bolts hit where you look)
 */

const _camDir = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _toBeast = new THREE.Vector3();
const _closest = new THREE.Vector3();

export function getReticleAimPoint(
  camera: THREE.Camera,
  maxDist = 80,
): { origin: THREE.Vector3; dir: THREE.Vector3; point: THREE.Vector3 } {
  camera.getWorldDirection(_camDir);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  _aimPoint.copy(origin).addScaledVector(_camDir, maxDist);
  return { origin, dir: _camDir.clone(), point: _aimPoint.clone() };
}

/**
 * Soft aim assist: if a living beast is within `assistRadius` of the reticle ray,
 * pull the aim point onto the beast center (chest).
 */
export function getCombatAim(
  camera: THREE.Camera,
  muzzle: THREE.Vector3,
  beasts: WildBeast[],
  opts?: { maxDist?: number; assistRadius?: number; assistAngle?: number },
): { dir: THREE.Vector3; point: THREE.Vector3; locked: WildBeast | null } {
  const maxDist = opts?.maxDist ?? 80;
  const assistRadius = opts?.assistRadius ?? 1.35;
  const assistAngle = opts?.assistAngle ?? 0.12; // ~7 degrees

  const { origin, dir, point } = getReticleAimPoint(camera, maxDist);

  let locked: WildBeast | null = null;
  let bestScore = Infinity;

  for (const b of beasts) {
    if (b.hp <= 0 || b.state === 'captured') continue;
    // Beast aim center (chest)
    const center = b.mesh.position.clone();
    center.y += 0.7;

    _toBeast.subVectors(center, origin);
    const dist = _toBeast.length();
    if (dist < 0.5 || dist > maxDist) continue;

    const along = _toBeast.dot(dir);
    if (along < 0.5) continue; // behind camera

    // Closest point on ray to beast center
    _closest.copy(origin).addScaledVector(dir, along);
    const lateral = _closest.distanceTo(center);
    const angle = Math.atan2(lateral, along);

    if (lateral < assistRadius || angle < assistAngle) {
      // Prefer closer + more centered
      const score = lateral + dist * 0.02;
      if (score < bestScore) {
        bestScore = score;
        locked = b;
        point.copy(center);
      }
    }
  }

  // Direction from muzzle to aim point — this is the key fix for "overshoot"
  const fireDir = point.clone().sub(muzzle);
  if (fireDir.lengthSq() < 1e-6) {
    fireDir.copy(dir);
  } else {
    fireDir.normalize();
  }

  return { dir: fireDir, point: point.clone(), locked };
}

/** Melee/ward: prefer beast near reticle, else nearest in front cone */
export function getWardTarget(
  camera: THREE.Camera,
  playerPos: THREE.Vector3,
  beasts: WildBeast[],
  range = 5,
): WildBeast | null {
  const { dir, locked } = getCombatAim(camera, playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)), beasts, {
    maxDist: range + 2,
    assistRadius: 1.8,
    assistAngle: 0.35,
  });
  if (locked && playerPos.distanceTo(locked.mesh.position) <= range + 0.5) return locked;

  let best: WildBeast | null = null;
  let bestD = range;
  for (const b of beasts) {
    if (b.hp <= 0 || b.state === 'captured') continue;
    const to = b.mesh.position.clone().sub(playerPos);
    to.y = 0;
    const d = to.length();
    if (d > range) continue;
    to.normalize();
    const flatDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    if (flatDir.dot(to) < 0.25) continue;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
