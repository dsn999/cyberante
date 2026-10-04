import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GamePhase } from '@cyberante/shared';
import { AudioEngine } from '../audio/AudioEngine.js';
import { ProceduralMusic } from '../audio/ProceduralMusic.js';
import { SoundEffects } from '../audio/SoundEffects.js';

class Param {
  value = 1;
  events: { method: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number): void { this.record('set', value, time); }
  exponentialRampToValueAtTime(value: number, time: number): void { this.record('exponential', value, time); }
  linearRampToValueAtTime(value: number, time: number): void { this.record('linear', value, time); }
  setTargetAtTime(value: number, time: number): void { this.record('target', value, time); }
  cancelScheduledValues(): void {}
  private record(method: string, value: number, time: number): void {
    this.value = value; this.events.push({ method, value, time });
  }
}
class Node {
  connections: unknown[] = [];
  disconnected = false;
  gain = new Param(); frequency = new Param(); Q = new Param();
  type = '';
  fftSize = 0;
  curve: Float32Array | null = null;
  oversample = '';
  buffer: Buffer | null = null;
  onended: (() => void) | null = null;
  starts: number[] = []; stops: (number | undefined)[] = [];
  constructor(public kind: string) {}
  connect(target: unknown): void { this.connections.push(target); }
  disconnect(): void { this.disconnected = true; this.connections = []; }
  start(time: number): void { this.starts.push(time); }
  stop(time?: number): void { this.stops.push(time); }
  end(): void { this.onended?.(); }
  getByteFrequencyData(data: Uint8Array): void { data.set(Context.spectrum); }
}
class Buffer {
  private data: Float32Array;
  constructor(length: number) { this.data = new Float32Array(length); }
  getChannelData(): Float32Array { return this.data; }
}
class Context {
  static instances: Context[] = [];
  static spectrum = new Uint8Array(128);
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  nodes: Node[] = [];
  destination = this.make('destination');
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  constructor() { Context.instances.push(this); }
  make(kind: string): Node { const node = new Node(kind); this.nodes.push(node); return node; }
  createGain(): Node { return this.make('gain'); }
  createAnalyser(): Node { return this.make('analyser'); }
  createOscillator(): Node { return this.make('oscillator'); }
  createBiquadFilter(): Node { return this.make('filter'); }
  createBufferSource(): Node { return this.make('bufferSource'); }
  createWaveShaper(): Node { return this.make('waveShaper'); }
  createBuffer(_channels: number, length: number): Buffer { return new Buffer(length); }
  get sources(): Node[] { return this.nodes.filter(n => n.kind === 'oscillator' || n.kind === 'bufferSource'); }
}
const ctxType = (ctx: Context): AudioContext => ctx as unknown as AudioContext;
const gainType = (gain: Node): GainNode => gain as unknown as GainNode;
const frequencies = (ctx: Context): number[] => ctx.sources.map(n => n.frequency.events[0]?.value);

