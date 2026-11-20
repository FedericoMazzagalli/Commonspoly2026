/**
 * weatherEvents.ts
 * Motor de Eventos Meteorológicos Dinámicos de Commonspoly.
 * Genera cambios climáticos aleatorios (Sequía, Lluvia Torrencial, Ola de Calor,
 * Temporal de Heladas, Solsticio Regenerativo) que afectan aleatoriamente a un
 * subconjunto de casillas de recursos del tablero y sus costes/rendimientos.
 */

import {
  DynamicWeatherEvent,
  DynamicWeatherEventKind,
  GoodType,
  Tile,
  WeatherType
} from '../types/game';

interface WeatherEventTemplate {
  kind: DynamicWeatherEventKind;
  weatherType: WeatherType;
  title: string;
  description: string;
  preferredGoodTypes: GoodType[];
  tileCountMin: number;
  tileCountMax: number;
  unlockCostDelta: number;
  resourceYieldDelta: number;
  totalTurns: number;
  severity: 'HAZARD' | 'WARNING' | 'BENEFICIAL';
}

const MIN_TURNS_BETWEEN_WEATHER_EVENTS = 2;

export const DYNAMIC_WEATHER_TEMPLATES: WeatherEventTemplate[] = [
  {
    kind: 'DROUGHT',
    weatherType: 'DROUGHT',
    title: 'Sequía Prolongada',
    description:
      'La falta de lluvias reseca acuíferos y cultivos: las casillas afectadas encarecen +2 su desbloqueo y reducen -1 su rendimiento.',
    preferredGoodTypes: ['ENVIRONMENT', 'HEALTH'],
    tileCountMin: 3,
    tileCountMax: 5,
    unlockCostDelta: 2,
    resourceYieldDelta: -1,
    totalTurns: 4,
    severity: 'HAZARD'
  },
  {
    kind: 'TORRENTIAL_RAIN',
    weatherType: 'RAIN',
    title: 'Lluvia Torrencial',
    description:
      'Fuertes trombas de agua anegan accesos y suministros: +2 al coste de desbloqueo y -1 al rendimiento temporal en las casillas anegadas.',
    preferredGoodTypes: ['URBAN', 'KNOWLEDGE'],
    tileCountMin: 3,
    tileCountMax: 5,
    unlockCostDelta: 2,
    resourceYieldDelta: -1,
    totalTurns: 4,
    severity: 'WARNING'
  },
  {
    kind: 'HEATWAVE',
    weatherType: 'DROUGHT',
    title: 'Ola de Calor Urbano',
    description:
      'Temperaturas extremas saturan los nodos afectados: +2 al coste de transformación y -1 al retorno de Bienestar/Legitimidad.',
    preferredGoodTypes: ['URBAN', 'HEALTH'],
    tileCountMin: 3,
    tileCountMax: 4,
    unlockCostDelta: 2,
    resourceYieldDelta: -1,
    totalTurns: 3,
    severity: 'HAZARD'
  },
  {
    kind: 'FROST_WAVE',
    weatherType: 'SNOW',
    title: 'Temporal de Nieve y Helada',
    description:
      'Las heladas dificultan el mantenimiento comunitario: +1 al coste de desbloqueo y -1 al rendimiento en las casillas afectadas.',
    preferredGoodTypes: ['ENVIRONMENT', 'URBAN'],
    tileCountMin: 3,
    tileCountMax: 4,
    unlockCostDelta: 1,
    resourceYieldDelta: -1,
    totalTurns: 3,
    severity: 'WARNING'
  },
  {
    kind: 'SOLAR_BLOOM',
    weatherType: 'SUNNY',
    title: 'Solsticio Regenerativo',
    description:
      'Clima benévolo y luz abundante revitalizan el barrio: -2 al coste de desbloqueo y +1 recurso adicional al visitar las casillas favorecidas.',
    preferredGoodTypes: ['ENVIRONMENT', 'HEALTH', 'KNOWLEDGE'],
    tileCountMin: 3,
    tileCountMax: 5,
    unlockCostDelta: -2,
    resourceYieldDelta: 1,
    totalTurns: 4,
    severity: 'BENEFICIAL'
  }
];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomAffectedTiles(
  tiles: Tile[],
  preferredGoodTypes: GoodType[],
  minCount: number,
  maxCount: number
): Tile[] {
  const candidates = tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  if (candidates.length === 0) return [];

  const targetCount = Math.min(
    candidates.length,
    minCount + Math.floor(Math.random() * (maxCount - minCount + 1))
  );

  // Mezcla aleatoria ponderada: prioriza tipos afines al clima pero incluye variabilidad en todo el tablero
  const preferredPool = shuffleArray(
    candidates.filter(t => t.goodType && preferredGoodTypes.includes(t.goodType))
  );
  const otherPool = shuffleArray(
    candidates.filter(t => !t.goodType || !preferredGoodTypes.includes(t.goodType))
  );

  const selected: Tile[] = [];
  const preferredTake = Math.min(preferredPool.length, Math.max(1, targetCount - 1));
  selected.push(...preferredPool.slice(0, preferredTake));

  const remainingNeeded = targetCount - selected.length;
  const fallbackPool = shuffleArray([
    ...preferredPool.slice(preferredTake),
    ...otherPool
  ]);
  selected.push(...fallbackPool.slice(0, remainingNeeded));

  return selected;
}

