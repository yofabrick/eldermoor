import { describe, it, expect } from 'vitest';
import { catchChance, methodMult } from './CaptureMath';
import { CaptureController, CHANNEL_DURATION } from './CaptureController';
import type { WildBeast } from '../core/types';
import { emptyInventory } from '../core/types';
import * as THREE from 'three';

function mockBeast(speciesId = 'B01'): WildBeast {
  const mesh = new THREE.Group();
  mesh.position.set(0, 0.5, 0);
  return {
    id: 'test-beast',
    speciesId,
    position: mesh.position.clone(),
    mesh,
    hp: 40,
    maxHp: 40,
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
    name: 'Glimmerpouch',
  };
}

describe('CaptureMath (shipped)', () => {
  it('methodMult ranks bond > bait > snare', () => {
    expect(methodMult('bond')).toBeGreaterThan(methodMult('bait'));
    expect(methodMult('bait')).toBeGreaterThan(methodMult('snare'));
  });

  it('catchChance clamps with fair floor when softened', () => {
    const low = catchChance({
      catchBase: 0.01,
      wil: 5,
      methodMult: 0.5,
      softenQuality: 0.1,
      toolTier: 0.5,
      pathAffinity: 0.5,
    });
    const softened = catchChance({
      catchBase: 0.2,
      wil: 4,
      methodMult: 1,
      softenQuality: 1.1,
      toolTier: 1,
      pathAffinity: 1,
    });
    const high = catchChance({
      catchBase: 1,
      wil: 0,
      methodMult: 2,
      softenQuality: 2,
      toolTier: 2,
      pathAffinity: 2,
      coopBonus: 1,
    });
    expect(low).toBeGreaterThanOrEqual(0.08);
    expect(softened).toBeGreaterThanOrEqual(0.28); // soften floor
    expect(high).toBeLessThanOrEqual(0.92);
  });

  it('estimateChance matches finish formula shape', () => {
    const c = new CaptureController();
    const b = mockBeast('B01');
    c.tryOpenWindow(b, true, 1.1);
    c.toolTier = 1;
    c.pathAffinity = 1;
    const p = c.estimateChance(b, 'bond');
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThanOrEqual(0.92);
  });

  it('higher softenQuality increases catch chance', () => {
    const base = {
      catchBase: 0.5,
      wil: 2,
      methodMult: 1,
      toolTier: 1,
      pathAffinity: 1,
    };
    const weak = catchChance({ ...base, softenQuality: 0.5 });
    const strong = catchChance({ ...base, softenQuality: 1.1 });
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('CaptureController channel (shipped soften → F hold)', () => {
  it('opens window only when softenOk', () => {
    const c = new CaptureController();
    const b = mockBeast();
    c.tryOpenWindow(b, false, 1);
    expect(c.state).toBe('idle');
    c.tryOpenWindow(b, true, 1.1);
    expect(c.state).toBe('window');
    expect(c.target?.id).toBe(b.id);
  });

  it('beginChannel bond starts channeling without items', () => {
    const c = new CaptureController();
    const b = mockBeast();
    const inv = emptyInventory();
    c.tryOpenWindow(b, true, 1);
    const r = c.beginChannel('bond', inv);
    expect(r.ok).toBe(true);
    expect(c.state).toBe('channeling');
    expect(c.channelProgress).toBe(0);
  });

  it('channel completes only while holdingChannel over CHANNEL_DURATION', () => {
    const c = new CaptureController();
    const b = mockBeast();
    // Force success roll for deterministic finish
    const realRandom = Math.random;
    Math.random = () => 0; // always succeed (prob > 0)
    try {
      c.tryOpenWindow(b, true, 1.1);
      c.beginChannel('bond', emptyInventory());
      c.holdingChannel = true;
      // half duration — still channeling
      let ev = c.update(CHANNEL_DURATION * 0.5, { x: 0, z: 0 });
      expect(ev.event).toBe('none');
      expect(c.state).toBe('channeling');
      expect(c.channelProgress).toBeGreaterThan(0.4);
      // finish
      ev = c.update(CHANNEL_DURATION, { x: 0, z: 0 });
      expect(ev.event).toBe('success');
    } finally {
      Math.random = realRandom;
    }
  });

  it('releasing F too long fails channel with DE lesson', () => {
    const c = new CaptureController();
    const b = mockBeast();
    c.tryOpenWindow(b, true, 1);
    c.beginChannel('bond', emptyInventory());
    c.holdingChannel = false;
    const ev = c.update(1.0, { x: 0, z: 0 });
    expect(ev.event).toBe('fail');
    expect(ev.failLesson).toMatch(/F zu früh|halten|100%/i);
    expect(ev.failKind).toBe('release');
  });
});
