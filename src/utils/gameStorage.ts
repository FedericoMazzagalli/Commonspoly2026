/**
 * gameStorage.ts
 * Persistencia local completa de partidas en LocalStorage con esquema versionado,
 * rehidratación de cartas (funciones) y normalización segura de fases transitorias.
 */

import {
  DifficultyLevel,
  GameEngineState,
  GamePhase,
  Tile
} from '../types/game';
import { GLOBAL_CARDS, SITUATION_CARDS } from '../data/cards';
import { INITIAL_TILES } from '../data/tiles';
import { loadLocalAchievements } from './achievements';
import { hapticsManager } from './haptics';

const STORAGE_KEY = 'commonspoly_saved_game_v1';
const SCHEMA_VERSION = 1;

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
  chatMessages: GameEngineState['chatMessages'];
  gameResult?: GameEngineState['gameResult'];
  gameResultDetails?: GameEngineState['gameResultDetails'];
  playerStats?: GameEngineState['playerStats'];
  performanceHistory?: GameEngineState['performanceHistory'];
  turnHistory?: GameEngineState['turnHistory'];
  cameraMode: GameEngineState['cameraMode'];
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  postProcessingEnabled?: boolean;
  ambientMode: GameEngineState['ambientMode'];
  weatherMode: GameEngineState['weatherMode'];
  weatherIntensity?: number;
  timeOfDayMode?: GameEngineState['timeOfDayMode'];
  activeCrisis?: GameEngineState['activeCrisis'];
  turnsSinceLastCrisis?: number;
}

interface PersistedGamePayload {
  version: number;
  savedAt: string;
  autoResumeOnReload: boolean;
  pendingRoundAdvance: boolean;
  currentGlobalCardId: string | null;
  currentSituationCardId: string | null;
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

function buildMetadata(payload: PersistedGamePayload): SavedGameMetadata {
  const { state } = payload;
  const activePlayer = state.players[state.activePlayerIndex] || state.players[0];
  const { commonCount, totalResourceTiles } = countResourceProgress(state.tiles);

  return {
    savedAt: payload.savedAt,
    round: state.round,
    phase: state.phase,
    activePlayerName: activePlayer?.name || 'Comunidad',
    activePlayerColor: activePlayer?.color || '#14b8a6',
    commonCount,
    totalResourceTiles,
    difficulty: state.setupConfig?.difficulty || 'EN_TRANSICION',
    playersCount: state.players.length,
    speculatorsCount: state.speculators.length,
    autoResumeOnReload: payload.autoResumeOnReload
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
  options?: { autoResumeOnReload?: boolean; pendingRoundAdvance?: boolean }
): SavedGameMetadata | null {
  if (state.phase === 'TITLE' || state.phase === 'SETUP') {
    return getSavedGameMetadata();
  }

  const storage = getStorage();
  if (!storage) return null;

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
    chatMessages: state.chatMessages.slice(-40),
    gameResult: state.gameResult,
    gameResultDetails: state.gameResultDetails,
    playerStats: state.playerStats,
    performanceHistory: state.performanceHistory,
    turnHistory: state.turnHistory,
    cameraMode: state.cameraMode,
    soundEnabled: state.soundEnabled,
    hapticsEnabled: state.hapticsEnabled,
    postProcessingEnabled: state.postProcessingEnabled,
    ambientMode: state.ambientMode,
    weatherMode: state.weatherMode,
    weatherIntensity: state.weatherIntensity,
    timeOfDayMode: state.timeOfDayMode,
    activeCrisis: state.activeCrisis ?? null,
    turnsSinceLastCrisis: state.turnsSinceLastCrisis ?? 0
  };

  const payload: PersistedGamePayload = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    autoResumeOnReload: options?.autoResumeOnReload ?? true,
    pendingRoundAdvance: options?.pendingRoundAdvance ?? false,
    currentGlobalCardId: state.currentGlobalCard?.id ?? null,
    currentSituationCardId: state.currentSituationCard?.id ?? null,
    state: serializableState
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return buildMetadata(payload);
  } catch {
    // Reintentar con un historial más compacto si el almacenamiento está cerca del límite
    try {
      payload.state.logs = state.logs.slice(0, 120);
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
      parsed.version !== SCHEMA_VERSION ||
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
      parsed.version !== SCHEMA_VERSION ||
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
      players: saved.players,
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
      chatMessages: Array.isArray(saved.chatMessages) ? saved.chatMessages : [],
      gameResult: saved.gameResult,
      gameResultDetails: saved.gameResultDetails,
      playerStats: saved.playerStats,
      performanceHistory: saved.performanceHistory,
      turnHistory: saved.turnHistory,
      cameraMode: saved.cameraMode || 'ISOMETRIC',
      soundEnabled: saved.soundEnabled ?? true,
      hapticsEnabled: saved.hapticsEnabled ?? hapticsManager.isEnabled(),
      postProcessingEnabled: saved.postProcessingEnabled ?? true,
      ambientMode: saved.ambientMode || 'AUTO',
      weatherMode: saved.weatherMode || 'AUTO',
      weatherIntensity: saved.weatherIntensity ?? 0.85,
      timeOfDayMode: saved.timeOfDayMode || 'AUTO',
      activeCrisis: saved.activeCrisis ?? null,
      turnsSinceLastCrisis: saved.turnsSinceLastCrisis ?? 0,
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
