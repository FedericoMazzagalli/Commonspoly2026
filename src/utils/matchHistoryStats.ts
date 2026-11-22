/**
 * matchHistoryStats.ts
 * Persistencia local de estadísticas acumuladas de partidas jugadas en Commonspoly
 * (victorias, empates, derrotas, rachas, eficiencia cooperativa, bienes recuperados
 * y personajes más utilizados) en localStorage.
 */

import {
  Character,
  DifficultyLevel,
  PlayerContributionStats,
  SetupInitialRolls
} from '../types/game';
import { CooperativeEfficiencyBreakdown } from './cooperativeEfficiency';

export const CAREER_STATS_STORAGE_KEY = 'commonspoly_career_stats_v1';
const MAX_RECENT_MATCHES = 20;

export interface CareerMatchRecord {
  id: string;
  playedAt: string;
  result: 'VICTORY' | 'DRAW' | 'DEFEAT';
  round: number;
  efficiencyPct: number;
  tierLabel: string;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  totalResourceTiles: number;
  totalCooperativeActions: number;
  difficulty: DifficultyLevel;
  playerCount: number;
  playerNames: string[];
  playerIds: string[];
}

export interface CareerCharacterUsage {
  id: string;
  name: string;
  color: string;
  matchesPlayed: number;
  wins: number;
  commonsUnlocked: number;
  cooperativeActions: number;
}

export interface CareerMatchStats {
  version: 1;
  totalMatches: number;
  victories: number;
  draws: number;
  defeats: number;
  winStreak: number;
  bestWinStreak: number;
  sumEfficiencyPct: number;
  bestEfficiencyPct: number;
  totalRoundsPlayed: number;
  totalCommonsUnlocked: number;
  totalPublicsUnlocked: number;
  totalCooperativeActions: number;
  characterUsage: Record<string, CareerCharacterUsage>;
  difficultyCounts: Record<DifficultyLevel, number>;
  recentMatches: CareerMatchRecord[];
  lastUpdatedAt: string | null;
}

export interface CareerSummary {
  winRatePct: number;
  avgEfficiencyPct: number;
  avgRounds: number;
  topCharacters: CareerCharacterUsage[];
}

export function createEmptyCareerStats(): CareerMatchStats {
  return {
    version: 1,
    totalMatches: 0,
    victories: 0,
    draws: 0,
    defeats: 0,
    winStreak: 0,
    bestWinStreak: 0,
    sumEfficiencyPct: 0,
    bestEfficiencyPct: 0,
    totalRoundsPlayed: 0,
    totalCommonsUnlocked: 0,
    totalPublicsUnlocked: 0,
    totalCooperativeActions: 0,
    characterUsage: {},
    difficultyCounts: {
      MAD_MAX: 0,
      EN_TRANSICION: 0,
      COMUNLANDIA: 0
    },
    recentMatches: [],
    lastUpdatedAt: null
  };
}

export function loadCareerStats(): CareerMatchStats {
  if (typeof window === 'undefined') return createEmptyCareerStats();
  try {
    const raw = window.localStorage.getItem(CAREER_STATS_STORAGE_KEY);
    if (!raw) return createEmptyCareerStats();
    const parsed = JSON.parse(raw) as Partial<CareerMatchStats>;
    if (!parsed || typeof parsed !== 'object') return createEmptyCareerStats();

    const empty = createEmptyCareerStats();
    return {
      ...empty,
      ...parsed,
      difficultyCounts: {
        ...empty.difficultyCounts,
        ...(parsed.difficultyCounts ?? {})
      },
      characterUsage: parsed.characterUsage ?? {},
      recentMatches: Array.isArray(parsed.recentMatches)
        ? parsed.recentMatches.slice(0, MAX_RECENT_MATCHES)
        : []
    };
  } catch {
    return createEmptyCareerStats();
  }
}

export function saveCareerStats(stats: CareerMatchStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignorar errores de cuota de almacenamiento en modo privado
  }
}

export function resetCareerStats(): CareerMatchStats {
  const empty = createEmptyCareerStats();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CAREER_STATS_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  }
  return empty;
}

export interface RecordMatchPayload {
  result: 'VICTORY' | 'DRAW' | 'DEFEAT';
  round: number;
  efficiency: CooperativeEfficiencyBreakdown;
  players: Character[];
  playerStats?: Record<string, PlayerContributionStats>;
  setupConfig?: SetupInitialRolls;
}

