/**
 * LeaderboardModal.tsx
 * Modal de Clasificación Global ('Leaderboard') para consultar y comparar
 * las puntuaciones más altas de Eficiencia Cooperativa registradas al finalizar partidas.
 */

import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Medal,
  Globe,
  RefreshCw,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  HeartHandshake,
  UploadCloud,
  UserCheck,
  X
} from 'lucide-react';
import { type User } from '../../firebase';
import { playSound } from '../../utils/audio';
import {
  formatLeaderboardResultLabel,
  LeaderboardEntry,
  loadSavedLeaderboardAlias,
  LocalBestRecord,
  saveLeaderboardAlias
} from '../../utils/leaderboard';
import { OFFICIAL_CHARACTERS } from '../../data/characters';

interface LeaderboardModalProps {
  isOpen: boolean;
  entries: LeaderboardEntry[];
  isLoading: boolean;
  errorMessage: string | null;
  authUser: User | null;
  isAuthBusy: boolean;
  localBest: LocalBestRecord | null;
  latestMatchEfficiencyPct?: number | null;
  onClose: () => void;
  onRefresh: () => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onSyncPendingRecord?: () => void;
}

function getResultBadgeVisual(result: LeaderboardEntry['result']) {
  switch (result) {
    case 'VICTORY':
      return {
        label: 'Victoria',
        textClass: 'text-emerald-300',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      };
    case 'DRAW':
      return {
        label: 'Empate',
        textClass: 'text-indigo-300',
        icon: <HeartHandshake className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      };
    case 'DEFEAT':
    default:
      return {
        label: 'Inconclusa',
        textClass: 'text-rose-300',
        icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
      };
  }
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  entries,
  isLoading,
  errorMessage,
  authUser,
  isAuthBusy,
  localBest,
  latestMatchEfficiencyPct = null,
  onClose,
  onRefresh,
  onSignInGoogle,
  onSignOut,
  onSyncPendingRecord
}) => {
  const [aliasInput, setAliasInput] = useState<string>(() => loadSavedLeaderboardAlias());
  const [aliasSavedFeedback, setAliasSavedFeedback] = useState(false);

  const userRankInfo = useMemo(() => {
    if (!authUser) return null;
    const idx = entries.findIndex(e => e.uid === authUser.uid);
    if (idx === -1) return null;
    return {
      rank: idx + 1,
      entry: entries[idx]
    };
  }, [entries, authUser]);

  const topEntry = entries[0] ?? null;

  const personalReferencePct =
    userRankInfo?.entry.efficiencyPct ??
    localBest?.efficiencyPct ??
    latestMatchEfficiencyPct ??
    null;

  if (!isOpen) return null;

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    playSound.uiClick();
    saveLeaderboardAlias(aliasInput);
    setAliasSavedFeedback(true);
    window.setTimeout(() => setAliasSavedFeedback(false), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clasificación Global de Eficiencia Cooperativa"
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-950/85 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-teal-500/50 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Clasificación Global · Leaderboard
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap tabular-nums mt-0.5">
                <span>Récords de Eficiencia Cooperativa al finalizar partida</span>
                <span aria-hidden="true">·</span>
                <span className="text-teal-300 font-semibold">
                  {entries.length} {entries.length === 1 ? 'registro global' : 'registros globales'}
                </span>
                {topEntry && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-semibold">
                      Top #1: {topEntry.efficiencyPct}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                onRefresh();
              }}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors"
              title="Actualizar clasificación"
              aria-label="Actualizar clasificación"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar clasificación global"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Estado de Cuenta & Comparativa Personal */}
        <div className="py-4 border-b border-slate-800/80 space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {authUser ? (
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Sesión activa: {authUser.displayName || 'Jugadora verificada'}
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex items-center flex-wrap gap-x-2.5 gap-y-1 tabular-nums">
                  {userRankInfo ? (
                    <>
                      <span className="font-bold text-white">
                        Posición Global: #{userRankInfo.rank}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-teal-300 font-bold">
                        Tu mejor marca: {userRankInfo.entry.efficiencyPct}%
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span>
                        {userRankInfo.entry.tierLabel} (Ronda {userRankInfo.entry.round}/20)
                      </span>
                    </>
                  ) : localBest ? (
                    <span className="text-amber-200">
                      Tienes una marca local de <strong>{localBest.efficiencyPct}%</strong> lista para publicar en el Leaderboard Global.
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Completa una partida hasta el final para registrar tu mejor Eficiencia Cooperativa.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-bold text-slate-200">
                  Conecta tu cuenta de Google para publicar y comparar tu récord global
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {localBest ? (
                    <span>
                      Récord local guardado: <strong className="text-amber-300">{localBest.efficiencyPct}%</strong> ({formatLeaderboardResultLabel(localBest.result)} · Ronda {localBest.round}/20)
                    </span>
                  ) : (
                    <span>
                      Puedes consultar la tabla global libremente o iniciar sesión para guardar tu marca personal.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {authUser && localBest?.pendingSync && onSyncPendingRecord && (
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    onSyncPendingRecord();
                  }}
                  disabled={isAuthBusy}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Publicar récord ({localBest.efficiencyPct}%)</span>
                </button>
              )}

              {authUser ? (
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    onSignOut();
                  }}
                  disabled={isAuthBusy}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    onSignInGoogle();
                  }}
                  disabled={isAuthBusy}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors shadow-lg whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isAuthBusy ? 'Conectando...' : 'Conectar con Google'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Alias público opcional + comparativa frente al #1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <form onSubmit={handleSaveAlias} className="flex items-center gap-2">
              <label htmlFor="leaderboard-alias-input" className="text-slate-400 shrink-0">
                Alias público:
              </label>
              <input
                id="leaderboard-alias-input"
                type="text"
                maxLength={48}
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                placeholder={authUser?.displayName || 'Ej: Cooperativa Lavapiés'}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-teal-500 focus:outline-none text-xs text-white w-48 sm:w-56"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {aliasSavedFeedback ? 'Guardado' : 'Guardar alias'}
              </button>
            </form>

            {personalReferencePct !== null && topEntry && (
              <div className="text-[11px] text-slate-300 tabular-nums">
                Comparativa vs #1 Global ({topEntry.efficiencyPct}%):{' '}
                {personalReferencePct >= topEntry.efficiencyPct ? (
                  <strong className="text-emerald-300">¡Igualas o lideras el récord!</strong>
                ) : (
                  <strong className="text-amber-300">
                    a {topEntry.efficiencyPct - personalReferencePct} pts porcentuales del liderazgo
                  </strong>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Clasificación Global */}
        <div className="py-4 max-h-[48vh] overflow-y-auto pr-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3 mb-3">
              <span>No se pudo cargar la clasificación global: {errorMessage}</span>
              <button
                type="button"
                onClick={onRefresh}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-semibold shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}

          {isLoading && entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Cargando clasificación global...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                Aún no hay puntuaciones publicadas en el Leaderboard Global
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Finaliza una partida y conecta tu cuenta de Google para inaugurar el primer récord mundial de Eficiencia Cooperativa.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 pr-2 font-semibold w-12">Puesto</th>
                    <th className="py-2.5 px-2 font-semibold">Jugadora / Equipo</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Eficiencia</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Tablero</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Sinergia</th>
                    <th className="py-2.5 px-2 font-semibold">Desenlace</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Ronda</th>
                    <th className="py-2.5 pl-2 font-semibold text-right">Comunes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 tabular-nums">
                  {entries.map((entry, index) => {
                    const rank = index + 1;
                    const isCurrentUser = Boolean(authUser && entry.uid === authUser.uid);
                    const resultVisual = getResultBadgeVisual(entry.result);
                    const charMeta = OFFICIAL_CHARACTERS.find(c => c.id === entry.leadCharacterId);
                    const diffVsPersonal =
                      personalReferencePct !== null ? entry.efficiencyPct - personalReferencePct : null;

                    return (
                      <tr
                        key={entry.uid}
                        className={`transition-colors ${
                          isCurrentUser
                            ? 'bg-teal-950/50 hover:bg-teal-950/70'
                            : 'hover:bg-slate-950/60'
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-black">
                          <div className="flex items-center gap-1.5">
                            {rank === 1 ? (
                              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : rank === 2 ? (
                              <Medal className="w-4 h-4 text-slate-300 shrink-0" />
                            ) : rank === 3 ? (
                              <Medal className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <span className="w-4 text-center text-slate-500 font-bold">
                                #{rank}
                              </span>
                            )}
                            {rank <= 3 && (
                              <span className={rank === 1 ? 'text-amber-300' : 'text-slate-200'}>
                                #{rank}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: charMeta?.color || '#14b8a6' }}
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{entry.displayAlias}</span>
                                {isCurrentUser && (
                                  <span className="text-[10px] font-bold text-teal-300">
                                    · Tú
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {entry.tierLabel} · {entry.teamSummary}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <div className="font-black text-sm text-teal-300">
                            {entry.efficiencyPct}%
                          </div>
                          {diffVsPersonal !== null && !isCurrentUser && diffVsPersonal !== 0 && (
                            <div
                              className={`text-[10px] ${
                                diffVsPersonal > 0 ? 'text-amber-300' : 'text-emerald-300'
                              }`}
                            >
                              {diffVsPersonal > 0
                                ? `+${diffVsPersonal}% sobre ti`
                                : `${diffVsPersonal}% vs tu marca`}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2 text-right text-emerald-300 font-semibold">
                          {entry.boardRecoveryPct}%
                        </td>

                        <td className="py-2.5 px-2 text-right text-sky-300 font-semibold">
                          {entry.teamSynergyPct}%
                        </td>

                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center gap-1 font-semibold ${resultVisual.textClass}`}>
                            {resultVisual.icon}
                            <span>{resultVisual.label}</span>
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-right text-slate-200 font-semibold">
                          {entry.round}/20
                        </td>

                        <td className="py-2.5 pl-2 text-right text-slate-200 font-semibold">
                          {entry.commonCount}/{entry.totalResourceTiles}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-400">
          <span>
            Se conserva automáticamente la Eficiencia Cooperativa más alta de cada jugadora verificada.
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Pulsa <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-slate-200">Esc</kbd> para cerrar
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
