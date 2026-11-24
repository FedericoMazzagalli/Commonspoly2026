/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useCommonspolyGame } from './store/gameEngine';
import { CommonspolyBoard3D } from './components/board3d/CommonspolyBoard3D';
import { TitleScreen } from './components/TitleScreen';
import type { CinemaCameraMode } from './components/hud/CinemaReplayHUD';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  CooperativeChatMessage,
  GameEngineState,
  GoodType,
  RulesetMode,
  SetupInitialRolls,
  Tile,
  TutorialBoardFocus
} from './types/game';
import { playSound } from './utils/audio';
import { resolveWeather } from './utils/weather';
import { computeCooperativeEfficiency } from './utils/cooperativeEfficiency';
import { hydrateBoardFromReplayFrame } from './utils/replay';
import { DEFAULT_WEATHER_ADVANCED_CONFIG } from './utils/weatherSettings';
import {
  computeSpeculatorDangerHeatmap,
  computeSpeculatorTrajectories
} from './utils/economyDebugMetrics';
import {
  CareerMatchStats,
  loadCareerStats,
  recordCompletedMatchStats,
  resetCareerStats
} from './utils/matchHistoryStats';
import {
  BoardPerformanceTelemetry,
  createInitialBoardTelemetry
} from './utils/performanceTelemetry';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from './firebase';
import {
  buildLeaderboardSnapshotFromMatch,
  fetchGlobalLeaderboardOnce,
  LeaderboardEntry,
  LeaderboardSubmissionStatus,
  loadLocalBestRecord,
  LocalBestRecord,
  saveLocalBestRecordIfBetter,
  submitPersonalBestToLeaderboard,
  subscribeGlobalLeaderboard
} from './utils/leaderboard';
import {
  AccessibilitySettings,
  applyAccessibilityDocumentAttributes,
  getAccessibilityPalette,
  loadAccessibilitySettings,
  saveAccessibilitySettings
} from './utils/accessibility';
import {
  DailyChallengeEntry,
  fetchDailyLeaderboardOnce,
  getDailyChallengeConfig,
  loadLocalDailyResult,
  saveLocalDailyResult,
  submitDailyChallengeScore,
  subscribeDailyLeaderboard
} from './utils/dailyChallenge';
import {
  buildSetupRollsForDifficulty,
  createMultiplayerRoom,
  fetchMultiplayerRoomById,
  joinMultiplayerRoomByCode,
  joinMultiplayerRoomById,
  launchRoomMatchByHost,
  leaveMultiplayerRoom,
  loadSavedActiveRoomId,
  markRoomActionProcessed,
  MultiplayerRoom,
  rehydrateCharactersFromRoom,
  saveActiveRoomId,
  serializePlayersSummary,
  serializeSpeculatorsSummary,
  serializeTilesToArray,
  submitRoomActionIntent,
  subscribeToPendingRoomActions,
  subscribeToRoom,
  syncHostGameStateToRoom,
  tileArrayToStateMap,
  updateRoomMemberSelection
} from './utils/multiplayerRooms';
import { OFFICIAL_CHARACTERS } from './data/characters';
import { useOnlineStatus } from './hooks/usePWAInstall';

