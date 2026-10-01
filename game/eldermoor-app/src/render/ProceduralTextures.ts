import * as THREE from 'three';

/** Canvas-forged seamless-ish textures (Claude-of-Duty spirit: no image files). */

function noise2(x: number, y: number, seed: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/** Value-noise blend for smoother seamless-ish fields. */
function fbm2(x: number, y: number, seed: number): number {
  return (
    noise2(x, y, seed) * 0.5 +
    noise2(x * 2.1, y * 2.1, seed + 1) * 0.3 +
    noise2(x * 4.3, y * 4.3, seed + 2) * 0.2
  );
}

function finishTex(c: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Bounds-checked pixel accessor for a canvas ImageData buffer.
 * Canvas data is always allocated as size*size*4 RGBA, so an in-range
 * index is guaranteed to exist — but the type system cannot know that.
 */
function px(data: Uint8ClampedArray, index: number): number {
  const v = data[index];
  return v === undefined ? 0 : v;
}

/** Read-modify-write helper: add `delta` to a channel, clamped to 0..255. */
function bump(data: Uint8ClampedArray, index: number, delta: number): void {
  data[index] = Math.min(255, Math.max(0, px(data, index) + delta));
}

/** Read-modify-write helper: scale a channel, clamped to 0..255. */
function scaleCh(data: Uint8ClampedArray, index: number, factor: number): void {
  data[index] = Math.min(255, Math.max(0, px(data, index) * factor));
}

export function makeGrassTexture(size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        noise2(x * 0.08, y * 0.08, 1) * 0.5 +
        noise2(x * 0.2, y * 0.2, 2) * 0.3 +
        noise2(x * 0.5, y * 0.5, 3) * 0.2;
      const g = 55 + n * 70;
      const r = 35 + n * 40;
      const b = 28 + n * 25;
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      // blade flecks
      if (noise2(x, y, 9) > 0.92) {
        img.data[i] = 70;
        img.data[i + 1] = 120 + noise2(x, y, 4) * 40;
        img.data[i + 2] = 40;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 40, 40);
}

/** Vertical bark ridges + dark cracks, seamless-ish. */
export function makeBarkTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Vertical grain (wrap-friendly via periodic x)
      const wx = (x / size) * Math.PI * 2;
      const ridge = Math.sin(wx * 4 + noise2(x * 0.3, y * 0.05, 7) * 2.5) * 0.5 + 0.5;
      const grain = fbm2(x * 0.18, y * 0.55, 8);
      const crack = noise2(x * 0.9, y * 0.08, 12) > 0.88 ? 0.35 : 0;
      const v = ridge * 0.45 + grain * 0.45 - crack;
      const r = 48 + v * 55;
      const g = 32 + v * 35;
      const b = 18 + v * 22;
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, r));
      img.data[i + 1] = Math.max(0, Math.min(255, g));
      img.data[i + 2] = Math.max(0, Math.min(255, b));
      img.data[i + 3] = 255;
      // Sparse lighter knot flecks
      if (noise2(x * 0.4, y * 0.4, 15) > 0.97) {
        bump(img.data, i, 30);
        bump(img.data, i + 1, 18);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 2, 3);
}

/** Dense foliage blotches — deterministic (no Math.random). */
export function makeLeafTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x * 0.12, y * 0.12, 20);
      const vein = Math.abs(Math.sin(x * 0.35 + y * 0.08 + n * 2));
      const g = 70 + n * 90 + vein * 15;
      const r = 30 + n * 45;
      const b = 22 + n * 30;
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      // Leaf-cluster bright spots
      if (noise2(x * 0.25, y * 0.25, 22) > 0.78) {
        img.data[i] = 45 + n * 30;
        img.data[i + 1] = 110 + n * 60;
        img.data[i + 2] = 35 + n * 25;
      }
      // Dark gaps between leaves
      if (noise2(x * 0.35, y * 0.35, 24) > 0.9) {
        scaleCh(img.data, i, 0.45);
        scaleCh(img.data, i + 1, 0.5);
        scaleCh(img.data, i + 2, 0.45);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 2, 2);
}

/** Speckled granite / cobble stone. */
export function makeStoneTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x * 0.1, y * 0.1, 30);
      const speck = noise2(x * 0.8, y * 0.8, 31);
      const base = 95 + n * 45;
      const cool = speck > 0.55 ? 8 : -5;
      const i = (y * size + x) * 4;
      img.data[i] = base + cool * 0.4;
      img.data[i + 1] = base + cool * 0.2;
      img.data[i + 2] = base + 6 + cool;
      img.data[i + 3] = 255;
      // Dark mineral veins
      const vein = Math.abs(Math.sin(x * 0.2 + y * 0.35 + n * 4));
      if (vein < 0.12) {
        scaleCh(img.data, i, 0.55);
        scaleCh(img.data, i + 1, 0.55);
        scaleCh(img.data, i + 2, 0.6);
      }
      // Light lichen flecks
      if (noise2(x, y, 33) > 0.94) {
        img.data[i] = 140;
        img.data[i + 1] = 145;
        img.data[i + 2] = 130;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 2, 2);
}

/** Soft green moss patches over a darker base. */
export function makeMossTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x * 0.14, y * 0.14, 40);
      const clump = fbm2(x * 0.06, y * 0.06, 41);
      const isMoss = clump > 0.42;
      const i = (y * size + x) * 4;
      if (isMoss) {
        img.data[i] = 35 + n * 40;
        img.data[i + 1] = 70 + n * 80;
        img.data[i + 2] = 28 + n * 30;
      } else {
        // damp earth under moss
        img.data[i] = 45 + n * 25;
        img.data[i + 1] = 42 + n * 22;
        img.data[i + 2] = 30 + n * 15;
      }
      img.data[i + 3] = 255;
      // Tiny bright tips on moss
      if (isMoss && noise2(x * 0.5, y * 0.5, 42) > 0.93) {
        img.data[i] = 60;
        img.data[i + 1] = 140;
        img.data[i + 2] = 50;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 3, 3);
}

export function makeDirtPathTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise2(x * 0.12, y * 0.12, 11);
      const i = (y * size + x) * 4;
      img.data[i] = 90 + n * 40;
      img.data[i + 1] = 70 + n * 30;
      img.data[i + 2] = 45 + n * 20;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(c, 8, 80);
}
