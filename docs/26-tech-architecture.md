# 26 — Tech Architecture (Intent)

Not a final engineering bible — enough to start without painting into corners.

## Recommended Stack
| Layer | Choice | Why |
|-------|--------|-----|
| Engine | **Unreal Engine 5.4+** | Action feel, large world path, Niagara VFX for magic |
| Language | C++ / Blueprint hybrid | Gameplay programmers + designer proto speed |
| Net | Steam sockets → listen server first | Palworld-like friends co-op |
| Data | DataAssets / DataTables for beasts, recipes | Designers edit without recompile |
| AI | StateTree or Behavior Trees + EQS | Workforce jobs + combat stances |
| Save | Slot save + async | Base + beasts + Heat + path flag |
| Input | Enhanced Input | KBM + controller |

Unity 6 alternative: same module boundaries; Netcode for GameObjects or custom Steam.

---

## Module Map

```
[Core] bootstrap, save, input, camera
[Survival] vitals, inventory, gather, craft
[Magic] spells, mana/strain, path flag, seal echo
[Beasts] species def, AI, capture FSM, workforce, party
[Base] build, stations, production ticks, raids
[World] biomes, day/night, hazards, POIs, spawns
[Heat] notoriety, events, institutional AI
[Narrative] journal, shards, NPCs, bark system
[UI] HUD, bond ring, workforce, grimoire, dex
[Online] session, replication, bind score, perms
```

**Dependency rule:** Beasts may depend on Survival + Magic. Online depends on nothing’s *sim* — only replicates authoritative host state in listen-server model.

---

## Capture FSM (code-level states)
`Idle → Aggro → SoftenTrack → Opportunity → MethodChannel → ResolveCatch | ResolveFail | Dead`

Opportunity is a **gated window** computed from Soften predicates (data-driven per species).

---

## Workforce Tick
Server/host timer 1s:
1. For each assigned beast: if pathing OK and mood>0, add job progress  
2. On threshold, grant item to station output inventory  
3. Apply upkeep drain  

Keep logic deterministic for easier MP sync.

---

## Replication Priorities (P3)
| High | Medium | Low |
|------|--------|-----|
| Player transform, HP, cast | Beast combat targets | Cosmetic VFX |
| Capture state of contested beast | Station outputs | Idle anim variants |
| Base module HP on raid | Inventory ops | Foliage |

## Performance Budgets (slice)
- 4 players + 40 active beasts world + 20 workers at base  
- Cap simultaneous full AI combatants on screen (~12)  
- LODs for workers beyond 30m become simplified job dummies  

## Analytics (privacy-respecting, optional)
Events: first_capture, first_worker, path_chosen, heat_stage, session_length, quit_reason_survey  

## Security
Listen-server = trust host. Anti-cheat later for dedicated. No real-money beast economy = less incentive to hack roster.
