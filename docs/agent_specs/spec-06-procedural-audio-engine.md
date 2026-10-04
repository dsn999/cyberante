# SPEC-06: Procedural Web Audio Engine

## 1. Goal & Non-Goals
- **Goal:** Implement a 100% code-driven Web Audio API procedural synthesis engine for generative synthwave music (arpeggios, basslines, tempo pacing) and dynamic tactical SFX (clicks, nudges, suit bleeds, burns, laser clash impacts) without external audio files.
- **Non-Goals:** Do not load `.mp3`, `.wav`, or `.ogg` audio files over the network (zero audio asset footprint).

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/client/src/audio/AudioEngine.ts`
  - `packages/client/src/audio/ProceduralMusic.ts`
  - `packages/client/src/audio/SoundEffects.ts`
- **Dependencies:**
  - Standard Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AnalyserNode`).
  - `@cyberante/shared` contracts (`GamePhase`, `Stance`).
  - Zero third-party audio packages.

## 3. Public API & Contract Signatures

### 3.1 AudioEngine Class
```typescript
import { ProceduralMusic } from './ProceduralMusic.js';
import { SoundEffects } from './SoundEffects.js';

export class AudioEngine {
  public music: ProceduralMusic;
  public sfx: SoundEffects;

  constructor();

  public init(): void;
  public resume(): Promise<void>;
  public toggleMute(): boolean;
  public get isMuted(): boolean;
  public get context(): AudioContext | null;

  public getEnergyLevels(): { bass: number; mid: number; high: number };
}
```

### 3.2 ProceduralMusic Class
```typescript
import { GamePhase } from '@cyberante/shared';

export class ProceduralMusic {
  constructor(ctx: AudioContext, masterGain: GainNode);

  public start(): void;
  public stop(): void;
  public setPhase(phase: GamePhase): void;
  public setTempo(bpm: number): void;
  public update(): void;
}
```

### 3.3 SoundEffects Class
```typescript
import { Stance } from '@cyberante/shared';

export class SoundEffects {
  constructor(ctx: AudioContext, masterGain: GainNode);

  public playClick(): void;
  public playCardSelect(): void;
  public playPipNudge(direction: 'UP' | 'DOWN'): void;
  public playSuitBleed(): void;
  public playBurn(): void;
  public playStanceSelect(stance: Stance): void;
  public playClashLaser(): void;
  public playDamageImpact(isLethal?: boolean): void;
  public playVictory(): void;
  public playDefeat(): void;
}
```

## 4. Detailed Behavior & Synthesis Pipeline

### 4.1 Master Audio Graph
```
[Oscillators / Noise Nodes]
            │
      [BiquadFilter]
            │
       [Node Gain]
            │
            ▼
    [SFX / Music Gain]
            │
            ▼
       [Master Gain] ──────► [AnalyserNode (FFT)] ──► [Destination]
```

### 4.2 Autoplay Policy & Gesture Activation
- Browser audio policies suspend `AudioContext` until the first user click or touch.
- `AudioEngine` is created in an idle state; `resume()` is triggered on the first user interaction in `main.ts` or overlay click.
- Audio synthesis silently no-ops if Web Audio is unsupported in the client browser.

### 4.3 Generative Synthwave Music (D-Minor Pentatonic)
- **Scale Frequencies:**
  - $D_3 = 146.83\text{Hz}$, $F_3 = 174.61\text{Hz}$, $G_3 = 196.00\text{Hz}$, $A_3 = 220.00\text{Hz}$
  - $C_4 = 261.63\text{Hz}$, $D_4 = 293.66\text{Hz}$, $F_4 = 349.23\text{Hz}$, $A_4 = 440.00\text{Hz}$
- **8-Step Arpeggiator:** Uses lookahead scheduling with short exponential decay envelopes.
- **Phase Pacing & Dynamic Filter Sweeps:**
  - `LOBBY_WAIT` / `DEAL`: Slow atmospheric drone (85 BPM, low-pass filter cutoff 400 Hz).
  - `SHAPING`: Driving bassline arpeggio (115 BPM, filter cutoff 900 Hz with $Q = 3.5$).
  - `COMMITMENT`: Tense clockwork pulse (135 BPM, filter cutoff opening to 1800 Hz).
  - `CLASH_REVEAL`: Full filter sweep open + clash bass drop (90 BPM).
  - `ROUND_RESOLVE`: Harmonic pad chord (100 BPM).

### 4.4 Interactive Sound Effects Palette
1. **`playClick`:** Short sinusoidal click (800 Hz $\to$ 200 Hz sweep over 0.04s, gain decay).
2. **`playPipNudge`:**
   - `UP`: Rising chirp (440 Hz $\to$ 660 Hz over 0.08s).
   - `DOWN`: Falling chirp (440 Hz $\to$ 330 Hz over 0.08s).
