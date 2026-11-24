/**
 * CollectiveImpactHUD.tsx
 * Panel analítico en tiempo real ("Collective Impact") integrado en GameOverlayHUD.
 * Calcula y visualiza mediante Recharts la eficiencia combinada del equipo
 * preservando los bienes comunes frente a la presión privatizadora de los especuladores.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { BarChart3, Shield, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { GameEngineState, GoodType } from '../../types/game';
import { playSound } from '../../utils/audio';
import { HudPanelMotion } from '../ui/MotionPrimitives';

interface CollectiveImpactHUDProps {
  isOpen: boolean;
  state: GameEngineState;
  onClose: () => void;
}

type ImpactTab = 'efficiency' | 'sectors';

interface EfficiencyPoint {
  label: string;
  round: number;
  actorName: string;
  eventSummary?: string;
  teamEfficiencyPct: number;
  commonsPurePct: number;
  speculatorCapturePct: number;
  commonCount: number;
  publicCount: number;
  privateCount: number;
}

interface SectorPoint {
  sector: string;
  common: number;
  publicCount: number;
  privateCount: number;
  preservationPct: number;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: EfficiencyPoint | SectorPoint;
}

const ImpactChartTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
  mode: ImpactTab;
}> = ({ active, payload, label, mode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const firstPayload = payload[0]?.payload;

  return (
    <div className="bg-slate-950/95 border border-slate-700 rounded-xl px-3 py-2.5 shadow-2xl text-[11px] text-slate-200 space-y-1.5 min-w-[11.5rem]">
      <div className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        {mode === 'efficiency' && firstPayload && 'round' in firstPayload && (
          <span className="text-[10px] text-slate-400 tabular-nums">R{firstPayload.round}</span>
        )}
      </div>

      {mode === 'efficiency' && firstPayload && 'actorName' in firstPayload && (
        <div className="text-[10px] text-slate-400">
          {firstPayload.actorName}
          {firstPayload.eventSummary ? ` · ${firstPayload.eventSummary}` : ''}
        </div>
      )}

      <div className="space-y-1 tabular-nums">
        {payload.map((entry, idx) => (
          <div key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{entry.name}</span>
            <span className="font-bold text-white">
              {entry.value}
              {mode === 'efficiency' ? '%' : ' casillas'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SECTOR_META: Array<{ key: GoodType; label: string }> = [
  { key: 'ENVIRONMENT', label: 'Medioambiente' },
  { key: 'HEALTH', label: 'Salud' },
  { key: 'URBAN', label: 'Urbano' },
  { key: 'KNOWLEDGE', label: 'Conocimiento' }
];

export const CollectiveImpactHUD: React.FC<CollectiveImpactHUDProps> = ({
  isOpen,
  state,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<ImpactTab>('efficiency');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const metrics = useMemo(() => {
    const resourceTiles = state.tiles.filter(
      t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
    );
    const total = resourceTiles.length || 1;
    const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
    const publicCount = resourceTiles.filter(t => t.state === 'PUBLIC').length;
    const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;

    // Eficiencia combinada del equipo: Comunes (100% peso) + Públicos en transición (35% peso)
    const teamEfficiencyPct = Math.min(
      100,
      Math.round(((commonCount + publicCount * 0.35) / total) * 100)
    );
    const commonsPurePct = Math.round((commonCount / total) * 100);
    const publicPct = Math.round((publicCount / total) * 100);
    const speculatorCapturePct = Math.round((privateCount / total) * 100);

    // Balance comparativo frente a los especuladores
    const netBalance = commonCount - privateCount;
    const comparativeRatio =
      privateCount > 0 ? Number((commonCount / privateCount).toFixed(2)) : commonCount;

    // Acciones del equipo frente a ofensivas especuladoras registradas
    const statsList = Object.values(state.playerStats ?? {});
    const totalUnlocks = statsList.reduce(
      (sum, s) => sum + s.commonsUnlocked + s.publicsUnlocked,
      0
    );
    const totalCoopActions = statsList.reduce((sum, s) => sum + s.cooperativeActions, 0);
    const totalTeamActions = totalUnlocks + totalCoopActions;

    const speculatorOffensives = state.logs.filter(
      log =>
        log.type === 'HAZARD' &&
        /especulador|privatiz|fondo|inmobiliari|tragedia/i.test(
          `${log.actor} ${log.message}`
        )
    ).length;

    const topContributor =
      statsList
        .slice()
        .sort(
          (a, b) =>
            b.commonsUnlocked +
            b.cooperativeActions -
            (a.commonsUnlocked + a.cooperativeActions)
        )[0] ?? null;

    // Serie temporal turno a turno para AreaChart
    const history = state.turnHistory ?? [];
    const baselineEfficiency =
      history.length > 0
        ? Math.min(
            100,
            Math.round(
              ((history[0].commonCount + history[0].publicCount * 0.35) /
                (history[0].totalResourceTiles || total)) *
                100
            )
          )
        : teamEfficiencyPct;

    const efficiencySeries: EfficiencyPoint[] =
      history.length > 0
        ? history.map(snap => {
            const snapTotal = snap.totalResourceTiles || total;
            return {
              label: snap.label,
              round: snap.round,
              actorName: snap.actorName,
              eventSummary: snap.eventSummary,
              teamEfficiencyPct: Math.min(
                100,
                Math.round(((snap.commonCount + snap.publicCount * 0.35) / snapTotal) * 100)
              ),
              commonsPurePct: Math.round((snap.commonCount / snapTotal) * 100),
              speculatorCapturePct: Math.round((snap.privateCount / snapTotal) * 100),
              commonCount: snap.commonCount,
              publicCount: snap.publicCount,
              privateCount: snap.privateCount
            };
          })
        : [
            {
              label: 'Actual',
              round: state.round,
              actorName: 'Estado actual',
              teamEfficiencyPct,
              commonsPurePct,
              speculatorCapturePct,
              commonCount,
              publicCount,
              privateCount
            }
          ];

    // Desglose por sector para BarChart
    const sectorSeries: SectorPoint[] = SECTOR_META.map(({ key, label }) => {
      const catTiles = resourceTiles.filter(t => t.goodType === key);
      const catTotal = catTiles.length || 1;
      const catCommon = catTiles.filter(t => t.state === 'COMMON').length;
      const catPublic = catTiles.filter(t => t.state === 'PUBLIC').length;
      const catPrivate = catTiles.filter(t => t.state === 'PRIVATE').length;
      return {
        sector: label,
        common: catCommon,
        publicCount: catPublic,
        privateCount: catPrivate,
        preservationPct: Math.round(((catCommon + catPublic * 0.35) / catTotal) * 100)
      };
    });

    const efficiencyDelta = teamEfficiencyPct - baselineEfficiency;

    return {
      total,
      commonCount,
      publicCount,
      privateCount,
      teamEfficiencyPct,
      commonsPurePct,
      publicPct,
      speculatorCapturePct,
      netBalance,
      comparativeRatio,
      totalTeamActions,
      speculatorOffensives,
      topContributor,
      efficiencySeries,
      sectorSeries,
      efficiencyDelta
    };
  }, [state.tiles, state.turnHistory, state.playerStats, state.logs, state.round]);

  const isTeamAhead = metrics.teamEfficiencyPct >= metrics.speculatorCapturePct;

  return (
    <AnimatePresence>
      {isOpen && (
        <HudPanelMotion
          as="section"
          direction="right"
          onSwipeDismiss={() => {
            playSound.modalClose();
            onClose();
          }}
          ariaLabel="Collective Impact - Eficiencia del Equipo vs Especuladores"
          className="pointer-events-auto fixed inset-x-0 bottom-0 top-auto md:inset-x-auto md:top-16 md:right-6 md:bottom-auto z-40 w-full md:w-[35rem] max-w-full md:max-w-[95vw] max-h-[84dvh] md:max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain-y bg-slate-900/95 border border-emerald-700/70 rounded-t-3xl md:rounded-2xl shadow-2xl p-4 pb-safe text-slate-100 select-none space-y-3.5"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="hud-heading text-sm font-bold text-white truncate">Collective Impact</h3>
                <p className="text-[11px] text-slate-400 truncate tabular-nums">
                  Preservación común vs especulación · Ronda {state.round}/20 ·{' '}
                  {state.speculators.length} especuladores activos
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSound.modalClose();
                onClose();
              }}
              className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Cerrar panel Collective Impact"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

      {/* Franja KPI comparativa (sin pills, tipografía tabular) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-3 border-b border-slate-800/80 tabular-nums">
        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-400">Eficiencia Equipo</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-emerald-400">
              {metrics.teamEfficiencyPct}%
            </span>
            <span
              className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                metrics.efficiencyDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {metrics.efficiencyDelta >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {metrics.efficiencyDelta >= 0 ? `+${metrics.efficiencyDelta}%` : `${metrics.efficiencyDelta}%`}
            </span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-400">Captura Especuladora</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-rose-400">
              {metrics.speculatorCapturePct}%
            </span>
            <span className="text-[10px] text-slate-400">
              {metrics.privateCount}/{metrics.total} priv.
            </span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-400">Balance Común</div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-lg font-extrabold ${
                metrics.netBalance >= 0 ? 'text-teal-300' : 'text-amber-300'
              }`}
            >
              {metrics.netBalance >= 0 ? `+${metrics.netBalance}` : metrics.netBalance}
            </span>
            <span className="text-[10px] text-slate-400">{metrics.comparativeRatio}x ratio</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-400">Acciones vs Ofensivas</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-sky-300">
              {metrics.totalTeamActions}
            </span>
            <span className="text-[10px] text-slate-400">
              vs {metrics.speculatorOffensives} golp.
            </span>
          </div>
        </div>
      </div>

      {/* Selector de vista Recharts + estado comparativo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setActiveTab('efficiency');
            }}
            className={`min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'efficiency'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tendencia por Turno
          </button>
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              setActiveTab('sectors');
            }}
            className={`min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'sectors'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sectores del Tablero
          </button>
        </div>

        <div className="text-[11px] flex items-center gap-1.5 text-slate-300">
          <Shield
            className={`w-3.5 h-3.5 shrink-0 ${
              isTeamAhead ? 'text-emerald-400' : 'text-amber-400'
            }`}
          />
          <span>
            {isTeamAhead ? 'Ventaja cooperativa' : 'Presión especuladora'}
          </span>
        </div>
      </div>

      {/* Gráfica Recharts en tiempo real */}
      <div className="h-[220px] w-full min-w-0 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'efficiency' ? (
            <AreaChart
              data={metrics.efficiencySeries}
              margin={{ top: 8, right: 12, left: -16, bottom: 2 }}
            >
              <defs>
                <linearGradient id="collectiveTeamFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="speculatorCaptureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                minTickGap={16}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={val => `${val}%`}
              />
              <Tooltip content={<ImpactChartTooltip mode="efficiency" />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="teamEfficiencyPct"
                name="Preservación Equipo"
                stroke="#10b981"
                strokeWidth={2.4}
                fill="url(#collectiveTeamFill)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="speculatorCapturePct"
                name="Captura Especuladores"
                stroke="#f43f5e"
                strokeWidth={2.2}
                fill="url(#speculatorCaptureFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={metrics.sectorSeries}
              margin={{ top: 8, right: 12, left: -16, bottom: 2 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="sector"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                allowDecimals={false}
              />
              <Tooltip content={<ImpactChartTooltip mode="sectors" />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Bar
                dataKey="common"
                name="Común (Equipo)"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="publicCount"
                name="Público"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="privateCount"
                name="Privado (Espec.)"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Barra comparativa global + resumen de contribución */}
      <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px] tabular-nums">
        <div className="flex items-center justify-between text-slate-300">
          <span>Distribución actual del tablero ({metrics.total} bienes)</span>
          <span className="text-slate-400">
            {metrics.commonsPurePct}% común · {metrics.publicPct}% público · {metrics.speculatorCapturePct}% privado
          </span>
        </div>

        <svg
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Distribución: ${metrics.commonsPurePct}% común, ${metrics.publicPct}% público, ${metrics.speculatorCapturePct}% privado`}
          className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden block"
        >
          <rect x={0} y={0} width={metrics.commonsPurePct} height={6} fill="#10b981" />
          <rect
            x={metrics.commonsPurePct}
            y={0}
            width={metrics.publicPct}
            height={6}
            fill="#38bdf8"
            fillOpacity={0.7}
          />
          <rect
            x={metrics.commonsPurePct + metrics.publicPct}
            y={0}
            width={metrics.speculatorCapturePct}
            height={6}
            fill="#f43f5e"
            fillOpacity={0.85}
          />
        </svg>

        {metrics.topContributor && (
          <div className="flex items-center justify-between text-slate-400 pt-0.5">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Mayor aporte cooperativo:</span>
              <strong className="text-slate-200">{metrics.topContributor.playerName}</strong>
            </span>
            <span className="text-emerald-300 font-semibold">
              {metrics.topContributor.commonsUnlocked} com. · {metrics.topContributor.cooperativeActions} coop.
            </span>
          </div>
        )}
      </div>
        </HudPanelMotion>
      )}
    </AnimatePresence>
  );
};