let engine: AudioEngine;
beforeEach(() => {
  vi.useFakeTimers();
  Context.instances = []; Context.spectrum.fill(0);
  vi.stubGlobal('window', { AudioContext: Context });
  engine = new AudioEngine();
});
afterEach(async () => { await engine.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Spec-06 master graph and graceful gesture activation', () => {
  it('stays idle until init, reuses one graph, routes both buses through a 0.3 master and 256 FFT', () => {
    expect(Context.instances).toHaveLength(0);
    const music = engine.music; const sfx = engine.sfx;
    engine.init(); engine.init();
    expect(Context.instances).toHaveLength(1);
    expect(engine.music).toBe(music); expect(engine.sfx).toBe(sfx);
    const ctx = Context.instances[0]; const master = ctx.nodes[1]; const analyser = ctx.nodes[2];
    expect(master.gain.value).toBe(0.3); expect(analyser.fftSize).toBe(256);
    expect(master.connections).toEqual([analyser]); expect(analyser.connections).toEqual([ctx.destination]);
    expect(ctx.nodes.filter(n => n.connections.includes(master))).toHaveLength(2);
  });
  it('supports mute before init, stops voices on mute, and restores only 0.3', () => {
    expect(engine.toggleMute()).toBe(true); engine.init();
    const ctx = Context.instances[0]; expect(ctx.nodes[1].gain.value).toBe(0);
    engine.sfx.playClick(); expect(ctx.sources).toHaveLength(0);
    expect(engine.toggleMute()).toBe(false); engine.sfx.playClick();
    engine.toggleMute(); expect(ctx.sources.every(n => n.disconnected)).toBe(true);
    engine.toggleMute(); expect(ctx.nodes[1].gain.value).toBe(0.3);
  });
  it('averages every inclusive specified FFT bin, excludes DC and bins above 100', () => {
    engine.init();
    Context.spectrum[0] = Context.spectrum[101] = 255;
    Context.spectrum[1] = Context.spectrum[10] = 255;
    Context.spectrum[11] = Context.spectrum[40] = 255;
    Context.spectrum[41] = Context.spectrum[100] = 255;
    expect(engine.getEnergyLevels()).toEqual({ bass: 0.2, mid: 2 / 30, high: 2 / 60 });
    Context.spectrum.fill(255); expect(engine.getEnergyLevels()).toEqual({ bass: 1, mid: 1, high: 1 });
    engine.toggleMute(); expect(engine.getEnergyLevels()).toEqual({ bass: 0, mid: 0, high: 0 });
  });
  it('remembers music requested during suspension and schedules only after asynchronous resume', async () => {
    engine.init(); const ctx = Context.instances[0]; ctx.state = 'suspended';
    engine.music.start(); engine.sfx.playClick(); expect(ctx.sources).toHaveLength(0);
    expect(engine.getEnergyLevels()).toEqual({ bass: 0, mid: 0, high: 0 });
    await engine.resume(); expect(ctx.resume).toHaveBeenCalledOnce(); expect(ctx.sources.length).toBeGreaterThan(0);
  });
  it('silently handles unavailable APIs, constructor failure and denied resume', async () => {
    vi.stubGlobal('window', {}); engine.init(); engine.music.start(); engine.sfx.playBurn();
    await expect(engine.resume()).resolves.toBeUndefined(); expect(engine.context).toBeNull();
    vi.stubGlobal('window', { AudioContext: class { constructor() { throw new Error('unavailable'); } } });
    expect(() => engine.init()).not.toThrow();
    vi.stubGlobal('window', { AudioContext: Context }); engine.init();
    const ctx = Context.instances[0]; ctx.state = 'suspended'; ctx.resume.mockRejectedValueOnce(new Error('denied'));
    await expect(engine.resume()).resolves.toBeUndefined(); expect(ctx.sources).toHaveLength(0);
  });
  it('cleans up a partially initialized graph and permits later initialization', async () => {
    const create = vi.spyOn(Context.prototype, 'createAnalyser').mockImplementationOnce(() => { throw new Error('graph failed'); });
    engine.init(); expect(engine.context).toBeNull(); expect(Context.instances[0].close).toHaveBeenCalledOnce();
    create.mockRestore(); engine.init(); expect(engine.context).not.toBeNull();
  });
});

