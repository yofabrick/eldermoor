import type * as THREE from 'three';

export type PathFlag = 'none' | 'vita' | 'mortis';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Inventory {
  wood: number;
  stone: number;
  herb: number;
  ore: number;
  essence: number;
  chalk_snare: number;
  shiny_tin_bait: number;
  berry_bait: number;
  fodder: number;
  ingot: number;
}

/** Soft caps for walk-over gather (tools/bait stay unlimited for now). */
export const INVENTORY_CAPS: Record<
  'wood' | 'stone' | 'herb' | 'ore' | 'essence' | 'ingot' | 'fodder',
  number
> = {
  wood: 80,
  stone: 80,
  herb: 40,
  ore: 40,
  essence: 40,
  ingot: 30,
  fodder: 40,
};

export interface OwnedBeast {
  uid: string;
  speciesId: string;
  name: string;
  hp: number;
  maxHp: number;
  mood: number;
  job: JobId | null;
  fieldSlot: boolean;
  bondLevel?: number;
  bondXp?: number;
}

export type JobId = 'lumber' | 'haul' | 'smelt' | 'scout' | 'idle' | 'guard';

export type CaptureMethod = 'snare' | 'bait' | 'bond';

export type BeastAiState =
  'wander' | 'aggro' | 'attack' | 'flee' | 'soften' | 'opportunity' | 'captured';

export interface WildBeast {
  id: string;
  speciesId: string;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  hp: number;
  maxHp: number;
  state: BeastAiState;
  target: THREE.Vector3 | null;
  aggroTimer: number;
  attackCooldown: number;
  lastChargeWhiff: number;
  partBroken: boolean;
  heavyDamageRecent: number;
  calmed: boolean;
  overheated: boolean;
  opportunityTimer: number;
  name: string;
}

export interface ResourceNode {
  id: string;
  kind: 'wood' | 'stone' | 'herb' | 'ore';
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  remaining: number;
  max: number;
  respawn: number;
}

export interface Station {
  id: string;
  kind: 'pen' | 'lumber' | 'storage' | 'bed' | 'workbench' | 'smelter' | 'tower';
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  progress: number;
  assignedBeastUid: string | null;
}

export interface GameSave {
  version: number;
  player: { x: number; z: number; hp: number; mana: number; strain: number };
  inventory: Inventory;
  owned: OwnedBeast[];
  heat: number;
  path: PathFlag;
  stationsBuilt: { kind: Station['kind']; x: number; z: number }[];
  timeOfDay: number;
  watcherSeen: boolean;
  tutorialStep: number;
  wandTier?: number;
  milestonesDone?: string[];
  maelDefeated?: boolean;
}

export interface SpeciesDef {
  id: string;
  name: string;
  tier: number;
  stats: { pow: number; wrk: number; spd: number; wil: number; hp: number; catchBase: number };
  workTags: string[];
  bestMethods: string[];
  failLesson: string;
  fantasy: string;
  bark: string;
  color: number;
  scale: number;
  softenKey: string;
}

export const emptyInventory = (): Inventory => ({
  wood: 0,
  stone: 0,
  herb: 0,
  ore: 0,
  essence: 0,
  chalk_snare: 2,
  shiny_tin_bait: 1,
  berry_bait: 2,
  fodder: 5,
  ingot: 0,
});
