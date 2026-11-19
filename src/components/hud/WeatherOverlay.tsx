/**
 * WeatherOverlay.tsx
 * Capa atmosférica CSS-only superpuesta sobre el HUD según el weatherMode activo:
 * - RAIN: Estelas de lluvia en ángulo con paralaje + bruma fría perimetral.
 * - SNOW: Copos de nieve oscilantes en dos planos + halo de escarcha.
 * - SUNNY: Destello solar cálido (sun glare) y haces de luz diagonales.
 * - DROUGHT: Calima cálida ascendente y partículas de polvo árido.
 * - TEMPERATE: Brisa atmosférica suave.
 */

import React from 'react';
import { WeatherMode, WeatherType } from '../../types/game';

interface WeatherOverlayProps {
  weatherType: WeatherType;
  weatherMode: WeatherMode;
  intensity: number;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  weatherType,
  weatherMode,
  intensity
}) => {
  const opacityClass =
    intensity < 0.45 ? 'opacity-45' : intensity < 0.72 ? 'opacity-70' : 'opacity-95';

  return (
    <div
      aria-hidden="true"
      data-weather-mode={weatherMode}
      data-weather-type={weatherType}
      className={`pointer-events-none select-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-700 ${opacityClass}`}
    >
      {weatherType === 'RAIN' && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(14,165,233,0.12)_100%)]" />
          <div className="absolute -top-[240px] -bottom-24 -left-24 -right-24 weather-rain-streaks" />
          <div className="absolute -top-[240px] -bottom-24 -left-24 -right-24 weather-rain-streaks-slow" />
        </>
      )}

      {weatherType === 'SNOW' && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(186,230,253,0.12)_100%)]" />
          <div className="absolute -top-[220px] -inset-x-8 bottom-0 weather-snow-layer-a" />
          <div className="absolute -top-[180px] -inset-x-8 bottom-0 weather-snow-layer-b" />
        </>
      )}

      {weatherType === 'SUNNY' && (
        <>
          <div className="absolute inset-0 weather-sun-glare-orb" />
          <div className="absolute -inset-24 weather-sun-glare-rays" />
        </>
      )}

      {weatherType === 'DROUGHT' && (
        <>
          <div className="absolute inset-0 weather-drought-haze" />
          <div className="absolute -inset-8 weather-drought-dust" />
        </>
      )}

      {weatherType === 'TEMPERATE' && (
        <div className="absolute -inset-8 weather-temperate-breeze" />
      )}
    </div>
  );
};
