# 16 — Economy & Balance Skeleton

## Goals
1. Expeditions always feel richer than standing AFK — but AFK workers matter.  
2. No single resource becomes eternal bottleneck without a beast solution.  
3. Path choice changes *efficiency shape*, not “one path is just stronger.”  
4. Multiplayer doesn’t obsolete solo; it opens parallelization.

---

## Resource Tiers

| Tier | Examples | Sink |
|------|----------|------|
| **T0 Raw** | Wood, stone, fiber, water | Building, fuel |
| **T1 Refined** | Planks, ingots, cloth, pure water | Stations, gear |
| **T2 Reagents** | Glowherb, resin, toxin gland, seal-ash | Potions, baits, brands |
| **T3 Essence** | Minor / deep / ur-essence | Spells, rituals, high craft |
| **T4 Relics** | Ward keys, grimoire pages, memory shards | Progression gates, prestige |

### Upkeep
- Beasts eat **fodder** (farmed) or **hunt share** (expedition tax)  
- Starving workforce: speed down → disobey → flee/rampage  
- Mortis thralls: eat less fodder, drain **strain essence** instead  
- Vita partners: eat more, grant prosperity passive  

---

## Time-to-Fun Targets

| Action | Target time |
|--------|-------------|
| First capture | < 15 min from boot |
| First worker assigned | < 25 min |
| First full core loop cycle | < 40 min |
| Gear tier 0 → 1 | ~2–3 hrs |
| Path fork available | ~6–8 hrs |
| First mount | ~8–12 hrs |
| Slice complete (Ashcrown caught or key loot) | ~10–15 hrs |

---

## Power Budget (relative)

### Player vs Beast damage share
- Early: player 70% / beasts 30%  
- Mid: 50/50  
- Late army fantasy: beasts 60–70% with player as commander-mage  

### Capture vs Kill rewards
- Capture: long-term power (worker/fighter)  
- Kill: burst mats + rare glands  
- Design so both valid; pure murder-only should lag base automation  

---

## Vita vs Mortis Economy (fairness)

| | Vita | Mortis |
|--|------|--------|
| **Income shape** | Stable compound growth | Spikes + crashes |
| **Workforce** | Loyal, slower ramp | Fast thralls, betrayal risk |
| **Land** | Bloom tiles +crop | Blight tiles +dark reagent |
| **Combat** | Sustain, auras | Execute, sacrifice burst |
| **Heat** | Lower passive notoriety | Higher heat / better siege |

**Golden rule:** at equal investment, win-rate within ~10% in controlled arena tests; fantasy difference must still be *obvious*.

---

## Crafting Trees (slice)

### Tools
Stick focus → Iron-bound focus → Rune focus  

### Capture
Chalk snare → Barbed snare → Ley snare  
Bait: berry → shiny tin → species specialty  

### Gear
Cloth pads → Boar-hide → Mire-scale  

### Base
Campfire → Smelter → Still → Ward stone  

---

## Soft Caps & Anti-Snowball
- Pen capacity gates workforce  
- Essence still has heat (overproduction attracts raids)  
- Elite spawns personal loot lockouts short enough for fun, long enough vs dupe-feeling  
- Co-op: personal binding rights on contested catch (need dice/tag rules)

## Inflation Levers (designers)
- Worker speed %  
- Upkeep cost  
- Capture resource cost  
- Merchant prices  
- Raid frequency by heat  

Log all as data table `balance_v0.csv` later; this doc is the intent contract.
