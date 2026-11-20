/**
 * GameOverModal.tsx
 * Pantalla final de Desenlace con Dashboard de Rendimiento en Recharts:
 * - Evolución por ronda de recursos (Bienestar, Legitimidad, Total) por jugador
 * - Contribución de cada jugador a Bienes Comunes, Públicos y acciones cooperativas
 * - Evolución del tablero (Comunes vs Públicos vs Privados)
 * - Tabla comparativa por participante
 */

import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  HeartHandshake,
  Eye,
  TrendingUp,
  Layers,
  Users,
  Activity,
  Globe,
  LogIn,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Tile,
  Character,
  RoundPerformanceSnapshot,
  TurnCommonsSnapshot,
  PlayerContributionStats,
  GameLogEntry
} from '../../types/game';
import { CommonsEvolutionD3Chart } from '../charts/CommonsEvolutionD3Chart';
import { CooperativeEfficiencyBreakdown } from '../../utils/cooperativeEfficiency';
import { LeaderboardEntry, LeaderboardSubmissionStatus } from '../../utils/leaderboard';
import { type User } from '../../firebase';

interface GameOverModalProps {
  result: 'VICTORY' | 'DRAW' | 'DEFEAT';
  details?: string;
  round: number;
  tiles: Tile[];
  players: Character[];
  performanceHistory?: RoundPerformanceSnapshot[];
  turnHistory?: TurnCommonsSnapshot[];
  playerStats?: Record<string, PlayerContributionStats>;
  logs?: GameLogEntry[];
  cooperativeEfficiency?: CooperativeEfficiencyBreakdown;
  leaderboardStatus?: LeaderboardSubmissionStatus;
  globalTopEntry?: LeaderboardEntry | null;
  globalUserRank?: number | null;
  authUser?: User | null;
  isAuthBusy?: boolean;
  onOpenLeaderboard?: () => void;
  onSignInAndPublish?: () => void;
  onInspectBoard?: () => void;
  onRestart: () => void;
}

type DashboardTab = 'resources' | 'evolution' | 'commons' | 'breakdown';
type ResourceMetric = 'totalResources' | 'wellness' | 'legitimacy';

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

interface CustomChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: CustomTooltipPayloadItem[];
  unitSuffix?: string;
}

