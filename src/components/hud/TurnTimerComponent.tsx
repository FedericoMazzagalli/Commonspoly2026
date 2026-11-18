/**
 * TurnTimerComponent.tsx
 * Temporizador visual de turno en el HUD de Commonspoly.
 * Rastrea el tiempo disponible para la jugada del personaje humano activo,
 * con anillo SVG animado, barra de progreso y animación sutil de advertencia
 * cuando queda poco tiempo, fomentando el juego estratégico sin bloquear la lectura de reglas/modales.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Pause, Play, AlertTriangle, Bot } from 'lucide-react';
import { Character, GamePhase } from '../../types/game';
import { playSound } from '../../utils/audio';

interface TurnTimerComponentProps {
  activePlayer: Character | undefined;
  activePlayerIndex: number;
  round: number;
  phase: GamePhase;
  isPausedByOverlay: boolean;
  durationSeconds?: number;
  onTimeout: () => void;
}

export const TurnTimerComponent: React.FC<TurnTimerComponentProps> = ({
  activePlayer,
  activePlayerIndex,
  round,
  phase,
  isPausedByOverlay,
  durationSeconds = 45,
  onTimeout
}) => {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const timeoutFiredRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const isHumanTurnDecision =
    activePlayer?.controller === 'HUMAN' &&
    (phase === 'PLAYER_TURN_READY' || phase === 'TILE_ACTION_DECISION');

  const isTimerActive = isHumanTurnDecision && !isPausedByOverlay && !isManualPaused;

  // Reiniciar el temporizador cada vez que cambia el jugador, la ronda o la fase de decisión
  useEffect(() => {
    setSecondsLeft(durationSeconds);
    timeoutFiredRef.current = false;
  }, [activePlayerIndex, round, phase, durationSeconds]);

  // Cuenta regresiva por segundo mientras la jugada humana está activa
  useEffect(() => {
    if (!isTimerActive) return;

    const interval = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isTimerActive]);

  // Ejecutar acción automática al llegar a 0
  useEffect(() => {
    if (secondsLeft === 0 && isTimerActive && !timeoutFiredRef.current) {
      timeoutFiredRef.current = true;
      onTimeoutRef.current();
    }
  }, [secondsLeft, isTimerActive]);

  if (!activePlayer) return null;

  const progress = Math.max(0, Math.min(1, secondsLeft / durationSeconds));
  const isWarning = isHumanTurnDecision && secondsLeft <= 12 && secondsLeft > 5;
  const isCritical = isHumanTurnDecision && secondsLeft <= 5;

  // Geometría del anillo SVG
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const ringColor = isCritical
    ? '#f43f5e' // Rose
    : isWarning
    ? '#f59e0b' // Amber
    : '#14b8a6'; // Teal

  const badgeText =
    activePlayer.controller === 'BOT'
      ? 'Turno IA'
      : isPausedByOverlay
      ? 'Pausado (Modal)'
      : isManualPaused
      ? 'En pausa'
      : isCritical
      ? '¡Decide ahora!'
      : isWarning
      ? 'Poco tiempo'
      : phase === 'TILE_ACTION_DECISION'
      ? 'Decisión'
      : 'Tu jugada';

  return (
    <motion.div
      aria-label="Temporizador de Turno"
      animate={
        isCritical && isTimerActive
          ? { scale: [1, 1.03, 1], boxShadow: ['0 0 0 rgba(244,63,94,0)', '0 0 18px rgba(244,63,94,0.45)', '0 0 0 rgba(244,63,94,0)'] }
          : isWarning && isTimerActive
          ? { boxShadow: ['0 0 0 rgba(245,158,11,0)', '0 0 12px rgba(245,158,11,0.32)', '0 0 0 rgba(245,158,11,0)'] }
          : { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }
      }
      transition={
        (isCritical || isWarning) && isTimerActive
          ? { duration: isCritical ? 0.85 : 1.4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      className={`pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border text-xs transition-colors ${
        isCritical
          ? 'bg-rose-950/90 border-rose-500/80 text-rose-100'
          : isWarning
          ? 'bg-amber-950/85 border-amber-500/75 text-amber-100'
          : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
      }`}
    >
      {/* Anillo SVG de cuenta regresiva */}
      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="3"
          />
          {activePlayer.controller === 'HUMAN' && (
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.35s linear, stroke 0.25s ease' }}
            />
          )}
        </svg>

        <span className="absolute inset-0 flex items-center justify-center font-black text-[10px] tabular-nums">
          {activePlayer.controller === 'BOT' ? (
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            `${secondsLeft}s`
          )}
        </span>
      </div>

      {/* Etiqueta y barra de tiempo */}
      <div className="flex flex-col min-w-[88px] gap-1">
        <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold leading-none">
          <span className="flex items-center gap-1">
            {isCritical || isWarning ? (
              <AlertTriangle
                className={`w-3 h-3 ${isCritical ? 'text-rose-400 animate-bounce' : 'text-amber-400'}`}
              />
            ) : (
              <Clock className="w-3 h-3 text-teal-400" />
            )}
            <span>{badgeText}</span>
          </span>
        </div>

        {activePlayer.controller === 'HUMAN' ? (
          <div className="h-1.5 w-full rounded-full bg-slate-950/90 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-linear ${
                isCritical
                  ? 'bg-rose-500'
                  : isWarning
                  ? 'bg-amber-400'
                  : 'bg-teal-400'
              }`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : (
          <div className="text-[9px] text-indigo-300/90 font-medium leading-none">
            IA calculando...
          </div>
        )}
      </div>

      {/* Botón Pausar / Reanudar para estrategia cooperativa */}
      {isHumanTurnDecision && (
        <button
          type="button"
          onClick={() => {
            playSound.uiToggle(isManualPaused);
            setIsManualPaused(p => !p);
          }}
          className="p-1.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors shrink-0"
          title={isManualPaused ? 'Reanudar temporizador' : 'Pausar para deliberar'}
          aria-label={isManualPaused ? 'Reanudar temporizador' : 'Pausar temporizador'}
        >
          {isManualPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
        </button>
      )}
    </motion.div>
  );
};
