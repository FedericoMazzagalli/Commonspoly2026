/**
 * TutorialOverlay.tsx
 * Tutorial interactivo paso a paso y guía contextual durante las primeras rondas (Rondas 1–2)
 * de una nueva partida en Commonspoly:
 * - Resalta elementos reales del HUD (vía data-tutorial-target) y del tablero 3D (casillas por estado,
 *   peón activo, dado 3D, especuladores y Ágora Central).
 * - Multi-idioma completo (useI18n).
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
  Flame,
  Minimize2,
  GraduationCap,
  Pointer
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { GameEngineState, TutorialBoardFocus } from '../../types/game';
import { playSound } from '../../utils/audio';
import { useI18n, TranslationDict } from '../../i18n';
import { isReducedMotionActive } from '../ui/MotionPrimitives';

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

function formatTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

export type TargetZone =
  | 'TOP_STATUS'
  | 'TOP_LEFT_PLAYER'
  | 'TOP_RIGHT_RESOURCES'
  | 'BOTTOM_DOCK'
  | 'CHAT_SOLIDARITY'
  | 'BOARD_AGORA';

type TutorialMode = 'CLOSED' | 'STEP_BY_STEP' | 'COACH_STRIP';

interface StepStructuralMeta {
  id: string;
  number: number;
  icon: React.ReactNode;
  targetZone: TargetZone;
  domSelector: string | null;
  mobileDomSelector?: string | null;
  boardFocus: TutorialBoardFocus;
  interactiveType:
    | 'LEGITIMACY_DEMO'
    | 'GOODS_STATES'
    | 'SKILL_DISCOUNT'
    | 'SHORTCUTS'
    | 'BAILOUT_SIM'
    | 'AGORA_CELEBRATION';
}

interface OnboardingStep extends StepStructuralMeta {
  title: string;
  subtitle: string;
  categoryLabel: string;
  content: string;
  tip: string;
  boardHighlightLegend: string;
}

const STEP_STRUCTURAL_META: StepStructuralMeta[] = [
  {
    id: 'cooperative_mission',
    number: 1,
    icon: <Award className="w-5 h-5 text-amber-400" />,
    targetZone: 'TOP_STATUS',
    domSelector: '[data-tutorial-target="top-status"]',
    boardFocus: 'LEGITIMACY_AND_GOAL',
    interactiveType: 'LEGITIMACY_DEMO'
  },
  {
    id: 'commons_and_states',
    number: 2,
    icon: <Droplets className="w-5 h-5 text-emerald-400" />,
    targetZone: 'TOP_RIGHT_RESOURCES',
    domSelector: '[data-tutorial-target="resources-tracker"]',
    mobileDomSelector: '[data-tutorial-target="mobile-menu-btn"]',
    boardFocus: 'GOODS_STATES',
    interactiveType: 'GOODS_STATES'
  },
  {
    id: 'character_and_wellness',
    number: 3,
    icon: <Users className="w-5 h-5 text-teal-400" />,
    targetZone: 'TOP_LEFT_PLAYER',
    domSelector: '[data-tutorial-target="player-indicator"]',
    boardFocus: 'ACTIVE_PLAYER_PAWN',
    interactiveType: 'SKILL_DISCOUNT'
  },
  {
    id: 'turn_actions_and_dock',
    number: 4,
    icon: <Compass className="w-5 h-5 text-cyan-400" />,
    targetZone: 'BOTTOM_DOCK',
    domSelector: '[data-tutorial-target="bottom-dock"]',
    boardFocus: 'TURN_DICE_AND_TILE',
    interactiveType: 'SHORTCUTS'
  },
  {
    id: 'threats_and_solidarity',
    number: 5,
    icon: <HeartHandshake className="w-5 h-5 text-rose-400" />,
    targetZone: 'CHAT_SOLIDARITY',
    domSelector: '[data-tutorial-target="coop-chat"]',
    mobileDomSelector: '[data-tutorial-target="bottom-dock"]',
    boardFocus: 'SPECULATORS_THREAT',
    interactiveType: 'BAILOUT_SIM'
  },
  {
    id: 'climate_and_agora',
    number: 6,
    icon: <Flame className="w-5 h-5 text-pink-400" />,
    targetZone: 'BOARD_AGORA',
    domSelector: null,
    boardFocus: 'AGORA_CENTRAL',
    interactiveType: 'AGORA_CELEBRATION'
  }
];

interface MeasuredRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getLivePhaseCoachAdvice(
  state: GameEngineState,
  t: TranslationDict
): {
  title: string;
  detail: string;
  stepIndex: number;
  boardFocus: TutorialBoardFocus;
} {
  const activePlayer = state.players[state.activePlayerIndex];
  const currentTile = state.tiles.find(tile => tile.id === activePlayer?.position);
  const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
  const targetLegitimacy = Math.max(1, state.players.length * 10);
  const tut = t.tutorial;

  if (state.phase === 'SPECULATOR_TURN') {
    return {
      title: formatTemplate(tut.coachSpecTitle, { round: state.round }),
      detail: tut.coachSpecDetail,
      stepIndex: 4,
      boardFocus: 'SPECULATORS_THREAT'
    };
  }

  if (activePlayer?.controller === 'BOT') {
    return {
      title: formatTemplate(tut.coachBotTitle, {
        round: state.round,
        name: activePlayer.name
      }),
      detail: tut.coachBotDetail,
      stepIndex: 1,
      boardFocus: 'ACTIVE_PLAYER_PAWN'
    };
  }

  if (state.phase === 'TILE_ACTION_DECISION' && currentTile) {
    if (currentTile.state === 'PRIVATE' || currentTile.state === 'PUBLIC') {
      const nextStateLabel =
        currentTile.state === 'PRIVATE' ? t.common.public : t.common.common;
      return {
        title: formatTemplate(tut.coachDecTitle, {
          round: state.round,
          tile: currentTile.name
        }),
        detail:
          currentTile.state === 'PUBLIC'
            ? tut.coachDecDetailPublic
            : formatTemplate(tut.coachDecDetailPrivate, { next: nextStateLabel }),
        stepIndex: 3,
        boardFocus: 'ACTIVE_PLAYER_PAWN'
      };
    }
    return {
      title: formatTemplate(tut.coachSpecialTitle, {
        round: state.round,
        tile: currentTile.name
      }),
      detail: tut.coachSpecialDetail,
      stepIndex: 3,
      boardFocus: 'ACTIVE_PLAYER_PAWN'
    };
  }

  if (totalLegitimacy >= targetLegitimacy && !activePlayer?.inAgora) {
    return {
      title: formatTemplate(tut.coachAgoraTitle, { round: state.round }),
      detail: tut.coachAgoraDetail,
      stepIndex: 5,
      boardFocus: 'AGORA_CENTRAL'
    };
  }

  if (state.round === 2) {
    return {
      title: formatTemplate(tut.coachRound2Title, {
        cur: totalLegitimacy,
        target: targetLegitimacy
      }),
      detail: tut.coachRound2Detail,
      stepIndex: 2,
      boardFocus: 'TURN_DICE_AND_TILE'
    };
  }

  return {
    title: formatTemplate(tut.coachRound1Title, {
      name: activePlayer?.name || t.common.human
    }),
    detail: tut.coachRound1Detail,
    stepIndex: 3,
    boardFocus: 'TURN_DICE_AND_TILE'
  };
}

const TOUCH_HINT_BY_LANG: Record<string, string> = {
  es: 'Toca aquí',
  en: 'Tap here',
  fr: 'Touchez ici',
  pt: 'Toque aqui',
  it: 'Tocca qui',
  de: 'Hier tippen',
  ca: 'Toca aquí',
  gl: 'Toca aquí',
  eu: 'Ukitu hemen',
  nl: 'Tik hier',
  pl: 'Dotknij tutaj',
  ru: 'Нажмите здесь',
  ja: 'ここをタップ',
  ko: '여기를 탭하세요',
  zh: '点击此处',
  ar: 'المس هنا',
  hi: 'यहाँ टैप करें'
};

const ZONE_LABEL_BY_LANG: Record<TargetZone, Record<string, string>> = {
  TOP_STATUS: {
    es: 'Misión y Rondas',
    en: 'Mission & Rounds',
    fr: 'Mission et Manches',
    pt: 'Missão e Rodadas',
    it: 'Missione e Turni',
    de: 'Mission & Runden',
    ca: 'Missió i Rondes',
    gl: 'Misión e Roldas',
    eu: 'Misioa eta Txandak',
    nl: 'Missie & Rondes',
    pl: 'Misja i Rundy',
    ru: 'Миссия и Раунды',
    ja: 'ミッションとラウンド',
    ko: '미션 및 라운드',
    zh: '使命与回合',
    ar: 'المهمة والجولات',
    hi: 'मिशन और राउंड'
  },
  TOP_RIGHT_RESOURCES: {
    es: 'Bienes Comunes',
    en: 'Commons Resources',
    fr: 'Biens Communs',
    pt: 'Bens Comuns',
    it: 'Beni Comuni',
    de: 'Gemeingüter',
    ca: 'Béns Comuns',
    gl: 'Bens Comúns',
    eu: 'Ondasun Komunak',
    nl: 'Gemeenschapsgoederen',
    pl: 'Dobra Wspólne',
    ru: 'Общие Блага',
    ja: 'コモンズ資源',
    ko: '공유 자원',
    zh: '公有资源',
    ar: 'الموارد المشتركة',
    hi: 'साझा संसाधन'
  },
  TOP_LEFT_PLAYER: {
    es: 'Jugador y Bienestar',
    en: 'Player & Wellness',
    fr: 'Joueur et Bien-être',
    pt: 'Jogador e Bem-estar',
    it: 'Giocatore e Benessere',
    de: 'Spieler & Wohlbefinden',
    ca: 'Jugador i Benestar',
    gl: 'Xogador e Benestar',
    eu: 'Jokalaria eta Ongizatea',
    nl: 'Speler & Welzijn',
    pl: 'Gracz i Dobrostan',
    ru: 'Игрок и Благополучие',
    ja: 'プレイヤーと幸福度',
    ko: '플레이어 및 웰빙',
    zh: '玩家与福祉',
    ar: 'اللاعب والرفاهية',
    hi: 'खिलाड़ी और कल्याण'
  },
  BOTTOM_DOCK: {
    es: 'Controles de Turno',
    en: 'Turn Controls',
    fr: 'Contrôles du Tour',
    pt: 'Controles do Turno',
    it: 'Comandi del Turno',
    de: 'Zug-Steuerung',
    ca: 'Controls del Torn',
    gl: 'Controis da Rolda',
    eu: 'Txandaren Kontrolak',
    nl: 'Beurtbediening',
    pl: 'Sterowanie Turą',
    ru: 'Управление Ходом',
    ja: 'ターンコントロール',
    ko: '턴 컨트롤',
    zh: '回合控制',
    ar: 'أزرار التحكم بالدور',
    hi: 'बारी नियंत्रण'
  },
  CHAT_SOLIDARITY: {
    es: 'Solidaridad y Chat',
    en: 'Solidarity & Chat',
    fr: 'Solidarité et Chat',
    pt: 'Solidariedade e Chat',
    it: 'Solidarietà e Chat',
    de: 'Solidarität & Chat',
    ca: 'Solidaritat i Xat',
    gl: 'Solidariedade e Chat',
    eu: 'Elkartasuna eta Txata',
    nl: 'Solidariteit & Chat',
    pl: 'Solidarność i Czat',
    ru: 'Солидарность и Чат',
    ja: '連帯とチャット',
    ko: '연대 및 채팅',
    zh: '团结与聊天',
    ar: 'التضامن والدردشة',
    hi: 'एकجुटता और चैट'
  },
  BOARD_AGORA: {
    es: 'Ágora Central (Tablero)',
    en: 'Central Agora (Board)',
    fr: 'Agora Centrale (Plateau)',
    pt: 'Ágora Central (Tabuleiro)',
    it: 'Agora Centrale (Tabellone)',
    de: 'Zentrale Agora (Spielbrett)',
    ca: 'Àgora Central (Taulell)',
    gl: 'Ágora Central (Taboleiro)',
    eu: 'Agora Zentrala (Taula)',
    nl: 'Centrale Agora (Bord)',
    pl: 'Centralna Agora (Plansza)',
    ru: 'Центральная Агора (Доска)',
    ja: '中央アゴラ（ボード）',
    ko: '중앙 아고라 (보드)',
    zh: '中央广场（棋盘）',
    ar: 'الساحة المركزية (اللوحة)',
    hi: 'केंद्रीय अगोरा (बोर्ड)'
  }
};

interface TutorialTouchPointerProps {
  targetRect: MeasuredRect | null;
  targetZone: TargetZone;
  stepNumber: number;
  stepTitle: string;
  viewportSize: { w: number; h: number };
  language: string;
}

export const TutorialTouchPointer: React.FC<TutorialTouchPointerProps> = ({
  targetRect,
  targetZone,
  stepNumber,
  stepTitle,
  viewportSize,
  language
}) => {
  const reducedMotion = isReducedMotionActive();

  const touchHint = TOUCH_HINT_BY_LANG[language] || TOUCH_HINT_BY_LANG.es;
  const zoneDict = ZONE_LABEL_BY_LANG[targetZone] || ZONE_LABEL_BY_LANG.BOTTOM_DOCK;
  const zoneName = zoneDict[language] || zoneDict.es;

  // Si no hay targetRect y no es el Ágora central, no renderizamos
  if (!targetRect && targetZone !== 'BOARD_AGORA') {
    return null;
  }

  let focalX = viewportSize.w * 0.5;
  let focalY = viewportSize.h * 0.42;
  let orientation: 'point-down' | 'point-up' = 'point-up';
  let badgeVertical: 'above' | 'below' = 'below';

  if (targetRect) {
    if (targetZone === 'BOTTOM_DOCK') {
      focalX = targetRect.left + targetRect.width * 0.5;
      focalY = targetRect.top + Math.min(30, targetRect.height * 0.4);
      orientation = 'point-down';
      badgeVertical = 'above';
    } else if (targetZone === 'TOP_STATUS') {
      focalX = targetRect.left + targetRect.width * 0.5;
      focalY = targetRect.top + targetRect.height * 0.55;
      orientation = 'point-up';
      badgeVertical = 'below';
    } else if (targetZone === 'TOP_LEFT_PLAYER') {
      focalX = targetRect.left + Math.min(84, targetRect.width * 0.4);
      focalY = targetRect.top + targetRect.height * 0.55;
      orientation = 'point-up';
      badgeVertical = 'below';
    } else if (targetZone === 'TOP_RIGHT_RESOURCES') {
      focalX = targetRect.left + targetRect.width * 0.5;
      focalY = targetRect.top + targetRect.height * 0.55;
      orientation = 'point-up';
      badgeVertical = 'below';
    } else if (targetZone === 'CHAT_SOLIDARITY') {
      focalX = targetRect.left + targetRect.width * 0.5;
      focalY = targetRect.top + Math.min(32, targetRect.height * 0.45);
      orientation = targetRect.top > viewportSize.h * 0.55 ? 'point-down' : 'point-up';
      badgeVertical = orientation === 'point-down' ? 'above' : 'below';
    } else {
      focalX = targetRect.left + targetRect.width * 0.5;
      focalY = targetRect.top + targetRect.height * 0.5;
      orientation = targetRect.top > viewportSize.h * 0.55 ? 'point-down' : 'point-up';
      badgeVertical = orientation === 'point-down' ? 'above' : 'below';
    }
  } else if (targetZone === 'BOARD_AGORA') {
    focalX = viewportSize.w * 0.5;
    focalY = viewportSize.h * 0.42;
    orientation = 'point-down';
    badgeVertical = 'above';
  }

  // Clampeo seguro en bordes de pantalla para móviles y tablets
  focalX = Math.max(32, Math.min(viewportSize.w - 32, focalX));
  focalY = Math.max(32, Math.min(viewportSize.h - 32, focalY));

  // Si badgeVertical es 'above' pero está muy cerca de la parte superior, conmutar a 'below'
  if (badgeVertical === 'above' && focalY < 84) {
    badgeVertical = 'below';
  } else if (badgeVertical === 'below' && focalY > viewportSize.h - 84) {
    badgeVertical = 'above';
  }

  // Desplazamiento horizontal relativo para mantener el badge visible en pantallas de 360px-430px
  const badgeOffsetClamp = Math.max(
    88 - focalX,
    Math.min(viewportSize.w - 88 - focalX, 0)
  );

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="absolute pointer-events-none select-none z-30"
      style={{ left: focalX, top: focalY }}
    >
      {/* 1. Ondas concéntricas de pulso táctil (ripple) emitidas desde el centro de interacción */}
      <motion.span
        className="absolute rounded-full border-2 border-teal-400 bg-teal-400/20"
        style={{ width: 44, height: 44, left: -22, top: -22 }}
        initial={false}
        animate={
          reducedMotion
            ? { scale: 1, opacity: 0.4 }
            : { scale: [0.5, 2.2], opacity: [0.95, 0] }
        }
        transition={
          reducedMotion
            ? {}
            : { repeat: Infinity, duration: 1.5, ease: 'easeOut' }
        }
      />
      {!reducedMotion && (
        <motion.span
          className="absolute rounded-full border border-teal-300 bg-teal-300/15"
          style={{ width: 44, height: 44, left: -22, top: -22 }}
          initial={false}
          animate={{ scale: [0.5, 2.2], opacity: [0.95, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, delay: 0.5, ease: 'easeOut' }}
        />
      )}

      {/* 2. Micro-retícula con ticks en cruz y punto focal luminoso */}
      <span className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-teal-300 border-2 border-white shadow-[0_0_16px_rgba(45,212,191,1)]" />

      <div className="absolute -left-3.5 -top-3.5 w-7 h-7 pointer-events-none opacity-70">
        <span className="absolute top-0 left-0 w-2 h-0.5 bg-teal-300" />
        <span className="absolute top-0 left-0 w-0.5 h-2 bg-teal-300" />
        <span className="absolute top-0 right-0 w-2 h-0.5 bg-teal-300" />
        <span className="absolute top-0 right-0 w-0.5 h-2 bg-teal-300" />
        <span className="absolute bottom-0 left-0 w-2 h-0.5 bg-teal-300" />
        <span className="absolute bottom-0 left-0 w-0.5 h-2 bg-teal-300" />
        <span className="absolute bottom-0 right-0 w-2 h-0.5 bg-teal-300" />
        <span className="absolute bottom-0 right-0 w-0.5 h-2 bg-teal-300" />
      </div>

      {/* 3. Mano indicadora con animación táctil de toque rítmico (Tap Bounce) */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: orientation === 'point-down' ? -16 : -12,
          top: orientation === 'point-down' ? -46 : 14
        }}
        initial={false}
        animate={
          reducedMotion
            ? { y: 0, scale: 1 }
            : orientation === 'point-down'
            ? {
                y: [0, 8, 0],
                scale: [1, 1.1, 1],
                rotate: [150, 146, 150]
              }
            : {
                y: [0, -8, 0],
                scale: [1, 1.1, 1],
                rotate: [-20, -25, -20]
              }
        }
        transition={
          reducedMotion
            ? {}
            : {
                repeat: Infinity,
                duration: 1.25,
                ease: [0.25, 1, 0.5, 1]
              }
        }
      >
        <div className="relative filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] drop-shadow-[0_0_12px_rgba(45,212,191,0.75)]">
          <Pointer className="w-8 h-8 text-teal-300 fill-slate-950/90 stroke-teal-300 stroke-[2.2]" />
          {/* Micro-destello en la yema del dedo */}
          {!reducedMotion && (
            <motion.span
              className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047]"
              style={{
                top: orientation === 'point-down' ? 26 : 2,
                left: orientation === 'point-down' ? 6 : 4
              }}
              animate={{
                scale: [0.7, 1.6, 0.7],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
            />
          )}
        </div>
      </motion.div>

      {/* 4. Badge flotante táctil "Toca aquí · Zona" */}
      <motion.div
        className="absolute -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/95 border border-teal-400/80 text-teal-200 text-xs font-bold shadow-[0_6px_24px_rgba(0,0,0,0.85)] backdrop-blur-md whitespace-nowrap pointer-events-none select-none z-20"
        style={{
          left: badgeOffsetClamp,
          top: badgeVertical === 'above' ? -76 : 52
        }}
        initial={false}
        animate={
          reducedMotion
            ? {}
            : {
                scale: [0.98, 1.03, 0.98]
              }
        }
        transition={
          reducedMotion
            ? {}
            : {
                repeat: Infinity,
                duration: 2.2,
                ease: 'easeInOut'
              }
        }
      >
        <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf] animate-pulse shrink-0" />
        <span className="text-white font-extrabold">{touchHint}</span>
        <span className="text-teal-400 font-semibold text-[11px]">· {zoneName}</span>
      </motion.div>
    </div>
  );
};

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  state,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onOpenRules,
  disableEscapeKey = false,
  onVisibilityChange,
  onBoardFocusChange
}) => {
  const { t, language } = useI18n();
  const tut = t.tutorial;

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

  const onboardingSteps = useMemo<OnboardingStep[]>(() => {
    return STEP_STRUCTURAL_META.map((meta, idx) => {
      const localized = tut.steps[idx] ?? tut.steps[0];
      return {
        ...meta,
        title: localized?.title ?? '',
        subtitle: localized?.subtitle ?? '',
        categoryLabel: localized?.categoryLabel ?? '',
        content: localized?.content ?? '',
        tip: localized?.tip ?? '',
        boardHighlightLegend: localized?.boardHighlightLegend ?? ''
      };
    });
  }, [tut.steps]);

  // Sincronizar aperturas manuales desde tecla T o botón HUD
  useEffect(() => {
    if (controlledIsOpen === undefined) return;
    if (controlledIsOpen) {
      setMode('STEP_BY_STEP');
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

  const currentStep = onboardingSteps[currentStepIndex] ?? onboardingSteps[0];
  const liveAdvice = useMemo(() => getLivePhaseCoachAdvice(state, t), [state, t]);

  // Notificar visibilidad bloqueante al sistema global de atajos (solo modo paso a paso)
  useEffect(() => {
    onVisibilityChange?.(isStepByStepVisible);
  }, [isStepByStepVisible, onVisibilityChange]);

  // Notificar foco 3D al tablero WebGL
  useEffect(() => {
    if (!onBoardFocusChange) return;
    if (isStepByStepVisible) {
      onBoardFocusChange(currentStep.boardFocus);
    } else if (isCoachStripVisible) {
      onBoardFocusChange(liveAdvice.boardFocus);
    } else {
      onBoardFocusChange('NONE');
    }
  }, [
    isStepByStepVisible,
    isCoachStripVisible,
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

    if (!isStepByStepVisible) {
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
  }, [isStepByStepVisible, currentStep.domSelector, currentStep.mobileDomSelector]);

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
    playSound.uiToggle(false);
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
  }, [dontShowAgain, state.round, controlledOnClose]);

  const handleSkipCompletely = useCallback(() => {
    playSound.uiToggle(false);
    if (dontShowAgain) {
      safeSetStorage(STORAGE_KEY_TUTORIAL_DONT_SHOW, 'true');
    }
    safeSetStorage(STORAGE_KEY_TUTORIAL_DISMISSED, 'true');
    setMode('CLOSED');
    controlledOnClose?.();
  }, [dontShowAgain, controlledOnClose]);

  const handleNext = useCallback(() => {
    playSound.voiceStep();
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleMinimizeToCoach();
    }
  }, [currentStepIndex, onboardingSteps.length, handleMinimizeToCoach]);

  const handlePrev = useCallback(() => {
    playSound.voiceStep();
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

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
        handleMinimizeToCoach();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isStepByStepVisible,
    disableEscapeKey,
    handleMinimizeToCoach,
    handleNext,
    handlePrev
  ]);

  // Posición inteligente de la tarjeta para nunca tapar el tablero 3D resaltado ni desbordar en móvil
  const cardPlacementStyle = useMemo<React.CSSProperties>(() => {
    const isMobile = viewportSize.w < 640;
    const margin = isMobile ? 12 : 24;

    if (currentStep.boardFocus === 'GOODS_STATES' || currentStep.boardFocus === 'AGORA_CENTRAL') {
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
  }, [viewportSize.w, viewportSize.h, currentStep.boardFocus, targetRect]);

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

  // MODO 1: BARRA CONTEXTUAL NO BLOQUEANTE PARA LAS PRIMERAS RONDAS (Rondas 1–2)
  if (isCoachStripVisible) {
    return (
      <aside
        aria-label={tut.coachAria}
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
              className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold whitespace-nowrap transition-colors"
            >
              {formatTemplate(tut.viewGuide, {
                current: liveAdvice.stepIndex + 1,
                total: onboardingSteps.length
              })}
            </button>
            <button
              type="button"
              onClick={handleSkipCompletely}
              className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={tut.hideGuideTitle}
              aria-label={tut.hideGuideTitle}
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
      aria-label={tut.dialogAria}
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
      {targetRect && (
        <motion.div
          aria-hidden="true"
          className="absolute border-2 border-teal-400 rounded-2xl shadow-[0_0_28px_rgba(45,212,191,0.45)] pointer-events-none transition-all duration-300 ease-out"
          initial={false}
          animate={
            isReducedMotionActive()
              ? {}
              : {
                  boxShadow: [
                    '0 0 20px rgba(45,212,191,0.35)',
                    '0 0 38px rgba(45,212,191,0.65)',
                    '0 0 20px rgba(45,212,191,0.35)'
                  ]
                }
          }
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          style={{
            top: Math.max(4, targetRect.top - 4),
            left: Math.max(4, targetRect.left - 4),
            width: targetRect.width + 8,
            height: targetRect.height + 8
          }}
        />
      )}

      {/* 2b. Indicador táctil animado (puntero con toque rítmico, onda y badge) */}
      <TutorialTouchPointer
        targetRect={targetRect}
        targetZone={currentStep.targetZone}
        stepNumber={currentStep.number}
        stepTitle={currentStep.title}
        viewportSize={viewportSize}
        language={language}
      />

      {/* 3. Tarjeta Principal del Tutorial */}
      <div
        style={cardPlacementStyle}
        className="absolute pointer-events-auto transition-all duration-200 ease-out w-[94vw] max-w-xl max-h-[78dvh] overflow-y-auto overscroll-contain-y pb-safe"
      >
        <div className="bg-slate-950 border border-teal-500/70 rounded-2xl shadow-2xl p-4 md:p-5 text-slate-100 flex flex-col gap-3">
          {/* HEADER SUPERIOR */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-950 border border-teal-600/50 shrink-0">
                {currentStep.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 tabular-nums flex-wrap">
                  <span>
                    {formatTemplate(tut.stepOf, {
                      current: currentStep.number,
                      total: onboardingSteps.length
                    })}
                  </span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-300">
                    {t.common.round} {state.round}
                  </span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-400">{currentStep.categoryLabel}</span>
                </div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-snug">
                  {currentStep.title}
                </h2>
              </div>
            </div>

            {/* Botón minimizar / cerrar */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleMinimizeToCoach}
                className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={
                  state.round <= 2 ? tut.minimizeCoachTitle : tut.closeTutorialTitle
                }
                aria-label={tut.closeOrMinAria}
              >
                {state.round <= 2 ? <Minimize2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* EXPLICACIÓN DEL PASO + RESALTE 3D */}
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
                  {tut.viewFullManual}
                </button>
              )}
            </div>

            <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
              {currentStep.content}
            </p>

            {/* Leyenda del resalte vivo en el tablero 3D */}
            {currentStep.boardHighlightLegend && (
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-teal-200 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{currentStep.boardHighlightLegend}</span>
              </div>
            )}

            {/* Micro-Área Interactiva para Experimentar la Mecánica */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs tabular-nums">
              {currentStep.interactiveType === 'LEGITIMACY_DEMO' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-300">
                    <span>{tut.legitimacyGoal} </span>
                    <strong className="text-amber-300">
                      {state.players.length * 10} {t.common.legitimacy}
                    </strong>
                    <span className="text-slate-400"> · {tut.simulatedLbl} </span>
                    <strong className="text-teal-300">+{demoLegitimacy} pts</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.voiceSuccess();
                      setDemoLegitimacy(prev => prev + 2);
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>{tut.simDonationBtn}</span>
                  </button>
                </div>
              )}

              {currentStep.interactiveType === 'GOODS_STATES' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{tut.stateLbl}</span>
                    {demoStateIndex === 0 && (
                      <span className="text-xs font-bold text-rose-300">
                        {tut.statePrivateDesc}
                      </span>
                    )}
                    {demoStateIndex === 1 && (
                      <span className="text-xs font-bold text-sky-300">
                        {tut.statePublicDesc}
                      </span>
                    )}
                    {demoStateIndex === 2 && (
                      <span className="text-xs font-bold text-emerald-300">
                        {tut.stateCommonDesc}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSound.uiClick();
                      setDemoStateIndex(prev => (prev + 1) % 3);
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    {tut.transformStateBtn}
                  </button>
                </div>
              )}

              {currentStep.interactiveType === 'SKILL_DISCOUNT' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-300">
                    <span>{tut.skillRegenLbl} </span>
                    <strong className="text-teal-300">{demoSkillPoints} pts</strong>
                    <span className="text-slate-400"> → {tut.parkCostBase} </span>
                    <strong className="text-emerald-300">
                      {Math.max(1, 4 - demoSkillPoints)} {t.common.wellness}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playSound.uiClick();
                        setDemoSkillPoints(prev => Math.max(0, prev - 1));
                      }}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-mono text-xs font-bold"
                      aria-label={tut.reduceSkillAria}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSound.uiClick();
                        setDemoSkillPoints(prev => Math.min(3, prev + 1));
                      }}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-mono text-xs font-bold"
                      aria-label={tut.increaseSkillAria}
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
                    <span>{tut.keyRoll}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-[10px] font-mono font-bold text-amber-300">
                      D
                    </kbd>
                    <span>{tut.keyCommunize}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                      P
                    </kbd>
                    <span>{tut.keyPass}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-pink-950 border border-pink-500/50 text-[10px] font-mono font-bold text-pink-300">
                      A
                    </kbd>
                    <span>{tut.keyAgora}</span>
                  </div>
                </div>
              )}

              {currentStep.interactiveType === 'BAILOUT_SIM' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-300">
                    {demoBailoutDone ? (
                      <span className="text-emerald-300 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {tut.rescuedMsg}
                      </span>
                    ) : (
                      <span>{tut.detainedMsg}</span>
                    )}
                  </div>
                  {!demoBailoutDone ? (
                    <button
                      type="button"
                      onClick={() => {
                        playSound.voiceSuccess();
                        setDemoBailoutDone(true);
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <HeartHandshake className="w-3.5 h-3.5" />
                      <span>{tut.payBailBtn}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDemoBailoutDone(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                    >
                      {tut.resetTestBtn}
                    </button>
                  )}
                </div>
              )}

              {currentStep.interactiveType === 'AGORA_CELEBRATION' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="text-[11px] text-pink-300 font-semibold">
                    {tut.agoraReadyMsg}
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerCelebration}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-200" />
                    <span>{celebrationFired ? tut.longLiveCommons : tut.simInsurrectionBtn}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-300 flex items-start gap-2">
              <span className="font-bold text-teal-400 shrink-0">{tut.tipPrefix}</span>
              <span>{currentStep.tip}</span>
            </div>
          </div>

          {/* PIE DE PROGRESO Y OPCIONES */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              {onboardingSteps.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setCurrentStepIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-teal-400'
                      : idx < currentStepIndex
                      ? 'w-3 bg-teal-700'
                      : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                  }`}
                  title={`${step.number}: ${step.title}`}
                  aria-label={formatTemplate(tut.goToStepAria, { num: idx + 1 })}
                />
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 accent-teal-500"
              />
              <span>{tut.dontShowStartupChk}</span>
            </label>
          </div>

          {/* BOTONES DE NAVEGACIÓN */}
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkipCompletely}
                className="min-h-[40px] text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2"
              >
                {tut.skipTutorialBtn}
              </button>
              {state.round <= 2 && (
                <button
                  type="button"
                  onClick={handleMinimizeToCoach}
                  className="min-h-[40px] text-[11px] font-semibold text-teal-300 hover:text-teal-200 transition-colors px-2"
                >
                  {tut.tryLiveBtn}
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
                  <span>{tut.prevBtn}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>
                  {currentStepIndex === onboardingSteps.length - 1
                    ? state.round <= 2
                      ? tut.playShortGuideBtn
                      : tut.gotItPlayBtn
                    : tut.nextStepBtn}
                </span>
                {currentStepIndex === onboardingSteps.length - 1 ? (
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
