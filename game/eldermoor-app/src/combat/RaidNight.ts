import * as THREE from 'three';
import type { Station } from '../core/types';
import { createWildBeast } from '../beasts/BeastFactory';
import type { WildBeast } from '../core/types';

export type RaidState = 'idle' | 'warning' | 'active' | 'won' | 'lost';

/**
 * Council strike / night raid when Heat is high — waves of husks toward base.
 */
export class RaidNight {
  state: RaidState = 'idle';
  private timer = 0;
  private wave = 0;
  private maxWaves = 3;
  private spawnCd = 0;
  raiders: WildBeast[] = [];
  private scene: THREE.Scene;
  private lastHeatTrigger = -1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  clear() {
    for (const r of this.raiders) {
      this.scene.remove(r.mesh);
    }
    this.raiders = [];
    this.state = 'idle';
    this.wave = 0;
    this.timer = 0;
  }

  /**
   * Call each frame. Triggers raid when heat crosses 40/75 at night once.
   */
  update(
    dt: number,
    heat: number,
    isNight: boolean,
    stations: Station[],
    playerPos: THREE.Vector3,
    onToast: (s: string) => void,
    onTowerDamage: (amount: number) => void,
  ): void {
    // Trigger
    if (this.state === 'idle' && isNight && heat >= 40) {
      const band = heat >= 75 ? 75 : 40;
      if (this.lastHeatTrigger !== band) {
        this.lastHeatTrigger = band;
        this.state = 'warning';
        this.timer = 8;
        this.wave = 0;
        this.maxWaves = heat >= 75 ? 4 : 3;
        onToast(
          heat >= 75
            ? 'STRIKE INBOUND — defend your enclave!'
            : 'Night raid approaching — Grey-Gold scouts…',
        );
      }
    }

    if (this.state === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'active';
        this.wave = 1;
        this.spawnCd = 0.5;
        this.timer = 45;
        onToast(`Raid wave ${this.wave}/${this.maxWaves}`);
      }
      return;
    }

    if (this.state !== 'active') return;

    this.timer -= dt;
    this.spawnCd -= dt;

    // Target: tower or lumber or player base centroid
    const tower = stations.find((s) => s.kind === 'tower');
    const lumber = stations.find((s) => s.kind === 'lumber');
    const bed = stations.find((s) => s.kind === 'bed');
    const targetPos = (tower ?? lumber ?? bed)?.position.clone() ?? playerPos.clone();

    // Spawn raiders at edge
    if (this.spawnCd <= 0 && this.raiders.length < 6 + this.wave) {
      this.spawnCd = 3.5 - this.wave * 0.3;
      const ang = Math.random() * Math.PI * 2;
      const pos = new THREE.Vector3(
        targetPos.x + Math.cos(ang) * 28,
        0,
        targetPos.z + Math.sin(ang) * 28,
      );
      // Reuse husk-like: B07 bogwhisper or B04 as "scout"
      const sid = Math.random() > 0.5 ? 'B07' : 'B04';
      const b = createWildBeast(sid, pos, THREE);
      b.mesh.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
          c.material = c.material.clone();
          c.material.emissive = new THREE.Color(0xc9a227);
          c.material.emissiveIntensity = 0.25;
        }
      });
      // Grey-gold ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.75, 16),
        new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      b.mesh.add(ring);
      b.mesh.userData.isRaider = true;
      this.scene.add(b.mesh);
      this.raiders.push(b);
    }

    // Move raiders toward target; damage tower when close
    for (const r of this.raiders) {
      if (r.hp <= 0) continue;
      const to = targetPos.clone().sub(r.mesh.position);
      to.y = 0;
      const d = to.length();
      if (d > 1.5) {
        to.normalize();
        r.mesh.position.addScaledVector(to, 3.2 * dt);
        r.mesh.position.y = 0.5;
        r.mesh.lookAt(targetPos.x, r.mesh.position.y, targetPos.z);
      } else {
        r.attackCooldown -= dt;
        if (r.attackCooldown <= 0) {
          r.attackCooldown = 1.4;
          onTowerDamage(6 + this.wave);
        }
      }
      r.position.copy(r.mesh.position);
    }

    // Cleanup dead
    this.raiders = this.raiders.filter((r) => {
      if (r.hp <= 0) {
        this.scene.remove(r.mesh);
        return false;
      }
      return true;
    });

    // Wave advance
    if (this.timer <= 0 || (this.raiders.length === 0 && this.spawnCd < -1)) {
      if (this.wave >= this.maxWaves) {
        this.state = 'won';
        onToast('Raid broken. The Council retreats — for now.');
        for (const r of this.raiders) this.scene.remove(r.mesh);
        this.raiders = [];
        this.timer = 0;
        // Reset to idle after short celebration
        this.state = 'idle';
      } else {
        this.wave += 1;
        this.timer = 35;
        this.spawnCd = 1;
        onToast(`Raid wave ${this.wave}/${this.maxWaves}`);
      }
    }
  }

  /** All raiders as damageable targets for projectiles / party */
  getTargets(): WildBeast[] {
    return this.raiders.filter((r) => r.hp > 0);
  }
}
