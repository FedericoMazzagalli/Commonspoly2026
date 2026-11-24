/**
 * SituationCardModal.tsx
 * Modal de Carta de Situación ('S') individual para el personaje activo
 * Muestra el impacto y la modificación de probabilidad según el ciclo dinámico del clima.
 */

import React from 'react';
import { HelpCircle, Check, Sparkles, CloudSun } from 'lucide-react';
import { SituationCard, Character, WeatherCondition } from '../../types/game';
import { useI18n } from '../../i18n';
import { ModalFrame } from '../ui/MotionPrimitives';

interface SituationCardModalProps {
  card: SituationCard | null;
  player: Character;
  weather?: WeatherCondition;
  onConfirm: () => void;
}

export const SituationCardModal: React.FC<SituationCardModalProps> = ({ card, player, weather, onConfirm }) => {
  const { t } = useI18n();
  if (!card) return null;

  const isFavorable = weather && (weather.type === 'RAIN' || weather.type === 'SUNNY' || weather.type === 'TEMPERATE');

  return (
    <ModalFrame
      ariaLabel={card.title}
      className="w-full max-w-lg bg-slate-900 border-2 border-sky-500/80 rounded-2xl shadow-2xl p-6 text-slate-100 my-auto"
    >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-widest">
            <HelpCircle className="w-4 h-4" />
            <span>{t.modals.situationCardTitle}</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
            {player.name}
          </span>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          <h3 className="hud-heading text-xl font-bold text-white">
            {card.title}
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            {card.description}
          </p>

          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs font-semibold text-sky-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>{card.impactText}</span>
          </div>

          {/* Clima Actual y Probabilidad Modificada */}
          {weather && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              isFavorable
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                : 'bg-amber-950/50 border-amber-700/60 text-amber-200'
            }`}>
              <CloudSun className="w-4 h-4 shrink-0 text-teal-400" />
              <div>
                <strong className="block text-white font-bold">{t.title.weatherLabel}: {weather.label}</strong>
                <span>{weather.description}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] sm:min-h-[38px] px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{t.modals.resolveCard}</span>
          </button>
        </div>
    </ModalFrame>
  );
};
