// ============================================================================
// CYBERANTE: Master Web Audio API Engine
// ============================================================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private muted: boolean = false;
  private fftData: Uint8Array | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public init(): void {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.fftData = new Uint8Array(this.analyser.frequencyBinCount);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  public get context(): AudioContext | null {
    return this.ctx;
  }

  public get destinationNode(): AudioNode | null {
    return this.masterGain;
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public get isMuted(): boolean { return this.muted; }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.muted;
  }

  /**
   * Retrieves real-time normalized frequency energy buckets for WebGL shader uniforms.
   */
  public getEnergyLevels(): { bass: number; mid: number; high: number } {
    if (!this.analyser || !this.fftData) {
      return { bass: 0, mid: 0, high: 0 };
    }

    (this.analyser as any).getByteFrequencyData(this.fftData);

    // Bin 0-3: Sub/Bass, Bin 4-12: Mid, Bin 13-31: High
    const bass = (this.fftData[1] + this.fftData[2]) / (2 * 255);
    const mid = (this.fftData[6] + this.fftData[8]) / (2 * 255);
    const high = (this.fftData[16] + this.fftData[20]) / (2 * 255);

    return { bass, mid, high };
  }
}

export const masterAudio = new AudioEngine();
