/**
 * gameTimeline.ts
 * Utilidad para extraer, clasificar y ordenar cronológicamente los hitos clave
 * de la partida de Commonspoly a partir de los logs, logros desbloqueados,
 * crisis inesperadas, eventos de asamblea y desenlaces del juego.
 */

import {
  CooperativeAchievement,
  GameEngineState,
  GameLogEntry
} from '../types/game';

export type MilestoneCategory =
  | 'ALL'
  | 'TRAGEDY'
  | 'ACHIEVEMENT'
  | 'CRISIS'
  | 'COMMON'
  | 'AGORA'
  | 'DECISION'
  | 'RESCUE'
  | 'CARD'
  | 'GAME_OVER';

export interface GameMilestone {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  round: number;
  timestamp: string;
  timestampMs: number;
  actor: string;
  actorColor?: string;
  badgeLabel: string;
  badgeClass: string;
  iconType:
    | 'TRAGEDY'
    | 'ACHIEVEMENT'
    | 'CRISIS'
    | 'COMMON'
    | 'AGORA'
    | 'DECISION'
    | 'RESCUE'
    | 'DETENTION'
    | 'CARD'
    | 'VICTORY'
    | 'DRAW'
    | 'DEFEAT';
  impact?: string;
  highlight?: boolean;
}

/**
 * Extrae el timestamp en milisegundos a partir de un identificador de log o fallback.
 */
function extractTimestampMs(id: string, fallbackOffsetMs: number): number {
  const match = id.match(/_(\d{10,14})/);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (!Number.isNaN(val) && val > 1600000000000) {
      return val;
    }
  }
  return Date.now() - fallbackOffsetMs;
}

/**
 * Analiza un registro de log y determina si representa un hito clave de la partida.
 */
