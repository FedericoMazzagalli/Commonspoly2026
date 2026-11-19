/**
 * voiceNarrator.ts
 * Motor de voz y locución de accesibilidad para Commonspoly.
 * Utiliza Web Speech Synthesis API integrado con CommonspolyAudioManager:
 * - Selección inteligente de voces en español (priorizando síntesis natural / neural).
 * - Atenuación armónica (ducking) del paisaje sonoro mientras la locutora o el narrador habla.
 * - Sincronización en tiempo real de subtítulos y palabras para accesibilidad visual y auditiva.
 * - Control de velocidad (0.85x a 1.25x), pausa, repetición y persistencia de silencio.
 */

import { useEffect, useState } from 'react';
import { audioManager, playSound } from './audio';

export interface VoiceNarratorSnapshot {
  isSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isMuted: boolean;
  rate: number;
  pitch: number;
  volume: number;
  currentVoiceName: string | null;
  availableSpanishVoices: Array<{ name: string; lang: string; default: boolean }>;
  activeText: string;
  charIndex: number;
  activeWord: string;
}

const STORAGE_KEY_VOICE_MUTED = 'commonspoly_voice_narrator_muted_v1';
const STORAGE_KEY_VOICE_RATE = 'commonspoly_voice_narrator_rate_v1';
const STORAGE_KEY_VOICE_NAME = 'commonspoly_voice_narrator_preferred_name_v1';

type Listener = (snapshot: VoiceNarratorSnapshot) => void;

class CommonspolyVoiceNarrator {
  private isSupported = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private isPaused = false;
  private isMuted = false;
  private rate = 1.0;
  private pitch = 1.0;
  private volume = 1.0;
  private activeText = '';
  private charIndex = 0;
  private activeWord = '';
  private listeners = new Set<Listener>();
  private onEndCallback: (() => void) | null = null;
  private chromeKeepAliveTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      this.isSupported = true;
      this.synth = window.speechSynthesis;

