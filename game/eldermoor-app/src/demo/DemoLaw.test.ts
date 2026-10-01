/**
 * Opening-slice DEMO LAW path — imports shipped modules only.
 * Simulates gather → bind channel → pay/build → heat foreshadow
 * without hardcoding game outcomes.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { emptyInventory, INVENTORY_CAPS } from '../core/types';
import type { ResourceNode, WildBeast } from '../core/types';
import { canCarry, tryGather } from '../world/Resources';
import { canAfford, pay, buildCosts } from '../base/Stations';
import { catchChance, methodMult } from '../capture/CaptureMath';
import { CaptureController, CHANNEL_DURATION } from '../capture/CaptureController';
import { HeatSystem } from '../heat/HeatSystem';
import { WorldEvents } from '../heat/Events';

function woodNode(x = 0, z = 0): ResourceNode {
  const mesh = new THREE.Group();
  mesh.visible = true;
  mesh.position.set(x, 0, z);
  return {
    id: `wood_${x}_${z}`,
    kind: 'wood',
    position: new THREE.Vector3(x, 0, z),
    mesh,
    remaining: 1,
    max: 1,
    respawn: 0,
  };
}

function beast(speciesId = 'B01'): WildBeast {
  const mesh = new THREE.Group();
  mesh.position.set(2, 0.5, 0);
  return {
    id: 'demo-b01',
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

describe('DEMO LAW opening slice (shipped path)', () => {
  it('Law 1+2+3: walk-over wood → F-channel bind → pay lumber once → heat pamphlet', () => {
    const inv = emptyInventory();
    inv.shiny_tin_bait = 3;
    inv.chalk_snare = 4;

    // --- Gather (walk-over) until bed-affordable ---
    const nodes: ResourceNode[] = [];
    for (let i = 0; i < 6; i++) {
      nodes.push(woodNode(i * 0.1, 0)); // overlapping piles for sequential pickup
    }
    // respawn depleted between picks via remaining reset simulation:
    // tryGather takes one node per call — place fresh piles each step
    let piles = 0;
    while (inv.wood < 8 && piles < 20) {
      const n = [woodNode(0, 0)];
      const r = tryGather(n, new THREE.Vector3(0, 0, 0), inv, 0.016);
      expect(r.gained).toBeTruthy();
      piles++;
    }
    expect(inv.wood).toBeGreaterThanOrEqual(8);
    expect(canCarry(inv, 'wood', 0)).toBe(true);
    expect(inv.wood).toBeLessThanOrEqual(INVENTORY_CAPS.wood);

    // --- Bind: soften window → hold F channel ---
    const cap = new CaptureController();
    const b = beast('B01');
    cap.tryOpenWindow(b, true, 1.1);
    expect(cap.state).toBe('window');
    const open = cap.beginChannel('bond', inv);
    expect(open.ok).toBe(true);
    cap.holdingChannel = true;
    const rnd = Math.random;
    Math.random = () => 0; // success if catchProb > 0
    try {
      let ev = cap.update(CHANNEL_DURATION * 0.4, { x: 0, z: 0 });
      expect(ev.event).toBe('none');
      expect(cap.channelProgress).toBeGreaterThan(0);
      ev = cap.update(CHANNEL_DURATION, { x: 0, z: 0 });
      expect(ev.event).toBe('success');
    } finally {
      Math.random = rnd;
    }
    // Soften math still meaningful
    const p = catchChance({
      catchBase: 0.55,
      wil: 1,
      methodMult: methodMult('bond'),
      softenQuality: 1.1,
      toolTier: 1,
      pathAffinity: 1,
    });
    expect(p).toBeGreaterThan(0.3);

    // --- Build: lumber pay-once (no re-afford after pay) ---
    inv.stone = 2;
    expect(canAfford(inv, 'lumber')).toBe(true);
    const woodBefore = inv.wood;
    pay(inv, 'lumber');
    expect(inv.wood).toBe(woodBefore - (buildCosts.lumber.wood ?? 0));
    expect(inv.stone).toBe(0);
    // After exact/near-exact pay, re-check may fail — placement must still happen (Game contract)
    // We assert pay already applied once only:
    const woodAfterPay = inv.wood;
    // second accidental pay would double-charge — Game never does this
    expect(woodAfterPay).toBe(woodBefore - 8);

    // --- Heat foreshadow ramp (first bind + first base → pamphlet) ---
    const heat = new HeatSystem(0);
    heat.onFirstBind();
    heat.onFirstBase();
    expect(heat.heat).toBeGreaterThanOrEqual(8);
    const events = new WorldEvents(false);
    const pos = new THREE.Vector3(0, 0, 0);
    const foreshadow = events.update(0.016, heat.heat, pos, null, false, false);
    expect(foreshadow.spawnPamphlet).toBe(true);
    expect(foreshadow.toast).toMatch(/Flugblatt|Unlisted|Zuschauer/i);

    // push to Watcher stage
    heat.onFirstWorker();
    heat.onTowerBuilt();
    heat.add(5, 'extra');
    if (heat.heat < 25) heat.add(25 - heat.heat, 'force_watcher');
    const watcher = events.update(0.016, heat.heat, pos, null, false, false);
    expect(watcher.spawnWatcher).toBeTruthy();
    expect(watcher.toast).toMatch(/Beobachter|Silhouette/i);
  });
});
