import { describe, it, expect } from 'vitest';
import {
  Deck,
} from '../Deck.js';
import {
  Card,
  nudgeRank,
  bleedSuit,
  evaluateBurn,
  canNudgeRank,
  canBleedSuit,
  canBurnCard,
  SUIT_RING,
  GAME_CONSTANTS,
} from '@cyberante/shared';

describe('Deck & Flux Transmutation Engine', () => {
  it('generates a full 52-card standard deck and deals cards', () => {
    const deck = new Deck();
    expect(deck.remainingCount).toBe(52);

    const hand = deck.deal(5);
    expect(hand.length).toBe(5);
    expect(deck.remainingCount).toBe(47);

    // Each card has valid suit and rank
    for (const card of hand) {
      expect(['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS']).toContain(card.suit);
      expect(card.rank).toBeGreaterThanOrEqual(2);
      expect(card.rank).toBeLessThanOrEqual(14);
    }
  });

  it('draws single replacement cards for Burn-to-Cast', () => {
    const deck = new Deck();
    const c1 = deck.drawOne();
    expect(c1).toBeDefined();
    expect(deck.remainingCount).toBe(51);
  });

  it('handles Pip Nudge rank transitions and Ace wrapping', () => {
    const cardMid: Card = { id: 'c1', suit: 'SPADES', rank: 7 };
    expect(nudgeRank(cardMid, 'UP').rank).toBe(8);
    expect(nudgeRank(cardMid, 'DOWN').rank).toBe(6);

    // King -> Ace
    const cardKing: Card = { id: 'c2', suit: 'HEARTS', rank: 13 };
    expect(nudgeRank(cardKing, 'UP').rank).toBe(14);

    // Ace wrapping: 14 UP -> 2, 2 DOWN -> 14
    const cardAce: Card = { id: 'c3', suit: 'DIAMONDS', rank: 14 };
    expect(nudgeRank(cardAce, 'UP').rank).toBe(2);

    const cardTwo: Card = { id: 'c4', suit: 'CLUBS', rank: 2 };
    expect(nudgeRank(cardTwo, 'DOWN').rank).toBe(14);
  });

  it('handles chromatic Suit Bleed transitions along the cyclic ring', () => {
    const spade: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
    // Spades can bleed to Clubs or Hearts
    expect(bleedSuit(spade, 'CLUBS').suit).toBe('CLUBS');
    expect(bleedSuit(spade, 'HEARTS').suit).toBe('HEARTS');

    // Spades cannot bleed across to Diamonds directly
    expect(() => bleedSuit(spade, 'DIAMONDS')).toThrow();

    // Verify all suit ring adjacencies
    expect(SUIT_RING.SPADES).toEqual(['CLUBS', 'HEARTS']);
    expect(SUIT_RING.CLUBS).toEqual(['SPADES', 'DIAMONDS']);
    expect(SUIT_RING.DIAMONDS).toEqual(['CLUBS', 'HEARTS']);
    expect(SUIT_RING.HEARTS).toEqual(['DIAMONDS', 'SPADES']);
  });

  it('evaluates Burn-to-Cast effects across all 4 suits', () => {
    // Spade -> Veil
    const spade: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
    expect(evaluateBurn(spade).burnType).toBe('SPADE_VEIL');

    // Heart -> Siphon
    const heart: Card = { id: 'c2', suit: 'HEARTS', rank: 5 };
    expect(evaluateBurn(heart).burnType).toBe('HEART_SIPHON');

    // Club -> Sunder
    const club: Card = { id: 'c3', suit: 'CLUBS', rank: 9 };
    expect(evaluateBurn(club).burnType).toBe('CLUB_SUNDER');

    // Diamond -> Barrier (Ace=11, Face=10, Pip=rank)
    const diamondAce: Card = { id: 'c4', suit: 'DIAMONDS', rank: 14 };
    const diamondKing: Card = { id: 'c5', suit: 'DIAMONDS', rank: 13 };
    const diamond7: Card = { id: 'c6', suit: 'DIAMONDS', rank: 7 };

    expect(evaluateBurn(diamondAce)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 11 });
    expect(evaluateBurn(diamondKing)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 10 });
    expect(evaluateBurn(diamond7)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 7 });
  });

  it('enforces Flux cost constraints', () => {
    const state = { remainingFlux: 3, hasBurnedThisRound: false };
    expect(canNudgeRank(state)).toBe(true);
    expect(canBleedSuit(state)).toBe(true);
    expect(canBurnCard(state)).toBe(true);

    const lowFlux = { remainingFlux: 1, hasBurnedThisRound: true };
    expect(canNudgeRank(lowFlux)).toBe(true);
    expect(canBleedSuit(lowFlux)).toBe(false); // Bleed costs 2
    expect(canBurnCard(lowFlux)).toBe(false); // Max 1 burn per exchange
  });
});
