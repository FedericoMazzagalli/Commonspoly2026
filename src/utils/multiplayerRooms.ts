/**
 * multiplayerRooms.ts
 * Servicio de Salas Multijugador Cooperativas Online en Firebase Firestore.
 * Arquitectura host-autoritativa con mapas/listas nativas de Firestore (cero blobs JSON.stringify)
 * alineada estrictamente con firebase-blueprint.json y firestore.rules.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, type User } from '../firebase';
import { OFFICIAL_CHARACTERS, createInitialCharacter } from '../data/characters';
import { INITIAL_TILES, applyInitialDifficultyToTiles } from '../data/tiles';
import {
  Character,
  DifficultyLevel,
  GameEngineState,
  GamePhase,
  GoodState,
  SetupInitialRolls,
  Speculator
} from '../types/game';

export const ROOMS_COLLECTION = 'rooms';
export const ROOM_ACTIONS_SUBCOLLECTION = 'actions';

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';
export type CompactTileState = 'PRIVATE' | 'PUBLIC' | 'COMMON' | 'NONE';

export type MultiplayerActionType =
  | 'ROLL_DICE'
  | 'UNLOCK_TILE'
  | 'PASS_TILE'
  | 'TRY_AGORA'
  | 'STAY_AGORA'
  | 'RESOLVE_CARD'
  | 'CLOSE_MODAL'
  | 'RESCUE_PLAYER'
  | 'CHAT';

export interface MultiplayerMember {
  uid: string;
  displayAlias: string;
  characterId: string;
  ready: boolean;
  isHost: boolean;
}

export interface CompactRoomPlayer {
  id: string;
  name: string;
  color: string;
  controller: 'HUMAN' | 'BOT';
  wellness: number;
  legitimacy: number;
  position: number;
  isDetained: boolean;
  detentionRoundsLeft: number;
  inAgora: boolean;
  roundsInAgora: number;
}

export interface CompactRoomSpeculator {
  id: number;
  name: string;
  position: number;
  color: string;
}

export interface MultiplayerRoom {
  roomId: string;
  roomCode: string;
  hostUid: string;
  status: RoomStatus;
  isPublic: boolean;
  difficulty: DifficultyLevel;
  maxPlayers: number;
  memberUids: string[];
  members: MultiplayerMember[];
  stateVersion: number;
  phase: GamePhase;
  round: number;
  activePlayerIndex: number;
  currentDiceRoll: number;
  playersSummary: CompactRoomPlayer[];
  speculatorsSummary: CompactRoomSpeculator[];
  tileStates: CompactTileState[];
  gameResult: 'NONE' | 'VICTORY' | 'DRAW' | 'DEFEAT';
  gameResultDetails: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface MultiplayerActionIntent {
  actionId: string;
  uid: string;
  hostUid: string;
  displayAlias: string;
  actionType: MultiplayerActionType;
  payloadText: string;
  targetRound: number;
  processed: boolean;
  createdAtMs?: number;
}

function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeAlias(raw: string | undefined): string {
  const cleaned = (raw ?? '').trim().replace(/\s+/g, ' ');
  return (cleaned || 'Activista').slice(0, 32);
}

function sanitizeCharId(raw: string | undefined): string {
  const cleaned = (raw ?? 'carolina').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return OFFICIAL_CHARACTERS.some(c => c.id === cleaned) ? cleaned : 'carolina';
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function toMillis(ts: unknown): number | undefined {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

export function buildSetupRollsForDifficulty(difficulty: DifficultyLevel): SetupInitialRolls {
  if (difficulty === 'MAD_MAX') {
    return {
      health: 2,
      urban: 2,
      knowledge: 3,
      environment: 2,
      totalSum: 9,
      difficulty,
      speculatorsCount: 3
    };
  }
  if (difficulty === 'COMUNLANDIA') {
    return {
      health: 5,
      urban: 4,
      knowledge: 5,
      environment: 4,
      totalSum: 18,
      difficulty,
      speculatorsCount: 2
    };
  }
  return {
    health: 3,
    urban: 3,
    knowledge: 4,
    environment: 4,
    totalSum: 14,
    difficulty: 'EN_TRANSICION',
    speculatorsCount: 2
  };
}

export function serializeTilesToArray(tiles: GameEngineState['tiles']): CompactTileState[] {
  const arr: CompactTileState[] = [];
  for (let i = 0; i < 40; i++) {
    const t = tiles.find(tile => tile.id === i);
    const st = t?.state;
    if (st === 'COMMON' || st === 'PUBLIC' || st === 'PRIVATE') {
      arr.push(st);
    } else {
      arr.push('NONE');
    }
  }
  return arr;
}

export function tileArrayToStateMap(tileStates: CompactTileState[]): Record<string, GoodState> {
  const map: Record<string, GoodState> = {};
  tileStates.forEach((st, idx) => {
    if (st === 'COMMON' || st === 'PUBLIC' || st === 'PRIVATE') {
      map[String(idx)] = st;
    }
  });
  return map;
}

export function serializePlayersSummary(players: Character[]): CompactRoomPlayer[] {
  return players.slice(0, 8).map(p => ({
    id: sanitizeCharId(p.id),
    name: p.name.slice(0, 40),
    color: p.color.slice(0, 16),
    controller: p.controller,
    wellness: clampInt(p.wellness, 0, 99),
    legitimacy: clampInt(p.legitimacy, 0, 99),
    position: clampInt(p.position, 0, 100),
    isDetained: Boolean(p.isDetained),
    detentionRoundsLeft: clampInt(p.detentionRoundsLeft, 0, 10),
    inAgora: Boolean(p.inAgora),
    roundsInAgora: clampInt(p.roundsInAgora, 0, 10)
  }));
}

export function rehydrateCharactersFromRoom(playersSummary: CompactRoomPlayer[]): Character[] {
  return playersSummary.map(ps => {
    const base = OFFICIAL_CHARACTERS.find(c => c.id === ps.id) || OFFICIAL_CHARACTERS[0];
    const hydrated = createInitialCharacter(base, ps.controller);
    return {
      ...hydrated,
      wellness: ps.wellness,
      legitimacy: ps.legitimacy,
      position: ps.position,
      isDetained: ps.isDetained,
      detentionRoundsLeft: ps.detentionRoundsLeft,
      inAgora: ps.inAgora,
      roundsInAgora: ps.roundsInAgora
    };
  });
}

export function serializeSpeculatorsSummary(speculators: Speculator[]): CompactRoomSpeculator[] {
  return speculators.slice(0, 3).map(s => ({
    id: clampInt(s.id, 1, 3),
    name: s.name.slice(0, 40),
    position: clampInt(s.position, 0, 39),
    color: (s.color || '#FFFFFF').slice(0, 16)
  }));
}

function docToRoom(id: string, data: Record<string, unknown>): MultiplayerRoom {
  const rawMembers = Array.isArray(data.members) ? data.members : [];
  const members: MultiplayerMember[] = rawMembers
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
    .map(m => ({
      uid: typeof m.uid === 'string' ? m.uid : '',
      displayAlias: sanitizeAlias(typeof m.displayAlias === 'string' ? m.displayAlias : undefined),
      characterId: sanitizeCharId(typeof m.characterId === 'string' ? m.characterId : undefined),
      ready: Boolean(m.ready),
      isHost: Boolean(m.isHost)
    }));

  const rawPlayers = Array.isArray(data.playersSummary) ? data.playersSummary : [];
  const playersSummary: CompactRoomPlayer[] = rawPlayers
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map(p => ({
      id: sanitizeCharId(typeof p.id === 'string' ? p.id : undefined),
      name: (typeof p.name === 'string' ? p.name : 'Activista').slice(0, 40),
      color: (typeof p.color === 'string' ? p.color : '#14b8a6').slice(0, 16),
      controller: p.controller === 'BOT' ? 'BOT' : 'HUMAN',
      wellness: clampInt(Number(p.wellness ?? 5), 0, 99),
      legitimacy: clampInt(Number(p.legitimacy ?? 5), 0, 99),
      position: clampInt(Number(p.position ?? 0), 0, 100),
      isDetained: Boolean(p.isDetained),
      detentionRoundsLeft: clampInt(Number(p.detentionRoundsLeft ?? 0), 0, 10),
      inAgora: Boolean(p.inAgora),
      roundsInAgora: clampInt(Number(p.roundsInAgora ?? 0), 0, 10)
    }));

  const rawSpecs = Array.isArray(data.speculatorsSummary) ? data.speculatorsSummary : [];
  const speculatorsSummary: CompactRoomSpeculator[] = rawSpecs
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map(s => ({
      id: clampInt(Number(s.id ?? 1), 1, 3),
      name: (typeof s.name === 'string' ? s.name : 'Especulador').slice(0, 40),
      position: clampInt(Number(s.position ?? 0), 0, 39),
      color: (typeof s.color === 'string' ? s.color : '#FFFFFF').slice(0, 16)
    }));

  const rawTiles = Array.isArray(data.tileStates) ? data.tileStates : [];
  const tileStates: CompactTileState[] = Array.from({ length: 40 }, (_, i) => {
    const val = rawTiles[i];
    return val === 'COMMON' || val === 'PUBLIC' || val === 'PRIVATE' ? val : 'NONE';
  });

  const validStatus: RoomStatus =
    data.status === 'PLAYING' || data.status === 'FINISHED' ? data.status : 'WAITING';
  const validDifficulty: DifficultyLevel =
    data.difficulty === 'MAD_MAX' || data.difficulty === 'COMUNLANDIA'
      ? data.difficulty
      : 'EN_TRANSICION';

  return {
    roomId: id,
    roomCode: typeof data.roomCode === 'string' ? data.roomCode : id.slice(0, 6).toUpperCase(),
    hostUid: typeof data.hostUid === 'string' ? data.hostUid : '',
    status: validStatus,
    isPublic: Boolean(data.isPublic),
    difficulty: validDifficulty,
    maxPlayers: clampInt(Number(data.maxPlayers ?? 4), 2, 4),
    memberUids: Array.isArray(data.memberUids)
      ? data.memberUids.filter((u): u is string => typeof u === 'string')
      : [],
    members,
    stateVersion: clampInt(Number(data.stateVersion ?? 0), 0, 999999),
    phase: (typeof data.phase === 'string' ? data.phase : 'PLAYER_TURN_READY') as GamePhase,
    round: clampInt(Number(data.round ?? 1), 1, 20),
    activePlayerIndex: clampInt(Number(data.activePlayerIndex ?? 0), 0, 7),
    currentDiceRoll: clampInt(Number(data.currentDiceRoll ?? 0), 0, 6),
    playersSummary,
    speculatorsSummary,
    tileStates,
    gameResult:
      data.gameResult === 'VICTORY' || data.gameResult === 'DRAW' || data.gameResult === 'DEFEAT'
        ? data.gameResult
        : 'NONE',
    gameResultDetails:
      typeof data.gameResultDetails === 'string' ? data.gameResultDetails.slice(0, 240) : '',
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt)
  };
}

export async function createMultiplayerRoom(
  user: User,
  displayAlias: string,
  characterId: string,
  difficulty: DifficultyLevel,
  maxPlayers = 4,
  isPublic = true
): Promise<MultiplayerRoom> {
  if (!user.emailVerified) {
    throw new Error('Se requiere una cuenta de Google con correo verificado para crear una sala.');
  }

  const roomCode = generateRoomCode();
  const roomId = `room_${roomCode}`;
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const path = `${ROOMS_COLLECTION}/${roomId}`;

  const cleanCharId = sanitizeCharId(characterId);
  const baseChar = OFFICIAL_CHARACTERS.find(c => c.id === cleanCharId) || OFFICIAL_CHARACTERS[0];
  const initialPlayer = createInitialCharacter(baseChar, 'HUMAN');
  const rolls = buildSetupRollsForDifficulty(difficulty);
  const initialTiles = applyInitialDifficultyToTiles(INITIAL_TILES, rolls);

  const member: MultiplayerMember = {
    uid: user.uid,
    displayAlias: sanitizeAlias(displayAlias || user.displayName || undefined),
    characterId: cleanCharId,
    ready: true,
    isHost: true
  };

  const payload = {
    roomCode,
    hostUid: user.uid,
    status: 'WAITING' as RoomStatus,
    isPublic: Boolean(isPublic),
    difficulty,
    maxPlayers: clampInt(maxPlayers, 2, 4),
    memberUids: [user.uid],
    members: [member],
    stateVersion: 1,
    phase: 'PLAYER_TURN_READY' as GamePhase,
    round: 1,
    activePlayerIndex: 0,
    currentDiceRoll: 0,
    playersSummary: serializePlayersSummary([initialPlayer]),
    speculatorsSummary: serializeSpeculatorsSummary([
      { id: 1, position: 0, name: 'Fondo Buitre Inmobiliario', color: '#FFFFFF' },
      { id: 2, position: 0, name: 'Corporación Farmacéutica', color: '#E2E8F0' }
    ]),
    tileStates: serializeTilesToArray(initialTiles),
    gameResult: 'NONE' as const,
    gameResultDetails: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(roomRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return docToRoom(roomId, {
    ...payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
}

export async function joinMultiplayerRoomByCode(
  user: User,
  rawCode: string,
  displayAlias: string,
  preferredCharacterId: string
): Promise<MultiplayerRoom> {
  if (!user.emailVerified) {
    throw new Error('Inicia sesión con Google verificado para unirte a una sala.');
  }

  const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (normalized.length < 4) {
    throw new Error('Introduce un código de sala válido (ej. ABC123).');
  }

  const roomId = `room_${normalized}`;
  return joinMultiplayerRoomById(user, roomId, displayAlias, preferredCharacterId);
}

export async function joinMultiplayerRoomById(
  user: User,
  roomId: string,
  displayAlias: string,
  preferredCharacterId: string
): Promise<MultiplayerRoom> {
  if (!user.emailVerified) {
    throw new Error('Inicia sesión con Google verificado para unirte a una sala.');
  }

  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const path = `${ROOMS_COLLECTION}/${roomId}`;

  let snap;
  try {
    snap = await getDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    throw new Error('No se encontró ninguna sala activa con ese código.');
  }

  const room = docToRoom(snap.id, snap.data() as Record<string, unknown>);
  if (room.memberUids.includes(user.uid)) {
    return room;
  }

  if (room.status !== 'WAITING') {
    throw new Error('Esta partida online ya está en curso o finalizada.');
  }

  if (room.memberUids.length >= room.maxPlayers) {
    throw new Error('La sala ha alcanzado el máximo de jugadoras.');
  }

  const usedChars = new Set(room.members.map(m => m.characterId));
  let chosenCharId = sanitizeCharId(preferredCharacterId);
  if (usedChars.has(chosenCharId)) {
    const fallback = OFFICIAL_CHARACTERS.find(c => !usedChars.has(c.id));
    if (fallback) chosenCharId = fallback.id;
  }

  const nextMember: MultiplayerMember = {
    uid: user.uid,
    displayAlias: sanitizeAlias(displayAlias || user.displayName || undefined),
    characterId: chosenCharId,
    ready: false,
    isHost: false
  };

  const nextMemberUids = [...room.memberUids, user.uid];
  const nextMembers = [...room.members, nextMember];

  try {
    await updateDoc(roomRef, {
      memberUids: nextMemberUids,
      members: nextMembers,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...room,
    memberUids: nextMemberUids,
    members: nextMembers
  };
}

export async function updateRoomMemberSelection(
  room: MultiplayerRoom,
  uid: string,
  characterId: string,
  ready: boolean
): Promise<void> {
  const path = `${ROOMS_COLLECTION}/${room.roomId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, room.roomId);
  const cleanChar = sanitizeCharId(characterId);
  const nextMembers = room.members.map(m =>
    m.uid === uid ? { ...m, characterId: cleanChar, ready } : m
  );

  try {
    await updateDoc(roomRef, {
      members: nextMembers,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leaveMultiplayerRoom(room: MultiplayerRoom, uid: string): Promise<void> {
  const path = `${ROOMS_COLLECTION}/${room.roomId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, room.roomId);

  const nextMemberUids = room.memberUids.filter(id => id !== uid);
  const nextMembers = room.members.filter(m => m.uid !== uid);
  const nextStatus: RoomStatus = nextMemberUids.length === 0 ? 'FINISHED' : room.status;

  try {
    await updateDoc(roomRef, {
      memberUids: nextMemberUids,
      members: nextMembers,
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchPublicWaitingRooms(maxRows = 15): Promise<MultiplayerRoom[]> {
  try {
    const q = query(
      collection(db, ROOMS_COLLECTION),
      where('isPublic', '==', true),
      where('status', '==', 'WAITING'),
      limit(Math.min(25, Math.max(1, maxRows)))
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToRoom(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ROOMS_COLLECTION);
  }
}

export function subscribeToRoom(
  roomId: string,
  onData: (room: MultiplayerRoom) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `${ROOMS_COLLECTION}/${roomId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  return onSnapshot(
    roomRef,
    snap => {
      if (snap.exists()) {
        onData(docToRoom(snap.id, snap.data() as Record<string, unknown>));
      }
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function launchRoomMatchByHost(
  room: MultiplayerRoom,
  roster: Array<{ baseCharId: string; controller: 'HUMAN' | 'BOT' }>,
  rolls: SetupInitialRolls
): Promise<void> {
  const path = `${ROOMS_COLLECTION}/${room.roomId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, room.roomId);

  const players = roster.map(sc => {
    const base = OFFICIAL_CHARACTERS.find(c => c.id === sc.baseCharId) || OFFICIAL_CHARACTERS[0];
    return createInitialCharacter(base, sc.controller);
  });
  const tiles = applyInitialDifficultyToTiles(INITIAL_TILES, rolls);
  const speculators: Speculator[] = Array.from({ length: rolls.speculatorsCount }, (_, i) => ({
    id: i + 1,
    position: 0,
    name:
      i === 0
        ? 'Fondo Buitre Inmobiliario'
        : i === 1
        ? 'Corporación Farmacéutica'
        : 'Monopolio Tecnológico',
    color: '#FFFFFF'
  }));

  try {
    await updateDoc(roomRef, {
      status: 'PLAYING' as RoomStatus,
      stateVersion: room.stateVersion + 1,
      phase: 'PLAYER_TURN_READY' as GamePhase,
      round: 1,
      activePlayerIndex: 0,
      currentDiceRoll: 0,
      playersSummary: serializePlayersSummary(players),
      speculatorsSummary: serializeSpeculatorsSummary(speculators),
      tileStates: serializeTilesToArray(tiles),
      gameResult: 'NONE',
      gameResultDetails: '',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncHostGameStateToRoom(
  roomId: string,
  state: GameEngineState,
  nextVersion: number
): Promise<void> {
  const path = `${ROOMS_COLLECTION}/${roomId}`;
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const status: RoomStatus = state.phase === 'GAME_OVER' ? 'FINISHED' : 'PLAYING';

  try {
    await updateDoc(roomRef, {
      status,
      stateVersion: clampInt(nextVersion, 1, 999999),
      phase: state.phase,
      round: clampInt(state.round, 1, 20),
      activePlayerIndex: clampInt(state.activePlayerIndex, 0, 7),
      currentDiceRoll: clampInt(state.currentDiceRoll ?? 0, 0, 6),
      playersSummary: serializePlayersSummary(state.players),
      speculatorsSummary: serializeSpeculatorsSummary(state.speculators),
      tileStates: serializeTilesToArray(state.tiles),
      gameResult: state.gameResult ?? 'NONE',
      gameResultDetails: (state.gameResultDetails || '').slice(0, 240),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitRoomActionIntent(
  roomId: string,
  hostUid: string,
  user: User,
  displayAlias: string,
  actionType: MultiplayerActionType,
  targetRound: number,
  payloadText = ''
): Promise<void> {
  if (!user.emailVerified) return;
  const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${ROOMS_COLLECTION}/${roomId}/${ROOM_ACTIONS_SUBCOLLECTION}/${actionId}`;
  const actionRef = doc(db, ROOMS_COLLECTION, roomId, ROOM_ACTIONS_SUBCOLLECTION, actionId);

  try {
    await setDoc(actionRef, {
      uid: user.uid,
      hostUid,
      displayAlias: sanitizeAlias(displayAlias || user.displayName || undefined),
      actionType,
      payloadText: payloadText.trim().slice(0, 180),
      targetRound: clampInt(targetRound, 1, 20),
      processed: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToPendingRoomActions(
  roomId: string,
  hostUid: string,
  onActions: (actions: MultiplayerActionIntent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `${ROOMS_COLLECTION}/${roomId}/${ROOM_ACTIONS_SUBCOLLECTION}`;
  const q = query(
    collection(db, ROOMS_COLLECTION, roomId, ROOM_ACTIONS_SUBCOLLECTION),
    where('hostUid', '==', hostUid),
    where('processed', '==', false),
    limit(25)
  );

  return onSnapshot(
    q,
    snap => {
      const actions: MultiplayerActionIntent[] = snap.docs
        .map(d => {
          const data = d.data() as Record<string, unknown>;
          return {
            actionId: d.id,
            uid: typeof data.uid === 'string' ? data.uid : '',
            hostUid: typeof data.hostUid === 'string' ? data.hostUid : hostUid,
            displayAlias: sanitizeAlias(typeof data.displayAlias === 'string' ? data.displayAlias : undefined),
            actionType: (typeof data.actionType === 'string' ? data.actionType : 'CHAT') as MultiplayerActionType,
            payloadText: typeof data.payloadText === 'string' ? data.payloadText : '',
            targetRound: clampInt(Number(data.targetRound ?? 1), 1, 20),
            processed: Boolean(data.processed),
            createdAtMs: toMillis(data.createdAt)
          };
        })
        .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
      onActions(actions);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function markRoomActionProcessed(roomId: string, actionId: string): Promise<void> {
  const path = `${ROOMS_COLLECTION}/${roomId}/${ROOM_ACTIONS_SUBCOLLECTION}/${actionId}`;
  const actionRef = doc(db, ROOMS_COLLECTION, roomId, ROOM_ACTIONS_SUBCOLLECTION, actionId);
  try {
    await updateDoc(actionRef, { processed: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
