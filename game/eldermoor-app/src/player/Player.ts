import * as THREE from 'three';
import type { Input } from '../core/Input';

export class Player {
  mesh: THREE.Group;
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0.35;
  hp = 100;
  maxHp = 100;
  mana = 100;
  maxMana = 100;
  strain = 0;
  stamina = 100;
  wardTimer = 0;
  invuln = 0;
  height = 1.7;
  /** External speed multiplier (mount). */
  speedMul = 1;
  private lookTarget = new THREE.Vector3();

  private camera: THREE.PerspectiveCamera;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, spawn: THREE.Vector3) {
    this.camera = camera;
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a4560, roughness: 0.6 }),
    );
    body.position.y = 1.0;
    body.castShadow = true;
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2438 }),
    );
    hood.position.y = 1.75;
    const wand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0xc9a227, emissiveIntensity: 0.3 }),
    );
    wand.position.set(0.45, 1.1, 0.1);
    wand.rotation.z = Math.PI / 5;
    this.mesh.add(body, hood, wand);
    this.mesh.position.copy(spawn);
    // Soft body shadow blob
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.mesh.add(shadow);
    // Player receives/casts for nicer lighting
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(this.mesh);
  }

  get position() {
    return this.mesh.position;
  }

  /** Horizontal movement facing (no pitch). */
  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /**
   * True aim direction matching screen-center reticle.
   * Includes pitch so shots go where you look, not flat over their heads.
   */
  get aimForward() {
    // pitch: 0 = horizon-ish, higher = more top-down look-down from behind
    // Camera sits behind+above; aim uses yaw + pitch mapped so mouse-up aims higher.
    const pitchFromHorizon = (0.55 - this.pitch) * 1.15; // invert: pull mouse down → look down
    const cosP = Math.cos(pitchFromHorizon);
    const sinP = Math.sin(pitchFromHorizon);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cosP,
      sinP,
      -Math.cos(this.yaw) * cosP,
    ).normalize();
  }

  /** Camera getWorldDirection (after lookAt) — most accurate reticle ray. */
  getCameraAimDir(out = new THREE.Vector3()) {
    this.camera.getWorldDirection(out);
    return out.normalize();
  }

  update(dt: number, input: Input, bounds: number) {
    const mouse = input.consumeMouse();
    if (input.pointerLocked) {
      this.yaw -= mouse.dx * 0.0022;
      // mouse up (negative movementY) → decrease pitch value → look higher
      this.pitch = THREE.MathUtils.clamp(this.pitch - mouse.dy * 0.0022, 0.12, 1.15);
    }

    const forward = this.forward;
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (input.pressed('KeyW')) wish.add(forward);
    if (input.pressed('KeyS')) wish.sub(forward);
    if (input.pressed('KeyD')) wish.add(right);
    if (input.pressed('KeyA')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    let speed = 7.5 * this.speedMul;
    const gallop = input.pressed('Space') && this.stamina > 10;
    if (gallop) {
      speed = (this.speedMul > 1.2 ? 18 : 14) * Math.max(1, this.speedMul * 0.85);
      this.stamina -= (this.speedMul > 1.2 ? 18 : 35) * dt;
    } else {
      this.stamina = Math.min(100, this.stamina + 20 * dt);
    }

    this.velocity.x = wish.x * speed;
    this.velocity.z = wish.z * speed;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;

    const r = Math.hypot(this.mesh.position.x, this.mesh.position.z);
    if (r > bounds) {
      const s = bounds / r;
      this.mesh.position.x *= s;
      this.mesh.position.z *= s;
    }
    // Mount raises player slightly
    this.mesh.position.y = this.speedMul > 1.2 ? 0.85 : 0;
    this.mesh.rotation.y = this.yaw;

    // Third-person orbit: camera behind, look AHEAD of player so reticle is on world
    const camDist = this.speedMul > 1.2 ? 8.2 : 6.0;
    const camH = (this.speedMul > 1.2 ? 2.8 : 2.15) + this.pitch * 0.85;
    const ox = Math.sin(this.yaw) * camDist;
    const oz = Math.cos(this.yaw) * camDist;
    const desired = new THREE.Vector3(
      this.mesh.position.x + ox,
      this.mesh.position.y + camH,
      this.mesh.position.z + oz,
    );
    this.camera.position.lerp(desired, 1 - Math.pow(0.0008, dt));

    // Look point: ahead of character at aim height (NOT into the character's back)
    const lookDist = 14;
    const aim = this.aimForward;
    this.lookTarget.set(
      this.mesh.position.x + aim.x * lookDist,
      this.mesh.position.y + 1.35 + aim.y * lookDist,
      this.mesh.position.z + aim.z * lookDist,
    );
    this.camera.lookAt(this.lookTarget);

    this.mana = Math.min(this.maxMana, this.mana + 8 * dt);
    this.strain = Math.max(0, this.strain - 6 * dt);
    this.wardTimer = Math.max(0, this.wardTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 1.5 * dt);
  }

  takeDamage(amount: number): boolean {
    if (this.invuln > 0) return false;
    if (this.wardTimer > 0) amount *= 0.35;
    this.hp -= amount;
    this.invuln = 0.4;
    return true;
  }

  trySpend(mana: number, strain = 0): boolean {
    if (this.mana < mana) return false;
    this.mana -= mana;
    this.strain = Math.min(100, this.strain + strain);
    return true;
  }
}
