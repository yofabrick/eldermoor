import * as THREE from 'three';
import type { WildBeast } from '../core/types';
import { applyDamageToBeast } from '../beasts/BeastAI';
import { BossTelegraph, type TelegraphShape } from './BossTelegraph';

export type BossPhase = 'idle' | 'engage' | 'plates' | 'enrage' | 'vulnerable' | 'defeated';

const BREATH_TELEGRAPH = 0.85;
const STOMP_TELEGRAPH = 0.55;
const BREATH_RANGE = 14;
const BREATH_HALF_ANGLE = 0.55; // radians from centerline
const STOMP_RANGE = 3.2;

/**
 * Ashcrown elite encounter — multi-phase, plate breaks, breath cones, capture window.
 * Wraps a B12 WildBeast and drives special attacks when the player is near.
 * Attacks use {@link BossTelegraph} ground indicators before damage lands.
 */
export class BossAshcrown {
  beast: WildBeast;
  phase: BossPhase = 'idle';
  plates = 3;
  enrage = 0;
  /** Shared telegraph system (Game may read `telegraph.isActive`) */
  readonly telegraph: BossTelegraph;
  /**
   * Optional: fired when a boss telegraph starts.
   * Game can optionally hook this without changing update() signature.
   */
  onTelegraphStart?: (shape: TelegraphShape, duration: number) => void;

  private attackCd = 0;
  private breathCd = 2;
  private arenaCenter: THREE.Vector3;
  private arenaRadius = 22;
  private engaged = false;
  private vulnerableTimer = 0;
  private ring: THREE.Mesh | null = null;
  private scene: THREE.Scene;
  private breathMeshes: THREE.Mesh[] = [];

  /** Windup timers (>0 = telegraph active, damage pending) */
  private breathWindup = 0;
  private stompWindup = 0;
  private pendingBreathDir: THREE.Vector3 | null = null;
  private pendingStompCenter = new THREE.Vector3();
  private didVulnerableFlash = false;

  constructor(beast: WildBeast, scene: THREE.Scene) {
    this.beast = beast;
    this.scene = scene;
    this.arenaCenter = beast.mesh.position.clone();
    this.arenaCenter.y = 0;
    this.telegraph = new BossTelegraph(scene);
    this.telegraph.onTelegraphStart = (shape, duration) => {
      this.onTelegraphStart?.(shape, duration);
    };
    this.buildArena();
  }

  /** True while any attack telegraph is filling or flashing */
  get isTelegraphing(): boolean {
    return this.telegraph.isActive || this.breathWindup > 0 || this.stompWindup > 0;
  }

