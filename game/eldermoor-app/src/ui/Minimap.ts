/** Canvas minimap — top-down blips for player, base, POIs, beasts */

import { requireCanvas2d } from '../core/util';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly size = 148;

  constructor() {
    let el = document.getElementById('minimap') as HTMLCanvasElement | null;
    if (!el) {
      el = document.createElement('canvas');
      el.id = 'minimap';
      el.width = this.size;
      el.height = this.size;
      Object.assign(el.style, {
        position: 'absolute',
        top: '70px',
        left: '12px',
        width: `${this.size}px`,
        height: `${this.size}px`,
        borderRadius: '12px',
        border: '1px solid #c9a227',
        background: 'rgba(11,10,18,0.85)',
        pointerEvents: 'none',
        zIndex: '5',
        display: 'none',
      } as CSSStyleDeclaration);
      document.getElementById('ui')?.appendChild(el);
    }
    this.canvas = el;
    this.ctx = requireCanvas2d(el);
  }

  show(v: boolean) {
    this.canvas.style.display = v ? 'block' : 'none';
  }

  draw(opts: {
    player: { x: number; z: number; yaw: number };
    stations: { x: number; z: number; kind: string }[];
    wild: { x: number; z: number; elite?: boolean }[];
    pois: { x: number; z: number; color: string }[];
    worldRadius: number;
  }) {
    const ctx = this.ctx;
    const s = this.size;
    const scale = (s * 0.42) / opts.worldRadius;
    const cx = s / 2;
    const cy = s / 2;

    ctx.clearRect(0, 0, s, s);
    // bg
    ctx.fillStyle = '#0b0a12';
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e2848';
    ctx.lineWidth = 2;
    ctx.stroke();

    const px = opts.player.x;
    const pz = opts.player.z;

    const toMap = (x: number, z: number) => ({
      x: cx + (x - px) * scale,
      y: cy + (z - pz) * scale,
    });

    // POIs
    for (const p of opts.pois) {
      const m = toMap(p.x, p.z);
      if (m.x < 4 || m.x > s - 4 || m.y < 4 || m.y > s - 4) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stations
    for (const st of opts.stations) {
      const m = toMap(st.x, st.z);
      if (m.x < 4 || m.x > s - 4 || m.y < 4 || m.y > s - 4) continue;
      ctx.fillStyle = st.kind === 'tower' ? '#c9a227' : '#6bcb8a';
      ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
    }

    // Wild
    for (const w of opts.wild) {
      const m = toMap(w.x, w.z);
      if (m.x < 4 || m.x > s - 4 || m.y < 4 || m.y > s - 4) continue;
      ctx.fillStyle = w.elite === true ? '#ff6a00' : '#e85d5d';
      ctx.beginPath();
      ctx.arc(m.x, m.y, w.elite === true ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player triangle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-opts.player.yaw);
    ctx.fillStyle = '#e8d48b';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label
    ctx.fillStyle = '#a39bb8';
    ctx.font = '9px Segoe UI, sans-serif';
    ctx.fillText('MAP', 8, s - 8);
  }
}
