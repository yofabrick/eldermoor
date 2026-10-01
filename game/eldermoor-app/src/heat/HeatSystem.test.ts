import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HeatSystem, HEAT_STAGES } from './HeatSystem';
import { WorldEvents } from './Events';

describe('HeatSystem thresholds (shipped)', () => {
  it('stageName tracks Gerüchte → Beobachter at 25', () => {
    const h = new HeatSystem(0);
    expect(h.stageName()).toBe('Gerüchte');
    h.add(24, 'test');
    expect(h.stageName()).toBe('Gerüchte');
    const toast = h.add(1, 'cross');
    expect(h.heat).toBe(25);
    expect(h.stageName()).toBe('Beobachter');
    expect(toast).toMatch(/Beobachter/i);
  });

  it('onFirstBind / onFirstBase / onFirstWorker raise heat for demo ramp', () => {
    const h = new HeatSystem(0);
    h.onFirstBind();
    expect(h.heat).toBe(5);
    h.onFirstBase();
    expect(h.heat).toBe(11);
    h.onFirstWorker();
    expect(h.heat).toBe(16);
    // pamphlet threshold is 8 — demo path crosses it after bind+base
    expect(h.heat).toBeGreaterThanOrEqual(8);
  });

  it('HEAT_STAGES include War at 100', () => {
    const war = HEAT_STAGES.find((s) => s.threshold === 100);
    expect(war?.name).toBe('Krieg');
    const h = new HeatSystem(99);
    const t = h.add(1, 'war');
    expect(h.stageName()).toBe('Krieg');
    expect(t).toMatch(/Krieg/i);
  });
});

describe('WorldEvents pamphlet + Watcher (shipped Demo Law #3)', () => {
  it('spawns pamphlet once at heat >= 8', () => {
    const ev = new WorldEvents(false);
    const pos = new THREE.Vector3(0, 0, 0);
    const r0 = ev.update(0.016, 7, pos, null, false, false);
    expect(r0.spawnPamphlet).toBeUndefined();
    const r1 = ev.update(0.016, 8, pos, null, false, false);
    expect(r1.spawnPamphlet).toBe(true);
    expect(r1.toast).toMatch(/Flugblatt|Unlisted/i);
    // only once
    const r2 = ev.update(0.016, 20, pos, null, false, false);
    expect(r2.spawnPamphlet).toBeUndefined();
  });

  it('spawns Watcher once at heat >= 25', () => {
    const ev = new WorldEvents(false);
    const pos = new THREE.Vector3(10, 0, 10);
    // heat 8 first consumes pamphlet
    ev.update(0.016, 8, pos, null, false, false);
    const r = ev.update(0.016, 25, pos, null, false, false);
    const watcher = r.spawnWatcher;
    expect(watcher).toBeInstanceOf(THREE.Vector3);
    if (!(watcher instanceof THREE.Vector3)) {
      throw new Error('expected watcher spawn');
    }
    expect(watcher.distanceTo(pos)).toBeGreaterThan(15);
    expect(r.toast).toMatch(/Beobachter|Silhouette/i);
    // no second watcher
    const r2 = ev.update(0.016, 50, pos, null, false, false);
    expect(r2.spawnWatcher).toBeUndefined();
  });

  it('watcherSeen from save prevents re-spawn', () => {
    const ev = new WorldEvents(true);
    const pos = new THREE.Vector3(0, 0, 0);
    const r = ev.update(0.016, 30, pos, null, false, true);
    expect(r.spawnWatcher).toBeUndefined();
  });
});
