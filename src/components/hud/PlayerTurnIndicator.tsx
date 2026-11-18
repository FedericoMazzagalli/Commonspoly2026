/**
 * PlayerTurnIndicator.tsx
 * Indicador visual de turno activo en el HUD de Commonspoly.
 * Resalta el avatar estilizado y el color característico del personaje actual,
 * mostrando fase del turno, estado (Ágora/Detención), controlador (Humano/IA)
 * y la cola compacta del resto de participantes.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Award,
  Lock,
  Flame,
  Bot,
  User,
  Sparkles,
  Dices
} from 'lucide-react';
import { Character, GamePhase } from '../../types/game';

interface PlayerTurnIndicatorProps {
  players: Character[];
  activePlayerIndex: number;
  phase: GamePhase;
  currentDiceRoll: number | null;
}

/**
 * Avatar vectorial estilizado para cada uno de los 8 personajes oficiales,
 * enmarcado con su color distintivo y color de acento.
 */
const CharacterAvatar: React.FC<{
  character: Character;
  size?: 'lg' | 'sm';
  isActive?: boolean;
}> = ({ character, size = 'lg', isActive = false }) => {
  const dim = size === 'lg' ? 'w-12 h-12' : 'w-7 h-7';

  // Rasgos distintivos sutiles por ID de personaje
  const renderPortraitSvg = () => {
    switch (character.id) {
      case 'carolina':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="15" r="7" fill="#fef3c7" />
            <path d="M12 15c0-6 3.5-9.5 8-9.5s8 3.5 8 9.5c-1.5-2-3.5-3-8-3s-6.5 1-8 3z" fill="#1e1b4b" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#fdf4ff" fillOpacity="0.92" />
            <circle cx="17.5" cy="15" r="1" fill="#1e293b" />
            <circle cx="22.5" cy="15" r="1" fill="#1e293b" />
            <path d="M17.5 18.2c1.4 1.1 3.6 1.1 5 0" stroke="#be185d" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'chelsea':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <path d="M11 21c0-9 3.8-14 9-14s9 5 9 14" fill="#fde68a" />
            <circle cx="20" cy="15.5" r="6.5" fill="#ffedd5" />
            <rect x="14.5" y="13.5" width="4.3" height="3" rx="1" stroke="#0f172a" strokeWidth="1.2" fill="none" />
            <rect x="21.2" y="13.5" width="4.3" height="3" rx="1" stroke="#0f172a" strokeWidth="1.2" fill="none" />
            <line x1="18.8" y1="15" x2="21.2" y2="15" stroke="#0f172a" strokeWidth="1.1" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#dbeafe" />
          </svg>
        );
      case 'matsuko':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="15" r="6.8" fill="#fef3c7" />
            <path d="M13 13c1-5 13-5 14 0-2-2-12-2-14 0z" fill="#0f172a" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#ede9fe" />
            <path d="M15 26l5 4 5-4" stroke={character.accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="17.5" cy="15" r="1" fill="#0f172a" />
            <circle cx="22.5" cy="15" r="1" fill="#0f172a" />
          </svg>
        );
      case 'moha':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="15.5" r="6.8" fill="#7c2d12" />
            <path d="M13.5 13c0-4.2 3-6.5 6.5-6.5s6.5 2.3 6.5 6.5c-2-1.3-11-1.3-13 0z" fill="#0f172a" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#ffedd5" />
            <circle cx="17.5" cy="15.2" r="1" fill="#fff7ed" />
            <circle cx="22.5" cy="15.2" r="1" fill="#fff7ed" />
            <path d="M17.5 18.5c1.5 1.1 3.5 1.1 5 0" stroke="#fed7aa" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'prafulla':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="16" r="6.6" fill="#78350f" />
            <path d="M13 13.5c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5H13z" fill="#fef08a" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#fef9c3" />
            <path d="M16.5 18.5c2 1.2 5 1.2 7 0" stroke="#fde047" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            <circle cx="17.5" cy="15.5" r="1" fill="#fef9c3" />
            <circle cx="22.5" cy="15.5" r="1" fill="#fef9c3" />
          </svg>
        );
      case 'temple':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <path d="M12.5 18c0-6.5 3.3-10.5 7.5-10.5s7.5 4 7.5 10.5" fill="#92400e" />
            <circle cx="20" cy="15.5" r="6.4" fill="#ffedd5" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#d1fae5" />
            <circle cx="17.5" cy="15.2" r="1" fill="#1e293b" />
            <circle cx="22.5" cy="15.2" r="1" fill="#1e293b" />
            <path d="M17.5 18.4c1.5 1 3.5 1 5 0" stroke="#047857" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'whina':
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <path d="M12 20c0-7.5 3.5-12 8-12s8 4.5 8 12" fill="#1e293b" />
            <circle cx="20" cy="15.5" r="6.5" fill="#d97706" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#ccfbf1" />
            <circle cx="26" cy="11.5" r="2" fill="#2dd4bf" />
            <circle cx="17.5" cy="15.2" r="1" fill="#0f172a" />
            <circle cx="22.5" cy="15.2" r="1" fill="#0f172a" />
          </svg>
        );
      case 'yayo':
      default:
        return (
          <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="15.5" r="6.6" fill="#ffedd5" />
            <path d="M12.5 14c0-5 3.5-8 7.5-8s7.5 3 7.5 8c-2-2-13-2-15 0z" fill="#e2e8f0" />
            <circle cx="20" cy="7.5" r="3" fill="#cbd5e1" />
            <path d="M10 34c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#d1fae5" />
            <circle cx="17.5" cy="15.5" r="1" fill="#1e293b" />
            <circle cx="22.5" cy="15.5" r="1" fill="#1e293b" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative ${dim} rounded-2xl overflow-hidden shrink-0 flex items-center justify-center transition-transform duration-300`}
      style={{
        background: `linear-gradient(135deg, ${character.color}, ${character.accentColor})`,
        boxShadow: isActive ? `0 0 0 2px #0f172a, 0 0 0 4px ${character.color}, 0 8px 20px -4px ${character.color}88` : undefined
      }}
    >
      {renderPortraitSvg()}
      {isActive && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 flex items-center justify-center"
          style={{ backgroundColor: character.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
        </span>
      )}
    </div>
  );
};

