import type { Inventory, OwnedBeast, Station } from '../core/types';
import { SPECIES } from '../data/species';

/** Fodder drained per working second. 5 fodder ≈ 4+ minutes of continuous work. */
const FODDER_PER_WORK = 0.02;
const MOOD_DRAIN_NO_FODDER = 2.5;
const LOW_MOOD = 10;
const WARN_INTERVAL = 10;
/** Wood/sec per wrk at mood 100. At mood 80 wrk 3 → ~0.36 wood/s (~1 wood / 2.8s). */
const LUMBER_WOOD_PER_WRK = 0.15;

/**
 * Assigns base labor from owned beasts each second.
 * Work speed scales with mood/100; mood < 10 skips work.
 * Mood is on OwnedBeast and shown by the HUD party panel.
 */
export class Workforce {
  private accum = 0;
  private moodWarnCd = 0;
  /** Fractional wood/ingot banked for less chatty produce toasts */
  private woodBank = 0;
  private ingotBank = 0;

  update(
    dt: number,
    owned: OwnedBeast[],
    stations: Station[],
    inv: Inventory,
    onProduce: (msg: string) => void,
  ): void {
    this.accum += dt;
    if (this.moodWarnCd > 0) this.moodWarnCd -= dt;

    while (this.accum >= 1) {
      this.accum -= 1;
      this.tickSecond(owned, stations, inv, onProduce);
    }
  }

  private tickSecond(
    owned: OwnedBeast[],
    stations: Station[],
    inv: Inventory,
    onProduce: (msg: string) => void,
  ): void {
    const hasLumber = stations.some((s) => s.kind === 'lumber');
    const hasSmelter = stations.some((s) => s.kind === 'smelter');

    for (const beast of owned) {
      const job = beast.job;
      if (!job || job === 'idle') continue;

      // Mood drains without fodder for any assigned worker
      if (inv.fodder <= 0) {
        beast.mood = Math.max(0, beast.mood - MOOD_DRAIN_NO_FODDER);
      }

      if (beast.mood < LOW_MOOD) {
        if (this.moodWarnCd <= 0) {
          onProduce(
            `${beast.name} is too weary to work (mood ${Math.floor(beast.mood)}). Feed fodder.`,
          );
          this.moodWarnCd = WARN_INTERVAL;
        }
        continue;
      }

      const sp = SPECIES[beast.speciesId];
      const wrk = sp?.stats.wrk ?? 1;
      const speed = Math.max(0.05, beast.mood / 100);

      switch (job) {
        case 'lumber': {
          if (!hasLumber) break;
          const woodGain = wrk * LUMBER_WOOD_PER_WRK * speed;
          inv.wood += woodGain;
          this.woodBank += woodGain;
          this.consumeFodder(inv);
          if (this.woodBank >= 1) {
            const n = Math.floor(this.woodBank);
            this.woodBank -= n;
            onProduce(`+${n} wood — ${beast.name} (lumber)`);
          }
          break;
        }
        case 'smelt': {
          if (!hasSmelter || inv.ore <= 0) break;
          const converted = Math.min(inv.ore, wrk * 0.08 * speed);
          if (converted <= 0) break;
          inv.ore -= converted;
          inv.ingot += converted;
          this.ingotBank += converted;
          this.consumeFodder(inv);
          if (this.ingotBank >= 1) {
            const n = Math.floor(this.ingotBank);
            this.ingotBank -= n;
            onProduce(`+${n} ingot — ${beast.name} (smelt)`);
          }
          break;
        }
        case 'scout': {
          const herbChance = 0.18 * speed;
          const essenceChance = 0.05 * speed;
          let found = false;
          if (Math.random() < herbChance) {
            inv.herb += 1;
            found = true;
            onProduce(`+1 herb — ${beast.name} (scout)`);
          }
          if (Math.random() < essenceChance) {
            inv.essence += 1;
            found = true;
            onProduce(`+1 essence — ${beast.name} (scout)`);
          }
          if (found) this.consumeFodder(inv);
          else if (inv.fodder > 0) {
            inv.fodder = Math.max(0, inv.fodder - FODDER_PER_WORK * 0.35);
          }
          break;
        }
        case 'haul': {
          if (!hasLumber) break;
          const bonus = wrk * 0.06 * speed;
          inv.wood += bonus;
          this.woodBank += bonus;
          this.consumeFodder(inv);
          break;
        }
        case 'guard':
          break;
        default:
          break;
      }
    }
  }

  private consumeFodder(inv: Inventory): void {
    if (inv.fodder <= 0) return;
    inv.fodder = Math.max(0, inv.fodder - FODDER_PER_WORK);
  }
}
