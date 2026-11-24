/**
 * voiceNarrator.ts
 * Motor de voz híbrido de alta naturalidad para Commonspoly:
 * 1. Modo Neural IA (por defecto en AUTO): utiliza Gemini 3.8 Flash Lite TTS (/api/tutorial-tts)
 *    con perfiles de estilo expresivos por personaje, audio WAV 24kHz y caché en memoria.
 * 2. Respaldo del sistema mejorado: si el servidor no tiene clave configurada o está offline,
 *    selecciona automáticamente la voz más natural disponible (Natural/Neural/Online/Google)
 *    y divide la locución por frases con pausas respiratorias naturales.
 */

import { useEffect, useState } from 'react';
import { audioManager, playSound } from './audio';
import { getCurrentLanguage, getCurrentLanguageMeta } from '../i18n';

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

export type GeminiPrebuiltVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
export type VoiceEngineMode = 'AUTO' | 'NEURAL' | 'SYSTEM';
export type ActiveVoiceBackend = 'IDLE' | 'NEURAL' | 'SYSTEM';

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
  geminiVoiceName: GeminiPrebuiltVoice;
  voiceStylePrompt: string;
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
    recommendedPitch: 1.02,
    recommendedRate: 1.02,
    voiceGenderPreference: 'FEMALE',
    geminiVoiceName: 'Kore',
    voiceStylePrompt:
      'Warm, energetic, empathetic Spanish community narrator, natural conversational cadence with gentle emphasis and clear pauses.',
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
    recommendedPitch: 1.0,
    recommendedRate: 1.03,
    voiceGenderPreference: 'FEMALE',
    geminiVoiceName: 'Zephyr',
    voiceStylePrompt:
      'Bright, lucid, agile and friendly narrator with crisp diction and natural conversational flow.',
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
    recommendedPitch: 1.0,
    recommendedRate: 1.01,
    voiceGenderPreference: 'MALE',
    geminiVoiceName: 'Puck',
    voiceStylePrompt:
      'Expressive, warm, vibrant theatrical storyteller with natural human intonation and inviting rhythm.',
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
    recommendedPitch: 0.96,
    recommendedRate: 0.99,
    voiceGenderPreference: 'MALE',
    geminiVoiceName: 'Charon',
    voiceStylePrompt:
      'Calm, grounded, firm and warm narrator with steady human pacing and clear natural articulation.',
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
    recommendedPitch: 0.97,
    recommendedRate: 0.97,
    voiceGenderPreference: 'MALE',
    geminiVoiceName: 'Fenrir',
    voiceStylePrompt:
      'Warm, hospitable, unhurried and generous narrator with relaxed conversational breathing and smiling tone.',
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
    recommendedPitch: 1.01,
    recommendedRate: 0.97,
    voiceGenderPreference: 'FEMALE',
    geminiVoiceName: 'Kore',
    voiceStylePrompt:
      'Thoughtful, precise, calm and crystal-clear educational narrator explaining concepts step by step with natural warmth.',
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
    recommendedRate: 0.96,
    voiceGenderPreference: 'FEMALE',
    geminiVoiceName: 'Zephyr',
    voiceStylePrompt:
      'Serene, pedagogical, patient teacher-like narrator with warm phrasing and reassuring clarity.',
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
    recommendedPitch: 0.99,
    recommendedRate: 0.97,
    voiceGenderPreference: 'FEMALE',
    geminiVoiceName: 'Kore',
    voiceStylePrompt:
      'Reflective, eloquent, warm and deeply thoughtful narrator with natural pauses and human gravitas.',
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
    recommendedPitch: 0.98,
    recommendedRate: 0.99,
    voiceGenderPreference: 'NEUTRAL',
    geminiVoiceName: 'Charon',
    voiceStylePrompt:
      'Resonant, inspiring, dignified civic assembly narrator speaking with warm clarity to a cooperative gathering.',
    samplePhrase:
      '¡El Ágora nos convoca! La legitimidad acumulada es la fuerza viva de los pueblos libres.',
    badgeLabel: 'Asamblea Común',
    colorHex: '#EC4899'
  }
];

