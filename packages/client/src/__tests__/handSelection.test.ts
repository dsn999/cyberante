import { describe, expect, it } from 'vitest';
import { evaluateAegisHand, evaluateAssaultHand, type Card } from '@cyberante/shared';
import { HandSelection } from '../ui/HandSelection';
const cards: Card[] = [
  { id: 'a', rank: 14, suit: 'SPADES' }, { id: 'b', rank: 13, suit: 'SPADES' },
  { id: 'c', rank: 12, suit: 'SPADES' }, { id: 'd', rank: 5, suit: 'HEARTS' }, { id: 'e', rank: 5, suit: 'CLUBS' },
];
const setup = () => { const selection = new HandSelection(); selection.setCards(cards); return selection; };

describe('tactical hand selection', () => {
  it('chooses the best of ten local utility partitions', () => {
    const selection = setup();
    expect(selection.assaultIds).toEqual(['a', 'b', 'c']); expect(selection.aegisIds).toEqual(['d', 'e']);
    const utility = (assault: Card[], aegis: Card[]) => evaluateAssaultHand(assault as [Card, Card, Card]).baseDamage * 1.5 + evaluateAegisHand(aegis as [Card, Card]).mitigation;
    const best = utility(cards.slice(0, 3), cards.slice(3));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 4; j++) for (let k = j + 1; k < 5; k++) {
      const assault = [cards[i], cards[j], cards[k]];
      expect(utility(assault, cards.filter(card => !assault.includes(card)))).toBeLessThanOrEqual(best);
    }
    expect(selection.valid).toBe(true);
  });
  it('swaps opposite lanes without overfilling either lane', () => {
    const selection = setup(); selection.toggle('a');
    expect(selection.pendingSwap).toBe('a'); expect(selection.valid).toBe(true);
    selection.toggle('d'); expect(selection.assaultIds).toEqual(['d', 'b', 'c']); expect(selection.aegisIds).toEqual(['a', 'e']);
    expect(selection.pendingSwap).toBeNull(); expect(selection.valid).toBe(true);
  });
  it('cancels a selected swap and rejects unknown cards', () => {
    const selection = setup(); selection.toggle('a'); selection.toggle('a'); expect(selection.pendingSwap).toBeNull();
    selection.toggle('foreign'); expect(selection.valid).toBe(true);
  });
  it('preserves an incomplete manual selection on repeated authoritative updates', () => {
    const selection = setup(); selection.remove('a'); expect(selection.valid).toBe(false);
    selection.setCards(cards.map(card => ({ ...card }))); expect(selection.assaultIds).toEqual(['b', 'c']);
    expect(selection.valid).toBe(false); selection.toggle('a'); expect(selection.valid).toBe(true);
  });
  it('updates ranks without changing the chosen partition or mutating input', () => {
    const selection = setup(); selection.toggle('a'); selection.toggle('d');
    const updated = cards.map(card => card.id === 'b' ? { ...card, rank: 14 as const } : card);
    selection.setCards(updated); expect(selection.assaultIds).toEqual(['d', 'b', 'c']); expect(selection.cards[1].rank).toBe(14);
    selection.cards[1].rank = 2; expect(updated[1].rank).toBe(14); expect(cards[1].rank).toBe(13);
  });
  it('retains a burned card’s lane when its replacement arrives', () => {
    const selection = setup(); selection.toggle('a');
    selection.setCards(cards.map(card => card.id === 'a' ? { id: 'replacement', rank: 2, suit: 'DIAMONDS' } : card));
    expect(selection.assaultIds).toEqual(['replacement', 'b', 'c']); expect(selection.valid).toBe(true); expect(selection.pendingSwap).toBeNull();
  });
  it('resets for a fresh exchange and never accepts a duplicate partition', () => {
    const selection = setup(); selection.remove('a');
    selection.setCards(cards.map(card => ({ ...card, id: `new-${card.id}` })));
    expect(selection.valid).toBe(true); expect(selection.assaultIds).toEqual(['new-a', 'new-b', 'new-c']);
    selection.aegisIds[0] = selection.assaultIds[0]; expect(selection.valid).toBe(false);
    selection.reset(); expect(selection.cards).toEqual([]); expect(selection.valid).toBe(false);
  });
});
