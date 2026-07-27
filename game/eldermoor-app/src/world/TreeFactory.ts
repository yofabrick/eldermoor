import type { Group, Texture } from 'three';

type ThreeModule = typeof import('three');

/**
 * Low-poly prop factory for Eldermoor glade flora/rocks.
 * Pass the three.js module so callers control the import path.
 */

export function createTree(
  THREE: ThreeModule,
  rng: () => number,
  barkMap: Texture,
  leafMap: Texture,
): Group {
  const group = new THREE.Group();
  group.name = 'tree';

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  // Slight canopy color variation per tree
  const leafTint = new THREE.Color().setHSL(
    0.28 + rng() * 0.08,
    0.35 + rng() * 0.25,
    0.32 + rng() * 0.12,
  );
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafMap,
    color: leafTint,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const variant = rng();
  const trunkH = 1.5 + rng() * 1.4;
  const trunkR = 0.16 + rng() * 0.14;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.72, trunkR * 1.05, trunkH, 6),
    barkMat,
  );
  trunk.position.y = trunkH * 0.5;
  trunk.castShadow = true;
  group.add(trunk);

  if (variant < 0.34) {
    // Pine — stacked cones
    const layers = 2 + (rng() > 0.5 ? 1 : 0);
    for (let i = 0; i < layers; i++) {
      const t = i / Math.max(1, layers - 1);
      const r = (1.15 - t * 0.45) * (0.85 + rng() * 0.25);
      const h = 1.3 + rng() * 0.5 - t * 0.25;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat);
      cone.position.y = trunkH + 0.2 + i * (h * 0.55);
      cone.castShadow = true;
      group.add(cone);
    }
  } else if (variant < 0.67) {
    // Broad deciduous — multi-sphere canopy
    const mainR = 0.9 + rng() * 0.55;
    const main = new THREE.Mesh(new THREE.SphereGeometry(mainR, 7, 6), leafMat);
    main.position.y = trunkH + mainR * 0.5;
    main.castShadow = true;
    group.add(main);
    const blobs = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < blobs; i++) {
      const r = mainR * (0.45 + rng() * 0.35);
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), leafMat);
      blob.position.set(
        (rng() - 0.5) * mainR * 1.1,
        trunkH + mainR * (0.2 + rng() * 0.5),
        (rng() - 0.5) * mainR * 1.1,
      );
      blob.castShadow = true;
      group.add(blob);
    }
  } else {
    // Twisted oak — short fat trunk + offset spheres + small branch stub
    const fatR = trunkR * 1.25;
    trunk.geometry.dispose();
    trunk.geometry = new THREE.CylinderGeometry(
      fatR * 0.7,
      fatR * 1.15,
      trunkH * 0.9,
      6,
    );
    trunk.position.y = trunkH * 0.45;

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.25, trunkR * 0.4, trunkH * 0.55, 5),
      barkMat,
    );
    branch.position.set(trunkR * 0.8, trunkH * 0.7, 0);
    branch.rotation.z = -0.7 - rng() * 0.3;
    group.add(branch);

    const r0 = 0.75 + rng() * 0.4;
    for (let i = 0; i < 3; i++) {
      const r = r0 * (0.7 + rng() * 0.4);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), leafMat);
      canopy.position.set(
        (rng() - 0.5) * 0.7,
        trunkH * 0.9 + r * 0.4 + i * 0.15,
        (rng() - 0.5) * 0.7,
      );
      canopy.castShadow = true;
      group.add(canopy);
    }
  }

  return group;
}

export function createRock(
  THREE: ThreeModule,
  rng: () => number,
  stoneMap: Texture,
): Group {
  const group = new THREE.Group();
  group.name = 'rock';

  const mat = new THREE.MeshStandardMaterial({
    map: stoneMap,
    color: 0xc8c8d0,
    roughness: 0.9,
    metalness: 0.06,
    flatShading: true,
  });

  const style = rng();
  const w = 0.55 + rng() * 1.35;
  const h = 0.35 + rng() * 1.0;
  const d = 0.5 + rng() * 1.15;

  if (style < 0.45) {
    // Boxy boulder
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = h * 0.45;
    mesh.rotation.set(rng() * 0.35, rng() * Math.PI, rng() * 0.35);
    mesh.castShadow = true;
    group.add(mesh);
  } else if (style < 0.8) {
    // Faceted chunk (low-seg sphere, squashed)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(w, d) * 0.55, 5, 4), mat);
    mesh.scale.set(1 + rng() * 0.4, 0.55 + rng() * 0.35, 0.9 + rng() * 0.4);
    mesh.position.y = h * 0.35;
    mesh.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.4);
    mesh.castShadow = true;
    group.add(mesh);
  } else {
    // Cluster of 2–3 smaller stones
    const n = 2 + (rng() > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const sw = w * (0.4 + rng() * 0.5);
      const sh = h * (0.4 + rng() * 0.55);
      const sd = d * (0.4 + rng() * 0.5);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), mat);
      mesh.position.set((rng() - 0.5) * w, sh * 0.42, (rng() - 0.5) * d);
      mesh.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
      mesh.castShadow = true;
      group.add(mesh);
    }
  }

  return group;
}

export function createBush(
  THREE: ThreeModule,
  rng: () => number,
  leafMap: Texture,
): Group {
  const group = new THREE.Group();
  group.name = 'bush';

  const tint = new THREE.Color().setHSL(
    0.25 + rng() * 0.12,
    0.4 + rng() * 0.3,
    0.28 + rng() * 0.14,
  );
  const mat = new THREE.MeshStandardMaterial({
    map: leafMap,
    color: tint,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const blobs = 2 + Math.floor(rng() * 3);
  const baseR = 0.35 + rng() * 0.35;
  for (let i = 0; i < blobs; i++) {
    const r = baseR * (0.55 + rng() * 0.55);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat);
    mesh.position.set(
      (rng() - 0.5) * baseR * 1.2,
      r * 0.7 + rng() * 0.1,
      (rng() - 0.5) * baseR * 1.2,
    );
    mesh.scale.y = 0.75 + rng() * 0.25;
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}
