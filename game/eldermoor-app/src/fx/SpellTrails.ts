import * as THREE from 'three';

/** Simple particle puffs for spell casts and ambient magic. */
export class SpellTrails {
  private scene: THREE.Scene;
  private particles: { mesh: THREE.Mesh; life: number; vel: THREE.Vector3 }[] = [];
  private geo = new THREE.SphereGeometry(0.08, 5, 5);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(origin: THREE.Vector3, color: number, count = 10, speed = 3) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.copy(origin);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8,
        (Math.random() - 0.5) * speed,
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, life: 0.35 + Math.random() * 0.25, vel });
    }
  }

  trail(from: THREE.Vector3, color: number) {
    this.burst(from, color, 3, 1.2);
  }

  update(dt: number) {
    const keep: typeof this.particles = [];
    for (const p of this.particles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 2 * dt;
      if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
        p.mesh.material.opacity = Math.max(0, p.life * 2);
      }
      if (p.life > 0) keep.push(p);
      else {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
      }
    }
    this.particles = keep;
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}
