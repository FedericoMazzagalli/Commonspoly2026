/**
 * gameStorage.ts
 * Persistencia local completa de partidas en LocalStorage con esquema versionado,
 * rehidratación de cartas (funciones) y normalización segura de fases transitorias.
 */

import {
  DifficultyLevel,
  GameEngineState,
  GamePhase,
  GoodState,
  GoodType,
  Tile
} from '../types/game';
import { GLOBAL_CARDS, SITUATION_CARDS } from '../data/cards';
import { INITIAL_TILES } from '../data/tiles';
import { loadLocalAchievements } from './achievements';
import { hapticsManager } from './haptics';
import { buildTurnReplayFrame, MAX_REPLAY_FRAMES } from './replay';
import {
  loadWeatherAdvancedConfig,
  normalizeWeatherAdvancedConfig
} from './weatherSettings';

const STORAGE_KEY = 'commonspoly_saved_game_v1';
const SCHEMA_VERSION = 2;

export type AutosaveReason = 'TURN_END' | 'ROUND_END' | 'GAME_OVER' | 'MANUAL' | 'CHECKPOINT';

export interface TileOwnershipEntry {
  tileId: number;
  code: string;
  name: string;
  goodType?: GoodType;
  state: GoodState;
  ownerId?: string;
  ownerName?: string;
  updatedAtRound?: number;
}

export interface PlayerAutosaveSnapshot {
  playerId: string;
  name: string;
  color: string;
  controller: 'HUMAN' | 'BOT';
  wellness: number;
  legitimacy: number;
  position: number;
  isDetained: boolean;
  inAgora: boolean;
  commonsUnlocked: number;
  publicsUnlocked: number;
  cooperativeActions: number;
  wellnessInvested: number;
  totalResourcesEarned: number;
  neighborhoodReputation?: number;
}

export interface SavedGameMetadata {
  savedAt: string;
  round: number;
  phase: GamePhase;
  activePlayerName: string;
  activePlayerColor: string;
  commonCount: number;
  totalResourceTiles: number;
  difficulty: DifficultyLevel;
  playersCount: number;
  speculatorsCount: number;
  autoResumeOnReload: boolean;
  lastAutosaveReason?: AutosaveReason;
  lastEndedTurnBy?: string;
  autosaveCount?: number;
}

interface SerializableGameState {
  phase: GamePhase;
  round: number;
  activePlayerIndex: number;
  players: GameEngineState['players'];
  speculators: GameEngineState['speculators'];
  tiles: GameEngineState['tiles'];
  setupConfig?: GameEngineState['setupConfig'];
  currentDiceRoll: number | null;
  activeModal: GameEngineState['activeModal'];
  neighborhoodDecision?: GameEngineState['neighborhoodDecision'];
  speculatorAttackPayload?: GameEngineState['speculatorAttackPayload'];
  logs: GameEngineState['logs'];
  speculatorActionLogs?: GameEngineState['speculatorActionLogs'];
  chatMessages: GameEngineState['chatMessages'];
  gameResult?: GameEngineState['gameResult'];
  gameResultDetails?: GameEngineState['gameResultDetails'];
  playerStats?: GameEngineState['playerStats'];
  performanceHistory?: GameEngineState['performanceHistory'];
  turnHistory?: GameEngineState['turnHistory'];
  replayFrames?: GameEngineState['replayFrames'];
  cameraMode: GameEngineState['cameraMode'];
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  postProcessingEnabled?: boolean;
  ambientMode: GameEngineState['ambientMode'];
  weatherMode: GameEngineState['weatherMode'];
  weatherIntensity?: number;
  weatherAdvancedConfig?: GameEngineState['weatherAdvancedConfig'];
  timeOfDayMode?: GameEngineState['timeOfDayMode'];
  activeCrisis?: GameEngineState['activeCrisis'];
  turnsSinceLastCrisis?: number;
  activeWeatherEvent?: GameEngineState['activeWeatherEvent'];
  turnsSinceLastWeatherEvent?: number;
}