export function doesWeatherEventAffectTile(
  tile: Tile | undefined,
  weatherEvent: DynamicWeatherEvent | null | undefined
): boolean {
  if (!tile || !weatherEvent) return false;
  return weatherEvent.affectedTileIds.includes(tile.id);
}

export function formatWeatherImpactSummary(event: DynamicWeatherEvent): string {
  const costText =
    event.unlockCostDelta > 0
      ? `+${event.unlockCostDelta} coste`
      : `${event.unlockCostDelta} coste`;
  const yieldText =
    event.resourceYieldDelta > 0
      ? `+${event.resourceYieldDelta} retorno`
      : `${event.resourceYieldDelta} retorno`;
  return `${costText} · ${yieldText}`;
}

export interface DynamicWeatherTurnEvaluation {
  nextWeatherEvent: DynamicWeatherEvent | null;
  newlyTriggeredWeatherEvent: DynamicWeatherEvent | null;
  expiredWeatherEvent: DynamicWeatherEvent | null;
  nextTurnsSinceLastWeatherEvent: number;
}

export function evaluateDynamicWeatherTurn(
  currentEvent: DynamicWeatherEvent | null | undefined,
  turnsSinceLast: number | undefined,
  tiles: Tile[],
  round: number,
  lastKind?: DynamicWeatherEventKind | null
): DynamicWeatherTurnEvaluation {
  if (currentEvent) {
    const remaining = currentEvent.turnsRemaining - 1;
    if (remaining <= 0) {
      return {
        nextWeatherEvent: null,
        newlyTriggeredWeatherEvent: null,
        expiredWeatherEvent: currentEvent,
        nextTurnsSinceLastWeatherEvent: 0
      };
    }
    return {
      nextWeatherEvent: {
        ...currentEvent,
        turnsRemaining: remaining
      },
      newlyTriggeredWeatherEvent: null,
      expiredWeatherEvent: null,
      nextTurnsSinceLastWeatherEvent: 0
    };
  }

  const nextCooldown = (turnsSinceLast ?? 0) + 1;
  if (nextCooldown < MIN_TURNS_BETWEEN_WEATHER_EVENTS) {
    return {
      nextWeatherEvent: null,
      newlyTriggeredWeatherEvent: null,
      expiredWeatherEvent: null,
      nextTurnsSinceLastWeatherEvent: nextCooldown
    };
  }

  // Probabilidad progresiva (28% tras el enfriamiento mínimo, hasta 46%)
  const triggerProbability = Math.min(
    0.46,
    0.28 + (nextCooldown - MIN_TURNS_BETWEEN_WEATHER_EVENTS) * 0.045
  );
  if (Math.random() >= triggerProbability) {
    return {
      nextWeatherEvent: null,
      newlyTriggeredWeatherEvent: null,
      expiredWeatherEvent: null,
      nextTurnsSinceLastWeatherEvent: nextCooldown
    };
  }

  const pool = DYNAMIC_WEATHER_TEMPLATES.filter(t => t.kind !== lastKind);
  const candidates = pool.length > 0 ? pool : DYNAMIC_WEATHER_TEMPLATES;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  const affectedTiles = pickRandomAffectedTiles(
    tiles,
    chosen.preferredGoodTypes,
    chosen.tileCountMin,
    chosen.tileCountMax
  );
  const affectedTileIds = affectedTiles.map(t => t.id);
  const affectedTileNames = affectedTiles.map(t => t.name);
  const affectedGoodTypes = Array.from(
    new Set(affectedTiles.map(t => t.goodType).filter((g): g is GoodType => Boolean(g)))
  );

  const impactLabel = `${chosen.unlockCostDelta > 0 ? `+${chosen.unlockCostDelta}` : chosen.unlockCostDelta} coste, ${
    chosen.resourceYieldDelta > 0 ? `+${chosen.resourceYieldDelta}` : chosen.resourceYieldDelta
  } retorno`;

  const newEvent: DynamicWeatherEvent = {
    id: `weather_${chosen.kind.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    kind: chosen.kind,
    weatherType: chosen.weatherType,
    title: chosen.title,
    description: chosen.description,
    alertMessage: `${chosen.title} (${impactLabel}) en ${affectedTileNames.join(', ')}.`,
    affectedTileIds,
    affectedTileNames,
    affectedGoodTypes,
    unlockCostDelta: chosen.unlockCostDelta,
    resourceYieldDelta: chosen.resourceYieldDelta,
    turnsRemaining: chosen.totalTurns,
    totalTurns: chosen.totalTurns,
    severity: chosen.severity,
    triggeredAtRound: round
  };

  return {
    nextWeatherEvent: newEvent,
    newlyTriggeredWeatherEvent: newEvent,
    expiredWeatherEvent: null,
    nextTurnsSinceLastWeatherEvent: 0
  };
}
