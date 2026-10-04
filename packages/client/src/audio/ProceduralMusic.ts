// ============================================================================
// CYBERANTE: Generative Synthwave Procedural Music Sequencer
// ============================================================================

import { masterAudio } from './AudioEngine';
import { GamePhase } from '@cyberante/shared';

// D-minor pentatonic / Aeolian notes (Hz)
const D_MINOR_SCALE = [
  146.83, // D3
  164.81, // E3
  174.61, // F3
  196.00, // G3
  220.00, // A3
  233.08, // Bb3
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
];

export class ProceduralMusic {
  private isPlaying: boolean = false;
  private timerId: number | null = null;
  private currentStep: number = 0;
  private bpm: number = 110;
  private currentPhase: GamePhase = 'LOBBY_WAIT';

  public start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.scheduleNextNote();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public setPhase(phase: GamePhase): void {
    this.currentPhase = phase;
    switch (phase) {
      case 'DEAL':
        this.bpm = 85;
        break;
      case 'SHAPING':
        this.bpm = 115;
        break;
      case 'COMMITMENT':
        this.bpm = 135;
        break;
      case 'CLASH_REVEAL':
        this.bpm = 90;
        break;
      default:
        this.bpm = 100;
        break;
    }
  }

  private scheduleNextNote(): void {
    if (!this.isPlaying) return;

    this.playStep(this.currentStep);
    this.currentStep = (this.currentStep + 1) % 16;

    // Sixteenth-note interval (ms)
    const intervalMs = (60000 / this.bpm) / 4;
    this.timerId = window.setTimeout(() => {
      this.scheduleNextNote();
    }, intervalMs);
  }

  private playStep(step: number): void {
    const ctx = masterAudio.context;
    const dest = masterAudio.destinationNode;
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // Bassline on downbeats (0, 4, 8, 12)
    if (step % 4 === 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      const bassFilter = ctx.createBiquadFilter();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(D_MINOR_SCALE[0] * 0.5, t); // D2

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(this.currentPhase === 'COMMITMENT' ? 600 : 350, t);
      bassFilter.Q.setValueAtTime(4, t);

      bassGain.gain.setValueAtTime(0.3, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(dest);

      bassOsc.start(t);
      bassOsc.stop(t + 0.25);
    }

    // Arpeggiated melody steps in Shaping and Commitment phases
    if (this.currentPhase === 'SHAPING' || this.currentPhase === 'COMMITMENT') {
      const noteIdx = (step * 3) % D_MINOR_SCALE.length;
      const freq = D_MINOR_SCALE[noteIdx];

      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();

      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(freq, t);

      leadGain.gain.setValueAtTime(0.08, t);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      leadOsc.connect(leadGain);
      leadGain.connect(dest);

      leadOsc.start(t);
      leadOsc.stop(t + 0.12);
    }
  }
}

export const musicPlayer = new ProceduralMusic();
