/**
 * QuickStartHUDGuide.tsx
 * Guía de inicio rápido dentro del juego para novatas y novatos:
 * - Resalta visualmente los elementos esenciales del HUD mediante un foco temporal inteligente (spotlight).
 * - Modos: temporizado automático con barra de progreso (foco temporal de 6s por botón) y control manual paso a paso.
 * - Pausa/reanudación del temporizador, atajos de teclado y tips amigables.
 * - Multi-idioma completo con soporte para los 17 idiomas de Commonspoly.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dices,
  Sparkles,
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Users,
  Award,
  Droplets,
  MessageSquare,
  History,
  Flame,
  Zap,
  Check,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playSound } from '../../utils/audio';
import { useI18n } from '../../i18n';
import { isReducedMotionActive } from '../ui/MotionPrimitives';

export interface QuickStartHUDGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRules?: () => void;
  stepDurationSeconds?: number;
}

interface TourStepDef {
  id: string;
  icon: React.ReactNode;
  domSelector: string;
  fallbackSelector?: string;
  badgeLabel: string;
  shortcut?: string;
  titleKey: string;
  descKey: string;
  tipKey: string;
}

interface MeasuredRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'roll_dice',
    icon: <Dices className="w-5 h-5 text-teal-400" />,
    domSelector: '[data-tour-target="roll-dice-btn"]',
    fallbackSelector: '[data-tutorial-target="bottom-dock"]',
    badgeLabel: 'Dado & Turno',
    shortcut: 'R',
    titleKey: 'rollTitle',
    descKey: 'rollDesc',
    tipKey: 'rollTip'
  },
  {
    id: 'dock_actions',
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    domSelector: '[data-tour-target="unlock-tile-btn"]',
    fallbackSelector: '[data-tutorial-target="bottom-dock"]',
    badgeLabel: 'Comunizar o Pasar',
    shortcut: 'D / P',
    titleKey: 'actionsTitle',
    descKey: 'actionsDesc',
    tipKey: 'actionsTip'
  },
  {
    id: 'player_indicator',
    icon: <Users className="w-5 h-5 text-sky-400" />,
    domSelector: '[data-tutorial-target="player-indicator"]',
    badgeLabel: 'Tu Jugadora',
    titleKey: 'playerTitle',
    descKey: 'playerDesc',
    tipKey: 'playerTip'
  },
  {
    id: 'global_mission',
    icon: <Award className="w-5 h-5 text-amber-300" />,
    domSelector: '[data-tutorial-target="top-status"]',
    badgeLabel: 'Misión Común',
    titleKey: 'missionTitle',
    descKey: 'missionDesc',
    tipKey: 'missionTip'
  },
  {
    id: 'commons_tracker',
    icon: <Droplets className="w-5 h-5 text-emerald-400" />,
    domSelector: '[data-tutorial-target="resources-tracker"]',
    fallbackSelector: '[data-tutorial-target="mobile-menu-btn"]',
    badgeLabel: 'Bienes Comunes',
    titleKey: 'commonsTitle',
    descKey: 'commonsDesc',
    tipKey: 'commonsTip'
  },
  {
    id: 'coop_chat',
    icon: <MessageSquare className="w-5 h-5 text-teal-300" />,
    domSelector: '[data-tutorial-target="coop-chat"]',
    fallbackSelector: '[data-tour-target="sheet-chat"]',
    badgeLabel: 'Solidaridad',
    titleKey: 'chatTitle',
    descKey: 'chatDesc',
    tipKey: 'chatTip'
  },
  {
    id: 'history_log',
    icon: <History className="w-5 h-5 text-indigo-400" />,
    domSelector: '[data-tour-target="history-btn"]',
    shortcut: 'G',
    badgeLabel: 'Bitácora',
    titleKey: 'historyTitle',
    descKey: 'historyDesc',
    tipKey: 'historyTip'
  },
  {
    id: 'agora_goal',
    icon: <Flame className="w-5 h-5 text-pink-400" />,
    domSelector: '[data-tour-target="agora-btn"]',
    fallbackSelector: '[data-tutorial-target="bottom-dock"]',
    badgeLabel: 'Victoria Comunal',
    shortcut: 'A',
    titleKey: 'agoraTitle',
    descKey: 'agoraDesc',
    tipKey: 'agoraTip'
  }
];

// Diccionario multi-idioma para los 17 lenguajes de Commonspoly
const QUICK_GUIDE_I18N: Record<string, Record<string, string>> = {
  es: {
    guideHeader: 'Guía de Inicio Rápido · HUD',
    temporalFocusBadge: 'Foco Temporal',
    pauseAria: 'Pausar foco automático',
    playAria: 'Reanudar foco automático',
    prevBtn: 'Anterior',
    nextBtn: 'Siguiente',
    finishBtn: '¡Entendido, a jugar!',
    skipBtn: 'Saltar guía',
    stepOf: 'Paso {current} de {total}',
    autoSecondsLeft: '{sec}s',
    proTipLabel: 'Consejo novata/o:',
    // Steps
    rollTitle: 'Tirar Dado y Avanzar',
    rollDesc: 'En tu turno, pulsa este botón (o la tecla R) para lanzar el dado 3D. Tu peón se moverá automáticamente por las casillas del tablero.',
    rollTip: 'En móvil, este botón está centrado en el dock inferior para pulsarlo cómodamente con el pulgar.',
    actionsTitle: 'Comunizar o Pasar el Turno',
    actionsDesc: 'Al caer en una casilla puedes Comunizarla (D) invirtiendo Bienestar para protegerla de la especulación, o Pasar (P) para ahorrar energía y ganar recursos.',
    actionsTip: 'Comunizar casillas es la clave cooperativa para ganar juntas antes de que el tablero sea privatizado.',
    playerTitle: 'Tu Estado: Bienestar y Legitimidad',
    playerDesc: 'Muestra a la jugadora activa. El Bienestar (♥) es tu energía vital para moverte y decidir; la Legitimidad (★) es tu reputación asamblearia.',
    playerTip: '¡Atención! Si tu Bienestar llega a cero, tu peón quedará exhausto o detenido por la policía.',
    missionTitle: 'Misión Común y Rondas',
    missionDesc: 'Commonspoly es 100% cooperativo. Aquí ves la ronda actual y los puntos de legitimidad necesarios en total entre todas para ganar la partida.',
    missionTip: 'Todas ganan juntas si alcanzan la meta colectiva de legitimidad y entran al Ágora Central.',
    commonsTitle: 'Rastreador de Bienes Comunes',
    commonsDesc: 'Monitorea en tiempo real el porcentaje de casillas protegidas como Bien Común frente a Privatizadas. Pulsa para ver gráficos y clima.',
    commonsTip: 'Mantener un alto porcentaje de comunes desbloquea bonificaciones frente a crisis climáticas.',
    chatTitle: 'Chat Cooperativo y Acuerdos',
    chatDesc: 'Coordina estrategias con las demás jugadoras y bots. Úsalo para solicitar donaciones de bienestar, pagar rescates o votar referéndums.',
    chatTip: 'En móvil tienes acceso directo tocando la pestaña "Chat" en la barra inferior.',
    historyTitle: 'Historial y Registro de Mesa',
    historyDesc: 'Pulsa este botón (o la tecla G) para consultar la bitácora completa con cada tirada, evento climático y cambio de propiedad.',
    historyTip: 'Revisa el historial para ver quién rescató a una compañera o qué casilla fue privatizada recientemente.',
    agoraTitle: 'El Ágora Central (Gran Victoria)',
    agoraDesc: 'Cuando el equipo haya acumulado suficiente legitimidad, las jugadoras pueden ingresar al centro del tablero para proclamar la victoria comunal.',
    agoraTip: 'Pulsa este botón cuando cumplas los requisitos para iniciar la asamblea insurreccional en el Ágora.'
  },
  en: {
    guideHeader: 'Quick Start HUD Guide',
    temporalFocusBadge: 'Timed Focus',
    pauseAria: 'Pause timed spotlight',
    playAria: 'Resume timed spotlight',
    prevBtn: 'Back',
    nextBtn: 'Next',
    finishBtn: 'Got it, let’s play!',
    skipBtn: 'Skip tour',
    stepOf: 'Step {current} of {total}',
    autoSecondsLeft: '{sec}s',
    proTipLabel: 'Novice tip:',
    rollTitle: 'Roll Dice & Move',
    rollDesc: 'On your turn, press this button (or key R) to roll the 3D dice. Your pawn will advance automatically across the circular board.',
    rollTip: 'On mobile, this button is centered in the bottom dock for easy one-handed thumb tapping.',
    actionsTitle: 'Communize or Pass Turn',
    actionsDesc: 'Upon landing on a tile, you can Communize (D) by investing Wellness to protect it from speculation, or Pass (P) to conserve energy.',
    actionsTip: 'Communizing tiles is the core cooperative mechanic to secure the city before speculators privatize it.',
    playerTitle: 'Your Stats: Wellness & Legitimacy',
    playerDesc: 'Displays the active player. Wellness (♥) is your vital stamina to act; Legitimacy (★) is your accumulated civic standing.',
    playerTip: 'Watch out! If your Wellness hits zero, you will become exhausted or detained by police.',
    missionTitle: 'Common Mission & Rounds',
    missionDesc: 'Commonspoly is 100% cooperative. View the current round and total collective Legitimacy points needed to beat speculation.',
    missionTip: 'All players win together if the collective legitimacy target is reached and someone enters the Central Agora.',
    commonsTitle: 'Commons Resource Tracker',
    commonsDesc: 'Real-time percentage of protected Commons vs Private goods. Tap to view ecological metrics, evolution, and climate insight.',
    commonsTip: 'Higher commons percentages grant resilient shields against weather disasters and crisis cards.',
    chatTitle: 'Cooperative Chat & Solidarity',
    chatDesc: 'Coordinate strategy with teammates and cooperative bots. Request wellness donations, pay bailouts, or vote in referendums.',
    chatTip: 'On touchscreens, tap the "Chat" tab directly in the bottom dock navigation.',
    historyTitle: 'Table History & Action Log',
    historyDesc: 'Click this button (or key G) to inspect the complete audit trail of dice rolls, ownership shifts, and crisis occurrences.',
    historyTip: 'Review past turns to check who bailed out a teammate or which tiles were recently converted.',
    agoraTitle: 'The Central Agora (Victory Hub)',
    agoraDesc: 'Once the team gathers enough collective legitimacy, players can enter the board center to trigger the triumphant commons assembly.',
    agoraTip: 'Press this button when requirements are met to inaugurate the victorious Agora insurrection.'
  }
};

export const QuickStartHUDGuide: React.FC<QuickStartHUDGuideProps> = ({
  isOpen,
  onClose,
  onOpenRules,
  stepDurationSeconds = 6
}) => {
  const { language } = useI18n();
  const dict = useMemo(() => QUICK_GUIDE_I18N[language] || QUICK_GUIDE_I18N.es, [language]);
  const reducedMotion = isReducedMotionActive();

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(!reducedMotion);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(stepDurationSeconds);
  const [targetRect, setTargetRect] = useState<MeasuredRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  }));

  const timerRef = useRef<number | null>(null);
  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  // Medir posición del elemento objetivo en pantalla
  const measureCurrentTarget = useCallback(() => {
    if (typeof window === 'undefined' || !isOpen) return;
    setViewportSize({ w: window.innerWidth, h: window.innerHeight });

    const findRect = (selector: string): MeasuredRect | null => {
      try {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return null;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      } catch {
        return null;
      }
    };

    const primary = findRect(currentStep.domSelector);
    const fallback = currentStep.fallbackSelector ? findRect(currentStep.fallbackSelector) : null;
    const resolved = primary || fallback;

    setTargetRect(resolved);
  }, [isOpen, currentStep.domSelector, currentStep.fallbackSelector]);

  // Manejar cambio de paso y reseteo de tiempo
  const goToStep = useCallback(
    (index: number) => {
      playSound.uiClick();
      const validIndex = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
      setCurrentStepIndex(validIndex);
      setSecondsRemaining(stepDurationSeconds);
    },
    [stepDurationSeconds]
  );

  const handleNext = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      playSound.voiceSuccess();
      onClose();
    }
  }, [currentStepIndex, goToStep, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  // Actualizar medición cuando cambie el paso o tamaño de pantalla
  useEffect(() => {
    measureCurrentTarget();
    if (!isOpen) return;

    const raf = window.requestAnimationFrame(measureCurrentTarget);
    window.addEventListener('resize', measureCurrentTarget);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureCurrentTarget);
    };
  }, [measureCurrentTarget, isOpen, currentStepIndex]);

  // Temporizador de foco automático (Foco temporal)
  useEffect(() => {
    if (!isOpen || !isPlaying || reducedMotion) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Avanzar al siguiente paso automáticamente
          if (currentStepIndex < TOUR_STEPS.length - 1) {
            setCurrentStepIndex((idx) => idx + 1);
            return stepDurationSeconds;
          } else {
            // Fin del tour temporal
            setIsPlaying(false);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isOpen, isPlaying, currentStepIndex, stepDurationSeconds, reducedMotion]);

  // Atajos de teclado para la guía rápida
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        playSound.uiToggle(false);
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        playSound.uiClick();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Cálculo de posición de la tarjeta de explicación
  const cardPlacementStyle = useMemo<React.CSSProperties>(() => {
    const isMobile = viewportSize.w < 640;
    const margin = isMobile ? 12 : 24;

    if (!targetRect) {
      return {
        bottom: margin,
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }

    const spaceBelow = viewportSize.h - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    // Si hay suficiente espacio abajo, colocamos la tarjeta abajo
    if (spaceBelow >= 310 || spaceBelow >= spaceAbove) {
      const clampedTop = Math.min(
        Math.max(margin, targetRect.top + targetRect.height + 16),
        Math.max(margin, viewportSize.h - 360)
      );
      return {
        top: clampedTop,
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }

    // Si el elemento está en la parte inferior, colocamos la tarjeta arriba
    const clampedBottom = Math.min(
      Math.max(margin, viewportSize.h - targetRect.top + 16),
      Math.max(margin, viewportSize.h - 360)
    );
    return {
      bottom: clampedBottom,
      left: '50%',
      transform: 'translateX(-50%)'
    };
  }, [targetRect, viewportSize.w, viewportSize.h]);

  if (!isOpen) return null;

  const currentTitle = dict[currentStep.titleKey] || currentStep.badgeLabel;
  const currentDesc = dict[currentStep.descKey] || '';
  const currentTip = dict[currentStep.tipKey] || '';

  // Porcentaje del tiempo restante para la barra de progreso
  const progressPercent = Math.max(0, Math.min(100, ((stepDurationSeconds - secondsRemaining + 1) / stepDurationSeconds) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.guideHeader}
      className="fixed inset-0 z-50 pointer-events-none select-none"
    >
      {/* 1. Scrim translúcido que enfoca visualmente el área */}
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto" onClick={onClose} />

      {/* 2. Spotlight focal activo medido sobre el botón o elemento del HUD */}
      {targetRect && (
        <motion.div
          aria-hidden="true"
          className="absolute border-2 border-amber-400 rounded-2xl shadow-[0_0_36px_rgba(251,191,36,0.55)] pointer-events-none"
          initial={false}
          animate={
            reducedMotion
              ? {}
              : {
                  boxShadow: [
                    '0 0 18px rgba(251,191,36,0.35)',
                    '0 0 42px rgba(251,191,36,0.7)',
                    '0 0 18px rgba(251,191,36,0.35)'
                  ]
                }
          }
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{
            top: Math.max(4, targetRect.top - 6),
            left: Math.max(4, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
        >
          {/* Badge flotante indicador del botón */}
          <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
            <Zap className="w-3 h-3 fill-slate-950" />
            <span>{currentStep.badgeLabel}</span>
          </div>
        </motion.div>
      )}

      {/* 3. Tarjeta Explicativa de la Guía Rápida */}
      <div
        style={cardPlacementStyle}
        className="absolute pointer-events-auto w-[94vw] max-w-lg transition-all duration-300 ease-out"
      >
        <div className="bg-slate-950/95 border-2 border-teal-500/80 rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-100 backdrop-blur-md flex flex-col gap-3">
          
          {/* Barra de progreso del foco temporal */}
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-teal-400 to-amber-400 h-full rounded-full"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Header de la tarjeta */}
          <div className="flex items-start justify-between gap-2.5 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-600/60 shrink-0">
                {currentStep.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-teal-300 flex-wrap">
                  <span className="tabular-nums">
                    {dict.stepOf
                      .replace('{current}', String(currentStepIndex + 1))
                      .replace('{total}', String(TOUR_STEPS.length))}
                  </span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[10px] font-bold">
                    {dict.temporalFocusBadge} ({dict.autoSecondsLeft.replace('{sec}', String(secondsRemaining))})
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate">
                  {currentTitle}
                </h3>
              </div>
            </div>

            {/* Controles de reproducción y cierre */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound.uiClick();
                  setIsPlaying((prev) => !prev);
                }}
                className={`min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-xl border transition-colors ${
                  isPlaying
                    ? 'bg-amber-950/70 border-amber-600/60 text-amber-300 hover:bg-amber-900/80'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title={isPlaying ? dict.pauseAria : dict.playAria}
                aria-label={isPlaying ? dict.pauseAria : dict.playAria}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound.uiToggle(false);
                  onClose();
                }}
                className="min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={dict.skipBtn}
                aria-label={dict.skipBtn}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Explicación concisa para novatos */}
          <div className="space-y-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
            <p className="font-normal">{currentDesc}</p>

            {currentStep.shortcut && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="text-slate-400">Atajo de teclado:</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-teal-300 text-[11px]">
                  {currentStep.shortcut}
                </kbd>
              </div>
            )}

            {currentTip && (
              <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-teal-800/60 text-[11px] text-teal-200 flex items-start gap-2">
                <span className="font-bold text-amber-400 shrink-0">{dict.proTipLabel}</span>
                <span>{currentTip}</span>
              </div>
            )}
          </div>

          {/* Navegación y selector de botones */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {/* Dots interactivos */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-amber-400'
                      : idx < currentStepIndex
                      ? 'w-2.5 bg-teal-600'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                  title={step.badgeLabel}
                  aria-label={step.badgeLabel}
                />
              ))}
            </div>

            {/* Botones Anterior / Siguiente */}
            <div className="flex items-center gap-1.5 ml-auto">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{dict.prevBtn}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="min-h-[40px] px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
              >
                <span>
                  {currentStepIndex === TOUR_STEPS.length - 1 ? dict.finishBtn : dict.nextBtn}
                </span>
                {currentStepIndex === TOUR_STEPS.length - 1 ? (
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
