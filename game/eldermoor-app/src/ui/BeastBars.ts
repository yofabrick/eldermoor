import * as THREE from 'three';

export type BarKind = 'enemy' | 'ally';

export interface BarTarget {
  id: string;
  position: THREE.Vector3;
  /** World Y offset for the bar (above head) */
  height: number;
  hp: number;
  maxHp: number;
  kind: BarKind;
  /** Optional name under the bar */
  label?: string;
}

/**
 * World-space HP bars:
 * - enemy = always red
 * - ally  = always green
 */
export class BeastBars {
  private bars = new Map<string, THREE.Sprite>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  clear() {
    for (const s of this.bars.values()) this.scene.remove(s);
    this.bars.clear();
  }

  /** Pass all targets each frame (enemies + allies). */
  update(targets: BarTarget[], playerPos: THREE.Vector3, range = 22) {
    const seen = new Set<string>();
    for (const t of targets) {
      if (t.hp <= 0 || t.maxHp <= 0) continue;
      const d = playerPos.distanceTo(t.position);
      if (d > range) continue;
      seen.add(t.id);
      let spr = this.bars.get(t.id);
      if (!spr) {
        spr = this.makeBar();
        this.bars.set(t.id, spr);
        this.scene.add(spr);
      }
      const ratio = Math.max(0, Math.min(1, t.hp / t.maxHp));
      this.paint(spr, ratio, t.kind, t.label);
      spr.position.copy(t.position);
      spr.position.y = t.height;
      spr.scale.set(t.kind === 'ally' ? 1.35 : 1.25, t.label ? 0.42 : 0.22, 1);
      spr.visible = true;
    }
    for (const [id, spr] of this.bars) {
      if (!seen.has(id)) {
        this.scene.remove(spr);
        this.bars.delete(id);
      }
    }
  }

  private makeBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 40;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.userData.canvas = canvas;
    spr.userData.tex = tex;
    spr.renderOrder = 10;
    return spr;
  }

  private paint(spr: THREE.Sprite, ratio: number, kind: BarKind, label?: string) {
    const canvas = spr.userData.canvas as HTMLCanvasElement;
    const tex = spr.userData.tex as THREE.CanvasTexture;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 160, 40);

    const barY = label ? 18 : 12;
    const barH = 12;
    // background
    ctx.fillStyle = 'rgba(10,8,18,0.85)';
    ctx.fillRect(4, barY, 152, barH);
    // fill: enemies ALWAYS red, allies ALWAYS green
    ctx.fillStyle = kind === 'enemy' ? '#e85d5d' : '#3dd68c';
    ctx.fillRect(4, barY, 152 * ratio, barH);
    // border
    ctx.strokeStyle = kind === 'enemy' ? '#ff8888' : '#7dffb0';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, barY, 152, barH);

    if (label) {
      ctx.font = 'bold 11px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = kind === 'enemy' ? '#ffb0b0' : '#b8ffd4';
      ctx.fillText(label, 80, 12);
    }

    tex.needsUpdate = true;
  }
}
