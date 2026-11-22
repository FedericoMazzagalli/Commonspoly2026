/**
 * NeighborhoodDecisionModal.tsx
 * Modal de Votación In-Situ para Decisiones Barriales y Referéndums
 * Requiere que los jugadores se desplacen físicamente a casillas específicas de urnas en el tablero.
 */

import React from 'react';
import { Vote, MapPin, CheckCircle2, Sparkles, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { NeighborhoodDecision, Character, Tile } from '../../types/game';
import { playSound } from '../../utils/audio';
import {
  computeReferendumTrustSummary,
  formatSignedScore,
  getReputationProfile
} from '../../utils/reputation';
import { useI18n } from '../../i18n';

interface NeighborhoodDecisionModalProps {
  decision: NeighborhoodDecision | null;
  activePlayer: Character;
  players?: Character[];
  tiles: Tile[];
  onCastVote: () => void;
  onClose?: () => void;
}

export const NeighborhoodDecisionModal: React.FC<NeighborhoodDecisionModalProps> = ({
  decision,
  activePlayer,
  players = [],
  tiles,
  onCastVote,
  onClose
}) => {
  const { t } = useI18n();
  if (!decision) return null;

  const playerTile = tiles.find(t => t.id === activePlayer.position);
  const isAtPollingStation = playerTile && decision.targetTileIds.includes(playerTile.id);
  const hasAlreadyVoted = decision.votesCast.includes(activePlayer.id);
  const activeRep = getReputationProfile(activePlayer);
  const trustSummary = computeReferendumTrustSummary(
    decision,
    players.length > 0 ? players : [activePlayer]
  );

  const targetTileNames = decision.targetTileIds
    .map(id => tiles.find(t => t.id === id)?.name || `Casilla #${id}`)
    .join(', ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.modals.neighborhoodDecisionTitle}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/88"
    >
      <div className="w-full max-w-lg bg-slate-900 border-2 border-teal-500 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 shrink-0">
              <Vote className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-400">
                {t.modals.neighborhoodDecisionTitle}
              </div>
              <h2 className="text-xl font-black text-white">
                {decision.title}
              </h2>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                playSound.modalClose();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="py-4 space-y-3.5">
          <p className="text-sm text-slate-300 leading-relaxed">
            {decision.description}
          </p>

          {/* Confianza Vecinal y Quórum Ponderado */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 tabular-nums">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{t.hud.referendumProgress}</span>
              </span>
              <span className="font-bold text-teal-300">
                {trustSummary.trustAccumulated.toFixed(2)} / {trustSummary.requiredTrust.toFixed(1)} {t.common.points}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${trustSummary.progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {activePlayer.name}:{' '}
                <strong
                  className={
                    activeRep.tone === 'POSITIVE'
                      ? 'text-emerald-300'
                      : activeRep.tone === 'NEGATIVE'
                      ? 'text-rose-300'
                      : 'text-slate-200'
                  }
                >
                  {activeRep.label} ({formatSignedScore(activeRep.score)})
                </strong>
              </span>
              <span className="text-slate-200 font-semibold">
                {activeRep.trustPercent}% · {activeRep.voteWeight}x
              </span>
            </div>

            {trustSummary.voters.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-[10px] text-slate-400">
                <span>{t.hud.neighborhoodVote}:</span>
                {trustSummary.voters.map(v => (
                  <span key={v.player.id} className="text-slate-200 font-semibold">
                    {v.player.name} ({v.profile.voteWeight}x)
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-teal-300">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{t.hud.neighborhoodVote}</span>
            </div>
            <p className="text-slate-200 pl-6 text-[11px]">
              {targetTileNames}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold gap-2">
              <span className="text-slate-300">{t.modals.ownerState}:</span>
              <span
                className={`text-[11px] font-bold ${
                  isAtPollingStation ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {playerTile?.name || '—'} · {isAtPollingStation ? '✓' : '—'}
              </span>
            </div>

            {!isAtPollingStation && (
              <p className="text-amber-200/90 text-[11px] flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{targetTileNames}</span>
              </p>
            )}

            {isAtPollingStation && !hasAlreadyVoted && (
              <p className="text-emerald-200 text-[11px] flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  +{activeRep.voteWeight}x ({t.hud.referendumProgress})
                </span>
              </p>
            )}

            {hasAlreadyVoted && (
              <p className="text-teal-200 text-[11px] flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>✓ {t.modals.castVote}</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{decision.rewardSummary}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 tabular-nums">
            {decision.votesCast.length} · {trustSummary.collectiveTrustPercent}%
          </span>
          <button
            type="button"
            disabled={!isAtPollingStation || hasAlreadyVoted}
            onClick={() => {
              playSound.uiClick();
              onCastVote();
            }}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 tabular-nums whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.modals.castVote} ({activeRep.voteWeight}x)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
