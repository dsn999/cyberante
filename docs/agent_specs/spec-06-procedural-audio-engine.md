# SPEC-06: Procedural Web Audio Engine

## 1. Context & Objective
Implement a fully procedural Web Audio synthesis engine generating dynamic synthwave background music and reactive sound effects without loading external audio files.

## 2. Target Files
- `packages/client/src/audio/AudioEngine.ts`
- `packages/client/src/audio/ProceduralMusic.ts`
- `packages/client/src/audio/SoundEffects.ts`

## 3. Invariants & Rules
1. **Zero External Audio Assets:** No `.mp3`, `.ogg`, or `.wav` imports.
2. **Generative Arpeggiator:** Dual polyphonic oscillators (Sawtooth/Square), resonant low-pass filter, phase-reactive BPM ($75\text{--}120\text{ BPM}$).
3. **Sound Effects Palette:**
   - UI Click / Hover chirps.
   - Up/Down pitch bends for Pip Nudges.
   - Filtered noise pops for Burn discards.
   - Sub-bass drop for Stance lock-in.
   - Frequency-modulated (FM) laser zap for Clash damage.
4. **Visual Coupling:** Expose `AnalyserNode` frequency spectrum buckets (Bass, Mid, High) for real-time WebGL shader reactivity.

## 4. Verification Command
Headless Web Audio graph initialization test.