const SetupWizard = lazy(() =>
  import('./components/SetupWizard').then(m => ({ default: m.SetupWizard }))
);
const GameOverlayHUD = lazy(() =>
  import('./components/hud/GameOverlayHUD').then(m => ({ default: m.GameOverlayHUD }))
);
const TileInspectorHUD = lazy(() =>
  import('./components/hud/TileInspectorHUD').then(m => ({ default: m.TileInspectorHUD }))
);
const GameOverCinematicOverlay = lazy(() =>
  import('./components/hud/GameOverCinematicOverlay').then(m => ({
    default: m.GameOverCinematicOverlay
  }))
);
const GlobalCardModal = lazy(() =>
  import('./components/modals/GlobalCardModal').then(m => ({ default: m.GlobalCardModal }))
);
const SituationCardModal = lazy(() =>
  import('./components/modals/SituationCardModal').then(m => ({ default: m.SituationCardModal }))
);
const AgoraInsurrectionModal = lazy(() =>
  import('./components/modals/AgoraInsurrectionModal').then(m => ({
    default: m.AgoraInsurrectionModal
  }))
);
const DetentionRescueModal = lazy(() =>
  import('./components/modals/DetentionRescueModal').then(m => ({ default: m.DetentionRescueModal }))
);
const TragedyVoteModal = lazy(() =>
  import('./components/modals/TragedyVoteModal').then(m => ({ default: m.TragedyVoteModal }))
);
const BureaucracyModal = lazy(() =>
  import('./components/modals/BureaucracyModal').then(m => ({ default: m.BureaucracyModal }))
);
const CrowdfundingModal = lazy(() =>
  import('./components/modals/CrowdfundingModal').then(m => ({ default: m.CrowdfundingModal }))
);
const GameOverModal = lazy(() =>
  import('./components/modals/GameOverModal').then(m => ({ default: m.GameOverModal }))
);
const RulesModal = lazy(() =>
  import('./components/modals/RulesModal').then(m => ({ default: m.RulesModal }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('./components/modals/KeyboardShortcutsModal').then(m => ({
    default: m.KeyboardShortcutsModal
  }))
);
const AchievementsModal = lazy(() =>
  import('./components/modals/AchievementsModal').then(m => ({ default: m.AchievementsModal }))
);
const NeighborhoodDecisionModal = lazy(() =>
  import('./components/modals/NeighborhoodDecisionModal').then(m => ({
    default: m.NeighborhoodDecisionModal
  }))
);
const LeaderboardModal = lazy(() =>
  import('./components/modals/LeaderboardModal').then(m => ({ default: m.LeaderboardModal }))
);
const WeatherSettingsModal = lazy(() =>
  import('./components/modals/WeatherSettingsModal').then(m => ({ default: m.WeatherSettingsModal }))
);
const CareerStatsModal = lazy(() =>
  import('./components/modals/CareerStatsModal').then(m => ({ default: m.CareerStatsModal }))
);
const AccessibilityModal = lazy(() =>
  import('./components/modals/AccessibilityModal').then(m => ({ default: m.AccessibilityModal }))
);
const MultiplayerLobbyModal = lazy(() =>
  import('./components/modals/MultiplayerLobbyModal').then(m => ({
    default: m.MultiplayerLobbyModal
  }))
);
const CinemaReplayHUD = lazy(() =>
  import('./components/hud/CinemaReplayHUD').then(m => ({ default: m.CinemaReplayHUD }))
);

function roomChatsToMessages(
  recentChats: string[],
  players: GameEngineState['players'],
  round: number
): CooperativeChatMessage[] {
  return recentChats.map((line, idx) => {
    const colonIdx = line.indexOf(':');
    const senderName = colonIdx > 0 ? line.slice(0, colonIdx).trim() : 'Comunidad';
    const text = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
    const matched = players.find(p => p.name === senderName);
    return {
      id: `remote_chat_${round}_${idx}_${senderName}`,
      senderName,
      senderColor: matched?.color ?? '#14b8a6',
      controller: matched?.controller ?? 'HUMAN',
      text,
      round,
      timestamp: ''
    };
  });
}

export default function App() {
  const { t } = useTranslation();
  const {
    state,
    savedGameMeta,
    startSetup,
    finalizeSetup,
    rollDiceForCurrentPlayer,
    unlockCurrentTile,
    passCurrentTile,
    passTurnOnTimeout,
    tryEnterAgora,
    stayInAgora,
    executeInsurrectionForCategory,
    acknowledgeGlobalCard,
    resolveSituationCard,
    rescueDetainedPlayer,
    openDetentionRescue,
    resolveTragedyOfCommons,
    executeBureaucracy,
    executeCrowdfunding,
    sendCooperativeChat,
    setCameraMode,
    toggleSound,
    toggleHaptics,
    togglePostProcessing,
    setAmbientMode,
    setWeatherMode,
    setWeatherIntensity,
    setWeatherAdvancedConfig,
    setTimeOfDayMode,
    dismissRecentAchievement,
    resetAchievements,
    closeModal,
    saveGameNow,
    resumeSavedGame,
    pauseToTitle,
    clearSavedGame,
    resetToTitle,
    triggerNeighborhoodDecision,
    castNeighborhoodVote,
    applySandboxMutation,
    simulateDiceRollInSandbox,
    simulateSpeculatorsWaveInSandbox,
    restorePreSandboxState,
    hydrateMultiplayerState,
    canRestoreSandbox
  } = useCommonspolyGame();

  const isOnline = useOnlineStatus();
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>(() =>
    loadAccessibilitySettings()
  );
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);

  const [showRules, setShowRules] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showWeatherSettings, setShowWeatherSettings] = useState(false);
  const [showCareerStats, setShowCareerStats] = useState(false);
  const [careerStats, setCareerStats] = useState<CareerMatchStats>(() => loadCareerStats());
  const [isGameHistoryOpen, setIsGameHistoryOpen] = useState(false);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showEconomyDebug, setShowEconomyDebug] = useState(false);
  const [isSpeculatorHeatmapEnabled, setIsSpeculatorHeatmapEnabled] = useState(true);
  const [isSpeculatorTrajectoriesEnabled, setIsSpeculatorTrajectoriesEnabled] = useState(true);
  const boardTelemetryRef = useRef<BoardPerformanceTelemetry>(createInitialBoardTelemetry());
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [tutorialOpenOverride, setTutorialOpenOverride] = useState<boolean | undefined>(undefined);
  const [isTutorialOverlayVisible, setIsTutorialOverlayVisible] = useState(false);
  const [tutorialBoardFocus, setTutorialBoardFocus] = useState<TutorialBoardFocus>('NONE');
  const [showGameOverSummary, setShowGameOverSummary] = useState(false);
  const [inspectedTileId, setInspectedTileId] = useState<number | null>(null);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [cinemaFrameIndex, setCinemaFrameIndex] = useState(0);
  const [isCinemaPlaying, setIsCinemaPlaying] = useState(false);
  const [cinemaSpeed, setCinemaSpeed] = useState(1);
  const [cinemaCameraMode, setCinemaCameraMode] = useState<CinemaCameraMode>('FOLLOW');

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [localBest, setLocalBest] = useState<LocalBestRecord | null>(() => loadLocalBestRecord());
  const [submissionStatus, setSubmissionStatus] = useState<LeaderboardSubmissionStatus>({
    state: 'IDLE'
  });
  const hasRecordedGameOverRef = useRef(false);

  const dailyConfig = useMemo(() => getDailyChallengeConfig(), []);
  const [dailyEntries, setDailyEntries] = useState<DailyChallengeEntry[]>([]);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [localDailyBest, setLocalDailyBest] = useState<{ efficiencyPct: number; result: string } | null>(
    () => loadLocalDailyResult(dailyConfig.challengeDate)
  );

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoom | null>(null);
  const hostStateVersionRef = useRef<number>(1);
  const lastSyncedFingerprintRef = useRef<string>('');
  const lastHydratedVersionRef = useRef<number>(0);
  const processedActionIdsRef = useRef<Set<string>>(new Set());
  const hasAttemptedRoomRestoreRef = useRef(false);

  useEffect(() => {
    applyAccessibilityDocumentAttributes(accessibilitySettings);
    saveAccessibilitySettings(accessibilitySettings);
  }, [accessibilitySettings]);

  const inspectedTile: Tile | null =
    inspectedTileId !== null
      ? (state.tiles.find(t => t.id === inspectedTileId) ?? null)
      : null;

  const closeAllAppPanels = (except?: 'history' | 'evolution' | 'perf' | 'debug') => {
    if (except !== 'history') setIsGameHistoryOpen(false);
    if (except !== 'evolution') setIsEvolutionOpen(false);
    if (except !== 'perf') setShowPerformanceMonitor(false);
    if (except !== 'debug') setShowEconomyDebug(false);
  };

  const handleToggleGameHistory = () => {
    setIsGameHistoryOpen(prev => {
      const next = !prev;
      if (next) closeAllAppPanels('history');
      return next;
    });
  };

  const handleToggleEvolution = () => {
    setIsEvolutionOpen(prev => {
      const next = !prev;
      if (next) closeAllAppPanels('evolution');
      return next;
    });
  };

  const handleTogglePerformanceMonitor = () => {
    setShowPerformanceMonitor(prev => {
      const next = !prev;
      if (next) closeAllAppPanels('perf');
      return next;
    });
  };

  const handleToggleEconomyDebug = () => {
    setShowEconomyDebug(prev => {
      const next = !prev;
      if (next) closeAllAppPanels('debug');
      return next;
    });
  };

  const replayFrames = state.replayFrames ?? [];
  const activeReplayFrame =
    isCinemaMode && replayFrames.length > 0
      ? (replayFrames[Math.min(cinemaFrameIndex, replayFrames.length - 1)] ?? null)
      : null;

  const cinemaBoardData = useMemo(() => {
    if (!activeReplayFrame) return null;
    return hydrateBoardFromReplayFrame(state, activeReplayFrame);
  }, [activeReplayFrame, state]);

  const speculatorHeatmap = useMemo(() => {
    if (
      !showEconomyDebug ||
      !isSpeculatorHeatmapEnabled ||
      isCinemaMode ||
      state.phase === 'TITLE' ||
      state.phase === 'SETUP' ||
      state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    return computeSpeculatorDangerHeatmap(state);
  }, [
    showEconomyDebug,
    isSpeculatorHeatmapEnabled,
    isCinemaMode,
    state.phase,
    state.tiles,
    state.speculators,
    state.players,
    state.probabilitySandbox
  ]);

  const speculatorTrajectories = useMemo(() => {
    if (
      !showEconomyDebug ||
      !isSpeculatorTrajectoriesEnabled ||
      isCinemaMode ||
      state.phase === 'TITLE' ||
      state.phase === 'SETUP' ||
      state.phase === 'GAME_OVER'
    ) {
      return null;
    }
    return computeSpeculatorTrajectories(state);
  }, [
    showEconomyDebug,
    isSpeculatorTrajectoriesEnabled,
    isCinemaMode,
    state.phase,
    state.tiles,
    state.speculators,
    state.players,
    state.probabilitySandbox
  ]);

  const openCinemaMode = useCallback(() => {
    if (replayFrames.length === 0) return;
    const startIdx = replayFrames.length > 8 ? replayFrames.length - 8 : 0;
    setCinemaFrameIndex(startIdx);
    setIsCinemaPlaying(replayFrames.length > 1);
    setCinemaCameraMode('FOLLOW');
    setInspectedTileId(null);
    setIsGameHistoryOpen(false);
    setIsEvolutionOpen(false);
    setIsCinemaMode(true);
  }, [replayFrames.length]);

  const closeCinemaMode = useCallback(() => {
    setIsCinemaPlaying(false);
    setIsCinemaMode(false);
  }, []);

  const toggleCinemaMode = useCallback(() => {
    if (isCinemaMode) {
      closeCinemaMode();
    } else {
      openCinemaMode();
    }
  }, [isCinemaMode, closeCinemaMode, openCinemaMode]);

  const isRoomHost = Boolean(activeRoom && authUser && activeRoom.hostUid === authUser.uid);
  const isInMultiplayerMatch = Boolean(
    activeRoom && state.multiplayerRoomId && state.multiplayerRoomId === activeRoom.roomId
  );
  const activePlayerForTurn = state.players[state.activePlayerIndex];
  const activePlayerOwnerMember =
    isInMultiplayerMatch && activeRoom
      ? activeRoom.members.find(m => m.characterId === activePlayerForTurn?.id)
      : undefined;
  const isRemoteMultiplayerTurn = Boolean(
    isInMultiplayerMatch &&
      activeRoom &&
      (activePlayerOwnerMember ? activePlayerOwnerMember.uid !== authUser?.uid : !isRoomHost)
  );
  const remoteTurnOwnerName = activePlayerOwnerMember
    ? activePlayerOwnerMember.displayAlias
    : isInMultiplayerMatch && !isRoomHost
    ? t('errors.botHostSuffix', 'Bot (Anfitrión)')
    : null;

  const emitGuestAction = useCallback(
    (actionType: Parameters<typeof submitRoomActionIntent>[4], payloadText = '') => {
      if (!activeRoom || !authUser) return;
      const myMember = activeRoom.members.find(m => m.uid === authUser.uid);
      const alias = myMember?.displayAlias || authUser.displayName || t('errors.activistDefault', 'Activista');
      void submitRoomActionIntent(
        activeRoom.roomId,
        activeRoom.hostUid,
        authUser,
        alias,
        actionType,
        state.round,
        payloadText
      );
    },
    [activeRoom, authUser, state.round]
  );

  const handleActionRollDice = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('ROLL_DICE');
      return;
    }
    rollDiceForCurrentPlayer();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, rollDiceForCurrentPlayer]);

  const handleActionUnlockTile = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('UNLOCK_TILE');
      return;
    }
    unlockCurrentTile();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, unlockCurrentTile]);

  const handleActionPassTile = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('PASS_TILE');
      return;
    }
    passCurrentTile();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, passCurrentTile]);

  const handleActionTryEnterAgora = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('TRY_AGORA');
      return;
    }
    tryEnterAgora();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, tryEnterAgora]);

  const handleActionStayInAgora = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('STAY_AGORA');
      return;
    }
    stayInAgora();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, stayInAgora]);

  const handleActionResolveSituationCard = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('RESOLVE_CARD');
      return;
    }
    resolveSituationCard();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, resolveSituationCard]);

  const handleActionSendChat = useCallback(
    (text: string, votingContext?: string) => {
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('CHAT', text);
      }
      sendCooperativeChat(text, votingContext);
    },
    [isInMultiplayerMatch, isRoomHost, emitGuestAction, sendCooperativeChat]
  );

  const handleActionAcknowledgeGlobalCard = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('ACK_GLOBAL_CARD');
      return;
    }
    acknowledgeGlobalCard();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, acknowledgeGlobalCard]);

  const handleActionAgoraInsurrection = useCallback(
    (category: GoodType) => {
      if (isRemoteMultiplayerTurn) return;
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('AGORA_INSURRECTION', category);
        return;
      }
      executeInsurrectionForCategory(category);
    },
    [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, executeInsurrectionForCategory]
  );

  const handleActionOpenDetentionRescue = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('OPEN_DETENTION_RESCUE');
      return;
    }
    openDetentionRescue();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, openDetentionRescue]);

  const handleActionDetentionRescue = useCallback(
    (rescuerId: string, victimId: string) => {
      if (isRemoteMultiplayerTurn) return;
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('DETENTION_RESCUE', JSON.stringify({ rescuerId, victimId }));
        return;
      }
      rescueDetainedPlayer(rescuerId, victimId);
    },
    [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, rescueDetainedPlayer]
  );

  const handleActionTragedySelect = useCallback(
    (tileIds: number[]) => {
      if (isRemoteMultiplayerTurn) return;
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('TRAGEDY_SELECT', JSON.stringify(tileIds));
        return;
      }
      resolveTragedyOfCommons(tileIds);
    },
    [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, resolveTragedyOfCommons]
  );

  const handleActionBureaucracy = useCallback(
    (tileId: number) => {
      if (isRemoteMultiplayerTurn) return;
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('BUREAUCRACY_TRANSFORM', String(tileId));
        return;
      }
      executeBureaucracy(tileId);
    },
    [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, executeBureaucracy]
  );

  const handleActionCrowdfunding = useCallback(
    (targetPlayerId: string, amount: number) => {
      if (isRemoteMultiplayerTurn) return;
      if (isInMultiplayerMatch && !isRoomHost) {
        emitGuestAction('CROWDFUND_DONATE', JSON.stringify({ targetPlayerId, amount }));
        return;
      }
      executeCrowdfunding(targetPlayerId, amount);
    },
    [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, executeCrowdfunding]
  );

  const handleActionTriggerNeighborhoodDecision = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('OPEN_NEIGHBORHOOD_DECISION');
      return;
    }
    triggerNeighborhoodDecision();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, triggerNeighborhoodDecision]);

  const handleActionCastNeighborhoodVote = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('NEIGHBORHOOD_VOTE');
      return;
    }
    castNeighborhoodVote();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, castNeighborhoodVote]);

  const handleActionCloseModal = useCallback(() => {
    if (isRemoteMultiplayerTurn) return;
    if (isInMultiplayerMatch && !isRoomHost) {
      emitGuestAction('CLOSE_MODAL');
      return;
    }
    closeModal();
  }, [isRemoteMultiplayerTurn, isInMultiplayerMatch, isRoomHost, emitGuestAction, closeModal]);

  // Gestor global de atajos de teclado ('R', 'D', 'P', 'A', '1-3', 'M', 'H', 'G', 'V', 'C', 'L', 'B', '?', 'Esc')
  useKeyboardShortcuts({
    state,
    isShortcutsOpen: showShortcuts,
    isRulesOpen: showRules,
    isAchievementsOpen: showAchievements,
    isLeaderboardOpen: showLeaderboard,
    isWeatherSettingsOpen: showWeatherSettings,
    isCareerStatsOpen: showCareerStats,
    isAccessibilityOpen: showAccessibility,
    isMultiplayerOpen: showMultiplayerLobby,
    isRemoteMultiplayerTurn,
    isTutorialOpen: isTutorialOverlayVisible,
    isGameHistoryOpen,
    isEvolutionOpen,
    isPerformanceMonitorOpen: showPerformanceMonitor,
    isEconomyDebugOpen: showEconomyDebug,
    isCinemaMode,
    isTileInspectorOpen: inspectedTile !== null,
    showGameOverSummary,
    onRollDice: handleActionRollDice,
    onUnlockTile: handleActionUnlockTile,
    onPassTile: handleActionPassTile,
    onTryEnterAgora: handleActionTryEnterAgora,
    onAcknowledgeGlobalCard: handleActionAcknowledgeGlobalCard,
    onResolveSituationCard: handleActionResolveSituationCard,
    onCloseActiveModal: handleActionCloseModal,
    onSetCameraMode: setCameraMode,
    onToggleSound: toggleSound,
    onToggleDock: () => setIsDockCollapsed(prev => !prev),
    onToggleGameHistory: handleToggleGameHistory,
    onCloseGameHistory: () => setIsGameHistoryOpen(false),
    onToggleEvolution: handleToggleEvolution,
    onCloseEvolution: () => setIsEvolutionOpen(false),
    onTogglePerformanceMonitor: handleTogglePerformanceMonitor,
    onClosePerformanceMonitor: () => setShowPerformanceMonitor(false),
    onToggleEconomyDebug: handleToggleEconomyDebug,
    onCloseEconomyDebug: () => setShowEconomyDebug(false),
    onCloseTileInspector: () => setInspectedTileId(null),
    onToggleRules: () => setShowRules(prev => !prev),
    onCloseRules: () => setShowRules(false),
    onToggleAchievements: () => setShowAchievements(prev => !prev),
    onCloseAchievements: () => setShowAchievements(false),
    onCloseLeaderboard: () => setShowLeaderboard(false),
    onCloseWeatherSettings: () => setShowWeatherSettings(false),
    onCloseCareerStats: () => setShowCareerStats(false),
    onCloseAccessibility: () => setShowAccessibility(false),
    onCloseMultiplayer: () => setShowMultiplayerLobby(false),
    onToggleShortcuts: () => setShowShortcuts(prev => !prev),
    onCloseShortcuts: () => setShowShortcuts(false),
    onCloseGameOverSummary: () => setShowGameOverSummary(false),
    onToggleTutorial: () => setTutorialOpenOverride(isTutorialOverlayVisible ? false : true),
    onToggleCinemaMode: toggleCinemaMode,
    onCloseCinemaMode: closeCinemaMode
  });

  const refreshLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const rows = await fetchGlobalLeaderboardOnce(25);
      setLeaderboardEntries(rows);
    } catch (err) {
      setLeaderboardError(err instanceof Error ? err.message : t('errors.appLoadLeaderboard', 'Error al consultar la clasificación.'));
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const refreshDailyLeaderboard = useCallback(async () => {
    setIsDailyLoading(true);
    try {
      const rows = await fetchDailyLeaderboardOnce(dailyConfig.challengeDate, 25);
      setDailyEntries(rows);
    } catch {
      // Silenciar si el usuario está offline
    } finally {
      setIsDailyLoading(false);
    }
  }, [dailyConfig.challengeDate]);

  // Autenticación Firebase + carga inicial del Leaderboard Global y Reto Diario
  useEffect(() => {
    void refreshLeaderboard();
    void refreshDailyLeaderboard();
    const unsubAuth = onAuthStateChanged(auth, user => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, [refreshLeaderboard, refreshDailyLeaderboard]);

  // Suscripción en tiempo real (onSnapshot) solo cuando Auth está listo y el usuario autenticado
  useEffect(() => {
    if (!authReady || !authUser) return;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    const unsubSnapshot = subscribeGlobalLeaderboard(
      entries => {
        setLeaderboardEntries(entries);
        setLeaderboardLoading(false);
        setLeaderboardError(null);
      },
      err => {
        setLeaderboardLoading(false);
        setLeaderboardError(err.message);
      },
      25
    );
    const unsubDaily = subscribeDailyLeaderboard(
      dailyConfig.challengeDate,
      entries => setDailyEntries(entries),
      () => {},
      25
    );
    return () => {
      unsubSnapshot();
      unsubDaily();
    };
  }, [authReady, authUser, dailyConfig.challengeDate]);

  const syncPendingLocalRecord = useCallback(
    async (user: User, record: LocalBestRecord | null) => {
      if (!record || !record.pendingSync) return;
      setSubmissionStatus({ state: 'SUBMITTING' });
      try {
        const res = await submitPersonalBestToLeaderboard(user, record);
        const refreshed = loadLocalBestRecord();
        setLocalBest(refreshed);
        if (res.status === 'CREATED' && res.entry) {
          setSubmissionStatus({ state: 'CREATED', entry: res.entry });
        } else if (res.status === 'UPDATED_RECORD' && res.entry) {
          setSubmissionStatus({
            state: 'UPDATED_RECORD',
            entry: res.entry,
            prevEfficiencyPct: res.prevEfficiencyPct ?? 0
          });
        } else if (res.status === 'NOT_HIGHER') {
          setSubmissionStatus({
            state: 'NOT_HIGHER',
            existingBestPct: res.prevEfficiencyPct ?? 0,
            matchPct: record.efficiencyPct
          });
        }
        await refreshLeaderboard();
      } catch (err) {
        setSubmissionStatus({
          state: 'ERROR',
          message: err instanceof Error ? err.message : t('errors.publishRecord', 'No se pudo publicar el récord.')
        });
      }
    },
    [refreshLeaderboard, t]
  );

  // Al iniciar sesión con Google, sincronizar cualquier récord local pendiente
  useEffect(() => {
    if (authReady && authUser && authUser.emailVerified && localBest?.pendingSync) {
      void syncPendingLocalRecord(authUser, localBest);
    }
  }, [authReady, authUser, localBest, syncPendingLocalRecord]);

  const handleSignInGoogle = useCallback(async () => {
    setIsAuthBusy(true);
    setLeaderboardError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.emailVerified) {
        const currentPending = loadLocalBestRecord();
        if (currentPending?.pendingSync) {
          await syncPendingLocalRecord(cred.user, currentPending);
        }
      }
    } catch (err) {
      setLeaderboardError(
        err instanceof Error ? err.message : t('errors.googleSignIn', 'No se pudo iniciar sesión con Google.')
      );
    } finally {
      setIsAuthBusy(false);
    }
  }, [syncPendingLocalRecord, t]);

  const handleSignOutGoogle = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOut(auth);
      await refreshLeaderboard();
    } catch (err) {
      setLeaderboardError(err instanceof Error ? err.message : t('errors.googleSignOut', 'Error al cerrar sesión.'));
    } finally {
      setIsAuthBusy(false);
    }
  }, [refreshLeaderboard]);

  // Limpiar inspector, tutorial y Modo Cine al volver al título o configuración
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      setInspectedTileId(null);
      setIsEvolutionOpen(false);
      setIsCinemaMode(false);
      setIsCinemaPlaying(false);
      setTutorialOpenOverride(undefined);
      setIsTutorialOverlayVisible(false);
      setTutorialBoardFocus('NONE');
      setShowEconomyDebug(false);
    }
  }, [state.phase]);

  // Al entrar en GAME_OVER, mostrar primero 4.2s de vuelo cinematográfico y partículas antes del modal resumen
  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      setShowGameOverSummary(false);
      setInspectedTileId(null);
      const timer = window.setTimeout(() => {
        setShowGameOverSummary(true);
      }, 4200);
      return () => window.clearTimeout(timer);
    } else {
      setShowGameOverSummary(false);
    }
  }, [state.phase]);

  // Restauración automática de sala multijugador activa tras recargar página
  useEffect(() => {
    if (!authReady || !authUser || activeRoomId || hasAttemptedRoomRestoreRef.current) return;
    hasAttemptedRoomRestoreRef.current = true;
    const savedRoomId = loadSavedActiveRoomId();
    if (!savedRoomId) return;
    void fetchMultiplayerRoomById(savedRoomId).then(room => {
      if (room && room.status !== 'FINISHED' && room.memberUids.includes(authUser.uid)) {
        lastHydratedVersionRef.current = 0;
        hostStateVersionRef.current = room.stateVersion;
        setActiveRoomId(room.roomId);
        setActiveRoom(room);
      } else {
        saveActiveRoomId(null);
      }
    });
  }, [authReady, authUser, activeRoomId]);

  // Suscripción a Sala Multijugador activa en tiempo real
  useEffect(() => {
    if (!authUser || !activeRoomId) return;
    const unsub = subscribeToRoom(
      activeRoomId,
      room => {
        setActiveRoom(room);
        if (room.status === 'FINISHED') {
          saveActiveRoomId(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [authUser, activeRoomId]);

  // Auto-lanzamiento y rehidratación para invitados (y anfitrión tras recarga)
  useEffect(() => {
    if (!activeRoom || !authUser) return;
    const amHost = activeRoom.hostUid === authUser.uid;
    if (activeRoom.status === 'WAITING') return;

    const hydratedPlayers = rehydrateCharactersFromRoom(activeRoom.playersSummary);
    const hydratedModal =
      activeRoom.activeModal && activeRoom.activeModal !== 'NONE'
        ? (activeRoom.activeModal as GameEngineState['activeModal'])
        : null;
    const hydratedChats =
      activeRoom.recentChats.length > 0
        ? roomChatsToMessages(activeRoom.recentChats, hydratedPlayers, activeRoom.round)
        : undefined;

    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      const roster = activeRoom.playersSummary.map(ps => ({
        baseCharId: ps.id,
        controller: ps.controller
      }));
      const rolls = buildSetupRollsForDifficulty(activeRoom.difficulty, activeRoom.rulesetMode);
      lastHydratedVersionRef.current = activeRoom.stateVersion;
      if (amHost) {
        hostStateVersionRef.current = activeRoom.stateVersion;
      }
      finalizeSetup(roster, rolls, {
        multiplayerRoomId: activeRoom.roomId,
        multiplayerRoomCode: activeRoom.roomCode
      });
      hydrateMultiplayerState({
        phase: activeRoom.phase,
        round: activeRoom.round,
        activePlayerIndex: activeRoom.activePlayerIndex,
        currentDiceRoll: activeRoom.currentDiceRoll || null,
        players: hydratedPlayers,
        speculators: activeRoom.speculatorsSummary,
        tileStates: tileArrayToStateMap(activeRoom.tileStates),
        gameResult: activeRoom.gameResult === 'NONE' ? undefined : activeRoom.gameResult,
        gameResultDetails: activeRoom.gameResultDetails,
        multiplayerRoomId: activeRoom.roomId,
        multiplayerRoomCode: activeRoom.roomCode,
        difficulty: activeRoom.difficulty,
        rulesetMode: activeRoom.rulesetMode,
        activeModal: hydratedModal,
        currentGlobalCardId: activeRoom.currentGlobalCardId || null,
        currentSituationCardId: activeRoom.currentSituationCardId || null,
        recentChats: hydratedChats
      });
      setShowMultiplayerLobby(false);
      return;
    }

    if (amHost) return;

    if (
      state.multiplayerRoomId === activeRoom.roomId &&
      activeRoom.stateVersion > lastHydratedVersionRef.current
    ) {
      lastHydratedVersionRef.current = activeRoom.stateVersion;
      hydrateMultiplayerState({
        phase: activeRoom.phase,
        round: activeRoom.round,
        activePlayerIndex: activeRoom.activePlayerIndex,
        currentDiceRoll: activeRoom.currentDiceRoll || null,
        players: hydratedPlayers,
        speculators: activeRoom.speculatorsSummary,
        tileStates: tileArrayToStateMap(activeRoom.tileStates),
        gameResult: activeRoom.gameResult === 'NONE' ? undefined : activeRoom.gameResult,
        gameResultDetails: activeRoom.gameResultDetails,
        multiplayerRoomId: activeRoom.roomId,
        multiplayerRoomCode: activeRoom.roomCode,
        difficulty: activeRoom.difficulty,
        rulesetMode: activeRoom.rulesetMode,
        activeModal: hydratedModal,
        currentGlobalCardId: activeRoom.currentGlobalCardId || null,
        currentSituationCardId: activeRoom.currentSituationCardId || null,
        recentChats: hydratedChats
      });
    }
  }, [activeRoom, authUser, state.phase, state.multiplayerRoomId, finalizeSetup, hydrateMultiplayerState]);

  // Sincronización host-autoritativa hacia Firestore cuando cambia el estado relevante de partida
  useEffect(() => {
    if (
      !isRoomHost ||
      !activeRoom ||
      !state.multiplayerRoomId ||
      state.multiplayerRoomId !== activeRoom.roomId ||
      state.phase === 'TITLE' ||
      state.phase === 'SETUP'
    ) {
      return;
    }

    const fingerprint = JSON.stringify({
      p: state.phase,
      r: state.round,
      a: state.activePlayerIndex,
      d: state.currentDiceRoll ?? 0,
      m: state.activeModal ?? 'NONE',
      gc: state.currentGlobalCard?.id ?? '',
      sc: state.currentSituationCard?.id ?? '',
      ch: (state.chatMessages ?? []).slice(-8).map(c => `${c.senderName}:${c.text}`),
      pl: serializePlayersSummary(state.players),
      sp: serializeSpeculatorsSummary(state.speculators),
      t: serializeTilesToArray(state.tiles),
      g: state.gameResult ?? 'NONE'
    });

    if (fingerprint === lastSyncedFingerprintRef.current) return;
    lastSyncedFingerprintRef.current = fingerprint;

    const timer = window.setTimeout(() => {
      hostStateVersionRef.current += 1;
      void syncHostGameStateToRoom(activeRoom.roomId, state, hostStateVersionRef.current);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [isRoomHost, activeRoom, state]);

  // Cola de intenciones de jugada/chat que recibe el Anfitrión en tiempo real
  useEffect(() => {
    if (
      !isRoomHost ||
      !activeRoom ||
      activeRoom.status !== 'PLAYING' ||
      !state.multiplayerRoomId ||
      state.multiplayerRoomId !== activeRoom.roomId
    ) {
      return;
    }

    const unsub = subscribeToPendingRoomActions(
      activeRoom.roomId,
      activeRoom.hostUid,
      actions => {
        actions.forEach(action => {
          if (processedActionIdsRef.current.has(action.actionId)) return;
          processedActionIdsRef.current.add(action.actionId);
          void markRoomActionProcessed(activeRoom.roomId, action.actionId);

          if (action.actionType === 'CHAT') {
            if (action.uid !== authUser?.uid && action.payloadText) {
              sendCooperativeChat(`${action.displayAlias}: ${action.payloadText}`);
            }
            return;
          }

          const currentOwner = activeRoom.members.find(
            m => m.characterId === state.players[state.activePlayerIndex]?.id
          );
          if (currentOwner && currentOwner.uid !== action.uid) {
            return;
          }

          switch (action.actionType) {
            case 'ROLL_DICE':
              rollDiceForCurrentPlayer();
              break;
            case 'UNLOCK_TILE':
              unlockCurrentTile();
              break;
            case 'PASS_TILE':
              passCurrentTile();
              break;
            case 'TRY_AGORA':
              tryEnterAgora();
              break;
            case 'STAY_AGORA':
              stayInAgora();
              break;
            case 'RESOLVE_CARD':
              resolveSituationCard();
              break;
            case 'ACK_GLOBAL_CARD':
              acknowledgeGlobalCard();
              break;
            case 'AGORA_INSURRECTION': {
              if (
                action.payloadText === 'HEALTH' ||
                action.payloadText === 'URBAN' ||
                action.payloadText === 'KNOWLEDGE' ||
                action.payloadText === 'ENVIRONMENT'
              ) {
                executeInsurrectionForCategory(action.payloadText);
              }
              break;
            }
            case 'OPEN_DETENTION_RESCUE':
              openDetentionRescue();
              break;
            case 'DETENTION_RESCUE':
            case 'RESCUE_PLAYER': {
              try {
                const parsed = JSON.parse(action.payloadText) as {
                  rescuerId?: string;
                  victimId?: string;
                };
                if (typeof parsed.rescuerId === 'string' && typeof parsed.victimId === 'string') {
                  rescueDetainedPlayer(parsed.rescuerId, parsed.victimId);
                }
              } catch {
                // Ignorar payload inválido
              }
              break;
            }
            case 'TRAGEDY_SELECT': {
              try {
                const parsed = JSON.parse(action.payloadText) as unknown;
                if (Array.isArray(parsed)) {
                  const tileIds = parsed.filter(
                    (id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < 40
                  );
                  resolveTragedyOfCommons(tileIds);
                }
              } catch {
                // Ignorar payload inválido
              }
              break;
            }
            case 'BUREAUCRACY_TRANSFORM': {
              const tileId = Number(action.payloadText);
              if (Number.isInteger(tileId) && tileId >= 0 && tileId < 40) {
                executeBureaucracy(tileId);
              }
              break;
            }
            case 'CROWDFUND_DONATE': {
              try {
                const parsed = JSON.parse(action.payloadText) as {
                  targetPlayerId?: string;
                  amount?: number;
                };
                if (
                  typeof parsed.targetPlayerId === 'string' &&
                  typeof parsed.amount === 'number' &&
                  Number.isInteger(parsed.amount) &&
                  parsed.amount >= 1 &&
                  parsed.amount <= 3
                ) {
                  executeCrowdfunding(parsed.targetPlayerId, parsed.amount);
                }
              } catch {
                // Ignorar payload inválido
              }
              break;
            }
            case 'OPEN_NEIGHBORHOOD_DECISION':
              triggerNeighborhoodDecision();
              break;
            case 'NEIGHBORHOOD_VOTE':
              castNeighborhoodVote();
              break;
            case 'CLOSE_MODAL':
              closeModal();
              break;
          }
        });
      },
      () => {}
    );

    return () => unsub();
  }, [
    isRoomHost,
    activeRoom,
    authUser?.uid,
    state.multiplayerRoomId,
    state.players,
    state.activePlayerIndex,
    sendCooperativeChat,
    rollDiceForCurrentPlayer,
    unlockCurrentTile,
    passCurrentTile,
    tryEnterAgora,
    stayInAgora,
    resolveSituationCard,
    acknowledgeGlobalCard,
    executeInsurrectionForCategory,
    openDetentionRescue,
    rescueDetainedPlayer,
    resolveTragedyOfCommons,
    executeBureaucracy,
    executeCrowdfunding,
    triggerNeighborhoodDecision,
    castNeighborhoodVote,
    closeModal
  ]);

  // Acción de partida rápida
  const handleQuickStart = () => {
    try {
      localStorage.removeItem('commonspoly_tutorial_dismissed_v2');
    } catch {
      // Ignorar en navegadores con almacenamiento restringido
    }
    setTutorialOpenOverride(undefined);

    const quickRolls: SetupInitialRolls = {
      health: 3,
      urban: 3,
      knowledge: 4,
      environment: 4,
      totalSum: 14,
      difficulty: 'EN_TRANSICION',
      speculatorsCount: 2
    };

    finalizeSetup(
      [
        { baseCharId: 'carolina', controller: 'HUMAN' },
        { baseCharId: 'chelsea', controller: 'BOT' },
        { baseCharId: 'moha', controller: 'BOT' },
        { baseCharId: 'yayo', controller: 'BOT' }
      ],
      quickRolls
    );
  };

  // Lanzar Reto Diario Determinista por Semilla UTC
  const handleStartDailyChallenge = useCallback(() => {
    try {
      localStorage.removeItem('commonspoly_tutorial_dismissed_v2');
    } catch {
      // Ignorar
    }
    setTutorialOpenOverride(undefined);
    setShowLeaderboard(false);
    finalizeSetup(dailyConfig.roster, dailyConfig.rolls, {
      seedNumber: dailyConfig.seedNumber,
      dailyChallengeDate: dailyConfig.challengeDate
    });
    setWeatherMode(dailyConfig.weatherMode);
  }, [dailyConfig, finalizeSetup, setWeatherMode]);

  const handleCreateMultiplayerRoom = useCallback(
    async (
      alias: string,
      characterId: string,
      difficulty: 'COMUNLANDIA' | 'EN_TRANSICION' | 'MAD_MAX',
      maxPlayers: number,
      isPublic: boolean,
      rulesetMode: RulesetMode = 'EXPANDED'
    ) => {
      if (!authUser) throw new Error(t('errors.signInFirst', 'Inicia sesión con Google primero.'));
      const room = await createMultiplayerRoom(
        authUser,
        alias,
        characterId,
        difficulty,
        maxPlayers,
        isPublic,
        rulesetMode
      );
      processedActionIdsRef.current.clear();
      hostStateVersionRef.current = 1;
      lastSyncedFingerprintRef.current = '';
      lastHydratedVersionRef.current = 1;
      saveActiveRoomId(room.roomId);
      setActiveRoomId(room.roomId);
      setActiveRoom(room);
    },
    [authUser, t]
  );

  const handleJoinRoomByCode = useCallback(
    async (code: string, alias: string, characterId: string) => {
      if (!authUser) throw new Error(t('errors.signInFirst', 'Inicia sesión con Google primero.'));
      const room = await joinMultiplayerRoomByCode(authUser, code, alias, characterId);
      processedActionIdsRef.current.clear();
      lastHydratedVersionRef.current = 0;
      saveActiveRoomId(room.roomId);
      setActiveRoomId(room.roomId);
      setActiveRoom(room);
    },
    [authUser, t]
  );

  const handleJoinRoomById = useCallback(
    async (roomId: string, alias: string, characterId: string) => {
      if (!authUser) throw new Error(t('errors.signInFirst', 'Inicia sesión con Google primero.'));
      const room = await joinMultiplayerRoomById(authUser, roomId, alias, characterId);
      processedActionIdsRef.current.clear();
      lastHydratedVersionRef.current = 0;
      saveActiveRoomId(room.roomId);
      setActiveRoomId(room.roomId);
      setActiveRoom(room);
    },
    [authUser, t]
  );

  const handleUpdateRoomMember = useCallback(
    async (characterId: string, ready: boolean) => {
      if (!activeRoom || !authUser) return;
      await updateRoomMemberSelection(activeRoom, authUser.uid, characterId, ready);
    },
    [activeRoom, authUser]
  );

  const handleLeaveMultiplayerRoom = useCallback(async () => {
    if (activeRoom && authUser) {
      await leaveMultiplayerRoom(activeRoom, authUser.uid);
    }
    saveActiveRoomId(null);
    setActiveRoomId(null);
    setActiveRoom(null);
  }, [activeRoom, authUser]);

  const handleLaunchMultiplayerMatch = useCallback(async () => {
    if (!activeRoom) return;
    const usedIds = new Set(activeRoom.members.map(m => m.characterId));
    const humanRoster = activeRoom.members.map(m => ({
      baseCharId: m.characterId,
      controller: 'HUMAN' as const
    }));
    const botChars = OFFICIAL_CHARACTERS.filter(c => !usedIds.has(c.id)).slice(
      0,
      Math.max(0, 4 - humanRoster.length)
    );
    const fullRoster = [
      ...humanRoster,
      ...botChars.map(c => ({ baseCharId: c.id, controller: 'BOT' as const }))
    ];
    const rolls = buildSetupRollsForDifficulty(activeRoom.difficulty, activeRoom.rulesetMode);
    hostStateVersionRef.current = activeRoom.stateVersion + 1;
    await launchRoomMatchByHost(activeRoom, fullRoster, rolls);
    finalizeSetup(fullRoster, rolls, {
      multiplayerRoomId: activeRoom.roomId,
      multiplayerRoomCode: activeRoom.roomCode
    });
    setShowMultiplayerLobby(false);
  }, [activeRoom, finalizeSetup]);

  const handleExitToTitle = useCallback(() => {
    saveActiveRoomId(null);
    setActiveRoomId(null);
    setActiveRoom(null);
    resetToTitle();
  }, [resetToTitle]);

  const activePlayer = state.players[state.activePlayerIndex];
  const detainedPlayer = state.players.find(p => p.isDetained);
  const cooperativeEfficiency = useMemo(
    () =>
      computeCooperativeEfficiency(
        state.tiles,
        state.playerStats,
        state.round,
        state.gameResult
      ),
    [state.tiles, state.playerStats, state.round, state.gameResult]
  );

  // Registrar puntuación más alta de Eficiencia Cooperativa al finalizar partida (aislando Sandbox)
  useEffect(() => {
    if (state.phase !== 'GAME_OVER' || !state.gameResult) {
      hasRecordedGameOverRef.current = false;
      setSubmissionStatus({ state: 'IDLE' });
      return;
    }

    if (hasRecordedGameOverRef.current) return;
    hasRecordedGameOverRef.current = true;

    // Aislamiento estricto: las sesiones alteradas con el Simulador Sandbox nunca se publican
    if (state.isSandboxSession) {
      setSubmissionStatus({ state: 'IDLE' });
      return;
    }

    const updatedCareer = recordCompletedMatchStats({
      result: state.gameResult,
      round: state.round,
      efficiency: cooperativeEfficiency,
      players: state.players,
      playerStats: state.playerStats,
      setupConfig: state.setupConfig
    });
    setCareerStats(updatedCareer);

    const snapshot = buildLeaderboardSnapshotFromMatch(
      cooperativeEfficiency,
      state.gameResult,
      state.round,
      state.players,
      authUser?.displayName || undefined
    );

    if (state.dailyChallengeDate) {
      saveLocalDailyResult(state.dailyChallengeDate, snapshot.efficiencyPct, state.gameResult);
      setLocalDailyBest(loadLocalDailyResult(state.dailyChallengeDate));
    }

    const canSyncNow = Boolean(authUser && authUser.emailVerified);
    const { record } = saveLocalBestRecordIfBetter(snapshot, !canSyncNow);
    setLocalBest(record);

    if (authUser && authUser.emailVerified) {
      setSubmissionStatus({ state: 'SUBMITTING' });
      const dailyPromise =
        state.dailyChallengeDate && state.seedNumber
          ? submitDailyChallengeScore(
              authUser,
              snapshot,
              state.dailyChallengeDate,
              state.seedNumber
            ).then(() => refreshDailyLeaderboard())
          : Promise.resolve();

      void Promise.all([submitPersonalBestToLeaderboard(authUser, snapshot), dailyPromise])
        .then(([res]) => {
          setLocalBest(loadLocalBestRecord());
          if (res.status === 'CREATED' && res.entry) {
            setSubmissionStatus({ state: 'CREATED', entry: res.entry });
          } else if (res.status === 'UPDATED_RECORD' && res.entry) {
            setSubmissionStatus({
              state: 'UPDATED_RECORD',
              entry: res.entry,
              prevEfficiencyPct: res.prevEfficiencyPct ?? 0
            });
          } else if (res.status === 'NOT_HIGHER') {
            setSubmissionStatus({
              state: 'NOT_HIGHER',
              existingBestPct: res.prevEfficiencyPct ?? 0,
              matchPct: snapshot.efficiencyPct
            });
          }
          return refreshLeaderboard();
        })
        .catch(err => {
          setSubmissionStatus({
            state: 'ERROR',
            message: err instanceof Error ? err.message : t('errors.syncError', 'Error al sincronizar.')
          });
        });
    } else {
      setSubmissionStatus({ state: 'SAVED_LOCAL_PENDING', record });
    }
  }, [
    state.phase,
    state.gameResult,
    state.isSandboxSession,
    state.dailyChallengeDate,
    state.seedNumber,
    state.round,
    state.players,
    state.playerStats,
    state.setupConfig,
    cooperativeEfficiency,
    authUser,
    refreshLeaderboard,
    refreshDailyLeaderboard
  ]);

  const globalTopEntry = leaderboardEntries[0] ?? null;
  const globalUserRank = useMemo(() => {
    if (!authUser) return null;
    const idx = leaderboardEntries.findIndex(e => e.uid === authUser.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboardEntries, authUser]);

  return (
    <MotionConfig reducedMotion={accessibilitySettings.reducedMotionOverride ? 'always' : 'user'}>
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      
      {/* 1. THREE.JS 3D BOARD VIEWPORT (100% full-bleed) */}
      <CommonspolyBoard3D
        tiles={cinemaBoardData ? cinemaBoardData.tiles : state.tiles}
        players={cinemaBoardData ? cinemaBoardData.players : state.players}
        speculators={cinemaBoardData ? cinemaBoardData.speculators : state.speculators}
        activePlayerIndex={
          cinemaBoardData ? cinemaBoardData.activePlayerIndex : state.activePlayerIndex
        }
        currentDiceRoll={
          cinemaBoardData ? cinemaBoardData.currentDiceRoll : state.currentDiceRoll
        }
        cameraMode={isCinemaMode ? cinemaCameraMode : state.cameraMode}
        phase={isCinemaMode ? 'PLAYER_TURN_READY' : state.phase}
        round={cinemaBoardData ? cinemaBoardData.round : state.round}
        gameResult={isCinemaMode ? undefined : state.gameResult}
        cooperativeEfficiency={cooperativeEfficiency.efficiency}
        weatherMode={state.weatherMode}
        weatherIntensity={state.weatherIntensity}
        weatherAdvancedConfig={state.weatherAdvancedConfig}
        activeWeatherEvent={state.activeWeatherEvent}
        timeOfDayMode={state.timeOfDayMode}
        currentGlobalCard={isCinemaMode ? null : state.currentGlobalCard}
        currentSituationCard={isCinemaMode ? null : state.currentSituationCard}
        activeModal={isCinemaMode ? null : state.activeModal}
        neighborhoodDecision={isCinemaMode ? null : state.neighborhoodDecision}
        postProcessingEnabled={state.postProcessingEnabled}
        tutorialFocus={isCinemaMode || state.activeModal ? 'NONE' : tutorialBoardFocus}
        selectedTileId={isCinemaMode ? null : inspectedTileId}
        speculatorHeatmap={speculatorHeatmap}
        speculatorTrajectories={speculatorTrajectories}
        accessibilitySettings={accessibilitySettings}
        telemetryRef={boardTelemetryRef}
        onTileClick={(tile) => {
          if (isCinemaMode) return;
          playSound.uiClick();
          setInspectedTileId(prev => (prev === tile.id ? null : tile.id));
        }}
      />

      {/* 2. TITLE SCREEN VIEW */}
      {state.phase === 'TITLE' && (
        <TitleScreen
          onStartSetup={startSetup}
          onQuickStart={handleQuickStart}
          onOpenRules={() => setShowRules(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenLeaderboard={() => {
            setShowLeaderboard(true);
            void refreshLeaderboard();
            void refreshDailyLeaderboard();
          }}
          onOpenWeatherSettings={() => setShowWeatherSettings(true)}
          onOpenCareerStats={() => setShowCareerStats(true)}
          careerMatchesCount={careerStats.totalMatches}
          careerBestPct={careerStats.totalMatches > 0 ? careerStats.bestEfficiencyPct : null}
          leaderboardTopPct={globalTopEntry?.efficiencyPct ?? null}
          leaderboardCount={leaderboardEntries.length}
          localBestPct={
            authUser && globalUserRank
              ? leaderboardEntries[globalUserRank - 1]?.efficiencyPct ?? localBest?.efficiencyPct ?? null
              : localBest?.efficiencyPct ?? null
          }
          achievementsUnlockedCount={(state.achievements ?? []).filter(a => a.isUnlocked).length}
          achievementsTotalCount={(state.achievements ?? []).length}
          isModalOpen={
            showRules ||
            showShortcuts ||
            showAchievements ||
            showLeaderboard ||
            showWeatherSettings ||
            showCareerStats ||
            showAccessibility ||
            showMultiplayerLobby
          }
          soundEnabled={state.soundEnabled}
          onToggleSound={toggleSound}
          savedGameMeta={savedGameMeta}
          onResumeSavedGame={resumeSavedGame}
          onDeleteSavedGame={clearSavedGame}
          dailyConfig={dailyConfig}
          localDailyBest={localDailyBest}
          onStartDailyChallenge={handleStartDailyChallenge}
          onOpenMultiplayer={() => setShowMultiplayerLobby(true)}
          isOnline={isOnline}
          onOpenAccessibility={() => setShowAccessibility(true)}
          accessibilityModeLabel={getAccessibilityPalette(accessibilitySettings.colorVisionMode).label}
        />
      )}

      <Suspense fallback={null}>
        {/* 3. SETUP WIZARD VIEW */}
        {state.phase === 'SETUP' && (
          <SetupWizard
            onComplete={finalizeSetup}
            onCancel={pauseToTitle}
            onOpenWeatherSettings={() => setShowWeatherSettings(true)}
          />
        )}

      {/* 4. ACTIVE GAMEPLAY HUD OVERLAY */}
      {state.phase !== 'TITLE' && state.phase !== 'SETUP' && state.phase !== 'GAME_OVER' && !isCinemaMode && (
        <>
          <GameOverlayHUD
            state={state}
            isRulesOpen={showRules}
            isShortcutsOpen={showShortcuts}
            isAchievementsOpen={showAchievements}
            isWeatherSettingsOpen={showWeatherSettings}
            isGameHistoryOpen={isGameHistoryOpen}
            isEvolutionOpen={isEvolutionOpen}
            isDockCollapsed={isDockCollapsed}
            onRollDice={handleActionRollDice}
            onUnlockTile={handleActionUnlockTile}
            onPassTile={handleActionPassTile}
            onTurnTimeout={passTurnOnTimeout}
            onTryEnterAgora={handleActionTryEnterAgora}
            onStayInAgora={handleActionStayInAgora}
            onOpenDetentionRescue={handleActionOpenDetentionRescue}
            onTriggerNeighborhoodDecision={handleActionTriggerNeighborhoodDecision}
            onOpenRules={() => setShowRules(true)}
            onOpenShortcuts={() => setShowShortcuts(true)}
            onOpenAchievements={() => setShowAchievements(true)}
            onDismissRecentAchievement={dismissRecentAchievement}
            onToggleGameHistory={handleToggleGameHistory}
            onCloseGameHistory={() => setIsGameHistoryOpen(false)}
            onToggleEvolution={handleToggleEvolution}
            onCloseEvolution={() => setIsEvolutionOpen(false)}
            onToggleDock={() => setIsDockCollapsed(prev => !prev)}
            isTutorialOpen={tutorialOpenOverride}
            onToggleTutorial={() =>
              setTutorialOpenOverride(isTutorialOverlayVisible ? false : true)
            }
            onCloseTutorial={() => setTutorialOpenOverride(undefined)}
            onTutorialVisibilityChange={(visible) => {
              setIsTutorialOverlayVisible(visible);
              if (visible) {
                closeAllAppPanels();
              }
            }}
            onTutorialBoardFocusChange={setTutorialBoardFocus}
            onSetCameraMode={setCameraMode}
            onToggleSound={toggleSound}
            onToggleHaptics={toggleHaptics}
            onTogglePostProcessing={togglePostProcessing}
            onSetAmbientMode={setAmbientMode}
            onSetWeatherMode={setWeatherMode}
            onSetWeatherIntensity={setWeatherIntensity}
            onSetTimeOfDayMode={setTimeOfDayMode}
            onSendCooperativeChat={handleActionSendChat}
            savedGameMeta={savedGameMeta}
            onSaveGame={saveGameNow}
            onPauseToTitle={pauseToTitle}
            onOpenCinemaMode={openCinemaMode}
            replayFramesCount={replayFrames.length}
            onOpenWeatherSettings={() => setShowWeatherSettings(true)}
            boardTelemetryRef={boardTelemetryRef}
            isPerformanceMonitorOpen={showPerformanceMonitor}
            onTogglePerformanceMonitor={handleTogglePerformanceMonitor}
            onClosePerformanceMonitor={() => setShowPerformanceMonitor(false)}
            isEconomyDebugOpen={showEconomyDebug}
            onToggleEconomyDebug={handleToggleEconomyDebug}
            onCloseEconomyDebug={() => setShowEconomyDebug(false)}
            isSpeculatorHeatmapEnabled={isSpeculatorHeatmapEnabled}
            onToggleSpeculatorHeatmap={() => setIsSpeculatorHeatmapEnabled(prev => !prev)}
            isSpeculatorTrajectoriesEnabled={isSpeculatorTrajectoriesEnabled}
            onToggleSpeculatorTrajectories={() =>
              setIsSpeculatorTrajectoriesEnabled(prev => !prev)
            }
            onSelectTileFromDebug={(tileId) => {
              playSound.uiClick();
              setInspectedTileId(prev => (prev === tileId ? null : tileId));
            }}
            accessibilitySettings={accessibilitySettings}
            onOpenAccessibility={() => setShowAccessibility(true)}
            onApplySandboxMutation={applySandboxMutation}
            onSimulateDiceRoll={simulateDiceRollInSandbox}
            onSimulateSpeculatorsTurn={simulateSpeculatorsWaveInSandbox}
            onRestorePreSandbox={restorePreSandboxState}
            canRestoreSandbox={canRestoreSandbox}
            isRemoteMultiplayerTurn={isRemoteMultiplayerTurn}
            remoteTurnOwnerName={remoteTurnOwnerName}
          />
          <TileInspectorHUD
            tile={state.activeModal ? null : inspectedTile}
            players={state.players}
            speculators={state.speculators}
            activeCrisis={state.activeCrisis}
            activeWeatherEvent={state.activeWeatherEvent}
            accessibilitySettings={accessibilitySettings}
            onClose={() => setInspectedTileId(null)}
          />
        </>
      )}

      {/* 5. MODALES INTERACTIVOS */}
      <AnimatePresence mode="wait">
        {/* Carta Global de la Ronda */}
        {state.activeModal === 'GLOBAL_CARD' && (
          <GlobalCardModal
            key="modal-global-card"
            card={state.currentGlobalCard}
            round={state.round}
            onConfirm={handleActionAcknowledgeGlobalCard}
          />
        )}

        {/* Carta de Situación individual */}
        {state.activeModal === 'SITUATION_CARD' && activePlayer && (
          <SituationCardModal
            key="modal-situation-card"
            card={state.currentSituationCard}
            player={activePlayer}
            weather={resolveWeather(
              state.tiles,
              state.weatherMode,
              state.weatherIntensity ?? 0.85,
              state.round,
              state.activePlayerIndex,
              state.activeWeatherEvent
            )}
            onConfirm={handleActionResolveSituationCard}
          />
        )}

        {/* Insurrección Colectiva en el Ágora */}
        {state.activeModal === 'AGORA_INSURRECTION' && (
          <AgoraInsurrectionModal
            key="modal-agora-insurrection"
            tiles={state.tiles}
            onSelectCategory={handleActionAgoraInsurrection}
          />
        )}

        {/* Rescate solidario de Detención */}
        {state.activeModal === 'DETENTION_RESCUE' && detainedPlayer && (
          <DetentionRescueModal
            key="modal-detention-rescue"
            detainedPlayer={detainedPlayer}
            allPlayers={state.players}
            onRescue={handleActionDetentionRescue}
            onDismiss={handleActionCloseModal}
          />
        )}

        {/* Tragedia de los Comunes (Privatización obligatoria de 3) */}
        {state.activeModal === 'TRAGEDY_VOTE' && (
          <TragedyVoteModal
            key="modal-tragedy-vote"
            tiles={state.tiles}
            onConfirmPrivatization={handleActionTragedySelect}
          />
        )}

        {/* Gestión Pública en Burocracia (ID 10) */}
        {state.activeModal === 'BUREAUCRACY' && activePlayer && (
          <BureaucracyModal
            key="modal-bureaucracy"
            player={activePlayer}
            tiles={state.tiles}
            onConfirm={handleActionBureaucracy}
            onPass={handleActionCloseModal}
          />
        )}

        {/* Caja Solidaria / Crowdfunding Barrial (ID 38) */}
        {state.activeModal === 'CROWDFUNDING' && activePlayer && (
          <CrowdfundingModal
            key="modal-crowdfunding"
            donor={activePlayer}
            players={state.players}
            onDonate={handleActionCrowdfunding}
            onPass={handleActionCloseModal}
          />
        )}

        {/* Votación In-Situ para Decisión Barrial */}
        {state.activeModal === 'NEIGHBORHOOD_DECISION' && activePlayer && (
          <NeighborhoodDecisionModal
            key="modal-neighborhood-decision"
            decision={state.neighborhoodDecision}
            activePlayer={activePlayer}
            players={state.players}
            tiles={state.tiles}
            onCastVote={handleActionCastNeighborhoodVote}
            onClose={handleActionCloseModal}
          />
        )}
      </AnimatePresence>

      {/* Fin de Juego: Superposición cinematográfica de partículas + Modal Resumen */}
      {state.phase === 'GAME_OVER' && state.gameResult && !isCinemaMode && (
        <>
          <GameOverCinematicOverlay
            result={state.gameResult}
            tiles={state.tiles}
            round={state.round}
            cooperativeEfficiency={cooperativeEfficiency}
            showSummaryModal={showGameOverSummary}
            onToggleSummary={() => setShowGameOverSummary(prev => !prev)}
          />
          <AnimatePresence>
            {showGameOverSummary && (
              <GameOverModal
                key="modal-game-over"
              result={state.gameResult}
              details={state.gameResultDetails}
              round={state.round}
              tiles={state.tiles}
              players={state.players}
              performanceHistory={state.performanceHistory}
              turnHistory={state.turnHistory}
              playerStats={state.playerStats}
              logs={state.logs}
              cooperativeEfficiency={cooperativeEfficiency}
              leaderboardStatus={submissionStatus}
              globalTopEntry={globalTopEntry}
              globalUserRank={globalUserRank}
              authUser={authUser}
              isAuthBusy={isAuthBusy}
              onOpenLeaderboard={() => {
                playSound.modalOpen();
                setShowLeaderboard(true);
              }}
              onSignInAndPublish={() => void handleSignInGoogle()}
              onInspectBoard={() => {
                playSound.uiClick();
                setShowGameOverSummary(false);
              }}
              onOpenCinemaMode={() => {
                playSound.modalOpen();
                openCinemaMode();
              }}
              replayFramesCount={replayFrames.length}
              careerStats={careerStats}
              onOpenCareerStats={() => {
                playSound.modalOpen();
                setShowCareerStats(true);
              }}
              isSandboxSession={state.isSandboxSession}
              dailyChallengeDate={state.dailyChallengeDate}
              onRestart={handleExitToTitle}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {/* 5B. MODO CINE / REPETICIÓN AUTOMÁTICA DE PARTIDA */}
      {isCinemaMode && replayFrames.length > 0 && (
        <CinemaReplayHUD
          frames={replayFrames}
          currentIndex={cinemaFrameIndex}
          onSelectFrame={setCinemaFrameIndex}
          isPlaying={isCinemaPlaying}
          onSetPlaying={setIsCinemaPlaying}
          playbackSpeed={cinemaSpeed}
          onChangeSpeed={setCinemaSpeed}
          cameraMode={cinemaCameraMode}
          onChangeCameraMode={setCinemaCameraMode}
          tiles={state.tiles}
          onExit={closeCinemaMode}
        />
      )}

      {/* Manual de Reglas */}
      <AnimatePresence>
        {showRules && (
          <RulesModal
            key="modal-rules"
            onClose={() => {
              playSound.modalClose();
              setShowRules(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Guía de Atajos de Teclado Globales */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => {
          playSound.modalClose();
          setShowShortcuts(false);
        }}
      />

      {/* Galería de Logros Locales ('Achievements') */}
      <AchievementsModal
        isOpen={showAchievements}
        achievements={state.achievements ?? []}
        onClose={() => {
          playSound.modalClose();
          setShowAchievements(false);
        }}
        onResetAchievements={resetAchievements}
      />

      {/* Clasificación Global y Reto Diario ('Leaderboard') */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        entries={leaderboardEntries}
        isLoading={leaderboardLoading}
        errorMessage={leaderboardError}
        authUser={authUser}
        isAuthBusy={isAuthBusy}
        localBest={localBest}
        latestMatchEfficiencyPct={
          state.phase === 'GAME_OVER' ? cooperativeEfficiency.efficiencyPct : null
        }
        dailyConfig={dailyConfig}
        dailyEntries={dailyEntries}
        isDailyLoading={isDailyLoading}
        localDailyBestPct={localDailyBest?.efficiencyPct ?? null}
        onStartDailyChallenge={handleStartDailyChallenge}
        onRefreshDaily={() => void refreshDailyLeaderboard()}
        onClose={() => {
          playSound.modalClose();
          setShowLeaderboard(false);
        }}
        onRefresh={() => void refreshLeaderboard()}
        onSignInGoogle={() => void handleSignInGoogle()}
        onSignOut={() => void handleSignOutGoogle()}
        onSyncPendingRecord={
          authUser && localBest?.pendingSync
            ? () => void syncPendingLocalRecord(authUser, localBest)
            : undefined
        }
      />

      {/* Panel de Configuración Avanzada de Clima */}
      <WeatherSettingsModal
        isOpen={showWeatherSettings}
        config={state.weatherAdvancedConfig ?? DEFAULT_WEATHER_ADVANCED_CONFIG}
        weatherMode={state.weatherMode}
        weatherIntensity={state.weatherIntensity ?? 0.85}
        timeOfDayMode={state.timeOfDayMode}
        onUpdateConfig={setWeatherAdvancedConfig}
        onSetWeatherMode={setWeatherMode}
        onSetWeatherIntensity={setWeatherIntensity}
        onSetTimeOfDayMode={setTimeOfDayMode}
        onClose={() => setShowWeatherSettings(false)}
      />

      {/* Estadísticas Acumuladas de Partidas Jugadas */}
      <CareerStatsModal
        isOpen={showCareerStats}
        stats={careerStats}
        onClose={() => setShowCareerStats(false)}
        onResetStats={() => setCareerStats(resetCareerStats())}
      />

      {/* Modal de Accesibilidad y Modos Daltónicos */}
      <AccessibilityModal
        isOpen={showAccessibility}
        settings={accessibilitySettings}
        onUpdateSettings={setAccessibilitySettings}
        onClose={() => setShowAccessibility(false)}
      />

      {/* Lobby de Salas Multijugador Cooperativas Online */}
      <MultiplayerLobbyModal
        isOpen={showMultiplayerLobby}
        authUser={authUser}
        isAuthBusy={isAuthBusy}
        isOnline={isOnline}
        activeRoom={activeRoom}
        onClose={() => setShowMultiplayerLobby(false)}
        onSignInGoogle={() => void handleSignInGoogle()}
        onCreateRoom={handleCreateMultiplayerRoom}
        onJoinByCode={handleJoinRoomByCode}
        onJoinById={handleJoinRoomById}
        onUpdateMember={handleUpdateRoomMember}
        onLeaveRoom={handleLeaveMultiplayerRoom}
        onLaunchMatch={handleLaunchMultiplayerMatch}
      />
      </Suspense>

    </div>
    </MotionConfig>
  );
}
