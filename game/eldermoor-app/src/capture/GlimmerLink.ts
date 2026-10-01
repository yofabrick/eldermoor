import * as THREE from 'three';
import type { WildBeast } from '../core/types';
import { at } from '../core/util';

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
  /** 5 ground wedges = visual bind strength (no text %). */
  private fitSegs: THREE.Mesh[] = [];
  private fitGroup = new THREE.Group();
  private fitChance = 0;
  private beamGeo: THREE.CylinderGeometry;
  private mode: GlimmerMode = 'off';
  private pulse = 0;
  private target: WildBeast | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.visible = false;
    this.scene.add(this.group);

    // Beam cylinder (thicker for FPS readability)
    this.beamGeo = new THREE.CylinderGeometry(0.06, 0.11, 1, 10, 1, true);
    this.beam = new THREE.Mesh(
      this.beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0x7dffc8,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.beam);

    // Outer soft beam shell (glow)
    const shellGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 10, 1, true);
    const shell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshBasicMaterial({
        color: 0xaeffe0,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    shell.name = 'beamShell';
    this.group.add(shell);
    (this as unknown as { beamShell: THREE.Mesh }).beamShell = shell;

    // Ground selection ring under target (wider lock-on)
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 36),
      new THREE.MeshBasicMaterial({
        color: 0x7dffc8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    this.outerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.4, 36),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.outerRing.rotation.x = -Math.PI / 2;
    this.group.add(this.outerRing);

    // Floating diamond above target (lock-on marker)
    this.crown = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({
        color: 0xe8fff4,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
      }),
    );
    this.group.add(this.crown);

    // Rising motes along the beam (more for channel spectacle)
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + (i % 3) * 0.02, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xaeffe0,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      );
      m.userData.t = i / 14;
      this.motes.push(m);
      this.group.add(m);
    }

    // Fit wedges under feet: empty = weak odds · filled = strong odds (show, don't tell)
    this.fitGroup.name = 'fitMeter';
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const start = (i / segs) * Math.PI * 2 - Math.PI / 2;
      const geo = new THREE.RingGeometry(1.55, 1.85, 12, 1, start, (Math.PI * 2) / segs - 0.08);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x3a3548,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.07;
      this.fitSegs.push(mesh);
      this.fitGroup.add(mesh);
    }
    this.group.add(this.fitGroup);
  }

  /**
   * Visual bind strength 0..1 (from catch chance). No numbers — wedges light up.
   * red/orange = hard · green = good · gold = channeling strong
   */
  setFit(chance: number) {
    this.fitChance = Math.max(0, Math.min(1, chance));
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

    const shell = this.group.getObjectByName('beamShell') as THREE.Mesh | null;
    if (shell) {
      shell.position.copy(this.beam.position);
      shell.scale.copy(this.beam.scale);
      shell.quaternion.copy(this.beam.quaternion);
      const sm = shell.material as THREE.MeshBasicMaterial;
      sm.opacity = this.mode === 'channeling' ? 0.28 : this.mode === 'ready' ? 0.2 : 0.12;
    }

    this.ring.position.set(to.x, 0.06, to.z);
    this.outerRing.position.set(to.x, 0.05, to.z);
    this.fitGroup.position.set(to.x, 0, to.z);
    const ready = this.mode === 'ready' || this.mode === 'channeling';
    const pulse = ready ? 1.18 + Math.sin(this.pulse * 5) * 0.1 : 1;
    this.ring.scale.setScalar(pulse);
    this.outerRing.scale.setScalar(ready ? 1.25 + Math.sin(this.pulse * 3) * 0.06 : 1.05);
    this.fitGroup.rotation.y = this.pulse * 0.4;
    this.updateFitVisuals();
  }

  private updateFitVisuals() {
    // How many wedges lit (1–5). Violet/not-ready: show dim outline only.
    const notReady = this.mode === 'focus';
    const lit = notReady ? 0 : Math.max(1, Math.round(this.fitChance * 5));
    for (let i = 0; i < this.fitSegs.length; i++) {
      const seg = at(this.fitSegs, i);
      if (seg === undefined) continue;
      const mat = seg.material as THREE.MeshBasicMaterial;
      const on = i < lit;
      if (notReady) {
        mat.color.setHex(0x5544aa);
        mat.opacity = 0.25;
      } else if (!on) {
        mat.color.setHex(0x2a2438);
        mat.opacity = 0.4;
      } else if (this.fitChance >= 0.7) {
        mat.color.setHex(this.mode === 'channeling' ? 0xffe08a : 0x3dff9a);
        mat.opacity = 0.95;
      } else if (this.fitChance >= 0.45) {
        mat.color.setHex(0xffc070);
        mat.opacity = 0.9;
      } else {
        mat.color.setHex(0xff6b6b);
        mat.opacity = 0.88;
      }
    }
  }

  private applyColors(mode: GlimmerMode) {
    const beam = this.beam.material as THREE.MeshBasicMaterial;
    const ring = this.ring.material as THREE.MeshBasicMaterial;
    const outer = this.outerRing.material as THREE.MeshBasicMaterial;
    const crown = this.crown.material as THREE.MeshBasicMaterial;

    // Color grammar (must read at a glance):
    // violet = not ready · green = ready · gold = channeling · white = success
    const shell = this.group.getObjectByName('beamShell') as THREE.Mesh | null;
    const shellMat = shell?.material as THREE.MeshBasicMaterial | undefined;

    if (mode === 'channeling') {
      beam.color.setHex(0xffe08a);
      ring.color.setHex(0xffe08a);
      outer.color.setHex(0xfff0b0);
      crown.color.setHex(0xffffff);
      ring.opacity = 0.98;
      shellMat?.color.setHex(0xffe08a);
      for (const m of this.motes) {
        (m.material as THREE.MeshBasicMaterial).color.setHex(0xffe08a);
      }
    } else if (mode === 'ready') {
      beam.color.setHex(0x3dff9a);
      ring.color.setHex(0x3dff9a);
      outer.color.setHex(0xc9a227);
      crown.color.setHex(0xb8ffd4);
      ring.opacity = 0.95;
      shellMat?.color.setHex(0x5dffb0);
      for (const m of this.motes) {
        (m.material as THREE.MeshBasicMaterial).color.setHex(0x5dffb0);
      }
    } else if (mode === 'focus') {
      beam.color.setHex(0x9a7cff);
      ring.color.setHex(0x9a7cff);
      outer.color.setHex(0x6644cc);
      crown.color.setHex(0xd8cfff);
      ring.opacity = 0.65;
      shellMat?.color.setHex(0xb0a0ff);
      for (const m of this.motes) {
        (m.material as THREE.MeshBasicMaterial).color.setHex(0xb0a0ff);
      }
    } else if (mode === 'success') {
      beam.color.setHex(0xffffff);
      ring.color.setHex(0xffffff);
      outer.color.setHex(0x6bcb8a);
      crown.color.setHex(0xffffff);
      shellMat?.color.setHex(0xffffff);
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
