/**
 * BitacoraHUD.tsx
 * Componente de 'Bitácora de Juego' superpuesto sutilmente en el HUD de Commonspoly.
 * Registra y resalta los eventos cooperativos clave (rescates, comunalizaciones,
 * insurrecciones del Ágora, apoyo mutuo) para enriquecer la narrativa colaborativa.
 */

import React, { useState } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight, 
  X, 
  Flame, 
  Award, 
  Filter,
  ScrollText,
  Clock,
  Layers,
  Trees
} from 'lucide-react';
import { GameLogEntry, CooperativeActionType } from '../../types/game';
import { playSound } from '../../utils/audio';

interface BitacoraHUDProps {
  logs: GameLogEntry[];
  round: number;
}

export const BitacoraHUD: React.FC<BitacoraHUDProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'COOP' | 'ALL' | 'HAZARD'>('COOP');

  // Contadores de logros colaborativos
  const cooperativeLogs = logs.filter(l => l.category === 'COOPERATIVE' || l.cooperativeAction);
  const rescuesCount = logs.filter(l => l.cooperativeAction === 'RESCUE').length;
  const commonsUnlockedCount = logs.filter(l => l.cooperativeAction === 'COMMON_UNLOCK').length;
  const agoraInsurrectionsCount = logs.filter(l => l.cooperativeAction === 'AGORA_INSURRECTION').length;

  const filteredLogs = logs.filter(log => {
    if (filter === 'COOP') return log.category === 'COOPERATIVE' || log.cooperativeAction;
    if (filter === 'HAZARD') return log.type === 'HAZARD';
    return true;
  });

  const getActionBadge = (action?: CooperativeActionType) => {
    switch (action) {
      case 'RESCUE':
        return {
          label: 'Rescate Solidario',
          icon: <HeartHandshake className="w-3 h-3 text-rose-300" />,
          color: 'text-rose-300 bg-rose-950/60 border-rose-800/60'
        };
      case 'COMMON_UNLOCK':
        return {
          label: 'Bien Comunalizado',
          icon: <Trees className="w-3 h-3 text-emerald-300" />,
          color: 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60'
        };
      case 'PUBLIC_UNLOCK':
        return {
          label: 'Gestión Pública',
          icon: <Layers className="w-3 h-3 text-sky-300" />,
          color: 'text-sky-300 bg-sky-950/60 border-sky-800/60'
        };
      case 'AGORA_INSURRECTION':
        return {
          label: 'Insurrección Ágora',
          icon: <Flame className="w-3 h-3 text-pink-300" />,
          color: 'text-pink-300 bg-pink-950/60 border-pink-800/60'
        };
      case 'CROWDFUND':
        return {
          label: 'Caja Solidaria',
          icon: <Sparkles className="w-3 h-3 text-amber-300" />,
          color: 'text-amber-300 bg-amber-950/60 border-amber-800/60'
        };
      case 'SOLIDARITY':
        return {
          label: 'Tejido Común',
          icon: <ShieldCheck className="w-3 h-3 text-teal-300" />,
          color: 'text-teal-300 bg-teal-950/60 border-teal-800/60'
        };
      default:
        return {
          label: 'Acción Colectiva',
          icon: <Sparkles className="w-3 h-3 text-teal-300" />,
          color: 'text-teal-300 bg-teal-950/60 border-teal-800/60'
        };
    }
  };

  return (
    <>
      {/* 1. CHIP DE ACCESO RÁPIDO A LA BITÁCORA (Superposición lateral derecha sutil) */}
      <div className="pointer-events-auto fixed right-4 bottom-28 md:bottom-24 z-20">
        <button
          onClick={() => {
            playSound.uiToggle(!isOpen);
            setIsOpen(!isOpen);
          }}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800/95 border border-teal-800/70 shadow-lg text-xs font-semibold text-slate-200 transition-all hover:scale-105 active:scale-95"
          title="Abrir Bitácora de Eventos Cooperativos"
        >
          <div className="p-1 rounded-lg bg-teal-500/20 text-teal-300">
            <ScrollText className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-white leading-tight">Bitácora de Juego</span>
            <span className="text-[10px] text-teal-400 tabular-nums">
              {cooperativeLogs.length} Hitos Solidarios
            </span>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* 3. PANEL COMPLETO DE BITÁCORA COLABORATIVA (Drawer lateral) */}
      {isOpen && (
        <div className="pointer-events-auto fixed top-16 right-4 bottom-24 w-84 md:w-96 max-w-[94vw] bg-slate-900/95 border border-teal-700/60 rounded-3xl shadow-2xl p-4 flex flex-col z-30 animate-in fade-in slide-in-from-right-4 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-teal-400" />
              <div>
                <h3 className="font-extrabold text-sm text-white leading-none">
                  Bitácora Cooperativa
                </h3>
                <span className="text-[10px] text-slate-400">
                  Crónica de Apoyo Mutuo y Cuidados
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                playSound.uiToggle(false);
                setIsOpen(false);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Resumen de Hitos Colectivos */}
          <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-800/80 text-center shrink-0">
            <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400 leading-tight">Rescates</div>
              <div className="text-base font-extrabold text-rose-400 tabular-nums">{rescuesCount}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400 leading-tight">Comunizados</div>
              <div className="text-base font-extrabold text-emerald-400 tabular-nums">{commonsUnlockedCount}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-400 leading-tight">Insurrección</div>
              <div className="text-base font-extrabold text-pink-400 tabular-nums">{agoraInsurrectionsCount}</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1.5 py-2.5 border-b border-slate-800 text-[11px] font-medium shrink-0">
            <button
              onClick={() => {
                playSound.uiClick();
                setFilter('COOP');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filter === 'COOP' ? 'bg-teal-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cooperación ({cooperativeLogs.length})
            </button>
            <button
              onClick={() => {
                playSound.uiClick();
                setFilter('HAZARD');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filter === 'HAZARD' ? 'bg-rose-950 text-rose-300 font-bold border border-rose-800/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              Amenazas
            </button>
            <button
              onClick={() => {
                playSound.uiClick();
                setFilter('ALL');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({logs.length})
            </button>
          </div>

          {/* Timeline Scrollable Feed */}
          <div className="py-2 overflow-y-auto space-y-2.5 flex-1 pr-1">
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => {
                const badge = getActionBadge(log.cooperativeAction);
                const isCoop = log.category === 'COOPERATIVE' || log.cooperativeAction;

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-2xl border transition-all text-xs ${
                      isCoop
                        ? 'bg-slate-950/80 border-teal-900/60 hover:border-teal-700/80'
                        : log.type === 'HAZARD'
                        ? 'bg-rose-950/20 border-rose-900/40'
                        : 'bg-slate-950/40 border-slate-800/60'
                    }`}
                  >
                    {/* Top row: Actor and Badge */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {log.actorColor && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: log.actorColor }}
                          />
                        )}
                        <span className="font-bold text-white truncate text-[11px]">
                          {log.actor}
                        </span>
                      </div>

                      {log.cooperativeAction ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.color}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          Ronda {log.round}
                        </span>
                      )}
                    </div>

                    {/* Message content */}
                    <p className="text-slate-200 text-xs leading-relaxed">
                      {log.message}
                    </p>

                    {/* Footer metadata */}
                    <div className="flex items-center justify-between pt-1.5 text-[10px] text-slate-500">
                      <span>{log.timestamp}</span>
                      {log.target && (
                        <span className="text-teal-400/90 font-medium">
                          Objetivo: {log.target}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Aún no hay eventos registrados en esta categoría.
              </div>
            )}
          </div>

          {/* Footer Quote */}
          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 italic text-center shrink-0">
            &quot;La cooperación mutua es la base de la felicidad radical.&quot;
          </div>

        </div>
      )}
    </>
  );
};
