// ============================================================================
// CYBERANTE: Main Menu Overlay
// ============================================================================

import { masterAudio } from '../audio/AudioEngine';
import type { BotPersonality } from '@cyberante/shared';
import { sfx } from '../audio/SoundEffects';

export interface MainMenuCallbacks {
  onStartSolo: (profile: BotPersonality) => void;
  onCreateMultiplayer: (playerName: string) => void;
  onJoinMultiplayer: (roomCode: string, playerName: string) => void;
  onToggleRules: () => void;
  onStartTutorial: () => void;
}

export class MainMenuOverlay {
  private container: HTMLElement;
  private callbacks: MainMenuCallbacks;

  constructor(parent: HTMLElement, callbacks: MainMenuCallbacks) {
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
        <label>Solo opponent
          <select id="bot-profile" aria-label="Solo opponent">
            <option value="CIPHER_ZERO">Cipher Zero</option>
            <option value="VEKTOR_AGGRO">Vektor Aggro</option>
            <option value="AEGIS_WALL">Aegis Wall</option>
          </select>
        </label>
        <label>Player name <input id="player-name-input" aria-label="Player name" maxlength="16" value="Operative" /></label>
        <p id="menu-error" role="alert"></p>
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
        <button id="btn-menu-rules">RULES</button>
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

    roomInput.value = new URLSearchParams(window.location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) ?? '';
    roomInput.addEventListener('input', () => roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
    this.container.querySelector('#btn-menu-rules')?.addEventListener('click', () => this.callbacks.onToggleRules());

    const startAudio = () => {
      masterAudio.init();
      masterAudio.resume();
    };

    soloBtn?.addEventListener('click', () => {
      startAudio();
      sfx.playClick();
      this.hide();
      const profile = (this.container.querySelector('#bot-profile') as HTMLSelectElement).value as BotPersonality;
      this.callbacks.onStartSolo(profile);
    });

    multiBtn?.addEventListener('click', () => {
      startAudio();
      sfx.playClick();
      const code = roomInput?.value.trim().toUpperCase() || '';
      this.hide();
      const playerName = (this.container.querySelector('#player-name-input') as HTMLInputElement).value.trim().slice(0, 16);
      if (!playerName) { this.show(); this.showError('Enter a player name.'); return; }
      if (code) this.callbacks.onJoinMultiplayer(code, playerName);
      else this.callbacks.onCreateMultiplayer(playerName);
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
    const error = this.container.querySelector('#menu-error');
    if (error) error.textContent = '';
  }

  public showError(message: string): void {
    let error = this.container.querySelector('#menu-error');
    if (!error) {
      error = document.createElement('p');
      error.id = 'menu-error';
      error.setAttribute('role', 'alert');
      this.container.appendChild(error);
    }
    error.textContent = message;
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
