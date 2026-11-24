/**
 * economyDebugMetrics.ts
 * Motor de cálculo determinista en tiempo real para el Panel Debug de Economía y Especulación.
 * Evalúa probabilidades exactas de eventos especulativos (ataques de especuladores 1d6,
 * crisis inesperadas, eventos climáticos y trampas del próximo dado) e impacto económico
 * real de las casillas cooperativas para facilitar el balanceo del juego.
 */

import {
  BoardDangerZoneEntry,
  BoardDangerZoneTier,
  Character,
  DifficultyLevel,
  GameEngineState,
  GoodState,
  GoodType,
  SpeculatorTrajectory,
  Tile
} from '../types/game';
import {
  UNEXPECTED_CRISIS_TEMPLATES,
  doesCrisisAffectTile,
  getEffectiveResourceReward,
  getEffectiveUnlockCost
} from './crisisEngine';
import { computeCooperativeEfficiency } from './cooperativeEfficiency';
import { getReputationProfile } from './reputation';
import { doesWeatherEventAffectTile } from './weatherEvents';
import {
  getPlayerDiceDistribution,
  getSpeculatorTilePressureChance,
  resolveSpeculatorStepDistribution
} from './probabilitySandbox';

export type SpeculatorStepOutcome =
  | 'VULNERABLE_PLAYER'
  | 'MUTUAL_PROTECTION'
  | 'RESOURCE_TILE'
  | 'SPECIAL_TILE';

export interface SpeculatorPathStep {
  step: number;
  tileId: number;
  tileName: string;
  tileState?: GoodState;
  tileCategory: Tile['category'];
  hitProbabilityPct: number;
  outcome: SpeculatorStepOutcome;
  occupantNames: string[];
  supersededByPriorAttack: boolean;
}

export interface SpeculatorIntendedTarget {
  tileId: number;
  tileName: string;
  distance: number;
  reason:
    | 'IN_RANGE_ATTACK'
    | 'BLOCKED_MUTUAL_PROTECTION'
    | 'NEAREST_ISOLATED_CHASE'
    | 'EXPECTED_MIDPOINT';
  targetPlayerName?: string;
  targetPlayerWellness?: number;
  targetPlayerLegitimacy?: number;
  inCurrentRollRange: boolean;
  probabilityPct: number;
}

export interface SpeculatorThreatDetail {
  speculatorId: number;
  speculatorName: string;
  orderIndex: number;
  position: number;
  currentTileName: string;
  boardSideLabel: string;
  pathingLogicLabel: string;
  attackPriorityNote: string;
  priorAttackProbabilityPct: number;
  causesReboundBlockNow: boolean;
  vulnerableTargets: Array<{
    playerName: string;
    tileId: number;
    tileName: string;
    distance: number;
  }>;
  protectedTilesCount: number;
  hitChancePct: number;
  intendedTarget: SpeculatorIntendedTarget;
  candidateSteps: SpeculatorPathStep[];
  predictedTileRisks: Array<{
    tileId: number;
    tileName: string;
    distance: number;
    currentState: GoodState;
    riskAction: 'BUY' | 'VANDALIZE';
    actionChancePct: number;
  }>;
}

export interface DangerZoneHotspot {
  tileId: number;
  tileName: string;
  boardSideLabel: string;
  tier: BoardDangerZoneTier;
  intensity: number;
  hitChancePct: number;
  intendedByCount: number;
  summaryLabel: string;
}

export interface SpeculationProbabilityMetrics {
  difficulty: DifficultyLevel;
  speculatorsCount: number;
  /** Probabilidad combinada (0-100) de que >= 1 especulador alcance a una jugadora sin protección mutua */
  roundAttackHitChancePct: number;
  /** Probabilidad condicionada de detención si impacta (25% / 32% / 38%) */
  detentionOnHitPct: number;
  /** Probabilidad neta de sufrir una detención este fin de ronda */
  roundDetentionRiskPct: number;
  /** Probabilidad neta de robo de Bienestar o Legitimidad (1-4 pts) este fin de ronda */
  roundStealRiskPct: number;
  /** Casillas al alcance 1..6 protegidas por 2+ jugadoras juntas */
  mutualProtectionZones: number;
  /** Detalle por especulador activo */
  speculatorThreats: SpeculatorThreatDetail[];
  /** Probabilidad de Crisis Inesperada en el próximo turno (0-100) */
  crisisTriggerChancePct: number;
  crisisCooldownCurrent: number;
  crisisCooldownRequired: number;
  crisisNegativeSharePct: number;
  activeCrisisTurnsLeft: number;
  /** Probabilidad de Evento Meteorológico Dinámico en el próximo turno (0-100) */
  weatherTriggerChancePct: number;
  weatherFrequencyMultiplier: number;
  weatherCooldownCurrent: number;
  weatherCooldownRequired: number;
  activeWeatherTurnsLeft: number;
  /** Probabilidad (0-100) en el próximo dado 1d6 del jugador activo de caer en trampa / Tragedia */
  nextRollTragedyRiskPct: number;
  nextRollBankOrDetentionRiskPct: number;
  /** Mapa rápido tileId -> probabilidad (%) de paso de al menos un especulador */
  tileSpeculatorHitChanceMap: Record<number, number>;
  /** Mapa de calor 3D de zonas de peligro por concentración e intenciones objetivo */
  dangerHeatmapMap: Record<number, BoardDangerZoneEntry>;
  /** Top de casillas críticas o protegidas ordenadas por concentración de peligro */
  dangerHotspots: DangerZoneHotspot[];
  /** Trayectorias de movimiento 3D de cada bot especulador hacia su casilla objetivo */
  speculatorTrajectories: SpeculatorTrajectory[];
}

