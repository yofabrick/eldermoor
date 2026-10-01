import * as THREE from 'three';
import type { ResourceNode } from '../core/types';

/** German + clear names for what each resource is and why you need it */
export const RESOURCE_INFO: Record<
  ResourceNode['kind'],
  { de: string; look: string; use: string; color: string }
> = {
  wood: {
    de: 'Holz',
    look: 'brauner Baumstamm am Boden',
    use: 'Bauen (Bett, Sägeplatz, Turm…)',
    color: '#c4a574',
  },
  stone: {
    de: 'Stein',
    look: 'grauer Felsbrocken',
    use: 'Bauen (Sägeplatz, Schmelze, Turm)',
    color: '#b0b8c8',
  },
  herb: {
    de: 'Kraut',
    look: 'grüner leuchtender Kegel',
    use: 'Futter (G) + Gift-Schutz in der Mire',
    color: '#6bcb8a',
  },
  ore: {
    de: 'Erz',
    look: 'metallischer Kristall',
    use: 'In Schmelze → Barren → Zauberstab upgraden (U)',
    color: '#8aa0c8',
  },
};

/** Floating name tags above resource nodes so you know what to pick up */
export class ResourceLabels {
  private labels = new Map<string, THREE.Sprite>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  clear() {
    for (const s of this.labels.values()) this.scene.remove(s);
    this.labels.clear();
  }

  update(nodes: ResourceNode[], playerPos: THREE.Vector3) {
    const seen = new Set<string>();
    for (const n of nodes) {
      if (n.remaining <= 0 || !n.mesh.visible) continue;
      const d = playerPos.distanceTo(n.position);
      // Show labels nearby; always if very close
      if (d > 14) continue;
      seen.add(n.id);
      let spr = this.labels.get(n.id);
      if (!spr) {
        spr = this.makeLabel(n.kind);
        this.labels.set(n.id, spr);
        this.scene.add(spr);
      }
      spr.position.copy(n.position);
      spr.position.y = 1.15;
      // pulse when interactable
      const near = d < 2.5;
      spr.scale.set(near ? 1.5 : 1.15, near ? 0.45 : 0.35, 1);
      if (spr.material instanceof THREE.SpriteMaterial) {
        spr.material.opacity = near ? 1 : 0.75;
      }
    }
    for (const [id, spr] of this.labels) {
      if (!seen.has(id)) {
        this.scene.remove(spr);
        this.labels.delete(id);
      }
    }
  }

  private makeLabel(kind: ResourceNode['kind']) {
    const info = RESOURCE_INFO[kind];
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    // pill background
    ctx.fillStyle = 'rgba(11,10,18,0.88)';
    roundRect(ctx, 8, 8, 240, 48, 10);
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 3;
    roundRect(ctx, 8, 8, 240, 48, 10);
    ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.de.toUpperCase(), 128, 30);
    ctx.fillStyle = '#a39bb8';
    ctx.font = '14px Segoe UI, Arial, sans-serif';
    ctx.fillText('Drüberlaufen', 128, 48);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.renderOrder = 9;
    return spr;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
