/**
 * GameChatLog.tsx
 * Componente integrado en GameOverlayHUD que muestra en tiempo real los últimos
 * 5 mensajes y acciones de la partida (movimientos, decisiones de bots, tiradas de dados,
 * desprivatizaciones y mensajes del chat rápido cooperativo).
 * Incluye acceso al historial completo de acciones con filtros por Bots, Jugadores y Chat.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Bot,
  User,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Trees
} from 'lucide-react';
import { GameEngineState } from '../../types/game';
import { playSound } from '../../utils/audio';

export interface GameChatLogProps {
  state: GameEngineState;
  className?: string;
}

export interface UnifiedLogItem {
  id: string;
  source: 'CHAT' | 'ACTION';
  round: number;
  timestamp: string;
  actor: string;
  actorColor: string;
  isBot: boolean;
  isHuman: boolean;
  isSystem: boolean;
  text: string;
  type?: string;
  tag?: string;
  timestampMs: number;
}

type FilterType = 'ALL' | 'BOTS' | 'PLAYERS' | 'CHAT';

export const GameChatLog: React.FC<GameChatLogProps> = ({
  state,
  className = ''
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalFilter, setModalFilter] = useState<'ALL' | 'BOTS' | 'PLAYERS' | 'CHAT' | 'COMMONS'>('ALL');

  // Mapeo de nombres de bots y jugadores humanos
  const botNames = useMemo(() => {
    return new Set(state.players.filter(p => p.controller === 'BOT').map(p => p.name));
  }, [state.players]);

  const humanNames = useMemo(() => {
    return new Set(state.players.filter(p => p.controller === 'HUMAN').map(p => p.name));
  }, [state.players]);

  // Función para extraer timestamp numérico de los identificadores únicos
  const extractTimestamp = (id: string, fallbackOffset: number): number => {
    const match = id.match(/_(\d{10,14})/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return Date.now() - fallbackOffset;
  };

  // Construcción unificada y ordenada de la lista de mensajes y acciones
  const unifiedItems: UnifiedLogItem[] = useMemo(() => {
    // 1. Mensajes de chat cooperativo (jugadores y bots)
    const chatItems: UnifiedLogItem[] = state.chatMessages.map((msg, idx) => {
      const isBot = msg.controller === 'BOT' || botNames.has(msg.senderName);
      const isHuman = msg.controller === 'HUMAN' || humanNames.has(msg.senderName);
      const isSystem = !isBot && !isHuman;

      return {
        id: msg.id,
        source: 'CHAT',
        round: msg.round,
        timestamp: msg.timestamp,
        actor: msg.senderName,
        actorColor: msg.senderColor || '#14b8a6',
        isBot,
        isHuman,
        isSystem,
        text: msg.text,
        type: 'CHAT',
        tag: msg.votingContext || 'Chat',
        timestampMs: extractTimestamp(msg.id, (state.chatMessages.length - idx) * 1200)
      };
    });

    // 2. Acciones y eventos de juego (tiradas, desprivatizaciones, detenciones, decisiones de bots)
    const actionItems: UnifiedLogItem[] = state.logs.map((log, idx) => {
      const isBot =
        botNames.has(log.actor) ||
        log.message.includes('[BOT]') ||
        log.actor.toLowerCase().includes('bot');
      const isHuman = !isBot && humanNames.has(log.actor);
      const isSystem = !isBot && !isHuman;

      return {
        id: log.id,
        source: 'ACTION',
        round: log.round,
        timestamp: log.timestamp,
        actor: log.actor,
        actorColor: log.actorColor || (isBot ? '#a855f7' : isHuman ? '#14b8a6' : '#94a3b8'),
        isBot,
        isHuman,
        isSystem,
        text: log.message,
        type: log.type,
        tag: log.cooperativeAction ? 'Cooperativa' : log.type === 'ACTION' ? 'Acción' : log.type === 'SUCCESS' ? 'Éxito' : log.type === 'HAZARD' ? 'Alerta' : 'Evento',
        timestampMs: extractTimestamp(log.id, idx * 800)
      };
    });

    // Unir y ordenar estrictamente de más reciente a más antiguo
    const combined = [...chatItems, ...actionItems];
    combined.sort((a, b) => b.timestampMs - a.timestampMs);
    return combined;
  }, [state.chatMessages, state.logs, botNames, humanNames]);

  // Filtrado de los mensajes para la vista principal
  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'BOTS':
        return unifiedItems.filter(item => item.isBot);
      case 'PLAYERS':
        return unifiedItems.filter(item => item.isHuman);
      case 'CHAT':
        return unifiedItems.filter(item => item.source === 'CHAT');
      case 'ALL':
      default:
        return unifiedItems;
    }
  }, [unifiedItems, filter]);

  // ÚLTIMOS 5 MENSAJES DE LA PARTIDA (según el filtro activo)
  const last5Messages = useMemo(() => {
    return filteredItems.slice(0, 5);
  }, [filteredItems]);

  // Métricas para badges y cabecera
  const botEventsCount = useMemo(() => unifiedItems.filter(i => i.isBot).length, [unifiedItems]);
  const humanEventsCount = useMemo(() => unifiedItems.filter(i => i.isHuman).length, [unifiedItems]);

  // Manejo de teclado para cerrar el modal con ESC
  useEffect(() => {
    if (!isHistoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playSound.modalClose();
        setIsHistoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryModalOpen]);

  // Filtrado detallado para el modal de Historial Completo
  const modalFilteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      // Filtro por categoría
      if (modalFilter === 'BOTS' && !item.isBot) return false;
      if (modalFilter === 'PLAYERS' && !item.isHuman) return false;
      if (modalFilter === 'CHAT' && item.source !== 'CHAT') return false;
      if (modalFilter === 'COMMONS') {
        const lower = item.text.toLowerCase();
        if (!lower.includes('común') && !lower.includes('desprivatiz') && !lower.includes('público')) {
          return false;
        }
      }

      // Búsqueda textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inActor = item.actor.toLowerCase().includes(query);
        const inText = item.text.toLowerCase().includes(query);
        return inActor || inText;
      }

      return true;
    });
  }, [unifiedItems, modalFilter, searchQuery]);

  return (
    <>
      <div
        className={`pointer-events-auto w-full max-w-lg md:max-w-xl transition-all duration-200 select-none ${className}`}
        aria-label="Registro de Chat y Acciones de Partida"
      >
        <div className="bg-slate-900/90 border border-teal-800/60 hover:border-teal-600/70 rounded-2xl shadow-xl overflow-hidden backdrop-blur-none transition-colors">
          
          {/* BARRA SUPERIOR / CABECERA */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950/70 border-b border-teal-900/40 gap-2">
            
            {/* Título & Badges */}
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-xs font-bold text-white tracking-tight truncate">
                Chat & Acciones
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800/70 tabular-nums shrink-0">
                Últimos 5
              </span>
              {botEventsCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60 shrink-0">
                  <Bot className="w-2.5 h-2.5 text-purple-400" />
                  {botEventsCount} bots
                </span>
              )}
            </div>

            {/* Acciones: Filtros rápidos, Historial Completo y Minimizar */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Botón para abrir modal de Historial Completo */}
              <button
                type="button"
                onClick={() => {
                  playSound.modalOpen();
                  setIsHistoryModalOpen(true);
                }}
                className="px-2 py-1 rounded-lg bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 hover:text-white border border-teal-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="Abrir historial completo de la partida"
              >
                <History className="w-3 h-3 text-teal-400" />
                <span className="hidden xs:inline">Historial</span>
              </button>

              {/* Botón de Colapsar / Expandir */}
              <button
                type="button"
                onClick={() => {
                  playSound.uiToggle(!isMinimized);
                  setIsMinimized(!isMinimized);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMinimized ? 'Expandir últimos 5 mensajes' : 'Minimizar registro'}
                aria-label={isMinimized ? 'Expandir últimos 5 mensajes' : 'Minimizar registro'}
              >
                {isMinimized ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* CUERPO DEL COMPONENTE: ÚLTIMOS 5 MENSAJES */}
          {!isMinimized && (
            <div className="p-2 sm:p-2.5 flex flex-col gap-1.5">
              
              {/* Pestañas de filtrado rápido */}
              <div className="flex items-center gap-1 text-[11px] pb-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setFilter('ALL');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors shrink-0 ${
                    filter === 'ALL'
                      ? 'bg-teal-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Todos ({unifiedItems.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setFilter('BOTS');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 shrink-0 ${
                    filter === 'BOTS'
                      ? 'bg-purple-700 text-white font-bold'
                      : 'text-purple-300/80 hover:text-purple-200 hover:bg-purple-950/40'
                  }`}
                >
                  <Bot className="w-3 h-3 text-purple-400" />
                  Bots ({botEventsCount})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setFilter('PLAYERS');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 shrink-0 ${
                    filter === 'PLAYERS'
                      ? 'bg-emerald-700 text-white font-bold'
                      : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-950/40'
                  }`}
                >
                  <User className="w-3 h-3 text-emerald-400" />
                  Jugadores ({humanEventsCount})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setFilter('CHAT');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 shrink-0 ${
                    filter === 'CHAT'
                      ? 'bg-sky-700 text-white font-bold'
                      : 'text-sky-300/80 hover:text-sky-200 hover:bg-sky-950/40'
                  }`}
                >
                  <MessageSquare className="w-3 h-3 text-sky-400" />
                  Chat ({state.chatMessages.length})
                </button>
              </div>

              {/* LISTA DE LOS ÚLTIMOS 5 MENSAJES */}
              <div className="flex flex-col gap-1.5">
                {last5Messages.length === 0 ? (
                  <div className="py-3 px-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-400 italic">
                    Sin eventos recientes para este filtro.
                  </div>
                ) : (
                  last5Messages.map((item, index) => (
                    <div
                      key={item.id}
                      className={`group flex items-start gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                        index === 0
                          ? 'bg-slate-950/80 border-teal-700/50 hover:border-teal-500/80'
                          : 'bg-slate-950/45 border-slate-800/50 hover:bg-slate-950/70 hover:border-slate-700/70'
                      }`}
                    >
                      {/* Avatar del emisor */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5 shadow-sm"
                        style={{ backgroundColor: item.actorColor }}
                      >
                        {item.actor.charAt(0).toUpperCase()}
                      </div>

                      {/* Contenido principal */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Nombre del actor */}
                          <span className="font-bold text-slate-100 truncate text-[11px]">
                            {item.actor}
                          </span>

                          {/* Rol: Bot / Jugador / Sistema */}
                          {item.isBot ? (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-purple-950/90 text-purple-300 border border-purple-800/60">
                              <Bot className="w-2.5 h-2.5 text-purple-400" />
                              Bot
                            </span>
                          ) : item.isHuman ? (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/60">
                              <User className="w-2.5 h-2.5 text-emerald-400" />
                              Jugador
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                              Sistema
                            </span>
                          )}

                          {/* Tag de tipo (Chat o Acción) */}
                          {item.source === 'CHAT' ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">
                              💬 Chat
                            </span>
                          ) : null}

                          {/* Ronda y hora */}
                          <span className="text-[10px] text-slate-500 font-mono tabular-nums ml-auto shrink-0">
                            R{item.round} · {item.timestamp}
                          </span>
                        </div>

                        {/* Texto del mensaje / acción */}
                        <p className={`text-[11px] leading-snug break-words ${
                          item.source === 'CHAT' ? 'text-sky-100 font-medium' : 'text-slate-300'
                        }`}>
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* MODAL / DRAWER: HISTORIAL COMPLETO DE ACCIONES DE BOTS Y JUGADORES */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-teal-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-slate-100">
            
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-teal-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-teal-950 border border-teal-800 text-teal-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    Historial Completo de la Partida
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono tabular-nums">
                      {unifiedItems.length} registros
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Historial cronológico de acciones de bots, movimientos de jugadores y chat cooperativo
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSound.modalClose();
                  setIsHistoryModalOpen(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Cerrar historial"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Métricas y barra de búsqueda */}
            <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex flex-col gap-2.5">
              {/* Tarjetas resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="px-2 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Total Eventos</span>
                  <strong className="text-sm font-black text-white tabular-nums">{unifiedItems.length}</strong>
                </div>
                <div className="px-2 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/60">
                  <span className="text-[10px] text-purple-300 block flex items-center justify-center gap-1">
                    <Bot className="w-3 h-3 text-purple-400" /> Bots
                  </span>
                  <strong className="text-sm font-black text-purple-200 tabular-nums">{botEventsCount}</strong>
                </div>
                <div className="px-2 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-900/60">
                  <span className="text-[10px] text-emerald-300 block flex items-center justify-center gap-1">
                    <User className="w-3 h-3 text-emerald-400" /> Jugadores
                  </span>
                  <strong className="text-sm font-black text-emerald-200 tabular-nums">{humanEventsCount}</strong>
                </div>
                <div className="px-2 py-1.5 rounded-xl bg-sky-950/40 border border-sky-900/60">
                  <span className="text-[10px] text-sky-300 block flex items-center justify-center gap-1">
                    <MessageSquare className="w-3 h-3 text-sky-400" /> Chat
                  </span>
                  <strong className="text-sm font-black text-sky-200 tabular-nums">{state.chatMessages.length}</strong>
                </div>
              </div>

              {/* Buscador + Filtros */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                {/* Input de búsqueda */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar bot, jugador o acción..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filtros de categoría */}
                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setModalFilter('ALL');
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                      modalFilter === 'ALL' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setModalFilter('BOTS');
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0 ${
                      modalFilter === 'BOTS' ? 'bg-purple-700 text-white' : 'text-purple-300 hover:text-white hover:bg-purple-950/50'
                    }`}
                  >
                    <Bot className="w-3 h-3" /> Solo Bots
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setModalFilter('PLAYERS');
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0 ${
                      modalFilter === 'PLAYERS' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:text-white hover:bg-emerald-950/50'
                    }`}
                  >
                    <User className="w-3 h-3" /> Jugadores
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setModalFilter('CHAT');
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0 ${
                      modalFilter === 'CHAT' ? 'bg-sky-700 text-white' : 'text-sky-300 hover:text-white hover:bg-sky-950/50'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" /> Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setModalFilter('COMMONS');
                    }}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0 ${
                      modalFilter === 'COMMONS' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-white hover:bg-emerald-950/50'
                    }`}
                  >
                    <Trees className="w-3 h-3" /> Comunalizaciones
                  </button>
                </div>
              </div>
            </div>

            {/* Lista scrollable de registros */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {modalFilteredItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No se encontraron eventos coincidentes con los filtros aplicados.
                </div>
              ) : (
                modalFilteredItems.map((item) => (
                  <div
                    key={`modal_${item.id}`}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: item.actorColor }}
                    >
                      {item.actor.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                        <strong className="text-slate-100 font-bold">
                          {item.actor}
                        </strong>

                        {item.isBot ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            <Bot className="w-3 h-3 text-purple-400" /> Bot
                          </span>
                        ) : item.isHuman ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <User className="w-3 h-3 text-emerald-400" /> Jugador
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            Sistema
                          </span>
                        )}

                        {item.tag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-teal-300 border border-slate-700 font-medium">
                            {item.tag}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono tabular-nums ml-auto shrink-0">
                          Ronda {item.round} · {item.timestamp}
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed ${
                        item.source === 'CHAT' ? 'text-sky-100 font-medium' : 'text-slate-300'
                      }`}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pie del modal */}
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Mostrando {modalFilteredItems.length} de {unifiedItems.length} eventos</span>
              <button
                type="button"
                onClick={() => {
                  playSound.modalClose();
                  setIsHistoryModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
