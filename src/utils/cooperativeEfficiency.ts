/**
 * cooperativeEfficiency.ts
 * Calcula la eficiencia cooperativa final lograda por el equipo en Commonspoly
 * a partir de la recuperación de bienes comunes, acciones solidarias y rapidez
 * de transformación, determinando el grado de restauración cromática del tablero.
 */

import { GameEngineState, PlayerContributionStats, Tile } from '../types/game';

export interface CooperativeEfficiencyBreakdown {
  /** Eficiencia cooperativa final normalizada [0, 1] */
  efficiency: number;
  /** Porcentaje entero [0, 100] */
  efficiencyPct: number;
  /** Etiqueta cualitativa del nivel de limpieza y cooperación */
  tierLabel: string;
  /** Porcentaje de recuperación del tablero (Comunes + Públicos ponderados) */
  boardRecoveryPct: number;
  /** Porcentaje de sinergia cooperativa del equipo */
  teamSynergyPct: number;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  totalResourceTiles: number;
  totalCooperativeActions: number;
}

export function computeCooperativeEfficiency(
  tiles: Tile[],
  playerStats?: Record<string, PlayerContributionStats>,
  round = 1,
  gameResult?: GameEngineState['gameResult']
): CooperativeEfficiencyBreakdown {
  const resourceTiles = tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const totalResourceTiles = Math.max(1, resourceTiles.length);
  const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
  const publicCount = resourceTiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;

  // Recuperación estructural del tablero: Comunes (100%) + Públicos en transición (35%)
  const boardRecoveryRatio = Math.min(
    1,
    (commonCount + publicCount * 0.35) / totalResourceTiles
  );

  // Sinergia cooperativa: acciones solidarias, desbloqueos colectivos y celeridad
  const statsList = Object.values(playerStats ?? {});
  const totalCooperativeActions = statsList.reduce(
    (sum, s) => sum + s.cooperativeActions,
    0
  );
  const totalUnlocks = statsList.reduce(
    (sum, s) => sum + s.commonsUnlocked + s.publicsUnlocked * 0.5,
    0
  );

  const expectedTeamEffort = Math.max(8, totalResourceTiles * 0.8);
  const actionRatio = Math.min(
    1,
    (totalCooperativeActions + totalUnlocks * 0.75) / expectedTeamEffort
  );
  const speedBonus =
    gameResult === 'VICTORY' ? Math.max(0, (20 - round) / 20) * 0.25 : 0;
  const teamSynergyRatio = Math.min(1, actionRatio + speedBonus);

  // Ponderación combinada (78% estado del tablero, 22% sinergia cooperativa)
  let efficiency = boardRecoveryRatio * 0.78 + teamSynergyRatio * 0.22;

  if (gameResult === 'VICTORY') {
    efficiency = Math.max(0.85, efficiency);
  }
  efficiency = Math.max(0, Math.min(1, efficiency));

  const efficiencyPct = Math.round(efficiency * 100);
  const boardRecoveryPct = Math.round(boardRecoveryRatio * 100);
  const teamSynergyPct = Math.round(teamSynergyRatio * 100);

  let tierLabel = 'Desarticulación Urbana';
  if (efficiencyPct >= 85) {
    tierLabel = 'Regeneración Plena';
  } else if (efficiencyPct >= 65) {
    tierLabel = 'Alta Cohesión Barrial';
  } else if (efficiencyPct >= 40) {
    tierLabel = 'Transición Parcial';
  } else if (efficiencyPct >= 15) {
    tierLabel = 'Resistencia Inicial';
  }

  return {
    efficiency,
    efficiencyPct,
    tierLabel,
    boardRecoveryPct,
    teamSynergyPct,
    commonCount,
    publicCount,
    privateCount,
    totalResourceTiles,
    totalCooperativeActions
  };
}
