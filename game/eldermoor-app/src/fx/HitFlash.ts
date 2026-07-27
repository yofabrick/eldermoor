import * as THREE from 'three';

/** Brief emissive flash on a mesh when hit. */
export function flashMesh(obj: THREE.Object3D, color = 0xff6666, ms = 120) {
  const mats: THREE.MeshStandardMaterial[] = [];
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
      mats.push(c.material);
      c.material.emissive = new THREE.Color(color);
      c.material.emissiveIntensity = 0.85;
    }
  });
  window.setTimeout(() => {
    for (const m of mats) {
      m.emissiveIntensity = 0.05;
      m.emissive = new THREE.Color(0x000000);
    }
  }, ms);
}
