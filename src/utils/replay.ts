/**
 * replay.ts
 * Utilidades para capturar, hidratar y analizar fotogramas históricos por turno
 * en el Modo Cine / Repetición de Partida de Commonspoly.
 */

import {
  Character,
  GameEngineState,
  GameLogEntry,
  GoodState,
  ReplayPlayerSnapshot,
  Speculator,
  Tile,
  TurnReplayFrame
} from '../types/game';

export const MAX_REPLAY_FRAMES = 32;

export function captureTileStatesMap(tiles: Tile[]): Record<number, GoodState> {
  const map: Record<number, GoodState> = {};
  tiles.forEach(tile => {
    if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
      map[tile.id] = tile.state ?? tile.defaultState ?? 'PRIVATE';
    }
  });
  return map;
}

function summarizeTurnLogs(logs: GameLogEntry[], fallback: string): string {
  if (logs.length === 0) return fallback;
  const prioritized =
    logs.find(
      l =>
        l.cooperativeAction === 'COMMON_UNLOCK' ||
        l.cooperativeAction === 'AGORA_INSURRECTION' ||
        l.cooperativeAction === 'RESCUE'
    ) ??
    logs.find(l => l.type === 'HAZARD' || l.type === 'CARD' || l.type === 'SUCCESS') ??
    logs[logs.length - 1];
  return prioritized?.message || fallback;
}

export function buildTurnReplayFrame(params: {
  prevFrames?: TurnReplayFrame[];
  logs: GameLogEntry[];
  round: number;
  actorId: string;
  actorName: string;
  actorColor: string;
  activePlayerIndex: number;
  diceRoll: number | null;
  players: Character[];
  speculators: Speculator[];
  tiles: Tile[];
  fallbackSummary?: string;
  activeWeatherTitle?: string;
  activeCrisisTitle?: string;
}): TurnReplayFrame {
  const prevFrames = params.prevFrames ?? [];
  const lastFrame = prevFrames[prevFrames.length - 1];
  const nextFrameIndex = lastFrame ? lastFrame.frameIndex + 1 : 0;

  const prevNewestLogId = lastFrame?.newestLogId;
  let cutIndex = prevNewestLogId
    ? params.logs.findIndex(l => l.id === prevNewestLogId)
    : params.logs.length;
  if (cutIndex === -1) {
    cutIndex = Math.min(params.logs.length, 6);
  }

  // params.logs está ordenado de más reciente (0) a más antiguo
  const turnLogs = params.logs.slice(0, cutIndex).slice(0, 8).reverse();
  const newestLogId = params.logs[0]?.id ?? prevNewestLogId;

  const resourceTiles = params.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
  const publicCount = resourceTiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;

  const playerSnapshots: ReplayPlayerSnapshot[] = params.players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    controller: p.controller,
    position: p.position,
    wellness: p.wellness,
    legitimacy: p.legitimacy,
    isDetained: p.isDetained,
    detentionRoundsLeft: p.detentionRoundsLeft,
    inAgora: p.inAgora,
    roundsInAgora: p.roundsInAgora,
    neighborhoodReputation: p.neighborhoodReputation ?? 0
  }));

  const fallback = params.fallbackSummary || `Turno completado por ${params.actorName}`;
  const eventSummary = summarizeTurnLogs(turnLogs, fallback);

  return {
    frameIndex: nextFrameIndex,
    round: params.round,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actorId: params.actorId,
    actorName: params.actorName,
    actorColor: params.actorColor,
    activePlayerIndex: params.activePlayerIndex,
    diceRoll: params.diceRoll,
    eventSummary,
    turnLogs,
    newestLogId,
    players: playerSnapshots,
    speculators: params.speculators.map(s => ({ ...s })),
    tileStates: captureTileStatesMap(params.tiles),
    commonCount,
    publicCount,
    privateCount,
    activeWeatherTitle: params.activeWeatherTitle,
    activeCrisisTitle: params.activeCrisisTitle
  };
}

export function appendTurnReplayFrame(
  prevFrames: TurnReplayFrame[] | undefined,
  frame: TurnReplayFrame
): TurnReplayFrame[] {
  const next = [...(prevFrames ?? []), frame];
  if (next.length > MAX_REPLAY_FRAMES) {
    return next.slice(next.length - MAX_REPLAY_FRAMES);
  }
  return next;
}

export function hydrateBoardFromReplayFrame(
  baseState: GameEngineState,
  frame: TurnReplayFrame
): {
  tiles: Tile[];
  players: Character[];
  speculators: Speculator[];
  activePlayerIndex: number;
  round: number;
  currentDiceRoll: number | null;
} {
  const hydratedTiles: Tile[] = baseState.tiles.map(tile => {
    const savedState = frame.tileStates[tile.id];
    if (!savedState) return tile;
    return {
      ...tile,
      state: savedState
    };
  });

  const hydratedPlayers: Character[] = baseState.players.map(basePlayer => {
    const snap = frame.players.find(p => p.id === basePlayer.id);
    if (!snap) return basePlayer;
    return {
      ...basePlayer,
      position: snap.position,
      wellness: snap.wellness,
      legitimacy: snap.legitimacy,
      isDetained: snap.isDetained,
      detentionRoundsLeft: snap.detentionRoundsLeft,
      inAgora: snap.inAgora,
      roundsInAgora: snap.roundsInAgora,
      neighborhoodReputation: snap.neighborhoodReputation
    };
  });

  const safeActiveIdx = Math.max(
    0,
    Math.min(frame.activePlayerIndex, Math.max(0, hydratedPlayers.length - 1))
  );

  return {
    tiles: hydratedTiles,
    players: hydratedPlayers,
    speculators: frame.speculators.map(s => ({ ...s })),
    activePlayerIndex: safeActiveIdx,
    round: frame.round,
    currentDiceRoll: frame.diceRoll
  };
}

export interface PlayerDecisionDelta {
  playerId: string;
  wellnessDelta: number;
  legitimacyDelta: number;
  reputationDelta: number;
  prevPosition: number | null;
  nextPosition: number;
}

export interface FrameDecisionAnalysis {
  commonDelta: number;
  publicDelta: number;
  privateDelta: number;
  playerDeltas: Record<string, PlayerDecisionDelta>;
}

export function computeFrameDecisionDeltas(
  frame: TurnReplayFrame,
  prevFrame: TurnReplayFrame | null
): FrameDecisionAnalysis {
  const playerDeltas: Record<string, PlayerDecisionDelta> = {};

  frame.players.forEach(p => {
    const prevP = prevFrame?.players.find(pp => pp.id === p.id);
    playerDeltas[p.id] = {
      playerId: p.id,
      wellnessDelta: prevP ? p.wellness - prevP.wellness : 0,
      legitimacyDelta: prevP ? p.legitimacy - prevP.legitimacy : 0,
      reputationDelta: prevP ? p.neighborhoodReputation - prevP.neighborhoodReputation : 0,
      prevPosition: prevP ? prevP.position : null,
      nextPosition: p.position
    };
  });

  return {
    commonDelta: prevFrame ? frame.commonCount - prevFrame.commonCount : 0,
    publicDelta: prevFrame ? frame.publicCount - prevFrame.publicCount : 0,
    privateDelta: prevFrame ? frame.privateCount - prevFrame.privateCount : 0,
    playerDeltas
  };
}
