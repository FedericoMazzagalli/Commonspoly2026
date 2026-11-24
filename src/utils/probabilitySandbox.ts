/**
 * probabilitySandbox.ts
 * Lógica compartida y determinista para el modo Probability Sandbox:
 * - Distribuciones configurables de dados (Justo 1d6, Sesgo Bajo 1-3, Sesgo Alto 4-6, Fijo).
 * - Modos de movimiento de especuladores en tiempo real (Estándar, Persecución, Agresivo, Congelados).
 * Consumido simultáneamente por gameEngine, economyDebugMetrics (heatmap/trayectorias) y economySimulator.
 */

import {
  Character,
  DifficultyLevel,
  ProbabilitySandboxConfig,
  SandboxDiceProfile,
  SandboxSpeculatorMovementLogic
} from '../types/game';

export function getSpeculatorTilePressureChance(
  difficulty: DifficultyLevel,
  sandbox?: ProbabilitySandboxConfig | null,
  speculatorId?: number
): number {
  if (sandbox?.enabled) {
    if (sandbox.speculatorMovementLogic === 'FROZEN') return 0;
    const behavior = speculatorId !== undefined ? sandbox.speculatorBehaviors?.[speculatorId] : undefined;
    if (behavior) {
      return Math.max(0.05, Math.min(0.85, (behavior.aggressivenessPct / 100) * 0.75));
    }
    if (sandbox.speculatorMovementLogic === 'AGGRESSIVE_MAX') return 0.45;
  }
  if (difficulty === 'MAD_MAX') return 0.32;
  if (difficulty === 'COMUNLANDIA') return 0.14;
  return 0.22;
}

export const DEFAULT_PROBABILITY_SANDBOX_CONFIG: ProbabilitySandboxConfig = {
  enabled: false,
  playerDiceProfile: 'FAIR',
  forcedPlayerDice: 4,
  speculatorMovementLogic: 'STANDARD_1D6',
  forcedSpeculatorDice: null,
  detentionChanceOverridePct: null
};

export function clampDiceFace(face: number): number {
  return Math.max(1, Math.min(6, Math.round(face)));
}

/**
 * Devuelve un vector de 6 probabilidades [p(1)..p(6)] que suma 1.0.
 */
