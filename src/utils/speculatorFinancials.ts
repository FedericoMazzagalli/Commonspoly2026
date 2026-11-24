/**
 * speculatorFinancials.ts
 * Cálculo determinista en tiempo real del valor neto de activos (NAV),
 * liquidez operativa y capacidad financiera para vandalizar/privatizar
 * de cada especulador activo, orientado a la planificación defensiva.
 */

import {
  DifficultyLevel,
  GameEngineState,
  GoodState,
  SpeculatorActionLogEntry
} from '../types/game';
import { getEffectiveUnlockCost } from './crisisEngine';
import { computeEconomyDebugSnapshot, SpeculatorThreatDetail } from './economyDebugMetrics';
import { getSpeculatorTilePressureChance } from './probabilitySandbox';

export type SpeculatorDefenseTier = 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'CONTAINED';

export interface SpeculatorFinancialProfile {
  speculatorId: number;
  speculatorName: string;
  speculatorColor: string;
  orderIndex: number;
  position: number;
  currentTileName: string;
  boardSideLabel: string;
  /** Valor total de casillas privatizadas atribuidas al especulador */
  tileAssetValue: number;
  /** Número de casillas directamente privatizadas + cuota proporcional de privadas en el tablero */
  directBuyoutsCount: number;
  directVandalismsCount: number;
  controlledPrivateTilesCount: number;
  /** Liquidez financiera disponible para financiar vandalismo, compras y sabotajes */
  liquidCapital: number;
  /** Valor Neto Total (Activos Privatizados + Liquidez Operativa) */
  netAssetValue: number;
  /** Coste financiero unitario estimado para vandalizar un Bien Común */
  vandalizeUnitCost: number;
  /** Coste financiero unitario estimado para comprar/privatizar un Bien Público */
  buyoutUnitCost: number;
  /** Cuántos actos de vandalismo puede costear con su liquidez actual */
  maxVandalismsAffordable: number;
  /** Cuántas compras especulativas puede costear con su liquidez actual */
  maxBuyoutsAffordable: number;
  /** Probabilidad base de ejecutar presión al aterrizar en casilla indefensa (0-100%) */
  landingPressurePct: number;
  /** Índice compuesto (0-100%) de capacidad financiera + amenaza inmediata */
  vandalismCapacityPct: number;
  /** Nivel de alerta para planificar la defensa */
  defenseTier: SpeculatorDefenseTier;
  /** Amenaza táctica en 1d6 procedente de economyDebugMetrics */
  threatDetail?: SpeculatorThreatDetail;
  /** Recomendación táctica concreta para neutralizar al especulador */
  defensePlan: string;
}

export interface SpeculatorFinancialDashboardSummary {
  totalNetAssetValue: number;
  totalLiquidCapital: number;
  totalTileAssetValue: number;
  totalVandalismsAffordable: number;
  maxCapacityPct: number;
  criticalCount: number;
  profiles: SpeculatorFinancialProfile[];
}

function getBaseCapitalByDifficulty(difficulty: DifficultyLevel): number {
  if (difficulty === 'MAD_MAX') return 14;
  if (difficulty === 'COMUNLANDIA') return 7;
  return 10;
}

function getUnitCostsByDifficulty(
  difficulty: DifficultyLevel,
  hasActiveNegativeCrisis: boolean
): { vandalizeUnitCost: number; buyoutUnitCost: number } {
  if (difficulty === 'MAD_MAX') {
    return {
      vandalizeUnitCost: hasActiveNegativeCrisis ? 2 : 3,
      buyoutUnitCost: hasActiveNegativeCrisis ? 4 : 5
    };
  }
  if (difficulty === 'COMUNLANDIA') {
    return {
      vandalizeUnitCost: 5,
      buyoutUnitCost: 8
    };
  }
  return {
    vandalizeUnitCost: hasActiveNegativeCrisis ? 3 : 4,
    buyoutUnitCost: hasActiveNegativeCrisis ? 5 : 6
  };
}

function getTileAssetValuation(state: GameEngineState, tileId: number): number {
  const tile = state.tiles.find(t => t.id === tileId);
  if (!tile) return 4;
  const activePlayer = state.players[state.activePlayerIndex] ?? state.players[0];
  if (!activePlayer) return 6;
  const effective = getEffectiveUnlockCost(
    tile,
    activePlayer,
    state.activeCrisis ?? null,
    state.activeWeatherEvent ?? null
  ).effectiveCost;
  // El valor de mercado especulativo de un bien privatizado escala con su coste de recuperación
  return Math.max(4, Math.round(effective * 1.15));
}

