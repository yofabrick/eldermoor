import * as THREE from 'three';
import {
  makeBarkTexture,
  makeGrassTexture,
  makeLeafTexture,
  makeStoneTexture,
} from '../render/ProceduralTextures';
import { createBush, createRock, createTree } from './TreeFactory';

/** Seeded mulberry32 PRNG for deterministic world layout. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function isInBounds(x: number, z: number, bounds: number): boolean {
  return x * x + z * z <= bounds * bounds;
}

export interface WorldBuildResult {
  ground: THREE.Mesh;
  trees: THREE.Object3D[];
  ruins: THREE.Object3D[];
  shrinePos: THREE.Vector3;
  amphitheaterPos: THREE.Vector3;
  spawnPos: THREE.Vector3;
  bounds: number;
}

export class WorldBuilder {
  build(scene: THREE.Scene): WorldBuildResult {
    const bounds = 85;
    const rng = mulberry32(42);

    scene.background = new THREE.Color(0x0b0a12);
    scene.fog = new THREE.Fog(0x0b0a12, 40, 120);

    // Soft sky + fill
    const hemi = new THREE.HemisphereLight(0xc9d6e8, 0x2a3a28, 0.55);
    hemi.name = 'hemi';
    scene.add(hemi);

    // Moonlight / sun
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.85);
    sun.name = 'sun';
    sun.position.set(40, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -0.0002;
    scene.add(sun);

    // Dim ambient fill so night is never pure black without DayNight
    const amb = new THREE.AmbientLight(0x1a1830, 0.25);
    amb.name = 'ambient';
    scene.add(amb);

    // --- Ground: large grass plane with vertex-color variation ---
    const groundSize = 180;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x3d5c3a);
    const gold = new THREE.Color(0x6a7a3a);
    const dark = new THREE.Color(0x2f4a2e);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Gentle height noise for soft rolling glade
      const h =
        Math.sin(x * 0.04) * Math.cos(z * 0.035) * 0.35 +
        Math.sin(x * 0.12 + z * 0.08) * 0.12;
      pos.setY(i, h);
      const t = (Math.sin(x * 0.08) * Math.cos(z * 0.07) + 1) * 0.5;
      tmp.copy(base).lerp(gold, t * 0.55).lerp(dark, (1 - t) * 0.25);
      // Slight radial darkening toward bounds edge
      const dist = Math.hypot(x, z) / (groundSize * 0.5);
      if (dist > 0.7) tmp.lerp(new THREE.Color(0x1a2218), (dist - 0.7) * 0.8);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    // Procedural grass albedo (no image files)
    const grassMap = makeGrassTexture(256);
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: grassMap,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: false,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.name = 'ground';
    ground.receiveShadow = true;
    scene.add(ground);

    // Secondary soft gold patch under landmarks
    const patchGeo = new THREE.CircleGeometry(14, 24);
    patchGeo.rotateX(-Math.PI / 2);
    const patch = new THREE.Mesh(
      patchGeo,
      new THREE.MeshStandardMaterial({
        color: 0x5a6b32,
        roughness: 0.95,
        transparent: true,
        opacity: 0.55,
      }),
    );
    patch.position.set(6, 0.06, -4);
    scene.add(patch);

    // Shared procedural maps for flora / stone props
    const barkMap = makeBarkTexture(128);
    const leafMap = makeLeafTexture(128);
    const stoneMap = makeStoneTexture(128);

    // --- Trees (40–60 low-poly, textured) ---
    const trees: THREE.Object3D[] = [];
    const treeTarget = 50;

    let attempts = 0;
    while (trees.length < treeTarget && attempts < 400) {
      attempts++;
      const angle = rng() * Math.PI * 2;
      const radius = 12 + rng() * 70;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Keep clearing near origin / Discarding Stones
      if (Math.hypot(x, z) < 10) continue;
      if (Math.hypot(x - 6, z + 4) < 8) continue;

      const tree = createTree(THREE, rng, barkMap, leafMap);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng() * Math.PI * 2;
      const s = 0.75 + rng() * 0.7;
      tree.scale.setScalar(s);
      scene.add(tree);
      trees.push(tree);
    }

    // --- Scattered rocks (~25) ---
    const rockTarget = 25;
    let rocksPlaced = 0;
    let rockAttempts = 0;
    while (rocksPlaced < rockTarget && rockAttempts < 300) {
      rockAttempts++;
      const angle = rng() * Math.PI * 2;
      const radius = 8 + rng() * 72;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x, z) < 8) continue;
      if (Math.hypot(x - 6, z + 4) < 6) continue;
      const rock = createRock(THREE, rng, stoneMap);
      rock.position.set(x, 0, z);
      rock.rotation.y = rng() * Math.PI * 2;
      rock.scale.setScalar(0.85 + rng() * 0.5);
      scene.add(rock);
      rocksPlaced++;
    }

    // --- Scattered bushes (~30) ---
    const bushTarget = 30;
    let bushesPlaced = 0;
    let bushAttempts = 0;
    while (bushesPlaced < bushTarget && bushAttempts < 350) {
      bushAttempts++;
      const angle = rng() * Math.PI * 2;
      const radius = 9 + rng() * 68;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x, z) < 9) continue;
      if (Math.hypot(x - 6, z + 4) < 7) continue;
      const bush = createBush(THREE, rng, leafMap);
      bush.position.set(x, 0, z);
      bush.rotation.y = rng() * Math.PI * 2;
      bush.scale.setScalar(0.8 + rng() * 0.7);
      scene.add(bush);
      bushesPlaced++;
    }

    // --- Discarding Stones: 3 tall standing stones in a circle ---
    const stonesCenter = new THREE.Vector3(6, 0, -4);
    const stoneGroup = new THREE.Group();
    stoneGroup.name = 'discardingStones';
    const stoneBodyMat = new THREE.MeshStandardMaterial({
      color: 0x5c5a62,
      roughness: 0.75,
      metalness: 0.08,
      flatShading: true,
    });
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      emissive: 0xffc040,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.35,
    });

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 6;
      const r = 3.2;
      const height = 3.2 + i * 0.35;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, height, 0.45),
        stoneBodyMat,
      );
      body.position.set(Math.cos(a) * r, height * 0.5, Math.sin(a) * r);
      body.lookAt(0, height * 0.5, 0);
      body.rotateY(Math.PI / 2);

      // Gold emissive rim strip along the inner face
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, height * 0.85, 0.08), goldRimMat);
      rim.position.copy(body.position);
      rim.position.y = height * 0.5;
      // Nudge rim slightly toward center
      rim.position.x *= 0.88;
      rim.position.z *= 0.88;
      rim.quaternion.copy(body.quaternion);

      stoneGroup.add(body, rim);
    }
    // Small pedestal disk
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.9, flatShading: true }),
    );
    ped.position.y = 0.12;
    stoneGroup.add(ped);
    stoneGroup.position.copy(stonesCenter);
    scene.add(stoneGroup);

    // --- Ruined wall pieces (academy debris) ---
    const ruins: THREE.Object3D[] = [];
    const ruinMat = new THREE.MeshStandardMaterial({
      color: 0x7a6e62,
      roughness: 0.9,
      flatShading: true,
    });
    const ruinLayouts: { x: number; z: number; rot: number; w: number; h: number }[] = [
      { x: -14, z: 6, rot: 0.4, w: 4.5, h: 1.8 },
      { x: -16, z: 9, rot: 1.1, w: 2.8, h: 1.2 },
      { x: 18, z: 10, rot: -0.6, w: 3.5, h: 1.5 },
      { x: 20, z: 7, rot: 0.2, w: 2.2, h: 0.9 },
      { x: -5, z: 22, rot: 1.4, w: 5.0, h: 1.4 },
      { x: 12, z: -22, rot: -0.3, w: 3.0, h: 1.6 },
    ];
    for (const layout of ruinLayouts) {
      const wall = new THREE.Group();
      const main = new THREE.Mesh(
        new THREE.BoxGeometry(layout.w, layout.h, 0.45),
        ruinMat,
      );
      main.position.y = layout.h * 0.5;
      wall.add(main);
      // Broken top notch
      const chip = new THREE.Mesh(new THREE.BoxGeometry(layout.w * 0.35, layout.h * 0.35, 0.5), ruinMat);
      chip.position.set(layout.w * 0.2, layout.h * 0.85, 0);
      wall.add(chip);
      // Fallen rubble block
      const rubble = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.55), ruinMat);
      rubble.position.set(layout.w * 0.4, 0.2, 0.8);
      rubble.rotation.y = 0.5;
      wall.add(rubble);

      wall.position.set(layout.x, 0, layout.z);
      wall.rotation.y = layout.rot;
      wall.name = 'ruin';
      scene.add(wall);
      ruins.push(wall);
    }

    // --- Shrine marker (small living platform, green emissive) ---
    const shrinePos = new THREE.Vector3(-22, 0, -18);
    const shrine = new THREE.Group();
    shrine.name = 'shrine';
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.8, 0.35, 8),
      new THREE.MeshStandardMaterial({
        color: 0x3a5a3a,
        emissive: 0x1a4a28,
        emissiveIntensity: 0.45,
        roughness: 0.7,
        flatShading: true,
      }),
    );
    platform.position.y = 0.18;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6),
      new THREE.MeshStandardMaterial({
        color: 0x4a6a48,
        emissive: 0x2a8038,
        emissiveIntensity: 0.65,
        roughness: 0.55,
        flatShading: true,
      }),
    );
    pillar.position.y = 1.0;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x60ff90,
        emissive: 0x40ff70,
        emissiveIntensity: 1.1,
        roughness: 0.3,
      }),
    );
    orb.position.y = 1.85;
    shrine.add(platform, pillar, orb);
    shrine.position.copy(shrinePos);
    scene.add(shrine);

    // --- Amphitheater: ring of stones for path ritual ---
    const amphitheaterPos = new THREE.Vector3(28, 0, 32);
    const amph = new THREE.Group();
    amph.name = 'amphitheater';
    const amphStoneMat = new THREE.MeshStandardMaterial({
      color: 0x585860,
      roughness: 0.85,
      flatShading: true,
    });
    const ringCount = 12;
    const ringRadius = 7.5;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const h = 0.7 + (i % 3) * 0.25;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 0.55), amphStoneMat);
      stone.position.set(Math.cos(a) * ringRadius, h * 0.5, Math.sin(a) * ringRadius);
      stone.lookAt(0, h * 0.5, 0);
      stone.rotateY(Math.PI / 2);
      amph.add(stone);
    }
    // Center dais
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.9, flatShading: true }),
    );
    dais.position.y = 0.15;
    amph.add(dais);
    amph.position.copy(amphitheaterPos);
    scene.add(amph);

    // --- Soft golden floating particles ---
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 0.55,
    });
    const particleGeo = new THREE.SphereGeometry(0.08, 6, 6);
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(particleGeo, particleMat);
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 22;
      p.position.set(
        Math.cos(a) * r + stonesCenter.x * 0.3,
        1.2 + rng() * 3.5,
        Math.sin(a) * r + stonesCenter.z * 0.3,
      );
      p.name = 'mote';
      scene.add(p);
    }

    // Spawn near Discarding Stones
    const spawnPos = new THREE.Vector3(stonesCenter.x - 5, 0, stonesCenter.z + 4);

    return {
      ground,
      trees,
      ruins,
      shrinePos,
      amphitheaterPos,
      spawnPos,
      bounds,
    };
  }
}
