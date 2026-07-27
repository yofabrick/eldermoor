import * as THREE from 'three';

/** Full day cycle length in real-time seconds (~8 minutes). */
const DAY_LENGTH_SEC = 8 * 60;

export class DayNight {
  /** Normalized time of day in [0, 1). 0 = dawn. */
  timeOfDay = 0.15;

  /**
   * Advance the day cycle and tint lights / fog.
   * @param dt delta time in seconds
   */
  update(
    dt: number,
    sun?: THREE.DirectionalLight,
    hemi?: THREE.HemisphereLight,
    scene?: THREE.Scene,
  ): void {
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH_SEC) % 1;

    const t = this.timeOfDay;
    const night = this.isNight();
    const dayFactor = this.dayFactor(t);

    if (sun) {
      // Orbit: rise at dawn, high midday, set at dusk
      const angle = t * Math.PI * 2 - Math.PI * 0.5;
      const elev = Math.sin(t * Math.PI * 2);
      sun.position.set(Math.cos(angle) * 60, Math.max(elev, -0.15) * 70 + 10, Math.sin(angle) * 40);

      const dayColor = new THREE.Color(0xfff0c8);
      const duskColor = new THREE.Color(0xff8a40);
      const nightColor = new THREE.Color(0x8899cc);

      let col: THREE.Color;
      if (t < 0.2) {
        col = nightColor.clone().lerp(dayColor, t / 0.2);
      } else if (t < 0.45) {
        col = dayColor.clone();
      } else if (t < 0.6) {
        col = dayColor.clone().lerp(duskColor, (t - 0.45) / 0.15);
      } else if (t < 0.75) {
        col = duskColor.clone().lerp(nightColor, (t - 0.6) / 0.15);
      } else {
        col = nightColor.clone();
      }
      sun.color.copy(col);
      sun.intensity = THREE.MathUtils.lerp(0.12, 1.05, dayFactor);
    }

    if (hemi) {
      const skyDay = new THREE.Color(0xc9d6e8);
      const skyNight = new THREE.Color(0x0a0c1a);
      const groundDay = new THREE.Color(0x2a3a28);
      const groundNight = new THREE.Color(0x0a100e);
      hemi.color.copy(skyNight.clone().lerp(skyDay, dayFactor));
      hemi.groundColor.copy(groundNight.clone().lerp(groundDay, dayFactor));
      hemi.intensity = THREE.MathUtils.lerp(0.12, 0.6, dayFactor);
    }

    if (scene) {
      const fogDay = new THREE.Color(0x0b0a12);
      const fogNight = new THREE.Color(0x05040a);
      const fogWarm = new THREE.Color(0x1a100c);
      const fogCol = fogDay.clone().lerp(fogNight, 1 - dayFactor);
      // Warm dusk tint
      if (t > 0.45 && t < 0.7) {
        const duskAmt = 1 - Math.abs(t - 0.55) / 0.15;
        fogCol.lerp(fogWarm, Math.max(0, duskAmt) * 0.45);
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(fogCol);
        scene.fog.near = THREE.MathUtils.lerp(28, 40, dayFactor);
        scene.fog.far = THREE.MathUtils.lerp(90, 120, dayFactor);
      }
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(fogCol);
      }

      const amb = scene.getObjectByName('ambient');
      if (amb instanceof THREE.AmbientLight) {
        amb.intensity = night
          ? THREE.MathUtils.lerp(0.08, 0.18, dayFactor)
          : THREE.MathUtils.lerp(0.15, 0.35, dayFactor);
        amb.color.set(night ? 0x101428 : 0x1a1830);
      }
    }
  }

  /** Night when timeOfDay is in [0.75, 1) ∪ [0, 0.2). */
  isNight(): boolean {
    return this.timeOfDay >= 0.75 || this.timeOfDay < 0.2;
  }

  /** 0 = darkest night, 1 = brightest day. */
  private dayFactor(t: number): number {
    if (t >= 0.2 && t < 0.75) {
      const u = (t - 0.2) / 0.55;
      return Math.sin(u * Math.PI) * 0.35 + 0.65;
    }
    if (t < 0.2) {
      return THREE.MathUtils.smoothstep(t, 0.05, 0.22) * 0.65;
    }
    return (1 - THREE.MathUtils.smoothstep(t, 0.72, 0.88)) * 0.65;
  }
}
