import type { Inventory, Station } from '../core/types';
import { nonzero } from '../core/util';
import type * as ThreeNS from 'three';
import { makeBarkTexture, makeStoneTexture } from '../render/ProceduralTextures';

type ThreeLib = typeof ThreeNS;

let _barkMap: ThreeNS.Texture | null = null;
let _stoneMap: ThreeNS.Texture | null = null;
function barkMap() {
  if (!_barkMap) _barkMap = makeBarkTexture(128);
  return _barkMap;
}
function stoneMap() {
  if (!_stoneMap) _stoneMap = makeStoneTexture(128);
  return _stoneMap;
}

export const buildCosts: Record<Station['kind'], Partial<Inventory>> = {
  bed: { wood: 4 },
  storage: { wood: 6 },
  pen: { wood: 10 },
  lumber: { wood: 8, stone: 2 },
  workbench: { wood: 6, stone: 2 },
  smelter: { stone: 10, wood: 4, ore: 2 },
  tower: { wood: 15, stone: 15, essence: 3 },
};

export function canAfford(inv: Inventory, kind: Station['kind']): boolean {
  const cost = buildCosts[kind];
  for (const key of Object.keys(cost) as (keyof Inventory)[]) {
    const need = cost[key] ?? 0;
    if (inv[key] < need) return false;
  }
  return true;
}

/** Deducts build cost from inventory. Caller must check canAfford first. */
export function pay(inv: Inventory, kind: Station['kind']): void {
  const cost = buildCosts[kind];
  for (const key of Object.keys(cost) as (keyof Inventory)[]) {
    const need = cost[key] ?? 0;
    inv[key] = Math.max(0, inv[key] - need);
  }
}

function mat(
  THREE: ThreeLib,
  color: number,
  opts?: {
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    map?: 'bark' | 'stone' | null;
  },
) {
  return new THREE.MeshStandardMaterial({
    color,
    map: opts?.map === 'bark' ? barkMap() : opts?.map === 'stone' ? stoneMap() : null,
    roughness: opts?.roughness ?? 0.85,
    metalness: 0.05,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
  });
}

function box(
  THREE: ThreeLib,
  w: number,
  h: number,
  d: number,
  color: number,
  y: number,
  opts?: {
    emissive?: number;
    emissiveIntensity?: number;
    x?: number;
    z?: number;
    roughness?: number;
    ry?: number;
  },
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(THREE, color, opts));
  mesh.position.set(opts?.x ?? 0, y, opts?.z ?? 0);
  const ry = opts?.ry;
  if (nonzero(ry)) mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(
  THREE: ThreeLib,
  rTop: number,
  rBot: number,
  h: number,
  color: number,
  y: number,
  opts?: {
    emissive?: number;
    emissiveIntensity?: number;
    x?: number;
    z?: number;
    radial?: number;
    rx?: number;
    rz?: number;
    roughness?: number;
  },
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, opts?.radial ?? 8),
    mat(THREE, color, opts),
  );
  mesh.position.set(opts?.x ?? 0, y, opts?.z ?? 0);
  const rx = opts?.rx;
  const rz = opts?.rz;
  if (nonzero(rx)) mesh.rotation.x = rx;
  if (nonzero(rz)) mesh.rotation.z = rz;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildBed(THREE: ThreeLib, g: ThreeNS.Group) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.08, 0.7),
    mat(THREE, 0x6b4f2a, { map: 'bark', roughness: 0.9 }),
  );
  frame.position.y = 0.04;
  frame.castShadow = true;
  g.add(frame);
  g.add(box(THREE, 1.35, 0.06, 0.65, 0x8b6b4a, 0.1));
  g.add(box(THREE, 0.35, 0.12, 0.55, 0xc4a574, 0.16, { x: -0.45 }));
  g.add(box(THREE, 0.9, 0.05, 0.55, 0x4a6741, 0.14, { x: 0.2 }));
  // Cozy lantern
  const lamp = new THREE.PointLight(0xffc080, 0.55, 5, 2);
  lamp.position.set(0.5, 0.6, 0);
  g.add(lamp);
}

function buildStorage(THREE: ThreeLib, g: ThreeNS.Group) {
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.75, 0.9),
    mat(THREE, 0x8b6914, { map: 'bark', roughness: 0.88 }),
  );
  crate.position.y = 0.375;
  crate.castShadow = true;
  g.add(crate);
  g.add(box(THREE, 0.95, 0.08, 0.95, 0x6b4f1a, 0.78));
  g.add(box(THREE, 0.96, 0.06, 0.12, 0x3d2e12, 0.4, { z: 0.42 }));
  g.add(box(THREE, 0.96, 0.06, 0.12, 0x3d2e12, 0.4, { z: -0.42 }));
  g.add(box(THREE, 0.18, 0.1, 0.08, 0x888888, 0.55, { z: 0.48 }));
}

