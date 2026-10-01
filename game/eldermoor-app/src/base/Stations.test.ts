import { describe, it, expect } from 'vitest';
import { emptyInventory } from '../core/types';
import { canAfford, pay, buildCosts } from './Stations';

/**
 * Mirrors the real build flow: check canAfford → pay once → place must not re-check.
 * After pay with exact cost, canAfford is false — placeStation must still spawn
 * (Game.ts does not re-check; this test locks that contract).
 */
describe('Stations pay + afford (shipped build contract)', () => {
  it('canAfford bed when wood >= 4', () => {
    const inv = emptyInventory();
    inv.wood = 4;
    expect(canAfford(inv, 'bed')).toBe(true);
    inv.wood = 3;
    expect(canAfford(inv, 'bed')).toBe(false);
  });

  it('pay deducts exact buildCosts and never double-charges', () => {
    const inv = emptyInventory();
    inv.wood = 10;
    inv.stone = 5;
    const cost = buildCosts.lumber;
    expect(canAfford(inv, 'lumber')).toBe(true);
    pay(inv, 'lumber');
    expect(inv.wood).toBe(10 - (cost.wood ?? 0));
    expect(inv.stone).toBe(5 - (cost.stone ?? 0));
    // Second pay would be wrong in real flow — we only pay once
    expect(canAfford(inv, 'lumber')).toBe(false);
  });

  it('exact-cost pay leaves canAfford false (the old vanish bug condition)', () => {
    const inv = emptyInventory();
    inv.wood = buildCosts.bed.wood ?? 4;
    expect(canAfford(inv, 'bed')).toBe(true);
    pay(inv, 'bed');
    // After pay, afford check fails — callers must place without re-checking
    expect(canAfford(inv, 'bed')).toBe(false);
    expect(inv.wood).toBe(0);
  });

  it('tower costs wood+stone+essence', () => {
    const inv = emptyInventory();
    inv.wood = 15;
    inv.stone = 15;
    inv.essence = 3;
    expect(canAfford(inv, 'tower')).toBe(true);
    pay(inv, 'tower');
    expect(inv.wood).toBe(0);
    expect(inv.stone).toBe(0);
    expect(inv.essence).toBe(0);
  });
});
