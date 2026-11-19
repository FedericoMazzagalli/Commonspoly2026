/**
 * GameHistorySidebar.tsx
 * Panel lateral de Chat y Narrativa de Sesión integrado en el HUD.
 * Registra y filtra interacciones cooperativas, eventos de rescate,
 * decisiones de votación (Ágora / Tragedia) y chat de la partida.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  History,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  MessageSquare,
  ShieldAlert,
  Vote,
  HeartHandshake,
  Milestone
} from 'lucide-react';
import {
  Character,
  GameLogEntry,
  CooperativeChatMessage,
  CooperativeAchievement,
  GameEngineState
} from '../../types/game';
import { playSound } from '../../utils/audio';
import { GameTimelinePanel } from './GameTimelinePanel';

interface GameHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
  chatMessages?: CooperativeChatMessage[];
  round: number;
  players: Character[];
  achievements?: CooperativeAchievement[];
  gameResult?: GameEngineState['gameResult'];
  gameResultDetails?: string;
  disableEscapeKey?: boolean;
}

type NarrativeFilter = 'ALL' | 'COOP' | 'RESCUE' | 'DECISIONS' | 'CHAT';

interface NarrativeItem {
  id: string;
  sequenceNumber?: number;
  source: 'LOG' | 'CHAT';
  round: number;
  timestamp: string;
  actor: string;
  actorColor?: string;
  message: string;
  type?: string;
  category?: string;
  cooperativeAction?: string | boolean;
  isRescue: boolean;
  isDecision: boolean;
  isCoop: boolean;
  isChat: boolean;
  timestampMs: number;
}

export const GameHistorySidebar: React.FC<GameHistorySidebarProps> = ({
  isOpen,
  onClose,
  logs,
  chatMessages = [],
  round,
  players,
  achievements = [],
  gameResult,
  gameResultDetails,
  disableEscapeKey = false
}) => {
  const [activeView, setActiveView] = useState<'NARRATIVE' | 'TIMELINE'>('NARRATIVE');
  const [filter, setFilter] = useState<NarrativeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chronologicalAsc, setChronologicalAsc] = useState(true);
  const [isUserScrolledAway, setIsUserScrolledAway] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // Mapa rápido de colores por nombre de personaje
  const playerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach(p => map.set(p.name, p.color));
    return map;
  }, [players]);

  // Unificar logs de juego y mensajes de chat en una narrativa cronológica coherente
  const narrativeItems = useMemo(() => {
    const items: NarrativeItem[] = [];

    logs.forEach((log, idx) => {
      const lower = log.message.toLowerCase();
      const isRescue =
        lower.includes('detención') ||
        lower.includes('rescate') ||
        lower.includes('fianza') ||
        lower.includes('liberado') ||
        lower.includes('detenido');
      const isDecision =
        lower.includes('voto') ||
        lower.includes('ágora') ||
        lower.includes('tragedia') ||
        lower.includes('decisión') ||
        lower.includes('elección') ||
        lower.includes('carta') ||
        lower.includes('insurrección');
      const isCoop =
        log.category === 'COOPERATIVE' ||
        !!log.cooperativeAction ||
        lower.includes('cooper') ||
        lower.includes('solidar') ||
        lower.includes('común');

      items.push({
        id: log.id,
        source: 'LOG',
        round: log.round,
        timestamp: log.timestamp,
        actor: log.actor,
        actorColor: log.actorColor,
        message: log.message,
        type: log.type,
        category: log.category,
        cooperativeAction: log.cooperativeAction,
        isRescue,
        isDecision,
        isCoop: isCoop || isRescue || isDecision,
        isChat: false,
        timestampMs: idx * 1000
      });
    });

    chatMessages.forEach((msg, idx) => {
      const lower = msg.text.toLowerCase();
      const isRescue = lower.includes('rescate') || lower.includes('fianza') || lower.includes('liberar');
      const isDecision = lower.includes('voto') || lower.includes('ágora') || lower.includes('tragedia');
      const isCoop = true;

      items.push({
        id: msg.id,
        source: 'CHAT',
        round: msg.round,
        timestamp: msg.timestamp,
        actor: msg.senderName,
        actorColor: msg.senderColor,
        message: msg.text,
        isRescue,
        isDecision,
        isCoop,
        isChat: true,
        timestampMs: (logs.length + idx) * 1000
      });
    });

    // Ordenar cronológicamente (Ronda 1 hasta N)
    items.sort((a, b) => a.timestampMs - b.timestampMs);
    const withSeq = items.map((item, idx) => ({ ...item, sequenceNumber: idx + 1 }));
    return chronologicalAsc ? withSeq : [...withSeq].reverse();
  }, [logs, chatMessages, chronologicalAsc]);

  // Filtrado por categoría narrativa y búsqueda textual
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return narrativeItems.filter(item => {
      if (filter === 'COOP' && !item.isCoop) return false;
      if (filter === 'RESCUE' && !item.isRescue) return false;
      if (filter === 'DECISIONS' && !item.isDecision) return false;
      if (filter === 'CHAT' && !item.isChat) return false;

      if (q) {
        const matchActor = item.actor.toLowerCase().includes(q);
        const matchMsg = item.message.toLowerCase().includes(q);
        const matchRound = `ronda ${item.round}`.includes(q);
        if (!matchActor && !matchMsg && !matchRound) return false;
      }

      return true;
    });
  }, [narrativeItems, filter, searchQuery]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen || disableEscapeKey) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playSound.modalClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, disableEscapeKey]);

  // Auto-scroll inteligente
  useEffect(() => {
    if (!isOpen || !listRef.current || isUserScrolledAway) return;
    const el = listRef.current;
    if (chronologicalAsc) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = 0;
    }
  }, [filteredItems.length, isOpen, chronologicalAsc, isUserScrolledAway]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    if (chronologicalAsc) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsUserScrolledAway(distanceFromBottom > 48);
    } else {
      setIsUserScrolledAway(el.scrollTop > 48);
    }
  };

  const scrollToTop = () => {
    if (!listRef.current) return;
    playSound.uiClick();
    listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    if (!listRef.current) return;
    playSound.uiClick();
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    setIsUserScrolledAway(false);
  };

  const getItemBadge = (item: NarrativeItem) => {
    if (item.isChat) {
      return { label: 'Chat', color: 'text-sky-400 bg-sky-950/80 border-sky-800/60' };
    }
    if (item.isRescue) {
      return { label: 'Rescate', color: 'text-rose-400 bg-rose-950/80 border-rose-800/60' };
    }
    if (item.isDecision) {
      return { label: 'Decisión', color: 'text-amber-400 bg-amber-950/80 border-amber-800/60' };
    }
    if (item.isCoop) {
      return { label: 'Cooperación', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60' };
    }
    return { label: 'Acción', color: 'text-teal-300 bg-teal-950/80 border-teal-800/60' };
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Panel de Chat y Narrativa de Sesión"
      className="pointer-events-auto fixed top-16 right-3 md:right-6 bottom-6 w-[23rem] sm:w-[28rem] max-w-[94vw] z-40 flex flex-col bg-slate-900/95 border border-teal-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 select-text backdrop-blur-md"
    >
      {/* CABECERA */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-teal-900/50 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-400 shrink-0" />
              <h2 className="text-sm font-extrabold text-white tracking-tight truncate">
                Chat y Narrativa de Sesión
              </h2>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 tabular-nums">
              <span>{narrativeItems.length} registros</span>
              <span aria-hidden="true">·</span>
              <span>Ronda {round} / 20</span>
              <span aria-hidden="true">·</span>
              <span>{activeView === 'TIMELINE' ? 'Timeline de Hitos' : chronologicalAsc ? 'Cronológico' : 'Recientes'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound.modalClose();
              onClose();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Cerrar panel de chat y narrativa"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de modo: Narrativa & Chat vs Timeline de Hitos */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setActiveView('NARRATIVE');
            }}
            className={`py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeView === 'NARRATIVE'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Narrativa & Chat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setActiveView('TIMELINE');
            }}
            className={`py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeView === 'TIMELINE'
                ? 'bg-teal-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Milestone className="w-3.5 h-3.5 text-amber-300" />
            <span>Timeline de Hitos</span>
          </button>
        </div>
      </div>

      {/* VISTA A: TIMELINE DE HITOS CLAVE */}
      {activeView === 'TIMELINE' ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <GameTimelinePanel
            logs={logs}
            achievements={achievements}
            gameResult={gameResult}
            gameResultDetails={gameResultDetails}
            round={round}
          />
        </div>
      ) : (
        /* VISTA B: CONTROLES DE BÚSQUEDA Y LISTA NARRATIVA */
        <>
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar votación, rescate, chat o ronda..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
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

          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setChronologicalAsc(prev => !prev);
              setIsUserScrolledAway(false);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            title={chronologicalAsc ? 'Cambiar a más recientes primero' : 'Cambiar a orden cronológico (1 → N)'}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
            <span>{chronologicalAsc ? '1 → N' : 'N → 1'}</span>
          </button>
        </div>

        {/* Filtros específicos solicitados: Cooperación, Rescates, Decisiones, Chat */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg overflow-x-auto text-[11px] no-scrollbar">
          {(
            [
              { id: 'ALL', label: 'Todo' },
              { id: 'COOP', label: '🤝 Cooperación' },
              { id: 'RESCUE', label: '🚨 Rescates' },
              { id: 'DECISIONS', label: '⚖️ Decisiones' },
              { id: 'CHAT', label: '💬 Chat' }
            ] as { id: NarrativeFilter; label: string }[]
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playSound.uiClick();
                setFilter(tab.id);
              }}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 transition-colors ${
                filter === tab.id
                  ? 'bg-teal-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contador y navegación rápida */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="tabular-nums">
            Mostrando {filteredItems.length} de {narrativeItems.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollToTop}
              className="hover:text-teal-300 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowUp className="w-3 h-3" />
              <span>{chronologicalAsc ? 'Inicio' : 'Último'}</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={scrollToBottom}
              className="hover:text-teal-300 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              <span>{chronologicalAsc ? 'Actual' : 'Inicio'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* LISTA NARRATIVA DESPLAZABLE */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 relative space-y-1.5"
      >
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <p>No se encontraron registros que coincidan con este filtro narrativo.</p>
            {(filter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const prevItem = idx > 0 ? filteredItems[idx - 1] : null;
            const showRoundDivider = !prevItem || prevItem.round !== item.round;
            const actorColor = item.actorColor || playerColorMap.get(item.actor) || '#94a3b8';
            const badge = getItemBadge(item);

            return (
              <React.Fragment key={item.id}>
                {showRoundDivider && (
                  <div className="sticky top-0 z-10 py-1.5 bg-slate-900/95 border-b border-slate-800 text-[11px] font-bold text-teal-400 flex items-center justify-between tabular-nums">
                    <span>Ronda {item.round}</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      Narrativa de Sesión
                    </span>
                  </div>
                )}

                <div className="py-2.5 px-3 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums flex-wrap mb-1">
                    <span className="font-mono text-slate-500">#{item.sequenceNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold" style={{ color: actorColor }}>
                      {item.actor}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">
                      {item.timestamp}
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed break-words ${
                    item.isChat ? 'text-sky-100 font-medium' : 'text-slate-200'
                  }`}>
                    {item.message}
                  </p>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* BOTÓN FLOTANTE SI EL USUARIO RETROCEDIÓ */}
      {isUserScrolledAway && (
        <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Viendo eventos anteriores</span>
          <button
            type="button"
            onClick={() => {
              if (chronologicalAsc) scrollToBottom();
              else scrollToTop();
            }}
            className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-[11px] transition-colors whitespace-nowrap shrink-0"
          >
            Ir al evento actual
          </button>
        </div>
      )}
        </>
      )}
    </aside>
  );
};
