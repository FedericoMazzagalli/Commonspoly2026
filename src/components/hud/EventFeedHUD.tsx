/**
 * EventFeedHUD.tsx
 * Feed cronológico compacto en la esquina superior derecha del HUD.
 * Muestra las últimas 5 acciones críticas ocurridas en la partida
 * (vandalismo/compras de especuladores, Crowdfunding, rescates,
 * desprivatizaciones clave, crisis, cartas y votos colectivos)
 * sin necesidad de abrir el historial completo.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Coins,
  Flame,
  HeartHandshake,
  History,
  ShieldCheck,
  Sparkles,
  Vote
} from 'lucide-react';
import {
  GameEngineState,
  GameLogEntry,
  SpeculatorActionLogEntry
} from '../../types/game';
import { playSound } from '../../utils/audio';
import { useI18n } from '../../i18n';
import { useSwipeToDismiss } from '../ui/MotionPrimitives';

interface EventFeedHUDProps {
  state: GameEngineState;
  onOpenHistory?: () => void;
  onSelectTile?: (tileId: number) => void;
}

type CriticalFeedSeverity =
  | 'HAZARD'
  | 'SPECULATOR_TILE'
  | 'COOP'
  | 'CROWDFUND'
  | 'CARD'
  | 'PROTECTION';

interface CriticalFeedItem {
  id: string;
  round: number;
  timestamp: string;
  sortKey: number;
  categoryLabel: string;
  summary: string;
  actorName: string;
  accentColor: string;
  severity: CriticalFeedSeverity;
  tileId?: number;
}

function extractNumericOrder(id: string, round: number, fallbackIdx: number): number {
  const match = id.match(/_(\d{10,14})/);
  if (match && match[1]) {
    return Number(match[1]);
  }
  return round * 100000 - fallbackIdx;
}

function findMatchingTileId(text: string, state: GameEngineState): number | undefined {
  const hashMatch = text.match(/#(\d{1,2})\b/);
  if (hashMatch && hashMatch[1]) {
    const id = Number(hashMatch[1]);
    if (state.tiles.some(t => t.id === id)) return id;
  }
  const lower = text.toLowerCase();
  const matched = state.tiles.find(
    t => t.name && t.name.length >= 4 && lower.includes(t.name.toLowerCase())
  );
  return matched?.id;
}

function isRoutineMovementNoise(log: GameLogEntry): boolean {
  const msg = log.message.toLowerCase();
  if (msg.startsWith('se desplazó ') || msg.startsWith('[sandbox] se desplazó ')) {
    return true;
  }
  if (msg.startsWith('[sandbox] congelado en la casilla')) {
    return true;
  }
  if (msg.startsWith('avanzó ') && msg.includes('casillas hasta')) {
    return true;
  }
  if (msg.includes('comienzo de la ronda')) {
    return true;
  }
  if (
    msg.includes('pasa su turno sin') ||
    msg.includes('conservando su bienestar') ||
    msg.includes('sin realizar trámites')
  ) {
    return true;
  }
  return false;
}

function classifyLogEntry(
  log: GameLogEntry,
  state: GameEngineState,
  idx: number
): CriticalFeedItem | null {
  if (isRoutineMovementNoise(log)) return null;

  const msg = log.message;
  const msgLower = msg.toLowerCase();

  // Evitar duplicar eventos de especuladores que ya vienen detallados en speculatorActionLogs
  const hasSpecLogs = (state.speculatorActionLogs?.length ?? 0) > 0;
  if (
    hasSpecLogs &&
    (msgLower.includes('¡compra especulativa!') ||
      msgLower.includes('¡vandalismo especulador!') ||
      msgLower.includes('¡atrapó a ') ||
      msgLower.includes('explotó a ') ||
      msgLower.includes('desprestigiaron a ') ||
      log.cooperativeAction === 'PROTECTION')
  ) {
    return null;
  }

  let severity: CriticalFeedSeverity | null = null;
  let categoryLabel = 'Evento';
  let summary = msg;

  if (log.cooperativeAction === 'CROWDFUND' || msgLower.includes('crowdfunding')) {
    severity = 'CROWDFUND';
    categoryLabel = 'Crowdfunding';
    const tileMatch = state.tiles.find(t => t.specialType === 'CROWDFUNDING');
    const tileLabel = tileMatch?.name || 'Crowdfunding';
    summary = log.target
      ? `Crowdfunding activado (${log.actor} → ${log.target})`
      : `Crowdfunding activado en ${tileLabel}`;
  } else if (log.cooperativeAction === 'RESCUE') {
    severity = 'COOP';
    categoryLabel = 'Rescate';
    summary = log.target
      ? `${log.actor} rescató a ${log.target} de Detención`
      : msg;
  } else if (
    log.cooperativeAction === 'AGORA_INSURRECTION' ||
    log.cooperativeAction === 'COLLECTIVE_VOTE'
  ) {
    severity = 'COOP';
    categoryLabel = 'Voto Colectivo';
    summary = msg;
  } else if (log.cooperativeAction === 'BUROCRACIA') {
    severity = 'COOP';
    categoryLabel = 'Burocracia';
    summary = msg;
  } else if (
    log.cooperativeAction === 'COMMON_UNLOCK' ||
    log.cooperativeAction === 'PUBLIC_UNLOCK'
  ) {
    severity = 'COOP';
    categoryLabel =
      log.cooperativeAction === 'COMMON_UNLOCK' ? 'Bien Común' : 'Bien Público';
    summary = msg;
  } else if (log.cooperativeAction === 'PROTECTION') {
    severity = 'PROTECTION';
    categoryLabel = 'Protección';
    summary = msg;
  } else if (log.type === 'HAZARD' || log.category === 'HAZARD') {
    severity = 'HAZARD';
    categoryLabel = msgLower.includes('tragedia')
      ? 'Tragedia'
      : msgLower.includes('detención') || msgLower.includes('detencion')
      ? 'Detención'
      : msgLower.includes('banco') || msgLower.includes('casino')
      ? 'Penalización'
      : 'Alerta';
    summary = msg;
  } else if (
    log.type === 'CARD' ||
    log.category === 'CARD' ||
    msgLower.includes('crisis') ||
    msgLower.includes('meteor')
  ) {
    severity = 'CARD';
    categoryLabel = log.actor === 'Carta Global' ? 'Carta Global' : 'Situación';
    summary = msg;
  } else if (log.highlight || log.cooperativeAction === 'SOLIDARITY') {
    severity = 'COOP';
    categoryLabel = 'Cooperación';
    summary = msg;
  }

  if (!severity) return null;

  return {
    id: `feed_log_${log.id}`,
    round: log.round,
    timestamp: log.timestamp,
    sortKey: extractNumericOrder(log.id, log.round, idx),
    categoryLabel,
    summary,
    actorName: log.actor,
    accentColor: log.actorColor || '#38bdf8',
    severity,
    tileId: findMatchingTileId(msg, state)
  };
}

function mapSpeculatorActionToFeed(
  entry: SpeculatorActionLogEntry,
  idx: number
): CriticalFeedItem | null {
  if (entry.kind === 'MOVE') return null;

  if (entry.kind === 'VANDALIZE_TILE') {
    return {
      id: `feed_spec_${entry.id}`,
      round: entry.round,
      timestamp: entry.timestamp,
      sortKey: extractNumericOrder(entry.id, entry.round, idx),
      categoryLabel: 'Vandalismo',
      summary: `${entry.speculatorName} vandalizó ${entry.tileName} (Común → Público)`,
      actorName: entry.speculatorName,
      accentColor: entry.speculatorColor,
      severity: 'SPECULATOR_TILE',
      tileId: entry.toTileId
    };
  }

  if (entry.kind === 'BUY_TILE') {
    return {
      id: `feed_spec_${entry.id}`,
      round: entry.round,
      timestamp: entry.timestamp,
      sortKey: extractNumericOrder(entry.id, entry.round, idx),
      categoryLabel: 'Compra',
      summary: `${entry.speculatorName} compró ${entry.tileName} (Público → Privado)`,
      actorName: entry.speculatorName,
      accentColor: entry.speculatorColor,
      severity: 'SPECULATOR_TILE',
      tileId: entry.toTileId
    };
  }

  if (entry.kind === 'DETAIN_PLAYER') {
    return {
      id: `feed_spec_${entry.id}`,
      round: entry.round,
      timestamp: entry.timestamp,
      sortKey: extractNumericOrder(entry.id, entry.round, idx),
      categoryLabel: 'Detención',
      summary: `${entry.speculatorName} detuvo a ${entry.targetPlayerName ?? 'jugadora'} en ${entry.tileName}`,
      actorName: entry.speculatorName,
      accentColor: entry.speculatorColor,
      severity: 'HAZARD',
      tileId: entry.toTileId
    };
  }

  if (entry.kind === 'ATTACK_PLAYER') {
    return {
      id: `feed_spec_${entry.id}`,
      round: entry.round,
      timestamp: entry.timestamp,
      sortKey: extractNumericOrder(entry.id, entry.round, idx),
      categoryLabel: 'Ataque',
      summary: entry.details,
      actorName: entry.speculatorName,
      accentColor: entry.speculatorColor,
      severity: 'HAZARD',
      tileId: entry.toTileId
    };
  }

  if (entry.kind === 'BLOCKED') {
    return {
      id: `feed_spec_${entry.id}`,
      round: entry.round,
      timestamp: entry.timestamp,
      sortKey: extractNumericOrder(entry.id, entry.round, idx),
      categoryLabel: 'Protección',
      summary: `Protección Mutua bloqueó a ${entry.speculatorName} en ${entry.tileName}`,
      actorName: entry.speculatorName,
      accentColor: '#10b981',
      severity: 'PROTECTION',
      tileId: entry.toTileId
    };
  }

  return null;
}

function getSeverityVisual(severity: CriticalFeedSeverity): {
  cardClass: string;
  badgeClass: string;
  icon: React.ReactNode;
} {
  switch (severity) {
    case 'SPECULATOR_TILE':
      return {
        cardClass: 'bg-amber-950/35 border-amber-700/50',
        badgeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-200',
        icon: <Flame className="w-3 h-3 text-amber-400 shrink-0" />
      };
    case 'HAZARD':
      return {
        cardClass: 'bg-rose-950/35 border-rose-700/50',
        badgeClass: 'bg-rose-500/20 border-rose-500/50 text-rose-200',
        icon: <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
      };
    case 'CROWDFUND':
      return {
        cardClass: 'bg-teal-950/35 border-teal-600/55',
        badgeClass: 'bg-teal-500/20 border-teal-500/50 text-teal-200',
        icon: <Coins className="w-3 h-3 text-teal-300 shrink-0" />
      };
    case 'PROTECTION':
      return {
        cardClass: 'bg-emerald-950/35 border-emerald-700/50',
        badgeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200',
        icon: <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
      };
    case 'CARD':
      return {
        cardClass: 'bg-indigo-950/35 border-indigo-700/50',
        badgeClass: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200',
        icon: <Vote className="w-3 h-3 text-indigo-300 shrink-0" />
      };
    case 'COOP':
    default:
      return {
        cardClass: 'bg-emerald-950/25 border-emerald-800/50',
        badgeClass: 'bg-emerald-500/15 border-emerald-600/50 text-emerald-200',
        icon: <HeartHandshake className="w-3 h-3 text-emerald-400 shrink-0" />
      };
  }
}

export const EventFeedHUD: React.FC<EventFeedHUDProps> = ({
  state,
  onOpenHistory,
  onSelectTile
}) => {
  const { t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const criticalEvents = useMemo(() => {
    const items: CriticalFeedItem[] = [];

    (state.speculatorActionLogs ?? []).forEach((entry, idx) => {
      const mapped = mapSpeculatorActionToFeed(entry, idx);
      if (mapped) items.push(mapped);
    });

    (state.logs ?? []).forEach((log, idx) => {
      const mapped = classifyLogEntry(log, state, idx);
      if (mapped) items.push(mapped);
    });

    // Orden cronológico descendente (más reciente primero) y tope de las últimas 5 acciones críticas
    items.sort((a, b) => b.sortKey - a.sortKey || b.round - a.round);
    return items.slice(0, 5);
  }, [state]);

  const { swipeX, swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: 'right',
    enabled: !isCollapsed,
    resetOnDismiss: true,
    onDismiss: () => {
      playSound.uiToggle(false);
      setIsCollapsed(true);
    }
  });

  return (
    <motion.section
      aria-label={t.hud.eventFeedTitle || 'Eventos Críticos'}
      style={{ x: swipeX, y: swipeY }}
      className={`pointer-events-auto w-full md:w-72 lg:w-80 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-xl text-slate-100 overflow-hidden ${touchActionClass}`}
      {...swipeHandlers}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/75 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => {
            playSound.uiToggle(isCollapsed);
            setIsCollapsed(prev => !prev);
          }}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? t.hud.eventFeedExpand || 'Mostrar feed de eventos'
              : t.hud.eventFeedCollapse || 'Ocultar feed de eventos'
          }
          className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-white truncate">
            {t.hud.eventFeedTitle || 'Eventos Críticos'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold text-amber-300 tabular-nums shrink-0">
            {criticalEvents.length}/5
          </span>
          <span className="text-slate-400 ml-0.5 shrink-0">
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-slate-200 flex items-center gap-1 shrink-0 transition-colors"
            title={t.hud.historyLog}
          >
            <History className="w-3 h-3 text-teal-300" />
            <span>{t.hud.eventFeedOpenLog || 'Historial'}</span>
          </button>
        )}
      </div>

      {/* Lista cronológica de las últimas 5 acciones críticas */}
      {!isCollapsed && (
        <div className="p-2 space-y-1.5 max-h-60 overflow-y-auto bg-slate-950/35">
          {criticalEvents.length === 0 ? (
            <div className="py-3 px-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{t.hud.eventFeedEmpty || 'Sin acciones críticas recientes.'}</span>
            </div>
          ) : (
            criticalEvents.map(item => {
              const visual = getSeverityVisual(item.severity);
              const content = (
                <>
                  <div className="flex items-center justify-between gap-1.5 text-[10px]">
                    <span className="flex items-center gap-1.5 min-w-0 font-bold">
                      {visual.icon}
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${visual.badgeClass}`}
                      >
                        {item.categoryLabel}
                      </span>
                      <span
                        className="truncate font-semibold"
                        style={{ color: item.accentColor }}
                      >
                        {item.actorName}
                      </span>
                    </span>
                    <span className="text-[9px] text-slate-400 tabular-nums shrink-0">
                      R{item.round} · {item.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">
                    {item.summary}
                  </p>
                </>
              );

              if (item.tileId !== undefined && onSelectTile) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTile(item.tileId!)}
                    title={t.hud.eventFeedInspectTile || 'Inspeccionar casilla en el tablero 3D'}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl border space-y-0.5 transition-colors hover:brightness-110 ${visual.cardClass}`}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`px-2.5 py-1.5 rounded-xl border space-y-0.5 ${visual.cardClass}`}
                >
                  {content}
                </div>
              );
            })
          )}
        </div>
      )}
    </motion.section>
  );
};
