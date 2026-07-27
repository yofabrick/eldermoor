# Changelog

## v0.9.1 — Clarity + feel (bind/lift/help)
- German soften reasons (actionable)
- Target emissive highlight + abduction lift while holding F
- Help strip always answers "what now?"
- Low-HP / channel vignette
- ACES tone mapping + soft shadows
- Player ground blob shadow

## v0.9.0 — Orchestrated polish (viewmodel, telegraphs, world)
- 6 parallel agents: ViewmodelWand, TreeFactory/materials, BossTelegraph, ImpactDecals+Muzzle, AmbientProps, BindChannelBar
- FPS-style viewmodel wand (tiers, cast kick, tip beam origin)
- Boss breath/stomp telegraphs before damage
- Procedural tree/rock/bush materials + ambient prop scatter
- Bind channel hold bar UI + muzzle flash + ground decals

## v0.8.0 — Claude-of-Duty care pass
- ARCHITECTURE.md + FEEL.md contracts
- **Glimmer bind loop**: look-select, hold F channel, beam modes, crosshair states
- Feel camera (bob/FOV), hitmarkers, procedural grass, bind hum + footsteps + ambience
- Crosshair reacts to focus/ready/channel

## v0.7.0 — Mael, progression, minimap, pause
- **Inquisitor Mael** duel at Heat 50+ (arrive → duel → retreat/kill)
- **Wand progression** (3 tiers, U key / pause menu)
- **Beast bond levels** from field combat
- **Minimap** with POIs and elites
- **Esc pause menu** with campaign checklist
- Spell particle bursts, autosave ~90s, save v2 (wand + milestones)
- Campaign milestones expanded (mael, wand)

## v0.6.0 — Boss, raids, mount, campaign
- **Ashcrown boss**: arena, plates, enrage, breath cones, capture window
- **Night raids** at Heat 40+/75: multi-wave Grey-Gold attackers, tower HP
- **Ridgespire mount** (M) with gallop camera
- **Campaign milestones** with rewards (9-step arc)
- Camera shake, boss/raid SFX hooks, Thorn plate-break focus
- B09 species + mesh

## v0.5.1 — Field party, Mire, combat juice
- Field party: up to 2 beasts fight beside you (X / C menu)
- Blackvein Mire zone (NW): fog, dead trees, poison, B06/B07 spawns
- World HP bars, hit flashes, build ghost preview
- Craft fodder (G), essence on kills, auto-field on capture
- Better party HUD (field vs job)

## v0.5 — Playable browser prototype
- Full Three.js / Vite / TypeScript game in `game/eldermoor-app`
- Parallel-built systems: world, beasts, capture, base, combat, heat, audio, FX
- Loop: gather → Bond Ring capture → workforce → Heat / Watcher / path / Seal Echo
- Tutorial spawns, objective compass, local save, production build green
- Dev server: `npm run dev` → http://127.0.0.1:5173/

## v0.4 — Data, tools, narrative, production (major)
- Machine-readable `data/beasts.json` (12, unique Soften keys, stats, rules), `spells.json`, `threats.json`, `recipes.json`
- Capture math implementation contract + interactive calculator
- Tools hub: Dex browser, heat simulator, demo checklist (`tools/index.html`)
- Master GDD (md + PDF)
- Signature mechanics lock doc (32)
- Full narrative pack (journal, barks, scenes, Mael)
- Production: 12-week calendar, budget skeleton, UE5 content map, datatable schema
- Steam store mock HTML
- Art: Ashcrown Whelp, Hearthkin
- START_HERE entrypoint
- Validated JSON integrity

## v0.3 — Production-minded depth
- Red team, tickets, architecture, playtest, audio, legal, a11y
- Beast cards, spells/items, threats, interactive design bible
- Bind score, early Heat, Seal Echo

## v0.2 — Depth pass
- Roster, biomes, capture FSM, beats, economy, UX, pitch deck

## v0.1 — Foundation
- High concept, systems, initial art
