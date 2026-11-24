/**
 * useKeyboardShortcuts.ts
 * Gestor global de atajos de teclado para Commonspoly.
 * Centraliza acciones de turno, navegación de cámara, audio, paneles HUD
 * y cierre jerárquico de modales con 'Esc' respetando campos de texto activos.
 */

import { useEffect } from 'react';
import { GameEngineState } from '../types/game';
import { playSound } from '../utils/audio';
import { getEffectiveUnlockCost } from '../utils/crisisEngine';

export interface KeyboardShortcutItem {
  keys: string[];
  label: string;
  description: string;
  category: 'TURN' | 'MODALS' | 'VIEW';
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcutItem[] = [
  {
    keys: ['R'],
    label: 'Lanzar Dado 3D',
    description: 'Tira el dado al inicio de tu turno humano.',
    category: 'TURN'
  },
  {
    keys: ['Espacio'],
    label: 'Lanzar Dado (alternativo)',
    description: 'Atajo rápido equivalente a R cuando no hay modales activos.',
    category: 'TURN'
  },
  {
    keys: ['D'],
    label: 'Desbloquear / Comunizar',
    description: 'Transforma la casilla actual de Privado a Público o de Público a Común.',
    category: 'TURN'
  },
  {
    keys: ['P'],
    label: 'Pasar Turno',
    description: 'Finaliza la decisión en la casilla actual (suma +1/+1 si es Pública).',
    category: 'TURN'
  },
  {
    keys: ['A'],
    label: 'Entrar al Ágora',
    description: 'Accede al Ágora Central cuando la Legitimidad Colectiva es suficiente.',
    category: 'TURN'
  },
  {
    keys: ['Esc'],
    label: 'Cerrar Modal / Panel',
    description: 'Cierra el modal, carta, tutorial, historial o menú superior activo.',
    category: 'MODALS'
  },
  {
    keys: ['Enter'],
    label: 'Confirmar Carta',
    description: 'Aplica y cierra la Carta Global o Carta de Situación visible.',
    category: 'MODALS'
  },
  {
    keys: ['?'],
    label: 'Atajos de Teclado',
    description: 'Abre o cierra esta guía de accesos rápidos en cualquier momento.',
    category: 'MODALS'
  },
  {
    keys: ['G'],
    label: 'Chat y Timeline',
    description: 'Abre o cierra la barra lateral de chat y timeline cronológico de hitos de la partida.',
    category: 'MODALS'
  },
  {
    keys: ['T'],
    label: 'Tutorial Interactivo',
    description: 'Abre o cierra el tutorial interactivo de onboarding.',
    category: 'MODALS'
  },
  {
    keys: ['V'],
    label: 'Evolución D3',
    description: 'Muestra el gráfico dinámico de bienes comunes vs privatizados por turno.',
    category: 'VIEW'
  },
  {
    keys: ['C'],
    label: 'Modo Cine (Repetición)',
    description: 'Reproduce automáticamente los últimos turnos guardados para analizar tus decisiones.',
    category: 'VIEW'
  },
  {
    keys: ['L'],
    label: 'Logros Locales',
    description: 'Abre o cierra la galería de logros cooperativos locales.',
    category: 'MODALS'
  },
  {
    keys: ['B'],
    label: 'Manual de Reglas',
    description: 'Abre o cierra la guía oficial de Commonspoly.',
    category: 'MODALS'
  },
  {
    keys: ['1', '2', '3'],
    label: 'Modos de Cámara 3D',
    description: '1: Isométrica · 2: Cenital · 3: Seguimiento al personaje activo.',
    category: 'VIEW'
  },
  {
    keys: ['M'],
    label: 'Silenciar / Activar Audio',
    description: 'Alterna efectos sonoros y paisaje ambiental.',
    category: 'VIEW'
  },
  {
    keys: ['H'],
    label: 'Mostrar / Ocultar Controles',
    description: 'Colapsa o expande el dock inferior de acciones.',
    category: 'VIEW'
  },
  {
    keys: ['F'],
    label: 'Monitor de Rendimiento (FPS / RAM)',
    description: 'Muestra u oculta el panel en vivo de FPS, memoria JS Heap, draw calls y frustum culling.',
    category: 'VIEW'
  },
  {
    keys: ['E'],
    label: 'Debug Economía y Especulación',
    description: 'Abre o cierra el panel de probabilidades especulativas e impacto económico de casillas.',
    category: 'VIEW'
  }
];

interface UseKeyboardShortcutsOptions {
  state: GameEngineState;
  isShortcutsOpen: boolean;
  isRulesOpen: boolean;
  isAchievementsOpen?: boolean;
  isLeaderboardOpen?: boolean;
  isWeatherSettingsOpen?: boolean;
  isCareerStatsOpen?: boolean;
  isAccessibilityOpen?: boolean;
  isMultiplayerOpen?: boolean;
  isRemoteMultiplayerTurn?: boolean;
  isTutorialOpen: boolean;
  isGameHistoryOpen: boolean;
  isEvolutionOpen?: boolean;
  isPerformanceMonitorOpen?: boolean;
  isEconomyDebugOpen?: boolean;
  isCinemaMode?: boolean;
  isTileInspectorOpen?: boolean;
  showGameOverSummary: boolean;
  onRollDice: () => void;
  onUnlockTile: () => void;
  onPassTile: () => void;
  onTryEnterAgora: () => void;
  onAcknowledgeGlobalCard: () => void;
  onResolveSituationCard?: () => void;
  onCloseActiveModal: () => void;
  onSetCameraMode: (mode: 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW') => void;
  onToggleSound: () => void;
  onToggleDock: () => void;
  onToggleGameHistory: () => void;
  onCloseGameHistory: () => void;
  onToggleEvolution?: () => void;
  onCloseEvolution?: () => void;
  onTogglePerformanceMonitor?: () => void;
  onClosePerformanceMonitor?: () => void;
  onToggleEconomyDebug?: () => void;
  onCloseEconomyDebug?: () => void;
  onCloseTileInspector?: () => void;
  onToggleRules: () => void;
  onCloseRules: () => void;
  onToggleAchievements?: () => void;
  onCloseAchievements?: () => void;
  onCloseLeaderboard?: () => void;
  onCloseWeatherSettings?: () => void;
  onCloseCareerStats?: () => void;
  onCloseAccessibility?: () => void;
  onCloseMultiplayer?: () => void;
  onToggleShortcuts: () => void;
  onCloseShortcuts: () => void;
  onCloseGameOverSummary: () => void;
  onToggleTutorial?: () => void;
  onToggleCinemaMode?: () => void;
  onCloseCinemaMode?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

export function useKeyboardShortcuts({
  state,
  isShortcutsOpen,
  isRulesOpen,
  isAchievementsOpen = false,
  isLeaderboardOpen = false,
  isWeatherSettingsOpen = false,
  isCareerStatsOpen = false,
  isAccessibilityOpen = false,
  isMultiplayerOpen = false,
  isRemoteMultiplayerTurn = false,
  isTutorialOpen,
  isGameHistoryOpen,
  isEvolutionOpen = false,
  isPerformanceMonitorOpen = false,
  isEconomyDebugOpen = false,
  isCinemaMode = false,
  isTileInspectorOpen = false,
  showGameOverSummary,
  onRollDice,
  onUnlockTile,
  onPassTile,
  onTryEnterAgora,
  onAcknowledgeGlobalCard,
  onResolveSituationCard,
  onCloseActiveModal,
  onSetCameraMode,
  onToggleSound,
  onToggleDock,
  onToggleGameHistory,
  onCloseGameHistory,
  onToggleEvolution,
  onCloseEvolution,
  onTogglePerformanceMonitor,
  onClosePerformanceMonitor,
  onToggleEconomyDebug,
  onCloseEconomyDebug,
  onCloseTileInspector,
  onToggleRules,
  onCloseRules,
  onToggleAchievements,
  onCloseAchievements,
  onCloseLeaderboard,
  onCloseWeatherSettings,
  onCloseCareerStats,
  onCloseAccessibility,
  onCloseMultiplayer,
  onToggleShortcuts,
  onCloseShortcuts,
  onCloseGameOverSummary,
  onToggleTutorial,
  onToggleCinemaMode,
  onCloseCinemaMode
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Nunca interceptar atajos del sistema / navegador (Ctrl, Cmd, Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const activeEl = document.activeElement;
      const isEditingText = isEditableTarget(e.target) || isEditableTarget(activeEl);

      // 1. TECLA ESCAPE: prioridad jerárquica estricta (solo cierra la capa superior)
      if (e.key === 'Escape') {
        // Si está escribiendo en un input (chat o buscador), primero quitar foco del campo
        if (isEditingText && activeEl instanceof HTMLElement) {
          e.preventDefault();
          activeEl.blur();
          return;
        }

        if (isShortcutsOpen) {
          e.preventDefault();
          playSound.modalClose();
          onCloseShortcuts();
          return;
        }

        if (isCinemaMode && onCloseCinemaMode) {
          e.preventDefault();
          playSound.modalClose();
          onCloseCinemaMode();
          return;
        }

        if (isRulesOpen) {
          e.preventDefault();
          playSound.modalClose();
          onCloseRules();
          return;
        }

        if (isAchievementsOpen && onCloseAchievements) {
          e.preventDefault();
          playSound.modalClose();
          onCloseAchievements();
          return;
        }

        if (isLeaderboardOpen && onCloseLeaderboard) {
          e.preventDefault();
          playSound.modalClose();
          onCloseLeaderboard();
          return;
        }

        if (isWeatherSettingsOpen && onCloseWeatherSettings) {
          e.preventDefault();
          playSound.modalClose();
          onCloseWeatherSettings();
          return;
        }

        if (isCareerStatsOpen && onCloseCareerStats) {
          e.preventDefault();
          playSound.modalClose();
          onCloseCareerStats();
          return;
        }

        if (isAccessibilityOpen && onCloseAccessibility) {
          e.preventDefault();
          playSound.modalClose();
          onCloseAccessibility();
          return;
        }

        if (isMultiplayerOpen && onCloseMultiplayer) {
          e.preventDefault();
          playSound.modalClose();
          onCloseMultiplayer();
          return;
        }

        // TutorialOverlay gestiona su propio cierre con Esc cuando está arriba
        if (isTutorialOpen) {
          return;
        }

        if (state.phase === 'GAME_OVER' && showGameOverSummary) {
          e.preventDefault();
          playSound.modalClose();
          onCloseGameOverSummary();
          return;
        }

        if (state.activeModal === 'SITUATION_CARD') {
          e.preventDefault();
          (onResolveSituationCard ?? onCloseActiveModal)();
          return;
        }

        if (
          state.activeModal === 'DETENTION_RESCUE' ||
          state.activeModal === 'BUREAUCRACY' ||
          state.activeModal === 'CROWDFUNDING'
        ) {
          e.preventDefault();
          onCloseActiveModal();
          return;
        }

        if (state.activeModal === 'GLOBAL_CARD') {
          e.preventDefault();
          onAcknowledgeGlobalCard();
          return;
        }

        if (isTileInspectorOpen && onCloseTileInspector) {
          e.preventDefault();
          playSound.uiClick();
          onCloseTileInspector();
          return;
        }

        if (isEvolutionOpen && onCloseEvolution) {
          e.preventDefault();
          playSound.modalClose();
          onCloseEvolution();
          return;
        }

        if (isPerformanceMonitorOpen && onClosePerformanceMonitor) {
          e.preventDefault();
          playSound.modalClose();
          onClosePerformanceMonitor();
          return;
        }

        if (isEconomyDebugOpen && onCloseEconomyDebug) {
          e.preventDefault();
          playSound.modalClose();
          onCloseEconomyDebug();
          return;
        }

        if (isGameHistoryOpen) {
          e.preventDefault();
          playSound.modalClose();
          onCloseGameHistory();
          return;
        }

        return;
      }

      // Respetar campos de texto / búsqueda / chat para cualquier otra tecla
      if (isEditingText) return;

      // 2. GUÍA DE ATAJOS ('?' o F1) disponible en cualquier fase
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        playSound.uiToggle(!isShortcutsOpen);
        onToggleShortcuts();
        return;
      }

      // 3. CONFIRMACIÓN CON ENTER EN CARTAS INFORMATIVAS (si no hay foco en otro botón)
      if (e.key === 'Enter' && !isShortcutsOpen && !isRulesOpen && !isAchievementsOpen && !isTutorialOpen) {
        const focusedButton = activeEl instanceof HTMLButtonElement;
        if (!focusedButton) {
          if (state.activeModal === 'GLOBAL_CARD') {
            e.preventDefault();
            onAcknowledgeGlobalCard();
            return;
          }
          if (state.activeModal === 'SITUATION_CARD') {
            e.preventDefault();
            (onResolveSituationCard ?? onCloseActiveModal)();
            return;
          }
        }
      }

      // Atajos de partida solo aplican durante juego activo
      const isPlaying =
        state.phase !== 'TITLE' &&
        state.phase !== 'SETUP' &&
        state.phase !== 'GAME_OVER';

      if (!isPlaying) return;

      const keyLower = e.key.toLowerCase();

      // 4. UTILIDADES GLOBALES DE PARTIDA (cuando no hay modal de diálogo bloqueante)
      const hasBlockingOverlay =
        isShortcutsOpen ||
        isRulesOpen ||
        isAchievementsOpen ||
        isLeaderboardOpen ||
        isWeatherSettingsOpen ||
        isCareerStatsOpen ||
        isAccessibilityOpen ||
        isMultiplayerOpen ||
        isTutorialOpen ||
        Boolean(state.activeModal);

      if (keyLower === 'c' && onToggleCinemaMode && !hasBlockingOverlay) {
        e.preventDefault();
        onToggleCinemaMode();
        return;
      }

      if (isCinemaMode) return;

      if (keyLower === 'b' && !isShortcutsOpen && !isAchievementsOpen && !isTutorialOpen && !state.activeModal) {
        e.preventDefault();
        if (isRulesOpen) {
          playSound.modalClose();
        } else {
          playSound.modalOpen();
        }
        onToggleRules();
        return;
      }

      if (keyLower === 'l' && onToggleAchievements && !isShortcutsOpen && !isRulesOpen && !isTutorialOpen && !state.activeModal) {
        e.preventDefault();
        if (isAchievementsOpen) {
          playSound.modalClose();
        } else {
          playSound.modalOpen();
        }
        onToggleAchievements();
        return;
      }

      if (keyLower === 't' && onToggleTutorial && !isShortcutsOpen && !isRulesOpen && !isAchievementsOpen && !state.activeModal) {
        e.preventDefault();
        onToggleTutorial();
        return;
      }

      if (hasBlockingOverlay) return;

      // Paneles y audio
      if (keyLower === 'g') {
        e.preventDefault();
        playSound.uiToggle(!isGameHistoryOpen);
        onToggleGameHistory();
        return;
      }

      if (keyLower === 'v' && onToggleEvolution) {
        e.preventDefault();
        playSound.uiToggle(!isEvolutionOpen);
        onToggleEvolution();
        return;
      }

      if (keyLower === 'f' && onTogglePerformanceMonitor) {
        e.preventDefault();
        playSound.uiToggle(!isPerformanceMonitorOpen);
        onTogglePerformanceMonitor();
        return;
      }

      if (keyLower === 'e' && onToggleEconomyDebug) {
        e.preventDefault();
        playSound.uiToggle(!isEconomyDebugOpen);
        onToggleEconomyDebug();
        return;
      }

      if (keyLower === 'm') {
        e.preventDefault();
        onToggleSound();
        return;
      }

      if (keyLower === 'h') {
        e.preventDefault();
        onToggleDock();
        return;
      }

      // Modos de cámara 3D
      if (e.key === '1') {
        e.preventDefault();
        onSetCameraMode('ISOMETRIC');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        onSetCameraMode('TOP_DOWN');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        onSetCameraMode('FOLLOW');
        return;
      }

      // 5. ACCIONES DE TURNO HUMANO (ignorar repetición al mantener pulsada la tecla)
      if (e.repeat) return;

      const activePlayer = state.players[state.activePlayerIndex];
      const isHumanTurn = activePlayer?.controller === 'HUMAN';
      if (!isHumanTurn || isRemoteMultiplayerTurn) return;

      // 'R' o 'Espacio' para lanzar dado
      if (
        (keyLower === 'r' || e.code === 'Space') &&
        state.phase === 'PLAYER_TURN_READY'
      ) {
        // Evitar doble disparo si el usuario tiene el foco en otro botón distinto al de tirar dado
        if (e.code === 'Space' && activeEl instanceof HTMLButtonElement) {
          return;
        }
        e.preventDefault();
        onRollDice();
        return;
      }

      // 'A' para entrar al Ágora Central
      if (keyLower === 'a' && state.phase === 'PLAYER_TURN_READY') {
        const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
        const requiredLegitimacy = state.players.length * 10;
        if (totalLegitimacy >= requiredLegitimacy && !activePlayer.inAgora) {
          e.preventDefault();
          onTryEnterAgora();
        }
        return;
      }

      // 'D' para desbloquear / comunizar casilla actual
      if (keyLower === 'd' && state.phase === 'TILE_ACTION_DECISION') {
        const currentTile = state.tiles.find(t => t.id === activePlayer.position);
        if (
          currentTile &&
          (currentTile.category === 'RESOURCE' || currentTile.category === 'AGORA_ENTRY') &&
          (currentTile.state === 'PRIVATE' || currentTile.state === 'PUBLIC')
        ) {
          const costInfo = getEffectiveUnlockCost(
            currentTile,
            activePlayer,
            state.activeCrisis,
            state.activeWeatherEvent
          );
          if (activePlayer.wellness >= costInfo.effectiveCost) {
            e.preventDefault();
            onUnlockTile();
          }
        }
        return;
      }

      // 'P' para pasar turno
      if (keyLower === 'p' && state.phase === 'TILE_ACTION_DECISION') {
        e.preventDefault();
        onPassTile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state,
    isShortcutsOpen,
    isRulesOpen,
    isAchievementsOpen,
    isLeaderboardOpen,
    isWeatherSettingsOpen,
    isCareerStatsOpen,
    isAccessibilityOpen,
    isMultiplayerOpen,
    isRemoteMultiplayerTurn,
    isTutorialOpen,
    isGameHistoryOpen,
    isEvolutionOpen,
    isPerformanceMonitorOpen,
    isEconomyDebugOpen,
    isCinemaMode,
    isTileInspectorOpen,
    showGameOverSummary,
    onRollDice,
    onUnlockTile,
    onPassTile,
    onTryEnterAgora,
    onAcknowledgeGlobalCard,
    onResolveSituationCard,
    onCloseActiveModal,
    onSetCameraMode,
    onToggleSound,
    onToggleDock,
    onToggleGameHistory,
    onCloseGameHistory,
    onToggleEvolution,
    onCloseEvolution,
    onTogglePerformanceMonitor,
    onClosePerformanceMonitor,
    onToggleEconomyDebug,
    onCloseEconomyDebug,
    onCloseTileInspector,
    onToggleRules,
    onCloseRules,
    onToggleAchievements,
    onCloseAchievements,
    onCloseLeaderboard,
    onCloseWeatherSettings,
    onCloseCareerStats,
    onCloseAccessibility,
    onCloseMultiplayer,
    onToggleShortcuts,
    onCloseShortcuts,
    onCloseGameOverSummary,
    onToggleTutorial,
    onToggleCinemaMode,
    onCloseCinemaMode
  ]);
}