  private buildArena() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.arenaRadius - 0.4, this.arenaRadius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff6a00,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this.arenaCenter);
    ring.position.y = 0.08;
    this.scene.add(ring);
    this.ring = ring;

    // Den rocks
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2 + (i % 2) * 0.4, 0),
        new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9, emissive: 0x221100, emissiveIntensity: 0.15 }),
      );
      rock.position.set(
        this.arenaCenter.x + Math.cos(a) * (this.arenaRadius - 2),
        0.6,
        this.arenaCenter.z + Math.sin(a) * (this.arenaRadius - 2),
      );
      this.scene.add(rock);
    }
  }

  isNear(playerPos: THREE.Vector3): boolean {
    return playerPos.distanceTo(this.arenaCenter) < this.arenaRadius + 8;
  }

  inArena(playerPos: THREE.Vector3): boolean {
    return playerPos.distanceTo(this.arenaCenter) < this.arenaRadius;
  }

  /**
   * @returns events for toasts / camera / damage
   */
  update(
    dt: number,
    playerPos: THREE.Vector3,
    onPlayerDamage: (amount: number, kind: string) => void,
    onToast: (msg: string) => void,
  ): { captureReady: boolean; phaseChanged?: string } {
    this.telegraph.update(dt);

    if (this.beast.hp <= 0 || this.beast.state === 'captured') {
      this.phase = 'defeated';
      if (this.ring) this.ring.visible = false;
      this.telegraph.clear();
      this.breathWindup = 0;
      this.stompWindup = 0;
      return { captureReady: false };
    }

    let phaseChanged: string | undefined;
    const dist = playerPos.distanceTo(this.beast.mesh.position);
    const hpRatio = this.beast.hp / this.beast.maxHp;

    // Engage — brief arena pulse telegraph
    if (!this.engaged && dist < 18) {
      this.engaged = true;
      this.phase = 'engage';
      phaseChanged = 'Ashcrown stirs — the den awakens.';
      onToast(phaseChanged);
      this.telegraph.showCircle(this.arenaCenter, this.arenaRadius * 0.92, 0.7, 0xff6a00);
    }
    if (!this.engaged) return { captureReady: false };

    // Soften / plates: track partBroken from combat as plate breaks
    if (this.beast.partBroken && this.plates > 0 && this.phase !== 'vulnerable') {
      this.beast.partBroken = false;
      this.plates -= 1;
      this.enrage = Math.max(0, this.enrage - 0.3);
      onToast(`Armor plate shattered (${3 - this.plates}/3)`);
      if (this.plates <= 0) {
        this.phase = 'vulnerable';
        this.vulnerableTimer = 8;
        this.didVulnerableFlash = false;
        phaseChanged = 'Crown exposed! Capture window — channel now!';
        onToast(phaseChanged);
      }
    }

    // Vulnerable: green ring flash on boss
    if (this.phase === 'vulnerable' && !this.didVulnerableFlash) {
      this.didVulnerableFlash = true;
      const under = this.beast.mesh.position.clone();
      under.y = 0;
      this.telegraph.showCircle(under, 2.8, 0.45, 0x44ff66);
    }

    // Phase by HP
    if (this.phase === 'engage' && hpRatio < 0.7) {
      this.phase = 'plates';
      phaseChanged = 'Ashcrown hardens — break plates with heavy hits (Thorn / Bind).';
    }
    if (hpRatio < 0.35 && this.phase !== 'vulnerable' && this.phase !== 'enrage') {
      this.phase = 'enrage';
      this.enrage = 1;
      phaseChanged = 'ENRAGE — breath quickens!';
      onToast(phaseChanged);
    }

    if (this.phase === 'vulnerable') {
      this.vulnerableTimer -= dt;
      this.beast.calmed = true;
      if (this.vulnerableTimer <= 0) {
        this.phase = 'enrage';
        this.plates = 1;
        this.beast.calmed = false;
        this.didVulnerableFlash = false;
        onToast('Crown reseals. Break another plate.');
      }
    }

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.breathCd = Math.max(0, this.breathCd - dt);

    // Face player (hold facing during breath windup so telegraph stays honest)
    if (this.breathWindup <= 0) {
      this.beast.mesh.lookAt(playerPos.x, this.beast.mesh.position.y, playerPos.z);
    }

    // --- Stomp: telegraph circle under boss, then damage if still in range ---
    if (this.stompWindup > 0) {
      this.stompWindup -= dt;
      if (this.stompWindup <= 0) {
        const stompDist = playerPos.distanceTo(this.pendingStompCenter);
        if (stompDist < STOMP_RANGE) {
          const dmg = 10 + this.enrage * 8;
          onPlayerDamage(dmg, 'stomp');
        }
      }
    } else if (
      dist < STOMP_RANGE &&
      this.attackCd <= 0 &&
      this.breathWindup <= 0
    ) {
      this.pendingStompCenter.copy(this.beast.mesh.position);
      this.pendingStompCenter.y = 0;
      this.telegraph.showCircle(this.pendingStompCenter, STOMP_RANGE, STOMP_TELEGRAPH, 0xff3300);
      this.stompWindup = STOMP_TELEGRAPH;
      this.attackCd = (this.enrage > 0.5 ? 1.1 : 1.6) + STOMP_TELEGRAPH;
    }

    // --- Breath: cone telegraph, then damage + fire VFX ---
    if (this.breathWindup > 0) {
      this.breathWindup -= dt;
      if (this.breathWindup <= 0 && this.pendingBreathDir) {
        this.resolveBreath(playerPos, onPlayerDamage);
        this.pendingBreathDir = null;
      }
    } else if (this.breathCd <= 0 && dist < 16 && this.stompWindup <= 0) {
      this.startBreathTelegraph(playerPos);
      this.breathCd = (this.enrage > 0.5 ? 2.2 : 3.5) + BREATH_TELEGRAPH;
    }

    // Animate breath VFX fade
    for (const m of [...this.breathMeshes]) {
      const life = (m.userData.life as number) - dt;
      m.userData.life = life;
      if (m.material instanceof THREE.MeshBasicMaterial) {
        m.material.opacity = Math.max(0, life / 0.6);
      }
      if (life <= 0) {
        this.scene.remove(m);
        this.breathMeshes = this.breathMeshes.filter((x) => x !== m);
      }
    }

    // Keep boss near arena
    const fromC = this.beast.mesh.position.clone().sub(this.arenaCenter);
    fromC.y = 0;
    if (fromC.length() > this.arenaRadius - 3) {
      fromC.setLength(this.arenaRadius - 3);
      this.beast.mesh.position.x = this.arenaCenter.x + fromC.x;
      this.beast.mesh.position.z = this.arenaCenter.z + fromC.z;
    }
    this.beast.position.copy(this.beast.mesh.position);

    // Capture ready when vulnerable or plates gone + mid HP
    const captureReady =
      this.phase === 'vulnerable' || (this.plates <= 0 && hpRatio < 0.55 && hpRatio > 0.08);

    this.beast.mesh.userData.bossCaptureReady = captureReady;
    this.beast.mesh.userData.bossPlates = this.plates;
    this.beast.mesh.userData.bossTelegraphing = this.isTelegraphing;

    return { captureReady, phaseChanged };
  }

  private startBreathTelegraph(playerPos: THREE.Vector3) {
    const origin = this.beast.mesh.position.clone();
    origin.y = 0;
    const dir = playerPos.clone().sub(origin);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();

    this.pendingBreathDir = dir.clone();
    this.breathWindup = BREATH_TELEGRAPH;

    // Lock facing toward telegraph direction
    const look = origin.clone().add(dir);
    this.beast.mesh.lookAt(look.x, this.beast.mesh.position.y, look.z);

    this.telegraph.showCone(
      origin,
      dir,
      BREATH_RANGE,
      BREATH_HALF_ANGLE * 2,
      BREATH_TELEGRAPH,
      0xff6a00,
    );
  }

  /** Fire VFX + cone damage after telegraph completes */
  private resolveBreath(
    playerPos: THREE.Vector3,
    onPlayerDamage: (n: number, k: string) => void,
  ) {
    const dir = this.pendingBreathDir!;
    const origin = this.beast.mesh.position.clone();
    origin.y = 1.2;

    // Visual fire wedges along cone
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 0.18;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      const fire = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.85 }),
      );
      fire.position.copy(origin).addScaledVector(d, 2 + i * 1.4);
      fire.userData.life = 0.55;
      this.scene.add(fire);
      this.breathMeshes.push(fire);
    }

    // Damage if player still in cone
    const toP = playerPos.clone().sub(this.beast.mesh.position);
    toP.y = 0;
    const d = toP.length();
    if (d < BREATH_RANGE && d > 0.01) {
      const ang = dir.angleTo(toP.normalize());
      if (ang < BREATH_HALF_ANGLE) {
        onPlayerDamage(14 + this.enrage * 10, 'breath');
      }
    }
  }

  /** Extra damage application that also chips plates on heavy hits */
  applyBossHit(amount: number, heavy: boolean) {
    applyDamageToBeast(this.beast, amount, heavy);
    if (heavy || amount >= 16) {
      if (Math.random() < 0.45 + amount * 0.01) {
        this.beast.partBroken = true;
      }
    }
  }
}
