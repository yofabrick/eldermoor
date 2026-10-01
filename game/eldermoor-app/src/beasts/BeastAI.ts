import type * as THREE_NS from 'three';
import type { Inventory, WildBeast } from '../core/types';
import { speciesDef } from '../data/species';

const AGGRO_BASE = 10;
const LEASH = 14;
const WANDER_SPEED = 1.6;
const ATTACK_SPEED = 3.2;
const FLEE_SPEED = 3.8;
const LUNGE_RANGE = 2.2;
const LUNGE_COOLDOWN = 1.35;
const CHARGE_WHIFF_WINDOW_MS = 4000;
const HEAVY_DAMAGE_WINDOW_MS = 5000;
const FLEE_HP_RATIO = 0.3;

export type SoftenCheck = { ok: boolean; reason: string };

export type SoftenMethodHints = {
  /** Player recently used water/douse on the beast */
  doused?: boolean;
  /** Player / beast is near a light source (Lantern Hare) */
  inLight?: boolean;
  /** Optional capture method context */
  method?: 'snare' | 'bait' | 'bond' | string;
};

/**
 * Wild beast AI: wander / aggro / attack / flee.
 * Does not apply player damage directly — sets mesh.userData.pendingDamage on hits.
 */
export class BeastAI {
  private _wanderTimer = new WeakMap<object, number>();
  private _fleeTimer = new WeakMap<object, number>();
  private _lungeWindup = new WeakMap<object, number>();
  private _overheatTick = new WeakMap<object, number>();

