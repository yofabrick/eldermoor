# Capture Math v0.4 (Implementation Contract)

```
softenQuality ∈ [0.5, 1.3]   // how cleanly Soften key satisfied
methodMult   ∈ data          // snare 1.0, bait 1.05 if preferred, brand 1.1 Mortis-lean, etc.
wilEffective = wil/5 * (1 - partBreakBonus) * pathWilMod
toolTier     = 0.9 + 0.1*tier // cracked focus 0.9 … ley snare 1.2
pathAffinity = 1 + pathBonus from species
coopBonus    = 0 … 0.25 from second player valid assist
rng          = U(0.92, 1.08)

catchChance = clamp(
  catchBase
  * methodMult
  * softenQuality
  * (1 - wilEffective * 0.65)
  * toolTier
  * pathAffinity
  * (1 + coopBonus)
  * rng
, 0.02, 0.92)
```

## Soften quality rubric
| Quality | Value | Example |
|---------|-------|---------|
| Marginal | 0.5 | Wrong bait but somehow window opened |
| OK | 0.85 | Main key hit sloppily |
| Clean | 1.0 | Key + hp band |
| Perfect | 1.2–1.3 | Key + perfect interrupt + no extra damage |

## Pity
After 3 consecutive *clean* failures on same individual: +0.08 catchBase for next attempt only.

## Kill on channel
If HP → 0 during MethodChannel: species `onDeathCatch` (default: fail + corpse loot; Mortis may roll thrall residue).
