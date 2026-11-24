/**
 * cooperativeChatStorage.ts
 * Persistencia local en LocalStorage para el historial reciente del chat cooperativo,
 * manteniendo el contexto de decisiones grupales entre turnos y recargas.
 */

import { CooperativeChatMessage } from '../types/game';

export const COOP_CHAT_STORAGE_KEY = 'commonspoly_coop_chat_v1';
const MAX_PERSISTED_CHAT_MESSAGES = 40;

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return null;
}

function isValidChatMessage(item: unknown): item is CooperativeChatMessage {
  if (!item || typeof item !== 'object') return false;
  const msg = item as Partial<CooperativeChatMessage>;
  return (
    typeof msg.id === 'string' &&
    typeof msg.senderName === 'string' &&
    typeof msg.senderColor === 'string' &&
    (msg.controller === 'HUMAN' || msg.controller === 'BOT') &&
    typeof msg.text === 'string' &&
    typeof msg.round === 'number' &&
    typeof msg.timestamp === 'string'
  );
}

export function loadCooperativeChatHistory(): CooperativeChatMessage[] {
  const storage = getSafeStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(COOP_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidChatMessage).slice(-MAX_PERSISTED_CHAT_MESSAGES);
  } catch {
    return [];
  }
}

export function saveCooperativeChatHistory(messages: CooperativeChatMessage[]): void {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    const trimmed = messages.filter(isValidChatMessage).slice(-MAX_PERSISTED_CHAT_MESSAGES);
    storage.setItem(COOP_CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore quota or serialization errors
  }
}

export function clearCooperativeChatHistory(): void {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    storage.removeItem(COOP_CHAT_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
