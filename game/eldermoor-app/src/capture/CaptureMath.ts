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
 * Caller should roll: `Math.random() < catchChance(...)`.
 *
 * Tuned for readability: soft window open ≈ fair try, not lottery.
 * Will resistance soft (was 0.65 → 0.38); floor when softened ≥ 0.28.
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
  /** First-bind tutorial: never feel hopeless */
  tutorialBoost?: boolean;
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
    tutorialBoost,
  } = opts;

  // Will softens success but never obliterates a green window
  const willFactor = 1 - (wil / 5) * 0.38;
  const raw =
    catchBase *
    mm *
    softenQuality *
    willFactor *
    Math.max(1, toolTier) *
    pathAffinity *
    (1 + (coopBonus ?? 0)) *
    (rng ?? 1);

  // If player earned a soften window, floor so it never feels "always fail"
  const floor = softenQuality >= 1 ? 0.28 : 0.08;
  let p = clamp(raw, floor, 0.92);
  if (tutorialBoost) p = Math.max(p, 0.88);
  return p;
}

/** German short label for a chance (for HUD). */
export function chanceLabelDe(p: number): string {
  const pct = Math.round(p * 100);
  if (pct >= 75) return `${pct}% — gut`;
  if (pct >= 50) return `${pct}% — fair`;
  if (pct >= 35) return `${pct}% — riskant`;
  return `${pct}% — schwer`;
}
