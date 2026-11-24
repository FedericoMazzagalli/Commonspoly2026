/**
 * reputation.ts
 * Sistema de Reputación Vecinal de Commonspoly.
 * Rastrea las acciones cooperativas (+) o egoístas (-) de cada jugadora,
 * modulando el precio de las transacciones (desbloqueos, Burocracia, fianzas)
 * y la confianza/peso de su voto en las votaciones barriales.
 */

import {
  Character,
  NeighborhoodDecision,
  ReputationEvent,
  ReputationTierId
} from '../types/game';

export const MIN_NEIGHBORHOOD_REPUTATION = -20;
export const MAX_NEIGHBORHOOD_REPUTATION = 20;
export const DEFAULT_REFERENDUM_REQUIRED_TRUST = 2.0;

export interface ReputationProfile {
  score: number;
  tierId: ReputationTierId;
  label: string;
  shortDesc: string;
  transactionCostDelta: number;
  voteWeight: number;
  trustPercent: number;
  tone: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export function clampReputation(value: number): number {
  return Math.max(
    MIN_NEIGHBORHOOD_REPUTATION,
    Math.min(MAX_NEIGHBORHOOD_REPUTATION, Math.round(value))
  );
}

export function getReputationScore(playerOrScore: Character | number | undefined): number {
  if (typeof playerOrScore === 'number') {
    return clampReputation(playerOrScore);
  }
  return clampReputation(playerOrScore?.neighborhoodReputation ?? 0);
}

export function getReputationProfile(
  playerOrScore: Character | number | undefined
): ReputationProfile {
  const score = getReputationScore(playerOrScore);

  if (score >= 10) {
    return {
      score,
      tierId: 'EXEMPLARY',
      label: 'Referente Vecinal',
      shortDesc: 'Máxima confianza barrial: -2 coste en transacciones y voto doble (2.0x).',
      transactionCostDelta: -2,
      voteWeight: 2.0,
      trustPercent: 95,
      tone: 'POSITIVE'
    };
  }

  if (score >= 4) {
    return {
      score,
      tierId: 'TRUSTED',
      label: 'Vecina Fiable',
      shortDesc: 'Alta confianza vecinal: -1 coste en transacciones y peso de voto 1.5x.',
      transactionCostDelta: -1,
      voteWeight: 1.5,
      trustPercent: 82,
      tone: 'POSITIVE'
    };
  }

  if (score >= -3) {
    return {
      score,
      tierId: 'NEUTRAL',
      label: 'Neutral',
      shortDesc: 'Confianza estándar en el barrio: precios base y voto 1.0x.',
      transactionCostDelta: 0,
      voteWeight: 1.0,
      trustPercent: 65,
      tone: 'NEUTRAL'
    };
  }

  if (score >= -9) {
    return {
      score,
      tierId: 'SUSPECT',
      label: 'Recelo Vecinal',
      shortDesc: 'Baja confianza barrial: +1 recargo en transacciones y voto reducido (0.75x).',
      transactionCostDelta: 1,
      voteWeight: 0.75,
      trustPercent: 42,
      tone: 'NEGATIVE'
    };
  }

  return {
    score,
    tierId: 'DISTRUSTED',
    label: 'Egoísta',
    shortDesc: 'Desconfianza vecinal severa: +2 recargo en transacciones y voto mínimo (0.5x).',
    transactionCostDelta: 2,
    voteWeight: 0.5,
    trustPercent: 20,
    tone: 'NEGATIVE'
  };
}

export function formatSignedScore(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function applyReputationDelta(
  player: Character,
  delta: number,
  reason: string,
  round: number
): {
  player: Character;
  prevScore: number;
  nextScore: number;
  prevTier: ReputationTierId;
  nextTier: ReputationTierId;
  tierChanged: boolean;
} {
  const prevScore = getReputationScore(player);
  const prevTier = getReputationProfile(prevScore).tierId;

  if (delta === 0) {
    return {
      player,
      prevScore,
      nextScore: prevScore,
      prevTier,
      nextTier: prevTier,
      tierChanged: false
    };
  }

  const nextScore = clampReputation(prevScore + delta);
  const nextTier = getReputationProfile(nextScore).tierId;
  const event: ReputationEvent = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    round,
    delta,
    reason,
    kind: delta > 0 ? 'POSITIVE' : 'SELFISH'
  };

  const prevHistory = Array.isArray(player.reputationHistory) ? player.reputationHistory : [];
  const nextPlayer: Character = {
    ...player,
    neighborhoodReputation: nextScore,
    reputationHistory: [event, ...prevHistory].slice(0, 12)
  };

  return {
    player: nextPlayer,
    prevScore,
    nextScore,
    prevTier,
    nextTier,
    tierChanged: prevTier !== nextTier
  };
}

export function getEffectiveBureaucracyCost(
  player: Character | undefined,
  rulesetMode?: 'OFFICIAL' | 'EXPANDED'
): {
  baseCost: number;
  reputationDelta: number;
  effectiveCost: number;
} {
  const baseCost = 6;
  if (rulesetMode === 'OFFICIAL') {
    return {
      baseCost,
      reputationDelta: 0,
      effectiveCost: baseCost
    };
  }
  const reputationDelta = getReputationProfile(player).transactionCostDelta;
  const effectiveCost = Math.max(4, Math.min(8, baseCost + reputationDelta));
  return {
    baseCost,
    reputationDelta: effectiveCost - baseCost,
    effectiveCost
  };
}

export function getEffectiveBailCostPerRound(
  victim: Character,
  rescuer?: Character,
  rulesetMode?: 'OFFICIAL' | 'EXPANDED'
): {
  basePerRound: number;
  reputationDelta: number;
  effectivePerRound: number;
} {
  const basePerRound =
    rulesetMode === 'OFFICIAL'
      ? 2
      : victim.hasCitizenship && victim.socialClass !== 'BAJA'
      ? 1
      : 2;
  if (!rescuer || rulesetMode === 'OFFICIAL') {
    return {
      basePerRound,
      reputationDelta: 0,
      effectivePerRound: basePerRound
    };
  }
  const profile = getReputationProfile(rescuer);
  // Referentes y fiables reducen la fianza solidaria en -1 (mín. 1); egoístas pagan +1 extra
  const delta = profile.transactionCostDelta < 0 ? -1 : profile.transactionCostDelta > 0 ? 1 : 0;
  const effectivePerRound = Math.max(1, basePerRound + delta);
  return {
    basePerRound,
    reputationDelta: effectivePerRound - basePerRound,
    effectivePerRound
  };
}

export function computeReferendumTrustSummary(
  decision: NeighborhoodDecision | null,
  players: Character[]
): {
  trustAccumulated: number;
  requiredTrust: number;
  progressPercent: number;
  collectiveTrustPercent: number;
  voters: { player: Character; profile: ReputationProfile }[];
} {
  const requiredTrust = decision?.requiredTrust ?? DEFAULT_REFERENDUM_REQUIRED_TRUST;
  const votesCast = decision?.votesCast ?? [];
  const voters = votesCast
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Character => Boolean(p))
    .map(player => ({ player, profile: getReputationProfile(player) }));

  const computedFromVoters = voters.reduce((sum, v) => sum + v.profile.voteWeight, 0);
  const trustAccumulated = Number(
    (decision?.trustAccumulated ?? computedFromVoters).toFixed(2)
  );
  const progressPercent = Math.min(100, Math.round((trustAccumulated / requiredTrust) * 100));

  const avgTrust =
    players.length > 0
      ? Math.round(
          players.reduce((sum, p) => sum + getReputationProfile(p).trustPercent, 0) /
            players.length
        )
      : 65;

  return {
    trustAccumulated,
    requiredTrust,
    progressPercent,
    collectiveTrustPercent: avgTrust,
    voters
  };
}
