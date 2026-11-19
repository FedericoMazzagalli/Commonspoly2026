/**
 * WeatherControllerHUD.tsx
 * Controlador de clima dinámico integrado en el HUD de Commonspoly.
 * Refleja el estado de los recursos medioambientales (Costas, Bosques, Parques, etc.)
 * y permite controlar o consultar las condiciones atmosféricas del tablero 3D:
 * - Lluvia Regenerativa (RAIN)
 * - Nevada Invernal (SNOW)
 * - Día Soleado (SUNNY)
 * - Auto Ecológico (AUTO)
 */

import React, { useState } from 'react';
import {
  CloudRain,
  Snowflake,
  Sun,
  Wind,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Info,
  Clock,
  Sunrise,
  Sunset,
  Moon,
  Radar
} from 'lucide-react';
import { GameEngineState, TimeOfDayMode, WeatherMode } from '../../types/game';
import { resolveWeather } from '../../utils/weather';
import { resolveCardAtmosphere, resolveGameTimeOfDay } from '../../utils/atmosphere';
import { playSound } from '../../utils/audio';

interface WeatherControllerHUDProps {
  state: GameEngineState;
  onSetWeatherMode: (mode: WeatherMode) => void;
  onSetWeatherIntensity?: (intensity: number) => void;
  onSetTimeOfDayMode?: (mode: TimeOfDayMode) => void;
  isMeteorologicalInsightOpen?: boolean;
  onToggleMeteorologicalInsight?: () => void;
}

