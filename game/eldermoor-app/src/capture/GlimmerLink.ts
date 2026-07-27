import * as THREE from 'three';
import type { WildBeast } from '../core/types';

export type GlimmerMode = 'off' | 'focus' | 'ready' | 'channeling' | 'success';

/**
 * "Alien abduction" style glimmer tether:
 * glowing beam from wand → target + ground ring + rising motes.
 * Makes it obvious WHICH creature binding targets.
 */
export class GlimmerLink {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private outerRing: THREE.Mesh;
  private crown: THREE.Mesh;
  private motes: THREE.Mesh[] = [];
  private beamGeo: THREE.CylinderGeometry;
  private mode: GlimmerMode = 'off';
  private pulse = 0;
  private target: WildBeast | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.visible = false;
    this.scene.add(this.group);

    // Beam cylinder (scaled each frame to fit distance)
    this.beamGeo = new THREE.CylinderGeometry(0.04, 0.08, 1, 8, 1, true);
    this.beam = new THREE.Mesh(
      this.beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0x7dffc8,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.beam);

    // Ground selection ring under target
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7dffc8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    this.outerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.25, 32),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.outerRing.rotation.x = -Math.PI / 2;
    this.group.add(this.outerRing);

    // Floating diamond above target (lock-on marker)
    this.crown = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({
        color: 0xe8fff4,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    this.group.add(this.crown);

    // Rising motes along the beam
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xaeffe0,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      m.userData.t = i / 10;
      this.motes.push(m);
      this.group.add(m);
    }
  }

  get focused(): WildBeast | null {
    return this.target;
  }

  setMode(mode: GlimmerMode) {
    this.mode = mode;
  }

  /**
   * Focus a beast (or null to hide).
   * from = wand/chest position, to = beast center.
   */
  setFocus(beast: WildBeast | null, from: THREE.Vector3, mode: GlimmerMode) {
    this.target = beast;
    this.mode = mode;
    if (!beast || mode === 'off') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.layout(from, beast.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
    this.applyColors(mode);
  }

  update(dt: number, from: THREE.Vector3) {
    if (!this.group.visible || !this.target) return;
    if (this.target.hp <= 0 || this.target.state === 'captured') {
      this.group.visible = false;
      this.target = null;
      return;
    }
    this.pulse += dt;
    const to = this.target.mesh.position.clone().add(new THREE.Vector3(0, 0.65, 0));
    this.layout(from, to);
    this.applyColors(this.mode);

    // Animate rings + motes
    const spin = this.mode === 'channeling' ? 2.8 : 1.2;
    this.ring.rotation.z += dt * spin;
    this.outerRing.rotation.z -= dt * spin * 0.7;
    this.crown.position.copy(to);
    this.crown.position.y += 1.1 + Math.sin(this.pulse * 3) * 0.12;
    this.crown.rotation.y += dt * 2;
    this.crown.rotation.x = Math.sin(this.pulse * 2) * 0.3;

    const mid = from.clone().lerp(to, 0.5);
    const dist = from.distanceTo(to);
    for (const m of this.motes) {
      m.userData.t = (m.userData.t + dt * (this.mode === 'channeling' ? 0.55 : 0.25)) % 1;
      const t = m.userData.t as number;
      // rise from target to player (abduction feel) when channeling; otherwise swirl at target
      if (this.mode === 'channeling' || this.mode === 'ready') {
        const p = to.clone().lerp(from, t);
        p.y += Math.sin(t * Math.PI) * 0.35;
        m.position.copy(p);
        m.visible = true;
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + 0.7 * Math.sin(t * Math.PI);
      } else {
        const a = this.pulse * 2 + t * Math.PI * 2;
        m.position.set(
          to.x + Math.cos(a) * 0.7,
          to.y + 0.3 + Math.sin(this.pulse * 3 + t) * 0.2,
          to.z + Math.sin(a) * 0.7,
        );
        m.visible = this.mode !== 'off';
      }
    }

    // Pulse beam opacity
    const mat = this.beam.material as THREE.MeshBasicMaterial;
    const base = this.mode === 'channeling' ? 0.75 : this.mode === 'ready' ? 0.55 : 0.28;
    mat.opacity = base + Math.sin(this.pulse * 6) * 0.12;

    // Channel: thicken beam
    const thick = this.mode === 'channeling' ? 1.6 : this.mode === 'ready' ? 1.15 : 0.85;
    this.beam.scale.x = thick;
    this.beam.scale.z = thick;
    void mid;
    void dist;
  }

  private layout(from: THREE.Vector3, to: THREE.Vector3) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.05) return;
    dir.normalize();

    // Cylinder default points +Y; orient along from→to
    this.beam.position.copy(from).add(to).multiplyScalar(0.5);
    this.beam.scale.set(1, dist, 1);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    this.ring.position.set(to.x, 0.06, to.z);
    this.outerRing.position.set(to.x, 0.05, to.z);
    const ready = this.mode === 'ready' || this.mode === 'channeling';
    this.ring.scale.setScalar(ready ? 1.15 + Math.sin(this.pulse * 5) * 0.08 : 1);
    this.outerRing.scale.setScalar(ready ? 1.2 : 1);
  }

  private applyColors(mode: GlimmerMode) {
    const beam = this.beam.material as THREE.MeshBasicMaterial;
    const ring = this.ring.material as THREE.MeshBasicMaterial;
    const outer = this.outerRing.material as THREE.MeshBasicMaterial;
    const crown = this.crown.material as THREE.MeshBasicMaterial;

    if (mode === 'channeling') {
      // Bright gold-cyan abduction
      beam.color.setHex(0xffe08a);
      ring.color.setHex(0xffe08a);
      outer.color.setHex(0x7dffc8);
      crown.color.setHex(0xffffff);
      ring.opacity = 0.95;
    } else if (mode === 'ready') {
      // Ready to bind — cyan/green lock
      beam.color.setHex(0x5dffb0);
      ring.color.setHex(0x5dffb0);
      outer.color.setHex(0xc9a227);
      crown.color.setHex(0xb8ffd4);
      ring.opacity = 0.9;
    } else if (mode === 'focus') {
      // Looking at it but not ready — dim violet link
      beam.color.setHex(0x8a7cff);
      ring.color.setHex(0x8a7cff);
      outer.color.setHex(0x5544aa);
      crown.color.setHex(0xc8bfff);
      ring.opacity = 0.55;
    } else if (mode === 'success') {
      beam.color.setHex(0xffffff);
      ring.color.setHex(0xffffff);
      outer.color.setHex(0x6bcb8a);
      crown.color.setHex(0xffffff);
    }
  }

  flashSuccess() {
    this.mode = 'success';
    this.applyColors('success');
  }

  hide() {
    this.group.visible = false;
    this.target = null;
    this.mode = 'off';
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

/**
 * Pick best bind target: prefer look-direction, then distance.
 * range = max meters.
 */
/**
 * Pick bind target using full 3D aim (camera/reticle), not flat yaw.
 * `aimDir` should be camera getWorldDirection / aimForward.
 */
export function pickBindTarget(
  wild: WildBeast[],
  playerPos: THREE.Vector3,
  aimDir: THREE.Vector3,
  range = 14,
  cameraPos?: THREE.Vector3,
): WildBeast | null {
  const origin = cameraPos?.clone() ?? playerPos.clone().add(new THREE.Vector3(0, 1.4, 0));
  let best: WildBeast | null = null;
  let bestScore = Infinity;

  const dir = aimDir.clone().normalize();

  for (const b of wild) {
    if (b.hp <= 0 || b.state === 'captured') continue;
    const center = b.mesh.position.clone();
    center.y += 0.65;
    const to = center.clone().sub(origin);
    const dist = to.length();
    if (dist > range || dist < 0.5) continue;
    const along = to.dot(dir);
    if (along < 0.4) continue;
    const closest = origin.clone().addScaledVector(dir, along);
    const lateral = closest.distanceTo(center);
    // Must be near the reticle ray
    if (lateral > 2.4 && along > 3) continue;
    const score = lateral * 2.2 + dist * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}