export interface FamilyEconomySummary {
  goodType: GoodType;
  label: string;
  totalTiles: number;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  avgUnlockCost: number;
  avgCommonWellnessYield: number;
  avgCommonLegitimacyYield: number;
  avgPublicPassYield: number;
  avgPaybackVisits: number;
  crisisCostDelta: number;
  weatherAffectedTiles: number;
}

export interface CooperativeTileEconomyRow {
  tileId: number;
  name: string;
  category: Tile['category'];
  goodType?: GoodType;
  state: GoodState;
  baseUnlockCost: number;
  effectiveUnlockCost: number;
  skillDiscount: number;
  crisisCostDelta: number;
  weatherCostDelta: number;
  reputationCostDelta: number;
  characterBonusDelta: number;
  currentWellnessYield: number;
  currentLegitimacyYield: number;
  projectedCommonWellness: number;
  projectedCommonLegitimacy: number;
  paybackVisits: number;
  /** Puntuación sintética de valor económico neto para ordenar/balancear */
  netEconomicImpact: number;
  speculatorThreatPct: number;
  affectedByCrisis: boolean;
  affectedByWeather: boolean;
}

export interface EconomyBalanceSummary {
  efficiencyPct: number;
  boardRecoveryPct: number;
  teamSynergyPct: number;
  tierLabel: string;
  totalLegitimacy: number;
  requiredLegitimacy: number;
  legitimacyProgressPct: number;
  avgPlayerWellness: number;
  avgPlayerReputation: number;
  activePlayerName: string;
  activePlayerRepDelta: number;
  activePlayerVoteWeight: number;
  transformableTilesCount: number;
  inalienableTilesCount: number;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  avgTransformUnlockCost: number;
  expectedRoundCommonYield: number;
  expectedRoundPublicYield: number;
  crisisAffectedTilesCount: number;
  weatherAffectedTilesCount: number;
}

export interface EconomyDebugSnapshot {
  speculation: SpeculationProbabilityMetrics;
  economySummary: EconomyBalanceSummary;
  familySummaries: FamilyEconomySummary[];
  tileRows: CooperativeTileEconomyRow[];
}

const GOOD_TYPE_LABELS: Record<GoodType, string> = {
  HEALTH: 'Salud',
  URBAN: 'Urbanismo',
  KNOWLEDGE: 'Conocimiento',
  ENVIRONMENT: 'Medioambiente'
};

function getDetentionChancePctForDifficulty(difficulty: DifficultyLevel): number {
  if (difficulty === 'MAD_MAX') return 25;
  if (difficulty === 'COMUNLANDIA') return 38;
  return 32;
}

function getBoardSideLabel(tileId: number): string {
  if (tileId >= 0 && tileId <= 9) return 'Lado Sur';
  if (tileId >= 10 && tileId <= 19) return 'Lado Este';
  if (tileId >= 20 && tileId <= 29) return 'Lado Norte';
  return 'Lado Oeste';
}

export const SPECULATOR_TRAJECTORY_COLORS = [
  { hex: 0xf43f5e, css: '#f43f5e' }, // Bot 1: Rose / Carmesí
  { hex: 0xf97316, css: '#f97316' }, // Bot 2: Orange / Naranja
  { hex: 0xa855f7, css: '#a855f7' }, // Bot 3: Purple / Púrpura
  { hex: 0x06b6d4, css: '#06b6d4' }, // Bot 4: Cyan / Turquesa
  { hex: 0xeab308, css: '#eab308' }, // Bot 5: Amber / Amarillo
  { hex: 0xec4899, css: '#ec4899' }  // Bot 6: Pink / Rosa
];

export function buildClockwisePath(fromTileId: number, toTileId: number): number[] {
  if (fromTileId === toTileId) return [fromTileId];
  const path: number[] = [fromTileId];
  let curr = fromTileId;
  const maxSteps = (toTileId - fromTileId + 40) % 40;
  for (let s = 1; s <= maxSteps; s++) {
    curr = (curr + 1) % 40;
    path.push(curr);
  }
  return path;
}

interface SpeculatorRoutingAnalysis {
  speculatorThreats: SpeculatorThreatDetail[];
  tileSpeculatorHitChanceMap: Record<number, number>;
  mutualProtectionZones: number;
  noSpeculatorAttackProb: number;
  dangerHeatmapMap: Record<number, BoardDangerZoneEntry>;
  dangerHotspots: DangerZoneHotspot[];
  speculatorTrajectories: SpeculatorTrajectory[];
}

