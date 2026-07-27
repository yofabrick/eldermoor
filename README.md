# ELDERMOOR · Concept Package **v0.4**

> A discarded mage binds beasts, builds an enclave, chooses **Vita or Mortis**, and grows until the **High Council** declares war.

**Status:** Design + data + tools + narrative + production plan + **browser greybox prototype**.  
**IP:** Original. Not affiliated with any wizarding franchise.

---

## Playable prototype

A **Vite + TypeScript + Three.js** greybox for the First Sealbreak loop (gather → Bond Ring capture → beast labor → Council Heat → Vita/Mortis).

| | |
|--|--|
| **Location** | [`game/eldermoor-app/`](game/eldermoor-app/) |
| **Full docs** | [`game/eldermoor-app/README.md`](game/eldermoor-app/README.md) · [`game/README.md`](game/README.md) |

### Run it

```bash
cd game/eldermoor-app
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

- **WASD** move · **Mouse** look (click to lock) · **Space** dash  
- **E** gather · **F** capture · **1–4** spells · **B** build · **C** assign work · **V** path ritual  
- Progress saves to browser `localStorage` (`eldermoor_save_v1`)

This is a scaffolded greybox, not shipping art or multiplayer. See the prototype README for pillars and known limitations.

---

## Open this first

| Priority | File |
|----------|------|
| **0** | **[`game/eldermoor-app/`](game/eldermoor-app/)** — playable prototype (`npm install` · `npm run dev`) |
| **1** | [`START_HERE.md`](START_HERE.md) |
| **2** | [`tools/index.html`](tools/index.html) — Dex, capture math, heat sim |
| **3** | [`docs/MASTER-GDD.md`](docs/MASTER-GDD.md) · [PDF](pitch/eldermoor-master-gdd.pdf) |
| **4** | [`pitch/design-bible.html`](pitch/design-bible.html) |
| **5** | [`docs/22-prototype-tickets.md`](docs/22-prototype-tickets.md) |

German: [`KURZBRIEF.md`](KURZBRIEF.md)

---

## What “much better” means in v0.4

| Layer | Deliverable |
|-------|-------------|
| **Data** | `data/beasts.json`, `spells.json`, `threats.json`, `recipes.json` + capture math contract |
| **Tools** | Interactive Dex / calculator / heat sim / demo checklist |
| **Master docs** | Single Master GDD + PDF export |
| **Narrative** | Journal, barks, scenes, Mael voice sheet |
| **Production** | 12-week calendar, budget skeleton, UE5 map, schemas |
| **Signature lock** | Five non-negotiable mechanics (`docs/32`) |
| **Pitch** | Deck, Steam mock, one-pager, design bible |

### Five signature mechanics
1. Bond Ring capture (unique Soften keys)  
2. Beast labor economy  
3. Council Heat (taught early)  
4. Vita / Mortis identity  
5. Seal Echo zones  

### Demo Law
By minute 15: **capture skill · working beast · Heat foreshadow**.

---

## Folder map

```
mages/
  START_HERE.md
  README.md · KURZBRIEF.md · CHANGELOG.md
  data/           machine-readable game data
  tools/          interactive design desk (HTML)
  docs/           GDD 00–32 + MASTER-GDD
  narrative/      writing samples
  production/     schedule, budget, UE map, schemas
  pitch/          deck, PDF, steam mock, bible
  art/            key visuals
  game/           playable prototype (eldermoor-app)
```

---

## Vertical slice — First Sealbreak
Thornwake Glade + Blackvein Mire · 12 beasts (JSON) · path fork · co-op 4 · Ashcrown · early Heat  

## Next real step
**P0 greybox** lives in [`game/eldermoor-app/`](game/eldermoor-app/): gather → Bond Ring catch → lumber job → save/load → Gate A playtest.  
Calendar: `production/12-week-calendar.md`.
