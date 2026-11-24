/**
 * MeteorologicalInsightHUD.tsx
 * Panel flotante de Meteorological Insight integrado en GameOverlayHUD.
 * Al abrirse, envía el estado actual de la partida, el pronóstico climático
 * de próximos turnos y los registros recientes al endpoint del servidor para
 * obtener un asesoramiento estratégico sobre decisiones barriales y recursos.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  CloudRain,
  Snowflake,
  Sun,
  Flame,
  Wind,
  Radar,
  RefreshCw,
  X,
  AlertTriangle,
  Compass,
  MapPin,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { GameEngineState, GoodType, WeatherType } from '../../types/game';
import { predictWeatherForecast, resolveWeather } from '../../utils/weather';
import { formatWeatherImpactSummary } from '../../utils/weatherEvents';
import { playSound } from '../../utils/audio';
import { HudPanelMotion } from '../ui/MotionPrimitives';

interface PrioritizedResourceAdvice {
  target: string;
  action: string;
  reason: string;
}

interface MeteorologicalInsightData {
  headline: string;
  riskLevel: string;
  forecastSummary: string;
  prioritizedResources: PrioritizedResourceAdvice[];
  neighborhoodAdvice: string;
  nextTurnAction: string;
}

interface MeteorologicalInsightHUDProps {
  isOpen: boolean;
  state: GameEngineState;
  onClose: () => void;
}

function renderWeatherIcon(type: WeatherType, className = 'w-4 h-4') {
  switch (type) {
    case 'RAIN':
      return <CloudRain className={`${className} text-cyan-400`} />;
    case 'SNOW':
      return <Snowflake className={`${className} text-sky-200`} />;
    case 'SUNNY':
      return <Sun className={`${className} text-amber-400`} />;
    case 'DROUGHT':
      return <Flame className={`${className} text-orange-400`} />;
    case 'TEMPERATE':
    default:
      return <Wind className={`${className} text-emerald-400`} />;
  }
}

const GOOD_LABELS: Record<GoodType, string> = {
  ENVIRONMENT: 'Medioambiente',
  HEALTH: 'Salud',
  URBAN: 'Urbano',
  KNOWLEDGE: 'Conocimiento'
};

export const MeteorologicalInsightHUD: React.FC<MeteorologicalInsightHUDProps> = ({
  isOpen,
  state,
  onClose
}) => {
  const [insight, setInsight] = useState<MeteorologicalInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdatedRound, setLastUpdatedRound] = useState<number | null>(null);

  const currentWeather = useMemo(
    () =>
      resolveWeather(
        state.tiles,
        state.weatherMode,
        state.weatherIntensity ?? 0.85,
        state.round,
        state.activePlayerIndex,
        state.activeWeatherEvent
      ),
    [
      state.tiles,
      state.weatherMode,
      state.weatherIntensity,
      state.round,
      state.activePlayerIndex,
      state.activeWeatherEvent
    ]
  );

  const forecast = useMemo(
    () =>
      predictWeatherForecast(
        state.tiles,
        state.weatherMode,
        state.weatherIntensity ?? 0.85,
        state.round,
        state.activePlayerIndex,
        state.players.length || 4,
        3,
        state.activeWeatherEvent
      ),
    [
      state.tiles,
      state.weatherMode,
      state.weatherIntensity,
      state.round,
      state.activePlayerIndex,
      state.players.length,
      state.activeWeatherEvent
    ]
  );

  const fetchInsight = useCallback(
    async (signal?: AbortSignal) => {
      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return;

      setLoading(true);
      setErrorMsg(null);

      const positionTile = state.tiles.find(t => t.id === activePlayer.position);
      const resourceTiles = state.tiles.filter(
        t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
      );

      const resourceBreakdown = (['ENVIRONMENT', 'HEALTH', 'URBAN', 'KNOWLEDGE'] as GoodType[]).map(
        cat => {
          const catTiles = resourceTiles.filter(t => t.goodType === cat);
          const privateTiles = catTiles.filter(t => t.state === 'PRIVATE');
          return {
            category: `${GOOD_LABELS[cat]} (${cat})`,
            common: catTiles.filter(t => t.state === 'COMMON').length,
            publicCount: catTiles.filter(t => t.state === 'PUBLIC').length,
            privateCount: privateTiles.length,
            total: catTiles.length,
            priorityPrivateNames: privateTiles.slice(0, 4).map(t => t.name)
          };
        }
      );

      const collectiveLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
      const requiredLegitimacyForAgora = state.players.length * 10;

      const neighborhoodDecision = state.neighborhoodDecision
        ? {
            title: state.neighborhoodDecision.title,
            description: state.neighborhoodDecision.description,
            targetTileNames: state.neighborhoodDecision.targetTileIds.map(
              id => state.tiles.find(t => t.id === id)?.name || `Casilla #${id}`
            ),
            votesCastCount: state.neighborhoodDecision.votesCast.length,
            totalPlayers: state.players.length,
            rewardSummary: state.neighborhoodDecision.rewardSummary
          }
        : null;

      const payload = {
        round: state.round,
        phase: state.phase,
        activePlayer: {
          name: activePlayer.name,
          wellness: activePlayer.wellness,
          legitimacy: activePlayer.legitimacy,
          positionName: positionTile?.name || (activePlayer.inAgora ? 'Ágora Central' : 'Tablero'),
          inAgora: activePlayer.inAgora,
          skills: activePlayer.skills
        },
        collectiveLegitimacy,
        requiredLegitimacyForAgora,
        currentWeather,
        forecast: forecast.map(step => ({
          turnOffset: step.turnOffset,
          round: step.round,
          weatherType: step.condition.type,
          label: step.condition.label,
          intensity: Math.round(step.condition.intensity * 100),
          situationSuccessPercent: step.situationSuccessPercent
        })),
        resourceBreakdown,
        neighborhoodDecision,
        currentGlobalCard: state.currentGlobalCard
          ? {
              title: state.currentGlobalCard.title,
              description: state.currentGlobalCard.description
            }
          : null,
        activeCrisis: state.activeCrisis
          ? {
              title: state.activeCrisis.title,
              affectedGoodType: state.activeCrisis.affectedGoodType,
              unlockCostDelta: state.activeCrisis.unlockCostDelta,
              commonYieldDelta: state.activeCrisis.commonYieldDelta,
              turnsRemaining: state.activeCrisis.turnsRemaining
            }
          : null,
        recentLogs: state.logs.slice(0, 12).map(log => ({
          round: log.round,
          actor: log.actor,
          type: log.type,
          message: log.message
        }))
      };

      try {
        const res = await fetch('/api/meteorological-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Error del servidor (${res.status})`);
        }

        if (signal?.aborted) return;
        setInsight(data.insight as MeteorologicalInsightData);
        setLastUpdatedRound(state.round);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No se pudo obtener el informe meteorológico estratégico.'
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [state, currentWeather, forecast]
  );

  // Al abrirse el panel, solicita automáticamente el análisis del estado actual
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetchInsight(controller.signal);
    return () => controller.abort();
    // Intencionalmente solo al abrir; el botón Actualizar permite refrescar bajo demanda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isCurrentFavorable =
    currentWeather.type === 'RAIN' ||
    currentWeather.type === 'SUNNY' ||
    currentWeather.type === 'TEMPERATE';

  const riskBadgeClass = (() => {
    const level = (insight?.riskLevel || '').toUpperCase();
    if (level.includes('CRÍTIC') || level.includes('CRITIC')) {
      return 'bg-rose-950/80 text-rose-300 border-rose-700/80';
    }
    if (level.includes('PRECAUC')) {
      return 'bg-amber-950/80 text-amber-300 border-amber-700/80';
    }
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <HudPanelMotion
          as="section"
          direction="right"
          onSwipeDismiss={() => {
            playSound.modalClose();
            onClose();
          }}
          ariaLabel="Meteorological Insight - Análisis Climático Estratégico"
          className="pointer-events-auto fixed top-16 right-3 md:right-6 z-30 w-[26rem] sm:w-[32rem] max-w-[94vw] max-h-[calc(100vh-10rem)] overflow-y-auto bg-slate-900/95 border border-cyan-700/70 rounded-2xl shadow-2xl p-4 text-slate-100 select-none space-y-3.5"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 shrink-0">
                <Radar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="hud-heading text-sm font-bold text-white truncate">
                  Meteorological Insight
                </h3>
                <p className="text-[11px] text-slate-400 truncate tabular-nums">
                  Parte estratégico · Ronda {state.round}/20
                  {lastUpdatedRound !== null ? ` · Act. R${lastUpdatedRound}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  fetchInsight();
                }}
                disabled={loading}
                className="min-h-[44px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-colors"
                title="Reanalizar clima, registros y tablero actual"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound.modalClose();
                  onClose();
                }}
                className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Cerrar Meteorological Insight"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

      {/* Evento Meteorológico Dinámico Activo */}
      {state.activeWeatherEvent && (
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 ${
            state.activeWeatherEvent.severity === 'BENEFICIAL'
              ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-100'
              : 'bg-orange-950/60 border-orange-600/50 text-orange-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 font-bold">
            <span>{state.activeWeatherEvent.title}</span>
            <span className="tabular-nums text-[11px]">
              {state.activeWeatherEvent.turnsRemaining}t · {formatWeatherImpactSummary(state.activeWeatherEvent)}
            </span>
          </div>
          <p className="text-[11px] opacity-90 leading-snug">
            Casillas afectadas: {state.activeWeatherEvent.affectedTileNames.join(', ')}.
          </p>
        </div>
      )}

      {/* Tira de Pronóstico Climático (Actual + 3 Turnos) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300 uppercase tracking-wider">
            Pronóstico a 3 Turnos
          </span>
          <span className="tabular-nums">
            Bienes Ambientales: {currentWeather.envCommonCount}/{currentWeather.totalEnvTiles} Comunes
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <div className="p-2 rounded-xl bg-slate-950/90 border border-cyan-700/60 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold">
              <span>Ahora</span>
              {renderWeatherIcon(currentWeather.type, 'w-3.5 h-3.5')}
            </div>
            <div className="text-[11px] font-semibold text-white truncate" title={currentWeather.label}>
              {currentWeather.label}
            </div>
            <div className="text-[10px] text-slate-400 tabular-nums">
              {Math.round(currentWeather.intensity * 100)}% ·{' '}
              <span className={isCurrentFavorable ? 'text-emerald-400' : 'text-amber-400'}>
                {isCurrentFavorable ? '92% éxito' : '68% éxito'}
              </span>
            </div>
          </div>

          {forecast.map(step => (
            <div
              key={step.turnOffset}
              className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold tabular-nums">
                <span>+{step.turnOffset}T · R{step.round}</span>
                {renderWeatherIcon(step.condition.type, 'w-3.5 h-3.5')}
              </div>
              <div className="text-[11px] font-semibold text-slate-200 truncate" title={step.condition.label}>
                {step.condition.label}
              </div>
              <div className="text-[10px] text-slate-400 tabular-nums">
                {Math.round(step.condition.intensity * 100)}% ·{' '}
                <span className={step.isFavorableForSituationCards ? 'text-emerald-400' : 'text-amber-400'}>
                  {step.situationSuccessPercent}% éxito
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estado de Carga */}
      {loading && (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Analizando pronóstico climático, historial de turnos y recursos del tablero...</span>
          </div>
          <div className="h-3 w-3/4 rounded bg-slate-800" />
          <div className="h-3 w-full rounded bg-slate-800" />
          <div className="h-3 w-5/6 rounded bg-slate-800" />
        </div>
      )}

      {/* Error */}
      {!loading && errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-700/70 text-xs text-rose-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-100">No se pudo generar el parte meteorológico</div>
              <p className="text-rose-200/90 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => fetchInsight()}
              className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-semibold text-[11px] transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Informe Estratégico Estructurado */}
      {!loading && !errorMsg && insight && (
        <div className="space-y-3 text-xs">
          {/* Titular + Riesgo */}
          <div className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-sm text-white leading-snug">
                {insight.headline}
              </div>
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 ${riskBadgeClass}`}
              >
                {insight.riskLevel}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {insight.forecastSummary}
            </p>
          </div>

          {/* Recursos Prioritarios */}
          {insight.prioritizedResources?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-300 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Recursos Prioritarios</span>
              </div>
              <div className="space-y-1.5">
                {insight.prioritizedResources.map((item, idx) => (
                  <div
                    key={`${item.target}-${idx}`}
                    className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/90 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{item.target}</span>
                      <span className="px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-800/70 text-[10px] font-semibold shrink-0">
                        {item.action}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisión Barrial y Posicionamiento */}
          <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              <span>Decisiones Barriales y Posicionamiento</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              {insight.neighborhoodAdvice}
            </p>
          </div>

          {/* Acción inmediata sugerida */}
          <div className="p-3 rounded-xl bg-cyan-950/35 border border-cyan-800/60 flex items-start gap-2">
            <Compass className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                Acción Recomendada Este Turno
              </div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{insight.nextTurnAction}</span>
              </div>
            </div>
          </div>
        </div>
      )}
        </HudPanelMotion>
      )}
    </AnimatePresence>
  );
};
