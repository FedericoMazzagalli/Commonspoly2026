/**
 * SituationCardModal.tsx
 * Modal de Carta de Situación ('S') individual para el personaje activo
 * Muestra el impacto y la modificación de probabilidad según el ciclo dinámico del clima.
 */

import React from 'react';
import { HelpCircle, Check, Sparkles, CloudSun } from 'lucide-react';
import { SituationCard, Character, WeatherCondition } from '../../types/game';

interface SituationCardModalProps {
  card: SituationCard | null;
  player: Character;
  weather?: WeatherCondition;
  onConfirm: () => void;
}

export const SituationCardModal: React.FC<SituationCardModalProps> = ({ card, player, weather, onConfirm }) => {
  if (!card) return null;

  const isFavorable = weather && (weather.type === 'RAIN' || weather.type === 'SUNNY' || weather.type === 'TEMPERATE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-sky-500/80 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-widest">
            <HelpCircle className="w-4 h-4" />
            <span>Carta de Situación ('S')</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
            {player.name}
          </span>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          <h3 className="text-xl font-bold text-white">
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
                <strong className="block text-white font-bold">Clima Dinámico Activo: {weather.label}</strong>
                <span>
                  {isFavorable
                    ? 'Clima favorable: +20% de probabilidad de éxito y bonus de recursos (+1 extra).'
                    : 'Clima adverso: Desafío de resiliencia comunitaria en la resolución de la situación.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Aceptar y Continuar</span>
          </button>
        </div>

      </div>
    </div>
  );
};