const ChartTooltip: React.FC<CustomChartTooltipProps> = ({
  active,
  label,
  payload,
  unitSuffix = ''
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-xl text-left min-w-[168px]">
      <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1.5 mb-1.5">
        {label}
      </div>
      <div className="space-y-1">
        {sorted.map((entry, idx) => (
          <div key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 truncate max-w-[130px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || '#14b8a6' }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-bold text-white tabular-nums">
              {entry.value ?? 0}{unitSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  details,
  round,
  tiles,
  players,
  performanceHistory,
  turnHistory,
  playerStats,
  logs = [],
  cooperativeEfficiency,
  leaderboardStatus,
  globalTopEntry = null,
  globalUserRank = null,
  authUser = null,
  isAuthBusy = false,
  onOpenLeaderboard,
  onSignInAndPublish,
  onInspectBoard,
  onRestart
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('evolution');
  const [resourceMetric, setResourceMetric] = useState<ResourceMetric>('totalResources');

  useEffect(() => {
    if (result === 'VICTORY') {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 }
      });
      const interval = setInterval(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [result]);

  const commonCount = tiles.filter(t => t.state === 'COMMON' || t.category === 'INALIENABLE_COMMON').length;
  const publicCount = tiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = tiles.filter(t => t.state === 'PRIVATE').length;

  // Normalizar historial de rondas con fallback seguro si la partida terminó en ronda 1
  const normalizedHistory = useMemo<RoundPerformanceSnapshot[]>(() => {
    if (performanceHistory && performanceHistory.length > 0) {
      return [...performanceHistory].sort((a, b) => a.round - b.round);
    }

    return [
      {
        round: Math.max(1, round),
        commonCount,
        publicCount,
        privateCount,
        players: players.map(p => {
          const stats = playerStats?.[p.id];
          return {
            playerId: p.id,
            playerName: p.name,
            color: p.color,
            wellness: p.wellness,
            legitimacy: p.legitimacy,
            totalResources: p.wellness + p.legitimacy,
            commonsContributed: stats?.commonsUnlocked ?? 0,
            publicsContributed: stats?.publicsUnlocked ?? 0,
            cooperativeActions: stats?.cooperativeActions ?? 0
          };
        })
      }
    ];
  }, [performanceHistory, round, commonCount, publicCount, privateCount, players, playerStats]);

  // Datos por ronda para el gráfico de acumulación de recursos de cada jugador
  const resourceSeriesData = useMemo(() => {
    return normalizedHistory.map(snap => {
      const row: Record<string, string | number> = {
        roundLabel: `R${snap.round}`
      };
      players.forEach(p => {
        const match = snap.players.find(sp => sp.playerId === p.id);
        if (match) {
          row[p.id] = match[resourceMetric];
        } else {
          row[p.id] =
            resourceMetric === 'wellness'
              ? p.wellness
              : resourceMetric === 'legitimacy'
              ? p.legitimacy
              : p.wellness + p.legitimacy;
        }
      });
      return row;
    });
  }, [normalizedHistory, players, resourceMetric]);

  // Historial turno a turno para el gráfico dinámico D3 (Comunes vs Privatizados)
  const normalizedTurnHistory = useMemo<TurnCommonsSnapshot[]>(() => {
    if (turnHistory && turnHistory.length > 0) {
      return [...turnHistory].sort((a, b) => a.turn - b.turn);
    }

    const baseCommon = normalizedHistory[0]?.commonCount ?? commonCount;
    const totalResourceTiles = Math.max(1, commonCount + publicCount + privateCount);
    return normalizedHistory.map((snap, idx) => ({
      turn: idx,
      round: snap.round,
      label: idx === 0 ? 'Inicio' : `T${idx}`,
      actorName: idx === 0 ? 'Tablero Inicial' : `Ronda ${snap.round}`,
      commonCount: snap.commonCount,
      recoveredDelta: snap.commonCount - baseCommon,
      publicCount: snap.publicCount,
      privateCount: snap.privateCount,
      totalResourceTiles
    }));
  }, [turnHistory, normalizedHistory, commonCount, publicCount, privateCount]);

  // Contribución acumulada por jugador para BarChart y tabla de detalle
  const playerContributionRows = useMemo(() => {
    const latestSnap = normalizedHistory[normalizedHistory.length - 1];

    return players.map(p => {
      const stats = playerStats?.[p.id];
      const snapPlayer = latestSnap?.players.find(sp => sp.playerId === p.id);

      const commonsUnlocked = stats?.commonsUnlocked ?? snapPlayer?.commonsContributed ?? 0;
      const publicsUnlocked = stats?.publicsUnlocked ?? snapPlayer?.publicsContributed ?? 0;
      const cooperativeActions = stats?.cooperativeActions ?? snapPlayer?.cooperativeActions ?? 0;
      const wellnessInvested = stats?.wellnessInvested ?? 0;
      const totalResources = p.wellness + p.legitimacy;

      return {
        id: p.id,
        name: p.name.split(' ')[0],
        fullName: p.name,
        controller: p.controller,
        color: p.color,
        wellness: p.wellness,
        legitimacy: p.legitimacy,
        totalResources,
        commonsUnlocked,
        publicsUnlocked,
        cooperativeActions,
        wellnessInvested
      };
    });
  }, [players, playerStats, normalizedHistory]);

  const totalCoopActions = playerContributionRows.reduce((acc, row) => acc + row.cooperativeActions, 0);
  const totalWellnessInvested = playerContributionRows.reduce((acc, row) => acc + row.wellnessInvested, 0);

  const metricLabel =
    resourceMetric === 'totalResources'
      ? 'Recursos Totales (Bienestar + Legitimidad)'
      : resourceMetric === 'wellness'
      ? 'Bienestar acumulado por ronda'
      : 'Legitimidad acumulada por ronda';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-900/95 border border-teal-500/60 rounded-3xl shadow-2xl p-5 sm:p-7 text-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Cabecera del desenlace */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-start sm:items-center gap-4 text-left">
            <div className="shrink-0">
              {result === 'VICTORY' && (
                <div className="p-3.5 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
                  <Trophy className="w-9 h-9" />
                </div>
              )}
              {result === 'DRAW' && (
                <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
                  <HeartHandshake className="w-9 h-9" />
                </div>
              )}
              {result === 'DEFEAT' && (
                <div className="p-3.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <AlertCircle className="w-9 h-9" />
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-teal-400">
                Commonspoly · Informe de Partida
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mt-0.5">
                {result === 'VICTORY' && '¡Victoria de los Bienes Comunes!'}
                {result === 'DRAW' && 'Empate Social de Transición'}
                {result === 'DEFEAT' && 'Avance Neoliberal Inconcluso'}
              </h2>
              {details && (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {details}
                </p>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-1 shrink-0 tabular-nums">
            {cooperativeEfficiency && (
              <>
                <span className="font-bold text-teal-300">
                  Eficiencia coop.: {cooperativeEfficiency.efficiencyPct}% ({cooperativeEfficiency.tierLabel})
                </span>
                <span className="text-slate-600">·</span>
              </>
            )}
            <span>{round} / 20 rondas</span>
            <span className="text-slate-600">·</span>
            <span>{players.length} participantes</span>
            <span className="text-slate-600">·</span>
            <span>{logs.length} eventos registrados</span>
          </div>
        </div>

        {/* Fila de KPIs principales (elevación única, cifras tabulares) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 text-left">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Rondas Jugadas
            </div>
            <div className="text-2xl font-black text-white tabular-nums mt-0.5">
              {round} <span className="text-sm font-semibold text-slate-500">/ 20</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Bienes Comunes
            </div>
            <div className="text-2xl font-black text-emerald-400 tabular-nums mt-0.5">
              {commonCount}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Bienes Públicos
            </div>
            <div className="text-2xl font-black text-sky-400 tabular-nums mt-0.5">
              {publicCount}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Bienes Privados
            </div>
            <div className="text-2xl font-black text-rose-400 tabular-nums mt-0.5">
              {privateCount}
            </div>
          </div>
        </div>

        {/* Panel Analítico Recharts */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 text-left mb-5">
          {/* Selector de vista del dashboard */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                Panel de Rendimiento y Contribución Colectiva
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {totalCoopActions} acciones cooperativas · {totalWellnessInvested} pts de bienestar invertidos en el común
              </p>
            </div>

            <div className="inline-flex items-center flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('evolution')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'evolution'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Comunes vs Privatizados</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('resources')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'resources'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Recursos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('commons')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'commons'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Contribuciones</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('breakdown')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'breakdown'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Participantes</span>
              </button>
            </div>
          </div>

          {/* Vista 0: Gráfico dinámico D3 de Bienes Comunes vs Privatizados a lo largo de los turnos */}
          {activeTab === 'evolution' && (
            <CommonsEvolutionD3Chart
              data={normalizedTurnHistory}
              height={280}
              title="Evolución turno a turno: Bienes Comunes recuperados vs Privatizados (D3)"
            />
          )}

          {/* Vista 1: Acumulación de Recursos por Ronda */}
          {activeTab === 'resources' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
                <span className="text-xs font-semibold text-slate-300">
                  {metricLabel}
                </span>
                <div className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => setResourceMetric('totalResources')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      resourceMetric === 'totalResources'
                        ? 'bg-slate-800 text-teal-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Total Recursos
                  </button>
                  <button
                    type="button"
                    onClick={() => setResourceMetric('wellness')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      resourceMetric === 'wellness'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bienestar
                  </button>
                  <button
                    type="button"
                    onClick={() => setResourceMetric('legitimacy')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      resourceMetric === 'legitimacy'
                        ? 'bg-slate-800 text-sky-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Legitimidad
                  </button>
                </div>
              </div>

              <div className="h-[265px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resourceSeriesData} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="roundLabel"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip unitSuffix=" pts" />} />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    />
                    {players.map(player => (
                      <Line
                        key={player.id}
                        type="monotone"
                        dataKey={player.id}
                        name={player.name}
                        stroke={player.color}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: player.color, strokeWidth: 0 }}
                        activeDot={{ r: 5.5, stroke: '#0f172a', strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Vista 2: Contribuciones individuales al común y lo público */}
          {activeTab === 'commons' && (
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Contribución individual al común, lo público y acciones solidarias
              </div>
              <div className="h-[265px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={playerContributionRows}
                    margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      dataKey="commonsUnlocked"
                      name="Bienes Comunes"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="publicsUnlocked"
                      name="Bienes Públicos"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="cooperativeActions"
                      name="Acciones Coop."
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Vista 3: Tabla comparativa por participante */}
          {activeTab === 'breakdown' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 pr-3 font-semibold">Participante</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Bienestar</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Legitimidad</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Total</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Comunes</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Públicos</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Acciones Coop.</th>
                    <th className="py-2.5 pl-2 font-semibold text-right">Invertido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {playerContributionRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <div>
                            <div className="font-bold text-slate-100">{row.fullName}</div>
                            <div className="text-[10px] text-slate-400">
                              {row.controller === 'HUMAN' ? 'Jugador Humano' : 'Bot Cooperativo'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-emerald-400 tabular-nums">
                        {row.wellness}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-sky-400 tabular-nums">
                        {row.legitimacy}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-white tabular-nums">
                        {row.totalResources}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-teal-400 tabular-nums">
                        {row.commonsUnlocked}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-sky-300 tabular-nums">
                        {row.publicsUnlocked}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-amber-400 tabular-nums">
                        {row.cooperativeActions}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-semibold text-slate-300 tabular-nums">
                        {row.wellnessInvested} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Estado de Récord en el Leaderboard Global */}
        {cooperativeEfficiency && (
          <div className="bg-slate-950 border border-teal-800/60 rounded-2xl p-3.5 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0 mt-0.5">
                {leaderboardStatus?.state === 'CREATED' || leaderboardStatus?.state === 'UPDATED_RECORD' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 space-y-0.5 tabular-nums">
                <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>Clasificación Global · Eficiencia Cooperativa: {cooperativeEfficiency.efficiencyPct}%</span>
                  {globalUserRank && (
                    <span className="text-teal-300">· Tu puesto actual: #{globalUserRank}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {leaderboardStatus?.state === 'CREATED' &&
                    `¡Primer récord personal publicado en el Leaderboard Global (${leaderboardStatus.entry.efficiencyPct}%)!`}
                  {leaderboardStatus?.state === 'UPDATED_RECORD' &&
                    `¡Nuevo récord personal! Superaste tu marca anterior (${leaderboardStatus.prevEfficiencyPct}% → ${leaderboardStatus.entry.efficiencyPct}%).`}
                  {leaderboardStatus?.state === 'NOT_HIGHER' &&
                    `Tu récord global vigente sigue siendo ${leaderboardStatus.existingBestPct}% (se conserva tu puntuación más alta).`}
                  {leaderboardStatus?.state === 'SAVED_LOCAL_PENDING' &&
                    'Puntuación guardada localmente. Conecta tu cuenta de Google para publicarla y compararte en el Leaderboard Global.'}
                  {leaderboardStatus?.state === 'SUBMITTING' &&
                    'Sincronizando récord con el Leaderboard Global...'}
                  {leaderboardStatus?.state === 'ERROR' &&
                    `Guardado local conservado (error de red al sincronizar: ${leaderboardStatus.message}).`}
                  {(!leaderboardStatus || leaderboardStatus.state === 'IDLE') &&
                    (globalTopEntry
                      ? `Líder mundial actual: ${globalTopEntry.displayAlias} con ${globalTopEntry.efficiencyPct}% (Ronda ${globalTopEntry.round}/20).`
                      : 'Consulta y compara tu resultado con el resto de participantes en el Leaderboard Global.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {!authUser && onSignInAndPublish && (
                <button
                  type="button"
                  onClick={onSignInAndPublish}
                  disabled={isAuthBusy}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isAuthBusy ? 'Conectando...' : 'Publicar con Google'}</span>
                </button>
              )}
              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Ver Leaderboard Global</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nota y acciones */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-1">
          <p className="text-xs text-slate-400 italic text-center md:text-left max-w-xl">
            &quot;Commonspoly nació en 2015 en el Hackcamp Reclaim the Commons (ZEMOS98) para subvertir el Monopoly y celebrar la felicidad radical cuando nos reconocemos interdependientes.&quot;
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            {onInspectBoard && (
              <button
                type="button"
                onClick={onInspectBoard}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Eye className="w-4 h-4 text-teal-400" />
                <span>Ver Vuelo 3D</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Jugar Nueva Partida de Commonspoly</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
