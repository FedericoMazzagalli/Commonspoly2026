/**
 * EconomyDebugHUD.tsx
 * Panel Debug en tiempo real para auditar y balancear la economía de Commonspoly:
 * - Probabilidad en vivo de eventos de especulación (ataque de especuladores 1d6,
 *   crisis inesperadas, eventos climáticos y trampas del próximo dado).
 * - Impacto económico actual de las casillas cooperativas (coste efectivo tras Saberes,
 *   Reputación y modificadores activos; retorno neto, amortización en visitas y amenaza).
 * Diseñado sin backdrop-blur ni puntos pulsantes decorativos sobre el tablero WebGL.
 */

import React, { useMemo, useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Coins,
  Crosshair,
  Dices,
  Download,
  Flame,
  FlaskConical,
  History,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Route,
  Scale,
  Search,
  ShieldAlert,
  Sliders,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import {
  BoardDangerZoneTier,
  DifficultyLevel,
  GameEngineState,
  GoodState,
  ProbabilitySandboxConfig,
  SandboxDiceProfile,
  SandboxSpeculatorMovementLogic,
  SpeculatorActionKind,
  SpeculatorActionLogEntry,
  SpeculatorBehaviorOverride
} from '../../types/game';
import {
  CooperativeTileEconomyRow,
  DangerZoneHotspot,
  SpeculatorIntendedTarget,
  SpeculatorPathStep,
  computeEconomyDebugSnapshot
} from '../../utils/economyDebugMetrics';
import { formatSignedScore } from '../../utils/reputation';
import {
  AccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  getAccessibilityPalette
} from '../../utils/accessibility';
import {
  MonteCarloSimulationResult,
  runEconomyMonteCarlo
} from '../../utils/economySimulator';
import {
  DEFAULT_PROBABILITY_SANDBOX_CONFIG,
  getPlayerDiceDistribution
} from '../../utils/probabilitySandbox';
import type { SandboxMutation } from '../../store/gameEngine';
import { useI18n } from '../../i18n';
import type { TranslationDict } from '../../i18n/types';

interface EconomyDebugHUDProps {
  isOpen: boolean;
  state: GameEngineState;
  onClose: () => void;
  onSelectTile?: (tileId: number) => void;
  isHeatmapEnabled?: boolean;
  onToggleHeatmap?: () => void;
  isTrajectoriesEnabled?: boolean;
  onToggleTrajectories?: () => void;
  accessibilitySettings?: AccessibilitySettings;
  onApplySandboxMutation?: (mutation: SandboxMutation) => void;
  onSimulateDiceRoll?: (forcedRoll?: number) => void;
  onSimulateSpeculatorsTurn?: () => void;
  onRestorePreSandbox?: () => void;
  canRestoreSandbox?: boolean;
}

type DebugTab = 'SPECULATION' | 'TILES' | 'BALANCE' | 'SIMULATOR' | 'LOG' | 'BOTS';
type EventLogFilter = 'ALL' | 'SPECULATOR' | 'TILES' | 'GLOBAL' | 'ACTION';
type SpecActionFilter = 'ALL' | 'BUY' | 'VANDALIZE' | 'ATTACK' | 'MOVE';
type TileFilter = 'ALL' | 'COMMON' | 'PUBLIC' | 'PRIVATE' | 'THREATENED';
type TileSort = 'IMPACT' | 'COST_ASC' | 'THREAT';

function getDifficultyLabel(difficulty: string, setup: TranslationDict['setup']): string {
  if (difficulty === 'MAD_MAX') return setup.diffMadMax;
  if (difficulty === 'COMUNLANDIA') return setup.diffComunlandia;
  return setup.diffTransition;
}

function getStateLabel(tileState: GoodState, isInalienable: boolean, common: TranslationDict['common']): string {
  if (isInalienable) return common.inalienable;
  if (tileState === 'COMMON') return common.common;
  if (tileState === 'PUBLIC') return common.public;
  return common.private;
}

function getStateTextClass(tileState: GoodState, isInalienable: boolean): string {
  if (isInalienable) return 'text-pink-300';
  if (tileState === 'COMMON') return 'text-emerald-300';
  if (tileState === 'PUBLIC') return 'text-sky-300';
  return 'text-rose-300';
}

function getRiskSeverityStyle(pct: number, debug: TranslationDict['debug']): {
  label: string;
  textClass: string;
  barClass: string;
} {
  if (pct >= 45) {
    return { label: debug.riskCritical, textClass: 'text-rose-300', barClass: 'bg-rose-400' };
  }
  if (pct >= 20) {
    return { label: debug.riskHigh, textClass: 'text-amber-300', barClass: 'bg-amber-400' };
  }
  if (pct > 0) {
    return { label: debug.riskMod, textClass: 'text-sky-300', barClass: 'bg-sky-400' };
  }
  return { label: debug.riskNone, textClass: 'text-emerald-300', barClass: 'bg-emerald-400' };
}

function getIntendedTargetLabel(target: SpeculatorIntendedTarget): {
  tag: string;
  toneClass: string;
} {
  if (target.reason === 'IN_RANGE_ATTACK') {
    return {
      tag: `Ataque a ${target.targetPlayerName} (${target.probabilityPct}%)`,
      toneClass: 'text-rose-300'
    };
  }
  if (target.reason === 'BLOCKED_MUTUAL_PROTECTION') {
    return {
      tag: `Bloqueado por ${target.targetPlayerName}`,
      toneClass: 'text-emerald-300'
    };
  }
  if (target.reason === 'NEAREST_ISOLATED_CHASE') {
    return {
      tag: `Próximo alcance a ${target.targetPlayerName} (+${target.distance})`,
      toneClass: 'text-amber-300'
    };
  }
  return {
    tag: 'Media esperada 1d6 (+3)',
    toneClass: 'text-slate-300'
  };
}

function getStepOutcomeText(step: SpeculatorPathStep): {
  label: string;
  toneClass: string;
} {
  if (step.outcome === 'VULNERABLE_PLAYER') {
    return {
      label: `Ataca: ${step.occupantNames[0]}${step.supersededByPriorAttack ? ' (sup.)' : ''}`,
      toneClass: 'text-rose-300'
    };
  }
  if (step.outcome === 'MUTUAL_PROTECTION') {
    return {
      label: `Protegida (${step.occupantNames.length})`,
      toneClass: 'text-emerald-300'
    };
  }
  if (step.outcome === 'RESOURCE_TILE') {
    if (step.tileState === 'COMMON') return { label: 'Bien Común', toneClass: 'text-emerald-300' };
    if (step.tileState === 'PUBLIC') return { label: 'Bien Público', toneClass: 'text-sky-300' };
    return { label: 'Bien Privado', toneClass: 'text-slate-400' };
  }
  return { label: 'Casilla Especial', toneClass: 'text-slate-400' };
}

function getDangerTierStyle(tier: BoardDangerZoneTier, debug: TranslationDict['debug']): {
  label: string;
  textClass: string;
  swatchClass: string;
} {
  if (tier === 'CRITICAL') {
    return { label: debug.critical, textClass: 'text-rose-300', swatchClass: 'bg-rose-500' };
  }
  if (tier === 'HIGH') {
    return { label: debug.high, textClass: 'text-orange-300', swatchClass: 'bg-orange-500' };
  }
  if (tier === 'PROTECTED') {
    return { label: debug.protectedLbl, textClass: 'text-emerald-300', swatchClass: 'bg-emerald-500' };
  }
  return { label: debug.moderate, textClass: 'text-amber-300', swatchClass: 'bg-amber-400' };
}

function getSpecActionBadgeMeta(
  kind: SpeculatorActionKind,
  debug: TranslationDict['debug']
): { label: string; badgeClass: string; cardClass: string } {
  switch (kind) {
    case 'BUY_TILE':
      return {
        label: debug.specLogKindBuy ?? 'COMPRA',
        badgeClass: 'bg-rose-500/25 border-rose-500/60 text-rose-200',
        cardClass: 'bg-rose-950/35 border-rose-800/60'
      };
    case 'VANDALIZE_TILE':
      return {
        label: debug.specLogKindVandal ?? 'VANDALISMO',
        badgeClass: 'bg-amber-500/25 border-amber-500/60 text-amber-200',
        cardClass: 'bg-amber-950/35 border-amber-800/60'
      };
    case 'DETAIN_PLAYER':
      return {
        label: debug.specLogKindDetain ?? 'DETENCIÓN',
        badgeClass: 'bg-red-600/30 border-red-500/70 text-red-200',
        cardClass: 'bg-red-950/40 border-red-800/60'
      };
    case 'ATTACK_PLAYER':
      return {
        label: debug.specLogKindAttack ?? 'ATAQUE',
        badgeClass: 'bg-orange-500/25 border-orange-500/60 text-orange-200',
        cardClass: 'bg-orange-950/30 border-orange-800/60'
      };
    case 'BLOCKED':
      return {
        label: debug.specLogKindBlocked ?? 'BLOQUEO',
        badgeClass: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200',
        cardClass: 'bg-emerald-950/25 border-emerald-800/50'
      };
    case 'MOVE':
    default:
      return {
        label: debug.specLogKindMove ?? 'AVANCE',
        badgeClass: 'bg-slate-800 border-slate-700 text-slate-300',
        cardClass: 'bg-slate-900/90 border-slate-800'
      };
  }
}

export const EconomyDebugHUD: React.FC<EconomyDebugHUDProps> = ({
  isOpen,
  state,
  onClose,
  onSelectTile,
  isHeatmapEnabled = true,
  onToggleHeatmap,
  isTrajectoriesEnabled = true,
  onToggleTrajectories,
  accessibilitySettings = DEFAULT_ACCESSIBILITY_SETTINGS,
  onApplySandboxMutation,
  onSimulateDiceRoll,
  onSimulateSpeculatorsTurn,
  onRestorePreSandbox,
  canRestoreSandbox = false
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<DebugTab>('SPECULATION');
  const [tileFilter, setTileFilter] = useState<TileFilter>('ALL');
  const [tileSort, setTileSort] = useState<TileSort>('IMPACT');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [collapsedSpeculatorIds, setCollapsedSpeculatorIds] = useState<Record<number, boolean>>({});
  const [simIterations, setSimIterations] = useState<number>(200);
  const [simHorizonRounds, setSimHorizonRounds] = useState<number>(20);
  const [simResult, setSimResult] = useState<MonteCarloSimulationResult | null>(null);
  const [eventLogFilter, setEventLogFilter] = useState<EventLogFilter>('ALL');
  const [eventLogSearch, setEventLogSearch] = useState('');
  const [logSubMode, setLogSubMode] = useState<'SPECULATORS' | 'GENERAL'>('SPECULATORS');
  const [specActionFilter, setSpecActionFilter] = useState<SpecActionFilter>('ALL');
  const [specBotFilter, setSpecBotFilter] = useState<'ALL' | number>('ALL');
  const [loadedReplayFrameIndex, setLoadedReplayFrameIndex] = useState<number | null>(null);

  const replayFramesMeta = useMemo(() => {
    const frames = state.replayFrames ?? [];
    const items = frames.map((frame, idx) => {
      const prevFrame = idx > 0 ? frames[idx - 1] : null;
      const privateDelta = prevFrame ? frame.privateCount - prevFrame.privateCount : 0;
      const hasHazardLog = frame.turnLogs.some(l => l.type === 'HAZARD');
      const summaryLower = frame.eventSummary.toLowerCase();
      const mentionsSpeculator =
        summaryLower.includes('especulador') ||
        summaryLower.includes('speculator') ||
        summaryLower.includes('deten') ||
        summaryLower.includes('tragedia') ||
        summaryLower.includes('privatiz') ||
        frame.actorId === 'speculators';
      const criticalScore =
        (hasHazardLog ? 3 : 0) +
        (mentionsSpeculator ? 3 : 0) +
        (privateDelta > 0 ? privateDelta * 2 : 0) +
        (frame.activeCrisisTitle ? 2 : 0);

      return {
        frame,
        privateDelta,
        isCritical: criticalScore >= 3,
        criticalScore
      };
    });

    const mostCritical =
      [...items].sort(
        (a, b) => b.criticalScore - a.criticalScore || b.frame.frameIndex - a.frame.frameIndex
      )[0] ?? null;
    const latest = items[items.length - 1] ?? null;

    return {
      orderedNewestFirst: [...items].reverse(),
      mostCritical: mostCritical && mostCritical.criticalScore > 0 ? mostCritical : latest,
      latest
    };
  }, [state.replayFrames]);

  const filteredLogs = useMemo(() => {
    const q = eventLogSearch.trim().toLowerCase();
    return (state.logs || []).filter(log => {
      if (q && !log.message.toLowerCase().includes(q) && !log.actor.toLowerCase().includes(q)) {
        return false;
      }
      const msg = log.message.toLowerCase();
      const type = log.type;

      if (eventLogFilter === 'SPECULATOR') {
        return type === 'HAZARD' || msg.includes('especulador') || msg.includes('speculator') || msg.includes('ataque') || msg.includes('detención') || msg.includes('detencion');
      }
      if (eventLogFilter === 'TILES') {
        return msg.includes('casilla') || msg.includes('tile') || msg.includes('común') || msg.includes('comun') || msg.includes('público') || msg.includes('public') || msg.includes('privado') || msg.includes('privatelock') || msg.includes('desbloqueo');
      }
      if (eventLogFilter === 'GLOBAL') {
        return type === 'CARD' || msg.includes('crisis') || msg.includes('clima') || msg.includes('meteorología') || msg.includes('sequía') || msg.includes('weather') || msg.includes('bureaucracy');
      }
      if (eventLogFilter === 'ACTION') {
        return type === 'ACTION' || type === 'SUCCESS' || type === 'INFO';
      }
      return true;
    });
  }, [state.logs, eventLogFilter, eventLogSearch]);

  const speculatorActionLogs = state.speculatorActionLogs ?? [];

  const speculatorActionCounts = useMemo(() => {
    const counts: Record<number, { buys: number; vandals: number; attacks: number; blocked: number }> = {};
    state.speculators.forEach(s => {
      counts[s.id] = { buys: 0, vandals: 0, attacks: 0, blocked: 0 };
    });
    speculatorActionLogs.forEach(entry => {
      if (!counts[entry.speculatorId]) {
        counts[entry.speculatorId] = { buys: 0, vandals: 0, attacks: 0, blocked: 0 };
      }
      if (entry.kind === 'BUY_TILE') counts[entry.speculatorId].buys += 1;
      else if (entry.kind === 'VANDALIZE_TILE') counts[entry.speculatorId].vandals += 1;
      else if (entry.kind === 'ATTACK_PLAYER' || entry.kind === 'DETAIN_PLAYER') {
        counts[entry.speculatorId].attacks += 1;
      } else if (entry.kind === 'BLOCKED') {
        counts[entry.speculatorId].blocked += 1;
      }
    });
    return counts;
  }, [speculatorActionLogs, state.speculators]);

  const filteredSpecActionLogs = useMemo(() => {
    const q = eventLogSearch.trim().toLowerCase();
    return speculatorActionLogs.filter(entry => {
      if (specBotFilter !== 'ALL' && entry.speculatorId !== specBotFilter) return false;
      if (specActionFilter === 'BUY' && entry.kind !== 'BUY_TILE') return false;
      if (specActionFilter === 'VANDALIZE' && entry.kind !== 'VANDALIZE_TILE') return false;
      if (
        specActionFilter === 'ATTACK' &&
        entry.kind !== 'ATTACK_PLAYER' &&
        entry.kind !== 'DETAIN_PLAYER'
      ) {
        return false;
      }
      if (
        specActionFilter === 'MOVE' &&
        entry.kind !== 'MOVE' &&
        entry.kind !== 'BLOCKED'
      ) {
        return false;
      }
      if (q) {
        const hay = `${entry.speculatorName} ${entry.tileName} ${entry.details} ${entry.targetPlayerName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [speculatorActionLogs, specActionFilter, specBotFilter, eventLogSearch]);

  const a11yPalette = useMemo(
    () => getAccessibilityPalette(accessibilitySettings.colorVisionMode),
    [accessibilitySettings.colorVisionMode]
  );

  const toggleSpeculatorRoute = (id: number) => {
    setCollapsedSpeculatorIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunSimulation = () => {
    const res = runEconomyMonteCarlo(state, {
      iterations: simIterations,
      horizonRounds: simHorizonRounds
    });
    setSimResult(res);
  };

  const handleExportJson = () => {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      round: state.round,
      difficulty: snapshot.speculation.difficulty,
      speculators: state.speculators,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        wellness: p.wellness,
        legitimacy: p.legitimacy,
        reputation: p.neighborhoodReputation ?? 0,
        controller: p.controller
      })),
      tiles: state.tiles.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        state: t.state,
        goodType: t.goodType,
        transformedByName: t.transformedByName
      })),
      snapshot: {
        speculation: snapshot.speculation,
        economySummary: snapshot.economySummary,
        familySummaries: snapshot.familySummaries,
        dangerHotspots: snapshot.speculation.dangerHotspots,
        tileRows: snapshot.tileRows
      },
      probabilitySandbox: state.probabilitySandbox ?? null,
      speculatorActionLogs: state.speculatorActionLogs ?? [],
      activeCrisis: state.activeCrisis ?? null,
      activeWeatherEvent: state.activeWeatherEvent ?? null
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commonspoly_economy_debug_round_${state.round}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateBotBehavior = (specId: number, patch: Partial<SpeculatorBehaviorOverride>) => {
    if (!onApplySandboxMutation) return;
    const currentBehaviors = state.probabilitySandbox?.speculatorBehaviors ?? {};
    const existing = currentBehaviors[specId] ?? {
      speculatorId: specId,
      aggressivenessPct: 50,
      influenceRadius: 12,
      decisionThreshold: 3
    };
    const updated = { ...existing, ...patch };

    onApplySandboxMutation({
      type: 'UPDATE_PROBABILITY_SANDBOX',
      patch: {
        speculatorBehaviors: {
          ...currentBehaviors,
          [specId]: updated
        }
      }
    });
  };

  const snapshot = useMemo(() => computeEconomyDebugSnapshot(state), [state]);

  const filteredTileRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = snapshot.tileRows.filter(row => {
      if (tileFilter === 'COMMON' && row.state !== 'COMMON') return false;
      if (tileFilter === 'PUBLIC' && row.state !== 'PUBLIC') return false;
      if (tileFilter === 'PRIVATE' && row.state !== 'PRIVATE') return false;
      if (tileFilter === 'THREATENED' && row.speculatorThreatPct <= 0) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (tileSort === 'COST_ASC') {
        return a.effectiveUnlockCost - b.effectiveUnlockCost || b.netEconomicImpact - a.netEconomicImpact;
      }
      if (tileSort === 'THREAT') {
        return b.speculatorThreatPct - a.speculatorThreatPct || b.netEconomicImpact - a.netEconomicImpact;
      }
      return b.netEconomicImpact - a.netEconomicImpact || a.effectiveUnlockCost - b.effectiveUnlockCost;
    });
  }, [snapshot.tileRows, tileFilter, tileSort, searchQuery]);

  if (!isOpen) return null;

  const { speculation, economySummary, familySummaries } = snapshot;
  const attackSeverity = getRiskSeverityStyle(speculation.roundAttackHitChancePct, t.debug);
  const crisisSeverity = getRiskSeverityStyle(speculation.crisisTriggerChancePct, t.debug);
  const weatherSeverity = getRiskSeverityStyle(speculation.weatherTriggerChancePct, t.debug);

  const sandboxConfig: ProbabilitySandboxConfig =
    state.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG;
  const isProbabilitySandboxEnabled = Boolean(sandboxConfig.enabled);
  const playerDiceDistribution = useMemo(
    () => getPlayerDiceDistribution(sandboxConfig),
    [sandboxConfig]
  );

  const handleToggleProbabilitySandbox = () => {
    if (!onApplySandboxMutation) return;
    const nextEnabled = !isProbabilitySandboxEnabled;
    onApplySandboxMutation({
      type: 'TOGGLE_PROBABILITY_SANDBOX',
      enabled: nextEnabled
    });
    if (nextEnabled) {
      setActiveTab('SIMULATOR');
    }
  };

  return (
    <aside
      role="region"
      aria-label={t.debug.title}
      className={`pointer-events-auto fixed left-3 right-3 sm:left-6 sm:right-auto top-16 sm:top-20 z-40 flex flex-col bg-slate-950 border border-amber-600/70 rounded-2xl shadow-2xl text-slate-100 overflow-hidden ${
        isCompact ? 'sm:w-96' : 'bottom-20 sm:bottom-auto sm:w-[440px] sm:max-h-[calc(100vh-11rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bug className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold tracking-wide text-white truncate">
              {t.debug.title} · {t.hud.roundLabel} {state.round}/20
            </h2>
            <p className="text-[11px] text-slate-400 truncate tabular-nums">
              {getDifficultyLabel(speculation.difficulty, t.setup)} · {speculation.speculatorsCount} {t.debug.speculatorsLbl} · {economySummary.activePlayerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="px-2 py-1 min-h-[32px] sm:min-h-[32px] flex items-center gap-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={t.debug.exportJson ?? 'Exportar JSON'}
            aria-label={t.debug.exportJson ?? 'Exportar JSON'}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCompact(prev => !prev)}
            className="min-w-[40px] min-h-[40px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={isCompact ? t.hud.dockExpand : t.hud.dockCollapse}
            aria-label={isCompact ? t.hud.dockExpand : t.hud.dockCollapse}
          >
            {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={t.common.close}
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Strip Mode */}
      {isCompact ? (
        <div className="px-4 py-3 grid grid-cols-3 gap-3 text-xs tabular-nums">
          <div>
            <div className="text-[10px] text-slate-400">Ataque Espec.</div>
            <div className={`text-sm font-black ${attackSeverity.textClass}`}>
              {speculation.roundAttackHitChancePct}%
            </div>
            <div className="text-[10px] text-slate-400">
              Det. {speculation.roundDetentionRiskPct}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Crisis / Clima</div>
            <div className="text-sm font-black text-amber-300">
              {speculation.crisisTriggerChancePct}% / {speculation.weatherTriggerChancePct}%
            </div>
            <div className="text-[10px] text-slate-400">próximo turno</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">Coste / Retorno</div>
            <div className="text-sm font-black text-emerald-300">
              {economySummary.avgTransformUnlockCost}B · +{economySummary.expectedRoundCommonYield}
            </div>
            <div className="text-[10px] text-slate-400">
              Eficiencia {economySummary.efficiencyPct}%
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Segmented Tabs */}
          <div className="px-4 pt-2.5 pb-2 border-b border-slate-800 bg-slate-950 shrink-0">
            <div className="grid grid-cols-6 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('SPECULATION')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'SPECULATION'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabRisk}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('TILES')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'TILES'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabTiles} ({snapshot.tileRows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BALANCE')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'BALANCE'
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabBalance}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SIMULATOR')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'SIMULATOR'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabSandbox}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LOG')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'LOG'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabLog ?? 'Event Log'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BOTS')}
                className={`min-h-[40px] sm:min-h-[34px] px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  activeTab === 'BOTS'
                    ? 'bg-rose-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span>{t.debug.tabBots ?? 'Bots'}</span>
              </button>
            </div>
          </div>

          {/* Persistent Probability Sandbox Mode Quick-Toggle Bar */}
          {onApplySandboxMutation && (
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/75 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-100 truncate">
                    {t.debug.probSandboxTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {isProbabilitySandboxEnabled
                      ? t.debug.probSandboxDescOn
                      : t.debug.probSandboxDescOff}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isProbabilitySandboxEnabled && activeTab !== 'SIMULATOR' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('SIMULATOR')}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-sky-300"
                  >
                    {t.debug.probSandboxControls}
                  </button>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isProbabilitySandboxEnabled}
                  aria-label={t.debug.probSandboxTitle}
                  onClick={handleToggleProbabilitySandbox}
                  className={`min-h-[30px] px-2.5 rounded-lg border text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isProbabilitySandboxEnabled
                      ? 'bg-sky-400 text-slate-950 border-sky-300'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {isProbabilitySandboxEnabled ? t.common.on : t.common.off}
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-4 overflow-y-auto space-y-4 text-xs tabular-nums flex-1">
            {activeTab === 'SPECULATION' && (
              <>
                {/* 1. Probabilidad de ataque especulador en cierre de ronda */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200">
                      {t.debug.speculatorRiskTitle}
                    </h3>
                    <span className={`font-bold ${attackSeverity.textClass}`}>
                      {speculation.roundAttackHitChancePct}% · {attackSeverity.label}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${attackSeverity.barClass}`}
                      style={{ width: `${Math.min(100, speculation.roundAttackHitChancePct)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="py-1.5 border-t border-slate-800">
                      <div className="text-slate-400">{t.debug.netDetention}</div>
                      <div className="font-bold text-rose-300">
                        {speculation.roundDetentionRiskPct}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ({speculation.detentionOnHitPct}%)
                      </div>
                    </div>
                    <div className="py-1.5 border-t border-slate-800">
                      <div className="text-slate-400">{t.debug.stealPts}</div>
                      <div className="font-bold text-amber-300">
                        {speculation.roundStealRiskPct}%
                      </div>
                      <div className="text-[10px] text-slate-500">{t.common.wellness} / {t.common.legitimacy}</div>
                    </div>
                    <div className="py-1.5 border-t border-slate-800">
                      <div className="text-slate-400">{t.debug.mutualProtection}</div>
                      <div className="font-bold text-emerald-300">
                        {speculation.mutualProtectionZones}
                      </div>
                      <div className="text-[10px] text-slate-500">2+</div>
                    </div>
                  </div>

                  {/* Mapa de calor 3D y Top zonas de peligro (Hotspots) */}
                  <div className="border-t border-slate-800 pt-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{t.debug.heatmapTitle}</span>
                      </h4>
                      {onToggleHeatmap && (
                        <button
                          type="button"
                          onClick={onToggleHeatmap}
                          aria-pressed={isHeatmapEnabled}
                          className={`min-h-[40px] sm:min-h-[34px] px-2.5 rounded-lg border text-[11px] font-bold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            isHeatmapEnabled
                              ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 hover:bg-rose-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                          title={t.debug.heatmapTitle}
                        >
                          {isHeatmapEnabled ? t.debug.board3dOn : t.debug.board3dOff}
                        </button>
                      )}
                    </div>

                    {/* Leyenda accesible por color + forma simbólica */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block"
                          style={{ backgroundColor: a11yPalette.heatmapTiers.CRITICAL.cssHex }}
                          aria-hidden="true"
                        />
                        {accessibilitySettings.showSymbolicShapes ? `${a11yPalette.heatmapTiers.CRITICAL.shape} ` : ''}
                        {t.debug.critical}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block"
                          style={{ backgroundColor: a11yPalette.heatmapTiers.HIGH.cssHex }}
                          aria-hidden="true"
                        />
                        {accessibilitySettings.showSymbolicShapes ? `${a11yPalette.heatmapTiers.HIGH.shape} ` : ''}
                        {t.debug.high}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block"
                          style={{ backgroundColor: a11yPalette.heatmapTiers.MODERATE.cssHex }}
                          aria-hidden="true"
                        />
                        {accessibilitySettings.showSymbolicShapes ? `${a11yPalette.heatmapTiers.MODERATE.shape} ` : ''}
                        {t.debug.moderate}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block"
                          style={{ backgroundColor: a11yPalette.heatmapTiers.PROTECTED.cssHex }}
                          aria-hidden="true"
                        />
                        {accessibilitySettings.showSymbolicShapes ? `${a11yPalette.heatmapTiers.PROTECTED.shape} ` : ''}
                        {t.debug.protectedLbl}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Crosshair className="w-3 h-3 text-rose-300" aria-hidden="true" />
                        {t.debug.ringTarget}
                      </span>
                    </div>

                    {/* Lista clicable de Hotspots */}
                    {speculation.dangerHotspots.length === 0 ? (
                      <div className="text-[11px] text-slate-400 py-1">
                        {t.debug.noHotspots}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {speculation.dangerHotspots.map((hotspot: DangerZoneHotspot) => {
                          const tierMeta = getDangerTierStyle(hotspot.tier, t.debug);
                          const a11yTier =
                            hotspot.tier !== 'NONE'
                              ? a11yPalette.heatmapTiers[hotspot.tier]
                              : null;
                          return (
                            <button
                              key={hotspot.tileId}
                              type="button"
                              onClick={() => onSelectTile?.(hotspot.tileId)}
                              className="w-full min-h-[42px] text-left px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              title={`Inspeccionar casilla #${hotspot.tileId} ${hotspot.tileName} en el tablero 3D`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: a11yTier?.cssHex }}
                                  aria-hidden="true"
                                />
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold text-slate-100 truncate">
                                    {accessibilitySettings.showSymbolicShapes && a11yTier ? `${a11yTier.shape} ` : ''}
                                    #{hotspot.tileId} {hotspot.tileName}
                                    <span className="text-slate-500 font-normal"> · {hotspot.boardSideLabel}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {hotspot.summaryLabel}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0 tabular-nums">
                                <div className={`text-[11px] font-bold ${a11yTier?.textClass ?? tierMeta.textClass}`}>
                                  {tierMeta.label} · {Math.round(hotspot.intensity * 100)}%
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {hotspot.hitChancePct}% 1d6
                                  {hotspot.intendedByCount > 0 ? ` · ${hotspot.intendedByCount} obj.` : ''}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Patrones de movimiento, lógica de ruta y casilla objetivo por Especulador (Bots) */}
                  <div className="border-t border-slate-800 pt-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                          <Route className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{t.debug.trajectoriesTitle}</span>
                        </h4>
                      </div>
                      {onToggleTrajectories && (
                        <button
                          type="button"
                          onClick={onToggleTrajectories}
                          aria-pressed={isTrajectoriesEnabled}
                          className={`min-h-[40px] sm:min-h-[34px] px-2.5 rounded-lg border text-[11px] font-bold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            isTrajectoriesEnabled
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                          title={t.debug.trajectoriesTitle}
                        >
                          3D: {isTrajectoriesEnabled ? t.common.on : t.common.off}
                        </button>
                      )}
                    </div>

                    {speculation.speculatorThreats.map(spec => {
                      const targetMeta = getIntendedTargetLabel(spec.intendedTarget);
                      const isRouteExpanded = !collapsedSpeculatorIds[spec.speculatorId];
                      const traj = (speculation.speculatorTrajectories ?? []).find(
                        t => t.speculatorId === spec.speculatorId
                      );
                      const trajPal =
                        a11yPalette.trajectoryColors[
                          Math.max(0, spec.orderIndex - 1) % a11yPalette.trajectoryColors.length
                        ];

                      return (
                        <div
                          key={spec.speculatorId}
                          className="pt-2.5 border-t border-slate-800/80 space-y-2"
                        >
                          {/* Cabecera del bot especulador */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {traj && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: trajPal?.css || traj.color }}
                                    aria-hidden="true"
                                  />
                                )}
                                <div className="font-bold text-slate-100 truncate">
                                  {accessibilitySettings.showSymbolicShapes && trajPal ? `${trajPal.shape} ` : ''}
                                  Bot #{spec.orderIndex} · {spec.speculatorName}
                                </div>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                Posición actual: #{spec.position} {spec.currentTileName} ({spec.boardSideLabel})
                                {spec.causesReboundBlockNow ? ' · Bloquea casilla (2+ fichas)' : ''}
                              </div>
                            </div>
                            <span
                              className={`font-bold shrink-0 ${
                                spec.hitChancePct > 0 ? 'text-rose-300' : 'text-emerald-300'
                              }`}
                            >
                              {spec.hitChancePct}% impacto
                            </span>
                          </div>

                          {/* Detalle visual de trayectoria 3D */}
                          {traj && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-300 flex-wrap">
                              <span className="text-slate-400 font-medium">Trayectoria 3D:</span>
                              <span className="font-mono text-slate-100 font-bold">
                                #{traj.fromTileId} → #{traj.toTileId}
                              </span>
                              <span className="text-slate-400">
                                ({traj.distance} {traj.distance === 1 ? 'casilla' : 'casillas'})
                              </span>
                              {traj.inCurrentRollRange ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  En rango 1d6
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                  Persecución
                                </span>
                              )}
                            </div>
                          )}

                          {/* Lógica de pathing y prioridad */}
                          <div className="text-[11px] text-slate-300 space-y-0.5 leading-snug">
                            <div>
                              <span className="text-slate-400">Lógica de ruta:</span>{' '}
                              {spec.pathingLogicLabel}
                            </div>
                            <div>
                              <span className="text-slate-400">Prioridad de turno:</span>{' '}
                              {spec.attackPriorityNote}
                            </div>
                          </div>

                          {/* Casilla objetivo prevista (clicable para inspeccionar en 3D) */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectTile?.(spec.intendedTarget.tileId)}
                              className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              title="Inspeccionar casilla objetivo en el tablero 3D"
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate text-[11px] text-slate-200 font-semibold">
                                  Objetivo: #{spec.intendedTarget.tileId} {spec.intendedTarget.tileName} (+{spec.intendedTarget.distance})
                                </span>
                              </span>
                              <span className={`text-[11px] font-bold shrink-0 ${targetMeta.toneClass}`}>
                                {targetMeta.tag}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSpeculatorRoute(spec.speculatorId)}
                              className="min-h-[38px] px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center gap-1 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              aria-expanded={isRouteExpanded}
                              title={isRouteExpanded ? 'Ocultar pasos +1..+6' : 'Ver pasos +1..+6'}
                            >
                              <span>+1..+6</span>
                              {isRouteExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Desglose de los 6 pasos candidatos (1d6) */}
                          {isRouteExpanded && (
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              {spec.candidateSteps.map(step => {
                                const outcomeMeta = getStepOutcomeText(step);
                                return (
                                  <button
                                    key={step.step}
                                    type="button"
                                    onClick={() => onSelectTile?.(step.tileId)}
                                    className="text-left px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                    title={`Casilla #${step.tileId} ${step.tileName} — ${step.hitProbabilityPct}% probabilidad`}
                                  >
                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                      <span className="font-bold text-slate-200 truncate">
                                        +{step.step} · #{step.tileId} {step.tileName}
                                      </span>
                                      <span className="text-slate-400 shrink-0">
                                        {step.hitProbabilityPct}%
                                      </span>
                                    </div>
                                    <div className={`text-[10px] font-semibold truncate ${outcomeMeta.toneClass}`}>
                                      {outcomeMeta.label}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Casillas en riesgo de compra o vandalismo en rango +1..+6 */}
                          <div className="pt-0.5 space-y-1">
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {t.debug.specLogPredictTileRisk ?? 'Casillas en rango +1..+6:'}
                            </div>
                            {spec.predictedTileRisks.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {spec.predictedTileRisks.slice(0, 3).map(risk => (
                                  <button
                                    key={risk.tileId}
                                    type="button"
                                    onClick={() => onSelectTile?.(risk.tileId)}
                                    className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors ${
                                      risk.riskAction === 'BUY'
                                        ? 'bg-rose-950/50 hover:bg-rose-900/60 border-rose-700/60 text-rose-200'
                                        : 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-700/60 text-amber-200'
                                    }`}
                                    title={`#${risk.tileId} ${risk.tileName}`}
                                  >
                                    +{risk.distance} #{risk.tileId} ·{' '}
                                    {risk.riskAction === 'BUY'
                                      ? t.debug.specLogKindBuy ?? 'COMPRA'
                                      : t.debug.specLogKindVandal ?? 'VANDALISMO'}{' '}
                                    ({risk.actionChancePct}%)
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500">
                                {t.debug.specLogNoTileRisk ?? 'Sin casillas vulnerables en +1..+6'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Vista rápida en tiempo real del Log de Especuladores */}
                    <div className="pt-2.5 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{t.debug.specLogTitle ?? 'Log en Tiempo Real · Especuladores'}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('LOG');
                            setLogSubMode('SPECULATORS');
                          }}
                          className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 shrink-0"
                        >
                          {t.debug.specLogViewAllBtn ?? 'Ver log completo'} ({speculatorActionLogs.length})
                        </button>
                      </div>

                      {speculatorActionLogs.length === 0 ? (
                        <div className="text-[10px] text-slate-400 py-1">
                          {t.debug.specLogEmpty ?? 'Aún no hay movimientos registrados de especuladores en esta partida.'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {speculatorActionLogs.slice(0, 4).map((entry: SpeculatorActionLogEntry) => {
                            const badge = getSpecActionBadgeMeta(entry.kind, t.debug);
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => onSelectTile?.(entry.toTileId)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors hover:brightness-110 ${badge.cardClass}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 min-w-0 font-bold text-slate-100">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: entry.speculatorColor }}
                                    />
                                    <span className="truncate">{entry.speculatorName}</span>
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black shrink-0 ${badge.badgeClass}`}>
                                      {badge.label}
                                    </span>
                                  </span>
                                  <span className="text-slate-400 shrink-0 tabular-nums">
                                    R{entry.round} · +{entry.diceRoll}
                                  </span>
                                </div>
                                <div className="text-slate-300 truncate mt-0.5">
                                  {entry.details}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 2. Probabilidades dinámicas de Crisis y Clima */}
                <section className="border-t border-slate-800 pt-3 space-y-3">
                  <h3 className="text-xs font-bold text-slate-200">
                    Eventos Probabilísticos (próximo turno)
                  </h3>

                  {/* Crisis Inesperada */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Crisis Inesperada</span>
                      <span className={`font-bold ${crisisSeverity.textClass}`}>
                        {state.activeCrisis
                          ? `Activa (${speculation.activeCrisisTurnsLeft} turnos)`
                          : `${speculation.crisisTriggerChancePct}% · ${crisisSeverity.label}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${crisisSeverity.barClass}`}
                        style={{
                          width: `${
                            state.activeCrisis ? 100 : Math.min(100, speculation.crisisTriggerChancePct)
                          }%`
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                      <span>
                        {state.activeCrisis
                          ? `${state.activeCrisis.title} (${formatSignedScore(state.activeCrisis.unlockCostDelta)} coste)`
                          : `Cooldown ${speculation.crisisCooldownCurrent}/${speculation.crisisCooldownRequired} turnos (máx. 28%)`}
                      </span>
                      <span className="shrink-0">
                        {speculation.crisisNegativeSharePct}% negativa
                      </span>
                    </div>
                  </div>

                  {/* Clima Dinámico */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Evento Climático Dinámico</span>
                      <span className={`font-bold ${weatherSeverity.textClass}`}>
                        {state.activeWeatherEvent
                          ? `Activo (${speculation.activeWeatherTurnsLeft} turnos)`
                          : `${speculation.weatherTriggerChancePct}% · ${weatherSeverity.label}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${weatherSeverity.barClass}`}
                        style={{
                          width: `${
                            state.activeWeatherEvent
                              ? 100
                              : Math.min(100, speculation.weatherTriggerChancePct)
                          }%`
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                      <span>
                        {state.activeWeatherEvent
                          ? `${state.activeWeatherEvent.title} (${state.activeWeatherEvent.affectedTileIds.length} casillas)`
                          : `Cooldown ${speculation.weatherCooldownCurrent}/${speculation.weatherCooldownRequired} · Frec. ${Math.round(speculation.weatherFrequencyMultiplier * 100)}%`}
                      </span>
                    </div>
                  </div>
                </section>

                {/* 3. Riesgo inmediato de Trampas en próximo 1d6 */}
                <section className="border-t border-slate-800 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200">
                      Riesgo Próximo Dado ({economySummary.activePlayerName})
                    </h3>
                    <span className="text-[11px] text-slate-400">Tirada 1d6</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Tragedia Comunes</span>
                      <strong
                        className={
                          speculation.nextRollTragedyRiskPct > 0
                            ? 'text-rose-300'
                            : 'text-emerald-300'
                        }
                      >
                        {speculation.nextRollTragedyRiskPct}%
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Banco / Detención</span>
                      <strong
                        className={
                          speculation.nextRollBankOrDetentionRiskPct > 0
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }
                      >
                        {speculation.nextRollBankOrDetentionRiskPct}%
                      </strong>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'TILES' && (
              <>
                {/* Resumen por familia */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200">
                      Impacto Económico por Familia
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Coste / Retorno Común
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1 pr-2 font-semibold">Familia</th>
                          <th className="py-1 px-1.5 font-semibold text-right">C/P/Pr</th>
                          <th className="py-1 px-1.5 font-semibold text-right">Coste</th>
                          <th className="py-1 px-1.5 font-semibold text-right">Retorno</th>
                          <th className="py-1 pl-1.5 font-semibold text-right">Amort.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {familySummaries.map(fam => (
                          <tr key={fam.goodType} className="border-b border-slate-900">
                            <td className="py-1.5 pr-2 font-semibold text-slate-200">
                              {fam.label}
                            </td>
                            <td className="py-1.5 px-1.5 text-right text-slate-300">
                              {fam.commonCount}/{fam.publicCount}/{fam.privateCount}
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-bold text-amber-300">
                              {fam.avgUnlockCost}B
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-bold text-emerald-300">
                              +{fam.avgCommonWellnessYield}B/+{fam.avgCommonLegitimacyYield}L
                            </td>
                            <td className="py-1.5 pl-1.5 text-right text-slate-300">
                              {fam.avgPaybackVisits} vis.
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Filtros y búsqueda */}
                <section className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t.debug.searchTile}
                        aria-label={t.debug.searchTile}
                        className="w-full min-h-[38px] pl-8 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTileSort(prev =>
                          prev === 'IMPACT' ? 'COST_ASC' : prev === 'COST_ASC' ? 'THREAT' : 'IMPACT'
                        )
                      }
                      className="min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      {tileSort}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {(
                      [
                        { id: 'ALL', label: t.debug.allFilter },
                        { id: 'COMMON', label: t.hud.commonPlural },
                        { id: 'PUBLIC', label: t.hud.publicPlural },
                        { id: 'PRIVATE', label: t.hud.privatePlural },
                        { id: 'THREATENED', label: t.debug.threatenedFilter }
                      ] as const
                    ).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTileFilter(item.id)}
                        className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          tileFilter === item.id
                            ? 'bg-slate-200 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Lista de tiles */}
                <section className="space-y-1">
                  {filteredTileRows.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">
                      —
                    </div>
                  ) : (
                    filteredTileRows.map((row: CooperativeTileEconomyRow) => {
                      const isInalienable = row.category === 'INALIENABLE_COMMON';
                      return (
                        <button
                          key={row.tileId}
                          type="button"
                          onClick={() => onSelectTile?.(row.tileId)}
                          className="w-full text-left py-2 px-2 rounded-lg border-b border-slate-900 hover:bg-slate-900 transition-colors flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-semibold text-slate-100 truncate">
                                {row.name}
                              </span>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className={`font-semibold ${getStateTextClass(row.state, isInalienable)}`}>
                                {getStateLabel(row.state, isInalienable, t.common)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {isInalienable
                                ? `${t.common.inalienable} · +2B/+2L`
                                : `${t.setup.costLabel}: ${row.effectiveUnlockCost}B (${row.baseUnlockCost}${row.crisisCostDelta ? `, ${formatSignedScore(row.crisisCostDelta)}` : ''}${row.weatherCostDelta ? `, ${formatSignedScore(row.weatherCostDelta)}` : ''}${row.reputationCostDelta ? `, ${formatSignedScore(row.reputationCostDelta)}` : ''})`}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-bold text-emerald-300">
                              {row.currentWellnessYield > 0 || row.currentLegitimacyYield > 0
                                ? `+${row.currentWellnessYield}B/+${row.currentLegitimacyYield}L`
                                : `→ +${row.projectedCommonWellness}B/+${row.projectedCommonLegitimacy}L`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {row.netEconomicImpact}
                              {row.speculatorThreatPct > 0
                                ? ` · ${row.speculatorThreatPct}%`
                                : !isInalienable
                                ? ` · ${row.paybackVisits}v`
                                : ''}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </section>
              </>
            )}

            {activeTab === 'BALANCE' && (
              <>
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                      <span>{t.debug.macroBalanceTitle}</span>
                    </h3>
                    <span className="text-teal-300 font-bold">
                      {economySummary.efficiencyPct}% · {economySummary.tierLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] border-t border-slate-800 pt-2.5">
                    <div>
                      <div className="text-slate-400">{t.debug.boardRecovery}</div>
                      <div className="text-sm font-black text-emerald-300">
                        {economySummary.boardRecoveryPct}%
                      </div>
                      <div className="text-slate-400">
                        {economySummary.commonCount} · {economySummary.publicCount} · {economySummary.privateCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">{t.debug.agoraGoal}</div>
                      <div className="text-sm font-black text-amber-300">
                        {economySummary.totalLegitimacy} / {economySummary.requiredLegitimacy} ({economySummary.legitimacyProgressPct}%)
                      </div>
                      <div className="text-slate-400">
                        {t.debug.teamSynergy}: {economySummary.teamSynergyPct}%
                      </div>
                    </div>
                  </div>
                </section>

                <section className="border-t border-slate-800 pt-3 space-y-2 text-[11px]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">{t.debug.avgUnlockCost}</span>
                      <strong className="text-amber-300">
                        {economySummary.avgTransformUnlockCost} {t.common.wellness}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">{t.debug.expectedCommonReturn}</span>
                      <strong className="text-emerald-300">
                        +{economySummary.expectedRoundCommonYield}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">{t.debug.expectedPublicReturn}</span>
                      <strong className="text-sky-300">
                        +{economySummary.expectedRoundPublicYield}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">{t.debug.avgTeamWellness}</span>
                      <strong className="text-slate-100">
                        {economySummary.avgPlayerWellness} {t.common.points}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">{t.debug.repModifier} ({economySummary.activePlayerName})</span>
                      <strong className="text-slate-100">
                        {formatSignedScore(economySummary.activePlayerRepDelta)} · {economySummary.activePlayerVoteWeight}x
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">{t.debug.alteredTiles}</span>
                      <strong className="text-slate-100">
                        {economySummary.crisisAffectedTilesCount} / {economySummary.weatherAffectedTilesCount}
                      </strong>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'SIMULATOR' && (
              <>
                {/* Sección Principal: Probability Sandbox Interactivo en Tiempo Real */}
                <section className="rounded-xl border border-sky-500/40 bg-slate-900/90 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isProbabilitySandboxEnabled
                              ? 'bg-sky-400'
                              : state.isSandboxSession
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          {isProbabilitySandboxEnabled
                            ? t.debug.probSandboxActive
                            : state.isSandboxSession
                            ? t.debug.sandboxActiveNoRank
                            : t.debug.realMatchSandboxOff}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {isProbabilitySandboxEnabled
                          ? t.debug.probSandboxDescOn
                          : t.debug.probSandboxDescOff}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canRestoreSandbox && onRestorePreSandbox && (
                        <button
                          type="button"
                          onClick={() => {
                            setLoadedReplayFrameIndex(null);
                            onRestorePreSandbox();
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-200 font-bold text-[11px] flex items-center gap-1 shrink-0"
                          title={t.debug.restoreReal}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.debug.restoreReal}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {onApplySandboxMutation && (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      {/* 1. Simulador Interactivo de Dado del Jugador */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                            <Dices className="w-3.5 h-3.5 shrink-0" />
                            <span>{t.debug.diceSimTitle}</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {state.phase === 'PLAYER_TURN_READY' ? t.debug.phaseReady : state.phase}
                          </span>
                        </div>

                        {/* Perfil probabilístico del dado */}
                        <div className="grid grid-cols-4 gap-1">
                          {(
                            [
                              { id: 'FAIR', label: t.debug.diceFair },
                              { id: 'LOW_BIASED', label: t.debug.diceLow },
                              { id: 'HIGH_BIASED', label: t.debug.diceHigh },
                              { id: 'FORCED', label: t.debug.diceForced }
                            ] as Array<{ id: SandboxDiceProfile; label: string }>
                          ).map(profile => {
                            const selected =
                              isProbabilitySandboxEnabled &&
                              sandboxConfig.playerDiceProfile === profile.id;
                            return (
                              <button
                                key={profile.id}
                                type="button"
                                onClick={() =>
                                  onApplySandboxMutation({
                                    type: 'UPDATE_PROBABILITY_SANDBOX',
                                    patch: { playerDiceProfile: profile.id }
                                  })
                                }
                                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                  selected
                                    ? 'bg-sky-400 text-slate-950 border-sky-300'
                                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                {profile.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Distribución viva de probabilidad por cara 1..6 + Ejecución directa */}
                        <div className="grid grid-cols-6 gap-1">
                          {[1, 2, 3, 4, 5, 6].map((face, idx) => {
                            const pct = Math.round((playerDiceDistribution[idx] ?? 0) * 100);
                            const isForcedSelected =
                              isProbabilitySandboxEnabled &&
                              sandboxConfig.playerDiceProfile === 'FORCED' &&
                              sandboxConfig.forcedPlayerDice === face;
                            const canRollNow = state.phase === 'PLAYER_TURN_READY';
                            return (
                              <button
                                key={face}
                                type="button"
                                onClick={() => {
                                  onApplySandboxMutation({
                                    type: 'UPDATE_PROBABILITY_SANDBOX',
                                    patch: {
                                      playerDiceProfile: 'FORCED',
                                      forcedPlayerDice: face
                                    }
                                  });
                                  if (canRollNow && onSimulateDiceRoll) {
                                    onSimulateDiceRoll(face);
                                  }
                                }}
                                title={
                                  canRollNow
                                    ? `Fijar y lanzar tirada real ${face} ahora en el tablero 3D`
                                    : `Fijar próximo dado a ${face} (resuelve el paso actual para tirar)`
                                }
                                className={`py-1.5 rounded-lg border flex flex-col items-center justify-center transition-colors ${
                                  isForcedSelected
                                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                                    : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                <span className="text-xs font-black leading-none">{face}</span>
                                <span
                                  className={`text-[9px] mt-0.5 ${
                                    isForcedSelected ? 'text-slate-900 font-bold' : 'text-slate-400'
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {onSimulateDiceRoll && (
                          <button
                            type="button"
                            disabled={state.phase !== 'PLAYER_TURN_READY'}
                            onClick={() => onSimulateDiceRoll()}
                            className={`w-full min-h-[36px] px-3 rounded-lg font-black text-[11px] flex items-center justify-center gap-1.5 transition-colors ${
                              state.phase === 'PLAYER_TURN_READY'
                                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>
                              {state.phase === 'PLAYER_TURN_READY'
                                ? `${t.debug.executeRoll} (${
                                    sandboxConfig.playerDiceProfile === 'FORCED'
                                      ? `${sandboxConfig.forcedPlayerDice}`
                                      : sandboxConfig.playerDiceProfile === 'LOW_BIASED'
                                      ? t.debug.diceLow
                                      : sandboxConfig.playerDiceProfile === 'HIGH_BIASED'
                                      ? t.debug.diceHigh
                                      : '1d6'
                                  })`
                                : t.debug.resolveTurnFirst}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* 2. Simulador de Lógica de Movimiento de Especuladores */}
                      <div className="space-y-2 pt-2.5 border-t border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                            <Route className="w-3.5 h-3.5 shrink-0" />
                            <span>{t.debug.specLogicTitle}</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {state.speculators.length} {t.debug.botsCount}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'STANDARD_1D6', label: t.debug.logicStandard },
                              { id: 'CHASE_NEAREST', label: t.debug.logicChase },
                              { id: 'AGGRESSIVE_MAX', label: t.debug.logicAggressive },
                              { id: 'FROZEN', label: t.debug.logicFrozen }
                            ] as Array<{ id: SandboxSpeculatorMovementLogic; label: string }>
                          ).map(mode => {
                            const selected =
                              isProbabilitySandboxEnabled &&
                              sandboxConfig.speculatorMovementLogic === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() =>
                                  onApplySandboxMutation({
                                    type: 'UPDATE_PROBABILITY_SANDBOX',
                                    patch: { speculatorMovementLogic: mode.id }
                                  })
                                }
                                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border text-left transition-colors ${
                                  selected
                                    ? 'bg-rose-500 text-white border-rose-400'
                                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Dado fijo de especuladores */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {t.debug.botsDiceLabel}
                          </span>
                          <div className="flex items-center gap-1 flex-1 justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                onApplySandboxMutation({
                                  type: 'UPDATE_PROBABILITY_SANDBOX',
                                  patch: { forcedSpeculatorDice: null }
                                })
                              }
                              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                !isProbabilitySandboxEnabled ||
                                sandboxConfig.forcedSpeculatorDice === null
                                  ? 'bg-teal-400 text-slate-950 border-teal-300'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              {t.common.auto}
                            </button>
                            {[1, 2, 3, 4, 5, 6].map(step => (
                              <button
                                key={step}
                                type="button"
                                onClick={() =>
                                  onApplySandboxMutation({
                                    type: 'UPDATE_PROBABILITY_SANDBOX',
                                    patch: { forcedSpeculatorDice: step }
                                  })
                                }
                                className={`w-6 py-1 rounded text-[10px] font-bold border ${
                                  isProbabilitySandboxEnabled &&
                                  sandboxConfig.forcedSpeculatorDice === step
                                    ? 'bg-rose-500 text-white border-rose-400'
                                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                {step}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tasa de Detención al Impactar */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {t.debug.detentionLabel}
                          </span>
                          <div className="flex items-center gap-1 flex-1 justify-end">
                            {[
                              { label: t.common.auto, val: null },
                              { label: '0%', val: 0 },
                              { label: '25%', val: 25 },
                              { label: '50%', val: 50 },
                              { label: '100%', val: 100 }
                            ].map(opt => {
                              const active =
                                opt.val === null
                                  ? !isProbabilitySandboxEnabled ||
                                    sandboxConfig.detentionChanceOverridePct === null
                                  : isProbabilitySandboxEnabled &&
                                    sandboxConfig.detentionChanceOverridePct === opt.val;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() =>
                                    onApplySandboxMutation({
                                      type: 'UPDATE_PROBABILITY_SANDBOX',
                                      patch: { detentionChanceOverridePct: opt.val }
                                    })
                                  }
                                  className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                    active
                                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Ajuste manual posicional por bot especulador */}
                        <div className="space-y-1">
                          {state.speculators.map((spec, idx) => (
                            <div
                              key={spec.id}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px]"
                            >
                              <span className="truncate text-slate-200 font-semibold">
                                Bot #{idx + 1} · Casilla #{spec.position}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onApplySandboxMutation({
                                      type: 'MOVE_SPECULATOR',
                                      speculatorId: spec.id,
                                      deltaSteps: -1
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
                                  title="Retroceder especulador 1 casilla"
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onApplySandboxMutation({
                                      type: 'MOVE_SPECULATOR',
                                      speculatorId: spec.id,
                                      deltaSteps: 1
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
                                  title="Avanzar especulador 1 casilla"
                                >
                                  +1
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {onSimulateSpeculatorsTurn && (
                          <button
                            type="button"
                            disabled={state.phase === 'DICE_ROLLING' || state.phase === 'GAME_OVER'}
                            onClick={onSimulateSpeculatorsTurn}
                            className={`w-full min-h-[36px] px-3 rounded-lg font-black text-[11px] flex items-center justify-center gap-1.5 transition-colors ${
                              state.phase !== 'DICE_ROLLING' && state.phase !== 'GAME_OVER'
                                ? 'bg-rose-500 hover:bg-rose-400 text-white'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{t.debug.executeSpecWave}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {/* Cargar Estado Previo desde Historial (ReplayFrames) */}
                {onApplySandboxMutation && (
                  <section className="border-t border-slate-800 pt-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 shrink-0" />
                          <span>{t.debug.replayLoaderTitle ?? 'Cargar Estado Previo (ReplayFrames)'}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {t.debug.replayLoaderDesc ??
                            'Restaura un fotograma del historial en el Sandbox para reproducir y balancear momentos críticos de especulación.'}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                        {replayFramesMeta.orderedNewestFirst.length} frames
                      </span>
                    </div>

                    {replayFramesMeta.orderedNewestFirst.length === 0 ? (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                        {t.debug.replayLoaderEmpty ??
                          'Aún no hay fotogramas registrados en el historial de esta partida.'}
                      </div>
                    ) : (
                      <>
                        {/* Accesos rápidos a escenarios clave */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {replayFramesMeta.mostCritical && (
                            <button
                              type="button"
                              onClick={() => {
                                const idx = replayFramesMeta.mostCritical!.frame.frameIndex;
                                setLoadedReplayFrameIndex(idx);
                                onApplySandboxMutation({
                                  type: 'LOAD_REPLAY_FRAME',
                                  frameIndex: idx
                                });
                              }}
                              className="py-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/60 text-rose-200 font-bold flex items-center justify-between gap-1"
                            >
                              <span className="truncate">
                                {t.debug.replayMostCriticalBtn ?? 'Más Crítico'}
                              </span>
                              <span className="font-mono shrink-0">
                                #{replayFramesMeta.mostCritical.frame.frameIndex} · R
                                {replayFramesMeta.mostCritical.frame.round}
                              </span>
                            </button>
                          )}
                          {replayFramesMeta.latest && (
                            <button
                              type="button"
                              onClick={() => {
                                const idx = replayFramesMeta.latest!.frame.frameIndex;
                                setLoadedReplayFrameIndex(idx);
                                onApplySandboxMutation({
                                  type: 'LOAD_REPLAY_FRAME',
                                  frameIndex: idx
                                });
                              }}
                              className="py-1.5 px-2 rounded-lg bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/60 text-sky-200 font-bold flex items-center justify-between gap-1"
                            >
                              <span className="truncate">
                                {t.debug.replayLatestBtn ?? 'Último Frame'}
                              </span>
                              <span className="font-mono shrink-0">
                                #{replayFramesMeta.latest.frame.frameIndex} · R
                                {replayFramesMeta.latest.frame.round}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Lista seleccionable de ReplayFrames */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {replayFramesMeta.orderedNewestFirst.map(
                            ({ frame, privateDelta, isCritical }) => {
                              const isLoaded = loadedReplayFrameIndex === frame.frameIndex;
                              return (
                                <div
                                  key={frame.frameIndex}
                                  className={`p-2 rounded-xl border text-[10px] space-y-1 transition-colors ${
                                    isLoaded
                                      ? 'bg-amber-950/40 border-amber-500/70'
                                      : isCritical
                                      ? 'bg-rose-950/25 border-rose-800/50'
                                      : 'bg-slate-900/80 border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-950 text-amber-300 font-mono font-bold shrink-0">
                                        #{frame.frameIndex} · R{frame.round}
                                      </span>
                                      <span className="font-bold text-white truncate">
                                        {frame.actorName}
                                      </span>
                                      {isCritical && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold shrink-0">
                                          {t.debug.replayCriticalTag ?? 'Crítico'}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLoadedReplayFrameIndex(frame.frameIndex);
                                        onApplySandboxMutation({
                                          type: 'LOAD_REPLAY_FRAME',
                                          frameIndex: frame.frameIndex
                                        });
                                      }}
                                      className={`px-2 py-1 rounded-md font-bold shrink-0 transition-colors ${
                                        isLoaded
                                          ? 'bg-amber-400 text-slate-950'
                                          : 'bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-100'
                                      }`}
                                    >
                                      {isLoaded
                                        ? t.debug.replayLoadedBadge ?? 'Cargado'
                                        : t.debug.replayLoadBtn ?? 'Cargar'}
                                    </button>
                                  </div>

                                  <p className="text-slate-300 leading-snug line-clamp-2">
                                    {frame.eventSummary}
                                  </p>

                                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 tabular-nums">
                                    <span>
                                      {t.common.common}: {frame.commonCount} · {t.common.public}:{' '}
                                      {frame.publicCount} · {t.common.private}: {frame.privateCount}
                                      {privateDelta > 0 ? ` (+${privateDelta})` : ''}
                                    </span>
                                    <span>
                                      {frame.speculators.length} {t.debug.botsCount}
                                      {frame.activeCrisisTitle ? ` · ${frame.activeCrisisTitle}` : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {/* Simulador Probabilístico Monte Carlo */}
                <section className="border-t border-slate-800 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-200">
                      {t.debug.monteCarloTitle} {isProbabilitySandboxEnabled ? t.debug.withSandbox : t.debug.fromCurrentState}
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      {t.hud.roundLabel} {state.round}/20
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      {[100, 200, 500].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSimIterations(n)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            simIterations === n
                              ? 'bg-sky-400 text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      {[
                        { label: '+5R', val: 5 },
                        { label: 'R20', val: 20 }
                      ].map(h => (
                        <button
                          key={h.val}
                          type="button"
                          onClick={() => setSimHorizonRounds(h.val)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            simHorizonRounds === h.val
                              ? 'bg-teal-400 text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      className="flex-1 min-h-[36px] px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t.debug.simulateBtn} ({simIterations})</span>
                    </button>
                  </div>

                  {simResult && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-slate-950 border border-emerald-900/50">
                          <div className="text-[10px] text-slate-400">{t.debug.victoryLbl}</div>
                          <div className="text-base font-black text-emerald-300">
                            {simResult.victoryPct}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-sky-900/50">
                          <div className="text-[10px] text-slate-400">{t.debug.drawLbl}</div>
                          <div className="text-base font-black text-sky-300">
                            {simResult.drawPct}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-rose-900/50">
                          <div className="text-[10px] text-slate-400">{t.debug.defeatLbl}</div>
                          <div className="text-base font-black text-rose-300">
                            {simResult.defeatPct}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.avgEfficiency}</span>
                          <strong className="text-teal-300">{simResult.avgFinalEfficiencyPct}%</strong>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.avgEndRound}</span>
                          <strong className="text-white">{simResult.avgFinalRound}/20</strong>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.finalCommons}</span>
                          <strong className="text-emerald-300">{simResult.avgFinalCommonCount}</strong>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.finalPrivates}</span>
                          <strong className="text-rose-300">{simResult.avgFinalPrivateCount}</strong>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.detentionsPerSim}</span>
                          <strong className="text-amber-300">{simResult.avgDetentionsPerMatch}</strong>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-slate-800/70">
                          <span className="text-slate-400">{t.debug.wellnessFlow}</span>
                          <strong className="text-slate-100">
                            {simResult.expectedRoundWellnessDelta >= 0
                              ? `+${simResult.expectedRoundWellnessDelta}`
                              : simResult.expectedRoundWellnessDelta}
                          </strong>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>
                          {simResult.iterations}x · {simResult.horizonRounds}R
                        </span>
                        <span>{simResult.durationMs} ms</span>
                      </div>
                    </div>
                  )}
                </section>

                {/* Sandbox en Vivo */}
                {onApplySandboxMutation && (
                  <section className="border-t border-slate-800 pt-3 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-200">
                      {t.debug.liveMutationsTitle}
                    </h3>

                    {/* Ronda y Especuladores */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{t.debug.currentRound}</span>
                          <strong className="text-white">{state.round}/20</strong>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onApplySandboxMutation({ type: 'SET_ROUND', round: state.round - 1 })
                            }
                            className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 font-bold text-[11px]"
                          >
                            -1R
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onApplySandboxMutation({ type: 'SET_ROUND', round: state.round + 1 })
                            }
                            className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 font-bold text-[11px]"
                          >
                            +1R
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{t.debug.speculatorsLbl}</span>
                          <strong className="text-rose-300">{state.speculators.length}</strong>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map(cnt => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() =>
                                onApplySandboxMutation({ type: 'SET_SPECULATORS_COUNT', count: cnt })
                              }
                              className={`flex-1 py-1 rounded text-[11px] font-bold ${
                                state.speculators.length === cnt
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Recursos del Jugador Activo */}
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{t.debug.activePlayerLbl} ({economySummary.activePlayerName})</span>
                        <span className="text-slate-200 font-semibold">
                          {state.players[state.activePlayerIndex]?.wellness ?? 0}B ·{' '}
                          {state.players[state.activePlayerIndex]?.legitimacy ?? 0}L
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'ADJUST_ACTIVE_PLAYER', wellnessDelta: 3 })
                          }
                          className="py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/50 text-emerald-200 font-bold text-[11px]"
                        >
                          +3B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'ADJUST_ACTIVE_PLAYER', wellnessDelta: -3 })
                          }
                          className="py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/50 text-rose-200 font-bold text-[11px]"
                        >
                          -3B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'ADJUST_ACTIVE_PLAYER', legitimacyDelta: 3 })
                          }
                          className="py-1 rounded bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/50 text-sky-200 font-bold text-[11px]"
                        >
                          +3L
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'ADJUST_ACTIVE_PLAYER', legitimacyDelta: -3 })
                          }
                          className="py-1 rounded bg-amber-950/60 hover:bg-amber-900/70 border border-amber-700/50 text-amber-200 font-bold text-[11px]"
                        >
                          -3L
                        </button>
                      </div>
                    </div>

                    {/* Dificultad + Crisis + Clima */}
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'MAD_MAX', label: t.setup.diffMadMax },
                          { id: 'EN_TRANSICION', label: t.setup.diffTransition },
                          { id: 'COMUNLANDIA', label: t.setup.diffComunlandia }
                        ] as Array<{ id: DifficultyLevel; label: string }>
                      ).map(diff => (
                        <button
                          key={diff.id}
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'SET_DIFFICULTY', difficulty: diff.id })
                          }
                          className={`py-1.5 rounded-lg text-[10px] font-bold border ${
                            speculation.difficulty === diff.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {diff.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({
                              type: 'TRIGGER_CRISIS',
                              templateId: 'crisis_market_inflation'
                            })
                          }
                          className="flex-1 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 font-semibold"
                        >
                          {t.debug.injectCrisis}
                        </button>
                        {state.activeCrisis && (
                          <button
                            type="button"
                            onClick={() => onApplySandboxMutation({ type: 'CLEAR_CRISIS' })}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                            title={t.common.reset}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'TRIGGER_WEATHER', kind: 'DROUGHT' })
                          }
                          className="flex-1 py-1.5 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 text-sky-200 font-semibold"
                        >
                          {t.debug.activeDrought}
                        </button>
                        {state.activeWeatherEvent && (
                          <button
                            type="button"
                            onClick={() => onApplySandboxMutation({ type: 'CLEAR_WEATHER' })}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                            title={t.common.reset}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mutar casilla actual del jugador */}
                    {(() => {
                      const activeTileId = state.players[state.activePlayerIndex]?.position;
                      const tile = state.tiles.find(t => t.id === activeTileId);
                      const isMutable =
                        tile && (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY');
                      if (!isMutable || !tile) return null;
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            onApplySandboxMutation({ type: 'CYCLE_TILE_STATE', tileId: tile.id })
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-teal-200 flex items-center justify-between"
                        >
                          <span className="truncate">{t.debug.rotateTile}: {tile.name}</span>
                          <span className="font-mono font-bold shrink-0">{tile.state}</span>
                        </button>
                      );
                    })()}
                  </section>
                )}
              </>
            )}

            {activeTab === 'LOG' && (
              <section className="space-y-3">
                {/* Selector entre Log en Tiempo Real de Especuladores y Log General */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setLogSubMode('SPECULATORS')}
                    className={`py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                      logSubMode === 'SPECULATORS'
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t.debug.specLogTabSpeculators ?? 'Especuladores'} ({speculatorActionLogs.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogSubMode('GENERAL')}
                    className={`py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                      logSubMode === 'GENERAL'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t.debug.specLogTabGeneral ?? 'Log General'} ({state.logs.length})
                    </span>
                  </button>
                </div>

                {logSubMode === 'SPECULATORS' ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{t.debug.specLogTitle ?? 'Log en Tiempo Real · Especuladores'}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {t.debug.specLogSubtitle ??
                          'Registra compras, vandalismo y ataques de cada bot para anticipar sus próximos objetivos en rango 1d6.'}
                      </p>
                    </div>

                    {/* Panel predictivo por especulador basado en historial + rango 1d6 */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Crosshair className="w-3 h-3 shrink-0" />
                        <span>{t.debug.specLogPredictTitle ?? 'Predicción de Próximos Ataques y Casillas en Riesgo'}</span>
                      </div>

                      <div className="space-y-1.5">
                        {speculation.speculatorThreats.map(threat => {
                          const counts = speculatorActionCounts[threat.speculatorId] ?? {
                            buys: 0,
                            vandals: 0,
                            attacks: 0,
                            blocked: 0
                          };
                          const targetMeta = getIntendedTargetLabel(threat.intendedTarget);
                          const topTileRisk = threat.predictedTileRisks[0];
                          return (
                            <div
                              key={threat.speculatorId}
                              className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 text-[10px] space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-100 truncate">
                                  #{threat.orderIndex} · {threat.speculatorName}
                                </span>
                                <span className="text-slate-400 tabular-nums shrink-0">
                                  {counts.buys} {t.debug.specLogStatsBuys ?? 'compras'} · {counts.vandals}{' '}
                                  {t.debug.specLogStatsVandals ?? 'vandal.'} · {counts.attacks}{' '}
                                  {t.debug.specLogStatsAttacks ?? 'ataques'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => onSelectTile?.(threat.intendedTarget.tileId)}
                                  className={`font-semibold hover:underline text-left truncate ${targetMeta.toneClass}`}
                                >
                                  → #{threat.intendedTarget.tileId} {threat.intendedTarget.tileName}: {targetMeta.tag}
                                </button>
                                {topTileRisk && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectTile?.(topTileRisk.tileId)}
                                    className={`px-1.5 py-0.5 rounded border font-bold shrink-0 ${
                                      topTileRisk.riskAction === 'BUY'
                                        ? 'bg-rose-950/60 border-rose-700/60 text-rose-200'
                                        : 'bg-amber-950/60 border-amber-700/60 text-amber-200'
                                    }`}
                                  >
                                    +{topTileRisk.distance} #{topTileRisk.tileId}{' '}
                                    {topTileRisk.riskAction === 'BUY'
                                      ? t.debug.specLogKindBuy ?? 'COMPRA'
                                      : t.debug.specLogKindVandal ?? 'VANDALISMO'}{' '}
                                    {topTileRisk.actionChancePct}%
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filtros por tipo de acción y por bot */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold">
                        {(
                          [
                            { id: 'ALL', label: t.debug.specLogFilterAll ?? 'Todo' },
                            { id: 'BUY', label: t.debug.specLogFilterBuy ?? 'Compras' },
                            { id: 'VANDALIZE', label: t.debug.specLogFilterVandal ?? 'Vandalismo' },
                            { id: 'ATTACK', label: t.debug.specLogFilterAttack ?? 'Ataques' },
                            { id: 'MOVE', label: t.debug.specLogFilterMove ?? 'Mov./Bloq.' }
                          ] as Array<{ id: SpecActionFilter; label: string }>
                        ).map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setSpecActionFilter(f.id)}
                            className={`py-1.5 px-1 rounded-lg border text-center transition-colors truncate ${
                              specActionFilter === f.id
                                ? 'bg-rose-500 text-white border-rose-400 font-bold'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {state.speculators.length > 1 && (
                        <div className="flex items-center gap-1 flex-wrap text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSpecBotFilter('ALL')}
                            className={`px-2 py-1 rounded-md border font-bold ${
                              specBotFilter === 'ALL'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {t.debug.allFilter} ({speculatorActionLogs.length})
                          </button>
                          {state.speculators.map((spec, idx) => (
                            <button
                              key={spec.id}
                              type="button"
                              onClick={() => setSpecBotFilter(spec.id)}
                              className={`px-2 py-1 rounded-md border font-bold flex items-center gap-1 ${
                                specBotFilter === spec.id
                                  ? 'bg-slate-100 text-slate-950 border-white'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: spec.color }}
                              />
                              <span>Bot #{idx + 1}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Buscador */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={eventLogSearch}
                        onChange={e => setEventLogSearch(e.target.value)}
                        placeholder={t.common.searchPlaceholder ?? 'Buscar casilla, bot o acción...'}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                      {eventLogSearch && (
                        <button
                          type="button"
                          onClick={() => setEventLogSearch('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Feed en tiempo real de acciones de especuladores */}
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {filteredSpecActionLogs.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          {t.debug.specLogEmpty ?? 'Aún no hay movimientos registrados de especuladores en esta partida.'}
                        </div>
                      ) : (
                        filteredSpecActionLogs.map((entry: SpeculatorActionLogEntry) => {
                          const badge = getSpecActionBadgeMeta(entry.kind, t.debug);
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => onSelectTile?.(entry.toTileId)}
                              className={`w-full text-left p-2.5 rounded-xl border text-[11px] space-y-1 transition-colors hover:brightness-110 ${badge.cardClass}`}
                              title={`Inspeccionar casilla #${entry.toTileId} (${entry.tileName}) en el tablero 3D`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 font-bold">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/75 text-[10px] text-amber-300 shrink-0">
                                    R{entry.round}
                                  </span>
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: entry.speculatorColor }}
                                  />
                                  <span className="truncate text-white">{entry.speculatorName}</span>
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black shrink-0 ${badge.badgeClass}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                  +{entry.diceRoll} · {entry.timestamp}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                                <span className="font-mono">
                                  #{entry.fromTileId} → #{entry.toTileId} · {entry.tileName}
                                </span>
                                {entry.previousTileState && entry.nextTileState && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[9px] font-bold text-slate-200 shrink-0">
                                    {entry.previousTileState} → {entry.nextTileState}
                                  </span>
                                )}
                              </div>

                              <p className="leading-snug text-slate-200 font-normal">
                                {entry.details}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t.debug.tabLog ?? 'Event Log'} ({filteredLogs.length})</span>
                      </h3>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {state.logs.length} total
                      </div>
                    </div>

                    {/* Filtros de evento */}
                    <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold">
                      {(
                        [
                          { id: 'ALL', label: t.debug.filterAll ?? 'Todos' },
                          { id: 'SPECULATOR', label: t.debug.filterSpeculator ?? 'Especuladores' },
                          { id: 'TILES', label: t.debug.filterTiles ?? 'Casillas' },
                          { id: 'GLOBAL', label: t.debug.filterGlobal ?? 'Globales' },
                          { id: 'ACTION', label: t.debug.filterAction ?? 'Acciones' }
                        ] as Array<{ id: EventLogFilter; label: string }>
                      ).map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setEventLogFilter(f.id)}
                          className={`py-1.5 px-1 rounded-lg border text-center transition-colors truncate ${
                            eventLogFilter === f.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                          title={f.label}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Buscador de logs */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={eventLogSearch}
                        onChange={e => setEventLogSearch(e.target.value)}
                        placeholder={t.common.searchPlaceholder ?? 'Buscar evento...'}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      {eventLogSearch && (
                        <button
                          type="button"
                          onClick={() => setEventLogSearch('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Lista de logs */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredLogs.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          {t.common.error ?? 'No hay eventos coincidentes.'}
                        </div>
                      ) : (
                        filteredLogs.map(log => {
                          const typeColor =
                            log.type === 'HAZARD'
                              ? 'bg-rose-950/60 border-rose-800/60 text-rose-200'
                              : log.type === 'SUCCESS'
                              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
                              : log.type === 'CARD'
                              ? 'bg-purple-950/60 border-purple-800/60 text-purple-200'
                              : log.type === 'ACTION'
                              ? 'bg-sky-950/60 border-sky-800/60 text-sky-200'
                              : 'bg-slate-900 border-slate-800 text-slate-300';

                          return (
                            <div
                              key={log.id}
                              className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${typeColor}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/70 text-[10px] text-amber-300">
                                    R{log.round}
                                  </span>
                                  <span className="truncate">{log.actor}</span>
                                </div>
                                <span className="text-[10px] opacity-75 shrink-0 tabular-nums">
                                  {log.timestamp}
                                </span>
                              </div>
                              <p className="leading-snug text-slate-200 font-normal">
                                {log.message}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'BOTS' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t.debug.botControllerTitle ?? 'Controlador de Bots'}</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 tabular-nums">
                    {state.speculators.length} {t.debug.speculatorsLbl}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">
                  {t.debug.botControllerDesc ?? 'Ajusta en tiempo real la agresividad, radio de influencia y umbral de decisión para cada especulador.'}
                </p>

                {/* Presets rápidos + Restauración Oficial ZEMOS98 */}
                <div className="space-y-1.5 text-[10px]">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        state.speculators.forEach(spec => {
                          handleUpdateBotBehavior(spec.id, { aggressivenessPct: 15, influenceRadius: 4, decisionThreshold: 5 });
                        });
                      }}
                      className="py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-200 font-bold"
                    >
                      {t.debug.presetPacifist ?? 'Pacifistas (15%)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        state.speculators.forEach(spec => {
                          handleUpdateBotBehavior(spec.id, { aggressivenessPct: 50, influenceRadius: 8, decisionThreshold: 3 });
                        });
                      }}
                      className="py-1.5 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 text-sky-200 font-bold"
                    >
                      {t.debug.presetBalanced ?? 'Equilibrados (50%)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        state.speculators.forEach(spec => {
                          handleUpdateBotBehavior(spec.id, { aggressivenessPct: 100, influenceRadius: 12, decisionThreshold: 1 });
                        });
                      }}
                      className="py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 font-bold"
                    >
                      {t.debug.presetPredator ?? 'Depredadores (100%)'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onApplySandboxMutation) return;
                      onApplySandboxMutation({
                        type: 'UPDATE_PROBABILITY_SANDBOX',
                        patch: {
                          playerDiceProfile: 'FAIR',
                          forcedPlayerDice: 4,
                          speculatorMovementLogic: 'STANDARD_1D6',
                          forcedSpeculatorDice: null,
                          detentionChanceOverridePct: null,
                          speculatorBehaviors: {}
                        }
                      });
                      onApplySandboxMutation({
                        type: 'TOGGLE_PROBABILITY_SANDBOX',
                        enabled: false
                      });
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-teal-700/60 text-teal-200 font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>{t.debug.restoreOfficialValues ?? 'Restaurar Valores Oficiales (ZEMOS98)'}</span>
                  </button>
                </div>

                {/* Tarjetas por especulador */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {state.speculators.map(spec => {
                    const sandboxConfig = state.probabilitySandbox ?? DEFAULT_PROBABILITY_SANDBOX_CONFIG;
                    const behavior = sandboxConfig.speculatorBehaviors?.[spec.id] ?? {
                      speculatorId: spec.id,
                      aggressivenessPct: 50,
                      influenceRadius: 12,
                      decisionThreshold: 3
                    };
                    const tile = state.tiles.find(t => t.id === spec.position);

                    return (
                      <div
                        key={spec.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow"
                              style={{ backgroundColor: spec.color }}
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">
                                #{spec.id} · {spec.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate">
                                Casilla #{spec.position} ({tile?.name ?? 'Casilla'})
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateBotBehavior(spec.id, {
                                aggressivenessPct: 50,
                                influenceRadius: 12,
                                decisionThreshold: 3
                              })
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-semibold"
                            title={t.common.reset}
                          >
                            Reset
                          </button>
                        </div>

                        {/* Slider Agresividad */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-medium">
                              {t.debug.aggressiveness ?? 'Agresividad'}
                            </span>
                            <span className="font-bold text-rose-300 tabular-nums">
                              {behavior.aggressivenessPct}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={behavior.aggressivenessPct}
                            onChange={e =>
                              handleUpdateBotBehavior(spec.id, {
                                aggressivenessPct: Number(e.target.value)
                              })
                            }
                            className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Slider Radio de Influencia */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-medium">
                              {t.debug.influenceRadius ?? 'Radio de Influencia'}
                            </span>
                            <span className="font-bold text-amber-300 tabular-nums">
                              {behavior.influenceRadius} casillas
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="12"
                            step="1"
                            value={behavior.influenceRadius}
                            onChange={e =>
                              handleUpdateBotBehavior(spec.id, {
                                influenceRadius: Number(e.target.value)
                              })
                            }
                            className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Slider Umbral de Decisión */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-medium">
                              {t.debug.decisionThreshold ?? 'Umbral de Decisión'}
                            </span>
                            <span className="font-bold text-sky-300 tabular-nums">
                              +{behavior.decisionThreshold} pasos
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="6"
                            step="1"
                            value={behavior.decisionThreshold}
                            onChange={e =>
                              handleUpdateBotBehavior(spec.id, {
                                decisionThreshold: Number(e.target.value)
                              })
                            }
                            className="w-full accent-sky-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