export interface VoiceNarratorSnapshot {
  isSupported: boolean;
  isSystemSpeechSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isLoadingNeural: boolean;
  isMuted: boolean;
  engineMode: VoiceEngineMode;
  activeBackend: ActiveVoiceBackend;
  neuralStatusMessage: string | null;
  rate: number;
  pitch: number;
  volume: number;
  currentProfileId: NarrativeProfileId;
  currentProfile: VoiceNarrativeProfile;
  profiles: VoiceNarrativeProfile[];
  currentVoiceName: string | null;
  availableSpanishVoices: Array<{ name: string; lang: string; default: boolean; isNatural: boolean }>;
  allVoices: Array<{ name: string; lang: string; default: boolean; isNatural: boolean }>;
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
const STORAGE_KEY_VOICE_ENGINE = 'commonspoly_voice_narrator_engine_v1';

const MAX_AUDIO_CACHE_ENTRIES = 24;

type Listener = (snapshot: VoiceNarratorSnapshot) => void;

interface SpeechChunk {
  text: string;
  startOffset: number;
}

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

function isNaturalSystemVoice(voice: SpeechSynthesisVoice): boolean {
  const lower = voice.name.toLowerCase();
  if (
    lower.includes('espeak') ||
    lower.includes('festival') ||
    lower.includes('eloquence') ||
    lower.includes('compact') ||
    lower.includes('flite')
  ) {
    return false;
  }
  return (
    lower.includes('natural') ||
    lower.includes('neural') ||
    lower.includes('online') ||
    lower.includes('google') ||
    lower.includes('wavenet') ||
    lower.includes('enhanced') ||
    lower.includes('premium') ||
    lower.includes('siri') ||
    !voice.localService
  );
}

function scoreSystemVoice(
  voice: SpeechSynthesisVoice,
  activeLangCode: string,
  genderPreference: VoiceNarrativeProfile['voiceGenderPreference']
): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  // Penalizar motores robóticos clásicos
  if (
    name.includes('espeak') ||
    name.includes('festival') ||
    name.includes('eloquence') ||
    name.includes('compact') ||
    name.includes('flite') ||
    name.includes('pico')
  ) {
    score -= 140;
  }

  // Priorizar voces neuronales / en línea / mejoradas del navegador
  if (
    name.includes('natural') ||
    name.includes('neural') ||
    name.includes('online') ||
    name.includes('wavenet') ||
    name.includes('studio')
  ) {
    score += 120;
  } else if (name.includes('google')) {
    score += 90;
  } else if (
    name.includes('enhanced') ||
    name.includes('premium') ||
    name.includes('siri')
  ) {
    score += 75;
  }

  if (!voice.localService) {
    score += 35;
  }

  if (lang.startsWith(activeLangCode)) {
    score += 65;
    if (lang === 'es-es' || lang === 'es-419' || lang === 'es-mx') {
      score += 10;
    }
  } else if (lang.startsWith('es')) {
    score += 20;
  }

  const femaleKeywords = [
    'monica',
    'mónica',
    'paulina',
    'helena',
    'laura',
    'dalia',
    'ana',
    'elvira',
    'female',
    'mujer',
    'sabina',
    'lucia',
    'lucía',
    'sofia',
    'sofía',
    'samantha',
    'victoria',
    'amelie',
    'kyoko',
    'paloma',
    'ximena',
    'salome',
    'salomé'
  ];
  const maleKeywords = [
    'jorge',
    'diego',
    'pablo',
    'juan',
    'carlos',
    'male',
    'hombre',
    'alvaro',
    'álvaro',
    'enrique',
    'miguel',
    'tomas',
    'tomás',
    'daniel',
    'thomas',
    'otoya',
    'alonso'
  ];

  if (genderPreference === 'FEMALE' && femaleKeywords.some(kw => name.includes(kw))) {
    score += 28;
  } else if (genderPreference === 'MALE' && maleKeywords.some(kw => name.includes(kw))) {
    score += 28;
  }

