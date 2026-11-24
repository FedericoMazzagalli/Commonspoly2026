/**
 * economySimulator.ts
 * Simulador de probabilidad Monte Carlo ligero para el Panel Debug de Economía.
 * Ejecuta N simulaciones aisladas desde el estado actual de la partida sin mutar React.
 */

import {
  DifficultyLevel,
  GameEngineState,
  GoodState,
  Tile
} from '../types/game';
import { getEffectiveResourceReward, getEffectiveUnlockCost } from './crisisEngine';
import { createMulberry32, rollSeededDice } from './prng';
import { clampDiceFace, samplePlayerDiceFromSandbox } from './probabilitySandbox';

export interface MonteCarloConfig {
  iterations: number;
  horizonRounds: number;
  seed?: number;
}

export interface MonteCarloSimulationResult {
  iterations: number;
  horizonRounds: number;
  fromRound: number;
  victoryPct: number;
  drawPct: number;
  defeatPct: number;
  avgFinalRound: number;
  avgFinalEfficiencyPct: number;
  avgFinalCommonCount: number;
  avgFinalPublicCount: number;
  avgFinalPrivateCount: number;
  avgTotalLegitimacy: number;
  avgDetentionsPerMatch: number;
  avgSpeculatorAttacksPerMatch: number;
  expectedRoundWellnessDelta: number;
  durationMs: number;
}

function getDetentionChanceForDifficulty(difficulty: DifficultyLevel): number {
  if (difficulty === 'MAD_MAX') return 0.25;
  if (difficulty === 'COMUNLANDIA') return 0.38;
  return 0.32;
}