3. **`playSuitBleed`:** Dual-triangle detuned shimmer (440 Hz & 444 Hz) with resonant bandpass sweep over 0.15s.
4. **`playBurn`:** Filtered white-noise burst with rapid exponential decay mimicking plasma incineration.
5. **`playStanceSelect`:**
   - `BRACE`: Low square-wave thud (120 Hz with fast attack).
   - `OVERCHARGE`: Aggressive rising sawtooth surge (220 Hz $\to$ 880 Hz over 0.2s).
   - `PARRY`: High-frequency metallic chime (1400 Hz sine wave + ring modulation).
6. **`playClashLaser`:** Dual-oscillator FM pitch drop (880 Hz modulated by 110 Hz square wave, 0.35s decay).
7. **`playDamageImpact`:** Sub-bass rumble (65 Hz $\to$ 30 Hz sine wave with distortion boost).

### 4.5 Audio-Reactive FFT Visual Coupling
- `AnalyserNode` with `fftSize: 256` connected to master bus.
- `getEnergyLevels()` samples the 128 frequency bins into three normalized buckets $[0.0, 1.0]$:
  - **`bass`:** Bins $1 \dots 10$ ($0 \dots 400\text{Hz}$) $\to$ drives vector grid shockwave expansion.
  - **`mid`:** Bins $11 \dots 40$ ($400 \dots 1600\text{Hz}$) $\to$ drives CRT scanline pulse.
  - **`high`:** Bins $41 \dots 100$ ($1600 \dots 4000\text{Hz}$) $\to$ drives particle spark jitter.

## 5. Invariants & Edge Cases
1. **Zero External Assets:** Zero audio bytes downloaded; 100% synthesized in Web Audio nodes.
2. **Error Resilience:** Calling SFX or music methods when audio is muted or context is suspended must never throw uncaught exceptions.
3. **Master Volume Clamping:** Master gain node clamped to $0.3$ maximum to protect player hearing and prevent clipping distortion.
4. **Polyphony Capping:** SFX oscillators must automatically disconnect upon completion to prevent node leaks in memory.

## 6. Forbidden Boundaries & Anti-Patterns
- Strictly FORBIDDEN from importing `.wav`, `.mp3`, `.ogg`, or other audio files.
- Do NOT create a new `AudioContext` on every note or sound effect; reuse the single master context.
- Do NOT block the main JavaScript thread with synchronous loops for audio scheduling; use `AudioParam.setValueAtTime` and `exponentialRampToValueAtTime`.

## 7. Test Specifications
- Verify TypeScript compilation and export signatures in `packages/client`.
- Confirm client production bundle contains 0 audio asset files and builds without diagnostics.

## 8. Exact Verification Command
```bash
npm --workspace=packages/client run build
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Procedural Web Audio Engine (Spec-06)
Implement/refactor the procedural Web Audio synthesis engine according to `docs/agent_specs/spec-06-procedural-audio-engine.md`.

Target files:
- `packages/client/src/audio/AudioEngine.ts`
- `packages/client/src/audio/ProceduralMusic.ts`
- `packages/client/src/audio/SoundEffects.ts`

Requirements:
1. Synthesize all music and SFX via Web Audio API nodes (no audio files).
2. Implement D-minor pentatonic arpeggiator with phase-adaptive tempo and filter cutoff.
3. Implement SFX palette for click, pip nudge, suit bleed, burn, stances, clash laser, and impact.
4. Export normalized FFT energy levels (bass, mid, high) via AnalyserNode for WebGL visual coupling.
5. Verify client build passes cleanly: `npm --workspace=packages/client run build`.
```

## 10. Definition of Done Checklist
- [x] Master audio graph with `AudioContext`, `GainNode`, and `AnalyserNode`.
- [x] Generative synthwave music arpeggiator adapting to game phases.
- [x] Complete interactive SFX suite for all gameplay actions.
- [x] Audio-reactive FFT buckets exposed for vector renderer.
- [x] Zero external audio assets required; builds cleanly under Vite.

### Verification evidence (2026-10-04)

- Exact client build command and the repository build/test/sim gates pass.
- 33 audio unit tests cover graph/API activation, phase scheduling, FFT bins,
  every SFX palette entry, muted/suspended/unsupported behavior and voice cleanup.
- Native Chromium acceptance verifies FFT activity, single-context reuse,
  mute and mode cleanup, unsupported-audio play and authoritative result cues.
- Production output contains no external media files. Detailed dispatch evidence
  and remaining integration acceptance are recorded in
  [the implementation strategy](../implementation_strategy.md#spec-06-implementation-evidence-2026-10-04).
