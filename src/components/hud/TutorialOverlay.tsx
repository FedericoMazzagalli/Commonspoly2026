/**
 * TutorialOverlay.tsx
 * Tutorial interactivo paso a paso y guía contextual durante las primeras rondas (Rondas 1–2)
 * de una nueva partida en Commonspoly:
 * - Resalta elementos reales del HUD (vía data-tutorial-target) y del tablero 3D (casillas por estado,
 *   peón activo, dado 3D, especuladores y Ágora Central).
 * - Explica la lógica cooperativa, descuentos por Saberes, Reputación Vecinal y atajos reales (R/D/P/A).
 * - Incluye modo minimizado no bloqueante para acompañar las Rondas 1–2 sin tapar el tablero 3D.
 * - Integra selector de perfiles narrativos de voz (Web Speech API) sin backdrop-blur ni dots pulsantes.
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
  Theater,
  Minimize2,
  GraduationCap,
  Loader2,
  AudioLines
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameEngineState, TutorialBoardFocus } from '../../types/game';
import { playSound } from '../../utils/audio';
import {
  useVoiceNarrator,
  NARRATIVE_PROFILES,
  NarrativeProfileId,
  VoiceEngineMode
} from '../../utils/voiceNarrator';

interface TutorialOverlayProps {
  state: GameEngineState;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenRules?: () => void;
  disableEscapeKey?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  onBoardFocusChange?: (focus: TutorialBoardFocus) => void;
}

export const STORAGE_KEY_TUTORIAL_DISMISSED = 'commonspoly_tutorial_dismissed_v2';
export const STORAGE_KEY_TUTORIAL_DONT_SHOW = 'commonspoly_tutorial_dont_show_v2';

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
  | 'CHAT_SOLIDARITY'
  | 'BOARD_AGORA';

type TutorialMode = 'CLOSED' | 'STEP_BY_STEP' | 'COACH_STRIP';

interface OnboardingStep {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  categoryLabel: string;
  icon: React.ReactNode;
  content: string;
  voiceScript: string;
  tip: string;
  targetZone: TargetZone;
  domSelector: string | null;
  mobileDomSelector?: string | null;
  boardFocus: TutorialBoardFocus;
  boardHighlightLegend?: string;
  interactiveType:
    | 'LEGITIMACY_DEMO'
    | 'GOODS_STATES'
    | 'SKILL_DISCOUNT'
    | 'SHORTCUTS'
    | 'BAILOUT_SIM'
    | 'AGORA_CELEBRATION';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'cooperative_mission',
    number: 1,
    title: 'Objetivo Común: Legitimidad Colectiva',
    subtitle: 'En Commonspoly todas ganan o pierden juntas frente a la especulación',
    categoryLabel: 'Cooperación',
    icon: <Award className="w-5 h-5 text-amber-400" />,
    content:
      'Aquí no compites por arruinar a tus compañeras. La asamblea coopera para rescatar la ciudad antes de la Ronda 20. Para ganar, reunid al menos 10 puntos de Legitimidad Colectiva por jugadora y llevad a 3 o más personajes al Ágora Central.',
    voiceScript:
      '¡Bienvenida a Commonspoly! En este juego cooperativo no compites por arruinar a tus compañeras: todas ganáis o perdéis juntas frente a la especulación. Vuestro objetivo es acumular diez puntos de Legitimidad Colectiva por jugadora y llevar a tres o más personajes al Ágora Central antes de la Ronda 20.',
    tip: 'Vigila la barra superior: cada bien comunizado, rescate solidario o votación vecinal acerca la meta.',
    targetZone: 'TOP_STATUS',
    domSelector: '[data-tutorial-target="top-status"]',
    boardFocus: 'LEGITIMACY_AND_GOAL',
    boardHighlightLegend: 'En el tablero 3D brillan el Ágora Central y los bienes comunes ya activos.',
    interactiveType: 'LEGITIMACY_DEMO'
  },
  {
    id: 'commons_and_states',
    number: 2,
    title: 'Los 4 Bienes Comunes en el Tablero 3D',
    subtitle: 'Observa los 3 colores de estado iluminados ahora mismo sobre el tablero',
    categoryLabel: 'Bienes y Estados',
    icon: <Droplets className="w-5 h-5 text-emerald-400" />,
    content:
      'Las casillas de Salud, Urbanismo, Conocimiento y Medioambiente tienen 3 estados visibles en el tablero 3D: Privado (blanco/rojo, controlado por especuladores), Público (gris/azul, gestionado por el Estado) y Común (negro/verde, autogestionado por la comunidad).',
    voiceScript:
      'Observa las casillas iluminadas en el tablero tridimensional: en rojo ves los bienes Privados dominados por especuladores, en azul los bienes Públicos regulados por el Estado, y en verde esmeralda los bienes Comunes autogestionados. Transformar lo privado en común fortalece todo el barrio.',
    tip: 'En escritorio tienes el desglose por familias arriba a la derecha; en móvil ábrelo desde el botón Menú.',
    targetZone: 'TOP_RIGHT_RESOURCES',
    domSelector: '[data-tutorial-target="resources-tracker"]',
    mobileDomSelector: '[data-tutorial-target="mobile-menu-btn"]',
    boardFocus: 'GOODS_STATES',
    boardHighlightLegend: 'Casillas iluminadas: Verde = Común · Azul = Público · Rojo = Privado.',
    interactiveType: 'GOODS_STATES'
  },
  {
    id: 'character_and_wellness',
    number: 3,
    title: 'Tu Personaje: Bienestar, Saberes y Reputación',
    subtitle: 'Energía vital, descuentos de coste y peso en votaciones vecinales',
    categoryLabel: 'Personaje',
    icon: <Users className="w-5 h-5 text-teal-400" />,
    content:
      'Tu Bienestar es la energía para desbloquear casillas (si llega a 0 caerás en Detención). Tus Saberes (Cuidar, Ocupar, Compartir, Regenerar) reducen el coste en su familia de bienes, y tu Reputación Vecinal aumenta tu peso de voto en referéndums y abarata rescates.',
    voiceScript:
      'Tu peón iluminado en el tablero usa Bienestar para transformar casillas: si llegas a cero caerás en detención. Tus cuatro saberes solidarios descuentan puntos de coste en cada familia, y actuar de forma cooperativa mejora tu Reputación Vecinal para votar con mayor peso.',
    tip: 'Coordina a cada personaje hacia los bienes donde su saber solidario ofrece mayor descuento.',
    targetZone: 'TOP_LEFT_PLAYER',
    domSelector: '[data-tutorial-target="player-indicator"]',
    boardFocus: 'ACTIVE_PLAYER_PAWN',
    boardHighlightLegend: 'Baliza turquesa sobre el peón activo y su casilla actual en el tablero.',
    interactiveType: 'SKILL_DISCOUNT'
  },
  {
    id: 'turn_actions_and_dock',
    number: 4,
    title: 'Tu Turno: Dado 3D y Decisión en Casilla',
    subtitle: 'El dock inferior agrupa las acciones de cada turno y sus atajos reales',
    categoryLabel: 'Turnos',
    icon: <Compass className="w-5 h-5 text-cyan-400" />,
    content:
      'Al iniciar tu turno, tira el Dado 3D (tecla R o Espacio) para avanzar. Al caer en una casilla puedes Desbloquear / Comunizar (tecla D) invirtiendo Bienestar, o Pasar Turno (tecla P). Pasar en una casilla Pública regenera Bienestar y suma Legitimidad sin coste.',
    voiceScript:
      'En tu turno pulsa Tirar Dado o la tecla R para avanzar por el tablero. Al aterrizar podrás Desbloquear o Comunizar con la tecla D invirtiendo Bienestar, o Pasar Turno con la tecla P. Si pasas sobre una casilla Pública, descansarás ganando Bienestar y Legitimidad gratis.',
    tip: 'También puedes pulsar directamente cualquier casilla del tablero 3D para inspeccionar su coste y bonificador.',
    targetZone: 'BOTTOM_DOCK',
    domSelector: '[data-tutorial-target="bottom-dock"]',
    boardFocus: 'TURN_DICE_AND_TILE',
    boardHighlightLegend: 'Baliza dorada bajo el Dado 3D y tu casilla de destino.',
    interactiveType: 'SHORTCUTS'
  },
  {
    id: 'threats_and_solidarity',
    number: 5,
    title: 'Especuladores, Rescates y Consenso Barrial',
    subtitle: 'Cómo responder en equipo a las amenazas de cada ronda',
    categoryLabel: 'Solidaridad',
    icon: <HeartHandshake className="w-5 h-5 text-rose-400" />,
    content:
      'Al cerrar cada ronda, los Especuladores avanzan e intentan reprivatizar casillas. Si una compañera queda detenida, cualquiera puede pagar su fianza solidaria. Ante una Tragedia de los Comunes o Referéndum Barrial, coordinad la defensa desde el Chat Cooperativo.',
    voiceScript:
      'Al terminar cada ronda los especuladores marcados en naranja recorren la ciudad intentando privatizar bienes. Si detienen a una compañera, cualquiera puede liberarla con la fianza solidaria. Usad el Chat Cooperativo para acordar qué casillas proteger en las votaciones.',
    tip: 'Cada rescate solidario sube la Legitimidad de la mesa y tu Reputación Vecinal.',
    targetZone: 'CHAT_SOLIDARITY',
    domSelector: '[data-tutorial-target="coop-chat"]',
    mobileDomSelector: '[data-tutorial-target="bottom-dock"]',
    boardFocus: 'SPECULATORS_THREAT',
    boardHighlightLegend: 'Baliza naranja señalando a los Especuladores y sus casillas amenazadas.',
    interactiveType: 'BAILOUT_SIM'
  },
  {
    id: 'climate_and_agora',
    number: 6,
    title: 'Clima Vivo e Insurrección en el Ágora Central',
    subtitle: 'La regeneración ecológica impulsa la victoria colectiva final',
    categoryLabel: 'Ágora Central',
    icon: <Flame className="w-5 h-5 text-pink-400" />,
    content:
      'Comunizar bienes medioambientales estabiliza el clima del tablero 3D (elevando hasta un 92% el éxito de las Cartas de Situación). Cuando reunáis la Legitimidad colectiva necesaria, entrad al Ágora Central (tecla A) para lanzar la insurrección ciudadana.',
    voiceScript:
      'El clima tridimensional responde a vuestras decisiones ecológicas: cuidar el entorno estabiliza la ciudad y eleva al noventa y dos por ciento el éxito de las cartas. Al alcanzar la Legitimidad colectiva meta, entrad al Ágora Central con la tecla A para ganar juntas.',
    tip: 'Durante las Rondas 1 y 2 puedes mantener una breve barra guía en vivo mientras juegas.',
    targetZone: 'BOARD_AGORA',
    domSelector: null,
    boardFocus: 'AGORA_CENTRAL',
    boardHighlightLegend: 'Ágora Central iluminada en el corazón del tablero 3D.',
    interactiveType: 'AGORA_CELEBRATION'
  }
];

interface MeasuredRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getLivePhaseCoachAdvice(state: GameEngineState): {
  title: string;
  detail: string;
  stepIndex: number;
  boardFocus: TutorialBoardFocus;
} {
  const activePlayer = state.players[state.activePlayerIndex];
  const currentTile = state.tiles.find(t => t.id === activePlayer?.position);
  const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
  const targetLegitimacy = Math.max(1, state.players.length * 10);

  if (state.phase === 'SPECULATOR_TURN') {
    return {
      title: `Ronda ${state.round} · Turno de Especuladores`,
      detail:
        'Observa las casillas en naranja: los especuladores intentan degradar bienes Comunes y Públicos.',
      stepIndex: 4,
      boardFocus: 'SPECULATORS_THREAT'
    };
  }

  if (activePlayer?.controller === 'BOT') {
    return {
      title: `Ronda ${state.round} · Turno aliado (${activePlayer.name})`,
      detail:
        'Tu compañera IA actúa según sus Saberes. Aprovecha para revisar los 3 estados del tablero o coordinar en el Chat.',
      stepIndex: 1,
      boardFocus: 'ACTIVE_PLAYER_PAWN'
    };
  }

  if (state.phase === 'TILE_ACTION_DECISION' && currentTile) {
    if (currentTile.state === 'PRIVATE' || currentTile.state === 'PUBLIC') {
      const nextStateLabel = currentTile.state === 'PRIVATE' ? 'Público' : 'Común';
      return {
        title: `Ronda ${state.round} · Decisión en ${currentTile.name}`,
        detail:
          currentTile.state === 'PUBLIC'
            ? `Pulsa D para comunizar a Común (+Legitimidad) o P para Pasar y ganar Bienestar en casilla Pública.`
            : `Pulsa D para liberar este bien Privado a ${nextStateLabel}, o P para ahorrar Bienestar si vas justa.`,
        stepIndex: 3,
        boardFocus: 'ACTIVE_PLAYER_PAWN'
      };
    }
    return {
      title: `Ronda ${state.round} · Casilla ${currentTile.name}`,
      detail: 'Pulsa P para cerrar tu decisión. Ya está protegida o es una casilla especial.',
      stepIndex: 3,
      boardFocus: 'ACTIVE_PLAYER_PAWN'
    };
  }

  if (totalLegitimacy >= targetLegitimacy && !activePlayer?.inAgora) {
    return {
      title: `Ronda ${state.round} · ¡Ágora Central desbloqueada!`,
      detail: 'Ya reunisteis la Legitimidad meta. Pulsa A para entrar al Ágora Central.',
      stepIndex: 5,
      boardFocus: 'AGORA_CENTRAL'
    };
  }

  if (state.round === 2) {
    return {
      title: `Ronda 2 · Consolidación cooperativa (${totalLegitimacy}/${targetLegitimacy} Legitimidad)`,
      detail:
        'Pulsa R para tirar el dado. Prioriza comunizar bienes donde tu personaje tenga mayor Saber para ahorrar Bienestar.',
      stepIndex: 2,
      boardFocus: 'TURN_DICE_AND_TILE'
    };
  }

  return {
    title: `Ronda 1 · Tu primer turno (${activePlayer?.name || 'Jugadora'})`,
    detail:
      'Pulsa "Tirar Dado 3D" (tecla R) en el panel inferior para moverte por el tablero e iniciar la cooperación.',
    stepIndex: 3,
    boardFocus: 'TURN_DICE_AND_TILE'
  };
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  state,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onOpenRules,
  disableEscapeKey = false,
  onVisibilityChange,
  onBoardFocusChange
}) => {
  const [mode, setMode] = useState<TutorialMode>(() => {
    if (typeof window === 'undefined') return 'CLOSED';
    const dontShow = safeGetStorage(STORAGE_KEY_TUTORIAL_DONT_SHOW) === 'true';
    const dismissed = safeGetStorage(STORAGE_KEY_TUTORIAL_DISMISSED) === 'true';
    if (!dontShow && !dismissed && state.round <= 2) {
      return 'STEP_BY_STEP';
    }
    return 'CLOSED';
  });

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  const [isVoiceAutoPlay, setIsVoiceAutoPlay] = useState<boolean>(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);
  const [targetRect, setTargetRect] = useState<MeasuredRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  }));

  // Micro-estados interactivos
  const [demoLegitimacy, setDemoLegitimacy] = useState<number>(0);
  const [demoStateIndex, setDemoStateIndex] = useState<number>(0);
  const [demoSkillPoints, setDemoSkillPoints] = useState<number>(2);
  const [demoBailoutDone, setDemoBailoutDone] = useState<boolean>(false);
  const [celebrationFired, setCelebrationFired] = useState<boolean>(false);

  const voice = useVoiceNarrator();

  // Sincronizar aperturas manuales desde tecla T o botón HUD
  useEffect(() => {
    if (controlledIsOpen === undefined) return;
    if (controlledIsOpen) {
      setMode('STEP_BY_STEP');
      setShowVoiceSettings(false);
    } else {
      setMode(prev => (prev === 'STEP_BY_STEP' ? 'CLOSED' : prev));
    }
  }, [controlledIsOpen]);

  // Al superar la Ronda 2, graduar automáticamente el coach strip no bloqueante
  useEffect(() => {
    if (state.round > 2 && mode === 'COACH_STRIP') {
      setMode('CLOSED');
    }
  }, [state.round, mode]);

  const inGameplay =
    state.phase !== 'TITLE' && state.phase !== 'SETUP' && state.phase !== 'GAME_OVER';
  const isStepByStepVisible = inGameplay && mode === 'STEP_BY_STEP';
  const isCoachStripVisible =
    inGameplay &&
    mode === 'COACH_STRIP' &&
    state.round <= 2 &&
    !state.activeModal;

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const liveAdvice = useMemo(() => getLivePhaseCoachAdvice(state), [state]);

  // Notificar visibilidad bloqueante al sistema global de atajos (solo modo paso a paso)
  useEffect(() => {
    onVisibilityChange?.(isStepByStepVisible);
  }, [isStepByStepVisible, onVisibilityChange]);

  // Notificar foco 3D al tablero WebGL
  useEffect(() => {
    if (!onBoardFocusChange) return;
    if (isStepByStepVisible && !showVoiceSettings) {
      onBoardFocusChange(currentStep.boardFocus);
    } else if (isCoachStripVisible) {
      onBoardFocusChange(liveAdvice.boardFocus);
    } else {
      onBoardFocusChange('NONE');
    }
  }, [
    isStepByStepVisible,
    isCoachStripVisible,
    showVoiceSettings,
    currentStep.boardFocus,
    liveAdvice.boardFocus,
    onBoardFocusChange
  ]);

  // Al desmontar, limpiar foco 3D
  useEffect(() => {
    return () => {
      onBoardFocusChange?.('NONE');
    };
  }, [onBoardFocusChange]);

  // Medir el elemento DOM real resaltado
  const measureTarget = useCallback(() => {
    if (typeof window === 'undefined') return;
    setViewportSize({ w: window.innerWidth, h: window.innerHeight });

    if (!isStepByStepVisible || showVoiceSettings) {
      setTargetRect(null);
      return;
    }

    const findUsableRect = (selector: string | null | undefined): MeasuredRect | null => {
      if (!selector) return null;
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) return null;
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    };

    const isNarrow = window.innerWidth < 768;
    const primary = findUsableRect(currentStep.domSelector);
    const fallback = isNarrow ? findUsableRect(currentStep.mobileDomSelector) : null;
    const resolved =
      isNarrow && currentStep.mobileDomSelector ? fallback || primary : primary || fallback;

    setTargetRect(resolved);
  }, [isStepByStepVisible, showVoiceSettings, currentStep.domSelector, currentStep.mobileDomSelector]);

  useEffect(() => {
    measureTarget();
    if (!isStepByStepVisible) return;

    const raf = window.requestAnimationFrame(measureTarget);
    window.addEventListener('resize', measureTarget);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureTarget);
    };
  }, [measureTarget, isStepByStepVisible, state.phase, state.round]);

  // Cerrar completamente o pasar a barra guía durante Rondas 1-2
  const handleMinimizeToCoach = useCallback(() => {
    voice.stop();
    playSound.uiToggle(false);
    setShowVoiceSettings(false);
    if (dontShowAgain) {
      safeSetStorage(STORAGE_KEY_TUTORIAL_DONT_SHOW, 'true');
      safeSetStorage(STORAGE_KEY_TUTORIAL_DISMISSED, 'true');
      setMode('CLOSED');
    } else if (state.round <= 2) {
      safeSetStorage(STORAGE_KEY_TUTORIAL_DISMISSED, 'true');
      setMode('COACH_STRIP');
    } else {
      safeSetStorage(STORAGE_KEY_TUTORIAL_DISMISSED, 'true');
      setMode('CLOSED');
    }
    controlledOnClose?.();
  }, [dontShowAgain, state.round, controlledOnClose, voice]);

  const handleSkipCompletely = useCallback(() => {
    voice.stop();
    playSound.uiToggle(false);
    setShowVoiceSettings(false);
    if (dontShowAgain) {
      safeSetStorage(STORAGE_KEY_TUTORIAL_DONT_SHOW, 'true');
    }
    safeSetStorage(STORAGE_KEY_TUTORIAL_DISMISSED, 'true');
    setMode('CLOSED');
    controlledOnClose?.();
  }, [dontShowAgain, controlledOnClose, voice]);

  const handleNext = useCallback(() => {
    playSound.voiceStep();
    setShowVoiceSettings(false);
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleMinimizeToCoach();
    }
  }, [currentStepIndex, handleMinimizeToCoach]);

  const handlePrev = useCallback(() => {
    playSound.voiceStep();
    setShowVoiceSettings(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Narrar automáticamente al cambiar de paso si está activo
  useEffect(() => {
    if (!isStepByStepVisible) {
      voice.stop();
      return;
    }

    if (showVoiceSettings) return;

    if (isVoiceAutoPlay && !voice.isMuted) {
      const timer = window.setTimeout(() => {
        voice.speak(currentStep.voiceScript);
      }, 240);
      return () => {
        window.clearTimeout(timer);
        voice.stop();
      };
    } else {
      voice.stop();
    }
  }, [isStepByStepVisible, currentStepIndex, isVoiceAutoPlay, voice.isMuted, showVoiceSettings]);

  // Atajos de teclado del tutorial paso a paso
  useEffect(() => {
    if (!isStepByStepVisible) return;

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
          handleMinimizeToCoach();
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
            if (voice.isPaused) voice.resume();
            else voice.pause();
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
  }, [
    isStepByStepVisible,
    disableEscapeKey,
    showVoiceSettings,
    handleMinimizeToCoach,
    handleNext,
    handlePrev,
    voice,
    currentStep.voiceScript
  ]);

  // Posición inteligente de la tarjeta para nunca tapar el tablero 3D resaltado ni desbordar en móvil
  const cardPlacementStyle = useMemo<React.CSSProperties>(() => {
    if (showVoiceSettings) {
      return {};
    }

    const isMobile = viewportSize.w < 640;
    const margin = isMobile ? 12 : 24;

    if (currentStep.boardFocus === 'GOODS_STATES' || currentStep.boardFocus === 'AGORA_CENTRAL') {
      // Dejar el centro del tablero 3D completamente despejado para ver los colores de estado y el Ágora
      return {
        bottom: margin,
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }

    if (targetRect) {
      const spaceBelow = viewportSize.h - (targetRect.top + targetRect.height);
      const spaceAbove = targetRect.top;

      if (spaceBelow >= 340 || spaceBelow >= spaceAbove) {
        const clampedTop = Math.min(
          Math.max(margin, targetRect.top + targetRect.height + 12),
          Math.max(margin, viewportSize.h - 380)
        );
        return {
          top: clampedTop,
          left: '50%',
          transform: 'translateX(-50%)'
        };
      }

      const clampedBottom = Math.min(
        Math.max(margin, viewportSize.h - targetRect.top + 12),
        Math.max(margin, viewportSize.h - 380)
      );
      return {
        bottom: clampedBottom,
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }

    return {
      bottom: margin,
      left: '50%',
      transform: 'translateX(-50%)'
    };
  }, [showVoiceSettings, viewportSize.w, viewportSize.h, currentStep.boardFocus, targetRect]);

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

  // MODO 1: BARRA CONTEXTUAL NO BLOQUEANTE PARA LAS PRIMERAS RONDAS (Rondas 1–2)
  if (isCoachStripVisible) {
    return (
      <aside
        aria-label="Asistente contextual de primeras rondas"
        className="pointer-events-auto fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-2xl bg-slate-950 border border-teal-600/80 rounded-2xl shadow-2xl px-3.5 py-2.5 text-slate-100"
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-teal-950 border border-teal-700/70 shrink-0">
              <GraduationCap className="w-4 h-4 text-teal-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-teal-300 truncate">
                {liveAdvice.title}
              </div>
              <p className="text-xs text-slate-200 leading-snug line-clamp-2">
                {liveAdvice.detail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playSound.modalOpen();
                setCurrentStepIndex(liveAdvice.stepIndex);
                setMode('STEP_BY_STEP');
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold whitespace-nowrap transition-colors"
            >
              Ver guía ({liveAdvice.stepIndex + 1}/{ONBOARDING_STEPS.length})
            </button>
            <button
              type="button"
              onClick={handleSkipCompletely}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Ocultar guía de primeras rondas"
              aria-label="Ocultar guía de primeras rondas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (!isStepByStepVisible) {
    return null;
  }

  // MODO 2: TUTORIAL INTERACTIVO PASO A PASO CON SPOTLIGHT REAL + BALIZA 3D
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial interactivo paso a paso de Commonspoly"
      className="fixed inset-0 z-50 pointer-events-none select-none"
    >
      {/* 1. Scrim suave para dirigir atención sin ocultar el tablero 3D */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${
          currentStep.boardFocus === 'GOODS_STATES' || currentStep.boardFocus === 'AGORA_CENTRAL'
            ? 'bg-slate-950/25'
            : 'bg-slate-950/45'
        }`}
      />

      {/* 2. Spotlight real medido sobre el elemento HUD activo */}
      {!showVoiceSettings && targetRect && (
        <div
          aria-hidden="true"
          className="absolute border-2 border-teal-400 rounded-2xl shadow-[0_0_28px_rgba(45,212,191,0.45)] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: Math.max(4, targetRect.top - 4),
            left: Math.max(4, targetRect.left - 4),
            width: targetRect.width + 8,
            height: targetRect.height + 8
          }}
        />
      )}

      {/* 3. Tarjeta Principal del Tutorial */}
      <div
        style={showVoiceSettings ? undefined : cardPlacementStyle}
        className={`absolute pointer-events-auto transition-all duration-200 ease-out ${
          showVoiceSettings
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto'
            : 'w-[94vw] max-w-xl max-h-[82vh] overflow-y-auto'
        }`}
      >
        <div className="bg-slate-950 border border-teal-500/70 rounded-2xl shadow-2xl p-4 md:p-5 text-slate-100 flex flex-col gap-3">
          {/* HEADER SUPERIOR */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-950 border border-teal-600/50 shrink-0">
                {showVoiceSettings ? (
                  <SlidersHorizontal className="w-5 h-5 text-teal-400" />
                ) : (
                  currentStep.icon
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 tabular-nums flex-wrap">
                  {showVoiceSettings ? (
                    <span>Configuración de Voz</span>
                  ) : (
                    <>
                      <span>
                        Paso {currentStep.number} de {ONBOARDING_STEPS.length}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-300">Ronda {state.round}</span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-400">{currentStep.categoryLabel}</span>
                    </>
                  )}
                </div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-snug">
                  {showVoiceSettings
                    ? 'Perfiles Narrativos del Asistente de Voz'
                    : currentStep.title}
                </h2>
              </div>
            </div>

            {/* Selector de voz y cierre */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  voice.stop();
                  setShowVoiceSettings(prev => !prev);
                }}
                className={`min-h-[38px] px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  showVoiceSettings
                    ? 'bg-teal-600 border-teal-400 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
                }`}
                title="Configurar perfiles narrativos y voces del asistente"
                aria-label="Abrir selector de perfiles narrativos de voz"
              >
                {getProfileIcon(voice.currentProfileId)}
                <span className="hidden sm:inline font-bold">{voice.currentProfile.name}</span>
                <SlidersHorizontal className="w-3.5 h-3.5 opacity-80" />
              </button>

              {!showVoiceSettings && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      if (voice.isLoadingNeural) {
                        voice.stop();
                      } else if (voice.isSpeaking) {
                        if (voice.isPaused) voice.resume();
                        else voice.pause();
                      } else {
                        voice.speak(currentStep.voiceScript);
                      }
                    }}
                    className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border text-xs transition-colors ${
                      voice.isLoadingNeural
                        ? 'bg-teal-950 border-teal-500/60 text-teal-300 hover:bg-teal-900'
                        : voice.isSpeaking && !voice.isPaused
                        ? 'bg-amber-950 border-amber-500/60 text-amber-300 hover:bg-amber-900'
                        : 'bg-slate-900 border-slate-700 text-teal-300 hover:text-white hover:bg-slate-800'
                    }`}
                    title={
                      voice.isLoadingNeural
                        ? 'Sintetizando voz natural... (pulsa para detener)'
                        : voice.isSpeaking && !voice.isPaused
                        ? 'Pausar locución (Espacio)'
                        : voice.isPaused
                        ? 'Reanudar locución (Espacio)'
                        : 'Reproducir explicación por voz'
                    }
                    aria-label="Control de reproducción de voz"
                  >
                    {voice.isLoadingNeural ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : voice.isSpeaking && !voice.isPaused ? (
                      <Pause className="w-4 h-4" />
                    ) : voice.isPaused ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      voice.toggleMute();
                    }}
                    className={`min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border transition-colors ${
                      voice.isMuted
                        ? 'bg-rose-950 border-rose-600/60 text-rose-300 hover:bg-rose-900'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    title={voice.isMuted ? 'Activar narrador de voz (M)' : 'Silenciar narrador de voz (M)'}
                    aria-label="Silenciar o activar narrador de voz"
                  >
                    {voice.isMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-teal-400" />
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleMinimizeToCoach}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={
                  state.round <= 2
                    ? 'Minimizar a barra guía durante Rondas 1-2 (Esc)'
                    : 'Cerrar tutorial (Esc)'
                }
                aria-label="Cerrar o minimizar tutorial"
              >
                {state.round <= 2 ? <Minimize2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* VISTA 1: CONFIGURACIÓN DE PERFILES NARRATIVOS */}
          {showVoiceSettings ? (
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-300">
                  Selecciona la personalidad y tono del asistente de voz que te guiará en Commonspoly:
                </p>
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(false)}
                  className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver al tutorial</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[42vh] overflow-y-auto pr-1">
                {NARRATIVE_PROFILES.map(profile => {
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
                        borderColor: isSelected ? profile.colorHex : undefined
                      }}
                      className={`cursor-pointer rounded-xl p-2.5 border transition-colors flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-slate-900'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="p-1.5 rounded-lg bg-slate-950 border shrink-0"
                              style={{ borderColor: `${profile.colorHex}55` }}
                            >
                              {getProfileIcon(profile.id)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="truncate">{profile.name}</span>
                                {isSelected && (
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 shrink-0"
                                    style={{ color: profile.colorHex }}
                                  />
                                )}
                              </h3>
                              <p
                                className="text-[10px] text-slate-400 font-medium truncate"
                                title={profile.characterArchetype}
                              >
                                {profile.characterArchetype}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-teal-200/90 font-medium italic truncate">
                            "{profile.tagline}"
                          </span>
                          <span className="font-semibold shrink-0" style={{ color: profile.colorHex }}>
                            {profile.badgeLabel}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {profile.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          Neural: {profile.geminiVoiceName} · {profile.recommendedRate}x
                        </span>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            playSound.uiClick();
                            voice.previewProfile(profile.id);
                          }}
                          className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border ${
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

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                    <Settings2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Motor de Voz y Ajustes Finos</span>
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

                {/* Selector de motor: Voz Neural IA vs Sistema */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AudioLines className="w-3.5 h-3.5 text-teal-400" />
                      <span>Calidad de síntesis de voz:</span>
                    </span>
                    <span className="text-[10px] text-teal-300 font-semibold">
                      {voice.activeBackend === 'NEURAL'
                        ? 'Voz Neural IA activa'
                        : voice.activeBackend === 'SYSTEM'
                        ? 'Voz del sistema activa'
                        : voice.engineMode === 'SYSTEM'
                        ? 'Modo sistema'
                        : 'Neural IA (con respaldo)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'AUTO' as VoiceEngineMode,
                          label: 'Voz Natural IA (Auto)',
                          desc: 'Usa Gemini Neural TTS y respalda con voz local si no hay conexión.'
                        },
                        {
                          id: 'SYSTEM' as VoiceEngineMode,
                          label: 'Voz del sistema',
                          desc: 'Usa únicamente las voces instaladas en tu navegador.'
                        }
                      ] as const
                    ).map(opt => {
                      const active =
                        opt.id === 'AUTO'
                          ? voice.engineMode === 'AUTO' || voice.engineMode === 'NEURAL'
                          : voice.engineMode === 'SYSTEM';
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            playSound.uiClick();
                            voice.setEngineMode(opt.id);
                          }}
                          className={`min-h-[44px] p-2 rounded-lg border text-left transition-colors ${
                            active
                              ? 'bg-teal-950/70 border-teal-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{opt.label}</div>
                          <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {voice.neuralStatusMessage && (
                    <p className="text-[10px] text-amber-300/90 leading-snug">
                      {voice.neuralStatusMessage}
                    </p>
                  )}
                </div>

                {voice.isSystemSpeechSupported && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between gap-2">
                      <span>Voz local de respaldo:</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[55%]">
                        {voice.currentVoiceName || 'Automática'}
                      </span>
                    </label>
                    <select
                      value={voice.currentVoiceName || ''}
                      onChange={e => {
                        playSound.uiClick();
                        voice.setVoiceByName(e.target.value);
                      }}
                      className="w-full min-h-[40px] bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
                    >
                      {voice.availableSpanishVoices.map(v => (
                        <option key={v.name} value={v.name}>
                          {v.isNatural ? '★ Natural · ' : ''}
                          {v.name} ({v.lang}) {v.default ? '· Predeterminada' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                      <span>Velocidad de locución:</span>
                      <strong className="text-teal-300 font-mono">{voice.rate}x</strong>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.05"
                      value={voice.rate}
                      onChange={e => voice.setRate(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                      <span>Tono (voz del sistema):</span>
                      <strong className="text-teal-300 font-mono">{voice.pitch}x</strong>
                    </div>
                    <input
                      type="range"
                      min="0.85"
                      max="1.15"
                      step="0.05"
                      value={voice.pitch}
                      onChange={e => voice.setPitch(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    voice.speak(currentStep.voiceScript);
                    setShowVoiceSettings(false);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar y Continuar</span>
                </button>
              </div>
            </div>
          ) : (
            /* VISTA 2: EXPLICACIÓN DEL PASO + RESALTE 3D */
            <div className="space-y-2.5 text-xs md:text-sm text-slate-300 leading-relaxed">
              <div className="flex items-center justify-between gap-2">
                <p className="text-teal-200 font-medium text-xs">{currentStep.subtitle}</p>
                {onOpenRules && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound.modalOpen();
                      onOpenRules();
                    }}
                    className="text-[11px] text-slate-400 hover:text-teal-300 underline whitespace-nowrap shrink-0"
                  >
                    Ver manual completo
                  </button>
                )}
              </div>

              <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
                {currentStep.content}
              </p>

              {/* Leyenda del resalte vivo en el tablero 3D */}
              {currentStep.boardHighlightLegend && (
                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-teal-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{currentStep.boardHighlightLegend}</span>
                  </div>
                  {(voice.isLoadingNeural || voice.isSpeaking) && (
                    <span className="text-[10px] font-semibold text-teal-300 whitespace-nowrap shrink-0 flex items-center gap-1">
                      <AudioLines className="w-3 h-3" />
                      {voice.isLoadingNeural
                        ? 'Sintetizando...'
                        : voice.activeBackend === 'NEURAL'
                        ? 'Voz IA'
                        : 'Voz sistema'}
                    </span>
                  )}
                </div>
              )}

              {/* Micro-Área Interactiva para Experimentar la Mecánica */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs tabular-nums">
                {currentStep.interactiveType === 'LEGITIMACY_DEMO' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      <span>Meta de asamblea: </span>
                      <strong className="text-amber-300">{state.players.length * 10} Legitimidad</strong>
                      <span className="text-slate-500"> · Simulada: </span>
                      <strong className="text-teal-300">+{demoLegitimacy} pts</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playSound.voiceSuccess();
                        setDemoLegitimacy(prev => prev + 2);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>Simular donación (+2)</span>
                    </button>
                  </div>
                )}

                {currentStep.interactiveType === 'GOODS_STATES' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Estado:</span>
                      {demoStateIndex === 0 && (
                        <span className="text-xs font-bold text-rose-300">
                          Privado (Control especulativo)
                        </span>
                      )}
                      {demoStateIndex === 1 && (
                        <span className="text-xs font-bold text-sky-300">
                          Público (Gestión estatal)
                        </span>
                      )}
                      {demoStateIndex === 2 && (
                        <span className="text-xs font-bold text-emerald-300">
                          Común (Autogestión vecinal)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playSound.uiClick();
                        setDemoStateIndex(prev => (prev + 1) % 3);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-semibold transition-colors shrink-0"
                    >
                      Transformar estado
                    </button>
                  </div>
                )}

                {currentStep.interactiveType === 'SKILL_DISCOUNT' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      <span>Saber Regenerar: </span>
                      <strong className="text-teal-300">{demoSkillPoints} pts</strong>
                      <span className="text-slate-500"> → Coste parque (base 4): </span>
                      <strong className="text-emerald-300">
                        {Math.max(1, 4 - demoSkillPoints)} Bienestar
                      </strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          setDemoSkillPoints(prev => Math.max(0, prev - 1));
                        }}
                        className="min-w-[36px] min-h-[36px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-mono text-xs font-bold"
                        aria-label="Reducir saber"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playSound.uiClick();
                          setDemoSkillPoints(prev => Math.min(3, prev + 1));
                        }}
                        className="min-w-[36px] min-h-[36px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-mono text-xs font-bold"
                        aria-label="Aumentar saber"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {currentStep.interactiveType === 'SHORTCUTS' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-teal-950 border border-teal-500/50 text-[10px] font-mono font-bold text-teal-300">
                        R
                      </kbd>
                      <span>Tirar Dado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-[10px] font-mono font-bold text-amber-300">
                        D
                      </kbd>
                      <span>Comunizar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                        P
                      </kbd>
                      <span>Pasar Turno</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-pink-950 border border-pink-500/50 text-[10px] font-mono font-bold text-pink-300">
                        A
                      </kbd>
                      <span>Ágora</span>
                    </div>
                  </div>
                )}

                {currentStep.interactiveType === 'BAILOUT_SIM' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">
                      {demoBailoutDone ? (
                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          ¡Compañera rescatada! +2 Legitimidad y Reputación Vecinal.
                        </span>
                      ) : (
                        <span>Una compañera cayó en detención por agotamiento.</span>
                      )}
                    </div>
                    {!demoBailoutDone ? (
                      <button
                        type="button"
                        onClick={() => {
                          playSound.voiceSuccess();
                          setDemoBailoutDone(true);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Pagar fianza solidaria</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDemoBailoutDone(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Reiniciar prueba
                      </button>
                    )}
                  </div>
                )}

                {currentStep.interactiveType === 'AGORA_CELEBRATION' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-[11px] text-pink-300 font-semibold">
                      ¡La asamblea está lista para transformar la ciudad!
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerCelebration}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-200" />
                      <span>{celebrationFired ? '¡Viva el Común!' : 'Simular Insurrección'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-300 flex items-start gap-2">
                <span className="font-bold text-teal-400 shrink-0">Consejo:</span>
                <span>{currentStep.tip}</span>
              </div>
            </div>
          )}

          {/* PIE DE PROGRESO Y OPCIONES */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
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
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-teal-400'
                      : idx < currentStepIndex
                      ? 'w-3 bg-teal-700'
                      : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                  }`}
                  title={`Paso ${idx + 1}: ${step.title}`}
                  aria-label={`Ir al paso ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVoiceAutoPlay}
                  onChange={e => setIsVoiceAutoPlay(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 accent-teal-500"
                />
                <span>Narrar voz</span>
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 accent-teal-500"
                />
                <span>No mostrar al inicio</span>
              </label>
            </div>
          </div>

          {/* BOTONES DE NAVEGACIÓN */}
          {!showVoiceSettings && (
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkipCompletely}
                  className="min-h-[40px] text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2"
                >
                  Saltar tutorial
                </button>
                {state.round <= 2 && (
                  <button
                    type="button"
                    onClick={handleMinimizeToCoach}
                    className="min-h-[40px] text-[11px] font-semibold text-teal-300 hover:text-teal-200 transition-colors px-2"
                  >
                    Probar en vivo
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span>
                    {currentStepIndex === ONBOARDING_STEPS.length - 1
                      ? state.round <= 2
                        ? '¡Jugar con guía breve!'
                        : '¡Entendido, a jugar!'
                      : 'Siguiente paso'}
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
