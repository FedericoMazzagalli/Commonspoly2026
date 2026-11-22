/**
 * PerformanceMonitorHUD.tsx
 * Monitor de rendimiento en tiempo real para auditar FPS, latencia de frame,
 * memoria JS Heap / WebGL y frustum culling sobre el tablero 3D en móvil y escritorio.
 * Diseñado sin backdrop-blur ni animaciones continuas para evitar interferencia con WebGL.
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Layers,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import {
  BoardPerformanceTelemetry,
  MemorySnapshot,
  createInitialBoardTelemetry,
  readBrowserMemorySnapshot
} from '../../utils/performanceTelemetry';
import { useI18n } from '../../i18n';
import type { TranslationDict } from '../../i18n/types';

interface PerformanceMonitorHUDProps {
  isOpen: boolean;
  telemetryRef: React.MutableRefObject<BoardPerformanceTelemetry>;
  onClose: () => void;
  cameraMode: 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW';
  postProcessingEnabled?: boolean;
}

const MAX_FPS_SAMPLES = 24;

function getFpsClassification(fps: number, perf: TranslationDict['perf']): {
  label: string;
  textClass: string;
  barClass: string;
} {
  if (fps <= 0) {
    return {
      label: perf.measuring,
      textClass: 'text-slate-300',
      barClass: 'bg-slate-500'
    };
  }
  if (fps >= 50) {
    return {
      label: perf.smooth,
      textClass: 'text-emerald-300',
      barClass: 'bg-emerald-400'
    };
  }
  if (fps >= 30) {
    return {
      label: perf.moderate,
      textClass: 'text-amber-300',
      barClass: 'bg-amber-400'
    };
  }
  return {
    label: perf.low,
    textClass: 'text-rose-300',
    barClass: 'bg-rose-400'
  };
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export const PerformanceMonitorHUD: React.FC<PerformanceMonitorHUDProps> = ({
  isOpen,
  telemetryRef,
  onClose,
  cameraMode,
  postProcessingEnabled = true
}) => {
  const { t } = useI18n();
  const [telemetry, setTelemetry] = useState<BoardPerformanceTelemetry>(() =>
    createInitialBoardTelemetry()
  );
  const [memory, setMemory] = useState<MemorySnapshot>(() => readBrowserMemorySnapshot());
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    if (!isOpen) return;

    const sampleNow = () => {
      const latestTelemetry = { ...telemetryRef.current };
      const latestMemory = readBrowserMemorySnapshot();
      setTelemetry(latestTelemetry);
      setMemory(latestMemory);
      if (latestTelemetry.fps > 0) {
        setFpsHistory(prev => {
          const next = [...prev, latestTelemetry.fps];
          return next.length > MAX_FPS_SAMPLES ? next.slice(next.length - MAX_FPS_SAMPLES) : next;
        });
      }
    };

    sampleNow();
    const intervalId = window.setInterval(sampleNow, 500);
    return () => window.clearInterval(intervalId);
  }, [isOpen, telemetryRef]);

  if (!isOpen) return null;

  const fpsStatus = getFpsClassification(telemetry.fps, t.perf);
  const cullingPct =
    telemetry.totalCullableObjects > 0
      ? Math.round((telemetry.culledObjects / telemetry.totalCullableObjects) * 100)
      : 0;
  const cameraLabel =
    cameraMode === 'TOP_DOWN'
      ? t.hud.camTopDown
      : cameraMode === 'FOLLOW'
      ? t.hud.camFollow
      : t.hud.camIsometric;

  return (
    <aside
      role="region"
      aria-label={t.perf.title}
      className="pointer-events-auto fixed left-3 right-3 sm:left-auto sm:right-6 top-16 sm:top-20 z-40 sm:w-80 bg-slate-950 border border-teal-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-teal-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold tracking-wide uppercase text-white truncate">
              {t.perf.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsCompact(prev => !prev)}
            className="min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCompact ? t.hud.dockExpand : t.hud.dockCollapse}
            aria-label={isCompact ? t.hud.dockExpand : t.hud.dockCollapse}
          >
            {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={t.common.close}
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Strip Mode (Ideal en pantallas móviles estrechas) */}
      {isCompact ? (
        <div className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-black leading-none ${fpsStatus.textClass}`}>
              {telemetry.fps > 0 ? telemetry.fps : '--'}
            </span>
            <div className="leading-tight">
              <div className={`text-[11px] font-bold ${fpsStatus.textClass}`}>
                FPS · {fpsStatus.label}
              </div>
              <div className="text-[10px] text-slate-400">
                {telemetry.frameTimeMs > 0 ? `${telemetry.frameTimeMs} ms` : '-- ms'}
              </div>
            </div>
          </div>

          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-cyan-300">
              {memory.supported && memory.usedJSHeapMB !== null
                ? `${memory.usedJSHeapMB} MB`
                : memory.deviceMemoryGB !== null
                ? `~${memory.deviceMemoryGB} GB ${t.perf.ramApprox}`
                : t.perf.heapNa}
            </div>
            <div className="text-[10px] text-slate-400">
              Cull {telemetry.culledObjects}/{telemetry.totalCullableObjects} · {formatCompactCount(telemetry.triangles)} tri
            </div>
          </div>
        </div>
      ) : (
        /* Expanded Audit View */
        <div className="p-3 space-y-2.5 text-xs tabular-nums">
          {/* Row 1: FPS + Frame Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                <span>{t.perf.refreshRate}</span>
                <span className={`font-bold ${fpsStatus.textClass}`}>{fpsStatus.label}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black leading-none ${fpsStatus.textClass}`}>
                  {telemetry.fps > 0 ? telemetry.fps : '--'}
                </span>
                <span className="text-[11px] font-bold text-slate-400">FPS</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {t.perf.frameLbl}: <strong className="text-slate-200">{telemetry.frameTimeMs} ms</strong> · {t.perf.peakLbl}{' '}
                <strong className="text-slate-200">{telemetry.maxFrameTimeMs} ms</strong>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                <span>{t.perf.jsMemory}</span>
                <HardDrive className="w-3 h-3 text-cyan-400" />
              </div>
              {memory.supported && memory.usedJSHeapMB !== null && memory.jsHeapLimitMB !== null ? (
                <>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-black leading-none text-cyan-300">
                      {memory.usedJSHeapMB}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      / {memory.totalJSHeapMB} MB
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, memory.heapUsagePct ?? 0)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {memory.heapUsagePct}% / {memory.jsHeapLimitMB} MB
                    {memory.deviceMemoryGB !== null ? ` · ~${memory.deviceMemoryGB} GB` : ''}
                  </div>
                </>
              ) : (
                <div className="mt-1.5 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-300">
                    {t.perf.heapNa}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug">
                    {memory.deviceMemoryGB !== null
                      ? `${t.perf.ramApprox}: ~${memory.deviceMemoryGB} GB`
                      : t.perf.heapNa}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FPS Sparkline (últimas 24 muestras) */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
              <span>{t.perf.recentHistory}</span>
              <span>DPR {telemetry.pixelRatio.toFixed(1)}x · {telemetry.isSoftwareGl ? 'Software GL' : 'GPU Hardware'}</span>
            </div>
            <div className="h-8 flex items-end gap-0.5" aria-hidden="true">
              {Array.from({ length: MAX_FPS_SAMPLES }).map((_, i) => {
                const offset = MAX_FPS_SAMPLES - fpsHistory.length;
                const sample = i >= offset ? fpsHistory[i - offset] : 0;
                const heightPct = sample > 0 ? Math.max(12, Math.min(100, Math.round((sample / 65) * 100))) : 8;
                const barCls = sample > 0 ? getFpsClassification(sample, t.perf).barClass : 'bg-slate-800';
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm transition-all duration-200 ${barCls}`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Row 3: WebGL Geometry, Draw Calls & Frustum Culling */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-teal-400" />
                <span>{t.perf.webglScene}</span>
              </span>
              <span className="text-teal-300 font-bold">{cameraLabel}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t.perf.drawCalls}</span>
                <strong className="text-slate-100">{telemetry.drawCalls}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t.perf.triangles}</span>
                <strong className="text-slate-100">{formatCompactCount(telemetry.triangles)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t.perf.geometries}</span>
                <strong className="text-slate-100">{telemetry.geometries}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t.perf.textures}</span>
                <strong className="text-slate-100">{telemetry.textures}</strong>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-emerald-400" />
                <span>{t.perf.frustumCulling}</span>
              </span>
              <strong className="text-emerald-300">
                {telemetry.culledObjects}/{telemetry.totalCullableObjects} ({cullingPct}%)
              </strong>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{t.perf.postProcessing}</span>
              <span className="text-slate-200 font-semibold">
                {postProcessingEnabled && !telemetry.isSoftwareGl ? t.perf.acesColor : t.perf.standard}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
