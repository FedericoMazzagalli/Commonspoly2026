/**
 * dailyChallenge.ts
 * Retos Diarios Deterministas por Semilla UTC (YYYY-MM-DD) y Clasificatoria Diaria en Firestore.
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
import { OFFICIAL_CHARACTERS } from '../data/characters';
import { DifficultyLevel, SetupInitialRolls, WeatherMode } from '../types/game';
import {
  isRecordBetter,
  LeaderboardMatchSnapshot,
  loadSavedLeaderboardAlias,
  MatchResultType
} from './leaderboard';
import { createMulberry32, getUtcDateKey, hashStringToSeed, rollSeededDice } from './prng';

export const DAILY_CHALLENGES_COLLECTION = 'dailyChallenges';
export const DAILY_LOCAL_CACHE_KEY = 'commonspoly_daily_local_v1';

export interface DailyChallengeConfig {
  challengeDate: string;
  seedNumber: number;
  title: string;
  themeSubtitle: string;
  weatherMode: WeatherMode;
  rolls: SetupInitialRolls;
  roster: Array<{ baseCharId: string; controller: 'HUMAN' | 'BOT' }>;
}

export interface DailyChallengeEntry {
  uid: string;
  challengeDate: string;
  seedNumber: number;
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
  isPublic: true;
  createdAtMs?: number;
  updatedAtMs?: number;
}

const DAILY_THEMES: Array<{ title: string; subtitle: string; weather: WeatherMode }> = [
  {
    title: 'Asamblea bajo Lluvia Fértil',
    subtitle: 'Clima húmedo favorable al cuidado y regeneración de acuíferos.',
    weather: 'RAIN'
  },
  {
    title: 'Solsticio de Bienes Comunes',
    subtitle: 'Jornada luminosa propicia para la cooperación vecinal y el Ágora.',
    weather: 'SUNNY'
  },
  {
    title: 'Resistencia frente a la Sequía',
    subtitle: 'Tensión climática que exige priorizar alianzas y evitar detenciones.',
    weather: 'DROUGHT'
  },
  {
    title: 'Equilibrio del Barrio Verde',
    subtitle: 'Condiciones templadas para optimizar rutas en equipo.',
    weather: 'TEMPERATE'
  },
  {
    title: 'Marea Ciudadana en Transición',
    subtitle: 'Clima dinámico según el estado ambiental del tablero.',
    weather: 'AUTO'
  }
];

export function getDailyChallengeConfig(dateKey: string = getUtcDateKey()): DailyChallengeConfig {
  const seedNumber = hashStringToSeed(`commonspoly-daily-v1-${dateKey}`);
  const rng = createMulberry32(seedNumber);

  const health = rollSeededDice(rng);
  const urban = rollSeededDice(rng);
  const knowledge = rollSeededDice(rng);
  const environment = rollSeededDice(rng);
  const totalSum = health + urban + knowledge + environment;

  const difficulty: DifficultyLevel =
    totalSum <= 10 ? 'MAD_MAX' : totalSum <= 16 ? 'EN_TRANSICION' : 'COMUNLANDIA';
  const speculatorsCount = difficulty === 'MAD_MAX' || rng() < 0.45 ? 3 : 2;

  const theme = DAILY_THEMES[Math.floor(rng() * DAILY_THEMES.length)] ?? DAILY_THEMES[0];

  // Seleccionar 4 personajes deterministas sin repetir
  const pool = [...OFFICIAL_CHARACTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, 4);
  const roster = picked.map((c, idx) => ({
    baseCharId: c.id,
    controller: idx === 0 ? ('HUMAN' as const) : ('BOT' as const)
  }));

  return {
    challengeDate: dateKey,
    seedNumber,
    title: theme.title,
    themeSubtitle: theme.subtitle,
    weatherMode: theme.weather,
    rolls: {
      health,
      urban,
      knowledge,
      environment,
      totalSum,
      difficulty,
      speculatorsCount
    },
    roster
  };
}

function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function toMillis(ts: unknown): number | undefined {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function docToDailyEntry(id: string, challengeDate: string, data: Record<string, unknown>): DailyChallengeEntry {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    challengeDate: typeof data.challengeDate === 'string' ? data.challengeDate : challengeDate,
    seedNumber: clampInt(Number(data.seedNumber ?? 1), 1, 4294967295),
    displayAlias: (typeof data.displayAlias === 'string' ? data.displayAlias : 'Cooperativa').slice(0, 48),
    leadCharacterId: (typeof data.leadCharacterId === 'string' ? data.leadCharacterId : 'carolina')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32) || 'carolina',
    efficiencyPct: clampInt(Number(data.efficiencyPct ?? 0), 0, 100),
    boardRecoveryPct: clampInt(Number(data.boardRecoveryPct ?? 0), 0, 100),
    teamSynergyPct: clampInt(Number(data.teamSynergyPct ?? 0), 0, 100),
    tierLabel: (typeof data.tierLabel === 'string' ? data.tierLabel : 'Transición Parcial').slice(0, 48),
    result:
      data.result === 'VICTORY' || data.result === 'DRAW' || data.result === 'DEFEAT'
        ? data.result
        : 'DRAW',
    round: clampInt(Number(data.round ?? 1), 1, 20),
    commonCount: clampInt(Number(data.commonCount ?? 0), 0, 40),
    totalResourceTiles: clampInt(Number(data.totalResourceTiles ?? 22), 1, 40),
    totalCooperativeActions: clampInt(Number(data.totalCooperativeActions ?? 0), 0, 9999),
    isPublic: true,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt)
  };
}

export function sortDailyEntries(entries: DailyChallengeEntry[]): DailyChallengeEntry[] {
  return [...entries].sort((a, b) => {
    if (b.efficiencyPct !== a.efficiencyPct) return b.efficiencyPct - a.efficiencyPct;
    if (a.round !== b.round) return a.round - b.round;
    if (b.totalCooperativeActions !== a.totalCooperativeActions) {
      return b.totalCooperativeActions - a.totalCooperativeActions;
    }
    return (a.updatedAtMs ?? 0) - (b.updatedAtMs ?? 0);
  });
}

export function saveLocalDailyResult(
  challengeDate: string,
  efficiencyPct: number,
  result: MatchResultType
): void {
  try {
    const raw = localStorage.getItem(DAILY_LOCAL_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, { efficiencyPct: number; result: MatchResultType }>) : {};
    const prev = parsed[challengeDate];
    if (!prev || efficiencyPct >= prev.efficiencyPct) {
      parsed[challengeDate] = { efficiencyPct, result };
      localStorage.setItem(DAILY_LOCAL_CACHE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Ignorar errores de cuota
  }
}

export function loadLocalDailyResult(
  challengeDate: string
): { efficiencyPct: number; result: MatchResultType } | null {
  try {
    const raw = localStorage.getItem(DAILY_LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, { efficiencyPct: number; result: MatchResultType }>;
    return parsed[challengeDate] ?? null;
  } catch {
    return null;
  }
}

function buildDailyEntriesQuery(challengeDate: string, maxRows = 25) {
  return query(
    collection(db, DAILY_CHALLENGES_COLLECTION, challengeDate, 'entries'),
    where('efficiencyPct', '>=', 0),
    orderBy('efficiencyPct', 'desc'),
    limit(Math.min(50, Math.max(1, maxRows)))
  );
}

export async function fetchDailyLeaderboardOnce(
  challengeDate: string,
  maxRows = 25
): Promise<DailyChallengeEntry[]> {
  const path = `${DAILY_CHALLENGES_COLLECTION}/${challengeDate}/entries`;
  try {
    const snap = await getDocs(buildDailyEntriesQuery(challengeDate, maxRows));
    const list = snap.docs.map(d =>
      docToDailyEntry(d.id, challengeDate, d.data() as Record<string, unknown>)
    );
    return sortDailyEntries(list);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeDailyLeaderboard(
  challengeDate: string,
  onData: (entries: DailyChallengeEntry[]) => void,
  onError?: (err: Error) => void,
  maxRows = 25
): Unsubscribe {
  const path = `${DAILY_CHALLENGES_COLLECTION}/${challengeDate}/entries`;
  return onSnapshot(
    buildDailyEntriesQuery(challengeDate, maxRows),
    snap => {
      const list = snap.docs.map(d =>
        docToDailyEntry(d.id, challengeDate, d.data() as Record<string, unknown>)
      );
      onData(sortDailyEntries(list));
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

export async function submitDailyChallengeScore(
  user: User,
  snapshot: LeaderboardMatchSnapshot,
  challengeDate: string,
  seedNumber: number
): Promise<{
  status: 'CREATED' | 'UPDATED_RECORD' | 'NOT_HIGHER' | 'UNVERIFIED';
  entry?: DailyChallengeEntry;
  prevEfficiencyPct?: number;
}> {
  if (!user.emailVerified) {
    return { status: 'UNVERIFIED' };
  }

  const docPath = `${DAILY_CHALLENGES_COLLECTION}/${challengeDate}/entries/${user.uid}`;
  const docRef = doc(db, DAILY_CHALLENGES_COLLECTION, challengeDate, 'entries', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const alias = (
    loadSavedLeaderboardAlias() ||
    user.displayName ||
    snapshot.displayAlias ||
    'Cooperativa'
  )
    .trim()
    .slice(0, 48) || 'Cooperativa';

  const normalizedPayload = {
    uid: user.uid,
    challengeDate,
    seedNumber: clampInt(seedNumber, 1, 4294967295),
    displayAlias: alias,
    leadCharacterId:
      snapshot.leadCharacterId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'carolina',
    efficiencyPct: clampInt(snapshot.efficiencyPct, 0, 100),
    boardRecoveryPct: clampInt(snapshot.boardRecoveryPct, 0, 100),
    teamSynergyPct: clampInt(snapshot.teamSynergyPct, 0, 100),
    tierLabel: (snapshot.tierLabel.trim() || 'Transición Parcial').slice(0, 48),
    result: snapshot.result,
    round: clampInt(snapshot.round, 1, 20),
    commonCount: clampInt(snapshot.commonCount, 0, 40),
    totalResourceTiles: clampInt(snapshot.totalResourceTiles, 1, 40),
    totalCooperativeActions: clampInt(snapshot.totalCooperativeActions, 0, 9999),
    isPublic: true as const
  };

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        ...normalizedPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
    return {
      status: 'CREATED',
      entry: {
        ...normalizedPayload,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now()
      }
    };
  }

  const prevEntry = docToDailyEntry(
    existingSnap.id,
    challengeDate,
    existingSnap.data() as Record<string, unknown>
  );

  if (!isRecordBetter(normalizedPayload, prevEntry)) {
    return {
      status: 'NOT_HIGHER',
      entry: prevEntry,
      prevEfficiencyPct: prevEntry.efficiencyPct
    };
  }

  try {
    await updateDoc(docRef, {
      displayAlias: normalizedPayload.displayAlias,
      leadCharacterId: normalizedPayload.leadCharacterId,
      efficiencyPct: normalizedPayload.efficiencyPct,
      boardRecoveryPct: normalizedPayload.boardRecoveryPct,
      teamSynergyPct: normalizedPayload.teamSynergyPct,
      tierLabel: normalizedPayload.tierLabel,
      result: normalizedPayload.result,
      round: normalizedPayload.round,
      commonCount: normalizedPayload.commonCount,
      totalResourceTiles: normalizedPayload.totalResourceTiles,
      totalCooperativeActions: normalizedPayload.totalCooperativeActions,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }

  return {
    status: 'UPDATED_RECORD',
    entry: {
      ...normalizedPayload,
      createdAtMs: prevEntry.createdAtMs,
      updatedAtMs: Date.now()
    },
    prevEfficiencyPct: prevEntry.efficiencyPct
  };
}
