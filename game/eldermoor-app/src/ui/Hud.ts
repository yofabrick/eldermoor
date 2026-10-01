import type { Inventory, OwnedBeast, PathFlag } from '../core/types';
import { speciesDef } from '../data/species';

export class Hud {
  private toastTimer = 0;
  private toastEl = document.getElementById('toast')!;
  private invEl = document.getElementById('inv')!;
  private partyEl = document.getElementById('party')!;
  private promptEl = document.getElementById('prompt')!;
  private bondRing = document.getElementById('bond-ring')!;
  private bondLabel = document.getElementById('bond-label')!;
  private hpBar = document.getElementById('hp-bar')!;
  private manaBar = document.getElementById('mana-bar')!;
  private strainBar = document.getElementById('strain-bar')!;
  private heatEye = document.getElementById('heat-eye')!;
  private heatNum = document.getElementById('heat-num')!;
  private journal = document.getElementById('journal-text')!;
  private objectiveEl = document.getElementById('objective-text')!;
  private compassEl = document.getElementById('compass-hint')!;

  showGameUi(show: boolean) {
    for (const id of [
      'hud-top',
      'inv',
      'party',
      'spells',
      'menu',
      'journal',
      'crosshair',
      'objective-bar',
    ]) {
      const el = document.getElementById(id)!;
      el.style.display = show ? '' : 'none';
    }
    document.getElementById('title-screen')!.style.display = show ? 'none' : 'flex';
  }

  toast(msg: string, seconds = 2.8) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  setVitals(hp: number, maxHp: number, mana: number, maxMana: number, strain: number) {
    this.hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.manaBar.style.width = `${Math.max(0, (mana / maxMana) * 100)}%`;
    this.strainBar.style.width = `${Math.max(0, Math.min(100, strain))}%`;
  }

  setHeat(heat: number) {
    this.heatNum.textContent = String(Math.floor(heat));
    this.heatEye.classList.toggle('open', heat >= 25);
    this.heatEye.title =
      heat >= 100 ? 'Krieg' : heat >= 50 ? 'Gesandter' : heat >= 25 ? 'Beobachter' : 'Gerüchte';
  }

  setInventory(inv: Inventory, path: PathFlag) {
    const pathLabel = path === 'none' ? 'offen' : path === 'vita' ? 'Vita' : 'Mortis';
    this.invEl.innerHTML = `
      <div class="inv-title">Inventar · Pfad: <b>${pathLabel}</b></div>
      <div class="inv-row"><span class="c-wood">Holz</span> <b>${Math.floor(inv.wood)}</b> <small>bauen</small></div>
      <div class="inv-row"><span class="c-stone">Stein</span> <b>${Math.floor(inv.stone)}</b> <small>bauen</small></div>
      <div class="inv-row"><span class="c-herb">Kraut</span> <b>${Math.floor(inv.herb)}</b> <small>Futter G · Mire</small></div>
      <div class="inv-row"><span class="c-ore">Erz</span> <b>${Math.floor(inv.ore)}</b> <small>→ Barren (Schmelze)</small></div>
      <div class="inv-row">Barren <b>${Math.floor(inv.ingot)}</b> · Essenz <b>${Math.floor(inv.essence)}</b> <small>Stab U</small></div>
      <div class="inv-row">Fallen <b>${inv.chalk_snare}</b> · Köder <b>${inv.shiny_tin_bait}</b>/<b>${inv.berry_bait}</b></div>
      <div class="inv-row">Futter <b>${Math.floor(inv.fodder)}</b> <small>Arbeiter füttern</small></div>
      <div class="inv-hint">Am Boden: farbige Ringe + Name · <b>drüberlaufen</b> (wenn Stack voll → nichts)</div>
    `;
  }

  setParty(owned: OwnedBeast[]) {
    if (!owned.length) {
      this.partyEl.innerHTML = `<div class="pet"><span class="name">Keine Bestien</span><div class="job">Goldener Glimmerpouch → Bond-Ring → F</div></div>`;
      return;
    }
    this.partyEl.innerHTML =
      `<div class="party-legend"><span class="ally">■ Begleiter (grün)</span> · <span class="enemy">■ Gegner (rot)</span></div>` +
      owned
        .map((b) => {
          const sp = speciesDef(b.speciesId);
          const role = b.fieldSlot ? '⚔ KÄMPFT MIT DIR' : b.job ? `🔧 ${b.job}` : 'idle';
          const bond = b.bondLevel ? ` · Band ${b.bondLevel}` : '';
          const cls = b.fieldSlot ? 'pet ally-pet' : 'pet';
          return `<div class="${cls}"><div class="name">${b.name}</div><div class="job">${sp.name} · ${role}${bond}</div></div>`;
        })
        .join('');
  }

  setPrompt(text: string) {
    this.promptEl.textContent = text;
  }

  setObjective(text: string) {
    this.objectiveEl.textContent = text;
  }

  setCompass(hint: string) {
    this.compassEl.textContent = hint;
  }

  setBondRing(show: boolean, channeling: boolean, label: string) {
    // Ring pulse when bind-relevant; label only if short prompt needed
    this.bondRing.classList.toggle('show', show);
    this.bondRing.classList.toggle('channel', channeling);
    this.bondLabel.classList.toggle('show', Boolean(label));
    this.bondLabel.textContent = label;
    this.bondLabel.classList.toggle('focus-dim', label.includes('noch nicht') || label.length > 8);
    this.bondLabel.classList.toggle('focus-ready', channeling || label === 'F');
  }

  setJournal(text: string) {
    this.journal.textContent = text;
  }

  setSpellActive(slot: number) {
    document.querySelectorAll('.spell').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-s') === String(slot));
    });
  }
}