describe('Spec-06 synthesis palette and voice ownership', () => {
  let ctx: Context; let sfx: SoundEffects;
  beforeEach(() => { engine.init(); ctx = Context.instances[0]; sfx = engine.sfx; });
  it.each([
    ['click', () => sfx.playClick(), 'sine', 800, 200, 0.04],
    ['card selection', () => sfx.playCardSelect(), 'triangle', 660, 880, 0.06],
    ['up nudge', () => sfx.playPipNudge('UP'), 'triangle', 440, 660, 0.08],
    ['down nudge', () => sfx.playPipNudge('DOWN'), 'triangle', 440, 330, 0.08],
    ['brace', () => sfx.playStanceSelect('BRACE'), 'square', 120, 80, 0.1],
    ['overcharge', () => sfx.playStanceSelect('OVERCHARGE'), 'sawtooth', 220, 880, 0.2],
  ] as const)('%s uses the specified waveform, pitch sweep and lifetime', (_name, play, type, from, to, duration) => {
    play(); const source = ctx.sources[0];
    expect(source.type).toBe(type);
    expect(source.frequency.events).toEqual([{ method: 'set', value: from, time: 0 }, { method: 'exponential', value: to, time: duration }]);
    expect(source.starts).toEqual([0]); expect(source.stops).toEqual([duration]);
    const gain = source.connections[0] as Node;
    expect(gain.gain.events.at(-1)?.value).toBe(0.0001);
  });
  it('bleed owns both detuned triangles and disconnects its filter/envelope only when both end', () => {
    const baseline = ctx.nodes.length; sfx.playSuitBleed();
    expect(frequencies(ctx)).toEqual([440, 444]); expect(ctx.sources.every(n => n.type === 'triangle')).toBe(true);
    const filter = ctx.nodes.slice(baseline).find(n => n.kind === 'filter')!;
    expect(filter.type).toBe('bandpass'); expect(filter.Q.value).toBe(6);
    expect(filter.frequency.events.at(-1)).toEqual({ method: 'exponential', value: 1800, time: 0.15 });
    ctx.sources[0].end(); expect(filter.disconnected).toBe(false);
    ctx.sources[1].end(); expect(ctx.nodes.slice(baseline).every(n => n.disconnected)).toBe(true);
  });
  it('burn synthesizes and reuses a bounded white noise buffer with filtering', () => {
    sfx.playBurn(); sfx.playBurn();
    expect(ctx.sources[0].buffer).toBe(ctx.sources[1].buffer);
    const data = ctx.sources[0].buffer!.getChannelData();
    expect(data.length).toBe(5760); expect(data.every(x => x >= -1 && x <= 1)).toBe(true);
    expect(new Set(data).size).toBeGreaterThan(1000);
    expect(ctx.nodes.filter(n => n.type === 'lowpass')).toHaveLength(3); // music + two bursts
  });
  it('Parry uses a 1400Hz carrier and ring modulation into a zero-offset gain parameter', () => {
    sfx.playStanceSelect('PARRY'); expect(frequencies(ctx)).toEqual([1400, 320]);
    const carrierGain = ctx.sources[0].connections[0] as Node;
    const modGain = ctx.sources[1].connections[0] as Node;
    expect(carrierGain.gain.value).toBe(0); expect(modGain.connections).toContain(carrierGain.gain);
  });
  it('clash FM connects the 110Hz square modulator to the 880Hz carrier frequency', () => {
    sfx.playClashLaser(); expect(frequencies(ctx)).toEqual([880, 110]);
    expect(ctx.sources[1].type).toBe('square');
    expect((ctx.sources[1].connections[0] as Node).connections).toContain(ctx.sources[0].frequency);
    expect(ctx.sources.map(n => n.stops[0])).toEqual([0.35, 0.35]);
  });
  it.each([false, true])('impact has a 65→30Hz sine, bounded distortion and lethal=%s envelope', lethal => {
    sfx.playDamageImpact(lethal);
    const source = ctx.sources[0]; expect(source.type).toBe('sine');
    expect(source.frequency.events.map(e => e.value)).toEqual([65, 30]);
    const shaper = source.connections[0] as Node;
    expect(shaper.kind).toBe('waveShaper'); expect(shaper.oversample).toBe('2x');
    expect(shaper.curve!.every(x => Math.abs(x) <= 1)).toBe(true);
    expect(source.stops).toEqual([lethal ? 0.6 : 0.3]);
  });
  it('victory and defeat schedule distinct ascending/descending fanfares on the audio clock', () => {
    ctx.currentTime = 5; sfx.playVictory();
    expect(frequencies(ctx)).toEqual([293.66, 349.23, 440, 587.32]);
    expect(ctx.sources.map(n => n.starts[0])).toEqual([5, 5.12, 5.24, 5.36]);
    sfx.stop(); const count = ctx.sources.length; sfx.playDefeat();
    expect(frequencies(ctx).slice(count)).toEqual([293.66, 261.63, 220, 146.83]);
  });
  it('disconnects every SFX source, filter, modulation and envelope on natural completion', () => {
    const baseline = ctx.nodes.length;
    sfx.playClick(); sfx.playCardSelect(); sfx.playPipNudge('DOWN'); sfx.playSuitBleed(); sfx.playBurn();
    sfx.playStanceSelect('BRACE'); sfx.playStanceSelect('OVERCHARGE'); sfx.playStanceSelect('PARRY');
    sfx.playClashLaser(); sfx.playDamageImpact(true); sfx.playVictory(); sfx.playDefeat();
    for (const source of ctx.sources) source.end();
    expect(ctx.nodes.slice(baseline).every(n => n.disconnected)).toBe(true);
  });
  it('caps live sources at 32 even during bursts, and cancels future fanfare notes on stop', () => {
    const baseline = ctx.nodes.length;
    for (let i = 0; i < 100; i++) sfx.playClashLaser();
    expect(ctx.sources.filter(n => !n.disconnected)).toHaveLength(32);
    sfx.playVictory(); sfx.stop();
    expect(ctx.nodes.slice(baseline).every(n => n.disconnected)).toBe(true);
    expect(ctx.sources.every(n => n.stops.includes(undefined))).toBe(true);
  });
  it('all methods are harmless and allocate no voices when suspended, muted or closed', () => {
    const playAll = (): void => {
      sfx.playClick(); sfx.playCardSelect(); sfx.playPipNudge('UP'); sfx.playSuitBleed(); sfx.playBurn();
      sfx.playStanceSelect('PARRY'); sfx.playClashLaser(); sfx.playDamageImpact(); sfx.playVictory(); sfx.playDefeat();
    };
    ctx.state = 'suspended'; expect(playAll).not.toThrow();
    ctx.state = 'running'; engine.toggleMute(); expect(playAll).not.toThrow();
    ctx.state = 'closed'; expect(playAll).not.toThrow(); expect(ctx.sources).toHaveLength(0);
  });
});

