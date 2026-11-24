/**
 * CooperativeChatComponent.tsx
 * Chat rápido cooperativo integrado en la esquina inferior derecha del HUD.
 * Permite enviar mensajes tácticos rápidos durante las fases de votación colectiva
 * (Ágora Central, Tragedia de los Comunes, Rescate Solidario o coordinación general)
 * con respuestas contextuales de las compañeras IA y auto-scroll en los mensajes.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Vote,
  Sparkles,
  Bot
} from 'lucide-react';
import { GameEngineState } from '../../types/game';
import { playSound } from '../../utils/audio';
import { useI18n } from '../../i18n';
import { useSwipeToDismiss } from '../ui/MotionPrimitives';

interface CooperativeChatComponentProps {
  state: GameEngineState;
  onSendMessage: (text: string, votingContext?: string) => void;
  isDockCollapsed?: boolean;
  variant?: 'floating' | 'sheet';
}

interface QuickPreset {
  id: string;
  label: string;
  text: string;
}

export const CooperativeChatComponent: React.FC<CooperativeChatComponentProps> = ({
  state,
  onSendMessage,
  isDockCollapsed = false,
  variant = 'floating'
}) => {
  const { t } = useI18n();
  const isVotingModalActive =
    state.activeModal === 'AGORA_INSURRECTION' ||
    state.activeModal === 'TRAGEDY_VOTE' ||
    state.activeModal === 'DETENTION_RESCUE';

  const isCooperativeVotingPhase =
    isVotingModalActive ||
    state.phase === 'AGORA_COUNCIL' ||
    state.activeModal === 'GLOBAL_CARD';

  const votingContextLabel = useMemo(() => {
    switch (state.activeModal) {
      case 'AGORA_INSURRECTION':
        return 'Voto Ágora';
      case 'TRAGEDY_VOTE':
        return 'Consenso Tragedia';
      case 'DETENTION_RESCUE':
        return 'Rescate Solidario';
      case 'GLOBAL_CARD':
        return 'Carta Global';
      default:
        return state.phase === 'AGORA_COUNCIL' ? 'Consejo Ágora' : 'Coordinación';
    }
  }, [state.activeModal, state.phase]);

  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(state.chatMessages.length);
  const prevVotingRef = useRef(isVotingModalActive);

  const isSheet = variant === 'sheet';
  const effectiveOpen = isSheet || isOpen;

  // Abrir automáticamente cuando inicia una votación colectiva crítica
  useEffect(() => {
    if (!isSheet && isVotingModalActive && !prevVotingRef.current) {
      setIsOpen(true);
      setUnreadCount(0);
    }
    prevVotingRef.current = isVotingModalActive;
  }, [isVotingModalActive, isSheet]);

  // Auto-scroll y contador de mensajes nuevos cuando está colapsado
  useEffect(() => {
    const count = state.chatMessages.length;
    if (count > prevMsgCountRef.current && !effectiveOpen) {
      setUnreadCount(u => u + (count - prevMsgCountRef.current));
    }
    prevMsgCountRef.current = count;

    if (effectiveOpen && listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [state.chatMessages.length, effectiveOpen]);

  const quickPresets: QuickPreset[] = useMemo(() => {
    if (state.activeModal === 'AGORA_INSURRECTION') {
      return [
        { id: 'pool', label: '¡Juntemos recursos!', text: '¡Juntemos recursos en el Ágora!' },
        { id: 'park', label: '¡Salvemos el parque!', text: '¡Salvemos el parque y lo medioambiental!' },
        { id: 'health', label: '¡Prioricemos Salud!', text: '¡Comunalicemos los Bienes de Salud!' },
        { id: 'knowledge', label: '¡Cultura Libre!', text: '¡Votemos por Conocimiento libre!' }
      ];
    }
    if (state.activeModal === 'TRAGEDY_VOTE') {
      return [
        { id: 'park', label: '¡Salvemos el parque!', text: '¡Salvemos el parque, no lo privaticemos!' },
        { id: 'pool', label: '¡Juntemos recursos!', text: '¡Juntemos recursos para recuperarlo luego!' },
        { id: 'protect_health', label: 'Protejamos Salud', text: 'Protejamos hospitales y cuidados.' },
        { id: 'urban', label: 'Sacrificar Urbano', text: 'Sacrifiquemos bienes urbanos fáciles de ocupar.' }
      ];
    }
    if (state.activeModal === 'DETENTION_RESCUE') {
      return [
        { id: 'rescue', label: '¡Paguemos fianza!', text: '¡Rescatemos al aliado con la fianza común!' },
        { id: 'pool', label: '¡Juntemos recursos!', text: '¡Juntemos recursos para liberar a la compañera!' },
        { id: 'hold', label: 'Ahorrar Bienestar', text: 'Esperemos un turno si falta Bienestar.' }
      ];
    }
    return [
      { id: 'pool', label: '¡Juntemos recursos!', text: '¡Juntemos recursos para desprivatizar!' },
      { id: 'park', label: '¡Salvemos el parque!', text: '¡Salvemos el parque y el entorno verde!' },
      { id: 'agora', label: '¡Vamos al Ágora!', text: '¡Subamos Legitimidad para entrar al Ágora!' },
      { id: 'rescue', label: '¡Apoyo mutuo!', text: '¡Cuidémonos y protejamos las casillas!' }
    ];
  }, [state.activeModal]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    playSound.uiToggle(nextOpen);
    if (nextOpen) {
      setUnreadCount(0);
    }
    setIsOpen(nextOpen);
  };

  const handleSendPreset = (preset: QuickPreset) => {
    onSendMessage(preset.text, votingContextLabel);
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onSendMessage(customInput, votingContextLabel);
    setCustomInput('');
  };

  const { swipeX, swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: 'down',
    enabled: !isSheet && isOpen,
    resetOnDismiss: true,
    onDismiss: () => {
      playSound.uiToggle(false);
      setIsOpen(false);
    }
  });

  if (isSheet) {
    return (
      <div className="flex flex-col gap-3 text-slate-100">
        {isCooperativeVotingPhase && (
          <div className="px-3 py-2 rounded-xl bg-pink-950/60 border border-pink-600/60 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-bold text-pink-200">
              <Vote className="w-4 h-4 text-pink-300 shrink-0" />
              <span>Consenso activo: {votingContextLabel}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-pink-600/80 text-white text-[10px] font-black uppercase">
              Votación
            </span>
          </div>
        )}

        <div
          ref={listRef}
          className="p-2.5 max-h-[34dvh] min-h-[140px] overflow-y-auto overscroll-contain-y space-y-2 text-xs scroll-smooth bg-slate-950/60 rounded-2xl border border-slate-800"
        >
          {state.chatMessages.length > 0 ? (
            state.chatMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90 text-xs leading-snug"
              >
                <div className="flex items-center justify-between gap-1.5 mb-0.5 text-[10px]">
                  <span className="flex items-center gap-1.5 font-bold truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: msg.senderColor }}
                    />
                    <span style={{ color: msg.senderColor }}>{msg.senderName}</span>
                    {msg.controller === 'BOT' && (
                      <Bot className="w-3 h-3 text-indigo-400 shrink-0" />
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {msg.votingContext ? `${msg.votingContext} · ` : ''}
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-slate-200 pl-3.5">{msg.text}</p>
              </div>
            ))
          ) : (
            <div className="py-6 px-3 text-center text-xs text-slate-400 italic">
              Envía un mensaje rápido para coordinar la votación con el grupo.
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mensajes Rápidos ({votingContextLabel})</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {quickPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSendPreset(preset)}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold text-left truncate transition-all active:scale-95 ${
                  isCooperativeVotingPhase
                    ? 'bg-pink-950/45 hover:bg-pink-900/60 border-pink-700/60 text-pink-100'
                    : 'bg-slate-800/85 hover:bg-teal-900/50 border-slate-700 hover:border-teal-600/70 text-slate-100'
                }`}
                title={preset.text}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitCustom} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              maxLength={90}
              placeholder="Mensaje breve al grupo..."
              className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-teal-500 outline-none text-sm text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
              title="Enviar mensaje"
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Posición en esquina inferior derecha sobre el chip de Bitácora, elevando z-index durante modales de votación
  const zIndexClass = isVotingModalActive ? 'z-[60]' : 'z-20';
  const bottomOffsetClass = isVotingModalActive
    ? 'bottom-20 md:bottom-24'
    : isDockCollapsed
    ? 'bottom-44 md:bottom-40'
    : 'bottom-56 md:bottom-52';

  return (
    <motion.aside
      data-tutorial-target="coop-chat"
      aria-label="Chat Rápido Cooperativo"
      style={{ x: swipeX, y: swipeY }}
      className={`pointer-events-auto fixed right-3 md:right-6 ${bottomOffsetClass} ${zIndexClass} w-68 md:w-72 lg:w-80 max-w-[34vw] lg:max-w-[82vw] select-none transition-all duration-300 ${touchActionClass}`}
      {...swipeHandlers}
    >
      <div
        className={`rounded-2xl border hud-surface overflow-hidden text-slate-100 transition-colors ${
          isCooperativeVotingPhase
            ? 'bg-slate-900/95 border-pink-400/90 ring-1 ring-pink-500/40'
            : 'bg-slate-900/90 border-teal-800/70'
        }`}
      >
        {/* Cabecera / Toggle */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className="w-full min-h-[44px] sm:min-h-[38px] flex items-center justify-between px-3 py-2.5 bg-slate-950/75 border-b border-slate-800/80 text-xs text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`p-1 rounded-lg shrink-0 ${
                isCooperativeVotingPhase
                  ? 'bg-pink-500/25 text-pink-300 ring-1 ring-pink-400/40'
                  : 'bg-teal-500/20 text-teal-300'
              }`}
            >
              {isCooperativeVotingPhase ? (
                <Vote className="w-3.5 h-3.5" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-[11px] leading-tight truncate flex items-center gap-1.5">
                <span>Chat Cooperativo</span>
                {isCooperativeVotingPhase && (
                  <span className="px-1.5 py-0.5 rounded bg-pink-600/80 text-white text-[9px] font-black uppercase tracking-wide shrink-0">
                    Votación
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {isCooperativeVotingPhase
                  ? `Consenso: ${votingContextLabel}`
                  : `${state.chatMessages.length} mensajes rápidos`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[9px] font-semibold text-emerald-300">
              {t.hud.recentChatPersisted || 'Guardado local'}
            </span>
            {!isOpen && unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-400 text-slate-950 text-[9px] font-black tabular-nums">
                +{unreadCount}
              </span>
            )}
            <span className="text-slate-400">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </span>
          </div>
        </button>

        {/* Vista previa rápida del último mensaje cuando está colapsado */}
        {!isOpen && state.chatMessages.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-950/60 text-[10px] text-slate-300 flex items-center gap-1.5 truncate">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: state.chatMessages[state.chatMessages.length - 1].senderColor }}
            />
            <span
              className="font-bold shrink-0"
              style={{ color: state.chatMessages[state.chatMessages.length - 1].senderColor }}
            >
              {state.chatMessages[state.chatMessages.length - 1].senderName}:
            </span>
            <span className="truncate text-slate-300">
              {state.chatMessages[state.chatMessages.length - 1].text}
            </span>
          </div>
        )}

        {/* Cuerpo desplegable */}
        {isOpen && (
          <div className="flex flex-col">
            {/* Historial de mensajes con auto-scroll */}
            <div
              ref={listRef}
              className="p-2.5 max-h-40 overflow-y-auto space-y-1.5 text-xs scroll-smooth bg-slate-950/35"
            >
              {state.chatMessages.length > 0 ? (
                state.chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2 rounded-xl bg-slate-900/85 border border-slate-800/80 text-[11px] leading-snug"
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-0.5 text-[10px]">
                      <span className="flex items-center gap-1 font-bold truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: msg.senderColor }}
                        />
                        <span style={{ color: msg.senderColor }}>{msg.senderName}</span>
                        {msg.controller === 'BOT' && (
                          <Bot className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                        )}
                      </span>
                      <span className="text-[9px] text-slate-400 tabular-nums shrink-0">
                        {msg.votingContext ? `${msg.votingContext} · ` : ''}
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-200 pl-3">{msg.text}</p>
                  </div>
                ))
              ) : (
                <div className="py-4 px-2 text-center text-[11px] text-slate-400 italic">
                  Envía un mensaje rápido para coordinar la votación con el grupo.
                </div>
              )}
            </div>

            {/* Botones de Chat Rápido (Quick-Chat Presets) */}
            <div className="p-2 border-t border-slate-800/80 bg-slate-900/80 space-y-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-teal-300 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Mensajes Rápidos ({votingContextLabel})</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSendPreset(preset)}
                    className={`min-h-[38px] sm:min-h-[30px] px-2 py-1.5 rounded-lg border text-[10px] font-semibold text-left truncate transition-all active:scale-95 ${
                      isCooperativeVotingPhase
                        ? 'bg-pink-950/45 hover:bg-pink-900/60 border-pink-700/60 text-pink-100'
                        : 'bg-slate-800/80 hover:bg-teal-900/50 border-slate-700 hover:border-teal-600/70 text-slate-200'
                    }`}
                    title={preset.text}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Input corto opcional */}
              <form onSubmit={handleSubmitCustom} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  maxLength={90}
                  placeholder="Mensaje breve al grupo..."
                  className="flex-1 min-w-0 min-h-[38px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-teal-500 outline-none text-[11px] text-white placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!customInput.trim()}
                  className="min-w-[40px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] p-1.5 flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
                  title="Enviar mensaje"
                  aria-label="Enviar mensaje"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
};
