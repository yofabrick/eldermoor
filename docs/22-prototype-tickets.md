# 22 — Prototype Tickets (Greybox → Slice)

## Goal of Proto
Prove in playable form: **gather → capture with Bond Ring → assign work → leave and return to production → see Heat foreshadowing.**

If any of those fail the fun test, stop feature expansion.

**Recommended stack:** Unreal Engine 5 (World Partition later; Proto in one persistent level). Alternative: Unity 6 if team is C#-only — same ticket list.

---

## Milestone P0 — “One Beast Economy” (Week 1–2)

| ID | Ticket | Acceptance |
|----|--------|------------|
| P0-01 | Third-person controller + stamina | Move, dash, jump; no jank camera clip on flat nav |
| P0-02 | Gather nodes (wood/stone/herb) | Hold interact; inventory gains stack |
| P0-03 | Craft recipe: chalk snare | Bench or inventory craft |
| P0-04 | Dummy beast AI (wander + aggro) | Enter radius → chase → melee tell |
| P0-05 | Soften: HP band opens Bond Ring UI | Ring visible only when valid |
| P0-06 | Snare method channel | Success → beast owned entity |
| P0-07 | Pen + assign lumber job | Beast pathfinds; wood ticks into chest every N sec |
| P0-08 | Save/load base + owned beasts | Restart keeps progress |
| P0-09 | Death → respawn at bed, partial drop | Recoverable |

**Playtest gate:** 8 external players, 25 min each. ≥6 say they want to catch a second beast.

---

## Milestone P1 — “Methods & Mood” (Week 3–4)

| ID | Ticket | Acceptance |
|----|--------|------------|
| P1-01 | Three methods: snare, bait, bond channel | Different species prefer different |
| P1-02 | Species data table (3 beasts) | Glimmerpouch, Brushback, Cinderscale |
| P1-03 | Wrong method feedback bark | UI tip actionable |
| P1-04 | Mood/control meters | Starvation lowers work speed |
| P1-05 | Night cycle + basic threat | Threat forces return or fight |
| P1-06 | Smelter station + Cinderscale job | Chain: ore → ingot |
| P1-07 | Heat pip visual (fake curve) | Building tower raises pip |
| P1-08 | Watcher silhouette event once | Non-combat spook at Heat ≥2 |

---

## Milestone P2 — “Magic & Path” (Week 5–6)

| ID | Ticket | Acceptance |
|----|--------|------------|
| P2-01 | Spell bar: Arc bolt, Ward, Bind thread | All usable in combat |
| P2-02 | Mana + strain | Strain causes misfire VFX |
| P2-03 | Path ritual volume (binary choice) | Sets path flag on save |
| P2-04 | One exclusive recipe per path | Visible in grimoire |
| P2-05 | Seal Echo zone volume | Player spells weakened; beasts OK |
| P2-06 | Field party: 2 beast slots + commands | Attack / guard / withdraw |

---

## Milestone P3 — “Co-op & Slice Content” (Week 7–10)

| ID | Ticket | Acceptance |
|----|--------|------------|
| P3-01 | Steam listen-server 1–4 | Join, see others, shared damage |
| P3-02 | Bind contribution score | Fair catch rights |
| P3-03 | Second biome blockout (Mire) | Hazard + 2 new beasts |
| P3-04 | Full 12-beast data (grey meshes OK) | All catchable |
| P3-05 | Ashcrown elite encounter | Catch or kill paths |
| P3-06 | Base raid night (AI) | Defenses matter |
| P3-07 | Performance budget | 60fps target mid settings on ref PC |

---

## Non-Goals for Proto
- Final art, full VO, breeding, Council war, trading MMO, foliage beauty pass.

## Definition of Slice Done
External 90-minute playtest: median rating ≥7/10 “want to play more,” and unaided recall of **capture method difference**, **beast work**, and **Council watching**.
