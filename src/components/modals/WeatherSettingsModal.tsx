/**
 * WeatherSettingsModal.tsx
 * Panel de Configuración Avanzada de Clima en el menú del juego y en partida.
 * Permite ajustar mediante deslizadores la frecuencia de eventos meteorológicos
 * dinámicos, el enfriamiento entre eventos y su impacto visual en el tablero 3D
 * (densidad de partículas, atmósfera/niebla/luz y superposición HUD) con vista previa en vivo.
 */

import React, { useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  CloudRain,
  CloudSun,
  Flame,
  RotateCcw,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  X
} from 'lucide-react';
import { TimeOfDayMode, WeatherAdvancedConfig, WeatherMode } from '../../types/game';
import {
  computeEffectiveWeatherTriggerRange,
  DEFAULT_WEATHER_ADVANCED_CONFIG,
  describeVisualImpactLevel,
  WEATHER_CONFIG_PRESETS
} from '../../utils/weatherSettings';
import { playSound } from '../../utils/audio';
import { useI18n } from '../../i18n';
import { ModalFrame } from '../ui/MotionPrimitives';

interface WeatherSettingsModalProps {
  isOpen: boolean;
  config: WeatherAdvancedConfig;
  weatherMode: WeatherMode;
  weatherIntensity: number;
  timeOfDayMode?: TimeOfDayMode;
  onUpdateConfig: (next: Partial<WeatherAdvancedConfig>) => void;
  onSetWeatherMode: (mode: WeatherMode) => void;
  onSetWeatherIntensity: (intensity: number) => void;
  onSetTimeOfDayMode?: (mode: TimeOfDayMode) => void;
  onClose: () => void;
}

