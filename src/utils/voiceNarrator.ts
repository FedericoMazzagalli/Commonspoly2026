/**
 * voiceNarrator.ts
 * Motor de voz, perfiles narrativos y locución de accesibilidad para Commonspoly.
 * Incluye perfiles dedicados para los 8 personajes oficiales (Carolina, Chelsea,
 * Matsuko, Moha, Prafulla, Temple, Whina, Yayo) además de la Voz del Ágora.
 * Utiliza Web Speech Synthesis API integrado con CommonspolyAudioManager:
 * - Calibración de tono (pitch), ritmo (rate) y selección inteligente de voz.
 * - Atenuación armónica (ducking) del paisaje sonoro mientras la voz está activa.
 * - Preescucha (preview) por perfil y persistencia local.
 */

import { useEffect, useState } from 'react';
import { audioManager, playSound } from './audio';

export type NarrativeProfileId =
  | 'carolina'
  | 'chelsea'
  | 'matsuko'
  | 'moha'
  | 'prafulla'
  | 'temple'
  | 'whina'
  | 'yayo'
  | 'agora_voice';

export interface VoiceNarrativeProfile {
  id: NarrativeProfileId;
  characterId?: string;
  name: string;
  characterArchetype: string;
  tagline: string;
  description: string;
  recommendedPitch: number;
  recommendedRate: number;
  voiceGenderPreference: 'FEMALE' | 'MALE' | 'NEUTRAL';
  samplePhrase: string;
  badgeLabel: string;
  colorHex: string;
}

