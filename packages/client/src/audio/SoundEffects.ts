import type { Stance } from '@cyberante/shared';
import { Voice, VoicePool } from './VoicePool.js';

export class SoundEffects {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly voices = new VoicePool(32);

  constructor(ctx: AudioContext | null, masterGain: GainNode | null) {
    if (ctx && masterGain) this.attach(ctx, masterGain);
  }
  public attach(ctx: AudioContext, masterGain: GainNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = masterGain;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.bus.connect(masterGain);
  }
  private get audible(): boolean { return this.ctx?.state === 'running' && Boolean(this.master?.gain.value); }

  private envelope(voice: Voice, t: number, duration: number, volume: number): GainNode {
    const gain = voice.node(this.ctx!.createGain());
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    gain.connect(this.bus!);
    return gain;
  }
  private oscillator(voice: Voice, type: OscillatorType, frequency: number, t: number, duration: number, end?: number): OscillatorNode {
    const osc = voice.source(this.ctx!.createOscillator());
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    return osc;
  }
  private sweep(type: OscillatorType, frequency: number, end: number, duration: number, volume = 0.25, delay = 0): void {
    if (!this.audible) return;
    const voice = this.voices.create(1);
    const t = this.ctx!.currentTime + delay;
    const osc = this.oscillator(voice, type, frequency, t, duration, end);
    osc.connect(this.envelope(voice, t, duration, volume));
    osc.start(t);
    osc.stop(t + duration);
  }

  public playClick(): void { this.sweep('sine', 800, 200, 0.04, 0.15); }
  public playCardSelect(): void { this.sweep('triangle', 660, 880, 0.06, 0.18); }
  public playPipNudge(direction: 'UP' | 'DOWN'): void {
    this.sweep('triangle', 440, direction === 'UP' ? 660 : 330, 0.08);
  }
  public playSuitBleed(): void {
    if (!this.audible) return;
    const ctx = this.ctx!;
    const voice = this.voices.create(2);
    const t = ctx.currentTime;
    const filter = voice.node(ctx.createBiquadFilter());
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
    filter.Q.setValueAtTime(6, t);
    filter.connect(this.envelope(voice, t, 0.15, 0.2));
    // Register both sources before starting either, so cleanup owns the pair.
    const oscillators = [440, 444].map(hz => this.oscillator(voice, 'triangle', hz, t, 0.15));
    for (const osc of oscillators) { osc.connect(filter); osc.start(t); osc.stop(t + 0.15); }
  }
  public playBurn(): void {
    if (!this.audible) return;
    const ctx = this.ctx!;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const voice = this.voices.create(1);
    const t = ctx.currentTime;
    const source = voice.source(ctx.createBufferSource());
    source.buffer = this.noise;
    const filter = voice.node(ctx.createBiquadFilter());
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.12);
    source.connect(filter);
    filter.connect(this.envelope(voice, t, 0.12, 0.3));
    source.start(t);
    source.stop(t + 0.12);
  }
  public playStanceSelect(stance: Stance): void {
    if (stance === 'BRACE') this.sweep('square', 120, 80, 0.1);
    else if (stance === 'OVERCHARGE') this.sweep('sawtooth', 220, 880, 0.2);
    else this.modulated('sine', 1400, 1400, 'sine', 320, 0.22, true);
  }
  public playClashLaser(): void { this.modulated('sine', 880, 110, 'square', 110, 0.35, false); }

  private modulated(type: OscillatorType, frequency: number, end: number, modType: OscillatorType, modFrequency: number, duration: number, ring: boolean): void {
    if (!this.audible) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const voice = this.voices.create(2);
    const carrier = this.oscillator(voice, type, frequency, t, duration, end);
    const modulator = this.oscillator(voice, modType, modFrequency, t, duration);
    const modulation = voice.node(ctx.createGain());
    const envelope = this.envelope(voice, t, duration, 0.22);
    if (ring) {
      const ringGain = voice.node(ctx.createGain());
      ringGain.gain.setValueAtTime(0, t);
      modulation.gain.setValueAtTime(1, t);
      modulation.connect(ringGain.gain);
      carrier.connect(ringGain);
      ringGain.connect(envelope);
    } else {
      modulation.gain.setValueAtTime(220, t);
      modulation.gain.exponentialRampToValueAtTime(5, t + duration);
      modulation.connect(carrier.frequency);
      carrier.connect(envelope);
    }
    modulator.connect(modulation);
    carrier.start(t); modulator.start(t);
    carrier.stop(t + duration); modulator.stop(t + duration);
  }

  public playDamageImpact(isLethal = false): void {
    if (!this.audible) return;
    const ctx = this.ctx!;
    const voice = this.voices.create(1);
    const t = ctx.currentTime;
    const duration = isLethal ? 0.6 : 0.3;
    const osc = this.oscillator(voice, 'sine', 65, t, duration, 30);
    const distortion = voice.node(ctx.createWaveShaper());
    const curve = new Float32Array(256);
    const drive = isLethal ? 6 : 3;
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(drive * (2 * i / (curve.length - 1) - 1));
    distortion.curve = curve;
    distortion.oversample = '2x';
    osc.connect(distortion);
    distortion.connect(this.envelope(voice, t, duration, isLethal ? 0.4 : 0.3));
    osc.start(t); osc.stop(t + duration);
  }
  public playVictory(): void {
    for (const [index, hz] of [293.66, 349.23, 440, 587.32].entries()) {
      this.sweep('triangle', hz, hz, 0.35, 0.22, index * 0.12);
    }
  }
  public playDefeat(): void {
    for (const [index, hz] of [293.66, 261.63, 220, 146.83].entries()) {
      this.sweep('triangle', hz, hz * 0.98, 0.4, 0.22, index * 0.14);
    }
  }
  public stop(): void { this.voices.clear(); }
  public dispose(): void {
    this.stop();
    this.bus?.disconnect();
    this.ctx = null;
    this.master = this.bus = null;
    this.noise = null;
  }
}
