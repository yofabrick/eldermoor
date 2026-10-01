import * as THREE from 'three';
import type { Inventory, ResourceNode } from '../core/types';
import { INVENTORY_CAPS } from '../core/types';
import { RESOURCE_INFO } from './ResourceLabels';
import { at } from '../core/util';

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PICKUP_RADIUS = 1.85;
const AMOUNTS = { wood: 2, stone: 2, herb: 2, ore: 1 } as const;

export function canCarry(inv: Inventory, kind: ResourceNode['kind'], amount: number): boolean {
  const cap = INVENTORY_CAPS[kind];
  return inv[kind] + amount <= cap;
}

export function isStackFull(inv: Inventory, kind: ResourceNode['kind']): boolean {
  return inv[kind] >= INVENTORY_CAPS[kind];
}

/** Distinct, readable resource piles with ground rings */
export function spawnResources(scene: THREE.Scene, count = 55): ResourceNode[] {
  const rng = mulberry32(99);
  const nodes: ResourceNode[] = [];
  const kinds: ResourceNode['kind'][] = ['wood', 'stone', 'herb', 'ore'];
  const colors = { wood: 0x8b5a2b, stone: 0x8a909c, herb: 0x3dcc6e, ore: 0x6a8ab8 };

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
    const ringCol =
      kind === 'wood'
        ? 0xc4a574
        : kind === 'stone'
          ? 0x8899aa
          : kind === 'herb'
            ? 0x3dcc6e
            : 0x6a8ab8;
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
      remaining: 1, // one walk-over pickup per pile
      max: 1,
      respawn: 0,
    } satisfies ResourceNode;
  };

  let idx = 0;
  for (const s of nearSpawn) {
    nodes.push(makeNode(s.kind, s.x, s.z, String(idx++)));
  }

  for (let i = 0; i < count; i++) {
    const kind = at(kinds, i % kinds.length) ?? 'wood';
    const ang = rng() * Math.PI * 2;
    const rad = 10 + rng() * 68;
    nodes.push(makeNode(kind, Math.cos(ang) * rad, Math.sin(ang) * rad, String(idx++)));
  }
  return nodes;
}

export type GatherResult = {
  node: ResourceNode | null;
  gained: string | null;
  full?: boolean;
  kind?: ResourceNode['kind'];
};

/**
 * Walk-over pickup: stepping on a pile collects it instantly,
 * unless that resource stack is at cap. No key press required.
 */
export function tryGather(
  nodes: ResourceNode[],
  playerPos: THREE.Vector3,
  inv: Inventory,
  _dt: number,
): GatherResult {
  // Respawn depleted piles
  for (const n of nodes) {
    if (n.remaining <= 0) {
      n.respawn -= _dt;
      if (n.respawn <= 0) {
        n.remaining = n.max;
        n.mesh.visible = true;
      }
    }
  }

  // All piles within radius (can pick several if overlapping)
  let nearest: ResourceNode | null = null;
  let best = PICKUP_RADIUS;
  let anyFullNear: ResourceNode | null = null;

  for (const n of nodes) {
    if (n.remaining <= 0) continue;
    const d = playerPos.distanceTo(n.position);
    if (d >= PICKUP_RADIUS) continue;

    if (d < best) {
      best = d;
      nearest = n;
    }

    const amt = AMOUNTS[n.kind];
    if (!canCarry(inv, n.kind, amt)) {
      anyFullNear = n;
      continue;
    }

    // Instant pickup
    n.remaining = 0;
    n.respawn = 18;
    n.mesh.visible = false;
    inv[n.kind] += amt;
    return {
      node: n,
      gained: `${RESOURCE_INFO[n.kind].de} +${amt}`,
      kind: n.kind,
    };
  }

  if (anyFullNear && !nearest) {
    // Only full piles nearby
    return {
      node: anyFullNear,
      gained: null,
      full: true,
      kind: anyFullNear.kind,
    };
  }

  // Standing on a full stack of the nearest kind
  if (nearest && !canCarry(inv, nearest.kind, AMOUNTS[nearest.kind])) {
    return { node: nearest, gained: null, full: true, kind: nearest.kind };
  }

  return { node: nearest, gained: null };
}

export function gatherPrompt(
  node: ResourceNode | null,
  _gathering: boolean,
  _progress = 0,
  full = false,
  kind?: ResourceNode['kind'],
): string {
  if (full && kind) {
    const info = RESOURCE_INFO[kind];
    const cap = INVENTORY_CAPS[kind];
    return `Inventar voll: ${info.de} (max ${cap}) — verbrauchen/bauen zuerst`;
  }
  if (!node) return '';
  const info = RESOURCE_INFO[node.kind];
  return `Darüberlaufen: ${info.de} aufsammeln · ${info.use}`;
}
