import * as THREE from 'three';

export class CameraShake {
  private trauma = 0;

  add(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Apply offset to camera after normal follow; call each frame */
  apply(camera: THREE.Camera, dt: number) {
    if (this.trauma <= 0.001) {
      this.trauma = 0;
      return;
    }
    const shake = this.trauma * this.trauma;
    camera.position.x += (Math.random() - 0.5) * shake * 0.45;
    camera.position.y += (Math.random() - 0.5) * shake * 0.35;
    camera.position.z += (Math.random() - 0.5) * shake * 0.45;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }
}
