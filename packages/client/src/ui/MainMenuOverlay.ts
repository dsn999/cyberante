import { masterAudio } from '../audio/AudioEngine';
import type { BotPersonality } from '@cyberante/shared';
import { sfx } from '../audio/SoundEffects';

export interface MainMenuCallbacks {
  onStartSolo: (profile: BotPersonality) => void;
  onCreateMultiplayer: (playerName: string) => void;
  onJoinMultiplayer: (roomCode: string, playerName: string) => void;
  onStartTutorial: () => void;
  onToggleRules: () => void;
}

export class MainMenuOverlay {
  private readonly container: HTMLElement;
  constructor(parent: HTMLElement, private readonly callbacks: MainMenuCallbacks) {
    this.container = document.createElement('section');
    this.container.id = 'main-menu-overlay'; this.container.className = 'screen';
    this.container.setAttribute('aria-label', 'Main menu');
    this.container.innerHTML = `<div class="menu-content">
      <header><h1 class="menu-title display-glow">CYBERANTE</h1><p class="menu-subtitle">Five cards. Two lanes. One blind clash.<br>Win two rounds to take the match.</p></header>
      <section class="menu-section panel" aria-labelledby="solo-heading"><h2 id="solo-heading">SOLO OPERATIONS</h2>
        <label for="bot-profile">Solo opponent</label><select id="bot-profile"><option value="CIPHER_ZERO">Cipher Zero · Balanced</option><option value="VEKTOR_AGGRO">Vektor Aggro · Aggressive</option><option value="AEGIS_WALL">Aegis Wall · Defensive</option></select>
        <button id="btn-solo" class="primary">PLAY SOLO</button>
      </section>
      <form class="menu-section panel" id="multiplayer-form" novalidate aria-labelledby="online-heading"><h2 id="online-heading">ONLINE OPERATIONS</h2>
        <label for="player-name-input">Player name · 1–16 characters</label><input id="player-name-input" name="playerName" maxlength="16" value="Operative" autocomplete="nickname" required>
        <label for="input-room">Room code · 4 letters or digits</label><input id="input-room" name="roomCode" maxlength="4" placeholder="ABCD" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-describedby="menu-error">
        <div class="button-row"><button id="btn-host" type="button">HOST ROOM</button><button id="btn-multiplayer" type="submit" class="primary">JOIN ROOM</button></div>
        <p id="menu-error" role="alert"></p>
      </form>
      <div class="button-row"><button id="btn-tutorial">TUTORIAL</button><button id="btn-menu-rules">RULES</button><button id="btn-mute" aria-pressed="false">AUDIO: ON</button></div>
    </div>`;
    parent.appendChild(this.container);
    const room = this.element<HTMLInputElement>('input-room');
    const sanitizeRoom = () => {
      room.value = room.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    };
    room.value = new URLSearchParams(window.location.search).get('room') ?? ''; sanitizeRoom();
    room.addEventListener('input', sanitizeRoom);
    this.element('multiplayer-form').addEventListener('submit', event => { event.preventDefault(); this.multiplayer(false); });
    this.element('btn-host').addEventListener('click', () => this.multiplayer(true));
    this.element('btn-solo').addEventListener('click', () => {
      const profile = this.element<HTMLSelectElement>('bot-profile').value;
      if (profile !== 'CIPHER_ZERO' && profile !== 'VEKTOR_AGGRO' && profile !== 'AEGIS_WALL') return;
      this.unlock(); this.hide(); this.callbacks.onStartSolo(profile);
    });
    this.element('btn-tutorial').addEventListener('click', () => { this.unlock(); this.hide(); this.callbacks.onStartTutorial(); });
    this.element('btn-menu-rules').addEventListener('click', () => this.callbacks.onToggleRules());
    this.element('btn-mute').addEventListener('click', () => { masterAudio.toggleMute(); this.syncMute(); });
    this.syncMute();
  }
  private element<T extends HTMLElement = HTMLElement>(id: string): T { return this.container.querySelector<T>(`#${id}`)!; }
  private unlock(): void { masterAudio.init(); masterAudio.resume(); sfx.playClick(); }
  private multiplayer(host: boolean): void {
    const nameInput = this.element<HTMLInputElement>('player-name-input');
    const name = nameInput.value.trim().slice(0, 16); nameInput.value = name;
    const code = this.element<HTMLInputElement>('input-room').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (!name) { this.showError('Enter a player name.'); nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); return; }
    nameInput.removeAttribute('aria-invalid');
    if (!host && code.length !== 4) { this.showError('Room codes contain four letters or digits.'); this.element('input-room').focus(); return; }
    this.unlock(); this.hide();
    if (host) this.callbacks.onCreateMultiplayer(name); else this.callbacks.onJoinMultiplayer(code, name);
  }
  private syncMute(): void {
    this.element('btn-mute').textContent = masterAudio.isMuted ? 'AUDIO: MUTED' : 'AUDIO: ON';
    this.element('btn-mute').setAttribute('aria-pressed', String(masterAudio.isMuted));
  }
  public show(): void { this.container.hidden = false; this.element('menu-error').textContent = ''; this.syncMute(); }
  public hide(): void { this.container.hidden = true; }
  public showError(message: string): void { this.element('menu-error').textContent = message; }
}
