import type * as THREE from 'three';

/** Seeded mulberry32 PRNG for deterministic ambient scatter. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type ThreeMod = typeof THREE;

export interface AmbientPropsOpts {
  seed?: number;
  /** Landmark positions (e.g. Discarding Stones, shrine, amphitheater) for torch placement. */
  landmarks?: THREE.Vector3[];
}

/**
 * Scatter 80–120 small ambient props across the glade.
 * Parent group is named `ambient_props` and added to the scene.
 */
export function scatterAmbientProps(
  scene: THREE.Scene,
  bounds: number,
  THREE: ThreeMod,
  opts?: AmbientPropsOpts,
): THREE.Group {
  const rng = mulberry32(opts?.seed ?? 0xa3b1e77);
  const root = new THREE.Group();
  root.name = 'ambient_props';

  // Shared materials (MeshStandardMaterial only)
  const logMat = new THREE.MeshStandardMaterial({
    color: 0x4a3424,
    roughness: 0.92,
    flatShading: true,
  });
  const logEndMat = new THREE.MeshStandardMaterial({
    color: 0x6a5040,
    roughness: 0.85,
    flatShading: true,
  });
  const mushroomCapMats = [
    new THREE.MeshStandardMaterial({
      color: 0x7a4a9a,
      emissive: 0x5a2080,
      emissiveIntensity: 0.45,
      roughness: 0.55,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x4a8a6a,
      emissive: 0x1a6040,
      emissiveIntensity: 0.4,
      roughness: 0.55,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xa06040,
      emissive: 0x603018,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    }),
  ];
  const mushroomStemMat = new THREE.MeshStandardMaterial({
    color: 0xd8d0c0,
    roughness: 0.8,
  });
  const crystalPurpleMat = new THREE.MeshStandardMaterial({
    color: 0x6a4a9a,
    emissive: 0x4a3080,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  const crystalGoldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    emissive: 0xffc040,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.4,
    transparent: true,
    opacity: 0.9,
  });
  const grassMats = [
    new THREE.MeshStandardMaterial({
      color: 0x3d5c3a,
      roughness: 0.95,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x4a6b38,
      roughness: 0.95,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x2f4a2e,
      roughness: 0.95,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  ];
  const torchPostMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.9,
    flatShading: true,
  });
  const torchFlameMat = new THREE.MeshStandardMaterial({
    color: 0xffa040,
    emissive: 0xff6020,
    emissiveIntensity: 1.1,
    roughness: 0.4,
    transparent: true,
    opacity: 0.92,
  });
  const torchBowlMat = new THREE.MeshStandardMaterial({
    color: 0x5a5048,
    roughness: 0.7,
    metalness: 0.25,
  });

  const total = 80 + Math.floor(rng() * 41); // 80–120

  // Budget split (remainder becomes grass)
  const nLogs = Math.max(8, Math.floor(total * 0.14));
  const nMushrooms = Math.max(10, Math.floor(total * 0.16));
  const nCrystals = Math.max(8, Math.floor(total * 0.14));
  let nGrass = total - nLogs - nMushrooms - nCrystals;
  if (nGrass < 20) nGrass = 20;

  const sampleXZ = (): { x: number; z: number } => {
    const ang = rng() * Math.PI * 2;
    // Prefer mid/far field; allow a light near-origin presence without piling on (0,0)
    let rad: number;
    const roll = rng();
    if (roll < 0.1) {
      rad = 3 + rng() * 9; // sparse near spawn
    } else if (roll < 0.35) {
      rad = 12 + rng() * 18;
    } else {
      // sqrt bias fills area more evenly
      rad = 18 + Math.sqrt(rng()) * (bounds * 0.88 - 18);
    }
    if (rad > bounds * 0.92) rad = bounds * 0.92;
    return { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad };
  };

  // --- Fallen logs ---
  for (let i = 0; i < nLogs; i++) {
    const g = new THREE.Group();
    const len = 0.9 + rng() * 1.4;
    const r = 0.1 + rng() * 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, len, 6), logMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = r;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // End caps (rings hint)
    const endA = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.04, 6), logEndMat);
    endA.rotation.z = Math.PI / 2;
    endA.position.set(-len * 0.5, r, 0);
    const endB = endA.clone();
    endB.position.x = len * 0.5;
    g.add(endA, endB);

    const { x, z } = sampleXZ();
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    g.rotation.x = (rng() - 0.5) * 0.15;
    g.rotation.z = (rng() - 0.5) * 0.12;
    root.add(g);
  }

  // --- Mushrooms (emissive caps) ---
  for (let i = 0; i < nMushrooms; i++) {
    const g = new THREE.Group();
    const cluster = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < cluster; j++) {
      const h = 0.12 + rng() * 0.22;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, h, 5), mushroomStemMat);
      stem.position.set((rng() - 0.5) * 0.25, h * 0.5, (rng() - 0.5) * 0.25);
      stem.castShadow = true;
      const capR = 0.08 + rng() * 0.12;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capR, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mushroomCapMats[Math.floor(rng() * mushroomCapMats.length)]!,
      );
      cap.position.set(stem.position.x, h + capR * 0.15, stem.position.z);
      cap.castShadow = true;
      g.add(stem, cap);
    }
    const { x, z } = sampleXZ();
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    root.add(g);
  }

  // --- Crystal shards (path-neutral purple / gold) ---
  for (let i = 0; i < nCrystals; i++) {
    const g = new THREE.Group();
    const shards = 1 + Math.floor(rng() * 3);
    const gold = rng() > 0.55;
    const mat = gold ? crystalGoldMat : crystalPurpleMat;
    for (let j = 0; j < shards; j++) {
      const h = 0.25 + rng() * 0.45;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + rng() * 0.1, 0), mat);
      shard.scale.set(0.45 + rng() * 0.3, h / 0.3, 0.45 + rng() * 0.3);
      shard.position.set((rng() - 0.5) * 0.2, h * 0.35, (rng() - 0.5) * 0.2);
      shard.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
      shard.castShadow = true;
      g.add(shard);
    }
    const { x, z } = sampleXZ();
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    root.add(g);
  }

  // --- Grass tufts (cards + cones) ---
  for (let i = 0; i < nGrass; i++) {
    const g = new THREE.Group();
    const mat = grassMats[Math.floor(rng() * grassMats.length)]!;
    const blades = 2 + Math.floor(rng() * 3);
    for (let j = 0; j < blades; j++) {
      if (rng() > 0.4) {
        // Card blade
        const h = 0.25 + rng() * 0.4;
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.08 + rng() * 0.06, h), mat);
        card.position.set((rng() - 0.5) * 0.18, h * 0.5, (rng() - 0.5) * 0.18);
        card.rotation.y = rng() * Math.PI;
        card.rotation.x = (rng() - 0.5) * 0.25;
        card.castShadow = false;
        card.receiveShadow = true;
        g.add(card);
      } else {
        // Cone tuft
        const h = 0.2 + rng() * 0.35;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06 + rng() * 0.04, h, 4), mat);
        cone.position.set((rng() - 0.5) * 0.16, h * 0.5, (rng() - 0.5) * 0.16);
        cone.rotation.z = (rng() - 0.5) * 0.2;
        cone.castShadow = false;
        cone.receiveShadow = true;
        g.add(cone);
      }
    }
    const { x, z } = sampleXZ();
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    const s = 0.85 + rng() * 0.5;
    g.scale.setScalar(s);
    root.add(g);
  }

  // --- Standing torches near landmarks ---
  const landmarks = opts?.landmarks;
  if (landmarks && landmarks.length > 0) {
    for (const lm of landmarks) {
      const torchCount = 1 + (rng() > 0.45 ? 1 : 0);
      for (let t = 0; t < torchCount; t++) {
        const a = rng() * Math.PI * 2;
        const dist = 3.5 + rng() * 2.5;
        const torch = makeTorch(THREE, torchPostMat, torchBowlMat, torchFlameMat);
        torch.position.set(lm.x + Math.cos(a) * dist, 0, lm.z + Math.sin(a) * dist);
        torch.rotation.y = rng() * Math.PI * 2;
        root.add(torch);
      }
    }
  }

  scene.add(root);
  return root;
}