  if (voice.default) {
    score += 8;
  }

  return score;
}

function splitIntoNaturalSentences(text: string): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  // Divide en frases respetando signos de cierre para generar pausas respiratorias humanas
  const rawParts = text.split(/(?<=[.!?…])\s+/);
  let cursor = 0;

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const foundAt = text.indexOf(trimmed, cursor);
    const baseOffset = foundAt >= 0 ? foundAt : cursor;

    if (trimmed.length > 175) {
      // Subdividir oraciones muy largas por punto y coma o dos puntos para evitar tono monótono
      const subParts = trimmed.split(/(?<=[;:])\s+/);
      let subCursor = baseOffset;
      for (const sub of subParts) {
        const subTrimmed = sub.trim();
        if (!subTrimmed) continue;
        const subAt = text.indexOf(subTrimmed, subCursor);
        const startOffset = subAt >= 0 ? subAt : subCursor;
        chunks.push({ text: subTrimmed, startOffset });
        subCursor = startOffset + subTrimmed.length;
      }
    } else {
      chunks.push({ text: trimmed, startOffset: baseOffset });
    }

    cursor = baseOffset + trimmed.length;
  }

  if (chunks.length === 0 && text.trim()) {
    chunks.push({ text: text.trim(), startOffset: 0 });
  }

  return chunks;
}

function base64ToWavObjectUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

class CommonspolyVoiceNarrator {
  private isSupported = false;
  private isSystemSpeechSupported = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private chunkPauseTimer: number | null = null;
  private chromeKeepAliveTimer: number | null = null;
  private playbackSessionId = 0;

  private audioCache = new Map<string, string>();
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentProfileId: NarrativeProfileId = 'carolina';
  private engineMode: VoiceEngineMode = 'AUTO';
  private activeBackend: ActiveVoiceBackend = 'IDLE';
  private isLoadingNeural = false;
  private neuralKeyMissing = false;
  private neuralStatusMessage: string | null = null;

  private isSpeaking = false;
  private isPaused = false;
  private isMuted = false;
  private rate = 1.02;
  private pitch = 1.02;
  private volume = 1.0;
  private activeText = '';
  private charIndex = 0;
  private activeWord = '';
  private previewingProfileId: NarrativeProfileId | null = null;
  private listeners = new Set<Listener>();
  private onEndCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = true;
      this.isSystemSpeechSupported =
        'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
      if (this.isSystemSpeechSupported) {
        this.synth = window.speechSynthesis;
      }

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

