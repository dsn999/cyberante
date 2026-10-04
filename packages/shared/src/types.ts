// ============================================================================
// CYBERANTE: Core Types & Network Protocol Contracts
// ============================================================================

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; 
// 11 = Jack, 12 = Queen, 13 = King, 14 = Ace

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type Stance = 'BRACE' | 'OVERCHARGE' | 'PARRY';

export type HandTier3 =
  | 'STRAIGHT_FLUSH'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'PAIR'
  | 'HIGH_CARD';

export type HandTier2 =
  | 'PAIR'
  | 'SUITED'
  | 'HIGH_CARD';

export interface HandEvaluation3 {
  tier: HandTier3;
  baseDamage: number;
  score: number; // Lexicographical tie-breaker value
  description: string;
  cards: [Card, Card, Card];
}

export interface HandEvaluation2 {
  tier: HandTier2;
  mitigation: number;
  score: number; // Lexicographical tie-breaker value
  description: string;
  cards: [Card, Card];
}

export type BurnType = 'SPADE_VEIL' | 'DIAMOND_BARRIER' | 'HEART_SIPHON' | 'CLUB_SUNDER';

export interface BurnResult {
  burnType: BurnType;
  cardBurned: Card;
  replacementCard: Card;
  barrierAdded?: number;
}

export interface PlayerPublicState {
  playerId: string;
  name: string;
  guardHp: number;
  fluxRemaining: number;
  roundWins: number;
  hasBurnedCard: boolean;
  activeBurn: BurnType | null;
  hasCommitted: boolean;
  activeBarrier: number;
  connected: boolean;
}

export interface PlayerPrivateState extends PlayerPublicState {
  cards: Card[];
  assaultCardIds: [string, string, string] | null;
  aegisCardIds: [string, string] | null;
  chosenStance: Stance | null;
}

export type GamePhase =
  | 'LOBBY_WAIT'
  | 'DEAL'
  | 'SHAPING'
  | 'COMMITMENT'
  | 'CLASH_REVEAL'
  | 'ROUND_RESOLVE'
  | 'MATCH_OVER';

export interface RoundResolution {
  exchangeNumber: number;
  roundNumber: number;
  isRoundOver: boolean;

  p1PlayerId: string;
  p2PlayerId: string;

  p1Assault: [Card, Card, Card];
  p1Aegis: [Card, Card];
  p1Stance: Stance;
  p1Eval3: HandEvaluation3;
  p1Eval2: HandEvaluation2;
  p1Burn: BurnType | null;

  p2Assault: [Card, Card, Card];
  p2Aegis: [Card, Card];
  p2Stance: Stance;
  p2Eval3: HandEvaluation3;
  p2Eval2: HandEvaluation2;
  p2Burn: BurnType | null;

  p1RawDamage: number;
  p2RawDamage: number;
  p1NetDamageReceived: number;
  p2NetDamageReceived: number;
  p1ReflectedDamage: number;
  p2ReflectedDamage: number;
  p1SiphonHeal: number;
  p2SiphonHeal: number;
  p1HpRemaining: number;
  p2HpRemaining: number;

  roundWinnerId: string | null;
  matchWinnerId: string | null;
}

// ----------------------------------------------------------------------------
// Client-to-Server Messages
// ----------------------------------------------------------------------------
export type ClientMessage =
  | { type: 'CMD_CREATE_ROOM'; playerName: string }
  | { type: 'CMD_JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'CMD_RECONNECT'; roomCode: string; playerId: string; sessionToken: string }
  | { type: 'CMD_NUDGE_RANK'; cardId: string; direction: 'UP' | 'DOWN' }
  | { type: 'CMD_BLEED_SUIT'; cardId: string; targetSuit: Suit }
  | { type: 'CMD_BURN_CAST'; cardId: string }
  | { type: 'CMD_READY' }
  | { type: 'CMD_LEAVE_ROOM' }
  | {
      type: 'CMD_COMMIT_HAND';
      assaultCardIds: [string, string, string];
      aegisCardIds: [string, string];
      stance: Stance;
    }
  | { type: 'CMD_REMATCH' };

// ----------------------------------------------------------------------------
// Server-to-Client Messages
// ----------------------------------------------------------------------------
export type ServerMessage =
  | { type: 'STATE_INIT'; playerId: string; matchId: string; roomCode: string; opponentName: string; sessionToken?: string }
  | {
      type: 'STATE_TICK';
      phase: GamePhase;
      timeRemainingMs: number;
      matchWinnerId: string | null;
      roundNumber: number;
      exchangeNumber: number;
      players: Record<string, PlayerPublicState>;
      selfCards: Card[];
    }
  | {
      type: 'ROUND_OUTCOME';
      resolution: RoundResolution;
    }
  | { type: 'ERROR_REJECTED'; reason: string };

// ----------------------------------------------------------------------------
// Classical Bot & Solo Mode Types
// ----------------------------------------------------------------------------
export type BotPersonality = 'CIPHER_ZERO' | 'VEKTOR_AGGRO' | 'AEGIS_WALL';

export interface BotNudgeAction {
  cardId: string;
  direction: 'UP' | 'DOWN';
}

export interface BotDecision {
  fluxActions: Array<{
    type: 'NUDGE' | 'BLEED';
    cardId: string;
    direction?: 'UP' | 'DOWN';
    targetSuit?: Suit;
  }>;
  burnCardId?: string;
  assaultCardIds: [string, string, string];
  aegisCardIds: [string, string];
  stance: Stance;

  // Required Spec-05 card/stance fields plus optional shaping decisions.
  // Card references and IDs describe the same partition; chosenStance === stance.
  nudges?: BotNudgeAction[];
  cardToBurn?: Card | null;
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  chosenStance: Stance;
}
