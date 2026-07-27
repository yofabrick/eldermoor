import * as THREE from 'three';
import type { Inventory, ResourceNode } from '../core/types';
import { RESOURCE_INFO } from './ResourceLabels';

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distinct, readable resource piles with ground rings */
export function spawnResources(scene: THREE.Scene, count = 55): ResourceNode[] {
  const rng = mulberry32(99);
  const nodes: ResourceNode[] = [];
  const kinds: ResourceNode['kind'][] = ['wood', 'stone', 'herb', 'ore'];
  const colors = { wood: 0x8b5a2b, stone: 0x8a909c, herb: 0x3dcc6e, ore: 0x6a8ab8 };

  // Cluster some resources near spawn (origin-ish) so the first goal is obvious
  const nearSpawn: { kind: ResourceNode['kind']; x: number; z: number }[] = [
    { kind: 'wood', x: 3, z: -2 },
    { kind: 'wood', x: 5, z: 1 },
    { kind: 'wood', x: 2, z: 3 },
    { kind: 'stone', x: -3, z: 2 },
    { kind: 'herb', x: -2, z: -4 },
    { kind: 'ore', x: 6, z: 4 },
  ];

  const makeNode = (kind: ResourceNode['kind'], x: number, z: number, id: string) => {
    const group = new THREE.Group();
    // Ground ring — color coded
    const ringCol =
      kind === 'wood' ? 0xc4a574 : kind === 'stone' ? 0x8899aa : kind === 'herb' ? 0x3dcc6e : 0x6a8ab8;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 20),
      new THREE.MeshBasicMaterial({
        color: ringCol,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);

    let body: THREE.Object3D;
    if (kind === 'wood') {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, 1.1, 6),
          new THREE.MeshStandardMaterial({ color: colors.wood, roughness: 0.9 }),
        );
        log.rotation.z = Math.PI / 2;
        log.rotation.y = i * 0.5;
        log.position.set(0, 0.2 + i * 0.15, (i - 1) * 0.15);
        log.castShadow = true;
        g.add(log);
      }
      body = g;
    } else if (kind === 'herb') {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.7, 5),
          new THREE.MeshStandardMaterial({
            color: colors.herb,
            emissive: colors.herb,
            emissiveIntensity: 0.35,
          }),
        );
        leaf.position.set((i - 1) * 0.22, 0.35, (i % 2) * 0.1);
        g.add(leaf);
      }
      body = g;
    } else if (kind === 'ore') {
      body = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({
          color: colors.ore,
          metalness: 0.65,
          roughness: 0.25,
          emissive: 0x223355,
          emissiveIntensity: 0.25,
        }),
      );
      body.position.y = 0.45;
      (body as THREE.Mesh).castShadow = true;
    } else {
      body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ color: colors.stone, roughness: 0.95 }),
      );
      body.position.y = 0.35;
      (body as THREE.Mesh).castShadow = true;
    }
    group.add(body);
    group.position.set(x, 0, z);
    group.name = `res_${kind}_${id}`;
    scene.add(group);

    return {
      id: `res_${id}`,
      kind,
      position: group.position.clone(),
      mesh: group,
      remaining: 4 + Math.floor(rng() * 2),
      max: 5,
      respawn: 0,
    } satisfies ResourceNode;
  };

  let idx = 0;
  for (const s of nearSpawn) {
    nodes.push(makeNode(s.kind, s.x, s.z, String(idx++)));
  }

  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const ang = rng() * Math.PI * 2;
    const rad = 10 + rng() * 68;
    nodes.push(makeNode(kind, Math.cos(ang) * rad, Math.sin(ang) * rad, String(idx++)));
  }
  return nodes;
}

export function tryGather(
  nodes: ResourceNode[],
  playerPos: THREE.Vector3,
  inv: Inventory,
  dt: number,
  gathering: boolean,
): { node: ResourceNode | null; gained: string | null; progress?: number } {
  let nearest: ResourceNode | null = null;
  let best = 2.6;
  for (const n of nodes) {
    if (n.remaining <= 0) {
      n.respawn -= dt;
      if (n.respawn <= 0) {
        n.remaining = n.max;
        n.mesh.visible = true;
      }
      continue;
    }
    const d = playerPos.distanceTo(n.position);
    if (d < best) {
      best = d;
      nearest = n;
    }
  }
  if (!nearest) return { node: null, gained: null };
  if (!gathering) {
    return {
      node: nearest,
      gained: null,
      progress: 1 - nearest.remaining / nearest.max,
    };
  }
  // ~1.2s hold to clear a full node
  nearest.remaining -= 4.2 * dt;
  if (nearest.remaining <= 0) {
    nearest.remaining = 0;
    nearest.respawn = 22;
    nearest.mesh.visible = false;
    const amounts = { wood: 2, stone: 2, herb: 2, ore: 1 } as const;
    const amt = amounts[nearest.kind];
    inv[nearest.kind] += amt;
    return {
      node: nearest,
      gained: `${RESOURCE_INFO[nearest.kind].de} +${amt}`,
      progress: 1,
    };
  }
  return {
    node: nearest,
    gained: null,
    progress: 1 - nearest.remaining / nearest.max,
  };
}

export function gatherPrompt(node: ResourceNode | null, gathering: boolean, progress = 0): string {
  if (!node) return '';
  const info = RESOURCE_INFO[node.kind];
  if (gathering) {
    const pct = Math.floor(progress * 100);
    return `Sammle ${info.de}… ${pct}%  —  braucht: ${info.use}`;
  }
  return `[E halten] ${info.de}  ·  ${info.look}  ·  für: ${info.use}`;
}
