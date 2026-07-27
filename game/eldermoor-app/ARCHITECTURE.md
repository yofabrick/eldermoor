# Eldermoor — Architecture Contract (v0.8)

Inspired by the Claude-of-Duty harness: **clear ownership**, **shared events**, **feel as a first-class subsystem**.

## Principle
Sequential ownership of coupled concerns beats parallel feature spam.  
If it isn't readable in 2 seconds of play, it isn't done.

## Directory ownership

| Path | Owns | Must not |
|------|------|----------|
| `src/core/` | Types, save, input, campaign, progression | Three meshes |
| `src/render/` | Camera feel, procedural textures, ground | Game rules |
| `src/player/` | Player body, mount | Capture math |
| `src/capture/` | Bond FSM, GlimmerLink, catch math | Base building |
| `src/beasts/` | Meshes, AI, field party | UI DOM |
| `src/world/` | Resources, biomes, world builder | Combat |
| `src/combat/` | Spells, projectiles, boss, raid, Mael | Inventory UI |
| `src/base/` | Stations, workforce | Capture |
| `src/heat/` | Notoriety events | Rendering |
| `src/audio/` | All sound (Web Audio only, no files) | Game state |
| `src/ui/` | DOM HUD, bars, minimap, pause | Three scene graph (except sprites) |
| `src/fx/` | Shake, trails, flash | Rules |
| `src/game/` | Orchestrator only | Low-level mesh construction |

## Cross-system events (vocabulary)
- `gather.progress` / `gather.complete`
- `bind.focus` / `bind.ready` / `bind.channel` / `bind.success` / `bind.fail`
- `combat.hit` / `combat.kill`
- `heat.stage`
- `milestone.complete`

## Feel contract (non-negotiable)
See `FEEL.md`. Every loop must pass:
1. **Readable** — what am I looking at?
2. **Targeted** — what is selected?
3. **Feedback** — did my input land within 100ms?
4. **Consequence** — did the world change?

## Audio
Procedural only (`AudioBus`). No asset files.

## Rendering
Three.js. Prefer procedural canvas/noise textures over flat colors.
