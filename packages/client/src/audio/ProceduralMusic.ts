import type { GamePhase } from '@cyberante/shared';
import { VoicePool } from './VoicePool.js';

const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 440];
const PACING: Record<GamePhase, { bpm: number; cutoff: number; q: number }> = {
  LOBBY_WAIT: { bpm: 85, cutoff: 400, q: 0.7 },
  DEAL: { bpm: 85, cutoff: 400, q: 0.7 },
  SHAPING: { bpm: 115, cutoff: 900, q: 3.5 },
  COMMITMENT: { bpm: 135, cutoff: 1800, q: 1.5 },
  CLASH_REVEAL: { bpm: 90, cutoff: 20000, q: 0.7 },
  ROUND_RESOLVE: { bpm: 100, cutoff: 1800, q: 0.7 },
  MATCH_OVER: { bpm: 100, cutoff: 900, q: 0.7 },
};

export class ProceduralMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private readonly voices = new VoicePool(16);
  private timer: ReturnType<typeof setInterval> | undefined;
  private playing = false;
  private phase: GamePhase = 'LOBBY_WAIT';
  private bpm = 85;
  private step = 0;
  private nextNoteTime = 0;

  // Nullable binding keeps the public engine idle and usable without Web Audio.
  constructor(ctx: AudioContext | null, masterGain: GainNode | null) {
    if (ctx && masterGain) this.attach(ctx, masterGain);
  }
  public attach(ctx: AudioContext, masterGain: GainNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = masterGain;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.35;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.connect(this.bus);
    this.bus.connect(masterGain);
    this.applyFilter();
  }
  public start(): void {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextNoteTime = 0;
    this.update();
  }
  public stop(): void {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = undefined;
    this.silence();
  }
  /** Cancel scheduled notes while retaining requested playback. */
  public silence(): void { this.voices.clear(); this.nextNoteTime = 0; }
  public setPhase(phase: GamePhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.bpm = PACING[phase].bpm;
    this.silence();
    this.step = 0;
    this.applyFilter();
    this.update();
  }
  public setTempo(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) throw new RangeError('Tempo must be 40–240 BPM');
    this.bpm = bpm;
  }
  private applyFilter(): void {
    if (!this.ctx || !this.filter) return;
    const pacing = PACING[this.phase];
    const t = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(Math.min(pacing.cutoff, this.ctx.sampleRate / 2), t, 0.04);
    this.filter.Q.setValueAtTime(pacing.q, t);
  }
  /** JS wakes every 25ms; note starts/envelopes use the audio clock, 100ms ahead. */
  public update(): void {
    const ctx = this.ctx;
    if (!this.playing || !ctx || ctx.state !== 'running' || !this.master?.gain.value) return;
    if (this.timer === undefined) this.timer = setInterval(() => this.update(), 25);
    if (this.nextNoteTime <= ctx.currentTime) this.nextNoteTime = ctx.currentTime + 0.01;
    // A bounded horizon avoids scheduling a backlog after a late tab wakeup.
    for (let count = 0; count < 8 && this.nextNoteTime < ctx.currentTime + 0.1; count++) {
      this.playStep(this.step, this.nextNoteTime);
      this.step = (this.step + 1) % 8;
      this.nextNoteTime += 60 / this.bpm / 4;
    }
  }
  private playStep(step: number, t: number): void {
    if (this.phase === 'SHAPING' || this.phase === 'COMMITMENT') {
      this.tone(SCALE[step], t, 0.11, this.phase === 'SHAPING' ? 'triangle' : 'square', 0.12);
      if (step % 4 === 0) this.tone(SCALE[0] / 2, t, 0.23, 'sawtooth', 0.18);
    } else if (this.phase === 'CLASH_REVEAL') {
      if (step === 0) this.tone(73.415, t, 0.6, 'sine', 0.35, 30);
    } else if (step === 0) {
      const chord = this.phase === 'ROUND_RESOLVE' || this.phase === 'MATCH_OVER';
      for (const frequency of chord ? [SCALE[0], SCALE[1], SCALE[3]] : [SCALE[0] / 2, SCALE[1]]) {
        this.tone(frequency, t, 60 / this.bpm * 1.8, 'triangle', chord ? 0.08 : 0.07);
      }
    }
  }
  private tone(frequency: number, t: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number): void {
    const ctx = this.ctx!;
    const voice = this.voices.create(1);
    const oscillator = voice.source(ctx.createOscillator());
    const gain = voice.node(ctx.createGain());
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.015, duration / 10));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.filter!);
    oscillator.start(t);
    oscillator.stop(t + duration);
  }
  public dispose(): void {
    this.stop();
    this.filter?.disconnect();
    this.bus?.disconnect();
    this.ctx = null;
    this.master = this.bus = null;
    this.filter = null;
  }
}
