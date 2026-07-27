import * as THREE from 'three';

export interface WorldEventResult {
  toast?: string;
  /** Caller builds a tall black mesh at this position (once). */
  spawnWatcher?: THREE.Vector3;
  /** Damage applied to the player (e.g. night crawler ambush). */
  damage?: number;
}

/**
 * Lightweight world heat-driven events.
 * No full AI — only positions / toasts / damage signals for the game loop.
 */
export class WorldEvents {
  private watcherSpawned: boolean;
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

    // First time heat hits Watchers stage: ridge spawn ~25u from player
    if (heat >= 25 && !this.watcherSpawned) {
      this.watcherSpawned = true;
      const angle = Math.random() * Math.PI * 2;
      const dist = 25;
      result.spawnWatcher = new THREE.Vector3(
        playerPos.x + Math.cos(angle) * dist,
        (playerPos.y ?? 0) + 3.5, // ridge height hint; caller may snap to terrain
        playerPos.z + Math.sin(angle) * dist,
      );
      result.toast = 'A silhouette on the ridge… a Watcher.';
    }

    // Night crawler ambush — rare, cooldown-gated, no mesh AI
    if (isNight) {
      this.crawlerCooldown -= dt;
      if (this.crawlerCooldown <= 0) {
        this.crawlerCooldown = 18 + Math.random() * 28;
        if (Math.random() < 0.4) {
          result.damage = 5;
          // Do not overwrite a first-sight Watcher toast
          if (!result.toast) result.toast = 'Night crawler!';
        }
      }
    } else {
      // Short arming delay when night begins again
      this.crawlerCooldown = Math.min(this.crawlerCooldown, 6 + Math.random() * 6);
    }

    return result;
  }
}
