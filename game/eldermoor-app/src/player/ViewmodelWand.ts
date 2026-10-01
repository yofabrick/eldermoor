import * as THREE from 'three';
import { at } from '../core/util';

type PathTint = 'none' | 'vita' | 'mortis';
type WandTier = 0 | 1 | 2;

const BASE_POS = new THREE.Vector3(0.28, -0.28, -0.55);
const PATH_COLORS: Record<PathTint, number> = {
  none: 0xc9a227, // gold
  vita: 0x4ade80, // green
  mortis: 0xa78bfa, // purple
};

/**
 * First-person viewmodel wand — child of the camera, bottom-right FPS pose.
 * Low-poly elegant: wood handle, shaft, crystal tip; tiers 0–2 upgrade look.
 */
export class ViewmodelWand {
  readonly root = new THREE.Group();

  private camera: THREE.Camera;
  private anim = new THREE.Group();
  private wand = new THREE.Group();

  private handleMat: THREE.MeshStandardMaterial;
  private shaftMat: THREE.MeshStandardMaterial;
  private tipMat: THREE.MeshStandardMaterial;
  private bandMat: THREE.MeshStandardMaterial;
  private runeMat: THREE.MeshStandardMaterial;
  private crackMat: THREE.MeshStandardMaterial;

  private tip!: THREE.Mesh;
  private tipLocal = new THREE.Vector3(0, 0.42, 0);
  private bands: THREE.Mesh[] = [];
  private runes: THREE.Mesh[] = [];
  private crackDecals: THREE.Mesh[] = [];

  private tier: WandTier = 0;
  private path: PathTint = 'none';
  private time = 0;

  private castKick = 0;
  private castFlash = 0;
  private castColor = 0xc9a227;
  private bindPulse = 0;

  private baseTipEmissive = 0.45;
  private baseTipColor = 0xc9a227;

  constructor(camera: THREE.Camera, _scene?: never) {
    this.camera = camera;

    this.handleMat = new THREE.MeshStandardMaterial({
      color: 0x5c3d24,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.shaftMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a2e,
      roughness: 0.75,
      metalness: 0.08,
    });
    this.tipMat = new THREE.MeshStandardMaterial({
      color: 0xe8d48b,
      emissive: 0xc9a227,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92,
    });
    this.bandMat = new THREE.MeshStandardMaterial({
      color: 0x8a9099,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.runeMat = new THREE.MeshStandardMaterial({
      color: 0xe8d48b,
      emissive: 0xc9a227,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.2,
    });
    this.crackMat = new THREE.MeshStandardMaterial({
      color: 0x2a2030,
      roughness: 1,
      metalness: 0,
    });

    this.buildMesh();
    this.root.add(this.anim);
    this.anim.add(this.wand);

    // FPS pose: bottom-right, tip points forward / slightly up
    this.root.position.copy(BASE_POS);
    this.wand.rotation.set(-0.55, 0.35, 0.18);
    this.wand.scale.setScalar(1);

    camera.add(this.root);
    this.applyTierVisuals();
    this.applyPathTint();
  }

  private buildMesh() {
    // Handle (grip)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.11, 7),
      this.handleMat,
    );
    handle.position.y = 0.0;
    handle.castShadow = false;

    // Pommel knob
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), this.handleMat);
    pommel.position.y = -0.06;

    // Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.32, 6), this.shaftMat);
    shaft.position.y = 0.2;

