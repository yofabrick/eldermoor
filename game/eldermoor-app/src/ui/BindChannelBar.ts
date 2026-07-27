/**
 * Glimmer-bind channel progress HUD — centered bottom third.
 * Dark fantasy gold/cyan; red pulse + "F HALTEN!" when not holding.
 */

export class BindChannelBar {
  private root: HTMLDivElement;
  private titleEl: HTMLElement;
  private fillEl: HTMLElement;
  private holdEl: HTMLElement;
  private pctEl: HTMLElement;

  private visible = false;
  private targetOpacity = 0;
  private opacity = 0;
  private displayProgress = 0;
  private targetProgress = 0;
  private holding = false;
  private beastName = '';
  private pulseT = 0;

  constructor() {
    let el = document.getElementById('bind-channel-bar') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'bind-channel-bar';
      el.innerHTML = `
        <div class="bcb-inner">
          <div class="bcb-title">
            <span class="bcb-tag">GLIMMER-BIND</span>
            <span class="bcb-sep">·</span>
            <span class="bcb-name"></span>
          </div>
          <div class="bcb-track">
            <div class="bcb-fill"></div>
            <div class="bcb-glow"></div>
          </div>
          <div class="bcb-meta">
            <span class="bcb-hold">F HALTEN!</span>
            <span class="bcb-pct">0%</span>
          </div>
        </div>
      `;
      const style = document.createElement('style');
      style.textContent = `
        #bind-channel-bar {
          position: absolute;
          left: 50%;
          top: 68%;
          transform: translate(-50%, 8px);
          width: min(420px, 72vw);
          pointer-events: none;
          z-index: 14;
          opacity: 0;
          will-change: opacity, transform;
          font-family: Segoe UI, system-ui, sans-serif;
        }
        #bind-channel-bar.visible {
          /* class used only as hook; opacity driven in JS for smooth fade */
        }
        #bind-channel-bar .bcb-inner {
          background: linear-gradient(
            180deg,
            rgba(14, 12, 24, 0.55) 0%,
            rgba(11, 10, 18, 0.88) 100%
          );
          border: 1px solid rgba(201, 162, 39, 0.35);
          border-radius: 10px;
          padding: 12px 16px 10px;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.45),
            0 8px 28px rgba(0, 0, 0, 0.55),
            0 0 24px rgba(93, 220, 255, 0.06);
          backdrop-filter: blur(6px);
        }
        #bind-channel-bar .bcb-title {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 1px 4px #000, 0 0 12px rgba(0, 0, 0, 0.8);
        }
        #bind-channel-bar .bcb-tag {
          color: #e8d48b;
          font-size: 11px;
          font-weight: 700;
        }
        #bind-channel-bar .bcb-sep {
          color: #5a5470;
          font-size: 11px;
        }
        #bind-channel-bar .bcb-name {
          color: #a8f0ff;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          max-width: 55%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #bind-channel-bar .bcb-track {
          position: relative;
          height: 14px;
          border-radius: 7px;
          background: rgba(6, 5, 12, 0.92);
          border: 1px solid rgba(46, 40, 72, 0.95);
          overflow: hidden;
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.65);
        }
        #bind-channel-bar .bcb-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 0%;
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            #2a9fb8 0%,
            #5ddcff 42%,
            #e8d48b 100%
          );
          box-shadow:
            0 0 12px rgba(93, 220, 255, 0.55),
            0 0 4px rgba(232, 212, 139, 0.45);
          transition: none;
        }
        #bind-channel-bar .bcb-glow {
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 28px;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 248, 220, 0.55)
          );
          mix-blend-mode: screen;
        }
        #bind-channel-bar.holding .bcb-fill {
          background: linear-gradient(
            90deg,
            #1f8a9e 0%,
            #5ddcff 38%,
            #c9a227 72%,
            #ffe08a 100%
          );
        }
        #bind-channel-bar.holding .bcb-track {
          border-color: rgba(201, 162, 39, 0.55);
          box-shadow:
            inset 0 1px 4px rgba(0, 0, 0, 0.65),
            0 0 14px rgba(93, 220, 255, 0.18);
        }
        #bind-channel-bar.holding .bcb-glow {
          opacity: 1;
        }
        #bind-channel-bar:not(.holding) .bcb-fill {
          background: linear-gradient(
            90deg,
            #6a2830 0%,
            #c94a52 55%,
            #e87a72 100%
          );
          box-shadow: 0 0 10px rgba(232, 93, 93, 0.35);
        }
        #bind-channel-bar:not(.holding) .bcb-track {
          border-color: rgba(200, 80, 80, 0.45);
        }
        #bind-channel-bar .bcb-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          min-height: 16px;
        }
        #bind-channel-bar .bcb-hold {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: #ff8a8a;
          text-shadow: 0 0 8px rgba(232, 93, 93, 0.55), 0 1px 3px #000;
          opacity: 0;
          transition: opacity 0.12s linear;
        }
        #bind-channel-bar:not(.holding) .bcb-hold {
          opacity: 1;
        }
        #bind-channel-bar.holding .bcb-hold {
          opacity: 0;
        }
        #bind-channel-bar .bcb-pct {
          font-size: 11px;
          font-weight: 700;
          color: #e8d48b;
          letter-spacing: 0.06em;
          text-shadow: 0 1px 3px #000;
          margin-left: auto;
          font-variant-numeric: tabular-nums;
        }
        #bind-channel-bar:not(.holding) .bcb-pct {
          color: #ffb0b0;
        }
      `;
      document.head.appendChild(style);
      document.getElementById('ui')?.appendChild(el);
    }
    this.root = el;
    this.titleEl = el.querySelector('.bcb-name')!;
    this.fillEl = el.querySelector('.bcb-fill')!;
    this.holdEl = el.querySelector('.bcb-hold')!;
    this.pctEl = el.querySelector('.bcb-pct')!;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.targetOpacity = v ? 1 : 0;
    this.root.classList.toggle('visible', v);
    if (v) {
      // snap name/state if already set
      this.root.style.display = 'block';
    }
  }

  /**
   * @param progress 0..1 channel fill
   * @param beastName target name for label
   * @param holding whether F is held
   */
  setProgress(progress: number, beastName: string, holding: boolean): void {
    this.targetProgress = Math.max(0, Math.min(1, progress));
    this.beastName = beastName;
    this.holding = holding;
    this.titleEl.textContent = beastName;
    this.root.classList.toggle('holding', holding);
    this.holdEl.textContent = 'F HALTEN!';
  }

  update(dt: number): void {
    // Smooth opacity show/hide
    const fadeSpeed = 6;
    if (this.opacity < this.targetOpacity) {
      this.opacity = Math.min(this.targetOpacity, this.opacity + dt * fadeSpeed);
    } else if (this.opacity > this.targetOpacity) {
      this.opacity = Math.max(this.targetOpacity, this.opacity - dt * fadeSpeed);
    }

    if (this.opacity <= 0.001 && !this.visible) {
      this.root.style.opacity = '0';
      this.root.style.display = 'none';
      this.root.style.transform = 'translate(-50%, 10px)';
      this.displayProgress = 0;
      return;
    }

    this.root.style.display = 'block';
    this.root.style.opacity = String(this.opacity);
    const y = (1 - this.opacity) * 10;
    this.root.style.transform = `translate(-50%, ${y}px)`;

    // Smooth fill chase
    const fillSpeed = 8;
    const diff = this.targetProgress - this.displayProgress;
    if (Math.abs(diff) < 0.001) {
      this.displayProgress = this.targetProgress;
    } else {
      this.displayProgress += diff * Math.min(1, dt * fillSpeed);
    }
    const pct = Math.round(this.displayProgress * 100);
    this.fillEl.style.width = `${this.displayProgress * 100}%`;
    this.pctEl.textContent = `${pct}%`;

    // Red pulse when not holding
    this.pulseT += dt;
    if (!this.holding && this.visible) {
      const pulse = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(this.pulseT * 7));
      this.holdEl.style.opacity = String(pulse);
      this.root.style.filter = `brightness(${0.92 + 0.12 * (0.5 + 0.5 * Math.sin(this.pulseT * 5))})`;
    } else {
      this.holdEl.style.opacity = this.holding ? '0' : '';
      this.root.style.filter = '';
    }
  }
}
