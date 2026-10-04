import { describe, it, expect } from 'vitest';
import {
  MatchEngine,
  SeededPRNG,
  HandTier3,
  Stance,
  BurnType,
  BotPersonality,
  ClassicalBotAI,
} from '@cyberante/shared';

interface SimulationReport {
  matchesPlayed: number;
  p1Wins: number;
  p2Wins: number;
  totalRounds: number;
  totalExchanges: number;
  avgExchangesPerRound: number;
  avgRoundsPerMatch: number;
  tierCounts: Record<HandTier3, number>;
  stanceCounts: Record<Stance, number>;
  burnCounts: Record<BurnType, number>;
  parryReflects: number;
}

function runMatchSeries(
  p1Profile: BotPersonality,
  p2Profile: BotPersonality,
  matchCount: number,
  baseSeed: number = 42
): SimulationReport {
  const prng = new SeededPRNG(baseSeed);
  const bot1 = new ClassicalBotAI(p1Profile, prng);
  const bot2 = new ClassicalBotAI(p2Profile, prng);

  const report: SimulationReport = {
    matchesPlayed: matchCount,
    p1Wins: 0,
    p2Wins: 0,
    totalRounds: 0,
    totalExchanges: 0,
    avgExchangesPerRound: 0,
    avgRoundsPerMatch: 0,
    tierCounts: {
      STRAIGHT_FLUSH: 0,
      THREE_OF_A_KIND: 0,
      STRAIGHT: 0,
      FLUSH: 0,
      PAIR: 0,
      HIGH_CARD: 0,
    },
    stanceCounts: {
      BRACE: 0,
      OVERCHARGE: 0,
      PARRY: 0,
    },
    burnCounts: {
      SPADE_VEIL: 0,
      DIAMOND_BARRIER: 0,
      HEART_SIPHON: 0,
      CLUB_SUNDER: 0,
    },
    parryReflects: 0,
  };

  for (let m = 0; m < matchCount; m++) {
    const engine = new MatchEngine('p1', `Bot_${p1Profile}`, 'p2', `Bot_${p2Profile}`, prng);
    engine.startMatch();

    let roundsInMatch = 0;
    let exchangesInMatch = 0;
    let lastRoundSeen = 1;

    // Safety watchdog: max 100 exchanges per match
    for (let step = 0; step < 100; step++) {
      if (engine.phase === 'MATCH_OVER' || engine.matchWinnerId) {
        break;
      }

      if (engine.currentRound !== lastRoundSeen) {
        roundsInMatch++;
        lastRoundSeen = engine.currentRound;
      }
      exchangesInMatch++;

      const p1Private = engine.getPlayer('p1')!;
      const p2Private = engine.getPlayer('p2')!;

      // Bot 1 decision
      const d1 = bot1.evaluateHand(
        p1Private.cards,
        p1Private.guardHp,
        p2Private.guardHp,
        p1Private.fluxRemaining,
        !p1Private.hasBurnedCard
      );

      // Bot 2 decision
      const d2 = bot2.evaluateHand(
        p2Private.cards,
        p2Private.guardHp,
        p1Private.guardHp,
        p2Private.fluxRemaining,
        !p2Private.hasBurnedCard
      );

      // Apply Burns
      if (d1.burnCardId) {
        const card = p1Private.cards.find(c => c.id === d1.burnCardId);
        if (card) {
          const ok = engine.burnCard('p1', d1.burnCardId);
          if (ok && p1Private.activeBurn) {
            report.burnCounts[p1Private.activeBurn]++;
          }
        }
      }
      if (d2.burnCardId) {
        const card = p2Private.cards.find(c => c.id === d2.burnCardId);
        if (card) {
          const ok = engine.burnCard('p2', d2.burnCardId);
          if (ok && p2Private.activeBurn) {
            report.burnCounts[p2Private.activeBurn]++;
          }
        }
      }

      // Apply Flux Actions (Nudge)
      for (const act of d1.fluxActions) {
        if (act.type === 'NUDGE' && act.direction) {
          engine.nudgeRank('p1', act.cardId, act.direction);
        }
      }
      for (const act of d2.fluxActions) {
        if (act.type === 'NUDGE' && act.direction) {
          engine.nudgeRank('p2', act.cardId, act.direction);
        }
      }

      // Re-evaluate hand splits with post-burn/nudge cards
      const finalD1 = bot1.evaluateHand(
        p1Private.cards,
        p1Private.guardHp,
        p2Private.guardHp,
        0,
        false
      );
      const finalD2 = bot2.evaluateHand(
        p2Private.cards,
        p2Private.guardHp,
        p1Private.guardHp,
        0,
        false
      );

      engine.commitHand('p1', finalD1.assaultCardIds, finalD1.aegisCardIds, finalD1.stance);
      engine.commitHand('p2', finalD2.assaultCardIds, finalD2.aegisCardIds, finalD2.stance);

      report.stanceCounts[finalD1.stance]++;
      report.stanceCounts[finalD2.stance]++;

      // Resolve Clash
      const outcome = engine.resolveClash();

      report.tierCounts[outcome.p1Eval3.tier]++;
      report.tierCounts[outcome.p2Eval3.tier]++;

      if (outcome.p1ReflectedDamage > 0 || outcome.p2ReflectedDamage > 0) {
        report.parryReflects++;
      }

      if (engine.matchWinnerId) {
        roundsInMatch++;
        break;
      }

      // Advance exchange
      engine.startExchange();
    }

    if (engine.matchWinnerId === 'p1') {
      report.p1Wins++;
    } else {
      report.p2Wins++;
    }

    report.totalRounds += Math.max(1, roundsInMatch);
    report.totalExchanges += exchangesInMatch;
  }

  report.avgExchangesPerRound = report.totalExchanges / report.totalRounds;
  report.avgRoundsPerMatch = report.totalRounds / report.matchesPlayed;

  return report;
}

