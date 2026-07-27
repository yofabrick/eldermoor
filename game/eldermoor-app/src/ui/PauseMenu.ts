import type { Campaign } from '../core/Campaign';
import type { WandProgression } from '../core/Progression';

/** Full-screen pause overlay with campaign checklist + help + wand upgrade */
export class PauseMenu {
  private root: HTMLDivElement;
  private open = false;
  onUpgradeWand: (() => void) | null = null;
  onResume: (() => void) | null = null;

  constructor() {
    let el = document.getElementById('pause-menu') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'pause-menu';
      el.innerHTML = `
        <div class="pause-card">
          <h2>Paused — Eldermoor</h2>
          <p class="pause-sub">The Arcana waits. Barely.</p>
          <div class="pause-cols">
            <div>
              <h3>Campaign</h3>
              <ul id="pause-milestones"></ul>
            </div>
            <div>
              <h3>Controls</h3>
              <div class="pause-help">
                WASD move · Mouse look · Space dash/gallop<br/>
                E gather/build · F capture · 1–4 spells · Click cast<br/>
                Q snare · G fodder · B build · C jobs · X field<br/>
                M mount · V path · U upgrade wand · T save · Esc pause
              </div>
              <h3>Wand</h3>
              <div id="pause-wand"></div>
              <button type="button" id="pause-upgrade">Upgrade wand</button>
            </div>
          </div>
          <button type="button" id="pause-resume" class="pause-primary">Resume (Esc)</button>
        </div>
      `;
      const style = document.createElement('style');
      style.textContent = `
        #pause-menu {
          display: none; position: absolute; inset: 0; z-index: 30;
          background: rgba(5,4,12,0.82); align-items: center; justify-content: center;
          pointer-events: auto; font-family: Segoe UI, system-ui, sans-serif;
        }
        #pause-menu.show { display: flex; }
        .pause-card {
          background: #161322; border: 1px solid #2e2848; border-radius: 14px;
          padding: 28px 32px; max-width: 640px; width: 92%; color: #f4f0e6;
        }
        .pause-card h2 { font-family: Georgia, serif; color: #e8d48b; margin: 0 0 4px; }
        .pause-sub { color: #a39bb8; font-size: 13px; margin-bottom: 16px; font-style: italic; }
        .pause-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 640px) { .pause-cols { grid-template-columns: 1fr; } }
        .pause-card h3 { color: #c9a227; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 8px; }
        #pause-milestones { list-style: none; padding: 0; margin: 0; font-size: 13px; line-height: 1.65; color: #a39bb8; }
        #pause-milestones li.done { color: #6bcb8a; }
        #pause-milestones li.done::before { content: "✓ "; }
        #pause-milestones li:not(.done)::before { content: "○ "; color: #2e2848; }
        .pause-help { font-size: 12px; color: #a39bb8; line-height: 1.55; margin-bottom: 14px; }
        #pause-wand { font-size: 13px; margin-bottom: 8px; color: #e8d48b; }
        #pause-menu button {
          background: #1c1830; border: 1px solid #2e2848; color: #f4f0e6;
          padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; margin-top: 6px;
        }
        #pause-menu button:hover { border-color: #c9a227; color: #c9a227; }
        .pause-primary { width: 100%; margin-top: 18px !important; background: #c9a227 !important; color: #1a1408 !important; font-weight: 700; border: none !important; }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.root = el;
    document.getElementById('pause-resume')?.addEventListener('click', () => {
      this.setOpen(false);
      this.onResume?.();
    });
    document.getElementById('pause-upgrade')?.addEventListener('click', () => this.onUpgradeWand?.());
  }

  isOpen() {
    return this.open;
  }

  setOpen(v: boolean) {
    this.open = v;
    this.root.classList.toggle('show', v);
    if (v) {
      document.exitPointerLock?.();
    }
  }

  toggle() {
    this.setOpen(!this.open);
    return this.open;
  }

  refresh(campaign: Campaign, wand: WandProgression) {
    const ul = document.getElementById('pause-milestones');
    if (ul) {
      ul.innerHTML = campaign.milestones
        .map((m) => `<li class="${m.done ? 'done' : ''}">${m.title}</li>`)
        .join('');
    }
    const w = document.getElementById('pause-wand');
    if (w) {
      w.textContent = `${wand.names[wand.tier]} · dmg ×${wand.damageMul.toFixed(2)} · upgrade: ${wand.upgradeCost()}`;
    }
  }
}
