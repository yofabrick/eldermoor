import * as THREE from 'three';

/**
 * Camera juice: FOV kick, head bob, punch offsets.
 * Applied after player sets base camera pose.
 */
export class FeelCamera {
  private baseFov = 60;
  private fov = 60;
  private bobPhase = 0;
  private punch = new THREE.Vector3();
  private roll = 0;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.baseFov = camera.fov;
    this.fov = camera.fov;
  }

  /** speed 0..1-ish, grounded */
  update(
    dt: number,
    opts: {
      speed: number;
      sprinting: boolean;
      mounted: boolean;
      moving: boolean;
    },
  ) {
    // FOV: sprint/gallop opens up
    const targetFov =
      this.baseFov + (opts.sprinting ? 8 : 0) + (opts.mounted ? 4 : 0) + (opts.speed > 10 ? 3 : 0);
    this.fov = THREE.MathUtils.lerp(this.fov, targetFov, 1 - Math.pow(0.001, dt));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // Head bob
    if (opts.moving && opts.speed > 0.5) {
      const cadence = opts.sprinting ? 14 : opts.mounted ? 10 : 9;
      this.bobPhase += dt * cadence * (0.6 + Math.min(1.5, opts.speed / 10));
    } else {
      this.bobPhase *= 0.9;
    }
    const bobAmp = opts.mounted ? 0.04 : 0.055;
    const bobY = Math.sin(this.bobPhase) * bobAmp * Math.min(1, opts.speed / 8);
    const bobX = Math.cos(this.bobPhase * 0.5) * bobAmp * 0.35 * Math.min(1, opts.speed / 8);

    // Punch decay
    this.punch.multiplyScalar(Math.pow(0.02, dt));
    this.roll = THREE.MathUtils.lerp(this.roll, 0, 1 - Math.pow(0.001, dt));

    this.camera.position.x += bobX + this.punch.x;
    this.camera.position.y += bobY + this.punch.y;
    this.camera.position.z += this.punch.z;
    // subtle roll via quaternion would need more care — skip for stability
  }

  /** Screen punch (damage / success) */
  addPunch(amount: number, dir?: THREE.Vector3) {
    if (dir) {
      this.punch.addScaledVector(dir, amount * 0.15);
    } else {
      this.punch.y += amount * 0.08;
      this.punch.x += (Math.random() - 0.5) * amount * 0.05;
    }
  }

  addFovKick(delta: number) {
    this.fov = Math.min(this.baseFov + 18, this.fov + delta);
  }
}
