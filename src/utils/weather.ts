/**
 * weather.ts
 * Controlador y calculador de clima dinámico para Commonspoly.
 * Modula las condiciones climáticas del tablero 3D (Lluvia, Nieve, Día Soleado)
 * con intensidad gradual basada en el equilibrio ecológico o en el control manual:
 * - LLUVIA (RAIN): Precipitaciones vivificantes que nutren los bienes comunes.
 * - NIEVE (SNOW): Copos de nieve cristalinos que cubren suavemente el tablero.
 * - DÍA SOLEADO (SUNNY): Radiante luz solar dorada y atmósfera cálida despejada.
 * - AUTO: Cálculo ecológico automático según el estado de los bienes medioambientales.
 */

import { Tile, WeatherType, WeatherMode, WeatherCondition } from '../types/game';

export function resolveWeather(
  tiles: Tile[],
  mode: WeatherMode = 'AUTO',
  manualIntensity = 0.85,
  round = 1,
  activePlayerIndex = 0
): WeatherCondition {
  const envTiles = tiles.filter(t => t.goodType === 'ENVIRONMENT');
  const envCommonCount = envTiles.filter(t => t.state === 'COMMON').length;
  const envPublicCount = envTiles.filter(t => t.state === 'PUBLIC').length;
  const envPrivateCount = envTiles.filter(t => t.state === 'PRIVATE').length;
  const totalEnvTiles = envTiles.length || 1;

  let resolvedType: WeatherType = 'SUNNY';
  let intensity = Math.min(1, Math.max(0.2, manualIntensity));

  if (mode !== 'AUTO') {
    resolvedType = mode;
  } else {
    // Ciclo dinámico automático de clima según turno y ronda combinados con equilibrio ecológico
    const weatherCycle: WeatherType[] = ['SUNNY', 'RAIN', 'SNOW', 'DROUGHT', 'TEMPERATE'];
    const cycleIndex = Math.floor((round * 2 + activePlayerIndex) / 2) % weatherCycle.length;
    const cycledType = weatherCycle[cycleIndex] || 'SUNNY';

    const commonRatio = envCommonCount / totalEnvTiles;
    const privateRatio = envPrivateCount / totalEnvTiles;

    if (envCommonCount >= 3) {
      resolvedType = round % 2 === 0 ? 'RAIN' : 'SUNNY';
      intensity = 0.6 + commonRatio * 0.4;
    } else if (envPrivateCount >= 4) {
      resolvedType = round % 2 === 0 ? 'DROUGHT' : 'SNOW';
      intensity = 0.6 + privateRatio * 0.4;
    } else {
      resolvedType = cycledType;
      intensity = 0.52 + (round % 4) * 0.12;
    }
    intensity = Math.min(1, Math.max(0.25, intensity));
  }

  let label = 'Día Soleado';
  let description = 'Cielo radiante y luz solar cálida sobre el territorio comunitario.';

  if (resolvedType === 'RAIN') {
    label = 'Lluvia Regenerativa';
    description = `Precipitaciones vivificantes fertilizan los bienes comunes (${envCommonCount}/${totalEnvTiles} comunes).`;
  } else if (resolvedType === 'SNOW') {
    label = 'Nevada Invernal';
    description = `Copos de nieve cristalinos cubren suavemente el tablero de juego (${envPrivateCount}/${totalEnvTiles} privatizados).`;
  } else if (resolvedType === 'SUNNY') {
    label = 'Día Soleado';
    description = `Luz solar dorada y atmósfera despejada impulsan la prosperidad colectiva (${envCommonCount}/${totalEnvTiles} comunes).`;
  } else if (resolvedType === 'DROUGHT') {
    label = 'Sequía Extrema';
    description = `Alerta ecológica: aridez, calima ardiente y polvo sobre el suelo (${envPrivateCount}/${totalEnvTiles} privatizados).`;
  } else if (resolvedType === 'TEMPERATE') {
    label = 'Brisa Templada';
    description = 'Equilibrio ecológico en transición comunitaria.';
  }

  return {
    type: resolvedType,
    mode,
    intensity,
    label,
    description,
    envCommonCount,
    envPublicCount,
    envPrivateCount,
    totalEnvTiles
  };
}

export interface WeatherForecastStep {
  turnOffset: number;
  round: number;
  activePlayerIndex: number;
  condition: WeatherCondition;
  isFavorableForSituationCards: boolean;
  situationSuccessPercent: number;
}

export function predictWeatherForecast(
  tiles: Tile[],
  mode: WeatherMode = 'AUTO',
  manualIntensity = 0.85,
  currentRound = 1,
  currentPlayerIndex = 0,
  playerCount = 4,
  steps = 3
): WeatherForecastStep[] {
  const safePlayers = Math.max(1, playerCount);
  const forecast: WeatherForecastStep[] = [];

  for (let offset = 1; offset <= steps; offset++) {
    const totalTurns = currentPlayerIndex + offset;
    const projectedPlayerIdx = totalTurns % safePlayers;
    const projectedRound = Math.min(20, currentRound + Math.floor(totalTurns / safePlayers));
    const condition = resolveWeather(
      tiles,
      mode,
      manualIntensity,
      projectedRound,
      projectedPlayerIdx
    );
    const isFavorableForSituationCards =
      condition.type === 'RAIN' || condition.type === 'SUNNY' || condition.type === 'TEMPERATE';

    forecast.push({
      turnOffset: offset,
      round: projectedRound,
      activePlayerIndex: projectedPlayerIdx,
      condition,
      isFavorableForSituationCards,
      situationSuccessPercent: isFavorableForSituationCards ? 92 : 68
    });
  }

  return forecast;
}

