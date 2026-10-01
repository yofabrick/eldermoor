import * as THREE from 'three';

export interface WorldEventResult {
  toast?: string;
  /** Caller builds a tall black mesh at this position (once). */
  spawnWatcher?: THREE.Vector3;
  /** Spawn a pamphlet prop near the player (heat foreshadow). */
  spawnPamphlet?: boolean;
  /** Damage applied to the player (e.g. night crawler ambush). */
  damage?: number;
}

/**
 * Lightweight world heat-driven events.
 * No full AI — only positions / toasts / damage signals for the game loop.
 */
export class WorldEvents {
  private watcherSpawned: boolean;
  /** Early heat pamphlet (before full Watcher stage). */
  private pamphletDone = false;
  /** Seconds until the next night-crawler roll while night. */
  private crawlerCooldown: number;

  constructor(watcherSeen = false) {
    this.watcherSpawned = watcherSeen;
    this.crawlerCooldown = 8 + Math.random() * 12;
  }

  /** Sync from save / HeatSystem after load. */
  setWatcherSeen(seen: boolean): void {
    if (seen) this.watcherSpawned = true;
  }

  /**
   * @param dt        frame delta seconds
   * @param heat      current heat value
   * @param playerPos player world position
   * @param _scene    reserved for future in-scene spawns (mesh built by caller)
   * @param isNight   night window for ambient threats
   * @param watcherSeen from HeatSystem / save — prevents re-spawn after load
   */
  update(
    dt: number,
    heat: number,
    playerPos: THREE.Vector3,
    _scene: THREE.Scene | null,
    isNight = false,
    watcherSeen = false,
  ): WorldEventResult {
    const result: WorldEventResult = {};

    if (watcherSeen) this.watcherSpawned = true;

    // Early pamphlet foreshadow (heat 8+) — once, world prop + toast
    if (heat >= 8 && !this.pamphletDone) {
      this.pamphletDone = true;
      result.spawnPamphlet = true;
      if (!result.toast) {
        result.toast =
          'Ein Flugblatt am Wind: „Unlisted, die zu laut werden, finden Zuschauer.“';
      }
    }

    // First time heat hits Watchers stage: ridge spawn NW of player (skyline)
    if (heat >= 25 && !this.watcherSpawned) {
      this.watcherSpawned = true;
      // Prefer fixed ridge direction so silhouette is learnable
      const dist = 22;
      const angle = -Math.PI * 0.65; // NW-ish from player
      result.spawnWatcher = new THREE.Vector3(
        playerPos.x + Math.cos(angle) * dist,
        0,
        playerPos.z + Math.sin(angle) * dist,
      );
      result.toast = 'Eine Silhouette am Grat… ein Beobachter des Rates.';
    }

    // Night crawler ambush — rare, cooldown-gated, no mesh AI
    if (isNight) {
      this.crawlerCooldown -= dt;
      if (this.crawlerCooldown <= 0) {
        this.crawlerCooldown = 18 + Math.random() * 28;
        if (Math.random() < 0.4) {
          result.damage = 5;
          // Do not overwrite a first-sight Watcher toast
          if (!result.toast) result.toast = 'Nachtkriecher!';
        }
      }
    } else {
      // Short arming delay when night begins again
      this.crawlerCooldown = Math.min(this.crawlerCooldown, 6 + Math.random() * 6);
    }

    return result;
  }
}
