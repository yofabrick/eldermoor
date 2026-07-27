# 14 — Capture & Combat Design

## North Star Moments
1. Soften without killing (or risk a corpse and a lesson).  
2. Read the beast — pride, fear, greed, hunger, silence.  
3. Commit to a method under pressure.  
4. Success stinger + immediate *use* (work or party).  

If capture is “press F when HP low,” the game is a worse Pokémon.

---

## Combat Pillars
- **Third-person action**, readable telegraphs, short encounters (30–90s common, 3–8m elites).  
- You are a **mage** *and* a **beast-master** — both kits must work alone.  
- Beasts have **stances**: Free · Focus Target · Guard Me · Ability · Withdraw · (Mortis) Sacrifice.

### Player combat verbs (slice)
| Verb | Role |
|------|------|
| Arc bolt | Basic ranged |
| Ward pulse | Defense / interrupt |
| Bind thread | Soften for capture, slow |
| Ember fan / Thorn lash | Element starter |
| Dash step | Mobility |
| Potion quickslot | Survival |

### Beast command UX
Radial or number keys 1–5; hold for stance. Co-op: each player 2–3 field beasts max in slice to keep readability.

---

## Capture as a Phase, Not a Button

### State machine
```
AGGRO → SOFTEN → OPPORTUNITY WINDOW → COMMIT METHOD → RESOLVE (Catch / Break / Enrage / Flee)
```

### Soften conditions (mix per species)
- HP threshold band (not always “red”)  
- Broken armor part  
- Status: calm / sleep / shame / silence / dazzled  
- Environmental: shrine nearby, full moon, standing in water  
- Relationship: fed 3×, rescued from predator  

### Opportunity window
UI: **Bond ring** fills when conditions met. Window lasts 3–8s. Outside window, methods waste resources or anger the target.

---

## Methods (depth)

| Method | Resource | Best vs | Skill expression | Path |
|--------|----------|---------|------------------|------|
| **Snare circle** | Crafted stakes + chalk | Low WIL, grounded | Placement, kite into circle | N |
| **Bait offering** | Food / shiny / specialty | Greedy, hungry | Read preferred bait | N |
| **Bonding focus** | Mana + channel time | Mid WIL, non-corrupt | Channel under attack | V-lean |
| **Pact ritual** | Multi-reagent, long | High WIL, elites | Setup, co-op | V |
| **Dominance brand** | Strain + optional blood | High WIL, thrall fantasy | Interrupt timing | M |
| **Sever-bind** | Kill-adjacent execute | Near-death only | High risk last second | M |

**Kill on capture attempt:** if HP hits 0 mid-method, species rules decide: corpse loot only / ghost residue / Mortis raise chance.

---

## Capture Math (slice draft — tune in playtest)

```
CatchChance = baseSpecies
  * methodMultiplier
  * softenQuality (0.5–1.3)
  * (1 - wilEffective)
  * bondToolTier
  * pathAffinity
  * rng(0.9–1.1)
```

- First catch of species: slight pity after 3 clean failures.  
- Elite: hard soft-cap until ritual unlocked.  
- Multiplayer assist: +10–25% if second player holds Ward or feeds correct bait (not AFK leech).

---

## Field Party vs Base Workforce
- **Field party:** 3 slots slice (player + up to 2 beasts active; more unlocked later).  
- **Base workforce:** soft-capped by pens + food upkeep.  
- Swap at pen: 3s channel, combat cancels.

## Death & Downed
- Player downed: beasts continue X seconds (guard/withdraw AI).  
- Recover at base or ally revive.  
- Default: keep beasts, drop portion of carried mats (server tunable).

## Boss / Elite Pattern Language
1. Learn tell  
2. Break part or silence channel  
3. Open capture *or* kill for unique mat  
4. Optional co-op second phase if brand/pact contested  

## Feel Checklist
- [ ] Audio stinger on opportunity window  
- [ ] Camera push-in on successful bind  
- [ ] Immediate name + assign prompt (“Work or Party?”)  
- [ ] Failures teach (bark: “Too proud—break the crest first”)  
