/**
 * GameToastHUD.tsx
 * Sistema de notificaciones 'toast' no intrusivo para mejorar la consciencia situacional:
 * - Recursos completados / comunalizados por otros jugadores o bots
 * - Categorías de bienes completadas al 100%
 * - Cartas de evento global aplicadas al inicio de ronda
 * - Hitos del Ágora Central, rescates solidarios, protección mutua y alertas de riesgo
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trees,
  Globe,
  HeartHandshake,
  Flame,
  AlertTriangle,
  Sparkles,
  Layers,
  Award,
  CloudRain,
  Snowflake,
  Sun,
  Wind,
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import {
  GameEngineState,
  GameLogEntry,
  GoodType,
  ReputationTierId,
  WeatherType
} from '../../types/game';
import { playSound } from '../../utils/audio';
import { resolveWeather } from '../../utils/weather';
import { formatWeatherImpactSummary } from '../../utils/weatherEvents';
import { formatSignedScore, getReputationProfile } from '../../utils/reputation';

interface GameToastHUDProps {
  state: GameEngineState;
  onOpenHistory?: () => void;
  topOffsetClass?: string;
}

type ToastTone =
  | 'COMMON'
  | 'PUBLIC'
  | 'GLOBAL'
  | 'AGORA'
  | 'COOP'
  | 'HAZARD'
  | 'WEATHER_HAZARD'
  | 'WEATHER_BENEFICIAL'
  | 'WEATHER_SHIFT'
  | 'REPUTATION_UP'
  | 'REPUTATION_DOWN';

interface ToastItem {
  id: string;
  tone: ToastTone;
  categoryLabel: string;
  title: string;
  message: string;
  round: number;
  actorColor?: string;
  weatherType?: WeatherType;
}

const GOOD_CATEGORY_LABELS: Record<GoodType, string> = {
  HEALTH: 'Bienes de la Salud',
  URBAN: 'Bienes Urbanos',
  KNOWLEDGE: 'Bienes del Conocimiento',
  ENVIRONMENT: 'Bienes Medioambientales'
};

const MAX_VISIBLE_TOASTS = 3;
const TOAST_DURATION_MS = 5000;

export const GameToastHUD: React.FC<GameToastHUDProps> = ({
  state,
  onOpenHistory,
  topOffsetClass = 'top-16'
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  const seenLogIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);
  const prevCompletedCategoriesRef = useRef<Set<GoodType>>(new Set());
  const prevAgoraReadyRef = useRef<boolean>(false);
  const prevWeatherEventIdRef = useRef<string | null>(state.activeWeatherEvent?.id ?? null);
  const prevResolvedWeatherTypeRef = useRef<WeatherType | null>(null);
  const prevReputationTiersRef = useRef<Map<string, ReputationTierId>>(new Map());

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>, playAlertSfx = true) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [{ ...toast, id }, ...prev].slice(0, MAX_VISIBLE_TOASTS));
    if (playAlertSfx) {
      playSound.notification();
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-expiración de notificaciones (en pausa mientras el puntero está encima)
  useEffect(() => {
    if (toasts.length === 0 || isHovering) return;
    const timer = window.setTimeout(() => {
      setToasts(prev => prev.slice(0, -1));
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toasts, isHovering]);

  // 1. Detectar eventos clave a partir de nuevos registros de partida
  useEffect(() => {
    if (!isInitializedRef.current) {
      state.logs.forEach(l => seenLogIdsRef.current.add(l.id));
      isInitializedRef.current = true;
      return;
    }

    const newLogs = state.logs.filter(l => !seenLogIdsRef.current.has(l.id));
    if (newLogs.length === 0) return;

    // Procesar en orden cronológico (más antiguo de los nuevos -> más reciente)
    [...newLogs].reverse().forEach((entry: GameLogEntry) => {
      seenLogIdsRef.current.add(entry.id);

      // Carta de evento global aplicada
      if (entry.type === 'CARD' || entry.actor === 'Carta Global') {
        pushToast({
          tone: 'GLOBAL',
          categoryLabel: 'Evento Global',
          title: `Carta Global · Ronda ${entry.round}`,
          message: entry.message,
          round: entry.round,
          actorColor: '#f59e0b'
        });
        return;
      }

      // Recurso comunalizado / desprivatizado
      if (entry.cooperativeAction === 'COMMON_UNLOCK') {
        pushToast({
          tone: 'COMMON',
          categoryLabel: 'Recurso Común',
          title: `${entry.actor} completó un Bien Común`,
          message: entry.target
            ? `"${entry.target}" pasa a gestión comunitaria.`
            : entry.message,
          round: entry.round,
          actorColor: entry.actorColor
        });
        return;
      }

      // Recurso convertido a Gestión Pública
      if (entry.cooperativeAction === 'PUBLIC_UNLOCK' || entry.cooperativeAction === 'BUROCRACIA') {
        pushToast({
          tone: 'PUBLIC',
          categoryLabel: 'Gestión Pública',
          title: `${entry.actor} desprivatizó un recurso`,
          message: entry.target
            ? `"${entry.target}" convertido en Bien Público.`
            : entry.message,
          round: entry.round,
          actorColor: entry.actorColor
        });
        return;
      }

      // Insurrección en el Ágora o voto colectivo
      if (entry.cooperativeAction === 'AGORA_INSURRECTION' || entry.cooperativeAction === 'COLLECTIVE_VOTE') {
        pushToast({
          tone: 'AGORA',
          categoryLabel: 'Ágora Central',
          title: entry.actor === 'Ágora Asamblearia' ? '¡Insurrección Colectiva!' : `${entry.actor} en el Ágora`,
          message: entry.message,
          round: entry.round,
          actorColor: entry.actorColor || '#ec4899'
        });
        return;
      }

      // Rescate solidario, protección mutua y crowdfunding
      if (
        entry.cooperativeAction === 'RESCUE' ||
        entry.cooperativeAction === 'PROTECTION' ||
        entry.cooperativeAction === 'CROWDFUND'
      ) {
        const title =
          entry.cooperativeAction === 'RESCUE'
            ? `Rescate solidario de ${entry.actor}`
            : entry.cooperativeAction === 'PROTECTION'
            ? '¡Protección mutua activada!'
            : `Apoyo mutuo de ${entry.actor}`;
        pushToast({
          tone: 'COOP',
          categoryLabel: 'Cooperación',
          title,
          message: entry.message,
          round: entry.round,
          actorColor: entry.actorColor
        });
        return;
      }

      // Amenazas / Especuladores / Casillas de riesgo
      if (entry.type === 'HAZARD') {
        pushToast({
          tone: 'HAZARD',
          categoryLabel: 'Alerta',
          title: entry.actor,
          message: entry.message,
          round: entry.round,
          actorColor: '#f43f5e'
        });
      }
    });
  }, [state.logs, pushToast]);

  // 2. Detectar completado del 100% de cualquier categoría de bienes comunes
  useEffect(() => {
    const resourceTiles = state.tiles.filter(
      t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
    );
    const categories: GoodType[] = ['HEALTH', 'URBAN', 'KNOWLEDGE', 'ENVIRONMENT'];
    const currentCompleted = new Set<GoodType>();

    categories.forEach(cat => {
      const catTiles = resourceTiles.filter(t => t.goodType === cat);
      if (catTiles.length > 0 && catTiles.every(t => t.state === 'COMMON')) {
        currentCompleted.add(cat);
      }
    });

    if (prevCompletedCategoriesRef.current.size === 0 && currentCompleted.size > 0 && state.round === 1 && state.logs.length <= 1) {
      prevCompletedCategoriesRef.current = currentCompleted;
      return;
    }

    currentCompleted.forEach(cat => {
      if (!prevCompletedCategoriesRef.current.has(cat)) {
        pushToast({
          tone: 'COMMON',
          categoryLabel: 'Sector Completo',
          title: `¡${GOOD_CATEGORY_LABELS[cat]} al 100%!`,
          message: 'Todos los recursos de este sector son ahora Bienes Comunes.',
          round: state.round,
          actorColor: '#10b981'
        });
      }
    });

    prevCompletedCategoriesRef.current = currentCompleted;
  }, [state.tiles, state.round, state.logs.length, pushToast]);

  // 3. Detectar cuando se alcanza la Legitimidad Colectiva requerida para entrar al Ágora
  useEffect(() => {
    const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
    const required = state.players.length * 10;
    const isReady = state.players.length > 0 && totalLegitimacy >= required;

    if (isReady && !prevAgoraReadyRef.current && state.phase !== 'TITLE' && state.phase !== 'SETUP') {
      pushToast({
        tone: 'AGORA',
        categoryLabel: 'Hito Colectivo',
        title: '¡Legitimidad suficiente para el Ágora!',
        message: `El grupo alcanzó ${totalLegitimacy}/${required} de Legitimidad Colectiva.`,
        round: state.round,
        actorColor: '#ec4899'
      });
    }
    prevAgoraReadyRef.current = isReady;
  }, [state.players, state.phase, state.round, pushToast]);

  // 4. Alertas visuales cuando cambia el clima dinámico o se activa un evento meteorológico
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      prevWeatherEventIdRef.current = state.activeWeatherEvent?.id ?? null;
      prevResolvedWeatherTypeRef.current = null;
      return;
    }

    const resolved = resolveWeather(
      state.tiles,
      state.weatherMode,
      state.weatherIntensity ?? 0.85,
      state.round,
      state.activePlayerIndex,
      state.activeWeatherEvent
    );

    const activeEvent = state.activeWeatherEvent ?? null;
    const currentEventId = activeEvent?.id ?? null;
    let emittedWeatherEventToast = false;

    if (currentEventId && currentEventId !== prevWeatherEventIdRef.current && activeEvent) {
      const tone: ToastTone =
        activeEvent.severity === 'BENEFICIAL' ? 'WEATHER_BENEFICIAL' : 'WEATHER_HAZARD';
      const impact = formatWeatherImpactSummary(activeEvent);
      const affectedPreview = activeEvent.affectedTileNames.slice(0, 3).join(', ');
      const extraCount =
        activeEvent.affectedTileNames.length > 3
          ? ` (+${activeEvent.affectedTileNames.length - 3})`
          : '';

      pushToast(
        {
          tone,
          categoryLabel: 'Alerta Meteorológica',
          title: `${activeEvent.title} · ${activeEvent.totalTurns} turnos`,
          message: `${impact} en ${affectedPreview}${extraCount}.`,
          round: state.round,
          weatherType: activeEvent.weatherType
        },
        false
      );
      emittedWeatherEventToast = true;
    }

    if (
      !emittedWeatherEventToast &&
      prevResolvedWeatherTypeRef.current !== null &&
      prevResolvedWeatherTypeRef.current !== resolved.type
    ) {
      pushToast(
        {
          tone: 'WEATHER_SHIFT',
          categoryLabel: 'Cambio de Clima',
          title: `Clima actual: ${resolved.label}`,
          message: resolved.description,
          round: state.round,
          weatherType: resolved.type
        },
        true
      );
    }

    prevWeatherEventIdRef.current = currentEventId;
    prevResolvedWeatherTypeRef.current = resolved.type;
  }, [
    state.activeWeatherEvent,
    state.tiles,
    state.weatherMode,
    state.weatherIntensity,
    state.round,
    state.activePlayerIndex,
    state.phase,
    pushToast
  ]);

  // 5. Detectar cambios de nivel en la Reputación Vecinal de cualquier jugadora
  useEffect(() => {
    const tierRank: Record<ReputationTierId, number> = {
      DISTRUSTED: 0,
      SUSPECT: 1,
      NEUTRAL: 2,
      TRUSTED: 3,
      EXEMPLARY: 4
    };

    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      const resetMap = new Map<string, ReputationTierId>();
      state.players.forEach(p => {
        resetMap.set(p.id, getReputationProfile(p).tierId);
      });
      prevReputationTiersRef.current = resetMap;
      return;
    }

    if (prevReputationTiersRef.current.size === 0) {
      state.players.forEach(p => {
        prevReputationTiersRef.current.set(p.id, getReputationProfile(p).tierId);
      });
      return;
    }

    const nextMap = new Map<string, ReputationTierId>();
    state.players.forEach(player => {
      const profile = getReputationProfile(player);
      const prevTier = prevReputationTiersRef.current.get(player.id);
      nextMap.set(player.id, profile.tierId);

      if (prevTier && prevTier !== profile.tierId) {
        const isUpgrade = tierRank[profile.tierId] > tierRank[prevTier];
        const costText =
          profile.transactionCostDelta === 0
            ? 'precios estándar'
            : profile.transactionCostDelta < 0
            ? `${profile.transactionCostDelta} coste en transacciones`
            : `+${profile.transactionCostDelta} recargo en transacciones`;

        pushToast(
          {
            tone: isUpgrade ? 'REPUTATION_UP' : 'REPUTATION_DOWN',
            categoryLabel: 'Reputación Vecinal',
            title: `${player.name}: ${profile.label} (${formatSignedScore(profile.score)})`,
            message: `Ahora aplica ${costText}, peso de voto ${profile.voteWeight}x y ${profile.trustPercent}% de confianza barrial.`,
            round: state.round,
            actorColor: player.color
          },
          true
        );
      }
    });

    prevReputationTiersRef.current = nextMap;
  }, [state.players, state.phase, state.round, pushToast]);

  if (toasts.length === 0) return null;

  const getWeatherIcon = (wType?: WeatherType) => {
    switch (wType) {
      case 'RAIN':
        return <CloudRain className="w-4 h-4" />;
      case 'SNOW':
        return <Snowflake className="w-4 h-4" />;
      case 'SUNNY':
        return <Sun className="w-4 h-4" />;
      case 'DROUGHT':
        return <Flame className="w-4 h-4" />;
      case 'TEMPERATE':
      default:
        return <Wind className="w-4 h-4" />;
    }
  };

  const getToneStyle = (tone: ToastTone, weatherType?: WeatherType) => {
    switch (tone) {
      case 'WEATHER_HAZARD':
        return {
          border: 'border-orange-500/70',
          iconWrap: 'bg-orange-500/15 text-orange-300',
          labelColor: 'text-orange-300',
          icon: getWeatherIcon(weatherType)
        };
      case 'WEATHER_BENEFICIAL':
        return {
          border: 'border-emerald-400/70',
          iconWrap: 'bg-emerald-500/15 text-emerald-300',
          labelColor: 'text-emerald-300',
          icon: getWeatherIcon(weatherType)
        };
      case 'WEATHER_SHIFT':
        return {
          border: 'border-cyan-500/70',
          iconWrap: 'bg-cyan-500/15 text-cyan-300',
          labelColor: 'text-cyan-300',
          icon: getWeatherIcon(weatherType)
        };
      case 'REPUTATION_UP':
        return {
          border: 'border-emerald-500/70',
          iconWrap: 'bg-emerald-500/15 text-emerald-300',
          labelColor: 'text-emerald-300',
          icon: <ShieldCheck className="w-4 h-4" />
        };
      case 'REPUTATION_DOWN':
        return {
          border: 'border-rose-500/70',
          iconWrap: 'bg-rose-500/15 text-rose-300',
          labelColor: 'text-rose-300',
          icon: <ShieldAlert className="w-4 h-4" />
        };
      case 'COMMON':
        return {
          border: 'border-emerald-500/60',
          iconWrap: 'bg-emerald-500/15 text-emerald-400',
          labelColor: 'text-emerald-400',
          icon: <Trees className="w-4 h-4" />
        };
      case 'PUBLIC':
        return {
          border: 'border-sky-500/60',
          iconWrap: 'bg-sky-500/15 text-sky-400',
          labelColor: 'text-sky-400',
          icon: <Layers className="w-4 h-4" />
        };
      case 'GLOBAL':
        return {
          border: 'border-amber-500/60',
          iconWrap: 'bg-amber-500/15 text-amber-400',
          labelColor: 'text-amber-400',
          icon: <Globe className="w-4 h-4" />
        };
      case 'AGORA':
        return {
          border: 'border-pink-500/60',
          iconWrap: 'bg-pink-500/15 text-pink-400',
          labelColor: 'text-pink-400',
          icon: <Flame className="w-4 h-4" />
        };
      case 'HAZARD':
        return {
          border: 'border-rose-500/60',
          iconWrap: 'bg-rose-500/15 text-rose-400',
          labelColor: 'text-rose-400',
          icon: <AlertTriangle className="w-4 h-4" />
        };
      case 'COOP':
      default:
        return {
          border: 'border-teal-500/60',
          iconWrap: 'bg-teal-500/15 text-teal-400',
          labelColor: 'text-teal-400',
          icon: <HeartHandshake className="w-4 h-4" />
        };
    }
  };

  return (
    <div
      role="region"
      aria-label="Notificaciones de eventos clave"
      aria-live="polite"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`pointer-events-none fixed ${topOffsetClass} left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md flex flex-col gap-2 transition-all duration-200`}
    >
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const style = getToneStyle(toast.tone, toast.weatherType);
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`pointer-events-auto bg-slate-900/95 border ${style.border} rounded-xl shadow-2xl px-3.5 py-2.5 text-slate-100 flex items-start gap-2.5`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${style.iconWrap}`}>
                {style.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 tabular-nums">
                  <span className={`font-bold uppercase tracking-wider ${style.labelColor}`}>
                    {toast.categoryLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Ronda {toast.round}</span>
                  {onOpenHistory && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          onOpenHistory();
                          dismissToast(toast.id);
                        }}
                        className="text-slate-300 hover:text-teal-300 underline transition-colors"
                      >
                        Historial
                      </button>
                    </>
                  )}
                </div>

                <div className="text-xs font-bold text-white leading-snug mt-0.5 flex items-center gap-1.5">
                  {toast.tone === 'COMMON' && <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {toast.tone === 'GLOBAL' && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="truncate">{toast.title}</span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 mt-0.5">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  dismissToast(toast.id);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Cerrar notificación"
                title="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