export const NARRATIVE_PROFILES: VoiceNarrativeProfile[] = [
  {
    id: 'carolina',
    characterId: 'carolina',
    name: 'Carolina',
    characterArchetype: 'Trabajadora doméstica · Cuidar 6',
    tagline: 'Enérgica, cálida y combativa',
    description:
      'Locución cercana y decidida, centrada en los cuidados, la defensa laboral y la solidaridad mutua en el barrio.',
    recommendedPitch: 1.08,
    recommendedRate: 1.06,
    voiceGenderPreference: 'FEMALE',
    samplePhrase:
      '¡Hola compañeras! Soy Carolina. En este barrio cuidarnos mutuamente es nuestra mayor fuerza frente a la especulación.',
    badgeLabel: 'Salud & Cuidados',
    colorHex: '#D946EF'
  },
  {
    id: 'chelsea',
    characterId: 'chelsea',
    name: 'Chelsea',
    characterArchetype: 'Seguridad digital & Activista LGTB · Compartir 6',
    tagline: 'Ágil, lúcida y conectada',
    description:
      'Locución clara y dinámica enfocada en la cultura libre, el conocimiento abierto y la coordinación táctica.',
    recommendedPitch: 1.02,
    recommendedRate: 1.05,
    voiceGenderPreference: 'FEMALE',
    samplePhrase:
      'Soy Chelsea. Compartir el conocimiento y las redes abiertas libera la ciudad del control privado.',
    badgeLabel: 'Conocimiento Libre',
    colorHex: '#3B82F6'
  },
  {
    id: 'matsuko',
    characterId: 'matsuko',
    name: 'Matsuko',
    characterArchetype: 'Actor & Activista · Compartir 4 / Regenerar 4',
    tagline: 'Expresivo, vibrante y teatral',
    description:
      'Locución con presencia escénica y calidez cultural que invita a transformar la ciudad en un espacio diverso.',
    recommendedPitch: 0.98,
    recommendedRate: 1.04,
    voiceGenderPreference: 'MALE',
    samplePhrase:
      '¡Arriba el telón ciudadano! Soy Matsuko, y juntas convertiremos estas calles en un escenario común y diverso.',
    badgeLabel: 'Cultura & Diversidad',
    colorHex: '#8B5CF6'
  },
  {
    id: 'moha',
    characterId: 'moha',
    name: 'Moha',
    characterArchetype: 'Activista antirracista · Ocupar 4 / Compartir 4',
    tagline: 'Firme, directo y reivindicativo',
    description:
      'Locución serena y contundente centrada en el derecho a la ciudad, la inclusión y la resistencia frente al despojo.',
    recommendedPitch: 0.92,
    recommendedRate: 1.0,
    voiceGenderPreference: 'MALE',
    samplePhrase:
      'Soy Moha. Una ciudad justa se construye ocupando espacios comunes donde todas las personas tengamos voz y hogar.',
    badgeLabel: 'Derecho a la Ciudad',
    colorHex: '#F97316'
  },
  {
    id: 'prafulla',
    characterId: 'prafulla',
    name: 'Prafulla',
    characterArchetype: 'Cocinero ecológico solidario · Ocupar 6',
    tagline: 'Acogedor, generoso y pausado',
    description:
      'Locución amable y hospitalaria enfocada en recuperar espacios urbanos para la vida comunitaria y la soberanía alimentaria.',
    recommendedPitch: 0.94,
    recommendedRate: 0.96,
    voiceGenderPreference: 'MALE',
    samplePhrase:
      'Bienvenidas a mi cocina ambulante, soy Prafulla. Cuando ocupamos lo urbano en comunidad, nadie pasa hambre ni soledad.',
    badgeLabel: 'Urbano & Solidario',
    colorHex: '#EAB308'
  },
  {
    id: 'temple',
    characterId: 'temple',
    name: 'Temple',
    characterArchetype: 'Veterinaria & Zoóloga · Cuidar 5 / Ocupar 4',
    tagline: 'Metódica, observadora y precisa',
    description:
      'Locución estructurada y cristalina que analiza paso a paso las reglas, costes de bienestar y equilibrio de las especies.',
    recommendedPitch: 1.04,
    recommendedRate: 0.95,
    voiceGenderPreference: 'FEMALE',
    samplePhrase:
      'Soy Temple. Observar con rigor el bienestar de cada habitante y cada especie nos permite cuidar el equilibrio común.',
    badgeLabel: 'Rigor & Bienestar',
    colorHex: '#10B981'
  },
  {
    id: 'whina',
    characterId: 'whina',
    name: 'Whina',
    characterArchetype: 'Profesora & Investigadora · Cuidar 4 / Regenerar 4',
    tagline: 'Pedagógica, serena y comunitaria',
    description:
      'Locución didáctica y paciente, ideal para comprender los vínculos entre enseñanza pública, territorio y bienes comunes.',
    recommendedPitch: 1.0,
    recommendedRate: 0.93,
    voiceGenderPreference: 'FEMALE',
    samplePhrase:
      'Soy Whina. La tierra y la enseñanza pública son raíces vivas: protegerlas garantiza el futuro de toda la comunidad.',
    badgeLabel: 'Pedagogía & Tierra',
    colorHex: '#14B8A6'
  },
  {
    id: 'yayo',
    characterId: 'yayo',
    name: 'Yayo',
    characterArchetype: 'Profesora ecofeminista · Regenerar 6',
    tagline: 'Reflexiva, elocuente y ecologista',
    description:
      'Locución profunda y esclarecedora sobre la ecodependencia, la regeneración ambiental y la sostenibilidad de la vida.',
    recommendedPitch: 0.98,
    recommendedRate: 0.94,
    voiceGenderPreference: 'FEMALE',
    samplePhrase:
      'Soy Yayo. La vida es vulnerable y ecodependiente; regenerar los bienes comunes es la única economía que sostiene el mundo.',
    badgeLabel: 'Ecofeminismo',
    colorHex: '#059669'
  },
  {
    id: 'agora_voice',
    name: 'Voz del Ágora',
    characterArchetype: 'Asamblea Soberana',
    tagline: 'Solemne, coral e inspiradora',
    description:
      'Locución colectiva de proclama popular para acompañar las decisiones democráticas, votaciones y la insurrección final.',
    recommendedPitch: 0.96,
    recommendedRate: 0.98,
    voiceGenderPreference: 'NEUTRAL',
    samplePhrase:
      '¡El Ágora nos convoca! La legitimidad acumulada es la fuerza viva de los pueblos libres.',
    badgeLabel: 'Asamblea Común',
    colorHex: '#EC4899'
  }
];

export interface VoiceNarratorSnapshot {
  isSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isMuted: boolean;
  rate: number;
  pitch: number;
  volume: number;
  currentProfileId: NarrativeProfileId;
  currentProfile: VoiceNarrativeProfile;
  profiles: VoiceNarrativeProfile[];
  currentVoiceName: string | null;
  availableSpanishVoices: Array<{ name: string; lang: string; default: boolean }>;
  allVoices: Array<{ name: string; lang: string; default: boolean }>;
  activeText: string;
  charIndex: number;
  activeWord: string;
  previewingProfileId: NarrativeProfileId | null;
}

