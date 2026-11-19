/**
 * NeighborhoodDecisionModal.tsx
 * Modal de Votación In-Situ para Decisiones Barriales y Referéndums
 * Requiere que los jugadores se desplacen físicamente a casillas específicas de urnas en el tablero.
 */

import React from 'react';
import { Vote, MapPin, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { NeighborhoodDecision, Character, Tile } from '../../types/game';
import { playSound } from '../../utils/audio';

interface NeighborhoodDecisionModalProps {
  decision: NeighborhoodDecision | null;
  activePlayer: Character;
  tiles: Tile[];
  onCastVote: () => void;
}

export const NeighborhoodDecisionModal: React.FC<NeighborhoodDecisionModalProps> = ({
  decision,
  activePlayer,
  tiles,
  onCastVote
}) => {
  if (!decision) return null;

  // Comprobar si el jugador activo está en alguna de las casillas de urna objetivo
  const playerTile = tiles.find(t => t.id === activePlayer.position);
  const isAtPollingStation = playerTile && decision.targetTileIds.includes(playerTile.id);
  const hasAlreadyVoted = decision.votesCast.includes(activePlayer.id);

  const targetTileNames = decision.targetTileIds
    .map(id => tiles.find(t => t.id === id)?.name || `Casilla #${id}`)
    .join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-teal-500 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40">
            <Vote className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Referéndum In-Situ · Decisión Barrial
            </div>
            <h2 className="text-xl font-black text-white">
              {decision.title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            {decision.description}
          </p>

          <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-teal-300">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Casillas de Urna Habilitadas:</span>
            </div>
            <p className="text-slate-200 pl-6 font-mono text-[11px]">
              {targetTileNames} (Busca los marcadores brillantes en el tablero 3D)
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span className="text-slate-300">Estado de tu Posición:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isAtPollingStation ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {playerTile?.name || 'Desconocido'} ({isAtPollingStation ? 'En Urna In-Situ 🗳️' : 'Fuera de Urna 🚶'})
              </span>
            </div>

            {!isAtPollingStation && (
              <p className="text-amber-200/90 text-[11px] flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Debes desplazar tu peón a una casilla de urna habilitada para poder emitir tu voto.</span>
              </p>
            )}

            {isAtPollingStation && !hasAlreadyVoted && (
              <p className="text-emerald-200 text-[11px] flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>¡Estás en posición! Ya puedes emitir tu voto in-situ.</span>
              </p>
            )}

            {hasAlreadyVoted && (
              <p className="text-teal-200 text-[11px] flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>¡Ya has emitido tu voto en este referéndum!</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span><strong>Recompensa Colectiva:</strong> {decision.rewardSummary}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Votos emitidos: {decision.votesCast.length}
          </span>
          <button
            type="button"
            disabled={!isAtPollingStation || hasAlreadyVoted}
            onClick={() => {
              playSound.uiClick();
              onCastVote();
            }}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Emitir Voto In-Situ</span>
          </button>
        </div>

      </div>
    </div>
  );
};