        const savedEngine = localStorage.getItem(STORAGE_KEY_VOICE_ENGINE);
        if (savedEngine === 'AUTO' || savedEngine === 'NEURAL' || savedEngine === 'SYSTEM') {
          this.engineMode = savedEngine;
        }
      } catch {
        // Ignorar restricciones en entornos aislados
      }

      if (this.synth) {
        this.initVoices();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => {
            this.initVoices();
          };
        }
      }

      window.addEventListener('commonspoly:language-changed', () => {
        this.syncLanguage();
      });
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
    const activeLangCode = getCurrentLanguage();
    const langVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith(activeLangCode));
    const spanishVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith('es'));
    const candidateVoices =
      langVoices.length > 0
        ? langVoices
        : spanishVoices.length > 0
          ? spanishVoices
          : this.voices;

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
      preferredVoice = [...candidateVoices].sort(
        (a, b) =>
          scoreSystemVoice(b, activeLangCode, profile.voiceGenderPreference) -
          scoreSystemVoice(a, activeLangCode, profile.voiceGenderPreference)
      )[0];
    }

    this.selectedVoice = preferredVoice;
    this.notify();
  }

  public syncLanguage(): void {
    this.applyProfileVoice(this.currentProfileId);
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
    const activeLang = getCurrentLanguage();
    const langVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith(activeLang));
    const spanishVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith('es'));
    const baseList =
      langVoices.length > 0
        ? langVoices
        : spanishVoices.length > 0
          ? spanishVoices
          : this.voices.slice(0, 8);
    const currentProfile =
      NARRATIVE_PROFILES.find(p => p.id === this.currentProfileId) || NARRATIVE_PROFILES[0];

    const sortedCandidates = [...baseList].sort(
      (a, b) =>
        scoreSystemVoice(b, activeLang, currentProfile.voiceGenderPreference) -
        scoreSystemVoice(a, activeLang, currentProfile.voiceGenderPreference)
    );

    return {
      isSupported: this.isSupported,
      isSystemSpeechSupported: this.isSystemSpeechSupported,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      isLoadingNeural: this.isLoadingNeural,
      isMuted: this.isMuted,
      engineMode: this.engineMode,
      activeBackend: this.activeBackend,
      neuralStatusMessage: this.neuralStatusMessage,
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      currentProfileId: this.currentProfileId,
      currentProfile,
      profiles: NARRATIVE_PROFILES,
      currentVoiceName: this.selectedVoice ? this.selectedVoice.name : null,
      availableSpanishVoices: sortedCandidates.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
        isNatural: isNaturalSystemVoice(v)
      })),
      allVoices: this.voices.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
        isNatural: isNaturalSystemVoice(v)
      })),
      activeText: this.activeText,
      charIndex: this.charIndex,
      activeWord: this.activeWord,
      previewingProfileId: this.previewingProfileId
    };
  }

  private cancelActivePlayback(): void {
    this.playbackSessionId += 1;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.chunkPauseTimer !== null) {
      window.clearTimeout(this.chunkPauseTimer);
      this.chunkPauseTimer = null;
    }

    this.stopKeepAlive();

    if (this.currentAudio) {
      try {
        this.currentAudio.onplay = null;
        this.currentAudio.ontimeupdate = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // Ignorar errores de limpieza
      }
      this.currentAudio = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignorar
      }
    }

    this.currentUtterance = null;
    this.isLoadingNeural = false;
  }

  public speak(text: string, onEnd?: () => void): void {
    if (!this.isSupported) {
      onEnd?.();
      return;
    }

    this.cancelActivePlayback();
    const sessionId = this.playbackSessionId;

    this.activeText = text;
    this.charIndex = 0;
    this.activeWord = '';
    this.onEndCallback = onEnd || null;

    if (this.isMuted || audioManager.isMuted()) {
      this.isSpeaking = false;
      this.isPaused = false;
      this.activeBackend = 'IDLE';
      this.notify();
      this.onEndCallback?.();
      this.onEndCallback = null;
      return;
    }

    const cleaned = text
      .replace(/[#*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      this.handleSpeechFinished();
      return;
    }

    const shouldTryNeural =
      this.engineMode === 'NEURAL' ||
      (this.engineMode === 'AUTO' && !this.neuralKeyMissing);

    if (shouldTryNeural) {
      void this.speakWithNeuralTTS(cleaned, sessionId);
      return;
    }

    if (this.isSystemSpeechSupported) {
      this.speakWithSystemSynthesis(cleaned, sessionId);
    } else {
      this.handleSpeechFinished();
    }
  }

  private putAudioCache(cacheKey: string, objectUrl: string): void {
    if (this.audioCache.has(cacheKey)) {
      this.audioCache.delete(cacheKey);
    } else if (this.audioCache.size >= MAX_AUDIO_CACHE_ENTRIES) {
      const oldestKey = this.audioCache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestUrl = this.audioCache.get(oldestKey);
        if (oldestUrl) {
          URL.revokeObjectURL(oldestUrl);
        }
        this.audioCache.delete(oldestKey);
      }
    }
    this.audioCache.set(cacheKey, objectUrl);
  }

  private async speakWithNeuralTTS(cleaned: string, sessionId: number): Promise<void> {
    const profile =
      NARRATIVE_PROFILES.find(p => p.id === this.currentProfileId) || NARRATIVE_PROFILES[0];
    const activeMeta = getCurrentLanguageMeta();
    const cacheKey = `${profile.id}:${profile.geminiVoiceName}:${activeMeta.code}:${cleaned}`;

    const cachedUrl = this.audioCache.get(cacheKey);
    if (cachedUrl) {
      // Refrescar LRU
      this.putAudioCache(cacheKey, cachedUrl);
      this.neuralStatusMessage = null;
      this.playNeuralAudioUrl(cachedUrl, cleaned, sessionId);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.isLoadingNeural = true;
    this.isSpeaking = false;
    this.isPaused = false;
    this.activeBackend = 'NEURAL';
    this.notify();

    try {
      const response = await fetch('/api/tutorial-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: cleaned,
          voiceName: profile.geminiVoiceName,
          style: profile.voiceStylePrompt,
          lang: activeMeta.bcp47
        })
      });

      if (sessionId !== this.playbackSessionId) return;

      const payload = (await response.json().catch(() => ({}))) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
        fallbackRecommended?: boolean;
      };

      if (!response.ok || !payload.audioBase64) {
        if (response.status === 503) {
          this.neuralKeyMissing = true;
        }
        this.neuralStatusMessage =
          payload.error || 'Voz Neural no disponible; usando voz mejorada del sistema.';
        this.isLoadingNeural = false;

        if (this.engineMode === 'AUTO' && this.isSystemSpeechSupported) {
          this.speakWithSystemSynthesis(cleaned, sessionId);
        } else {
          this.activeBackend = 'IDLE';
          this.previewingProfileId = null;
          this.handleSpeechFinished();
        }
        return;
      }

      if (sessionId !== this.playbackSessionId) return;

      const objectUrl = base64ToWavObjectUrl(payload.audioBase64, payload.mimeType || 'audio/wav');
      this.putAudioCache(cacheKey, objectUrl);
      this.isLoadingNeural = false;
      this.neuralKeyMissing = false;
      this.neuralStatusMessage = null;
      this.abortController = null;

      this.playNeuralAudioUrl(objectUrl, cleaned, sessionId);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (sessionId !== this.playbackSessionId) return;

      this.isLoadingNeural = false;
      this.abortController = null;
      this.neuralStatusMessage =
        'Sin conexión con la síntesis neural; usando voz mejorada del sistema.';

      if (this.engineMode === 'AUTO' && this.isSystemSpeechSupported) {
        this.speakWithSystemSynthesis(cleaned, sessionId);
      } else {
        this.activeBackend = 'IDLE';
        this.previewingProfileId = null;
        this.handleSpeechFinished();
      }
    }
  }

  private playNeuralAudioUrl(objectUrl: string, cleaned: string, sessionId: number): void {
    if (sessionId !== this.playbackSessionId) return;

    const audio = new Audio(objectUrl);
    audio.playbackRate = this.rate;
    audio.volume = this.volume;
    this.currentAudio = audio;

    audio.onplay = () => {
      if (sessionId !== this.playbackSessionId) return;
      this.isLoadingNeural = false;
      this.isSpeaking = true;
      this.isPaused = false;
      this.activeBackend = 'NEURAL';
      audioManager.setVoiceDucking(true);
      playSound.voiceCue();
      this.notify();
    };

    audio.ontimeupdate = () => {
      if (sessionId !== this.playbackSessionId || !audio.duration || !Number.isFinite(audio.duration)) {
        return;
      }
      const ratio = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
      const approxIdx = Math.min(cleaned.length - 1, Math.floor(ratio * cleaned.length));
      const wordStart = cleaned.lastIndexOf(' ', approxIdx) + 1;
      const remainder = cleaned.slice(wordStart);
      const nextSpace = remainder.search(/[\s.,;:!?]/);
      const word = nextSpace > 0 ? remainder.slice(0, nextSpace) : remainder.slice(0, 18);

      if (word !== this.activeWord) {
        this.charIndex = wordStart;
        this.activeWord = word;
        this.notify();
      }
    };

    audio.onended = () => {
      if (sessionId !== this.playbackSessionId) return;
      this.previewingProfileId = null;
      this.handleSpeechFinished();
    };

    audio.onerror = () => {
      if (sessionId !== this.playbackSessionId) return;
      this.currentAudio = null;
      if (this.engineMode === 'AUTO' && this.isSystemSpeechSupported) {
        this.speakWithSystemSynthesis(cleaned, sessionId);
      } else {
        this.previewingProfileId = null;
        this.handleSpeechFinished();
      }
    };

    audio.play().catch(err => {
      if (sessionId !== this.playbackSessionId) return;
      // Si el navegador bloqueó el autoplay inicial antes de interacción del usuario,
      // dejamos los controles listos para reproducir manualmente sin simular error fatal.
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.currentAudio = null;
        this.isLoadingNeural = false;
        this.isSpeaking = false;
        this.isPaused = false;
        this.activeBackend = 'IDLE';
        this.previewingProfileId = null;
        audioManager.setVoiceDucking(false);
        this.notify();
        return;
      }
      if (this.engineMode === 'AUTO' && this.isSystemSpeechSupported) {
        this.speakWithSystemSynthesis(cleaned, sessionId);
      } else {
        this.previewingProfileId = null;
        this.handleSpeechFinished();
      }
    });
  }

  private speakWithSystemSynthesis(cleaned: string, sessionId: number): void {
    if (!this.isSystemSpeechSupported || !this.synth || sessionId !== this.playbackSessionId) {
      this.previewingProfileId = null;
      this.handleSpeechFinished();
      return;
    }

    try {
      const chunks = splitIntoNaturalSentences(cleaned);
      const activeMeta = getCurrentLanguageMeta();
      const activeLangVoices = this.voices.filter(v =>
        v.lang.toLowerCase().startsWith(activeMeta.code)
      );
      const voiceForLang =
        this.selectedVoice &&
        this.selectedVoice.lang.toLowerCase().startsWith(activeMeta.code)
          ? this.selectedVoice
          : activeLangVoices[0] || this.selectedVoice;

      const naturalVoice = voiceForLang ? isNaturalSystemVoice(voiceForLang) : false;
      // Suavizar la alteración de pitch en voces locales no neuronales para evitar timbre metálico
      const effectivePitch = naturalVoice ? this.pitch : 1 + (this.pitch - 1) * 0.45;

      if (this.synth.paused) {
        this.synth.resume();
      }

      let hasStartedOnce = false;

      const speakChunk = (chunkIndex: number) => {
        if (sessionId !== this.playbackSessionId || !this.synth) return;
        if (chunkIndex >= chunks.length) {
          this.previewingProfileId = null;
          this.handleSpeechFinished();
          return;
        }

        const chunk = chunks[chunkIndex];
        const utterance = new SpeechSynthesisUtterance(chunk.text);
        this.currentUtterance = utterance;

        if (voiceForLang) {
          utterance.voice = voiceForLang;
          utterance.lang = voiceForLang.lang || activeMeta.bcp47;
        } else {
          utterance.lang = activeMeta.bcp47;
        }

        utterance.rate = this.rate;
        utterance.pitch = effectivePitch;
        utterance.volume = this.volume;

        utterance.onstart = () => {
          if (sessionId !== this.playbackSessionId) return;
          this.isLoadingNeural = false;
          this.isSpeaking = true;
          this.isPaused = false;
          this.activeBackend = 'SYSTEM';
          if (!hasStartedOnce) {
            hasStartedOnce = true;
            audioManager.setVoiceDucking(true);
            playSound.voiceCue();
            this.startKeepAlive();
          }
          this.notify();
        };

        utterance.onboundary = (e: SpeechSynthesisEvent) => {
          if (sessionId !== this.playbackSessionId) return;
          if (e.name === 'word' || typeof e.charIndex === 'number') {
            this.charIndex = chunk.startOffset + e.charIndex;
            const remainder = chunk.text.slice(e.charIndex);
            const nextSpace = remainder.search(/[\s.,;:!?]/);
            this.activeWord =
              nextSpace > 0 ? remainder.slice(0, nextSpace) : remainder.slice(0, 18);
            this.notify();
          }
        };

        utterance.onend = () => {
          if (sessionId !== this.playbackSessionId) return;
          if (chunkIndex + 1 < chunks.length) {
            this.chunkPauseTimer = window.setTimeout(() => {
              this.chunkPauseTimer = null;
              speakChunk(chunkIndex + 1);
            }, 85);
          } else {
            this.previewingProfileId = null;
            this.handleSpeechFinished();
          }
        };

        utterance.onerror = e => {
          if (sessionId !== this.playbackSessionId) return;
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.warn('[VoiceNarrator] SpeechSynthesis error:', e.error);
          }
          this.previewingProfileId = null;
          this.handleSpeechFinished();
        };

        utterance.onpause = () => {
          if (sessionId !== this.playbackSessionId) return;
          this.isPaused = true;
          this.notify();
        };

        utterance.onresume = () => {
          if (sessionId !== this.playbackSessionId) return;
          this.isPaused = false;
          this.notify();
        };

        this.synth.speak(utterance);
      };

      this.isSpeaking = true;
      this.activeBackend = 'SYSTEM';
      this.notify();
      speakChunk(0);
    } catch (err) {
      console.warn('[VoiceNarrator] Failed to speak with system synthesis:', err);
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
    if (this.chunkPauseTimer !== null) {
      window.clearTimeout(this.chunkPauseTimer);
      this.chunkPauseTimer = null;
    }
    this.isLoadingNeural = false;
    this.isSpeaking = false;
    this.isPaused = false;
    this.activeBackend = 'IDLE';
    this.charIndex = 0;
    this.activeWord = '';
    this.currentUtterance = null;
    this.currentAudio = null;
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
      if (this.synth && this.isSpeaking && !this.isPaused && this.activeBackend === 'SYSTEM') {
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
    if (!this.isSpeaking) return;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.isPaused = true;
      audioManager.setVoiceDucking(false);
      this.notify();
      return;
    }
    if (this.synth) {
      this.synth.pause();
      this.isPaused = true;
      audioManager.setVoiceDucking(false);
      this.notify();
    }
  }

  public resume(): void {
    if (!this.isSpeaking) return;
    if (this.currentAudio) {
      void this.currentAudio.play();
      this.isPaused = false;
      audioManager.setVoiceDucking(true);
      this.notify();
      return;
    }
    if (this.synth) {
      this.synth.resume();
      this.isPaused = false;
      audioManager.setVoiceDucking(true);
      this.notify();
    }
  }

  public stop(): void {
    this.cancelActivePlayback();
    this.isSpeaking = false;
    this.isPaused = false;
    this.isLoadingNeural = false;
    this.activeBackend = 'IDLE';
    this.charIndex = 0;
    this.activeWord = '';
    this.previewingProfileId = null;
    this.onEndCallback = null;
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

  public setEngineMode(mode: VoiceEngineMode): void {
    this.engineMode = mode;
    if (mode !== 'SYSTEM') {
      this.neuralKeyMissing = false;
      this.neuralStatusMessage = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_ENGINE, mode);
    } catch {
      // Ignorar
    }
    this.notify();
    if ((this.isSpeaking || this.isLoadingNeural) && this.activeText) {
      this.replay();
    }
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
    if (this.currentAudio) {
      this.currentAudio.playbackRate = clamped;
      this.notify();
      return;
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
    if (this.isSpeaking && this.activeText && this.activeBackend === 'SYSTEM') {
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
      if (this.isSpeaking && this.activeText && this.activeBackend === 'SYSTEM') {
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
    setEngineMode: (mode: VoiceEngineMode) => voiceNarrator.setEngineMode(mode),
    setRate: (rate: number) => voiceNarrator.setRate(rate),
    setPitch: (pitch: number) => voiceNarrator.setPitch(pitch),
    setProfile: (profileId: NarrativeProfileId, persist?: boolean) =>
      voiceNarrator.setProfile(profileId, persist),
    setVoiceByName: (name: string) => voiceNarrator.setVoiceByName(name)
  };
}
