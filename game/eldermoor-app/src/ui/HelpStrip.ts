/** Persistent bottom help strip — always answers "what do I do?" */

export class HelpStrip {
  private el: HTMLDivElement;

  constructor() {
    let el = document.getElementById('help-strip') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'help-strip';
      const style = document.createElement('style');
      style.textContent = `
        #help-strip {
          position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
          max-width: min(720px, 94vw); z-index: 9; pointer-events: none;
          font-family: Segoe UI, system-ui, sans-serif; font-size: 11px;
          color: #a39bb8; text-align: center; line-height: 1.45;
          background: rgba(11,10,18,.78); border: 1px solid #2e2848;
          border-radius: 10px; padding: 6px 14px;
          text-shadow: 0 1px 2px #000;
        }
        #help-strip b { color: #e8d48b; }
        #help-strip .ok { color: #5dffb0; }
        #help-strip .bad { color: #e85d5d; }
        #help-strip .hint { color: #c8bfff; }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.el = el;
    this.setDefault();
  }

  setDefault() {
    this.el.innerHTML = `
      <b>Sammeln:</b> drüberlaufen ·
      <b>Binden:</b> anschauen · <span class="hint">violett</span> Ring = warten ·
      <span class="ok">viele grüne Keile</span> = starker Griff · <span class="bad">rote Keile</span> = schwach ·
      Gold-◆ du · Violett-◆ Bestie · <span class="ok">F halten</span>
    `;
  }

  set(html: string) {
    this.el.innerHTML = html;
  }

  show(v: boolean) {
    this.el.style.display = v ? 'block' : 'none';
  }
}
