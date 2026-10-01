import * as THREE from 'three';
import { Input } from '../core/Input';
import { saveGame, loadGame, hasSave, clearSave } from '../core/Save';
import {
  emptyInventory,
  type Inventory,
  type OwnedBeast,
  type PathFlag,
  type Station,
  type WildBeast,
  type CaptureMethod,
  type GameSave,
} from '../core/types';
import { Hud } from '../ui/Hud';
import { Player } from '../player/Player';
import { WorldBuilder } from '../world/WorldBuilder';
import { DayNight } from '../world/DayNight';
import { spawnResources, tryGather, gatherPrompt } from '../world/Resources';
import { ResourceLabels } from '../world/ResourceLabels';
import { createWildBeast } from '../beasts/BeastFactory';
import { BeastAI, applyDamageToBeast } from '../beasts/BeastAI';
import { FieldParty, toggleFieldSlot } from '../beasts/FieldParty';
import { CaptureController } from '../capture/CaptureController';
import { GlimmerLink, pickBindTarget } from '../capture/GlimmerLink';
import { createStationMesh, canAfford, pay, buildCosts } from '../base/Stations';
import { Workforce } from '../base/Workforce';
import { StationWorkers } from '../base/StationWorkers';
import { castSpell, type SpellId, SPELL_ORDER, SPELLs } from '../combat/Spells';
import { ProjectileSystem } from '../combat/Projectiles';
import { getCombatAim, getWardTarget } from '../combat/Aim';
import { HeatSystem } from '../heat/HeatSystem';
import { WorldEvents } from '../heat/Events';
import { SPECIES, STARTER_SPAWNS } from '../data/species';
import { AudioBus } from '../audio/AudioBus';
import { FloatingTextSystem } from '../fx/FloatingText';
import { flashMesh } from '../fx/HitFlash';
import { CameraShake } from '../fx/CameraShake';
import { FeelCamera } from '../render/FeelCamera';
import { BeastBars } from '../ui/BeastBars';
import { HitMarker } from '../ui/HitMarker';
import { Crosshair } from '../ui/Crosshair';
import { BindChannelBar } from '../ui/BindChannelBar';
import { buildMireZone, animateMire, isInMire, type MireZoneResult } from '../world/MireZone';
import { scatterAmbientProps, createDiscardingStoneGlow } from '../world/AmbientProps';
import { BossAshcrown } from '../combat/BossAshcrown';
import { RaidNight } from '../combat/RaidNight';
import { InquisitorMael } from '../combat/InquisitorMael';
import { MountSystem } from '../player/Mount';
import { ViewmodelWand } from '../player/ViewmodelWand';
import { Campaign } from '../core/Campaign';
import { WandProgression, gainBondXp } from '../core/Progression';
import { SpellTrails } from '../fx/SpellTrails';
import { ImpactDecals } from '../fx/ImpactDecals';
import { WandMuzzle } from '../fx/MuzzleFlash';
import { TargetHighlight } from '../fx/TargetHighlight';
import { Minimap } from '../ui/Minimap';
import { PauseMenu } from '../ui/PauseMenu';
import { HelpStrip } from '../ui/HelpStrip';
import { Vignette } from '../ui/Vignette';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STATION_DE: Record<Station['kind'], string> = {
  bed: 'Bett',
  storage: 'Lager',
  pen: 'Pferch',
  lumber: 'Sägeplatz',
  workbench: 'Werkbank',
  smelter: 'Schmelze',
  tower: 'Wachturm',
};

const JOB_DE: Record<string, string> = {
  lumber: 'Sägeplatz',
  smelt: 'Schmelze',
  scout: 'Spähen',
  haul: 'Schleppen',
  guard: 'Wache',
  idle: 'Ruhe',
};

function makeStationLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(12,10,18,0.82)';
  ctx.beginPath();
  ctx.roundRect(12, 10, 232, 44, 10);
  ctx.fill();
  ctx.strokeStyle = '#c9a66b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  spr.position.y = 2.1;
  spr.scale.set(1.6, 0.4, 1);
  spr.renderOrder = 9;
  return spr;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private hud = new Hud();
  private clock = new THREE.Clock();
  private running = false;

  private player!: Player;
  private world!: ReturnType<WorldBuilder['build']>;
  private dayNight = new DayNight();
  private resources: ReturnType<typeof spawnResources> = [];
  private wild: WildBeast[] = [];
  private beastAI = new BeastAI();
  private capture = new CaptureController();
  private glimmer!: GlimmerLink;
  private focusBeast: WildBeast | null = null;
  private owned: OwnedBeast[] = [];
  private stations: Station[] = [];
  private workforce = new Workforce();
  private projectiles!: ProjectileSystem;
  private heat = new HeatSystem();
  private events = new WorldEvents();
  private inv: Inventory = emptyInventory();
  private path: PathFlag = 'none';
  private audio = new AudioBus();
  private floatText!: FloatingTextSystem;
  private spellCd: Record<SpellId, number> = { bolt: 0, ward: 0, bind: 0, thorn: 0 };
  private selectedSpell: SpellId = 'bolt';
  private buildMode: Station['kind'] | null = null;
  private tutorialStep = 0;
  private shrinePos = new THREE.Vector3();
  private amphPos = new THREE.Vector3();
  /** Invisible Seal Echo hazard — formulas thin inside this radius. */
  private sealEchoPos = new THREE.Vector3(-30, 0, 25);
  private readonly sealEchoRadius = 12;
  private sealEchoToasted = false;
  private watcherMesh: THREE.Object3D | null = null;
  private captureCooldown = 0;
  private lastBondToast = 0;
  private lastFullToast = 0;
  private playTime = 0;
  private objective = 'Sammle HOLZ (braune Stämme mit Ring) — drüberlaufen';
  private fieldParty!: FieldParty;
  private stationWorkers!: StationWorkers;
  private beastBars!: BeastBars;
  private resourceLabels!: ResourceLabels;
  private mire: MireZoneResult | null = null;
  private mireToasted = false;
  private mirePoisonAccum = 0;
  private buildGhost: THREE.Object3D | null = null;
  private boss: BossAshcrown | null = null;
  private raid!: RaidNight;
  private mount!: MountSystem;
  private shake = new CameraShake();
  private campaign = new Campaign();
  private towerHp = 100;
  private maxTowerHp = 100;
  private mael!: InquisitorMael;
  private wand = new WandProgression();
  private trails!: SpellTrails;
  private minimap = new Minimap();
  private pause = new PauseMenu();
  private hitMarker = new HitMarker();
  private crosshair = new Crosshair();
  private feelCam!: FeelCamera;
  private viewWand!: ViewmodelWand;
  private wandMuzzle = new WandMuzzle();
  private impactDecals!: ImpactDecals;
  private bindBar = new BindChannelBar();
  private targetFx = new TargetHighlight();
  private helpStrip = new HelpStrip();
  private vignette = new Vignette();
  private castTimer = 0;
  private lastFocusId: string | null = null;
  private paused = false;
  private autoSaveTimer = 0;
  private maelSummoned = false;
  private _nearGather: {
    node: import('../core/types').ResourceNode | null;
    gained: string | null;
    full?: boolean;
    kind?: import('../core/types').ResourceNode['kind'];
  } = { node: null, gained: null };

  constructor(canvasParent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Higher exposure — scene was crushed by dark fog + low ambient
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasParent.insertBefore(this.renderer.domElement, canvasParent.firstChild);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.input = new Input(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.bindUi();
    this.pause.onResume = () => {
      this.paused = false;
    };
    this.pause.onUpgradeWand = () => this.upgradeWand();
  }

  private bindUi() {
    document.getElementById('btn-start')!.onclick = () => {
      void this.audio.resume();
      clearSave();
      this.startNew();
    };
    document.getElementById('btn-continue')!.onclick = () => {
      void this.audio.resume();
      if (hasSave()) this.startLoad();
      else {
        this.hud.toast('Kein Speicherstand — Neustart.');
        this.startNew();
      }
    };
    document.getElementById('btn-save')!.onclick = () => this.persist();
    document.getElementById('btn-build')!.onclick = () => this.cycleBuild();
    document.getElementById('btn-path')!.onclick = () => this.openPath();
    document.getElementById('pick-vita')!.onclick = () => this.choosePath('vita');
    document.getElementById('pick-mortis')!.onclick = () => this.choosePath('mortis');
    document.getElementById('path-cancel')!.onclick = () => {
      document.getElementById('path-modal')!.classList.remove('show');
    };
    document.getElementById('assign-close')!.onclick = () => {
      document.getElementById('assign-modal')!.classList.remove('show');
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.running) {
        this.paused = this.pause.toggle();
        if (this.paused) this.pause.refresh(this.campaign, this.wand);
      }
    });
  }

  private startNew() {
    this.resetWorld(null);
  }

  private startLoad() {
    this.resetWorld(loadGame());
  }

  private resetWorld(save: GameSave | null) {
    // Subsystem teardown BEFORE scene wipe (workstream L — no camera-parented leaks)
    this.clearBuildGhost();
    try {
      this.beastBars?.clear?.();
    } catch {
      /* first boot */
    }
    try {
      this.resourceLabels?.clear?.();
    } catch {
      /* first boot */
    }
    try {
      this.fieldParty?.clear?.();
    } catch {
      /* first boot */
    }
    try {
      this.stationWorkers?.clear?.();
    } catch {
      /* first boot */
    }
    // Viewmodel is parented to camera — must dispose before new ViewmodelWand
    try {
      this.viewWand?.dispose?.();
    } catch {
      /* first boot */
    }

    // Clear scene children + dispose GPU resources
    while (this.scene.children.length) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
      obj.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry?.dispose?.();
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) {
            if (!m) continue;
            const mapKeys = [
              'map',
              'emissiveMap',
              'normalMap',
              'roughnessMap',
              'metalnessMap',
              'alphaMap',
            ] as const;
            for (const k of mapKeys) {
              const tex = (m as THREE.MeshStandardMaterial)[k];
              if (tex && typeof (tex as THREE.Texture).dispose === 'function') {
                (tex as THREE.Texture).dispose();
              }
            }
            m.dispose?.();
          }
        }
      });
    }

    this.world = new WorldBuilder().build(this.scene);
    this.shrinePos.copy(this.world.shrinePos);
    this.amphPos.copy(this.world.amphitheaterPos);
    // Ambient density + landmark glow
    scatterAmbientProps(this.scene, this.world.bounds, THREE, {
      seed: 42,
      landmarks: [
        this.world.shrinePos.clone(),
        this.world.amphitheaterPos.clone(),
        new THREE.Vector3(6, 0, -4),
      ],
    });
    this.scene.add(createDiscardingStoneGlow(THREE, new THREE.Vector3(6, 0, -4)));
    // Dedicated Seal Echo locus (falls back near amphitheater theme)
    this.sealEchoPos.set(-30, 0, 25);
    this.sealEchoToasted = false;
    this.resources = spawnResources(this.scene, 60);
    this.impactDecals = new ImpactDecals(this.scene);
    this.projectiles = new ProjectileSystem(this.scene);
    this.floatText = new FloatingTextSystem(this.scene, this.camera);
    this.fieldParty?.clear?.();
    this.stationWorkers?.clear?.();
    this.fieldParty = new FieldParty(this.scene);
    this.stationWorkers = new StationWorkers(this.scene);
    this.stationWorkers.onChop = () => this.audio.playChop();
    this.beastBars = new BeastBars(this.scene);
    this.resourceLabels = new ResourceLabels(this.scene);
    this.glimmer = new GlimmerLink(this.scene);
    this.focusBeast = null;
    this.mire = buildMireZone(this.scene);
    this.mireToasted = false;
    this.mirePoisonAccum = 0;
    this.clearBuildGhost();
    this.boss = null;
    this.raid = new RaidNight(this.scene);
    this.mount = new MountSystem(this.scene);
    this.mael = new InquisitorMael(this.scene);
    this.trails = new SpellTrails(this.scene);
    this.campaign = new Campaign();
    this.wand = new WandProgression();
    this.towerHp = 100;
    this.shake = new CameraShake();
    this.maelSummoned = false;
    this.autoSaveTimer = 0;
    this.paused = false;
    this.pause.setOpen(false);
    this.wild = [];
    this.owned = [];
    this.stations = [];
    this.watcherMesh = null;
    this.capture.cancel();
    this.buildMode = null;
    this.path = 'none';
    this.inv = emptyInventory();
    this.heat = new HeatSystem();
    this.events = new WorldEvents();
    this.tutorialStep = 0;

    const spawn = this.world.spawnPos.clone();
    if (save) {
      spawn.set(save.player.x, 0, save.player.z);
      this.inv = { ...emptyInventory(), ...save.inventory };
      this.path = save.path;
      this.heat = new HeatSystem(save.heat, save.watcherSeen);
      this.events.setWatcherSeen(save.watcherSeen);
      this.dayNight.timeOfDay = save.timeOfDay;
      this.tutorialStep = save.tutorialStep;
      this.owned = save.owned.map((o) => ({
        ...o,
        bondLevel: o.bondLevel ?? 0,
        bondXp: o.bondXp ?? 0,
      }));
      this.wand.tier = save.wandTier ?? 0;
      if (save.milestonesDone) this.campaign.loadDone(save.milestonesDone);
      if (save.maelDefeated) {
        this.maelSummoned = true;
        this.mael.phase = 'defeated';
      }
      for (const s of save.stationsBuilt) {
        this.placeStation(s.kind, new THREE.Vector3(s.x, 0, s.z), true);
      }
      // Re-link workers to stations from owned.job (assignedBeastUid not in save blob)
      for (const o of this.owned) {
        if (o.job === 'lumber') {
          const st = this.stations.find((s) => s.kind === 'lumber' && !s.assignedBeastUid);
          if (st) st.assignedBeastUid = o.uid;
        } else if (o.job === 'smelt') {
          const st = this.stations.find((s) => s.kind === 'smelter' && !s.assignedBeastUid);
          if (st) st.assignedBeastUid = o.uid;
        }
      }
    }

    this.player = new Player(this.scene, this.camera, spawn);
    // Hide world-space wand on body — viewmodel is the focus
    this.player.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh && c.geometry?.type === 'CylinderGeometry') {
        const g = c.geometry as THREE.CylinderGeometry;
        // crude: hide thin cylinders (wand) on body
        if (g.parameters && g.parameters.radiusTop < 0.05) c.visible = false;
      }
    });
    this.feelCam = new FeelCamera(this.camera);
    this.viewWand = new ViewmodelWand(this.camera);
    this.viewWand.setTier(Math.min(2, this.wand.tier) as 0 | 1 | 2);
    // Muzzle on tip — attach via temporary anchor updated each frame if needed
    // WandMuzzle attaches to object; we create a tip anchor under viewmodel
    this.wandMuzzle.attach(this.viewWand.root);
    this.crosshair.show(true);
    this.bindBar.setVisible(false);
    if (save) {
      this.player.hp = save.player.hp;
      this.player.mana = save.player.mana;
      this.player.strain = save.player.strain;
      this.viewWand.setTier(Math.min(2, this.wand.tier) as 0 | 1 | 2);
    }

    // Tutorial Glimmerpouch near spawn (easy first bind) — gold halo so it reads at a glance
    const tutor = createWildBeast(
      'B01',
      spawn.clone().add(new THREE.Vector3(4, 0, -6)),
      THREE,
    );
    const tutorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    tutorRing.rotation.x = -Math.PI / 2;
    tutorRing.position.y = 0.04;
    tutor.mesh.add(tutorRing);
    tutor.mesh.userData.tutorialStarter = true;
    this.scene.add(tutor.mesh);
    this.wild.push(tutor);

    // Brushback nearby for first worker fantasy
    const boar = createWildBeast(
      'B02',
      spawn.clone().add(new THREE.Vector3(-8, 0, 10)),
      THREE,
    );
    this.scene.add(boar.mesh);
    this.wild.push(boar);

    // Spawn wild beasts across the glade
    const rng = (i: number) => {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      return a - Math.floor(a);
    };
    STARTER_SPAWNS.forEach((sid, i) => {
      if (sid === 'B12') return;
      const ang = rng(i) * Math.PI * 2;
      const rad = 18 + rng(i + 3) * 50;
      const pos = new THREE.Vector3(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      const b = createWildBeast(sid, pos, THREE);
      this.scene.add(b.mesh);
      this.wild.push(b);
    });
    // Ashcrown elite den + boss controller
    const elite = createWildBeast('B12', new THREE.Vector3(48, 0, -52), THREE);
    this.scene.add(elite.mesh);
    this.wild.push(elite);
    this.boss = new BossAshcrown(elite, this.scene);
    this.boss.onTelegraphStart = (shape, duration) => {
      this.audio.playHeat();
      this.shake.add(shape === 'cone' ? 0.2 : 0.12);
      this.feelCam.addPunch(0.1);
      void duration;
    };

    // Ridgespire mount near cliffs SE
    const ridge = createWildBeast('B09', new THREE.Vector3(35, 0, 40), THREE);
    this.scene.add(ridge.mesh);
    this.wild.push(ridge);

    // Mire natives
    if (this.mire) {
      const mireSpawns: [string, number, number][] = [
        ['B06', -50, 38],
        ['B06', -58, 48],
        ['B07', -62, 35],
        ['B07', -48, 50],
        ['B04', -54, 42],
      ];
      for (const [sid, x, z] of mireSpawns) {
        const b = createWildBeast(sid, new THREE.Vector3(x, 0, z), THREE);
        this.scene.add(b.mesh);
        this.wild.push(b);
      }
    }

    // Seal Echo visual (broken ward ring)
    this.spawnSealEchoMarker();

    // Restore field party + station workers after load
    if (save) {
      this.fieldParty.sync(this.owned);
      this.stationWorkers.sync(this.owned, this.stations);
    }

    if (!save) {
      this.inv.chalk_snare = 4;
      this.inv.shiny_tin_bait = 3;
      this.inv.wood = 2;
      this.hud.toast(
        'Unlisted · Verwerfungssteine. HOLZ: über braune Stämme laufen · dann goldenen Glimmerpouch ansehen.',
      );
      this.hud.setJournal(
        '1) Holz/Stein drüberlaufen  2) goldenen Glimmerpouch ansehen → grüner Strahl → F halten  3) Bauen (B) · Arbeiter (C). Rot = Gegner · Grün = Begleiter.',
      );
      this.objective = 'Sammle HOLZ (drüberlaufen) · dann Glimmerpouch binden (F halten)';
    }

    this.hud.showGameUi(true);
    this.minimap.show(true);
    this.helpStrip.show(true);
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.playTime += dt;
    // Soft camp ambience every ~18s (AudioBus character)
    if (Math.floor(this.playTime / 18) !== Math.floor((this.playTime - dt) / 18)) {
      this.audio.playCampAmbience();
    }
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer > 90) {
      this.autoSaveTimer = 0;
      this.persist(true);
    }
    this.captureCooldown = Math.max(0, this.captureCooldown - dt);
    // Wand mana regen bonus
    this.player.maxMana = 100 * this.wand.manaMul;

    const sun = this.scene.getObjectByName('sun') as THREE.DirectionalLight | undefined;
    const hemi = this.scene.getObjectByName('hemi') as THREE.HemisphereLight | undefined;
    this.dayNight.update(dt, sun, hemi, this.scene);
    // Camp fire brighter at dusk (cozy pocket vs global moon fill)
    const duskW = this.dayNight.duskWarmth();
    if (duskW > 0.05) {
      const stones = this.scene.getObjectByName('discardingStones');
      const cl = stones?.getObjectByName('campLight');
      if (cl instanceof THREE.PointLight) {
        cl.userData.duskBoost = 1 + duskW * 0.85;
      }
    }

    this.player.update(dt, this.input, this.world.bounds);

    // Camera feel (bob / FOV)
    const spd = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const moving = spd > 0.4;
    const sprinting = this.input.pressed('Space') && spd > 1;
    this.feelCam.update(dt, {
      speed: spd,
      sprinting,
      mounted: this.mount.mounted,
      moving,
    });
    // Bind tone: pitch = odds (high=strong), rises while F is held
    {
      const method = this.pickBindMethod(this.focusBeast);
      this.capture.toolTier = this.wand.catchToolTier;
      this.capture.pathAffinity =
        this.path === 'vita' ? 1.05 : this.path === 'mortis' ? 1.08 : 1.0;
      this.capture.tutorialBoost = this.owned.length === 0;
      const fit = this.focusBeast
        ? this.capture.estimateChance(this.focusBeast, method)
        : 0;
      const phase =
        this.capture.state === 'channeling'
          ? 'channel'
          : this.capture.state === 'window' || this._bindSoftenOk
            ? 'ready'
            : this.focusBeast
              ? 'focus'
              : 'off';
      this.audio.tick(dt, {
        bindHum:
          phase === 'channel'
            ? 0.85 + this.capture.channelProgress * 0.15
            : phase === 'ready'
              ? 0.5
              : phase === 'focus'
                ? 0.28
                : 0,
        bindFit: phase === 'off' ? 0.35 : fit,
        channelProgress:
          phase === 'channel' ? this.capture.channelProgress : 0,
        bindPhase: phase,
        night: this.dayNight.isNight() ? 1 : 0.25,
        footstep: moving && !this.mount.mounted,
        sprint: sprinting,
      });
    }

    // Viewmodel wand feel
    this.castTimer = Math.max(0, this.castTimer - dt);
    this.viewWand.update(dt, {
      moving,
      speed: spd,
      casting: this.castTimer > 0,
      channeling: this.capture.state === 'channeling',
      bindReady: this.capture.state === 'window' || this._bindSoftenOk,
      path: this.path,
    });
    this.wandMuzzle.update(dt);
    this.impactDecals.update(dt);

    // Spell cooldowns
    for (const id of SPELL_ORDER) this.spellCd[id] = Math.max(0, this.spellCd[id] - dt);

    // Input actions
    if (this.input.tap('Digit1')) this.selectedSpell = 'bolt';
    if (this.input.tap('Digit2')) this.selectedSpell = 'ward';
    if (this.input.tap('Digit3')) this.selectedSpell = 'bind';
    if (this.input.tap('Digit4')) this.selectedSpell = 'thorn';
    this.hud.setSpellActive(SPELL_ORDER.indexOf(this.selectedSpell) + 1);

    if (this.input.tap('KeyQ')) this.craftSnare();
    if (this.input.tap('KeyG')) this.craftFodder();
    if (this.input.tap('KeyB')) this.cycleBuild();
    if (this.input.tap('KeyC')) this.openAssign();
    if (this.input.tap('KeyV')) this.openPath();
    if (this.input.tap('KeyT')) this.persist();
    if (this.input.tap('KeyX')) this.quickToggleField();
    if (this.input.tap('KeyM')) this.toggleMount();
    if (this.input.tap('KeyU')) this.upgradeWand();

    // Walk-over gather — step on a pile; blocked only when that stack is full
    const g = tryGather(this.resources, this.player.position, this.inv, dt);
    this._nearGather = g;
    if (g.gained) {
      this.audio.playGather();
      this.floatText.spawn(
        this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        g.gained,
        '#7dff9a',
      );
      this.grantMilestone('gather');
      if (this.tutorialStep === 0) {
        this.tutorialStep = 1;
        this.hud.setJournal(
          'Schau den goldenen Glimmerpouch an. Glimmer-Strahl = Ziel. Violett = noch nicht · Grün = F drücken & HALTEN bis 100%.',
        );
      }
    } else if (g.full && g.kind && this.playTime - this.lastFullToast > 2.5) {
      this.lastFullToast = this.playTime;
      this.hud.toast(gatherPrompt(null, false, 0, true, g.kind));
    }
    this.resourceLabels.update(this.resources, this.player.position);

    // Build place
    if (this.buildMode && this.input.tap('KeyE')) {
      this.tryBuildAtPlayer();
    }

    // Combat cast — click (pointer lock) or Z / R
    if ((this.input.pointerLocked && this.input.click()) || this.input.tap('KeyZ') || this.input.tap('KeyR')) {
      this.castSelected();
    }

    // Capture: tap F to start / hold F to channel (abduction)
    if (this.input.tap('KeyF')) this.tryCapture();
    this.capture.holdingChannel = this.input.pressed('KeyF');

    // Mount speed
    const galloping = this.input.pressed('Space');
    this.player.speedMul = this.mount.update(this.player.position, this.player.yaw, galloping);

    // Beasts AI (skip boss — driven by BossAshcrown)
    const isNight = this.dayNight.isNight();
    const inLight = !isNight || this.player.position.distanceTo(this.shrinePos) < 8;
    for (const b of this.wild) {
      if (b.state === 'captured' || b.hp <= 0) continue;
      if (this.boss && b.id === this.boss.beast.id) continue;
      this.beastAI.updateWild(b, this.player.position, dt, { inLight });
      const pending = (b.mesh.userData.pendingDamage as number) || 0;
      if (pending > 0) {
        b.mesh.userData.pendingDamage = 0;
        if (this.player.takeDamage(pending)) {
          this.audio.playHit();
          this.shake.add(0.25);
          flashMesh(this.player.mesh, 0xff4444, 100);
          this.floatText.spawn(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), `-${Math.floor(pending)}`, '#ff6b6b');
        }
      }
    }

    // Boss
    if (this.boss && this.boss.beast.hp > 0 && this.boss.beast.state !== 'captured') {
      this.boss.update(
        dt,
        this.player.position,
        (amount, kind) => {
          if (this.player.takeDamage(amount)) {
            this.shake.add(kind === 'breath' ? 0.55 : 0.35);
            this.audio.playHit();
            flashMesh(this.player.mesh, 0xff6a00, 140);
            this.floatText.spawn(
              this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
              kind === 'breath' ? 'BREATH!' : `-${Math.floor(amount)}`,
              '#ff6a00',
            );
          }
        },
        (msg) => this.hud.toast(msg),
      );
    }

    // Raid night
    const allHostiles = [...this.wild, ...this.raid.getTargets()];
    this.raid.update(
      dt,
      this.heat.heat,
      isNight,
      this.stations,
      this.player.position,
      (msg) => {
        this.hud.toast(msg);
        this.audio.playHeat();
        if (msg.includes('broken') || msg.includes('retreats')) {
          this.grantMilestone('raid');
        }
      },
      (dmg) => {
        this.towerHp = Math.max(0, this.towerHp - dmg);
        this.shake.add(0.2);
        if (this.towerHp <= 0) {
          this.hud.toast('Turm fällt! Mit Holz & Stein neu bauen.');
          // Remove tower station
          const t = this.stations.find((s) => s.kind === 'tower');
          if (t) {
            this.scene.remove(t.mesh);
            this.stations = this.stations.filter((s) => s.id !== t.id);
          }
          this.towerHp = this.maxTowerHp;
        }
      },
    );

    // Inquisitor Mael
    if (!this.maelSummoned && this.heat.heat >= 50) {
      if (this.mael.trySummon(this.heat.heat, this.player.position, (m) => this.hud.toast(m))) {
        this.maelSummoned = true;
        this.audio.playHeat();
        this.shake.add(0.3);
      }
    }
    const maelWasDuel = this.mael.phase === 'duel' || this.mael.phase === 'arrive';
    this.mael.update(
      dt,
      this.player.position,
      (n) => {
        if (this.player.takeDamage(n)) {
          this.shake.add(0.4);
          this.audio.playHit();
          flashMesh(this.player.mesh, 0xc9a227, 120);
        }
      },
      (m) => {
        this.hud.toast(m);
        if (m.includes('withdraws') || m.includes('File updated')) {
          this.grantMilestone('mael');
        }
      },
      (origin, dir, dmg) => {
        this.projectiles.spawn(origin, dir, 'bolt', 26, dmg, 0xc9a227, {});
        this.trails.burst(origin, 0xc9a227, 6, 2);
      },
    );
    if (maelWasDuel && this.mael.phase === 'defeated' && this.mael.hp <= 0) {
      // killed fully — onMaelDown already via takeDamage path
    }

    // Field party vs wild + raiders
    this.fieldParty.update(
      dt,
      this.player.position,
      this.player.forward,
      allHostiles,
      (beast, dmg) => {
        flashMesh(beast.mesh, 0xc9a227, 90);
        this.floatText.spawn(
          beast.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
          `-${Math.floor(dmg)}`,
          '#e8d48b',
        );
        // Bond XP for field beasts
        for (const o of this.owned) {
          if (!o.fieldSlot) continue;
          const msg = gainBondXp(o, 1.2);
          if (msg) this.hud.toast(msg);
        }
        this.handleWildDeath(beast);
      },
      this.owned,
    );

    // Soften window tracking
    this.updateCaptureWindow(dt, inLight);

    // Crosshair reflects bind state (feel)
    if (this.capture.state === 'channeling') this.crosshair.setMode('channel');
    else if (this.capture.state === 'window' || this._bindSoftenOk) this.crosshair.setMode('ready');
    else if (this.focusBeast) this.crosshair.setMode('focus');
    else this.crosshair.setMode('normal');

    // Projectiles — hit wild + raiders; also check Mael manually
    const projectileTargets = [...this.wild, ...this.raid.getTargets()];
    this.projectiles.update(dt, projectileTargets, (beast, dmg, meta) => {
      const scaled = dmg;
      if (this.boss && beast.id === this.boss.beast.id) {
        this.boss.applyBossHit(scaled, scaled > 14 || meta.interrupt === true);
      } else {
        applyDamageToBeast(beast, scaled, scaled > 15);
      }
      flashMesh(beast.mesh, meta.soft ? 0xaa66ff : 0xffe9a8, 100);
      this.shake.add(0.08);
      this.feelCam.addPunch(0.15);
      this.hitMarker.pulse(beast.hp <= 0 ? 'kill' : 'hit');
      this.trails.burst(
        beast.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
        meta.soft ? 0xaa66ff : 0xffe9a8,
        5,
        2,
      );
      this.floatText.spawn(
        beast.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
        `-${Math.floor(scaled)}`,
        '#ffe9a8',
      );
      this.audio.playHit();
      if (meta.soft) beast.calmed = true;
      if (meta.interrupt) {
        beast.overheated = false;
        beast.partBroken = true;
      }
      this.handleWildDeath(beast);
    });
    // Mael projectile proximity damage (player bolts already use system — damage Mael via ray in cast)
    this.trails.update(dt);

    // Mire poison + ambience
    if (this.mire) {
      animateMire(this.mire.group, this.playTime);
      if (isInMire(this.player.position, this.mire.center, this.mire.radius)) {
        if (!this.mireToasted) {
          this.mireToasted = true;
          this.hud.toast('Blackvein-Moor — Giftnebel. Kraut mitnehmen oder bald raus.');
          this.hud.setJournal(
            'Das Moor erinnert sich an ertrunkene Vorlesungen. Hirsche und Sänger warten im Violett.',
          );
          this.grantMilestone('mire');
        }
        this.mirePoisonAccum += dt;
        if (this.mirePoisonAccum >= 2.5) {
          this.mirePoisonAccum = 0;
          if (this.inv.herb > 0) {
            this.inv.herb -= 1;
            this.floatText.spawn(
              this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
              'Kraut schützt',
              '#6bcb8a',
            );
          } else {
            this.player.takeDamage(4);
            this.floatText.spawn(
              this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
              'Gift!',
              '#a78bfa',
            );
          }
        }
      } else {
        this.mirePoisonAccum = 0;
      }
    }

    // Build ghost preview
    this.updateBuildGhost();

    // HP bars: enemies RED, companions GREEN
    this.updateHealthBars();

    // Workforce + visible station workers (Demo Law: beast works while you walk away)
    this.workforce.update(dt, this.owned, this.stations, this.inv, (msg) => {
      this.hud.toast(msg);
      this.audio.playUI();
      if (msg.includes('wood') || msg.includes('Holz')) this.grantMilestone('lumber');
      // Float produce at station (spectacle for Demo Law #2)
      const lumber = this.stations.find((s) => s.kind === 'lumber');
      const smelt = this.stations.find((s) => s.kind === 'smelter');
      const at =
        msg.includes('Holz') && lumber
          ? lumber.position
          : msg.includes('Barren') && smelt
            ? smelt.position
            : this.player.position;
      this.floatText.spawn(
        at.clone().add(new THREE.Vector3(0, 1.8, 0)),
        msg.split('—')[0]?.trim() || msg,
        '#7dff9a',
      );
      if (msg.includes('Holz')) this.pulseStationStack('lumber');
      if (msg.includes('Barren')) this.pulseStationStack('smelter');
    });
    this.stationWorkers.sync(this.owned, this.stations);
    this.stationWorkers.update(dt);

    // Heat events
    const ev = this.events.update(
      dt,
      this.heat.heat,
      this.player.position,
      this.scene,
      isNight,
      this.heat.watcherSeen,
    );
    if (ev.toast) this.hud.toast(ev.toast);
    if (ev.damage) this.player.takeDamage(ev.damage);
    if (ev.spawnPamphlet) this.spawnPamphletNearPlayer();
    if (ev.spawnWatcher) {
      this.spawnWatcher(ev.spawnWatcher);
      this.heat.watcherSeen = true;
      this.events.setWatcherSeen(true);
    }
    // Watcher idle sway (still watching) — elevated ridge read
    if (this.watcherMesh) {
      this.watcherMesh.rotation.y = Math.sin(this.playTime * 0.4) * 0.15;
      const baseY = (this.watcherMesh.userData.baseY as number) ?? 2.2;
      this.watcherMesh.position.y = baseY + Math.sin(this.playTime * 0.8) * 0.04;
    }
    // Campfire multi-layer flicker (outer / mid / inner + embers + light bob)
    const stones = this.scene.getObjectByName('discardingStones');
    if (stones) {
      const flame = stones.getObjectByName('campFlame');
      const mid = stones.getObjectByName('campFlameMid');
      const inner = stones.getObjectByName('campFlameInner');
      const f = 0.9 + Math.sin(this.playTime * 9) * 0.16 + Math.sin(this.playTime * 17) * 0.1;
      if (flame) {
        flame.scale.set(f, f * 1.08, f);
        flame.rotation.y = this.playTime * 0.9;
      }
      if (mid) {
        const fm = 0.92 + Math.sin(this.playTime * 12 + 0.5) * 0.15;
        mid.scale.set(fm, fm * 1.05, fm);
        mid.rotation.y = -this.playTime * 1.1;
      }
      if (inner) {
        const fi = 0.95 + Math.sin(this.playTime * 15 + 1) * 0.2;
        inner.scale.set(fi * 0.85, fi, fi * 0.85);
        inner.rotation.y = this.playTime * 1.4;
      }
      // Ember bob
      for (let ei = 0; ei < 6; ei++) {
        const em = stones.getObjectByName(`campEmber${ei}`);
        if (em) {
          em.position.y = 0.28 + (ei % 3) * 0.08 + Math.sin(this.playTime * 6 + ei) * 0.05;
        }
      }
      const light = stones.getObjectByName('campLight');
      if (light instanceof THREE.PointLight) {
        const duskBoost = (light.userData.duskBoost as number) || 1;
        light.intensity =
          (2.8 + Math.sin(this.playTime * 11) * 0.7 + Math.sin(this.playTime * 19) * 0.35) * duskBoost;
      }
    }

    // Death
    if (this.player.hp <= 0) {
      this.player.hp = this.maxHpSafe();
      const bed = this.stations.find((s) => s.kind === 'bed');
      if (bed) this.player.position.copy(bed.position);
      else this.player.position.copy(this.world.spawnPos);
      this.inv.wood = Math.floor(this.inv.wood * 0.7);
      this.inv.stone = Math.floor(this.inv.stone * 0.7);
      this.hud.toast('Du fällst. Gnade = respawn am Bett — oder den Verwerfungssteinen.');
    }

    // Seal Echo zone (spell damage thin) + one-shot toast
    if (this.inSealEcho()) {
      if (!this.sealEchoToasted) {
        this.sealEchoToasted = true;
        this.hud.toast('Siegel-Echo — deine Formeln dünnen aus. Bestien beißen weiter.');
      }
    }

    // Campaign objective — keep wake DE tutorial until first bind / step 2
    if (this.tutorialStep < 2) {
      this.objective =
        this.tutorialStep === 0
          ? 'Sammle HOLZ (drüberlaufen) · dann goldenen Glimmerpouch ansehen'
          : 'Glimmerpouch: grüner Strahl → F halten · dann bauen (B)';
    } else {
      this.objective = `${this.campaign.nextObjective()}  [${this.campaign.progress()}] · ${this.wand.names[this.wand.tier]}`;
    }

    // Prompt + objective compass
    this.updatePrompt();
    this.updateObjectiveUi();

    // Minimap
    this.minimap.draw({
      player: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw },
      stations: this.stations.map((s) => ({ x: s.position.x, z: s.position.z, kind: s.kind })),
      wild: this.wild
        .filter((w) => w.hp > 0 && w.state !== 'captured')
        .map((w) => ({
          x: w.mesh.position.x,
          z: w.mesh.position.z,
          elite: w.speciesId === 'B12',
        })),
      pois: [
        { x: this.amphPos.x, z: this.amphPos.z, color: '#a78bfa' },
        { x: this.sealEchoPos.x, z: this.sealEchoPos.z, color: '#6bcb8a' },
        ...(this.mire ? [{ x: this.mire.center.x, z: this.mire.center.z, color: '#7c5cbf' }] : []),
        { x: 48, z: -52, color: '#ff6a00' },
        { x: 35, z: 40, color: '#c4b8a0' },
      ],
      worldRadius: this.world.bounds,
    });

    // HUD
    this.hud.setVitals(this.player.hp, this.player.maxHp, this.player.mana, this.player.maxMana, this.player.strain);
    this.hud.setHeat(this.heat.heat);
    this.hud.setInventory(this.inv, this.path);
    this.hud.setParty(this.owned);
    this.hud.update(dt);
    this.floatText.update(dt);
    this.hitMarker.update(dt);
    this.shake.apply(this.camera, dt);

    // Vignette: low HP / channel / ready
    const hpR = this.player.hp / this.player.maxHp;
    if (this.capture.state === 'channeling') this.vignette.set(hpR, 'channel');
    else if (this.capture.state === 'window' || this._bindSoftenOk) this.vignette.set(hpR, 'ready');
    else this.vignette.set(hpR, hpR < 0.35 ? 'hurt' : 'none');

    // Contextual help strip
    if (this.capture.state === 'channeling') {
      this.helpStrip.set(
        `<b>BINDEN:</b> <span class="ok">F halten</span> bis 100% · nicht weglaufen · Glimmer-Strahl = Ziel`,
      );
    } else if (this.focusBeast && !this._bindSoftenOk) {
      this.helpStrip.set(
        `<b>ZIEL:</b> ${SPECIES[this.focusBeast.speciesId]?.name ?? 'Bestie'} · <span class="hint">${this._bindSoftenReason}</span>`,
      );
    } else if (this.focusBeast && this._bindSoftenOk) {
      this.helpStrip.set(
        `<b>BEREIT:</b> <span class="ok">F drücken und halten</span> · grüner Glimmer · Entführung startet`,
      );
    } else if (this._nearGather.full && this._nearGather.kind) {
      this.helpStrip.set(
        `<b>VOLL:</b> <span class="hint">Inventar voll für diesen Rohstoff</span> — bauen/verbrauchen, dann wieder drüberlaufen`,
      );
    } else if (this._nearGather.node) {
      this.helpStrip.set(
        `<b>SAMMELN:</b> <span class="ok">einfach drüberlaufen</span> · Name schwebt am Haufen`,
      );
    } else {
      this.helpStrip.setDefault();
    }

    // Gather milestone
    if (this.inv.wood >= 4) this.grantMilestone('gather');
    if (this.owned.some((o) => o.fieldSlot)) this.grantMilestone('field');

    this.input.endFrame();
  }

  private upgradeWand() {
    const msg = this.wand.tryUpgrade(this.inv);
    this.hud.toast(msg);
    this.audio.playUI();
    if (msg.includes('iron-bound') || msg.includes('Rune') || msg.includes('Focus')) {
      this.grantMilestone('wand');
      this.viewWand.setTier(Math.min(2, this.wand.tier) as 0 | 1 | 2);
      this.viewWand.playBindPulse();
      this.trails.burst(this.wandOrigin(), 0xc9a227, 16, 4);
      this.shake.add(0.2);
      this.player.maxMana = 100 * this.wand.manaMul;
    }
    if (this.paused) this.pause.refresh(this.campaign, this.wand);
  }

  private grantMilestone(id: Parameters<Campaign['complete']>[0]) {
    const r = this.campaign.complete(id);
    if (!r) return;
    this.hud.toast(r.toast);
    this.audio.playCaptureSuccess();
    if (id === 'first_bind') {
      this.inv.chalk_snare += 2;
    } else if (id === 'lumber') {
      this.inv.wood += 5;
    } else if (id === 'mire') {
      this.inv.essence += 3;
    } else if (id === 'raid') {
      this.inv.essence += 10;
      this.inv.fodder += 6;
    } else if (id === 'boss') {
      this.inv.essence += 8;
      this.inv.ingot += 3;
      this.hud.setJournal('Ashcrown falls to your will — or your flame. The Council will remember this den.');
    } else if (id === 'mael') {
      this.inv.essence += 6;
      this.inv.shiny_tin_bait += 2;
    }
  }

  private toggleMount() {
    const msg = this.mount.toggle(this.owned, this.player.position);
    this.fieldParty.sync(this.owned);
    this.hud.toast(msg);
    this.audio.playUI();
    if (this.mount.mounted) this.shake.add(0.1);
  }

  private maxHpSafe() {
    return this.player.maxHp * 0.55;
  }

  /** Wand tip world origin for glimmer beam (viewmodel tip preferred) */
  private wandOrigin(): THREE.Vector3 {
    if (this.viewWand) {
      return this.viewWand.getTipWorldPosition(new THREE.Vector3());
    }
    return this.player.position
      .clone()
      .add(new THREE.Vector3(0, 1.25, 0))
      .add(this.player.forward.clone().multiplyScalar(0.45));
  }

  private updateCaptureWindow(dt: number, inLight: boolean) {
    const wand = this.wandOrigin();

    // 1) Focus target: look + distance (always show glimmer when looking at a beast)
    //    While channeling, keep the locked capture target.
    if (this.capture.state === 'channeling' || this.capture.state === 'window') {
      this.focusBeast = this.capture.target;
    } else {
      // Use camera aim (same as combat reticle) so bind target = what you look at
      this.focusBeast = pickBindTarget(
        this.wild,
        this.player.position,
        this.player.getCameraAimDir(),
        14,
        this.camera.getWorldPosition(new THREE.Vector3()),
      );
    }

    // 2) Soften check on focus only — this is THE target
    let softenOk = false;
    let softenReason = '';
    if (this.focusBeast) {
      const check = this.beastAI.canSoften(this.focusBeast, this.inv, {
        inLight,
        doused: this.player.wardTimer > 0,
      });
      softenOk = check.ok;
      softenReason = check.reason;
    }

    // 3) Open capture window only on focused + softenable beast
    if (
      this.capture.state === 'idle' &&
      this.focusBeast &&
      softenOk &&
      this.captureCooldown <= 0
    ) {
      const quality = 1.05 + Math.random() * 0.2;
      this.capture.tryOpenWindow(this.focusBeast, true, quality);
      {
        const openFit = this.capture.estimateChance(
          this.focusBeast,
          this.pickBindMethod(this.focusBeast),
        );
        this.audio.playCaptureOpen(openFit);
      }
      if (this.playTime - this.lastBondToast > 2.5) {
        this.lastBondToast = this.playTime;
        // No % toast — tone pitch + green wedges speak for themselves
      }
    }

    // If we look away from window target, close window (keep channel locked)
    if (
      this.capture.state === 'window' &&
      this.capture.target &&
      this.focusBeast &&
      this.focusBeast.id !== this.capture.target.id
    ) {
      // re-evaluate: if focus changed, cancel old window
      this.capture.cancel();
      this.captureCooldown = 0.4;
    }

    // Path affinity + wand tool tier
    this.capture.pathAffinity =
      this.path === 'vita' ? 1.05 : this.path === 'mortis' ? 1.08 : 1.0;
    this.capture.toolTier = this.wand.catchToolTier;
    // First Glimmerpouch should feel fair (tutorial)
    this.capture.tutorialBoost = this.owned.length === 0;

    const result = this.capture.update(dt, this.player.position);

    // Live odds → visual only (wedges + pips), not essay text
    const previewMethod = this.pickBindMethod(this.focusBeast ?? this.capture.target);
    const liveChance = this.capture.estimateChance(
      this.capture.target ?? this.focusBeast,
      previewMethod,
    );
    const fitActive =
      !!this.focusBeast &&
      (softenOk || this.capture.state === 'window' || this.capture.state === 'channeling');
    this.glimmer.setFit(fitActive ? liveChance : 0);

    // 4) Glimmer visual modes + target highlight + abduction lift
    if (!this.focusBeast) {
      this.glimmer.hide();
      this.targetFx.setTarget(null, 'off');
      if (this.lastFocusId) {
        // reset lift on previous if any still in wild
        for (const w of this.wild) {
          if (w.id === this.lastFocusId) this.targetFx.resetLift(w);
        }
        this.lastFocusId = null;
      }
    } else {
      const mode =
        this.capture.state === 'channeling'
          ? 'channeling'
          : this.capture.state === 'window' || softenOk
            ? 'ready'
            : 'focus';
      this.glimmer.setFocus(this.focusBeast, wand, mode);
      this.targetFx.setTarget(this.focusBeast, mode);
      this.lastFocusId = this.focusBeast.id;
      if (this.capture.state === 'channeling') {
        this.targetFx.setLift(this.focusBeast, this.capture.channelProgress);
      } else {
        this.targetFx.resetLift(this.focusBeast);
      }
    }
    this.glimmer.update(dt, wand);

    // 5) Minimal text — strength is the ground wedges + crosshair pips
    const show = this.capture.state === 'window' || this.capture.state === 'channeling';
    const channeling = this.capture.state === 'channeling';
    let label = '';
    let beastName = 'Bestie';
    if (this.focusBeast) {
      const sp = SPECIES[this.focusBeast.speciesId];
      beastName = sp?.name ?? 'Bestie';
      if (channeling) {
        label = this.capture.holdingChannel ? '' : 'F halten';
      } else if (show) {
        label = 'F';
      } else if (!softenOk) {
        // Short only — full reason stays as glimmer violet + journal tip once
        label = softenReason.length > 42 ? softenReason.slice(0, 40) + '…' : softenReason;
      } else {
        label = '';
      }
    }
    this.hud.setBondRing(show || !!this.focusBeast, channeling, label);

    // Power compare: gold pips = you · purple = beast (tier)
    const youPower = this.playerBindPower();
    const beastPower = this.focusBeast
      ? Math.min(3, SPECIES[this.focusBeast.speciesId]?.tier ?? 1)
      : 1;
    this.crosshair.setPowerCompare(youPower, beastPower, liveChance, !!this.focusBeast);

    // Channel bar: progress only (fit is world-space wedges)
    if (channeling && this.focusBeast) {
      this.bindBar.setVisible(true);
      this.bindBar.setProgress(
        this.capture.channelProgress,
        beastName,
        this.capture.holdingChannel,
        liveChance,
      );
    } else {
      this.bindBar.setVisible(false);
    }
    this.bindBar.update(dt);

    // Store soften reason for prompts
    this._bindSoftenReason = softenReason;
    this._bindSoftenOk = softenOk;

    if (result.event === 'success' && result.target) {
      this.glimmer.flashSuccess();
      this.hitMarker.pulse('bind');
      this.viewWand.playBindPulse();
      this.feelCam.addFovKick(6);
      this.feelCam.addPunch(0.35);
      this.bindBar.setVisible(false);
      this.floatText.spawn(
        this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
        '✦',
        '#7dff9a',
      );
      this.onCaptureSuccess(result.target);
      this.glimmer.hide();
    } else if (result.event === 'fail') {
      this.audio.playCaptureFail(result.catchProb ?? liveChance);
      this.captureCooldown = 0.9;
      this.shake.add(0.18);
      this.feelCam.addPunch(0.2);
      // Short fail — color flash + symbol, not a wall of text
      if (result.failKind === 'rng') {
        this.floatText.spawn(
          this.player.position.clone().add(new THREE.Vector3(0, 2, 0)),
          '✕',
          '#ff8a8a',
        );
        this.hud.toast('Abgeschüttelt — Ring war nicht voll grün. Nochmal.');
      } else if (result.failKind === 'release') {
        this.floatText.spawn(
          this.player.position.clone().add(new THREE.Vector3(0, 2, 0)),
          'F…',
          '#ffc070',
        );
        this.hud.toast('F halten bis der Balken voll ist.');
      } else if (result.failKind === 'distance') {
        this.floatText.spawn(
          this.player.position.clone().add(new THREE.Vector3(0, 2, 0)),
          '←→',
          '#ffc070',
        );
        this.hud.toast('Näher ran.');
      } else {
        this.hud.toast(result.failLesson ?? 'Noch einmal, wenn grün.');
      }
    } else if (result.event === 'window_closed') {
      this.captureCooldown = 0.6;
      this.floatText.spawn(
        this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
        '…',
        '#a39bb8',
      );
    }
  }

  /** Player bind strength 1–3 (wand + path + experience) for pip compare. */
  private playerBindPower(): number {
    let p = 1 + this.wand.tier; // 1..3
    if (this.path !== 'none') p = Math.min(3, p + 1);
    if (this.owned.length >= 3) p = Math.min(3, p + 1);
    return Math.max(1, Math.min(3, p));
  }

  /** Prefer species best method with inventory available (for odds preview). */
  private pickBindMethod(beast: { speciesId: string } | null): CaptureMethod {
    if (!beast) return 'bond';
    const best = SPECIES[beast.speciesId]?.bestMethods ?? [];
    if (best.includes('bait') && (this.inv.shiny_tin_bait > 0 || this.inv.berry_bait > 0)) {
      return 'bait';
    }
    if (this.inv.chalk_snare > 0 && (best.includes('snare') || best.length === 0)) return 'snare';
    if (this.inv.shiny_tin_bait > 0 || this.inv.berry_bait > 0) return 'bait';
    if (this.inv.chalk_snare > 0) return 'snare';
    return 'bond';
  }

  private _bindSoftenReason = '';
  private _bindSoftenOk = false;

  private tryCapture() {
    // Must have a glimmer focus
    if (!this.focusBeast && this.capture.state === 'idle') {
      this.hud.toast('Schau eine Bestie an (mittig) — der Glimmer-Strahl wählt das Ziel.');
      return;
    }

    if (this.capture.state === 'idle') {
      // Try to open window if ready
      if (this.focusBeast && this._bindSoftenOk) {
        this.capture.tryOpenWindow(this.focusBeast, true, 1.1);
      } else {
        this.hud.toast(
          this._bindSoftenReason
            ? `Noch nicht: ${this._bindSoftenReason}`
            : 'Ziel ansehen — violetter Strahl = noch nicht bereit, grün = F drücken.',
        );
        return;
      }
    }

    if (this.capture.state === 'window') {
      const method = this.pickBindMethod(this.capture.target);
      const odds = this.capture.estimateChance(this.capture.target, method);
      const r = this.capture.beginChannel(method, this.inv);
      if (!r.ok) this.hud.toast(r.msg);
      else {
        this.audio.playUI();
        this.capture.holdingChannel = true;
        void odds;
        this.hud.toast('F halten — Ring am Boden zeigt, wie stark der Griff ist.');
        this.feelCam.addFovKick(3);
      }
      return;
    }
    if (this.capture.state === 'channeling') return;
  }

  private handleWildDeath(beast: WildBeast) {
    if (beast.hp > 0 || beast.state === 'captured') return;
    const t = this.heat.onKill();
    if (t) this.hud.toast(t);
    beast.mesh.visible = false;
    beast.state = 'captured';
    this.scene.remove(beast.mesh);
    this.inv.essence += beast.speciesId === 'B12' ? 5 : 1;
    this.floatText.spawn(
      beast.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
      beast.speciesId === 'B12' ? '+5 essence' : '+1 essence',
      '#a78bfa',
    );
    this.shake.add(beast.speciesId === 'B12' ? 0.6 : 0.15);
    if (beast.speciesId === 'B12') {
      this.grantMilestone('boss');
      this.boss = null;
      this.hud.toast('Ashcrown besiegt. Binden wäre möglich gewesen — Macht bleibt.');
    }
    // Raider cleanup handled by RaidNight filter on hp
  }

  private onCaptureSuccess(target: WildBeast) {
    this.audio.playCaptureSuccess();
    const sp = SPECIES[target.speciesId];
    const fieldCount = this.owned.filter((o) => o.fieldSlot).length;
    const ob: OwnedBeast = {
      uid: uid(),
      speciesId: target.speciesId,
      name: sp?.name ?? target.speciesId,
      hp: target.hp,
      maxHp: target.maxHp,
      mood: 80,
      job: null,
      fieldSlot: fieldCount < 2,
      bondLevel: 0,
      bondXp: 0,
    };
    this.owned.push(ob);
    target.state = 'captured';
    target.mesh.visible = false;
    this.scene.remove(target.mesh);
    this.wild = this.wild.filter((w) => w.id !== target.id);
    this.fieldParty.sync(this.owned);
    this.floatText.spawn(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), 'GEBUNDEN!', '#6bcb8a');
    this.shake.add(0.22);
    const fieldNote = ob.fieldSlot ? ' · Feldtrupp' : '';
    this.hud.toast(`${ob.name} gebunden${fieldNote}. C Jobs · X Feld · M Reittier`);
    this.hud.setJournal(
      `${ob.name} gebunden. „${sp?.bark ?? ''}“ — C Arbeit (Sägeplatz) · X Kampf · M Reiten.`,
    );
    this.grantMilestone('first_bind');
    if (this.owned.length === 1) {
      const ht = this.heat.onFirstBind();
      if (ht) this.hud.toast(ht);
    }
    this.persist(true);

    if (target.speciesId === 'B12') {
      const t = this.heat.onEliteBind();
      if (t) this.hud.toast(t);
      this.grantMilestone('boss');
      this.boss = null;
    } else {
      const toast = this.heat.add(3, 'bind');
      if (toast) this.hud.toast(toast);
    }
    if (this.tutorialStep < 2) {
      this.tutorialStep = 2;
    }
    // Auto-suggest lumber if available and combat-tagged worker
    const lumber = this.stations.find((s) => s.kind === 'lumber');
    if (
      lumber &&
      !lumber.assignedBeastUid &&
      sp?.workTags.some((t) => t.includes('lumber') || t.includes('haul'))
    ) {
      ob.job = 'lumber';
      ob.fieldSlot = false;
      lumber.assignedBeastUid = ob.uid;
      this.fieldParty.sync(this.owned);
      this.hud.toast(`${ob.name} → Sägeplatz (vom Feld zurück).`);
      this.stationWorkers.sync(this.owned, this.stations);
      this.persist(true);
    }
  }

  private inSealEcho(): boolean {
    return this.player.position.distanceTo(this.sealEchoPos) < this.sealEchoRadius;
  }

  /** Spell damage multiplier (Seal Echo thins formulas). */
  private spellDamageMul(): number {
    return this.inSealEcho() ? 0.45 : 1;
  }

  private castSelected() {
    const id = this.selectedSpell;
    const result = castSpell(id, this.player, this.spellCd[id]);
    if (!result.ok) {
      if (result.reason === 'mana') this.hud.toast('Nicht genug Mana.');
      return;
    }
    this.spellCd[id] = SPELLs[id].cooldown;
    this.audio.playUI();
    this.castTimer = 0.22;
    this.viewWand.playCast(SPELLs[id].color);
    this.wandMuzzle.fire(SPELLs[id].color);
    this.feelCam.addPunch(0.12);
    const dmgMul = this.spellDamageMul() * this.wand.damageMul;

    const targets = [...this.wild, ...this.raid.getTargets()];
    const castOrigin = this.wandOrigin();
    // Aim where the reticle points (camera), not flat body yaw — fixes overshoot
    const aim = getCombatAim(this.camera, castOrigin, targets, {
      maxDist: 90,
      assistRadius: 1.6,
      assistAngle: 0.11,
    });
    this.trails.burst(castOrigin, SPELLs[id].color, 8, 2.5);

    if (id === 'ward') {
      const target = getWardTarget(this.camera, this.player.position, targets, 5);
      if (target) {
        if (this.boss && target.id === this.boss.beast.id) {
          this.boss.applyBossHit(5 * dmgMul, true);
        } else {
          applyDamageToBeast(target, 4 * dmgMul, false);
        }
        target.partBroken = true;
        target.overheated = false;
        this.floatText.spawn(target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 'Interrupt', '#88aaff');
        this.hitMarker.pulse('hit');
        this.shake.add(0.12);
      }
      if (this.mael.phase === 'duel' || this.mael.phase === 'arrive') {
        if (this.player.position.distanceTo(this.mael.position) < 5.5) {
          const killed = this.mael.takeDamage(8 * dmgMul);
          this.floatText.spawn(this.mael.position.clone().add(new THREE.Vector3(0, 2, 0)), 'Ward!', '#c9a227');
          this.hitMarker.pulse('hit');
          if (killed) this.onMaelDown();
        }
      }
      return;
    }

    if (result.projectile) {
      const speed = id === 'thorn' ? 22 : id === 'bind' ? 26 : 32;
      const dmg = (id === 'thorn' ? result.damage * 1.25 : result.damage) * dmgMul;
      // Fire along muzzle → reticle aim point (hits where crosshair is)
      this.projectiles.spawn(castOrigin, aim.dir, id, speed, dmg, result.color, {
        soft: result.soft,
        interrupt: result.interrupt || id === 'thorn',
        cone: SPELLs[id].cone,
      });
      // Decal at aim point on ground projection
      const decalPos = aim.point.clone();
      decalPos.y = 0.02;
      this.impactDecals.spawn(decalPos, new THREE.Vector3(0, 1, 0), result.color);

      // Mael: hit if aim ray near him
      if (this.mael.phase === 'duel' || this.mael.phase === 'arrive') {
        const mPos = this.mael.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const toM = mPos.clone().sub(castOrigin);
        const dist = toM.length();
        if (dist < 20 && aim.dir.dot(toM.normalize()) > 0.92) {
          const killed = this.mael.takeDamage(dmg * 0.9);
          this.floatText.spawn(mPos, `-${Math.floor(dmg * 0.9)}`, '#c9a227');
          this.shake.add(0.15);
          this.hitMarker.pulse('hit');
          if (killed) this.onMaelDown();
        }
      }
    }
  }

  private onMaelDown() {
    this.grantMilestone('mael');
    this.hud.toast('Inquisitor Mael fällt — oder flieht in Paragraphen.');
    this.hud.setJournal('You bloodied the Council\'s polite knife. Heat will answer.');
    this.heat.add(12, 'mael');
    this.audio.playBoss();
    this.shake.add(0.5);
    this.trails.burst(this.mael.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xc9a227, 24, 5);
  }

  private craftSnare() {
    if (this.inv.wood < 2) {
      this.hud.toast('2 Holz für Kreide-Falle nötig.');
      return;
    }
    this.inv.wood -= 2;
    this.inv.chalk_snare += 1;
    this.audio.playUI();
    this.hud.toast('Kreide-Falle gebaut. Bestie softenen, dann F.');
  }

  private craftFodder() {
    if (this.inv.herb < 2) {
      this.hud.toast('2 Kraut für Futter nötig (G).');
      return;
    }
    this.inv.herb -= 2;
    this.inv.fodder += 4;
    this.audio.playUI();
    this.hud.toast('+4 Futter. Arbeiter füttern.');
  }

  private quickToggleField() {
    if (!this.owned.length) {
      this.hud.toast('Keine Bestien für den Feldtrupp.');
      return;
    }
    // Prefer idle non-field, else toggle first owned
    const candidate =
      this.owned.find((o) => !o.fieldSlot && (!o.job || o.job === 'idle')) ??
      this.owned.find((o) => !o.fieldSlot) ??
      this.owned[0];
    const msg = toggleFieldSlot(this.owned, candidate.uid);
    this.fieldParty.sync(this.owned);
    this.hud.toast(msg);
    this.audio.playUI();
  }

  private clearBuildGhost() {
    if (this.buildGhost) {
      this.scene.remove(this.buildGhost);
      this.buildGhost = null;
    }
  }

  private updateBuildGhost() {
    if (!this.buildMode) {
      this.clearBuildGhost();
      return;
    }
    const affordable = canAfford(this.inv, this.buildMode);
    if (!this.buildGhost || this.buildGhost.userData.kind !== this.buildMode) {
      this.clearBuildGhost();
      this.buildGhost = createStationMesh(this.buildMode, THREE);
      this.buildGhost.userData.kind = this.buildMode;
      this.scene.add(this.buildGhost);
    }
    // Green = can pay · red = cannot (read before E)
    const tint = affordable ? 0x5dffb0 : 0xff6b6b;
    this.buildGhost.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material) {
        const src = c.material as THREE.MeshStandardMaterial;
        if (!c.userData._ghostMat) {
          const m = src.clone();
          m.transparent = true;
          m.depthWrite = false;
          c.material = m;
          c.userData._ghostMat = true;
        }
        const m = c.material as THREE.MeshStandardMaterial;
        m.opacity = 0.42;
        if (m.color) m.color.setHex(tint);
        if (m.emissive) {
          m.emissive.setHex(tint);
          m.emissiveIntensity = 0.25;
        }
      }
    });
    const pos = this.player.position.clone().add(this.player.forward.clone().multiplyScalar(2.5));
    pos.y = 0;
    this.buildGhost.position.copy(pos);
  }

  private formatCostDe(kind: Station['kind']): string {
    const cost = buildCosts[kind];
    const keyDe: Record<string, string> = {
      wood: 'Holz',
      stone: 'Stein',
      herb: 'Kraut',
      ore: 'Erz',
      essence: 'Essenz',
      ingot: 'Barren',
      fodder: 'Futter',
    };
    return Object.entries(cost)
      .map(([k, v]) => `${v} ${keyDe[k] ?? k}`)
      .join(', ');
  }

  private cycleBuild() {
    const order: Station['kind'][] = ['bed', 'storage', 'pen', 'lumber', 'workbench', 'smelter', 'tower'];
    this.clearBuildGhost();
    if (!this.buildMode) {
      this.buildMode = 'bed';
    } else {
      const i = order.indexOf(this.buildMode);
      if (i >= order.length - 1) {
        this.buildMode = null;
        this.hud.toast('Baumodus aus.');
        return;
      }
      this.buildMode = order[i + 1];
    }
    const de = STATION_DE[this.buildMode!] ?? this.buildMode;
    const costStr = this.formatCostDe(this.buildMode!);
    const ok = canAfford(this.inv, this.buildMode!);
    this.hud.toast(
      `Bauen: ${de} (${costStr}). ${ok ? 'Grün = leistbar' : 'Rot = zu teuer'} · E platzieren.`,
    );
    this.audio.playUI();
  }

  private tryBuildAtPlayer() {
    if (!this.buildMode) return;
    const kind = this.buildMode;
    if (!canAfford(this.inv, kind)) {
      this.hud.toast(`Zu teuer: ${STATION_DE[kind]} braucht ${this.formatCostDe(kind)}.`);
      return;
    }
    const pos = this.player.position.clone().add(this.player.forward.clone().multiplyScalar(2.5));
    pos.y = 0;
    // Avoid stacking (check build site, not player feet)
    for (const s of this.stations) {
      if (s.position.distanceTo(pos) < 3) {
        this.hud.toast('Zu nah an einer anderen Station.');
        return;
      }
    }
    pay(this.inv, kind);
    // placeStation always spawns — cost already paid above (do not re-check canAfford)
    this.placeStation(kind, pos);
    this.audio.playBuild();
    const deName = STATION_DE[kind] ?? kind;
    this.hud.toast(`${deName} gebaut — bleibt stehen (Turm nur bei Raid-Zerstörung).`);
    if (kind === 'tower') {
      const t = this.heat.onTowerBuilt();
      if (t) {
        this.hud.toast(t);
        this.audio.playHeat();
      }
      this.towerHp = this.maxTowerHp;
      this.grantMilestone('tower');
    }
    // Demo Law #3 ramp: first permanent station raises heat toward pamphlet/Watcher
    if (this.stations.length === 1) {
      const t = this.heat.onFirstBase();
      if (t) this.hud.toast(t);
    }
    if (kind === 'lumber') {
      this.grantMilestone('lumber');
      if (this.tutorialStep < 3) {
        this.tutorialStep = 3;
        this.hud.setJournal(
          'Sägeplatz steht. Brushback (brauner Eber) binden → C → Sägeplatz — Bestie hackt sichtbar Holz.',
        );
        this.objective = 'Binde Brushback Boar → C → Sägeplatz zuweisen';
      }
    }
    this.buildMode = null;
    this.clearBuildGhost();
    this.persist(true); // keep buildings across refresh
  }

  /** Spawn a permanent station mesh. Cost must already be paid (or free on load). */
  private placeStation(kind: Station['kind'], pos: THREE.Vector3, _fromSave = false) {
    const mesh = createStationMesh(kind, THREE);
    mesh.position.copy(pos);
    mesh.userData.station = true;
    // Ground plate so the build reads as permanent, not a ghost preview
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 20),
      new THREE.MeshStandardMaterial({
        color: 0x3a342c,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    mesh.add(pad);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.45, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    mesh.add(ring);

    // Floating German name on permanent builds
    const de = STATION_DE[kind] ?? kind;
    mesh.add(makeStationLabel(de));

    this.scene.add(mesh);
    this.stations.push({
      id: uid(),
      kind,
      position: pos.clone(),
      mesh,
      progress: 0,
      assignedBeastUid: null,
    });
  }

  private openAssign() {
    const modal = document.getElementById('assign-modal')!;
    const buttons = document.getElementById('assign-buttons')!;
    buttons.innerHTML = '';
    if (!this.owned.length) {
      this.hud.toast('Noch keine gebundene Bestie.');
      return;
    }
    document.getElementById('assign-desc')!.textContent = 'Bestie wählen, dann Job.';
    for (const b of this.owned) {
      const btn = document.createElement('button');
      const jobDe = JOB_DE[b.job ?? 'idle'] ?? b.job ?? 'idle';
      btn.textContent = `${b.name} (${jobDe})`;
      btn.onclick = () => this.pickJobFor(b);
      buttons.appendChild(btn);
    }
    modal.classList.add('show');
    this.audio.playUI();
  }

  private pickJobFor(b: OwnedBeast) {
    const buttons = document.getElementById('assign-buttons')!;
    buttons.innerHTML = '';
    const fieldBtn = document.createElement('button');
    fieldBtn.textContent = b.fieldSlot ? 'Vom Feld zurückrufen' : 'In den Feldtrupp';
    fieldBtn.onclick = () => {
      const msg = toggleFieldSlot(this.owned, b.uid);
      this.fieldParty.sync(this.owned);
      this.hud.toast(msg);
      document.getElementById('assign-modal')!.classList.remove('show');
      this.audio.playUI();
    };
    buttons.appendChild(fieldBtn);

    const jobs: { id: OwnedBeast['job']; label: string }[] = [
      { id: 'lumber', label: 'Sägeplatz' },
      { id: 'smelt', label: 'Schmelze' },
      { id: 'scout', label: 'Spähen' },
      { id: 'haul', label: 'Schleppen' },
      { id: 'guard', label: 'Wache' },
      { id: 'idle', label: 'Ruhe' },
    ];
    for (const j of jobs) {
      const btn = document.createElement('button');
      btn.textContent = j.label!;
      btn.onclick = () => {
        // Clear previous station assignment
        for (const s of this.stations) {
          if (s.assignedBeastUid === b.uid) s.assignedBeastUid = null;
        }
        b.job = j.id === 'idle' ? null : j.id;
        // Station workers leave the field party
        if (b.job === 'lumber' || b.job === 'smelt' || b.job === 'haul') {
          b.fieldSlot = false;
        }
        if (b.job === 'lumber') {
          const st = this.stations.find((s) => s.kind === 'lumber' && !s.assignedBeastUid);
          if (st) st.assignedBeastUid = b.uid;
          else if (!this.stations.some((s) => s.kind === 'lumber')) {
            this.hud.toast('Zuerst Sägeplatz bauen (B).');
          }
        }
        if (b.job === 'smelt') {
          const st = this.stations.find((s) => s.kind === 'smelter' && !s.assignedBeastUid);
          if (st) st.assignedBeastUid = b.uid;
        }
        this.fieldParty.sync(this.owned);
        this.stationWorkers.sync(this.owned, this.stations);
        document.getElementById('assign-modal')!.classList.remove('show');
        if (b.job === 'lumber' || b.job === 'smelt') {
          const t = this.heat.onFirstWorker();
          if (t) this.hud.toast(t);
          this.hud.toast(`${b.name} arbeitet am Posten — du kannst weggehen.`);
          // Grow wood stack spectacle
          this.pulseStationStack(b.job === 'lumber' ? 'lumber' : 'smelter');
        } else {
          this.hud.toast(`${b.name} → ${JOB_DE[b.job ?? 'idle'] ?? 'idle'}`);
        }
        this.persist(true);
        this.audio.playUI();
      };
      buttons.appendChild(btn);
    }
  }

  private pulseStationStack(kind: 'lumber' | 'smelter') {
    const st = this.stations.find((s) => s.kind === kind);
    if (!st) return;
    const stack = st.mesh.getObjectByName('woodStack');
    if (stack) {
      const n = ((stack.userData.grow as number) ?? 1) + 0.15;
      stack.userData.grow = Math.min(2.2, n);
      stack.scale.set(1, stack.userData.grow, 1);
    }
    // Soft work lamp so walk-away still sees activity
    if (!st.mesh.getObjectByName('workLamp')) {
      const lamp = new THREE.PointLight(0x7dff9a, 0.9, 8, 2);
      lamp.name = 'workLamp';
      lamp.position.set(0, 1.6, 0);
      st.mesh.add(lamp);
    }
  }

  private openPath() {
    const d = this.player.position.distanceTo(this.amphPos);
    if (d > 14 && this.path === 'none') {
      this.hud.toast('Amphitheater-Steinring finden (oder V in der Nähe drücken).');
      // Allow anyway after some progress
      if (this.owned.length < 1 && this.heat.heat < 10) return;
    }
    document.getElementById('path-modal')!.classList.add('show');
    this.audio.playUI();
  }

  private choosePath(p: PathFlag) {
    this.path = p;
    document.getElementById('path-modal')!.classList.remove('show');
    if (p === 'vita') {
      const t = this.heat.onPathVita();
      if (t) this.hud.toast(t);
      this.hud.toast('Vita färbt die Arcana grün. Wachstum ist Hunger mit Mauer.');
      this.hud.setJournal('Vita. Partner, keine Leibeigenen — es sei denn, du vergisst es.');
      this.player.maxHp += 15;
      this.player.hp += 15;
    } else if (p === 'mortis') {
      const t = this.heat.onPathMortis();
      if (t) this.hud.toast(t);
      this.hud.toast('Mortis brennt die Nacht. Macht kommt pünktlich.');
      this.hud.setJournal('Mortis. Loyalität ist eine Einstellung. Rechnung an den Rat.');
      this.inv.chalk_snare += 2;
      this.heat.add(4, 'mortis_commit');
    }
    this.grantMilestone('path');
    this.audio.playHeat();
    this.shake.add(0.25);
  }

  private spawnSealEchoMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(this.sealEchoRadius * 0.9, 0.15, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0xa78bfa,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.55,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.55, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2438, emissive: 0x4a3080, emissiveIntensity: 0.3 }),
    );
    pillar.position.y = 1.6;
    g.add(ring, pillar);
    g.position.copy(this.sealEchoPos);
    this.scene.add(g);
  }

  private spawnWatcher(pos: THREE.Vector3) {
    if (this.watcherMesh) return;
    const g = new THREE.Group();
    g.name = 'watcher';
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 2.6, 7),
      new THREE.MeshStandardMaterial({
        color: 0x0a0a12,
        emissive: 0x1a1520,
        emissiveIntensity: 0.35,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    cloak.position.y = 1.4;
    cloak.castShadow = true;
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 0.85, flatShading: true }),
    );
    hood.position.y = 2.55;
    hood.scale.set(1, 0.85, 1.1);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        emissive: 0xffc040,
        emissiveIntensity: 1.4,
        roughness: 0.3,
      }),
    );
    eye.position.set(0, 2.55, 0.32);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.05, 20),
      new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    const lamp = new THREE.PointLight(0xc9a227, 1.2, 14, 2);
    lamp.position.set(0, 2.8, 0);
    g.add(cloak, hood, eye, ring, lamp);
    // Elevated ridge: stand on rock mound so silhouette reads against sky
    const mound = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 2.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x3a3838, roughness: 0.95, flatShading: true }),
    );
    mound.position.y = 1.1;
    mound.castShadow = true;
    g.add(mound);
    cloak.position.y = 2.8;
    hood.position.y = 3.95;
    eye.position.set(0, 3.95, 0.32);
    lamp.position.set(0, 4.2, 0);
    ring.position.y = 2.25;
    g.userData.baseY = 0;
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.watcherMesh = g;
    this.hud.toast('Ein Beobachter wacht am Grat — der Rat hat dich gesehen.');
    this.hud.setJournal(
      'Heat: Beobachter am Horizont. Macht erzeugt Zuschauer. Turm und Lärm erhöhen die Stufe.',
    );
    this.audio.playHeat();
    this.shake.add(0.15);
  }

  /** World prop for early heat foreshadow (Demo Law #3). */
  private spawnPamphletNearPlayer() {
    if (this.scene.getObjectByName('heatPamphlet')) return;
    const g = new THREE.Group();
    g.name = 'heatPamphlet';
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.7),
      new THREE.MeshStandardMaterial({
        color: 0xe8dcc0,
        emissive: 0xc9a227,
        emissiveIntensity: 0.25,
        side: THREE.DoubleSide,
        roughness: 0.85,
      }),
    );
    paper.rotation.x = -Math.PI / 2.4;
    paper.position.y = 0.12;
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 }),
    );
    pin.position.y = 0.18;
    const glow = new THREE.PointLight(0xc9a227, 0.6, 6, 2);
    glow.position.y = 0.4;
    g.add(paper, pin, glow);
    const p = this.player.position
      .clone()
      .add(this.player.forward.clone().multiplyScalar(2.2));
    p.y = 0;
    // Prefer near Discarding Stones if still at camp
    if (this.world?.stonesCenter) {
      const d = this.player.position.distanceTo(this.world.stonesCenter);
      if (d < 18) {
        p.copy(this.world.stonesCenter).add(new THREE.Vector3(-2.5, 0, 1.5));
      }
    }
    g.position.copy(p);
    this.scene.add(g);
    this.floatText.spawn(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 'Flugblatt', '#c9a227');
  }

  private updateHealthBars() {
    const bars: import('../ui/BeastBars').BarTarget[] = [];
    for (const w of [...this.wild, ...this.raid.getTargets()]) {
      if (w.hp <= 0 || w.state === 'captured') continue;
      const sp = SPECIES[w.speciesId];
      const focused = this.focusBeast?.id === w.id;
      bars.push({
        id: w.id,
        position: w.mesh.position.clone(),
        height: (w.mesh.position.y || 0.5) + 1.55,
        hp: w.hp,
        maxHp: w.maxHp,
        kind: 'enemy',
        label: focused ? `▶ ${sp?.name ?? 'Ziel'}` : sp?.name ?? 'Gegner',
        tier: sp?.tier ?? 1,
      });
    }
    if (this.mael.phase === 'duel' || this.mael.phase === 'arrive') {
      bars.push({
        id: 'mael',
        position: this.mael.position.clone(),
        height: 2.4,
        hp: this.mael.hp,
        maxHp: this.mael.maxHp,
        kind: 'enemy',
        label: 'Inquisitor Mael',
        tier: 3,
      });
    }
    for (const c of this.fieldParty.companions) {
      const owned = this.owned.find((o) => o.uid === c.ownedUid);
      const sp = SPECIES[c.speciesId];
      const maxHp = owned?.maxHp ?? sp?.stats.hp ?? 50;
      const hp = owned?.hp ?? maxHp;
      bars.push({
        id: `ally_${c.ownedUid}`,
        position: c.mesh.position.clone(),
        height: c.mesh.position.y + 1.45,
        hp,
        maxHp,
        kind: 'ally',
        label: owned?.name ?? sp?.name ?? 'Begleiter',
      });
    }
    this.beastBars.update(bars, this.player.position, 24);
  }

  private updatePrompt() {
    if (this.buildMode) {
      const de = STATION_DE[this.buildMode] ?? this.buildMode;
      const ok = canAfford(this.inv, this.buildMode);
      this.hud.setPrompt(
        `Bauen: ${de} (${this.formatCostDe(this.buildMode)}) — ${ok ? 'E platzieren' : 'zu teuer'} · B wechseln`,
      );
      return;
    }
    // Binding is the main loop — prioritize glimmer focus messaging
    if (this.capture.state === 'channeling' && this.focusBeast) {
      const n = SPECIES[this.focusBeast.speciesId]?.name ?? 'Bestie';
      const pct = Math.floor(this.capture.channelProgress * 100);
      this.hud.setPrompt(`⬆ F HALTEN — ${n} wird gebunden… ${pct}%`);
      return;
    }
    if (this.capture.state === 'window' && this.focusBeast) {
      const n = SPECIES[this.focusBeast.speciesId]?.name ?? 'Bestie';
      this.hud.setPrompt(`✦ GRÜNER Glimmer → ${n} — F drücken & HALTEN`);
      return;
    }
    if (this.focusBeast) {
      const n = SPECIES[this.focusBeast.speciesId]?.name ?? 'Bestie';
      if (this._bindSoftenOk) {
        this.hud.setPrompt(`✦ ${n} bereit — F zum Binden`);
      } else {
        this.hud.setPrompt(
          `Violetter Glimmer → ${n}: ${this._bindSoftenReason || 'noch nicht bereit'}`,
        );
      }
      return;
    }
    const g = this._nearGather;
    if (g.full || g.node) {
      this.hud.setPrompt(gatherPrompt(g.node, false, 0, !!g.full, g.kind ?? g.node?.kind));
      return;
    }
    if (this.inSealEcho()) {
      this.hud.setPrompt('Seal Echo — Magie schwach · Bestien stark');
      return;
    }
    if (this.player.position.distanceTo(this.amphPos) < 12) {
      this.hud.setPrompt('Amphitheater — V für Vita / Mortis');
      return;
    }
    this.hud.setPrompt(
      `◆ ${this.objective}  ·  Bestie anschauen = Glimmer-Strahl wählt Ziel`,
    );
  }

  private compassCardinal(from: THREE.Vector3, to: THREE.Vector3): string {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    // 0° = north (-Z), clockwise
    const ang = Math.atan2(dx, -dz);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round((((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    return dirs[idx];
  }

  private formatCompass(label: string, target: THREE.Vector3): string {
    const dist = this.player.position.distanceTo(target);
    const dir = this.compassCardinal(this.player.position, target);
    return `${label} · ${Math.round(dist)}m · ${dir}`;
  }

  private updateObjectiveUi() {
    this.hud.setObjective(this.objective);

    let label = '';
    let target: THREE.Vector3 | null = null;

    if (this.owned.length === 0) {
      // Nearest living Glimmerpouch (B01)
      let bestD = Infinity;
      for (const b of this.wild) {
        if (b.speciesId !== 'B01' || b.hp <= 0 || b.state === 'captured') continue;
        const d = this.player.position.distanceTo(b.mesh.position);
        if (d < bestD) {
          bestD = d;
          target = b.mesh.position;
          label = 'Glimmerpouch';
        }
      }
    } else if (!this.owned.some((o) => o.job === 'lumber')) {
      // Nearest lumber station
      let bestD = Infinity;
      for (const s of this.stations) {
        if (s.kind !== 'lumber') continue;
        const d = this.player.position.distanceTo(s.position);
        if (d < bestD) {
          bestD = d;
          target = s.position;
          label = 'Sägeplatz';
        }
      }
      if (!target) {
        // No lumber built yet — still nudge toward industry goal
        label = 'Sägeplatz bauen';
      }
    } else if (this.path === 'none') {
      target = this.amphPos;
      label = 'Amphitheater';
    } else {
      // Ashcrown (B12)
      let bestD = Infinity;
      for (const b of this.wild) {
        if (b.speciesId !== 'B12' || b.hp <= 0 || b.state === 'captured') continue;
        const d = this.player.position.distanceTo(b.mesh.position);
        if (d < bestD) {
          bestD = d;
          target = b.mesh.position;
          label = 'Ashcrown';
        }
      }
      if (!target) {
        // Fallback den coords if elite already gone
        target = new THREE.Vector3(48, 0, -52);
        label = 'Ashcrown';
      }
    }

    if (target) this.hud.setCompass(this.formatCompass(label, target));
    else if (label) this.hud.setCompass(`${label} · —`);
    else this.hud.setCompass('');
  }

  private persist(silent = false) {
    const data: GameSave = {
      version: 2,
      player: {
        x: this.player.position.x,
        z: this.player.position.z,
        hp: this.player.hp,
        mana: this.player.mana,
        strain: this.player.strain,
      },
      inventory: { ...this.inv },
      owned: this.owned.map((o) => ({ ...o })),
      heat: this.heat.heat,
      path: this.path,
      stationsBuilt: this.stations.map((s) => ({
        kind: s.kind,
        x: s.position.x,
        z: s.position.z,
      })),
      timeOfDay: this.dayNight.timeOfDay,
      watcherSeen: this.heat.watcherSeen,
      tutorialStep: this.tutorialStep,
      wandTier: this.wand.tier,
      milestonesDone: this.campaign.doneIds(),
      maelDefeated: this.mael.phase === 'defeated',
    };
    saveGame(data);
    if (!silent) {
      this.hud.toast('Fortschritt gesichert (lokaler Speicher).');
      this.audio.playUI();
    }
  }
}
