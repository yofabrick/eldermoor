import * as THREE from 'three';

export interface MireZoneResult {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
}

/** Blackvein Mire — purple swamp pocket with fog trees and bog resources. */
export function buildMireZone(scene: THREE.Scene): MireZoneResult {
  const center = new THREE.Vector3(-55, 0, 40);
  const radius = 28;
  const group = new THREE.Group();
  group.name = 'mire_zone';

  // Swamp ground disk
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshStandardMaterial({
      color: 0x1a2a22,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x1a0a28,
      emissiveIntensity: 0.15,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(center);
  ground.position.y = 0.04;
  ground.receiveShadow = true;
  group.add(ground);

  // Water patches
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 4 + (i % 3) * 5;
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(2.2 + (i % 3) * 0.6, 16),
      new THREE.MeshStandardMaterial({
        color: 0x1a1428,
        emissive: 0x3d2a55,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.75,
        roughness: 0.2,
        metalness: 0.4,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(center.x + Math.cos(a) * r, 0.06, center.z + Math.sin(a) * r);
    group.add(pool);
  }

  // Dead white trees
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * (radius - 8);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 3 + Math.random() * 2, 5),
      new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.9 }),
    );
    trunk.position.set(center.x + Math.cos(a) * r, 1.5, center.z + Math.sin(a) * r);
    trunk.rotation.z = (Math.random() - 0.5) * 0.3;
    trunk.castShadow = true;
    group.add(trunk);
  }

  // Sunken lecture hall hint
  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.85 }),
  );
  hall.position.set(center.x + 6, 0.3, center.z - 4);
  hall.rotation.y = 0.4;
  group.add(hall);
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.4, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x5a4030 }),
  );
  desk.position.set(center.x + 5, 0.55, center.z - 3);
  group.add(desk);

  // Will-o-wisps
  for (let i = 0; i < 10; i++) {
    const w = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0xa78bfa,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.8,
      }),
    );
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (radius - 4);
    w.position.set(center.x + Math.cos(a) * r, 1.2 + Math.random() * 2, center.z + Math.sin(a) * r);
    w.userData.phase = Math.random() * Math.PI * 2;
    w.userData.baseY = w.position.y;
    group.add(w);
  }

  // Signpost
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
  );
  post.position.set(center.x + radius * 0.75, 1.1, center.z - radius * 0.2);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2a1830, emissive: 0x4a2060, emissiveIntensity: 0.2 }),
  );
  board.position.set(post.position.x, 2.0, post.position.z);
  group.add(post, board);

  scene.add(group);
  return { group, center, radius };
}

export function animateMire(group: THREE.Group, t: number) {
  group.traverse((obj) => {
    if (obj.userData.phase != null && obj instanceof THREE.Mesh) {
      obj.position.y = obj.userData.baseY + Math.sin(t * 2 + obj.userData.phase) * 0.35;
    }
  });
}

export function isInMire(pos: THREE.Vector3, center: THREE.Vector3, radius: number): boolean {
  const dx = pos.x - center.x;
  const dz = pos.z - center.z;
  return dx * dx + dz * dz <= radius * radius;
}