export function getPlayerDiceDistribution(
  sandbox?: ProbabilitySandboxConfig | null
): number[] {
  if (!sandbox?.enabled) {
    return [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
  }

  switch (sandbox.playerDiceProfile) {
    case 'LOW_BIASED':
      // 70% de probabilidad en caras bajas (1-3)
      return [0.25, 0.25, 0.20, 0.14, 0.10, 0.06];
    case 'HIGH_BIASED':
      // 70% de probabilidad en caras altas (4-6)
      return [0.06, 0.10, 0.14, 0.20, 0.25, 0.25];
    case 'FORCED': {
      const target = clampDiceFace(sandbox.forcedPlayerDice);
      return [1, 2, 3, 4, 5, 6].map(face => (face === target ? 1 : 0));
    }
    case 'FAIR':
    default:
      return [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6];
  }
}

export function sampleFromSixWeights(weights: number[], rngVal: number): number {
  const u = Math.max(0, Math.min(0.9999999, rngVal));
  let cumulative = 0;
  for (let i = 0; i < 6; i++) {
    cumulative += weights[i] ?? 0;
    if (u <= cumulative) {
      return i + 1;
    }
  }
  return 6;
}

export function samplePlayerDiceFromSandbox(
  rngFn: () => number,
  sandbox?: ProbabilitySandboxConfig | null
): number {
  if (sandbox?.enabled && sandbox.playerDiceProfile === 'FORCED') {
    return clampDiceFace(sandbox.forcedPlayerDice);
  }
  const weights = getPlayerDiceDistribution(sandbox);
  return sampleFromSixWeights(weights, rngFn());
}

export function getDiceProfileLabel(profile: SandboxDiceProfile): string {
  switch (profile) {
    case 'LOW_BIASED':
      return 'Sesgo Bajo (70% 1–3)';
    case 'HIGH_BIASED':
      return 'Sesgo Alto (70% 4–6)';
    case 'FORCED':
      return 'Dado Fijo';
    case 'FAIR':
    default:
      return 'Estándar 1d6';
  }
}

export function getSpeculatorLogicLabel(logic: SandboxSpeculatorMovementLogic): string {
  switch (logic) {
    case 'CHASE_NEAREST':
      return 'Persecución directa a jugadora aislada';
    case 'AGGRESSIVE_MAX':
      return 'Agresivo (impacto directo o avance 5–6)';
    case 'FROZEN':
      return 'Congelados (0 casillas)';
    case 'STANDARD_1D6':
    default:
      return 'Perímetro 1d6 horario (mod 40)';
  }
}

export interface SpeculatorStepDistribution {
  /** Probabilidad (0..1) por cada paso candidate (0 si congelado, o 1..6) */
  stepProbs: Record<number, number>;
  /** Descripción legible de la lógica aplicada */
  logicLabel: string;
  /** Dado forzado efectivo si la distribución es 100% determinista */
  deterministicStep: number | null;
}

/**
 * Calcula la distribución de pasos (0..6) de un especulador según la configuración
 * del Probability Sandbox y las posiciones actuales de las jugadoras.
 */
export function resolveSpeculatorStepDistribution(
  specPos: number,
  players: Character[],
  sandbox?: ProbabilitySandboxConfig | null,
  speculatorId?: number
): SpeculatorStepDistribution {
  const behavior = (speculatorId !== undefined && sandbox?.speculatorBehaviors?.[speculatorId]) || null;
  const influenceRadius = behavior ? behavior.influenceRadius : 12;
  const aggressiveness = behavior ? behavior.aggressivenessPct / 100 : 0.5;
  const decisionThreshold = behavior ? behavior.decisionThreshold : 3;

  if (!sandbox?.enabled) {
    return {
      stepProbs: {
        1: 1 / 6,
        2: 1 / 6,
        3: 1 / 6,
        4: 1 / 6,
        5: 1 / 6,
        6: 1 / 6
      },
      logicLabel: 'Perímetro 1d6 horario (mod 40) · sin desvío al Ágora',
      deterministicStep: null
    };
  }

  if (sandbox.speculatorMovementLogic === 'FROZEN') {
    return {
      stepProbs: { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      logicLabel: 'Sandbox · Especuladores congelados en su casilla',
      deterministicStep: 0
    };
  }

  if (sandbox.forcedSpeculatorDice !== null) {
    const fixed = clampDiceFace(sandbox.forcedSpeculatorDice);
    const probs: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    probs[fixed] = 1;
    return {
      stepProbs: probs,
      logicLabel: `Sandbox · Dado forzado a +${fixed} (${getSpeculatorLogicLabel(sandbox.speculatorMovementLogic)})`,
      deterministicStep: fixed
    };
  }

  // Buscar distancia (1..influenceRadius) hasta la primera jugadora vulnerable (aislada, no en Ágora)
  let nearestVulnerableDist: number | null = null;
  for (let dist = 1; dist <= influenceRadius; dist++) {
    const checkPos = (specPos + dist) % 40;
    const here = players.filter(p => !p.inAgora && p.position === checkPos);
    if (here.length === 1) {
      nearestVulnerableDist = dist;
      break;
    }
  }

  if (sandbox.speculatorMovementLogic === 'CHASE_NEAREST' || aggressiveness > 0.7) {
    const chosenStep =
      nearestVulnerableDist !== null
        ? Math.min(6, nearestVulnerableDist)
        : decisionThreshold;
    const probs: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    probs[chosenStep] = 1;
    return {
      stepProbs: probs,
      logicLabel: `Sandbox · Bot Custom (Agres.: ${Math.round(aggressiveness * 100)}%, Radio: ${influenceRadius}, Umbral: ${decisionThreshold})`,
      deterministicStep: chosenStep
    };
  }

  if (sandbox.speculatorMovementLogic === 'AGGRESSIVE_MAX') {
    if (nearestVulnerableDist !== null && nearestVulnerableDist <= 6) {
      const probs: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      probs[nearestVulnerableDist] = 1;
      return {
        stepProbs: probs,
        logicLabel: `Sandbox · Agresivo (impacto directo en +${nearestVulnerableDist})`,
        deterministicStep: nearestVulnerableDist
      };
    }
    return {
      stepProbs: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0.5, 6: 0.5 },
      logicLabel: 'Sandbox · Agresivo (avance forzado +5/+6)',
      deterministicStep: null
    };
  }

  return {
    stepProbs: {
      1: 1 / 6,
      2: 1 / 6,
      3: 1 / 6,
      4: 1 / 6,
      5: 1 / 6,
      6: 1 / 6
    },
    logicLabel: 'Sandbox · Perímetro 1d6 estándar',
    deterministicStep: null
  };
}

export function sampleSpeculatorStepFromSandbox(
  specPos: number,
  players: Character[],
  rngFn: () => number,
  sandbox?: ProbabilitySandboxConfig | null,
  speculatorId?: number
): number {
  const dist = resolveSpeculatorStepDistribution(specPos, players, sandbox, speculatorId);
  if (dist.deterministicStep !== null) {
    return dist.deterministicStep;
  }
  const u = Math.max(0, Math.min(0.9999999, rngFn()));
  let cumulative = 0;
  for (let step = 1; step <= 6; step++) {
    cumulative += dist.stepProbs[step] ?? 0;
    if (u <= cumulative) {
      return step;
    }
  }
  return 6;
}
