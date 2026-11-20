/**
 * TitleScreen.tsx
 * Pantalla de inicio atmosférica con logotipo bespoke de Commonspoly,
 * llamadas a la acción primarias y atajos de teclado.
 */

import React, { useEffect } from 'react';
import { Play, Sparkles, BookOpen, Users, Volume2, VolumeX, Trophy, RotateCcw, Trash2, Globe } from 'lucide-react';
import { playSound } from '../utils/audio';
import {
  SavedGameMetadata,
  formatSavedPhaseLabel,
  formatSavedTimestamp
} from '../utils/gameStorage';

interface TitleScreenProps {
  onStartSetup: () => void;
  onQuickStart: () => void;
  onOpenRules: () => void;
  onOpenAchievements?: () => void;
  onOpenLeaderboard?: () => void;
  leaderboardTopPct?: number | null;
  leaderboardCount?: number;
  localBestPct?: number | null;
  achievementsUnlockedCount?: number;
  achievementsTotalCount?: number;
  isModalOpen?: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  savedGameMeta?: SavedGameMetadata | null;
  onResumeSavedGame?: () => void;
  onDeleteSavedGame?: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartSetup,
  onQuickStart,
  onOpenRules,
  onOpenAchievements,
  onOpenLeaderboard,
  leaderboardTopPct = null,
  leaderboardCount = 0,
  localBestPct = null,
  achievementsUnlockedCount = 0,
  achievementsTotalCount = 10,
  isModalOpen = false,
  soundEnabled,
  onToggleSound,
  savedGameMeta,
  onResumeSavedGame,
  onDeleteSavedGame
}) => {
  // Atajo de teclado: Barra espaciadora o Enter para comenzar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onStartSetup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartSetup, isModalOpen]);

  const savedTimeText = savedGameMeta ? formatSavedTimestamp(savedGameMeta.savedAt) : '';

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-6 md:p-12 text-center text-slate-100 select-none bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/90 pointer-events-auto">
      
      {/* Top Tagline & Audio Toggle */}
      <div className="w-full flex items-center justify-between pt-2">
        <div className="w-9" />
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-teal-400 uppercase">
          <Sparkles className="w-4 h-4" />
          <span>Nos Necesitamos · ¡Vamos a Cooperar!</span>
        </div>
        <button
          onClick={onToggleSound}
          className={`p-2 rounded-xl border transition-colors ${
            soundEnabled
              ? 'bg-slate-900/90 border-teal-800/70 text-teal-300 hover:text-white'
              : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:text-white'
          }`}
          title={soundEnabled ? 'Silenciar audio' : 'Activar audio'}
          aria-label={soundEnabled ? 'Silenciar audio' : 'Activar audio'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Hero Lockup */}
      <div className="max-w-2xl space-y-6 flex flex-col items-center my-auto">
        
        {/* Bespoke SVG Logo Lockup */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-3 bg-teal-800 text-white px-8 py-3.5 rounded-2xl shadow-2xl border border-teal-600/50 mb-3">
            <svg className="w-9 h-9 fill-amber-300" viewBox="0 0 100 100">
              <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" fill="none" stroke="currentColor" strokeWidth="8" />
              <circle cx="50" cy="50" r="18" fill="currentColor" />
              <path d="M50 15 L50 32 M50 68 L50 85 M20 32 L34 41 M66 59 L80 68 M20 68 L34 59 M66 41 L80 32" stroke="currentColor" strokeWidth="6" />
            </svg>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">
              Commonspoly
            </h1>
          </div>
          <div className="text-xs font-semibold tracking-wider text-teal-300 uppercase">
            Edición Verde 4.0 · Videojuego 3D de Bienes Comunes
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg mx-auto">
          Un juego de mesa cooperativo y subversivo nacido en 2015 para hackear el Monopoly neoliberal. 
          Unid fuerzas para transformar recursos de la salud, urbanos, conocimiento y medioambiente en 
          <strong> Bienes Comunes</strong> antes de que los Especuladores privaticen la vida.
        </p>

        {/* Saved Match Resume Block */}
        {savedGameMeta && onResumeSavedGame && (
          <div className="w-full max-w-md bg-slate-900/90 border border-teal-700/70 rounded-2xl p-4 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onResumeSavedGame}
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-teal-400 hover:from-amber-300 hover:to-teal-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Continuar Partida Guardada</span>
              </button>

              {onDeleteSavedGame && (
                <button
                  type="button"
                  onClick={onDeleteSavedGame}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-700/70 text-slate-400 hover:text-rose-300 transition-colors shrink-0"
                  title="Eliminar partida guardada"
                  aria-label="Eliminar partida guardada"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5 flex-wrap tabular-nums">
              <span className="font-bold text-teal-300">Ronda {savedGameMeta.round}/20</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{formatSavedPhaseLabel(savedGameMeta.phase)}</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: savedGameMeta.activePlayerColor }}
                />
                <span>{savedGameMeta.activePlayerName}</span>
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-emerald-300 font-semibold">
                {savedGameMeta.commonCount}/{savedGameMeta.totalResourceTiles} Comunes
              </span>
              {savedGameMeta.lastEndedTurnBy && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-slate-400">Últ. turno: {savedGameMeta.lastEndedTurnBy}</span>
                </>
              )}
              {savedTimeText && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-slate-400">{savedTimeText}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-1">
          <button
            onClick={() => {
              playSound.uiClick();
              onStartSetup();
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Comenzar Nueva Partida</span>
          </button>

          <button
            onClick={() => {
              playSound.uiClick();
              onQuickStart();
            }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="w-4 h-4 text-teal-400" />
            <span>Partida Rápida (4 Jugadores)</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-5 flex-wrap pt-1">
          <button
            onClick={() => {
              playSound.modalOpen();
              onOpenRules();
            }}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Consultar Reglas Oficiales y Glosario</span>
          </button>

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenLeaderboard();
              }}
              className="text-xs font-semibold text-teal-300 hover:text-teal-200 flex items-center gap-1.5 transition-colors tabular-nums"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                Leaderboard Global
                {leaderboardTopPct !== null
                  ? ` (Top ${leaderboardTopPct}%${localBestPct !== null ? ` · Tú ${localBestPct}%` : ''})`
                  : leaderboardCount > 0
                  ? ` (${leaderboardCount})`
                  : localBestPct !== null
                  ? ` (Tu récord ${localBestPct}%)`
                  : ''}
              </span>
            </button>
          )}

          {onOpenAchievements && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenAchievements();
              }}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors tabular-nums"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Logros Locales ({achievementsUnlockedCount}/{achievementsTotalCount})</span>
            </button>
          )}
        </div>

      </div>

      {/* Control Hint Line */}
      <div className="pb-4 text-[11px] text-slate-500 font-mono tracking-wide">
        Espacio / Enter Iniciar · Cámara 3D · Tutorial de Onboarding con Voz (Tecla T) · 20 Rondas de Carrera contra el Tiempo
      </div>

    </div>
  );
};
