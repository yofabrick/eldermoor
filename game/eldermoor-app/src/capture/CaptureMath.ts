import type { CaptureMethod } from '../core/types';

/** Multiplier by capture method. */
export function methodMult(method: CaptureMethod): number {
  switch (method) {
    case 'snare':
      return 1.0;
    case 'bait':
      return 1.05;
    case 'bond':
      return 1.08;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Probability of a successful bind after channel completes.
 * `rng` is an optional variance multiplier (default 1), not the roll itself.
 * Caller should roll: `Math.random() < catchChance(...)`.
 */
export function catchChance(opts: {
  catchBase: number;
  wil: number;
  methodMult: number;
  softenQuality: number;
  toolTier: number;
  pathAffinity: number;
  coopBonus?: number;
  rng?: number;
}): number {
  const {
    catchBase,
    wil,
    methodMult: mm,
    softenQuality,
    toolTier,
    pathAffinity,
    coopBonus,
    rng,
  } = opts;

  const raw =
    catchBase *
    mm *
    softenQuality *
    (1 - (wil / 5) * 0.65) *
    toolTier *
    pathAffinity *
    (1 + (coopBonus ?? 0)) *
    (rng ?? 1);

  return clamp(raw, 0.02, 0.92);
}
