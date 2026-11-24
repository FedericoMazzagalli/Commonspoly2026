/**
 * TileInspectorHUD.tsx
 * Inspector contextual no intrusivo al hacer clic en cualquier casilla del tablero 3D.
 */

import React from 'react';
import { AnimatePresence } from 'motion/react';
import { AlertTriangle, CloudRain, Flame, MapPin, Snowflake, Sun, Wind, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import {
  AccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  getAccessibilityPalette
} from '../../utils/accessibility';
import { HudPanelMotion } from '../ui/MotionPrimitives';

interface TileInspectorHUDProps {
  tile: Tile | null;
  players: Character[];
  speculators: Speculator[];
  activeCrisis?: UnexpectedCrisisEvent | null;
  activeWeatherEvent?: DynamicWeatherEvent | null;
  accessibilitySettings?: AccessibilitySettings;
  onClose: () => void;
}

export const TileInspectorHUD: React.FC<TileInspectorHUDProps> = ({
  tile,
  players,
  speculators,
  activeCrisis = null,
  activeWeatherEvent = null,
  accessibilitySettings = DEFAULT_ACCESSIBILITY_SETTINGS,
  onClose
}) => {
  const { t } = useTranslation();
  const a11yPalette = getAccessibilityPalette(accessibilitySettings.colorVisionMode);

  const goodLabels: Record<GoodType, string> = {
    HEALTH: t('common.health'),
    URBAN: t('common.urban'),
    KNOWLEDGE: t('common.knowledge'),
    ENVIRONMENT: t('common.environment')
  };

  const renderTileCard = (activeTile: Tile) => {
    const crisisAffectsTile = doesCrisisAffectTile(activeTile, activeCrisis);
    const weatherAffectsTile = doesWeatherEventAffectTile(activeTile, activeWeatherEvent);

    const occupants = players.filter(p => p.position === activeTile.id);
    const specOccupants = speculators.filter(s => s.position === activeTile.id);

    const stateLabel =
      activeTile.category === 'INALIENABLE_COMMON'
        ? t('tileInspector.stateInalienable')
        : activeTile.state === 'COMMON'
        ? t('tileInspector.stateCommon')
        : activeTile.state === 'PUBLIC'
        ? t('tileInspector.statePublic')
        : activeTile.state === 'PRIVATE'
        ? t('tileInspector.statePrivate')
        : activeTile.category === 'AGORA_CENTER'
        ? t('tileInspector.stateAgora')
        : t('tileInspector.stateSpecial');

    const stateSymbol =
      accessibilitySettings.showSymbolicShapes && activeTile.state
        ? `${a11yPalette.tileStateShapes[activeTile.state]} `
        : accessibilitySettings.showSymbolicShapes && activeTile.category === 'INALIENABLE_COMMON'
        ? `${a11yPalette.tileStateShapes.COMMON} `
        : '';

    const stateCssColor =
      activeTile.state && accessibilitySettings.colorVisionMode !== 'STANDARD'
        ? a11yPalette.tileStateBadgeCss[activeTile.state]
        : undefined;

    const stateColor =
      activeTile.category === 'INALIENABLE_COMMON'
        ? 'text-pink-300'
        : activeTile.state === 'COMMON'
        ? 'text-emerald-300'
        : activeTile.state === 'PUBLIC'
        ? 'text-sky-300'
        : activeTile.state === 'PRIVATE'
        ? 'text-rose-300'
        : 'text-teal-300';

    return (
      <HudPanelMotion
        key={activeTile.id}
        as="div"
        direction="up"
        swipeDirection="down"
        onSwipeDismiss={onClose}
        role="region"
        ariaLabel={t('tileInspector.ariaPrefix', { name: activeTile.name })}
        className="pointer-events-auto fixed bottom-28 md:bottom-24 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-sm bg-slate-900/95 border border-teal-700/70 rounded-2xl px-4 py-3 text-slate-100"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
              <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
              <span
                className={`font-bold uppercase tracking-wider ${stateColor}`}
                style={stateCssColor ? { color: stateCssColor } : undefined}
              >
                {stateSymbol}{stateLabel}
              </span>
              {activeTile.goodType && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{goodLabels[activeTile.goodType]}</span>
                </>
              )}
              {activeTile.transformedByName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">
                    {t('tileInspector.byActor', { name: activeTile.transformedByName })}
                    {activeTile.transformedAtRound ? ` (R${activeTile.transformedAtRound})` : ''}
                  </span>
                </>
              )}
            </div>

            <h4 className="text-sm font-extrabold text-white truncate mt-0.5 hud-heading">
              {activeTile.name}
            </h4>

            <p className="text-[11px] text-slate-300 leading-snug mt-1">
              {activeTile.description}
            </p>

            {crisisAffectsTile && activeCrisis && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-amber-700/60 text-[10px] text-amber-200 flex items-center gap-1.5 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  <strong>{activeCrisis.title}:</strong>{' '}
                  {t('tileInspector.crisisCost', {
                    delta: activeCrisis.unlockCostDelta >= 0 ? `+${activeCrisis.unlockCostDelta}` : activeCrisis.unlockCostDelta
                  })}
                  ,{' '}
                  {t('tileInspector.crisisYield', {
                    delta: activeCrisis.commonYieldDelta >= 0 ? `+${activeCrisis.commonYieldDelta}` : activeCrisis.commonYieldDelta
                  })}{' '}
                  ({activeCrisis.turnsRemaining}t)
                </span>
              </div>
            )}

            {weatherAffectsTile && activeWeatherEvent && (
              <div
                className={`mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border text-[10px] flex items-center gap-1.5 tabular-nums ${
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
            className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label={t('tileInspector.closeAria')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </HudPanelMotion>
    );
  };

  return <AnimatePresence>{tile ? renderTileCard(tile) : null}</AnimatePresence>;
};
