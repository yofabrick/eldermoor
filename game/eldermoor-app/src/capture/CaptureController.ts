import type { CaptureMethod, Inventory, WildBeast } from '../core/types';
import { speciesDef } from '../data/species';
import { catchChance, methodMult } from './CaptureMath';

/** Capture state machine phases. */
export type CaptureState = 'idle' | 'window' | 'channeling' | 'resolve';

/** Events emitted from `update`. */
export type CaptureEventKind = 'none' | 'success' | 'fail' | 'window_closed';

export type FailKind = 'rng' | 'distance' | 'release' | 'other';

export interface CaptureUpdateResult {
  event: CaptureEventKind;
  /** Catch probability used for the roll (success/fail only). */
  catchProb?: number;
  /** Species fail lesson on a failed catch. */
  failLesson?: string;
  /** Clear player-facing reason for fail */
  failKind?: FailKind;
  target?: WildBeast | null;
  method?: CaptureMethod;
}

export interface BeginChannelResult {
  ok: boolean;
  msg: string;
}

/** Channel fill time in seconds before the catch roll. */
export const CHANNEL_DURATION = 1.6;

/** Soften window duration range (seconds). */
export const WINDOW_MIN = 4;
export const WINDOW_MAX = 6;

/** Cancel channel if player is farther than this from the target (meters). */
export const CHANNEL_MAX_DISTANCE = 12;

/** Minimal position used for distance cancel (avoids THREE dependency). */
export type CapturePos = { x: number; y?: number; z: number };

/**
 * Opportunity-window + channel capture flow.
 *
 * ## Item consumption
 * On successful `beginChannel`, this class mutates `inv`:
 * - **snare** — `chalk_snare -= 1`
 * - **bait** — prefers `shiny_tin_bait`, else `berry_bait` (`-= 1`)
 * - **bond** — free (mana cost later)
 *
 * Caller may also consume; do not deduct twice.
 */
export class CaptureController {
  state: CaptureState = 'idle';
  target: WildBeast | null = null;
  method: CaptureMethod = 'snare';
  /** 0–1 fill while channeling. */
  channelProgress = 0;
  /** Seconds remaining in the soften opportunity window. */
  windowTime = 0;

  /** Soften quality stored when the window opens (feeds catchChance). */
  softenQuality = 1;
  /** External multipliers — caller may set before channel resolve. */
  toolTier = 1;
  pathAffinity = 1;
  coopBonus = 0;

  /** When channeling, only advance progress if true (hold F). */
  holdingChannel = false;
  /** Seconds released during channel before cancel */
  private releaseTimer = 0;
  /** First bind of the session should feel fair (tutorial). */
  tutorialBoost = false;

  /**
   * Open a capture opportunity if soften conditions passed.
   * Window lasts 4–6s. `quality` is stored as softenQuality for the catch formula.
   */
  tryOpenWindow(beast: WildBeast, softenOk: boolean, quality: number): void {
    if (!softenOk) return;
    if (this.state === 'channeling' || this.state === 'resolve') return;

    this.target = beast;
    this.softenQuality = quality;
    this.windowTime = WINDOW_MIN + Math.random() * (WINDOW_MAX - WINDOW_MIN);
    this.channelProgress = 0;
    this.state = 'window';
    this.holdingChannel = false;
    this.releaseTimer = 0;
  }

  /**
   * Live odds for UI — same formula as the roll at channel end.
   * Pass method if known; otherwise uses bond as free baseline.
   */
  estimateChance(beast: WildBeast | null, method: CaptureMethod = 'bond'): number {
    if (!beast) return 0;
    const species = speciesDef(beast.speciesId);
    return catchChance({
      catchBase: species.stats.catchBase,
      wil: species.stats.wil,
      methodMult: methodMult(method),
      softenQuality: this.state === 'idle' ? 1.1 : this.softenQuality,
      toolTier: this.toolTier,
      pathAffinity: this.pathAffinity,
      coopBonus: this.coopBonus,
      tutorialBoost: this.tutorialBoost && beast.speciesId === 'B01',
    });
  }

