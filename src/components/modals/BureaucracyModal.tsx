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
import { useI18n } from '../../i18n';

interface BureaucracyModalProps {
  player: Character;
  tiles: Tile[];
  onConfirm: (tileId: number) => void;
  onPass: () => void;
}

export const BureaucracyModal: React.FC<BureaucracyModalProps> = ({
  player,
  tiles,
  onConfirm,
  onPass
}) => {
  const { t } = useI18n();
  const sectorLabel: Record<GoodType, string> = {
    HEALTH: t.common.health,
    URBAN: t.common.urban,
    KNOWLEDGE: t.common.knowledge,
    ENVIRONMENT: t.common.environment
  };
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
      aria-label={t.modals.bureaucracyTitle}
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
                {t.modals.bureaucracyTitle}
              </div>
              <h2 className="text-xl font-extrabold text-white">
                {t.modals.bureaucracyTitle}
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
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">{player.name}</strong> ·{' '}
              <strong className="text-sky-300 tabular-nums">
                {costInfo.effectiveCost} {t.common.wellness}
              </strong>{' '}
              ({t.common.wellness}:{' '}
              <span className="font-bold text-white tabular-nums">{player.wellness}</span>) ·{' '}
              <strong className="text-slate-200">{t.common.private} → {t.common.public}</strong>
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap tabular-nums">
              <span>{t.debug.repModifier}:</span>
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
                    {costInfo.reputationDelta < 0 ? `${costInfo.reputationDelta}` : `+${costInfo.reputationDelta}`}
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
                        {tile.goodType ? sectorLabel[tile.goodType] : t.common.private} · {t.common.private} → {t.common.public}
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
                ? `0 ${t.hud.privatePlural}`
                : `${t.common.wellness} < ${costInfo.effectiveCost + 1} (${player.wellness})`}
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
            {t.hud.passTurn}
          </button>

          {canAfford && selectedTileId >= 0 && (
            <button
              type="button"
              onClick={() => onConfirm(selectedTileId)}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <span>{t.common.public} (-{costInfo.effectiveCost} {t.common.wellness})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
