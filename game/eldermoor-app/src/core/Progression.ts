/** Player wand tier + beast bond levels */

export class WandProgression {
  tier = 0; // 0 cracked, 1 iron, 2 rune
  readonly names = ['Cracked Focus', 'Iron-bound Focus', 'Rune Focus'];

  get damageMul() {
    return 1 + this.tier * 0.22;
  }
  get manaMul() {
    return 1 + this.tier * 0.12;
  }
  get catchToolTier() {
    return 0.95 + this.tier * 0.12;
  }

  /** Costs: essence + ingot */
  canUpgrade(essence: number, ingot: number): boolean {
    if (this.tier >= 2) return false;
    if (this.tier === 0) return essence >= 4 && ingot >= 1;
    return essence >= 8 && ingot >= 3;
  }

  upgradeCost(): string {
    if (this.tier >= 2) return 'Maxed';
    if (this.tier === 0) return '4 essence + 1 ingot';
    return '8 essence + 3 ingot';
  }

  tryUpgrade(inv: { essence: number; ingot: number }): string {
    if (this.tier >= 2) return 'Wand already at Rune Focus.';
    if (this.tier === 0) {
      if (inv.essence < 4 || inv.ingot < 1) return `Need ${this.upgradeCost()}.`;
      inv.essence -= 4;
      inv.ingot -= 1;
      this.tier = 1;
      return 'Focus iron-bound. Spells bite harder.';
    }
    if (inv.essence < 8 || inv.ingot < 3) return `Need ${this.upgradeCost()}.`;
    inv.essence -= 8;
    inv.ingot -= 3;
    this.tier = 2;
    return 'Rune Focus complete. The Council will feel this.';
  }
}

export function beastPowerMul(bondLevel: number): number {
  return 1 + Math.min(5, bondLevel) * 0.1;
}

export function gainBondXp(
  beast: { bondLevel?: number; bondXp?: number; name: string },
  amount: number,
): string | null {
  beast.bondLevel = beast.bondLevel ?? 0;
  beast.bondXp = (beast.bondXp ?? 0) + amount;
  const need = 20 + beast.bondLevel * 15;
  if (beast.bondXp >= need && beast.bondLevel < 5) {
    beast.bondXp -= need;
    beast.bondLevel += 1;
    return `${beast.name} bond level ${beast.bondLevel}!`;
  }
  return null;
}