  /**
   * Start channeling a capture method while the window is open.
   * Consumes snare/bait from `inv` on success (see class docs).
   */
  beginChannel(method: CaptureMethod, inv: Inventory): BeginChannelResult {
    if (this.state !== 'window' || !this.target) {
      return { ok: false, msg: 'Kein Binde-Fenster offen — Ziel ansehen, bis grün.' };
    }

    if (method === 'snare') {
      if (inv.chalk_snare <= 0) {
        return { ok: false, msg: 'Kreide-Falle fehlt (Q / Inventar).' };
      }
      inv.chalk_snare -= 1;
    } else if (method === 'bait') {
      if (inv.shiny_tin_bait > 0) {
        inv.shiny_tin_bait -= 1;
      } else if (inv.berry_bait > 0) {
        inv.berry_bait -= 1;
      } else {
        return { ok: false, msg: 'Köder fehlt (Glitzerzinn oder Beeren).' };
      }
    }
    // bond: free for now (mana cost later)

    this.method = method;
    this.channelProgress = 0;
    this.state = 'channeling';
    return { ok: true, msg: `Kanal: ${method}… F halten` };
  }

  /**
   * Advance timers. Returns a discrete event when something resolves.
   * Call once per frame with delta time in seconds.
   * Optional `playerPos`: if provided while channeling and player is farther
   * than CHANNEL_MAX_DISTANCE from the target, cancels with a fail event.
   */
  update(dt: number, playerPos?: CapturePos): CaptureUpdateResult {
    if (this.state === 'idle') {
      return { event: 'none' };
    }

    if (this.state === 'resolve') {
      // Event already delivered on the frame channel completed; this frame is cleanup.
      this.clear(true);
      return { event: 'none' };
    }

    if (this.state === 'window') {
      this.windowTime -= dt;
      if (this.windowTime <= 0) {
        const target = this.target;
        this.clear(true);
        return { event: 'window_closed', target };
      }
      return { event: 'none', target: this.target };
    }

    // Remaining state is 'channeling' — idle and resolve returned above.
    {
      if (playerPos && this.target) {
        const tp = this.target.mesh.position;
        const dx = playerPos.x - tp.x;
        const dz = playerPos.z - tp.z;
        const dist = Math.hypot(dx, dz);
        if (dist > CHANNEL_MAX_DISTANCE) {
          const target = this.target;
          const method = this.method;
          this.clear(true);
          return {
            event: 'fail',
            failKind: 'distance',
            failLesson: 'Zu weit — näher ran und F halten bis 100%.',
            target,
            method,
          };
        }
      }
      // Hold F to advance (abduction channel)
      if (!this.holdingChannel) {
        this.releaseTimer += dt;
        if (this.releaseTimer > 0.85) {
          const target = this.target;
          const method = this.method;
          this.clear(true);
          return {
            event: 'fail',
            failKind: 'release',
            failLesson: 'F zu früh losgelassen — Taste halten bis der Balken voll ist.',
            target,
            method,
          };
        }
        return { event: 'none', target: this.target, method: this.method };
      }
      this.releaseTimer = 0;
      this.channelProgress = Math.min(1, this.channelProgress + dt / CHANNEL_DURATION);
      if (this.channelProgress < 1) {
        return { event: 'none', target: this.target, method: this.method };
      }
      return this.finishChannel();
    }

    return { event: 'none' };
  }

  /** Abort window/channel and return to idle without a catch roll. */
  cancel(): void {
    this.clear(true);
  }

  get isActive(): boolean {
    return this.state !== 'idle';
  }

  private finishChannel(): CaptureUpdateResult {
    const target = this.target;
    const method = this.method;
    if (!target) {
      return { event: 'window_closed' };
    }
    const species = speciesDef(target.speciesId);

    const catchBase = species.stats.catchBase;
    const wil = species.stats.wil;
    const tip = species.failLesson;

    const catchProb = catchChance({
      catchBase,
      wil,
      methodMult: methodMult(method),
      softenQuality: this.softenQuality,
      toolTier: this.toolTier,
      pathAffinity: this.pathAffinity,
      coopBonus: this.coopBonus,
      tutorialBoost: this.tutorialBoost && target.speciesId === 'B01',
    });

    const success = Math.random() < catchProb;

    this.state = 'resolve';
    this.channelProgress = 1;

    if (success) {
      return { event: 'success', catchProb, target, method };
    }
    // RNG fail — player did everything right; say so + chance + tip
    const pct = Math.round(catchProb * 100);
    const failLesson = `Pech! Chance war ${pct}% — du hast richtig gespielt. Nochmal wenn grün. (${tip})`;
    return { event: 'fail', catchProb, failLesson, failKind: 'rng', target, method };
  }

  private clear(clearTarget: boolean): void {
    this.state = 'idle';
    this.channelProgress = 0;
    this.windowTime = 0;
    if (clearTarget) this.target = null;
  }
}