export function extractMilestonesFromGame(
  logs: GameLogEntry[],
  achievements?: CooperativeAchievement[],
  gameResult?: GameEngineState['gameResult'],
  gameResultDetails?: string
): GameMilestone[] {
  const milestones: GameMilestone[] = [];
  const processedKeys = new Set<string>();

  // 1. Procesar registros de logs en busca de hitos clave
  logs.forEach((log, idx) => {
    const msgLower = log.message.toLowerCase();
    const fallbackMs = (logs.length - idx) * 1500;
    const tsMs = extractTimestampMs(log.id, fallbackMs);

    // A. Tragedia de los Comunes (Inicio o Votación de Sacrificio)
    if (
      msgLower.includes('tragedia de los comunes') ||
      msgLower.includes('tragedia') && (log.type === 'HAZARD' || log.category === 'HAZARD' || log.cooperativeAction === 'COLLECTIVE_VOTE')
    ) {
      const isStart =
        msgLower.includes('ha caído en la tragedia') ||
        msgLower.includes('comienza la asamblea de emergencia') ||
        msgLower.includes('inicia la tragedia');
      const isVote = msgLower.includes('sacrificar') || msgLower.includes('consensuó');

      const title = isStart
        ? 'Alerta: Inicio de Tragedia de los Comunes'
        : isVote
        ? 'Consenso de Tragedia: Privatización Forzada'
        : 'Golpe Especulador: Tragedia de los Comunes';

      milestones.push({
        id: `m_tragedy_${log.id}`,
        category: 'TRAGEDY',
        title,
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor || 'Especuladores',
        actorColor: log.actorColor || '#f43f5e',
        badgeLabel: 'Tragedia',
        badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800/70',
        iconType: 'TRAGEDY',
        impact: isVote ? 'Privatización de emergencia' : 'Votación obligatoria',
        highlight: true
      });
      return;
    }

    // B. Crisis Inesperada
    if (
      msgLower.includes('crisis inesperada') ||
      msgLower.includes('burbuja especulativa') ||
      msgLower.includes('escasez de suministros') ||
      msgLower.includes('patentes digitales') ||
      msgLower.includes('estrés hídrico') ||
      msgLower.includes('inflación general') ||
      msgLower.includes('fondo vecinal de emergencia')
    ) {
      const isOpportunity = msgLower.includes('fondo vecinal') || msgLower.includes('solidaridad imprevista');
      const isExpired = msgLower.includes('resuelta') || msgLower.includes('expir');

      milestones.push({
        id: `m_crisis_${log.id}`,
        category: 'CRISIS',
        title: isExpired
          ? 'Resolución de Crisis Inesperada'
          : isOpportunity
          ? 'Oportunidad: Fondo Vecinal de Emergencia'
          : 'Crisis Inesperada en el Tablero',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor || 'Barrio',
        actorColor: log.actorColor || (isOpportunity ? '#10b981' : '#f97316'),
        badgeLabel: isOpportunity ? 'Oportunidad' : 'Crisis',
        badgeClass: isOpportunity
          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
          : 'bg-amber-950/80 text-amber-300 border-amber-800/70',
        iconType: 'CRISIS',
        impact: isOpportunity ? '-2 coste desbloqueo' : '+coste desbloqueo',
        highlight: true
      });
      return;
    }

    // C. Desbloqueo de Logro (desde el log)
    if (
      msgLower.includes('logro desbloqueado') ||
      (log.type === 'SUCCESS' && log.category === 'COOPERATIVE' && msgLower.includes('logro'))
    ) {
      milestones.push({
        id: `m_ach_${log.id}`,
        category: 'ACHIEVEMENT',
        title: '¡Logro Cooperativo Desbloqueado!',
        description: log.message.replace(/^🏆\s*¡Logro desbloqueado!\s*/i, ''),
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor || 'Comunidad',
        actorColor: log.actorColor || '#facc15',
        badgeLabel: 'Logro',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
        iconType: 'ACHIEVEMENT',
        impact: 'Hito comunitario',
        highlight: true
      });
      return;
    }

    // D. Ágora Central e Insurrección Colectiva
    if (
      log.cooperativeAction === 'AGORA_INSURRECTION' ||
      msgLower.includes('insurrección') ||
      msgLower.includes('entró al ágora') ||
      msgLower.includes('asamblea del ágora')
    ) {
      const isInsurrection = msgLower.includes('insurrección');
      milestones.push({
        id: `m_agora_${log.id}`,
        category: 'AGORA',
        title: isInsurrection
          ? '¡Insurrección Colectiva en el Ágora!'
          : 'Llegada al Ágora Central',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor,
        actorColor: log.actorColor || '#c084fc',
        badgeLabel: isInsurrection ? 'Insurrección' : 'Ágora',
        badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-800/70',
        iconType: 'AGORA',
        impact: isInsurrection ? 'Desprivatización sectorial' : 'Poder asambleario',
        highlight: true
      });
      return;
    }

    // E. Decisiones Barriales y Asambleas
    if (
      log.cooperativeAction === 'COLLECTIVE_VOTE' ||
      msgLower.includes('decisión barrial') ||
      msgLower.includes('asamblea barrial') ||
      msgLower.includes('votación comunitaria')
    ) {
      milestones.push({
        id: `m_decision_${log.id}`,
        category: 'DECISION',
        title: 'Asamblea y Decisión Barrial',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor,
        actorColor: log.actorColor || '#38bdf8',
        badgeLabel: 'Decisión',
        badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-800/70',
        iconType: 'DECISION',
        impact: 'Votación directa',
        highlight: false
      });
      return;
    }

    // F. Comunalizaciones de Gran Impacto (Común o Público)
    if (
      log.cooperativeAction === 'COMMON_UNLOCK' ||
      log.cooperativeAction === 'PUBLIC_UNLOCK' ||
      (msgLower.includes('comunaliz') && (log.type === 'SUCCESS' || log.highlight))
    ) {
      const isFullCommon = log.cooperativeAction === 'COMMON_UNLOCK' || msgLower.includes('bien común');
      milestones.push({
        id: `m_common_${log.id}`,
        category: 'COMMON',
        title: isFullCommon
          ? 'Recuperación de Bien Común'
          : 'Paso a Gestión Pública Social',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor,
        actorColor: log.actorColor || '#10b981',
        badgeLabel: isFullCommon ? 'Común' : 'Público',
        badgeClass: isFullCommon
          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
          : 'bg-teal-950/80 text-teal-300 border-teal-800/70',
        iconType: 'COMMON',
        impact: isFullCommon ? 'Bien Común 100%' : 'Bienes desprivatizados',
        highlight: isFullCommon
      });
      return;
    }

    // G. Detenciones y Rescates Solidarios
    if (
      log.cooperativeAction === 'RESCUE' ||
      msgLower.includes('centro de detención') ||
      msgLower.includes('retenido') ||
      msgLower.includes('rescatado') ||
      msgLower.includes('fianza')
    ) {
      const isRescue = log.cooperativeAction === 'RESCUE' || msgLower.includes('rescat') || msgLower.includes('libera');
      milestones.push({
        id: `m_rescue_${log.id}`,
        category: 'RESCUE',
        title: isRescue ? 'Rescate Solidario de Fianza' : 'Detención Policial de Activista',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: log.actor,
        actorColor: log.actorColor || (isRescue ? '#2dd4bf' : '#fb7185'),
        badgeLabel: isRescue ? 'Rescate' : 'Detención',
        badgeClass: isRescue
          ? 'bg-teal-950/80 text-teal-300 border-teal-800/70'
          : 'bg-rose-950/80 text-rose-300 border-rose-800/70',
        iconType: isRescue ? 'RESCUE' : 'DETENTION',
        impact: isRescue ? 'Liberación solidaria' : 'Fianza requerida',
        highlight: isRescue
      });
      return;
    }

    // H. Cartas Globales de Ronda
    if (log.category === 'CARD' || msgLower.includes('carta global')) {
      milestones.push({
        id: `m_card_${log.id}`,
        category: 'CARD',
        title: 'Nueva Carta Global de la Ronda',
        description: log.message,
        round: log.round,
        timestamp: log.timestamp,
        timestampMs: tsMs,
        actor: 'Consejo Social',
        actorColor: '#60a5fa',
        badgeLabel: 'Carta Global',
        badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-800/70',
        iconType: 'CARD',
        impact: `Ronda ${log.round}`
      });
    }
  });

  // 2. Incorporar logros de `achievements` que no hayan sido registrados en logs
  if (achievements && achievements.length > 0) {
    achievements.forEach(ach => {
      if (!ach.isUnlocked) return;
      const key = `ach_title_${ach.id}`;
      // Evitar duplicados si ya fue extraído de un log con el mismo título
      const alreadyLogged = milestones.some(
        m => m.category === 'ACHIEVEMENT' && m.description.includes(ach.title)
      );
      if (alreadyLogged || processedKeys.has(key)) return;
      processedKeys.add(key);

      const achRound = ach.unlockedAtRound ?? 1;
      milestones.push({
        id: `m_ach_state_${ach.id}`,
        category: 'ACHIEVEMENT',
        title: `Logro: ${ach.title}`,
        description: ach.description,
        round: achRound,
        timestamp: `R${achRound}`,
        timestampMs: Date.now() - (20 - achRound) * 60000,
        actor: ach.unlockedByPlayerName || 'Comunidad',
        actorColor: ach.unlockedByPlayerColor || '#facc15',
        badgeLabel: `Logro ${ach.tier ? ach.tier : ''}`,
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
        iconType: 'ACHIEVEMENT',
        impact: `Tier ${ach.tier || 'Bronce'}`,
        highlight: true
      });
    });
  }

  // 3. Incorporar Desenlace si la partida ha finalizado
  if (gameResult) {
    const isVictory = gameResult === 'VICTORY';
    const isDraw = gameResult === 'DRAW';
    const now = Date.now();

    milestones.push({
      id: 'm_game_result',
      category: 'GAME_OVER',
      title: isVictory
        ? '¡Victoria Comunitaria de los Bienes Comunes!'
        : isDraw
        ? 'Desenlace: Empate Social de Transición'
        : 'Fin de Partida: Avance Neoliberal',
      description:
        gameResultDetails ||
        (isVictory
          ? 'Todos los bienes de la sociedad han sido desprivatizados y comunalizados.'
          : 'La partida ha llegado a su desenlace final.'),
      round: 20,
      timestamp: 'Final',
      timestampMs: now + 1000,
      actor: 'Desenlace',
      actorColor: isVictory ? '#10b981' : isDraw ? '#38bdf8' : '#f43f5e',
      badgeLabel: isVictory ? 'Victoria' : isDraw ? 'Empate' : 'Derrota',
      badgeClass: isVictory
        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
        : isDraw
        ? 'bg-sky-950 text-sky-300 border-sky-700'
        : 'bg-rose-950 text-rose-300 border-rose-700',
      iconType: isVictory ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT',
      impact: isVictory ? 'Regeneración Plena' : 'Balance Final',
      highlight: true
    });
  }

  // Ordenar cronológicamente (de más antiguo a más reciente por defecto)
  milestones.sort((a, b) => a.timestampMs - b.timestampMs);

  return milestones;
}
