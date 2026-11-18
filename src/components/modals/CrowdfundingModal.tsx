/**
 * CrowdfundingModal.tsx
 * Casilla especial Crowdfunding (ID 38):
 * Donar 1-3 Puntos de Bienestar a una compañera otorga +2 de Legitimidad por punto donado.
 */

import React, { useState } from 'react';
import { HeartHandshake, Check, X } from 'lucide-react';
import { Character } from '../../types/game';
import { playSound } from '../../utils/audio';

interface CrowdfundingModalProps {
  donor: Character;
  players: Character[];
  onDonate: (targetPlayerId: string, amount: number) => void;
  onPass: () => void;
}

export const CrowdfundingModal: React.FC<CrowdfundingModalProps> = ({
  donor,
  players,
  onDonate,
  onPass
}) => {
  const recipients = players.filter(p => p.id !== donor.id);
  const maxDonation = Math.min(3, Math.max(0, donor.wellness - 1));

  // Por defecto sugerir a la compañera con menor Bienestar
  const sortedRecipients = [...recipients].sort((a, b) => a.wellness - b.wellness);
  const [targetId, setTargetId] = useState<string>(sortedRecipients[0]?.id ?? '');
  const [amount, setAmount] = useState<number>(1);

  const canDonate = maxDonation >= 1 && recipients.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caja de Resistencia y Crowdfunding"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-teal-500/60 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                Casilla Especial · Crowdfunding Barrial
              </div>
              <h2 className="text-xl font-extrabold text-white">
                Apoyo Mutuo y Caja Solidaria
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              onPass();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Cerrar y pasar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            <strong className="text-white">{donor.name}</strong> (Bienestar:{' '}
            <span className="font-bold text-rose-300 tabular-nums">{donor.wellness}</span>) puede donar
            Bienestar a una compañera. Cada punto donado otorga{' '}
            <strong className="text-amber-300">+2 de Legitimidad</strong>.
          </p>

          {canDonate ? (
            <>
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Cantidad a donar</div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(val => {
                    const disabled = val > maxDonation;
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          playSound.uiClick();
                          setAmount(val);
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold tabular-nums transition-colors ${
                          amount === val && !disabled
                            ? 'border-teal-400 bg-teal-950/60 text-teal-200'
                            : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none'
                        }`}
                      >
                        {val} Bienestar → +{val * 2} Legitimidad
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Destinataria del apoyo</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {sortedRecipients.map(player => {
                    const isSelected = player.id === targetId;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          setTargetId(player.id);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'border-teal-400 bg-teal-950/50 text-white'
                            : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: player.color }}
                          />
                          <span className="font-bold truncate">{player.name}</span>
                          <span className="text-slate-400 tabular-nums">
                            ({player.wellness} Bienestar · {player.legitimacy} Leg.)
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
              Tu Bienestar es de {donor.wellness}; necesitas al menos 2 puntos para donar sin quedarte sin energía.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              onPass();
            }}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Continuar sin donar
          </button>

          {canDonate && targetId && (
            <button
              type="button"
              onClick={() => onDonate(targetId, amount)}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Donar {amount} Bienestar (+{amount * 2} Leg.)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
