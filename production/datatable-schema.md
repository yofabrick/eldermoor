# DataTable / JSON Schema Reference

## Beast row
| Field | Type | Notes |
|-------|------|-------|
| id | string | B01… |
| name | string | display |
| tier | int | 1–3 |
| biome | string | enum |
| pathSynergy | enum | N/V/M |
| pow, wrk, spd, wil | int 1–5 | relative |
| hp | int | |
| catchBase | float 0–1 | |
| workTags | string[] | |
| combatTags | string[] | |
| softenKey | string | designer id |
| softenRules | json | predicates |
| bestMethods | string[] | |
| failLesson | string | UI tip |
| upkeepFodderPerHour | float | |
| mount | bool | |
| elite | bool | |
| fieldSlots | int | |

## Spell row
id, name, type, mana, strain, unlock, role, tags[]

## Station row
id, tier, jobs[], input[], output[], secondsPerOutput

## Heat action row
action, heatDelta

## Soften predicate vocabulary
`has_item:X` `part_broken:X` `status:X` `near:X` `time:night` `recent:X` `interrupt:X` `fed:X` `quest:X` `pride_duel:X` `puzzle:X` `enrage_stacks_lt:N` `parts_broken_ordered:a,b,c` `forbids:…` `requiresAny:…`
