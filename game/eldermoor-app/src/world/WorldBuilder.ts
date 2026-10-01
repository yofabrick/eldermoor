import * as THREE from 'three';
import {
  makeBarkTexture,
  makeGrassTexture,
  makeLeafTexture,
  makeStoneTexture,
} from '../render/ProceduralTextures';
import { createBush, createRock, createTree } from './TreeFactory';
import { requireCanvas2d } from '../core/util';

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

/** Write an RGB triple into a packed vertex-color buffer at vertex `index`. */
function setVertexColor(colors: Float32Array, index: number, c: THREE.Color): void {
  colors[index * 3] = c.r;
  colors[index * 3 + 1] = c.g;
  colors[index * 3 + 2] = c.b;
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
  /** Discarding Stones center — first camp landmark */
  stonesCenter: THREE.Vector3;
}

export class WorldBuilder {
  build(scene: THREE.Scene): WorldBuildResult {
    const bounds = 85;
    const rng = mulberry32(42);

    // Bright fantasy sky (DayNight will keep tuning this)
    scene.background = new THREE.Color(0xc5d6e8);
    scene.fog = new THREE.Fog(0xb8c8d8, 65, 170);

    // Soft sky + ground bounce — strong fill so nothing reads as black pits
    const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x5a7a48, 1.05);
    hemi.name = 'hemi';
    scene.add(hemi);

    // Key sunlight
    const sun = new THREE.DirectionalLight(0xfff4dc, 1.65);
    sun.name = 'sun';
    sun.position.set(45, 80, 30);
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

    // Fill ambient — kept high so materials stay readable
    const amb = new THREE.AmbientLight(0xd0d8e8, 0.65);
    amb.name = 'ambient';
    scene.add(amb);

