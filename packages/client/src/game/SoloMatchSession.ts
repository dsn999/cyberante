import {
  MatchEngine, SeededPRNG, ClassicalBotAI, applyBotShaping, GAME_CONSTANTS,
  type BotPersonality, type GamePhase, type ServerMessage, type Stance, type Suit,
} from '@cyberante/shared';

/** Owns offline match clocks. The engine remains the authority for all actions. */
export class SoloMatchSession {
  private readonly engine: MatchEngine;
  private readonly bot: ClassicalBotAI;
  private readonly thinking: SeededPRNG;
  private phaseTimer: ReturnType<typeof setTimeout> | undefined;
  private botTimer: ReturnType<typeof setTimeout> | undefined;
  private deadline = 0;
  private humanReady = false;
  private botReady = false;
  private stopped = false;

  constructor(profile: BotPersonality, seed: number, private readonly emit: (message: ServerMessage) => void) {
    this.engine = new MatchEngine('player', 'Operative', 'bot', profile, new SeededPRNG(seed));
    this.bot = new ClassicalBotAI(profile, new SeededPRNG(seed ^ 0x9e3779b9));
    this.thinking = new SeededPRNG(seed ^ 0x85ebca6b);
  }

  public start(): void {
    if (this.stopped) return;
    this.clearTimers();
    this.engine.startMatch();
    this.deal();
  }

  public rematch(): boolean {
    if (this.stopped || this.engine.phase !== 'MATCH_OVER') return false;
    this.start();
    return true;
  }

  public ready(): boolean {
    if (this.stopped || this.engine.phase !== 'SHAPING' || this.humanReady) return false;
    this.humanReady = true;
    if (this.botReady) this.commitment();
    else this.tick();
    return true;
  }

  public nudgeRank(cardId: string, direction: 'UP' | 'DOWN'): boolean {
    return this.action(() => this.engine.nudgeRank('player', cardId, direction));
  }

  public bleedSuit(cardId: string, suit: Suit): boolean {
    return this.action(() => this.engine.bleedSuit('player', cardId, suit));
  }

  public burnCard(cardId: string): boolean {
    return this.action(() => this.engine.burnCard('player', cardId));
  }

  public commitHand(assault: [string, string, string], aegis: [string, string], stance: Stance): boolean {
    if (this.stopped || !this.engine.commitHand('player', assault, aegis, stance)) return false;
    if (this.engine.areBothCommitted()) this.clash();
    else this.tick();
    return true;
  }

  public destroy(): void {
    this.stopped = true;
    this.clearTimers();
  }

  private action(apply: () => boolean): boolean {
    if (this.stopped || !apply()) return false;
    this.tick();
    return true;
  }

  private clearTimers(): void {
    clearTimeout(this.phaseTimer);
    clearTimeout(this.botTimer);
    this.phaseTimer = undefined;
    this.botTimer = undefined;
  }

  private enter(phase: GamePhase, duration: number, next?: () => void): void {
    this.clearTimers();
    this.engine.phase = phase;
    this.deadline = duration ? Date.now() + duration : 0;
    if (next) this.phaseTimer = setTimeout(() => {
      if (!this.stopped) next();
    }, duration);
    this.tick();
  }

  private think(run: () => void): void {
    this.botTimer = setTimeout(() => {
      if (!this.stopped) run();
    }, this.thinking.nextInt(1000, 1501));
  }

  private deal(): void {
    this.humanReady = false;
    this.botReady = false;
    this.enter('DEAL', GAME_CONSTANTS.DEAL_TIME_MS, () => this.shaping());
  }

  private shapeBot(): void {
    if (this.botReady) return;
    const bot = this.engine.getPlayer('bot')!;
    const human = this.engine.getPlayer('player')!;
    applyBotShaping(this.engine, 'bot', this.bot.evaluateHand(
      bot.cards, bot.guardHp, human.guardHp, bot.fluxRemaining, !bot.hasBurnedCard,
    ));
    this.botReady = true;
  }

  private shaping(): void {
    this.enter('SHAPING', GAME_CONSTANTS.SHAPING_TIME_MS, () => this.commitment());
    this.think(() => {
      this.shapeBot();
      if (this.humanReady) this.commitment();
      else this.tick();
    });
  }

  private commitment(): void {
    // A throttled browser may deliver the shaping deadline before the bot timer.
    this.shapeBot();
    this.enter('COMMITMENT', GAME_CONSTANTS.COMMITMENT_TIME_MS, () => {
      this.engine.autoLockUncommitted();
      this.clash();
    });
    this.think(() => {
      const bot = this.engine.getPlayer('bot')!;
      const human = this.engine.getPlayer('player')!;
      const decision = this.bot.evaluateHand(bot.cards, bot.guardHp, human.guardHp, 0, false);
      if (!this.engine.commitHand('bot', decision.assaultCardIds, decision.aegisCardIds, decision.stance)) {
        throw new Error('Bot commitment rejected');
      }
      if (this.engine.areBothCommitted()) this.clash();
      else this.tick();
    });
  }

  private clash(): void {
    const resolution = this.engine.resolveClash();
    this.enter('CLASH_REVEAL', GAME_CONSTANTS.CLASH_REVEAL_TIME_MS, () => {
      this.enter('ROUND_RESOLVE', GAME_CONSTANTS.ROUND_RESOLVE_TIME_MS, () => {
        if (this.engine.matchWinnerId) this.enter('MATCH_OVER', 0);
        else {
          this.engine.startExchange();
          this.deal();
        }
      });
    });
    this.emit({ type: 'ROUND_OUTCOME', resolution });
  }

  private tick(): void {
    this.emit({
      type: 'STATE_TICK', phase: this.engine.phase,
      timeRemainingMs: this.deadline ? Math.max(0, this.deadline - Date.now()) : 0,
      matchWinnerId: this.engine.matchWinnerId,
      roundNumber: this.engine.currentRound, exchangeNumber: this.engine.currentExchange,
      players: this.engine.getPublicState(),
      selfCards: this.engine.getPlayer('player')!.cards.map(card => ({ ...card })),
    });
  }
}
