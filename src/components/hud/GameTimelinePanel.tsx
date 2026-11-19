/**
 * GameTimelinePanel.tsx
 * Panel visual interactivo de 'Timeline de la Partida' para el historial de chat.
 * Renderiza cronológicamente los hitos clave de la sesión de juego (como el inicio
 * de una tragedia, el desbloqueo de un logro, eventos de crisis, insurrecciones
 * y comunalizaciones) con un raíl temporal continuo, iconos distintivos y timestamps.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Flame,
  Trophy,
  AlertTriangle,
  Trees,
  Landmark,
  Vote,
  HeartHandshake,
  Lock,
  Globe,
  Award,
  ArrowUpDown,
  Search,
  X,
  Milestone,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertOctagon
} from 'lucide-react';
import {
  CooperativeAchievement,
  GameEngineState,
  GameLogEntry
} from '../../types/game';
import {
  extractMilestonesFromGame,
  GameMilestone,
  MilestoneCategory
} from '../../utils/gameTimeline';
import { playSound } from '../../utils/audio';

interface GameTimelinePanelProps {
  logs: GameLogEntry[];
  achievements?: CooperativeAchievement[];
  gameResult?: GameEngineState['gameResult'];
  gameResultDetails?: string;
  round: number;
  className?: string;
  compact?: boolean;
}

export const GameTimelinePanel: React.FC<GameTimelinePanelProps> = ({
  logs,
  achievements = [],
  gameResult,
  gameResultDetails,
  round,
  className = '',
  compact = false
}) => {
  const [categoryFilter, setCategoryFilter] = useState<MilestoneCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chronologicalAsc, setChronologicalAsc] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Extraer todos los hitos clave disponibles en la partida
  const allMilestones = useMemo(() => {
    return extractMilestonesFromGame(logs, achievements, gameResult, gameResultDetails);
  }, [logs, achievements, gameResult, gameResultDetails]);

  // Filtrado y ordenación
  const filteredMilestones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matches = allMilestones.filter(m => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) {
        return false;
      }

      if (q) {
        const inTitle = m.title.toLowerCase().includes(q);
        const inDesc = m.description.toLowerCase().includes(q);
        const inActor = m.actor.toLowerCase().includes(q);
        const inRound = `ronda ${m.round}`.includes(q) || `r${m.round}`.includes(q);
        if (!inTitle && !inDesc && !inActor && !inRound) return false;
      }

      return true;
    });

    return chronologicalAsc ? matches : [...matches].reverse();
  }, [allMilestones, categoryFilter, searchQuery, chronologicalAsc]);

  // Contadores por categoría para insignias informativas
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      TRAGEDY: 0,
      ACHIEVEMENT: 0,
      CRISIS: 0,
      COMMON: 0,
      DECISION: 0,
      AGORA: 0,
      RESCUE: 0
    };
    allMilestones.forEach(m => {
      if (counts[m.category] !== undefined) {
        counts[m.category]++;
      }
    });
    return counts;
  }, [allMilestones]);

  const scrollToTop = () => {
    if (!scrollContainerRef.current) return;
    playSound.uiClick();
    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    if (!scrollContainerRef.current) return;
    playSound.uiClick();
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Renderizar icono distintivo por tipo de hito
  const renderMilestoneIcon = (iconType: GameMilestone['iconType']) => {
    switch (iconType) {
      case 'TRAGEDY':
        return <Flame className="w-4 h-4 text-rose-300" />;
      case 'ACHIEVEMENT':
        return <Trophy className="w-4 h-4 text-amber-300" />;
      case 'CRISIS':
        return <AlertTriangle className="w-4 h-4 text-orange-300" />;
      case 'COMMON':
        return <Trees className="w-4 h-4 text-emerald-300" />;
      case 'AGORA':
        return <Landmark className="w-4 h-4 text-purple-300" />;
      case 'DECISION':
        return <Vote className="w-4 h-4 text-sky-300" />;
      case 'RESCUE':
        return <HeartHandshake className="w-4 h-4 text-teal-300" />;
      case 'DETENTION':
        return <Lock className="w-4 h-4 text-rose-400" />;
      case 'CARD':
        return <Globe className="w-4 h-4 text-blue-300" />;
      case 'VICTORY':
        return <Sparkles className="w-4 h-4 text-emerald-300" />;
      case 'DRAW':
        return <HeartHandshake className="w-4 h-4 text-sky-300" />;
      case 'DEFEAT':
        return <AlertOctagon className="w-4 h-4 text-rose-300" />;
      default:
        return <Milestone className="w-4 h-4 text-teal-300" />;
    }
  };

  const getRailNodeClasses = (iconType: GameMilestone['iconType'], highlight?: boolean) => {
    switch (iconType) {
      case 'TRAGEDY':
      case 'DEFEAT':
        return 'bg-rose-950 border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]';
      case 'ACHIEVEMENT':
        return 'bg-amber-950 border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.35)]';
      case 'CRISIS':
        return 'bg-orange-950 border-orange-500/80 shadow-[0_0_10px_rgba(249,115,22,0.3)]';
      case 'COMMON':
      case 'VICTORY':
        return 'bg-emerald-950 border-emerald-400/90 shadow-[0_0_12px_rgba(16,185,129,0.35)]';
      case 'AGORA':
        return 'bg-purple-950 border-purple-400/80 shadow-[0_0_10px_rgba(192,132,252,0.3)]';
      case 'DECISION':
      case 'DRAW':
        return 'bg-sky-950 border-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.3)]';
      case 'RESCUE':
        return 'bg-teal-950 border-teal-400/80 shadow-[0_0_10px_rgba(45,212,191,0.3)]';
      default:
        return 'bg-slate-900 border-slate-700 shadow-sm';
    }
  };

  return (
    <div
      className={`flex flex-col h-full select-text min-h-0 ${className}`}
      aria-label="Timeline de Hitos Clave de la Partida"
    >
      {/* 1. BARRA DE CONTROLES Y FILTROS */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          {/* Campo de búsqueda */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar hito, logro, tragedia, actor..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Selector de orden cronológico */}
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setChronologicalAsc(prev => !prev);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 shrink-0 transition-colors"
            title={chronologicalAsc ? 'Cronológico: 1 → N' : 'Recientes: N → 1'}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
            <span>{chronologicalAsc ? '1 → N' : 'N → 1'}</span>
          </button>
        </div>

        {/* Pestañas de filtrado rápido */}
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setCategoryFilter('ALL');
            }}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors ${
              categoryFilter === 'ALL'
                ? 'bg-teal-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Todos ({allMilestones.length})
          </button>

          {categoryCounts.TRAGEDY > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setCategoryFilter('TRAGEDY');
              }}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === 'TRAGEDY'
                  ? 'bg-rose-700 text-white font-bold'
                  : 'text-rose-300/80 hover:text-rose-100 hover:bg-rose-950/40'
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400" />
              Tragedias ({categoryCounts.TRAGEDY})
            </button>
          )}

          {categoryCounts.ACHIEVEMENT > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setCategoryFilter('ACHIEVEMENT');
              }}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === 'ACHIEVEMENT'
                  ? 'bg-amber-600 text-slate-950 font-black'
                  : 'text-amber-300/80 hover:text-amber-100 hover:bg-amber-950/40'
              }`}
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              Logros ({categoryCounts.ACHIEVEMENT})
            </button>
          )}

          {categoryCounts.CRISIS > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setCategoryFilter('CRISIS');
              }}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === 'CRISIS'
                  ? 'bg-orange-700 text-white font-bold'
                  : 'text-orange-300/80 hover:text-orange-100 hover:bg-orange-950/40'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-orange-400" />
              Crisis ({categoryCounts.CRISIS})
            </button>
          )}

          {categoryCounts.COMMON > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setCategoryFilter('COMMON');
              }}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === 'COMMON'
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'text-emerald-300/80 hover:text-emerald-100 hover:bg-emerald-950/40'
              }`}
            >
              <Trees className="w-3 h-3 text-emerald-400" />
              Comunes ({categoryCounts.COMMON})
            </button>
          )}

          {categoryCounts.DECISION > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setCategoryFilter('DECISION');
              }}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === 'DECISION'
                  ? 'bg-sky-700 text-white font-bold'
                  : 'text-sky-300/80 hover:text-sky-100 hover:bg-sky-950/40'
              }`}
            >
              <Vote className="w-3 h-3 text-sky-400" />
              Decisiones ({categoryCounts.DECISION})
            </button>
          )}
        </div>

        {/* Subbarra con métricas y navegación rápida */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <div className="flex items-center gap-1.5 tabular-nums">
            <span className="font-semibold text-slate-300">{filteredMilestones.length}</span>
            <span>de {allMilestones.length} hitos</span>
            <span aria-hidden="true">·</span>
            <span>Ronda {round}/20</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollToTop}
              className="hover:text-teal-300 flex items-center gap-1 transition-colors"
            >
              <ArrowUp className="w-3 h-3" />
              <span>{chronologicalAsc ? 'Inicio' : 'Último'}</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={scrollToBottom}
              className="hover:text-teal-300 flex items-center gap-1 transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              <span>{chronologicalAsc ? 'Actual' : 'Inicio'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. CUERPO DEL TIMELINE CON LÍNEA VERTICAL CONTINUA */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 relative"
      >
        {filteredMilestones.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-xs italic space-y-2">
            <Milestone className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
            <p>No se encontraron hitos clave con los filtros actuales.</p>
            {(categoryFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-teal-400 hover:underline font-semibold"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-7 space-y-4">
            {/* Raíl vertical continuo */}
            <div
              className="absolute left-[13px] sm:left-[15px] top-2 bottom-3 w-0.5 bg-gradient-to-b from-teal-500/80 via-purple-500/50 to-slate-800"
              aria-hidden="true"
            />

            {filteredMilestones.map((milestone, idx) => {
              const nodeClasses = getRailNodeClasses(milestone.iconType, milestone.highlight);

              return (
                <div
                  key={milestone.id}
                  className="relative group animate-fadeIn"
                >
                  {/* Nodo circular en el raíl vertical */}
                  <div
                    className={`absolute -left-[27px] sm:-left-[31px] top-2.5 w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 z-10 ${nodeClasses}`}
                  >
                    {renderMilestoneIcon(milestone.iconType)}
                  </div>

                  {/* Tarjeta de hito */}
                  <div
                    className={`p-3 rounded-2xl border text-xs transition-colors ${
                      milestone.highlight
                        ? 'bg-slate-950/80 border-slate-700/80 hover:border-teal-500/80 shadow-md'
                        : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    {/* Metadatos superiores limpios (sin pastillas estáticas) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-800/60 text-[11px]">
                      <div className="flex items-center gap-2">
                        {/* Indicador de categoría */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${milestone.badgeClass}`}
                        >
                          {milestone.badgeLabel}
                        </span>

                        {/* Actor / Autor del hito */}
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          {milestone.actorColor && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: milestone.actorColor }}
                            />
                          )}
                          <span className="truncate max-w-[120px]">{milestone.actor}</span>
                        </span>
                      </div>

                      {/* Ronda y hora en cifras tabulares */}
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums flex items-center gap-1">
                        <span>Ronda {milestone.round}</span>
                        <span aria-hidden="true">·</span>
                        <span>{milestone.timestamp}</span>
                      </div>
                    </div>

                    {/* Título del hito */}
                    <h4 className="text-xs sm:text-sm font-bold text-white mt-1.5 leading-snug">
                      {milestone.title}
                    </h4>

                    {/* Descripción y contexto narrativo */}
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed break-words">
                      {milestone.description}
                    </p>

                    {/* Impacto o metadatos adicionales si existen */}
                    {milestone.impact && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="text-teal-400/90 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-teal-400" />
                          {milestone.impact}
                        </span>
                        <span className="text-slate-500 font-mono">#{idx + 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
