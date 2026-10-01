import type { SpeciesDef } from '../core/types';

/** Slice species for playable proto — mirrors data/beasts.json with render hints */
export const SPECIES = {
  B01: {
    id: 'B01',
    name: 'Glimmerpouch',
    tier: 1,
    stats: { pow: 1, wrk: 2, spd: 3, wil: 1, hp: 40, catchBase: 0.55 },
    workTags: ['scavenge'],
    bestMethods: ['bait', 'snare'],
    failLesson: 'Will Glitzer, keine Schläge.',
    fantasy: 'Pocket shiny thief',
    bark: 'Mine. Probably.',
    color: 0xc9a227,
    scale: 0.72, // hero tutorial read at 8–12m (eyes/pouch survive scale)
    softenKey: 'shiny_bait_no_heavy_hit',
  },
  B02: {
    id: 'B02',
    name: 'Brushback Boar',
    tier: 1,
    stats: { pow: 2, wrk: 3, spd: 2, wil: 2, hp: 90, catchBase: 0.4 },
    workTags: ['lumber_light', 'haul'],
    bestMethods: ['snare'],
    failLesson: 'Nicht in der Sturm-Linie stehen.',
    fantasy: 'First real worker',
    bark: 'Hrrn.',
    color: 0x6b4f3a,
    scale: 1.0,
    softenKey: 'hp_mid_break_tusk_after_charge_whiff',
  },
  B03: {
    id: 'B03',
    name: 'Lantern Hare',
    tier: 1,
    stats: { pow: 1, wrk: 1, spd: 4, wil: 2, hp: 35, catchBase: 0.45 },
    workTags: ['scout', 'herb_sense'],
    bestMethods: ['bond'],
    failLesson: 'Dominanz verscheucht es.',
    fantasy: 'Night scout',
    bark: '*chime*',
    color: 0xe8d48b,
    scale: 0.4,
    softenKey: 'calm_near_light',
  },
  B04: {
    id: 'B04',
    name: 'Cinderscale',
    tier: 1,
    stats: { pow: 2, wrk: 3, spd: 2, wil: 2, hp: 70, catchBase: 0.38 },
    workTags: ['smelt_assist', 'cook'],
    bestMethods: ['bait', 'snare'],
    failLesson: 'Schläge bei Überhitzung machen es wütend.',
    fantasy: 'Forge mascot',
    bark: '*coal clicks*',
    color: 0xe85d5d,
    scale: 0.55,
    softenKey: 'douse_overheat_then_ember_char',
  },
  B05: {
    id: 'B05',
    name: 'Hearthkin',
    tier: 1,
    stats: { pow: 1, wrk: 4, spd: 2, wil: 3, hp: 55, catchBase: 0.35 },
    workTags: ['craft_speed', 'tidy'],
    bestMethods: ['bond'],
    failLesson: 'Nur schlagen reicht nicht — es phast aus.',
    fantasy: 'House-spirit labor',
    bark: 'The hearth remembers.',
    color: 0x6bcb8a,
    scale: 0.6,
    softenKey: 'ethics_fork_shrine',
  },
  B06: {
    id: 'B06',
    name: 'Blackvein Stag',
    tier: 2,
    stats: { pow: 3, wrk: 3, spd: 2, wil: 3, hp: 140, catchBase: 0.28 },
    workTags: ['haul_heavy', 'poison_herb'],
    bestMethods: ['snare', 'bond'],
    failLesson: 'Platte brechen, dann binden.',
    fantasy: 'Mid workhorse',
    bark: '*wet bellow*',
    color: 0x3d5c4a,
    scale: 1.1,
    softenKey: 'break_antler_plate',
  },
  B07: {
    id: 'B07',
    name: 'Bogwhisper',
    tier: 2,
    stats: { pow: 2, wrk: 2, spd: 2, wil: 4, hp: 100, catchBase: 0.25 },
    workTags: ['essence_still'],
    bestMethods: ['bond'],
    failLesson: 'Zuerst den Singsang stillen.',
    fantasy: 'Mortis lean crooner',
    bark: '*wet choir*',
    color: 0xa78bfa,
    scale: 0.7,
    softenKey: 'silence_croon',
  },
  B09: {
    id: 'B09',
    name: 'Ridgespire Juvenile',
    tier: 2,
    stats: { pow: 3, wrk: 1, spd: 4, wil: 4, hp: 130, catchBase: 0.22 },
    workTags: ['mount'],
    bestMethods: ['bond'],
    failLesson: 'Dient nur Würdigen — Stolz-Duell gewinnen.',
    fantasy: 'First true mount',
    bark: '*respect skree*',
    color: 0xc4b8a0,
    scale: 1.15,
    softenKey: 'pride_duel_three_clean_hits',
  },
  B12: {
    id: 'B12',
    name: 'Ashcrown Whelp',
    tier: 3,
    stats: { pow: 4, wrk: 2, spd: 3, wil: 5, hp: 280, catchBase: 0.18 },
    workTags: ['magma_forge'],
    bestMethods: ['snare', 'bond'],
    failLesson: 'Platten der Reihe nach. Wut vermeiden.',
    fantasy: 'Elite dragonlet',
    bark: '*crown crackle*',
    color: 0xff6a00,
    scale: 1.4,
    softenKey: 'break_plates_ordered',
  },
} as const satisfies Record<string, SpeciesDef>;

export type SpeciesId = keyof typeof SPECIES;

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

/**
 * Fallback species for unknown ids (old saves, content typos).
 * B01 Glimmerpouch is the tier-1 tutorial read, so a bad id stays playable.
 */
const FALLBACK_ID: SpeciesId = 'B01';

/** Narrow an arbitrary string to a known species id. */
export function isSpeciesId(id: string): id is SpeciesId {
  return Object.prototype.hasOwnProperty.call(SPECIES, id);
}

/**
 * Resolve a species definition by id, falling back to the tutorial species.
 * Callers get a `SpeciesDef` back, never `undefined` — an unknown id is a
 * content bug, not a reason to crash mid-frame.
 */
export function speciesDef(id: string): SpeciesDef {
  if (isSpeciesId(id)) return SPECIES[id];
  return SPECIES[FALLBACK_ID];
}

export const STARTER_SPAWNS: SpeciesId[] = [
  'B01',
  'B02',
  'B03',
  'B04',
  'B05',
  'B02',
  'B01',
  'B06',
  'B07',
];