function buildDangerHeatmap(
  tiles: Tile[],
  speculatorThreats: SpeculatorThreatDetail[],
  tileSpeculatorHitChanceMap: Record<number, number>
): {
  dangerHeatmapMap: Record<number, BoardDangerZoneEntry>;
  dangerHotspots: DangerZoneHotspot[];
} {
  const dangerHeatmapMap: Record<number, BoardDangerZoneEntry> = {};
  const dangerHotspots: DangerZoneHotspot[] = [];

  const candidateTileIds = new Set<number>();
  for (let id = 0; id < 40; id++) {
    candidateTileIds.add(id);
  }
  speculatorThreats.forEach(spec => {
    candidateTileIds.add(spec.intendedTarget.tileId);
  });

  candidateTileIds.forEach(tileId => {
    const hitChancePct = tileSpeculatorHitChanceMap[tileId] ?? 0;

    let inRangeAttackSteps = 0;
    let mutualProtectionBlocked = false;
    speculatorThreats.forEach(spec => {
      spec.candidateSteps.forEach(step => {
        if (step.tileId === tileId) {
          if (step.outcome === 'VULNERABLE_PLAYER') inRangeAttackSteps += 1;
          if (step.outcome === 'MUTUAL_PROTECTION') mutualProtectionBlocked = true;
        }
      });
    });

    const intendingSpecs = speculatorThreats.filter(
      spec => spec.intendedTarget.tileId === tileId
    );
    const intendedByCount = intendingSpecs.length;
    const isIntendedTarget = intendedByCount > 0;

    if (hitChancePct === 0 && !isIntendedTarget) {
      return;
    }

    const inRangeAttackIntendedCount = intendingSpecs.filter(
      s => s.intendedTarget.reason === 'IN_RANGE_ATTACK'
    ).length;
    const chaseOrMidpointIntendedCount = intendingSpecs.filter(
      s =>
        s.intendedTarget.reason === 'NEAREST_ISOLATED_CHASE' ||
        s.intendedTarget.reason === 'EXPECTED_MIDPOINT'
    ).length;

    const coverageScore = Math.min(0.65, (hitChancePct / 16.7) * 0.25);
    const intentionScore =
      inRangeAttackIntendedCount * 0.45 +
      chaseOrMidpointIntendedCount * 0.26 +
      Math.max(0, inRangeAttackSteps - inRangeAttackIntendedCount) * 0.22;

    let tier: BoardDangerZoneTier;
    let intensity: number;

    if (mutualProtectionBlocked && inRangeAttackSteps === 0) {
      tier = 'PROTECTED';
      intensity = Number(Math.min(0.65, Math.max(0.25, coverageScore)).toFixed(2));
    } else {
      intensity = Number(Math.min(1, Math.max(0.18, coverageScore + intentionScore)).toFixed(2));
      if (inRangeAttackSteps > 0 || intensity >= 0.72) {
        tier = 'CRITICAL';
      } else if (intensity >= 0.42 || intendedByCount > 0) {
        tier = 'HIGH';
      } else {
        tier = 'MODERATE';
      }
    }

    dangerHeatmapMap[tileId] = {
      tileId,
      intensity,
      tier,
      isIntendedTarget,
      hitChancePct,
      intendedByCount
    };

    const tile = tiles.find(t => t.id === tileId);
    const tileName = tile?.name ?? `Casilla ${tileId}`;
    let summaryLabel = 'Paso probable 1d6';
    if (tier === 'PROTECTED') {
      summaryLabel = 'Protegida (2+ fichas)';
    } else if (inRangeAttackIntendedCount > 0) {
      summaryLabel = `Objetivo de ataque (${inRangeAttackIntendedCount} ${
        inRangeAttackIntendedCount > 1 ? 'bots' : 'bot'
      })`;
    } else if (inRangeAttackSteps > 0) {
      summaryLabel = 'Jugadora aislada al alcance 1d6';
    } else if (chaseOrMidpointIntendedCount > 0) {
      summaryLabel = `Ruta prevista (${chaseOrMidpointIntendedCount} ${
        chaseOrMidpointIntendedCount > 1 ? 'bots' : 'bot'
      })`;
    } else if (hitChancePct >= 30) {
      summaryLabel = 'Cruce de rutas 1d6';
    }

    dangerHotspots.push({
      tileId,
      tileName,
      boardSideLabel: getBoardSideLabel(tileId),
      tier,
      intensity,
      hitChancePct,
      intendedByCount,
      summaryLabel
    });
  });

  dangerHotspots.sort((a, b) => {
    const aHazard = a.tier === 'PROTECTED' ? 0 : 1;
    const bHazard = b.tier === 'PROTECTED' ? 0 : 1;
    if (bHazard !== aHazard) return bHazard - aHazard;
    if (b.intensity !== a.intensity) return b.intensity - a.intensity;
    if (b.intendedByCount !== a.intendedByCount) return b.intendedByCount - a.intendedByCount;
    return b.hitChancePct - a.hitChancePct || a.tileId - b.tileId;
  });

  return {
    dangerHeatmapMap,
    dangerHotspots: dangerHotspots.slice(0, 8)
  };
}

