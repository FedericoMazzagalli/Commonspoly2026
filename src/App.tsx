/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCommonspolyGame } from './store/gameEngine';
import { CommonspolyBoard3D } from './components/board3d/CommonspolyBoard3D';
import { TitleScreen } from './components/TitleScreen';
import { SetupWizard } from './components/SetupWizard';
import { GameOverlayHUD } from './components/hud/GameOverlayHUD';
import { TileInspectorHUD } from './components/hud/TileInspectorHUD';
import { GameOverCinematicOverlay } from './components/hud/GameOverCinematicOverlay';
import { GlobalCardModal } from './components/modals/GlobalCardModal';
import { SituationCardModal } from './components/modals/SituationCardModal';
import { AgoraInsurrectionModal } from './components/modals/AgoraInsurrectionModal';
import { DetentionRescueModal } from './components/modals/DetentionRescueModal';
import { TragedyVoteModal } from './components/modals/TragedyVoteModal';
import { BureaucracyModal } from './components/modals/BureaucracyModal';
import { CrowdfundingModal } from './components/modals/CrowdfundingModal';
import { GameOverModal } from './components/modals/GameOverModal';
import { RulesModal } from './components/modals/RulesModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { AchievementsModal } from './components/modals/AchievementsModal';
import { NeighborhoodDecisionModal } from './components/modals/NeighborhoodDecisionModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SetupInitialRolls, Tile } from './types/game';
import { playSound } from './utils/audio';
import { resolveWeather } from './utils/weather';
import { computeCooperativeEfficiency } from './utils/cooperativeEfficiency';
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