export function recordCompletedMatchStats(payload: RecordMatchPayload): CareerMatchStats {
  const prev = loadCareerStats();
  const isVictory = payload.result === 'VICTORY';
  const nextWinStreak = isVictory ? prev.winStreak + 1 : 0;
  const difficulty: DifficultyLevel = payload.setupConfig?.difficulty ?? 'EN_TRANSICION';

  const statsValues = Object.values(payload.playerStats ?? {});
  const matchCommonsUnlocked =
    statsValues.length > 0
      ? statsValues.reduce((sum, s) => sum + s.commonsUnlocked, 0)
      : payload.efficiency.commonCount;
  const matchPublicsUnlocked =
    statsValues.length > 0
      ? statsValues.reduce((sum, s) => sum + s.publicsUnlocked, 0)
      : payload.efficiency.publicCount;

  const nextCharacterUsage: Record<string, CareerCharacterUsage> = {
    ...prev.characterUsage
  };

  payload.players.forEach(p => {
    const existing = nextCharacterUsage[p.id];
    const pStats = payload.playerStats?.[p.id];
    nextCharacterUsage[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      matchesPlayed: (existing?.matchesPlayed ?? 0) + 1,
      wins: (existing?.wins ?? 0) + (isVictory ? 1 : 0),
      commonsUnlocked: (existing?.commonsUnlocked ?? 0) + (pStats?.commonsUnlocked ?? 0),
      cooperativeActions:
        (existing?.cooperativeActions ?? 0) + (pStats?.cooperativeActions ?? 0)
    };
  });

  const nowIso = new Date().toISOString();
  const matchRecord: CareerMatchRecord = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    playedAt: nowIso,
    result: payload.result,
    round: payload.round,
    efficiencyPct: payload.efficiency.efficiencyPct,
    tierLabel: payload.efficiency.tierLabel,
    commonCount: payload.efficiency.commonCount,
    publicCount: payload.efficiency.publicCount,
    privateCount: payload.efficiency.privateCount,
    totalResourceTiles: payload.efficiency.totalResourceTiles,
    totalCooperativeActions: payload.efficiency.totalCooperativeActions,
    difficulty,
    playerCount: payload.players.length,
    playerNames: payload.players.map(p => p.name.split(' ')[0]),
    playerIds: payload.players.map(p => p.id)
  };

  const nextStats: CareerMatchStats = {
    version: 1,
    totalMatches: prev.totalMatches + 1,
    victories: prev.victories + (payload.result === 'VICTORY' ? 1 : 0),
    draws: prev.draws + (payload.result === 'DRAW' ? 1 : 0),
    defeats: prev.defeats + (payload.result === 'DEFEAT' ? 1 : 0),
    winStreak: nextWinStreak,
    bestWinStreak: Math.max(prev.bestWinStreak, nextWinStreak),
    sumEfficiencyPct: prev.sumEfficiencyPct + payload.efficiency.efficiencyPct,
    bestEfficiencyPct: Math.max(prev.bestEfficiencyPct, payload.efficiency.efficiencyPct),
    totalRoundsPlayed: prev.totalRoundsPlayed + payload.round,
    totalCommonsUnlocked: prev.totalCommonsUnlocked + matchCommonsUnlocked,
    totalPublicsUnlocked: prev.totalPublicsUnlocked + matchPublicsUnlocked,
    totalCooperativeActions:
      prev.totalCooperativeActions + payload.efficiency.totalCooperativeActions,
    characterUsage: nextCharacterUsage,
    difficultyCounts: {
      ...prev.difficultyCounts,
      [difficulty]: (prev.difficultyCounts[difficulty] ?? 0) + 1
    },
    recentMatches: [matchRecord, ...prev.recentMatches].slice(0, MAX_RECENT_MATCHES),
    lastUpdatedAt: nowIso
  };

  saveCareerStats(nextStats);
  return nextStats;
}

export function getCareerSummary(stats: CareerMatchStats): CareerSummary {
  const total = stats.totalMatches;
  const winRatePct = total > 0 ? Math.round((stats.victories / total) * 100) : 0;
  const avgEfficiencyPct = total > 0 ? Math.round(stats.sumEfficiencyPct / total) : 0;
  const avgRounds = total > 0 ? Number((stats.totalRoundsPlayed / total).toFixed(1)) : 0;
  const topCharacters = Object.values(stats.characterUsage).sort(
    (a, b) => b.matchesPlayed - a.matchesPlayed || b.wins - a.wins
  );

  return {
    winRatePct,
    avgEfficiencyPct,
    avgRounds,
    topCharacters
  };
}