export function runEconomyMonteCarlo(
  state: GameEngineState,
  config: MonteCarloConfig
): MonteCarloSimulationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const iterations = Math.max(20, Math.min(1000, Math.round(config.iterations)));
  const startRound = Math.max(1, Math.min(20, state.round));
  const targetMaxRound = Math.min(20, startRound + Math.max(1, config.horizonRounds) - 1);
  const seed = config.seed ?? ((Date.now() ^ (state.round * 7919) ^ state.tiles.length * 101) >>> 0);
  const rng = createMulberry32(seed);

  const resourceTileIndices: number[] = [];
  const baseTiles = state.tiles;
  for (let i = 0; i < baseTiles.length; i++) {
    const t = baseTiles[i];
    if (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') {
      resourceTileIndices.push(i);
    }
  }
  const totalResourceTiles = Math.max(1, resourceTileIndices.length);
  const tileById = new Map<number, { idx: number; tile: Tile }>();
  baseTiles.forEach((t, idx) => tileById.set(t.id, { idx, tile: t }));

  const sandbox = state.probabilitySandbox?.enabled ? state.probabilitySandbox : null;
  const difficulty: DifficultyLevel = state.setupConfig?.difficulty ?? 'EN_TRANSICION';
  const detentionChance =
    sandbox && sandbox.detentionChanceOverridePct !== null
      ? Math.max(0, Math.min(1, sandbox.detentionChanceOverridePct / 100))
      : getDetentionChanceForDifficulty(difficulty);
  const playerCount = Math.max(2, state.players.length);
  const requiredLegitimacy = playerCount * 10;

  let victoryCount = 0;
  let drawCount = 0;
  let defeatCount = 0;
  let sumFinalRound = 0;
  let sumFinalEfficiency = 0;
  let sumFinalCommon = 0;
  let sumFinalPublic = 0;
  let sumFinalPrivate = 0;
  let sumTotalLegitimacy = 0;
  let sumDetentions = 0;
  let sumAttacks = 0;
  let sumNetWellnessPerRound = 0;

  for (let sim = 0; sim < iterations; sim++) {
    const tileStates: (GoodState | undefined)[] = baseTiles.map(t => t.state);
    const pWellness = state.players.map(p => p.wellness);
    const pLegitimacy = state.players.map(p => p.legitimacy);
    const pPos = state.players.map(p => p.position);
    const pDetained = state.players.map(p => (p.isDetained ? Math.max(1, p.detentionRoundsLeft) : 0));
    const pInAgora = state.players.map(p => p.inAgora);
    const specPos = state.speculators.map(s => s.position);

    const startTotalWellness = pWellness.reduce((a, b) => a + b, 0);
    let activeCrisis = state.activeCrisis ? { ...state.activeCrisis } : null;
    let activeWeather = state.activeWeatherEvent ? { ...state.activeWeatherEvent } : null;
    let simDetentions = 0;
    let simAttacks = 0;
    let endedRound = targetMaxRound;
    let outcome: 'VICTORY' | 'DRAW' | 'DEFEAT' | null = null;

    for (let r = startRound; r <= targetMaxRound; r++) {
      // Turnos de jugadores
      for (let pi = 0; pi < playerCount; pi++) {
        if (r === startRound && pi < state.activePlayerIndex) continue;

        if (pDetained[pi] > 0) {
          pDetained[pi] -= 1;
          continue;
        }

        const player = state.players[pi];
        const roll = sandbox ? samplePlayerDiceFromSandbox(rng, sandbox) : rollSeededDice(rng);

        // Decisión Ágora simplificada si hay suficiente legitimidad
        const totalLeg = pLegitimacy.reduce((a, b) => a + b, 0);
        if (!pInAgora[pi] && totalLeg >= requiredLegitimacy && r >= 4 && rng() < 0.35) {
          pInAgora[pi] = true;
        }

        if (pInAgora[pi]) {
          // Insurrección convierte hasta 2 casillas no comunes si alcanza el umbral
          if (totalLeg >= requiredLegitimacy) {
            let converted = 0;
            for (let k = 0; k < resourceTileIndices.length && converted < 2; k++) {
              const tidx = resourceTileIndices[k];
              if (tileStates[tidx] !== 'COMMON') {
                tileStates[tidx] = 'COMMON';
                pLegitimacy[pi] += 1;
                converted++;
              }
            }
          }
          pWellness[pi] = Math.max(1, pWellness[pi] - 1);
          if (rng() < 0.45) {
            pInAgora[pi] = false;
            pPos[pi] = [5, 15, 25, 35][roll % 4];
          }
        } else {
          const rawSum = pPos[pi] + roll;
          if (rawSum >= 40) {
            pWellness[pi] += player.id === 'moha' ? 2 : 1;
          }
          pPos[pi] = rawSum % 40;

          const landed = tileById.get(pPos[pi]);
          if (landed) {
            const tile = landed.tile;
            const tState = tileStates[landed.idx];
            if (tile.category === 'INALIENABLE_COMMON') {
              pWellness[pi] += 2;
              pLegitimacy[pi] += 2;
            } else if (
              (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') &&
              tState
            ) {
              if (tState === 'COMMON') {
                const reward = getEffectiveResourceReward(
                  tile,
                  2,
                  2,
                  activeCrisis,
                  player,
                  activeWeather,
                  state.rulesetMode
                );
                pWellness[pi] += reward.wellness;
                pLegitimacy[pi] += reward.legitimacy;
              } else {
                if (tState === 'PUBLIC') {
                  const reward = getEffectiveResourceReward(
                    tile,
                    1,
                    1,
                    activeCrisis,
                    player,
                    activeWeather,
                    state.rulesetMode
                  );
                  pWellness[pi] += reward.wellness;
                }
                const { effectiveCost } = getEffectiveUnlockCost(
                  tile,
                  player,
                  activeCrisis,
                  activeWeather,
                  state.rulesetMode
                );
                if (pWellness[pi] >= effectiveCost + 2) {
                  pWellness[pi] -= effectiveCost;
                  tileStates[landed.idx] = tState === 'PRIVATE' ? 'PUBLIC' : 'COMMON';
                  pLegitimacy[pi] += tState === 'PUBLIC' ? 2 : 1;
                }
              }
            } else if (tile.specialType === 'ASSEMBLY') {
              if (pWellness[pi] > 2) {
                pWellness[pi] -= 2;
                pLegitimacy[pi] += 2;
              }
            } else if (tile.specialType === 'BANK') {
              pWellness[pi] = Math.max(1, pWellness[pi] - 4);
            } else if (tile.specialType === 'CASINO') {
              pLegitimacy[pi] = Math.max(0, pLegitimacy[pi] - 4);
            } else if (tile.specialType === 'DETENTION_CENTER') {
              pDetained[pi] = 1;
              simDetentions++;
            } else if (tile.specialType === 'TRAGEDY_OF_COMMONS') {
              let privCount = 0;
              for (let k = 0; k < resourceTileIndices.length && privCount < 2; k++) {
                const tidx = resourceTileIndices[k];
                if (tileStates[tidx] === 'COMMON') {
                  tileStates[tidx] = 'PRIVATE';
                  privCount++;
                }
              }
            }
          }
        }

        // Check immediate victory
        const allCommon = resourceTileIndices.every(idx => tileStates[idx] === 'COMMON');
        if (allCommon) {
          outcome = 'VICTORY';
          endedRound = r;
          break;
        }
      }

      if (outcome) break;

      // Turno de especuladores al cierre de ronda
      let attackedThisRound = false;
      for (let si = 0; si < specPos.length; si++) {
        let sRoll = rollSeededDice(rng);
        if (sandbox) {
          if (sandbox.speculatorMovementLogic === 'FROZEN') {
            sRoll = 0;
          } else if (sandbox.forcedSpeculatorDice !== null) {
            sRoll = clampDiceFace(sandbox.forcedSpeculatorDice);
          } else if (
            sandbox.speculatorMovementLogic === 'CHASE_NEAREST' ||
            sandbox.speculatorMovementLogic === 'AGGRESSIVE_MAX'
          ) {
            let nearestDist: number | null = null;
            for (let d = 1; d < 40; d++) {
              const checkPos = (specPos[si] + d) % 40;
              let occ = 0;
              for (let pi = 0; pi < playerCount; pi++) {
                if (!pInAgora[pi] && pPos[pi] === checkPos) occ++;
              }
              if (occ === 1) {
                nearestDist = d;
                break;
              }
            }
            if (sandbox.speculatorMovementLogic === 'CHASE_NEAREST') {
              sRoll = nearestDist !== null ? Math.min(6, nearestDist) : 3;
            } else {
              sRoll = nearestDist !== null && nearestDist <= 6 ? nearestDist : rng() < 0.5 ? 5 : 6;
            }
          }
        }
        specPos[si] = (specPos[si] + sRoll) % 40;
        if (attackedThisRound) continue;
        const victims: number[] = [];
        for (let pi = 0; pi < playerCount; pi++) {
          if (pPos[pi] === specPos[si] && !pInAgora[pi]) victims.push(pi);
        }
        if (victims.length === 1) {
          attackedThisRound = true;
          simAttacks++;
          const v = victims[0];
          const actionDice = rollSeededDice(rng);
          if (rng() < detentionChance) {
            pDetained[v] = Math.min(3, Math.ceil(actionDice / 2));
            pPos[v] = 18;
            simDetentions++;
          } else {
            const steal = Math.min(4, Math.max(1, Math.ceil(actionDice * 0.7)));
            if (rng() > 0.5) {
              pWellness[v] = Math.max(1, pWellness[v] - steal);
            } else {
              pLegitimacy[v] = Math.max(0, pLegitimacy[v] - steal);
            }
          }
        }
      }

      // Avance de duración de crisis / clima activo
      if (activeCrisis) {
        activeCrisis.turnsRemaining -= 1;
        if (activeCrisis.turnsRemaining <= 0) activeCrisis = null;
      }
      if (activeWeather) {
        activeWeather.turnsRemaining -= 1;
        if (activeWeather.turnsRemaining <= 0) activeWeather = null;
      }
    }

    let commonCount = 0;
    let publicCount = 0;
    let privateCount = 0;
    resourceTileIndices.forEach(idx => {
      if (tileStates[idx] === 'COMMON') commonCount++;
      else if (tileStates[idx] === 'PUBLIC') publicCount++;
      else privateCount++;
    });

    if (!outcome) {
      if (privateCount === 0 && publicCount === 0) outcome = 'VICTORY';
      else if (commonCount > privateCount && commonCount >= Math.ceil(totalResourceTiles * 0.48)) {
        outcome = 'DRAW';
      } else {
        outcome = 'DEFEAT';
      }
    }

    if (outcome === 'VICTORY') victoryCount++;
    else if (outcome === 'DRAW') drawCount++;
    else defeatCount++;

    const boardRecoveryPct = ((commonCount + publicCount * 0.5) / totalResourceTiles) * 100;
    const totalLeg = pLegitimacy.reduce((a, b) => a + b, 0);
    const synergyPct = Math.min(100, (totalLeg / Math.max(1, requiredLegitimacy)) * 75 + (outcome === 'VICTORY' ? 25 : 10));
    const eff = Math.min(100, Math.round(boardRecoveryPct * 0.72 + synergyPct * 0.28));

    const roundsPlayed = Math.max(1, endedRound - startRound + 1);
    const endTotalWellness = pWellness.reduce((a, b) => a + b, 0);

    sumFinalRound += endedRound;
    sumFinalEfficiency += eff;
    sumFinalCommon += commonCount;
    sumFinalPublic += publicCount;
    sumFinalPrivate += privateCount;
    sumTotalLegitimacy += totalLeg;
    sumDetentions += simDetentions;
    sumAttacks += simAttacks;
    sumNetWellnessPerRound += (endTotalWellness - startTotalWellness) / roundsPlayed;
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    iterations,
    horizonRounds: targetMaxRound - startRound + 1,
    fromRound: startRound,
    victoryPct: Math.round((victoryCount / iterations) * 100),
    drawPct: Math.round((drawCount / iterations) * 100),
    defeatPct: Math.round((defeatCount / iterations) * 100),
    avgFinalRound: Number((sumFinalRound / iterations).toFixed(1)),
    avgFinalEfficiencyPct: Math.round(sumFinalEfficiency / iterations),
    avgFinalCommonCount: Number((sumFinalCommon / iterations).toFixed(1)),
    avgFinalPublicCount: Number((sumFinalPublic / iterations).toFixed(1)),
    avgFinalPrivateCount: Number((sumFinalPrivate / iterations).toFixed(1)),
    avgTotalLegitimacy: Math.round(sumTotalLegitimacy / iterations),
    avgDetentionsPerMatch: Number((sumDetentions / iterations).toFixed(2)),
    avgSpeculatorAttacksPerMatch: Number((sumAttacks / iterations).toFixed(2)),
    expectedRoundWellnessDelta: Number((sumNetWellnessPerRound / iterations).toFixed(1)),
    durationMs: Math.max(1, Math.round(t1 - t0))
  };
}
