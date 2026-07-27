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
  private gatherHold = false;
  private captureCooldown = 0;
  private lastBondToast = 0;
  private playTime = 0;
  private objective = 'Sammle HOLZ (braune Stämme mit Ring) — E halten';
  private fieldParty!: FieldParty;
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
    progress?: number;
  } = { node: null, gained: null };

  constructor(canvasParent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
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
        this.hud.toast('No save found — starting new.');
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
    // Clear scene children carefully
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);

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
    this.fieldParty = new FieldParty(this.scene);
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

    // Tutorial Glimmerpouch near spawn (easy first bind)
    const tutor = createWildBeast(
      'B01',
      spawn.clone().add(new THREE.Vector3(4, 0, -6)),
      THREE,
    );
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

    // Restore field party after load
    if (save) this.fieldParty.sync(this.owned);

    if (!save) {
      this.inv.chalk_snare = 4;
      this.inv.shiny_tin_bait = 3;
      this.inv.wood = 2;
      this.hud.toast('Du bist Unlisted. Zuerst: HOLZ sammeln (braune Stämme am Boden, E halten).');
      this.hud.setJournal(
        'Was sammeln? Holz/Stein = bauen · Kraut = Futter & Mire · Erz = Barren/Stab. Namen schweben über den Haufen. Gegner = ROTER Balken, Begleiter = GRÜNER Balken.',
      );
      this.objective = 'Sammle HOLZ (braune Stämme, farbiger Ring) — E halten';
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
    this.audio.tick(dt, {
      bindHum:
        this.capture.state === 'channeling'
          ? 0.85 + this.capture.channelProgress * 0.15
          : this.capture.state === 'window' || this._bindSoftenOk
            ? 0.45
            : this.focusBeast
              ? 0.2
              : 0,
      night: this.dayNight.isNight() ? 1 : 0.25,
      footstep: moving && !this.mount.mounted,
      sprint: sprinting,
    });

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

    // Gather (E) — not while placing a building
    this.gatherHold = this.input.pressed('KeyE') && !this.buildMode;
    const g = tryGather(this.resources, this.player.position, this.inv, dt, this.gatherHold);
    this._nearGather = g;
    if (g.gained) {
      this.audio.playGather();
      this.floatText.spawn(
        this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        `+${g.gained}`,
        '#7dff9a',
      );
      this.grantMilestone('gather');
      if (this.tutorialStep === 0) {
        this.tutorialStep = 1;
        this.hud.setJournal(
          'Schau den goldenen Glimmerpouch an. Glimmer-Strahl = Ziel. Violett = noch nicht · Grün = F drücken & HALTEN bis 100%.',
        );
      }
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
          this.hud.toast('Your tower falls! Rebuild with wood & stone.');
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
          this.hud.toast('Blackvein Mire — poison fog. Carry herbs or leave soon.');
          this.hud.setJournal('The Mire remembers drowned lectures. Stags and crooners wait in the violet dark.');
          this.grantMilestone('mire');
        }
        this.mirePoisonAccum += dt;
        if (this.mirePoisonAccum >= 2.5) {
          this.mirePoisonAccum = 0;
          if (this.inv.herb > 0) {
            this.inv.herb -= 1;
            this.floatText.spawn(this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 'Herb wards fog', '#6bcb8a');
          } else {
            this.player.takeDamage(4);
            this.floatText.spawn(this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 'Poison!', '#a78bfa');
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

    // Workforce
    this.workforce.update(dt, this.owned, this.stations, this.inv, (msg) => {
      this.hud.toast(msg);
      this.audio.playUI();
      if (msg.includes('wood')) this.grantMilestone('lumber');
    });

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
    if (ev.spawnWatcher) {
      this.spawnWatcher(ev.spawnWatcher);
      this.heat.watcherSeen = true;
      this.events.setWatcherSeen(true);
      this.audio.playHeat();
      this.hud.setJournal('A silhouette on the ridge. You are Unlisted no more.');
    }

    // Death
    if (this.player.hp <= 0) {
      this.player.hp = this.maxHpSafe();
      const bed = this.stations.find((s) => s.kind === 'bed');
      if (bed) this.player.position.copy(bed.position);
      else this.player.position.copy(this.world.spawnPos);
      this.inv.wood = Math.floor(this.inv.wood * 0.7);
      this.inv.stone = Math.floor(this.inv.stone * 0.7);
      this.hud.toast('You fall. Mercy is a kind of respawn at your bed — or the Discarding Stones.');
    }

    // Seal Echo zone (spell damage thin) + one-shot toast
    if (this.inSealEcho()) {
      if (!this.sealEchoToasted) {
        this.sealEchoToasted = true;
        this.hud.toast('Seal Echo — your formulas thin. Beasts still bite.');
      }
    }

    // Campaign objective text
    this.objective = `${this.campaign.nextObjective()}  [${this.campaign.progress()}] · ${this.wand.names[this.wand.tier]}`;

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
    } else if (this._nearGather.node) {
      this.helpStrip.set(`<b>SAMMELN:</b> <span class="ok">E halten</span> am markierten Haufen · Name schwebt darüber`);
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
      this.audio.playCaptureOpen();
      if (this.playTime - this.lastBondToast > 2.5) {
        this.lastBondToast = this.playTime;
        const name = SPECIES[this.focusBeast.speciesId]?.name ?? 'Bestie';
        this.hud.toast(`Glimmer-Verbindung: ${name} — jetzt F halten/drücken!`);
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

    const result = this.capture.update(dt, this.player.position);

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

    // 5) HUD bond ring + German labels
    const show = this.capture.state === 'window' || this.capture.state === 'channeling';
    const channeling = this.capture.state === 'channeling';
    let label = '';
    let beastName = 'Bestie';
    if (this.focusBeast) {
      const sp = SPECIES[this.focusBeast.speciesId];
      beastName = sp?.name ?? 'Bestie';
      if (channeling) {
        label = `⬆ Entführung: ${beastName}  ${Math.floor(this.capture.channelProgress * 100)}%`;
      } else if (show) {
        label = `✦ Glimmer bereit: ${beastName} — F halten  (${this.capture.windowTime.toFixed(1)}s)`;
      } else if (!softenOk) {
        label = `Verbindung: ${beastName} — noch nicht bereit: ${softenReason}`;
      } else {
        label = `✦ ${beastName} bereit`;
      }
    }
    this.hud.setBondRing(show || !!this.focusBeast, channeling, label);

    // Bind channel bar (COD-level clarity)
    if (channeling && this.focusBeast) {
      this.bindBar.setVisible(true);
      this.bindBar.setProgress(
        this.capture.channelProgress,
        beastName,
        this.capture.holdingChannel,
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
      this.onCaptureSuccess(result.target);
      this.glimmer.hide();
    } else if (result.event === 'fail') {
      this.audio.playCaptureFail();
      this.captureCooldown = 1.2;
      this.hud.toast(result.failLesson ?? 'Die Verbindung reißt. Nochmal versuchen.');
    } else if (result.event === 'window_closed') {
      this.captureCooldown = 0.8;
      this.hud.toast('Glimmer verblasst — Ziel wieder ansehen und Bedingungen erfüllen.');
    }
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
      let method: CaptureMethod = 'bond';
      const best = this.capture.target
        ? SPECIES[this.capture.target.speciesId]?.bestMethods ?? []
        : [];
      if (best.includes('bait') && this.inv.shiny_tin_bait > 0) method = 'bait';
      else if (best.includes('bait') && this.inv.berry_bait > 0) method = 'bait';
      else if (this.inv.chalk_snare > 0) method = 'snare';
      else if (this.inv.shiny_tin_bait > 0 || this.inv.berry_bait > 0) method = 'bait';
      const r = this.capture.beginChannel(method, this.inv);
      if (!r.ok) this.hud.toast(r.msg);
      else {
        this.audio.playUI();
        this.capture.holdingChannel = true;
        this.hud.toast('F HALTEN — Glimmer zieht das Wesen!');
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
      this.hud.toast('Ashcrown slain. Capture was an option — power remains.');
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
    this.floatText.spawn(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), 'BOUND!', '#6bcb8a');
    this.shake.add(0.22);
    const fieldNote = ob.fieldSlot ? ' · joins field party' : '';
    this.hud.toast(`${ob.name} bound${fieldNote}. C jobs · X field · M mount`);
    this.hud.setJournal(`Bound ${ob.name}. "${sp?.bark ?? ''}" — work (C), fight (X), mount (M).`);
    this.grantMilestone('first_bind');

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
      this.hud.toast(`${ob.name} assigned to lumber (recalled from field).`);
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
    this.hud.toast('Inquisitor Mael falls — or flees into policy.');
    this.hud.setJournal('You bloodied the Council\'s polite knife. Heat will answer.');
    this.heat.add(12, 'mael');
    this.audio.playBoss();
    this.shake.add(0.5);
    this.trails.burst(this.mael.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xc9a227, 24, 5);
  }

  private craftSnare() {
    if (this.inv.wood < 2) {
      this.hud.toast('Need 2 wood to craft a chalk snare.');
      return;
    }
    this.inv.wood -= 2;
    this.inv.chalk_snare += 1;
    this.audio.playUI();
    this.hud.toast('Crafted chalk snare. Soften a beast, then F.');
  }

  private craftFodder() {
    if (this.inv.herb < 2) {
      this.hud.toast('Need 2 herbs to craft fodder (G).');
      return;
    }
    this.inv.herb -= 2;
    this.inv.fodder += 4;
    this.audio.playUI();
    this.hud.toast('+4 fodder. Keep workers fed.');
  }

  private quickToggleField() {
    if (!this.owned.length) {
      this.hud.toast('No beasts to field.');
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
    if (!this.buildGhost) {
      this.buildGhost = createStationMesh(this.buildMode, THREE);
      this.buildGhost.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
          const m = c.material.clone() as THREE.MeshStandardMaterial;
          m.transparent = true;
          m.opacity = 0.45;
          m.depthWrite = false;
          c.material = m;
        }
      });
      this.scene.add(this.buildGhost);
    }
    const pos = this.player.position.clone().add(this.player.forward.clone().multiplyScalar(2.5));
    pos.y = 0;
    this.buildGhost.position.copy(pos);
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
        this.hud.toast('Build mode off.');
        return;
      }
      this.buildMode = order[i + 1];
    }
    const cost = buildCosts[this.buildMode!];
    const costStr = Object.entries(cost)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');
    this.hud.toast(`Build: ${this.buildMode} (${costStr}). Ghost preview · E place.`);
    this.audio.playUI();
  }

  private tryBuildAtPlayer() {
    if (!this.buildMode) return;
    if (!canAfford(this.inv, this.buildMode)) {
      this.hud.toast(`Cannot afford ${this.buildMode}.`);
      return;
    }
    // Avoid stacking
    for (const s of this.stations) {
      if (s.position.distanceTo(this.player.position) < 3) {
        this.hud.toast('Too close to another station.');
        return;
      }
    }
    pay(this.inv, this.buildMode);
    const pos = this.player.position.clone().add(this.player.forward.clone().multiplyScalar(2.5));
    pos.y = 0;
    this.placeStation(this.buildMode, pos, false);
    this.audio.playGather();
    this.hud.toast(`Built ${this.buildMode}.`);
    if (this.buildMode === 'tower') {
      const t = this.heat.onTowerBuilt();
      if (t) {
        this.hud.toast(t);
        this.audio.playHeat();
      }
      this.towerHp = this.maxTowerHp;
      this.grantMilestone('tower');
    }
    if (this.buildMode === 'lumber' && this.tutorialStep < 3) {
      this.tutorialStep = 3;
      this.hud.setJournal('Lumber post ready. Bind a Brushback and press C to assign lumber.');
    }
    this.buildMode = null;
  }

  private placeStation(kind: Station['kind'], pos: THREE.Vector3, free: boolean) {
    if (!free && !canAfford(this.inv, kind)) return;
    const mesh = createStationMesh(kind, THREE);
    mesh.position.copy(pos);
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
      this.hud.toast('No bound beasts yet.');
      return;
    }
    document.getElementById('assign-desc')!.textContent = 'Choose a beast, then a job.';
    for (const b of this.owned) {
      const btn = document.createElement('button');
      btn.textContent = `${b.name} (${b.job ?? 'idle'})`;
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
    fieldBtn.textContent = b.fieldSlot ? 'Recall from field' : 'Send to field party';
    fieldBtn.onclick = () => {
      const msg = toggleFieldSlot(this.owned, b.uid);
      this.fieldParty.sync(this.owned);
      this.hud.toast(msg);
      document.getElementById('assign-modal')!.classList.remove('show');
      this.audio.playUI();
    };
    buttons.appendChild(fieldBtn);

    const jobs: { id: OwnedBeast['job']; label: string }[] = [
      { id: 'lumber', label: 'Lumber' },
      { id: 'smelt', label: 'Smelt' },
      { id: 'scout', label: 'Scout' },
      { id: 'haul', label: 'Haul' },
      { id: 'guard', label: 'Guard' },
      { id: 'idle', label: 'Idle' },
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
            this.hud.toast('Build a lumber post first (B).');
          }
        }
        if (b.job === 'smelt') {
          const st = this.stations.find((s) => s.kind === 'smelter' && !s.assignedBeastUid);
          if (st) st.assignedBeastUid = b.uid;
        }
        this.fieldParty.sync(this.owned);
        document.getElementById('assign-modal')!.classList.remove('show');
        this.hud.toast(`${b.name} → ${b.job ?? 'idle'}`);
        this.audio.playUI();
      };
      buttons.appendChild(btn);
    }
  }

  private openPath() {
    const d = this.player.position.distanceTo(this.amphPos);
    if (d > 14 && this.path === 'none') {
      this.hud.toast('Find the amphitheater stone ring to choose your path (or press V near it).');
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
      this.hud.toast('Vita stains the Arcana green. Growth is appetite with a wall.');
      this.hud.setJournal('Vita. Partners, not thralls — unless you forget.');
      this.player.maxHp += 15;
      this.player.hp += 15;
    } else if (p === 'mortis') {
      const t = this.heat.onPathMortis();
      if (t) this.hud.toast(t);
      this.hud.toast('Mortis brands the night. Power arrives on time.');
      this.hud.setJournal('Mortis. Loyalty is a setting. Invoice the Council.');
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
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.4, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0x111118, emissive: 0xc9a227, emissiveIntensity: 0.15 }),
    );
    body.position.y = 1.2;
    g.add(body);
    g.position.copy(pos);
    g.position.y = 0;
    this.scene.add(g);
    this.watcherMesh = g;
    this.hud.toast('A Watcher observes from the ridge.');
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
      this.hud.setPrompt(`Bauen: ${this.buildMode} — E platzieren · B wechseln`);
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
    if (g.node) {
      this.hud.setPrompt(gatherPrompt(g.node, this.gatherHold, g.progress ?? 0));
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
          label = 'Lumber';
        }
      }
      if (!target) {
        // No lumber built yet — still nudge toward industry goal
        label = 'Lumber';
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
      this.hud.toast('Progress sealed into memory (local save).');
      this.audio.playUI();
    }
  }
}
