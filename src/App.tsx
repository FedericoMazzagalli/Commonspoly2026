/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SetupInitialRolls, Tile } from './types/game';
import { playSound } from './utils/audio';
import { resolveWeather } from './utils/weather';
import { computeCooperativeEfficiency } from './utils/cooperativeEfficiency';

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
  const [isGameHistoryOpen, setIsGameHistoryOpen] = useState(false);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showGameOverSummary, setShowGameOverSummary] = useState(false);
  const [inspectedTileId, setInspectedTileId] = useState<number | null>(null);

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
    onToggleShortcuts: () => setShowShortcuts(prev => !prev),
    onCloseShortcuts: () => setShowShortcuts(false),
    onCloseGameOverSummary: () => setShowGameOverSummary(false)
  });

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
          achievementsUnlockedCount={(state.achievements ?? []).filter(a => a.isUnlocked).length}
          achievementsTotalCount={(state.achievements ?? []).length}
          isModalOpen={showRules || showShortcuts || showAchievements}
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
            onOpenRules={() => setShowRules(true)}
            onOpenShortcuts={() => setShowShortcuts(true)}
            onOpenAchievements={() => setShowAchievements(true)}
            onDismissRecentAchievement={dismissRecentAchievement}
            onToggleGameHistory={handleToggleGameHistory}
            onCloseGameHistory={() => setIsGameHistoryOpen(false)}
            onToggleEvolution={handleToggleEvolution}
            onCloseEvolution={() => setIsEvolutionOpen(false)}
            onToggleDock={() => setIsDockCollapsed(prev => !prev)}
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
            onSaveGame={saveGameNow}
            onPauseToTitle={pauseToTitle}
          />
          {!state.activeModal && (
            <TileInspectorHUD
              tile={inspectedTile}
              players={state.players}
              speculators={state.speculators}
              activeCrisis={state.activeCrisis}
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
          weather={resolveWeather(state.tiles, state.weatherMode, state.weatherIntensity ?? 0.85, state.round, state.activePlayerIndex)}
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
          tiles={state.tiles}
          onCastVote={castNeighborhoodVote}
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

    </div>
  );
}
