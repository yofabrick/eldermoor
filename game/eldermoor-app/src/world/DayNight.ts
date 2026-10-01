import * as THREE from 'three';

/** Full day cycle length in real-time seconds (~10 minutes — more daylight). */
const DAY_LENGTH_SEC = 10 * 60;

export class DayNight {
  /** Normalized time of day in [0, 1). Start mid-morning so first play is bright. */
  timeOfDay = 0.32;

  /**
   * Advance the day cycle and tint lights / fog.
   * Bright fantasy glade — night stays readable, never pure black.
   */
  update(
    dt: number,
    sun?: THREE.DirectionalLight,
    hemi?: THREE.HemisphereLight,
    scene?: THREE.Scene,
  ): void {
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH_SEC) % 1;

    const t = this.timeOfDay;
    const dayFactor = this.dayFactor(t);
    const night = this.isNight();

    if (sun) {
      const angle = t * Math.PI * 2 - Math.PI * 0.5;
      const elev = Math.sin(t * Math.PI * 2);
      // Keep sun reasonably high even at "night" (cool moonlight)
      sun.position.set(Math.cos(angle) * 55, Math.max(elev, 0.28) * 65 + 28, Math.sin(angle) * 40);

      const dayColor = new THREE.Color(0xfff8e8);
      const duskColor = new THREE.Color(0xff9a50); // punchier golden hour
      const nightColor = new THREE.Color(0xb8c8f0); // cool readable moon

      let col: THREE.Color;
      if (t < 0.18) {
        col = nightColor.clone().lerp(dayColor, t / 0.18);
      } else if (t < 0.48) {
        col = dayColor.clone();
      } else if (t < 0.62) {
        col = dayColor.clone().lerp(duskColor, (t - 0.48) / 0.14);
      } else if (t < 0.78) {
        col = duskColor.clone().lerp(nightColor, (t - 0.62) / 0.16);
      } else {
        col = nightColor.clone();
      }
      sun.color.copy(col);
      // Day bright; night moon still paints silhouettes (camp fire fills warm pockets)
      sun.intensity = THREE.MathUtils.lerp(0.62, 1.95, dayFactor);
    }

    if (hemi) {
      const skyDay = new THREE.Color(0xe4eef8);
      const skyNight = new THREE.Color(0x3a4868);
      const groundDay = new THREE.Color(0x5a7a42);
      const groundNight = new THREE.Color(0x2e3c32);
      hemi.color.copy(skyNight.clone().lerp(skyDay, dayFactor));
      hemi.groundColor.copy(groundNight.clone().lerp(groundDay, dayFactor));
      hemi.intensity = THREE.MathUtils.lerp(0.62, 1.2, dayFactor);
    }

    if (scene) {
      // Soft fog — never crushed black; dusk gets warm amber push
      const fogDay = new THREE.Color(0xc0d0e0);
      const fogNight = new THREE.Color(0x3e4a62);
      const fogWarm = new THREE.Color(0xe0a878);
      const fogCol = fogNight.clone().lerp(fogDay, dayFactor);
      if (t > 0.48 && t < 0.72) {
        const duskAmt = 1 - Math.abs(t - 0.58) / 0.14;
        fogCol.lerp(fogWarm, Math.max(0, duskAmt) * 0.45);
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(fogCol);
        scene.fog.near = THREE.MathUtils.lerp(50, 72, dayFactor);
        scene.fog.far = THREE.MathUtils.lerp(135, 185, dayFactor);
      }
      if (scene.background instanceof THREE.Color) {
        const sky = fogCol.clone().lerp(new THREE.Color(0xeef4fa), dayFactor * 0.5);
        if (night) sky.lerp(new THREE.Color(0x2c3858), 0.32);
        // Dusk sky warmth
        if (t > 0.5 && t < 0.7) {
          sky.lerp(new THREE.Color(0xffc090), (1 - Math.abs(t - 0.58) / 0.12) * 0.25);
        }
        scene.background.copy(sky);
      }

      const amb = scene.getObjectByName('ambient');
      if (amb instanceof THREE.AmbientLight) {
        amb.intensity = THREE.MathUtils.lerp(0.5, 0.8, dayFactor);
        amb.color.set(night ? 0x7080a0 : 0xd0d8e8);
      }
    }
  }

  /** Night when timeOfDay is in [0.78, 1) ∪ [0, 0.18). */
  isNight(): boolean {
    return this.timeOfDay >= 0.78 || this.timeOfDay < 0.18;
  }

  /** 0 = darkest night, 1 = brightest day — floor raised so night is playable. */
  private dayFactor(t: number): number {
    if (t >= 0.18 && t < 0.78) {
      const u = (t - 0.18) / 0.6;
      // Punchier golden-hour peak (cozy camp postcard)
      return 0.8 + Math.sin(u * Math.PI) * 0.2;
    }
    if (t < 0.18) {
      // Night still readable: moon + camp fire carry silhouettes
      return 0.48 + THREE.MathUtils.smoothstep(t, 0.0, 0.2) * 0.32;
    }
    return 0.48 + (1 - THREE.MathUtils.smoothstep(t, 0.76, 0.95)) * 0.32;
  }

  /** Dusk warmth amount 0..1 for camp fire emphasis */
  duskWarmth(): number {
    const t = this.timeOfDay;
    if (t > 0.48 && t < 0.72) {
      return 1 - Math.abs(t - 0.58) / 0.14;
    }
    return 0;
  }
}