describe('Headless Balance Simulator (Option A Multi-Exchange)', () => {
  it('runs 200 mirror matches between Cipher-0 bots with balanced win rates', () => {
    const report = runMatchSeries('CIPHER_ZERO', 'CIPHER_ZERO', 200, 1001);

    console.log('\n======================================================');
    console.log('   CYBERANTE HEADLESS BALANCE SIMULATOR: CIPHER-0 MIRROR');
    console.log('======================================================');
    console.log(`Matches Simulated:     ${report.matchesPlayed}`);
    console.log(`P1 Wins:               ${report.p1Wins} (${((report.p1Wins / report.matchesPlayed) * 100).toFixed(1)}%)`);
    console.log(`P2 Wins:               ${report.p2Wins} (${((report.p2Wins / report.matchesPlayed) * 100).toFixed(1)}%)`);
    console.log(`Avg Rounds/Match:      ${report.avgRoundsPerMatch.toFixed(2)} (Bo3 target: 2.0 - 2.8)`);
    console.log(`Avg Exchanges/Round:   ${report.avgExchangesPerRound.toFixed(2)} (Target: 1.8 - 4.5)`);
    console.log('Stances Deployed:     ', report.stanceCounts);
    console.log('Tactical Burns:       ', report.burnCounts);
    console.log('Hand Tier Distribution:', report.tierCounts);
    console.log(`Parry Reflects:        ${report.parryReflects}`);
    console.log('======================================================\n');

    expect(report.matchesPlayed).toBe(200);
    expect(report.p1Wins + report.p2Wins).toBe(200);
    // Mirror match win rate must be statistically close to 50% (between 38% and 62%)
    expect(report.p1Wins).toBeGreaterThanOrEqual(76);
    expect(report.p1Wins).toBeLessThanOrEqual(124);

    // Pacing checks: Option A requires multi-exchange combat per round
    expect(report.avgExchangesPerRound).toBeGreaterThanOrEqual(1.5);
    expect(report.avgExchangesPerRound).toBeLessThanOrEqual(5.0);
    expect(report.avgRoundsPerMatch).toBeGreaterThanOrEqual(2.0);
  });

  it('runs Aggro vs Wall matchup: high damage meets high mitigation', () => {
    const report = runMatchSeries('VEKTOR_AGGRO', 'AEGIS_WALL', 100, 2002);

    console.log('\n======================================================');
    console.log('   CYBERANTE SIMULATOR: VEKTOR-AGGRO vs AEGIS-WALL');
    console.log('======================================================');
    console.log(`Vektor-Aggro Wins:     ${report.p1Wins} (${((report.p1Wins / 100) * 100).toFixed(1)}%)`);
    console.log(`Aegis-Wall Wins:       ${report.p2Wins} (${((report.p2Wins / 100) * 100).toFixed(1)}%)`);
    console.log(`Avg Exchanges/Round:   ${report.avgExchangesPerRound.toFixed(2)}`);
    console.log('Stances:              ', report.stanceCounts);
    console.log(`Parry Reflect Counters:${report.parryReflects}`);
    console.log('======================================================\n');

    expect(report.p1Wins + report.p2Wins).toBe(100);
    // Both archetypes must have viable win conditions (neither 0%)
    expect(report.p1Wins).toBeGreaterThanOrEqual(20);
    expect(report.p2Wins).toBeGreaterThanOrEqual(20);
  });
});
