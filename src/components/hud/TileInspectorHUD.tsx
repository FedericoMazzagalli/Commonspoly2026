/**
 * TileInspectorHUD.tsx
 * Inspector contextual no intrusivo al hacer clic en cualquier casilla del tablero 3D.
 */

import React from 'react';
import { AlertTriangle, CloudRain, Flame, MapPin, Snowflake, Sun, Wind, X } from 'lucide-react';
import {
  Character,
  DynamicWeatherEvent,
  GoodType,
  Speculator,
  Tile,
  UnexpectedCrisisEvent
} from '../../types/game';
import { playSound } from '../../utils/audio';
import { doesCrisisAffectTile } from '../../utils/crisisEngine';
import { doesWeatherEventAffectTile, formatWeatherImpactSummary } from '../../utils/weatherEvents';

interface TileInspectorHUDProps {
  tile: Tile | null;
  players: Character[];
  speculators: Speculator[];
  activeCrisis?: UnexpectedCrisisEvent | null;
  activeWeatherEvent?: DynamicWeatherEvent | null;
  onClose: () => void;
}

const GOOD_LABELS: Record<GoodType, string> = {
  HEALTH: 'Salud',
  URBAN: 'Urbano',
  KNOWLEDGE: 'Conocimiento',
  ENVIRONMENT: 'Medioambiente'
};

export const TileInspectorHUD: React.FC<TileInspectorHUDProps> = ({
  tile,
  players,
  speculators,
  activeCrisis = null,
  activeWeatherEvent = null,
  onClose
}) => {
  if (!tile) return null;
  const crisisAffectsTile = doesCrisisAffectTile(tile, activeCrisis);
  const weatherAffectsTile = doesWeatherEventAffectTile(tile, activeWeatherEvent);

  const occupants = players.filter(p => p.position === tile.id);
  const specOccupants = speculators.filter(s => s.position === tile.id);

  const stateLabel =
    tile.category === 'INALIENABLE_COMMON'
      ? 'Común Inalienable'
      : tile.state === 'COMMON'
      ? 'Bien Común'
      : tile.state === 'PUBLIC'
      ? 'Gestión Pública'
      : tile.state === 'PRIVATE'
      ? 'Propiedad Privada'
      : tile.category === 'AGORA_CENTER'
      ? 'Asamblea Central'
      : 'Casilla Especial';

  const stateColor =
    tile.category === 'INALIENABLE_COMMON'
      ? 'text-pink-300'
      : tile.state === 'COMMON'
      ? 'text-emerald-300'
      : tile.state === 'PUBLIC'
      ? 'text-sky-300'
      : tile.state === 'PRIVATE'
      ? 'text-rose-300'
      : 'text-teal-300';

  return (
    <div
      role="region"
      aria-label={`Inspector de casilla ${tile.name}`}
      className="pointer-events-auto fixed bottom-28 md:bottom-24 left-1/2 -translate-x-1/2 z-30 w-[90vw] max-w-sm bg-slate-900/95 border border-teal-700/70 rounded-2xl shadow-2xl px-4 py-3 text-slate-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
            <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
            <span className={`font-bold uppercase tracking-wider ${stateColor}`}>
              {stateLabel}
            </span>
            {tile.goodType && (
              <>
                <span aria-hidden="true">·</span>
                <span>{GOOD_LABELS[tile.goodType]}</span>
              </>
            )}
            {tile.transformedByName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">
                  Por {tile.transformedByName}
                  {tile.transformedAtRound ? ` (R${tile.transformedAtRound})` : ''}
                </span>
              </>
            )}
          </div>

          <h4 className="text-sm font-extrabold text-white truncate mt-0.5">
            {tile.name}
          </h4>

          <p className="text-[11px] text-slate-300 leading-snug mt-1">
            {tile.description}
          </p>

          {crisisAffectsTile && activeCrisis && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-amber-700/60 text-[10px] text-amber-200 flex items-center gap-1.5 tabular-nums">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>{activeCrisis.title}:</strong> coste desbloqueo{' '}
                {activeCrisis.unlockCostDelta >= 0
                  ? `+${activeCrisis.unlockCostDelta}`
                  : activeCrisis.unlockCostDelta}
                , rendimiento{' '}
                {activeCrisis.commonYieldDelta >= 0
                  ? `+${activeCrisis.commonYieldDelta}`
                  : activeCrisis.commonYieldDelta}{' '}
                ({activeCrisis.turnsRemaining}t)
              </span>
            </div>
          )}

          {weatherAffectsTile && activeWeatherEvent && (
            <div
              className={`mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border text-[10px] flex items-center gap-1.5 tabular-nums ${
                activeWeatherEvent.severity === 'BENEFICIAL'
                  ? 'border-emerald-600/60 text-emerald-200'
                  : 'border-cyan-600/60 text-cyan-200'
              }`}
            >
              {activeWeatherEvent.weatherType === 'RAIN' ? (
                <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              ) : activeWeatherEvent.weatherType === 'SNOW' ? (
                <Snowflake className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              ) : activeWeatherEvent.weatherType === 'SUNNY' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : activeWeatherEvent.weatherType === 'DROUGHT' ? (
                <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              ) : (
                <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>
                <strong>{activeWeatherEvent.title}:</strong>{' '}
                {formatWeatherImpactSummary(activeWeatherEvent)} ({activeWeatherEvent.turnsRemaining}t)
              </span>
            </div>
          )}

          {(occupants.length > 0 || specOccupants.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
              {occupants.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name}</span>
                </span>
              ))}
              {specOccupants.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 text-rose-300">
                  <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                  <span>{s.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            playSound.uiClick();
            onClose();
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Cerrar inspector de casilla"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
