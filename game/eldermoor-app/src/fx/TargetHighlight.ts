import * as THREE from 'three';
import type { WildBeast } from '../core/types';

/**
 * Soft emissive pulse on the currently focused bind target
 * so it reads clearly against other red-bar enemies.
 */
export class TargetHighlight {
  private current: WildBeast | null = null;
  private saved = new Map<THREE.Material, { emissive: THREE.Color; intensity: number }>();
  private pulse = 0;

  setTarget(beast: WildBeast | null, mode: 'focus' | 'ready' | 'channeling' | 'off') {
    if (this.current && this.current !== beast) {
      this.restore(this.current);
      this.current = null;
    }
    if (!beast || mode === 'off') {
      if (this.current) this.restore(this.current);
      this.current = null;
      return;
    }
    if (this.current !== beast) {
      this.current = beast;
      this.capture(beast);
    }
    this.pulse += 0.08;
    const col = mode === 'channeling' ? 0xffe08a : mode === 'ready' ? 0x5dffb0 : 0x8a7cff;
    const inten =
      mode === 'channeling'
        ? 0.55 + Math.sin(this.pulse * 8) * 0.25
        : mode === 'ready'
          ? 0.4
          : 0.22;
    this.apply(beast, col, inten);
  }

  /** Lift mesh during channel progress 0..1 */
  setLift(beast: WildBeast | null, progress: number) {
    if (!beast) return;
    const defY = ((beast.mesh.userData.baseScale as number) || 1) * 0.5;
    // store original y once
    if (beast.mesh.userData._groundY == null) {
      beast.mesh.userData._groundY = defY;
    }
    const ground = beast.mesh.userData._groundY as number;
    const lift = progress * progress * 2.8; // ease-in lift (abduction)
    beast.mesh.position.y = ground + lift;
    // gentle spin
    beast.mesh.rotation.y += 0.04 + progress * 0.08;
    // scale breathe
    const s = 1 + progress * 0.08;
    beast.mesh.scale.setScalar(((beast.mesh.userData.baseScale as number) || 1) * s);
  }

  resetLift(beast: WildBeast | null) {
    if (!beast) return;
    const ground = (beast.mesh.userData._groundY as number | undefined) ?? beast.mesh.position.y;
    beast.mesh.position.y = ground;
    const base = (beast.mesh.userData.baseScale as number) || 1;
    beast.mesh.scale.setScalar(base);
  }

  clear() {
    if (this.current) this.restore(this.current);
    this.current = null;
  }

  private capture(beast: WildBeast) {
    beast.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
        const m = c.material;
        if (!this.saved.has(m)) {
          this.saved.set(m, {
            emissive: m.emissive.clone(),
            intensity: m.emissiveIntensity,
          });
        }
      }
    });
  }

  private apply(beast: WildBeast, color: number, intensity: number) {
    beast.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
        c.material.emissive.setHex(color);
        c.material.emissiveIntensity = intensity;
      }
    });
  }

  private restore(beast: WildBeast) {
    beast.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
        const s = this.saved.get(c.material);
        if (s) {
          c.material.emissive.copy(s.emissive);
          c.material.emissiveIntensity = s.intensity;
        }
      }
    });
  }
}
