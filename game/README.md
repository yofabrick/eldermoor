# Eldermoor — Game code

Playable browser prototype and related game sources for the **First Sealbreak** slice.

## Playable prototype

**→ [`eldermoor-app/`](eldermoor-app/)** — Vite + TypeScript + Three.js greybox

Full controls, save system, design pillars, and limitations:  
**[`eldermoor-app/README.md`](eldermoor-app/README.md)**

### Quick start

```bash
cd eldermoor-app
npm install
npm run dev
```

Then open the local URL (typically `http://localhost:5173`).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

### What you should feel in ~15 minutes

1. **Gather** resources in the wild  
2. **Capture** with the Bond Ring (not pure HP-threshold spam)  
3. **Assign** a beast to work and see production  
4. **Watch** Council Heat rise as you grow  

## Design package

GDD, data tables, narrative, pitch, and production plans live one level up:

- [`../docs/`](../docs/) — GDD 00–32 + Master GDD  
- [`../data/`](../data/) — beasts, spells, threats, recipes  
- [`../tools/index.html`](../tools/index.html) — interactive Dex / capture math / heat sim  
- [`../START_HERE.md`](../START_HERE.md) — recommended reading order  

## Layout

```
game/
  README.md              ← this file
  eldermoor-app/         ← run the prototype here
  src/                   ← shared/module stubs (optional mirror)
  public/
```
