// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  GLOBAL_CARDS,
  SITUATION_CARDS,
  createShuffledCardIds,
  drawCardFromQueue
} from '../data/cards';
import { OFFICIAL_CHARACTERS } from '../data/characters';
import {
  AGORA_COLUMNS,
  INITIAL_TILES,
  computeAgoraColumnMove,
  findAgoraColumnByTileId,
  isAgoraEntryOrColumnTile
} from '../data/tiles';
import { Character, DynamicWeatherEvent, UnexpectedCrisisEvent } from '../types/game';
import { getEffectiveResourceReward, getEffectiveUnlockCost } from '../utils/crisisEngine';
import { createMulberry32 } from '../utils/prng';
import { getEffectiveBailCostPerRound, getEffectiveBureaucracyCost } from '../utils/reputation';

function makeCharacter(id: string): Character {
  const base = OFFICIAL_CHARACTERS.find(c => c.id === id) ?? OFFICIAL_CHARACTERS[0];
  return {
    ...base,
    controller: 'HUMAN',
    wellness: 6,
    legitimacy: 5,
    position: 0,
    isDetained: false,
    detentionRoundsLeft: 0,
    inAgora: false,
    roundsInAgora: 0,
    neighborhoodReputation: 8
  };
}

describe('Official Commonspoly Rules, Decks, Agora & Ruleset Isolation', () => {
  it('provides full 20 Global Cards and 24 Situation Cards with non-repeating shuffle queues', () => {
    expect(GLOBAL_CARDS.length).toBe(20);
    expect(SITUATION_CARDS.length).toBe(24);

    const rng = createMulberry32(424242);
    let queue: string[] | undefined;
    let cursor: number | undefined;
    const drawnFirstCycle: string[] = [];

    for (let i = 0; i < GLOBAL_CARDS.length; i++) {
      const draw = drawCardFromQueue(GLOBAL_CARDS, queue, cursor, rng);
      drawnFirstCycle.push(draw.card.id);
      queue = draw.nextQueueIds;
      cursor = draw.nextCursor;
    }

    expect(new Set(drawnFirstCycle).size).toBe(GLOBAL_CARDS.length);
    expect(cursor).toBe(GLOBAL_CARDS.length);

    // Next draw reshuffles automatically for a fresh cycle
    const nextCycleDraw = drawCardFromQueue(GLOBAL_CARDS, queue, cursor, rng);
    expect(nextCycleDraw.nextCursor).toBe(1);
    expect(nextCycleDraw.nextQueueIds.length).toBe(GLOBAL_CARDS.length);

    // Deterministic seeding reproduces exact shuffled order
    const orderA = createShuffledCardIds(SITUATION_CARDS, createMulberry32(999));
    const orderB = createShuffledCardIds(SITUATION_CARDS, createMulberry32(999));
    expect(orderA).toEqual(orderB);
    expect(new Set(orderA).size).toBe(SITUATION_CARDS.length);
  });

  it('enforces Agora radial column rules: legitimacy gate, exact entry to #100, and rebound on overshoot', () => {
    expect(AGORA_COLUMNS).toHaveLength(4);
    expect(isAgoraEntryOrColumnTile(5)).toBe(true);
    expect(isAgoraEntryOrColumnTile(43)).toBe(true);
    expect(isAgoraEntryOrColumnTile(100)).toBe(false);
    expect(findAgoraColumnByTileId(15)?.columnId).toBe('RIGHT');

    // Perimeter entry tile cannot climb column if collective legitimacy requirement is not met
    expect(computeAgoraColumnMove(5, 3, false)).toBeNull();

    // From entry tile #5 with collective legitimacy met, roll 4 lands exactly on #100 (Agora)
    const exactEntry = computeAgoraColumnMove(5, 4, true);
    expect(exactEntry).not.toBeNull();
    expect(exactEntry!.targetPos).toBe(100);
    expect(exactEntry!.enteredAgora).toBe(true);
    expect(exactEntry!.reboundedInColumn).toBe(false);
    expect(exactEntry!.pathTileIds).toEqual([5, 41, 42, 43, 100]);

    // Roll 6 from #5 overshoots #100 by 2 and rebounds back along the column
    const overshootEntry = computeAgoraColumnMove(5, 6, true);
    expect(overshootEntry).not.toBeNull();
    expect(overshootEntry!.enteredAgora).toBe(false);
    expect(overshootEntry!.reboundedInColumn).toBe(true);
    expect(overshootEntry!.targetPos).toBe(42);

    // Player already inside column #42 without legitimacy rebounds before entering #100
    const blockedInside = computeAgoraColumnMove(42, 3, false);
    expect(blockedInside).not.toBeNull();
    expect(blockedInside!.enteredAgora).toBe(false);
    expect(blockedInside!.reboundedInColumn).toBe(true);
  });

  it('contains official special tiles Casino (#36), Bank (#28), Bureaucracy (#10), Detention (#18), Tragedy (#20), Assembly (#30), Crowdfunding (#38)', () => {
    const byId = new Map(INITIAL_TILES.map(t => [t.id, t]));
    expect(byId.get(10)?.specialType).toBe('BUREAUCRACY');
    expect(byId.get(18)?.specialType).toBe('DETENTION_CENTER');
    expect(byId.get(20)?.specialType).toBe('TRAGEDY_OF_COMMONS');
    expect(byId.get(28)?.specialType).toBe('BANK');
    expect(byId.get(30)?.specialType).toBe('ASSEMBLY');
    expect(byId.get(36)?.specialType).toBe('CASINO');
    expect(byId.get(38)?.specialType).toBe('CROWDFUNDING');
    expect(byId.get(100)?.category).toBe('AGORA_CENTER');
  });

  it('isolates OFFICIAL ruleset from EXPANDED character bonuses, reputation modifiers, crises, and weather events', () => {
    const carolina = makeCharacter('carolina'); // care=6 -> baseCost = 10 - 6 = 4, + HEALTH unique bonus -1 in EXPANDED
    const hospitalTile = INITIAL_TILES.find(t => t.id === 2)!; // HEALTH resource
    const activeCrisis: UnexpectedCrisisEvent = {
      id: 'crisis_health_supply',
      title: 'Test Crisis',
      description: 'Health cost +3',
      affectedGoodType: 'HEALTH',
      unlockCostDelta: 3,
      commonYieldDelta: -1,
      turnsRemaining: 3,
      totalTurns: 5,
      severity: 'CRITICAL',
      triggeredAtRound: 2
    };
    const activeWeather: DynamicWeatherEvent = {
      id: 'weather_test',
      kind: 'TORRENTIAL_RAIN',
      weatherType: 'RAIN',
      title: 'Weather',
      description: 'Test weather',
      alertMessage: 'Test alert',
      affectedTileIds: [2],
      affectedTileNames: ['Hospital'],
      affectedGoodTypes: ['HEALTH'],
      unlockCostDelta: 2,
      resourceYieldDelta: -1,
      turnsRemaining: 2,
      totalTurns: 2,
      severity: 'HAZARD',
      triggeredAtRound: 2
    };

    const officialCost = getEffectiveUnlockCost(
      hospitalTile,
      carolina,
      activeCrisis,
      activeWeather,
      'OFFICIAL'
    );
    expect(officialCost.baseCost).toBe(4);
    expect(officialCost.effectiveCost).toBe(4);
    expect(officialCost.crisisDelta).toBe(0);
    expect(officialCost.weatherDelta).toBe(0);
    expect(officialCost.reputationDelta).toBe(0);
    expect(officialCost.characterBonusDelta).toBe(0);

    const expandedCost = getEffectiveUnlockCost(
      hospitalTile,
      carolina,
      activeCrisis,
      activeWeather,
      'EXPANDED'
    );
    expect(expandedCost.characterBonusDelta).toBe(-1);
    expect(expandedCost.crisisDelta).toBe(3);
    expect(expandedCost.weatherDelta).toBe(2);
    expect(expandedCost.effectiveCost).not.toBe(officialCost.effectiveCost);

    const officialReward = getEffectiveResourceReward(
      hospitalTile,
      2,
      2,
      activeCrisis,
      carolina,
      activeWeather,
      'OFFICIAL'
    );
    expect(officialReward).toEqual({
      wellness: 2,
      legitimacy: 2,
      crisisDelta: 0,
      weatherDelta: 0
    });

    // Bureaucracy cost & bail stay fixed at official 6 and 2/round in OFFICIAL mode
    expect(getEffectiveBureaucracyCost(carolina, 'OFFICIAL').effectiveCost).toBe(6);
    expect(getEffectiveBailCostPerRound(makeCharacter('matsuko'), carolina, 'OFFICIAL').effectivePerRound).toBe(2);
  });
});
