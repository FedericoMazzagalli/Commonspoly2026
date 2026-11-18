/**
 * Commonspoly Game Engine & State Management
 * Implementación fidedigna de las reglas de la Edición Verde (ZEMOS98)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  GameEngineState, 
  Tile, 
  Character, 
  Speculator, 
  SetupInitialRolls, 
  GoodType, 
  GoodState,
  GlobalCard, 
  SituationCard,
  GameLogEntry,
  CooperativeChatMessage,
  AmbientMode,
  WeatherMode,
  TimeOfDayMode,
  PlayerContributionStats,
  RoundPerformanceSnapshot,
  TurnCommonsSnapshot,
  CooperativeAchievement
} from '../types/game';
import { OFFICIAL_CHARACTERS, createInitialCharacter } from '../data/characters';
import { INITIAL_TILES, applyInitialDifficultyToTiles } from '../data/tiles';
import { GLOBAL_CARDS, SITUATION_CARDS } from '../data/cards';
import { playSound, audioManager } from '../utils/audio';
import { resolveWeather } from '../utils/weather';
import { hapticsManager, triggerHaptic } from '../utils/haptics';
import {
  loadLocalAchievements,
  resetLocalAchievements,
  applyAchievementUpdates,
  collectUpdatesFromLogEntry,
  detectCompletedGoodCategories,
  AchievementUpdate
} from '../utils/achievements';
import {
  SavedGameMetadata,
  saveGameToStorage,
  loadSavedGameFromStorage,
  getSavedGameMetadata,
  clearSavedGameFromStorage
} from '../utils/gameStorage';

function createInitialPlayerStats(players: Character[]): Record<string, PlayerContributionStats> {
  const stats: Record<string, PlayerContributionStats> = {};
  players.forEach(p => {
    stats[p.id] = {
      playerId: p.id,
      playerName: p.name,
      color: p.color,
      commonsUnlocked: 0,
      publicsUnlocked: 0,
      cooperativeActions: 0,
      wellnessInvested: 0,
      totalResourcesEarned: p.wellness + p.legitimacy
    };
  });
  return stats;
}

function buildRoundSnapshot(
  round: number,
  players: Character[],
  tiles: Tile[],
  playerStats: Record<string, PlayerContributionStats>
): RoundPerformanceSnapshot {
  const commonCount = tiles.filter(t => t.state === 'COMMON' || t.category === 'INALIENABLE_COMMON').length;
  const publicCount = tiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = tiles.filter(t => t.state === 'PRIVATE').length;

  return {
    round,
    commonCount,
    publicCount,
    privateCount,
    players: players.map(p => {
      const st = playerStats[p.id];
      return {
        playerId: p.id,
        playerName: p.name,
        color: p.color,
        wellness: p.wellness,
        legitimacy: p.legitimacy,
        totalResources: p.wellness + p.legitimacy,
        commonsContributed: st?.commonsUnlocked ?? 0,
        publicsContributed: st?.publicsUnlocked ?? 0,
        cooperativeActions: st?.cooperativeActions ?? 0
      };
    })
  };
}

function upsertRoundSnapshot(
  history: RoundPerformanceSnapshot[] | undefined,
  snapshot: RoundPerformanceSnapshot
): RoundPerformanceSnapshot[] {
  const base = history ? [...history] : [];
  const idx = base.findIndex(s => s.round === snapshot.round);
  if (idx >= 0) {
    base[idx] = snapshot;
    return base;
  }
  return [...base, snapshot].sort((a, b) => a.round - b.round);
}

function buildTurnCommonsSnapshot(
  turn: number,
  round: number,
  actorName: string,
  actorColor: string | undefined,
  tiles: Tile[],
  baselineCommonCount?: number,
  eventSummary?: string
): TurnCommonsSnapshot {
  const resourceTiles = tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
  const publicCount = resourceTiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;
  const baseCommon = baselineCommonCount ?? commonCount;

  return {
    turn,
    round,
    label: turn === 0 ? 'Inicio' : `T${turn}`,
    actorName,
    actorColor,
    eventSummary,
    commonCount,
    recoveredDelta: commonCount - baseCommon,
    publicCount,
    privateCount,
    totalResourceTiles: resourceTiles.length || 1
  };
}

function appendTurnSnapshot(
  history: TurnCommonsSnapshot[] | undefined,
  round: number,
  actorName: string,
  actorColor: string | undefined,
  tiles: Tile[],
  eventSummary?: string
): TurnCommonsSnapshot[] {
  const base = history ? [...history] : [];
  const nextTurn = base.length;
  const baselineCommon = base[0]?.commonCount;
  const snap = buildTurnCommonsSnapshot(
    nextTurn,
    round,
    actorName,
    actorColor,
    tiles,
    baselineCommon,
    eventSummary
  );
  return [...base, snap];
}

function buildDefaultTitleState(): GameEngineState {
  const initialPlayers = [
    createInitialCharacter(OFFICIAL_CHARACTERS[0], 'HUMAN'),
    createInitialCharacter(OFFICIAL_CHARACTERS[1], 'BOT'),
    createInitialCharacter(OFFICIAL_CHARACTERS[2], 'BOT'),
    createInitialCharacter(OFFICIAL_CHARACTERS[3], 'BOT'),
  ];

  const defaultRolls: SetupInitialRolls = {
    health: 3,
    urban: 3,
    knowledge: 4,
    environment: 4,
    totalSum: 14,
    difficulty: 'EN_TRANSICION',
    speculatorsCount: 2
  };

  const initialTiles = applyInitialDifficultyToTiles(INITIAL_TILES, defaultRolls);

  const initialSpeculators: Speculator[] = [
    { id: 1, position: 0, name: 'Especulador Inmobiliario', color: '#FFFFFF' },
    { id: 2, position: 0, name: 'Fondo de Capital Riesgo', color: '#E2E8F0' },
  ];

  const initialStats = createInitialPlayerStats(initialPlayers);

  return {
    phase: 'TITLE',
    round: 1,
    activePlayerIndex: 0,
    players: initialPlayers,
    speculators: initialSpeculators,
    tiles: initialTiles,
    setupConfig: defaultRolls,
    currentDiceRoll: null,
    currentGlobalCard: null,
    currentSituationCard: null,
    activeModal: null,
    logs: [
      {
        id: 'log_0',
        round: 1,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actor: 'Sistema',
        message: 'Bienvenidas a Commonspoly. ¡Construyamos juntos una sociedad de bienes comunes!',
        type: 'INFO'
      }
    ],
    chatMessages: [],
    cameraMode: 'ISOMETRIC',
    soundEnabled: true,
    hapticsEnabled: hapticsManager.isEnabled(),
    postProcessingEnabled: true,
    ambientMode: 'AUTO',
    weatherMode: 'AUTO',
    weatherIntensity: 0.85,
    timeOfDayMode: 'AUTO',
    achievements: loadLocalAchievements(),
    recentAchievement: null,
    playerStats: initialStats,
    performanceHistory: [buildRoundSnapshot(1, initialPlayers, initialTiles, initialStats)],
    turnHistory: [
      buildTurnCommonsSnapshot(
        0,
        1,
        'Tablero Inicial',
        '#14b8a6',
        initialTiles,
        undefined,
        'Distribución inicial del tablero'
      )
    ]
  };
}

export function useCommonspolyGame() {
  const restoredOnBootRef = useRef<ReturnType<typeof loadSavedGameFromStorage> | undefined>(undefined);
  if (restoredOnBootRef.current === undefined) {
    restoredOnBootRef.current = loadSavedGameFromStorage({ force: false });
  }

  const [state, setState] = useState<GameEngineState>(() =>
    restoredOnBootRef.current ? restoredOnBootRef.current.state : buildDefaultTitleState()
  );
  const [savedGameMeta, setSavedGameMeta] = useState<SavedGameMetadata | null>(() =>
    getSavedGameMetadata()
  );
  const [resumeNonce, setResumeNonce] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const seenAchievementLogsRef = useRef<Set<string>>(new Set(state.logs.map(l => l.id)));
  const prevCompletedSectorsRef = useRef<Set<GoodType>>(detectCompletedGoodCategories(state));
  const prevVictoryTriggeredRef = useRef<boolean>(
    state.phase === 'GAME_OVER' && state.gameResult === 'VICTORY'
  );
  const achievementQueueRef = useRef<CooperativeAchievement[]>([]);
  const pendingRoundAdvanceRef = useRef<boolean>(
    restoredOnBootRef.current?.pendingRoundAdvance ?? false
  );
  const needsRecoveryRef = useRef<boolean>(Boolean(restoredOnBootRef.current));
  const lastTurnHapticKeyRef = useRef<string>('');

  // Auto-guardado continuo en LocalStorage durante partidas activas
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') return;
    const meta = saveGameToStorage(state, {
      autoResumeOnReload: true,
      pendingRoundAdvance: pendingRoundAdvanceRef.current
    });
    if (meta) {
      setSavedGameMeta(meta);
    }
  }, [state]);

  // Sincronización dinámica del gestor de audio ambiental y háptica con el estado de la partida
  useEffect(() => {
    audioManager.setMuted(!state.soundEnabled);
  }, [state.soundEnabled]);

  useEffect(() => {
    hapticsManager.setEnabled(state.hapticsEnabled ?? true);
  }, [state.hapticsEnabled]);

  useEffect(() => {
    if (state.phase !== 'PLAYER_TURN_READY') return;
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.controller !== 'HUMAN') return;
    const key = `${state.round}-${state.activePlayerIndex}-${activePlayer.id}`;
    if (lastTurnHapticKeyRef.current !== key) {
      lastTurnHapticKeyRef.current = key;
      triggerHaptic.playerTurn();
    }
  }, [state.phase, state.activePlayerIndex, state.round, state.players]);

  useEffect(() => {
    const nextSoundscape = audioManager.resolveSoundscapeFromState(state);
    audioManager.setSoundscape(nextSoundscape);
  }, [
    state.phase,
    state.activePlayerIndex,
    state.activeModal,
    state.ambientMode,
    state.round,
    state.players,
    state.tiles
  ]);

  // Sincronización dinámica de la capa atmosférica de audio según el clima seleccionado e intensidad
  useEffect(() => {
    const cond = resolveWeather(state.tiles, state.weatherMode, state.weatherIntensity ?? 0.85);
    audioManager.setWeatherAudio(
      cond.type,
      cond.intensity,
      state.phase === 'TITLE' || state.phase === 'SETUP'
    );
  }, [state.phase, state.weatherMode, state.weatherIntensity, state.tiles]);

  // Rastreo automático de logros locales ('Achievements') ante hitos cooperativos
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      seenAchievementLogsRef.current = new Set(state.logs.map(l => l.id));
      prevCompletedSectorsRef.current = detectCompletedGoodCategories(state);
      prevVictoryTriggeredRef.current = false;
      return;
    }

    const updates: AchievementUpdate[] = [];

    const unseenLogs = state.logs.filter(l => !seenAchievementLogsRef.current.has(l.id));
    if (unseenLogs.length > 0) {
      [...unseenLogs].reverse().forEach(entry => {
        seenAchievementLogsRef.current.add(entry.id);
        updates.push(...collectUpdatesFromLogEntry(entry));
      });
    }

    const completedSectors = detectCompletedGoodCategories(state);
    if (state.round === 1 && state.logs.length <= 1) {
      prevCompletedSectorsRef.current = completedSectors;
    } else {
      completedSectors.forEach(cat => {
        if (!prevCompletedSectorsRef.current.has(cat)) {
          const activePlayer = state.players[state.activePlayerIndex];
          updates.push({
            id: 'sector_complete',
            increment: 1,
            round: state.round,
            playerName: activePlayer?.name,
            playerColor: activePlayer?.color
          });
        }
      });
      prevCompletedSectorsRef.current = completedSectors;
    }

    if (state.phase === 'GAME_OVER' && state.gameResult === 'VICTORY' && !prevVictoryTriggeredRef.current) {
      prevVictoryTriggeredRef.current = true;
      updates.push({
        id: 'radical_victory',
        increment: 1,
        round: state.round,
        playerName: 'Comunidad Commonspoly',
        playerColor: '#10b981'
      });
    }

    if (updates.length === 0) return;

    setState(prev => {
      const currentAchievements = prev.achievements ?? loadLocalAchievements();
      const { nextAchievements, newlyUnlocked, changed } = applyAchievementUpdates(
        currentAchievements,
        updates
      );

      if (!changed) return prev;

      if (newlyUnlocked.length > 0) {
        playSound.achievementUnlock();
        triggerHaptic.commonUnlocked();
        const [firstNew, ...restNew] = newlyUnlocked;
        if (!prev.recentAchievement) {
          if (restNew.length > 0) {
            achievementQueueRef.current.push(...restNew);
          }
          return {
            ...prev,
            achievements: nextAchievements,
            recentAchievement: firstNew
          };
        } else {
          achievementQueueRef.current.push(...newlyUnlocked);
        }
      }

      return {
        ...prev,
        achievements: nextAchievements
      };
    });
  }, [state.logs, state.tiles, state.phase, state.gameResult, state.round, state.players, state.activePlayerIndex]);

  const addLog = useCallback((
    actor: string, 
    message: string, 
    type: GameLogEntry['type'] = 'INFO',
    extra?: {
      category?: 'COOPERATIVE' | 'HAZARD' | 'SYSTEM' | 'CARD';
      cooperativeAction?: 'RESCUE' | 'COLLECTIVE_VOTE' | 'COMMON_UNLOCK' | 'PUBLIC_UNLOCK' | 'AGORA_INSURRECTION' | 'CROWDFUND' | 'SOLIDARITY' | 'PROTECTION' | 'BUROCRACIA';
      actorColor?: string;
      target?: string;
      highlight?: boolean;
    }
  ) => {
    setState(prev => ({
      ...prev,
      logs: [
        {
          id: `log_${Date.now()}_${Math.random()}`,
          round: prev.round,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actor,
          actorColor: extra?.actorColor,
          target: extra?.target,
          message,
          type,
          category: extra?.category || (type === 'HAZARD' ? 'HAZARD' : type === 'CARD' ? 'CARD' : 'SYSTEM'),
          cooperativeAction: extra?.cooperativeAction,
          highlight: extra?.highlight
        },
        ...prev.logs.slice(0, 1999) // Conservar historial completo de la partida en orden
      ]
    }));
  }, []);

  // Iniciar Asistente de Preparación
  const startSetup = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'SETUP'
    }));
  }, []);

  // Configuración completa desde el Asistente
  const finalizeSetup = useCallback((
    selectedCharacters: { baseCharId: string; controller: 'HUMAN' | 'BOT' }[],
    rolls: SetupInitialRolls
  ) => {
    const players: Character[] = selectedCharacters.map(sc => {
      const base = OFFICIAL_CHARACTERS.find(c => c.id === sc.baseCharId) || OFFICIAL_CHARACTERS[0];
      return createInitialCharacter(base, sc.controller);
    });

    const tiles = applyInitialDifficultyToTiles(INITIAL_TILES, rolls);

    const speculators: Speculator[] = [];
    const speculatorNames = [
      'Fondo Buitre Inmobiliario',
      'Corporación Farmacéutica',
      'Monopolio Tecnológico'
    ];
    for (let i = 0; i < rolls.speculatorsCount; i++) {
      speculators.push({
        id: i + 1,
        position: 0,
        name: speculatorNames[i] || `Especulador ${i + 1}`,
        color: '#FFFFFF'
      });
    }

    const freshStats = createInitialPlayerStats(players);
    const initialSnapshot = buildRoundSnapshot(1, players, tiles, freshStats);

    setState(prev => ({
      ...prev,
      phase: 'PLAYER_TURN_READY',
      round: 1,
      activePlayerIndex: 0,
      players,
      speculators,
      tiles,
      setupConfig: rolls,
      currentDiceRoll: null,
      currentGlobalCard: null,
      currentSituationCard: null,
      activeModal: null,
      recentAchievement: null,
      playerStats: freshStats,
      performanceHistory: [initialSnapshot],
      turnHistory: [
        buildTurnCommonsSnapshot(
          0,
          1,
          'Tablero Inicial',
          '#14b8a6',
          tiles,
          undefined,
          `Inicio en dificultad ${rolls.difficulty}`
        )
      ],
      gameResult: undefined,
      gameResultDetails: undefined,
      logs: [
        {
          id: `log_init_${Date.now()}`,
          round: 1,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actor: 'Máster de Juego',
          message: `Partida iniciada en dificultad ${rolls.difficulty} (${rolls.speculatorsCount} Especuladores en juego). ¡Ronda 1!`,
          type: 'INFO'
        }
      ],
      chatMessages: [
        {
          id: `chat_init_${Date.now()}`,
          senderName: players[0]?.name || 'Comunidad',
          senderColor: players[0]?.color || '#14b8a6',
          controller: players[0]?.controller || 'HUMAN',
          text: '¡Lista para coordinar el bien común! Usad el chat rápido en las votaciones.',
          round: 1,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          votingContext: 'Inicio'
        }
      ]
    }));
  }, []);

  // Registrar incremento en estadísticas de contribución y recursos del jugador
  const recordPlayerMetric = useCallback((
    playerId: string,
    delta: Partial<Omit<PlayerContributionStats, 'playerId' | 'playerName' | 'color'>>,
    overrideTiles?: Tile[],
    overrideRound?: number
  ) => {
    setState(prev => {
      const baseStats = prev.playerStats || createInitialPlayerStats(prev.players);
      const player = prev.players.find(p => p.id === playerId);
      const current = baseStats[playerId] || {
        playerId,
        playerName: player?.name || 'Jugador',
        color: player?.color || '#14b8a6',
        commonsUnlocked: 0,
        publicsUnlocked: 0,
        cooperativeActions: 0,
        wellnessInvested: 0,
        totalResourcesEarned: (player?.wellness || 0) + (player?.legitimacy || 0)
      };

      const nextStats: Record<string, PlayerContributionStats> = {
        ...baseStats,
        [playerId]: {
          ...current,
          commonsUnlocked: current.commonsUnlocked + (delta.commonsUnlocked || 0),
          publicsUnlocked: current.publicsUnlocked + (delta.publicsUnlocked || 0),
          cooperativeActions: current.cooperativeActions + (delta.cooperativeActions || 0),
          wellnessInvested: current.wellnessInvested + (delta.wellnessInvested || 0),
          totalResourcesEarned: current.totalResourcesEarned + (delta.totalResourcesEarned || 0)
        }
      };

      const snap = buildRoundSnapshot(
        overrideRound ?? prev.round,
        prev.players,
        overrideTiles ?? prev.tiles,
        nextStats
      );

      return {
        ...prev,
        playerStats: nextStats,
        performanceHistory: upsertRoundSnapshot(prev.performanceHistory, snap)
      };
    });
  }, []);

  // Verificar estado de victoria o fin de 20 rondas
  const checkEndGameConditions = useCallback((tiles: Tile[], round: number) => {
    const resourceTiles = tiles.filter(t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY');
    const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;
    const publicCount = resourceTiles.filter(t => t.state === 'PUBLIC').length;
    const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;

    // Condición de Victoria: Todos los bienes son Comunes
    if (privateCount === 0 && publicCount === 0 && commonCount > 0) {
      playSound.agoraInsurrection();
      triggerHaptic.victory();
      setState(prev => {
        const stats = prev.playerStats || createInitialPlayerStats(prev.players);
        const finalSnap = buildRoundSnapshot(Math.min(prev.round, 20), prev.players, tiles, stats);
        const lastTurn = prev.turnHistory?.[prev.turnHistory.length - 1];
        const nextTurnHistory =
          lastTurn && lastTurn.commonCount === commonCount && lastTurn.privateCount === privateCount
            ? prev.turnHistory
            : appendTurnSnapshot(
                prev.turnHistory,
                Math.min(prev.round, 20),
                'Victoria Comunitaria',
                '#10b981',
                tiles,
                'Todos los bienes comunes recuperados'
              );
        return {
          ...prev,
          phase: 'GAME_OVER',
          gameResult: 'VICTORY',
          gameResultDetails: '¡Victoria Comunitaria Total! Habéis desprivatizado y comunalizado todos los bienes de la sociedad. ¡La felicidad radical es una realidad!',
          performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
          turnHistory: nextTurnHistory
        };
      });
      return true;
    }

    // Condición al terminar la ronda 20
    if (round > 20) {
      if (privateCount === 0) {
        playSound.unlockPublic();
        triggerHaptic.rescue();
        setState(prev => {
          const stats = prev.playerStats || createInitialPlayerStats(prev.players);
          const finalSnap = buildRoundSnapshot(20, prev.players, tiles, stats);
          const nextTurnHistory = appendTurnSnapshot(
            prev.turnHistory,
            20,
            'Cierre de Partida',
            '#38bdf8',
            tiles,
            'Empate social al completar la ronda 20'
          );
          return {
            ...prev,
            phase: 'GAME_OVER',
            gameResult: 'DRAW',
            gameResultDetails: '¡Empate social! La sociedad no tiene ningún bien privado, aunque aún conviven bienes públicos y comunes. ¡Un gran avance hacia el bien común!',
            performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
            turnHistory: nextTurnHistory
          };
        });
      } else {
        playSound.speculatorAlert();
        triggerHaptic.defeat();
        setState(prev => {
          const stats = prev.playerStats || createInitialPlayerStats(prev.players);
          const finalSnap = buildRoundSnapshot(20, prev.players, tiles, stats);
          const nextTurnHistory = appendTurnSnapshot(
            prev.turnHistory,
            20,
            'Cierre de Partida',
            '#f43f5e',
            tiles,
            `Fin de las 20 rondas (${privateCount} privatizados)`
          );
          return {
            ...prev,
            phase: 'GAME_OVER',
            gameResult: 'DEFEAT',
            gameResultDetails: `Fin del tiempo (20 rondas). Quedan ${privateCount} bienes en manos privadas. Los Especuladores han frenado la transformación radical.`,
            performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
            turnHistory: nextTurnHistory
          };
        });
      }
      return true;
    }

    return false;
  }, []);

  // Coordenadas 3D de una casilla para audio espacial posicional
  const getTileCoords3D = useCallback((tileId: number): { x: number; y: number; z: number } => {
    const tile = stateRef.current.tiles.find(t => t.id === tileId);
    if (tile) return { x: tile.x, y: 0.35, z: tile.z };
    if (tileId === 100) return { x: 0, y: 0.5, z: 0 };
    return { x: -10, y: 0.35, z: 10 };
  }, []);

  // Permanecer una ronda en el Ágora Central (-1 Bienestar) esperando al grupo
  const stayInAgora = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.phase !== 'PLAYER_TURN_READY') return;
    const player = currentState.players[currentState.activePlayerIndex];
    if (!player || !player.inAgora) return;

    const nextWellness = Math.max(1, player.wellness - 1);
    const nextRoundsInAgora = player.roundsInAgora + 1;

    setState(prev => ({
      ...prev,
      players: prev.players.map((p, idx) =>
        idx === prev.activePlayerIndex
          ? { ...p, wellness: nextWellness, roundsInAgora: nextRoundsInAgora }
          : p
      )
    }));

    playSound.unlockPublic({ x: 0, y: 0.5, z: 0 });
    addLog(
      player.name,
      `Mantiene la asamblea en el Ágora Central esperando refuerzos (-1 Bienestar, ronda ${nextRoundsInAgora}/3 en el Ágora).`,
      'INFO'
    );
    advanceToNextTurn();
  }, []);

  // Tirar dado para el jugador activo (audio espacial ubicado en el dado 3D)
  const rollDiceForCurrentPlayer = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.phase !== 'PLAYER_TURN_READY') return;

    const activePlayer = currentState.players[currentState.activePlayerIndex];
    if (!activePlayer) return;

    // Inteligencia cooperativa automática para Bots antes de lanzar el dado
    if (activePlayer.controller === 'BOT') {
      // 1. Si ya está en el Ágora esperando asamblea y tiene aguante (<3 rondas y >2 Bienestar), esperar
      if (activePlayer.inAgora && activePlayer.roundsInAgora < 3 && activePlayer.wellness > 2) {
        stayInAgora();
        return;
      }

      // 2. Si hay una compañera detenida y el Bot tiene holgura, rescatarla solidariamente
      const detainedTeammate = currentState.players.find(p => p.isDetained && p.id !== activePlayer.id);
      if (detainedTeammate) {
        const costPerRound = (detainedTeammate.hasCitizenship && detainedTeammate.socialClass !== 'BAJA') ? 1 : 2;
        const totalCost = detainedTeammate.detentionRoundsLeft * costPerRound;
        if (activePlayer.wellness > totalCost + 2) {
          rescueDetainedPlayer(activePlayer.id, detainedTeammate.id);
        }
      }

      // 3. Si el grupo alcanzó Legitimidad Colectiva para el Ágora, el Bot entra para impulsar Insurrección
      const totalLegitimacy = currentState.players.reduce((sum, p) => sum + p.legitimacy, 0);
      const requiredLegitimacy = currentState.players.length * 10;
      const nonCommonRemaining = currentState.tiles.some(
        t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state !== 'COMMON'
      );
      const someoneAlreadyInAgora = currentState.players.some(p => p.inAgora);
      if (
        !activePlayer.inAgora &&
        !activePlayer.isDetained &&
        nonCommonRemaining &&
        totalLegitimacy >= requiredLegitimacy &&
        (someoneAlreadyInAgora || currentState.round >= 4)
      ) {
        tryEnterAgora();
        return;
      }
    }

    playSound.diceRoll({ x: 4.5, y: 0.9, z: 4.5 });
    if (activePlayer.controller === 'HUMAN') {
      triggerHaptic.diceRoll();
    }
    const roll = Math.floor(Math.random() * 6) + 1;

    setState(prev => ({
      ...prev,
      phase: 'DICE_ROLLING',
      currentDiceRoll: roll
    }));

    // Simulación de animación de tirada
    setTimeout(() => {
      executePlayerMove(roll);
    }, 600);
  }, []);

  // Lógica de movimiento respetando la regla oficial de 2 fichas máx y rebote
  const executePlayerMove = useCallback((roll: number) => {
    const currentState = stateRef.current;
    const activePlayer = currentState.players[currentState.activePlayerIndex];
    if (!activePlayer) return;

    // Si el jugador está detenido
    if (activePlayer.isDetained) {
      if (activePlayer.detentionRoundsLeft > 1) {
        activePlayer.detentionRoundsLeft -= 1;
        addLog(activePlayer.name, `Continúa en el Centro de Detención (quedan ${activePlayer.detentionRoundsLeft} rondas).`, 'HAZARD');
        setState(prev => ({
          ...prev,
          players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? { ...activePlayer } : p)
        }));
        advanceToNextTurn();
        return;
      } else {
        activePlayer.isDetained = false;
        activePlayer.detentionRoundsLeft = 0;
        addLog(activePlayer.name, `¡Cumplió su condena y sale del Centro de Detención!`, 'ACTION');
      }
    }

    // Cálculo de destino en el perímetro (0 a 39)
    const currentPos = activePlayer.position;
    const wasInAgora = activePlayer.inAgora;
    let targetPos = currentPos;
    let passedStart = false;
    let isRebound = false;

    // Si está en el Ágora (ID 100) y decide salir
    if (wasInAgora) {
      const exitColumns = [5, 15, 25, 35];
      targetPos = exitColumns[roll % 4];
      activePlayer.inAgora = false;
      activePlayer.roundsInAgora = 0;
      addLog(activePlayer.name, `Sale del Ágora Central hacia la casilla ${targetPos}.`, 'ACTION');
    } else {
      // Movimiento estándar en el perímetro de 40 casillas
      const rawSum = currentPos + roll;
      if (rawSum >= 40) {
        passedStart = true;
      }
      const rawTarget = rawSum % 40;

      // Comprobar regla: máximo 2 fichas por casilla (bloqueo / rebote)
      const occupantsOnTarget = currentState.players.filter(p => p.position === rawTarget && p.id !== activePlayer.id).length +
        currentState.speculators.filter(s => s.position === rawTarget).length;

      if (occupantsOnTarget >= 2) {
        isRebound = true;
        targetPos = (currentPos + roll - 2 + 40) % 40;
        addLog(activePlayer.name, `¡Casilla bloqueada por 2 fichas! Rebota hacia la casilla ${targetPos}.`, 'INFO');
      } else {
        targetPos = rawTarget;
      }
    }

    if (passedStart && targetPos !== 0) {
      activePlayer.wellness += 1;
      recordPlayerMetric(activePlayer.id, { totalResourcesEarned: 1 });
      addLog(activePlayer.name, 'Completó una vuelta al tablero pasando por SALIDA (+1 Bienestar).', 'SUCCESS');
    }

    // Construir trayectoria espacial 3D casilla a casilla para el audio posicional
    const stepCoords: { x: number; y: number; z: number }[] = [];
    if (wasInAgora) {
      stepCoords.push(getTileCoords3D(100), getTileCoords3D(targetPos));
    } else {
      for (let s = 1; s <= roll; s++) {
        stepCoords.push(getTileCoords3D((currentPos + s) % 40));
      }
      if (isRebound) {
        stepCoords.push(getTileCoords3D(targetPos));
      }
    }

    activePlayer.position = targetPos;
    playSound.pawnMoveSequence(stepCoords, { isRebound, isAgora: wasInAgora });

    // Actualizar estado del jugador
    const targetTile = currentState.tiles.find(t => t.id === targetPos);
    addLog(activePlayer.name, `Avanzó ${roll} casillas hasta "${targetTile?.name || targetPos}".`, 'ACTION');

    setState(prev => ({
      ...prev,
      phase: 'TILE_ACTION_DECISION',
      players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? { ...activePlayer } : p)
    }));

    // Resolver casilla
    handleLandedTile(targetTile, activePlayer);
  }, []);

  // Resolver el efecto de la casilla en la que se aterriza
  const handleLandedTile = useCallback((tile: Tile | undefined, player: Character) => {
    if (!tile) {
      advanceToNextTurn();
      return;
    }

    // A. Casilla de Situación 'S'
    if (tile.category === 'SITUATION') {
      const randomCard = SITUATION_CARDS[Math.floor(Math.random() * SITUATION_CARDS.length)];
      playSound.cardFlip();

      if (player.controller === 'BOT') {
        const currentState = stateRef.current;
        const result = randomCard.apply(player, currentState);
        const updatedPlayer: Character = { ...player, ...result.charUpdates };
        const wellDelta = Math.max(0, (updatedPlayer.wellness - player.wellness)) + Math.max(0, (updatedPlayer.legitimacy - player.legitimacy));

        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === player.id ? updatedPlayer : p)
        }));
        if (wellDelta > 0) {
          recordPlayerMetric(player.id, { totalResourcesEarned: wellDelta });
        }
        addLog('Carta de Situación', `[${randomCard.title}] ${result.message}`, 'CARD', {
          actorColor: player.color
        });
        setTimeout(() => {
          advanceToNextTurn();
        }, 650);
        return;
      }

      setState(prev => ({
        ...prev,
        currentSituationCard: randomCard,
        activeModal: 'SITUATION_CARD'
      }));
      return;
    }

    // B. Casillas Especiales
    if (tile.category === 'CORNER' || tile.category === 'SPECIAL') {
      if (tile.specialType === 'START') {
        player.wellness += 1;
        player.legitimacy += 1;
        playSound.unlockPublic(getTileCoords3D(tile.id));
        recordPlayerMetric(player.id, { totalResourcesEarned: 2 });
        addLog(player.name, 'Descansa en SALIDA (+1 Bienestar, +1 Legitimidad).', 'SUCCESS');
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === player.id ? { ...player } : p)
        }));
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'BUREAUCRACY') {
        const privateTiles = stateRef.current.tiles.filter(
          t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state === 'PRIVATE'
        );
        if (player.controller === 'BOT') {
          if (player.wellness > 7 && privateTiles.length > 0) {
            executeBureaucracy(privateTiles[0].id);
          } else {
            addLog(player.name, 'Pasa por Burocracia sin realizar trámites.', 'INFO');
            advanceToNextTurn();
          }
          return;
        }
        playSound.modalOpen();
        setState(prev => ({ ...prev, activeModal: 'BUREAUCRACY' }));
        return;
      }
      if (tile.specialType === 'CROWDFUNDING') {
        const recipients = stateRef.current.players.filter(p => p.id !== player.id);
        if (player.controller === 'BOT') {
          if (player.wellness > 4 && recipients.length > 0) {
            const neediest = [...recipients].sort((a, b) => a.wellness - b.wellness)[0];
            executeCrowdfunding(neediest.id, 1);
          } else {
            addLog(player.name, 'Pasa por Crowdfunding conservando su Bienestar.', 'INFO');
            advanceToNextTurn();
          }
          return;
        }
        playSound.modalOpen();
        setState(prev => ({ ...prev, activeModal: 'CROWDFUNDING' }));
        return;
      }
      if (tile.specialType === 'ASSEMBLY') {
        // Pierdes 2 Bienestar, ganas 2 Legitimidad
        player.wellness = Math.max(1, player.wellness - 2);
        player.legitimacy += 2;
        playSound.unlockCommon(getTileCoords3D(tile.id));
        recordPlayerMetric(player.id, { cooperativeActions: 1, totalResourcesEarned: 2 });
        addLog(
          player.name,
          'Participó en la Asamblea barrial (-2 Bienestar, +2 Legitimidad).',
          'SUCCESS',
          {
            category: 'COOPERATIVE',
            cooperativeAction: 'COLLECTIVE_VOTE',
            actorColor: player.color,
            target: 'Asamblea Barrial',
            highlight: false
          }
        );
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'BANK') {
        // Pierdes 6 Puntos de Bienestar
        player.wellness = Math.max(1, player.wellness - 6);
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.speculatorHit();
        addLog(player.name, '¡Cayó en el Banco privado! Pierde 6 Puntos de Bienestar.', 'HAZARD');
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'CASINO') {
        // Pierdes 6 Puntos de Legitimidad
        player.legitimacy = Math.max(0, player.legitimacy - 6);
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.speculatorHit();
        addLog(player.name, '¡Cayó en el Casino! Pierde 6 Puntos de Legitimidad.', 'HAZARD');
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'DETENTION_CENTER') {
        player.isDetained = true;
        player.detentionRoundsLeft = 1;
        playSound.detentionClang(getTileCoords3D(tile.id));
        triggerHaptic.detention();
        addLog(player.name, 'Retenido en el Centro de Detención durante 1 ronda.', 'HAZARD');
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'TRAGEDY_OF_COMMONS') {
        // Se debe abrir modal de votación para privatizar 3 comunes
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.tragedy();
        setState(prev => ({ ...prev, activeModal: 'TRAGEDY_VOTE' }));
        return;
      }

      advanceToNextTurn();
      return;
    }

    // C. Bien Común Inalienable (Rosa): siempre otorga +2 Bienestar y +2 Legitimidad
    if (tile.category === 'INALIENABLE_COMMON') {
      player.wellness += 2;
      player.legitimacy += 2;
      playSound.unlockCommon(getTileCoords3D(tile.id));
      if (player.controller === 'HUMAN') triggerHaptic.commonUnlocked();
      recordPlayerMetric(player.id, { totalResourcesEarned: 4 });
      addLog(player.name, `Visita el espacio común "${tile.name}" (+2 Bienestar, +2 Legitimidad).`, 'SUCCESS');
      advanceToNextTurn();
      return;
    }

    // D. Casilla de Recurso (Salud, Urbano, Conocimiento, Medioambiente)
    if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
      if (tile.state === 'COMMON') {
        player.wellness += 2;
        player.legitimacy += 2;
        playSound.unlockCommon(getTileCoords3D(tile.id));
        recordPlayerMetric(player.id, { totalResourcesEarned: 4 });
        addLog(player.name, `Disfruta del bien común "${tile.name}" (+2 Bienestar, +2 Legitimidad).`, 'SUCCESS');
        advanceToNextTurn();
        return;
      }

      // Si es BOT y puede desbloquear, decide inteligentemente
      if (player.controller === 'BOT') {
        autoBotActionForTile(tile, player);
      }
      // Si es HUMAN, el HUD mostrará los botones de "Desbloquear (10 pts)" o "Pasar / Ganar Puntos"
    }
  }, []);

  // Lógica de decisión autónoma para Bots
  const autoBotActionForTile = useCallback((tile: Tile, bot: Character) => {
    let skill = 0;
    if (tile.goodType === 'HEALTH') skill = bot.skills.care;
    if (tile.goodType === 'URBAN') skill = bot.skills.occupy;
    if (tile.goodType === 'KNOWLEDGE') skill = bot.skills.share;
    if (tile.goodType === 'ENVIRONMENT') skill = bot.skills.regenerate;

    const neededWellness = Math.max(0, 10 - skill);

    if (bot.wellness > neededWellness && (tile.state === 'PRIVATE' || tile.state === 'PUBLIC')) {
      // El bot desbloquea el bien solidariamente
      bot.wellness -= neededWellness;
      const nextState: GoodState = tile.state === 'PRIVATE' ? 'PUBLIC' : 'COMMON';
      const updatedTiles = stateRef.current.tiles.map(t =>
        t.id === tile.id ? { ...t, state: nextState } : t
      );
      setState(prev => ({
        ...prev,
        tiles: updatedTiles
      }));

      if (nextState === 'COMMON') playSound.unlockCommon(getTileCoords3D(tile.id));
      else playSound.unlockPublic(getTileCoords3D(tile.id));

      recordPlayerMetric(
        bot.id,
        {
          commonsUnlocked: nextState === 'COMMON' ? 1 : 0,
          publicsUnlocked: nextState === 'PUBLIC' ? 1 : 0,
          cooperativeActions: 1,
          wellnessInvested: neededWellness
        },
        updatedTiles
      );

      addLog(
        bot.name,
        `[Acción Cooperativa] ${bot.name} desprivatizó "${tile.name}" convirtiéndolo en ${nextState === 'COMMON' ? 'Bien Común' : 'Bien Público'}.`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: nextState === 'COMMON' ? 'COMMON_UNLOCK' : 'PUBLIC_UNLOCK',
          actorColor: bot.color,
          target: tile.name,
          highlight: nextState === 'COMMON'
        }
      );
    } else {
      // El bot pasa y gana puntos si es público
      if (tile.state === 'PUBLIC') {
        bot.wellness += 1;
        bot.legitimacy += 1;
        recordPlayerMetric(bot.id, { totalResourcesEarned: 2 });
        addLog(bot.name, `[BOT] No desbloqueó "${tile.name}" y obtiene +1 Bienestar y +1 Legitimidad.`, 'INFO');
      } else {
        addLog(bot.name, `[BOT] No tiene suficiente Bienestar para desprivatizar "${tile.name}".`, 'INFO');
      }
    }

    setTimeout(() => {
      advanceToNextTurn();
    }, 400);
  }, []);

  // Acción manual de un jugador humano: Desbloquear el bien (10 pts)
  const unlockCurrentTile = useCallback(() => {
    const currentState = stateRef.current;
    const player = currentState.players[currentState.activePlayerIndex];
    const tile = currentState.tiles.find(t => t.id === player.position);
    if (!tile || !tile.goodType) return;

    let skill = 0;
    if (tile.goodType === 'HEALTH') skill = player.skills.care;
    if (tile.goodType === 'URBAN') skill = player.skills.occupy;
    if (tile.goodType === 'KNOWLEDGE') skill = player.skills.share;
    if (tile.goodType === 'ENVIRONMENT') skill = player.skills.regenerate;

    const neededWellness = Math.max(0, 10 - skill);
    if (player.wellness < neededWellness) return;

    player.wellness -= neededWellness;
    const nextState: GoodState = tile.state === 'PRIVATE' ? 'PUBLIC' : 'COMMON';
    const updatedTiles = currentState.tiles.map(t =>
      t.id === tile.id ? { ...t, state: nextState } : t
    );
    setState(prev => ({
      ...prev,
      tiles: updatedTiles
    }));

    if (nextState === 'COMMON') {
      playSound.unlockCommon(getTileCoords3D(tile.id));
      triggerHaptic.commonUnlocked();
    } else {
      playSound.unlockPublic(getTileCoords3D(tile.id));
      triggerHaptic.uiTap();
    }

    recordPlayerMetric(
      player.id,
      {
        commonsUnlocked: nextState === 'COMMON' ? 1 : 0,
        publicsUnlocked: nextState === 'PUBLIC' ? 1 : 0,
        cooperativeActions: 1,
        wellnessInvested: neededWellness
      },
      updatedTiles
    );

    addLog(
      player.name,
      `¡Bien Desprivatizado! ${player.name} transformó "${tile.name}" en ${nextState === 'COMMON' ? 'Bien Común' : 'Bien Público'} (${neededWellness} Bienestar + ${skill} Habilidad).`,
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: nextState === 'COMMON' ? 'COMMON_UNLOCK' : 'PUBLIC_UNLOCK',
        actorColor: player.color,
        target: tile.name,
        highlight: nextState === 'COMMON'
      }
    );

    // Verificar si se ha ganado el juego
    if (checkEndGameConditions(updatedTiles, currentState.round)) {
      return;
    }

    advanceToNextTurn();
  }, []);

  // Acción manual de un jugador humano: Pasar y recolectar puntos
  const passCurrentTile = useCallback(() => {
    const currentState = stateRef.current;
    const player = currentState.players[currentState.activePlayerIndex];
    const tile = currentState.tiles.find(t => t.id === player.position);

    if (tile?.state === 'PUBLIC') {
      player.wellness += 1;
      player.legitimacy += 1;
      playSound.unlockPublic(getTileCoords3D(tile.id));
      recordPlayerMetric(player.id, { totalResourcesEarned: 2 });
      addLog(player.name, `Pasa en el bien público "${tile.name}" y recibe +1 Bienestar y +1 Legitimidad.`, 'INFO');
    } else {
      addLog(player.name, `Pasa su turno sin realizar transformaciones en "${tile?.name}".`, 'INFO');
    }

    advanceToNextTurn();
  }, []);

  // Intentar entrar al Ágora Central
  const tryEnterAgora = useCallback(() => {
    const currentState = stateRef.current;
    const totalLegitimacy = currentState.players.reduce((sum, p) => sum + p.legitimacy, 0);
    const requiredLegitimacy = currentState.players.length * 10;

    if (totalLegitimacy < requiredLegitimacy) {
      addLog('Ágora Central', `Legitimidad colectiva insuficiente (${totalLegitimacy}/${requiredLegitimacy} necesaria).`, 'HAZARD');
      return;
    }

    const player = currentState.players[currentState.activePlayerIndex];
    player.position = 100; // Ágora Central
    player.inAgora = true;
    player.roundsInAgora = 1;
    playSound.agoraInsurrection({ x: 0, y: 0.5, z: 0 });
    recordPlayerMetric(player.id, { cooperativeActions: 1 });
    addLog(
      player.name,
      '¡Ha entrado en el Ágora Central para la Insurrección Colectiva!',
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: 'AGORA_INSURRECTION',
        actorColor: player.color,
        target: 'Ágora Central',
        highlight: true
      }
    );

    // Comprobar si ya hay 3 o más en el Ágora
    const insideAgora = currentState.players.filter(p => p.inAgora || p.position === 100);
    if (insideAgora.length >= 3) {
      // ¡Todos los demás personajes se unen al instante!
      currentState.players.forEach(p => {
        p.position = 100;
        p.inAgora = true;
      });
      playSound.agoraInsurrection({ x: 0, y: 0.5, z: 0 });
      addLog(
        '¡INSURRECCIÓN COLECTIVA!',
        '¡3 personajes han alcanzado el Ágora! Toda la ciudadanía se reúne en asamblea masiva para comunalizar recursos.',
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: 'AGORA_INSURRECTION',
          target: 'Asamblea Masiva',
          highlight: true
        }
      );
      setState(prev => ({
        ...prev,
        activeModal: 'AGORA_INSURRECTION'
      }));
    } else {
      advanceToNextTurn();
    }
  }, []);

  // Ejecutar Insurrección Colectiva (comunalizar toda una categoría)
  const executeInsurrectionForCategory = useCallback((category: GoodType) => {
    const currentState = stateRef.current;
    playSound.agoraInsurrection({ x: 0, y: 0.5, z: 0 });
    triggerHaptic.commonUnlocked();

    const convertedCount = currentState.tiles.filter(
      t => t.goodType === category && t.state !== 'COMMON'
    ).length;

    // Convertir todos los bienes de esta categoría a COMMON
    const updatedTiles = currentState.tiles.map(t =>
      t.goodType === category ? { ...t, state: 'COMMON' as const } : t
    );

    const categoryNames: Record<GoodType, string> = {
      HEALTH: 'Bienes de la Salud',
      URBAN: 'Bienes Urbanos',
      KNOWLEDGE: 'Bienes del Conocimiento',
      ENVIRONMENT: 'Bienes Medioambientales'
    };

    addLog(
      'Ágora Asamblearia',
      `¡VOTO COLECTIVO TRIUNFANTE! La asamblea decidió comunalizar todos los ${categoryNames[category]}.`,
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: 'COLLECTIVE_VOTE',
        target: categoryNames[category],
        highlight: true
      }
    );

    // Desalojo pacífico de vuelta al tablero
    const exitCorners = [0, 10, 20, 30];
    currentState.players.forEach((p, idx) => {
      p.inAgora = false;
      p.roundsInAgora = 0;
      p.position = exitCorners[idx % exitCorners.length];
    });

    setState(prev => {
      const baseStats = prev.playerStats || createInitialPlayerStats(prev.players);
      const nextStats: Record<string, PlayerContributionStats> = { ...baseStats };
      const playerCount = prev.players.length || 1;
      const baseShare = Math.floor(convertedCount / playerCount);
      const remainder = convertedCount % playerCount;

      prev.players.forEach((p, idx) => {
        const cur = nextStats[p.id] || {
          playerId: p.id,
          playerName: p.name,
          color: p.color,
          commonsUnlocked: 0,
          publicsUnlocked: 0,
          cooperativeActions: 0,
          wellnessInvested: 0,
          totalResourcesEarned: p.wellness + p.legitimacy
        };
        const share = baseShare + (idx < remainder ? 1 : 0);
        nextStats[p.id] = {
          ...cur,
          commonsUnlocked: cur.commonsUnlocked + share,
          cooperativeActions: cur.cooperativeActions + 1
        };
      });

      const snap = buildRoundSnapshot(prev.round, prev.players, updatedTiles, nextStats);

      return {
        ...prev,
        tiles: updatedTiles,
        activeModal: null,
        playerStats: nextStats,
        performanceHistory: upsertRoundSnapshot(prev.performanceHistory, snap)
      };
    });

    if (checkEndGameConditions(updatedTiles, currentState.round)) {
      return;
    }
    advanceToNextTurn();
  }, []);

  // Turno de los Especuladores al final de la ronda
  const runSpeculatorsTurn = useCallback(() => {
    setState(prev => ({ ...prev, phase: 'SPECULATOR_TURN' }));

    const currentState = stateRef.current;
    const firstSpecPos = currentState.speculators[0]?.position ?? 0;
    playSound.speculatorAlert(getTileCoords3D(firstSpecPos));

    let attackTriggered = false;
    let detentionModalOpened = false;

    currentState.speculators.forEach((speculator, sIdx) => {
      // Lanzar dado para el especulador
      const prevPos = speculator.position;
      const roll = Math.floor(Math.random() * 6) + 1;
      const targetPos = (prevPos + roll) % 40;
      speculator.position = targetPos;

      const specSteps: { x: number; y: number; z: number }[] = [];
      for (let s = 1; s <= roll; s++) {
        specSteps.push(getTileCoords3D((prevPos + s) % 40));
      }
      playSound.speculatorMoveSequence(specSteps, sIdx * 180);

      addLog(speculator.name, `Se desplazó ${roll} casillas hasta la casilla ${targetPos}.`, 'HAZARD');

      // Comprobar si aterriza en una casilla con un personaje
      const victims = currentState.players.filter(p => p.position === targetPos);

      // Si hay 2 o más personajes juntos, se protegen mutuamente del especulador
      if (victims.length >= 2) {
        addLog(
          victims.map(v => v.name).join(' y '),
          `¡Protección Mutua! Al compartir casilla, bloquearon el ataque de ${speculator.name}.`,
          'SUCCESS',
          {
            category: 'COOPERATIVE',
            cooperativeAction: 'PROTECTION',
            actorColor: victims[0].color,
            target: speculator.name,
            highlight: true
          }
        );
      }

      // Si hay exactamente 1 personaje (sin protección de un segundo personaje en la casilla)
      if (victims.length === 1 && !attackTriggered) {
        const victim = victims[0];
        attackTriggered = true;

        // Decidir acción del especulador: Quitar puntos o Detención
        const actionDice = Math.floor(Math.random() * 6) + 1;
        const willDetain = Math.random() < 0.45;

        if (willDetain) {
          victim.isDetained = true;
          victim.detentionRoundsLeft = actionDice;
          victim.position = 18; // Centro de Detención
          playSound.detentionClang(getTileCoords3D(18));
          triggerHaptic.detention();
          addLog(speculator.name, `¡Atrapó a ${victim.name} y lo encerró en el Centro de Detención por ${actionDice} rondas!`, 'HAZARD');
          detentionModalOpened = true;
          pendingRoundAdvanceRef.current = true;
          setState(prev => ({
            ...prev,
            players: prev.players.map(p => p.id === victim.id ? { ...victim } : p),
            activeModal: 'DETENTION_RESCUE'
          }));
        } else {
          // Quitar puntos de Bienestar o Legitimidad
          playSound.speculatorAlert(getTileCoords3D(targetPos));
          triggerHaptic.speculatorHit();
          const stealType = Math.random() > 0.5 ? 'WELLNESS' : 'LEGITIMACY';
          if (stealType === 'WELLNESS') {
            const stolen = Math.min(victim.wellness - 1, actionDice);
            victim.wellness = Math.max(1, victim.wellness - stolen);
            addLog(speculator.name, `Explotó a ${victim.name} quitándole ${stolen} Puntos de Bienestar.`, 'HAZARD');
          } else {
            const stolen = Math.min(victim.legitimacy, actionDice);
            victim.legitimacy = Math.max(0, victim.legitimacy - stolen);
            addLog(speculator.name, `Desprestigiaron a ${victim.name} quitándole ${stolen} Puntos de Legitimidad.`, 'HAZARD');
          }
        }
      }
    });

    if (!detentionModalOpened) {
      setTimeout(() => {
        startNextRound();
      }, 1200);
    }
  }, []);

  // Transición a la siguiente ronda
  const startNextRound = useCallback(() => {
    const currentState = stateRef.current;
    const nextRound = currentState.round + 1;

    // Verificar si se alcanzó la ronda 20
    if (checkEndGameConditions(currentState.tiles, nextRound)) {
      return;
    }

    addLog('Máster de Juego', `--- COMIENZO DE LA RONDA ${nextRound} DE 20 ---`, 'INFO');

    // A partir de la ronda 2, se lee una Carta Global
    const globalCard = GLOBAL_CARDS[(nextRound - 2) % GLOBAL_CARDS.length];
    playSound.cardFlip();
    triggerHaptic.globalCard();

    setState(prev => {
      const stats = prev.playerStats || createInitialPlayerStats(prev.players);
      const completedSnap = buildRoundSnapshot(prev.round, prev.players, prev.tiles, stats);
      const nextSnap = buildRoundSnapshot(nextRound, prev.players, prev.tiles, stats);
      let nextHistory = upsertRoundSnapshot(prev.performanceHistory, completedSnap);
      nextHistory = upsertRoundSnapshot(nextHistory, nextSnap);

      return {
        ...prev,
        round: nextRound,
        activePlayerIndex: 0,
        currentDiceRoll: null,
        currentGlobalCard: globalCard,
        activeModal: 'GLOBAL_CARD',
        phase: 'GLOBAL_CARD',
        performanceHistory: nextHistory
      };
    });
  }, []);

  // Aplicar Carta Global y comenzar turnos
  const acknowledgeGlobalCard = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.currentGlobalCard) {
      const result = currentState.currentGlobalCard.effect(currentState);
      addLog('Carta Global', result.message, 'CARD');
    }

    setState(prev => ({
      ...prev,
      activeModal: null,
      phase: 'PLAYER_TURN_READY'
    }));

    // Si el primer jugador de la ronda es BOT, ejecutar turno automáticamente
    const firstPlayer = currentState.players[0];
    if (firstPlayer?.controller === 'BOT') {
      setTimeout(() => {
        rollDiceForCurrentPlayer();
      }, 700);
    }
  }, []);

  // Avanzar al siguiente jugador dentro de la ronda
  const advanceToNextTurn = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.phase === 'GAME_OVER') return;
    const nextIndex = currentState.activePlayerIndex + 1;

    // Registrar snapshot turno a turno de la evolución Comunes vs Privatizados
    setState(prev => {
      if (prev.phase === 'GAME_OVER') return prev;
      const endingPlayer = prev.players[prev.activePlayerIndex];
      const nextTurnHistory = appendTurnSnapshot(
        prev.turnHistory,
        prev.round,
        endingPlayer?.name ?? 'Turno',
        endingPlayer?.color,
        prev.tiles
      );

      if (nextIndex >= prev.players.length) {
        return {
          ...prev,
          turnHistory: nextTurnHistory
        };
      }

      return {
        ...prev,
        activePlayerIndex: nextIndex,
        currentDiceRoll: null,
        phase: 'PLAYER_TURN_READY',
        turnHistory: nextTurnHistory
      };
    });

    if (nextIndex >= currentState.players.length) {
      // Fin de la ronda para los jugadores -> Turno de los Especuladores
      runSpeculatorsTurn();
    } else {
      // Si el siguiente es BOT, tirar automáticamente
      const nextPlayer = currentState.players[nextIndex];
      if (nextPlayer?.controller === 'BOT') {
        setTimeout(() => {
          rollDiceForCurrentPlayer();
        }, 700);
      }
    }
  }, []);

  // Rescate solidario de un compañero en el Centro de Detención
  const rescueDetainedPlayer = useCallback((rescuerId: string, victimId: string) => {
    const currentState = stateRef.current;
    const victim = currentState.players.find(p => p.id === victimId);
    const rescuer = currentState.players.find(p => p.id === rescuerId);
    if (!victim || !rescuer) return;

    // Regla oficial de fianza:
    // Con ciudadanía / clase media o alta: 1 Bienestar por ronda
    // Sin ciudadanía / clase baja: 2 Bienestar por ronda
    const costPerRound = (victim.hasCitizenship && victim.socialClass !== 'BAJA') ? 1 : 2;
    const totalCost = victim.detentionRoundsLeft * costPerRound;

    if (rescuer.wellness > totalCost) {
      const updatedPlayers = currentState.players.map(p => {
        if (p.id === rescuer.id) {
          return { ...p, wellness: p.wellness - totalCost };
        }
        if (p.id === victim.id) {
          return { ...p, isDetained: false, detentionRoundsLeft: 0 };
        }
        return p;
      });

      playSound.unlockCommon(getTileCoords3D(18));
      triggerHaptic.rescue();
      recordPlayerMetric(rescuer.id, { cooperativeActions: 1, wellnessInvested: totalCost });
      addLog(
        rescuer.name,
        `¡Solidaridad Comunitaria! ${rescuer.name} pagó ${totalCost} pts de Bienestar de la caja común y rescató a ${victim.name} del Centro de Detención.`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: 'RESCUE',
          actorColor: rescuer.color,
          target: victim.name,
          highlight: true
        }
      );
      setState(prev => ({ ...prev, players: updatedPlayers, activeModal: null }));

      if (pendingRoundAdvanceRef.current) {
        pendingRoundAdvanceRef.current = false;
        setTimeout(() => {
          startNextRound();
        }, 300);
      }
    }
  }, []);

  // Votación de privatización obligatoria en la Tragedia de los Comunes
  const resolveTragedyOfCommons = useCallback((tileIdsToPrivatize: number[]) => {
    const currentState = stateRef.current;
    const affectedNames: string[] = [];
    const updatedTiles = currentState.tiles.map(tile => {
      if (tileIdsToPrivatize.includes(tile.id) && tile.category !== 'INALIENABLE_COMMON') {
        affectedNames.push(tile.name);
        return { ...tile, state: 'PRIVATE' as const };
      }
      return tile;
    });

    playSound.speculatorAlert();
    triggerHaptic.tragedy();
    addLog(
      'Voto Colectivo',
      affectedNames.length > 0
        ? `Tragedia de los Comunes: la mesa consensuó sacrificar ${affectedNames.join(', ')} para resistir el golpe neoliberal.`
        : 'Tragedia de los Comunes: no había bienes comunes que sacrificar.',
      'HAZARD',
      {
        category: 'COOPERATIVE',
        cooperativeAction: 'COLLECTIVE_VOTE',
        target: `${affectedNames.length} bienes`,
        highlight: false
      }
    );
    setState(prev => {
      const stats = prev.playerStats || createInitialPlayerStats(prev.players);
      const snap = buildRoundSnapshot(prev.round, prev.players, updatedTiles, stats);
      return {
        ...prev,
        tiles: updatedTiles,
        activeModal: null,
        performanceHistory: upsertRoundSnapshot(prev.performanceHistory, snap)
      };
    });
    advanceToNextTurn();
  }, []);

  // Aplicar Carta de Situación y continuar turno (afectado por el clima dinámico)
  const resolveSituationCard = useCallback(() => {
    const currentState = stateRef.current;
    const card = currentState.currentSituationCard;
    const player = currentState.players[currentState.activePlayerIndex];

    if (card && player) {
      const weather = resolveWeather(
        currentState.tiles,
        currentState.weatherMode,
        currentState.weatherIntensity ?? 0.85,
        currentState.round,
        currentState.activePlayerIndex
      );

      const isFavorable = weather.type === 'RAIN' || weather.type === 'SUNNY' || weather.type === 'TEMPERATE';
      const successRoll = Math.random();
      const successThreshold = isFavorable ? 0.08 : 0.32;

      let result = card.apply(player, currentState);

      if (isFavorable) {
        const wellDelta = (result.charUpdates.wellness ?? player.wellness) - player.wellness;
        const legDelta = (result.charUpdates.legitimacy ?? player.legitimacy) - player.legitimacy;
        if (wellDelta > 0) result.charUpdates.wellness = (result.charUpdates.wellness ?? player.wellness) + 1;
        if (legDelta > 0) result.charUpdates.legitimacy = (result.charUpdates.legitimacy ?? player.legitimacy) + 1;
        result.message += ` [Clima óptimo (${weather.label}): ¡Bonus de éxito +1 recurso!].`;
      } else if (successRoll < successThreshold) {
        result.message += ` [Clima adverso (${weather.label}): Superado con resiliencia vecinal].`;
      } else {
        result.message += ` [Clima adverso (${weather.label}): Desafío superado con mitigación parcial].`;
        if (result.charUpdates.wellness && result.charUpdates.wellness > player.wellness) {
          result.charUpdates.wellness = Math.max(player.wellness, result.charUpdates.wellness - 1);
        }
      }

      const updatedPlayer: Character = { ...player, ...result.charUpdates };
      const gained = Math.max(0, updatedPlayer.wellness - player.wellness) + Math.max(0, updatedPlayer.legitimacy - player.legitimacy);

      setState(prev => ({
        ...prev,
        players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? updatedPlayer : p),
        currentSituationCard: null,
        activeModal: null
      }));

      if (gained > 0) {
        recordPlayerMetric(player.id, { totalResourcesEarned: gained });
      }
      addLog('Carta de Situación', `[${card.title}] ${result.message}`, 'CARD', {
        actorColor: player.color
      });
    } else {
      setState(prev => ({
        ...prev,
        currentSituationCard: null,
        activeModal: null
      }));
    }

    advanceToNextTurn();
  }, []);

  // Burocracia: Convertir 1 bien privado en público pagando 6 bienestar
  const executeBureaucracy = useCallback((tileId: number) => {
    const currentState = stateRef.current;
    const player = currentState.players[currentState.activePlayerIndex];
    if (!player || player.wellness <= 6) {
      setState(prev => ({ ...prev, activeModal: null }));
      advanceToNextTurn();
      return;
    }

    const tile = currentState.tiles.find(t => t.id === tileId);
    if (tile && tile.state === 'PRIVATE') {
      player.wellness -= 6;
      const updatedTiles = currentState.tiles.map(t =>
        t.id === tile.id ? { ...t, state: 'PUBLIC' as const } : t
      );
      setState(prev => ({
        ...prev,
        tiles: updatedTiles,
        players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? { ...player } : p),
        activeModal: null
      }));
      playSound.unlockPublic(getTileCoords3D(tile.id));
      recordPlayerMetric(player.id, { publicsUnlocked: 1, cooperativeActions: 1, wellnessInvested: 6 }, updatedTiles);
      addLog(
        player.name,
        `Gestión Pública: ${player.name} utilizó la Burocracia para transformar "${tile.name}" en bien público por 6 pts de Bienestar.`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: 'BUROCRACIA',
          actorColor: player.color,
          target: tile.name,
          highlight: false
        }
      );
    } else {
      setState(prev => ({ ...prev, activeModal: null }));
    }
    advanceToNextTurn();
  }, []);

  // Crowdfunding: Donar 1-3 bienestar a un compañero y ganar +2 legitimidad por punto
  const executeCrowdfunding = useCallback((targetPlayerId: string, amount: number) => {
    const currentState = stateRef.current;
    const donor = currentState.players[currentState.activePlayerIndex];
    const receiver = currentState.players.find(p => p.id === targetPlayerId);
    if (!donor || !receiver || donor.wellness <= amount) {
      setState(prev => ({ ...prev, activeModal: null }));
      advanceToNextTurn();
      return;
    }

    donor.wellness -= amount;
    receiver.wellness += amount;
    donor.legitimacy += amount * 2;
    playSound.unlockCommon();

    setState(prev => ({
      ...prev,
      players: prev.players.map(p => {
        if (p.id === donor.id) return { ...donor };
        if (p.id === receiver.id) return { ...receiver };
        return p;
      }),
      activeModal: null
    }));

    recordPlayerMetric(donor.id, { cooperativeActions: 1, wellnessInvested: amount, totalResourcesEarned: amount * 2 });
    recordPlayerMetric(receiver.id, { totalResourcesEarned: amount });

    addLog(
      donor.name,
      `Apoyo Mutuo: ${donor.name} donó ${amount} pts de Bienestar a ${receiver.name} mediante Crowdfunding barrial (+${amount * 2} Legitimidad).`,
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: 'CROWDFUND',
        actorColor: donor.color,
        target: receiver.name,
        highlight: true
      }
    );
    advanceToNextTurn();
  }, []);

  // Toggle de cámara 3D
  const setCameraMode = useCallback((mode: GameEngineState['cameraMode']) => {
    playSound.uiClick();
    setState(prev => ({ ...prev, cameraMode: mode }));
  }, []);

  // Controles de audio y ambiente
  const toggleSound = useCallback(() => {
    setState(prev => {
      const nextEnabled = !prev.soundEnabled;
      audioManager.unlock();
      audioManager.setMuted(!nextEnabled);
      if (nextEnabled) {
        playSound.uiToggle(true);
      }
      return { ...prev, soundEnabled: nextEnabled };
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setState(prev => {
      const nextEnabled = !(prev.hapticsEnabled ?? true);
      hapticsManager.setEnabled(nextEnabled);
      playSound.uiToggle(nextEnabled);
      if (nextEnabled) {
        triggerHaptic.uiTap();
      }
      return { ...prev, hapticsEnabled: nextEnabled };
    });
  }, []);

  const togglePostProcessing = useCallback(() => {
    setState(prev => {
      const nextEnabled = !(prev.postProcessingEnabled ?? true);
      playSound.uiToggle(nextEnabled);
      return { ...prev, postProcessingEnabled: nextEnabled };
    });
  }, []);

  const setAmbientMode = useCallback((mode: AmbientMode) => {
    audioManager.unlock();
    playSound.uiClick();
    setState(prev => ({ ...prev, ambientMode: mode }));
  }, []);

  // Enviar mensaje rápido de chat cooperativo (durante votaciones o turnos)
  const sendCooperativeChat = useCallback((text: string, votingContext?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const currentState = stateRef.current;
    const active = currentState.players[currentState.activePlayerIndex];
    const sender =
      (active?.controller === 'HUMAN' ? active : currentState.players.find(p => p.controller === 'HUMAN')) ||
      active;
    if (!sender) return;

    playSound.uiClick();

    const msg: CooperativeChatMessage = {
      id: `chat_${Date.now()}_${Math.random()}`,
      senderName: sender.name,
      senderColor: sender.color,
      controller: sender.controller,
      text: trimmed,
      round: currentState.round,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      votingContext
    };

    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages.slice(-39), msg]
    }));

    // Respuesta cooperativa contextual de una compañera BOT si existen bots en la mesa
    const bots = currentState.players.filter(p => p.controller === 'BOT' && p.id !== sender.id);
    if (bots.length > 0) {
      const responder = bots[Math.floor(Math.random() * bots.length)];
      const lower = trimmed.toLowerCase();

      let replyText = '¡De acuerdo! Coordinemos nuestros puntos por el bien común.';
      if (lower.includes('parque') || lower.includes('park') || lower.includes('ambiente') || lower.includes('verde')) {
        replyText = '¡Apoyo total! Protejamos los bienes medioambientales y parques.';
      } else if (lower.includes('recurso') || lower.includes('pool') || lower.includes('junt') || lower.includes('bienestar')) {
        replyText = '¡Cuenten con mi Bienestar! Juntando fuerzas llegamos al Ágora.';
      } else if (lower.includes('rescat') || lower.includes('rescue') || lower.includes('fianza') || lower.includes('deten')) {
        replyText = '¡Nadie se queda atrás! Organicemos la fianza solidaria.';
      } else if (lower.includes('salud') || lower.includes('hospital') || lower.includes('health')) {
        replyText = 'Prioricemos los Bienes de la Salud para cuidar al grupo.';
      } else if (lower.includes('ágora') || lower.includes('agora') || lower.includes('insurrec')) {
        replyText = '¡Rumbo al Ágora Central! Juntemos Legitimidad colectiva.';
      }

      setTimeout(() => {
        playSound.notification();
        const botMsg: CooperativeChatMessage = {
          id: `chat_bot_${Date.now()}_${Math.random()}`,
          senderName: responder.name,
          senderColor: responder.color,
          controller: 'BOT',
          text: replyText,
          round: stateRef.current.round,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          votingContext
        };
        setState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages.slice(-39), botMsg]
        }));
      }, 700);
    }
  }, []);

  const setWeatherMode = useCallback((mode: WeatherMode) => {
    audioManager.unlock();
    playSound.uiClick();
    setState(prev => ({ ...prev, weatherMode: mode }));
  }, []);

  const setWeatherIntensity = useCallback((intensity: number) => {
    audioManager.unlock();
    const clamped = Math.min(1, Math.max(0.2, intensity));
    setState(prev => ({ ...prev, weatherIntensity: clamped }));
  }, []);

  const setTimeOfDayMode = useCallback((mode: TimeOfDayMode) => {
    playSound.uiClick();
    setState(prev => ({ ...prev, timeOfDayMode: mode }));
  }, []);

  const openDetentionRescue = useCallback(() => {
    playSound.modalOpen();
    setState(prev => ({ ...prev, activeModal: 'DETENTION_RESCUE' }));
  }, []);

  const closeModal = useCallback(() => {
    const activeModal = stateRef.current.activeModal;
    playSound.modalClose();
    setState(prev => ({ ...prev, activeModal: null }));

    if (activeModal === 'DETENTION_RESCUE' && pendingRoundAdvanceRef.current) {
      pendingRoundAdvanceRef.current = false;
      setTimeout(() => {
        startNextRound();
      }, 300);
      return;
    }

    if (activeModal === 'BUREAUCRACY' || activeModal === 'CROWDFUNDING') {
      advanceToNextTurn();
    }
  }, []);

  const dismissRecentAchievement = useCallback(() => {
    const nextQueued = achievementQueueRef.current.shift() ?? null;
    setState(prev => ({
      ...prev,
      recentAchievement: nextQueued
    }));
  }, []);

  const resetAchievements = useCallback(() => {
    playSound.uiClick();
    achievementQueueRef.current = [];
    const fresh = resetLocalAchievements();
    setState(prev => ({
      ...prev,
      achievements: fresh,
      recentAchievement: null
    }));
  }, []);

  const saveGameNow = useCallback((): SavedGameMetadata | null => {
    const currentState = stateRef.current;
    if (currentState.phase === 'TITLE' || currentState.phase === 'SETUP') {
      return getSavedGameMetadata();
    }
    const meta = saveGameToStorage(currentState, {
      autoResumeOnReload: true,
      pendingRoundAdvance: pendingRoundAdvanceRef.current
    });
    if (meta) {
      setSavedGameMeta(meta);
      playSound.uiClick();
    }
    return meta;
  }, []);

  const resumeSavedGame = useCallback((): boolean => {
    const loaded = loadSavedGameFromStorage({ force: true });
    if (!loaded) return false;
    playSound.uiClick();
    seenAchievementLogsRef.current = new Set(loaded.state.logs.map(l => l.id));
    prevCompletedSectorsRef.current = detectCompletedGoodCategories(loaded.state);
    prevVictoryTriggeredRef.current =
      loaded.state.phase === 'GAME_OVER' && loaded.state.gameResult === 'VICTORY';
    achievementQueueRef.current = [];
    pendingRoundAdvanceRef.current = loaded.pendingRoundAdvance;
    needsRecoveryRef.current = true;
    setSavedGameMeta(loaded.meta);
    setState(loaded.state);
    setResumeNonce(n => n + 1);
    return true;
  }, []);

  const pauseToTitle = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.phase !== 'TITLE' && currentState.phase !== 'SETUP') {
      const meta = saveGameToStorage(currentState, {
        autoResumeOnReload: false,
        pendingRoundAdvance: pendingRoundAdvanceRef.current
      });
      if (meta) setSavedGameMeta(meta);
    }
    playSound.uiClick();
    achievementQueueRef.current = [];
    setState(prev => ({
      ...prev,
      phase: 'TITLE',
      activeModal: null,
      recentAchievement: null
    }));
  }, []);

  const clearSavedGame = useCallback(() => {
    playSound.uiClick();
    clearSavedGameFromStorage();
    setSavedGameMeta(null);
  }, []);

  // Reanudar automáticamente turnos de Bots o transición de especuladores si la recarga ocurrió en mitad de un turno automático
  useEffect(() => {
    if (!needsRecoveryRef.current) return;

    const currentState = stateRef.current;
    if (currentState.activeModal) {
      needsRecoveryRef.current = false;
      return;
    }

    const activePlayer = currentState.players[currentState.activePlayerIndex];
    if (currentState.phase === 'PLAYER_TURN_READY' && activePlayer?.controller === 'BOT') {
      const timer = window.setTimeout(() => {
        needsRecoveryRef.current = false;
        rollDiceForCurrentPlayer();
      }, 700);
      return () => window.clearTimeout(timer);
    }

    if (currentState.phase === 'TILE_ACTION_DECISION' && activePlayer?.controller === 'BOT') {
      const timer = window.setTimeout(() => {
        needsRecoveryRef.current = false;
        advanceToNextTurn();
      }, 550);
      return () => window.clearTimeout(timer);
    }

    if (currentState.phase === 'SPECULATOR_TURN') {
      const timer = window.setTimeout(() => {
        needsRecoveryRef.current = false;
        startNextRound();
      }, 700);
      return () => window.clearTimeout(timer);
    }

    needsRecoveryRef.current = false;
  }, [resumeNonce, rollDiceForCurrentPlayer, advanceToNextTurn, startNextRound]);

  const resetToTitle = useCallback(() => {
    playSound.uiClick();
    achievementQueueRef.current = [];
    pendingRoundAdvanceRef.current = false;
    clearSavedGameFromStorage();
    setSavedGameMeta(null);
    setState(prev => ({
      ...prev,
      phase: 'TITLE',
      round: 1,
      activePlayerIndex: 0,
      activeModal: null,
      currentDiceRoll: null,
      recentAchievement: null,
      chatMessages: [],
      weatherMode: 'AUTO',
      weatherIntensity: 0.85,
      timeOfDayMode: 'AUTO',
      currentGlobalCard: null,
      currentSituationCard: null,
      gameResult: undefined,
      gameResultDetails: undefined,
      playerStats: undefined,
      performanceHistory: undefined,
      turnHistory: undefined
    }));
  }, []);

  return {
    state,
    savedGameMeta,
    startSetup,
    finalizeSetup,
    rollDiceForCurrentPlayer,
    unlockCurrentTile,
    passCurrentTile,
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
    addLog
  };
}
