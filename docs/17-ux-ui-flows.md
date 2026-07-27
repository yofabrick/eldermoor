# 17 — UX / UI Flows

## Design Principles
1. **One glance base health** — food, defense, idle beasts.  
2. **Capture is cinematic but controllable** — never lose input for 10s.  
3. **Assign work in < 3 clicks.**  
4. **Path identity visible** without shaming the other path.  
5. Keyboard/mouse first; controller maps planned.

---

## HUD (field)

```
[HP] [Mana] [Strain]          [Compass / Heat pip]
[Quick potions]               [Quest / pin]
[Beast1][Beast2][Beast3]      [Weapon/spell wheel hint]
                [Interact prompt]
```

- **Heat pip:** small Council eye that opens as notoriety rises.  
- **Opportunity window:** center Bond Ring, species-colored.

## HUD (base)
- Build menu radial  
- Workforce panel (list: name, job, mood/control, upkeep)  
- Production ticks as subtle +icons  
- Defense alert banner

---

## Critical Flows

### A. Capture success → integration
1. VFX bind  
2. Name roll (accept / reroll limited / custom)  
3. Modal: **Party** | **Workforce** | **Pen only**  
4. If workforce: job picker with recommended tag  
5. Dex entry unlock toast  

### B. Assign work
1. Open pen or workforce  
2. Select beast  
3. Select station (invalid stations greyed with reason: “Needs smelter”)  
4. Confirm — beast pathfinds  

### C. Path ritual
1. Approach amphitheater  
2. Preview mechanical differences (honest tooltips)  
3. Hold-confirm 2s to prevent misclick  
4. World tint + UI chrome swap + recipe mail  

### D. Death
1. Greyout + beast last orders  
2. Map respawn choices: base bed / shrine / ally  
3. Loot drop summary (what lost)

### E. Multiplayer join
1. Invite code / Steam friend  
2. Permission preset: Visitor / Builder / Officer  
3. Drop-in near host base or map edge  

---

## Menus
| Menu | Contents |
|------|----------|
| Journal | Memory shards, notoriety, faction notes |
| Grimoire | Spells, recipes, incomplete pages |
| Dex | Beasts, methods, personal bests |
| Wand bench | Cores, runes, stats preview |
| Settings | Capture assist, gore, thrall intensity, difficulty |

## Accessibility
- Colorblind path palettes (not only green/purple)  
- Flash reduction on capture  
- Combat telegraph shapes not color-only  
- Scalable UI, subtitle lore whispers  

## Onboarding without walls of text
- Ghost hands for first snare placement  
- Calder teaches sell/buy in one exchange  
- Failed captures bark *actionable* tips  

## Tone in UI Copy
Short, dry, slightly cruel:
- “Workforce empty. The trees are laughing.”  
- “Council Heat: Noticed. How flattering.”  
- “Brand successful. Loyalty is a setting.”  
