import * as THREE from 'three';

interface Floater {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  age: number;
  life: number;
  rise: number;
  baseY: number;
}

/**
 * World-space floating combat/loot text via canvas-texture sprites.
 * Sprites billboard automatically and float up while fading out.
 */
export class FloatingTextSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private items: Floater[] = [];
  private maxItems = 48;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  spawn(worldPos: THREE.Vector3, text: string, color = '#ffe9a8'): void {
    while (this.items.length >= this.maxItems) {
      this.disposeItem(this.items.shift()!);
    }

    const texture = this.makeTextTexture(text, color);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(worldPos);
    sprite.position.y += 1.2;
    sprite.scale.set(1.6, 0.55, 1);
    sprite.renderOrder = 999;
    this.scene.add(sprite);

    this.items.push({
      sprite,
      material,
      texture,
      age: 0,
      life: 1.15,
      rise: 1.4,
      baseY: sprite.position.y,
    });
  }

  update(dt: number): void {
    const camDist = new THREE.Vector3();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        this.disposeItem(f);
        this.items.splice(i, 1);
        continue;
      }

      // Ease-out rise + fade
      const ease = 1 - (1 - t) * (1 - t);
      f.sprite.position.y = f.baseY + ease * f.rise;
      f.material.opacity = 1 - t * t;

      // Subtle scale by camera distance so text stays readable
      camDist.subVectors(f.sprite.position, this.camera.position);
      const d = Math.max(4, Math.min(40, camDist.length()));
      const s = 0.9 + d * 0.035;
      f.sprite.scale.set(s * 1.35, s * 0.48, 1);
    }
  }

  dispose(): void {
    for (const f of this.items) this.disposeItem(f);
    this.items.length = 0;
  }

  private disposeItem(f: Floater): void {
    this.scene.remove(f.sprite);
    f.material.dispose();
    f.texture.dispose();
  }

  private makeTextTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 42px system-ui, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft dark outline for readability on bright terrain
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
