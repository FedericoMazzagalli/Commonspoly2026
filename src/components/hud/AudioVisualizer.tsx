/**
 * AudioVisualizer.tsx
 * Visualizador sutil de forma de onda en tiempo real acoplado a Web Audio API (música ambiental, clima y SFX 3D).
 * Renderizado en Canvas HiDPI con envolvente suavizada y respeto a prefers-reduced-motion.
 */

import React, { useEffect, useRef } from 'react';
import { AmbientSoundscape, WeatherType } from '../../types/game';
import { audioManager } from '../../utils/audio';

interface AudioVisualizerProps {
  soundEnabled: boolean;
  soundscape?: AmbientSoundscape;
  weatherType?: WeatherType;
  canvasClassName?: string;
  className?: string;
}

function getStrokePalette(
  soundscape: AmbientSoundscape,
  weatherType: WeatherType,
  isMuted: boolean
): { start: string; end: string; glow: string } {
  if (isMuted) {
    return {
      start: 'rgba(244, 63, 94, 0.45)',
      end: 'rgba(148, 163, 184, 0.35)',
      glow: 'rgba(244, 63, 94, 0.2)'
    };
  }

  if (soundscape === 'AGORA') {
    return {
      start: '#f472b6',
      end: '#2dd4bf',
      glow: 'rgba(244, 114, 182, 0.45)'
    };
  }

  if (soundscape === 'URBAN') {
    return {
      start: '#fb923c',
      end: '#2dd4bf',
      glow: 'rgba(251, 146, 60, 0.4)'
    };
  }

  if (weatherType === 'RAIN' || weatherType === 'SNOW') {
    return {
      start: '#38bdf8',
      end: '#2dd4bf',
      glow: 'rgba(56, 189, 248, 0.4)'
    };
  }

  return {
    start: '#2dd4bf',
    end: '#34d399',
    glow: 'rgba(45, 212, 191, 0.4)'
  };
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  soundEnabled,
  soundscape = 'NATURE',
  weatherType = 'SUNNY',
  canvasClassName = 'w-14 md:w-16 h-5',
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const soundscapeRef = useRef(soundscape);
  const weatherTypeRef = useRef(weatherType);

  soundEnabledRef.current = soundEnabled;
  soundscapeRef.current = soundscape;
  weatherTypeRef.current = weatherType;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const motionQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let rafId = 0;
    let smoothedAmbient = 0;
    let smoothedSfx = 0;
    let smoothedActivity = 0;
    let lastDrawTime = 0;

    const sampleCount = 28;
    const pointsX = new Float32Array(sampleCount);
    const pointsY = new Float32Array(sampleCount);

    const drawFrame = (timestamp: number) => {
      const reducedMotion = Boolean(motionQuery?.matches);
      if (reducedMotion && timestamp - lastDrawTime < 220) {
        rafId = window.requestAnimationFrame(drawFrame);
        return;
      }
      lastDrawTime = timestamp;

      const cssWidth = canvas.clientWidth || 64;
      const cssHeight = canvas.clientHeight || 20;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
      const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx2d.save();
      ctx2d.scale(dpr, dpr);
      ctx2d.clearRect(0, 0, cssWidth, cssHeight);

      const snapshot = audioManager.getVisualizerSnapshot();
      const isLive = soundEnabledRef.current && snapshot.isActive && !snapshot.isMuted;

      const targetAmbient = isLive ? snapshot.ambientRms : 0;
      const targetSfx = isLive ? snapshot.sfxRms : 0;
      const targetActivity = isLive ? 1 : 0;

      // Suavizado exponencial rápido en ataque, gradual en decaimiento
      smoothedAmbient += (targetAmbient - smoothedAmbient) * (targetAmbient > smoothedAmbient ? 0.25 : 0.08);
      smoothedSfx += (targetSfx - smoothedSfx) * (targetSfx > smoothedSfx ? 0.45 : 0.12);
      smoothedActivity += (targetActivity - smoothedActivity) * 0.14;

      const midY = cssHeight / 2;
      const maxAmplitude = Math.max(2, (cssHeight - 4) / 2);
      const paddingX = 2;
      const drawWidth = Math.max(4, cssWidth - paddingX * 2);

      const palette = getStrokePalette(
        snapshot.soundscape || soundscapeRef.current,
        snapshot.weatherType || weatherTypeRef.current,
        !soundEnabledRef.current || snapshot.isMuted
      );

      // Línea guía central muy sutil
      ctx2d.beginPath();
      ctx2d.moveTo(paddingX, midY);
      ctx2d.lineTo(cssWidth - paddingX, midY);
      ctx2d.strokeStyle = isLive ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.18)';
      ctx2d.lineWidth = 1;
      ctx2d.stroke();

      const waveform = snapshot.waveform;
      const wfLen = waveform.length;
      const step = wfLen / sampleCount;

      // Ganancia adaptativa: realza con suavidad el ambiente cuando no hay SFX, y abre rango para picos de SFX
      const adaptiveBoost = 2.8 + (1 - Math.min(1, smoothedSfx * 1.4)) * 3.0;
      const envelopeFloor = smoothedAmbient * 0.22 + smoothedSfx * 0.65;

      for (let i = 0; i < sampleCount; i++) {
        const t = i / (sampleCount - 1);
        // Ventana de Hann para extremos limpios en los bordes izquierdo y derecho
        const windowWeight = Math.sin(Math.PI * t);

        const idx = Math.min(wfLen - 1, Math.floor(i * step));
        const rawSample = (waveform[idx] - 128) / 128;

        let shaped = 0;
        if (reducedMotion) {
          shaped = Math.sin(t * Math.PI * 3) * Math.min(0.65, envelopeFloor) * windowWeight;
        } else {
          const compressed = Math.tanh(rawSample * adaptiveBoost);
          const subtleCarrier =
            Math.sin(t * Math.PI * 4 + timestamp * 0.0045) * Math.min(0.28, smoothedAmbient * 0.36);
          shaped = (compressed * 0.85 + subtleCarrier) * windowWeight * smoothedActivity;
        }

        pointsX[i] = paddingX + t * drawWidth;
        pointsY[i] = midY + shaped * maxAmplitude;
      }

      // Trazo suave de la forma de onda usando curvas cuadráticas
      const grad = ctx2d.createLinearGradient(paddingX, 0, cssWidth - paddingX, 0);
      grad.addColorStop(0, palette.start);
      grad.addColorStop(1, palette.end);

      ctx2d.beginPath();
      ctx2d.moveTo(pointsX[0], pointsY[0]);
      for (let i = 1; i < sampleCount - 1; i++) {
        const xc = (pointsX[i] + pointsX[i + 1]) / 2;
        const yc = (pointsY[i] + pointsY[i + 1]) / 2;
        ctx2d.quadraticCurveTo(pointsX[i], pointsY[i], xc, yc);
      }
      ctx2d.lineTo(pointsX[sampleCount - 1], pointsY[sampleCount - 1]);

      const energyGlow = Math.min(1, smoothedSfx * 1.2 + smoothedAmbient * 0.3);
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = isLive ? 1.35 + smoothedSfx * 0.5 : 1.1;
      ctx2d.lineCap = 'round';
      ctx2d.lineJoin = 'round';
      ctx2d.globalAlpha = isLive ? 0.68 + energyGlow * 0.32 : 0.55;
      if (isLive && smoothedSfx > 0.08) {
        ctx2d.shadowColor = palette.glow;
        ctx2d.shadowBlur = 4 + smoothedSfx * 5;
      }
      ctx2d.stroke();

      // Reflejo tenue simétrico bajo picos de sonido
      if (isLive && (smoothedAmbient > 0.04 || smoothedSfx > 0.04)) {
        ctx2d.shadowBlur = 0;
        ctx2d.beginPath();
        ctx2d.moveTo(pointsX[0], midY - (pointsY[0] - midY) * 0.45);
        for (let i = 1; i < sampleCount - 1; i++) {
          const xc = (pointsX[i] + pointsX[i + 1]) / 2;
          const yc = midY - ((pointsY[i] + pointsY[i + 1]) / 2 - midY) * 0.45;
          const yi = midY - (pointsY[i] - midY) * 0.45;
          ctx2d.quadraticCurveTo(pointsX[i], yi, xc, yc);
        }
        ctx2d.lineTo(pointsX[sampleCount - 1], midY - (pointsY[sampleCount - 1] - midY) * 0.45);
        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = 1;
        ctx2d.globalAlpha = 0.22 + smoothedSfx * 0.25;
        ctx2d.stroke();
      }

      ctx2d.restore();
      rafId = window.requestAnimationFrame(drawFrame);
    };

    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const statusText = !soundEnabled
    ? 'Audio silenciado'
    : soundscape === 'AGORA'
    ? 'Audio en vivo · Ágora'
    : soundscape === 'URBAN'
    ? 'Audio en vivo · Urbano'
    : 'Audio en vivo · Naturaleza';

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-slate-950/80 border border-slate-800/80 px-2 py-1 shrink-0 ${className}`}
      title={statusText}
      aria-label={statusText}
      role="img"
    >
      <canvas
        ref={canvasRef}
        className={`block pointer-events-none ${canvasClassName}`}
      />
    </div>
  );
};
