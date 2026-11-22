/**
 * weatherSettings.ts
 * Persistencia, normalización, preajustes y descriptores cuantitativos
 * para el Panel de Configuración Avanzada de Clima.
 */

import { WeatherAdvancedConfig } from '../types/game';

const STORAGE_KEY = 'commonspoly_weather_advanced_config_v1';

export const DEFAULT_WEATHER_ADVANCED_CONFIG: WeatherAdvancedConfig = {
  eventFrequencyMultiplier: 1.0,
  minCooldownTurns: 2,
  particleDensityScale: 1.0,
  atmosphereImpactScale: 1.0,
  hudOverlayOpacity: 0.85
};

export interface WeatherConfigPreset {
  id: 'STANDARD' | 'CINEMATIC' | 'STORM' | 'CLEAR';
  label: string;
  description: string;
  config: WeatherAdvancedConfig;
}

export const WEATHER_CONFIG_PRESETS: WeatherConfigPreset[] = [
  {
    id: 'STANDARD',
    label: 'Estándar',
    description: 'Equilibrio oficial entre dinámicas climáticas y claridad visual 3D.',
    config: { ...DEFAULT_WEATHER_ADVANCED_CONFIG }
  },
  {
    id: 'CINEMATIC',
    label: 'Cinematográfico',
    description: 'Niebla volumétrica rica y lluvia/nieve densa con frecuencia equilibrada.',
    config: {
      eventFrequencyMultiplier: 1.2,
      minCooldownTurns: 2,
      particleDensityScale: 1.35,
      atmosphereImpactScale: 1.35,
      hudOverlayOpacity: 0.95
    }
  },
  {
    id: 'STORM',
    label: 'Temporal Intenso',
    description: 'Eventos meteorológicos frecuentes y atmósfera dramática en el tablero.',
    config: {
      eventFrequencyMultiplier: 1.8,
      minCooldownTurns: 1,
      particleDensityScale: 1.45,
      atmosphereImpactScale: 1.4,
      hudOverlayOpacity: 1.0
    }
  },
  {
    id: 'CLEAR',
    label: 'Visibilidad Clara',
    description: 'Sin partículas invasivas y eventos ocasionales para priorizar legibilidad.',
    config: {
      eventFrequencyMultiplier: 0.5,
      minCooldownTurns: 4,
      particleDensityScale: 0.25,
      atmosphereImpactScale: 0.45,
      hudOverlayOpacity: 0.15
    }
  }
];

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function normalizeWeatherAdvancedConfig(
  raw?: Partial<WeatherAdvancedConfig> | null
): WeatherAdvancedConfig {
  return {
    eventFrequencyMultiplier: Number(
      clamp(
        typeof raw?.eventFrequencyMultiplier === 'number'
          ? raw.eventFrequencyMultiplier
          : DEFAULT_WEATHER_ADVANCED_CONFIG.eventFrequencyMultiplier,
        0,
        2.0
      ).toFixed(2)
    ),
    minCooldownTurns: Math.round(
      clamp(
        typeof raw?.minCooldownTurns === 'number'
          ? raw.minCooldownTurns
          : DEFAULT_WEATHER_ADVANCED_CONFIG.minCooldownTurns,
        1,
        6
      )
    ),
    particleDensityScale: Number(
      clamp(
        typeof raw?.particleDensityScale === 'number'
          ? raw.particleDensityScale
          : DEFAULT_WEATHER_ADVANCED_CONFIG.particleDensityScale,
        0,
        1.5
      ).toFixed(2)
    ),
    atmosphereImpactScale: Number(
      clamp(
        typeof raw?.atmosphereImpactScale === 'number'
          ? raw.atmosphereImpactScale
          : DEFAULT_WEATHER_ADVANCED_CONFIG.atmosphereImpactScale,
        0,
        1.5
      ).toFixed(2)
    ),
    hudOverlayOpacity: Number(
      clamp(
        typeof raw?.hudOverlayOpacity === 'number'
          ? raw.hudOverlayOpacity
          : DEFAULT_WEATHER_ADVANCED_CONFIG.hudOverlayOpacity,
        0,
        1
      ).toFixed(2)
    )
  };
}

export function loadWeatherAdvancedConfig(): WeatherAdvancedConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_WEATHER_ADVANCED_CONFIG };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEATHER_ADVANCED_CONFIG };
    const parsed = JSON.parse(raw) as Partial<WeatherAdvancedConfig>;
    return normalizeWeatherAdvancedConfig(parsed);
  } catch {
    return { ...DEFAULT_WEATHER_ADVANCED_CONFIG };
  }
}

export function saveWeatherAdvancedConfig(
  config: Partial<WeatherAdvancedConfig>
): WeatherAdvancedConfig {
  const normalized = normalizeWeatherAdvancedConfig(config);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Ignore storage quota errors
  }
  return normalized;
}

export function computeEffectiveWeatherTriggerRange(
  multiplier: number
): { minPct: number; maxPct: number; label: string } {
  if (multiplier <= 0) {
    return { minPct: 0, maxPct: 0, label: 'Desactivados' };
  }
  const minPct = Math.round(Math.min(0.9, 0.28 * multiplier) * 100);
  const maxPct = Math.round(Math.min(0.92, 0.46 * multiplier) * 100);

  if (multiplier < 0.6) {
    return { minPct, maxPct, label: 'Poco frecuente' };
  }
  if (multiplier <= 1.15) {
    return { minPct, maxPct, label: 'Estándar' };
  }
  if (multiplier <= 1.55) {
    return { minPct, maxPct, label: 'Frecuente' };
  }
  return { minPct, maxPct, label: 'Intenso / Continuo' };
}

export function describeVisualImpactLevel(
  particleScale: number,
  atmosphereScale: number
): string {
  const avg = (particleScale + atmosphereScale) / 2;
  if (avg <= 0.1) return 'Mínimo (tablero despejado)';
  if (avg < 0.65) return 'Sutil / Ligero';
  if (avg <= 1.1) return 'Estándar 3D';
  return 'Cinematográfico Intenso';
}
