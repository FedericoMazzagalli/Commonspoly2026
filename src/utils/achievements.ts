/**
 * achievements.ts
 * Sistema de logros locales ('Achievements') persistentes en localStorage.
 * Rastrea hitos cooperativos de Commonspoly entre partidas locales.
 */

import { CooperativeAchievement, GoodType, GameEngineState, GameLogEntry } from '../types/game';

export const ACHIEVEMENTS_STORAGE_KEY = 'commonspoly_local_achievements_v1';

export const ACHIEVEMENT_CATALOG: CooperativeAchievement[] = [
  {
    id: 'first_common',
    title: 'Primer bien común recuperado',
    description: 'Transforma o comunaliza tu primer recurso en Bien Común.',
    iconName: 'Trees',
    category: 'ENVIRONMENT',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'BRONZE'
  },
  {
    id: 'successful_rescue',
    title: 'Rescate solidario exitoso',
    description: 'Paga la fianza solidaria y libera a una compañera del Centro de Detención.',
    iconName: 'HeartHandshake',
    category: 'RESCUE',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'SILVER'
  },
  {
    id: 'first_public',
    title: 'Desprivatización inicial',
    description: 'Convierte un bien privado en Gestión Pública por primera vez.',
    iconName: 'Layers',
    category: 'URBAN',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'BRONZE'
  },
  {
    id: 'mutual_protection',
    title: 'Escudo vecinal',
    description: 'Comparte casilla con otra jugadora para bloquear juntas un ataque especulador.',
    iconName: 'ShieldCheck',
    category: 'SOLIDARITY',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'BRONZE'
  },
  {
    id: 'assembly_voice',
    title: 'Voz en la asamblea',
    description: 'Participa en una Asamblea barrial o en una votación colectiva.',
    iconName: 'Users',
    category: 'VOTE',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'BRONZE'
  },
  {
    id: 'commons_architect',
    title: 'Arquitecta de los comunes',
    description: 'Comunaliza 5 recursos a lo largo de tus partidas locales.',
    iconName: 'Sparkles',
    category: 'SOLIDARITY',
    isUnlocked: false,
    progress: { current: 0, target: 5 },
    tier: 'SILVER'
  },
  {
    id: 'sector_complete',
    title: 'Sector 100% comunalizado',
    description: 'Logra que todos los recursos de un mismo sector sean Bienes Comunes.',
    iconName: 'Award',
    category: 'HEALTH',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'GOLD'
  },
  {
    id: 'agora_entry',
    title: 'Rumbo al Ágora Central',
    description: 'Alcanza la Legitimidad Colectiva necesaria y entra en el Ágora Central.',
    iconName: 'Flame',
    category: 'AGORA',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'SILVER'
  },
  {
    id: 'collective_insurrection',
    title: 'Insurrección colectiva',
    description: 'Reúne a la comunidad en el Ágora Central para comunalizar todo un sector.',
    iconName: 'Flame',
    category: 'AGORA',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'GOLD'
  },
  {
    id: 'radical_victory',
    title: 'Felicidad radical',
    description: 'Consigue una Victoria Comunitaria Total comunalizando todos los bienes del tablero.',
    iconName: 'Trophy',
    category: 'KNOWLEDGE',
    isUnlocked: false,
    progress: { current: 0, target: 1 },
    tier: 'GOLD'
  }
];

interface PersistedAchievementRecord {
  id: string;
  isUnlocked: boolean;
  unlockedAtRound?: number;
  unlockedByPlayerName?: string;
  unlockedByPlayerColor?: string;
  current: number;
}

export function loadLocalAchievements(): CooperativeAchievement[] {
  const base = ACHIEVEMENT_CATALOG.map(item => ({
    ...item,
    progress: { ...item.progress }
  }));

  if (typeof window === 'undefined') return base;

  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as PersistedAchievementRecord[];
    if (!Array.isArray(parsed)) return base;

    const map = new Map(parsed.map(rec => [rec.id, rec]));
    return base.map(item => {
      const saved = map.get(item.id);
      if (!saved) return item;
      const clampedCurrent = Math.min(
        item.progress.target,
        Math.max(0, Number(saved.current) || 0)
      );
      return {
        ...item,
        isUnlocked: Boolean(saved.isUnlocked),
        unlockedAtRound: saved.unlockedAtRound,
        unlockedByPlayerName: saved.unlockedByPlayerName,
        unlockedByPlayerColor: saved.unlockedByPlayerColor,
        progress: {
          current: saved.isUnlocked ? item.progress.target : clampedCurrent,
          target: item.progress.target
        }
      };
    });
  } catch {
    return base;
  }
}

