# UE5 Content Map (proposed)

```
/Eldermoor
  /Content
    /Core          GameModes, Save, Input, Cameras
    /Player        Character, AnimBP, Wand
    /Beasts
      /_Data       DA_Beast_*, DT_Beasts
      /B01_Glimmerpouch
      /B02_Brushback
      ...
    /Capture       BondRing UI, Method components, FSM
    /Magic         Spells, Strain, SealEcho volumes
    /Base          Build pieces, Stations, ProductionComponent
    /Heat          NotorietyComponent, Events
    /World
      /Thornwake
      /Blackvein
      /POIs
    /UI            HUD, Workforce, Dex, Grimoire, Journal
    /Audio         MetaSounds, Music stems
    /Dev           Proto maps, test harnesses
  /Docs            symlink or copy of mages/docs for team
```

## Naming
- DataAssets: `DA_Beast_B01_Glimmerpouch`  
- Blueprints: `BP_BeastBase`, `BP_Station_Lumber`  
- Maps: `MAP_Proto_Glade`, `MAP_Slice_Full`  

## Import from JSON
At editor time, Python or Blutility can ingest `data/beasts.json` → DataTable rows.  
**Do not dual-edit forever** — pick JSON→DT pipeline or DT as master after import.
