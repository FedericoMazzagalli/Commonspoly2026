/**
 * GameOverCinematicOverlay.tsx
 * Superposición cinematográfica y sistema de partículas 2D ligero que se activa
 * al entrar en la fase 'GAME_OVER', enmarcando el vuelo de cámara 3D sobre el tablero
 * sin ocluirlo (sin backdrop-blur sobre WebGL) y permitiendo alternar con el resumen final.
 */

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Eye, Trophy, HeartHandshake, AlertCircle, Trees, Layers, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tile } from '../../types/game';
import { playSound } from '../../utils/audio';
import { CooperativeEfficiencyBreakdown } from '../../utils/cooperativeEfficiency';

interface GameOverCinematicOverlayProps {
  result: 'VICTORY' | 'DRAW' | 'DEFEAT';
  tiles: Tile[];
  round: number;
  cooperativeEfficiency?: CooperativeEfficiencyBreakdown;
  showSummaryModal: boolean;
  onToggleSummary: () => void;
}

interface OverlayParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  phase: number;
}

export const GameOverCinematicOverlay: React.FC<GameOverCinematicOverlayProps> = ({
  result,
  tiles,
  round,
  cooperativeEfficiency,
  showSummaryModal,
  onToggleSummary
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const commonCount = tiles.filter(t => t.state === 'COMMON' || t.category === 'INALIENABLE_COMMON').length;
  const publicCount = tiles.filter(t => t.state === 'PUBLIC').length;
  const privateCount = tiles.filter(t => t.state === 'PRIVATE').length;

  // Sistema de partículas suaves en canvas 2D superpuesto (transparente, pointer-events: none)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const palette =
      result === 'VICTORY'
        ? ['#34d399', '#2dd4bf', '#facc15', '#f472b6', '#a7f3d0']
        : result === 'DRAW'
        ? ['#38bdf8', '#818cf8', '#2dd4bf', '#e2e8f0']
        : ['#f43f5e', '#fb923c', '#fbbf24', '#94a3b8'];

    const particles: OverlayParticle[] = Array.from({ length: 65 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 28,
      vy: result === 'DEFEAT' ? 18 + Math.random() * 26 : -(22 + Math.random() * 34),
      size: 2 + Math.random() * 4.5,
      alpha: 0.35 + Math.random() * 0.55,
      color: palette[i % palette.length],
      phase: Math.random() * Math.PI * 2
    }));

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.phase += dt * 2.2;
        p.x += (p.vx + Math.sin(p.phase) * 14) * dt;
        p.y += p.vy * dt;

        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;

        const flicker = 0.7 + 0.3 * Math.sin(p.phase * 1.4);
        ctx.save();
        ctx.globalAlpha = p.alpha * flicker;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [result]);

  const titleText =
    result === 'VICTORY'
      ? t('gameOverCinematic.victoryTitle')
      : result === 'DRAW'
      ? t('gameOverCinematic.drawTitle')
      : t('gameOverCinematic.defeatTitle');

  const accentBorder =
    result === 'VICTORY'
      ? 'border-emerald-500/70'
      : result === 'DRAW'
      ? 'border-sky-500/70'
      : 'border-rose-500/70';

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden flex flex-col justify-between">
      {/* Canvas de partículas luminosas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Banda cinematográfica superior */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full px-4 md:px-8 pt-4 flex items-center justify-between gap-3"
      >
        <div className={`pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950/85 border ${accentBorder} shadow-xl text-xs`}>
          {result === 'VICTORY' && <Trophy className="w-4 h-4 text-emerald-400" />}
          {result === 'DRAW' && <HeartHandshake className="w-4 h-4 text-sky-400" />}
          {result === 'DEFEAT' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span className="font-black text-white uppercase tracking-wider">{titleText}</span>
          <span className="text-slate-400 tabular-nums">· {t('common.round')} {round}/20</span>
        </div>

        {/* Estado final del tablero en vivo */}
        <div className="pointer-events-auto hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/85 border border-slate-800 shadow-xl text-xs tabular-nums">
          <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
            <Trees className="w-3.5 h-3.5" />
            {commonCount} {t('hud.commonPlural')}
          </span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1.5 text-sky-300 font-bold">
            <Layers className="w-3.5 h-3.5" />
            {publicCount} {t('hud.publicPlural')}
          </span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1.5 text-rose-300 font-bold">
            <Lock className="w-3.5 h-3.5" />
            {privateCount} {t('hud.privatePlural')}
          </span>
        </div>
      </motion.div>

      {/* Controles inferiores durante el vuelo cinematográfico (cuando el modal resumen está oculto) */}
      {!showSummaryModal && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative z-10 w-full px-4 pb-6 flex flex-col items-center gap-3"
        >
          {cooperativeEfficiency && (
            <div className="pointer-events-auto w-full max-w-md px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-teal-500/40 shadow-xl space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-teal-300 uppercase tracking-wider">
                  {t('gameOverCinematic.boardCleanliness')} · {cooperativeEfficiency.tierLabel}
                </span>
                <span className="text-white tabular-nums">
                  {cooperativeEfficiency.efficiencyPct}% {t('gameOverCinematic.efficiencySuffix')}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(4, cooperativeEfficiency.efficiencyPct)}%` }}
                  transition={{ duration: 3.8, delay: 0.2, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              playSound.modalOpen();
              onToggleSummary();
            }}
            className="pointer-events-auto px-6 py-3 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border-2 border-teal-500 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>{t('gameOverCinematic.viewSummaryBtn')}</span>
          </button>
        </motion.div>
      )}

      {/* Botón discreto cuando el resumen está abierto */}
      {showSummaryModal && (
        <div className="relative z-10 w-full px-4 pb-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              playSound.uiClick();
              onToggleSummary();
            }}
            className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>{t('gameOverCinematic.view3dFlightBtn')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