function getPhaseLabel(phase: GamePhase, player: Character, roll: number | null): string {
  if (player.isDetained) return `Detenida (${player.detentionRoundsLeft} r.)`;
  if (player.inAgora) return 'En el Ágora Central';
  switch (phase) {
    case 'PLAYER_TURN_READY':
      return player.controller === 'BOT' ? 'IA preparando jugada...' : 'Lista para tirar dado';
    case 'DICE_ROLLING':
      return roll ? `Dado: ${roll}` : 'Lanzando dado...';
    case 'MOVE_ANIMATING':
      return 'Desplazándose...';
    case 'TILE_ACTION_DECISION':
      return 'Decidiendo acción en casilla';
    case 'SPECULATOR_TURN':
      return 'Turno de Especuladores';
    case 'GLOBAL_CARD':
      return 'Leyendo Carta Global';
    default:
      return 'En turno';
  }
}

export const PlayerTurnIndicator: React.FC<PlayerTurnIndicatorProps> = ({
  players,
  activePlayerIndex,
  phase,
  currentDiceRoll
}) => {
  const activePlayer = players[activePlayerIndex];
  if (!activePlayer) return null;

  const phaseText = getPhaseLabel(phase, activePlayer, currentDiceRoll);

  return (
    <div
      aria-label="Indicador de Turno Actual"
      className="pointer-events-auto flex flex-col gap-2 max-w-full"
    >
      {/* Tarjeta destacada del jugador en turno */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePlayer.id}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 border-2 shadow-2xl overflow-hidden"
          style={{
            borderColor: activePlayer.color,
            boxShadow: `0 12px 28px -8px ${activePlayer.color}55`
          }}
        >
          {/* Franja lateral de color del personaje */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: activePlayer.color }}
          />

          {/* Avatar destacado con halo del color del personaje */}
          <div className="pl-1">
            <CharacterAvatar character={activePlayer} size="lg" isActive />
          </div>

          {/* Información de turno */}
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-slate-950 flex items-center gap-1"
                style={{ backgroundColor: activePlayer.color }}
              >
                <Sparkles className="w-2.5 h-2.5" />
                Turno Actual
              </span>

              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[9px] font-bold text-slate-200">
                {activePlayer.controller === 'BOT' ? (
                  <>
                    <Bot className="w-2.5 h-2.5 text-indigo-400" />
                    <span>IA</span>
                  </>
                ) : (
                  <>
                    <User className="w-2.5 h-2.5 text-teal-400" />
                    <span>Humano</span>
                  </>
                )}
              </span>

              {activePlayer.inAgora && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-pink-950 border border-pink-700 text-[9px] font-bold text-pink-300">
                  <Flame className="w-2.5 h-2.5" />
                  Ágora
                </span>
              )}
              {activePlayer.isDetained && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700 text-[9px] font-bold text-rose-300">
                  <Lock className="w-2.5 h-2.5" />
                  Detenida
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-sm md:text-base font-black text-white truncate">
                {activePlayer.name}
              </span>
              <span className="text-[10px] font-medium text-slate-300 flex items-center gap-1 truncate">
                <Dices className="w-3 h-3 shrink-0" style={{ color: activePlayer.color }} />
                {phaseText}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] tabular-nums text-slate-300">
              <span className="flex items-center gap-1 font-semibold text-rose-300">
                <Heart className="w-3 h-3 text-rose-400" />
                {activePlayer.wellness} Bienestar
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-300">
                <Award className="w-3 h-3 text-amber-400" />
                {activePlayer.legitimacy} Legitimidad
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Cola compacta del resto de jugadoras */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        {players.map((p, idx) => {
          const isActive = idx === activePlayerIndex;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[11px] transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900/95 text-white font-bold shadow-md'
                  : 'bg-slate-900/65 border-slate-800/80 text-slate-300 opacity-80'
              }`}
              style={
                isActive
                  ? {
                      borderColor: p.color,
                      boxShadow: `0 0 0 1px ${p.color}55`
                    }
                  : undefined
              }
            >
              <CharacterAvatar character={p} size="sm" isActive={false} />
              <div className="flex flex-col leading-tight">
                <span className="flex items-center gap-1 text-[10px] font-bold">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name}</span>
                  {p.isDetained && <Lock className="w-2.5 h-2.5 text-rose-400" />}
                </span>
                <span className="text-[9px] text-slate-400 tabular-nums">
                  ♥{p.wellness} · ★{p.legitimacy}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