export function saveLocalAchievements(achievements: CooperativeAchievement[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedAchievementRecord[] = achievements.map(a => ({
      id: a.id,
      isUnlocked: a.isUnlocked,
      unlockedAtRound: a.unlockedAtRound,
      unlockedByPlayerName: a.unlockedByPlayerName,
      unlockedByPlayerColor: a.unlockedByPlayerColor,
      current: a.progress.current
    }));
    window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar errores de cuota o almacenamiento privado
  }
}

export function resetLocalAchievements(): CooperativeAchievement[] {
  const fresh = ACHIEVEMENT_CATALOG.map(item => ({
    ...item,
    progress: { ...item.progress }
  }));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ACHIEVEMENTS_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  }
  return fresh;
}

export interface AchievementUpdate {
  id: string;
  increment?: number;
  round: number;
  playerName?: string;
  playerColor?: string;
}

export function applyAchievementUpdates(
  currentList: CooperativeAchievement[],
  updates: AchievementUpdate[]
): {
  nextAchievements: CooperativeAchievement[];
  newlyUnlocked: CooperativeAchievement[];
  changed: boolean;
} {
  if (updates.length === 0) {
    return { nextAchievements: currentList, newlyUnlocked: [], changed: false };
  }

  let changed = false;
  const newlyUnlocked: CooperativeAchievement[] = [];
  const nextAchievements = currentList.map(ach => ({
    ...ach,
    progress: { ...ach.progress }
  }));

  updates.forEach(upd => {
    const target = nextAchievements.find(a => a.id === upd.id);
    if (!target || target.isUnlocked) return;

    const delta = upd.increment ?? 1;
    const nextCurrent = Math.min(target.progress.target, target.progress.current + delta);
    if (nextCurrent !== target.progress.current) {
      target.progress.current = nextCurrent;
      changed = true;
    }

    if (nextCurrent >= target.progress.target && !target.isUnlocked) {
      target.isUnlocked = true;
      target.unlockedAtRound = upd.round;
      target.unlockedByPlayerName = upd.playerName;
      target.unlockedByPlayerColor = upd.playerColor;
      changed = true;
      newlyUnlocked.push({ ...target, progress: { ...target.progress } });
    }
  });

  if (changed) {
    saveLocalAchievements(nextAchievements);
  }

  return { nextAchievements, newlyUnlocked, changed };
}

export function collectUpdatesFromLogEntry(entry: GameLogEntry): AchievementUpdate[] {
  const updates: AchievementUpdate[] = [];
  const meta = {
    round: entry.round,
    playerName: entry.actor,
    playerColor: entry.actorColor
  };

  if (entry.cooperativeAction === 'COMMON_UNLOCK') {
    updates.push({ id: 'first_common', increment: 1, ...meta });
    updates.push({ id: 'commons_architect', increment: 1, ...meta });
  }

  if (entry.cooperativeAction === 'PUBLIC_UNLOCK' || entry.cooperativeAction === 'BUROCRACIA') {
    updates.push({ id: 'first_public', increment: 1, ...meta });
  }

  if (entry.cooperativeAction === 'RESCUE') {
    updates.push({ id: 'successful_rescue', increment: 1, ...meta });
  }

  if (entry.cooperativeAction === 'PROTECTION') {
    updates.push({ id: 'mutual_protection', increment: 1, ...meta });
  }

  if (entry.cooperativeAction === 'COLLECTIVE_VOTE') {
    updates.push({ id: 'assembly_voice', increment: 1, ...meta });
    if (entry.actor === 'Ágora Asamblearia') {
      updates.push({ id: 'collective_insurrection', increment: 1, ...meta });
      updates.push({ id: 'first_common', increment: 1, ...meta });
    }
  }

  if (entry.cooperativeAction === 'AGORA_INSURRECTION') {
    updates.push({ id: 'agora_entry', increment: 1, ...meta });
  }

  return updates;
}

export function detectCompletedGoodCategories(state: GameEngineState): Set<GoodType> {
  const resourceTiles = state.tiles.filter(
    t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
  );
  const categories: GoodType[] = ['HEALTH', 'URBAN', 'KNOWLEDGE', 'ENVIRONMENT'];
  const completed = new Set<GoodType>();

  categories.forEach(cat => {
    const catTiles = resourceTiles.filter(t => t.goodType === cat);
    if (catTiles.length > 0 && catTiles.every(t => t.state === 'COMMON')) {
      completed.add(cat);
    }
  });

  return completed;
}
