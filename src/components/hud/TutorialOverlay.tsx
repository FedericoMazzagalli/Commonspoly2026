/**
 * TutorialOverlay.tsx
 * Tutorial interactivo de onboarding con selector de perfiles narrativos de voz para Commonspoly.
 * Permite a los jugadores:
 * - Elegir entre los 8 personajes oficiales de Commonspoly (Carolina, Chelsea, Matsuko, Moha,
 *   Prafulla, Temple, Whina y Yayo) o la Voz del Ágora como asistente narrativo.
 * - Preescuchar muestras de voz para cada perfil con un solo clic.
 * - Ajustar la voz del navegador, el ritmo de locución y el tono.
 * - Recorrer las 6 mecánicas básicas de Commonspoly con resaltes contextuales e interacción en vivo.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Users,
  Award,
  HeartHandshake,
  Droplets,
  Compass,
  Check,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  ArrowLeft,
  BookOpen,
  Trees,
  Megaphone,
  Radio,
  Settings2,
  Cpu,
  Utensils,
  Stethoscope,
  Theater
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameEngineState } from '../../types/game';
import { playSound } from '../../utils/audio';
import {
  useVoiceNarrator,
  NARRATIVE_PROFILES,
  NarrativeProfileId,
  VoiceNarrativeProfile
} from '../../utils/voiceNarrator';

interface TutorialOverlayProps {
  state: GameEngineState;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenRules?: () => void;
  disableEscapeKey?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const STORAGE_KEY_DISMISSED = 'commonspoly_tutorial_dismissed_v2';
const STORAGE_KEY_DONT_SHOW = 'commonspoly_tutorial_dont_show_v2';

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
    // Ignorar en entornos restringidos
  }
};

export type TargetZone =
  | 'TOP_STATUS'
  | 'TOP_LEFT_PLAYER'
  | 'TOP_RIGHT_RESOURCES'
  | 'BOTTOM_DOCK'
  | 'BOTTOM_CORNERS'
  | 'BOARD_AGORA';

interface OnboardingStep {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  content: string;
  voiceScript: string;
  tip: string;
  targetZone: TargetZone;
  arrowDirection: 'up' | 'down' | 'up-left' | 'up-right' | 'center';
  interactiveType: 'LEGITIMACY_DEMO' | 'GOODS_STATES' | 'SKILL_DISCOUNT' | 'SHORTCUTS' | 'BAILOUT_SIM' | 'AGORA_CELEBRATION';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'cooperative_mission',
    number: 1,
    title: 'Objetivo Común: Legitimidad Colectiva',
    subtitle: 'En Commonspoly todas ganan o pierden juntas frente a la especulación',
    badge: 'Mecánica #1: Cooperación',
    icon: <Award className="w-5 h-5 text-amber-400" />,
    content:
      'Aquí no compites por arruinar a tus compañeras. La asamblea coopera para rescatar la ciudad antes de la Ronda 20. Para ganar, debéis reunir al menos 10 puntos de Legitimidad Colectiva por jugador y llevar a 3 o más personajes al Ágora Central. Cada bien comunizado y cada rescate suma legitimidad para la mesa.',
    voiceScript:
      '¡Bienvenida a Commonspoly! En este juego cooperativo no compites por arruinar a tus compañeras: todas ganáis o perdéis juntas frente a la especulación. Vuestro objetivo es acumular diez puntos de Legitimidad Colectiva por jugadora y llevar a tres o más personajes al Ágora Central antes de la Ronda 20. Comunizar casillas, rescatar a detenidos y donar bienestar sumará legitimidad para la mesa entera.',
    tip: 'Vigila la barra superior: si la Ronda 20 concluye sin cumplir la meta, el neoliberalismo devora la ciudad.',
    targetZone: 'TOP_STATUS',
    arrowDirection: 'up',
    interactiveType: 'LEGITIMACY_DEMO'
  },
  {
    id: 'commons_and_states',
    number: 2,
    title: 'Los 4 Bienes Comunes y sus 3 Estados',
    subtitle: 'Salud, Urbanismo, Saber y Medio Ambiente',
    badge: 'Mecánica #2: Bienes',
    icon: <Droplets className="w-5 h-5 text-emerald-400" />,
    content:
      'El tablero cuenta con 4 familias de bienes esenciales: Salud, Urbanismo, Conocimiento y Medio Ambiente. Cada bien tiene 3 estados: Privado (blanco, controlado por especuladores), Público (gris, regulado por el Estado) y Común (negro, gestionado por la comunidad). Transformar bienes privados en comunes protege el vecindario.',
    voiceScript:
      'La ciudad se organiza en cuatro bienes esenciales: Salud, Urbanismo, Conocimiento y Medio Ambiente. Cada bien puede encontrarse en tres estados: Privado en blanco controlado por la especulación, Público en gris regulado por el Estado, y Común en negro autogestionado por la asamblea. Al comunizarlos, la comunidad florece y protege a sus habitantes de las crisis.',
    tip: 'Consulta el monitor de recursos en la esquina superior derecha para ver el balance de bienes comunitarios.',
    targetZone: 'TOP_RIGHT_RESOURCES',
    arrowDirection: 'up-right',
    interactiveType: 'GOODS_STATES'
  },
  {
    id: 'character_and_wellness',
    number: 3,
    title: 'Tu Personaje: Bienestar y Saberes Solidarios',
    subtitle: 'Energía vital y habilidades para abaratar costes',
    badge: 'Mecánica #3: Personaje',
    icon: <Users className="w-5 h-5 text-teal-400" />,
    content:
      'Tu personaje posee puntos de Bienestar, que representan su salud y energía física para transformar bienes. Además cuentas con 4 saberes solidarios: Cuidar, Ocupar, Compartir y Regenerar. Cada punto en un saber reduce en 1 el coste de comunizar el bien respectivo. Si tu Bienestar llega a cero, caerás en agotamiento y detención.',
    voiceScript:
      'Tu personaje posee puntos de Bienestar, que representan su salud y energía vital para comunizar bienes. Cuentas además con cuatro saberes solidarios: Cuidar, Ocupar, Compartir y Regenerar. Cada punto de saber te descuenta uno en el coste de transformar bienes. ¡Ten mucho cuidado! Si tu Bienestar llega a cero, caerás en agotamiento y serás detenida.',
    tip: 'Aprovecha las profesiones: envía al personaje con alto saber ambiental a regenerar bosques y costas.',
    targetZone: 'TOP_LEFT_PLAYER',
    arrowDirection: 'up-left',
    interactiveType: 'SKILL_DISCOUNT'
  },
  {
    id: 'turn_actions_and_dock',
    number: 4,
    title: 'Dinámica de Turno: Lanzar Dados y Acciones',
    subtitle: 'El dock inferior reúne tus decisiones tácticas',
    badge: 'Mecánica #4: Acciones',
    icon: <Compass className="w-5 h-5 text-cyan-400" />,
    content:
      'En tu turno, pulsa "Lanzar Dado" (tecla D) para avanzar por el tablero 3D. Al aterrizar en una casilla, podrás Comunizarla invirtiendo Bienestar, optar por Gestión Pública si no tienes suficiente energía, o Pasar Turno (tecla P) para descansar y recuperar puntos vitales.',
    voiceScript:
      'Durante tu turno, pulsa Lanzar Dado para mover tu peón por el tablero tridimensional. Al caer en una casilla, podrás Comunizarla invirtiendo tu Bienestar, optar por Gestión Pública con ayuda del estado, o Pasar Turno para descansar y recuperar puntos de energía vital si tus fuerzas escasean.',
    tip: 'Pasar turno en casillas públicas otorga bienestar y legitimidad gratuita como fruto de los servicios públicos.',
    targetZone: 'BOTTOM_DOCK',
    arrowDirection: 'down',
    interactiveType: 'SHORTCUTS'
  },
  {
    id: 'threats_and_solidarity',
    number: 5,
    title: 'Amenazas Especulativas y Apoyo Mutuo',
    subtitle: 'Fianza solidaria de detención y Tragedia de los Comunes',
    badge: 'Mecánica #5: Solidaridad',
    icon: <HeartHandshake className="w-5 h-5 text-rose-400" />,
    content:
      'Los Especuladores recorren el tablero buscando privatizar bienes. Si detienen a una compañera, cualquiera puede pagar su fianza solidaria desde el botón de rescate. Ante la Tragedia de los Comunes, la mesa entera vota unida qué bienes salvar para evitar pérdidas catastróficas.',
    voiceScript:
      'Los especuladores acechan el tablero intentando privatizar de nuevo los bienes públicos. Si una compañera es detenida, cualquier jugadora puede pagar su fianza solidaria para liberarla de inmediato. Durante la Tragedia de los Comunes, la asamblea votará unida qué bienes proteger para evitar la pérdida colectiva de recursos.',
    tip: 'Usa el chat cooperativo inferior en cualquier momento para coordinar votos y pedir donaciones de bienestar.',
    targetZone: 'BOTTOM_CORNERS',
    arrowDirection: 'down',
    interactiveType: 'BAILOUT_SIM'
  },
  {
    id: 'climate_and_agora',
    number: 6,
    title: 'Clima Dinámico y El Ágora Central',
    subtitle: 'La regeneración ecológica conduce a la insurrección final',
    badge: 'Mecánica #6: Desenlace',
    icon: <Flame className="w-5 h-5 text-pink-400" />,
    content:
      'El ecosistema 3D reacciona a vuestras acciones: comunizar bienes ambientales estabiliza el clima con lluvia y sol templado, elevando al 92% el éxito de las cartas de situación. Cuando alcancéis la Legitimidad requerida, entrad al Ágora Central para consumar la gran insurrección ciudadana y ganar la partida.',
    voiceScript:
      'El clima del tablero responde a vuestras decisiones ecológicas: comunizar bienes ambientales atrae lluvia y sol benigno, elevando el éxito de las cartas al noventa y dos por ciento; descuidarlas desata sequías severas. Cuando alcancéis la legitimidad requerida, avanzad al Ágora Central para desencadenar la gran insurrección y triunfar juntos.',
    tip: '¡Todo listo! Pulsa el botón inferior para comenzar la partida y transformar la ciudad.',
    targetZone: 'BOARD_AGORA',
    arrowDirection: 'center',
    interactiveType: 'AGORA_CELEBRATION'
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
  const playersCount = Math.max(state.players.length, 1);
  const totalTurnsElapsed = (state.round - 1) * playersCount + state.activePlayerIndex;
  const isFirstTurns = totalTurnsElapsed < 3;

  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const dontShow = safeGetStorage(STORAGE_KEY_DONT_SHOW) === 'true';
    if (dontShow) return false;
    const dismissed = safeGetStorage(STORAGE_KEY_DISMISSED) === 'true';
    return isFirstTurns && !dismissed;
  });

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  const [isVoiceAutoPlay, setIsVoiceAutoPlay] = useState<boolean>(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);

  // Micro-estados interactivos de cada paso
  const [demoLegitimacy, setDemoLegitimacy] = useState<number>(0);
  const [demoStateIndex, setDemoStateIndex] = useState<number>(0);
  const [demoSkillPoints, setDemoSkillPoints] = useState<number>(2);
  const [demoBailoutDone, setDemoBailoutDone] = useState<boolean>(false);
  const [celebrationFired, setCelebrationFired] = useState<boolean>(false);

  // Motor de voz reactivo con perfiles narrativos
  const voice = useVoiceNarrator();

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const effectivelyVisible =
    isVisible && state.phase !== 'TITLE' && state.phase !== 'SETUP' && state.phase !== 'GAME_OVER';

  const currentStep = ONBOARDING_STEPS[currentStepIndex];

  // Cerrar tutorial
  const handleClose = useCallback(() => {
    voice.stop();
    playSound.uiToggle(false);
    setShowVoiceSettings(false);
    if (dontShowAgain) {
      safeSetStorage(STORAGE_KEY_DONT_SHOW, 'true');
    }
    safeSetStorage(STORAGE_KEY_DISMISSED, 'true');
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  }, [dontShowAgain, controlledOnClose, voice]);

  // Navegación de pasos
  const handleNext = useCallback(() => {
    playSound.voiceStep();
    setShowVoiceSettings(false);
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStepIndex, handleClose]);

  const handlePrev = useCallback(() => {
    playSound.voiceStep();
    setShowVoiceSettings(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Narrar automáticamente al cambiar de paso si el narrador está activo
  useEffect(() => {
    if (!effectivelyVisible) {
      voice.stop();
      return;
    }

    if (showVoiceSettings) {
      return;
    }

    if (isVoiceAutoPlay && !voice.isMuted) {
      const timer = window.setTimeout(() => {
        voice.speak(currentStep.voiceScript);
      }, 250);
      return () => {
        window.clearTimeout(timer);
        voice.stop();
      };
    } else {
      voice.stop();
    }
  }, [effectivelyVisible, currentStepIndex, isVoiceAutoPlay, voice.isMuted, showVoiceSettings]);

  // Notificar visibilidad al sistema global de atajos
  useEffect(() => {
    onVisibilityChange?.(effectivelyVisible);
  }, [effectivelyVisible, onVisibilityChange]);

  // Atajos de teclado: Escape, Flechas, Barra Espaciadora
  useEffect(() => {
    if (!effectivelyVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (disableEscapeKey) return;
        e.preventDefault();
        if (showVoiceSettings) {
          setShowVoiceSettings(false);
        } else {
          handleClose();
        }
      } else if (!showVoiceSettings) {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        } else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          if (voice.isSpeaking) {
            if (voice.isPaused) {
              voice.resume();
            } else {
              voice.pause();
            }
          } else {
            voice.speak(currentStep.voiceScript);
          }
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          voice.toggleMute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectivelyVisible, disableEscapeKey, showVoiceSettings, handleClose, handleNext, handlePrev, voice, currentStep.voiceScript]);

  // Configuración de Spotlight según targetZone
  const layout = useMemo(() => {
    switch (currentStep.targetZone) {
      case 'TOP_STATUS':
        return {
          spotlightClasses: 'top-2 left-4 md:left-6 right-4 md:right-6 h-14 rounded-2xl',
          cardContainerClasses: 'top-20 left-1/2 -translate-x-1/2 w-[94vw] max-w-xl',
          arrowClass: 'left-1/2 -top-2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'TOP_LEFT_PLAYER':
        return {
          spotlightClasses: 'top-16 left-3 md:left-6 w-full max-w-md h-20 rounded-2xl',
          cardContainerClasses: 'top-40 left-3 md:left-6 w-[94vw] max-w-xl',
          arrowClass: 'left-10 -top-2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'TOP_RIGHT_RESOURCES':
        return {
          spotlightClasses: 'top-16 right-3 md:right-6 w-80 md:w-96 h-28 rounded-2xl',
          cardContainerClasses: 'top-48 right-3 md:right-6 w-[94vw] max-w-xl',
          arrowClass: 'right-12 -top-2 border-b-slate-900 border-x-transparent border-t-transparent border-b-8 border-x-8 border-t-0'
        };
      case 'BOTTOM_DOCK':
        return {
          spotlightClasses: 'bottom-2 left-1/2 -translate-x-1/2 w-full max-w-4xl h-36 rounded-3xl',
          cardContainerClasses: 'bottom-40 md:bottom-44 left-1/2 -translate-x-1/2 w-[94vw] max-w-xl',
          arrowClass: 'left-1/2 -bottom-2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent border-t-8 border-x-8 border-b-0'
        };
      case 'BOTTOM_CORNERS':
        return {
          spotlightClasses: 'bottom-16 right-3 md:right-6 w-72 h-48 rounded-2xl',
          cardContainerClasses: 'bottom-44 right-3 md:right-6 w-[94vw] max-w-xl',
          arrowClass: 'right-16 -bottom-2 border-t-slate-900 border-x-transparent border-b-transparent border-t-8 border-x-8 border-b-0'
        };
      case 'BOARD_AGORA':
      default:
        return {
          spotlightClasses: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-dashed',
          cardContainerClasses: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-xl',
          arrowClass: 'hidden'
        };
    }
  }, [currentStep.targetZone]);

  if (!effectivelyVisible) {
    return null;
  }

  // Celebración de insurrección
  const handleTriggerCelebration = () => {
    playSound.voiceSuccess();
    setCelebrationFired(true);
    try {
      confetti({
        particleCount: 55,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignorar si canvas no está disponible
    }
  };

  // Icono con el color oficial de cada personaje / perfil narrativo
  const getProfileIcon = (profileId: NarrativeProfileId) => {
    switch (profileId) {
      case 'carolina':
        return <HeartHandshake className="w-4 h-4" style={{ color: '#D946EF' }} />;
      case 'chelsea':
        return <Cpu className="w-4 h-4" style={{ color: '#3B82F6' }} />;
      case 'matsuko':
        return <Theater className="w-4 h-4" style={{ color: '#8B5CF6' }} />;
      case 'moha':
        return <Megaphone className="w-4 h-4" style={{ color: '#F97316' }} />;
      case 'prafulla':
        return <Utensils className="w-4 h-4" style={{ color: '#EAB308' }} />;
      case 'temple':
        return <Stethoscope className="w-4 h-4" style={{ color: '#10B981' }} />;
      case 'whina':
        return <BookOpen className="w-4 h-4" style={{ color: '#14B8A6' }} />;
      case 'yayo':
        return <Trees className="w-4 h-4" style={{ color: '#059669' }} />;
      case 'agora_voice':
      default:
        return <Flame className="w-4 h-4" style={{ color: '#EC4899' }} />;
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Tutorial interactivo de onboarding con narrador de voz"
      className="fixed inset-0 z-50 pointer-events-none select-none transition-opacity duration-300 animate-in fade-in"
    >
      {/* 1. Fondo atenuado de foco (vignette suave) */}
      <div className="absolute inset-0 bg-slate-950/45 pointer-events-none backdrop-blur-[1px]" />

      {/* 2. Spotlight sobre el área contextual */}
      {!showVoiceSettings && (
        <div
          className={`absolute border-2 border-teal-400 shadow-[0_0_35px_rgba(45,212,191,0.55)] pointer-events-none transition-all duration-300 ease-out ${layout.spotlightClasses}`}
          aria-hidden="true"
        >
          <span className="absolute -top-3 left-4 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-400 text-slate-950 shadow">
            {currentStep.badge}
          </span>
        </div>
      )}

      {/* 3. Tarjeta Principal del Tutorial */}
      <div
        className={`absolute pointer-events-auto transition-all duration-300 ease-out ${
          showVoiceSettings
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto'
            : layout.cardContainerClasses
        }`}
      >
        {/* Flecha indicadora */}
        {!showVoiceSettings && (
          <div className={`absolute w-0 h-0 pointer-events-none ${layout.arrowClass}`} />
        )}

        <div className="bg-slate-900/98 border border-teal-500/60 rounded-2xl shadow-2xl p-4 md:p-5 text-slate-100 flex flex-col gap-3">
          
          {/* HEADER SUPERIOR */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/80">
            
            {/* Lado izquierdo: Info de paso o de configuración */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-950/90 border border-teal-500/50 shrink-0">
                {showVoiceSettings ? (
                  <SlidersHorizontal className="w-5 h-5 text-teal-400" />
                ) : (
                  currentStep.icon
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {showVoiceSettings ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      Configuración de Voz
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                        Paso {currentStep.number} de {ONBOARDING_STEPS.length}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400 truncate">
                        Tutorial de Onboarding
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-tight truncate">
                  {showVoiceSettings
                    ? 'Perfiles Narrativos del Asistente de Voz'
                    : currentStep.title}
                </h2>
              </div>
            </div>

            {/* Lado derecho: Selector de perfil narrativo, controles de voz y cierre */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Botón Selector de Perfil Narrativo */}
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  voice.stop();
                  setShowVoiceSettings(prev => !prev);
                }}
                className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  showVoiceSettings
                    ? 'bg-teal-600 border-teal-400 text-white shadow-md'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200 hover:text-white'
                }`}
                title="Configurar perfiles narrativos y voces del asistente"
                aria-label="Abrir selector de perfiles narrativos de voz"
              >
                {getProfileIcon(voice.currentProfileId)}
                <span className="hidden sm:inline font-bold">
                  {voice.currentProfile.name}
                </span>
                <SlidersHorizontal className="w-3.5 h-3.5 opacity-80" />
              </button>

              {/* Controles de reproducción normales (cuando no está en configuración) */}
              {!showVoiceSettings && (
                <>
                  {/* Indicador de Ondas de Voz cuando habla */}
                  {voice.isSpeaking && !voice.isPaused && (
                    <div
                      className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded-lg bg-teal-950/80 border border-teal-500/50 text-teal-300 text-[10px] font-bold"
                      title="Voz narrando la explicación"
                    >
                      <span className="inline-block w-1 h-2.5 bg-teal-400 animate-pulse rounded-full" />
                      <span className="inline-block w-1 h-3.5 bg-teal-300 animate-pulse delay-75 rounded-full" />
                      <span className="inline-block w-1 h-2 bg-teal-400 animate-pulse delay-150 rounded-full" />
                    </div>
                  )}

                  {/* Play / Pausa / Repetir */}
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      if (voice.isSpeaking) {
                        if (voice.isPaused) {
                          voice.resume();
                        } else {
                          voice.pause();
                        }
                      } else {
                        voice.speak(currentStep.voiceScript);
                      }
                    }}
                    className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                      voice.isSpeaking && !voice.isPaused
                        ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900/80'
                        : 'bg-slate-800 border-slate-700 text-teal-300 hover:text-white hover:bg-slate-700'
                    }`}
                    title={
                      voice.isSpeaking && !voice.isPaused
                        ? 'Pausar locución (Espacio)'
                        : voice.isPaused
                        ? 'Reanudar locución (Espacio)'
                        : 'Reproducir explicación por voz'
                    }
                    aria-label="Control de reproducción de voz"
                  >
                    {voice.isSpeaking && !voice.isPaused ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : voice.isPaused ? (
                      <Play className="w-3.5 h-3.5" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Mute */}
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      voice.toggleMute();
                    }}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      voice.isMuted
                        ? 'bg-rose-950/80 border-rose-600/60 text-rose-300 hover:bg-rose-900/80'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                    title={voice.isMuted ? 'Activar narrador de voz (M)' : 'Silenciar narrador de voz (M)'}
                    aria-label="Silenciar o activar narrador de voz"
                  >
                    {voice.isMuted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                    )}
                  </button>
                </>
              )}

              {/* Cerrar tutorial */}
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Cerrar tutorial (Esc)"
                aria-label="Cerrar tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VISTA 1: CONFIGURACIÓN DE PERFILES NARRATIVOS */}
          {showVoiceSettings ? (
            <div className="space-y-4 py-1 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  Selecciona la personalidad y tono del asistente de voz que te guiará en Commonspoly:
                </p>
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(false)}
                  className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver al tutorial</span>
                </button>
              </div>

              {/* Grid de los 8 Personajes Oficiales + Voz del Ágora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[44vh] overflow-y-auto pr-1">
                {NARRATIVE_PROFILES.map((profile) => {
                  const isSelected = voice.currentProfileId === profile.id;
                  const isPreviewing = voice.previewingProfileId === profile.id;

                  return (
                    <div
                      key={profile.id}
                      onClick={() => {
                        playSound.uiClick();
                        voice.setProfile(profile.id);
                      }}
                      style={{
                        borderColor: isSelected ? profile.colorHex : undefined,
                        boxShadow: isSelected ? `0 0 16px ${profile.colorHex}40` : undefined
                      }}
                      className={`cursor-pointer rounded-xl p-2.5 border transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-slate-900/95'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="p-1.5 rounded-lg bg-slate-900 border shrink-0"
                              style={{ borderColor: `${profile.colorHex}55` }}
                            >
                              {getProfileIcon(profile.id)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="truncate">{profile.name}</span>
                                {isSelected && (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: profile.colorHex }} />
                                )}
                              </h3>
                              <p className="text-[10px] text-slate-400 font-medium truncate" title={profile.characterArchetype}>
                                {profile.characterArchetype}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-teal-200/90 font-medium italic truncate">
                            "{profile.tagline}"
                          </span>
                          <span
                            className="font-semibold shrink-0"
                            style={{ color: profile.colorHex }}
                          >
                            {profile.badgeLabel}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {profile.description}
                        </p>
                      </div>

                      {/* Botón de Preescucha de Muestra */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {profile.recommendedRate}x · Tono {profile.recommendedPitch}x
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSound.uiClick();
                            voice.previewProfile(profile.id);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border ${
                            isPreviewing
                              ? 'bg-amber-950 border-amber-500 text-amber-300'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-teal-300 hover:text-white'
                          }`}
                        >
                          {isPreviewing ? (
                            <>
                              <Radio className="w-3 h-3 text-amber-400 animate-spin" />
                              <span>Sonando...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Probar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ajustes Finos de Voz del Navegador y Calibración */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                    <Settings2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Ajustes Finos de Locución</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      voice.setProfile(voice.currentProfileId);
                    }}
                    className="text-[11px] text-slate-400 hover:text-teal-300 underline"
                  >
                    Restablecer valores del perfil
                  </button>
                </div>

                {/* Selector de Voz del Navegador */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Voz sintetizada del sistema:</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {voice.currentVoiceName || 'Voz por defecto'}
                    </span>
                  </label>
                  <select
                    value={voice.currentVoiceName || ''}
                    onChange={(e) => {
                      playSound.uiClick();
                      voice.setVoiceByName(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
                  >
                    {voice.availableSpanishVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang}) {v.default ? '★ Recomendada' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Controles deslizantes: Velocidad y Tono */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  
                  {/* Slider de Ritmo (Rate) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Velocidad de locución:</span>
                      <strong className="text-teal-300 font-mono">{voice.rate}x</strong>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.05"
                      value={voice.rate}
                      onChange={(e) => voice.setRate(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Pausada (0.8x)</span>
                      <span>Normal (1.0x)</span>
                      <span>Ágil (1.3x)</span>
                    </div>
                  </div>

                  {/* Slider de Tono (Pitch) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Tono / Entonación:</span>
                      <strong className="text-teal-300 font-mono">{voice.pitch}x</strong>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.25"
                      step="0.05"
                      value={voice.pitch}
                      onChange={(e) => voice.setPitch(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Grave (0.8x)</span>
                      <span>Medio (1.0x)</span>
                      <span>Agudo (1.25x)</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Botón de confirmación */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    voice.speak(currentStep.voiceScript);
                    setShowVoiceSettings(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  Probar con texto del paso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setShowVoiceSettings(false);
                    if (isVoiceAutoPlay && !voice.isMuted) {
                      voice.speak(currentStep.voiceScript);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-950/40"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar y Continuar Tutorial</span>
                </button>
              </div>

            </div>
          ) : (
            /* VISTA 2: EXPLICACIÓN DEL PASO CON MICRO-INTERACCIÓN */
            <div className="space-y-2 text-xs md:text-sm text-slate-300 leading-relaxed">
              
              <div className="flex items-center justify-between gap-2">
                <p className="text-teal-200/90 font-medium text-xs">
                  {currentStep.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setShowVoiceSettings(true);
                  }}
                  className="text-[10px] text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors shrink-0"
                  title="Cambiar personalidad de voz"
                >
                  <span>Voz:</span>
                  <strong className="text-teal-400 font-semibold">{voice.currentProfile.name}</strong>
                  <span className="underline">Cambiar</span>
                </button>
              </div>

              <p className="text-slate-300">
                {currentStep.content}
              </p>

              {/* Subtítulos visuales sincronizados con la locución */}
              {voice.isSpeaking && (
                <div className="p-2 rounded-xl bg-slate-950/90 border border-teal-500/40 text-[11px] text-slate-200 flex items-start gap-2 shadow-inner">
                  <Volume2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="leading-snug">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-teal-400 block mb-0.5">
                      Locución ({voice.currentProfile.name}):
                    </span>
                    <span className="italic">"{currentStep.voiceScript}"</span>
                  </div>
                </div>
              )}

              {/* Micro-Área Interactiva para Experimentar la Mecánica */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                
                {/* Paso 1: Simular donación de legitimidad */}
                {currentStep.interactiveType === 'LEGITIMACY_DEMO' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      <span>Meta de asamblea: </span>
                      <strong className="text-amber-300">{state.players.length * 10} Legitimidad</strong>
                      <span className="text-slate-500"> · Actual simulada: </span>
                      <strong className="text-teal-300">+{demoLegitimacy} puntos</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playSound.voiceSuccess();
                        setDemoLegitimacy(prev => prev + 2);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-teal-600/90 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>¡Simular donación (+2 ✨)!</span>
                    </button>
                  </div>
                )}

                {/* Paso 2: Conmutar estados de un bien */}
                {currentStep.interactiveType === 'GOODS_STATES' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Estado de muestra:</span>
                      {demoStateIndex === 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-slate-900">
                          ⬜ Privado (Especulación)
                        </span>
                      )}
                      {demoStateIndex === 1 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-500 text-white">
                          🔘 Público (Estado)
                        </span>
                      )}
                      {demoStateIndex === 2 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-900 border border-emerald-500 text-emerald-200">
                          ⬛ Común (Autogestión)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playSound.uiClick();
                        setDemoStateIndex(prev => (prev + 1) % 3);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-colors shrink-0"
                    >
                      Transformar estado ↻
                    </button>
                  </div>
                )}

                {/* Paso 3: Descuento de habilidades */}
                {currentStep.interactiveType === 'SKILL_DISCOUNT' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      <span>Saber Regenerar: </span>
                      <strong className="text-teal-300">{demoSkillPoints} pts</strong>
                      <span className="text-slate-500"> → Coste de parque (base 4): </span>
                      <strong className="text-emerald-400">{Math.max(1, 4 - demoSkillPoints)} Bienestar</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          setDemoSkillPoints(prev => Math.max(0, prev - 1));
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono text-xs font-bold"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          setDemoSkillPoints(prev => Math.min(3, prev + 1));
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 4: Atajos de teclado del dock */}
                {currentStep.interactiveType === 'SHORTCUTS' && (
                  <div className="flex items-center justify-around gap-2 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-teal-950 border border-teal-500/50 text-[10px] font-mono font-bold text-teal-300">
                        D
                      </kbd>
                      <span>Lanzar Dado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-teal-950 border border-teal-500/50 text-[10px] font-mono font-bold text-teal-300">
                        C
                      </kbd>
                      <span>Comunizar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                        P
                      </kbd>
                      <span>Pasar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-pink-950 border border-pink-500/50 text-[10px] font-mono font-bold text-pink-300">
                        A
                      </kbd>
                      <span>Ágora</span>
                    </div>
                  </div>
                )}

                {/* Paso 5: Fianza solidaria simulada */}
                {currentStep.interactiveType === 'BAILOUT_SIM' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      {demoBailoutDone ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          ¡Compañera rescatada! +2 Legitimidad otorgada a la mesa.
                        </span>
                      ) : (
                        <span>Un compañero cayó en detención por agotamiento.</span>
                      )}
                    </div>
                    {!demoBailoutDone ? (
                      <button
                        type="button"
                        onClick={() => {
                          playSound.voiceSuccess();
                          setDemoBailoutDone(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Pagar fianza solidaria</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDemoBailoutDone(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Reiniciar prueba
                      </button>
                    )}
                  </div>
                )}

                {/* Paso 6: Celebración del Ágora */}
                {currentStep.interactiveType === 'AGORA_CELEBRATION' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-pink-300 font-semibold">
                      ¡La asamblea está lista para transformar la ciudad!
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerCelebration}
                      className="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-lg shadow-pink-950/40"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      <span>{celebrationFired ? '¡Viva el Común! 🎊' : '¡Simular Insurrección!'}</span>
                    </button>
                  </div>
                )}

              </div>

              {/* Consejo táctico con icono Sparkles */}
              <div className="p-2 rounded-xl bg-slate-950/80 border border-teal-900/60 text-[11px] text-teal-300 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                <span>{currentStep.tip}</span>
              </div>
            </div>
          )}

          {/* PIE DE ACCIONES Y PROGRESO (Visible siempre) */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
            
            {/* Puntos de pasos */}
            <div className="flex items-center gap-1.5">
              {ONBOARDING_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setShowVoiceSettings(false);
                    setCurrentStepIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]'
                      : idx < currentStepIndex
                      ? 'w-2.5 bg-teal-700'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                  title={`Paso ${idx + 1}: ${step.title}`}
                  aria-label={`Ir al paso ${idx + 1}`}
                />
              ))}
            </div>

            {/* Opciones rápidas */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVoiceAutoPlay}
                  onChange={e => setIsVoiceAutoPlay(e.target.checked)}
                  className="w-3 h-3 rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 focus:outline-none"
                />
                <span>Narrar automáticamente</span>
              </label>

              <label className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  className="w-3 h-3 rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 focus:outline-none"
                />
                <span>No mostrar al inicio</span>
              </label>
            </div>
          </div>

          {/* Botones de navegación inferior */}
          {!showVoiceSettings && (
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
                    {currentStepIndex === ONBOARDING_STEPS.length - 1 ? '¡Entendido, a jugar!' : 'Siguiente paso'}
                  </span>
                  {currentStepIndex === ONBOARDING_STEPS.length - 1 ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
