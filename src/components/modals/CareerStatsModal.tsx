/**
 * CareerStatsModal.tsx
 * Panel de estadísticas acumuladas de partidas jugadas en Commonspoly:
 * victorias, derrotas, empates, rachas, eficiencia media y récord,
 * personajes más usados e historial reciente.
 */

import React, { useState } from 'react';
import {
  BarChart3,
  Trophy,
  Flame,
  TrendingUp,
  Sparkles,
  Users,
  Trash2,
  X,
  Clock,
  HeartHandshake,
  AlertCircle
} from 'lucide-react';
import { CareerMatchStats, getCareerSummary } from '../../utils/matchHistoryStats';
import { playSound } from '../../utils/audio';
import { DifficultyLevel } from '../../types/game';
import { useI18n } from '../../i18n';

interface CareerStatsModalProps {
  isOpen: boolean;
  stats: CareerMatchStats;
  onClose: () => void;
  onResetStats: () => void;
}

export const CareerStatsModal: React.FC<CareerStatsModalProps> = ({
  isOpen,
  stats,
  onClose,
  onResetStats
}) => {
  const { t, formatDate } = useI18n();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const difficultyLabels: Record<DifficultyLevel, string> = {
    MAD_MAX: t.setup.diffMadMax,
    EN_TRANSICION: t.setup.diffTransition,
    COMUNLANDIA: t.setup.diffComunlandia
  };

  const formatShortDate = (iso: string): string =>
    formatDate(iso, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

  const summary = getCareerSummary(stats);
  const topChars = summary.topCharacters.slice(0, 6);
  const maxCharMatches = topChars[0]?.matchesPlayed || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/88 overflow-y-auto pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-stats-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          playSound.modalClose();
          setConfirmReset(false);
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-teal-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-teal-400">
                {t.modals.careerSubtitle}
              </div>
              <h2 id="career-stats-title" className="text-xl sm:text-2xl font-black text-white truncate">
                {t.modals.careerTitle}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              setConfirmReset(false);
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stats.totalMatches === 0 ? (
          <div className="py-12 px-4 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
            <Trophy className="w-10 h-10 text-teal-400/70 mx-auto" />
            <h3 className="text-lg font-bold text-white">{t.modals.careerTitle}</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              {t.modals.careerSubtitle}
            </p>
          </div>
        ) : (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.modals.totalMatches} · {t.modals.winRate}</span>
                </div>
                <div className="text-2xl font-black text-white tabular-nums">
                  {stats.totalMatches}
                  <span className="text-sm font-bold text-emerald-400 ml-2">
                    ({summary.winRatePct}%)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {stats.victories} / {stats.draws} / {stats.defeats}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                  <span>{t.modals.avgEfficiency}</span>
                </div>
                <div className="text-2xl font-black text-teal-300 tabular-nums">
                  {summary.avgEfficiencyPct}%
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {t.modals.bestEfficiency}: <strong className="text-amber-300">{stats.bestEfficiencyPct}%</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.common.victory}</span>
                </div>
                <div className="text-2xl font-black text-amber-300 tabular-nums">
                  {stats.winStreak}
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {t.title.careerMax}: <strong className="text-white">{stats.bestWinStreak}</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t.hud.commonPlural}</span>
                </div>
                <div className="text-2xl font-black text-emerald-300 tabular-nums">
                  {stats.totalCommonsUnlocked}
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  +{stats.totalPublicsUnlocked} {t.hud.publicPlural} · {stats.totalCooperativeActions}
                </div>
              </div>
            </div>

            {/* Desglose secundario + Dificultades + Personajes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personajes más utilizados */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-400" />
                    <span>{t.gameover.participantCol}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {summary.avgRounds} {t.hud.roundLabel}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {topChars.map(char => {
                    const widthPct = Math.max(8, Math.round((char.matchesPlayed / maxCharMatches) * 100));
                    return (
                      <div key={char.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="flex items-center gap-2 font-semibold text-slate-200 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: char.color }}
                            />
                            <span className="truncate">{char.name}</span>
                          </span>
                          <span className="text-slate-300 font-bold shrink-0">
                            {char.matchesPlayed}
                            <span className="text-emerald-400 font-normal ml-1.5">
                              ({char.wins} / {char.commonsUnlocked})
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${widthPct}%`, backgroundColor: char.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dificultades jugadas */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                  <span className="font-semibold text-slate-300">{t.setup.difficultyLabel}:</span>
                  {(['MAD_MAX', 'EN_TRANSICION', 'COMUNLANDIA'] as DifficultyLevel[]).map(diff => (
                    <span
                      key={diff}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {difficultyLabels[diff]}: <strong>{stats.difficultyCounts[diff] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Últimas partidas */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{t.modals.totalMatches} ({stats.recentMatches.length})</span>
                </h3>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {stats.recentMatches.map(match => (
                    <div
                      key={match.id}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0">
                          {match.result === 'VICTORY' ? (
                            <Trophy className="w-4 h-4 text-emerald-400" />
                          ) : match.result === 'DRAW' ? (
                            <HeartHandshake className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5 truncate">
                            <span>
                              {match.result === 'VICTORY'
                                ? t.common.victory
                                : match.result === 'DRAW'
                                ? t.common.draw
                                : t.common.defeat}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span className="text-teal-300 tabular-nums">
                              {match.efficiencyPct}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate tabular-nums">
                            {t.hud.roundLabel} {match.round}/20 · {match.commonCount}/{match.totalResourceTiles} {t.hud.commonPlural} ·{' '}
                            {difficultyLabels[match.difficulty]}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 text-[10px] text-slate-500 tabular-nums">
                        <div>{formatShortDate(match.playedAt)}</div>
                        <div>{match.playerCount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {stats.totalMatches > 0 ? (
            confirmReset ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-rose-300 font-semibold">
                  {t.modals.confirmReset}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setConfirmReset(false);
                    onResetStats();
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                >
                  {t.common.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setConfirmReset(true);
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800/70 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.modals.resetCareer}</span>
              </button>
            )
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              setConfirmReset(false);
              onClose();
            }}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
