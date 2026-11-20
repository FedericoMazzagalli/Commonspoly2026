/**
 * DetentionRescueModal.tsx
 * Modal de Rescate Solidario y Caja de Resistencia
 * Permite a las compañeras pagar la fianza comunitaria para liberar a una persona detenida.
 */

import React, { useState } from 'react';
import { ShieldAlert, HeartHandshake, Lock, Check } from 'lucide-react';
import { Character } from '../../types/game';
import { formatSignedScore, getEffectiveBailCostPerRound, getReputationProfile } from '../../utils/reputation';

interface DetentionRescueModalProps {
  detainedPlayer: Character;
  allPlayers: Character[];
  onRescue: (rescuerId: string, victimId: string) => void;
  onDismiss: () => void;
}

export const DetentionRescueModal: React.FC<DetentionRescueModalProps> = ({
  detainedPlayer,
  allPlayers,
  onRescue,
  onDismiss
}) => {
  const baseCostPerRound = (detainedPlayer.hasCitizenship && detainedPlayer.socialClass !== 'BAJA') ? 1 : 2;
  const potentialRescuers = allPlayers.filter(p => {
    if (p.id === detainedPlayer.id || p.isDetained) return false;
    const bail = getEffectiveBailCostPerRound(detainedPlayer, p);
    return p.wellness > detainedPlayer.detentionRoundsLeft * bail.effectivePerRound;
  });

  const [chosenRescuerId, setChosenRescuerId] = useState<string>(
    potentialRescuers[0]?.id || ''
  );

  const selectedRescuer = potentialRescuers.find(p => p.id === chosenRescuerId) ?? potentialRescuers[0];
  const selectedBail = getEffectiveBailCostPerRound(detainedPlayer, selectedRescuer);
  const totalCost = detainedPlayer.detentionRoundsLeft * selectedBail.effectivePerRound;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-500 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Centro de Detención · Represión Especulativa
            </div>
            <h2 className="text-2xl font-black text-white">
              ¡{detainedPlayer.name} ha sido Detenido!
            </h2>
          </div>
        </div>

        {/* Narrative & Cost breakdown */}
        <div className="py-4 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            Un Especulador interceptó a <strong>{detainedPlayer.name}</strong> y lo ha encerrado 
            durante <span className="font-bold text-rose-400">{detainedPlayer.detentionRoundsLeft} rondas</span>. 
            Mientras permanezca entre rejas no podrá unirse al Ágora Central.
          </p>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs tabular-nums">
            <div className="flex justify-between items-center text-slate-400">
              <span>Condición social:</span>
              <span className="font-semibold text-slate-200">
                {detainedPlayer.hasCitizenship ? 'Con Ciudadanía' : 'Sin Ciudadanía'} ({detainedPlayer.socialClass})
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Coste solidario base:</span>
              <span className="font-semibold text-slate-200">
                {baseCostPerRound} Bienestar por ronda
              </span>
            </div>
            {selectedBail.reputationDelta !== 0 && selectedRescuer && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Ajuste por Reputación ({selectedRescuer.name}):</span>
                <span className={selectedBail.reputationDelta < 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
                  {selectedBail.reputationDelta > 0 ? `+${selectedBail.reputationDelta}` : selectedBail.reputationDelta} / ronda
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-amber-300 font-bold border-t border-slate-800 pt-2">
              <span>Total para fianza colectiva:</span>
              <span className="text-sm">{totalCost} Puntos de Bienestar</span>
            </div>
          </div>

          {/* Selector de quien aporta el Bienestar */}
          {potentialRescuers.length > 0 ? (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-300 block">
                ¿Qué compañera solidaria aportará los {totalCost} puntos de su Bienestar? (+4 Rep. Vecinal)
              </label>
              <div className="space-y-2">
                {potentialRescuers.map(rescuer => {
                  const prof = getReputationProfile(rescuer);
                  const rescuerBail = getEffectiveBailCostPerRound(detainedPlayer, rescuer);
                  const rescuerTotal = detainedPlayer.detentionRoundsLeft * rescuerBail.effectivePerRound;
                  return (
                    <button
                      key={rescuer.id}
                      onClick={() => setChosenRescuerId(rescuer.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                        chosenRescuerId === rescuer.id
                          ? 'border-teal-500 bg-teal-950/40 text-teal-200 ring-1 ring-teal-500/50'
                          : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rescuer.color }} />
                        <span className="font-bold">{rescuer.name}</span>
                        <span className="text-slate-400 tabular-nums truncate">
                          ({rescuer.wellness} Bienestar · {prof.label} {formatSignedScore(prof.score)} · {rescuerTotal} pts)
                        </span>
                      </div>
                      {chosenRescuerId === rescuer.id && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Ninguna compañera tiene actualmente suficiente Bienestar ({totalCost} pts) para liberarlo en este turno.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-semibold"
          >
            Permanecer Detenido
          </button>

          {potentialRescuers.length > 0 && (
            <button
              onClick={() => onRescue(chosenRescuerId, detainedPlayer.id)}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all tabular-nums"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Liberar Solidariamente ({totalCost} pts)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
