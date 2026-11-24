// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHARACTERS } from '../data/characters';
import { INITIAL_TILES, applyInitialDifficultyToTiles } from '../data/tiles';
import { GameEngineState, TurnReplayFrame } from '../types/game';
import { runEconomyMonteCarlo } from '../utils/economySimulator';
import {
  DEFAULT_PROBABILITY_SANDBOX_CONFIG,
  getSpeculatorTilePressureChance,
  resolveSpeculatorStepDistribution
} from '../utils/probabilitySandbox';
import { hydrateBoardFromReplayFrame } from '../utils/replay';
import { computeSpeculatorFinancialDashboard } from '../utils/speculatorFinancials';

function buildFixtureState(): GameEngineState {
  const players = OFFICIAL_CHARACTERS.slice(0, 4).map((c, idx) => ({
    ...c,
    controller: idx === 0 ? ('HUMAN' as const) : ('BOT' as const),
    wellness: 6,
    legitimacy: 4,
    position: idx * 3,
    isDetained: false,
    detentionRoundsLeft: 0,
    inAgora: false,
    roundsInAgora: 0,
    neighborhoodReputation: 0
  }));

  const tiles = applyInitialDifficultyToTiles(INITIAL_TILES, {
    health: 3,
    urban: 2,
    knowledge: 3,
    environment: 4
  });

  return {
    phase: 'PLAYER_TURN_READY',
    round: 3,
    players,
    speculators: [
      { id: 1, name: 'Especulador 1', position: 10, color: '#ef4444' },
      { id: 2, name: 'Especulador 2', position: 26, color: '#dc2626' }
    ],
    tiles,
    activePlayerIndex: 0,
    currentDiceRoll: null,
    currentGlobalCard: null,
    currentSituationCard: null,
    activeModal: null,
    neighborhoodDecision: null,
    logs: [],
    chatMessages: [],
    cameraMode: 'ISOMETRIC',
    soundEnabled: true,
    ambientMode: 'AUTO',
    weatherMode: 'AUTO',
    setupConfig: {
      health: 3,
      urban: 2,
      knowledge: 3,
      environment: 4,
      totalSum: 12,
      difficulty: 'EN_TRANSICION',
      speculatorsCount: 2,
      rulesetMode: 'EXPANDED'
    },
    rulesetMode: 'EXPANDED',
    probabilitySandbox: {
      ...DEFAULT_PROBABILITY_SANDBOX_CONFIG
    }
  };
}

