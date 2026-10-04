import { evaluateAssaultHand, evaluateAegisHand, type Card } from '@cyberante/shared';

/** UI-only partition selection; the engine/server validates every commitment. */
export class HandSelection {
  public cards: Card[] = [];
  public assaultIds: string[] = [];
  public aegisIds: string[] = [];
  public pendingSwap: string | null = null;

  public get valid(): boolean {
    const ids = [...this.assaultIds, ...this.aegisIds];
    return this.cards.length === 5 && this.assaultIds.length === 3 && this.aegisIds.length === 2
      && new Set(ids).size === 5 && ids.every(id => this.cards.some(card => card.id === id));
  }

  public setCards(cards: Card[]): void {
    const oldIds = new Set(this.cards.map(card => card.id));
    const newIds = new Set(cards.map(card => card.id));
    const replacements = cards.filter(card => !oldIds.has(card.id));
    const retired = this.cards.filter(card => !newIds.has(card.id));
    // A burn replaces one owned card. Retain its lane and all other selections.
    const replacement = retired.length === 1 && replacements.length === 1 ? replacements[0].id : null;
    const sync = (ids: string[]) => ids.flatMap(id => newIds.has(id) ? [id] : replacement ? [replacement] : []);
    this.assaultIds = sync(this.assaultIds);
    this.aegisIds = sync(this.aegisIds);
    if (this.pendingSwap && !newIds.has(this.pendingSwap)) this.pendingSwap = null;
    this.cards = cards.map(card => ({ ...card }));
    if (cards.length === 5 && (oldIds.size === 0 || !cards.some(card => oldIds.has(card.id)))) this.autoSplit();
  }

  public reset(): void {
    this.cards = [];
    this.assaultIds = [];
    this.aegisIds = [];
    this.pendingSwap = null;
  }

  public autoSplit(): void {
    if (this.cards.length !== 5) return;
    let best = -Infinity;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 4; j++) for (let k = j + 1; k < 5; k++) {
      const assault: [Card, Card, Card] = [this.cards[i], this.cards[j], this.cards[k]];
      const aegis = this.cards.filter((_, index) => index !== i && index !== j && index !== k) as [Card, Card];
      const utility = evaluateAssaultHand(assault).baseDamage * 1.5 + evaluateAegisHand(aegis).mitigation;
      if (utility > best) {
        best = utility;
        this.assaultIds = assault.map(card => card.id);
        this.aegisIds = aegis.map(card => card.id);
      }
    }
    this.pendingSwap = null;
  }

  public remove(id: string): void {
    this.assaultIds = this.assaultIds.filter(cardId => cardId !== id);
    this.aegisIds = this.aegisIds.filter(cardId => cardId !== id);
    this.pendingSwap = null;
  }

  public toggle(id: string): void {
    if (!this.cards.some(card => card.id === id)) return;
    const assault = this.assaultIds.includes(id);
    const aegis = this.aegisIds.includes(id);
    if (!assault && !aegis) {
      if (this.assaultIds.length < 3) this.assaultIds.push(id);
      else if (this.aegisIds.length < 2) this.aegisIds.push(id);
      this.pendingSwap = null;
      return;
    }
    if (this.pendingSwap === id) { this.pendingSwap = null; return; }
    const origin = assault ? this.assaultIds : this.aegisIds;
    const destination = assault ? this.aegisIds : this.assaultIds;
    if (this.pendingSwap && destination.includes(this.pendingSwap)) {
      const swapId = this.pendingSwap;
      origin[origin.indexOf(id)] = swapId;
      destination[destination.indexOf(swapId)] = id;
      this.pendingSwap = null;
    } else if (destination.length < (assault ? 2 : 3)) {
      origin.splice(origin.indexOf(id), 1);
      destination.push(id);
      this.pendingSwap = null;
    } else this.pendingSwap = id;
  }
}
