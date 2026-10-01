import * as THREE from 'three';
import type { OwnedBeast, Station } from '../core/types';
import { speciesDef } from '../data/species';
import { createBeastMesh } from '../beasts/BeastFactory';
import { at } from '../core/util';

/**
 * Visible workers at lumber/smelter — Demo Law #2: beast produces while player walks away.
 */
export class StationWorkers {
  private scene: THREE.Scene;
  private byUid = new Map<string, THREE.Group>();
  private time = 0;
  private chips: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  /** Optional chop SFX callback (wired from Game.audio.playChop) */
  onChop: (() => void) | null = null;
  private chopCd = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  clear() {
    for (const m of this.byUid.values()) this.scene.remove(m);
    this.byUid.clear();
    for (const c of this.chips) this.scene.remove(c.mesh);
    this.chips = [];
  }

  /** Keep meshes in sync with station assignments. */
  sync(owned: OwnedBeast[], stations: Station[]) {
    const want = new Set<string>();

    for (const st of stations) {
      if (!st.assignedBeastUid) continue;
      if (st.kind !== 'lumber' && st.kind !== 'smelter') continue;
      const beast = owned.find((o) => o.uid === st.assignedBeastUid);
      if (!beast || beast.mood < 10) continue;
      want.add(beast.uid);

      let mesh = this.byUid.get(beast.uid);
      if (!mesh) {
        mesh = createBeastMesh(beast.speciesId, THREE);
        // Ally work ring (green = working)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.75, 18),
          new THREE.MeshBasicMaterial({
            color: 0x5dffb0,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        ring.name = 'workRing';
        mesh.add(ring);
        mesh.add(makeWorkLabel(beast.name));
        this.scene.add(mesh);
        this.byUid.set(beast.uid, mesh);
      }

      const def = speciesDef(beast.speciesId);
      const y = def.scale * 0.5;
      // Stand beside station, not inside mesh
      const side = st.kind === 'lumber' ? 1.4 : -1.4;
      mesh.position.set(st.position.x + side, y, st.position.z + 0.6);
      mesh.userData.workKind = st.kind;
      mesh.userData.baseY = y;
      mesh.lookAt(st.position.x, y, st.position.z);
    }

    for (const [uid, mesh] of this.byUid) {
      if (!want.has(uid)) {
        this.scene.remove(mesh);
        this.byUid.delete(uid);
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    this.chopCd = Math.max(0, this.chopCd - dt);
    for (const mesh of this.byUid.values()) {
      const baseY = (mesh.userData.baseY as number | undefined) ?? 0.4;
      // Ease-in wind-up, hard strike (not plain sin bob)
      const phase = this.time * 4.2;
      const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const windUp = cycle < Math.PI * 1.2;
      const t = windUp ? cycle / (Math.PI * 1.2) : (cycle - Math.PI * 1.2) / (Math.PI * 0.8);
      const chop = windUp ? t * t * 0.35 : 1 - Math.pow(1 - t, 3); // ease out strike
      const strike = !windUp && t > 0.15 && t < 0.45;
      mesh.position.y = baseY + (windUp ? t * 0.06 : chop * 0.14);
      mesh.rotation.z = windUp ? -0.25 * t : 0.35 * (1 - t);
      // Squash on impact
      const squash = strike ? 0.92 : 1;
      mesh.scale.set(1 / squash, squash, 1 / squash);

      let tool = mesh.getObjectByName('workTool') as THREE.Mesh | undefined;
      if (!tool) {
        tool = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.05, 0.62, 6),
          new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }),
        );
        tool.name = 'workTool';
        tool.position.set(0.48, 0.4, 0.15);
        mesh.add(tool);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.16, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xa0a8b4, metalness: 0.55, roughness: 0.35 }),
        );
        head.position.set(0, 0.32, 0);
        tool.add(head);
      }
      tool.rotation.z = windUp ? -1.1 + t * 0.4 : 0.9 - t * 1.6;
      if (strike && this.chopCd <= 0) {
        this.spawnChip(mesh.position);
        this.spawnChip(mesh.position.clone().add(new THREE.Vector3(0.1, 0, 0.1)));
        this.onChop?.();
        this.chopCd = 0.42;
      }
      const ring = mesh.getObjectByName('workRing');
      if (ring instanceof THREE.Mesh && ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = strike ? 0.95 : 0.5 + chop * 0.25;
        ring.scale.setScalar(strike ? 1.25 : 0.95 + chop * 0.1);
      }
    }
    // Age chips
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = at(this.chips, i);
      if (c === undefined) continue;
      c.life -= dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.vel.y -= 6 * dt;
      c.mesh.rotation.x += dt * 4;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.chips.splice(i, 1);
      }
    }
  }

  private spawnChip(at: THREE.Vector3) {
    if (this.chips.length > 24) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xa07840, roughness: 0.9 }),
    );
    mesh.position.copy(at);
    mesh.position.y += 0.5;
    this.scene.add(mesh);
    this.chips.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        2 + Math.random() * 1.5,
        (Math.random() - 0.5) * 2.2,
      ),
      life: 0.55,
    });
  }
}

function makeWorkLabel(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(10,14,12,0.85)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 48, 10);
  ctx.fill();
  ctx.strokeStyle = '#5dffb0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#5dffb0';
  ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARBEITET', 128, 28);
  ctx.fillStyle = '#c8e8d4';
  ctx.font = '14px Segoe UI, Arial, sans-serif';
  ctx.fillText(name.slice(0, 18), 128, 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
  );
  spr.position.y = 1.5;
  spr.scale.set(1.4, 0.35, 1);
  spr.renderOrder = 11;
  return spr;
}
