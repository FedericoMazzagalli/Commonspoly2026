/**
 * TutorialOverlay.tsx
 * Componente de tutorial contextual interactivo para Commonspoly.
 * Muestra tooltips flotantes sobre los elementos del HUD durante los primeros
 * 3 turnos de la primera partida del usuario para explicar las mecánicas cooperativas:
 * - Legitimidad Colectiva y Objetivo Común (Insurrección en el Ágora)
 * - Personaje activo, Bienestar y Habilidades solidarias
 * - Los 4 Bienes Comunes (Salud, Urbano, Conocimiento, Medioambiente) y Clima Dinámico
 * - Dock de Acciones, Tiradas de Dado y Comunización de Recursos
 * - Apoyo Mutuo, Fianza de Detención, Votaciones Colectivas y Chat Rápido
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Users,
  Award,
  HeartHandshake,
  Droplets,
  HelpCircle,
  Compass,
  Check,
  ShieldAlert,
  Flame,
  MessageSquare
} from 'lucide-react';
import { GameEngineState } from '../../types/game';
import { playSound } from '../../utils/audio';

interface TutorialOverlayProps {
  state: GameEngineState;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenRules?: () => void;
  disableEscapeKey?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const STORAGE_KEY_DISMISSED = 'commonspoly_tutorial_dismissed_v1';
const STORAGE_KEY_DONT_SHOW = 'commonspoly_tutorial_dont_show_v1';

const safeGetStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  content: string;
  tip: string;
  targetZone: 'TOP_STATUS' | 'TOP_LEFT_PLAYER' | 'TOP_RIGHT_RESOURCES' | 'BOTTOM_DOCK' | 'BOTTOM_CORNERS';
  arrowDirection: 'up' | 'down' | 'up-left' | 'up-right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'cooperative_mission',
    title: 'Objetivo Común: Legitimidad e Insurrección',
    subtitle: '¡En Commonspoly todos ganan o todos pierden juntos!',
    badge: 'Mecánica #1: Cooperación',
    icon: <Award className="w-5 h-5 text-amber-400" />,
    content:
      'Aquí no compites por arruinar a tus compañeros. La mesa entera coopera para frenar la privatización neoliberal. Para ganar antes de la Ronda 20, la asamblea debe reunir al menos 10 puntos de Legitimidad Colectiva por jugador y llevar a 3 o más personajes al Ágora Central.',
    tip: 'Consejo: Comunizar bienes privados, donar bienestar o rescatar compañeros suma Legitimidad Colectiva.',
    targetZone: 'TOP_STATUS',
    arrowDirection: 'up'
  },
  {
    id: 'character_and_wellness',
    title: 'Tu Personaje: Bienestar y Saberes Solidarios',
    subtitle: 'Energía vital y habilidades especializadas',
    badge: 'Mecánica #2: Personaje',
    icon: <Users className="w-5 h-5 text-teal-400" />,
    content:
      'Tu personaje posee puntos de Bienestar (su energía vital para comunizar bienes) y 4 habilidades solidarias: Cuidar (Salud), Ocupar (Urbano), Compartir (Conocimiento) y Regenerar (Medioambiente). Cada punto de habilidad abarata en 1 el coste de transformar bienes.',
    tip: '¡Cuidado! Si tu Bienestar llega a cero caes en agotamiento y eres detenido. Pide ayuda antes de colapsar.',
    targetZone: 'TOP_LEFT_PLAYER',
    arrowDirection: 'up-left'
  },
  {
    id: 'commons_and_climate',
    title: 'Bienes Comunes y Clima Dinámico',
    subtitle: 'Salud, Urbanismo, Saber y Medio Ambiente',
    badge: 'Mecánica #3: Recursos & Clima',
    icon: <Droplets className="w-5 h-5 text-emerald-400" />,
    content:
      'Los bienes tienen 3 estados: Privado (blanco, en manos de la especulación), Público (gris, regulado por el Estado) y Común (negro, gestionado por la comunidad). El clima del tablero 3D reacciona en tiempo real a los bienes medioambientales: comunizarlos atrae lluvia vivificante; privatizarlos desata sequía.',
    tip: 'Consulta el despiece de bienes en la esquina superior derecha para ver el balance ecológico.',
    targetZone: 'TOP_RIGHT_RESOURCES',
    arrowDirection: 'up-right'
  },
  {
    id: 'turn_actions_and_unlock',
    title: 'Dock de Acciones: Tirada y Comunización',
    subtitle: 'Cómo jugar en tu turno',
    badge: 'Mecánica #4: Acciones',
    icon: <Compass className="w-5 h-5 text-cyan-400" />,
    content:
      'En tu turno, lanza el dado 3D para avanzar tu peón. Al caer en casillas privadas o públicas, pulsa "Comunizar" invirtiendo Bienestar (descontando tus habilidades). También puedes optar por Gestión Pública o pasar turno para conservar energía si la mesa lo necesita.',
    tip: 'Aprovecha las profesiones: deja que el personaje con más habilidad regenere los parques y costas.',
    targetZone: 'BOTTOM_DOCK',
    arrowDirection: 'down'
  },
  {
    id: 'solidarity_and_chat',
    title: 'Apoyo Mutuo: Rescates, Votos y Chat Rápido',
    subtitle: 'Nadie se queda atrás ante los especuladores',
    badge: 'Mecánica #5: Solidaridad',
    icon: <HeartHandshake className="w-5 h-5 text-rose-400" />,
    content:
      'Los Especuladores atacan periódicamente. Si detienen a alguien, cualquier compañera puede pagar su fianza solidaria. En la "Tragedia de los Comunes", votáis democráticamente qué bienes salvar. Usa el chat cooperativo inferior para coordinar donaciones y consensuar votos.',
    tip: 'Usa los botones de chat rápido en cualquier momento; tus compañeros bot responderán a tus propuestas.',
    targetZone: 'BOTTOM_CORNERS',
    arrowDirection: 'down'
  }
];

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  state,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onOpenRules,
  disableEscapeKey = false,
  onVisibilityChange
}) => {
  // Cálculo de turnos transcurridos en la partida (ronda 1 a 20)
  const playersCount = Math.max(state.players.length, 1);
  const totalTurnsElapsed = (state.round - 1) * playersCount + state.activePlayerIndex;
  const isFirstThreeTurns = totalTurnsElapsed < 3;

  // Estado interno para apertura automática durante los primeros 3 turnos
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const dontShow = safeGetStorage(STORAGE_KEY_DONT_SHOW) === 'true';
    if (dontShow) return false;
    const dismissed = safeGetStorage(STORAGE_KEY_DISMISSED) === 'true';
    return isFirstThreeTurns && !dismissed;
  });

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  // Sincronizar con control externo si se provee
  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Cerrar tutorial
  const handleClose = useCallback(() => {
    playSound.uiToggle(false);
    if (dontShowAgain) {
      safeSetStorage(STORAGE_KEY_DONT_SHOW, 'true');
    }
    safeSetStorage(STORAGE_KEY_DISMISSED, 'true');
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  }, [dontShowAgain, controlledOnClose]);

  // Navegación de pasos
  const handleNext = () => {
    playSound.uiClick();
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    playSound.uiClick();
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Notificar visibilidad real al gestor global de atajos
  const effectivelyVisible =
    isVisible && state.phase !== 'TITLE' && state.phase !== 'SETUP' && state.phase !== 'GAME_OVER';

  useEffect(() => {
    onVisibilityChange?.(effectivelyVisible);
  }, [effectivelyVisible, onVisibilityChange]);

  // Atajos de teclado: Escape para cerrar (si no hay modal superior), Flechas para navegar
  useEffect(() => {
    if (!effectivelyVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (disableEscapeKey) return;
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectivelyVisible, currentStepIndex, handleClose, disableEscapeKey]);

  // Si no está visible o la partida no ha comenzado (TITLE/SETUP/GAME_OVER), no renderizar
  if (!isVisible || state.phase === 'TITLE' || state.phase === 'SETUP' || state.phase === 'GAME_OVER') {
    return null;
  }

  const currentStep = TUTORIAL_STEPS[currentStepIndex];

  // Configuración de marco de foco / spotlight y posición del tooltip según targetZone
  const getLayoutConfiguration = () => {
    switch (currentStep.targetZone) {
      case 'TOP_STATUS':
        return {
          spotlightClasses: 'top-2 left-4 md:left-6 right-4 md:right-6 h-14 rounded-2xl',
          cardContainerClasses: 'top-20 left-1/2 -translate-x-1/2 w-[92vw] max-w-lg',
          arrowClass: 'left-1/2 -top-2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'TOP_LEFT_PLAYER':
        return {
          spotlightClasses: 'top-16 left-3 md:left-6 w-full max-w-md h-20 rounded-2xl',
          cardContainerClasses: 'top-40 left-3 md:left-6 w-[92vw] max-w-lg',
          arrowClass: 'left-10 -top-2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'TOP_RIGHT_RESOURCES':
        return {
          spotlightClasses: 'top-16 right-3 md:right-6 w-80 md:w-96 h-28 rounded-2xl',
          cardContainerClasses: 'top-48 right-3 md:right-6 w-[92vw] max-w-lg',
          arrowClass: 'right-12 -top-2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'BOTTOM_DOCK':
        return {
          spotlightClasses: 'bottom-2 left-1/2 -translate-x-1/2 w-full max-w-4xl h-36 rounded-3xl',
          cardContainerClasses: 'bottom-40 md:bottom-44 left-1/2 -translate-x-1/2 w-[92vw] max-w-xl',
          arrowClass: 'left-1/2 -bottom-2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent border-t-8 border-x-8 border-b-0'
        };
      case 'BOTTOM_CORNERS':
        return {
          spotlightClasses: 'bottom-16 right-3 md:right-6 w-72 h-48 rounded-2xl',
          cardContainerClasses: 'bottom-44 right-3 md:right-6 w-[92vw] max-w-lg',
          arrowClass: 'right-16 -bottom-2 border-t-slate-900 border-x-transparent border-b-transparent border-t-8 border-x-8 border-b-0'
        };
    }
  };

  const layout = getLayoutConfiguration();

  return (
    <div
      role="dialog"
      aria-label="Guía interactiva de mecánicas cooperativas"
      className="fixed inset-0 z-40 pointer-events-none select-none transition-opacity duration-300 animate-in fade-in"
    >
      {/* 1. Marco de Resalte / Spotlight sobre el elemento del HUD correspondiente */}
      <div
        className={`absolute border-2 border-teal-400/90 shadow-[0_0_30px_rgba(45,212,191,0.45)] pointer-events-none transition-all duration-300 ease-out ${layout.spotlightClasses}`}
        aria-hidden="true"
      >
        <span className="absolute -top-3 left-4 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500 text-slate-950 shadow">
          {currentStep.badge}
        </span>
      </div>

      {/* 2. Tooltip Flotante Contextual con Puntero */}
      <div className={`absolute pointer-events-auto transition-all duration-300 ease-out ${layout.cardContainerClasses}`}>
        {/* Flecha indicadora */}
        <div className={`absolute w-0 h-0 pointer-events-none ${layout.arrowClass}`} />

        <div className="bg-slate-900/95 border border-teal-500/50 rounded-2xl shadow-2xl p-4 md:p-5 text-slate-100 flex flex-col gap-3">
          
          {/* Header del Tooltip */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-500/40 shrink-0">
                {currentStep.icon}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                    Paso {currentStepIndex + 1} de {TUTORIAL_STEPS.length}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-[11px] text-slate-400">
                    {totalTurnsElapsed < 3 ? `Turno ${totalTurnsElapsed + 1} de 3 iniciales` : 'Guía Cooperativa'}
                  </span>
                </div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-tight">
                  {currentStep.title}
                </h2>
              </div>
            </div>

            {/* Botón cerrar */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title="Cerrar guía"
              aria-label="Cerrar guía"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtítulo y contenido descriptivo */}
          <div className="space-y-2 text-xs md:text-sm text-slate-300 leading-relaxed">
            <p className="text-teal-200/90 font-medium text-xs">
              {currentStep.subtitle}
            </p>
            <p className="text-slate-300">
              {currentStep.content}
            </p>

            {/* Recuadro de Consejo Táctico Solidario */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-teal-900/60 text-[11px] text-teal-300 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
              <span>{currentStep.tip}</span>
            </div>
          </div>

          {/* Barra de progreso de pasos */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5">
              {TUTORIAL_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setCurrentStepIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-teal-400'
                      : idx < currentStepIndex
                      ? 'w-2.5 bg-teal-700'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                  title={`Ir al paso ${idx + 1}: ${step.title}`}
                  aria-label={`Paso ${idx + 1}`}
                />
              ))}
            </div>

            {/* Checkbox "No volver a mostrar automáticamente" */}
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
                className="w-3 h-3 rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 focus:outline-none"
              />
              <span>No mostrar al inicio</span>
            </label>
          </div>

          {/* Botones de acción del pie */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
            >
              Saltar tutorial
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-950/40 border border-teal-400/30"
              >
                <span>
                  {currentStepIndex === TUTORIAL_STEPS.length - 1 ? '¡Entendido, a jugar!' : 'Siguiente'}
                </span>
                {currentStepIndex === TUTORIAL_STEPS.length - 1 ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