interface PersistedGamePayload {
  version: number;
  savedAt: string;
  autoResumeOnReload: boolean;
  pendingRoundAdvance: boolean;
  currentGlobalCardId: string | null;
  currentSituationCardId: string | null;
  // Campos estructurados de autosave por fin de turno
  round?: number;
  playerStats?: PlayerAutosaveSnapshot[];
  tileOwnership?: Record<number, TileOwnershipEntry>;
  autosaveReason?: AutosaveReason;
  lastEndedTurnBy?: string;
  autosaveCount?: number;
  state: SerializableGameState;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSupportedVersion(version: number | undefined): boolean {
  return version === 1 || version === SCHEMA_VERSION;
}

function countResourceProgress(tiles: Tile[]): { commonCount: number; totalResourceTiles: number } {
  const resourceTiles = tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
  return {
    commonCount,
    totalResourceTiles: resourceTiles.length || 1
  };
}

export function buildTileOwnershipSnapshot(tiles: Tile[]): Record<number, TileOwnershipEntry> {
  const map: Record<number, TileOwnershipEntry> = {};
  tiles.forEach(tile => {
    if (tile.category !== 'RESOURCE' && tile.category !== 'AGORA_ENTRY') return;
    map[tile.id] = {
      tileId: tile.id,
      code: tile.code,
      name: tile.name,
      goodType: tile.goodType,
      state: tile.state ?? tile.defaultState ?? 'PRIVATE',
      ownerId: tile.transformedById,
      ownerName: tile.transformedByName,
      updatedAtRound: tile.transformedAtRound
    };
  });
  return map;
}

export function buildPlayerAutosaveSnapshot(state: GameEngineState): PlayerAutosaveSnapshot[] {
  return state.players.map(player => {
    const metrics = state.playerStats?.[player.id];
    return {
      playerId: player.id,
      name: player.name,
      color: player.color,
      controller: player.controller,
      wellness: player.wellness,
      legitimacy: player.legitimacy,
      position: player.position,
      isDetained: player.isDetained,
      inAgora: player.inAgora,
      commonsUnlocked: metrics?.commonsUnlocked ?? 0,
      publicsUnlocked: metrics?.publicsUnlocked ?? 0,
      cooperativeActions: metrics?.cooperativeActions ?? 0,
      wellnessInvested: metrics?.wellnessInvested ?? 0,
      totalResourcesEarned: metrics?.totalResourcesEarned ?? player.wellness + player.legitimacy,
      neighborhoodReputation: player.neighborhoodReputation ?? 0
    };
  });
}

function buildMetadata(payload: PersistedGamePayload): SavedGameMetadata {
  const { state } = payload;
  const activePlayer = state.players[state.activePlayerIndex] || state.players[0];
  const { commonCount, totalResourceTiles } = countResourceProgress(state.tiles);

  return {
    savedAt: payload.savedAt,
    round: payload.round ?? state.round,
    phase: state.phase,
    activePlayerName: activePlayer?.name || 'Comunidad',
    activePlayerColor: activePlayer?.color || '#14b8a6',
    commonCount,
    totalResourceTiles,
    difficulty: state.setupConfig?.difficulty || 'EN_TRANSICION',
    playersCount: state.players.length,
    speculatorsCount: state.speculators.length,
    autoResumeOnReload: payload.autoResumeOnReload,
    lastAutosaveReason: payload.autosaveReason,
    lastEndedTurnBy: payload.lastEndedTurnBy,
    autosaveCount: payload.autosaveCount ?? 0
  };
}

export function formatSavedPhaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'GLOBAL_CARD':
      return 'Carta Global';
    case 'PLAYER_TURN_READY':
    case 'DICE_ROLLING':
    case 'MOVE_ANIMATING':
      return 'Turno de jugador';
    case 'TILE_ACTION_DECISION':
      return 'Decisión en casilla';
    case 'SPECULATOR_TURN':
      return 'Turno especuladores';
    case 'GAME_OVER':
      return 'Final de partida';
    default:
      return 'En curso';
  }
}

