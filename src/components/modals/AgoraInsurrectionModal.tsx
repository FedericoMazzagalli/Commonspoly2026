/**
 * AgoraInsurrectionModal.tsx
 * Modal de Insurrección Colectiva en el Ágora Central
 * Transforma una categoría completa de bienes en BIENES COMUNES
 */

import React, { useMemo, useState } from 'react';
import { Sparkles, HeartPulse, Building2, BookOpen, Trees, Flame, CheckCircle2 } from 'lucide-react';
import { GoodType, Tile } from '../../types/game';

interface AgoraInsurrectionModalProps {
  tiles?: Tile[];
  onSelectCategory: (category: GoodType) => void;
}

export const AgoraInsurrectionModal: React.FC<AgoraInsurrectionModalProps> = ({
  tiles = [],
  onSelectCategory
}) => {
  const remainingByCategory = useMemo(() => {
    const map: Record<GoodType, { remaining: number; total: number }> = {
      HEALTH: { remaining: 0, total: 0 },
      URBAN: { remaining: 0, total: 0 },
      KNOWLEDGE: { remaining: 0, total: 0 },
      ENVIRONMENT: { remaining: 0, total: 0 }
    };

    tiles.forEach(t => {
      if (t.goodType && (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY')) {
        map[t.goodType].total += 1;
        if (t.state !== 'COMMON') {
          map[t.goodType].remaining += 1;
        }
      }
    });

    return map;
  }, [tiles]);

  const firstIncomplete: GoodType =
    (['HEALTH', 'URBAN', 'KNOWLEDGE', 'ENVIRONMENT'] as GoodType[]).find(
      c => remainingByCategory[c].remaining > 0 || remainingByCategory[c].total === 0
    ) || 'HEALTH';

  const [selected, setSelected] = useState<GoodType>(firstIncomplete);

  const categories: { type: GoodType; title: string; desc: string; icon: React.ReactNode; color: string; border: string }[] = [
    {
      type: 'HEALTH',
      title: 'Bienes de la Salud',
      desc: 'Comunaliza Hospitales, Saunas, Piscinas, Centros de Salud Mental y Cuidados para que nadie quede desamparada.',
      icon: <HeartPulse className="w-6 h-6 text-fuchsia-400" />,
      color: 'bg-fuchsia-950/40 hover:bg-fuchsia-900/50',
      border: 'border-fuchsia-700/60'
    },
    {
      type: 'URBAN',
      title: 'Bienes Urbanos',
      desc: 'Comunaliza Tranvías, Edificios Abandonados, Parques Infantiles, Rutas Ciclistas y Espacios Públicos.',
      icon: <Building2 className="w-6 h-6 text-orange-400" />,
      color: 'bg-orange-950/40 hover:bg-orange-900/50',
      border: 'border-orange-700/60'
    },
    {
      type: 'KNOWLEDGE',
      title: 'Bienes del Conocimiento',
      desc: 'Comunaliza Bibliotecas, Museos, Salas de Conciertos, Universidades y Redes para garantizar la cultura libre.',
      icon: <BookOpen className="w-6 h-6 text-yellow-400" />,
      color: 'bg-yellow-950/40 hover:bg-yellow-900/50',
      border: 'border-yellow-700/60'
    },
    {
      type: 'ENVIRONMENT',
      title: 'Bienes Medioambientales',
      desc: 'Comunaliza Costas, Granjas Agroecológicas, Parques y Refugios Climáticos frente a la degradación ecológica.',
      icon: <Trees className="w-6 h-6 text-emerald-400" />,
      color: 'bg-emerald-950/40 hover:bg-emerald-900/50',
      border: 'border-emerald-700/60'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-pink-500 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/40">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-pink-400">
              Ágora Central · Democracia Directa
            </div>
            <h2 className="text-2xl font-black text-white">
              ¡Acción de Insurrección Colectiva!
            </h2>
          </div>
        </div>

        {/* Story copy */}
        <div className="py-4 space-y-2">
          <p className="text-sm text-slate-300 leading-relaxed">
            ¡Victoria asamblearia! Tres o más personas han alcanzado el centro del Ágora uniendo sus Puntos de Legitimidad. 
            El pueblo congregado decide por unanimidad <strong>desprivatizar y convertir en Bienes Comunes</strong> todos los recursos de un sector completo del tablero:
          </p>
        </div>

        {/* Category Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-3">
          {categories.map(cat => {
            const isChosen = selected === cat.type;
            const stats = remainingByCategory[cat.type];
            const isAlreadyComplete = stats.total > 0 && stats.remaining === 0;

            return (
              <button
                key={cat.type}
                type="button"
                disabled={isAlreadyComplete}
                onClick={() => setSelected(cat.type)}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isAlreadyComplete
                    ? 'border-emerald-800/50 bg-emerald-950/20 opacity-60 cursor-not-allowed'
                    : isChosen
                    ? 'border-pink-400 bg-pink-950/40 shadow-lg ring-2 ring-pink-500/50 scale-[1.01]'
                    : `${cat.border} ${cat.color} opacity-85 hover:opacity-100`
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-black/40 shrink-0">{cat.icon}</div>
                    <h4 className="font-bold text-base text-white truncate">{cat.title}</h4>
                  </div>
                  {stats.total > 0 && (
                    <span className="text-[11px] font-bold tabular-nums shrink-0 flex items-center gap-1 text-slate-300">
                      {isAlreadyComplete ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">100% Común</span>
                        </>
                      ) : (
                        <span className="text-pink-300">{stats.remaining}/{stats.total} restantes</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {cat.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-5 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => onSelectCategory(selected)}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            <span>¡Declarar Bien Común Inmediato!</span>
          </button>
        </div>

      </div>
    </div>
  );
};
