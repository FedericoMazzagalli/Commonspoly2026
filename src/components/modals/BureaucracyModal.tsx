/**
 * BureaucracyModal.tsx
 * Casilla especial Burocracia (ID 10):
 * Permite pagar 6 Puntos de Bienestar para convertir 1 Bien Privado en Bien Público.
 */

import React, { useState } from 'react';
import { Landmark, Check, ArrowRight, X } from 'lucide-react';
import { Character, GoodType, Tile } from '../../types/game';
import { playSound } from '../../utils/audio';
import { formatSignedScore, getEffectiveBureaucracyCost, getReputationProfile } from '../../utils/reputation';

interface BureaucracyModalProps {
  player: Character;
  tiles: Tile[];
  onConfirm: (tileId: number) => void;
  onPass: () => void;
}

const SECTOR_LABEL: Record<GoodType, string> = {
  HEALTH: 'Salud',
  URBAN: 'Urbano',
  KNOWLEDGE: 'Conocimiento',
  ENVIRONMENT: 'Medioambiente'
};

export const BureaucracyModal: React.FC<BureaucracyModalProps> = ({
  player,
  tiles,
  onConfirm,
  onPass
}) => {
  const privateTiles = tiles.filter(
    t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state === 'PRIVATE'
  );
  const [selectedTileId, setSelectedTileId] = useState<number>(privateTiles[0]?.id ?? -1);
  const costInfo = getEffectiveBureaucracyCost(player);
  const repProfile = getReputationProfile(player);
  const canAfford = player.wellness > costInfo.effectiveCost && privateTiles.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gestión Pública en Burocracia"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-sky-500/60 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                Casilla Especial · Burocracia
              </div>
              <h2 className="text-xl font-extrabold text-white">
                Gestión Pública Administrativa
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
          <div className="space-y-1.5">
            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">{player.name}</strong> puede invertir{' '}
              <strong className="text-sky-300 tabular-nums">
                {costInfo.effectiveCost} Puntos de Bienestar
              </strong>{' '}
              (disponible:{' '}
              <span className="font-bold text-white tabular-nums">{player.wellness}</span>) para expropiar un
              recurso privado y pasarlo a <strong className="text-slate-200">Gestión Pública</strong>.
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap tabular-nums">
              <span>Reputación Vecinal:</span>
              <strong
                className={
                  repProfile.tone === 'POSITIVE'
                    ? 'text-emerald-300'
                    : repProfile.tone === 'NEGATIVE'
                    ? 'text-rose-300'
                    : 'text-slate-200'
                }
              >
                {repProfile.label} ({formatSignedScore(repProfile.score)})
              </strong>
              {costInfo.reputationDelta !== 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={costInfo.reputationDelta < 0 ? 'text-emerald-300' : 'text-amber-300'}>
                    Tarifa {costInfo.reputationDelta < 0 ? `${costInfo.reputationDelta} descuento` : `+${costInfo.reputationDelta} recargo`}
                  </span>
                </>
              )}
            </div>
          </div>

          {canAfford ? (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {privateTiles.map(tile => {
                const isSelected = tile.id === selectedTileId;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setSelectedTileId(tile.id);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 text-xs transition-colors ${
                      isSelected
                        ? 'border-sky-400 bg-sky-950/50 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{tile.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {tile.goodType ? SECTOR_LABEL[tile.goodType] : 'Recurso'} · Privado → Público
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 tabular-nums">
              {privateTiles.length === 0
                ? 'Ya no quedan bienes privados en el tablero para convertir.'
                : `Necesitas al menos ${costInfo.effectiveCost + 1} de Bienestar para costear el trámite sin quedar a cero (actual: ${player.wellness}).`}
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
            Pasar sin trámite
          </button>

          {canAfford && selectedTileId >= 0 && (
            <button
              type="button"
              onClick={() => onConfirm(selectedTileId)}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <span>Convertir a Público (-{costInfo.effectiveCost} Bienestar)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
