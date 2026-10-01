/**
 * Contextual crosshair + visual power compare (you ◆ vs beast ◆).
 * No numbers — glance: more filled pips on your side than theirs ≈ good odds.
 */

export class Crosshair {
  private el: HTMLDivElement;
  private youPips: HTMLElement | null = null;
  private themPips: HTMLElement | null = null;
  private compareEl: HTMLElement | null = null;

  constructor() {
    let el = document.getElementById('crosshair-pro') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'crosshair-pro';
      el.innerHTML = `
        <div class="ch-dot"></div>
        <div class="ch-t"></div><div class="ch-b"></div>
        <div class="ch-l"></div><div class="ch-r"></div>
        <div class="ch-compare" hidden>
          <div class="ch-you" title="Deine Kraft"><span></span><span></span><span></span></div>
          <div class="ch-vs"></div>
          <div class="ch-them" title="Bestie"><span></span><span></span><span></span></div>
        </div>
      `;
      const style = document.createElement('style');
      style.textContent = `
        #crosshair-pro {
          position: absolute; left: 50%; top: 50%; width: 28px; height: 28px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 11;
        }
        #crosshair-pro .ch-dot {
          position: absolute; left: 50%; top: 50%; width: 3px; height: 3px;
          margin: -1.5px 0 0 -1.5px; background: #f4f0e6; border-radius: 50%;
          box-shadow: 0 0 2px #000;
        }
        #crosshair-pro .ch-t, #crosshair-pro .ch-b, #crosshair-pro .ch-l, #crosshair-pro .ch-r {
          position: absolute; background: #f4f0e6; box-shadow: 0 0 2px #000;
        }
        #crosshair-pro .ch-t { left: 50%; top: 0; width: 2px; height: 7px; margin-left: -1px; }
        #crosshair-pro .ch-b { left: 50%; bottom: 0; width: 2px; height: 7px; margin-left: -1px; }
        #crosshair-pro .ch-l { top: 50%; left: 0; height: 2px; width: 7px; margin-top: -1px; }
        #crosshair-pro .ch-r { top: 50%; right: 0; height: 2px; width: 7px; margin-top: -1px; }
        #crosshair-pro.bind-ready .ch-dot,
        #crosshair-pro.bind-ready .ch-t,
        #crosshair-pro.bind-ready .ch-b,
        #crosshair-pro.bind-ready .ch-l,
        #crosshair-pro.bind-ready .ch-r { background: #5dffb0; box-shadow: 0 0 6px #5dffb0; }
        #crosshair-pro.bind-focus .ch-dot,
        #crosshair-pro.bind-focus .ch-t,
        #crosshair-pro.bind-focus .ch-b,
        #crosshair-pro.bind-focus .ch-l,
        #crosshair-pro.bind-focus .ch-r { background: #c8bfff; }
        #crosshair-pro.bind-channel .ch-t,
        #crosshair-pro.bind-channel .ch-b,
        #crosshair-pro.bind-channel .ch-l,
        #crosshair-pro.bind-channel .ch-r { background: #ffe08a; height: 10px; width: 2px; }
        #crosshair-pro.bind-channel .ch-l, #crosshair-pro.bind-channel .ch-r { width: 10px; height: 2px; }
        #crosshair-pro .ch-compare {
          position: absolute; left: 50%; top: 22px; transform: translateX(-50%);
          display: flex; align-items: center; gap: 6px;
          filter: drop-shadow(0 1px 2px #000);
        }
        #crosshair-pro .ch-you, #crosshair-pro .ch-them {
          display: flex; gap: 3px;
        }
        #crosshair-pro .ch-you span, #crosshair-pro .ch-them span {
          width: 7px; height: 7px; border-radius: 2px;
          background: rgba(40,36,55,0.85);
          border: 1px solid rgba(255,255,255,0.25);
          box-sizing: border-box;
        }
        #crosshair-pro .ch-you span.on {
          background: #c9a227;
          border-color: #ffe08a;
          box-shadow: 0 0 6px rgba(201,162,39,0.7);
        }
        #crosshair-pro .ch-them span.on {
          background: #a78bfa;
          border-color: #ddd6fe;
          box-shadow: 0 0 6px rgba(167,139,250,0.65);
        }
        #crosshair-pro .ch-vs {
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(244,240,230,0.5);
        }
        #crosshair-pro.fit-good .ch-vs { background: #5dffb0; box-shadow: 0 0 8px #5dffb0; }
        #crosshair-pro.fit-mid .ch-vs { background: #ffc070; box-shadow: 0 0 6px #ffc070; }
        #crosshair-pro.fit-bad .ch-vs { background: #ff6b6b; box-shadow: 0 0 6px #ff6b6b; }
        #crosshair { display: none !important; }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.el = el;
    this.compareEl = el.querySelector('.ch-compare');
    this.youPips = el.querySelector('.ch-you');
    this.themPips = el.querySelector('.ch-them');
  }

  setMode(mode: 'normal' | 'focus' | 'ready' | 'channel') {
    this.el.classList.remove('bind-ready', 'bind-focus', 'bind-channel');
    if (mode === 'ready') this.el.classList.add('bind-ready');
    if (mode === 'focus') this.el.classList.add('bind-focus');
    if (mode === 'channel') this.el.classList.add('bind-channel');
    if (mode === 'normal' && this.compareEl) this.compareEl.hidden = true;
  }

  /**
   * Visual power compare: youPower/beastPower in 1..3 pips, fit 0..1 for middle dot color.
   */
  setPowerCompare(you: number, beast: number, fit: number, show: boolean) {
    if (!this.compareEl || !this.youPips || !this.themPips) return;
    this.compareEl.hidden = !show;
    if (!show) {
      this.el.classList.remove('fit-good', 'fit-mid', 'fit-bad');
      return;
    }
    const y = Math.max(1, Math.min(3, Math.round(you)));
    const b = Math.max(1, Math.min(3, Math.round(beast)));
    [...this.youPips.children].forEach((c, i) => c.classList.toggle('on', i < y));
    [...this.themPips.children].forEach((c, i) => c.classList.toggle('on', i < b));
    this.el.classList.remove('fit-good', 'fit-mid', 'fit-bad');
    if (fit >= 0.65) this.el.classList.add('fit-good');
    else if (fit >= 0.4) this.el.classList.add('fit-mid');
    else this.el.classList.add('fit-bad');
  }

  show(v: boolean) {
    this.el.style.display = v ? 'block' : 'none';
  }
}
