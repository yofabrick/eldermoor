/** COD-style hitmarker + damage number flash in screen center */

export class HitMarker {
  private el: HTMLDivElement;
  private timer = 0;

  constructor() {
    let el = document.getElementById('hitmarker') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'hitmarker';
      el.innerHTML = `
        <svg viewBox="0 0 40 40" width="28" height="28">
          <path d="M8 8 L16 16 M24 16 L32 8 M8 32 L16 24 M24 24 L32 32"
            stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="square"/>
        </svg>`;
      const style = document.createElement('style');
      style.textContent = `
        #hitmarker {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(0.6);
          color: #f4f0e6; opacity: 0; pointer-events: none; z-index: 12;
          transition: opacity 0.05s linear;
          filter: drop-shadow(0 0 2px #000);
        }
        #hitmarker.show { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        #hitmarker.kill { color: #e85d5d; }
        #hitmarker.bind { color: #5dffb0; }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.el = el;
  }

  /** kind: hit | kill | bind */
  pulse(kind: 'hit' | 'kill' | 'bind' = 'hit') {
    this.timer = kind === 'kill' ? 0.28 : 0.14;
    this.el.classList.remove('kill', 'bind');
    if (kind === 'kill') this.el.classList.add('kill');
    if (kind === 'bind') this.el.classList.add('bind');
    this.el.classList.add('show');
  }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) this.el.classList.remove('show', 'kill', 'bind');
    }
  }
}