describe('Spec-06 eight-step music and audio clock scheduling', () => {
  let ctx: Context; let music: ProceduralMusic;
  beforeEach(() => { ctx = new Context(); music = new ProceduralMusic(ctxType(ctx), gainType(ctx.createGain())); });
  afterEach(() => music.dispose());
  it('plays all eight exact pentatonic notes, wraps and schedules sixteenths at 115 BPM', () => {
    music.setPhase('SHAPING'); music.start();
    const interval = 60 / 115 / 4;
    for (let i = 1; i < 10; i++) { ctx.currentTime = i * interval; music.update(); }
    const leads = ctx.sources.filter(n => n.type === 'triangle');
    expect(leads.map(n => n.frequency.events[0].value)).toEqual([146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 440, 146.83, 174.61]);
    for (let i = 0; i < leads.length; i++) expect(leads[i].starts[0]).toBeCloseTo(0.01 + i * interval);
    expect(ctx.sources.filter(n => n.type === 'sawtooth')).toHaveLength(3);
  });
  it.each([
    ['LOBBY_WAIT', 85, 400, 0.7], ['DEAL', 85, 400, 0.7], ['SHAPING', 115, 900, 3.5],
    ['COMMITMENT', 135, 1800, 1.5], ['CLASH_REVEAL', 90, 20000, 0.7], ['ROUND_RESOLVE', 100, 1800, 0.7],
  ] as const)('%s applies the contract tempo/filter and avoids duplicate notes on repeated ticks', (phase, bpm, cutoff, q) => {
    music.setPhase(phase); music.start();
    const filter = ctx.nodes.find(n => n.kind === 'filter')!;
    expect(filter.frequency.events.at(-1)?.value).toBe(cutoff); expect(filter.Q.value).toBe(q);
    const initial = ctx.sources.length; music.setPhase(phase); music.start();
    expect(ctx.sources).toHaveLength(initial); expect(vi.getTimerCount()).toBe(1);
    // Advancing to the next eight-step downbeat also checks non-arpeggio tempos.
    for (let i = 1; i <= 8; i++) { ctx.currentTime = i * 60 / bpm / 4; music.update(); }
    expect(ctx.sources.at(-1)!.starts[0]).toBeCloseTo(0.01 + 8 * 60 / bpm / 4);
  });
  it('clash opens the filter and drops bass, resolve plays a D/F/A pad', () => {
    music.setPhase('CLASH_REVEAL'); music.start();
    expect(ctx.sources[0].frequency.events.map(e => e.value)).toEqual([73.415, 30]);
    music.setPhase('ROUND_RESOLVE');
    expect(ctx.sources.slice(1).map(n => n.frequency.events[0].value)).toEqual([146.83, 174.61, 220]);
    expect(ctx.sources[0].disconnected).toBe(true);
  });
  it('uses currentTime rather than JS timer drift and rebases a long gap without a burst', () => {
    music.setPhase('COMMITMENT'); music.start(); const initial = ctx.sources.length;
    vi.advanceTimersByTime(10000); expect(ctx.sources).toHaveLength(initial);
    ctx.currentTime = 50; music.update();
    expect(ctx.sources.at(-1)!.starts[0]).toBeCloseTo(50.01);
    expect(ctx.sources.length - initial).toBeLessThanOrEqual(2);
  });
  it('setTempo changes scheduling and rejects invalid or unbounded tempos', () => {
    music.setPhase('SHAPING'); music.setTempo(120); music.start(); ctx.currentTime = 0.125; music.update();
    expect(ctx.sources.at(-1)!.starts[0]).toBeCloseTo(0.135);
    for (const bpm of [0, -1, NaN, Infinity, 1000]) expect(() => music.setTempo(bpm)).toThrow(RangeError);
  });
  it('caps music polyphony, clears every transient node/timer on stop and reuses its graph on restart', () => {
    const baseline = ctx.nodes.length;
    music.setPhase('SHAPING'); music.start();
    for (let i = 1; i < 100; i++) { ctx.currentTime = i * 0.13; music.update(); }
    expect(ctx.sources.filter(n => !n.disconnected).length).toBeLessThanOrEqual(16);
    music.stop(); music.stop(); expect(vi.getTimerCount()).toBe(0);
    expect(ctx.nodes.slice(baseline).every(n => n.disconnected)).toBe(true);
    const filters = ctx.nodes.filter(n => n.kind === 'filter').length;
    music.start(); expect(ctx.nodes.filter(n => n.kind === 'filter')).toHaveLength(filters);
  });
});
