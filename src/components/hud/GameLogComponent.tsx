/**
 * GameLogComponent.tsx
 * Superposición semi-transparente en la esquina inferior izquierda del HUD de Commonspoly.
 * Monitorea el estado completo de la partida (logs estructurados y transiciones colectivas)
 * para mostrar eventos cooperativos (rescates, desprivatizaciones, protección mutua,
 * crowdfunding e insurrección del Ágora) en una lista desplazable con auto-scroll.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  HeartHandshake,
  Sparkles,
  Trees,
  Flame,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ScrollText,
  Clock,
  Award,
  Shield,
  Vote
} from 'lucide-react';
import {
  GameEngineState,
  GameLogEntry,
  CooperativeActionType
} from '../../types/game';
import { playSound } from '../../utils/audio';
import { useSwipeToDismiss } from '../ui/MotionPrimitives';

interface GameLogComponentProps {
  state: GameEngineState;
  isDockCollapsed?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  variant?: 'floating' | 'sheet';
}

export const GameLogComponent: React.FC<GameLogComponentProps> = ({
  state,
  isDockCollapsed = false,
  isMinimized: controlledMinimized,
  onToggleMinimize,
  variant = 'floating'
}) => {
  const isSheet = variant === 'sheet';
  const [internalMinimized, setInternalMinimized] = useState(true);
  const isMinimized = isSheet ? false : (controlledMinimized ?? internalMinimized);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stateEvents, setStateEvents] = useState<GameLogEntry[]>([]);
  const hasInitializedUnreadRef = useRef(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Snapshot previo para monitorear hitos colectivos desde el estado de la partida
  const prevMonitorRef = useRef<{
    agoraUnlocked: boolean;
    zeroPrivateReached: boolean;
    detainedIds: string[];
    phase: GameEngineState['phase'];
    seenLogCount: number;
  }>({
    agoraUnlocked: false,
    zeroPrivateReached: false,
    detainedIds: [],
    phase: state.phase,
    seenLogCount: 0
  });

  // Métricas colectivas en vivo calculadas desde el estado del gameEngine
  const resourceTiles = state.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
  const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;
  const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
  const requiredLegitimacy = state.players.length * 10;
  const currentDetainedIds = state.players.filter(p => p.isDetained).map(p => p.id);
  const detainedSignature = currentDetainedIds.join(',');

  // Monitoreo continuo del estado del gameEngine para registrar eventos de colaboración automáticamente
  useEffect(() => {
    const prev = prevMonitorRef.current;
    const newSynthetic: GameLogEntry[] = [];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Reiniciar eventos sintéticos si inicia nueva partida desde setup/title
    if (prev.phase !== state.phase && (state.phase === 'TITLE' || state.phase === 'SETUP')) {
      setStateEvents([]);
      setUnreadCount(0);
      prevMonitorRef.current = {
        agoraUnlocked: false,
        zeroPrivateReached: false,
        detainedIds: [],
        phase: state.phase,
        seenLogCount: state.logs.length
      };
      return;
    }

    // Detectar rescate/liberación de detención si no quedó ya registrado en el log más reciente
    const releasedIds = prev.detainedIds.filter(id => !currentDetainedIds.includes(id));
    if (releasedIds.length > 0 && state.phase !== 'TITLE' && state.phase !== 'SETUP') {
      const latestLog = state.logs[0];
      const alreadyLoggedRescue = latestLog?.cooperativeAction === 'RESCUE';
      if (!alreadyLoggedRescue) {
        releasedIds.forEach(id => {
          const freed = state.players.find(p => p.id === id);
          if (freed) {
            newSynthetic.push({
              id: `coop_freed_${freed.id}_${state.round}_${Date.now()}`,
              round: state.round,
              timestamp: nowTime,
              actor: freed.name,
              actorColor: freed.color,
              message: `${freed.name} ha recuperado la libertad y se reincorpora a la acción colectiva.`,
              type: 'SUCCESS',
              category: 'COOPERATIVE',
              cooperativeAction: 'RESCUE',
              highlight: true
            });
          }
        });
      }
    }

    const agoraReady = totalLegitimacy >= requiredLegitimacy && state.players.length > 0;
    if (agoraReady && !prev.agoraUnlocked && state.phase !== 'TITLE' && state.phase !== 'SETUP') {
      newSynthetic.push({
        id: `coop_agora_ready_${state.round}_${Date.now()}`,
        round: state.round,
        timestamp: nowTime,
        actor: 'Comunidad',
        message: `¡Umbral colectivo alcanzado (${totalLegitimacy}/${requiredLegitimacy} Legitimidad)! El Ágora Central está abierta para la Insurrección.`,
        type: 'SUCCESS',
        category: 'COOPERATIVE',
        cooperativeAction: 'SOLIDARITY',
        highlight: true
      });
    }

    const zeroPrivate = resourceTiles.length > 0 && privateCount === 0;
    if (zeroPrivate && !prev.zeroPrivateReached && state.phase !== 'TITLE' && state.phase !== 'SETUP') {
      newSynthetic.push({
        id: `coop_zero_private_${state.round}_${Date.now()}`,
        round: state.round,
        timestamp: nowTime,
        actor: 'Sociedad Común',
        message: '¡Cero bienes privatizados en el tablero! Todos los recursos son ya Públicos o Comunes.',
        type: 'SUCCESS',
        category: 'COOPERATIVE',
        cooperativeAction: 'COMMON_UNLOCK',
        highlight: true
      });
    }

    if (newSynthetic.length > 0) {
      setStateEvents(current => [...current, ...newSynthetic].slice(-15));
    }

    prevMonitorRef.current = {
      agoraUnlocked: agoraReady,
      zeroPrivateReached: zeroPrivate,
      detainedIds: currentDetainedIds,
      phase: state.phase,
      seenLogCount: prev.seenLogCount
    };
  }, [
    state.phase,
    state.round,
    state.players.length,
    totalLegitimacy,
    requiredLegitimacy,
    resourceTiles.length,
    privateCount,
    detainedSignature
  ]);

  // Combinar logs cooperativos del estado + hitos detectados por monitoreo
  const cooperativeLogs = useMemo(() => {
    const filtered = state.logs
      .filter(
        log =>
          log.category === 'COOPERATIVE' ||
          Boolean(log.cooperativeAction) ||
          log.type === 'SUCCESS'
      )
      .slice(0, 35)
      .reverse();

    return [...filtered, ...stateEvents].slice(-35);
  }, [state.logs, stateEvents]);

  // Auto-scroll suave y contador de no leídos cuando está minimizado
  useEffect(() => {
    if (!hasInitializedUnreadRef.current) {
      hasInitializedUnreadRef.current = true;
      prevMonitorRef.current.seenLogCount = cooperativeLogs.length;
      return;
    }

    const prevCount = prevMonitorRef.current.seenLogCount;
    if (cooperativeLogs.length > prevCount && isMinimized) {
      setUnreadCount(u => u + (cooperativeLogs.length - prevCount));
    }
    if (!isMinimized) {
      setUnreadCount(0);
    }
    prevMonitorRef.current.seenLogCount = cooperativeLogs.length;

    if (!isMinimized && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [cooperativeLogs.length, isMinimized]);

  const handleToggleMinimize = () => {
    const willExpand = isMinimized;
    playSound.uiToggle(willExpand);
    if (willExpand) {
      setUnreadCount(0);
    }
    if (onToggleMinimize) {
      onToggleMinimize();
    } else {
      setInternalMinimized(prev => !prev);
    }
  };

  const getActionIcon = (action?: CooperativeActionType) => {
    switch (action) {
      case 'RESCUE':
        return <HeartHandshake className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'COLLECTIVE_VOTE':
        return <Vote className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
      case 'PROTECTION':
        return <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case 'COMMON_UNLOCK':
        return <Trees className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'PUBLIC_UNLOCK':
      case 'BUROCRACIA':
        return <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'AGORA_INSURRECTION':
        return <Flame className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
      case 'CROWDFUND':
        return <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'SOLIDARITY':
        return <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    }
  };

  const getActionBadgeLabel = (action?: CooperativeActionType) => {
    switch (action) {
      case 'RESCUE':
        return 'Rescate';
      case 'COLLECTIVE_VOTE':
        return 'Voto Colectivo';
      case 'PROTECTION':
        return 'Protección';
      case 'COMMON_UNLOCK':
        return 'Común';
      case 'PUBLIC_UNLOCK':
      case 'BUROCRACIA':
        return 'Público';
      case 'AGORA_INSURRECTION':
        return 'Ágora';
      case 'CROWDFUND':
        return 'Apoyo';
      case 'SOLIDARITY':
        return 'Colectivo';
      default:
        return 'Logro';
    }
  };

  const { swipeX, swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: 'down',
    enabled: !isSheet && !isMinimized,
    resetOnDismiss: true,
    onDismiss: handleToggleMinimize
  });

  if (isSheet) {
    return (
      <div className="flex flex-col gap-2.5 text-slate-100">
        {/* Barra de estado cooperativo en vivo */}
        <div className="px-3 py-2 rounded-xl bg-slate-950/75 border border-slate-800 flex items-center justify-between text-xs text-slate-300 tabular-nums">
          <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <Trees className="w-3.5 h-3.5" />
            {commonCount}/{resourceTiles.length} Comunes
          </span>
          <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <Award className="w-3.5 h-3.5" />
            {totalLegitimacy}/{requiredLegitimacy} Legit.
          </span>
        </div>

        <div
          ref={scrollContainerRef}
          className="space-y-2 text-xs scroll-smooth"
        >
          {cooperativeLogs.length > 0 ? (
            cooperativeLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border text-xs leading-snug transition-colors ${
                  log.highlight
                    ? 'bg-teal-950/45 border-teal-500/45'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400 mb-1">
                  <div className="flex items-center gap-1.5 font-semibold min-w-0">
                    {getActionIcon(log.cooperativeAction)}
                    <span
                      className="truncate text-white"
                      style={{ color: log.actorColor || undefined }}
                    >
                      {log.actor}
                    </span>
                    {log.cooperativeAction && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-teal-300 text-[9px] font-semibold shrink-0">
                        {getActionBadgeLabel(log.cooperativeAction)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 tabular-nums text-[10px] shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>
                      R{log.round} · {log.timestamp}
                    </span>
                  </div>
                </div>

                <p className="text-slate-200 pl-5">{log.message}</p>
              </div>
            ))
          ) : (
            <div className="py-8 px-3 text-center text-slate-400 text-xs italic">
              Esperando acciones colaborativas: desprivatizad bienes, protegeos o rescatad compañeras.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Posición en esquina inferior izquierda sin ocluir el dock central de acciones ni el temporizador
  const bottomOffsetClass = isDockCollapsed
    ? 'bottom-20 md:bottom-20'
    : 'bottom-52 md:bottom-44';

  return (
    <motion.aside
      aria-label="Registro de Eventos Cooperativos"
      style={{ x: swipeX, y: swipeY }}
      className={`pointer-events-auto fixed ${bottomOffsetClass} left-3 md:left-6 z-20 w-68 md:w-72 lg:w-80 max-w-[34vw] lg:max-w-[82vw] select-none transition-all duration-300 ${touchActionClass}`}
      {...swipeHandlers}
    >
      <div className="bg-slate-950/75 hover:bg-slate-950/88 border border-teal-700/50 hover:border-teal-500/75 rounded-2xl hud-surface overflow-hidden text-slate-100 transition-colors">
        {/* Cabecera compacta */}
        <button
          type="button"
          onClick={handleToggleMinimize}
          aria-expanded={!isMinimized}
          className="w-full min-h-[44px] sm:min-h-[36px] flex items-center justify-between px-3 py-2 bg-slate-900/75 border-b border-teal-800/35 cursor-pointer text-xs text-left"
        >
          <div className="flex items-center gap-2 font-bold text-teal-300 min-w-0">
            <ScrollText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">Acciones Cooperativas</span>
            <span className="text-[10px] text-slate-400 font-normal tabular-nums shrink-0">
              ({cooperativeLogs.length})
            </span>
            {isMinimized && unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-black tabular-nums shadow-sm">
                +{unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0 ml-2">
            <span className="tabular-nums">R{state.round}</span>
            <span className="p-0.5 text-slate-300">
              {isMinimized ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
        </button>

        {/* Lista desplazable semi-transparente */}
        {!isMinimized && (
          <>
            {/* Barra de estado cooperativo en vivo */}
            <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
              <span className="flex items-center gap-1 text-emerald-300 font-medium">
                <Trees className="w-3 h-3" />
                {commonCount}/{resourceTiles.length} Comunes
              </span>
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <Award className="w-3 h-3" />
                {totalLegitimacy}/{requiredLegitimacy} Legit.
              </span>
            </div>

            <div
              ref={scrollContainerRef}
              className="p-2.5 max-h-36 md:max-h-44 overflow-y-auto space-y-1.5 text-xs scroll-smooth"
            >
              {cooperativeLogs.length > 0 ? (
                cooperativeLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded-xl border text-[11px] leading-snug transition-colors ${
                      log.highlight
                        ? 'bg-teal-950/45 border-teal-500/45'
                        : 'bg-slate-900/50 border-slate-800/65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <div className="flex items-center gap-1.5 font-semibold min-w-0">
                        {getActionIcon(log.cooperativeAction)}
                        <span
                          className="truncate text-white"
                          style={{ color: log.actorColor || undefined }}
                        >
                          {log.actor}
                        </span>
                        {log.cooperativeAction && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-teal-300 text-[9px] font-semibold shrink-0">
                            {getActionBadgeLabel(log.cooperativeAction)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 tabular-nums text-[9px] shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        <span>
                          R{log.round} · {log.timestamp}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-200/95 pl-5">{log.message}</p>
                  </div>
                ))
              ) : (
                <div className="py-5 px-2 text-center text-slate-400 text-[11px] italic">
                  Esperando acciones colaborativas: desprivatizad bienes, protegeos o rescatad compañeras.
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
};
