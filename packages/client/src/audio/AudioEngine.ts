import { ProceduralMusic } from './ProceduralMusic.js';
import { SoundEffects } from './SoundEffects.js';

const MASTER_VOLUME = 0.3;

export class AudioEngine {
  public readonly music = new ProceduralMusic(null, null);
  public readonly sfx = new SoundEffects(null, null);
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private fftData = new Uint8Array(128);
  private muted = false;

  /** Called by a gesture, never during module import. One graph per engine. */
  public init(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const Context = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new Context();
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : MASTER_VOLUME, ctx.currentTime);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      this.music.attach(ctx, master);
      this.sfx.attach(ctx, master);
      this.masterGain = master;
      this.analyser = analyser;
      this.ctx = ctx;
    } catch {
      this.music.dispose();
      this.sfx.dispose();
      if (ctx) void ctx.close().catch(() => {});
    }
  }

  public get context(): AudioContext | null { return this.ctx; }
  public get isMuted(): boolean { return this.muted; }

  public async resume(): Promise<void> {
    try {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      this.music.update();
    } catch { /* A denied gesture must not break the game. */ }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : MASTER_VOLUME, this.ctx.currentTime);
      if (this.muted) { this.music.silence(); this.sfx.stop(); }
      else this.music.update();
    }
    return this.muted;
  }

  public getEnergyLevels(): { bass: number; mid: number; high: number } {
    if (!this.analyser || this.muted || this.ctx?.state !== 'running') {
      return { bass: 0, mid: 0, high: 0 };
    }
    this.analyser.getByteFrequencyData(this.fftData);
    const average = (start: number, end: number): number => {
      let sum = 0;
      for (let i = start; i <= end; i++) sum += this.fftData[i];
      return sum / ((end - start + 1) * 255);
    };
    return { bass: average(1, 10), mid: average(11, 40), high: average(41, 100) };
  }

  public async dispose(): Promise<void> {
    this.music.dispose();
    this.sfx.dispose();
    this.masterGain?.disconnect();
    this.analyser?.disconnect();
    const ctx = this.ctx;
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => {});
  }
}

export const masterAudio = new AudioEngine();
