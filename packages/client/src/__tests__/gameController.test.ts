import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCombatRound, type CombatantInput, type ServerMessage } from '@cyberante/shared';

const probe = vi.hoisted(() => ({
  receive: undefined as ((message: ServerMessage) => void) | undefined,
  scene: {
    setCardViewport: vi.fn(), setTitleMode: vi.fn(), setCards: vi.fn(),
    triggerClashExplosion: vi.fn(), triggerVictoryConfetti: vi.fn(),
  },
  board: { show: vi.fn(), setConnected: vi.fn(), setRoom: vi.fn(), showBanner: vi.fn(), showResolution: vi.fn() },
  victory: vi.fn(), defeat: vi.fn(), laser: vi.fn(), impact: vi.fn(),
}));
vi.mock('../render/VectorScene', () => ({ VectorScene: vi.fn(function () { return probe.scene; }) }));
vi.mock('../ui/MainMenuOverlay', () => ({ MainMenuOverlay: vi.fn(function () { return { hide: vi.fn() }; }) }));
vi.mock('../ui/GameBoardOverlay', () => ({ GameBoardOverlay: vi.fn(function () { return probe.board; }) }));
vi.mock('../ui/RulesModal', () => ({ RulesModal: vi.fn() }));
vi.mock('../tutorial/TutorialManager', () => ({ TutorialManager: vi.fn() }));
vi.mock('../net/NetworkClient', () => ({ NetworkClient: vi.fn(function () { return {
  hasSession: true, on: vi.fn(), connect: vi.fn(() => Promise.resolve()),
  onMessage: (handler: (message: ServerMessage) => void) => { probe.receive = handler; },
}; }) }));
vi.mock('../audio/AudioEngine', () => ({ masterAudio: {
  music: { setPhase: vi.fn() },
  sfx: { playVictory: probe.victory, playDefeat: probe.defeat, playClashLaser: probe.laser, playDamageImpact: probe.impact },
} }));
beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers();
  const root = { addEventListener: vi.fn() };
  vi.stubGlobal('document', { getElementById: () => root, body: root });
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  const { CyberanteGame } = await import('../main.js');
  new CyberanteGame();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function identify(playerId: string): void {
  probe.receive!({ type: 'STATE_INIT', playerId, matchId: 'match', roomCode: 'TEST', opponentName: 'Other' });
}
function combatant(playerId: string, stance: CombatantInput['stance']): CombatantInput {
  return {
    playerId, stance, currentGuardHp: 20, activeBarrier: 0,
    assaultCards: [{ id: `${playerId}-a`, rank: 8, suit: 'SPADES' }, { id: `${playerId}-b`, rank: 8, suit: 'HEARTS' }, { id: `${playerId}-c`, rank: 3, suit: 'CLUBS' }],
    aegisCards: [{ id: `${playerId}-d`, rank: 2, suit: 'SPADES' }, { id: `${playerId}-e`, rank: 7, suit: 'HEARTS' }],
  };
}
const outcome = () => resolveCombatRound(combatant('left', 'BRACE'), combatant('right', 'OVERCHARGE'));

describe('controller clash perspective and round celebrations', () => {
  it.each(['left', 'right'])('orders cards, stances and incoming damage for local seat %s', self => {
    identify(self); const resolution = outcome(); probe.receive!({ type: 'ROUND_OUTCOME', resolution });
    const left = self === 'left';
    expect(probe.scene.setCards).toHaveBeenCalledWith(left ? [...resolution.p1Assault, ...resolution.p1Aegis] : [...resolution.p2Assault, ...resolution.p2Aegis], left ? [...resolution.p2Assault, ...resolution.p2Aegis] : [...resolution.p1Assault, ...resolution.p1Aegis]);
    expect(probe.scene.triggerClashExplosion).toHaveBeenCalledWith(left ? 'BRACE' : 'OVERCHARGE', left ? 'OVERCHARGE' : 'BRACE', 1.3, left ? 8 : 5);
    expect(probe.scene.triggerVictoryConfetti).not.toHaveBeenCalled();
  });
  it.each(['left', 'right'])('celebrates a local round win once for seat %s', self => {
    identify(self); const resolution = { ...outcome(), isRoundOver: true, roundWinnerId: self };
    probe.receive!({ type: 'ROUND_OUTCOME', resolution }); probe.receive!({ type: 'ROUND_OUTCOME', resolution });
    expect(probe.scene.triggerVictoryConfetti).toHaveBeenCalledTimes(1);
    expect(probe.scene.triggerClashExplosion).toHaveBeenCalledTimes(1);
    expect(probe.victory).not.toHaveBeenCalled(); // Match fanfare stays reserved for a match win.
  });
  it('does not celebrate an opponent round win or a tied exchange', () => {
    identify('left'); probe.receive!({ type: 'ROUND_OUTCOME', resolution: { ...outcome(), isRoundOver: true, roundWinnerId: 'right' } });
    probe.receive!({ type: 'ROUND_OUTCOME', resolution: { ...outcome(), exchangeNumber: 2 } });
    expect(probe.scene.triggerVictoryConfetti).not.toHaveBeenCalled();
  });
  it('celebrates the final match once without a second round burst or fanfare', () => {
    identify('left'); const resolution = { ...outcome(), isRoundOver: true, roundWinnerId: 'left', matchWinnerId: 'left' };
    probe.receive!({ type: 'ROUND_OUTCOME', resolution }); probe.receive!({ type: 'ROUND_OUTCOME', resolution });
    expect(probe.scene.triggerVictoryConfetti).toHaveBeenCalledTimes(1); expect(probe.victory).toHaveBeenCalledTimes(1);
  });
});