export function formatSavedTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export function saveGameToStorage(
  state: GameEngineState,
  options?: {
    autoResumeOnReload?: boolean;
    pendingRoundAdvance?: boolean;
    reason?: AutosaveReason;
    endedTurnBy?: string;
  }
): SavedGameMetadata | null {
  if (state.phase === 'TITLE' || state.phase === 'SETUP') {
    return getSavedGameMetadata();
  }

  const storage = getStorage();
  if (!storage) return null;

  const reason: AutosaveReason = options?.reason ?? 'CHECKPOINT';
  let prevAutosaveCount = 0;
  let prevEndedTurnBy: string | undefined;
  try {
    const existingRaw = storage.getItem(STORAGE_KEY);
    if (existingRaw) {
      const existingParsed = JSON.parse(existingRaw) as Partial<PersistedGamePayload>;
      prevAutosaveCount = existingParsed.autosaveCount ?? 0;
      prevEndedTurnBy = existingParsed.lastEndedTurnBy;
    }
  } catch {
    // Ignore parse failure on prior payload
  }

  const isTurnLifecycleSave =
    reason === 'TURN_END' || reason === 'ROUND_END' || reason === 'GAME_OVER';
  const nextAutosaveCount = isTurnLifecycleSave
    ? prevAutosaveCount + 1
    : prevAutosaveCount;

  const serializableState: SerializableGameState = {
    phase: state.phase,
    round: state.round,
    activePlayerIndex: state.activePlayerIndex,
    players: state.players,
    speculators: state.speculators,
    tiles: state.tiles,
    setupConfig: state.setupConfig,
    currentDiceRoll: state.currentDiceRoll,
    activeModal: state.activeModal,
    neighborhoodDecision: state.neighborhoodDecision,
    speculatorAttackPayload: state.speculatorAttackPayload,
    logs: state.logs.slice(0, 600),
    speculatorActionLogs: (state.speculatorActionLogs ?? []).slice(0, 120),
    chatMessages: state.chatMessages.slice(-40),
    gameResult: state.gameResult,
    gameResultDetails: state.gameResultDetails,
    playerStats: state.playerStats,
    performanceHistory: state.performanceHistory,
    turnHistory: state.turnHistory,
    replayFrames: state.replayFrames?.slice(-MAX_REPLAY_FRAMES),
    cameraMode: state.cameraMode,
    soundEnabled: state.soundEnabled,
    hapticsEnabled: state.hapticsEnabled,
    postProcessingEnabled: state.postProcessingEnabled,
    ambientMode: state.ambientMode,
    weatherMode: state.weatherMode,
    weatherIntensity: state.weatherIntensity,
    weatherAdvancedConfig: state.weatherAdvancedConfig,
    timeOfDayMode: state.timeOfDayMode,
    activeCrisis: state.activeCrisis ?? null,
    turnsSinceLastCrisis: state.turnsSinceLastCrisis ?? 0,
    activeWeatherEvent: state.activeWeatherEvent ?? null,
    turnsSinceLastWeatherEvent: state.turnsSinceLastWeatherEvent ?? 0
  };

  const payload: PersistedGamePayload = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    autoResumeOnReload: options?.autoResumeOnReload ?? true,
    pendingRoundAdvance: options?.pendingRoundAdvance ?? false,
    currentGlobalCardId: state.currentGlobalCard?.id ?? null,
    currentSituationCardId: state.currentSituationCard?.id ?? null,
    round: state.round,
    playerStats: buildPlayerAutosaveSnapshot(state),
    tileOwnership: buildTileOwnershipSnapshot(state.tiles),
    autosaveReason: reason,
    lastEndedTurnBy: options?.endedTurnBy ?? prevEndedTurnBy,
    autosaveCount: nextAutosaveCount,
    state: serializableState
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return buildMetadata(payload);
  } catch {
    // Reintentar con un historial más compacto si el almacenamiento está cerca del límite
    try {
      payload.state.logs = state.logs.slice(0, 120);
      payload.state.replayFrames = state.replayFrames?.slice(-12);
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return buildMetadata(payload);
    } catch {
      return null;
    }
  }
}

export function getSavedGameMetadata(): SavedGameMetadata | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGamePayload;
    if (
      !parsed ||
      !isSupportedVersion(parsed.version) ||
      !parsed.state ||
      !Array.isArray(parsed.state.players) ||
      parsed.state.players.length === 0 ||
      !Array.isArray(parsed.state.tiles) ||
      parsed.state.tiles.length === 0
    ) {
      return null;
    }
    return buildMetadata(parsed);
  } catch {
    return null;
  }
}

