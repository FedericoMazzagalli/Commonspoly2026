/**
 * SpeculatorDashboardHUD.tsx
 * Dashboard en tiempo real del balance patrimonial y capacidad financiera de cada especulador:
 * - Valor neto total de sus activos (cartera de casillas privatizadas + liquidez operativa).
 * - Capacidad financiera actual para vandalizar bienes comunes o comprar bienes públicos.
 * - Objetivos inmediatos en rango 1d6 y plan defensivo recomendado para el equipo.
 * Diseñado sin backdrop-blur ni puntos pulsantes sobre el tablero WebGL.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Building2,
  Coins,
  Crosshair,
  Flame,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  X
} from 'lucide-react';
import { GameEngineState } from '../../types/game';
import { useI18n } from '../../i18n';
import {
  computeSpeculatorFinancialDashboard,
  SpeculatorDefenseTier,
  SpeculatorFinancialProfile
} from '../../utils/speculatorFinancials';
import { HudPanelMotion } from '../ui/MotionPrimitives';

interface SpeculatorDashboardHUDProps {
  isOpen: boolean;
  state: GameEngineState;
  onClose: () => void;
  onSelectTile?: (tileId: number) => void;
  onOpenEconomyDebug?: () => void;
}

type SortMode = 'CAPACITY' | 'NAV';

function getTierMeta(tier: SpeculatorDefenseTier): {
  label: string;
  badgeClass: string;
  barClass: string;
  textClass: string;
} {
  switch (tier) {
    case 'CRITICAL':
      return {
        label: 'Crítico',
        badgeClass: 'bg-rose-500/25 border-rose-500/70 text-rose-200',
        barClass: 'bg-rose-500',
        textClass: 'text-rose-300'
      };
    case 'ELEVATED':
      return {
        label: 'Elevado',
        badgeClass: 'bg-amber-500/25 border-amber-500/70 text-amber-200',
        barClass: 'bg-amber-400',
        textClass: 'text-amber-300'
      };
    case 'MODERATE':
      return {
        label: 'Moderado',
        badgeClass: 'bg-sky-500/20 border-sky-500/60 text-sky-200',
        barClass: 'bg-sky-400',
        textClass: 'text-sky-300'
      };
    case 'CONTAINED':
    default:
      return {
        label: 'Contenido',
        badgeClass: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200',
        barClass: 'bg-emerald-400',
        textClass: 'text-emerald-300'
      };
  }
}

export const SpeculatorDashboardHUD: React.FC<SpeculatorDashboardHUDProps> = ({
  isOpen,
  state,
  onClose,
  onSelectTile,
  onOpenEconomyDebug
}) => {
  const { t } = useI18n();
  const [sortMode, setSortMode] = useState<SortMode>('CAPACITY');

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

  const dashboard = useMemo(() => computeSpeculatorFinancialDashboard(state), [state]);

  const sortedProfiles = useMemo(() => {
    return [...dashboard.profiles].sort((a, b) => {
      if (sortMode === 'NAV') {
        return b.netAssetValue - a.netAssetValue || b.vandalismCapacityPct - a.vandalismCapacityPct;
      }
      return b.vandalismCapacityPct - a.vandalismCapacityPct || b.netAssetValue - a.netAssetValue;
    });
  }, [dashboard.profiles, sortMode]);

  return (
    <AnimatePresence>
      {isOpen && (
        <HudPanelMotion
          as="aside"
          direction="right"
          onSwipeDismiss={onClose}
          role="dialog"
          ariaLabel={t.hud.specDashboardTitle ?? 'Balance y Capacidad de Especuladores'}
          className="pointer-events-auto fixed inset-x-0 bottom-0 top-auto md:inset-x-auto md:right-6 md:top-20 md:bottom-auto z-40 w-full md:w-[480px] max-h-[84dvh] md:max-h-[calc(100dvh-11rem)] flex flex-col bg-slate-950 border border-rose-700/75 rounded-t-3xl md:rounded-2xl shadow-2xl text-slate-100 overflow-hidden overscroll-contain-y pb-safe"
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="hud-heading text-xs sm:text-sm font-extrabold text-white truncate">
                  {t.hud.specDashboardTitle ?? 'Balance y Capacidad de Especuladores'}
                </h2>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  {t.hud.specDashboardSubtitle ??
                    'Valor neto de activos privatizados y liquidez operativa para financiar vandalismo y ataques en 1d6.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title={t.common.close}
              aria-label={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

      {/* KPIs Globales */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums shrink-0">
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-400 truncate">
            {t.hud.specDashboardTotalNav ?? 'Valor Neto Total'}
          </div>
          <div className="text-base font-black text-white flex items-center gap-1">
            <span>{dashboard.totalNetAssetValue}</span>
            <span className="text-[10px] font-semibold text-slate-400">pts</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-400 truncate">
            {t.hud.specDashboardAssetPortfolio ?? 'Activos Privatizados'}
          </div>
          <div className="text-base font-black text-rose-300 flex items-center gap-1">
            <span>{dashboard.totalTileAssetValue}</span>
            <span className="text-[10px] font-semibold text-slate-400">pts</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-400 truncate">
            {t.hud.specDashboardLiquidity ?? 'Liquidez Operativa'}
          </div>
          <div className="text-base font-black text-amber-300 flex items-center gap-1">
            <span>{dashboard.totalLiquidCapital}</span>
            <span className="text-[10px] font-semibold text-slate-400">pts</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-400 truncate">
            {t.hud.specDashboardMaxCap ?? 'Capacidad Ofensiva'}
          </div>
          <div
            className={`text-base font-black flex items-center gap-1 ${
              dashboard.maxCapacityPct >= 70
                ? 'text-rose-300'
                : dashboard.maxCapacityPct >= 45
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            <span>{dashboard.maxCapacityPct}%</span>
            <span className="text-[10px] font-semibold text-slate-400">
              ({dashboard.totalVandalismsAffordable}x)
            </span>
          </div>
        </div>
      </div>

      {/* Barra de ordenación y accesos */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-2 text-[10px] shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSortMode('CAPACITY')}
            className={`min-h-[38px] sm:min-h-[28px] px-2.5 py-1 rounded-lg font-bold border transition-colors ${
              sortMode === 'CAPACITY'
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {t.hud.specDashboardSortCap ?? 'Orden: Capacidad Vandalismo'}
          </button>
          <button
            type="button"
            onClick={() => setSortMode('NAV')}
            className={`min-h-[38px] sm:min-h-[28px] px-2.5 py-1 rounded-lg font-bold border transition-colors ${
              sortMode === 'NAV'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {t.hud.specDashboardSortNav ?? 'Orden: Valor Neto'}
          </button>
        </div>

        {onOpenEconomyDebug && (
          <button
            type="button"
            onClick={onOpenEconomyDebug}
            className="min-h-[38px] sm:min-h-[28px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold shrink-0"
          >
            {t.hud.economyDebug}
          </button>
        )}
      </div>

      {/* Lista de Especuladores */}
      <div className="p-4 overflow-y-auto space-y-3 text-xs tabular-nums flex-1">
        {sortedProfiles.map((profile: SpeculatorFinancialProfile) => {
          const tierMeta = getTierMeta(profile.defenseTier);
          const totalMix = Math.max(1, profile.netAssetValue);
          const assetSharePct = Math.round((profile.tileAssetValue / totalMix) * 100);
          const liquiditySharePct = 100 - assetSharePct;

          return (
            <div
              key={profile.speculatorId}
              className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5"
            >
              {/* Cabecera del especulador */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-1 shadow"
                    style={{ backgroundColor: profile.speculatorColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-white text-xs truncate">
                      #{profile.orderIndex} · {profile.speculatorName}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTile?.(profile.position)}
                      className="text-[11px] text-slate-400 hover:text-amber-300 truncate text-left transition-colors"
                      title={t.hud.specDashboardInspectBtn ?? 'Inspeccionar en 3D'}
                    >
                      Casilla #{profile.position} · {profile.currentTileName} ({profile.boardSideLabel})
                    </button>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide shrink-0 ${tierMeta.badgeClass}`}
                >
                  {tierMeta.label}
                </span>
              </div>

              {/* Desglose de Valor Neto (Activos Privatizados vs Liquidez Operativa) */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Valor Neto (NAV)</span>
                  </span>
                  <span className="font-black text-white text-sm">
                    {profile.netAssetValue} pts
                  </span>
                </div>

                {/* Barra de composición patrimonial */}
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${assetSharePct}%` }}
                    title={`${t.hud.specDashboardAssetPortfolio ?? 'Activos Privatizados'}: ${profile.tileAssetValue} pts`}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${liquiditySharePct}%` }}
                    title={`${t.hud.specDashboardLiquidity ?? 'Liquidez Operativa'}: ${profile.liquidCapital} pts`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5 text-[10px]">
                  <div className="flex items-center justify-between gap-1 text-slate-300">
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>Activos ({profile.controlledPrivateTilesCount} cas.)</span>
                    </span>
                    <strong className="text-rose-300 shrink-0">{profile.tileAssetValue}p</strong>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-slate-300">
                    <span className="flex items-center gap-1 truncate">
                      <Coins className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Liquidez</span>
                    </span>
                    <strong className="text-amber-300 shrink-0">{profile.liquidCapital}p</strong>
                  </div>
                </div>
              </div>

              {/* Medidor de Capacidad Financiera para Vandalizar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{t.hud.specDashboardVandalCap ?? 'Capacidad de vandalizar'}</span>
                  </span>
                  <span className={`font-black ${tierMeta.textClass}`}>
                    {profile.vandalismCapacityPct}% · {profile.maxVandalismsAffordable}x
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${tierMeta.barClass}`}
                    style={{ width: `${profile.vandalismCapacityPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-300">
                  <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 truncate">Vandalismos</div>
                    <div className="font-bold text-amber-300">
                      {profile.maxVandalismsAffordable} ({profile.vandalizeUnitCost}p/u)
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 truncate">Compras</div>
                    <div className="font-bold text-rose-300">
                      {profile.maxBuyoutsAffordable} ({profile.buyoutUnitCost}p/u)
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 truncate">Presión/paso</div>
                    <div className="font-bold text-sky-300">{profile.landingPressurePct}%</div>
                  </div>
                </div>
              </div>

              {/* Objetivos inmediatos en 1d6 y Plan Defensivo */}
              {profile.threatDetail && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{t.hud.specDashboardTargets1d6 ?? 'Objetivos inmediatos (+1..+6)'}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectTile?.(profile.threatDetail!.intendedTarget.tileId)}
                      className="px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-200 transition-colors"
                    >
                      #{profile.threatDetail.intendedTarget.tileId}{' '}
                      {profile.threatDetail.intendedTarget.tileName} (+
                      {profile.threatDetail.intendedTarget.distance})
                    </button>

                    {profile.threatDetail.predictedTileRisks.slice(0, 2).map(risk => (
                      <button
                        key={risk.tileId}
                        type="button"
                        onClick={() => onSelectTile?.(risk.tileId)}
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors ${
                          risk.riskAction === 'BUY'
                            ? 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-700/60 text-rose-200'
                            : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-700/60 text-amber-200'
                        }`}
                      >
                        +{risk.distance} #{risk.tileId} ·{' '}
                        {risk.riskAction === 'BUY' ? 'Compra' : 'Vandal.'} ({risk.actionChancePct}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan Defensivo Sugerido */}
              <div
                className={`p-2 rounded-xl border text-[11px] leading-snug flex items-start gap-2 ${
                  profile.defenseTier === 'CRITICAL'
                    ? 'bg-rose-950/35 border-rose-800/60 text-rose-100'
                    : profile.defenseTier === 'ELEVATED'
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-100'
                    : 'bg-emerald-950/25 border-emerald-800/50 text-emerald-100'
                }`}
              >
                {profile.defenseTier === 'CRITICAL' || profile.defenseTier === 'ELEVATED' ? (
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                    {t.hud.specDashboardDefensePlan ?? 'Plan defensivo sugerido'}
                  </div>
                  <p>{profile.defensePlan}</p>
                </div>
              </div>
            </div>
          );
        })}

        {sortedProfiles.length === 0 && (
          <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-slate-500" />
            <span>No hay especuladores activos en esta partida.</span>
          </div>
        )}
      </div>
        </HudPanelMotion>
      )}
    </AnimatePresence>
  );
};
