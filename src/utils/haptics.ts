/**
 * haptics.ts
 * Gestor de vibración háptica mediante Web Vibration API (navigator.vibrate)
 * para dispositivos compatibles ante eventos críticos de la partida.
 */

export type HapticEventType =
  | 'PLAYER_TURN'
  | 'DICE_ROLL'
  | 'TRAGEDY'
  | 'DETENTION'
  | 'RESCUE'
  | 'COMMON_UNLOCKED'
  | 'SPECULATOR_HIT'
  | 'GLOBAL_CARD'
  | 'VICTORY'
  | 'DEFEAT'
  | 'UI_TAP';

const STORAGE_KEY = 'commonspoly_haptics_enabled';

const HAPTIC_PATTERNS: Record<HapticEventType, number | number[]> = {
  PLAYER_TURN: [28, 42, 52],
  DICE_ROLL: [18, 28, 18, 28, 32],
  TRAGEDY: [140, 70, 140, 70, 260],
  DETENTION: [110, 50, 180],
  RESCUE: [35, 45, 35, 45, 115],
  COMMON_UNLOCKED: [30, 35, 78],
  SPECULATOR_HIT: [85, 45, 85],
  GLOBAL_CARD: [32, 48, 32],
  VICTORY: [50, 40, 50, 40, 80, 50, 165],
  DEFEAT: [180, 90, 240],
  UI_TAP: [14]
};

class CommonspolyHapticsManager {
  private enabled: boolean;

  constructor() {
    this.enabled = this.loadPreference();
  }

  private loadPreference(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'false') return false;
      if (saved === 'true') return true;
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
    return true;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
    if (!next) {
      this.stop();
    }
  }

  public vibrate(pattern: number | number[]): boolean {
    if (!this.enabled || !this.isSupported()) return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  public trigger(event: HapticEventType): boolean {
    const pattern = HAPTIC_PATTERNS[event];
    return this.vibrate(pattern);
  }

  public stop(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Ignorar si el navegador bloquea la llamada
    }
  }
}

export const hapticsManager = new CommonspolyHapticsManager();

export const triggerHaptic = {
  playerTurn: () => hapticsManager.trigger('PLAYER_TURN'),
  diceRoll: () => hapticsManager.trigger('DICE_ROLL'),
  tragedy: () => hapticsManager.trigger('TRAGEDY'),
  detention: () => hapticsManager.trigger('DETENTION'),
  rescue: () => hapticsManager.trigger('RESCUE'),
  commonUnlocked: () => hapticsManager.trigger('COMMON_UNLOCKED'),
  speculatorHit: () => hapticsManager.trigger('SPECULATOR_HIT'),
  globalCard: () => hapticsManager.trigger('GLOBAL_CARD'),
  victory: () => hapticsManager.trigger('VICTORY'),
  defeat: () => hapticsManager.trigger('DEFEAT'),
  uiTap: () => hapticsManager.trigger('UI_TAP'),
  stop: () => hapticsManager.stop()
};