export function loadSavedGameFromStorage(options?: {
  force?: boolean;
}): {
  state: GameEngineState;
  pendingRoundAdvance: boolean;
  meta: SavedGameMetadata;
} | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGamePayload;

    if (
      !parsed ||
      !isSupportedVersion(parsed.version) ||
      !parsed.state ||
      !Array.isArray(parsed.state.players) ||
      parsed.state.players.length === 0 ||
      !Array.isArray(parsed.state.tiles) ||
      parsed.state.tiles.length < INITIAL_TILES.length
    ) {
      return null;
    }

    if (!options?.force && !parsed.autoResumeOnReload) {
      return null;
    }

    const saved = parsed.state;
    const safePlayerIndex = Math.max(
      0,
      Math.min(saved.activePlayerIndex ?? 0, saved.players.length - 1)
    );

    // Normalizar fases con temporizadores efímeros para evitar bloqueos tras recargar
    let normalizedPhase: GamePhase = saved.phase;
    let normalizedDiceRoll = saved.currentDiceRoll ?? null;
    if (normalizedPhase === 'DICE_ROLLING' || normalizedPhase === 'MOVE_ANIMATING') {
      normalizedPhase = 'PLAYER_TURN_READY';
      normalizedDiceRoll = null;
    }

    // Rehidratar cartas con sus funciones effect/apply desde los mazos oficiales
    const rehydratedGlobalCard = parsed.currentGlobalCardId
      ? GLOBAL_CARDS.find(c => c.id === parsed.currentGlobalCardId) ?? GLOBAL_CARDS[0] ?? null
      : null;

    const rehydratedSituationCard = parsed.currentSituationCardId
      ? SITUATION_CARDS.find(c => c.id === parsed.currentSituationCardId) ?? SITUATION_CARDS[0] ?? null
      : null;

    let normalizedModal = saved.activeModal ?? null;
    if (normalizedPhase === 'GLOBAL_CARD' && !normalizedModal) {
      normalizedModal = 'GLOBAL_CARD';
    }
    if (normalizedModal === 'GLOBAL_CARD' && !rehydratedGlobalCard) {
      normalizedModal = null;
      if (normalizedPhase === 'GLOBAL_CARD') {
        normalizedPhase = 'PLAYER_TURN_READY';
      }
    }
    if (normalizedModal === 'SITUATION_CARD' && !rehydratedSituationCard) {
      normalizedModal = null;
    }

    const restoredState: GameEngineState = {
      phase: normalizedPhase,
      round: Math.max(1, saved.round ?? 1),
      activePlayerIndex: safePlayerIndex,
      players: saved.players.map(p => ({
        ...p,
        neighborhoodReputation: p.neighborhoodReputation ?? 0,
        reputationHistory: Array.isArray(p.reputationHistory) ? p.reputationHistory : []
      })),
      speculators: Array.isArray(saved.speculators) ? saved.speculators : [],
      tiles: saved.tiles,
      setupConfig: saved.setupConfig,
      currentDiceRoll: normalizedDiceRoll,
      currentGlobalCard: rehydratedGlobalCard,
      currentSituationCard: rehydratedSituationCard,
      activeModal: normalizedModal,
      neighborhoodDecision: saved.neighborhoodDecision ?? null,
      speculatorAttackPayload: saved.speculatorAttackPayload,
      logs: Array.isArray(saved.logs) ? saved.logs : [],
      speculatorActionLogs: Array.isArray(saved.speculatorActionLogs) ? saved.speculatorActionLogs : [],
      chatMessages: Array.isArray(saved.chatMessages) ? saved.chatMessages : [],
      gameResult: saved.gameResult,
      gameResultDetails: saved.gameResultDetails,
      playerStats: saved.playerStats,
      performanceHistory: saved.performanceHistory,
      turnHistory: saved.turnHistory,
      replayFrames:
        Array.isArray(saved.replayFrames) && saved.replayFrames.length > 0
          ? saved.replayFrames
          : [
              buildTurnReplayFrame({
                prevFrames: [],
                logs: Array.isArray(saved.logs) ? saved.logs : [],
                round: Math.max(1, saved.round ?? 1),
                actorId: saved.players[safePlayerIndex]?.id ?? 'resume',
                actorName: saved.players[safePlayerIndex]?.name ?? 'Partida Reanudada',
                actorColor: saved.players[safePlayerIndex]?.color ?? '#14b8a6',
                activePlayerIndex: safePlayerIndex,
                diceRoll: normalizedDiceRoll,
                players: saved.players,
                speculators: Array.isArray(saved.speculators) ? saved.speculators : [],
                tiles: saved.tiles,
                fallbackSummary: 'Estado restaurado desde autoguardado'
              })
            ],
      cameraMode: saved.cameraMode || 'ISOMETRIC',
      soundEnabled: saved.soundEnabled ?? true,
      hapticsEnabled: saved.hapticsEnabled ?? hapticsManager.isEnabled(),
      postProcessingEnabled: saved.postProcessingEnabled ?? true,
      ambientMode: saved.ambientMode || 'AUTO',
      weatherMode: saved.weatherMode || 'AUTO',
      weatherIntensity: saved.weatherIntensity ?? 0.85,
      weatherAdvancedConfig: saved.weatherAdvancedConfig
        ? normalizeWeatherAdvancedConfig(saved.weatherAdvancedConfig)
        : loadWeatherAdvancedConfig(),
      timeOfDayMode: saved.timeOfDayMode || 'AUTO',
      activeCrisis: saved.activeCrisis ?? null,
      turnsSinceLastCrisis: saved.turnsSinceLastCrisis ?? 0,
      activeWeatherEvent: saved.activeWeatherEvent ?? null,
      turnsSinceLastWeatherEvent: saved.turnsSinceLastWeatherEvent ?? 0,
      achievements: loadLocalAchievements(),
      recentAchievement: null
    };

    // Si se fuerza reanudación manual desde Título, reactivar autoResumeOnReload para futuras recargas
    if (options?.force && !parsed.autoResumeOnReload) {
      const updatedPayload: PersistedGamePayload = {
        ...parsed,
        autoResumeOnReload: true
      };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(updatedPayload));
      } catch {
        // Ignore storage write failure during forced resume
      }
    }

    return {
      state: restoredState,
      pendingRoundAdvance: Boolean(parsed.pendingRoundAdvance),
      meta: buildMetadata({
        ...parsed,
        autoResumeOnReload: options?.force ? true : parsed.autoResumeOnReload
      })
    };
  } catch {
    return null;
  }
}

export function clearSavedGameFromStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