export const WeatherControllerHUD: React.FC<WeatherControllerHUDProps> = ({
  state,
  onSetWeatherMode,
  onSetWeatherIntensity,
  onSetTimeOfDayMode,
  isMeteorologicalInsightOpen = false,
  onToggleMeteorologicalInsight
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const condition = resolveWeather(state.tiles, state.weatherMode, state.weatherIntensity ?? 0.85);
  const timeInfo = resolveGameTimeOfDay(
    state.round,
    state.activePlayerIndex,
    state.players.length || 4,
    state.timeOfDayMode ?? 'AUTO'
  );
  const cardInfo = resolveCardAtmosphere({
    phase: state.phase,
    activeModal: state.activeModal,
    currentGlobalCard: state.currentGlobalCard,
    currentSituationCard: state.currentSituationCard
  });

  const getTheme = () => {
    switch (condition.type) {
      case 'RAIN':
        return {
          icon: <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />,
          accent: 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          dot: 'bg-cyan-400'
        };
      case 'SNOW':
        return {
          icon: <Snowflake className="w-3.5 h-3.5 text-sky-200 shrink-0" />,
          accent: 'border-sky-300/60 bg-sky-950/40 text-sky-100',
          badgeBg: 'bg-sky-400/20 text-sky-200 border-sky-300/50',
          dot: 'bg-sky-200'
        };
      case 'SUNNY':
        return {
          icon: <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          accent: 'border-amber-500/60 bg-amber-950/40 text-amber-200',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400'
        };
      case 'DROUGHT':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />,
          accent: 'border-orange-500/60 bg-orange-950/40 text-orange-200',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
          dot: 'bg-orange-400'
        };
      case 'TEMPERATE':
      default:
        return {
          icon: <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          accent: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400'
        };
    }
  };

  const theme = getTheme();

  const handleSelectMode = (mode: WeatherMode) => {
    playSound.uiToggle(true);
    onSetWeatherMode(mode);
  };

  return (
    <div
      aria-label="Controlador de Clima Dinámico"
      className="pointer-events-auto bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl text-slate-100 overflow-hidden transition-all text-xs"
    >
      {/* Barra principal compacta con accesos directos rápidos */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => {
            playSound.uiToggle(!isExpanded);
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity text-left cursor-pointer min-w-0"
        >
          <div className={`p-1 rounded-lg border ${theme.badgeBg}`}>
            {theme.icon}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-bold text-white text-[11px] truncate">
              {condition.label}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums truncate">
              {timeInfo.formattedHour} · {timeInfo.phaseLabel} · {Math.round(condition.intensity * 100)}% · {condition.envCommonCount}/{condition.totalEnvTiles} Comunes
            </span>
          </div>
        </button>

        {/* Acceso rápido a modos climáticos en barra compacta */}
        <div className="flex items-center gap-1 pl-1">
          <button
            type="button"
            onClick={() => handleSelectMode('AUTO')}
            className={`p-1 rounded-lg transition-colors ${
              condition.mode === 'AUTO'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Auto: Clima ecológico automático según el tablero"
            aria-label="Clima Automático"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('RAIN')}
            className={`p-1 rounded-lg transition-colors ${
              condition.mode === 'RAIN'
                ? 'bg-cyan-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
            }`}
            title="Lluvia: Gotas vivificantes sobre el tablero 3D"
            aria-label="Clima Lluvia"
          >
            <CloudRain className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('SNOW')}
            className={`p-1 rounded-lg transition-colors ${
              condition.mode === 'SNOW'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-sky-200 hover:bg-slate-800'
            }`}
            title="Nieve: Copos cristalinos y atmósfera invernal"
            aria-label="Clima Nieve"
          >
            <Snowflake className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('SUNNY')}
            className={`p-1 rounded-lg transition-colors ${
              condition.mode === 'SUNNY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
            title="Día Soleado: Luz dorada y cielo despejado"
            aria-label="Clima Día Soleado"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          {onToggleMeteorologicalInsight && (
            <button
              type="button"
              onClick={() => {
                playSound.uiToggle(!isMeteorologicalInsightOpen);
                onToggleMeteorologicalInsight();
              }}
              className={`p-1 rounded-lg transition-colors ${
                isMeteorologicalInsightOpen
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Meteorological Insight: Análisis climático y prioridades estratégicas"
              aria-label="Abrir Meteorological Insight"
              aria-expanded={isMeteorologicalInsightOpen}
            >
              <Radar className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Botón expandir/contraer panel completo */}
          <button
            type="button"
            onClick={() => {
              playSound.uiToggle(!isExpanded);
              setIsExpanded(!isExpanded);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-0.5"
            title={isExpanded ? 'Ocultar opciones climáticas' : 'Detalles del clima'}
            aria-label={isExpanded ? 'Ocultar opciones climáticas' : 'Detalles del clima'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel expandido con detalles y selectores */}
      {isExpanded && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5 animate-in fade-in duration-200">
          <p className="text-[11px] text-slate-300 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
            <span>{condition.description}</span>
          </p>

          {/* Desglose de bienes ambientales */}
          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[10px] tabular-nums">
            <span className="text-emerald-300 font-semibold flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              {condition.envCommonCount} Comunes
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-sky-300 font-semibold">
              {condition.envPublicCount} Públicos
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-rose-300 font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {condition.envPrivateCount} Privados
            </span>
          </div>

          {/* Selector de modo de clima con botones nombrados */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-teal-300 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Controlador de Clima</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => handleSelectMode('AUTO')}
                className={`py-1.5 px-1 rounded-lg border font-semibold truncate transition-colors flex items-center justify-center gap-1 ${
                  condition.mode === 'AUTO'
                    ? 'bg-teal-700 text-white border-teal-500'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700'
                }`}
                title="Clima dinámico automático según el estado de los bienes ambientales del tablero"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Auto</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('RAIN')}
                className={`py-1.5 px-1 rounded-lg border font-semibold truncate transition-colors flex items-center justify-center gap-1 ${
                  condition.mode === 'RAIN'
                    ? 'bg-cyan-700 text-white border-cyan-500'
                    : 'bg-slate-800/80 text-slate-300 hover:text-cyan-200 border-slate-700'
                }`}
                title="Lluvia regenerativa: precipitaciones y agua vivificante"
              >
                <CloudRain className="w-3 h-3 shrink-0" />
                <span>Lluvia</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('SNOW')}
                className={`py-1.5 px-1 rounded-lg border font-semibold truncate transition-colors flex items-center justify-center gap-1 ${
                  condition.mode === 'SNOW'
                    ? 'bg-sky-600 text-white border-sky-400'
                    : 'bg-slate-800/80 text-slate-300 hover:text-sky-200 border-slate-700'
                }`}
                title="Nevada invernal: copos blancos flotantes y atmósfera cristalina"
              >
                <Snowflake className="w-3 h-3 shrink-0" />
                <span>Nieve</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('SUNNY')}
                className={`py-1.5 px-1 rounded-lg border font-semibold truncate transition-colors flex items-center justify-center gap-1 ${
                  condition.mode === 'SUNNY'
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-800/80 text-slate-300 hover:text-amber-200 border-slate-700'
                }`}
                title="Día soleado: cielo despejado y destellos solares dorados"
              >
                <Sun className="w-3 h-3 shrink-0" />
                <span>Soleado</span>
              </button>
            </div>
          </div>

          {/* Control gradual de intensidad ambiental */}
          {onSetWeatherIntensity && (
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-semibold">
                  Intensidad Ambiental {condition.mode === 'AUTO' ? '(Automática)' : '(Gradual)'}
                </span>
                <span className="text-teal-300 font-bold tabular-nums">
                  {Math.round(condition.intensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={Math.round((condition.mode === 'AUTO' ? condition.intensity : state.weatherIntensity ?? 0.85) * 100)}
                onChange={(e) => {
                  const nextVal = Number(e.target.value) / 100;
                  if (condition.mode === 'AUTO') {
                    onSetWeatherMode(condition.type);
                  }
                  onSetWeatherIntensity(nextVal);
                }}
                aria-label="Intensidad ambiental del clima 3D"
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
            </div>
          )}

          {/* Selector de Hora del Juego & Shader de Iluminación Global */}
          {onSetTimeOfDayMode && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] tabular-nums">
                <span className="font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Iluminación Global</span>
                </span>
                <span className="text-slate-300 font-semibold">
                  {timeInfo.formattedHour} · {timeInfo.phaseLabel}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1 text-[10px]">
                {([
                  { id: 'AUTO', label: 'Auto', icon: <Sparkles className="w-3 h-3 shrink-0" /> },
                  { id: 'DAWN', label: 'Alba', icon: <Sunrise className="w-3 h-3 shrink-0" /> },
                  { id: 'NOON', label: 'Día', icon: <Sun className="w-3 h-3 shrink-0" /> },
                  { id: 'SUNSET', label: 'Ocaso', icon: <Sunset className="w-3 h-3 shrink-0" /> },
                  { id: 'NIGHT', label: 'Noche', icon: <Moon className="w-3 h-3 shrink-0" /> }
                ] as const).map(opt => {
                  const active = (state.timeOfDayMode ?? 'AUTO') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSetTimeOfDayMode(opt.id)}
                      className={`py-1.5 px-1 rounded-lg border font-semibold truncate transition-colors flex flex-col items-center justify-center gap-0.5 ${
                        active
                          ? 'bg-teal-700 text-white border-teal-500'
                          : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {cardInfo.kind !== 'NONE' && (
                <div className="text-[10px] text-amber-200/90 leading-snug pt-0.5">
                  <span className="font-semibold">Evento activo:</span> {cardInfo.label} · {cardInfo.description}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