  /**
   * Advance one wild beast for `dt` seconds.
   * `opts.inLight` is used by soften logic consumers / B03 calm near light.
   */
  updateWild(
    beast: WildBeast,
    playerPos: THREE_NS.Vector3,
    dt: number,
    opts: { inLight?: boolean } = {},
  ): void {
    if (beast.state === 'captured') return;

    const def = speciesDef(beast.speciesId);
    const scale = def.scale;
    const groundY = scale * 0.5;
    const mesh = beast.mesh;
    const spawn: THREE_NS.Vector3 =
      (mesh.userData.spawn as THREE_NS.Vector3 | undefined) ?? mesh.position.clone();
    if (!mesh.userData.spawn) mesh.userData.spawn = spawn.clone();

    // B04: periodically overheat while HP is high
    if (beast.speciesId === 'B04' && beast.hp / beast.maxHp > 0.55) {
      const tick = (this._overheatTick.get(mesh) ?? 0) + dt;
      if (tick >= 4) {
        beast.overheated = true;
        this._overheatTick.set(mesh, 0);
      } else {
        this._overheatTick.set(mesh, tick);
      }
    }

    if (opts.inLight && beast.speciesId === 'B03') {
      beast.calmed = true;
    }

    // Keep interface position in sync with mesh (projectiles / capture use beast.position)
    beast.position.copy(mesh.position);

    // Subtle idle breathe / sway (charm — not frozen props)
    if (beast.state === 'wander' || beast.state === 'soften' || beast.state === 'opportunity') {
      const t = (mesh.userData.idleT as number | undefined) ?? Math.random() * 10;
      mesh.userData.idleT = t + dt;
      const bob = Math.sin(mesh.userData.idleT * 2.2) * 0.03;
      mesh.position.y = groundY + bob;
      mesh.rotation.y += Math.sin(mesh.userData.idleT * 0.7) * 0.002;
    }

    const dx = playerPos.x - mesh.position.x;
    const dz = playerPos.z - mesh.position.z;
    const distPlayer = Math.hypot(dx, dz);
    const tier = def.tier;
    const aggroRange = AGGRO_BASE * (1 + (tier - 1) * 0.15) * (0.85 + def.stats.wil * 0.05);

    // Low-HP flee chance
    const hpRatio = beast.hp / Math.max(1, beast.maxHp);
    let fleeLeft = this._fleeTimer.get(mesh) ?? 0;
    if (fleeLeft > 0) {
      beast.state = 'flee';
      fleeLeft -= dt;
      this._fleeTimer.set(mesh, fleeLeft);
    } else if (hpRatio < FLEE_HP_RATIO && beast.state !== 'flee' && Math.random() < 0.35 * dt) {
      beast.state = 'flee';
      this._fleeTimer.set(mesh, 1.2 + Math.random() * 1.5);
    } else if (distPlayer <= aggroRange && hpRatio >= FLEE_HP_RATIO) {
      if (beast.state === 'wander' || beast.state === 'opportunity' || beast.state === 'soften') {
        beast.state = 'aggro';
        beast.aggroTimer = 2.5;
      }
    } else if (distPlayer > aggroRange * 1.6 && beast.state !== 'flee') {
      beast.state = 'wander';
      beast.aggroTimer = 0;
    }

    if (beast.attackCooldown > 0) beast.attackCooldown = Math.max(0, beast.attackCooldown - dt);
    if (beast.aggroTimer > 0) beast.aggroTimer = Math.max(0, beast.aggroTimer - dt);

    let moveX = 0;
    let moveZ = 0;
    let speed = 0;

    switch (beast.state) {
      case 'flee': {
        speed = FLEE_SPEED * (0.9 + def.stats.spd * 0.08);
        const len = distPlayer || 1;
        moveX = -dx / len;
        moveZ = -dz / len;
        // Prefer back toward spawn leash edge if far
        const fromSpawnX = mesh.position.x - spawn.x;
        const fromSpawnZ = mesh.position.z - spawn.z;
        if (Math.hypot(fromSpawnX, fromSpawnZ) > LEASH * 0.6) {
          moveX = -fromSpawnX;
          moveZ = -fromSpawnZ;
          const m = Math.hypot(moveX, moveZ) || 1;
          moveX /= m;
          moveZ /= m;
        }
        break;
      }
      case 'aggro':
      case 'attack': {
        beast.state = distPlayer <= LUNGE_RANGE * 1.8 ? 'attack' : 'aggro';
        speed = ATTACK_SPEED * (0.85 + def.stats.spd * 0.07);
        const len = distPlayer || 1;
        moveX = dx / len;
        moveZ = dz / len;

        // Periodic lunge / charge
        if (distPlayer <= LUNGE_RANGE * 2.5 && beast.attackCooldown <= 0) {
          const wind = (this._lungeWindup.get(mesh) ?? 0) + dt;
          this._lungeWindup.set(mesh, wind);
          if (wind >= 0.25) {
            // Commit lunge burst
            speed *= 2.4;
            this._lungeWindup.set(mesh, 0);
            beast.attackCooldown = LUNGE_COOLDOWN / (0.85 + def.stats.spd * 0.05);

            if (distPlayer <= LUNGE_RANGE) {
              const dmg = 4 + def.stats.pow * 3;
              const pending = (mesh.userData.pendingDamage as number) || 0;
              mesh.userData.pendingDamage = pending + dmg;
            } else {
              // Charge miss — player out of lunge range (dashed away)
              beast.lastChargeWhiff = performance.now();
            }
          }
        } else {
          this._lungeWindup.set(mesh, 0);
        }
        break;
      }
      // Non-hostile states (wander / soften / opportunity) hold ground instead
      // of fleeing — that stillness is what makes the bind window readable.
      case 'wander':
      case 'soften':
      case 'opportunity': {
        speed = WANDER_SPEED * (0.8 + def.stats.spd * 0.06);
        let t = this._wanderTimer.get(mesh) ?? 0;
        t -= dt;
        // (Re)pick a wander point when the timer expired or the target was lost.
        // Either way `beast.target` is non-null afterwards.
        if (t <= 0 || !beast.target) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 2 + Math.random() * (LEASH * 0.55);
          const tx = spawn.x + Math.cos(ang) * rad;
          const tz = spawn.z + Math.sin(ang) * rad;
          const goal = mesh.position.clone();
          goal.x = tx;
          goal.z = tz;
          goal.y = groundY;
          beast.target = goal;
          t = 1.5 + Math.random() * 2.5;
        }
        this._wanderTimer.set(mesh, t);
        {
          // Non-null here: the branch above always assigns a target.
          const goal = beast.target as THREE_NS.Vector3;
          const wx = goal.x - mesh.position.x;
          const wz = goal.z - mesh.position.z;
          const wlen = Math.hypot(wx, wz);
          if (wlen < 0.35) {
            beast.target = null;
            this._wanderTimer.set(mesh, 0);
          } else {
            moveX = wx / wlen;
            moveZ = wz / wlen;
          }
        }
        break;
      }
    }

    // Integrate movement
    if (speed > 0 && (moveX !== 0 || moveZ !== 0)) {
      const nx = mesh.position.x + moveX * speed * dt;
      const nz = mesh.position.z + moveZ * speed * dt;

      // Soft leash — pull back if beyond LEASH from spawn
      const ox = nx - spawn.x;
      const oz = nz - spawn.z;
      const od = Math.hypot(ox, oz);
      if (od > LEASH && beast.state === 'wander') {
        mesh.position.x = spawn.x + (ox / od) * LEASH;
        mesh.position.z = spawn.z + (oz / od) * LEASH;
      } else if (od > LEASH * 1.35 && beast.state !== 'flee') {
        // Hard pull when far in combat
        mesh.position.x += (-ox / od) * speed * dt * 0.5;
        mesh.position.z += (-oz / od) * speed * dt * 0.5;
      } else {
        mesh.position.x = nx;
        mesh.position.z = nz;
      }

      // Face movement direction
      const yaw = Math.atan2(moveX, moveZ);
      mesh.rotation.y = yaw;
    }

