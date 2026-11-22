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
  DifficultyLevel,
  GoodType, 
  GoodState,
  GlobalCard, 
  SituationCard,
  NeighborhoodDecision,
  GameLogEntry,
  CooperativeChatMessage,
  AmbientMode,
  WeatherMode,
  TimeOfDayMode,
  PlayerContributionStats,
  RoundPerformanceSnapshot,
  TurnCommonsSnapshot,
  CooperativeAchievement,
  DynamicWeatherEventKind,
  WeatherAdvancedConfig,
  ProbabilitySandboxConfig
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
  AutosaveReason,
  SavedGameMetadata,
  saveGameToStorage,
  loadSavedGameFromStorage,
  getSavedGameMetadata,
  clearSavedGameFromStorage
} from '../utils/gameStorage';
import {
  UNEXPECTED_CRISIS_TEMPLATES,
  evaluateUnexpectedCrisisTurn,
  getEffectiveResourceReward,
  getEffectiveUnlockCost
} from '../utils/crisisEngine';
import {
  DYNAMIC_WEATHER_TEMPLATES,
  evaluateDynamicWeatherTurn
} from '../utils/weatherEvents';
import {
  DEFAULT_WEATHER_ADVANCED_CONFIG,
  loadWeatherAdvancedConfig,
  saveWeatherAdvancedConfig
} from '../utils/weatherSettings';
import {
  applyReputationDelta,
  DEFAULT_REFERENDUM_REQUIRED_TRUST,
  formatSignedScore,
  getEffectiveBailCostPerRound,
  getEffectiveBureaucracyCost,
  getReputationProfile
} from '../utils/reputation';
import {
  appendTurnReplayFrame,
  buildTurnReplayFrame
} from '../utils/replay';
import { createMulberry32 } from '../utils/prng';
import {
  DEFAULT_PROBABILITY_SANDBOX_CONFIG,
  clampDiceFace,
  samplePlayerDiceFromSandbox,
  sampleSpeculatorStepFromSandbox
} from '../utils/probabilitySandbox';

export interface SetupMatchOptions {
  seedNumber?: number | null;
  dailyChallengeDate?: string | null;
  multiplayerRoomId?: string | null;
  multiplayerRoomCode?: string | null;
}