function analyzeSpeculatorRouting(state: GameEngineState): SpeculatorRoutingAnalysis {
  // 1. Probabilidades exactas por casilla y patrones de movimiento por especulador (1d6 horario mod 40)
  const tileNonHitProb: Record<number, number> = {};
  let mutualProtectionZones = 0;
  let noSpeculatorAttackProb = 1;
  let priorSpeculatorHitProb = 0;

  const speculatorThreats: SpeculatorThreatDetail[] = state.speculators.map((spec, sIdx) => {
    const stepDist = resolveSpeculatorStepDistribution(
      spec.position,
      state.players,
      state.probabilitySandbox,
      spec.id
    );
    const isFrozen = stepDist.deterministicStep === 0;
    const difficulty: DifficultyLevel = state.setupConfig?.difficulty ?? 'EN_TRANSICION';
    const tilePressureProb = getSpeculatorTilePressureChance(
      difficulty,
      state.probabilitySandbox,
      spec.id
    );
    const vulnerableTargets: SpeculatorThreatDetail['vulnerableTargets'] = [];
    const candidateSteps: SpeculatorPathStep[] = [];
    const predictedTileRisks: SpeculatorThreatDetail['predictedTileRisks'] = [];
    let protectedTilesCount = 0;
    let specHitChance = 0;
    let firstProtectedTarget: {
      tileId: number;
      tileName: string;
      distance: number;
      names: string[];
      probPct: number;
    } | null = null;
    let bestVulnerableTarget: {
      playerName: string;
      tileId: number;
      tileName: string;
      distance: number;
      prob: number;
    } | null = null;

    const currentTile = state.tiles.find(t => t.id === spec.position);
    const currentOccupantsCount =
      state.players.filter(p => !p.inAgora && p.position === spec.position).length +
      state.speculators.filter(s => s.position === spec.position).length;

    for (let step = 1; step <= 6; step++) {
      const targetPos = (spec.position + step) % 40;
      const stepProb = isFrozen ? 0 : (stepDist.stepProbs[step] ?? 0);
      if (stepProb > 0) {
        tileNonHitProb[targetPos] = (tileNonHitProb[targetPos] ?? 1) * (1 - stepProb);
      }

      const tile = state.tiles.find(t => t.id === targetPos);
      const tileName = tile?.name ?? `Casilla ${targetPos}`;
      const playersOnTile = state.players.filter(p => !p.inAgora && p.position === targetPos);
      const occupantNames = playersOnTile.map(p => p.name);

      let outcome: SpeculatorStepOutcome =
        tile?.category === 'RESOURCE' ||
        tile?.category === 'AGORA_ENTRY' ||
        tile?.category === 'INALIENABLE_COMMON'
          ? 'RESOURCE_TILE'
          : 'SPECIAL_TILE';

      if (playersOnTile.length >= 2) {
        if (stepProb > 0) {
          protectedTilesCount += 1;
        }
        outcome = 'MUTUAL_PROTECTION';
        if (stepProb > 0 && (!firstProtectedTarget || stepProb > firstProtectedTarget.probPct / 100)) {
          firstProtectedTarget = {
            tileId: targetPos,
            tileName,
            distance: step,
            names: occupantNames,
            probPct: Math.round(stepProb * 1000) / 10
          };
        }
      } else if (playersOnTile.length === 1) {
        const victim = playersOnTile[0];
        outcome = 'VULNERABLE_PLAYER';
        if (stepProb > 0) {
          specHitChance += stepProb;
          vulnerableTargets.push({
            playerName: victim.name,
            tileId: targetPos,
            tileName,
            distance: step
          });
          if (!bestVulnerableTarget || stepProb > bestVulnerableTarget.prob) {
            bestVulnerableTarget = {
              playerName: victim.name,
              tileId: targetPos,
              tileName,
              distance: step,
              prob: stepProb
            };
          }
        }
      }

      if (
        stepProb > 0 &&
        playersOnTile.length === 0 &&
        tile &&
        (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') &&
        (tile.state === 'COMMON' || tile.state === 'PUBLIC')
      ) {
        const riskAction: 'BUY' | 'VANDALIZE' = tile.state === 'PUBLIC' ? 'BUY' : 'VANDALIZE';
        const actionChancePct = Math.round(stepProb * tilePressureProb * 1000) / 10;
        if (actionChancePct > 0) {
          predictedTileRisks.push({
            tileId: targetPos,
            tileName,
            distance: step,
            currentState: tile.state,
            riskAction,
            actionChancePct
          });
        }
      }

      candidateSteps.push({
        step,
        tileId: targetPos,
        tileName,
        tileState: tile?.state,
        tileCategory: tile?.category ?? 'SPECIAL',
        hitProbabilityPct: Math.round(stepProb * 1000) / 10,
        outcome,
        occupantNames,
        supersededByPriorAttack:
          stepProb > 0 && outcome === 'VULNERABLE_PLAYER' && priorSpeculatorHitProb > 0
      });
    }

    // Buscar objetivo aislado más cercano más allá del rango inmediato (+7..+39)
    let nearestIsolatedBeyond: {
      player: Character;
      tileId: number;
      tileName: string;
      distance: number;
    } | null = null;
    if (!isFrozen && vulnerableTargets.length === 0) {
      for (let dist = 7; dist < 40; dist++) {
        const lookPos = (spec.position + dist) % 40;
        const playersHere = state.players.filter(p => !p.inAgora && p.position === lookPos);
        if (playersHere.length === 1) {
          const tile = state.tiles.find(t => t.id === lookPos);
          nearestIsolatedBeyond = {
            player: playersHere[0],
            tileId: lookPos,
            tileName: tile?.name ?? `Casilla ${lookPos}`,
            distance: dist
          };
          break;
        }
      }
    }

    let intendedTarget: SpeculatorIntendedTarget;
    if (isFrozen) {
      intendedTarget = {
        tileId: spec.position,
        tileName: currentTile?.name ?? `Casilla ${spec.position}`,
        distance: 0,
        reason: 'EXPECTED_MIDPOINT',
        inCurrentRollRange: false,
        probabilityPct: 0
      };
    } else if (bestVulnerableTarget) {
      const victimPlayer = state.players.find(p => p.name === bestVulnerableTarget.playerName);
      intendedTarget = {
        tileId: bestVulnerableTarget.tileId,
        tileName: bestVulnerableTarget.tileName,
        distance: bestVulnerableTarget.distance,
        reason: 'IN_RANGE_ATTACK',
        targetPlayerName: bestVulnerableTarget.playerName,
        targetPlayerWellness: victimPlayer?.wellness,
        targetPlayerLegitimacy: victimPlayer?.legitimacy,
        inCurrentRollRange: true,
        probabilityPct: Math.round(bestVulnerableTarget.prob * 1000) / 10
      };
    } else if (firstProtectedTarget) {
      intendedTarget = {
        tileId: firstProtectedTarget.tileId,
        tileName: firstProtectedTarget.tileName,
        distance: firstProtectedTarget.distance,
        reason: 'BLOCKED_MUTUAL_PROTECTION',
        targetPlayerName: firstProtectedTarget.names.join(' + '),
        inCurrentRollRange: true,
        probabilityPct: firstProtectedTarget.probPct
      };
    } else if (nearestIsolatedBeyond) {
      intendedTarget = {
        tileId: nearestIsolatedBeyond.tileId,
        tileName: nearestIsolatedBeyond.tileName,
        distance: nearestIsolatedBeyond.distance,
        reason: 'NEAREST_ISOLATED_CHASE',
        targetPlayerName: nearestIsolatedBeyond.player.name,
        targetPlayerWellness: nearestIsolatedBeyond.player.wellness,
        targetPlayerLegitimacy: nearestIsolatedBeyond.player.legitimacy,
        inCurrentRollRange: false,
        probabilityPct: 0
      };
    } else {
      const expectedStep =
        stepDist.deterministicStep !== null
          ? stepDist.deterministicStep
          : state.probabilitySandbox?.enabled &&
            state.probabilitySandbox.speculatorMovementLogic === 'AGGRESSIVE_MAX'
          ? 6
          : 3;
      const midpointId = (spec.position + expectedStep) % 40;
      const midpointTile = state.tiles.find(t => t.id === midpointId);
      intendedTarget = {
        tileId: midpointId,
        tileName: midpointTile?.name ?? `Casilla ${midpointId}`,
        distance: expectedStep,
        reason: 'EXPECTED_MIDPOINT',
        inCurrentRollRange: true,
        probabilityPct: Math.round((stepDist.stepProbs[expectedStep] ?? 0) * 1000) / 10
      };
    }

    mutualProtectionZones += protectedTilesCount;
    const hitChance = Math.min(1, specHitChance);
    noSpeculatorAttackProb *= 1 - hitChance;

    const priorPct = Math.round(priorSpeculatorHitProb * 1000) / 10;
    const attackPriorityNote =
      isFrozen
        ? 'Congelado por Probability Sandbox (sin ataque)'
        : sIdx === 0
        ? 'Orden #1 · Evalúa ataque primero (sin bloqueo previo)'
        : priorPct > 0
        ? `Orden #${sIdx + 1} · Supeditado si bot previo impacta (${priorPct}% bloqueo)`
        : `Orden #${sIdx + 1} · Activo (bots previos sin objetivo en 1d6)`;

    priorSpeculatorHitProb = 1 - (1 - priorSpeculatorHitProb) * (1 - hitChance);

    return {
      speculatorId: spec.id,
      speculatorName: spec.name,
      orderIndex: sIdx + 1,
      position: spec.position,
      currentTileName: currentTile?.name ?? `Casilla ${spec.position}`,
      boardSideLabel: getBoardSideLabel(spec.position),
      pathingLogicLabel: stepDist.logicLabel,
      attackPriorityNote,
      priorAttackProbabilityPct: priorPct,
      causesReboundBlockNow: currentOccupantsCount >= 2,
      vulnerableTargets,
      protectedTilesCount,
      hitChancePct: Math.round(hitChance * 1000) / 10,
      intendedTarget,
      candidateSteps,
      predictedTileRisks
    };
  });

  const tileSpeculatorHitChanceMap: Record<number, number> = {};
  for (const [tileIdStr, nonHit] of Object.entries(tileNonHitProb)) {
    const tid = Number(tileIdStr);
    tileSpeculatorHitChanceMap[tid] = Math.round((1 - nonHit) * 1000) / 10;
  }

  const { dangerHeatmapMap, dangerHotspots } = buildDangerHeatmap(
    state.tiles,
    speculatorThreats,
    tileSpeculatorHitChanceMap
  );

  const speculatorTrajectories: SpeculatorTrajectory[] = speculatorThreats.map((threat, idx) => {
    const palette = SPECULATOR_TRAJECTORY_COLORS[idx % SPECULATOR_TRAJECTORY_COLORS.length];
    const pathTileIds = buildClockwisePath(threat.position, threat.intendedTarget.tileId);
    return {
      speculatorId: threat.speculatorId,
      speculatorName: threat.speculatorName,
      orderIndex: threat.orderIndex,
      fromTileId: threat.position,
      toTileId: threat.intendedTarget.tileId,
      distance: threat.intendedTarget.distance,
      reason: threat.intendedTarget.reason,
      inCurrentRollRange: threat.intendedTarget.inCurrentRollRange,
      targetPlayerName: threat.intendedTarget.targetPlayerName,
      color: palette.css,
      colorHex: palette.hex,
      pathTileIds
    };
  });

  return {
    speculatorThreats,
    tileSpeculatorHitChanceMap,
    mutualProtectionZones,
    noSpeculatorAttackProb,
    dangerHeatmapMap,
    dangerHotspots,
    speculatorTrajectories
  };
}

export function computeSpeculatorDangerHeatmap(
  state: GameEngineState
): Record<number, BoardDangerZoneEntry> {
  return analyzeSpeculatorRouting(state).dangerHeatmapMap;
}

export function computeSpeculatorTrajectories(
  state: GameEngineState
): SpeculatorTrajectory[] {
  return analyzeSpeculatorRouting(state).speculatorTrajectories;
}

export function computeEconomyDebugSnapshot(state: GameEngineState): EconomyDebugSnapshot {
  const difficulty: DifficultyLevel = state.setupConfig?.difficulty ?? 'EN_TRANSICION';
  const activePlayer: Character | undefined =
    state.players[state.activePlayerIndex] ?? state.players[0];

  const {
    speculatorThreats,
    tileSpeculatorHitChanceMap,
    mutualProtectionZones,
    noSpeculatorAttackProb,
    dangerHeatmapMap,
    dangerHotspots,
    speculatorTrajectories
  } = analyzeSpeculatorRouting(state);

  const roundAttackHitChancePct =
    state.speculators.length > 0 ? Math.round((1 - noSpeculatorAttackProb) * 1000) / 10 : 0;
  const detentionOnHitPct =
    state.probabilitySandbox?.enabled &&
    state.probabilitySandbox.detentionChanceOverridePct !== null
      ? Math.max(0, Math.min(100, state.probabilitySandbox.detentionChanceOverridePct))
      : getDetentionChancePctForDifficulty(difficulty);
  const roundDetentionRiskPct =
    Math.round(roundAttackHitChancePct * (detentionOnHitPct / 100) * 10) / 10;
  const roundStealRiskPct =
    Math.round(roundAttackHitChancePct * ((100 - detentionOnHitPct) / 100) * 10) / 10;

  // 2. Probabilidad de Crisis Inesperada en el próximo turno (crisisEngine.ts)
  const crisisCooldownRequired = 3;
  const crisisCooldownCurrent = state.turnsSinceLastCrisis ?? 0;
  let crisisTriggerChancePct = 0;
  if (!state.activeCrisis) {
    const nextCooldown = crisisCooldownCurrent + 1;
    if (nextCooldown >= crisisCooldownRequired) {
      crisisTriggerChancePct = Math.round(
        Math.min(0.28, 0.16 + (nextCooldown - crisisCooldownRequired) * 0.03) * 1000
      ) / 10;
    }
  }
  const negativeTemplatesCount = UNEXPECTED_CRISIS_TEMPLATES.filter(
    t => t.severity !== 'OPPORTUNITY'
  ).length;
  const crisisNegativeSharePct = Math.round(
    (negativeTemplatesCount / Math.max(1, UNEXPECTED_CRISIS_TEMPLATES.length)) * 100
  );

  // 3. Probabilidad de Evento Climático Dinámico (weatherEvents.ts)
  const weatherFreqMult = Math.max(
    0,
    Math.min(2.0, state.weatherAdvancedConfig?.eventFrequencyMultiplier ?? 1.0)
  );
  const weatherCooldownRequired = Math.max(
    1,
    Math.min(6, Math.round(state.weatherAdvancedConfig?.minCooldownTurns ?? 2))
  );
  const weatherCooldownCurrent = state.turnsSinceLastWeatherEvent ?? 0;
  let weatherTriggerChancePct = 0;
  if (!state.activeWeatherEvent && weatherFreqMult > 0) {
    const nextWeatherCooldown = weatherCooldownCurrent + 1;
    if (nextWeatherCooldown >= weatherCooldownRequired) {
      const baseProb = Math.min(
        0.46,
        0.28 + (nextWeatherCooldown - weatherCooldownRequired) * 0.045
      );
      weatherTriggerChancePct = Math.round(Math.min(0.92, baseProb * weatherFreqMult) * 1000) / 10;
    }
  }

  // 4. Riesgo del próximo dado 1d6 del jugador activo (ponderado por Sandbox si está activo)
  const playerDiceWeights = getPlayerDiceDistribution(state.probabilitySandbox);
  let tragedyProb = 0;
  let bankOrDetentionProb = 0;
  if (activePlayer && !activePlayer.inAgora && !activePlayer.isDetained) {
    for (let roll = 1; roll <= 6; roll++) {
      const dest = (activePlayer.position + roll) % 40;
      const destTile = state.tiles.find(t => t.id === dest);
      const w = playerDiceWeights[roll - 1] ?? (1 / 6);
      if (destTile?.specialType === 'TRAGEDY_OF_COMMONS') {
        tragedyProb += w;
      } else if (
        destTile?.specialType === 'BANK' ||
        destTile?.specialType === 'DETENTION_CENTER' ||
        destTile?.specialType === 'CASINO'
      ) {
        bankOrDetentionProb += w;
      }
    }
  }
  const nextRollTragedyRiskPct = Math.round(tragedyProb * 1000) / 10;
  const nextRollBankOrDetentionRiskPct = Math.round(bankOrDetentionProb * 1000) / 10;

  // 5. Economía real de cada tile cooperativa
  const cooperativeTiles = state.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY' || t.category === 'INALIENABLE_COMMON'
  );

  let crisisAffectedTilesCount = 0;
  let weatherAffectedTilesCount = 0;

  const tileRows: CooperativeTileEconomyRow[] = cooperativeTiles.map(tile => {
    const tileState: GoodState = tile.state ?? 'PRIVATE';
    const isInalienable = tile.category === 'INALIENABLE_COMMON';
    const costInfo = getEffectiveUnlockCost(
      tile,
      activePlayer,
      state.activeCrisis,
      state.activeWeatherEvent,
      state.rulesetMode
    );

    const commonReward = getEffectiveResourceReward(
      tile,
      2,
      2,
      state.activeCrisis,
      activePlayer,
      state.activeWeatherEvent,
      state.rulesetMode
    );
    const publicPassReward = getEffectiveResourceReward(
      tile,
      1,
      1,
      state.activeCrisis,
      activePlayer,
      state.activeWeatherEvent,
      state.rulesetMode
    );

    const affectedByCrisis = doesCrisisAffectTile(tile, state.activeCrisis);
    const affectedByWeather = doesWeatherEventAffectTile(tile, state.activeWeatherEvent);
    if (affectedByCrisis) crisisAffectedTilesCount += 1;
    if (affectedByWeather) weatherAffectedTilesCount += 1;

    const currentWellnessYield = isInalienable
      ? 2
      : tileState === 'COMMON'
      ? commonReward.wellness
      : tileState === 'PUBLIC'
      ? publicPassReward.wellness
      : 0;
    const currentLegitimacyYield = isInalienable
      ? 2
      : tileState === 'COMMON'
      ? commonReward.legitimacy
      : tileState === 'PUBLIC'
      ? publicPassReward.legitimacy
      : 0;

    const effectiveUnlockCost = isInalienable ? 0 : costInfo.effectiveCost;
    const paybackVisits = isInalienable
      ? 0
      : Number((effectiveUnlockCost / Math.max(1, commonReward.wellness)).toFixed(1));

    const speculatorThreatPct = tileSpeculatorHitChanceMap[tile.id] ?? 0;

    // Puntuación neta de impacto económico: retorno combinado en Común + ventaja de estado actual - coste desbloqueo
    const stateValue = isInalienable ? 4 : tileState === 'COMMON' ? 3 : tileState === 'PUBLIC' ? 1.5 : 0;
    const netEconomicImpact = Number(
      (
        commonReward.wellness +
        commonReward.legitimacy * 1.15 +
        stateValue -
        effectiveUnlockCost * 0.45
      ).toFixed(1)
    );

    return {
      tileId: tile.id,
      name: tile.name,
      category: tile.category,
      goodType: tile.goodType,
      state: tileState,
      baseUnlockCost: isInalienable ? 0 : costInfo.baseCost,
      effectiveUnlockCost,
      skillDiscount: isInalienable ? 0 : costInfo.skillPoints,
      crisisCostDelta: isInalienable ? 0 : costInfo.crisisDelta,
      weatherCostDelta: isInalienable ? 0 : costInfo.weatherDelta,
      reputationCostDelta: isInalienable ? 0 : costInfo.reputationDelta,
      characterBonusDelta: isInalienable ? 0 : costInfo.characterBonusDelta,
      currentWellnessYield,
      currentLegitimacyYield,
      projectedCommonWellness: isInalienable ? 2 : commonReward.wellness,
      projectedCommonLegitimacy: isInalienable ? 2 : commonReward.legitimacy,
      paybackVisits,
      netEconomicImpact,
      speculatorThreatPct,
      affectedByCrisis,
      affectedByWeather
    };
  });

  // 6. Resumen por familia de bienes
  const families: GoodType[] = ['HEALTH', 'URBAN', 'KNOWLEDGE', 'ENVIRONMENT'];
  const familySummaries: FamilyEconomySummary[] = families.map(goodType => {
    const rows = tileRows.filter(r => r.goodType === goodType);
    const total = Math.max(1, rows.length);
    const commonCount = rows.filter(r => r.state === 'COMMON').length;
    const publicCount = rows.filter(r => r.state === 'PUBLIC').length;
    const privateCount = rows.filter(r => r.state === 'PRIVATE').length;

    const avgUnlockCost = Number(
      (rows.reduce((sum, r) => sum + r.effectiveUnlockCost, 0) / total).toFixed(1)
    );
    const avgCommonWellnessYield = Number(
      (rows.reduce((sum, r) => sum + r.projectedCommonWellness, 0) / total).toFixed(1)
    );
    const avgCommonLegitimacyYield = Number(
      (rows.reduce((sum, r) => sum + r.projectedCommonLegitimacy, 0) / total).toFixed(1)
    );
    const avgPublicPassYield = Number(
      (
        rows.reduce((sum, r) => {
          const tile = state.tiles.find(t => t.id === r.tileId);
          const pub = getEffectiveResourceReward(
            tile,
            1,
            1,
            state.activeCrisis,
            activePlayer,
            state.activeWeatherEvent,
            state.rulesetMode
          );
          return sum + pub.wellness + pub.legitimacy;
        }, 0) / total
      ).toFixed(1)
    );
    const avgPaybackVisits = Number(
      (rows.reduce((sum, r) => sum + r.paybackVisits, 0) / total).toFixed(1)
    );

    return {
      goodType,
      label: GOOD_TYPE_LABELS[goodType],
      totalTiles: rows.length,
      commonCount,
      publicCount,
      privateCount,
      avgUnlockCost,
      avgCommonWellnessYield,
      avgCommonLegitimacyYield,
      avgPublicPassYield,
      avgPaybackVisits,
      crisisCostDelta: rows[0]?.crisisCostDelta ?? 0,
      weatherAffectedTiles: rows.filter(r => r.affectedByWeather).length
    };
  });

  // 7. Resumen económico global
  const efficiency = computeCooperativeEfficiency(
    state.tiles,
    state.playerStats,
    state.round,
    state.gameResult
  );
  const transformableRows = tileRows.filter(r => r.category !== 'INALIENABLE_COMMON');
  const inalienableCount = tileRows.length - transformableRows.length;
  const avgTransformUnlockCost = Number(
    (
      transformableRows.reduce((sum, r) => sum + r.effectiveUnlockCost, 0) /
      Math.max(1, transformableRows.length)
    ).toFixed(1)
  );

  // Probabilidad empírica aproximada de retorno por aterrizaje en bienes Comunes vs Públicos
  const totalBoardTiles = 40;
  const commonPerimeterRows = tileRows.filter(
    r => r.tileId < 40 && r.state === 'COMMON'
  );
  const publicPerimeterRows = tileRows.filter(
    r => r.tileId < 40 && r.state === 'PUBLIC'
  );
  const playerFactor = Math.max(1, state.players.length);
  const expectedRoundCommonYield = Number(
    (
      (commonPerimeterRows.reduce(
        (sum, r) => sum + r.currentWellnessYield + r.currentLegitimacyYield,
        0
      ) /
        totalBoardTiles) *
      playerFactor
    ).toFixed(2)
  );
  const expectedRoundPublicYield = Number(
    (
      (publicPerimeterRows.reduce(
        (sum, r) => sum + r.currentWellnessYield + r.currentLegitimacyYield,
        0
      ) /
        totalBoardTiles) *
      playerFactor
    ).toFixed(2)
  );

  const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
  const requiredLegitimacy = Math.max(1, state.players.length * 10);
  const legitimacyProgressPct = Math.min(
    100,
    Math.round((totalLegitimacy / requiredLegitimacy) * 100)
  );
  const avgPlayerWellness = Number(
    (
      state.players.reduce((sum, p) => sum + p.wellness, 0) / Math.max(1, state.players.length)
    ).toFixed(1)
  );
  const avgPlayerReputation = Number(
    (
      state.players.reduce((sum, p) => sum + getReputationProfile(p).score, 0) /
      Math.max(1, state.players.length)
    ).toFixed(1)
  );
  const activeRepProfile = getReputationProfile(activePlayer);

  return {
    speculation: {
      difficulty,
      speculatorsCount: state.speculators.length,
      roundAttackHitChancePct,
      detentionOnHitPct,
      roundDetentionRiskPct,
      roundStealRiskPct,
      mutualProtectionZones,
      speculatorThreats,
      crisisTriggerChancePct,
      crisisCooldownCurrent,
      crisisCooldownRequired,
      crisisNegativeSharePct,
      activeCrisisTurnsLeft: state.activeCrisis?.turnsRemaining ?? 0,
      weatherTriggerChancePct,
      weatherFrequencyMultiplier: weatherFreqMult,
      weatherCooldownCurrent,
      weatherCooldownRequired,
      activeWeatherTurnsLeft: state.activeWeatherEvent?.turnsRemaining ?? 0,
      nextRollTragedyRiskPct,
      nextRollBankOrDetentionRiskPct,
      tileSpeculatorHitChanceMap,
      dangerHeatmapMap,
      dangerHotspots,
      speculatorTrajectories
    },
    economySummary: {
      efficiencyPct: efficiency.efficiencyPct,
      boardRecoveryPct: efficiency.boardRecoveryPct,
      teamSynergyPct: efficiency.teamSynergyPct,
      tierLabel: efficiency.tierLabel,
      totalLegitimacy,
      requiredLegitimacy,
      legitimacyProgressPct,
      avgPlayerWellness,
      avgPlayerReputation,
      activePlayerName: activePlayer?.name ?? 'Jugadora',
      activePlayerRepDelta: activeRepProfile.transactionCostDelta,
      activePlayerVoteWeight: activeRepProfile.voteWeight,
      transformableTilesCount: transformableRows.length,
      inalienableTilesCount: inalienableCount,
      commonCount: efficiency.commonCount,
      publicCount: efficiency.publicCount,
      privateCount: efficiency.privateCount,
      avgTransformUnlockCost,
      expectedRoundCommonYield,
      expectedRoundPublicYield,
      crisisAffectedTilesCount,
      weatherAffectedTilesCount
    },
    familySummaries,
    tileRows
  };
}