function buildPen(THREE: ThreeLib, g: ThreeNS.Group) {
  const posts = 8;
  const radius = 1.4;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    g.add(cyl(THREE, 0.06, 0.07, 0.9, 0x6b5344, 0.45, { x, z, radial: 6 }));

    const a2 = ((i + 1) / posts) * Math.PI * 2;
    const x2 = Math.cos(a2) * radius;
    const z2 = Math.sin(a2) * radius;
    const mx = (x + x2) / 2;
    const mz = (z + z2) / 2;
    const dx = x2 - x;
    const dz = z2 - z;
    const len = Math.hypot(dx, dz);
    const ry = Math.atan2(dx, dz);
    g.add(box(THREE, 0.08, 0.08, len * 0.92, 0x8b7355, 0.55, { x: mx, z: mz, ry }));
    g.add(box(THREE, 0.08, 0.08, len * 0.92, 0x8b7355, 0.3, { x: mx, z: mz, ry }));
  }
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 16),
    mat(THREE, 0x5a7a3a, { roughness: 1 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  pad.receiveShadow = true;
  g.add(pad);
}

function buildLumber(THREE: ThreeLib, g: ThreeNS.Group) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.55, 10),
    mat(THREE, 0x8b6914, { map: 'bark', roughness: 0.92 }),
  );
  post.position.y = 0.275;
  post.castShadow = true;
  g.add(post);
  g.add(cyl(THREE, 0.32, 0.32, 0.06, 0x8b6914, 0.58, { radial: 10 }));
  g.add(box(THREE, 0.08, 0.35, 0.08, 0x4a3728, 0.75, { x: 0.25, z: 0.15 }));
  g.add(box(THREE, 0.22, 0.12, 0.04, 0x888888, 0.95, { x: 0.25, z: 0.15 }));
  for (const [y, z] of [
    [0.12, 0.1],
    [0.28, -0.05],
    [0.42, 0.05],
  ] as const) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.12, 0.9, 8),
      mat(THREE, 0x7a5c3a, { map: 'bark', roughness: 0.95 }),
    );
    log.rotation.z = Math.PI / 2;
    log.position.set(-0.9, y, z);
    log.castShadow = true;
    g.add(log);
  }
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.35, 0.5),
    mat(THREE, 0x6b4f2a, { map: 'bark', roughness: 0.9 }),
  );
  stack.position.set(0.7, 0.2, -0.5);
  stack.name = 'woodStack';
  stack.castShadow = true;
  g.add(stack);
}

function buildWorkbench(THREE: ThreeLib, g: ThreeNS.Group) {
  g.add(box(THREE, 1.4, 0.1, 0.8, 0x8b6914, 0.85));
  g.add(box(THREE, 0.1, 0.8, 0.1, 0x5c4033, 0.4, { x: -0.6, z: -0.3 }));
  g.add(box(THREE, 0.1, 0.8, 0.1, 0x5c4033, 0.4, { x: 0.6, z: -0.3 }));
  g.add(box(THREE, 0.1, 0.8, 0.1, 0x5c4033, 0.4, { x: -0.6, z: 0.3 }));
  g.add(box(THREE, 0.1, 0.8, 0.1, 0x5c4033, 0.4, { x: 0.6, z: 0.3 }));
  g.add(box(THREE, 0.35, 0.06, 0.12, 0xaaaaaa, 0.95, { x: -0.3 }));
  g.add(box(THREE, 0.15, 0.15, 0.15, 0x4a3728, 0.98, { x: 0.35 }));
}

function buildSmelter(THREE: ThreeLib, g: ThreeNS.Group) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 1.1, 10),
    mat(THREE, 0x7a7a82, { map: 'stone', roughness: 0.75 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  g.add(cyl(THREE, 0.35, 0.4, 0.35, 0x555555, 1.25, { radial: 8 }));
  g.add(
    cyl(THREE, 0.28, 0.32, 0.4, 0xff6a00, 0.45, {
      emissive: 0xff4400,
      emissiveIntensity: 1.4,
      radial: 8,
      z: 0.35,
    }),
  );
  g.add(
    box(THREE, 0.45, 0.35, 0.15, 0xff5500, 0.4, {
      z: 0.55,
      emissive: 0xff3300,
      emissiveIntensity: 1.2,
    }),
  );
  g.add(box(THREE, 0.7, 0.12, 0.7, 0x4a4a4a, 0.06));
  const fire = new THREE.PointLight(0xff6622, 1.6, 10, 2);
  fire.position.set(0, 0.9, 0.4);
  fire.name = 'smelterLight';
  g.add(fire);
}

function buildTower(THREE: ThreeLib, g: ThreeNS.Group) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 0.4, 8),
    mat(THREE, 0x7a7a82, { map: 'stone', roughness: 0.8 }),
  );
  base.position.y = 0.2;
  base.castShadow = true;
  g.add(base);
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 3.2, 0.55),
    mat(THREE, 0x8a8a92, { map: 'stone', roughness: 0.78 }),
  );
  shaft.position.y = 1.9;
  shaft.castShadow = true;
  g.add(shaft);
  g.add(box(THREE, 0.9, 0.15, 0.9, 0x8b6914, 3.55));
  for (const [x, z] of [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0.35],
    [0.35, 0.35],
  ] as const) {
    g.add(box(THREE, 0.15, 0.45, 0.15, 0x6b6b6b, 3.85, { x, z }));
  }
  g.add(
    cyl(THREE, 0.08, 0.1, 0.35, 0xffaa44, 4.2, {
      emissive: 0xff8800,
      emissiveIntensity: 1.5,
      radial: 6,
    }),
  );
  const beacon = new THREE.PointLight(0xffaa44, 1.4, 18, 2);
  beacon.position.set(0, 4.3, 0);
  g.add(beacon);
}

/** Procedural station mesh for the base builder. Pass the three module as THREE. */
export function createStationMesh(kind: Station['kind'], THREE: ThreeLib): ThreeNS.Group {
  const group = new THREE.Group();
  group.name = `station_${kind}`;
  group.userData.kind = kind;

  switch (kind) {
    case 'bed':
      buildBed(THREE, group);
      break;
    case 'storage':
      buildStorage(THREE, group);
      break;
    case 'pen':
      buildPen(THREE, group);
      break;
    case 'lumber':
      buildLumber(THREE, group);
      break;
    case 'workbench':
      buildWorkbench(THREE, group);
      break;
    case 'smelter':
      buildSmelter(THREE, group);
      break;
    case 'tower':
      buildTower(THREE, group);
      break;
  }

  return group;
}
