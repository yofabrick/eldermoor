import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { emptyInventory, INVENTORY_CAPS } from '../core/types';
import type { ResourceNode } from '../core/types';
import { canCarry, isStackFull, tryGather, gatherPrompt } from './Resources';
import { at } from '../core/util';

function mockNode(kind: ResourceNode['kind'], x: number, z: number, remaining = 1): ResourceNode {
  const mesh = new THREE.Group();
  mesh.visible = true;
  mesh.position.set(x, 0, z);
  return {
    id: `n_${kind}_${x}_${z}`,
    kind,
    position: new THREE.Vector3(x, 0, z),
    mesh,
    remaining,
    max: 1,
    respawn: 0,
  };
}

describe('Resources walk-over gather (shipped)', () => {
  it('canCarry respects INVENTORY_CAPS', () => {
    const inv = emptyInventory();
    inv.wood = INVENTORY_CAPS.wood - 1;
    expect(canCarry(inv, 'wood', 1)).toBe(true);
    expect(canCarry(inv, 'wood', 2)).toBe(false);
    inv.wood = INVENTORY_CAPS.wood;
    expect(isStackFull(inv, 'wood')).toBe(true);
  });

  it('tryGather picks up instantly when player walks on pile', () => {
    const inv = emptyInventory();
    const nodes = [mockNode('wood', 0, 0)];
    const player = new THREE.Vector3(0.5, 0, 0.5);
    const r = tryGather(nodes, player, inv, 0.016);
    expect(r.gained).toBeTruthy();
    expect(r.kind).toBe('wood');
    expect(inv.wood).toBe(2); // AMOUNTS.wood
    expect(at(nodes, 0)?.remaining).toBe(0);
    expect(at(nodes, 0)?.mesh.visible).toBe(false);
  });

  it('tryGather blocks when stack is full (no free pickup)', () => {
    const inv = emptyInventory();
    inv.wood = INVENTORY_CAPS.wood;
    const nodes = [mockNode('wood', 0, 0)];
    const player = new THREE.Vector3(0, 0, 0);
    const r = tryGather(nodes, player, inv, 0.016);
    expect(r.gained).toBeNull();
    expect(r.full).toBe(true);
    expect(at(nodes, 0)?.remaining).toBe(1);
    expect(inv.wood).toBe(INVENTORY_CAPS.wood);
  });

  it('tryGather ignores piles outside pickup radius', () => {
    const inv = emptyInventory();
    const nodes = [mockNode('wood', 50, 50)];
    const player = new THREE.Vector3(0, 0, 0);
    const r = tryGather(nodes, player, inv, 0.016);
    expect(r.gained).toBeNull();
    expect(inv.wood).toBe(0);
    expect(at(nodes, 0)?.remaining).toBe(1);
  });

  it('gatherPrompt reports full inventory in German', () => {
    const msg = gatherPrompt(null, false, 0, true, 'wood');
    expect(msg).toMatch(/Inventar voll|Holz|max/i);
  });
});
