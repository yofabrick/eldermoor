import * as THREE from 'three';

const FLASH_LIFE = 0.12;
const LIGHT_INTENSITY = 4.5;
const SPHERE_SCALE = 0.12;

/**
 * Wand tip muzzle flash: point light pulse + small emissive sphere.
 * Attach to the wand tip Object3D; call fire() on cast.
 */
export class WandMuzzle {
  private root = new THREE.Group();
  private light: THREE.PointLight;
  private sphere: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private age = 0;
  private active = false;
  private attached = false;

  constructor() {
    this.light = new THREE.PointLight(0xffffff, 0, 2.5, 2);
    this.light.castShadow = false;

    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      this.mat,
    );
    this.sphere.scale.setScalar(SPHERE_SCALE);
    this.sphere.visible = false;

    this.root.add(this.light);
    this.root.add(this.sphere);
    this.root.visible = false;
  }

  /** Parent light + flash mesh under the wand tip. */
  attach(parent: THREE.Object3D): void {
    if (this.attached) {
      this.root.parent?.remove(this.root);
    }
    parent.add(this.root);
    this.root.position.set(0, 0, 0);
    this.attached = true;
  }

  /** Trigger a colored tip flash (point light + emissive sphere). */
  fire(color: number): void {
    this.age = 0;
    this.active = true;
    this.root.visible = true;
    this.sphere.visible = true;

    this.light.color.setHex(color);
    this.light.intensity = LIGHT_INTENSITY;
    this.mat.color.setHex(color);
    this.mat.opacity = 1;
    this.sphere.scale.setScalar(SPHERE_SCALE);
  }

  update(dt: number): void {
    if (!this.active) return;

    this.age += dt;
    const t = this.age / FLASH_LIFE;

    if (t >= 1) {
      this.active = false;
      this.root.visible = false;
      this.sphere.visible = false;
      this.light.intensity = 0;
      this.mat.opacity = 0;
      return;
    }

    // Sharp attack, quick falloff
    const fall = 1 - t * t;
    this.light.intensity = LIGHT_INTENSITY * fall;
    this.mat.opacity = fall;
    // Expand slightly as it dies
    this.sphere.scale.setScalar(SPHERE_SCALE * (1 + t * 1.4));
  }
}
