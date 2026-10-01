import * as THREE from 'three';

export type MaelPhase = 'absent' | 'arrive' | 'duel' | 'retreat' | 'defeated';

/**
 * Mid-game face of the Council — polite, lethal duelist at Heat ≥ 50.
 */
export class InquisitorMael {
  phase: MaelPhase = 'absent';
  mesh: THREE.Group;
  hp = 220;
  maxHp = 220;
  private scene: THREE.Scene;
  private attackCd = 1.2;
  private wardCd = 0;
  private spawned = false;
  private retreatTimer = 0;
  private introDone = false;
  private orbit = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = this.buildMesh();
    this.mesh.visible = false;
  }

  private buildMesh(): THREE.Group {
    const g = new THREE.Group();
    const coat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.1, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a32,
        metalness: 0.35,
        roughness: 0.45,
        emissive: 0xc9a227,
        emissiveIntensity: 0.12,
      }),
    );
    coat.position.y = 1.15;
    coat.castShadow = true;
    const mask = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 }),
    );
    mask.position.y = 1.95;
    const wand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.9, 6),
      new THREE.MeshStandardMaterial({
        color: 0xe8d48b,
        emissive: 0xc9a227,
        emissiveIntensity: 0.5,
      }),
    );
    wand.position.set(0.5, 1.2, 0.15);
    wand.rotation.z = -0.4;
    // Authority halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.05;
    g.add(coat, mask, wand, halo);
    g.name = 'inquisitor_mael';
    return g;
  }

  /** Call when heat crosses envoy threshold */
  trySummon(heat: number, playerPos: THREE.Vector3, onToast: (s: string) => void): boolean {
    if (this.spawned || this.phase === 'defeated') return false;
    if (heat < 50) return false;
    this.spawned = true;
    this.phase = 'arrive';
    this.mesh.visible = true;
    this.scene.add(this.mesh);
    const dir = new THREE.Vector3(1, 0, 0.3).normalize();
    this.mesh.position.copy(playerPos).addScaledVector(dir, 14);
    this.mesh.position.y = 0;
    onToast('Inquisitor Mael: "Unlisted. How efficient of them."');
    return true;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    onPlayerDamage: (n: number) => void,
    onToast: (s: string) => void,
    onProjectile: (origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) => void,
  ): void {
    if (!this.spawned || this.phase === 'defeated' || this.phase === 'absent') return;

    if (this.phase === 'arrive') {
      // Walk closer
      const to = playerPos.clone().sub(this.mesh.position);
      to.y = 0;
      const d = to.length();
      if (d > 7) {
        to.normalize();
        this.mesh.position.addScaledVector(to, 3.5 * dt);
      } else {
        this.phase = 'duel';
        if (!this.introDone) {
          this.introDone = true;
          onToast('Mael: "I am authorized to offer departure — or end the conversation."');
        }
      }
      this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
      return;
    }

    if (this.phase === 'retreat') {
      this.retreatTimer -= dt;
      this.mesh.position.y += 2 * dt;
      const coat = this.mesh.children[0] as THREE.Mesh;
      coat.scale.multiplyScalar(0.99);
      if (this.retreatTimer <= 0) {
        this.mesh.visible = false;
        this.phase = 'defeated';
        onToast('Mael withdraws. "Build your little academy. History prefers tidy ruins."');
        // Still counts as facing him
        this.mesh.userData.retreated = true;
      }
      return;
    }

    // Duel AI
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.wardCd = Math.max(0, this.wardCd - dt);
    this.orbit += dt;

    const to = playerPos.clone().sub(this.mesh.position);
    to.y = 0;
    const dist = to.length();
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

    // Strafe orbit
    if (dist < 5) {
      const side = new THREE.Vector3(-to.z, 0, to.x).normalize();
      this.mesh.position.addScaledVector(side, Math.sin(this.orbit * 2) * 2.2 * dt);
      this.mesh.position.addScaledVector(to.normalize(), -1.5 * dt);
    } else if (dist > 11) {
      this.mesh.position.addScaledVector(to.normalize(), 4 * dt);
    }

    this.mesh.position.y = 0;

    // Gold bolt
    if (this.attackCd <= 0 && dist < 16) {
      this.attackCd = 1.35;
      const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const dir = playerPos
        .clone()
        .add(new THREE.Vector3(0, 1, 0))
        .sub(origin)
        .normalize();
      onProjectile(origin, dir, 11);
    }

    // Occasional close brand
    if (dist < 3.2 && this.wardCd <= 0) {
      this.wardCd = 3.5;
      onPlayerDamage(16);
      onToast('Mael brands the air — Ward up!');
    }

    // Low HP retreat (first meeting survival).
    // Earlier returns already excluded absent/arrive/retreat/defeated, so the
    // duel phase is implied here.
    if (this.hp < this.maxHp * 0.22) {
      this.phase = 'retreat';
      this.retreatTimer = 2.2;
      onToast('Mael: "Adequate. File updated."');
    }
  }

  takeDamage(amount: number): boolean {
    if (this.phase !== 'duel' && this.phase !== 'arrive') return false;
    // Arriving can take chip damage too
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.phase = 'defeated';
      this.mesh.visible = false;
      return true;
    }
    // Flash coat
    const coat = this.mesh.children[0];
    if (coat instanceof THREE.Mesh && coat.material instanceof THREE.MeshStandardMaterial) {
      coat.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        if (coat.material instanceof THREE.MeshStandardMaterial)
          coat.material.emissiveIntensity = 0.12;
      }, 100);
    }
    return false;
  }

  get position() {
    return this.mesh.position;
  }

  asTarget(): {
    id: string;
    mesh: THREE.Object3D;
    position: THREE.Vector3;
    hp: number;
    maxHp: number;
    state: string;
  } | null {
    if (!this.spawned || this.phase === 'defeated' || this.phase === 'absent' || !this.mesh.visible)
      return null;
    return {
      id: 'mael',
      mesh: this.mesh,
      position: this.mesh.position,
      hp: this.hp,
      maxHp: this.maxHp,
      state: 'aggro',
    };
  }
}
