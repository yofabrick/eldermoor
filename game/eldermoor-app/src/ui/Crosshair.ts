/** Contextual crosshair — changes when bind-ready */

export class Crosshair {
  private el: HTMLDivElement;

  constructor() {
    let el = document.getElementById('crosshair-pro') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'crosshair-pro';
      el.innerHTML = `
        <div class="ch-dot"></div>
        <div class="ch-t"></div><div class="ch-b"></div>
        <div class="ch-l"></div><div class="ch-r"></div>
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
        #crosshair-pro.bind-ready { color: #5dffb0; }
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
        #crosshair { display: none !important; }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.el = el;
  }

  setMode(mode: 'normal' | 'focus' | 'ready' | 'channel') {
    this.el.classList.remove('bind-ready', 'bind-focus', 'bind-channel');
    if (mode === 'ready') this.el.classList.add('bind-ready');
    if (mode === 'focus') this.el.classList.add('bind-focus');
    if (mode === 'channel') this.el.classList.add('bind-channel');
  }

  show(v: boolean) {
    this.el.style.display = v ? 'block' : 'none';
  }
}