export default function App() {
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
    castNeighborhoodVote
  } = useCommonspolyGame();

  const [showRules, setShowRules] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isGameHistoryOpen, setIsGameHistoryOpen] = useState(false);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showGameOverSummary, setShowGameOverSummary] = useState(false);
  const [inspectedTileId, setInspectedTileId] = useState<number | null>(null);

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

  const inspectedTile: Tile | null =
    inspectedTileId !== null
      ? (state.tiles.find(t => t.id === inspectedTileId) ?? null)
      : null;

  const handleToggleGameHistory = () => {
    setIsGameHistoryOpen(prev => {
      const next = !prev;
      if (next) setIsEvolutionOpen(false);
      return next;
    });
  };

  const handleToggleEvolution = () => {
    setIsEvolutionOpen(prev => {
      const next = !prev;
      if (next) setIsGameHistoryOpen(false);
      return next;
    });
  };

  // Gestor global de atajos de teclado ('R', 'D', 'P', 'A', '1-3', 'M', 'H', 'G', 'V', 'L', 'B', '?', 'Esc')
  useKeyboardShortcuts({
    state,
    isShortcutsOpen: showShortcuts,
    isRulesOpen: showRules,
    isAchievementsOpen: showAchievements,
    isLeaderboardOpen: showLeaderboard,
    isTutorialOpen,
    isGameHistoryOpen,
    isEvolutionOpen,
    isTileInspectorOpen: inspectedTile !== null,
    showGameOverSummary,
    onRollDice: rollDiceForCurrentPlayer,
    onUnlockTile: unlockCurrentTile,
    onPassTile: passCurrentTile,
    onTryEnterAgora: tryEnterAgora,
    onAcknowledgeGlobalCard: acknowledgeGlobalCard,
    onResolveSituationCard: resolveSituationCard,
    onCloseActiveModal: closeModal,
    onSetCameraMode: setCameraMode,
    onToggleSound: toggleSound,
    onToggleDock: () => setIsDockCollapsed(prev => !prev),
    onToggleGameHistory: handleToggleGameHistory,
    onCloseGameHistory: () => setIsGameHistoryOpen(false),
    onToggleEvolution: handleToggleEvolution,
    onCloseEvolution: () => setIsEvolutionOpen(false),
    onCloseTileInspector: () => setInspectedTileId(null),
    onToggleRules: () => setShowRules(prev => !prev),
    onCloseRules: () => setShowRules(false),
    onToggleAchievements: () => setShowAchievements(prev => !prev),
    onCloseAchievements: () => setShowAchievements(false),
    onCloseLeaderboard: () => setShowLeaderboard(false),
    onToggleShortcuts: () => setShowShortcuts(prev => !prev),
    onCloseShortcuts: () => setShowShortcuts(false),
    onCloseGameOverSummary: () => setShowGameOverSummary(false),
    onToggleTutorial: () => setIsTutorialOpen(prev => !prev)
  });

  const refreshLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const rows = await fetchGlobalLeaderboardOnce(25);
      setLeaderboardEntries(rows);
    } catch (err) {
      setLeaderboardError(err instanceof Error ? err.message : 'Error al consultar la clasificación.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // Autenticación Firebase + carga inicial del Leaderboard Global
  useEffect(() => {
    void refreshLeaderboard();
    const unsubAuth = onAuthStateChanged(auth, user => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, [refreshLeaderboard]);

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
    return () => unsubSnapshot();
  }, [authReady, authUser]);

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
          message: err instanceof Error ? err.message : 'No se pudo publicar el récord.'
        });
      }
    },
    [refreshLeaderboard]
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
        err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.'
      );
    } finally {
      setIsAuthBusy(false);
    }
  }, [syncPendingLocalRecord]);

  const handleSignOutGoogle = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOut(auth);
      await refreshLeaderboard();
    } catch (err) {
      setLeaderboardError(err instanceof Error ? err.message : 'Error al cerrar sesión.');
    } finally {
      setIsAuthBusy(false);
    }
  }, [refreshLeaderboard]);

  // Limpiar inspector al volver al título o configuración
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      setInspectedTileId(null);
      setIsEvolutionOpen(false);
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

  // Acción de partida rápida
  const handleQuickStart = () => {
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

  // Registrar puntuación más alta de Eficiencia Cooperativa al finalizar partida
  useEffect(() => {
    if (state.phase !== 'GAME_OVER' || !state.gameResult) {
      hasRecordedGameOverRef.current = false;
      setSubmissionStatus({ state: 'IDLE' });
      return;
    }

    if (hasRecordedGameOverRef.current) return;
    hasRecordedGameOverRef.current = true;

    const snapshot = buildLeaderboardSnapshotFromMatch(
      cooperativeEfficiency,
      state.gameResult,
      state.round,
      state.players,
      authUser?.displayName || undefined
    );

    const canSyncNow = Boolean(authUser && authUser.emailVerified);
    const { record } = saveLocalBestRecordIfBetter(snapshot, !canSyncNow);
    setLocalBest(record);

    if (authUser && authUser.emailVerified) {
      setSubmissionStatus({ state: 'SUBMITTING' });
      void submitPersonalBestToLeaderboard(authUser, snapshot)
        .then(res => {
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
            message: err instanceof Error ? err.message : 'Error al sincronizar.'
          });
        });
    } else {
      setSubmissionStatus({ state: 'SAVED_LOCAL_PENDING', record });
    }
  }, [
    state.phase,
    state.gameResult,
    state.round,
    state.players,
    cooperativeEfficiency,
    authUser,
    refreshLeaderboard
  ]);

  const globalTopEntry = leaderboardEntries[0] ?? null;
  const globalUserRank = useMemo(() => {
    if (!authUser) return null;
    const idx = leaderboardEntries.findIndex(e => e.uid === authUser.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboardEntries, authUser]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      
      {/* 1. THREE.JS 3D BOARD VIEWPORT (100% full-bleed) */}
      <CommonspolyBoard3D
        tiles={state.tiles}
        players={state.players}
        speculators={state.speculators}
        activePlayerIndex={state.activePlayerIndex}
        currentDiceRoll={state.currentDiceRoll}
        cameraMode={state.cameraMode}
        phase={state.phase}
        round={state.round}
        gameResult={state.gameResult}
        cooperativeEfficiency={cooperativeEfficiency.efficiency}
        weatherMode={state.weatherMode}
        weatherIntensity={state.weatherIntensity}
        activeWeatherEvent={state.activeWeatherEvent}
        timeOfDayMode={state.timeOfDayMode}
        currentGlobalCard={state.currentGlobalCard}
        currentSituationCard={state.currentSituationCard}
        activeModal={state.activeModal}
        neighborhoodDecision={state.neighborhoodDecision}
        postProcessingEnabled={state.postProcessingEnabled}
        onTileClick={(tile) => {
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
          }}
          leaderboardTopPct={globalTopEntry?.efficiencyPct ?? null}
          leaderboardCount={leaderboardEntries.length}
          localBestPct={
            authUser && globalUserRank
              ? leaderboardEntries[globalUserRank - 1]?.efficiencyPct ?? localBest?.efficiencyPct ?? null
              : localBest?.efficiencyPct ?? null
          }
          achievementsUnlockedCount={(state.achievements ?? []).filter(a => a.isUnlocked).length}
          achievementsTotalCount={(state.achievements ?? []).length}
          isModalOpen={showRules || showShortcuts || showAchievements || showLeaderboard}
          soundEnabled={state.soundEnabled}
          onToggleSound={toggleSound}
          savedGameMeta={savedGameMeta}
          onResumeSavedGame={resumeSavedGame}
          onDeleteSavedGame={clearSavedGame}
        />
      )}

      {/* 3. SETUP WIZARD VIEW */}
      {state.phase === 'SETUP' && (
        <SetupWizard
          onComplete={finalizeSetup}
          onCancel={pauseToTitle}
        />
      )}

      {/* 4. ACTIVE GAMEPLAY HUD OVERLAY */}
      {state.phase !== 'TITLE' && state.phase !== 'SETUP' && state.phase !== 'GAME_OVER' && (
        <>
          <GameOverlayHUD
            state={state}
            isRulesOpen={showRules}
            isShortcutsOpen={showShortcuts}
            isAchievementsOpen={showAchievements}
            isGameHistoryOpen={isGameHistoryOpen}
            isEvolutionOpen={isEvolutionOpen}
            isDockCollapsed={isDockCollapsed}
            onRollDice={rollDiceForCurrentPlayer}
            onUnlockTile={unlockCurrentTile}
            onPassTile={passCurrentTile}
            onTurnTimeout={passTurnOnTimeout}
            onTryEnterAgora={tryEnterAgora}
            onStayInAgora={stayInAgora}
            onOpenDetentionRescue={openDetentionRescue}
            onTriggerNeighborhoodDecision={triggerNeighborhoodDecision}
            onOpenRules={() => setShowRules(true)}
            onOpenShortcuts={() => setShowShortcuts(true)}
            onOpenAchievements={() => setShowAchievements(true)}
            onDismissRecentAchievement={dismissRecentAchievement}
            onToggleGameHistory={handleToggleGameHistory}
            onCloseGameHistory={() => setIsGameHistoryOpen(false)}
            onToggleEvolution={handleToggleEvolution}
            onCloseEvolution={() => setIsEvolutionOpen(false)}
            onToggleDock={() => setIsDockCollapsed(prev => !prev)}
            isTutorialOpen={isTutorialOpen}
            onToggleTutorial={() => setIsTutorialOpen(prev => !prev)}
            onTutorialVisibilityChange={setIsTutorialOpen}
            onSetCameraMode={setCameraMode}
            onToggleSound={toggleSound}
            onToggleHaptics={toggleHaptics}
            onTogglePostProcessing={togglePostProcessing}
            onSetAmbientMode={setAmbientMode}
            onSetWeatherMode={setWeatherMode}
            onSetWeatherIntensity={setWeatherIntensity}
            onSetTimeOfDayMode={setTimeOfDayMode}
            onSendCooperativeChat={sendCooperativeChat}
            savedGameMeta={savedGameMeta}
            onSaveGame={saveGameNow}
            onPauseToTitle={pauseToTitle}
          />
          {!state.activeModal && (
            <TileInspectorHUD
              tile={inspectedTile}
              players={state.players}
              speculators={state.speculators}
              activeCrisis={state.activeCrisis}
              activeWeatherEvent={state.activeWeatherEvent}
              onClose={() => setInspectedTileId(null)}
            />
          )}
        </>
      )}

      {/* 5. MODALES INTERACTIVOS */}

      {/* Carta Global de la Ronda */}
      {state.activeModal === 'GLOBAL_CARD' && (
        <GlobalCardModal
          card={state.currentGlobalCard}
          round={state.round}
          onConfirm={acknowledgeGlobalCard}
        />
      )}

      {/* Carta de Situación individual */}
      {state.activeModal === 'SITUATION_CARD' && activePlayer && (
        <SituationCardModal
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
          onConfirm={resolveSituationCard}
        />
      )}

      {/* Insurrección Colectiva en el Ágora */}
      {state.activeModal === 'AGORA_INSURRECTION' && (
        <AgoraInsurrectionModal
          tiles={state.tiles}
          onSelectCategory={executeInsurrectionForCategory}
        />
      )}

      {/* Rescate solidario de Detención */}
      {state.activeModal === 'DETENTION_RESCUE' && detainedPlayer && (
        <DetentionRescueModal
          detainedPlayer={detainedPlayer}
          allPlayers={state.players}
          onRescue={rescueDetainedPlayer}
          onDismiss={closeModal}
        />
      )}

      {/* Tragedia de los Comunes (Privatización obligatoria de 3) */}
      {state.activeModal === 'TRAGEDY_VOTE' && (
        <TragedyVoteModal
          tiles={state.tiles}
          onConfirmPrivatization={resolveTragedyOfCommons}
        />
      )}

      {/* Gestión Pública en Burocracia (ID 10) */}
      {state.activeModal === 'BUREAUCRACY' && activePlayer && (
        <BureaucracyModal
          player={activePlayer}
          tiles={state.tiles}
          onConfirm={executeBureaucracy}
          onPass={closeModal}
        />
      )}

      {/* Caja Solidaria / Crowdfunding Barrial (ID 38) */}
      {state.activeModal === 'CROWDFUNDING' && activePlayer && (
        <CrowdfundingModal
          donor={activePlayer}
          players={state.players}
          onDonate={executeCrowdfunding}
          onPass={closeModal}
        />
      )}

      {/* Votación In-Situ para Decisión Barrial */}
      {state.activeModal === 'NEIGHBORHOOD_DECISION' && activePlayer && (
        <NeighborhoodDecisionModal
          decision={state.neighborhoodDecision}
          activePlayer={activePlayer}
          players={state.players}
          tiles={state.tiles}
          onCastVote={castNeighborhoodVote}
          onClose={closeModal}
        />
      )}

      {/* Fin de Juego: Superposición cinematográfica de partículas + Modal Resumen */}
      {state.phase === 'GAME_OVER' && state.gameResult && (
        <>
          <GameOverCinematicOverlay
            result={state.gameResult}
            tiles={state.tiles}
            round={state.round}
            cooperativeEfficiency={cooperativeEfficiency}
            showSummaryModal={showGameOverSummary}
            onToggleSummary={() => setShowGameOverSummary(prev => !prev)}
          />
          {showGameOverSummary && (
            <GameOverModal
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
              onRestart={resetToTitle}
            />
          )}
        </>
      )}

      {/* Manual de Reglas */}
      {showRules && (
        <RulesModal
          onClose={() => {
            playSound.modalClose();
            setShowRules(false);
          }}
        />
      )}

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

      {/* Clasificación Global ('Leaderboard') */}
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

    </div>
  );
}
