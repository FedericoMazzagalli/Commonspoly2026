/**
 * TitleScreen.tsx
 * Pantalla de inicio atmosférica con logotipo bespoke de Commonspoly,
 * llamadas a la acción primarias y atajos de teclado.
 */

import React, { useEffect } from 'react';
import { Play, Sparkles, BookOpen, Users, Volume2, VolumeX, Trophy, RotateCcw, Trash2, Globe, CloudSun, BarChart3, Accessibility, Calendar, Wifi } from 'lucide-react';
import { playSound } from '../utils/audio';
import {
  SavedGameMetadata,
  formatSavedPhaseLabel,
  formatSavedTimestamp
} from '../utils/gameStorage';
import type { DailyChallengeConfig } from '../utils/dailyChallenge';
import { OfflineIndicator } from './hud/OfflineIndicator';
import { PWAInstallButton } from './hud/PWAInstallButton';
import { LanguageSelector } from './hud/LanguageSelector';
import { useI18n } from '../i18n';

interface TitleScreenProps {
  onStartSetup: () => void;
  onQuickStart: () => void;
  onOpenRules: () => void;
  onOpenAchievements?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenWeatherSettings?: () => void;
  onOpenCareerStats?: () => void;
  careerMatchesCount?: number;
  careerBestPct?: number | null;
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
  dailyConfig?: DailyChallengeConfig;
  localDailyBest?: { efficiencyPct: number; result: string } | null;
  onStartDailyChallenge?: () => void;
  onOpenMultiplayer?: () => void;
  isOnline?: boolean;
  onOpenAccessibility?: () => void;
  accessibilityModeLabel?: string;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartSetup,
  onQuickStart,
  onOpenRules,
  onOpenAchievements,
  onOpenLeaderboard,
  onOpenWeatherSettings,
  onOpenCareerStats,
  careerMatchesCount = 0,
  careerBestPct = null,
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
  onDeleteSavedGame,
  dailyConfig,
  localDailyBest = null,
  onStartDailyChallenge,
  onOpenMultiplayer,
  isOnline = true,
  onOpenAccessibility,
  accessibilityModeLabel
}) => {
  const { t } = useI18n();

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
    <div className="absolute inset-0 z-20 overflow-y-auto overflow-x-hidden select-none bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/90 pointer-events-auto">
      <div className="min-h-full w-full flex flex-col items-center justify-between gap-6 p-4 sm:p-6 md:p-10 text-center text-slate-100">
      
      {/* Top Tagline & Audio / PWA / Accessibility Toggles */}
      <div className="w-full flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <OfflineIndicator inline />
        </div>
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold tracking-widest text-teal-400 uppercase">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{t.title.tagline}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LanguageSelector variant="pill" />
          {onOpenAccessibility && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenAccessibility();
              }}
              className="min-h-[44px] px-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-teal-500/70 text-slate-200 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap"
              title={t.title.accessibilityTooltip}
              aria-label={t.title.accessibilityTooltip}
            >
              <Accessibility className="w-4 h-4 text-teal-300 shrink-0" />
              <span className="hidden sm:inline">
                {accessibilityModeLabel && accessibilityModeLabel !== 'Estándar'
                  ? accessibilityModeLabel
                  : t.title.accessibilityBtn}
              </span>
            </button>
          )}
          <button
            onClick={onToggleSound}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
              soundEnabled
                ? 'bg-slate-900/90 border-teal-800/70 text-teal-300 hover:text-white'
                : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:text-white'
            }`}
            title={soundEnabled ? t.title.muteAudio : t.title.enableAudio}
            aria-label={soundEnabled ? t.title.muteAudio : t.title.enableAudio}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Center Hero Lockup */}
      <div className="max-w-2xl w-full space-y-5 sm:space-y-6 flex flex-col items-center my-auto">
        
        {/* Bespoke SVG Logo Lockup */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2.5 sm:gap-3 bg-teal-800 text-white px-5 sm:px-8 py-3 sm:py-3.5 rounded-2xl shadow-2xl border border-teal-600/50 mb-3">
            <svg className="w-7 h-7 sm:w-9 sm:h-9 fill-amber-300 shrink-0" viewBox="0 0 100 100">
              <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" fill="none" stroke="currentColor" strokeWidth="8" />
              <circle cx="50" cy="50" r="18" fill="currentColor" />
              <path d="M50 15 L50 32 M50 68 L50 85 M20 32 L34 41 M66 59 L80 68 M20 68 L34 59 M66 41 L80 32" stroke="currentColor" strokeWidth="6" />
            </svg>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight uppercase">
              Commonspoly
            </h1>
          </div>
          <div className="text-xs font-semibold tracking-wider text-teal-300 uppercase">
            {t.title.subtitle}
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg mx-auto">
          {t.title.narrative}
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
                <span>{t.title.continueSaved}</span>
              </button>

              {onDeleteSavedGame && (
                <button
                  type="button"
                  onClick={onDeleteSavedGame}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-700/70 text-slate-400 hover:text-rose-300 transition-colors shrink-0"
                  title={t.title.deleteSaved}
                  aria-label={t.title.deleteSaved}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5 flex-wrap tabular-nums">
              <span className="font-bold text-teal-300">{t.common.round} {savedGameMeta.round}/20</span>
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
                {savedGameMeta.commonCount}/{savedGameMeta.totalResourceTiles} {t.title.commonsCount}
              </span>
              {savedGameMeta.lastEndedTurnBy && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-slate-400">{t.title.lastTurn}: {savedGameMeta.lastEndedTurnBy}</span>
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl pt-1 flex-wrap">
          <button
            onClick={() => {
              playSound.uiClick();
              onStartSetup();
            }}
            className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{t.title.newMatch}</span>
          </button>

          <button
            onClick={() => {
              playSound.uiClick();
              onQuickStart();
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="w-4 h-4 text-teal-400" />
            <span>{t.title.quickMatch}</span>
          </button>

          {onOpenMultiplayer && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenMultiplayer();
              }}
              className="w-full sm:w-auto min-h-[48px] px-5 py-3.5 rounded-xl bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/50 text-sky-100 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors whitespace-nowrap shrink-0"
              title={!isOnline ? t.title.onlineRoomsOfflineHint : t.title.onlineRoomsHint}
            >
              <Wifi className="w-4 h-4 text-sky-300 shrink-0" />
              <span>{t.title.onlineRooms}</span>
            </button>
          )}
        </div>

        {/* Deterministic Daily Seed Challenge Card */}
        {dailyConfig && onStartDailyChallenge && (
          <div className="w-full max-w-xl bg-slate-900/90 border border-emerald-700/60 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left shadow-lg">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{t.title.dailyChallenge} · {dailyConfig.challengeDate}</span>
                {localDailyBest && (
                  <span className="text-amber-300 tabular-nums">
                    · {t.title.todayBest}: {localDailyBest.efficiencyPct}%
                  </span>
                )}
              </div>
              <div className="text-sm font-extrabold text-white truncate">
                {dailyConfig.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate tabular-nums">
                {dailyConfig.rolls.difficulty} · {dailyConfig.rolls.speculatorsCount} {t.title.speculatorsLabel} · {t.title.weatherLabel} {dailyConfig.weatherMode}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                onStartDailyChallenge();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t.title.playDaily}</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-x-4 gap-y-2 flex-wrap pt-1">
          <button
            onClick={() => {
              playSound.modalOpen();
              onOpenRules();
            }}
            className="min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>{t.title.rulesGlossary}</span>
          </button>

          {onOpenCareerStats && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenCareerStats();
              }}
              className="min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1.5 transition-colors tabular-nums whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {t.title.careerStats}
                {careerMatchesCount > 0
                  ? ` (${careerMatchesCount}${careerBestPct !== null ? ` · ${t.title.careerMax} ${careerBestPct}%` : ''})`
                  : ''}
              </span>
            </button>
          )}

          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenLeaderboard();
              }}
              className="min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold text-teal-300 hover:text-teal-200 flex items-center gap-1.5 transition-colors tabular-nums"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>
                {t.title.globalLeaderboard}
                {leaderboardTopPct !== null
                  ? ` (${t.title.topLabel} ${leaderboardTopPct}%${localBestPct !== null ? ` · ${t.title.youLabel} ${localBestPct}%` : ''})`
                  : leaderboardCount > 0
                  ? ` (${leaderboardCount})`
                  : localBestPct !== null
                  ? ` (${t.title.yourRecord} ${localBestPct}%)`
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
              className="min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors tabular-nums"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>{t.title.localAchievements} ({achievementsUnlockedCount}/{achievementsTotalCount})</span>
            </button>
          )}
          {onOpenWeatherSettings && (
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                onOpenWeatherSettings();
              }}
              className="min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold text-sky-300 hover:text-sky-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <CloudSun className="w-3.5 h-3.5 shrink-0" />
              <span>{t.title.configWeather3d}</span>
            </button>
          )}
        </div>

      </div>

      {/* Control Hint Line */}
      <div className="pb-2 text-[11px] text-slate-500 font-mono tracking-wide">
        {t.title.hintBar}
      </div>

      </div>
    </div>
  );
};
