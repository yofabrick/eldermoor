/**
 * Procedural Web Audio — no sound files (Claude-of-Duty style).
 * Bind hum pitch = chance: tief = schwach, hoch = stark; rises while channeling.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private ambOsc: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private footCd = 0;
  masterVolume = 0.16;
  private humLevel = 0;
  private humFit = 0.5;
  private humProgress = 0;

  async resume(): Promise<void> {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      this.ensureAmbient();
      this.ensureHum();
    } catch (err) {
      // Autoplay policy / no AudioContext: audio is optional, never fatal.
      console.warn('AudioBus: init failed', err);
    }
  }

  /**
   * Every frame.
   * bindHum 0..1 volume presence
   * bindFit 0..1 catch chance (pitch high when strong)
   * channelProgress 0..1 while holding F (pitch climbs the spell)
   * bindPhase: off | focus (violet) | ready (green) | channel (gold)
   */
  tick(
    dt: number,
    opts: {
      bindHum: number;
      night: number;
      footstep: boolean;
      sprint: boolean;
      bindFit?: number;
      channelProgress?: number;
      bindPhase?: 'off' | 'focus' | 'ready' | 'channel';
    },
  ): void {
    this.footCd = Math.max(0, this.footCd - dt);
    this.humLevel = this.humLevel * 0.82 + opts.bindHum * 0.18;
    this.humFit = this.humFit * 0.88 + (opts.bindFit ?? 0.5) * 0.12;
    this.humProgress = this.humProgress * 0.75 + (opts.channelProgress ?? 0) * 0.25;

    try {
      if (this.humGain && this.ctx) {
        const t = this.ctx.currentTime;
        const phase = opts.bindPhase ?? 'off';
        // Volume: soft when looking, fuller when ready/channel
        const volMul =
          phase === 'channel' ? 1.15 : phase === 'ready' ? 0.95 : phase === 'focus' ? 0.55 : 0.2;
        this.humGain.gain.setTargetAtTime(0.0001 + this.humLevel * 0.085 * volMul, t, 0.06);

        // Pitch language (no text):
        // weak fit → deep (~120Hz) · strong fit → bright (~340Hz)
        // while channeling, climb further with progress (spell rising)
        const fitHz = 120 + this.humFit * 220;
        const climbHz = phase === 'channel' ? this.humProgress * 160 : 0;
        // violet focus: slightly flat/dissonant (detuned second osc)
        const baseHz = fitHz + climbHz;
        if (this.humOsc) {
          this.humOsc.frequency.setTargetAtTime(Math.max(60, baseHz), t, 0.07);
          this.humOsc.type = phase === 'channel' ? 'triangle' : 'sine';
        }
        if (this.humOsc2) {
          // Harmony: strong = clean fifth above; weak = muddy minor second
          const interval = this.humFit >= 0.55 ? 1.5 : this.humFit >= 0.35 ? 1.25 : 1.06;
          this.humOsc2.frequency.setTargetAtTime(Math.max(60, baseHz * interval), t, 0.08);
          // Second voice quieter when weak (muddy), fuller when strong
          // (volume is shared via humGain — keep second osc always connected)
        }
      }
      if (this.ambGain && this.ctx) {
        this.ambGain.gain.setTargetAtTime(0.012 + opts.night * 0.02, this.ctx.currentTime, 0.2);
      }
    } catch (err) {
      // Ambient bed is non-critical; gameplay audio continues without it.
      console.warn('AudioBus: ambient update failed', err);
    }
    if (opts.footstep && this.footCd <= 0) {
      this.playFootstep(opts.sprint);
      this.footCd = opts.sprint ? 0.28 : 0.38;
    }
  }

  playGather(): void {
    // Soft wood-chime cluster (cozy, not generic beep)
    this.blip({ freq: 392, freqEnd: 494, dur: 0.07, type: 'triangle', gain: 0.4 });
    this.blip({ freq: 523, freqEnd: 587, dur: 0.09, type: 'sine', gain: 0.35, delay: 0.03 });
    this.blip({ freq: 659, freqEnd: 698, dur: 0.06, type: 'sine', gain: 0.2, delay: 0.07 });
  }

  /** Solid place — deeper thud than gather */
  playBuild(): void {
    this.blip({ freq: 98, freqEnd: 72, dur: 0.14, type: 'triangle', gain: 0.5 });
    this.blip({ freq: 196, freqEnd: 247, dur: 0.1, type: 'sine', gain: 0.28, delay: 0.04 });
    this.blip({ freq: 392, freqEnd: 523, dur: 0.12, type: 'triangle', gain: 0.25, delay: 0.1 });
    this.blip({ freq: 784, freqEnd: 880, dur: 0.08, type: 'sine', gain: 0.15, delay: 0.16 });
  }

  /** Soft axe thud for station workers (Demo Law #2 spectacle) */
  playChop(): void {
    this.blip({ freq: 95, freqEnd: 55, dur: 0.08, type: 'triangle', gain: 0.32 });
    this.blip({ freq: 180, freqEnd: 120, dur: 0.05, type: 'sine', gain: 0.14, delay: 0.02 });
    this.blip({ freq: 340, freqEnd: 200, dur: 0.04, type: 'square', gain: 0.06, delay: 0.04 });
  }

  /** Window opens — pitch of blip scales with fit (high = good odds). */
  playCaptureOpen(fit = 0.55): void {
    const f = Math.max(0, Math.min(1, fit));
    const root = 280 + f * 220; // weak deep · strong bright
    this.blip({ freq: root, freqEnd: root * 1.25, dur: 0.16, type: 'sine', gain: 0.38 + f * 0.12 });
    this.blip({
      freq: root * 1.5,
      freqEnd: root * 1.75,
      dur: 0.18,
      type: 'triangle',
      gain: 0.28 + f * 0.1,
      delay: 0.05,
    });
    if (f >= 0.5) {
      this.blip({
        freq: root * 2,
        freqEnd: root * 2.2,
        dur: 0.12,
        type: 'sine',
        gain: 0.16,
        delay: 0.12,
      });
    }
  }

  playCaptureSuccess(): void {
    // Bright major arpeggio (always victorious)
    this.blip({ freq: 523, freqEnd: 523, dur: 0.12, type: 'sine', gain: 0.48 });
    this.blip({ freq: 659, freqEnd: 659, dur: 0.12, type: 'sine', gain: 0.42, delay: 0.09 });
    this.blip({ freq: 784, freqEnd: 784, dur: 0.12, type: 'sine', gain: 0.4, delay: 0.18 });
    this.blip({ freq: 1047, freqEnd: 1175, dur: 0.28, type: 'triangle', gain: 0.35, delay: 0.28 });
    this.blip({ freq: 1568, freqEnd: 1760, dur: 0.18, type: 'sine', gain: 0.18, delay: 0.4 });
  }

  /** Fail — always descends; deeper start if odds were bad (expected), sharper if odds were good (sting). */
  playCaptureFail(fit = 0.4): void {
    const f = Math.max(0, Math.min(1, fit));
    const start = 200 + f * 280; // strong fail stings higher then falls
    this.blip({ freq: start, freqEnd: 90, dur: 0.22, type: 'sawtooth', gain: 0.26 + f * 0.08 });
    this.blip({
      freq: start * 0.75,
      freqEnd: 70,
      dur: 0.18,
      type: 'triangle',
      gain: 0.2,
      delay: 0.05,
    });
  }

  playHit(): void {
    this.blip({ freq: 160, freqEnd: 90, dur: 0.1, type: 'square', gain: 0.22 });
    this.blip({ freq: 90, freqEnd: 50, dur: 0.12, type: 'sawtooth', gain: 0.18, delay: 0.02 });
  }

  playUI(): void {
    this.blip({ freq: 660, freqEnd: 880, dur: 0.05, type: 'sine', gain: 0.35 });
  }

  playHeat(): void {
    this.blip({ freq: 200, freqEnd: 140, dur: 0.25, type: 'sawtooth', gain: 0.2 });
    this.blip({ freq: 300, freqEnd: 220, dur: 0.18, type: 'triangle', gain: 0.15, delay: 0.04 });
  }

  playBoss(): void {
    this.blip({ freq: 80, freqEnd: 55, dur: 0.35, type: 'sawtooth', gain: 0.28 });
    this.blip({ freq: 120, freqEnd: 90, dur: 0.28, type: 'square', gain: 0.18, delay: 0.05 });
    this.blip({ freq: 40, freqEnd: 30, dur: 0.4, type: 'triangle', gain: 0.22, delay: 0.08 });
  }

  playRaid(): void {
    this.blip({ freq: 180, freqEnd: 140, dur: 0.15, type: 'square', gain: 0.2 });
    this.blip({ freq: 220, freqEnd: 160, dur: 0.12, type: 'sawtooth', gain: 0.15, delay: 0.1 });
    this.blip({ freq: 140, freqEnd: 100, dur: 0.2, type: 'triangle', gain: 0.18, delay: 0.2 });
  }

  playFootstep(sprint: boolean): void {
    this.blip({
      freq: sprint ? 90 : 70,
      freqEnd: 40,
      dur: 0.06,
      type: 'triangle',
      gain: sprint ? 0.18 : 0.12,
    });
    this.blip({
      freq: 180,
      freqEnd: 100,
      dur: 0.04,
      type: 'sine',
      gain: 0.06,
      delay: 0.01,
    });
  }

  /** Soft camp-day ambience (wind + distant chime) — call from Game when audio resumes */
  playCampAmbience(): void {
    this.blip({ freq: 220, freqEnd: 200, dur: 0.8, type: 'sine', gain: 0.04 });
    this.blip({ freq: 880, freqEnd: 990, dur: 0.35, type: 'triangle', gain: 0.05, delay: 0.4 });
    this.blip({ freq: 1320, freqEnd: 1180, dur: 0.4, type: 'sine', gain: 0.03, delay: 0.9 });
  }

  private ensureHum(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.humOsc) return;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.0001;
    this.humGain.connect(this.master);

    this.humOsc = ctx.createOscillator();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.value = 200;
    this.humOsc.connect(this.humGain);
    this.humOsc.start();

    // Second voice for consonant/dissonant fit (interval set in tick)
    this.humOsc2 = ctx.createOscillator();
    this.humOsc2.type = 'sine';
    this.humOsc2.frequency.value = 300;
    const g2 = ctx.createGain();
    g2.gain.value = 0.45; // relative to shared humGain chain — mix quieter
    // Route: humOsc2 → g2 → humGain so master volume still applies
    this.humOsc2.connect(g2);
    g2.connect(this.humGain);
    this.humOsc2.start();
  }

  private ensureAmbient(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.ambOsc) return;
    this.ambOsc = ctx.createOscillator();
    this.ambGain = ctx.createGain();
    this.ambOsc.type = 'triangle';
    this.ambOsc.frequency.value = 55;
    this.ambGain.gain.value = 0.012;
    // subtle LFO via second osc not needed
    this.ambOsc.connect(this.ambGain);
    this.ambGain.connect(this.master);
    this.ambOsc.start();
  }

  private ensureCtx(): AudioContext | null {
    try {
      if (!this.ctx) {
        // Safari < 14 only exposes the vendor-prefixed constructor.
        const win = window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        const AC = win.AudioContext ?? win.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.masterVolume;
        this.master.connect(this.ctx.destination);
      } else if (this.master) {
        this.master.gain.value = this.masterVolume;
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private blip(opts: {
    freq: number;
    freqEnd: number;
    dur: number;
    type: OscillatorType;
    gain: number;
    delay?: number;
  }): void {
    try {
      const ctx = this.ensureCtx();
      if (!ctx || !this.master) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      const t0 = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type;
      osc.frequency.setValueAtTime(opts.freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.dur);

      const peak = Math.max(0.0001, opts.gain);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + opts.dur + 0.02);
      osc.onended = () => {
        // A node may already be disconnected if the context closed mid-play.
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (err) {
          console.warn('AudioBus: disconnect failed', err);
        }
      };
    } catch (err) {
      // Voice budget exhausted or context lost — dropping one sound is acceptable.
      console.warn('AudioBus: play failed', err);
    }
  }
}
