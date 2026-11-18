/**
 * AchievementsModal.tsx
 * Galería modal de logros locales ('Achievements') persistentes entre partidas.
 */

import React, { useState } from 'react';
import {
  Trophy,
  Trees,
  HeartHandshake,
  Layers,
  ShieldCheck,
  Users,
  Sparkles,
  Award,
  Flame,
  Lock,
  CheckCircle2,
  RotateCcw,
  X
} from 'lucide-react';
import { CooperativeAchievement } from '../../types/game';
import { playSound } from '../../utils/audio';

interface AchievementsModalProps {
  isOpen: boolean;
  achievements: CooperativeAchievement[];
  onClose: () => void;
  onResetAchievements: () => void;
}

type AchievementFilter = 'ALL' | 'UNLOCKED' | 'LOCKED';

function renderAchievementIcon(iconName: string, className: string) {
  switch (iconName) {
    case 'Trees':
      return <Trees className={className} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Trophy':
    default:
      return <Trophy className={className} />;
  }
}

function getTierDisplay(tier?: CooperativeAchievement['tier']) {
  switch (tier) {
    case 'GOLD':
      return { label: 'Oro', accent: 'text-amber-300', iconBg: 'bg-amber-500/15 text-amber-300', border: 'border-amber-500/40' };
    case 'SILVER':
      return { label: 'Plata', accent: 'text-teal-300', iconBg: 'bg-teal-500/15 text-teal-300', border: 'border-teal-500/40' };
    case 'BRONZE':
    default:
      return { label: 'Bronce', accent: 'text-emerald-300', iconBg: 'bg-emerald-500/15 text-emerald-300', border: 'border-emerald-500/40' };
  }
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  achievements,
  onClose,
  onResetAchievements
}) => {
  const [filter, setFilter] = useState<AchievementFilter>('ALL');
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!isOpen) return null;

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;
  const completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filtered = achievements.filter(item => {
    if (filter === 'UNLOCKED') return item.isUnlocked;
    if (filter === 'LOCKED') return !item.isUnlocked;
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Logros locales de Commonspoly"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Logros Locales
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2 tabular-nums mt-0.5">
                <span>{unlockedCount} de {totalCount} completados</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-semibold">{completionPct}%</span>
                <span aria-hidden="true">·</span>
                <span>Guardado en este navegador</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Cerrar logros"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de progreso global y filtros */}
        <div className="py-4 space-y-3 border-b border-slate-800/80">
          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-amber-400 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setFilter('UNLOCKED');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filter === 'UNLOCKED' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Desbloqueados ({unlockedCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setFilter('LOCKED');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filter === 'LOCKED' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pendientes ({totalCount - unlockedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Lista / Rejilla de Logros */}
        <div className="py-4 max-h-[55vh] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No hay logros en esta vista todavía.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(ach => {
                const tier = getTierDisplay(ach.tier);
                const pct = Math.min(100, Math.round((ach.progress.current / ach.progress.target) * 100));

                return (
                  <div
                    key={ach.id}
                    className={`p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                      ach.isUnlocked
                        ? `bg-slate-950/90 ${tier.border}`
                        : 'bg-slate-950/40 border-slate-800/80 opacity-80'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        ach.isUnlocked ? tier.iconBg : 'bg-slate-900 text-slate-500'
                      }`}
                    >
                      {ach.isUnlocked
                        ? renderAchievementIcon(ach.iconName, 'w-4 h-4')
                        : <Lock className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold uppercase tracking-wider ${ach.isUnlocked ? tier.accent : 'text-slate-500'}`}>
                            {tier.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ach.isUnlocked ? 'Desbloqueado' : `${ach.progress.current}/${ach.progress.target}`}</span>
                        </div>
                        {ach.isUnlocked && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>

                      <h3 className={`text-xs sm:text-sm font-bold leading-snug ${ach.isUnlocked ? 'text-white' : 'text-slate-300'}`}>
                        {ach.title}
                      </h3>

                      <p className="text-[11px] text-slate-400 leading-snug">
                        {ach.description}
                      </p>

                      {!ach.isUnlocked && ach.progress.target > 1 && (
                        <div className="pt-1">
                          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-teal-500 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {ach.isUnlocked && (ach.unlockedAtRound !== undefined || ach.unlockedByPlayerName) && (
                        <div className="text-[10px] text-slate-500 pt-0.5 tabular-nums truncate">
                          {ach.unlockedAtRound !== undefined ? `Ronda ${ach.unlockedAtRound}` : 'Completado'}
                          {ach.unlockedByPlayerName ? ` · ${ach.unlockedByPlayerName}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {!confirmingReset ? (
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setConfirmingReset(true);
                }}
                disabled={unlockedCount === 0 && achievements.every(a => a.progress.current === 0)}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-300 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar progreso</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-rose-300 font-medium">¿Borrar logros locales?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetAchievements();
                    setConfirmingReset(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setConfirmingReset(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap shrink-0"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Pulsa <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-slate-200">Esc</kbd> para cerrar
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