const STORAGE_KEY_VOICE_PROFILE = 'commonspoly_voice_narrator_profile_v2';
const STORAGE_KEY_VOICE_MUTED = 'commonspoly_voice_narrator_muted_v2';
const STORAGE_KEY_VOICE_RATE = 'commonspoly_voice_narrator_rate_v2';
const STORAGE_KEY_VOICE_PITCH = 'commonspoly_voice_narrator_pitch_v2';
const STORAGE_KEY_VOICE_NAME = 'commonspoly_voice_narrator_preferred_name_v2';

type Listener = (snapshot: VoiceNarratorSnapshot) => void;

function migrateLegacyProfileId(raw: string | null): NarrativeProfileId | null {
  if (!raw) return null;
  if (raw === 'activist') return 'carolina';
  if (raw === 'chronicler') return 'yayo';
  if (raw === 'eco_monitor') return 'chelsea';
  if (NARRATIVE_PROFILES.some(p => p.id === raw)) {
    return raw as NarrativeProfileId;
  }
  return null;
}

class CommonspolyVoiceNarrator {
  private isSupported = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentProfileId: NarrativeProfileId = 'carolina';
  private isSpeaking = false;
  private isPaused = false;
  private isMuted = false;
  private rate = 1.06;
  private pitch = 1.08;
  private volume = 1.0;
  private activeText = '';
  private charIndex = 0;
  private activeWord = '';
  private previewingProfileId: NarrativeProfileId | null = null;
  private listeners = new Set<Listener>();
  private onEndCallback: (() => void) | null = null;
  private chromeKeepAliveTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      this.isSupported = true;
      this.synth = window.speechSynthesis;

