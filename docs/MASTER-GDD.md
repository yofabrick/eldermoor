# ELDERMOOR — Master GDD v0.4

**Single-source narrative for humans.** Detailed specs live in numbered docs and `data/*.json`. If conflicts arise: **JSON + this master > old prose**, then patch the old doc.

---

## 1. High Concept

**Logline:** A discarded mage with broken memories binds original beasts, builds an enclave, chooses Vita or Mortis magic, and grows until the High Council declares war.

**Genre:** Open-world survival · creature labor economy · base-building · action magic · sandbox co-op  

**Tone:** Wonder with teeth — satirical maturity without pure meme sludge.

**Promise:** The unfulfilled adult fantasy of living free in a dangerous magic world — not as a schoolchild on rails, but as a builder, binder, and eventual civilizational problem.

**Legal:** Original IP. No third-party franchise names, places, or creature designs.

---

## 2. Pillars

1. **Beasts first** — work, war, mount, ethics  
2. **Your enclave** — camp → tower → private academy  
3. **Magic free** — modular kit; Vita / Mortis identity  
4. **Multiplayer native** — co-op day one; bind scores  
5. **Nobody → threat** — Council Heat as political loop  

### Demo Law (minute 15)
Bond Ring capture · beast producing at station · Heat foreshadow  

### Differentiators
- Per-species Soften keys + multi-method capture  
- Seal Echo (player magic suppressed)  
- Early institutional pressure  
- Path economy texture, not good/evil slideshow  

---

## 3. Story

**World:** After the Veil War, Academies and High Council sealed the Wild Arcana. Seals crack. Wild magic and old beasts return.

**You:** Outcast / Unlisted. Memory fragments. Possible truths: vessel experiment, feared bloodline, or true nobody. No forced chosen-one title card.

**Path fork:** Vita (growth, pact, reclaim) vs Mortis (dominate, sacrifice, brand). Mixable; commitment rewarded.

**Endgame:** Heat escalates Watchers → Envoys → armies → war on institutions. Endings: annihilate, usurp, reform, unseal.

**NPCs (slice):** Calder Renn, Sister Vale, Ash-Scribe Orun, Inquisitor Mael.

---

## 4. Core Loop

`Base manage → Prepare → Expedition → Capture/Combat → Process → Progression/Heat`

Early: survive + 1–3 workers.  
Mid: biomes, path, mounts, automation chains.  
Late: territory, elites, institutional war.

---

## 5. Capture & Combat

**FSM:** Aggro → Soften → Opportunity (Bond Ring) → Method → Resolve  

**Methods:** snare, bait, bond, pact, brand, sever-bind…  

**Math:** see `data/capture-math.md` and Tools capture calculator.

**Combat:** Third-person action; player mage + beast commands (attack/guard/ability/withdraw/sacrifice).

**Field party (slice):** up to 2 beasts + player.

---

## 6. Beasts

12 slice beasts fully specified in `data/beasts.json` and `docs/25-beast-cards-slice.md`.

| ID | Name | Soften essence |
|----|------|----------------|
| B01 | Glimmerpouch | Shiny bait |
| B02 | Brushback Boar | Charge whiff |
| B03 | Lantern Hare | Calm + light |
| B04 | Cinderscale | Cool overheat |
| B05 | Hearthkin | Ethics fork |
| B06 | Mirelurk Stag | Plate + cleanse |
| B07 | Bogwhisper | Silence croon |
| B08 | Verdant Sprawler | Feed / no fire |
| B09 | Ridgespire | Pride duel |
| B10 | Umbracourse | Night window |
| B11 | Skyreel | Cargo puzzle |
| B12 | Ashcrown | Ordered plates |

Workforce stations + recipes: `data/recipes.json`.

---

## 7. Magic

Slice spells: `data/spells.json`.  
Resources: mana + strain.  
Seal Echo zones weaken player spells; beasts remain strong.  
Grimoire pages = exploration + co-op trade glue.

---

## 8. Base

Modules: shelter, storage, benches, pens, lumber, smelter, still, greenhouse, wards, path shrine/brandpit, magma forge.  
Automation via beast jobs + upkeep.  
Raids at higher Heat.

---

## 9. Multiplayer

Listen-server friends co-op first.  
Bind contribution score for contested catches.  
Shared bases with permissions.  
Configurable PvP later.

---

## 10. Heat & Endgame

Heat actions in `data/recipes.json`.  
Early teaching required (pamphlet, Watcher, tower pip).  
War is systemic climax using player base + beasts + path.

---

## 11. World (slice)

- **Thornwake Glade** — onboarding  
- **Blackvein Mire** — prep/poison contrast  
POIs: Discarding Stones, shrines, dens, sunken ruins.

---

## 12. Production

Tickets: `docs/22-prototype-tickets.md`  
Tech: `docs/26-tech-architecture.md`  
Playtest: `docs/27-playtest-protocol.md`  
Calendar/budget: `production/`  
Data-driven content: `data/`  
Tools: `tools/index.html`

---

## 13. Non-Goals (launch / announce)

Breeding depth · 100+ dex · megaservers · romance · gacha beasts · school sim schedule · official “Franchise X meets Y” copy  

---

## 14. Success

**Slice:** “I want one more expedition.”  
Unaided recall: capture methods differ · beasts work · Council watches.