    // --- Ground: ONE material — camp warmth baked into vertex colors (no sticker layers) ---
    const groundSize = 180;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 64, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    if (!pos) throw new Error('ground geometry has no position attribute');
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x3d5c3a);
    const gold = new THREE.Color(0x6a7a3a);
    const dark = new THREE.Color(0x2f4a2e);
    const campWarm = new THREE.Color(0x7a8a42); // cozy glade
    const campDirt = new THREE.Color(0x8a7348); // path dirt
    const campCenter = new THREE.Color(0x6a5a38); // hearth earth
    const tmp = new THREE.Color();
    const stonesCx = 6;
    const stonesCz = -4;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Gentle height noise for soft rolling glade
      let h =
        Math.sin(x * 0.04) * Math.cos(z * 0.035) * 0.35 + Math.sin(x * 0.12 + z * 0.08) * 0.12;
      // Slight depression at camp hearth (reads as worn path)
      const campDist = Math.hypot(x - stonesCx, z - stonesCz);
      if (campDist < 14) h *= 0.55 + (campDist / 14) * 0.45;
      pos.setY(i, h);
      const t = (Math.sin(x * 0.08) * Math.cos(z * 0.07) + 1) * 0.5;
      tmp
        .copy(base)
        .lerp(gold, t * 0.55)
        .lerp(dark, (1 - t) * 0.25);
      // Unified camp zone: warm glade + dirt ring + hearth — baked, not overlays
      // Fire pit at local offset (−1.2, 1.0) from stones center in world = (4.8, −3)
      const fireDist = Math.hypot(x - (stonesCx - 1.2), z - (stonesCz + 1.0));
      if (fireDist < 2.4) {
        // Scorch / warm hearth under fire (strongest pull)
        tmp.lerp(new THREE.Color(0x5a3a1a), 1 - fireDist / 2.4);
      } else if (campDist < 3.2) {
        tmp.lerp(campCenter, 1 - campDist / 3.2);
      } else if (campDist < 8.5) {
        const dirtAmt = 1 - Math.abs(campDist - 5.5) / 3.5;
        tmp.lerp(campDirt, Math.max(0, dirtAmt) * 0.75);
      } else if (campDist < 16) {
        tmp.lerp(campWarm, (1 - (campDist - 8.5) / 7.5) * 0.65);
      }
      // Slight radial darkening toward bounds edge
      const dist = Math.hypot(x, z) / (groundSize * 0.5);
      if (dist > 0.7) tmp.lerp(new THREE.Color(0x1a2218), (dist - 0.7) * 0.8);
      setVertexColor(colors, i, tmp);
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

    // --- Discarding Stones: 3 tall standing stones (wake / Unlisted landmark) ---
    const stonesCenter = new THREE.Vector3(6, 0, -4);
    const stoneGroup = new THREE.Group();
    stoneGroup.name = 'discardingStones';
    const stoneBodyMat = new THREE.MeshStandardMaterial({
      color: 0x6a6872,
      map: stoneMap,
      roughness: 0.72,
      metalness: 0.1,
      flatShading: true,
    });
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      emissive: 0xffc040,
      emissiveIntensity: 0.75,
      roughness: 0.35,
      metalness: 0.4,
    });

    // Asymmetric triad: tapered monoliths (not boxes) — silhouette at 20m without sprite
    const stoneSpecs = [
      { a: -Math.PI / 6, r: 3.0, h: 6.0, lean: 0.1, rTop: 0.28, rBot: 0.55 },
      { a: -Math.PI / 6 + (Math.PI * 2) / 3, r: 3.4, h: 4.4, lean: -0.08, rTop: 0.22, rBot: 0.42 },
      { a: -Math.PI / 6 + (Math.PI * 4) / 3, r: 3.1, h: 7.0, lean: 0.14, rTop: 0.32, rBot: 0.62 },
    ];
    for (const [i, s] of stoneSpecs.entries()) {
      // Tapered stone column — reads as menhir, not crate
      const body = new THREE.Mesh(new THREE.CylinderGeometry(s.rTop, s.rBot, s.h, 7), stoneBodyMat);
      body.position.set(Math.cos(s.a) * s.r, s.h * 0.5, Math.sin(s.a) * s.r);
      body.rotation.z = s.lean;
      body.rotation.y = s.a + Math.PI / 2;
      body.castShadow = true;
      body.receiveShadow = true;

      // Inset gold rune plate on body (mass first, jewelry second — not torus gizmo)
      const rune = new THREE.Mesh(
        new THREE.BoxGeometry(s.rBot * 1.1, s.h * 0.22, 0.08),
        goldRimMat,
      );
      rune.position.set(Math.cos(s.a) * s.r * 0.92, s.h * 0.5, Math.sin(s.a) * s.r * 0.92);
      rune.lookAt(0, s.h * 0.5, 0);
      rune.castShadow = true;

      // Stone cap mass (stone first) + small gold tip gem
      const capStone = new THREE.Mesh(new THREE.SphereGeometry(s.rTop * 1.15, 6, 5), stoneBodyMat);
      capStone.position.set(Math.cos(s.a) * s.r, s.h + 0.15, Math.sin(s.a) * s.r);
      capStone.castShadow = true;
      const capGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + i * 0.04, 0), goldRimMat);
      capGem.position.set(
        Math.cos(s.a) * s.r,
        s.h + 0.45 + Math.abs(s.lean) * 0.3,
        Math.sin(s.a) * s.r,
      );

      // Broken lintel between tallest stones
      if (i === 0) {
        const lintel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 2.8, 6), stoneBodyMat);
        lintel.rotation.z = Math.PI / 2 - 0.2;
        lintel.position.set(0.3, 5.5, -0.5);
        lintel.castShadow = true;
        stoneGroup.add(lintel);
      }

      stoneGroup.add(body, rune, capStone, capGem);
    }
    // Central stone needle — pure stone mass + small gold tip only
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.52, 7.2, 8), stoneBodyMat);
    needle.position.y = 3.7;
    needle.castShadow = true;
    const needleTip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 8), stoneBodyMat);
    needleTip.position.y = 8.0;
    needleTip.castShadow = true;
    const tipGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), goldRimMat);
    tipGem.position.y = 8.7;
    stoneGroup.add(needle, needleTip, tipGem);

    // Camp fire — volume layers (no translucent scorch disk; ground bake handles hearth)
    const fireX = -1.2;
    const fireZ = 1.0;
    const fireBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.95, flatShading: true }),
    );
    fireBase.position.set(fireX, 0.12, fireZ);
    // Log ring (mass)
    for (let li = 0; li < 5; li++) {
      const a = (li / 5) * Math.PI * 2;
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 0.75, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3424, map: barkMap, roughness: 0.92 }),
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = a;
      log.position.set(fireX + Math.cos(a) * 0.4, 0.2, fireZ + Math.sin(a) * 0.4);
      log.castShadow = true;
      stoneGroup.add(log);
    }
    // Outer flame
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.15, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff7a28,
        emissive: 0xff4400,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.88,
      }),
    );
    flame.position.set(fireX, 0.78, fireZ);
    flame.name = 'campFlame';
    // Mid flame
    const flameMid = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.85, 7),
      new THREE.MeshStandardMaterial({
        color: 0xffaa40,
        emissive: 0xff8800,
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.9,
      }),
    );
    flameMid.position.set(fireX, 0.65, fireZ);
    flameMid.name = 'campFlameMid';
    // Inner white-hot core
    const flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.55, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfff0c0,
        emissive: 0xffee88,
        emissiveIntensity: 2.8,
        transparent: true,
        opacity: 0.92,
      }),
    );
    flameInner.position.set(fireX, 0.5, fireZ);
    flameInner.name = 'campFlameInner';
    // Ember volume (third layer — glowing spheres)
    for (let ei = 0; ei < 6; ei++) {
      const ea = (ei / 6) * Math.PI * 2;
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + (ei % 2) * 0.03, 5, 4),
        new THREE.MeshStandardMaterial({
          color: 0xff6622,
          emissive: 0xff4400,
          emissiveIntensity: 1.8,
        }),
      );
      ember.position.set(
        fireX + Math.cos(ea) * 0.22,
        0.28 + (ei % 3) * 0.08,
        fireZ + Math.sin(ea) * 0.22,
      );
      ember.name = `campEmber${ei}`;
      stoneGroup.add(ember);
    }
    const campLight = new THREE.PointLight(0xff9944, 3.2, 22, 2);
    campLight.position.set(fireX, 1.6, fireZ);
    campLight.name = 'campLight';
    campLight.castShadow = false;
    stoneGroup.add(fireBase, flame, flameMid, flameInner, campLight);
    // Stone pedestal only (no MeshBasic gold ring jewelry)
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.9, 0.32, 12),
      new THREE.MeshStandardMaterial({
        color: 0x4a4a52,
        map: stoneMap,
        roughness: 0.88,
        flatShading: true,
      }),
    );
    ped.position.y = 0.14;
    ped.receiveShadow = true;
    ped.castShadow = true;
    // Subtle stone lip, not glowing gizmo
    const pedLip = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.08, 6, 24),
      new THREE.MeshStandardMaterial({
        color: 0x5a5858,
        map: stoneMap,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    pedLip.rotation.x = Math.PI / 2;
    pedLip.position.y = 0.32;
    stoneGroup.add(ped, pedLip);

    // Stepping-stone path from spawn approach → stones (cozy first camp)
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x7a7568,
      map: stoneMap,
      roughness: 0.9,
      flatShading: true,
    });
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7;
      const sx = stonesCenter.x - 5 + t * 5;
      const sz = stonesCenter.z + 4 - t * 4;
      const step = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45 + (i % 2) * 0.1, 0.5, 0.12, 7),
        pathMat,
      );
      step.position.set(sx - stonesCenter.x, 0.06, sz - stonesCenter.z);
      step.receiveShadow = true;
      stoneGroup.add(step);
    }

    // Floating name tag (always readable from spawn)
    stoneGroup.add(makeWorldLabel('VERWERFUNGSSTEINE', '#c9a227', '#ffe9a8'));
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
      const main = new THREE.Mesh(new THREE.BoxGeometry(layout.w, layout.h, 0.45), ruinMat);
      main.position.y = layout.h * 0.5;
      wall.add(main);
      // Broken top notch
      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(layout.w * 0.35, layout.h * 0.35, 0.5),
        ruinMat,
      );
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

    // --- Shrine marker (living platform + warm point light) ---
    const shrinePos = new THREE.Vector3(-22, 0, -18);
    const shrine = new THREE.Group();
    shrine.name = 'shrine';
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.8, 0.35, 8),
      new THREE.MeshStandardMaterial({
        color: 0x3a5a3a,
        map: stoneMap,
        emissive: 0x1a4a28,
        emissiveIntensity: 0.45,
        roughness: 0.7,
        flatShading: true,
      }),
    );
    platform.position.y = 0.18;
    platform.castShadow = true;
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
    pillar.castShadow = true;
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
    const shrineLight = new THREE.PointLight(0x60ff90, 1.3, 14, 2);
    shrineLight.position.set(0, 2.0, 0);
    shrine.add(platform, pillar, orb, shrineLight);
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

    // Shrine + amph labels for orientation
    const shrineLabel = makeWorldLabel('SCHREIN', '#6bcb8a', '#b8ffd4');
    shrineLabel.position.copy(shrinePos);
    shrineLabel.position.y = 0;
    scene.add(shrineLabel);
    const amphLabel = makeWorldLabel('AMPHITHEATER', '#a78bfa', '#ddd6fe');
    amphLabel.position.copy(amphitheaterPos);
    scene.add(amphLabel);

    return {
      ground,
      trees,
      ruins,
      shrinePos,
      amphitheaterPos,
      spawnPos,
      bounds,
      stonesCenter,
    };
  }
}

/** Canvas sprite world label — AC-style readable landmark names */
function makeWorldLabel(text: string, stroke: string, fill: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = requireCanvas2d(canvas);
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = 'rgba(12,10,18,0.78)';
  const rr = 14;
  ctx.beginPath();
  ctx.moveTo(24 + rr, 16);
  ctx.arcTo(488, 16, 488, 80, rr);
  ctx.arcTo(488, 80, 24, 80, rr);
  ctx.arcTo(24, 80, 24, 16, rr);
  ctx.arcTo(24, 16, 488, 16, rr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.font = 'bold 36px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  spr.position.y = 4.2;
  spr.scale.set(4.2, 0.8, 1);
  spr.renderOrder = 8;
  spr.name = `label_${text}`;
  return spr;
}
