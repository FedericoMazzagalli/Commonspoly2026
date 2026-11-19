/**
 * TragedyVoteModal.tsx
 * Modal para la casilla de Tragedia de los Comunes
 * Obliga a privatizar colectivamente 3 bienes comunes (exceptuando los inalienables).
 */

import React, { useState } from 'react';
import { Skull, AlertTriangle, Check } from 'lucide-react';
import { Tile } from '../../types/game';

interface TragedyVoteModalProps {
  tiles: Tile[];
  onConfirmPrivatization: (tileIds: number[]) => void;
}

export const TragedyVoteModal: React.FC<TragedyVoteModalProps> = ({ tiles, onConfirmPrivatization }) => {
  // Solo los que sean comunes y no inalienables
  const commonTiles = tiles.filter(
    t => t.state === 'COMMON' && t.category !== 'INALIENABLE_COMMON'
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      if (selectedIds.length < 3) {
        setSelectedIds(prev => [...prev, id]);
      }
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length === 3 || (commonTiles.length < 3 && selectedIds.length === commonTiles.length)) {
      onConfirmPrivatization(selectedIds);
    }
  };

  const needed = Math.min(3, commonTiles.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-red-600 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-600/40">
            <Skull className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-400">
              Casilla Especial · Golpe Neoliberal
            </div>
            <h2 className="text-2xl font-black text-white">
              La Tragedia de los Comunes
            </h2>
          </div>
        </div>

        {/* Description */}
        <div className="py-4 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            ¡Presión extrema sobre los recursos comunitarios! Debéis privatizar de forma obligatoria 
            <strong className="text-red-400"> {needed} Bienes Comunes</strong> (los Bienes Comunes Inalienables rosas quedan a salvo).
          </p>

          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/60">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Selecciona {needed} bienes comunes para devolver a manos privadas ({selectedIds.length}/{needed}):</span>
          </div>

          {/* List of common tiles */}
          {commonTiles.length > 0 ? (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {commonTiles.map(tile => {
                const isSelected = selectedIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    onClick={() => toggleSelect(tile.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-950/40 text-red-200 ring-1 ring-red-500'
                        : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold">{tile.name} ({tile.goodType || 'Bien'})</div>
                    {isSelected && <Check className="w-4 h-4 text-red-400" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-slate-800/50 rounded-xl text-center text-xs text-slate-400">
              No hay bienes comunes convertidos actualmente para privatizar.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            disabled={selectedIds.length < needed && commonTiles.length >= needed}
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <span>Confirmar Privatización Forzosa</span>
          </button>
        </div>

      </div>
    </div>
  );
};