export function computeSpeculatorFinancialDashboard(
  state: GameEngineState
): SpeculatorFinancialDashboardSummary {
  const difficulty: DifficultyLevel = state.setupConfig?.difficulty ?? 'EN_TRANSICION';
  const snapshot = computeEconomyDebugSnapshot(state);
  const actionLogs: SpeculatorActionLogEntry[] = state.speculatorActionLogs ?? [];
  const activeCrisisNegative = Boolean(
    state.activeCrisis && state.activeCrisis.severity !== 'OPPORTUNITY'
  );

  const resourceTiles = state.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const privateTiles = resourceTiles.filter(t => (t.state ?? 'PRIVATE') === 'PRIVATE');
  const specCount = Math.max(1, state.speculators.length);

  // Casillas privadas sin dueño directo de especulador se reparten como cartera corporativa compartida
  const directOwnedIds = new Set(
    privateTiles
      .filter(t => t.transformedById && t.transformedById.startsWith('speculator_'))
      .map(t => t.id)
  );
  const unattributedPrivateTiles = privateTiles.filter(t => !directOwnedIds.has(t.id));
  const unattributedTotalValue = unattributedPrivateTiles.reduce(
    (acc, t) => acc + getTileAssetValuation(state, t.id),
    0
  );
  const sharedPortfolioCount = Math.round((unattributedPrivateTiles.length / specCount) * 10) / 10;
  const sharedPortfolioValue = Math.round(unattributedTotalValue / specCount);

  const baseCapital = getBaseCapitalByDifficulty(difficulty);
  const { vandalizeUnitCost, buyoutUnitCost } = getUnitCostsByDifficulty(
    difficulty,
    activeCrisisNegative
  );

  const profiles: SpeculatorFinancialProfile[] = state.speculators.map((spec, idx) => {
    const logsForSpec = actionLogs.filter(l => l.speculatorId === spec.id);
    const directBuyoutsCount = logsForSpec.filter(l => l.kind === 'BUY_TILE').length;
    const directVandalismsCount = logsForSpec.filter(l => l.kind === 'VANDALIZE_TILE').length;
    const lootedPoints = logsForSpec.reduce((acc, l) => {
      if (l.kind === 'ATTACK_PLAYER') return acc + (l.deltaPoints ?? 2);
      if (l.kind === 'DETAIN_PLAYER') return acc + (l.detentionRounds ?? 1) * 2;
      return acc;
    }, 0);
    const blockedCount = logsForSpec.filter(l => l.kind === 'BLOCKED').length;

    const directlyOwnedTiles = privateTiles.filter(
      t => t.transformedById === `speculator_${spec.id}`
    );
    const directAssetsValue = directlyOwnedTiles.reduce(
      (acc, t) => acc + getTileAssetValuation(state, t.id),
      0
    );

    const tileAssetValue = directAssetsValue + sharedPortfolioValue;
    const controlledPrivateTilesCount = Number(
      (directlyOwnedTiles.length + sharedPortfolioCount).toFixed(1)
    );

    // Liquidez: capital base + renta por activos + botín extraído + bonus por ronda - gasto en sabotajes/compras - desgaste por bloqueos
    const sandboxBehavior = state.probabilitySandbox?.enabled
      ? state.probabilitySandbox.speculatorBehaviors?.[spec.id]
      : undefined;
    const aggressivenessMultiplier = sandboxBehavior
      ? 0.65 + (sandboxBehavior.aggressivenessPct / 100) * 0.7
      : 1;

    const roundRentalIncome = Math.floor((state.round - 1) * 0.8) + directlyOwnedTiles.length * 2;
    const operationalExpenses = directBuyoutsCount * 3 + directVandalismsCount * 1 + blockedCount * 2;
    const rawLiquidity = Math.round(
      (baseCapital + roundRentalIncome + lootedPoints - operationalExpenses) * aggressivenessMultiplier
    );
    const liquidCapital = Math.max(0, rawLiquidity);
    const netAssetValue = tileAssetValue + liquidCapital;

    const maxVandalismsAffordable = Math.floor(liquidCapital / vandalizeUnitCost);
    const maxBuyoutsAffordable = Math.floor(liquidCapital / buyoutUnitCost);

    const landingPressureProb = getSpeculatorTilePressureChance(
      difficulty,
      state.probabilitySandbox,
      spec.id
    );
    const landingPressurePct = Math.round(landingPressureProb * 100);

    const threatDetail = snapshot.speculation.speculatorThreats.find(
      t => t.speculatorId === spec.id
    );
    const isFrozen =
      state.probabilitySandbox?.enabled &&
      state.probabilitySandbox.speculatorMovementLogic === 'FROZEN';

    const hasVulnerableTilesInRange = (threatDetail?.predictedTileRisks.length ?? 0) > 0;
    const playerAttackChance = threatDetail?.hitChancePct ?? 0;

    // Capacidad financiera para vandalizar (0..100%)
    const liquidityScore = Math.min(55, Math.round((liquidCapital / (vandalizeUnitCost * 4)) * 55));
    const pressureScore = Math.min(25, Math.round(landingPressureProb * 45));
    const proximityBonus =
      (hasVulnerableTilesInRange ? 12 : 0) + (playerAttackChance > 0 ? 8 : 0);
    const vandalismCapacityPct = isFrozen
      ? 0
      : Math.min(100, Math.max(0, liquidityScore + pressureScore + proximityBonus));

    let defenseTier: SpeculatorDefenseTier = 'CONTAINED';
    if (
      !isFrozen &&
      maxVandalismsAffordable >= 1 &&
      (vandalismCapacityPct >= 70 || playerAttackChance >= 15)
    ) {
      defenseTier = 'CRITICAL';
    } else if (!isFrozen && maxVandalismsAffordable >= 1 && vandalismCapacityPct >= 45) {
      defenseTier = 'ELEVATED';
    } else if (!isFrozen && (maxVandalismsAffordable >= 1 || vandalismCapacityPct >= 20)) {
      defenseTier = 'MODERATE';
    }

    // Plan de defensa contextual para jugadoras
    let defensePlan = 'Mantener vigilancia en el perímetro y agrupar fichas en bienes comunes clave.';
    if (isFrozen) {
      defensePlan = 'Especulador congelado en Sandbox: sin capacidad operativa este turno.';
    } else if (threatDetail?.intendedTarget.reason === 'IN_RANGE_ATTACK') {
      defensePlan = `Alerta: ${threatDetail.intendedTarget.targetPlayerName} expuesta a +${threatDetail.intendedTarget.distance} (${threatDetail.intendedTarget.probabilityPct}%). Acompáñala para activar Protección Mutua.`;
    } else if (threatDetail && threatDetail.predictedTileRisks.length > 0) {
      const topRisk = threatDetail.predictedTileRisks[0];
      const actionVerb = topRisk.riskAction === 'VANDALIZE' ? 'vandalizar' : 'comprar';
      defensePlan = `Posiciona 1–2 fichas en #${topRisk.tileId} (${topRisk.tileName}, +${topRisk.distance}) para impedir que pueda ${actionVerb}la (${topRisk.actionChancePct}%).`;
    } else if (maxVandalismsAffordable === 0) {
      defensePlan = `Liquidez insuficiente (${liquidCapital}/${vandalizeUnitCost} pts): aprovecha esta ventana para desprivatizar.`;
    } else if (threatDetail?.intendedTarget.reason === 'BLOCKED_MUTUAL_PROTECTION') {
      defensePlan = `Bloqueado por Protección Mutua en #${threatDetail.intendedTarget.tileId}. Mantened la posición conjunta.`;
    }

    const currentTile = state.tiles.find(t => t.id === spec.position);

    return {
      speculatorId: spec.id,
      speculatorName: spec.name,
      speculatorColor: spec.color,
      orderIndex: idx + 1,
      position: spec.position,
      currentTileName: currentTile?.name ?? `Casilla ${spec.position}`,
      boardSideLabel: threatDetail?.boardSideLabel ?? 'Perímetro',
      tileAssetValue,
      directBuyoutsCount,
      directVandalismsCount,
      controlledPrivateTilesCount,
      liquidCapital,
      netAssetValue,
      vandalizeUnitCost,
      buyoutUnitCost,
      maxVandalismsAffordable,
      maxBuyoutsAffordable,
      landingPressurePct,
      vandalismCapacityPct,
      defenseTier,
      threatDetail,
      defensePlan
    };
  });

  const totalTileAssetValue = profiles.reduce((acc, p) => acc + p.tileAssetValue, 0);
  const totalLiquidCapital = profiles.reduce((acc, p) => acc + p.liquidCapital, 0);
  const totalNetAssetValue = totalTileAssetValue + totalLiquidCapital;
  const totalVandalismsAffordable = profiles.reduce((acc, p) => acc + p.maxVandalismsAffordable, 0);
  const maxCapacityPct = profiles.reduce((m, p) => Math.max(m, p.vandalismCapacityPct), 0);
  const criticalCount = profiles.filter(p => p.defenseTier === 'CRITICAL').length;

  return {
    totalNetAssetValue,
    totalLiquidCapital,
    totalTileAssetValue,
    totalVandalismsAffordable,
    maxCapacityPct,
    criticalCount,
    profiles
  };
}