      // Cargar preferencias guardadas
      try {
        const savedMuted = localStorage.getItem(STORAGE_KEY_VOICE_MUTED);
        if (savedMuted !== null) {
          this.isMuted = savedMuted === 'true';
        }
        const savedRate = localStorage.getItem(STORAGE_KEY_VOICE_RATE);
        if (savedRate !== null) {
          const parsed = parseFloat(savedRate);
          if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.5) {
            this.rate = parsed;
          }
        }
      } catch {
        // Ignorar restricciones de almacenamiento
      }

      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.initVoices();
        };
      }
    }
  }

  private initVoices(): void {
    if (!this.synth) return;
    const allVoices = this.synth.getVoices();
    if (!allVoices || allVoices.length === 0) return;

    this.voices = allVoices;

    // Buscar voces en español
    const spanishVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith('es'));

    // Preferir voces de alta calidad / naturales en español
    let preferredVoice: SpeechSynthesisVoice | null = null;

    let savedPreferredName: string | null = null;
    try {
      savedPreferredName = localStorage.getItem(STORAGE_KEY_VOICE_NAME);
    } catch {
      // Ignorar
    }

    if (savedPreferredName) {
      preferredVoice = spanishVoices.find(v => v.name === savedPreferredName) || null;
    }

    if (!preferredVoice && spanishVoices.length > 0) {
      // Criterio heurístico de mayor calidad
      const qualityKeywords = ['natural', 'google', 'online', 'premium', 'monica', 'paulina', 'jorge', 'helena', 'castilian'];
      for (const kw of qualityKeywords) {
        const found = spanishVoices.find(v => v.name.toLowerCase().includes(kw));
        if (found) {
          preferredVoice = found;
          break;
        }
      }
      if (!preferredVoice) {
        // Primera voz en español disponible
        preferredVoice = spanishVoices[0];
      }
    }

    if (!preferredVoice && this.voices.length > 0) {
      preferredVoice = this.voices.find(v => v.default) || this.voices[0];
    }

    this.selectedVoice = preferredVoice;
    this.notify();
  }

  private notify(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach(cb => {
      try {
        cb(snap);
      } catch {
        // Ignorar errores en observadores
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): VoiceNarratorSnapshot {
    const spanishVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith('es'));
    return {
      isSupported: this.isSupported,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      isMuted: this.isMuted,
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      currentVoiceName: this.selectedVoice ? this.selectedVoice.name : null,
      availableSpanishVoices: (spanishVoices.length > 0 ? spanishVoices : this.voices.slice(0, 5)).map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default
      })),
      activeText: this.activeText,
      charIndex: this.charIndex,
      activeWord: this.activeWord
    };
  }

  /**
   * Narrar un texto explicativo con sincronización acústica
   */
  public speak(text: string, onEnd?: () => void): void {
    if (!this.isSupported || !this.synth) {
      onEnd?.();
      return;
    }

    this.stopKeepAlive();
    this.synth.cancel();

    this.activeText = text;
    this.charIndex = 0;
    this.activeWord = '';
    this.onEndCallback = onEnd || null;

    if (this.isMuted || audioManager.isMuted()) {
      this.isSpeaking = false;
      this.isPaused = false;
      this.notify();
      this.onEndCallback?.();
      this.onEndCallback = null;
      return;
    }

    try {
      // Limpiar texto para una dicción suave y natural
      const cleaned = text
        .replace(/[#*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      this.currentUtterance = utterance;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || 'es-ES';
      } else {
        utterance.lang = 'es-ES';
      }

      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        audioManager.setVoiceDucking(true);
        playSound.voiceCue();
        this.startKeepAlive();
        this.notify();
      };

      utterance.onboundary = (e: SpeechSynthesisEvent) => {
        if (e.name === 'word' || typeof e.charIndex === 'number') {
          this.charIndex = e.charIndex;
          // Extraer la palabra activa aproximada
          const remainder = cleaned.slice(e.charIndex);
          const nextSpace = remainder.search(/[\s.,;:!?]/);
          this.activeWord = nextSpace > 0 ? remainder.slice(0, nextSpace) : remainder.slice(0, 15);
          this.notify();
        }
      };

      utterance.onend = () => {
        this.handleSpeechFinished();
      };

      utterance.onerror = (e) => {
        // En navegadores, 'canceled' e 'interrupted' son eventos normales al cambiar de paso
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('[VoiceNarrator] SpeechSynthesis error:', e.error);
        }
        this.handleSpeechFinished();
      };

      utterance.onpause = () => {
        this.isPaused = true;
        this.notify();
      };

      utterance.onresume = () => {
        this.isPaused = false;
        this.notify();
      };

      // Si el sintetizador estaba pausado por llamadas previas, reanudar
      if (this.synth.paused) {
        this.synth.resume();
      }

      this.synth.speak(utterance);
      this.isSpeaking = true;
      this.notify();
    } catch (err) {
      console.warn('[VoiceNarrator] Failed to speak:', err);
      this.handleSpeechFinished();
    }
  }

  private handleSpeechFinished(): void {
    this.stopKeepAlive();
    this.isSpeaking = false;
    this.isPaused = false;
    this.charIndex = 0;
    this.activeWord = '';
    this.currentUtterance = null;
    audioManager.setVoiceDucking(false);
    this.notify();

    if (this.onEndCallback) {
      const cb = this.onEndCallback;
      this.onEndCallback = null;
      cb();
    }
  }

  /**
   * Resuelve el bug conocido de Chromium donde SpeechSynthesis se detiene a los 14s
   */
  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.chromeKeepAliveTimer = window.setInterval(() => {
      if (this.synth && this.isSpeaking && !this.isPaused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.chromeKeepAliveTimer !== null) {
      clearInterval(this.chromeKeepAliveTimer);
      this.chromeKeepAliveTimer = null;
    }
  }

  public pause(): void {
    if (!this.synth || !this.isSpeaking) return;
    this.synth.pause();
    this.isPaused = true;
    audioManager.setVoiceDucking(false);
    this.notify();
  }

  public resume(): void {
    if (!this.synth || !this.isSpeaking) return;
    this.synth.resume();
    this.isPaused = false;
    audioManager.setVoiceDucking(true);
    this.notify();
  }

  public stop(): void {
    this.stopKeepAlive();
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.charIndex = 0;
    this.activeWord = '';
    this.currentUtterance = null;
    audioManager.setVoiceDucking(false);
    this.notify();
  }

  public replay(): void {
    if (this.activeText) {
      this.speak(this.activeText, this.onEndCallback || undefined);
    }
  }

  public toggleMute(): void {
    this.setMuted(!this.isMuted);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_MUTED, String(muted));
    } catch {
      // Ignorar
    }
    if (muted) {
      this.stop();
    } else if (this.activeText && !this.isSpeaking) {
      this.replay();
    }
    this.notify();
  }

  public setRate(rate: number): void {
    const clamped = Math.max(0.75, Math.min(1.4, rate));
    this.rate = clamped;
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_RATE, String(clamped));
    } catch {
      // Ignorar
    }
    this.notify();
    // Si estaba hablando, reiniciar el paso con el nuevo ritmo
    if (this.isSpeaking && this.activeText) {
      this.replay();
    }
  }

  public setVoiceByName(voiceName: string): void {
    const found = this.voices.find(v => v.name === voiceName);
    if (found) {
      this.selectedVoice = found;
      try {
        localStorage.setItem(STORAGE_KEY_VOICE_NAME, found.name);
      } catch {
        // Ignorar
      }
      this.notify();
      if (this.isSpeaking && this.activeText) {
        this.replay();
      }
    }
  }
}

export const voiceNarrator = new CommonspolyVoiceNarrator();

/**
 * Hook React reactivo para consumir el motor de voz en componentes HUD
 */
export function useVoiceNarrator() {
  const [snapshot, setSnapshot] = useState<VoiceNarratorSnapshot>(() => voiceNarrator.getSnapshot());

  useEffect(() => {
    return voiceNarrator.subscribe(setSnapshot);
  }, []);

  return {
    ...snapshot,
    speak: (text: string, onEnd?: () => void) => voiceNarrator.speak(text, onEnd),
    stop: () => voiceNarrator.stop(),
    pause: () => voiceNarrator.pause(),
    resume: () => voiceNarrator.resume(),
    replay: () => voiceNarrator.replay(),
    toggleMute: () => voiceNarrator.toggleMute(),
    setMuted: (muted: boolean) => voiceNarrator.setMuted(muted),
    setRate: (rate: number) => voiceNarrator.setRate(rate),
    setVoiceByName: (name: string) => voiceNarrator.setVoiceByName(name)
  };
}