      try {
        const savedProfile = migrateLegacyProfileId(localStorage.getItem(STORAGE_KEY_VOICE_PROFILE));
        if (savedProfile) {
          this.currentProfileId = savedProfile;
          const p = NARRATIVE_PROFILES.find(item => item.id === savedProfile);
          if (p) {
            this.rate = p.recommendedRate;
            this.pitch = p.recommendedPitch;
          }
        }

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

        const savedPitch = localStorage.getItem(STORAGE_KEY_VOICE_PITCH);
        if (savedPitch !== null) {
          const parsed = parseFloat(savedPitch);
          if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.4) {
            this.pitch = parsed;
          }
        }
      } catch {
        // Ignorar restricciones en entornos aislados
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
    this.applyProfileVoice(this.currentProfileId);
  }

  private applyProfileVoice(profileId: NarrativeProfileId): void {
    const profile = NARRATIVE_PROFILES.find(p => p.id === profileId) || NARRATIVE_PROFILES[0];
    const spanishVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith('es'));
    const candidateVoices = spanishVoices.length > 0 ? spanishVoices : this.voices;

    let preferredVoice: SpeechSynthesisVoice | null = null;

    let savedPreferredName: string | null = null;
    try {
      savedPreferredName = localStorage.getItem(STORAGE_KEY_VOICE_NAME);
    } catch {
      // Ignorar
    }

    if (savedPreferredName) {
      preferredVoice = candidateVoices.find(v => v.name === savedPreferredName) || null;
    }

    if (!preferredVoice && candidateVoices.length > 0) {
      const femaleKeywords = ['monica', 'paulina', 'helena', 'laura', 'dalia', 'ana', 'elvira', 'female', 'mujer', 'sabina', 'lucia', 'sofia'];
      const maleKeywords = ['jorge', 'diego', 'pablo', 'juan', 'carlos', 'male', 'hombre', 'alvaro', 'enrique', 'miguel', 'tomas'];

      if (profile.voiceGenderPreference === 'FEMALE') {
        preferredVoice = candidateVoices.find(v =>
          femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        ) || null;
      } else if (profile.voiceGenderPreference === 'MALE') {
        preferredVoice = candidateVoices.find(v =>
          maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        ) || null;
      }

      if (!preferredVoice) {
        const qualityKeywords = ['natural', 'google', 'online', 'premium', 'castilian'];
        for (const kw of qualityKeywords) {
          const found = candidateVoices.find(v => v.name.toLowerCase().includes(kw));
          if (found) {
            preferredVoice = found;
            break;
          }
        }
      }

      if (!preferredVoice && candidateVoices.length > 0) {
        preferredVoice = candidateVoices.find(v => v.default) || candidateVoices[0];
      }
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
    const currentProfile = NARRATIVE_PROFILES.find(p => p.id === this.currentProfileId) || NARRATIVE_PROFILES[0];

    return {
      isSupported: this.isSupported,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      isMuted: this.isMuted,
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      currentProfileId: this.currentProfileId,
      currentProfile,
      profiles: NARRATIVE_PROFILES,
      currentVoiceName: this.selectedVoice ? this.selectedVoice.name : null,
      availableSpanishVoices: (spanishVoices.length > 0 ? spanishVoices : this.voices.slice(0, 6)).map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default
      })),
      allVoices: this.voices.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default
      })),
      activeText: this.activeText,
      charIndex: this.charIndex,
      activeWord: this.activeWord,
      previewingProfileId: this.previewingProfileId
    };
  }

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
          const remainder = cleaned.slice(e.charIndex);
          const nextSpace = remainder.search(/[\s.,;:!?]/);
          this.activeWord = nextSpace > 0 ? remainder.slice(0, nextSpace) : remainder.slice(0, 15);
          this.notify();
        }
      };

      utterance.onend = () => {
        this.previewingProfileId = null;
        this.handleSpeechFinished();
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('[VoiceNarrator] SpeechSynthesis error:', e.error);
        }
        this.previewingProfileId = null;
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

      if (this.synth.paused) {
        this.synth.resume();
      }

      this.synth.speak(utterance);
      this.isSpeaking = true;
      this.notify();
    } catch (err) {
      console.warn('[VoiceNarrator] Failed to speak:', err);
      this.previewingProfileId = null;
      this.handleSpeechFinished();
    }
  }

  public previewProfile(profileId: NarrativeProfileId): void {
    const profile = NARRATIVE_PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    this.previewingProfileId = profileId;
    this.setProfile(profileId, false);
    this.speak(profile.samplePhrase, () => {
      this.previewingProfileId = null;
      this.notify();
    });
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
    this.previewingProfileId = null;
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

  public setProfile(profileId: NarrativeProfileId, persist = true): void {
    const profile = NARRATIVE_PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    this.currentProfileId = profileId;
    this.rate = profile.recommendedRate;
    this.pitch = profile.recommendedPitch;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY_VOICE_PROFILE, profileId);
        localStorage.setItem(STORAGE_KEY_VOICE_RATE, String(this.rate));
        localStorage.setItem(STORAGE_KEY_VOICE_PITCH, String(this.pitch));
      } catch {
        // Ignorar
      }
    }

    this.applyProfileVoice(profileId);
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
    if (this.isSpeaking && this.activeText) {
      this.replay();
    }
  }

  public setPitch(pitch: number): void {
    const clamped = Math.max(0.7, Math.min(1.4, pitch));
    this.pitch = clamped;
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_PITCH, String(clamped));
    } catch {
      // Ignorar
    }
    this.notify();
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

export function useVoiceNarrator() {
  const [snapshot, setSnapshot] = useState<VoiceNarratorSnapshot>(() => voiceNarrator.getSnapshot());

  useEffect(() => {
    return voiceNarrator.subscribe(setSnapshot);
  }, []);

  return {
    ...snapshot,
    speak: (text: string, onEnd?: () => void) => voiceNarrator.speak(text, onEnd),
    previewProfile: (profileId: NarrativeProfileId) => voiceNarrator.previewProfile(profileId),
    stop: () => voiceNarrator.stop(),
    pause: () => voiceNarrator.pause(),
    resume: () => voiceNarrator.resume(),
    replay: () => voiceNarrator.replay(),
    toggleMute: () => voiceNarrator.toggleMute(),
    setMuted: (muted: boolean) => voiceNarrator.setMuted(muted),
    setRate: (rate: number) => voiceNarrator.setRate(rate),
    setPitch: (pitch: number) => voiceNarrator.setPitch(pitch),
    setProfile: (profileId: NarrativeProfileId, persist?: boolean) => voiceNarrator.setProfile(profileId, persist),
    setVoiceByName: (name: string) => voiceNarrator.setVoiceByName(name)
  };
}
