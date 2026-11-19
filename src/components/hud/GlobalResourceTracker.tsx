/**
 * GlobalResourceTracker.tsx
 * Rastreador global de recursos comunales en la esquina superior derecha del HUD.
 * Refleja en tiempo real el progreso colaborativo desde gameEngine a través de una
 * barra de progreso animada global y desglose por categoría:
 * Conocimiento, Urbano, Medioambiente y Salud.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Building2,
  Trees,
  HeartPulse,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  LineChart,
  BarChart3
} from 'lucide-react';
import { GameEngineState, GoodType } from '../../types/game';
import { playSound } from '../../utils/audio';

interface GlobalResourceTrackerProps {
  state: GameEngineState;
  isEvolutionOpen?: boolean;
  onToggleEvolution?: () => void;
  isCollectiveImpactOpen?: boolean;
  onToggleCollectiveImpact?: () => void;
}

interface CategoryStats {
  type: GoodType;
  label: string;
  common: number;
  publicCount: number;
  total: number;
  percent: number;
  barClass: string;
  textClass: string;
  icon: React.ReactNode;
}

export const GlobalResourceTracker: React.FC<GlobalResourceTrackerProps> = ({
  state,
  isEvolutionOpen = false,
  onToggleEvolution,
  isCollectiveImpactOpen = false,
  onToggleCollectiveImpact
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [pulseGain, setPulseGain] = useState(false);

  const resourceTiles = state.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const totalResources = resourceTiles.length || 1;
  const totalCommon = resourceTiles.filter(t => t.state === 'COMMON').length;
  const totalPublic = resourceTiles.filter(t => t.state === 'PUBLIC').length;
  const totalPrivate = resourceTiles.filter(t => t.state === 'PRIVATE').length;

  const commonPercent = Math.round((totalCommon / totalResources) * 100);
  const publicPercent = Math.min(
    100 - commonPercent,
    Math.round((totalPublic / totalResources) * 100)
  );

  // Detectar incrementos cooperativos para disparar pulso visual en la barra
  const prevCommonRef = useRef(totalCommon);
  useEffect(() => {
    if (totalCommon > prevCommonRef.current) {
      setPulseGain(true);
      const timer = setTimeout(() => setPulseGain(false), 1100);
      prevCommonRef.current = totalCommon;
      return () => clearTimeout(timer);
    }
    prevCommonRef.current = totalCommon;
  }, [totalCommon]);

  const buildCategoryStats = (
    type: GoodType,
    label: string,
    barClass: string,
    textClass: string,
    icon: React.ReactNode
  ): CategoryStats => {
    const catTiles = resourceTiles.filter(t => t.goodType === type);
    const total = catTiles.length || 1;
    const common = catTiles.filter(t => t.state === 'COMMON').length;
    const publicCount = catTiles.filter(t => t.state === 'PUBLIC').length;
    return {
      type,
      label,
      common,
      publicCount,
      total: catTiles.length,
      percent: Math.round((common / total) * 100),
      barClass,
      textClass,
      icon
    };
  };

  const categories: CategoryStats[] = [
    buildCategoryStats(
      'KNOWLEDGE',
      'Conocimiento',
      'from-sky-500 to-indigo-400',
      'text-sky-300',
      <BookOpen className="w-3 h-3 text-sky-400 shrink-0" />
    ),
    buildCategoryStats(
      'URBAN',
      'Urbano',
      'from-amber-500 to-orange-400',
      'text-amber-300',
      <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
    ),
    buildCategoryStats(
      'ENVIRONMENT',
      'Medioambiente',
      'from-emerald-500 to-teal-400',
      'text-emerald-300',
      <Trees className="w-3 h-3 text-emerald-400 shrink-0" />
    ),
    buildCategoryStats(
      'HEALTH',
      'Salud',
      'from-rose-500 to-pink-400',
      'text-rose-300',
      <HeartPulse className="w-3 h-3 text-rose-400 shrink-0" />
    )
  ];

  return (
    <section
      aria-label="Progreso Global de Bienes Comunales"
      className={`pointer-events-auto w-72 sm:w-80 bg-slate-900/90 border rounded-2xl shadow-xl text-slate-100 overflow-hidden transition-colors duration-300 ${
        pulseGain ? 'border-emerald-400 shadow-emerald-500/20' : 'border-teal-800/70'
      }`}
    >
      {/* Cabecera y barra de progreso global animada */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles
              className={`w-3.5 h-3.5 shrink-0 ${
                pulseGain ? 'text-emerald-300 animate-spin' : 'text-teal-400'
              }`}
            />
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-200 truncate">
              Bienes Comunales
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-black text-white tabular-nums">
              {totalCommon}
              <span className="text-slate-400 font-semibold">/{resourceTiles.length}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-700/60 text-[10px] font-bold text-emerald-300 tabular-nums">
              {commonPercent}%
            </span>
            {onToggleCollectiveImpact && (
              <button
                type="button"
                onClick={() => {
                  playSound.uiToggle(!isCollectiveImpactOpen);
                  onToggleCollectiveImpact();
                }}
                className={`p-1 rounded-md transition-colors ${
                  isCollectiveImpactOpen
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Collective Impact: Eficiencia del equipo vs especuladores"
                aria-label="Abrir panel Collective Impact"
                aria-expanded={isCollectiveImpactOpen}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleEvolution && (
              <button
                type="button"
                onClick={() => {
                  playSound.uiToggle(!isEvolutionOpen);
                  onToggleEvolution();
                }}
                className={`p-1 rounded-md transition-colors ${
                  isEvolutionOpen
                    ? 'bg-teal-600 text-white'
                    : 'text-teal-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Evolución D3: Comunes vs Privatizados por turno (Atajo: V)"
                aria-label="Abrir gráfico de evolución D3"
                aria-expanded={isEvolutionOpen}
              >
                <LineChart className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                playSound.uiToggle(!isExpanded);
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isExpanded ? 'Contraer categorías' : 'Ver las 4 categorías'}
              aria-label={isExpanded ? 'Contraer categorías' : 'Ver las 4 categorías'}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Barra de progreso principal animada (Común + en transición Pública) */}
        <div
          role="progressbar"
          aria-valuenow={commonPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Porcentaje global de bienes comunalizados"
          className="relative h-2.5 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex"
        >
          <motion.div
            initial={false}
            animate={{ width: `${commonPercent}%` }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-l-full relative"
          >
            {pulseGain && (
              <motion.span
                initial={{ x: '-100%', opacity: 0.8 }}
                animate={{ x: '200%', opacity: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                className="absolute inset-y-0 w-1/2 bg-white/50"
              />
            )}
          </motion.div>

          {publicPercent > 0 && (
            <motion.div
              initial={false}
              animate={{ width: `${publicPercent}%` }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="h-full bg-sky-500/45"
              title={`${totalPublic} bienes públicos en transición`}
            />
          )}
        </div>

        {/* Leyenda compacta Común / Público / Privado */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Comunes: {totalCommon}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400/70" />
            <span>Públicos: {totalPublic}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400/70" />
            <span>Privados: {totalPrivate}</span>
          </span>
        </div>
      </div>

      {/* Desglose animado de las 4 categorías comunales */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-x-3 gap-y-2 bg-slate-950/40">
          {categories.map((cat) => {
            const isComplete = cat.total > 0 && cat.common === cat.total;
            return (
              <div key={cat.type} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 font-semibold text-slate-200 truncate">
                    {cat.icon}
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <span className={`font-bold tabular-nums shrink-0 flex items-center gap-0.5 ${cat.textClass}`}>
                    {isComplete && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                    {cat.common}/{cat.total}
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-900 border border-slate-800/80 overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${cat.percent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${cat.barClass}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