export const WeatherSettingsModal: React.FC<WeatherSettingsModalProps> = ({
  isOpen,
  config,
  weatherMode,
  weatherIntensity,
  timeOfDayMode = 'AUTO',
  onUpdateConfig,
  onSetWeatherMode,
  onSetWeatherIntensity,
  onSetTimeOfDayMode,
  onClose
}) => {
  const { t } = useI18n();
  const triggerStats = useMemo(
    () => computeEffectiveWeatherTriggerRange(config.eventFrequencyMultiplier),
    [config.eventFrequencyMultiplier]
  );

  const visualImpactLabel = useMemo(
    () =>
      describeVisualImpactLevel(
        config.particleDensityScale,
        config.atmosphereImpactScale
      ),
    [config.particleDensityScale, config.atmosphereImpactScale]
  );

  const isPresetActive = (presetCfg: WeatherAdvancedConfig) =>
    Math.abs(presetCfg.eventFrequencyMultiplier - config.eventFrequencyMultiplier) < 0.05 &&
    presetCfg.minCooldownTurns === config.minCooldownTurns &&
    Math.abs(presetCfg.particleDensityScale - config.particleDensityScale) < 0.05 &&
    Math.abs(presetCfg.atmosphereImpactScale - config.atmosphereImpactScale) < 0.05 &&
    Math.abs(presetCfg.hudOverlayOpacity - config.hudOverlayOpacity) < 0.05;

  const handleReset = () => {
    playSound.uiClick();
    onUpdateConfig({ ...DEFAULT_WEATHER_ADVANCED_CONFIG });
    onSetWeatherIntensity(0.85);
    onSetWeatherMode('AUTO');
    onSetTimeOfDayMode?.('AUTO');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalFrame
          ariaLabelledBy="weather-settings-title"
          backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 overflow-y-auto pointer-events-auto"
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 p-5 sm:p-6 space-y-5 my-auto"
          onBackdropClick={() => {
            playSound.modalClose();
            onClose();
          }}
        >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-teal-300 font-bold text-xs">
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span>{t.setup.weatherCardTitle}</span>
            </div>
            <h2
              id="weather-settings-title"
              className="hud-heading text-xl font-black text-white tracking-tight"
            >
              {t.modals.weatherTitle}
            </h2>
            <p className="text-xs text-slate-400">
              {t.modals.weatherSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors shrink-0"
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preajustes rápidos */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300">
            Perfiles Preestablecidos
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WEATHER_CONFIG_PRESETS.map(preset => {
              const active = isPresetActive(preset.config);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    onUpdateConfig({ ...preset.config });
                  }}
                  title={preset.description}
                  className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-teal-500/20 border-teal-400 text-white'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap truncate">
                    {preset.label}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vista previa atmosférica en vivo sobre el tablero 3D */}
        <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4 text-teal-400" />
              <span>Vista Previa en Tablero 3D</span>
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              Efecto visual: <strong className="text-teal-300">{visualImpactLabel}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 flex-wrap">
              {(
                [
                  { id: 'AUTO', label: t.common.auto, icon: <Sparkles className="w-3.5 h-3.5" /> },
                  { id: 'RAIN', label: 'Rain', icon: <CloudRain className="w-3.5 h-3.5" /> },
                  { id: 'SNOW', label: 'Snow', icon: <Snowflake className="w-3.5 h-3.5" /> },
                  { id: 'SUNNY', label: 'Sunny', icon: <Sun className="w-3.5 h-3.5" /> },
                  { id: 'DROUGHT', label: 'Drought', icon: <Flame className="w-3.5 h-3.5" /> }
                ] as const
              ).map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSetWeatherMode(mode.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    weatherMode === mode.id
                      ? 'bg-teal-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {onSetTimeOfDayMode && (
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                {(
                  [
                    { id: 'AUTO', label: 'Auto' },
                    { id: 'DAWN', label: 'Alba' },
                    { id: 'NOON', label: 'Día' },
                    { id: 'SUNSET', label: 'Ocaso' },
                    { id: 'NIGHT', label: 'Noche' }
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSetTimeOfDayMode(t.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      timeOfDayMode === t.id
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sección 1: Frecuencia de Eventos Meteorológicos */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-amber-300">
              01. Frecuencia de Eventos Meteorológicos Dinámicos
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {triggerStats.label} ·{' '}
              {triggerStats.maxPct > 0
                ? `${triggerStats.minPct}%–${triggerStats.maxPct}% prob./turno`
                : 'Solo clima ambiental'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Deslizador 1: Multiplicador de frecuencia */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Probabilidad de Aparición (Sequía, Lluvia Torrencial, Ola de Calor, Heladas)
                </span>
                <span className="font-bold text-amber-300">
                  {Math.round(config.eventFrequencyMultiplier * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={10}
                value={Math.round(config.eventFrequencyMultiplier * 100)}
                onChange={(e) =>
                  onUpdateConfig({
                    eventFrequencyMultiplier: Number(e.target.value) / 100
                  })
                }
                aria-label="Frecuencia de eventos meteorológicos"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>0% (Desactivado)</span>
                <span>100% (Estándar)</span>
                <span>200% (Extremo)</span>
              </div>
            </label>

            {/* Deslizador 2: Enfriamiento mínimo */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Intervalo Mínimo de Calma entre Eventos
                </span>
                <span className="font-bold text-amber-300">
                  {config.minCooldownTurns}{' '}
                  {config.minCooldownTurns === 1 ? 'turno' : 'turnos'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={config.minCooldownTurns}
                onChange={(e) =>
                  onUpdateConfig({
                    minCooldownTurns: Number(e.target.value)
                  })
                }
                aria-label="Intervalo mínimo entre eventos meteorológicos"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>1 turno (Inmediato)</span>
                <span>2 turnos (Estándar)</span>
                <span>6 turnos (Espaciado)</span>
              </div>
            </label>
          </div>
        </div>

        {/* Sección 2: Impacto Visual en el Tablero 3D */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-teal-300">
              02. Impacto Visual en el Tablero 3D y HUD
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {visualImpactLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deslizador 3: Densidad de partículas 3D */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Partículas 3D (Lluvia, Nieve, Sol)
                </span>
                <span className="font-bold text-teal-300">
                  {Math.round(config.particleDensityScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={Math.round(config.particleDensityScale * 100)}
                onChange={(e) =>
                  onUpdateConfig({
                    particleDensityScale: Number(e.target.value) / 100
                  })
                }
                aria-label="Densidad e impacto visual de partículas 3D"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>0% (Ocultas)</span>
                <span>100%</span>
                <span>150% (Denso)</span>
              </div>
            </label>

            {/* Deslizador 4: Atmósfera, niebla y reflejos 3D */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Atmósfera 3D (Niebla, Humedad, Luz)
                </span>
                <span className="font-bold text-teal-300">
                  {Math.round(config.atmosphereImpactScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={Math.round(config.atmosphereImpactScale * 100)}
                onChange={(e) =>
                  onUpdateConfig({
                    atmosphereImpactScale: Number(e.target.value) / 100
                  })
                }
                aria-label="Impacto atmosférico en niebla e iluminación 3D"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>0% (Nítido)</span>
                <span>100%</span>
                <span>150% (Dramático)</span>
              </div>
            </label>

            {/* Deslizador 5: Intensidad climática base */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Intensidad Climática Base
                </span>
                <span className="font-bold text-sky-300">
                  {Math.round(weatherIntensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={Math.round(weatherIntensity * 100)}
                onChange={(e) =>
                  onSetWeatherIntensity(Number(e.target.value) / 100)
                }
                aria-label="Intensidad climática base"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>20% (Suave)</span>
                <span>85%</span>
                <span>100% (Máxima)</span>
              </div>
            </label>

            {/* Deslizador 6: Superposición atmosférica sobre HUD */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-200 font-semibold">
                  Efectos Atmosféricos sobre Pantalla
                </span>
                <span className="font-bold text-sky-300">
                  {Math.round(config.hudOverlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(config.hudOverlayOpacity * 100)}
                onChange={(e) =>
                  onUpdateConfig({
                    hudOverlayOpacity: Number(e.target.value) / 100
                  })
                }
                aria-label="Opacidad de efectos atmosféricos sobre pantalla"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>0% (Desactivado)</span>
                <span>85%</span>
                <span>100%</span>
              </div>
            </label>
          </div>
        </div>

        {/* Pie del panel */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.common.reset}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              onClose();
            }}
            className="min-h-[44px] sm:min-h-[38px] px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs whitespace-nowrap shrink-0 transition-colors"
          >
            {t.common.apply}
          </button>
        </div>
        </ModalFrame>
      )}
    </AnimatePresence>
  );
};
