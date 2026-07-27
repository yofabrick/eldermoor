/**
 * Procedural Web Audio — no sound files (Claude-of-Duty style).
 * Layers: SFX blips + bind hum drone + light ambience.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private ambOsc: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private footCd = 0;
  masterVolume = 0.16;
  private humLevel = 0;

  async resume(): Promise<void> {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      this.ensureAmbient();
      this.ensureHum();
    } catch {
      /* blocked */
    }
  }

  /** Call every frame: bind hum intensity 0..1, ambient night 0..1, footstep request */
  tick(
    dt: number,
    opts: { bindHum: number; night: number; footstep: boolean; sprint: boolean },
  ): void {
    this.footCd = Math.max(0, this.footCd - dt);
    // Smooth hum
    this.humLevel = this.humLevel * 0.85 + opts.bindHum * 0.15;
    try {
      if (this.humGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.humGain.gain.setTargetAtTime(0.0001 + this.humLevel * 0.07, t, 0.05);
        if (this.humOsc) {
          this.humOsc.frequency.setTargetAtTime(180 + this.humLevel * 220, t, 0.08);
        }
      }
      if (this.ambGain && this.ctx) {
        this.ambGain.gain.setTargetAtTime(0.012 + opts.night * 0.02, this.ctx.currentTime, 0.2);
      }
    } catch {
      /* */
    }
    if (opts.footstep && this.footCd <= 0) {
      this.playFootstep(opts.sprint);
      this.footCd = opts.sprint ? 0.28 : 0.38;
    }
  }

  playGather(): void {
    this.blip({ freq: 420, freqEnd: 560, dur: 0.08, type: 'triangle', gain: 0.55 });
    this.blip({ freq: 640, freqEnd: 780, dur: 0.06, type: 'sine', gain: 0.3, delay: 0.04 });
  }

  playCaptureOpen(): void {
    this.blip({ freq: 280, freqEnd: 520, dur: 0.18, type: 'sine', gain: 0.45 });
    this.blip({ freq: 420, freqEnd: 720, dur: 0.14, type: 'triangle', gain: 0.28, delay: 0.06 });
  }

  playCaptureSuccess(): void {
    this.blip({ freq: 523, freqEnd: 523, dur: 0.1, type: 'sine', gain: 0.5 });
    this.blip({ freq: 659, freqEnd: 659, dur: 0.1, type: 'sine', gain: 0.45, delay: 0.08 });
    this.blip({ freq: 784, freqEnd: 880, dur: 0.22, type: 'triangle', gain: 0.4, delay: 0.16 });
  }

  playCaptureFail(): void {
    this.blip({ freq: 360, freqEnd: 180, dur: 0.2, type: 'sawtooth', gain: 0.28 });
    this.blip({ freq: 240, freqEnd: 120, dur: 0.16, type: 'triangle', gain: 0.22, delay: 0.05 });
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

  private ensureHum(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.humOsc) return;
    this.humOsc = ctx.createOscillator();
    this.humGain = ctx.createGain();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.value = 200;
    this.humGain.gain.value = 0.0001;
    this.humOsc.connect(this.humGain);
    this.humGain.connect(this.master);
    this.humOsc.start();
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
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* */
        }
      };
    } catch {
      /* */
    }
  }
}
