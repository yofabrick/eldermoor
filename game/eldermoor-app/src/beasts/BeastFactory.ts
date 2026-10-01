import type * as THREE_NS from 'three';
import type { WildBeast } from '../core/types';
import { speciesDef } from '../data/species';

type THREE = typeof THREE_NS;

function mat(
  THREE: THREE,
  color: number,
  opts?: {
    transparent?: boolean;
    opacity?: number;
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  },
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.75,
    metalness: opts?.metalness ?? 0.05,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
  });
}

function addPart(
  group: THREE_NS.Group,
  mesh: THREE_NS.Mesh,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

/** Stylized low-poly creature mesh colored/scaled by SPECIES. Distinct silhouettes per id. */
export function createBeastMesh(speciesId: string, THREE: THREE): THREE_NS.Group {
  const def = speciesDef(speciesId);
  const color = def.color;
  const scale = def.scale;
  const group = new THREE.Group();
  group.name = `beast_${speciesId}`;

  const bodyMat = mat(THREE, color);
  const darkMat = mat(THREE, shade(color, 0.55));
  const accentMat = mat(THREE, shade(color, 1.35));
  const eyeMat = mat(THREE, 0x1a1a1a);

  switch (speciesId) {
    case 'B01': {
      // Glimmerpouch — exaggerated gold thief silhouette (tall ears + big front pouch)
      const goldMat = mat(THREE, 0xe8c84a, {
        emissive: 0xc9a227,
        emissiveIntensity: 0.65,
        roughness: 0.32,
        metalness: 0.4,
      });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), bodyMat);
      addPart(group, body, 0, 0.55, 0);
      // LARGE front pouch mass — primary silhouette cue
      const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), goldMat);
      addPart(group, pouch, 0, 0.42, 0.42);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        mat(THREE, 0xfff6c8, {
          emissive: 0xffe08a,
          emissiveIntensity: 1.1,
          roughness: 0.2,
          metalness: 0.45,
        }),
      );
      addPart(group, gem, 0, 0.55, 0.78);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 7), bodyMat);
      addPart(group, head, 0, 1.02, 0.18);
      for (const sx of [-0.24, 0.24]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 4), accentMat);
        addPart(group, cheek, sx, 0.95, 0.32);
      }
      for (const sx of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), darkMat);
        addPart(group, leg, sx, 0.14, 0.05);
      }
      // TALL ear pair — unique outline at 8–12m
      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 5), darkMat);
      addPart(group, earL, -0.18, 1.45, 0.12, 0.1, 0, 0.25);
      const earR = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 5), darkMat);
      addPart(group, earR, 0.18, 1.45, 0.12, 0.1, 0, -0.25);
      // Inner ear gold flash
      for (const sx of [-0.18, 0.18]) {
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), goldMat);
        addPart(group, inner, sx, 1.38, 0.16, 0.1, 0, sx > 0 ? -0.2 : 0.2);
      }
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 12, 10),
        mat(THREE, 0xffe08a, {
          transparent: true,
          opacity: 0.24,
          emissive: 0xc9a227,
          emissiveIntensity: 0.7,
        }),
      );
      aura.castShadow = false;
      addPart(group, aura, 0, 0.55, 0);
      break;
    }
    case 'B02': {
      // Brushback Boar — tall center bristle + dark snout block (worker star)
      const hide = mat(THREE, color, { roughness: 0.92 });
      const bristle = mat(THREE, shade(color, 0.55), { roughness: 0.95 });
      const darkBlock = mat(THREE, shade(color, 0.4), { roughness: 0.95 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.6, 4, 8), hide);
      torso.rotation.z = Math.PI / 2;
      addPart(group, torso, 0, 0.55, 0);
      // Darker secondary block on snout + legs (silhouette mass)
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.5), darkBlock);
      addPart(group, snout, 0, 0.48, 0.75);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 7, 6), hide);
      addPart(group, head, 0, 0.8, 0.4);
      // Brush ridge — TALL center spike for outline
      for (let i = 0; i < 6; i++) {
        const h = i === 2 || i === 3 ? 0.48 : 0.22 + (i % 2) * 0.08;
        const br = new THREE.Mesh(new THREE.ConeGeometry(0.08, h, 4), bristle);
        addPart(group, br, 0, 0.95 + h * 0.15, -0.4 + i * 0.16, 0.35, 0, 0);
      }
      for (const sx of [-0.22, 0.22]) {
        const tusk = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.38, 5),
          mat(THREE, 0xf0e8d0, { roughness: 0.4, metalness: 0.15 }),
        );
        addPart(group, tusk, sx, 0.34, 0.95, Math.PI / 2.3, 0, sx > 0 ? -0.28 : 0.28);
      }
      for (const [lx, lz] of [
        [-0.3, 0.38],
        [0.3, 0.38],
        [-0.3, -0.42],
        [0.3, -0.42],
      ] as const) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.45, 6), darkBlock);
        addPart(group, leg, lx, 0.22, lz);
      }
      break;
    }
    case 'B03': {
      // Tall-eared lantern hare
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 6), bodyMat);
      body.scale.set(1, 1.15, 1.25);
      addPart(group, body, 0, 0.45, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), bodyMat);
      addPart(group, head, 0, 0.85, 0.22);
      for (const sx of [-0.12, 0.12]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), bodyMat);
        addPart(group, ear, sx, 1.35, 0.18, 0.15, 0, sx > 0 ? -0.15 : 0.15);
      }
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 5),
        mat(THREE, 0xfff0a0, { transparent: true, opacity: 0.9 }),
      );
      addPart(group, lantern, 0, 0.55, 0.45);
      for (const sx of [-0.18, 0.18]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.12), darkMat);
        addPart(group, leg, sx, 0.16, 0.05);
      }
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), accentMat);
      addPart(group, tail, 0, 0.4, -0.42);
      break;
    }
    case 'B04': {
      // Salamander — long body + tail
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.9), bodyMat);
      addPart(group, torso, 0, 0.35, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.4), darkMat);
      addPart(group, head, 0, 0.4, 0.55);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 6), bodyMat);
      addPart(group, tail, 0, 0.3, -0.7, Math.PI / 2, 0, 0);
      for (const [lx, lz] of [
        [-0.28, 0.25],
        [0.28, 0.25],
        [-0.28, -0.25],
        [0.28, -0.25],
      ] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.28), darkMat);
        addPart(group, leg, lx, 0.12, lz);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.7), accentMat);
      addPart(group, ridge, 0, 0.55, 0);
      break;
    }
    case 'B05': {
      // Small humanoid house-spirit
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.28), bodyMat);
      addPart(group, torso, 0, 0.55, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), accentMat);
      addPart(group, head, 0, 1.0, 0);
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 6), darkMat);
      addPart(group, hat, 0, 1.28, 0);
      for (const sx of [-0.28, 0.28]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), bodyMat);
        addPart(group, arm, sx, 0.55, 0);
      }
      for (const sx of [-0.12, 0.12]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.14), darkMat);
        addPart(group, leg, sx, 0.16, 0);
      }
      break;
    }
    case 'B06': {
      // Stag with antlers
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 1.1), bodyMat);
      addPart(group, torso, 0, 0.7, 0);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), darkMat);
      addPart(group, neck, 0, 1.05, 0.4, -0.4, 0, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.45), bodyMat);
      addPart(group, head, 0, 1.25, 0.6);
      for (const sx of [-1, 1]) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.55, 5), accentMat);
        addPart(group, base, sx * 0.12, 1.6, 0.55, 0, 0, sx * 0.35);
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.35, 4), accentMat);
        addPart(group, tine, sx * 0.28, 1.75, 0.5, 0.5, 0, sx * 0.6);
      }
      for (const [lx, lz] of [
        [-0.22, 0.35],
        [0.22, 0.35],
        [-0.22, -0.4],
        [0.22, -0.4],
      ] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), darkMat);
        addPart(group, leg, lx, 0.28, lz);
      }
      break;
    }
    case 'B07': {
      // Ghostly bog crooner — floaty translucent form
      const ghostMat = mat(THREE, color, { transparent: true, opacity: 0.72 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), ghostMat);
      body.scale.set(0.9, 1.3, 0.9);
      addPart(group, body, 0, 0.75, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), ghostMat);
      addPart(group, head, 0, 1.35, 0.05);
      const wisp1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4), ghostMat);
      addPart(group, wisp1, -0.4, 0.5, -0.1);
      const wisp2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), ghostMat);
      addPart(group, wisp2, 0.35, 0.35, -0.2);
      const trail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 6), ghostMat);
      addPart(group, trail, 0, 0.15, -0.15, Math.PI, 0, 0);
      break;
    }
    case 'B09': {
      // Ridgespire — proud avian mount
      addPart(group, new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), bodyMat), 0, 0.7, 0);
      addPart(
        group,
        new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), darkMat),
        0,
        1.1,
        0.35,
        Math.PI / 2,
        0,
        0,
      );
      addPart(
        group,
        new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.5), accentMat),
        0,
        1.0,
        -0.1,
      );
      addPart(
        group,
        new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), darkMat),
        0.25,
        0.35,
        0.15,
      );
      addPart(
        group,
        new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), darkMat),
        -0.25,
        0.35,
        0.15,
      );
      addPart(
        group,
        new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), accentMat),
        0,
        1.35,
        0.2,
      );
      break;
    }
    case 'B12': {
      // Dragonlet with crown
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.0), bodyMat);
      addPart(group, torso, 0, 0.6, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.5), darkMat);
      addPart(group, head, 0, 0.95, 0.55);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.35), bodyMat);
      addPart(group, snout, 0, 0.85, 0.9);
      // Crown spikes
      for (let i = -2; i <= 2; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.06, 0.28 + Math.abs(i) * 0.04, 5),
          accentMat,
        );
        addPart(group, spike, i * 0.1, 1.28, 0.5 - Math.abs(i) * 0.02);
      }
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.4), darkMat);
        addPart(group, wing, sx * 0.55, 0.85, -0.05, 0.2, 0, sx * 0.5);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 5), bodyMat);
      addPart(group, tail, 0, 0.5, -0.7, Math.PI / 2.2, 0, 0);
      for (const [lx, lz] of [
        [-0.25, 0.3],
        [0.25, 0.3],
        [-0.25, -0.3],
        [0.25, -0.3],
      ] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), darkMat);
        addPart(group, leg, lx, 0.2, lz);
      }
      break;
    }
    default: {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 6), bodyMat);
      addPart(group, body, 0, 0.5, 0);
      break;
    }
  }

  // Large readable eyes — local size tuned so post-scale still reads at 8–12m
  if (speciesId === 'B01' || speciesId === 'B02' || speciesId === 'B03') {
    const white = mat(THREE, 0xfff8f0, { roughness: 0.35 });
    const irisCol = speciesId === 'B01' ? 0x1a5a38 : speciesId === 'B02' ? 0x2a1810 : 0x3a2818;
    // Bigger local eyes for B01 (scaled down by species.scale) and B02 (worker star)
    const eyeR = speciesId === 'B01' ? 0.13 : speciesId === 'B02' ? 0.11 : 0.09;
    const irisR = eyeR * 0.52;
    for (const sx of [-1, 1]) {
      const xOff = sx * (speciesId === 'B02' ? 0.16 : 0.14);
      const y = speciesId === 'B02' ? 0.88 : speciesId === 'B01' ? 1.02 : 1.0;
      const z = speciesId === 'B02' ? 0.68 : speciesId === 'B01' ? 0.52 : 0.48;
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 7, 6), white);
      addPart(group, eyeWhite, xOff, y, z);
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(irisR, 6, 5),
        mat(THREE, irisCol, { emissive: irisCol, emissiveIntensity: 0.25 }),
      );
      addPart(group, iris, xOff, y, z + eyeR * 0.75);
      // Specular catchlight
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(irisR * 0.35, 4, 4),
        mat(THREE, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.2 }),
      );
      addPart(group, spark, xOff + 0.02, y + 0.02, z + eyeR * 0.95);
    }
  }

  // Tiny eyes on non-hero forms only (B01–B03 already have large eyes)
  if (speciesId !== 'B01' && speciesId !== 'B02' && speciesId !== 'B03') {
    const eyeY =
      speciesId === 'B07' ? 1.4 : speciesId === 'B06' ? 1.3 : speciesId === 'B12' ? 1.05 : 0.9;
    const eyeZ = speciesId === 'B04' ? 0.7 : 0.35;
    for (const sx of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
      addPart(group, eye, sx, eyeY, eyeZ);
    }
  }

  group.scale.setScalar(scale);
  group.userData.speciesId = speciesId;
  group.userData.baseScale = scale;
  return group;
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((hex & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `beast_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

/** Spawn a fully initialized WildBeast at the given world position. */
export function createWildBeast(
  speciesId: string,
  position: THREE_NS.Vector3,
  THREE: THREE,
): WildBeast {
  const def = speciesDef(speciesId);
  const mesh = createBeastMesh(def.id, THREE);
  const groundY = def.scale * 0.5;
  mesh.position.set(position.x, groundY, position.z);
  mesh.userData.spawn = new THREE.Vector3(position.x, groundY, position.z);
  mesh.userData.pendingDamage = 0;
  mesh.userData.speciesId = def.id;

  const maxHp = def.stats.hp;

  return {
    id: newId(),
    speciesId: def.id,
    position: mesh.position.clone(),
    mesh,
    hp: maxHp,
    maxHp,
    state: 'wander',
    target: null,
    aggroTimer: 0,
    attackCooldown: 0,
    lastChargeWhiff: 0,
    partBroken: false,
    heavyDamageRecent: 0,
    calmed: false,
    overheated: false,
    opportunityTimer: 0,
    name: def.name,
  };
}
