/** Low-HP / channel screen edge vignette */

export class Vignette {
  private el: HTMLDivElement;

  constructor() {
    let el = document.getElementById('vignette') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'vignette';
      const style = document.createElement('style');
      style.textContent = `
        #vignette {
          position: absolute; inset: 0; pointer-events: none; z-index: 8;
          opacity: 0; transition: opacity 0.2s ease;
          background: radial-gradient(ellipse at center, transparent 45%, rgba(80,0,20,0.55) 100%);
        }
        #vignette.channel {
          background: radial-gradient(ellipse at center, transparent 50%, rgba(20,60,50,0.4) 100%);
        }
        #vignette.bind-ready {
          background: radial-gradient(ellipse at center, transparent 55%, rgba(30,80,50,0.25) 100%);
        }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.el = el;
  }

  /** hpRatio 0..1, mode optional */
  set(hpRatio: number, mode: 'none' | 'hurt' | 'channel' | 'ready' = 'none') {
    this.el.classList.remove('channel', 'bind-ready');
    if (mode === 'channel') {
      this.el.classList.add('channel');
      this.el.style.opacity = '1';
      return;
    }
    if (mode === 'ready') {
      this.el.classList.add('bind-ready');
      this.el.style.opacity = '0.7';
      return;
    }
    if (hpRatio < 0.35) {
      this.el.style.opacity = String(Math.min(1, (0.35 - hpRatio) * 2.5));
    } else {
      this.el.style.opacity = '0';
    }
  }
}
