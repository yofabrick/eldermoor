import * as THREE from 'three';
import { hasText, nonzero, requireCanvas2d } from '../core/util';

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
  /** Beast tier 1–3 as ◆ pips (visual rank, no text "level") */
  tier?: number;
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
      this.paint(spr, ratio, t.kind, t.label, t.tier);
      spr.position.copy(t.position);
      spr.position.y = t.height;
      const hasHead = hasText(t.label) || nonzero(t.tier);
      spr.scale.set(t.kind === 'ally' ? 1.35 : 1.25, hasHead ? 0.48 : 0.22, 1);
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
    canvas.height = 48;
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

  private paint(spr: THREE.Sprite, ratio: number, kind: BarKind, label?: string, tier = 0) {
    const canvas = spr.userData.canvas as HTMLCanvasElement;
    const tex = spr.userData.tex as THREE.CanvasTexture;
    const ctx = requireCanvas2d(canvas);
    ctx.clearRect(0, 0, 160, 48);

    const hasHead = hasText(label) || nonzero(tier);
    const barY = hasHead ? 22 : 14;
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

    if (hasText(label)) {
      ctx.font = 'bold 11px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = kind === 'enemy' ? '#ffb0b0' : '#b8ffd4';
      ctx.fillText(label.slice(0, 14), 8, 14);
    }
    // Tier diamonds ◆◆◇ — visual rank, no "Lv." text
    if (tier > 0) {
      const t = Math.max(1, Math.min(3, Math.floor(tier)));
      ctx.font = 'bold 12px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'right';
      let diamonds = '';
      for (let i = 0; i < 3; i++) diamonds += i < t ? '◆' : '◇';
      ctx.fillStyle = kind === 'enemy' ? '#c9a227' : '#7dffb0';
      ctx.fillText(diamonds, 152, 14);
    }

    tex.needsUpdate = true;
  }
}