    // Ferrule between handle and shaft
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.018, 8), this.bandMat);
    ferrule.position.y = 0.055;
    this.bands.push(ferrule);

    // Iron bands (tier 1+)
    const bandA = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 5, 10), this.bandMat);
    bandA.rotation.x = Math.PI / 2;
    bandA.position.y = 0.14;
    this.bands.push(bandA);

    const bandB = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 5, 10), this.bandMat);
    bandB.rotation.x = Math.PI / 2;
    bandB.position.y = 0.28;
    this.bands.push(bandB);

    // Cracked crystal tip (octahedron reads as low-poly gem)
    this.tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), this.tipMat);
    this.tip.position.copy(this.tipLocal);
    this.tip.scale.set(1, 1.35, 1);

    // Crack lines on crystal (tier 0 emphasis)
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.05, 0.002), this.crackMat);
      crack.position.set((i - 1) * 0.012, this.tipLocal.y + (i % 2) * 0.01, 0.02);
      crack.rotation.z = (i - 1) * 0.4;
      this.crackDecals.push(crack);
      this.wand.add(crack);
    }

    // Glowing runes along shaft (tier 2)
    for (let i = 0; i < 4; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.003), this.runeMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      rune.position.set(Math.cos(a) * 0.015, 0.12 + i * 0.055, Math.sin(a) * 0.015);
      rune.lookAt(0, rune.position.y, 0);
      this.runes.push(rune);
      this.wand.add(rune);
    }

    this.wand.add(handle, pommel, shaft, ferrule, bandA, bandB, this.tip);
  }

  update(
    dt: number,
    opts: {
      moving: boolean;
      speed: number;
      casting: boolean;
      channeling: boolean;
      bindReady: boolean;
      path: PathTint;
    },
  ): void {
    this.time += dt;
    if (opts.path !== this.path) {
      this.path = opts.path;
      this.applyPathTint();
    }

    // Decay cast / bind one-shots
    this.castKick = Math.max(0, this.castKick - dt * 5.5);
    this.castFlash = Math.max(0, this.castFlash - dt * 4);
    this.bindPulse = Math.max(0, this.bindPulse - dt * 3.2);

    // opts.casting (~0.2s after cast) sustains a light kick/glow if playCast already fired
    const castHold = opts.casting ? 0.35 : 0;

    // Idle sway
    const swayX = Math.sin(this.time * 1.1) * 0.008;
    const swayY = Math.cos(this.time * 0.85) * 0.006;
    const swayRot = Math.sin(this.time * 0.7) * 0.02;

    // Walk bob — subtle, scales with speed
    const moveAmt = opts.moving ? THREE.MathUtils.clamp(opts.speed / 10, 0, 1.2) : 0;
    const bobY = Math.sin(this.time * 9.5) * 0.012 * moveAmt;
    const bobX = Math.cos(this.time * 4.75) * 0.006 * moveAmt;
    const bobRot = Math.sin(this.time * 9.5) * 0.03 * moveAmt;

    // Cast kick: pull back (+Z toward camera) + pitch tip down
    const kick = Math.max(this.castKick * this.castKick, castHold * castHold);
    const kickZ = kick * 0.07;
    const kickRotX = kick * 0.45;
    const kickY = kick * 0.02;

    // Channeling: slight shake + tip pulse gold/cyan
    let shakeX = 0;
    let shakeY = 0;
    let channelPulse = 0;
    if (opts.channeling) {
      shakeX = (Math.sin(this.time * 38) + Math.sin(this.time * 61) * 0.5) * 0.004;
      shakeY = (Math.cos(this.time * 43) + Math.sin(this.time * 29) * 0.5) * 0.004;
      channelPulse = 0.5 + 0.5 * Math.sin(this.time * 12);
    }

    // Bind-ready: soft breathe on tip
    const readyBreathe =
      opts.bindReady && !opts.channeling ? 0.15 + 0.1 * Math.sin(this.time * 4) : 0;

    this.anim.position.set(swayX + bobX + shakeX, swayY + bobY - kickY + shakeY, kickZ);
    this.anim.rotation.set(kickRotX, swayRot * 0.5, bobRot + swayRot);

    // Tip emissive composition
    const pathCol = new THREE.Color(this.baseTipColor);
    let intensity = this.baseTipEmissive + readyBreathe + castHold * 0.5;

    if (opts.channeling) {
      // Gold ↔ cyan pulse while binding
      const gold = new THREE.Color(0xffd700);
      const cyan = new THREE.Color(0x4fd2ff);
      pathCol.copy(gold).lerp(cyan, channelPulse);
      intensity = 0.7 + channelPulse * 1.1;
    }

    const flashAmt = Math.max(this.castFlash, castHold * 0.5);
    if (flashAmt > 0) {
      const flashCol = new THREE.Color(this.castColor);
      pathCol.lerp(flashCol, Math.min(1, flashAmt));
      intensity += flashAmt * 2.2;
    }

    if (this.bindPulse > 0) {
      pathCol.lerp(new THREE.Color(0xffffff), this.bindPulse * 0.6);
      intensity += this.bindPulse * 1.4;
    }

    this.tipMat.emissive.copy(pathCol);
    this.tipMat.emissiveIntensity = intensity;
    this.tipMat.color.copy(pathCol).multiplyScalar(0.55).offsetHSL(0, 0, 0.25);

    // Soft tip scale pulse on channel / cast
    const tipScale =
      1 + (opts.channeling ? channelPulse * 0.12 : 0) + flashAmt * 0.2 + this.bindPulse * 0.15;
    this.tip.scale.set(tipScale, 1.35 * tipScale, tipScale);

    if (this.tier >= 2) {
      this.runeMat.emissiveIntensity =
        0.7 + Math.sin(this.time * 3) * 0.25 + (opts.channeling ? channelPulse * 0.5 : 0);
    }
  }

  playCast(color: number): void {
    this.castColor = color;
    this.castKick = 1;
    this.castFlash = 1;
  }

  playBindPulse(): void {
    this.bindPulse = 1;
  }

  setTier(tier: WandTier): void {
    const t = Math.max(0, Math.min(2, tier | 0)) as WandTier;
    if (t === this.tier) return;
    this.tier = t;
    this.applyTierVisuals();
  }

  getTipWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    // Tip local offset through full hierarchy → world
    this.tip.getWorldPosition(out);
    return out;
  }

  dispose(): void {
    this.camera.remove(this.root);
    const geos = new Set<THREE.BufferGeometry>();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry != null) geos.add(obj.geometry);
    });
    for (const g of geos) g.dispose();
    this.handleMat.dispose();
    this.shaftMat.dispose();
    this.tipMat.dispose();
    this.bandMat.dispose();
    this.runeMat.dispose();
    this.crackMat.dispose();
  }

  private applyPathTint() {
    this.baseTipColor = PATH_COLORS[this.path];
    this.tipMat.emissive.setHex(this.baseTipColor);
    this.tipMat.color.setHex(this.baseTipColor);
    // Brightness by path
    this.baseTipEmissive = this.path === 'none' ? 0.45 : 0.55;
  }

  private applyTierVisuals() {
    // Tier 0: wood + cracked crystal (dim tip, cracks visible)
    // Tier 1: iron bands visible
    // Tier 2: runes glow + bright tip
    const showBands = this.tier >= 1;
    const showRunes = this.tier >= 2;
    const showCracks = this.tier === 0;

    // Ferrule (index 0) always on; extra iron bands only tier 1+
    if (this.bands[0]) this.bands[0].visible = true;
    for (let i = 1; i < this.bands.length; i++) {
      const band = at(this.bands, i);
      if (band) band.visible = showBands;
    }
    for (const r of this.runes) r.visible = showRunes;
    for (const c of this.crackDecals) c.visible = showCracks;

    if (this.tier === 0) {
      this.handleMat.color.setHex(0x5c3d24);
      this.shaftMat.color.setHex(0x6b4a2e);
      this.shaftMat.metalness = 0.05;
      this.tipMat.opacity = 0.85;
      this.baseTipEmissive = this.path === 'none' ? 0.35 : 0.45;
    } else if (this.tier === 1) {
      this.handleMat.color.setHex(0x4a3828);
      this.shaftMat.color.setHex(0x5a4a3a);
      this.shaftMat.metalness = 0.25;
      this.tipMat.opacity = 0.92;
      this.baseTipEmissive = this.path === 'none' ? 0.5 : 0.6;
    } else {
      this.handleMat.color.setHex(0x3d2e22);
      this.shaftMat.color.setHex(0x4a3a50);
      this.shaftMat.metalness = 0.35;
      this.tipMat.opacity = 0.98;
      this.baseTipEmissive = this.path === 'none' ? 0.7 : 0.85;
      this.runeMat.emissiveIntensity = 0.9;
    }

    this.tipMat.emissiveIntensity = this.baseTipEmissive;
  }
}
