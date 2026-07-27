import * as THREE from 'three';
import type { OwnedBeast } from '../core/types';
import { createBeastMesh } from '../beasts/BeastFactory';
import { SPECIES } from '../data/species';

/** Mount when player owns B09 Ridgespire (or any mount-tagged) and toggles. */
export class MountSystem {
  mounted = false;
  mesh: THREE.Group | null = null;
  private scene: THREE.Scene;
  private mountUid: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  hasMount(owned: OwnedBeast[]): OwnedBeast | null {
    return (
      owned.find((o) => o.speciesId === 'B09') ??
      owned.find((o) => SPECIES[o.speciesId]?.workTags.includes('mount')) ??
      null
    );
  }

  toggle(owned: OwnedBeast[], playerPos: THREE.Vector3): string {
    if (this.mounted) {
      this.dismount();
      return 'Dismounted.';
    }
    const m = this.hasMount(owned);
    if (!m) return 'No mount bound — capture a Ridgespire Juvenile.';
    this.mounted = true;
    this.mountUid = m.uid;
    this.mesh = createBeastMesh(m.speciesId, THREE);
    this.mesh.position.copy(playerPos);
    this.mesh.position.y = (SPECIES[m.speciesId]?.scale ?? 1) * 0.45;
    this.scene.add(this.mesh);
    // Recall from field if needed — caller handles fieldSlot
    m.fieldSlot = false;
    m.job = null;
    return `Mounted ${m.name}. Hold Space for gallop.`;
  }

  dismount() {
    this.mounted = false;
    this.mountUid = null;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }

  clear() {
    this.dismount();
  }

  /** Sync mount mesh under player; return speed multiplier */
  update(playerPos: THREE.Vector3, yaw: number, galloping: boolean): number {
    if (!this.mounted || !this.mesh) return 1;
    const def = SPECIES.B09;
    this.mesh.position.x = playerPos.x;
    this.mesh.position.z = playerPos.z;
    this.mesh.position.y = (def?.scale ?? 1) * 0.45;
    this.mesh.rotation.y = yaw;
    // Bob
    this.mesh.position.y += Math.sin(performance.now() * 0.01) * (galloping ? 0.12 : 0.04);
    return galloping ? 2.15 : 1.55;
  }
}
