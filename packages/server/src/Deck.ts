// ============================================================================
// CYBERANTE: Deterministic CSPRNG Deck Engine
// ============================================================================

import { Card, Suit, Rank } from '@cyberante/shared';
import { randomInt } from 'crypto';

const SUITS: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Reconstructs and shuffles a fresh standard 52-card deck.
   */
  public reset(): void {
    this.cards = [];
    let idCounter = 1;

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({
          id: `card_${idCounter++}_${suit}_${rank}`,
          suit,
          rank,
        });
      }
    }

    this.shuffle();
  }

  /**
   * Deterministic Fisher-Yates shuffle utilizing CSPRNG.
   */
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      const temp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = temp;
    }
  }

  /**
   * Deals N cards from the top of the deck.
   */
  public deal(count: number): Card[] {
    if (this.cards.length < count) {
      throw new Error(`Insufficient cards remaining in deck. Requested: ${count}, Available: ${this.cards.length}`);
    }
    return this.cards.splice(0, count);
  }

  /**
   * Draws a single card from the deck (e.g. for Burn-to-Cast replacement).
   */
  public drawOne(): Card {
    const card = this.cards.shift();
    if (!card) {
      throw new Error('Cannot draw from an empty deck.');
    }
    return card;
  }

  public get remainingCount(): number {
    return this.cards.length;
  }
}