export type SandboxMutation =
  | { type: 'SET_ROUND'; round: number }
  | { type: 'ADJUST_ACTIVE_PLAYER'; wellnessDelta?: number; legitimacyDelta?: number }
  | { type: 'SET_SPECULATORS_COUNT'; count: number }
  | { type: 'TRIGGER_CRISIS'; templateId?: string }
  | { type: 'CLEAR_CRISIS' }
  | { type: 'TRIGGER_WEATHER'; kind?: DynamicWeatherEventKind }
  | { type: 'CLEAR_WEATHER' }
  | { type: 'CYCLE_TILE_STATE'; tileId: number }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyLevel }
  | { type: 'TOGGLE_PROBABILITY_SANDBOX'; enabled: boolean }
  | { type: 'UPDATE_PROBABILITY_SANDBOX'; patch: Partial<ProbabilitySandboxConfig> }
  | { type: 'MOVE_SPECULATOR'; speculatorId: number; deltaSteps: number };

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
    neighborhoodDecision: null,
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
    weatherAdvancedConfig: loadWeatherAdvancedConfig(),
    timeOfDayMode: 'AUTO',
    activeCrisis: null,
    turnsSinceLastCrisis: 0,
    activeWeatherEvent: null,
    turnsSinceLastWeatherEvent: 0,
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
    ],
    replayFrames: []
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
  const lastCrisisIdRef = useRef<string | null>(state.activeCrisis?.id ?? null);
  const lastWeatherKindRef = useRef<DynamicWeatherEventKind | null>(state.activeWeatherEvent?.kind ?? null);
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
  const pendingAutosaveRef = useRef<{ reason: AutosaveReason; endedTurnBy?: string } | null>(null);
  const seededRngRef = useRef<(() => number) | null>(
    restoredOnBootRef.current?.state.seedNumber != null
      ? createMulberry32(
          (restoredOnBootRef.current.state.seedNumber +
            restoredOnBootRef.current.state.round * 313 +
            restoredOnBootRef.current.state.logs.length * 17) >>>
            0
        )
      : null
  );
  const preSandboxSnapshotRef = useRef<GameEngineState | null>(null);
  const [canRestoreSandbox, setCanRestoreSandbox] = useState(false);

  const nextRand = useCallback(() => {
    if (seededRngRef.current) return seededRngRef.current();
    return Math.random();
  }, []);

  // Auto-guardado automático en LocalStorage al finalizar cada turno, ronda o hito de partida
  useEffect(() => {
    if (state.phase === 'TITLE' || state.phase === 'SETUP') return;
    const pending = pendingAutosaveRef.current;
    if (!pending) return;
    pendingAutosaveRef.current = null;

    const meta = saveGameToStorage(state, {
      autoResumeOnReload: true,
      pendingRoundAdvance: pendingRoundAdvanceRef.current,
      reason: pending.reason,
      endedTurnBy: pending.endedTurnBy
    });
    if (meta) {
      setSavedGameMeta(meta);
    }
  }, [state]);

  // Red de seguridad si el usuario recarga o cierra la pestaña en mitad de un turno
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = stateRef.current;
      if (current.phase === 'TITLE' || current.phase === 'SETUP') return;
      saveGameToStorage(current, {
        autoResumeOnReload: true,
        pendingRoundAdvance: pendingRoundAdvanceRef.current,
        reason: 'CHECKPOINT'
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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

  // Sincronización dinámica de la capa atmosférica de audio y mezcla Naturaleza Urbana según weatherMode
  useEffect(() => {
    const cond = resolveWeather(
      state.tiles,
      state.weatherMode,
      state.weatherIntensity ?? 0.85,
      state.round,
      state.activePlayerIndex,
      state.activeWeatherEvent
    );
    audioManager.setWeatherAudio(
      cond.type,
      cond.intensity,
      state.phase === 'TITLE' || state.phase === 'SETUP',
      state.weatherMode
    );
  }, [
    state.phase,
    state.weatherMode,
    state.weatherIntensity,
    state.tiles,
    state.round,
    state.activePlayerIndex,
    state.activeWeatherEvent
  ]);

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

        const achievementLogs: GameLogEntry[] = newlyUnlocked.map(ach => ({
          id: `log_ach_${ach.id}_${Date.now()}`,
          round: ach.unlockedAtRound ?? prev.round,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actor: ach.unlockedByPlayerName || 'Comunidad',
          actorColor: ach.unlockedByPlayerColor || '#facc15',
          message: `🏆 ¡Logro desbloqueado! "${ach.title}": ${ach.description}`,
          type: 'SUCCESS' as const,
          category: 'COOPERATIVE' as const,
          highlight: true
        }));

        if (!prev.recentAchievement) {
          if (restNew.length > 0) {
            achievementQueueRef.current.push(...restNew);
          }
          return {
            ...prev,
            achievements: nextAchievements,
            recentAchievement: firstNew,
            logs: [...achievementLogs, ...prev.logs]
          };
        } else {
          achievementQueueRef.current.push(...newlyUnlocked);
          return {
            ...prev,
            achievements: nextAchievements,
            logs: [...achievementLogs, ...prev.logs]
          };
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

  // Configuración completa desde el Asistente (soporta Semilla Diaria y Multijugador Online)
  const finalizeSetup = useCallback((
    selectedCharacters: { baseCharId: string; controller: 'HUMAN' | 'BOT' }[],
    rolls: SetupInitialRolls,
    options?: SetupMatchOptions
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

    const activeSeed = options?.seedNumber ?? null;
    seededRngRef.current = activeSeed !== null ? createMulberry32(activeSeed) : null;
    preSandboxSnapshotRef.current = null;
    setCanRestoreSandbox(false);

    const modeSuffix = options?.dailyChallengeDate
      ? ` · Reto Diario ${options.dailyChallengeDate}`
      : options?.multiplayerRoomCode
      ? ` · Sala Online ${options.multiplayerRoomCode}`
      : '';

    const initLog: GameLogEntry = {
      id: `log_init_${Date.now()}`,
      round: 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: 'Máster de Juego',
      message: `Partida iniciada en dificultad ${rolls.difficulty} (${rolls.speculatorsCount} Especuladores en juego${modeSuffix}). ¡Ronda 1!`,
      type: 'INFO'
    };

    const initialReplayFrame = buildTurnReplayFrame({
      prevFrames: [],
      logs: [initLog],
      round: 1,
      actorId: 'setup',
      actorName: 'Tablero Inicial',
      actorColor: '#14b8a6',
      activePlayerIndex: 0,
      diceRoll: null,
      players,
      speculators,
      tiles,
      fallbackSummary: `Inicio en dificultad ${rolls.difficulty}`
    });

    lastCrisisIdRef.current = null;
    lastWeatherKindRef.current = null;
    pendingAutosaveRef.current = { reason: 'CHECKPOINT', endedTurnBy: 'Inicio de Partida' };
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
      neighborhoodDecision: null,
      activeCrisis: null,
      turnsSinceLastCrisis: 0,
      activeWeatherEvent: null,
      turnsSinceLastWeatherEvent: 0,
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
      replayFrames: [initialReplayFrame],
      gameResult: undefined,
      gameResultDetails: undefined,
      isSandboxSession: false,
      probabilitySandbox: undefined,
      dailyChallengeDate: options?.dailyChallengeDate ?? null,
      seedNumber: activeSeed,
      multiplayerRoomId: options?.multiplayerRoomId ?? null,
      multiplayerRoomCode: options?.multiplayerRoomCode ?? null,
      logs: [initLog],
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
      pendingAutosaveRef.current = { reason: 'GAME_OVER', endedTurnBy: 'Victoria Comunitaria' };
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
        const finalReplayFrame = buildTurnReplayFrame({
          prevFrames: prev.replayFrames,
          logs: prev.logs,
          round: Math.min(prev.round, 20),
          actorId: prev.players[prev.activePlayerIndex]?.id ?? 'victory',
          actorName: 'Victoria Comunitaria',
          actorColor: '#10b981',
          activePlayerIndex: prev.activePlayerIndex,
          diceRoll: prev.currentDiceRoll,
          players: prev.players,
          speculators: prev.speculators,
          tiles,
          fallbackSummary: '¡Todos los bienes comunes recuperados!',
          activeWeatherTitle: prev.activeWeatherEvent?.title,
          activeCrisisTitle: prev.activeCrisis?.title
        });
        return {
          ...prev,
          phase: 'GAME_OVER',
          gameResult: 'VICTORY',
          gameResultDetails: '¡Victoria Comunitaria Total! Habéis desprivatizado y comunalizado todos los bienes de la sociedad. ¡La felicidad radical es una realidad!',
          performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
          turnHistory: nextTurnHistory,
          replayFrames: appendTurnReplayFrame(prev.replayFrames, finalReplayFrame)
        };
      });
      return true;
    }

    // Condición al terminar la ronda 20
    if (round > 20) {
      pendingAutosaveRef.current = { reason: 'GAME_OVER', endedTurnBy: 'Cierre de Ronda 20' };
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
          const finalReplayFrame = buildTurnReplayFrame({
            prevFrames: prev.replayFrames,
            logs: prev.logs,
            round: 20,
            actorId: 'draw',
            actorName: 'Cierre de Partida',
            actorColor: '#38bdf8',
            activePlayerIndex: prev.activePlayerIndex,
            diceRoll: prev.currentDiceRoll,
            players: prev.players,
            speculators: prev.speculators,
            tiles,
            fallbackSummary: 'Empate social al completar la ronda 20',
            activeWeatherTitle: prev.activeWeatherEvent?.title,
            activeCrisisTitle: prev.activeCrisis?.title
          });
          return {
            ...prev,
            phase: 'GAME_OVER',
            gameResult: 'DRAW',
            gameResultDetails: '¡Empate social! La sociedad no tiene ningún bien privado, aunque aún conviven bienes públicos y comunes. ¡Un gran avance hacia el bien común!',
            performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
            turnHistory: nextTurnHistory,
            replayFrames: appendTurnReplayFrame(prev.replayFrames, finalReplayFrame)
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
          const finalReplayFrame = buildTurnReplayFrame({
            prevFrames: prev.replayFrames,
            logs: prev.logs,
            round: 20,
            actorId: 'defeat',
            actorName: 'Cierre de Partida',
            actorColor: '#f43f5e',
            activePlayerIndex: prev.activePlayerIndex,
            diceRoll: prev.currentDiceRoll,
            players: prev.players,
            speculators: prev.speculators,
            tiles,
            fallbackSummary: `Fin de las 20 rondas (${privateCount} privatizados)`,
            activeWeatherTitle: prev.activeWeatherEvent?.title,
            activeCrisisTitle: prev.activeCrisis?.title
          });
          return {
            ...prev,
            phase: 'GAME_OVER',
            gameResult: 'DEFEAT',
            gameResultDetails: `Fin del tiempo (20 rondas). Quedan ${privateCount} bienes en manos privadas. Los Especuladores han frenado la transformación radical.`,
            performanceHistory: upsertRoundSnapshot(prev.performanceHistory, finalSnap),
            turnHistory: nextTurnHistory,
            replayFrames: appendTurnReplayFrame(prev.replayFrames, finalReplayFrame)
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
    const repUpdate = applyReputationDelta(
      { ...player, wellness: nextWellness, roundsInAgora: nextRoundsInAgora },
      1,
      'Sostuvo el Ágora esperando refuerzos',
      currentState.round
    );

    setState(prev => ({
      ...prev,
      players: prev.players.map((p, idx) =>
        idx === prev.activePlayerIndex ? repUpdate.player : p
      )
    }));

    playSound.unlockPublic({ x: 0, y: 0.5, z: 0 });
    addLog(
      player.name,
      `Mantiene la asamblea en el Ágora Central esperando refuerzos (-1 Bienestar, +1 Reputación Vecinal, ronda ${nextRoundsInAgora}/3).`,
      'INFO'
    );
    advanceToNextTurn();
  }, []);

  // Tirar dado para el jugador activo (audio espacial ubicado en el dado 3D)
  const rollDiceForCurrentPlayer = useCallback((forcedRollOverride?: unknown) => {
    const currentState = stateRef.current;
    if (currentState.phase !== 'PLAYER_TURN_READY') return;

    const currentPlayer = currentState.players[currentState.activePlayerIndex];
    if (!currentPlayer) return;

    // Gestión de retención antes de lanzar el dado (evita tirada fantasma si sigue detenido)
    let activePlayer = currentPlayer;
    if (activePlayer.isDetained) {
      if (activePlayer.detentionRoundsLeft > 1) {
        const nextRoundsLeft = activePlayer.detentionRoundsLeft - 1;
        const detainedPlayer: Character = {
          ...activePlayer,
          detentionRoundsLeft: nextRoundsLeft
        };
        addLog(
          detainedPlayer.name,
          `Continúa en el Centro de Detención (quedan ${nextRoundsLeft} ${nextRoundsLeft === 1 ? 'ronda' : 'rondas'}).`,
          'HAZARD'
        );
        setState(prev => ({
          ...prev,
          players: prev.players.map((p, idx) =>
            idx === prev.activePlayerIndex ? detainedPlayer : p
          )
        }));
        advanceToNextTurn();
        return;
      } else {
        activePlayer = {
          ...activePlayer,
          isDetained: false,
          detentionRoundsLeft: 0
        };
        addLog(
          activePlayer.name,
          '¡Cumplió su condena y sale del Centro de Detención!',
          'ACTION'
        );
        setState(prev => ({
          ...prev,
          players: prev.players.map((p, idx) =>
            idx === prev.activePlayerIndex ? activePlayer : p
          )
        }));
      }
    }

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
        const bailInfo = getEffectiveBailCostPerRound(detainedTeammate, activePlayer);
        const totalCost = detainedTeammate.detentionRoundsLeft * bailInfo.effectivePerRound;
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
    const hasForcedRoll =
      typeof forcedRollOverride === 'number' &&
      Number.isFinite(forcedRollOverride) &&
      Boolean(currentState.isSandboxSession || currentState.probabilitySandbox?.enabled);
    const roll = hasForcedRoll
      ? clampDiceFace(forcedRollOverride as number)
      : currentState.probabilitySandbox?.enabled
      ? samplePlayerDiceFromSandbox(nextRand, currentState.probabilitySandbox)
      : Math.floor(nextRand() * 6) + 1;

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
      const startWellnessBonus = activePlayer.id === 'moha' ? 2 : 1;
      activePlayer.wellness += startWellnessBonus;
      recordPlayerMetric(activePlayer.id, { totalResourcesEarned: startWellnessBonus });
      addLog(
        activePlayer.name,
        `Completó una vuelta al tablero pasando por SALIDA (+${startWellnessBonus} Bienestar${activePlayer.id === 'moha' ? ' · Derecho a la Ciudad' : ''}).`,
        'SUCCESS'
      );
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
      const randomCard = SITUATION_CARDS[Math.floor(nextRand() * SITUATION_CARDS.length)];
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
        const startWellness = player.id === 'moha' ? 2 : 1;
        player.wellness += startWellness;
        player.legitimacy += 1;
        playSound.unlockPublic(getTileCoords3D(tile.id));
        recordPlayerMetric(player.id, { totalResourcesEarned: startWellness + 1 });
        addLog(
          player.name,
          `Descansa en SALIDA (+${startWellness} Bienestar, +1 Legitimidad${player.id === 'moha' ? ' · Derecho a la Ciudad' : ''}).`,
          'SUCCESS'
        );
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
        const burCost = getEffectiveBureaucracyCost(player).effectiveCost;
        if (player.controller === 'BOT') {
          if (player.wellness > burCost + 1 && privateTiles.length > 0) {
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
        // Pierdes 2 Bienestar, ganas 2 Legitimidad y +2 Reputación Vecinal
        player.wellness = Math.max(1, player.wellness - 2);
        player.legitimacy += 2;
        const repRes = applyReputationDelta(
          player,
          2,
          'Participación en Asamblea barrial',
          stateRef.current.round
        );
        const nextPlayer = repRes.player;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === nextPlayer.id ? nextPlayer : p)
        }));
        playSound.unlockCommon(getTileCoords3D(tile.id));
        recordPlayerMetric(nextPlayer.id, { cooperativeActions: 1, totalResourcesEarned: 2 });
        addLog(
          nextPlayer.name,
          `Participó en la Asamblea barrial (-2 Bienestar, +2 Legitimidad, +2 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
          'SUCCESS',
          {
            category: 'COOPERATIVE',
            cooperativeAction: 'COLLECTIVE_VOTE',
            actorColor: nextPlayer.color,
            target: 'Asamblea Barrial',
            highlight: false
          }
        );
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'BANK') {
        // Pierdes 6 Puntos de Bienestar y -2 Reputación Vecinal
        player.wellness = Math.max(1, player.wellness - 6);
        const repRes = applyReputationDelta(
          player,
          -2,
          'Operación con Banca privada especulativa',
          stateRef.current.round
        );
        const nextPlayer = repRes.player;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === nextPlayer.id ? nextPlayer : p)
        }));
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.speculatorHit();
        addLog(
          nextPlayer.name,
          `¡Cayó en el Banco privado! Pierde 6 Bienestar y -2 Reputación Vecinal (${formatSignedScore(repRes.nextScore)}).`,
          'HAZARD'
        );
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'CASINO') {
        // Pierdes 6 Puntos de Legitimidad y -2 Reputación Vecinal
        player.legitimacy = Math.max(0, player.legitimacy - 6);
        const repRes = applyReputationDelta(
          player,
          -2,
          'Apuesta individual en Casino',
          stateRef.current.round
        );
        const nextPlayer = repRes.player;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === nextPlayer.id ? nextPlayer : p)
        }));
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.speculatorHit();
        addLog(
          nextPlayer.name,
          `¡Cayó en el Casino! Pierde 6 Legitimidad y -2 Reputación Vecinal (${formatSignedScore(repRes.nextScore)}).`,
          'HAZARD'
        );
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'DETENTION_CENTER') {
        player.isDetained = true;
        player.detentionRoundsLeft = 1;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === player.id ? { ...player } : p)
        }));
        playSound.detentionClang(getTileCoords3D(tile.id));
        triggerHaptic.detention();
        addLog(player.name, 'Retenido en el Centro de Detención durante 1 ronda.', 'HAZARD');
        advanceToNextTurn();
        return;
      }
      if (tile.specialType === 'TRAGEDY_OF_COMMONS') {
        const commonTiles = stateRef.current.tiles.filter(
          t => t.state === 'COMMON' && t.category !== 'INALIENABLE_COMMON'
        );
        playSound.speculatorAlert(getTileCoords3D(tile.id));
        triggerHaptic.tragedy();

        if (commonTiles.length === 0) {
          addLog(
            player.name,
            'Tragedia de los Comunes: no había bienes comunes que sacrificar.',
            'INFO'
          );
          advanceToNextTurn();
          return;
        }

        addLog(
          player.name,
          '¡Ha caído en la Tragedia de los Comunes! Comienza la asamblea de emergencia para consensuar privatizaciones forzadas.',
          'HAZARD',
          { category: 'HAZARD', highlight: true }
        );

        if (player.controller === 'BOT') {
          const autoSelectedIds = commonTiles.slice(0, 3).map(t => t.id);
          setTimeout(() => {
            resolveTragedyOfCommons(autoSelectedIds);
          }, 650);
          return;
        }

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
      setState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === player.id ? { ...player } : p)
      }));
      playSound.unlockCommon(getTileCoords3D(tile.id));
      if (player.controller === 'HUMAN') triggerHaptic.commonUnlocked();
      recordPlayerMetric(player.id, { totalResourcesEarned: 4 });
      addLog(player.name, `Visita el espacio común "${tile.name}" (+2 Bienestar, +2 Legitimidad).`, 'SUCCESS');
      advanceToNextTurn();
      return;
    }

    // D. Casilla de Recurso (Salud, Urbano, Conocimiento, Medioambiente)
    if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
      const activeDecision = stateRef.current.neighborhoodDecision;
      if (
        player.controller === 'BOT' &&
        activeDecision &&
        activeDecision.targetTileIds.includes(tile.id) &&
        !activeDecision.votesCast.includes(player.id)
      ) {
        const repProfile = getReputationProfile(player);
        const requiredTrust = activeDecision.requiredTrust ?? DEFAULT_REFERENDUM_REQUIRED_TRUST;
        const prevTrust = activeDecision.trustAccumulated ?? 0;
        const nextTrustAccumulated = Number((prevTrust + repProfile.voteWeight).toFixed(2));
        const nextVotesCast = [...activeDecision.votesCast, player.id];
        const isQuorumReached = nextTrustAccumulated >= requiredTrust;
        const legitimacyEarned = repProfile.voteWeight >= 1.5 ? 3 : 2;

        const repRes = applyReputationDelta(
          {
            ...player,
            wellness: Math.min(10, player.wellness + 2),
            legitimacy: player.legitimacy + legitimacyEarned
          },
          2,
          'Participación en referéndum barrial',
          stateRef.current.round
        );
        player = repRes.player;

        let updatedTiles = stateRef.current.tiles.map(t => ({ ...t }));
        if (isQuorumReached) {
          const targetResource = updatedTiles.find(
            t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state !== 'COMMON'
          );
          if (targetResource) {
            targetResource.state = 'COMMON';
            targetResource.transformedById = 'neighborhood_referendum';
            targetResource.transformedByName = 'Referéndum Vecinal';
            targetResource.transformedAtRound = stateRef.current.round;
            if (targetResource.id === tile.id) {
              tile = targetResource;
            }
          }
        }

        const nextDecision = isQuorumReached
          ? null
          : {
              ...activeDecision,
              votesCast: nextVotesCast,
              trustAccumulated: nextTrustAccumulated,
              requiredTrust
            };

        setState(prev => ({
          ...prev,
          players: prev.players.map(p => (p.id === player.id ? player : p)),
          tiles: isQuorumReached ? updatedTiles : prev.tiles,
          neighborhoodDecision: nextDecision
        }));

        addLog(
          'Decisión Barrial',
          `${player.name} (${repProfile.label} · confianza ${repProfile.trustPercent}%, peso ${repProfile.voteWeight}x) votó in-situ (+2 Bienestar, +${legitimacyEarned} Legitimidad, +2 Rep. Vecinal · quórum ${nextTrustAccumulated.toFixed(2)}/${requiredTrust.toFixed(1)}).`,
          'SUCCESS',
          {
            category: 'COOPERATIVE',
            cooperativeAction: 'COLLECTIVE_VOTE',
            actorColor: player.color
          }
        );

        if (isQuorumReached) {
          addLog(
            'Decisión Barrial',
            `¡Quórum de confianza alcanzado (${nextTrustAccumulated.toFixed(2)}/${requiredTrust.toFixed(1)})! El referéndum barrial triunfó y consolidó un nuevo Bien Común en el territorio.`,
            'SUCCESS'
          );
          if (checkEndGameConditions(updatedTiles, stateRef.current.round)) {
            return;
          }
        }
      }

      if (tile.state === 'COMMON') {
        const reward = getEffectiveResourceReward(
          tile,
          2,
          2,
          stateRef.current.activeCrisis,
          player,
          stateRef.current.activeWeatherEvent
        );
        player.wellness += reward.wellness;
        player.legitimacy += reward.legitimacy;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === player.id ? { ...player } : p)
        }));
        playSound.unlockCommon(getTileCoords3D(tile.id));
        recordPlayerMetric(player.id, { totalResourcesEarned: reward.wellness + reward.legitimacy });
        const crisisNote =
          reward.crisisDelta !== 0
            ? ` (efecto crisis ${reward.crisisDelta > 0 ? `+${reward.crisisDelta}` : reward.crisisDelta})`
            : '';
        const weatherNote =
          reward.weatherDelta !== 0
            ? ` [Clima: ${reward.weatherDelta > 0 ? `+${reward.weatherDelta}` : reward.weatherDelta}]`
            : '';
        addLog(
          player.name,
          `Disfruta del bien común "${tile.name}" (+${reward.wellness} Bienestar, +${reward.legitimacy} Legitimidad)${crisisNote}${weatherNote}.`,
          'SUCCESS'
        );
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
    const costInfo = getEffectiveUnlockCost(
      tile,
      bot,
      stateRef.current.activeCrisis,
      stateRef.current.activeWeatherEvent
    );
    const neededWellness = costInfo.effectiveCost;

      if (bot.wellness > neededWellness && (tile.state === 'PRIVATE' || tile.state === 'PUBLIC')) {
      // El bot desbloquea el bien solidariamente
      bot.wellness = Math.max(0, bot.wellness - neededWellness);
      const nextState: GoodState = tile.state === 'PRIVATE' ? 'PUBLIC' : 'COMMON';

      // Bonificadores únicos al comunizar (Matsuko, Whina, Yayo)
      let bonusNote = '';
      if (nextState === 'COMMON') {
        if (bot.id === 'matsuko') {
          bot.legitimacy += 1;
          bonusNote = ' · +1 Legitimidad (Agitación Cultural)';
        } else if (bot.id === 'whina' && (tile.goodType === 'HEALTH' || tile.goodType === 'ENVIRONMENT')) {
          bot.legitimacy += 1;
          bonusNote = ' · +1 Legitimidad (Sabiduría Ancestral)';
        } else if (bot.id === 'yayo' && tile.goodType === 'ENVIRONMENT') {
          bot.wellness += 1;
          bonusNote = ' · +1 Bienestar (Economía Ecofeminista)';
        }
      }

      const repDelta = nextState === 'COMMON' ? 3 : 2;
      const repRes = applyReputationDelta(
        bot,
        repDelta,
        nextState === 'COMMON'
          ? `Comunalizó "${tile.name}"`
          : `Desprivatizó "${tile.name}" a Público`,
        stateRef.current.round
      );
      const updatedBot = repRes.player;

      const updatedTiles = stateRef.current.tiles.map(t =>
        t.id === tile.id
          ? {
              ...t,
              state: nextState,
              transformedById: updatedBot.id,
              transformedByName: updatedBot.name,
              transformedAtRound: stateRef.current.round
            }
          : t
      );
      setState(prev => ({
        ...prev,
        tiles: updatedTiles,
        players: prev.players.map(p => p.id === updatedBot.id ? updatedBot : p)
      }));

      if (nextState === 'COMMON') playSound.unlockCommon(getTileCoords3D(tile.id));
      else playSound.unlockPublic(getTileCoords3D(tile.id));

      recordPlayerMetric(
        updatedBot.id,
        {
          commonsUnlocked: nextState === 'COMMON' ? 1 : 0,
          publicsUnlocked: nextState === 'PUBLIC' ? 1 : 0,
          cooperativeActions: 1,
          wellnessInvested: neededWellness
        },
        updatedTiles
      );

      const crisisCostNote =
        costInfo.crisisDelta !== 0
          ? ` [Crisis: ${costInfo.crisisDelta > 0 ? `+${costInfo.crisisDelta}` : costInfo.crisisDelta} coste]`
          : '';
      const weatherCostNote =
        costInfo.weatherDelta !== 0
          ? ` [Clima: ${costInfo.weatherDelta > 0 ? `+${costInfo.weatherDelta}` : costInfo.weatherDelta} coste]`
          : '';
      const repCostNote =
        costInfo.reputationDelta !== 0
          ? ` [Reputación: ${costInfo.reputationDelta > 0 ? `+${costInfo.reputationDelta}` : costInfo.reputationDelta} coste]`
          : '';
      addLog(
        updatedBot.name,
        `[Acción Cooperativa] ${updatedBot.name} desprivatizó "${tile.name}" convirtiéndolo en ${nextState === 'COMMON' ? 'Bien Común' : 'Bien Público'} (+${repDelta} Rep. Vecinal)${crisisCostNote}${weatherCostNote}${repCostNote}${bonusNote}.`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: nextState === 'COMMON' ? 'COMMON_UNLOCK' : 'PUBLIC_UNLOCK',
          actorColor: updatedBot.color,
          target: tile.name,
          highlight: nextState === 'COMMON'
        }
      );
    } else {
      // El bot pasa y gana puntos si es público
      if (tile.state === 'PUBLIC') {
        const reward = getEffectiveResourceReward(
          tile,
          1,
          1,
          stateRef.current.activeCrisis,
          bot,
          stateRef.current.activeWeatherEvent
        );
        bot.wellness += reward.wellness;
        bot.legitimacy += reward.legitimacy;
        setState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === bot.id ? { ...bot } : p)
        }));
        recordPlayerMetric(bot.id, { totalResourcesEarned: reward.wellness + reward.legitimacy });
        const weatherNote =
          reward.weatherDelta !== 0
            ? ` [Clima: ${reward.weatherDelta > 0 ? `+${reward.weatherDelta}` : reward.weatherDelta}]`
            : '';
        addLog(
          bot.name,
          `[BOT] No desbloqueó "${tile.name}" y obtiene +${reward.wellness} Bienestar y +${reward.legitimacy} Legitimidad${weatherNote}.`,
          'INFO'
        );
      } else {
        addLog(bot.name, `[BOT] No tiene suficiente Bienestar para desprivatizar "${tile.name}".`, 'INFO');
      }
    }

    setTimeout(() => {
      advanceToNextTurn();
    }, 400);
  }, []);

  // Acción manual de un jugador humano: Desbloquear el bien (10 pts ± modificador de crisis)
  const unlockCurrentTile = useCallback(() => {
    const currentState = stateRef.current;
    const player = currentState.players[currentState.activePlayerIndex];
    const tile = currentState.tiles.find(t => t.id === player.position);
    if (!tile || !tile.goodType) return;

    const costInfo = getEffectiveUnlockCost(
      tile,
      player,
      currentState.activeCrisis,
      currentState.activeWeatherEvent
    );
    const neededWellness = costInfo.effectiveCost;
    const skill = costInfo.skillPoints;
    if (player.wellness < neededWellness) return;

    player.wellness = Math.max(0, player.wellness - neededWellness);
    const nextState: GoodState = tile.state === 'PRIVATE' ? 'PUBLIC' : 'COMMON';

    // Bonificadores únicos al comunizar (Matsuko, Whina, Yayo)
    let bonusNote = '';
    if (nextState === 'COMMON') {
      if (player.id === 'matsuko') {
        player.legitimacy += 1;
        bonusNote = ' · +1 Legitimidad (Agitación Cultural)';
      } else if (player.id === 'whina' && (tile.goodType === 'HEALTH' || tile.goodType === 'ENVIRONMENT')) {
        player.legitimacy += 1;
        bonusNote = ' · +1 Legitimidad (Sabiduría Ancestral)';
      } else if (player.id === 'yayo' && tile.goodType === 'ENVIRONMENT') {
        player.wellness += 1;
        bonusNote = ' · +1 Bienestar (Economía Ecofeminista)';
      }
    }

    const repDelta = nextState === 'COMMON' ? 3 : 2;
    const repRes = applyReputationDelta(
      player,
      repDelta,
      nextState === 'COMMON'
        ? `Comunalizó "${tile.name}"`
        : `Desprivatizó "${tile.name}" a Público`,
      currentState.round
    );
    const updatedPlayer = repRes.player;

    const updatedTiles = currentState.tiles.map(t =>
      t.id === tile.id
        ? {
            ...t,
            state: nextState,
            transformedById: updatedPlayer.id,
            transformedByName: updatedPlayer.name,
            transformedAtRound: currentState.round
          }
        : t
    );
    setState(prev => ({
      ...prev,
      tiles: updatedTiles,
      players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? updatedPlayer : p)
    }));

    if (nextState === 'COMMON') {
      playSound.unlockCommon(getTileCoords3D(tile.id));
      triggerHaptic.commonUnlocked();
    } else {
      playSound.unlockPublic(getTileCoords3D(tile.id));
      triggerHaptic.uiTap();
    }

    recordPlayerMetric(
      updatedPlayer.id,
      {
        commonsUnlocked: nextState === 'COMMON' ? 1 : 0,
        publicsUnlocked: nextState === 'PUBLIC' ? 1 : 0,
        cooperativeActions: 1,
        wellnessInvested: neededWellness
      },
      updatedTiles
    );

    const crisisNote =
      costInfo.crisisDelta !== 0
        ? `, Crisis ${costInfo.crisisDelta > 0 ? `+${costInfo.crisisDelta}` : costInfo.crisisDelta}`
        : '';
    const weatherCostNote =
      costInfo.weatherDelta !== 0
        ? `, Clima ${costInfo.weatherDelta > 0 ? `+${costInfo.weatherDelta}` : costInfo.weatherDelta}`
        : '';
    const repCostNote =
      costInfo.reputationDelta !== 0
        ? `, Rep. ${costInfo.reputationDelta > 0 ? `+${costInfo.reputationDelta}` : costInfo.reputationDelta}`
        : '';
    addLog(
      updatedPlayer.name,
      `¡Bien Desprivatizado! ${updatedPlayer.name} transformó "${tile.name}" en ${nextState === 'COMMON' ? 'Bien Común' : 'Bien Público'} (${neededWellness} Bienestar + ${skill} Habilidad${crisisNote}${weatherCostNote}${repCostNote}${bonusNote}) · +${repDelta} Rep. Vecinal (${formatSignedScore(repRes.nextScore)}).`,
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: nextState === 'COMMON' ? 'COMMON_UNLOCK' : 'PUBLIC_UNLOCK',
        actorColor: updatedPlayer.color,
        target: tile.name,
        highlight: nextState === 'COMMON'
      }
    );

    if (repRes.tierChanged) {
      const nextProf = getReputationProfile(repRes.nextScore);
      addLog(
        'Reputación Vecinal',
        `${updatedPlayer.name} alcanza el nivel "${nextProf.label}" (${formatSignedScore(repRes.nextScore)} · transacciones ${nextProf.transactionCostDelta >= 0 ? `+${nextProf.transactionCostDelta}` : nextProf.transactionCostDelta}, voto ${nextProf.voteWeight}x).`,
        repRes.nextScore >= 0 ? 'SUCCESS' : 'HAZARD'
      );
    }

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

    const canTransform =
      tile &&
      (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') &&
      (tile.state === 'PRIVATE' || tile.state === 'PUBLIC');
    const unlockCost = canTransform
      ? getEffectiveUnlockCost(tile, player, currentState.activeCrisis, currentState.activeWeatherEvent).effectiveCost
      : Infinity;
    const passedDespiteFunds = Boolean(canTransform && player.wellness >= unlockCost);

    if (tile?.state === 'PUBLIC') {
      const reward = getEffectiveResourceReward(
        tile,
        1,
        1,
        currentState.activeCrisis,
        player,
        currentState.activeWeatherEvent
      );
      player.wellness += reward.wellness;
      player.legitimacy += reward.legitimacy;

      const repRes = passedDespiteFunds
        ? applyReputationDelta(
            player,
            -2,
            `Cobró renta individual en "${tile.name}" pudiendo comunalizar`,
            currentState.round
          )
        : { player, nextScore: getReputationProfile(player).score, tierChanged: false };

      setState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === repRes.player.id ? repRes.player : p)
      }));
      playSound.unlockPublic(getTileCoords3D(tile.id));
      recordPlayerMetric(player.id, { totalResourcesEarned: reward.wellness + reward.legitimacy });
      const weatherNote =
        reward.weatherDelta !== 0
          ? ` [Clima: ${reward.weatherDelta > 0 ? `+${reward.weatherDelta}` : reward.weatherDelta}]`
          : '';
      const selfishNote = passedDespiteFunds
        ? ` · -2 Reputación Vecinal por priorizar renta propia (${formatSignedScore(repRes.nextScore)})`
        : '';
      addLog(
        player.name,
        `Pasa en el bien público "${tile.name}" y recibe +${reward.wellness} Bienestar y +${reward.legitimacy} Legitimidad${weatherNote}${selfishNote}.`,
        passedDespiteFunds ? 'HAZARD' : 'INFO'
      );
      if (repRes.tierChanged) {
        const nextProf = getReputationProfile(repRes.nextScore);
        addLog(
          'Reputación Vecinal',
          `${player.name} desciende a "${nextProf.label}" (${formatSignedScore(repRes.nextScore)} · recargo ${nextProf.transactionCostDelta >= 0 ? `+${nextProf.transactionCostDelta}` : nextProf.transactionCostDelta}, voto ${nextProf.voteWeight}x).`,
          'HAZARD'
        );
      }
    } else if (passedDespiteFunds && tile) {
      const repRes = applyReputationDelta(
        player,
        -1,
        `Evitó desprivatizar "${tile.name}" teniendo recursos`,
        currentState.round
      );
      setState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === repRes.player.id ? repRes.player : p)
      }));
      addLog(
        player.name,
        `Pasa su turno sin desprivatizar "${tile.name}" disponiendo de Bienestar (-1 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
        'INFO'
      );
    } else {
      addLog(player.name, `Pasa su turno sin realizar transformaciones en "${tile?.name}".`, 'INFO');
    }

    advanceToNextTurn();
  }, []);

  // Paso automático de turno al expirar el límite de tiempo (60s) del jugador humano activo
  const passTurnOnTimeout = useCallback(() => {
    const currentState = stateRef.current;
    if (
      currentState.phase !== 'PLAYER_TURN_READY' &&
      currentState.phase !== 'TILE_ACTION_DECISION'
    ) {
      return;
    }
    if (currentState.activeModal) return;

    const player = currentState.players[currentState.activePlayerIndex];
    if (!player || player.controller !== 'HUMAN') return;

    if (currentState.phase === 'PLAYER_TURN_READY' && player.isDetained) {
      if (player.detentionRoundsLeft > 1) {
        player.detentionRoundsLeft -= 1;
      } else {
        player.isDetained = false;
        player.detentionRoundsLeft = 0;
      }
      setState(prev => ({
        ...prev,
        players: prev.players.map((p, idx) =>
          idx === prev.activePlayerIndex ? { ...player } : p
        )
      }));
    }

    playSound.notification();
    triggerHaptic.uiTap();

    const phaseContext =
      currentState.phase === 'TILE_ACTION_DECISION'
        ? 'sin decidir sobre la casilla'
        : 'sin lanzar el dado';

    addLog(
      'Tiempo Límite (60s)',
      `¡Tiempo agotado! ${player.name} no actuó en 60s (${phaseContext}) y pasa su turno automáticamente.`,
      'HAZARD',
      {
        actorColor: player.color,
        highlight: true
      }
    );

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
      if (currentState.players.every(p => p.controller === 'BOT')) {
        const categories: GoodType[] = ['HEALTH', 'URBAN', 'KNOWLEDGE', 'ENVIRONMENT'];
        const bestCategory = categories.reduce<GoodType>((best, cat) => {
          const catCount = currentState.tiles.filter(
            t => t.goodType === cat && t.state !== 'COMMON'
          ).length;
          const bestCount = currentState.tiles.filter(
            t => t.goodType === best && t.state !== 'COMMON'
          ).length;
          return catCount > bestCount ? cat : best;
        }, 'HEALTH');
        setTimeout(() => {
          executeInsurrectionForCategory(bestCategory);
        }, 600);
        return;
      }
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
      t.goodType === category
        ? {
            ...t,
            state: 'COMMON' as const,
            transformedById: 'agora_assembly',
            transformedByName: 'Ágora Asamblearia',
            transformedAtRound: currentState.round
          }
        : t
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

    // Desalojo pacífico de vuelta al tablero + +3 Reputación Vecinal por acción colectiva en Ágora
    const exitCorners = [0, 10, 20, 30];
    const updatedAgoraPlayers = currentState.players.map((p, idx) => {
      const resetPlayer: Character = {
        ...p,
        inAgora: false,
        roundsInAgora: 0,
        position: exitCorners[idx % exitCorners.length]
      };
      return applyReputationDelta(
        resetPlayer,
        3,
        'Insurrección colectiva en el Ágora Central',
        currentState.round
      ).player;
    });

    setState(prev => {
      const baseStats = prev.playerStats || createInitialPlayerStats(updatedAgoraPlayers);
      const nextStats: Record<string, PlayerContributionStats> = { ...baseStats };
      const playerCount = updatedAgoraPlayers.length || 1;
      const baseShare = Math.floor(convertedCount / playerCount);
      const remainder = convertedCount % playerCount;

      updatedAgoraPlayers.forEach((p, idx) => {
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

      const snap = buildRoundSnapshot(prev.round, updatedAgoraPlayers, updatedTiles, nextStats);

      return {
        ...prev,
        players: updatedAgoraPlayers,
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

  // Turno de los Especuladores al final de la ronda (o ejecutado manualmente en Probability Sandbox)
  const runSpeculatorsTurn = useCallback((sandboxTestMode = false) => {
    const currentState = stateRef.current;
    const activeSandbox = currentState.probabilitySandbox?.enabled
      ? currentState.probabilitySandbox
      : null;
    const firstSpecPos = currentState.speculators[0]?.position ?? 0;
    playSound.speculatorAlert(getTileCoords3D(firstSpecPos));

    let attackTriggered = false;
    let detentionModalOpened = false;
    const nextPlayers = currentState.players.map(p => ({ ...p }));
    const nextSpeculators = currentState.speculators.map((speculator, sIdx) => {
      // Lanzar dado para el especulador (o aplicar lógica de movimiento Probability Sandbox)
      const prevPos = speculator.position;
      const roll = activeSandbox
        ? sampleSpeculatorStepFromSandbox(prevPos, nextPlayers, nextRand, activeSandbox)
        : Math.floor(nextRand() * 6) + 1;
      const targetPos = (prevPos + roll) % 40;

      if (roll === 0) {
        addLog(
          speculator.name,
          `[Sandbox] Congelado en la casilla ${targetPos} (0 pasos).`,
          'INFO'
        );
        return { ...speculator, position: targetPos };
      }

      const specSteps: { x: number; y: number; z: number }[] = [];
      for (let s = 1; s <= roll; s++) {
        specSteps.push(getTileCoords3D((prevPos + s) % 40));
      }
      playSound.speculatorMoveSequence(specSteps, sIdx * 180);

      addLog(
        speculator.name,
        `${sandboxTestMode ? '[Sandbox] ' : ''}Se desplazó ${roll} ${roll === 1 ? 'casilla' : 'casillas'} hasta la casilla ${targetPos}.`,
        'HAZARD'
      );

      // Comprobar si aterriza en una casilla con un personaje
      const victims = nextPlayers.filter(p => p.position === targetPos && !p.inAgora);

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

        // Decidir acción del especulador equilibrada según dificultad o anulación Sandbox
        const actionDice = Math.floor(nextRand() * 6) + 1;
        const difficulty = currentState.setupConfig?.difficulty ?? 'EN_TRANSICION';
        const detentionChance =
          activeSandbox && activeSandbox.detentionChanceOverridePct !== null
            ? Math.max(0, Math.min(1, activeSandbox.detentionChanceOverridePct / 100))
            : difficulty === 'MAD_MAX'
            ? 0.25
            : difficulty === 'COMUNLANDIA'
            ? 0.38
            : 0.32;
        const willDetain = nextRand() < detentionChance;

        if (willDetain) {
          const cappedRounds = Math.min(3, Math.ceil(actionDice / 2));
          victim.isDetained = true;
          victim.detentionRoundsLeft = cappedRounds;
          victim.position = 18; // Centro de Detención
          playSound.detentionClang(getTileCoords3D(18));
          triggerHaptic.detention();
          addLog(
            speculator.name,
            `¡Atrapó a ${victim.name} y lo encerró en el Centro de Detención por ${cappedRounds} ${cappedRounds === 1 ? 'ronda' : 'rondas'}!`,
            'HAZARD'
          );
          detentionModalOpened = true;
          pendingRoundAdvanceRef.current = !sandboxTestMode;
        } else {
          // Quitar puntos de Bienestar o Legitimidad (tope equilibrado de 1 a 4 puntos)
          playSound.speculatorAlert(getTileCoords3D(targetPos));
          triggerHaptic.speculatorHit();
          const maxSteal = Math.min(4, Math.max(1, Math.ceil(actionDice * 0.7)));
          const stealType = nextRand() > 0.5 ? 'WELLNESS' : 'LEGITIMACY';
          if (stealType === 'WELLNESS') {
            const stolen = Math.min(victim.wellness - 1, maxSteal);
            victim.wellness = Math.max(1, victim.wellness - stolen);
            addLog(speculator.name, `Explotó a ${victim.name} quitándole ${stolen} Puntos de Bienestar.`, 'HAZARD');
          } else {
            const stolen = Math.min(victim.legitimacy, maxSteal);
            victim.legitimacy = Math.max(0, victim.legitimacy - stolen);
            addLog(speculator.name, `Desprestigiaron a ${victim.name} quitándole ${stolen} Puntos de Legitimidad.`, 'HAZARD');
          }
        }
      }

      return { ...speculator, position: targetPos };
    });

    pendingAutosaveRef.current = { reason: 'TURN_END', endedTurnBy: 'Especuladores' };
    setState(prev => {
      const specFrame = buildTurnReplayFrame({
        prevFrames: prev.replayFrames,
        logs: prev.logs,
        round: prev.round,
        actorId: 'speculators',
        actorName: 'Especuladores',
        actorColor: '#f43f5e',
        activePlayerIndex: prev.activePlayerIndex,
        diceRoll: null,
        players: nextPlayers,
        speculators: nextSpeculators,
        tiles: prev.tiles,
        fallbackSummary: sandboxTestMode
          ? 'Simulación Sandbox de Especuladores en vivo'
          : 'Desplazamiento de los Especuladores al cierre de ronda',
        activeWeatherTitle: prev.activeWeatherEvent?.title,
        activeCrisisTitle: prev.activeCrisis?.title
      });
      return {
        ...prev,
        phase: 'SPECULATOR_TURN',
        speculators: nextSpeculators,
        players: nextPlayers,
        activeModal: detentionModalOpened ? 'DETENTION_RESCUE' : prev.activeModal,
        replayFrames: appendTurnReplayFrame(prev.replayFrames, specFrame)
      };
    });

    if (!detentionModalOpened) {
      if (sandboxTestMode) {
        setTimeout(() => {
          setState(prev =>
            prev.phase === 'SPECULATOR_TURN'
              ? { ...prev, phase: 'PLAYER_TURN_READY' }
              : prev
          );
        }, 1200);
      } else {
        setTimeout(() => {
          startNextRound();
        }, 1200);
      }
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

    pendingAutosaveRef.current = { reason: 'ROUND_END', endedTurnBy: `Fin Ronda ${currentState.round}` };
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

  // Avanzar al siguiente jugador dentro de la ronda y evaluar eventos de crisis inesperada
  const advanceToNextTurn = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.phase === 'GAME_OVER') return;
    const nextIndex = currentState.activePlayerIndex + 1;

    const crisisEval = evaluateUnexpectedCrisisTurn(
      currentState.activeCrisis,
      currentState.turnsSinceLastCrisis,
      currentState.round,
      lastCrisisIdRef.current
    );

    if (crisisEval.newlyTriggeredCrisis) {
      const triggered = crisisEval.newlyTriggeredCrisis;
      lastCrisisIdRef.current = triggered.id;
      if (triggered.severity === 'OPPORTUNITY') {
        playSound.unlockPublic();
      } else {
        playSound.speculatorAlert();
      }
      triggerHaptic.uiTap();
      addLog(
        'Crisis Inesperada',
        `${triggered.title}: ${triggered.description} (${triggered.totalTurns} turnos).`,
        triggered.severity === 'OPPORTUNITY' ? 'SUCCESS' : 'HAZARD',
        {
          category: triggered.severity === 'OPPORTUNITY' ? 'COOPERATIVE' : 'HAZARD',
          highlight: true
        }
      );
    } else if (crisisEval.expiredCrisis) {
      addLog(
        'Balance de Crisis',
        `Remite "${crisisEval.expiredCrisis.title}". El coste y valor de los recursos vuelven a la normalidad.`,
        'INFO'
      );
    }

    const weatherEval = evaluateDynamicWeatherTurn(
      currentState.activeWeatherEvent,
      currentState.turnsSinceLastWeatherEvent,
      currentState.tiles,
      currentState.round,
      lastWeatherKindRef.current,
      currentState.weatherAdvancedConfig
    );

    if (weatherEval.newlyTriggeredWeatherEvent) {
      const wEvent = weatherEval.newlyTriggeredWeatherEvent;
      lastWeatherKindRef.current = wEvent.kind;
      if (wEvent.severity === 'BENEFICIAL') {
        playSound.unlockPublic();
      } else {
        playSound.notification();
      }
      triggerHaptic.uiTap();
      addLog(
        'Meteorología Dinámica',
        `${wEvent.alertMessage} (${wEvent.totalTurns} turnos).`,
        wEvent.severity === 'BENEFICIAL' ? 'SUCCESS' : 'HAZARD',
        {
          category: wEvent.severity === 'BENEFICIAL' ? 'COOPERATIVE' : 'HAZARD',
          highlight: true
        }
      );
    } else if (weatherEval.expiredWeatherEvent) {
      addLog(
        'Meteorología Dinámica',
        `Remite "${weatherEval.expiredWeatherEvent.title}". El clima y las casillas afectadas vuelven a su estado habitual.`,
        'INFO'
      );
    }

    const endingPlayerName = currentState.players[currentState.activePlayerIndex]?.name ?? 'Turno';
    pendingAutosaveRef.current = { reason: 'TURN_END', endedTurnBy: endingPlayerName };

    // Registrar snapshot turno a turno de la evolución Comunes vs Privatizados + fotograma de Repetición
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

      const turnReplayFrame = buildTurnReplayFrame({
        prevFrames: prev.replayFrames,
        logs: prev.logs,
        round: prev.round,
        actorId: endingPlayer?.id ?? 'turn',
        actorName: endingPlayer?.name ?? 'Turno',
        actorColor: endingPlayer?.color ?? '#14b8a6',
        activePlayerIndex: prev.activePlayerIndex,
        diceRoll: prev.currentDiceRoll,
        players: prev.players,
        speculators: prev.speculators,
        tiles: prev.tiles,
        activeWeatherTitle: weatherEval.nextWeatherEvent?.title ?? prev.activeWeatherEvent?.title,
        activeCrisisTitle: crisisEval.nextCrisis?.title ?? prev.activeCrisis?.title
      });
      const nextReplayFrames = appendTurnReplayFrame(prev.replayFrames, turnReplayFrame);

      if (nextIndex >= prev.players.length) {
        return {
          ...prev,
          activeCrisis: crisisEval.nextCrisis,
          turnsSinceLastCrisis: crisisEval.nextTurnsSinceLastCrisis,
          activeWeatherEvent: weatherEval.nextWeatherEvent,
          turnsSinceLastWeatherEvent: weatherEval.nextTurnsSinceLastWeatherEvent,
          turnHistory: nextTurnHistory,
          replayFrames: nextReplayFrames
        };
      }

      return {
        ...prev,
        activePlayerIndex: nextIndex,
        currentDiceRoll: null,
        phase: 'PLAYER_TURN_READY',
        activeCrisis: crisisEval.nextCrisis,
        turnsSinceLastCrisis: crisisEval.nextTurnsSinceLastCrisis,
        activeWeatherEvent: weatherEval.nextWeatherEvent,
        turnsSinceLastWeatherEvent: weatherEval.nextTurnsSinceLastWeatherEvent,
        turnHistory: nextTurnHistory,
        replayFrames: nextReplayFrames
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

    const bailInfo = getEffectiveBailCostPerRound(victim, rescuer);
    const totalCost = victim.detentionRoundsLeft * bailInfo.effectivePerRound;

    if (rescuer.wellness > totalCost) {
      const rescueRefund = rescuer.id === 'carolina' ? 1 : 0;
      const repRes = applyReputationDelta(
        { ...rescuer, wellness: rescuer.wellness - totalCost + rescueRefund },
        4,
        `Rescate solidario de ${victim.name}`,
        currentState.round
      );

      const updatedPlayers = currentState.players.map(p => {
        if (p.id === rescuer.id) {
          return repRes.player;
        }
        if (p.id === victim.id) {
          return { ...p, isDetained: false, detentionRoundsLeft: 0 };
        }
        return p;
      });

      playSound.unlockCommon(getTileCoords3D(18));
      triggerHaptic.rescue();
      recordPlayerMetric(rescuer.id, { cooperativeActions: 1, wellnessInvested: totalCost });
      const repNote =
        bailInfo.reputationDelta !== 0
          ? ` (tarifa ajustada por reputación: ${bailInfo.reputationDelta > 0 ? `+${bailInfo.reputationDelta}` : bailInfo.reputationDelta}/ronda)`
          : '';
      addLog(
        rescuer.name,
        `¡Solidaridad Comunitaria! ${rescuer.name} pagó ${totalCost} Bienestar${repNote} y rescató a ${victim.name} del Centro de Detención (+4 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)})${rescueRefund > 0 ? ' · +1 Bienestar (Red de Cuidados)' : ''}.`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: 'RESCUE',
          actorColor: rescuer.color,
          target: victim.name,
          highlight: true
        }
      );
      setState(prev => ({
        ...prev,
        players: updatedPlayers,
        activeModal: null,
        phase:
          !pendingRoundAdvanceRef.current && prev.phase === 'SPECULATOR_TURN'
            ? 'PLAYER_TURN_READY'
            : prev.phase
      }));

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
        return {
          ...tile,
          state: 'PRIVATE' as const,
          transformedById: 'tragedy',
          transformedByName: 'Tragedia de los Comunes',
          transformedAtRound: currentState.round
        };
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
        currentState.activePlayerIndex,
        currentState.activeWeatherEvent
      );

      const isFavorable = weather.type === 'RAIN' || weather.type === 'SUNNY' || weather.type === 'TEMPERATE';
      const successRoll = nextRand();
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

  const triggerNeighborhoodDecision = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.neighborhoodDecision) {
      setState(prev => ({ ...prev, activeModal: 'NEIGHBORHOOD_DECISION' }));
      return;
    }

    const decision: NeighborhoodDecision = {
      id: `nd_${Date.now()}`,
      title: 'Referéndum de Asignación de Espacios Vecinales',
      description: 'El vecindario convoca una votación in-situ para decidir el destino de los solares y locales comunes. Desplázate a las casillas de Urna habilitadas (Cooperativa [4], Red P2P [14], Centro Social [24], Tienda Ecológica [31]) para emitir tu voto. La confianza vecinal determina el peso de cada voto.',
      targetTileIds: [4, 14, 24, 31],
      votesCast: [],
      trustAccumulated: 0,
      requiredTrust: DEFAULT_REFERENDUM_REQUIRED_TRUST,
      rewardSummary: '+2 Legitimidad, +2 Bienestar y conversión automática de 1 bien a Común.'
    };

    setState(prev => ({
      ...prev,
      neighborhoodDecision: decision,
      activeModal: 'NEIGHBORHOOD_DECISION'
    }));

    addLog(
      'Decisión Barrial',
      '¡Referéndum convocado! Desplázate a las urnas en el tablero para votar según tu Reputación Vecinal.',
      'CARD'
    );
  }, []);

  const castNeighborhoodVote = useCallback(() => {
    const currentState = stateRef.current;
    const decision = currentState.neighborhoodDecision;
    const player = currentState.players[currentState.activePlayerIndex];

    if (!decision || !player) return;

    const playerTile = currentState.tiles.find(t => t.id === player.position);
    const isAtPollingStation = playerTile && decision.targetTileIds.includes(playerTile.id);

    if (!isAtPollingStation) {
      addLog('Decisión Barrial', `${player.name} intentó votar pero no se encuentra en una casilla de urna in-situ.`, 'HAZARD');
      return;
    }

    if (decision.votesCast.includes(player.id)) return;

    const repProfile = getReputationProfile(player);
    const requiredTrust = decision.requiredTrust ?? DEFAULT_REFERENDUM_REQUIRED_TRUST;
    const prevTrust = decision.trustAccumulated ?? 0;
    const nextTrustAccumulated = Number((prevTrust + repProfile.voteWeight).toFixed(2));
    const nextVotesCast = [...decision.votesCast, player.id];
    const isQuorumReached = nextTrustAccumulated >= requiredTrust;

    const repRes = applyReputationDelta(
      {
        ...player,
        wellness: Math.min(10, player.wellness + 2),
        legitimacy: player.legitimacy + (repProfile.voteWeight >= 1.5 ? 3 : 2)
      },
      2,
      'Participación en referéndum barrial',
      currentState.round
    );

    let updatedTiles = currentState.tiles.map(t => ({ ...t }));
    if (isQuorumReached) {
      const targetResource = updatedTiles.find(t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state !== 'COMMON');
      if (targetResource) {
        targetResource.state = 'COMMON';
        targetResource.transformedById = 'neighborhood_referendum';
        targetResource.transformedByName = 'Referéndum Vecinal';
        targetResource.transformedAtRound = currentState.round;
      }
    }

    const nextDecision = isQuorumReached
      ? null
      : {
          ...decision,
          votesCast: nextVotesCast,
          trustAccumulated: nextTrustAccumulated,
          requiredTrust
        };
    const nextModal = isQuorumReached ? null : 'NEIGHBORHOOD_DECISION';

    setState(prev => ({
      ...prev,
      players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? repRes.player : p),
      tiles: updatedTiles,
      neighborhoodDecision: nextDecision,
      activeModal: nextModal
    }));

    const legitimacyEarned = repProfile.voteWeight >= 1.5 ? 3 : 2;
    addLog(
      'Decisión Barrial',
      `${player.name} (${repProfile.label} · confianza ${repProfile.trustPercent}%, peso ${repProfile.voteWeight}x) votó in-situ (+2 Bienestar, +${legitimacyEarned} Legitimidad, +2 Rep. Vecinal · quórum ${nextTrustAccumulated.toFixed(2)}/${requiredTrust.toFixed(1)}).`,
      'SUCCESS',
      {
        category: 'COOPERATIVE',
        cooperativeAction: 'COLLECTIVE_VOTE',
        actorColor: player.color
      }
    );

    if (isQuorumReached) {
      addLog('Decisión Barrial', `¡Quórum de confianza alcanzado (${nextTrustAccumulated.toFixed(2)}/${requiredTrust.toFixed(1)})! El referéndum barrial triunfó y consolidó un nuevo Bien Común en el territorio.`, 'SUCCESS');
      checkEndGameConditions(updatedTiles, currentState.round);
    }
  }, []);

  // Burocracia: Convertir 1 bien privado en público pagando 6 bienestar (± modificador por Reputación Vecinal)
  const executeBureaucracy = useCallback((tileId: number) => {
    const currentState = stateRef.current;
    const player = currentState.players[currentState.activePlayerIndex];
    const costInfo = getEffectiveBureaucracyCost(player);
    if (!player || player.wellness <= costInfo.effectiveCost) {
      setState(prev => ({ ...prev, activeModal: null }));
      advanceToNextTurn();
      return;
    }

    const tile = currentState.tiles.find(t => t.id === tileId);
    if (tile && tile.state === 'PRIVATE') {
      player.wellness -= costInfo.effectiveCost;
      const repRes = applyReputationDelta(
        player,
        2,
        `Gestión pública de "${tile.name}" en Burocracia`,
        currentState.round
      );
      const updatedTiles = currentState.tiles.map(t =>
        t.id === tile.id
          ? {
              ...t,
              state: 'PUBLIC' as const,
              transformedById: repRes.player.id,
              transformedByName: repRes.player.name,
              transformedAtRound: currentState.round
            }
          : t
      );
      setState(prev => ({
        ...prev,
        tiles: updatedTiles,
        players: prev.players.map((p, idx) => idx === prev.activePlayerIndex ? repRes.player : p),
        activeModal: null
      }));
      playSound.unlockPublic(getTileCoords3D(tile.id));
      recordPlayerMetric(repRes.player.id, { publicsUnlocked: 1, cooperativeActions: 1, wellnessInvested: costInfo.effectiveCost }, updatedTiles);
      const repCostNote =
        costInfo.reputationDelta !== 0
          ? ` (ajuste reputación ${costInfo.reputationDelta > 0 ? `+${costInfo.reputationDelta}` : costInfo.reputationDelta})`
          : '';
      addLog(
        repRes.player.name,
        `Gestión Pública: ${repRes.player.name} transformó "${tile.name}" en bien público por ${costInfo.effectiveCost} Bienestar${repCostNote} (+2 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
        'SUCCESS',
        {
          category: 'COOPERATIVE',
          cooperativeAction: 'BUROCRACIA',
          actorColor: repRes.player.color,
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
    const repGain = 1 + amount;
    const repRes = applyReputationDelta(
      donor,
      repGain,
      `Donación solidaria a ${receiver.name} en Crowdfunding`,
      currentState.round
    );
    playSound.unlockCommon();

    setState(prev => ({
      ...prev,
      players: prev.players.map(p => {
        if (p.id === donor.id) return repRes.player;
        if (p.id === receiver.id) return { ...receiver };
        return p;
      }),
      activeModal: null
    }));

    recordPlayerMetric(donor.id, { cooperativeActions: 1, wellnessInvested: amount, totalResourcesEarned: amount * 2 });
    recordPlayerMetric(receiver.id, { totalResourcesEarned: amount });

    addLog(
      donor.name,
      `Apoyo Mutuo: ${donor.name} donó ${amount} Bienestar a ${receiver.name} en Crowdfunding (+${amount * 2} Legitimidad, +${repGain} Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
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

  const setWeatherAdvancedConfig = useCallback(
    (
      updater:
        | Partial<WeatherAdvancedConfig>
        | ((prev: WeatherAdvancedConfig) => WeatherAdvancedConfig)
    ) => {
      setState(prev => {
        const base = prev.weatherAdvancedConfig ?? DEFAULT_WEATHER_ADVANCED_CONFIG;
        const nextRaw =
          typeof updater === 'function' ? updater(base) : { ...base, ...updater };
        const normalized = saveWeatherAdvancedConfig(nextRaw);
        return {
          ...prev,
          weatherAdvancedConfig: normalized
        };
      });
    },
    []
  );

  const setTimeOfDayMode = useCallback((mode: TimeOfDayMode) => {
    playSound.uiClick();
    setState(prev => ({ ...prev, timeOfDayMode: mode }));
  }, []);

  const openDetentionRescue = useCallback(() => {
    playSound.modalOpen();
    setState(prev => ({ ...prev, activeModal: 'DETENTION_RESCUE' }));
  }, []);

  const closeModal = useCallback(() => {
    const currentState = stateRef.current;
    const activeModal = currentState.activeModal;
    const activePlayer = currentState.players[currentState.activePlayerIndex];
    playSound.modalClose();

    if (activeModal === 'BUREAUCRACY' && activePlayer) {
      const burCost = getEffectiveBureaucracyCost(activePlayer).effectiveCost;
      const hasPrivateTiles = currentState.tiles.some(
        t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && t.state === 'PRIVATE'
      );
      if (hasPrivateTiles && activePlayer.wellness > burCost) {
        const repRes = applyReputationDelta(
          activePlayer,
          -1,
          'Rehusó trámite público en Burocracia disponiendo de recursos',
          currentState.round
        );
        setState(prev => ({
          ...prev,
          players: prev.players.map((p, idx) =>
            idx === prev.activePlayerIndex ? repRes.player : p
          ),
          activeModal: null
        }));
        addLog(
          activePlayer.name,
          `Rehusó iniciar trámite público en Burocracia (-1 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
          'INFO'
        );
      } else {
        setState(prev => ({ ...prev, activeModal: null }));
      }
      advanceToNextTurn();
      return;
    }

    if (activeModal === 'CROWDFUNDING' && activePlayer) {
      if (activePlayer.wellness > 2) {
        const repRes = applyReputationDelta(
          activePlayer,
          -1,
          'Evitó aportar a la caja solidaria en Crowdfunding',
          currentState.round
        );
        setState(prev => ({
          ...prev,
          players: prev.players.map((p, idx) =>
            idx === prev.activePlayerIndex ? repRes.player : p
          ),
          activeModal: null
        }));
        addLog(
          activePlayer.name,
          `Conservó su Bienestar sin donar en Crowdfunding (-1 Reputación Vecinal → ${formatSignedScore(repRes.nextScore)}).`,
          'INFO'
        );
      } else {
        setState(prev => ({ ...prev, activeModal: null }));
      }
      advanceToNextTurn();
      return;
    }

    setState(prev => ({
      ...prev,
      activeModal: null,
      phase:
        activeModal === 'DETENTION_RESCUE' &&
        !pendingRoundAdvanceRef.current &&
        prev.phase === 'SPECULATOR_TURN'
          ? 'PLAYER_TURN_READY'
          : prev.phase
    }));

    if (activeModal === 'DETENTION_RESCUE' && pendingRoundAdvanceRef.current) {
      pendingRoundAdvanceRef.current = false;
      setTimeout(() => {
        startNextRound();
      }, 300);
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
    lastCrisisIdRef.current = loaded.state.activeCrisis?.id ?? null;
    lastWeatherKindRef.current = loaded.state.activeWeatherEvent?.kind ?? null;
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

  const applySandboxMutation = useCallback((mutation: SandboxMutation) => {
    setState(prev => {
      if (prev.phase === 'TITLE' || prev.phase === 'SETUP' || prev.phase === 'GAME_OVER') {
        return prev;
      }

      if (!preSandboxSnapshotRef.current) {
        preSandboxSnapshotRef.current = {
          ...prev,
          players: prev.players.map(p => ({ ...p })),
          speculators: prev.speculators.map(s => ({ ...s })),
          tiles: prev.tiles.map(t => ({ ...t })),
          setupConfig: prev.setupConfig ? { ...prev.setupConfig } : undefined,
          activeCrisis: prev.activeCrisis ? { ...prev.activeCrisis } : null,
          activeWeatherEvent: prev.activeWeatherEvent ? { ...prev.activeWeatherEvent } : null
        };
        setCanRestoreSandbox(true);
      }

      let nextState: GameEngineState = { ...prev, isSandboxSession: true };

      switch (mutation.type) {
        case 'SET_ROUND': {
          const clampedRound = Math.max(1, Math.min(20, Math.round(mutation.round)));
          nextState = { ...nextState, round: clampedRound };
          break;
        }
        case 'ADJUST_ACTIVE_PLAYER': {
          const nextPlayers = prev.players.map((p, idx) => {
            if (idx !== prev.activePlayerIndex) return p;
            return {
              ...p,
              wellness: Math.max(0, Math.min(40, p.wellness + (mutation.wellnessDelta ?? 0))),
              legitimacy: Math.max(0, Math.min(40, p.legitimacy + (mutation.legitimacyDelta ?? 0)))
            };
          });
          nextState = { ...nextState, players: nextPlayers };
          break;
        }
        case 'SET_SPECULATORS_COUNT': {
          const targetCount = Math.max(1, Math.min(3, Math.round(mutation.count)));
          const speculatorNames = [
            'Fondo Buitre Inmobiliario',
            'Corporación Farmacéutica',
            'Monopolio Tecnológico'
          ];
          const nextSpecs: Speculator[] = [];
          for (let i = 0; i < targetCount; i++) {
            const existing = prev.speculators[i];
            nextSpecs.push(
              existing
                ? { ...existing }
                : {
                    id: i + 1,
                    position: (i * 10) % 40,
                    name: speculatorNames[i] || `Especulador ${i + 1}`,
                    color: '#FFFFFF'
                  }
            );
          }
          nextState = {
            ...nextState,
            speculators: nextSpecs,
            setupConfig: prev.setupConfig
              ? { ...prev.setupConfig, speculatorsCount: targetCount }
              : undefined
          };
          break;
        }
        case 'SET_DIFFICULTY': {
          nextState = {
            ...nextState,
            setupConfig: prev.setupConfig
              ? { ...prev.setupConfig, difficulty: mutation.difficulty }
              : {
                  health: 3,
                  urban: 3,
                  knowledge: 4,
                  environment: 4,
                  totalSum: 14,
                  difficulty: mutation.difficulty,
                  speculatorsCount: prev.speculators.length
                }
          };
          break;
        }
        case 'TRIGGER_CRISIS': {
          const tpl =
            UNEXPECTED_CRISIS_TEMPLATES.find(c => c.id === mutation.templateId) ||
            UNEXPECTED_CRISIS_TEMPLATES[0];
          nextState = {
            ...nextState,
            activeCrisis: {
              ...tpl,
              turnsRemaining: tpl.totalTurns,
              triggeredAtRound: prev.round
            },
            turnsSinceLastCrisis: 0
          };
          break;
        }
        case 'CLEAR_CRISIS': {
          nextState = {
            ...nextState,
            activeCrisis: null
          };
          break;
        }
        case 'TRIGGER_WEATHER': {
          const tpl =
            DYNAMIC_WEATHER_TEMPLATES.find(w => w.kind === mutation.kind) ||
            DYNAMIC_WEATHER_TEMPLATES[0];
          const candidateTiles = prev.tiles.filter(
            t =>
              (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') &&
              (tpl.preferredGoodTypes.length === 0 ||
                (t.goodType && tpl.preferredGoodTypes.includes(t.goodType)))
          );
          const picked = candidateTiles.slice(0, tpl.tileCountMax);
          nextState = {
            ...nextState,
            activeWeatherEvent: {
              id: `sandbox_weather_${tpl.kind}_${Date.now()}`,
              kind: tpl.kind,
              weatherType: tpl.weatherType,
              title: tpl.title,
              description: tpl.description,
              alertMessage: `[Sandbox] ${tpl.title} activa en ${picked.length} casillas.`,
              affectedTileIds: picked.map(t => t.id),
              affectedTileNames: picked.map(t => t.name),
              affectedGoodTypes: [...tpl.preferredGoodTypes],
              unlockCostDelta: tpl.unlockCostDelta,
              resourceYieldDelta: tpl.resourceYieldDelta,
              turnsRemaining: tpl.totalTurns,
              totalTurns: tpl.totalTurns,
              severity: tpl.severity,
              triggeredAtRound: prev.round
            },
            turnsSinceLastWeatherEvent: 0
          };
          break;
        }
        case 'CLEAR_WEATHER': {
          nextState = {
            ...nextState,
            activeWeatherEvent: null
          };
          break;
        }
        case 'CYCLE_TILE_STATE': {
          const nextTiles = prev.tiles.map(t => {
            if (t.id !== mutation.tileId) return t;
            if (t.category !== 'RESOURCE' && t.category !== 'AGORA_ENTRY') return t;
            const nextStateVal: GoodState =
              t.state === 'PRIVATE' ? 'PUBLIC' : t.state === 'PUBLIC' ? 'COMMON' : 'PRIVATE';
            return { ...t, state: nextStateVal };
          });
          nextState = { ...nextState, tiles: nextTiles };
          break;
        }
        case 'TOGGLE_PROBABILITY_SANDBOX': {
          const currentCfg = prev.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG;
          nextState = {
            ...nextState,
            probabilitySandbox: {
              ...currentCfg,
              enabled: mutation.enabled
            }
          };
          break;
        }
        case 'UPDATE_PROBABILITY_SANDBOX': {
          const currentCfg = prev.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG;
          nextState = {
            ...nextState,
            probabilitySandbox: {
              ...currentCfg,
              ...mutation.patch,
              enabled: true
            }
          };
          break;
        }
        case 'MOVE_SPECULATOR': {
          const nextSpecs = prev.speculators.map(s =>
            s.id === mutation.speculatorId
              ? { ...s, position: ((s.position + mutation.deltaSteps) % 40 + 40) % 40 }
              : s
          );
          nextState = { ...nextState, speculators: nextSpecs };
          break;
        }
      }

      return nextState;
    });
  }, []);

  const ensureSandboxSessionPrepared = useCallback(() => {
    const prev = stateRef.current;
    if (prev.phase === 'TITLE' || prev.phase === 'SETUP' || prev.phase === 'GAME_OVER') {
      return false;
    }
    if (!preSandboxSnapshotRef.current) {
      preSandboxSnapshotRef.current = {
        ...prev,
        players: prev.players.map(p => ({ ...p })),
        speculators: prev.speculators.map(s => ({ ...s })),
        tiles: prev.tiles.map(t => ({ ...t })),
        setupConfig: prev.setupConfig ? { ...prev.setupConfig } : undefined,
        activeCrisis: prev.activeCrisis ? { ...prev.activeCrisis } : null,
        activeWeatherEvent: prev.activeWeatherEvent ? { ...prev.activeWeatherEvent } : null
      };
      setCanRestoreSandbox(true);
    }
    if (!prev.isSandboxSession || !prev.probabilitySandbox?.enabled) {
      const nextSandboxCfg: ProbabilitySandboxConfig = {
        ...(prev.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG),
        enabled: true
      };
      stateRef.current = {
        ...prev,
        isSandboxSession: true,
        probabilitySandbox: nextSandboxCfg
      };
      setState(curr => ({
        ...curr,
        isSandboxSession: true,
        probabilitySandbox: {
          ...(curr.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG),
          enabled: true
        }
      }));
    }
    return true;
  }, []);

  const simulateDiceRollInSandbox = useCallback(
    (forcedRoll?: number) => {
      if (!ensureSandboxSessionPrepared()) return;
      const currentState = stateRef.current;
      if (currentState.phase !== 'PLAYER_TURN_READY') return;
      const roll =
        typeof forcedRoll === 'number' && Number.isFinite(forcedRoll)
          ? clampDiceFace(forcedRoll)
          : samplePlayerDiceFromSandbox(nextRand, currentState.probabilitySandbox);
      addLog(
        'Probability Sandbox',
        `Simulación de dado en vivo: resultado ${roll} para ${
          currentState.players[currentState.activePlayerIndex]?.name ?? 'jugador activo'
        }.`,
        'INFO'
      );
      rollDiceForCurrentPlayer(roll);
    },
    [ensureSandboxSessionPrepared, rollDiceForCurrentPlayer]
  );

  const simulateSpeculatorsWaveInSandbox = useCallback(() => {
    if (!ensureSandboxSessionPrepared()) return;
    const currentState = stateRef.current;
    if (currentState.phase === 'DICE_ROLLING' || currentState.phase === 'GAME_OVER') return;
    addLog(
      'Probability Sandbox',
      'Ejecutando simulación en vivo de movimiento y lógica de especuladores.',
      'HAZARD'
    );
    runSpeculatorsTurn(true);
  }, [ensureSandboxSessionPrepared, runSpeculatorsTurn]);

  const restorePreSandboxState = useCallback(() => {
    const saved = preSandboxSnapshotRef.current;
    if (!saved) return;
    playSound.uiClick();
    preSandboxSnapshotRef.current = null;
    setCanRestoreSandbox(false);
    setState(prev => ({
      ...saved,
      cameraMode: prev.cameraMode,
      soundEnabled: prev.soundEnabled,
      hapticsEnabled: prev.hapticsEnabled,
      postProcessingEnabled: prev.postProcessingEnabled,
      isSandboxSession: false,
      probabilitySandbox: undefined
    }));
  }, []);

  const hydrateMultiplayerState = useCallback(
    (remote: {
      phase: GameEngineState['phase'];
      round: number;
      activePlayerIndex: number;
      currentDiceRoll: number | null;
      players: Character[];
      speculators: Speculator[];
      tileStates: Record<string, GoodState>;
      gameResult?: GameEngineState['gameResult'];
      gameResultDetails?: string;
      multiplayerRoomId: string;
      multiplayerRoomCode: string;
      difficulty?: DifficultyLevel;
      recentLogs?: GameLogEntry[];
    }) => {
      setState(prev => {
        const nextTiles = prev.tiles.map(tile => {
          const remoteState = remote.tileStates[String(tile.id)];
          if (remoteState && (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY')) {
            return { ...tile, state: remoteState };
          }
          return tile;
        });

        const nextStats = prev.playerStats || createInitialPlayerStats(remote.players);
        const snap = buildRoundSnapshot(remote.round, remote.players, nextTiles, nextStats);

        return {
          ...prev,
          phase: remote.phase,
          round: remote.round,
          activePlayerIndex: remote.activePlayerIndex,
          currentDiceRoll: remote.currentDiceRoll,
          players: remote.players,
          speculators: remote.speculators,
          tiles: nextTiles,
          gameResult: remote.gameResult,
          gameResultDetails: remote.gameResultDetails,
          multiplayerRoomId: remote.multiplayerRoomId,
          multiplayerRoomCode: remote.multiplayerRoomCode,
          setupConfig: prev.setupConfig
            ? {
                ...prev.setupConfig,
                difficulty: remote.difficulty ?? prev.setupConfig.difficulty,
                speculatorsCount: remote.speculators.length
              }
            : prev.setupConfig,
          logs: remote.recentLogs && remote.recentLogs.length > 0 ? remote.recentLogs : prev.logs,
          performanceHistory: upsertRoundSnapshot(prev.performanceHistory, snap)
        };
      });
    },
    []
  );

  const resetToTitle = useCallback(() => {
    playSound.uiClick();
    achievementQueueRef.current = [];
    pendingRoundAdvanceRef.current = false;
    lastCrisisIdRef.current = null;
    lastWeatherKindRef.current = null;
    seededRngRef.current = null;
    preSandboxSnapshotRef.current = null;
    setCanRestoreSandbox(false);
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
      activeCrisis: null,
      turnsSinceLastCrisis: 0,
      activeWeatherEvent: null,
      turnsSinceLastWeatherEvent: 0,
      currentGlobalCard: null,
      currentSituationCard: null,
      gameResult: undefined,
      gameResultDetails: undefined,
      isSandboxSession: false,
      probabilitySandbox: undefined,
      dailyChallengeDate: null,
      seedNumber: null,
      multiplayerRoomId: null,
      multiplayerRoomCode: null,
      playerStats: undefined,
      performanceHistory: undefined,
      turnHistory: undefined
    }));
  }, []);

  return {
    state,
    savedGameMeta,
    canRestoreSandbox,
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
    addLog,
    triggerNeighborhoodDecision,
    castNeighborhoodVote,
    applySandboxMutation,
    simulateDiceRollInSandbox,
    simulateSpeculatorsWaveInSandbox,
    restorePreSandboxState,
    hydrateMultiplayerState
  };
}
