import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateAssaultHand, resolveCombatRound, GAME_CONSTANTS } from '@cyberante/shared';
import { TutorialSession } from '../tutorial/TutorialSession';

let session: TutorialSession;
beforeEach(() => { session = new TutorialSession(); });
function split(): { assaultIds: string[]; aegisIds: string[]; stance: 'OVERCHARGE' } {
  const state = session.snapshot;
  return { assaultIds: state.assaultIds.length ? state.assaultIds : state.cards.slice(0, 3).map(card => card.id), aegisIds: state.aegisIds.length ? state.aegisIds : state.cards.slice(3).map(card => card.id), stance: 'OVERCHARGE' };
}
function toFlux(): void { expect(session.act('COMMIT_HAND', split())).toBe(true); expect(session.next()).toBe(true); }
function toBurn(): void { toFlux(); expect(session.act('NUDGE_RANK', { cardId: 'flux-4', direction: 'DOWN' })).toBe(true); session.next(); }
function toClash(): void { toBurn(); expect(session.act('BURN_CARD', { cardId: 'burn-k' })).toBe(true); session.next(); }

describe('Spec-09 deterministic training curriculum', () => {
  it('deals the exact partition lesson with no preselected cards', () => {
    expect(session.snapshot.cards.map(({ rank, suit }) => [rank, suit])).toEqual([[14, 'SPADES'], [13, 'SPADES'], [12, 'SPADES'], [10, 'DIAMONDS'], [4, 'DIAMONDS']]);
    expect(session.snapshot.assaultIds).toEqual([]); expect(session.snapshot.aegisIds).toEqual([]);
    expect(session.next()).toBe(false); expect(session.snapshot.stepIndex).toBe(0);
    expect(session.steps.map(step => step.id)).toEqual([1, 2, 3, 4]);
  });
  it.each([undefined, null, {}, { assaultIds: [], aegisIds: [] }, { assaultIds: ['split-a', 'split-k'], aegisIds: ['split-q', 'split-10', 'split-4'] }, { assaultIds: ['split-a', 'split-a', 'split-q'], aegisIds: ['split-10', 'split-4'] }, { assaultIds: ['foreign', 'split-k', 'split-q'], aegisIds: ['split-10', 'split-4'] }, { assaultIds: [1, 2, 3], aegisIds: [4, 5] }])('rejects malformed or incomplete splits: %j', input => {
    const before = session.snapshot; expect(session.act('COMMIT_HAND', input)).toBe(false); expect(session.next()).toBe(false); expect(session.snapshot).toEqual(before);
  });
  it('accepts any exact partition, then deals the specified Flux hand', () => {
    const ids = session.snapshot.cards.map(card => card.id);
    expect(session.act('COMMIT_HAND', { assaultIds: [ids[4], ids[2], ids[0]], aegisIds: [ids[1], ids[3]] })).toBe(true);
    expect(session.canAdvance).toBe(true); session.next();
    expect(session.snapshot.cards.map(({ rank, suit }) => [rank, suit])).toEqual([[14, 'SPADES'], [2, 'SPADES'], [4, 'SPADES'], [8, 'CLUBS'], [8, 'DIAMONDS']]);
  });
  it.each([['NUDGE_RANK', { cardId: 'flux-4', direction: 'UP' }], ['NUDGE_RANK', { cardId: 'flux-a', direction: 'DOWN' }], ['BLEED_SUIT', { cardId: 'flux-4', targetSuit: 'CLUBS' }], ['BURN_CARD', { cardId: 'flux-4' }], ['COMMIT_HAND', undefined]])('keeps Flux lesson available after wrong action %s', (type, payload) => {
    toFlux(); const before = session.snapshot; expect(session.act(type, payload)).toBe(false); expect(session.snapshot).toEqual(before); expect(session.next()).toBe(false);
  });
  it('nudges with shared math, debits exactly one Flux and allows inspection of A–2–3', () => {
    toFlux(); session.act('NUDGE_RANK', { cardId: 'flux-4', direction: 'DOWN' });
    const state = session.snapshot; expect(state.stepIndex).toBe(1); expect(state.flux).toBe(GAME_CONSTANTS.STARTING_FLUX - GAME_CONSTANTS.FLUX_COST_NUDGE);
    expect(evaluateAssaultHand(state.cards.slice(0, 3) as [typeof state.cards[0], typeof state.cards[0], typeof state.cards[0]]).tier).toBe('STRAIGHT_FLUSH');
    expect(session.act('NUDGE_RANK', { cardId: 'flux-4', direction: 'DOWN' })).toBe(false); expect(session.snapshot).toEqual(state);
    expect(session.next()).toBe(true); expect(session.next()).toBe(false);
  });
  it('deals exact burn hand; wrong burns leave the targeted Diamond available', () => {
    toBurn(); expect(session.snapshot.cards.map(({ rank, suit }) => [rank, suit])).toEqual([[13, 'DIAMONDS'], [7, 'SPADES'], [8, 'SPADES'], [9, 'CLUBS'], [10, 'HEARTS']]);
    const before = session.snapshot; expect(session.act('BURN_CARD', { cardId: 'burn-7' })).toBe(false); expect(session.snapshot).toEqual(before);
  });
  it('casts the real Diamond effect, draws one deterministic replacement and carries it to stance', () => {
    toBurn(); session.act('BURN_CARD', { cardId: 'burn-k' });
    const state = session.snapshot; expect(state.cards).toHaveLength(5); expect(new Set(state.cards.map(card => card.id)).size).toBe(5);
    expect(state.cards.some(card => card.id === 'burn-k')).toBe(false); expect(state.cards[0]).toEqual({ id: 'replacement-9', rank: 9, suit: 'SPADES' });
    expect(state.barrier).toBe(10); expect(state.burn).toBe('DIAMOND_BARRIER'); expect(state.flux).toBe(3);
    expect(session.act('BURN_CARD', { cardId: 'burn-7' })).toBe(false); expect(session.snapshot).toEqual(state);
    session.next(); expect(session.snapshot).toEqual({ ...state, stepIndex: 3 });
  });
  it('requires an explicit Overcharge selection and valid commitment', () => {
    toClash(); expect(session.act('COMMIT_HAND', split())).toBe(false);
    for (const stance of ['BRACE', 'PARRY']) { session.act('SELECT_STANCE', { stance }); expect(session.act('COMMIT_HAND', { ...split(), stance })).toBe(false); }
    session.act('SELECT_STANCE', { stance: 'OVERCHARGE' });
    expect(session.act('COMMIT_HAND', { ...split(), aegisIds: [] })).toBe(false); expect(session.next()).toBe(false);
    expect(session.act('COMMIT_HAND', split())).toBe(true); expect(session.next()).toBe(true); expect(session.snapshot.complete).toBe(true);
  });
  it('resolves the training drone clash identically to real combat, including reflected damage', () => {
    toClash(); session.act('SELECT_STANCE', { stance: 'OVERCHARGE' }); session.act('COMMIT_HAND', split()); session.next();
    const outcome = session.snapshot.resolution!;
    expect(outcome).toEqual(resolveCombatRound({ playerId: 'training-player', assaultCards: outcome.p1Assault, aegisCards: outcome.p1Aegis, stance: 'OVERCHARGE', currentGuardHp: 20, activeBarrier: 10, burnType: 'DIAMOND_BARRIER' }, { playerId: 'training-drone', assaultCards: outcome.p2Assault, aegisCards: outcome.p2Aegis, stance: 'PARRY', currentGuardHp: 20, activeBarrier: 0 }));
    expect(outcome.p1RawDamage).toBe(36); expect(outcome.p1ReflectedDamage).toBe(18); expect(outcome.p1HpRemaining).toBe(2); expect(outcome.p2HpRemaining).toBe(0);
    expect(session.next()).toBe(false); expect(session.prev()).toBe(false); expect(session.act('COMMIT_HAND', split())).toBe(false);
  });
  it('previous replays each lesson without preserving spent Flux or burn state', () => {
    toClash(); expect(session.prev()).toBe(true); expect(session.snapshot.stepIndex).toBe(2); expect(session.snapshot.barrier).toBe(0); expect(session.snapshot.burn).toBeNull();
    expect(session.snapshot.cards[0].id).toBe('burn-k'); expect(session.next()).toBe(false);
    session.prev(); expect(session.snapshot.cards[2].rank).toBe(4); expect(session.snapshot.flux).toBe(3);
    session.prev(); expect(session.snapshot.assaultIds).toEqual([]); expect(session.prev()).toBe(false);
  });
  it('restart clears completion and exported snapshots cannot mutate training', () => {
    toClash(); session.act('SELECT_STANCE', { stance: 'OVERCHARGE' }); session.act('COMMIT_HAND', split()); session.next();
    const snapshot = session.snapshot; snapshot.cards[0].rank = 2; snapshot.assaultIds.length = 0; snapshot.resolution!.p1HpRemaining = 0;
    expect(session.snapshot.resolution!.p1HpRemaining).toBe(2); expect(session.snapshot.cards[0].rank).toBe(9);
    session.start(); expect(session.snapshot.stepIndex).toBe(0); expect(session.snapshot.complete).toBe(false); expect(session.snapshot.resolution).toBeNull(); expect(session.feedback).toBe('');
  });
  it('training does not need randomness, timers, sockets or browser globals', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('unseeded random'); });
    toClash(); session.act('SELECT_STANCE', { stance: 'OVERCHARGE' }); expect(session.act('COMMIT_HAND', split())).toBe(true);
    expect(random).not.toHaveBeenCalled(); random.mockRestore();
  });
});
