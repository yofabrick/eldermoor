/** Notoriety / heat stages (mirrors HUD eye labels). */
export const HEAT_STAGES = [
  { threshold: 0, name: 'Gerüchte' },
  { threshold: 25, name: 'Beobachter' },
  { threshold: 50, name: 'Gesandter' },
  { threshold: 75, name: 'Schlagtrupp' },
  { threshold: 100, name: 'Krieg' },
] as const;

export type HeatStageName = (typeof HEAT_STAGES)[number]['name'];

const STAGE_TOASTS: { threshold: number; toast: string }[] = [
  { threshold: 25, toast: 'Heat steigt — Beobachter des Rates bemerken dich…' },
  { threshold: 50, toast: 'Ein Gesandter ist unterwegs.' },
  { threshold: 75, toast: 'Schlagtrupps jagen deine Spur.' },
  { threshold: 100, toast: 'Krieg um Eldermoor ist erklärt.' },
];

export class HeatSystem {
  heat: number;
  watcherSeen: boolean;
  /** Last action that modified heat (for debug / journal hooks). */
  lastReason = '';

  constructor(heat = 0, watcherSeen = false) {
    this.heat = heat;
    this.watcherSeen = watcherSeen;
  }

  /** Current stage label for the given (or current) heat value. */
  stageName(value = this.heat): HeatStageName {
    let name: HeatStageName = 'Gerüchte';
    for (const s of HEAT_STAGES) {
      if (value >= s.threshold) name = s.name;
    }
    return name;
  }

  /**
   * Add heat from an action.
   * @returns toast string if a stage threshold was crossed; otherwise null.
   */
  add(amount: number, reason: string): string | null {
    this.lastReason = reason;
    const before = this.heat;
    this.heat = Math.max(0, this.heat + amount);

    let toast: string | null = null;
    for (const stage of STAGE_TOASTS) {
      if (before < stage.threshold && this.heat >= stage.threshold) {
        toast = stage.toast;
      }
    }
    return toast;
  }

  onTowerBuilt(): string | null {
    return this.add(8, 'tower_built');
  }

  onEliteBind(): string | null {
    return this.add(10, 'elite_bind');
  }

  /** First successful bind — heat ramp so pamphlet lands in opening minutes */
  onFirstBind(): string | null {
    return this.add(5, 'first_bind');
  }

  onKill(): string | null {
    return this.add(5, 'kill');
  }

  onPathMortis(): string | null {
    return this.add(6, 'path_mortis');
  }

  onPathVita(): string | null {
    return this.add(2, 'path_vita');
  }

  /** First permanent station / lumber — demo heat ramp so Watchers are reachable. */
  onFirstBase(): string | null {
    return this.add(6, 'first_base');
  }

  onFirstWorker(): string | null {
    return this.add(5, 'first_worker');
  }
}
