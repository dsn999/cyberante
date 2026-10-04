import type { ClientMessage } from '@cyberante/shared';

function text(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function ids(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length && value.every(id => text(id));
}

/** Validate at the trust boundary, before treating JSON as a command. */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const msg = value as Record<string, unknown>;
  switch (msg.type) {
    case 'CMD_CREATE_ROOM': return text(msg.playerName, 32);
    case 'CMD_JOIN_ROOM':
      return text(msg.playerName, 32) && typeof msg.roomCode === 'string' &&
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/i.test(msg.roomCode.trim());
    case 'CMD_RECONNECT':
      return typeof msg.roomCode === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/i.test(msg.roomCode.trim()) &&
        (msg.playerId === 'player_1' || msg.playerId === 'player_2') &&
        typeof msg.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(msg.sessionToken);
    case 'CMD_NUDGE_RANK': return text(msg.cardId) && (msg.direction === 'UP' || msg.direction === 'DOWN');
    case 'CMD_BLEED_SUIT':
      return text(msg.cardId) && ['SPADES', 'CLUBS', 'DIAMONDS', 'HEARTS'].includes(msg.targetSuit as string);
    case 'CMD_BURN_CAST': return text(msg.cardId);
    case 'CMD_COMMIT_HAND':
      return ids(msg.assaultCardIds, 3) && ids(msg.aegisCardIds, 2) &&
        ['BRACE', 'OVERCHARGE', 'PARRY'].includes(msg.stance as string);
    case 'CMD_READY':
    case 'CMD_REMATCH':
    case 'CMD_LEAVE_ROOM': return true;
    default: return false;
  }
}
