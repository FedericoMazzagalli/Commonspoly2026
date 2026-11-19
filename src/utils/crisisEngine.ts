/**
 * crisisEngine.ts
 * Motor probabilístico de eventos de 'Crisis Inesperada' para Commonspoly.
 * Se evalúa cada turno tras un intervalo mínimo de enfriamiento y se dispara
 * con baja probabilidad, alterando temporalmente el coste de desbloqueo y el
 * rendimiento de los recursos del tablero para introducir incertidumbre estratégica.
 */

import {
  Character,
  CrisisSeverity,
  GoodType,
  Tile,
  UnexpectedCrisisEvent
} from '../types/game';

interface CrisisTemplate {
  id: string;
  title: string;
  description: string;
  affectedGoodType: GoodType | 'ALL';
  unlockCostDelta: number;
  commonYieldDelta: number;
  totalTurns: number;
  severity: CrisisSeverity;
}

const MIN_TURNS_BETWEEN_CRISES = 3;

export const UNEXPECTED_CRISIS_TEMPLATES: CrisisTemplate[] = [
  {
    id: 'crisis_urban_bubble',
    title: 'Burbuja Especulativa Urbana',
    description:
      'La presión inmobiliaria encarece en +3 Bienestar desbloquear casillas Urbanas y merma -1 su retorno.',
    affectedGoodType: 'URBAN',
    unlockCostDelta: 3,
    commonYieldDelta: -1,
    totalTurns: 5,
    severity: 'CRITICAL'
  },
  {
    id: 'crisis_health_supply',
    title: 'Escasez de Suministros Sanitarios',
    description:
      'Fallos logísticos elevan +3 Bienestar el coste de recuperar nodos de Salud y reducen -1 su beneficio.',
    affectedGoodType: 'HEALTH',
    unlockCostDelta: 3,
    commonYieldDelta: -1,
    totalTurns: 5,
    severity: 'CRITICAL'
  },
  {
    id: 'crisis_knowledge_paywall',
    title: 'Cerco de Patentes Digitales',
    description:
      'Nuevas restricciones encarecen +2 Bienestar el desbloqueo en Conocimiento y restan -1 a su rendimiento.',
    affectedGoodType: 'KNOWLEDGE',
    unlockCostDelta: 2,
    commonYieldDelta: -1,
    totalTurns: 4,
    severity: 'WARNING'
  },
  {
    id: 'crisis_water_stress',
    title: 'Estrés Hídrico Repentino',
    description:
      'Sequía local inesperada aumenta +3 Bienestar el coste de regeneración Medioambiental y reduce -1 su retorno.',
    affectedGoodType: 'ENVIRONMENT',
    unlockCostDelta: 3,
    commonYieldDelta: -1,
    totalTurns: 5,
    severity: 'CRITICAL'
  },
  {
    id: 'crisis_market_inflation',
    title: 'Inflación General de Suministros',
    description:
      'Tensión económica transversal: todos los recursos del tablero cuestan +2 Bienestar extra al desbloquearse.',
    affectedGoodType: 'ALL',
    unlockCostDelta: 2,
    commonYieldDelta: -1,
    totalTurns: 4,
    severity: 'CRITICAL'
  },
  {
    id: 'crisis_civic_surge',
    title: 'Fondo Vecinal de Emergencia',
    description:
      'Solidaridad imprevista en el barrio: abarata -2 Bienestar desbloquear cualquier recurso y aporta +1 al rendimiento.',
    affectedGoodType: 'ALL',
    unlockCostDelta: -2,
    commonYieldDelta: 1,
    totalTurns: 4,
    severity: 'OPPORTUNITY'
  }
];

export function doesCrisisAffectTile(
  tile: Tile | undefined,
  crisis: UnexpectedCrisisEvent | null | undefined
): boolean {
  if (!tile || !crisis) return false;
  if (tile.category !== 'RESOURCE' && tile.category !== 'AGORA_ENTRY') return false;
  return crisis.affectedGoodType === 'ALL' || tile.goodType === crisis.affectedGoodType;
}

export function getSkillForGoodType(player: Character | undefined, goodType?: GoodType): number {
  if (!player || !goodType) return 0;
  switch (goodType) {
    case 'HEALTH':
      return player.skills.care;
    case 'URBAN':
      return player.skills.occupy;
    case 'KNOWLEDGE':
      return player.skills.share;
    case 'ENVIRONMENT':
      return player.skills.regenerate;
    default:
      return 0;
  }
}

