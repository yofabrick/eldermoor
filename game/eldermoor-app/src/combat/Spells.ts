/** Slice spell kit — Arc Bolt, Ward Pulse, Bind Thread, Thorn Lash */

export type SpellId = 'bolt' | 'ward' | 'bind' | 'thorn';

export interface SpellDef {
  id: SpellId;
  name: string;
  mana: number;
  strain: number;
  cooldown: number;
  damage: number;
  color: number;
  /** True for ranged/cone projectiles; ward is self/pulse only */
  projectile: boolean;
  /** Ward pulse interrupts enemy windups */
  interrupt: boolean;
  /** Bind softens target for capture */
  soft: boolean;
  /** Thorn is a short cone projectile */
  cone: boolean;
}

export const SPELLs: Record<SpellId, SpellDef> = {
  bolt: {
    id: 'bolt',
    name: 'Arc Bolt',
    mana: 8,
    strain: 0,
    cooldown: 0.35,
    damage: 12,
    color: 0x66ccff,
    projectile: true,
    interrupt: false,
    soft: false,
    cone: false,
  },
  ward: {
    id: 'ward',
    name: 'Ward Pulse',
    mana: 14,
    strain: 2,
    cooldown: 1.0,
    damage: 0,
    color: 0x88aaff,
    projectile: false,
    interrupt: true,
    soft: false,
    cone: false,
  },
  bind: {
    id: 'bind',
    name: 'Bind Thread',
    mana: 12,
    strain: 4,
    cooldown: 0.75,
    damage: 6,
    color: 0xaa66ff,
    projectile: true,
    interrupt: false,
    soft: true,
    cone: false,
  },
  thorn: {
    id: 'thorn',
    name: 'Thorn Lash',
    mana: 16,
    strain: 2,
    cooldown: 1.1,
    damage: 18,
    color: 0x55aa44,
    projectile: true,
    interrupt: false,
    soft: false,
    cone: true,
  },
};

export const SPELL_ORDER: SpellId[] = ['bolt', 'ward', 'bind', 'thorn'];

export const WARD_DURATION = 1.2;

export interface SpellCasterState {
  mana: number;
  strain: number;
  wardTimer: number;
}

export interface CastOk {
  ok: true;
  spell: SpellDef;
  /** Spawn a projectile for bolt / bind / thorn */
  projectile: boolean;
  soft: boolean;
  interrupt: boolean;
  damage: number;
  color: number;
  /** Ward only — duration applied to player.wardTimer */
  wardTimer?: number;
}

export interface CastFail {
  ok: false;
  reason: 'unknown' | 'mana' | 'cooldown';
}

export type CastResult = CastOk | CastFail;

/** Check whether the caster can pay mana (and optional cooldown). */
export function canCast(
  spellId: SpellId,
  player: Pick<SpellCasterState, 'mana'>,
  cooldownRemaining = 0,
): boolean {
  const def = SPELLs[spellId];
  if (cooldownRemaining > 0) return false;
  return player.mana >= def.mana;
}

/**
 * Apply mana/strain costs and ward side-effects.
 * Does not spawn projectiles — caller uses ProjectileSystem for those.
 * Ward is never a projectile; sets `player.wardTimer = 1.2`.
 */
export function castSpell(
  spellId: SpellId,
  player: SpellCasterState,
  cooldownRemaining = 0,
): CastResult {
  const spell = SPELLs[spellId];
  if (cooldownRemaining > 0) return { ok: false, reason: 'cooldown' };
  if (player.mana < spell.mana) return { ok: false, reason: 'mana' };

  player.mana -= spell.mana;
  player.strain += spell.strain;

  if (spellId === 'ward') {
    player.wardTimer = WARD_DURATION;
    return {
      ok: true,
      spell,
      projectile: false,
      soft: false,
      interrupt: true,
      damage: 0,
      color: spell.color,
      wardTimer: WARD_DURATION,
    };
  }

  return {
    ok: true,
    spell,
    projectile: spell.projectile,
    soft: spell.soft,
    interrupt: spell.interrupt,
    damage: spell.damage,
    color: spell.color,
  };
}

/** Hit-meta flags derived from a spell (for projectiles / pulse). */
export function spellHitMeta(spellId: SpellId): {
  soft: boolean;
  interrupt: boolean;
  cone: boolean;
} {
  const s = SPELLs[spellId];
  return {
    soft: s.soft,
    interrupt: s.interrupt,
    cone: s.cone,
  };
}