function makeTorch(
  THREE: ThreeMod,
  postMat: THREE.MeshStandardMaterial,
  bowlMat: THREE.MeshStandardMaterial,
  flameMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'torch';
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), postMat);
  post.position.y = 0.8;
  post.castShadow = true;
  post.receiveShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 6), bowlMat);
  bowl.position.y = 1.62;
  bowl.castShadow = true;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 5), flameMat);
  flame.position.y = 1.88;
  // Soft outer glow shell
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff8020,
      emissive: 0xff6010,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.28,
      roughness: 1,
      depthWrite: false,
    }),
  );
  glow.position.y = 1.9;
  g.add(post, bowl, flame, glow);
  return g;
}

/**
 * Soft godray-ish stack of transparent cones for the Discarding Stones tutorial landmark.
 * Does not auto-add to the scene — caller parents/places as needed.
 */
export function createDiscardingStoneGlow(THREE: ThreeMod, position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.name = 'discarding_stone_glow';

  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const radius = 1.2 + t * 2.4;
    const height = 3.2 + t * 2.8;
    // Open-ended cone so the shaft reads as a volumetric beam
    const geo = new THREE.ConeGeometry(radius, height, 16, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xc9a227 : 0xe8d48b,
      emissive: i % 2 === 0 ? 0xffc040 : 0xc9a227,
      emissiveIntensity: 0.4 - t * 0.2,
      transparent: true,
      opacity: 0.14 - t * 0.018,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(geo, mat);
    // Point upward; base sits slightly below ground for soft root
    cone.position.y = height * 0.45 + t * 0.35;
    cone.rotation.y = t * 0.35;
    cone.castShadow = false;
    cone.receiveShadow = false;
    group.add(cone);
  }

  // Soft ground caustic disk
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 24),
    new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      emissive: 0xffc040,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.18,
      roughness: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.08;
  group.add(disc);

  group.position.copy(position);
  return group;
}