export function getEffectiveUnlockCost(
  tile: Tile | undefined,
  player: Character | undefined,
  crisis: UnexpectedCrisisEvent | null | undefined
): {
  baseCost: number;
  crisisDelta: number;
  effectiveCost: number;
  skillPoints: number;
} {
  const skillPoints = getSkillForGoodType(player, tile?.goodType);
  const baseCost = Math.max(0, 10 - skillPoints);
  const affected = doesCrisisAffectTile(tile, crisis);
  const rawDelta = affected && crisis ? crisis.unlockCostDelta : 0;
  const effectiveCost = Math.max(0, baseCost + rawDelta);

  return {
    baseCost,
    crisisDelta: effectiveCost - baseCost,
    effectiveCost,
    skillPoints
  };
}

export function getEffectiveResourceReward(
  tile: Tile | undefined,
  baseWellness: number,
  baseLegitimacy: number,
  crisis: UnexpectedCrisisEvent | null | undefined
): {
  wellness: number;
  legitimacy: number;
  crisisDelta: number;
} {
  const affected = doesCrisisAffectTile(tile, crisis);
  const delta = affected && crisis ? crisis.commonYieldDelta : 0;
  return {
    wellness: Math.max(1, baseWellness + delta),
    legitimacy: Math.max(1, baseLegitimacy + (delta > 0 ? 1 : 0)),
    crisisDelta: delta
  };
}

export interface CrisisTurnEvaluation {
  nextCrisis: UnexpectedCrisisEvent | null;
  newlyTriggeredCrisis: UnexpectedCrisisEvent | null;
  expiredCrisis: UnexpectedCrisisEvent | null;
  nextTurnsSinceLastCrisis: number;
}

export function evaluateUnexpectedCrisisTurn(
  currentCrisis: UnexpectedCrisisEvent | null | undefined,
  turnsSinceLastCrisis: number | undefined,
  round: number,
  lastCrisisId?: string | null
): CrisisTurnEvaluation {
  // Si hay una crisis activa, descontamos 1 turno restante
  if (currentCrisis) {
    const remaining = currentCrisis.turnsRemaining - 1;
    if (remaining <= 0) {
      return {
        nextCrisis: null,
        newlyTriggeredCrisis: null,
        expiredCrisis: currentCrisis,
        nextTurnsSinceLastCrisis: 0
      };
    }
    return {
      nextCrisis: {
        ...currentCrisis,
        turnsRemaining: remaining
      },
      newlyTriggeredCrisis: null,
      expiredCrisis: null,
      nextTurnsSinceLastCrisis: 0
    };
  }

  // Si no hay crisis activa, incrementamos el contador de turnos desde la última
  const nextCooldown = (turnsSinceLastCrisis ?? 0) + 1;
  if (nextCooldown < MIN_TURNS_BETWEEN_CRISES) {
    return {
      nextCrisis: null,
      newlyTriggeredCrisis: null,
      expiredCrisis: null,
      nextTurnsSinceLastCrisis: nextCooldown
    };
  }

  // Baja probabilidad cada pocos turnos (16% tras 3 turnos, subiendo gradualmente hasta máx. 28%)
  const triggerProbability = Math.min(0.28, 0.16 + (nextCooldown - MIN_TURNS_BETWEEN_CRISES) * 0.03);
  if (Math.random() >= triggerProbability) {
    return {
      nextCrisis: null,
      newlyTriggeredCrisis: null,
      expiredCrisis: null,
      nextTurnsSinceLastCrisis: nextCooldown
    };
  }

  const candidates = UNEXPECTED_CRISIS_TEMPLATES.filter(t => t.id !== lastCrisisId);
  const pool = candidates.length > 0 ? candidates : UNEXPECTED_CRISIS_TEMPLATES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const newCrisis: UnexpectedCrisisEvent = {
    ...chosen,
    turnsRemaining: chosen.totalTurns,
    triggeredAtRound: round
  };

  return {
    nextCrisis: newCrisis,
    newlyTriggeredCrisis: newCrisis,
    expiredCrisis: null,
    nextTurnsSinceLastCrisis: 0
  };
}
