import { describe, expect, it } from 'vitest';
import { isClientMessage } from '../messageValidation.js';

const valid = [
  { type: 'CMD_CREATE_ROOM', playerName: 'A' },
  { type: 'CMD_JOIN_ROOM', roomCode: ' test ', playerName: 'B' },
  { type: 'CMD_RECONNECT', roomCode: 'TEST', playerId: 'player_1', sessionToken: 'a'.repeat(64) },
  { type: 'CMD_NUDGE_RANK', cardId: 'card', direction: 'UP' },
  { type: 'CMD_BLEED_SUIT', cardId: 'card', targetSuit: 'HEARTS' },
  { type: 'CMD_BURN_CAST', cardId: 'card' },
  { type: 'CMD_COMMIT_HAND', assaultCardIds: ['a', 'b', 'c'], aegisCardIds: ['d', 'e'], stance: 'BRACE' },
  { type: 'CMD_READY' }, { type: 'CMD_REMATCH' }, { type: 'CMD_LEAVE_ROOM' },
];
describe('Spec-04 runtime command schema', () => {
  it.each(valid)('accepts $type', msg => expect(isClientMessage(msg)).toBe(true));
  it('rejects non-object, unknown and malformed command fields', () => {
    const invalid: unknown[] = [null, undefined, [], 4, 'CMD_READY', {}, { type: 4 }, { type: 'UNKNOWN' }];
    for (const name of ['', '   ', 'A'.repeat(33), null, 42, [], {}]) invalid.push({ type: 'CMD_CREATE_ROOM', playerName: name });
    for (const code of ['', 'TOOLONG', 'AB01', 'ABIO', 123, null, {}]) invalid.push({ type: 'CMD_JOIN_ROOM', roomCode: code, playerName: 'A' });
    for (const msg of [
      { cardId: 4, direction: 'UP' }, { cardId: '', direction: 'UP' }, { cardId: 'a'.repeat(129), direction: 'UP' }, { cardId: 'a', direction: 'SIDEWAYS' },
    ]) invalid.push({ type: 'CMD_NUDGE_RANK', ...msg });
    for (const suit of [null, 0, [], {}, 'UNKNOWN']) invalid.push({ type: 'CMD_BLEED_SUIT', cardId: 'a', targetSuit: suit });
    for (const token of ['short', 'x'.repeat(64), 12, null]) invalid.push({ type: 'CMD_RECONNECT', roomCode: 'TEST', playerId: 'player_1', sessionToken: token });
    invalid.push({ type: 'CMD_RECONNECT', roomCode: 'TEST', playerId: 'other', sessionToken: 'a'.repeat(64) });
    for (const part of [null, 'abc', [1, 2, 3], ['a', 'b'], ['a', 'b', 'c', 'd'], ['a', '', 'c']]) {
      invalid.push({ type: 'CMD_COMMIT_HAND', assaultCardIds: part, aegisCardIds: ['d', 'e'], stance: 'BRACE' });
    }
    invalid.push({ type: 'CMD_COMMIT_HAND', assaultCardIds: ['a', 'b', 'c'], aegisCardIds: null, stance: 'BRACE' });
    invalid.push({ type: 'CMD_COMMIT_HAND', assaultCardIds: ['a', 'b', 'c'], aegisCardIds: ['d', 'e'], stance: 'UNKNOWN' });
    for (const msg of invalid) expect(isClientMessage(msg), JSON.stringify(msg)).toBe(false);
  });
});