    mesh.position.y = groundY;
    beast.position.copy(mesh.position);
  }

  /**
   * Simplified Soften-key checks per species.
   */
  canSoften(beast: WildBeast, inv: Inventory, methodHints: SoftenMethodHints = {}): SoftenCheck {
    const hpRatio = beast.hp / Math.max(1, beast.maxHp);
    const now = performance.now();
    const heavyRecent =
      beast.heavyDamageRecent > 0 && now - beast.heavyDamageRecent < HEAVY_DAMAGE_WINDOW_MS;
    const chargeWhiffRecent =
      beast.lastChargeWhiff > 0 && now - beast.lastChargeWhiff < CHARGE_WHIFF_WINDOW_MS;

    switch (beast.speciesId) {
      case 'B01': {
        // Peaceful tutorial: shiny tin bait only
        if (inv.shiny_tin_bait <= 0) {
          return { ok: false, reason: 'Brauchst Glitzer-Köder (Inventar) — kein Kampf nötig' };
        }
        if (heavyRecent) {
          return { ok: false, reason: 'Zu verletzt durch Schläge — warte kurz, nicht hauen' };
        }
        if (hpRatio < 0.15) {
          return { ok: false, reason: 'Zu schwer verletzt zum Binden' };
        }
        return { ok: true, reason: 'Will den Glitzer — F halten!' };
      }
      case 'B02': {
        if (hpRatio < 0.35 || hpRatio > 0.7) {
          return { ok: false, reason: 'Kraft dämpfen (Lebensbalken 35–70%) — kämpfen!' };
        }
        // Lehrling-Pfad: ruhiger Eber in der Mitte = bindbar (ohne Hauer-Puzzle)
        if (!beast.partBroken && !chargeWhiffRecent) {
          if (beast.state !== 'attack' && hpRatio >= 0.4 && hpRatio <= 0.65) {
            return { ok: true, reason: 'Eber zögert — F halten! (Lehrling)' };
          }
          return { ok: false, reason: 'Hauer brechen (Thorn) ODER Charge ausweichen' };
        }
        return { ok: true, reason: 'Eber wankt — F halten!' };
      }
      case 'B03': {
        if (heavyRecent) {
          return { ok: false, reason: 'Schwere Treffer ängstigen es — aufhören zu schlagen' };
        }
        const nearLight = beast.calmed || Boolean(methodHints.inLight);
        if (!nearLight) {
          return { ok: false, reason: 'Braucht Ruhe am Licht (Tag oder Schrein)' };
        }
        return { ok: true, reason: 'Ruhig — F halten!' };
      }
      case 'B04': {
        if (methodHints.doused) {
          beast.overheated = false;
        }
        if (beast.overheated && !methodHints.doused) {
          return { ok: false, reason: 'Überhitzt — Ward (2) zum Kühlen' };
        }
        if (hpRatio > 0.9) {
          return { ok: false, reason: 'Noch zu feurig — etwas Schaden machen' };
        }
        return { ok: true, reason: 'Abgekühlt — F halten!' };
      }
      case 'B05': {
        if (hpRatio <= 0.3) {
          return { ok: false, reason: 'Zu verletzt — es löst sich auf' };
        }
        if (beast.state === 'attack' && hpRatio < 0.5) {
          return { ok: false, reason: 'Greift an — erst abklingen lassen' };
        }
        return { ok: true, reason: 'Offen für Pakt — F halten!' };
      }
      case 'B09': {
        if (hpRatio < 0.3 || hpRatio > 0.75) {
          return { ok: false, reason: 'Ehren-Duell: mittlere Kraft + harte Treffer' };
        }
        if (!beast.partBroken && !chargeWhiffRecent) {
          return { ok: false, reason: 'Kamm brechen mit Thorn (4)' };
        }
        return { ok: true, reason: 'Respekt gezollt — F halten!' };
      }
      case 'B12': {
        if (beast.mesh.userData.bossCaptureReady) {
          return { ok: true, reason: 'Krone offen — JETZT F HALTEN!' };
        }
        if (hpRatio > 0.55) {
          return { ok: false, reason: 'Platten brechen (Thorn) — warte auf Telegraphs' };
        }
        if ((beast.mesh.userData.bossPlates as number) > 0) {
          return { ok: false, reason: `Noch ${beast.mesh.userData.bossPlates} Platten` };
        }
        if (hpRatio < 0.08) {
          return { ok: false, reason: 'Stirbt — DPS stoppen, dann binden' };
        }
        return { ok: true, reason: 'Ashcrown bindbar — F halten!' };
      }
      default: {
        if (hpRatio < 0.25 || hpRatio > 0.65) {
          return { ok: false, reason: 'Lebensbalken auf 25–65% bringen' };
        }
        return { ok: true, reason: 'Bereit — F halten!' };
      }
    }
  }
}

/** Apply combat damage; records heavy hits and may break a part if amount > 15. */
export function applyDamageToBeast(beast: WildBeast, amount: number, heavy: boolean): void {
  if (amount <= 0 || beast.state === 'captured') return;
  beast.hp = Math.max(0, beast.hp - amount);
  if (heavy || amount >= 12) {
    beast.heavyDamageRecent = performance.now();
  }
  if (amount > 15) {
    beast.partBroken = true;
  }
  // Hitting hard while overheated keeps B04 enraged
  if (beast.speciesId === 'B04' && (heavy || amount >= 10)) {
    beast.overheated = true;
  }
}
