import * as THREE from 'three';
import type { OwnedBeast, WildBeast } from '../core/types';
import { speciesDef } from '../data/species';
import { beastPowerMul } from '../core/Progression';
import { createBeastMesh } from './BeastFactory';
import { applyDamageToBeast } from './BeastAI';

export interface FieldCompanion {
  ownedUid: string;
  speciesId: string;
  mesh: THREE.Group;
  attackCd: number;
  slot: number;
}

/**
 * Up to 2 owned beasts follow the player and attack nearby wild targets.
 * Workers (job set, not field) stay at base — only fieldSlot companions appear.
 */
export class FieldParty {
  companions: FieldCompanion[] = [];
  private scene: THREE.Scene;
  private maxField = 2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Rebuild field meshes from owned list (call after capture / assign). */
  sync(owned: OwnedBeast[]) {
    const want = owned.filter((o) => o.fieldSlot).slice(0, this.maxField);

    // Remove companions no longer in field
    for (const c of [...this.companions]) {
      if (!want.some((o) => o.uid === c.ownedUid)) {
        this.scene.remove(c.mesh);
        this.companions = this.companions.filter((x) => x.ownedUid !== c.ownedUid);
      }
    }

    // Add missing
    let slot = 0;
    for (const o of want) {
      if (!this.companions.some((c) => c.ownedUid === o.uid)) {
        const mesh = createBeastMesh(o.speciesId, THREE);
        // gold ring under ally (local space under feet)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.7, 0.9, 20),
          new THREE.MeshBasicMaterial({
            color: 0xc9a227,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        mesh.add(ring);
        this.scene.add(mesh);
        this.companions.push({
          ownedUid: o.uid,
          speciesId: o.speciesId,
          mesh,
          attackCd: 0.4 * slot,
          slot,
        });
      }
      slot++;
    }

    // Re-index slots
    this.companions.forEach((c, i) => {
      c.slot = i;
    });
  }

  clear() {
    for (const c of this.companions) this.scene.remove(c.mesh);
    this.companions = [];
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerForward: THREE.Vector3,
    wild: WildBeast[],
    onHit: (beast: WildBeast, dmg: number) => void,
    owned: OwnedBeast[] = [],
  ) {
    const right = new THREE.Vector3()
      .crossVectors(playerForward, new THREE.Vector3(0, 1, 0))
      .normalize();

    for (const c of this.companions) {
      c.attackCd = Math.max(0, c.attackCd - dt);
      const def = speciesDef(c.speciesId);
      const owner = owned.find((o) => o.uid === c.ownedUid);
      const bondMul = beastPowerMul(owner?.bondLevel ?? 0);
      const side = c.slot === 0 ? -1.4 : 1.4;
      const behind = -1.8 - c.slot * 0.4;

      // Follow formation
      const desired = playerPos
        .clone()
        .add(playerForward.clone().multiplyScalar(behind))
        .add(right.clone().multiplyScalar(side));
      desired.y = def.scale * 0.5;

      // Acquire nearest hostile in range
      let target: WildBeast | null = null;
      let best = 14;
      for (const w of wild) {
        if (w.hp <= 0 || w.state === 'captured') continue;
        const d = c.mesh.position.distanceTo(w.mesh.position);
        if (d < best) {
          best = d;
          target = w;
        }
      }

      if (target && best < 12) {
        // Move toward target
        const to = target.mesh.position.clone().sub(c.mesh.position);
        to.y = 0;
        const dist = to.length();
        if (dist > 1.6) {
          to.normalize();
          c.mesh.position.addScaledVector(to, (4.5 + def.stats.spd * 0.4) * dt);
          c.mesh.position.y = def.scale * 0.5;
          c.mesh.lookAt(target.mesh.position.x, c.mesh.position.y, target.mesh.position.z);
        } else if (c.attackCd <= 0) {
          const dmg = (3 + def.stats.pow * 2.5) * bondMul;
          applyDamageToBeast(target, dmg, dmg > 12);
          onHit(target, dmg);
          c.attackCd = 1.1 / (0.85 + def.stats.spd * 0.06);
        } else {
          c.mesh.lookAt(target.mesh.position.x, c.mesh.position.y, target.mesh.position.z);
        }
      } else {
        // Return to formation
        c.mesh.position.lerp(desired, 1 - Math.pow(0.02, dt));
        c.mesh.position.y = def.scale * 0.5;
        const face = playerPos.clone().add(playerForward);
        c.mesh.lookAt(face.x, c.mesh.position.y, face.z);
      }
    }
  }
}

/** Toggle field slot: max 2 in field. Workers can be pulled to field. */
export function toggleFieldSlot(owned: OwnedBeast[], uid: string): string {
  const b = owned.find((o) => o.uid === uid);
  if (!b) return 'Beast not found.';
  if (b.fieldSlot) {
    b.fieldSlot = false;
    return `${b.name} recalled from the field.`;
  }
  const count = owned.filter((o) => o.fieldSlot).length;
  if (count >= 2) return 'Field party full (2). Recall one first.';
  // Leaving a job when going to field is OK — keep job for when recalled optional
  b.fieldSlot = true;
  return `${b.name} joins your field party.`;
}