describe('Economy Monte Carlo, Replay Hydration & Bot Behavior Controller', () => {
  it('runs deterministic seeded Monte Carlo simulations with bounded metrics', () => {
    const state = buildFixtureState();
    const runA = runEconomyMonteCarlo(state, { iterations: 40, horizonRounds: 10, seed: 1337 });
    const runB = runEconomyMonteCarlo(state, { iterations: 40, horizonRounds: 10, seed: 1337 });

    expect(runA.iterations).toBe(40);
    expect(runA.victoryPct + runA.drawPct + runA.defeatPct).toBeCloseTo(100, 0);
    expect(runA.avgFinalRound).toBeGreaterThanOrEqual(state.round);
    expect(runA.avgFinalRound).toBeLessThanOrEqual(20);
    expect(runA.avgFinalEfficiencyPct).toBeGreaterThanOrEqual(0);
    expect(runA.avgFinalEfficiencyPct).toBeLessThanOrEqual(100);

    // Deterministic given same seed
    expect(runA.victoryPct).toBe(runB.victoryPct);
    expect(runA.drawPct).toBe(runB.drawPct);
    expect(runA.defeatPct).toBe(runB.defeatPct);
    expect(runA.avgFinalCommonCount).toBe(runB.avgFinalCommonCount);
  });

  it('faithfully restores board tiles, players, speculators, and round from a ReplayFrame', () => {
    const baseState = buildFixtureState();
    const frame: TurnReplayFrame = {
      frameIndex: 5,
      round: 9,
      timestamp: '12:00',
      actorId: baseState.players[1].id,
      actorName: baseState.players[1].name,
      actorColor: baseState.players[1].color,
      activePlayerIndex: 1,
      diceRoll: 5,
      eventSummary: 'Snapshot crítico de especulación',
      turnLogs: [],
      players: baseState.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        controller: p.controller,
        position: idx === 1 ? 22 : 12,
        wellness: 3 + idx,
        legitimacy: 7 + idx,
        isDetained: idx === 2,
        detentionRoundsLeft: idx === 2 ? 1 : 0,
        inAgora: idx === 0,
        roundsInAgora: idx === 0 ? 2 : 0,
        neighborhoodReputation: idx === 1 ? 5 : 0
      })),
      speculators: [
        { id: 1, name: 'Especulador 1', position: 21, color: '#ef4444' },
        { id: 2, name: 'Especulador 2', position: 37, color: '#dc2626' }
      ],
      tileStates: {
        1: 'COMMON',
        2: 'PRIVATE',
        21: 'COMMON'
      },
      commonCount: 6,
      publicCount: 8,
      privateCount: 16
    };

    const hydrated = hydrateBoardFromReplayFrame(baseState, frame);
    expect(hydrated.round).toBe(9);
    expect(hydrated.activePlayerIndex).toBe(1);
    expect(hydrated.currentDiceRoll).toBe(5);
    expect(hydrated.players[0].inAgora).toBe(true);
    expect(hydrated.players[1].position).toBe(22);
    expect(hydrated.players[2].isDetained).toBe(true);
    expect(hydrated.speculators[0].position).toBe(21);
    expect(hydrated.speculators[1].position).toBe(37);
    expect(hydrated.tiles.find(t => t.id === 1)?.state).toBe('COMMON');
    expect(hydrated.tiles.find(t => t.id === 2)?.state).toBe('PRIVATE');
  });

  it('applies Bot Behavior Controller overrides (aggressiveness, influence radius, decision threshold, FROZEN)', () => {
    const state = buildFixtureState();
    // Place player 0 isolated at pos 14 (distance +4 ahead of speculator 1 at pos 10)
    state.players[0].position = 14;
    state.players.slice(1).forEach(p => {
      p.position = 0;
    });

    const predatorDist = resolveSpeculatorStepDistribution(
      10,
      state.players,
      {
        ...DEFAULT_PROBABILITY_SANDBOX_CONFIG,
        enabled: true,
        speculatorBehaviors: {
          1: { speculatorId: 1, aggressivenessPct: 95, influenceRadius: 12, decisionThreshold: 6 }
        }
      },
      1
    );
    expect(predatorDist.deterministicStep).toBe(4);
    expect(predatorDist.stepProbs[4]).toBe(1);

    const lowAggroPressure = getSpeculatorTilePressureChance(
      'EN_TRANSICION',
      {
        ...DEFAULT_PROBABILITY_SANDBOX_CONFIG,
        enabled: true,
        speculatorBehaviors: {
          1: { speculatorId: 1, aggressivenessPct: 10, influenceRadius: 4, decisionThreshold: 2 }
        }
      },
      1
    );
    const highAggroPressure = getSpeculatorTilePressureChance(
      'EN_TRANSICION',
      {
        ...DEFAULT_PROBABILITY_SANDBOX_CONFIG,
        enabled: true,
        speculatorBehaviors: {
          1: { speculatorId: 1, aggressivenessPct: 95, influenceRadius: 18, decisionThreshold: 5 }
        }
      },
      1
    );
    expect(highAggroPressure).toBeGreaterThan(lowAggroPressure);

    // FROZEN drops dashboard vandalism capacity to 0 and pressure chance to 0
    state.probabilitySandbox = {
      ...DEFAULT_PROBABILITY_SANDBOX_CONFIG,
      enabled: true,
      speculatorMovementLogic: 'FROZEN'
    };
    expect(getSpeculatorTilePressureChance('MAD_MAX', state.probabilitySandbox, 1)).toBe(0);
    const frozenDash = computeSpeculatorFinancialDashboard(state);
    expect(frozenDash.maxCapacityPct).toBe(0);
    expect(frozenDash.profiles.every(p => p.defenseTier === 'CONTAINED')).toBe(true);
  });
});
