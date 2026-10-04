// ============================================================================
// CYBERANTE: Main Menu Overlay
// ============================================================================

import { masterAudio } from '../audio/AudioEngine';
import { musicPlayer } from '../audio/ProceduralMusic';
import { sfx } from '../audio/SoundEffects';

export interface MenuCallbacks {
  onPlaySolo: () => void;
  onPlayMultiplayer: (roomCode: string) => void;
  onStartTutorial: () => void;
}

export class MainMenuOverlay {
  private container: HTMLElement;
  private callbacks: MenuCallbacks;

  constructor(parent: HTMLElement, callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'main-menu-overlay';
    this.container.className = 'interactive';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: radial-gradient(circle, rgba(11,19,41,0.6) 0%, rgba(3,7,18,0.92) 80%);
      z-index: 20;
    `;

    this.container.innerHTML = `
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(36px, 8vw, 64px);
          font-weight: 900;
          letter-spacing: 6px;
          color: #00f3ff;
          text-shadow: 0 0 20px rgba(0,243,255,0.7), 0 0 40px rgba(0,243,255,0.3);
          margin-bottom: 8px;
        ">CYBERANTE</h1>
        <p style="
          font-family: 'Share Tech Mono', monospace;
          font-size: 15px;
          color: #ff0055;
          letter-spacing: 3px;
          text-transform: uppercase;
        ">[ PROCEDURAL VECTOR POKER-COMBAT MATRIX ]</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px; width: 90%; max-width: 380px;">
        <button id="btn-solo" class="menu-btn" style="
          background: rgba(0, 243, 255, 0.12);
          border: 1px solid #00f3ff;
          color: #00f3ff;
          padding: 14px;
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
          box-shadow: 0 0 15px rgba(0,243,255,0.2);
        ">1. PLAY SOLO (VS LOCAL AI)</button>

        <div style="display: flex; gap: 8px;">
          <input id="input-room" type="text" placeholder="ROOM CODE (OPTIONAL)" maxlength="4" style="
            flex: 1;
            background: rgba(17, 30, 59, 0.6);
            border: 1px solid #1f293d;
            padding: 12px;
            color: #ffb700;
            font-family: 'Share Tech Mono', monospace;
            font-size: 14px;
            text-align: center;
            letter-spacing: 2px;
            border-radius: 4px;
            outline: none;
          " />
          <button id="btn-multiplayer" class="menu-btn" style="
            background: rgba(255, 0, 85, 0.15);
            border: 1px solid #ff0055;
            color: #ff0055;
            padding: 12px 18px;
            font-family: 'Orbitron', sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
          ">JOIN / HOST</button>
        </div>

        <button id="btn-tutorial" class="menu-btn" style="
          background: rgba(255, 183, 0, 0.12);
          border: 1px solid #ffb700;
          color: #ffb700;
          padding: 14px;
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
        ">3. INTERACTIVE TUTORIAL</button>
      </div>

      <div style="margin-top: 36px; display: flex; gap: 20px;">
        <button id="btn-mute" style="
          background: transparent; border: 1px solid #4b5563; color: #9ca3af;
          padding: 6px 12px; font-family: 'Share Tech Mono', monospace; font-size: 12px;
          cursor: pointer; border-radius: 4px;
        ">AUDIO: ON</button>
      </div>
    `;

    parent.appendChild(this.container);
    this.bindEvents();
  }

  private bindEvents(): void {
    const soloBtn = this.container.querySelector('#btn-solo');
    const multiBtn = this.container.querySelector('#btn-multiplayer');
    const tutorialBtn = this.container.querySelector('#btn-tutorial');
    const muteBtn = this.container.querySelector('#btn-mute');
    const roomInput = this.container.querySelector('#input-room') as HTMLInputElement;

    const startAudio = () => {
      masterAudio.init();
      masterAudio.resume();
      musicPlayer.start();
    };

    soloBtn?.addEventListener('click', () => {
      startAudio();
      sfx.playClick();
      this.hide();
      this.callbacks.onPlaySolo();
    });

    multiBtn?.addEventListener('click', () => {
      startAudio();
      sfx.playClick();
      const code = roomInput?.value.trim().toUpperCase() || '';
      this.hide();
      this.callbacks.onPlayMultiplayer(code);
    });

    tutorialBtn?.addEventListener('click', () => {
      startAudio();
      sfx.playClick();
      this.hide();
      this.callbacks.onStartTutorial();
    });

    muteBtn?.addEventListener('click', () => {
      const isMuted = masterAudio.toggleMute();
      if (muteBtn) {
        muteBtn.textContent = isMuted ? 'AUDIO: MUTED' : 'AUDIO: ON';
      }
    });
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
