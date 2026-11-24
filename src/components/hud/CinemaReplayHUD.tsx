/**
 * CinemaReplayHUD.tsx
 * Interfaz flotante de Modo Cine / Repetición de Partida.
 * Permite reproducir automáticamente los últimos fotogramas de estado almacenados,
 * cambiar el ángulo de cámara 3D, controlar la velocidad de reproducción y analizar
 * los deltas de decisión, logs y estadísticas por turno sin ocluir el tablero central.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  Dices,
  Film,
  Info,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  X
} from 'lucide-react';
import { GameLogEntry, Tile, TurnReplayFrame } from '../../types/game';
import { computeFrameDecisionDeltas } from '../../utils/replay';
import { formatSignedScore } from '../../utils/reputation';
import { playSound } from '../../utils/audio';

export type CinemaCameraMode = 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW';

interface CinemaReplayHUDProps {
  frames: TurnReplayFrame[];
  currentIndex: number;
  onSelectFrame: (idx: number) => void;
  isPlaying: boolean;
  onSetPlaying: (playing: boolean) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  cameraMode: CinemaCameraMode;
  onChangeCameraMode: (mode: CinemaCameraMode) => void;
  tiles: Tile[];
  onExit: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.5, 2.5];

function renderLogTypeIcon(type: GameLogEntry['type']) {
  if (type === 'SUCCESS') {
    return <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
  }
  if (type === 'HAZARD') {
    return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />;
  }
  if (type === 'CARD') {
    return <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />;
  }
  return <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />;
}

function DeltaReadout({ value, unit = '' }: { value: number; unit?: string }) {
  if (value === 0) {
    return <span className="text-[10px] text-slate-400 tabular-nums">0{unit}</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={`text-[10px] font-bold tabular-nums ${
        positive ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      {positive ? `+${value}` : value}
      {unit}
    </span>
  );
}

export const CinemaReplayHUD: React.FC<CinemaReplayHUDProps> = ({
  frames,
  currentIndex,
  onSelectFrame,
  isPlaying,
  onSetPlaying,
  playbackSpeed,
  onChangeSpeed,
  cameraMode,
  onChangeCameraMode,
  tiles,
  onExit
}) => {
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(true);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, frames.length - 1)));
  const currentFrame = frames[safeIndex] ?? null;
  const prevFrame = safeIndex > 0 ? frames[safeIndex - 1] : null;

  const tileNameMap = useMemo(() => {
    const map = new Map<number, string>();
    tiles.forEach(t => map.set(t.id, t.name));
    map.set(100, 'Ágora Central');
    return map;
  }, [tiles]);

  const analysis = useMemo(() => {
    if (!currentFrame) return null;
    return computeFrameDecisionDeltas(currentFrame, prevFrame);
  }, [currentFrame, prevFrame]);

  // Reproducción automática cronológica de fotogramas almacenados
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    if (safeIndex >= frames.length - 1) {
      onSetPlaying(false);
      return;
    }

    const intervalMs = Math.max(600, Math.round(2500 / playbackSpeed));
    const timer = window.setTimeout(() => {
      const next = safeIndex + 1;
      onSelectFrame(next);
      if (next >= frames.length - 1) {
        onSetPlaying(false);
      }
    }, intervalMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, safeIndex, frames.length, playbackSpeed, onSelectFrame, onSetPlaying]);

  // Atajos de transporte y cámara exclusivos del Modo Cine
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying && safeIndex >= frames.length - 1 && frames.length > 1) {
          onSelectFrame(0);
          onSetPlaying(true);
        } else {
          onSetPlaying(!isPlaying);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSetPlaying(false);
        onSelectFrame(Math.max(0, safeIndex - 1));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSetPlaying(false);
        onSelectFrame(Math.min(frames.length - 1, safeIndex + 1));
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        onSetPlaying(false);
        onSelectFrame(0);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        onSetPlaying(false);
        onSelectFrame(Math.max(0, frames.length - 1));
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        onChangeCameraMode('ISOMETRIC');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        onChangeCameraMode('TOP_DOWN');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        onChangeCameraMode('FOLLOW');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    isPlaying,
    safeIndex,
    frames.length,
    onSelectFrame,
    onSetPlaying,
    onChangeCameraMode
  ]);

  if (!currentFrame) {
    return null;
  }

  const handleTogglePlay = () => {
    playSound.uiClick();
    if (!isPlaying && safeIndex >= frames.length - 1 && frames.length > 1) {
      onSelectFrame(0);
      onSetPlaying(true);
      return;
    }
    onSetPlaying(!isPlaying);
  };

  const handleStep = (delta: number) => {
    playSound.uiClick();
    onSetPlaying(false);
    const next = Math.max(0, Math.min(frames.length - 1, safeIndex + delta));
    onSelectFrame(next);
  };

  const handleJumpStart = () => {
    playSound.uiClick();
    onSetPlaying(false);
    onSelectFrame(0);
  };

  const handleJumpEnd = () => {
    playSound.uiClick();
    onSetPlaying(false);
    onSelectFrame(Math.max(0, frames.length - 1));
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-3 sm:p-4 gap-3"
      role="region"
      aria-label="Modo Cine de Repetición de Partida"
    >
      {/* 1. BARRA SUPERIOR DE TELEMETRÍA Y CÁMARA */}
      <div className="hud-surface pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-slate-950/92 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm tracking-tight">
            <Film className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Modo Cine</span>
            <span className="text-slate-600 font-normal">·</span>
            <span className="text-slate-200 font-semibold tabular-nums">
              Fotograma {safeIndex + 1}/{frames.length}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 tabular-nums border-l border-slate-800 pl-3">
            <span className="font-semibold text-white">Ronda {currentFrame.round}/20</span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentFrame.actorColor }}
              />
              <span className="font-semibold text-slate-100 truncate max-w-[140px]">
                {currentFrame.actorName}
              </span>
            </span>
            {currentFrame.diceRoll !== null && (
              <>
                <span className="text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 text-teal-300 font-bold">
                  <Dices className="w-3.5 h-3.5" />
                  Dado {currentFrame.diceRoll}
                </span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-emerald-300 font-semibold">
              {currentFrame.commonCount} Comunes
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-sky-300">{currentFrame.publicCount} Públicos</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-300">{currentFrame.privateCount} Privados</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de ángulo de cámara 3D */}
          <div
            className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[11px]"
            role="group"
            aria-label="Ángulo de cámara en Modo Cine"
          >
            <span className="hidden md:inline-flex items-center gap-1 px-2 text-slate-400">
              <Camera className="w-3.5 h-3.5" />
            </span>
            {(
              [
                { id: 'FOLLOW', label: 'Seguimiento' },
                { id: 'ISOMETRIC', label: 'Isométrica' },
                { id: 'TOP_DOWN', label: 'Cenital' }
              ] as const
            ).map(cam => (
              <button
                key={cam.id}
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  onChangeCameraMode(cam.id);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  cameraMode === cam.id
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setShowAnalysisPanel(prev => !prev);
            }}
            className="min-h-[44px] sm:min-h-[34px] px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title={showAnalysisPanel ? 'Ocultar panel de análisis' : 'Mostrar panel de análisis'}
          >
            {showAnalysisPanel ? (
              <PanelRightClose className="w-3.5 h-3.5 text-teal-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-teal-400" />
            )}
            <span className="hidden md:inline">Análisis</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              onExit();
            }}
            className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Salir (Esc)</span>
          </button>
        </div>
      </div>

      {/* 2. FILA CENTRAL: PANEL DE ANÁLISIS DE DECISIONES (COLAPSABLE A LA DERECHA) */}
      <div className="flex-1 min-h-0 flex justify-end items-stretch overflow-hidden">
        {showAnalysisPanel && analysis && (
          <aside
            className="hud-surface pointer-events-auto w-full sm:w-80 md:w-96 max-h-full bg-slate-950/92 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-3 overflow-y-auto"
            aria-label="Análisis de decisiones del turno"
          >
            {/* Cabecera del turno */}
            <div className="space-y-1.5 border-b border-slate-800 pb-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
                <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Análisis del Turno
                </span>
                <span>{currentFrame.timestamp}</span>
              </div>
              <p className="text-xs font-semibold text-slate-100 leading-snug">
                {currentFrame.eventSummary}
              </p>

              {(currentFrame.activeWeatherTitle || currentFrame.activeCrisisTitle) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-300 pt-0.5">
                  {currentFrame.activeWeatherTitle && (
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <CloudLightning className="w-3.5 h-3.5 shrink-0" />
                      Clima: {currentFrame.activeWeatherTitle}
                    </span>
                  )}
                  {currentFrame.activeWeatherTitle && currentFrame.activeCrisisTitle && (
                    <span className="text-slate-600">·</span>
                  )}
                  {currentFrame.activeCrisisTitle && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Crisis: {currentFrame.activeCrisisTitle}
                    </span>
                  )}
                </div>
              )}

              {/* Balance de cambios en el tablero respecto al fotograma anterior */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] tabular-nums">
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                  <span className="text-emerald-300">Comunes</span>
                  <span className="font-bold text-white">
                    {currentFrame.commonCount}{' '}
                    <DeltaReadout value={analysis.commonDelta} />
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                  <span className="text-sky-300">Públicos</span>
                  <span className="font-bold text-white">
                    {currentFrame.publicCount}{' '}
                    <DeltaReadout value={analysis.publicDelta} />
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center justify-between">
                  <span className="text-rose-300">Privados</span>
                  <span className="font-bold text-white">
                    {currentFrame.privateCount}{' '}
                    <DeltaReadout value={analysis.privateDelta} />
                  </span>
                </div>
              </div>
            </div>

            {/* Estado y deltas por participante */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Estado y Variación por Participante
              </div>
              <div className="space-y-1.5">
                {currentFrame.players.map((p, idx) => {
                  const delta = analysis.playerDeltas[p.id];
                  const isTurnActor =
                    p.id === currentFrame.actorId || idx === currentFrame.activePlayerIndex;
                  const tileName =
                    tileNameMap.get(p.position) ?? `Casilla #${p.position}`;
                  const prevTileName =
                    delta?.prevPosition !== null && delta?.prevPosition !== undefined
                      ? tileNameMap.get(delta.prevPosition) ?? `#${delta.prevPosition}`
                      : null;
                  const moved =
                    prevTileName !== null && delta && delta.prevPosition !== delta.nextPosition;

                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border px-2.5 py-2 space-y-1 ${
                        isTurnActor
                          ? 'bg-slate-900/95 border-teal-500/50'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="font-bold text-slate-100 truncate">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            · {p.controller === 'HUMAN' ? 'Humana' : 'Bot'}
                          </span>
                        </div>
                        {p.isDetained ? (
                          <span className="text-[10px] font-semibold text-rose-300">
                            Detenida ({p.detentionRoundsLeft}r)
                          </span>
                        ) : p.inAgora ? (
                          <span className="text-[10px] font-semibold text-amber-300">
                            En Ágora
                          </span>
                        ) : null}
                      </div>

                      <div className="text-[11px] text-slate-300 flex items-center gap-1 truncate">
                        {moved ? (
                          <>
                            <span className="text-slate-400 truncate">{prevTileName}</span>
                            <ArrowRight className="w-3 h-3 text-teal-400 shrink-0" />
                            <span className="text-teal-200 font-medium truncate">
                              {tileName}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 truncate">
                            Posición: {tileName}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px] tabular-nums pt-0.5">
                        <div className="flex items-center justify-between bg-slate-950/70 rounded px-1.5 py-0.5">
                          <span className="text-slate-400">Bien.</span>
                          <span className="font-bold text-emerald-300">
                            {p.wellness}{' '}
                            {delta && delta.wellnessDelta !== 0 && (
                              <DeltaReadout value={delta.wellnessDelta} />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-950/70 rounded px-1.5 py-0.5">
                          <span className="text-slate-400">Legit.</span>
                          <span className="font-bold text-sky-300">
                            {p.legitimacy}{' '}
                            {delta && delta.legitimacyDelta !== 0 && (
                              <DeltaReadout value={delta.legitimacyDelta} />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-950/70 rounded px-1.5 py-0.5">
                          <span className="text-slate-400 inline-flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3 text-teal-400" />
                            Rep.
                          </span>
                          <span className="font-bold text-slate-100">
                            {formatSignedScore(p.neighborhoodReputation)}{' '}
                            {delta && delta.reputationDelta !== 0 && (
                              <DeltaReadout value={delta.reputationDelta} />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Registro cronológico de logs almacenados para este turno */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Logs del Turno ({currentFrame.turnLogs.length})
              </div>
              {currentFrame.turnLogs.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">
                  Sin registros adicionales en este fotograma.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {currentFrame.turnLogs.map(log => (
                    <li
                      key={log.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-start gap-2 text-[11px] text-slate-200 leading-snug"
                    >
                      {renderLogTypeIcon(log.type)}
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 mr-1.5 tabular-nums">
                          R{log.round}
                        </span>
                        <span>{log.message}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. DOCK INFERIOR DE TRANSPORTE Y LÍNEA TEMPORAL */}
      <div className="hud-surface pointer-events-auto bg-slate-950/92 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl space-y-2">
        {/* Línea de tiempo interactiva con marcadores por turno */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
            R{frames[0]?.round ?? 1}
          </span>
          <div className="flex-1 space-y-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={safeIndex}
              onChange={e => {
                onSetPlaying(false);
                onSelectFrame(Number(e.target.value));
              }}
              aria-label="Línea temporal de turnos guardados"
              className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            {frames.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {frames.map((frame, idx) => {
                  const isCurrent = idx === safeIndex;
                  return (
                    <button
                      key={`${frame.frameIndex}_${idx}`}
                      type="button"
                      onClick={() => {
                        playSound.uiClick();
                        onSetPlaying(false);
                        onSelectFrame(idx);
                      }}
                      title={`Fotograma ${idx + 1} · R${frame.round} · ${frame.actorName}: ${frame.eventSummary}`}
                      className={`h-2 flex-1 min-w-[8px] rounded-sm transition-all ${
                        isCurrent
                          ? 'ring-2 ring-white scale-y-125'
                          : 'opacity-55 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: frame.actorColor }}
                      aria-label={`Ir al fotograma ${idx + 1}, Ronda ${frame.round}, ${frame.actorName}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
            R{frames[frames.length - 1]?.round ?? currentFrame.round}
          </span>
        </div>

        {/* Botonera de reproducción + selector de velocidad */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleJumpStart}
              disabled={safeIndex === 0}
              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              title="Ir al primer fotograma (Inicio)"
              aria-label="Ir al primer fotograma"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStep(-1)}
              disabled={safeIndex === 0}
              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              title="Turno anterior (Flecha izquierda)"
              aria-label="Turno anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={frames.length <= 1}
              className="min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-colors"
              title="Reproducir o pausar repetición (Espacio)"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {safeIndex >= frames.length - 1 && frames.length > 1
                      ? 'Repetir'
                      : 'Reproducir'}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStep(1)}
              disabled={safeIndex >= frames.length - 1}
              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              title="Siguiente turno (Flecha derecha)"
              aria-label="Siguiente turno"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpEnd}
              disabled={safeIndex >= frames.length - 1}
              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 transition-colors"
              title="Ir al último fotograma (Fin)"
              aria-label="Ir al último fotograma"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 hidden sm:inline">Velocidad:</span>
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 tabular-nums">
              {SPEED_OPTIONS.map(speed => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    onChangeSpeed(speed);
                  }}
                  className={`min-h-[36px] sm:min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-teal-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
            <span className="hidden lg:inline text-[11px] text-slate-400 pl-1">
              Espacio: Play/Pausa · ←/→: Turno · 1/2/3: Cámara
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
