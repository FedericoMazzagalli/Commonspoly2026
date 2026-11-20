/**
 * leaderboard.ts
 * Servicio de Clasificación Global ('Leaderboard') para Commonspoly:
 * - Almacena y compara la puntuación más alta de Eficiencia Cooperativa en Firestore (/leaderboard/{userId})
 * - Mantiene respaldo local en localStorage cuando el jugador aún no ha iniciado sesión con Google
 * - Garantiza saneamiento estricto alineado con firebase-blueprint.json y firestore.rules
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
import { Character, GameEngineState } from '../types/game';
import { CooperativeEfficiencyBreakdown } from './cooperativeEfficiency';

export const LEADERBOARD_COLLECTION = 'leaderboard';
export const LOCAL_BEST_STORAGE_KEY = 'commonspoly_leaderboard_local_best_v1';
export const LEADERBOARD_ALIAS_STORAGE_KEY = 'commonspoly_leaderboard_alias_v1';

export type MatchResultType = 'VICTORY' | 'DRAW' | 'DEFEAT';

export interface LeaderboardMatchSnapshot {
  displayAlias: string;
  leadCharacterId: string;
  efficiencyPct: number;
  boardRecoveryPct: number;
  teamSynergyPct: number;
  tierLabel: string;
  result: MatchResultType;
  round: number;
  commonCount: number;
  totalResourceTiles: number;
  totalCooperativeActions: number;
  playersCount: number;
  teamSummary: string;
}

export interface LeaderboardEntry extends LeaderboardMatchSnapshot {
  uid: string;
  isPublic: true;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface LocalBestRecord extends LeaderboardMatchSnapshot {
  achievedAtMs: number;
  pendingSync: boolean;
}

export type LeaderboardSubmissionStatus =
  | { state: 'IDLE' }
  | { state: 'SUBMITTING' }
  | { state: 'CREATED'; entry: LeaderboardEntry }
  | { state: 'UPDATED_RECORD'; entry: LeaderboardEntry; prevEfficiencyPct: number }
  | { state: 'NOT_HIGHER'; existingBestPct: number; matchPct: number }
  | { state: 'SAVED_LOCAL_PENDING'; record: LocalBestRecord }
  | { state: 'ERROR'; message: string };

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeDisplayAlias(raw: string | undefined): string {
  const cleaned = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Cooperativa Vecinal';
  return cleaned.slice(0, 48);
}

function sanitizeCharacterId(raw: string | undefined): string {
  const normalized = (raw ?? 'carolina')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
  return normalized || 'carolina';
}

function sanitizeTeamSummary(players: Character[]): string {
  const names = players
    .map(p => p.name.trim().split(' ')[0])
    .filter(Boolean)
    .join(', ');
  const value = names || 'Equipo Cooperativo';
  return value.slice(0, 120);
}

export function loadSavedLeaderboardAlias(): string {
  try {
    return localStorage.getItem(LEADERBOARD_ALIAS_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLeaderboardAlias(alias: string): void {
  try {
    const trimmed = alias.trim().slice(0, 48);
    if (trimmed) {
      localStorage.setItem(LEADERBOARD_ALIAS_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(LEADERBOARD_ALIAS_STORAGE_KEY);
    }
  } catch {
    // Ignorar errores de cuota de almacenamiento local
  }
}

export function buildLeaderboardSnapshotFromMatch(
  breakdown: CooperativeEfficiencyBreakdown,
  result: MatchResultType,
  round: number,
  players: Character[],
  preferredAlias?: string
): LeaderboardMatchSnapshot {
  const leadHuman = players.find(p => p.controller === 'HUMAN') ?? players[0];
  const savedAlias = loadSavedLeaderboardAlias();
  const displayAlias = sanitizeDisplayAlias(
    preferredAlias || savedAlias || (leadHuman ? `Equipo ${leadHuman.name.split(' ')[0]}` : 'Cooperativa Vecinal')
  );

  return {
    displayAlias,
    leadCharacterId: sanitizeCharacterId(leadHuman?.id),
    efficiencyPct: clampInt(breakdown.efficiencyPct, 0, 100),
    boardRecoveryPct: clampInt(breakdown.boardRecoveryPct, 0, 100),
    teamSynergyPct: clampInt(breakdown.teamSynergyPct, 0, 100),
    tierLabel: (breakdown.tierLabel.trim() || 'Transición Parcial').slice(0, 48),
    result,
    round: clampInt(round, 1, 20),
    commonCount: clampInt(breakdown.commonCount, 0, 40),
    totalResourceTiles: clampInt(breakdown.totalResourceTiles, 1, 40),
    totalCooperativeActions: clampInt(breakdown.totalCooperativeActions, 0, 9999),
    playersCount: clampInt(players.length, 2, 8),
    teamSummary: sanitizeTeamSummary(players)
  };
}

export function isRecordBetter(
  candidate: Pick<LeaderboardMatchSnapshot, 'efficiencyPct' | 'round' | 'totalCooperativeActions'>,
  existing: Pick<LeaderboardMatchSnapshot, 'efficiencyPct' | 'round' | 'totalCooperativeActions'>
): boolean {
  if (candidate.efficiencyPct !== existing.efficiencyPct) {
    return candidate.efficiencyPct > existing.efficiencyPct;
  }
  if (candidate.round !== existing.round) {
    return candidate.round < existing.round;
  }
  return candidate.totalCooperativeActions > existing.totalCooperativeActions;
}

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.efficiencyPct !== a.efficiencyPct) return b.efficiencyPct - a.efficiencyPct;
    if (a.round !== b.round) return a.round - b.round;
    if (b.totalCooperativeActions !== a.totalCooperativeActions) {
      return b.totalCooperativeActions - a.totalCooperativeActions;
    }
    return (a.updatedAtMs ?? 0) - (b.updatedAtMs ?? 0);
  });
}

export function loadLocalBestRecord(): LocalBestRecord | null {
  try {
    const raw = localStorage.getItem(LOCAL_BEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalBestRecord>;
    if (typeof parsed.efficiencyPct !== 'number' || typeof parsed.round !== 'number') {
      return null;
    }
    return {
      displayAlias: sanitizeDisplayAlias(parsed.displayAlias),
      leadCharacterId: sanitizeCharacterId(parsed.leadCharacterId),
      efficiencyPct: clampInt(parsed.efficiencyPct, 0, 100),
      boardRecoveryPct: clampInt(parsed.boardRecoveryPct ?? 0, 0, 100),
      teamSynergyPct: clampInt(parsed.teamSynergyPct ?? 0, 0, 100),
      tierLabel: (parsed.tierLabel || 'Transición Parcial').slice(0, 48),
      result:
        parsed.result === 'VICTORY' || parsed.result === 'DRAW' || parsed.result === 'DEFEAT'
          ? parsed.result
          : 'DRAW',
      round: clampInt(parsed.round, 1, 20),
      commonCount: clampInt(parsed.commonCount ?? 0, 0, 40),
      totalResourceTiles: clampInt(parsed.totalResourceTiles ?? 22, 1, 40),
      totalCooperativeActions: clampInt(parsed.totalCooperativeActions ?? 0, 0, 9999),
      playersCount: clampInt(parsed.playersCount ?? 4, 2, 8),
      teamSummary: (parsed.teamSummary || 'Equipo Cooperativo').slice(0, 120),
      achievedAtMs: typeof parsed.achievedAtMs === 'number' ? parsed.achievedAtMs : Date.now(),
      pendingSync: Boolean(parsed.pendingSync)
    };
  } catch {
    return null;
  }
}

export function saveLocalBestRecordIfBetter(
  snapshot: LeaderboardMatchSnapshot,
  pendingSync: boolean
): { record: LocalBestRecord; improved: boolean } {
  const existing = loadLocalBestRecord();
  if (!existing || isRecordBetter(snapshot, existing)) {
    const nextRecord: LocalBestRecord = {
      ...snapshot,
      achievedAtMs: Date.now(),
      pendingSync
    };
    try {
      localStorage.setItem(LOCAL_BEST_STORAGE_KEY, JSON.stringify(nextRecord));
    } catch {
      // Ignorar errores de cuota
    }
    return { record: nextRecord, improved: true };
  }
  return { record: existing, improved: false };
}

export function markLocalBestSynced(syncedSnapshot?: LeaderboardMatchSnapshot): LocalBestRecord | null {
  const existing = loadLocalBestRecord();
  const base = syncedSnapshot
    ? {
        ...syncedSnapshot,
        achievedAtMs: existing?.achievedAtMs ?? Date.now(),
        pendingSync: false
      }
    : existing
    ? { ...existing, pendingSync: false }
    : null;

  if (!base) return null;
  try {
    localStorage.setItem(LOCAL_BEST_STORAGE_KEY, JSON.stringify(base));
  } catch {
    // Ignorar errores de cuota
  }
  return base;
}

function toMillis(ts: unknown): number | undefined {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function docToLeaderboardEntry(id: string, data: Record<string, unknown>): LeaderboardEntry {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    displayAlias: sanitizeDisplayAlias(typeof data.displayAlias === 'string' ? data.displayAlias : undefined),
    leadCharacterId: sanitizeCharacterId(typeof data.leadCharacterId === 'string' ? data.leadCharacterId : undefined),
    efficiencyPct: clampInt(Number(data.efficiencyPct ?? 0), 0, 100),
    boardRecoveryPct: clampInt(Number(data.boardRecoveryPct ?? 0), 0, 100),
    teamSynergyPct: clampInt(Number(data.teamSynergyPct ?? 0), 0, 100),
    tierLabel: typeof data.tierLabel === 'string' ? data.tierLabel.slice(0, 48) : 'Transición Parcial',
    result:
      data.result === 'VICTORY' || data.result === 'DRAW' || data.result === 'DEFEAT'
        ? data.result
        : 'DRAW',
    round: clampInt(Number(data.round ?? 1), 1, 20),
    commonCount: clampInt(Number(data.commonCount ?? 0), 0, 40),
    totalResourceTiles: clampInt(Number(data.totalResourceTiles ?? 22), 1, 40),
    totalCooperativeActions: clampInt(Number(data.totalCooperativeActions ?? 0), 0, 9999),
    playersCount: clampInt(Number(data.playersCount ?? 4), 2, 8),
    teamSummary: typeof data.teamSummary === 'string' ? data.teamSummary.slice(0, 120) : 'Equipo Cooperativo',
    isPublic: true,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt)
  };
}

function buildLeaderboardQuery(maxRows = 25) {
  return query(
    collection(db, LEADERBOARD_COLLECTION),
    where('efficiencyPct', '>=', 0),
    orderBy('efficiencyPct', 'desc'),
    limit(Math.min(50, Math.max(1, maxRows)))
  );
}

export async function fetchGlobalLeaderboardOnce(maxRows = 25): Promise<LeaderboardEntry[]> {
  try {
    const snap = await getDocs(buildLeaderboardQuery(maxRows));
    const entries = snap.docs.map(d => docToLeaderboardEntry(d.id, d.data() as Record<string, unknown>));
    return sortLeaderboardEntries(entries);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
  }
}

export function subscribeGlobalLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError?: (err: Error) => void,
  maxRows = 25
): Unsubscribe {
  const q = buildLeaderboardQuery(maxRows);
  return onSnapshot(
    q,
    snapshot => {
      const entries = snapshot.docs.map(d =>
        docToLeaderboardEntry(d.id, d.data() as Record<string, unknown>)
      );
      onData(sortLeaderboardEntries(entries));
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function submitPersonalBestToLeaderboard(
  user: User,
  snapshot: LeaderboardMatchSnapshot
): Promise<{
  status: 'CREATED' | 'UPDATED_RECORD' | 'NOT_HIGHER' | 'UNVERIFIED';
  entry?: LeaderboardEntry;
  prevEfficiencyPct?: number;
}> {
  if (!user.emailVerified) {
    return { status: 'UNVERIFIED' };
  }

  const docPath = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const sanitizedAlias = sanitizeDisplayAlias(
    loadSavedLeaderboardAlias() || user.displayName || snapshot.displayAlias
  );

  const normalized: LeaderboardMatchSnapshot = {
    ...snapshot,
    displayAlias: sanitizedAlias,
    leadCharacterId: sanitizeCharacterId(snapshot.leadCharacterId),
    efficiencyPct: clampInt(snapshot.efficiencyPct, 0, 100),
    boardRecoveryPct: clampInt(snapshot.boardRecoveryPct, 0, 100),
    teamSynergyPct: clampInt(snapshot.teamSynergyPct, 0, 100),
    tierLabel: (snapshot.tierLabel.trim() || 'Transición Parcial').slice(0, 48),
    round: clampInt(snapshot.round, 1, 20),
    commonCount: clampInt(snapshot.commonCount, 0, 40),
    totalResourceTiles: clampInt(snapshot.totalResourceTiles, 1, 40),
    totalCooperativeActions: clampInt(snapshot.totalCooperativeActions, 0, 9999),
    playersCount: clampInt(snapshot.playersCount, 2, 8),
    teamSummary: (snapshot.teamSummary.trim() || 'Equipo Cooperativo').slice(0, 120)
  };

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        uid: user.uid,
        ...normalized,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }

    const createdEntry: LeaderboardEntry = {
      uid: user.uid,
      ...normalized,
      isPublic: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };
    markLocalBestSynced(normalized);
    return { status: 'CREATED', entry: createdEntry };
  }

  const existingEntry = docToLeaderboardEntry(
    existingSnap.id,
    existingSnap.data() as Record<string, unknown>
  );

  if (!isRecordBetter(normalized, existingEntry)) {
    saveLocalBestRecordIfBetter(existingEntry, false);
    return {
      status: 'NOT_HIGHER',
      entry: existingEntry,
      prevEfficiencyPct: existingEntry.efficiencyPct
    };
  }

  try {
    await updateDoc(docRef, {
      ...normalized,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }

  const updatedEntry: LeaderboardEntry = {
    uid: user.uid,
    ...normalized,
    isPublic: true,
    createdAtMs: existingEntry.createdAtMs,
    updatedAtMs: Date.now()
  };
  markLocalBestSynced(normalized);
  return {
    status: 'UPDATED_RECORD',
    entry: updatedEntry,
    prevEfficiencyPct: existingEntry.efficiencyPct
  };
}

export function formatLeaderboardResultLabel(result: GameEngineState['gameResult'] | MatchResultType): string {
  switch (result) {
    case 'VICTORY':
      return 'Victoria Común';
    case 'DRAW':
      return 'Empate Social';
    case 'DEFEAT':
    default:
      return 'Avance Privado';
  }
}
