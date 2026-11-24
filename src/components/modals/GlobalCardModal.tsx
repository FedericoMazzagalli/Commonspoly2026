/**
 * GlobalCardModal.tsx
 * Modal de Carta Global leída por el Máster de Juego al inicio de cada ronda
 */

import React from 'react';
import { Globe, Sparkles, ArrowRight } from 'lucide-react';
import { GlobalCard } from '../../types/game';
import { useI18n } from '../../i18n';
import { ModalFrame } from '../ui/MotionPrimitives';

interface GlobalCardModalProps {
  card: GlobalCard | null;
  round: number;
  onConfirm: () => void;
}

export const GlobalCardModal: React.FC<GlobalCardModalProps> = ({ card, round, onConfirm }) => {
  const { t } = useI18n();
  if (!card) return null;

  return (
    <ModalFrame
      ariaLabel={card.title}
      className="w-full max-w-xl bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 my-auto"
    >
        {/* Card Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
            <Globe className="w-4 h-4" />
            <span>{t.modals.globalCardTitle} · {t.hud.roundLabel} {round} / 20</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            20 {t.hud.roundLabel}
          </span>
        </div>

        {/* Card Body */}
        <div className="py-6 space-y-4">
          <h3 className="hud-heading text-2xl font-black text-white leading-tight">
            {card.title}
          </h3>

          {card.quote && (
            <p className="italic text-sm text-amber-200/90 font-serif border-l-2 border-amber-500/60 pl-3 py-1">
              {card.quote}
            </p>
          )}

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 text-sm text-slate-200 leading-relaxed">
            {card.description}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] sm:min-h-[38px] px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.modals.acknowledgeCard}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
    </ModalFrame>
  );
};
