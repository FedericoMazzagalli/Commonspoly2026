/**
 * Web Audio API Procedural Advanced Spatial & Weather-Adaptive Audio Manager
 * Gestor de audio 100% procedural (cero dependencias externas .mp3/.wav):
 * - Audio espacial 3D (HRTF PannerNode + AudioListener sincronizado con cámara Three.js)
 *   para movimientos paso a paso de fichas, especuladores, dados, desbloqueos y alertas.
 * - Paisajes sonoros ambientales dinámicos (Naturaleza, Urbano, Ágora, Título)
 * - Capa atmosférica adaptable al clima seleccionado (Lluvia, Nieve, Soleado, Sequía, Templado)
 *   con modulación gradual de intensidad y micro-eventos procedurales.
 */

import { AmbientSoundscape, GameEngineState, WeatherType } from '../types/game';

/**
 * Posición 3D en el espacio del tablero para efectos de audio posicional
 */
export interface AudioPosition3D {
  x: number;
  y?: number;
  z: number;
}

export interface MoveSequenceOptions {
  isRebound?: boolean;
  isAgora?: boolean;
  stepIntervalMs?: number;
}

class CommonspolyAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private weatherBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  // Capas de paisaje base
  private natureGain: GainNode | null = null;
  private urbanGain: GainNode | null = null;
  private agoraGain: GainNode | null = null;
  private titleGain: GainNode | null = null;

  // Capas ambientales adaptables al clima
  private rainGain: GainNode | null = null;
  private rainToneFilter: BiquadFilterNode | null = null;
  private snowGain: GainNode | null = null;
  private snowWindFilter: BiquadFilterNode | null = null;
  private sunnyGain: GainNode | null = null;
  private droughtGain: GainNode | null = null;

  private muted = false;
  private spatialEnabled = true;
  private ambientVolume = 0.24;
  private sfxVolume = 0.68;
  private currentSoundscape: AmbientSoundscape = 'TITLE';
  private currentWeatherType: WeatherType = 'SUNNY';
  private currentWeatherIntensity = 0.75;
  private isTitleDucking = true;

  private isAmbientRunning = false;
  private schedulerId: number | null = null;
  private weatherSchedulerId: number | null = null;
  private moveTimeouts: number[] = [];
  private unlocked = false;
  private lastUnlockCommonAt = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlock();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;

      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = this.ambientVolume;
      this.ambientBus.connect(this.masterGain);

      this.weatherBus = this.ctx.createGain();
      this.weatherBus.gain.value = this.isTitleDucking ? 0.28 : 1;
      this.weatherBus.connect(this.ambientBus);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignorar si el navegador aún bloquea hasta interacción explícita
      });
    }

    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (!this.unlocked) {
      this.unlocked = true;
      this.startAmbientLayers();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    if (ctx && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setSpatialEnabled(enabled: boolean): void {
    this.spatialEnabled = enabled;
  }

  public isSpatialEnabled(): boolean {
    return this.spatialEnabled;
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.ambientBus) {
      this.ambientBus.gain.setTargetAtTime(this.ambientVolume, this.ctx.currentTime, 0.08);
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.08);
    }
  }

  public getCurrentWeatherAudio(): { type: WeatherType; intensity: number } {
    return {
      type: this.currentWeatherType,
      intensity: this.currentWeatherIntensity
    };
  }

  /**
   * Crea un nodo PannerNode configurado en HRTF para espacialización 3D real.
   * Si el audio espacial está desactivado o no hay contexto/posición, retorna null (estéreo directo).
   */
  public createSpatialPanner(
    position?: AudioPosition3D,
    options?: { refDistance?: number; maxDistance?: number; rolloffFactor?: number }
  ): PannerNode | null {
    if (!this.spatialEnabled || !position || !this.ctx || !this.sfxBus) return null;
    const ctx = this.ctx;

    try {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = options?.refDistance ?? 14;
      panner.maxDistance = options?.maxDistance ?? 90;
      panner.rolloffFactor = options?.rolloffFactor ?? 1.2;
      panner.coneInnerAngle = 360;

      const px = Number.isFinite(position.x) ? position.x : 0;
      const py = Number.isFinite(position.y) ? (position.y as number) : 0.35;
      const pz = Number.isFinite(position.z) ? position.z : 0;

      if ('positionX' in panner) {
        panner.positionX.setValueAtTime(px, ctx.currentTime);
        panner.positionY.setValueAtTime(py, ctx.currentTime);
        panner.positionZ.setValueAtTime(pz, ctx.currentTime);
      } else {
        const legacyPanner = panner as unknown as {
          setPosition?: (x: number, y: number, z: number) => void;
        };
        legacyPanner.setPosition?.(px, py, pz);
      }

      panner.connect(this.sfxBus);
      return panner;
    } catch {
      return null;
    }
  }

  /**
   * Actualiza la posición y orientación del oyente (AudioListener) en función de la cámara 3D
   */
  public updateListener(
    cameraPos: AudioPosition3D,
    lookAtPos?: AudioPosition3D,
    cameraUp?: AudioPosition3D
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const listener = ctx.listener;

    const cx = Number.isFinite(cameraPos.x) ? cameraPos.x : 0;
    const cy = Number.isFinite(cameraPos.y) ? (cameraPos.y as number) : 22;
    const cz = Number.isFinite(cameraPos.z) ? cameraPos.z : 21;

    const lx = lookAtPos && Number.isFinite(lookAtPos.x) ? lookAtPos.x : 0;
    const ly = lookAtPos && Number.isFinite(lookAtPos.y) ? (lookAtPos.y as number) : 0;
    const lz = lookAtPos && Number.isFinite(lookAtPos.z) ? lookAtPos.z : 0;

    let fx = lx - cx;
    let fy = ly - cy;
    let fz = lz - cz;
    const fLen = Math.hypot(fx, fy, fz) || 1;
    fx /= fLen;
    fy /= fLen;
    fz /= fLen;

    const ux = cameraUp && Number.isFinite(cameraUp.x) ? cameraUp.x : 0;
    const uy = cameraUp && Number.isFinite(cameraUp.y) ? (cameraUp.y as number) : 1;
    const uz = cameraUp && Number.isFinite(cameraUp.z) ? cameraUp.z : 0;

    try {
      if ('positionX' in listener) {
        listener.positionX.setValueAtTime(cx, ctx.currentTime);
        listener.positionY.setValueAtTime(cy, ctx.currentTime);
        listener.positionZ.setValueAtTime(cz, ctx.currentTime);

        listener.forwardX.setValueAtTime(fx, ctx.currentTime);
        listener.forwardY.setValueAtTime(fy, ctx.currentTime);
        listener.forwardZ.setValueAtTime(fz, ctx.currentTime);

        listener.upX.setValueAtTime(ux, ctx.currentTime);
        listener.upY.setValueAtTime(uy, ctx.currentTime);
        listener.upZ.setValueAtTime(uz, ctx.currentTime);
      } else {
        const legacyListener = listener as unknown as {
          setPosition?: (x: number, y: number, z: number) => void;
          setOrientation?: (
            fx: number,
            fy: number,
            fz: number,
            ux: number,
            uy: number,
            uz: number
          ) => void;
        };
        legacyListener.setPosition?.(cx, cy, cz);
        legacyListener.setOrientation?.(fx, fy, fz, ux, uy, uz);
      }
    } catch {
      // Ignorar incompatibilidades de navegador
    }
  }

  public getCurrentSoundscape(): AmbientSoundscape {
    return this.currentSoundscape;
  }

  /**
   * Calcula automáticamente qué paisaje sonoro ambiental corresponde al estado actual de la partida
   */
  public resolveSoundscapeFromState(state: GameEngineState): AmbientSoundscape {
    if (state.ambientMode === 'NATURE') return 'NATURE';
    if (state.ambientMode === 'URBAN') return 'URBAN';

    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      return 'TITLE';
    }

    if (
      state.activeModal === 'AGORA_INSURRECTION' ||
      state.phase === 'AGORA_COUNCIL' ||
      state.players.some(p => p.inAgora)
    ) {
      return 'AGORA';
    }

    if (state.phase === 'SPECULATOR_TURN') {
      return 'URBAN';
    }

    const activePlayer = state.players[state.activePlayerIndex];
    const currentTile = state.tiles.find(t => t.id === activePlayer?.position);

    if (currentTile) {
      if (
        currentTile.category === 'INALIENABLE_COMMON' ||
        currentTile.goodType === 'ENVIRONMENT' ||
        currentTile.state === 'COMMON'
      ) {
        return 'NATURE';
      }
      if (
        currentTile.goodType === 'URBAN' ||
        currentTile.specialType === 'BANK' ||
        currentTile.specialType === 'CASINO' ||
        currentTile.specialType === 'BUREAUCRACY' ||
        currentTile.specialType === 'DETENTION_CENTER' ||
        currentTile.state === 'PRIVATE'
      ) {
        return 'URBAN';
      }
    }

    const resourceTiles = state.tiles.filter(
      t => t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY'
    );
    const commonCount = resourceTiles.filter(t => t.state === 'COMMON').length;
    const privateCount = resourceTiles.filter(t => t.state === 'PRIVATE').length;

    return commonCount >= privateCount ? 'NATURE' : 'URBAN';
  }

  public setSoundscape(soundscape: AmbientSoundscape): void {
    if (this.currentSoundscape === soundscape && this.isAmbientRunning) return;
    this.currentSoundscape = soundscape;

    if (!this.ctx || !this.isAmbientRunning) return;

    const now = this.ctx.currentTime;
    const tau = 0.8;

    this.natureGain?.gain.setTargetAtTime(soundscape === 'NATURE' ? 1 : 0, now, tau);
    this.urbanGain?.gain.setTargetAtTime(soundscape === 'URBAN' ? 1 : 0, now, tau);
    this.agoraGain?.gain.setTargetAtTime(soundscape === 'AGORA' ? 1 : 0, now, tau);
    this.titleGain?.gain.setTargetAtTime(soundscape === 'TITLE' ? 1 : 0, now, tau);
  }

  /**
   * Adapta suavemente las capas ambientales de fondo al clima seleccionado e intensidad gradual
   */
  public setWeatherAudio(
    weatherType: WeatherType,
    intensity = 0.8,
    duckForTitle = false
  ): void {
    const clampedIntensity = Math.min(1, Math.max(0.15, intensity));
    this.currentWeatherType = weatherType;
    this.currentWeatherIntensity = clampedIntensity;
    this.isTitleDucking = duckForTitle;

    if (!this.ctx || !this.isAmbientRunning) return;

    const now = this.ctx.currentTime;
    const tau = 0.7;

    this.weatherBus?.gain.setTargetAtTime(duckForTitle ? 0.25 : 1.0, now, tau);

    const isRain = weatherType === 'RAIN';
    const isSnow = weatherType === 'SNOW';
    const isSunny = weatherType === 'SUNNY' || weatherType === 'TEMPERATE';
    const isDrought = weatherType === 'DROUGHT';

    this.rainGain?.gain.setTargetAtTime(
      isRain ? 0.35 + clampedIntensity * 0.75 : 0,
      now,
      tau
    );
    if (this.rainToneFilter) {
      this.rainToneFilter.frequency.setTargetAtTime(
        1150 + clampedIntensity * 1450,
        now,
        tau
      );
    }

    this.snowGain?.gain.setTargetAtTime(
      isSnow ? 0.32 + clampedIntensity * 0.65 : 0,
      now,
      tau
    );
    if (this.snowWindFilter) {
      this.snowWindFilter.frequency.setTargetAtTime(
        260 + clampedIntensity * 260,
        now,
        tau
      );
    }

    this.sunnyGain?.gain.setTargetAtTime(
      isSunny ? 0.28 + clampedIntensity * 0.52 : 0,
      now,
      tau
    );

    this.droughtGain?.gain.setTargetAtTime(
      isDrought ? 0.32 + clampedIntensity * 0.68 : 0,
      now,
      tau
    );
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.14;
    }
    return buffer;
  }

  private startAmbientLayers(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambientBus || !this.weatherBus || this.isAmbientRunning) return;
    this.isAmbientRunning = true;

    const noiseBuffer = this.createPinkNoiseBuffer(ctx, 5);
    const crispNoiseBuffer = this.createWhiteNoiseBuffer(ctx, 3);

    // --- 1. CAPA NATURALEZA (Brisa orgánica + hojas) ---
    this.natureGain = ctx.createGain();
    this.natureGain.gain.value = this.currentSoundscape === 'NATURE' ? 1 : 0;
    this.natureGain.connect(this.ambientBus);

    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = noiseBuffer;
    breezeSrc.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 620;
    breezeFilter.Q.value = 1.4;

    const breezeLfo = ctx.createOscillator();
    breezeLfo.frequency.value = 0.09;
    const breezeLfoGain = ctx.createGain();
    breezeLfoGain.gain.value = 240;
    breezeLfo.connect(breezeLfoGain);
    breezeLfoGain.connect(breezeFilter.frequency);

    const breezeAmp = ctx.createGain();
    breezeAmp.gain.value = 0.36;

    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeAmp);
    breezeAmp.connect(this.natureGain);
    breezeSrc.start();
    breezeLfo.start();

    // --- 2. CAPA ENTORNO URBANO (Rumor lejano de ciudad / tráfico suave) ---
    this.urbanGain = ctx.createGain();
    this.urbanGain.gain.value = this.currentSoundscape === 'URBAN' ? 1 : 0;
    this.urbanGain.connect(this.ambientBus);

    const citySrc = ctx.createBufferSource();
    citySrc.buffer = noiseBuffer;
    citySrc.loop = true;

    const cityFilter = ctx.createBiquadFilter();
    cityFilter.type = 'lowpass';
    cityFilter.frequency.value = 210;
    cityFilter.Q.value = 0.7;

    const cityLfo = ctx.createOscillator();
    cityLfo.frequency.value = 0.14;
    const cityLfoGain = ctx.createGain();
    cityLfoGain.gain.value = 75;
    cityLfo.connect(cityLfoGain);
    cityLfoGain.connect(cityFilter.frequency);

    const cityAmp = ctx.createGain();
    cityAmp.gain.value = 0.48;

    citySrc.connect(cityFilter);
    cityFilter.connect(cityAmp);
    cityAmp.connect(this.urbanGain);
    citySrc.start();
    cityLfo.start();

    const cityHum = ctx.createOscillator();
    cityHum.type = 'sine';
    cityHum.frequency.value = 60;
    const cityHumGain = ctx.createGain();
    cityHumGain.gain.value = 0.03;
    cityHum.connect(cityHumGain);
    cityHumGain.connect(this.urbanGain);
    cityHum.start();

    // --- 3. CAPA ÁGORA / ASAMBLEA (Acorde cálido comunitario) ---
    this.agoraGain = ctx.createGain();
    this.agoraGain.gain.value = this.currentSoundscape === 'AGORA' ? 1 : 0;
    this.agoraGain.connect(this.ambientBus);

    [261.63, 392.0, 587.33].forEach((freq, idx) => {
      const padOsc = ctx.createOscillator();
      padOsc.type = 'sine';
      padOsc.frequency.value = freq;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.042 / (idx + 1);
      padOsc.connect(padGain);
      padGain.connect(this.agoraGain!);
      padOsc.start();
    });

    // --- 4. CAPA TÍTULO (Atmósfera serena de bienvenida) ---
    this.titleGain = ctx.createGain();
    this.titleGain.gain.value = this.currentSoundscape === 'TITLE' ? 1 : 0;
    this.titleGain.connect(this.ambientBus);

    const titleBreeze = ctx.createBufferSource();
    titleBreeze.buffer = noiseBuffer;
    titleBreeze.loop = true;
    const titleFilter = ctx.createBiquadFilter();
    titleFilter.type = 'lowpass';
    titleFilter.frequency.value = 380;
    const titleAmp = ctx.createGain();
    titleAmp.gain.value = 0.24;
    titleBreeze.connect(titleFilter);
    titleFilter.connect(titleAmp);
    titleAmp.connect(this.titleGain);
    titleBreeze.start();

    // =====================================================================
    // CAPAS AMBIENTALES ADAPTABLES AL CLIMA (RAIN / SNOW / SUNNY / DROUGHT)
    // =====================================================================

    // A) LLUVIA REGENERATIVA: Patter continuo de gotas + cuerpo de aguacero
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainGain.connect(this.weatherBus);

    const rainBodySrc = ctx.createBufferSource();
    rainBodySrc.buffer = noiseBuffer;
    rainBodySrc.loop = true;

    const rainBodyFilter = ctx.createBiquadFilter();
    rainBodyFilter.type = 'bandpass';
    rainBodyFilter.frequency.value = 950;
    rainBodyFilter.Q.value = 0.65;

    const rainBodyAmp = ctx.createGain();
    rainBodyAmp.gain.value = 0.45;
    rainBodySrc.connect(rainBodyFilter);
    rainBodyFilter.connect(rainBodyAmp);
    rainBodyAmp.connect(this.rainGain);
    rainBodySrc.start();

    const rainPatterSrc = ctx.createBufferSource();
    rainPatterSrc.buffer = crispNoiseBuffer;
    rainPatterSrc.loop = true;

    this.rainToneFilter = ctx.createBiquadFilter();
    this.rainToneFilter.type = 'bandpass';
    this.rainToneFilter.frequency.value = 2100;
    this.rainToneFilter.Q.value = 0.85;

    const rainLfo = ctx.createOscillator();
    rainLfo.frequency.value = 0.16;
    const rainLfoGain = ctx.createGain();
    rainLfoGain.gain.value = 0.08;
    const rainPatterAmp = ctx.createGain();
    rainPatterAmp.gain.value = 0.28;
    rainLfo.connect(rainLfoGain);
    rainLfoGain.connect(rainPatterAmp.gain);

    rainPatterSrc.connect(this.rainToneFilter);
    this.rainToneFilter.connect(rainPatterAmp);
    rainPatterAmp.connect(this.rainGain);
    rainPatterSrc.start();
    rainLfo.start();

    // B) NEVADA INVERNAL: Viento invernal suave y amortiguado
    this.snowGain = ctx.createGain();
    this.snowGain.gain.value = 0;
    this.snowGain.connect(this.weatherBus);

    const snowSrc = ctx.createBufferSource();
    snowSrc.buffer = noiseBuffer;
    snowSrc.loop = true;

    this.snowWindFilter = ctx.createBiquadFilter();
    this.snowWindFilter.type = 'bandpass';
    this.snowWindFilter.frequency.value = 340;
    this.snowWindFilter.Q.value = 2.6;

    const snowLfo = ctx.createOscillator();
    snowLfo.frequency.value = 0.07;
    const snowLfoGain = ctx.createGain();
    snowLfoGain.gain.value = 145;
    snowLfo.connect(snowLfoGain);
    snowLfoGain.connect(this.snowWindFilter.frequency);

    const snowAmp = ctx.createGain();
    snowAmp.gain.value = 0.48;
    snowSrc.connect(this.snowWindFilter);
    this.snowWindFilter.connect(snowAmp);
    snowAmp.connect(this.snowGain);
    snowSrc.start();
    snowLfo.start();

    // C) DÍA SOLEADO / TEMPLADO: Brisa cálida diurna
    this.sunnyGain = ctx.createGain();
    this.sunnyGain.gain.value = 0;
    this.sunnyGain.connect(this.weatherBus);

    const sunnySrc = ctx.createBufferSource();
    sunnySrc.buffer = noiseBuffer;
    sunnySrc.loop = true;
    const sunnyFilter = ctx.createBiquadFilter();
    sunnyFilter.type = 'lowpass';
    sunnyFilter.frequency.value = 540;
    const sunnyLfo = ctx.createOscillator();
    sunnyLfo.frequency.value = 0.11;
    const sunnyLfoGain = ctx.createGain();
    sunnyLfoGain.gain.value = 160;
    sunnyLfo.connect(sunnyLfoGain);
    sunnyLfoGain.connect(sunnyFilter.frequency);
    const sunnyAmp = ctx.createGain();
    sunnyAmp.gain.value = 0.28;
    sunnySrc.connect(sunnyFilter);
    sunnyFilter.connect(sunnyAmp);
    sunnyAmp.connect(this.sunnyGain);
    sunnySrc.start();
    sunnyLfo.start();

    // D) SEQUÍA EXTREMA: Viento árido sibilante
    this.droughtGain = ctx.createGain();
    this.droughtGain.gain.value = 0;
    this.droughtGain.connect(this.weatherBus);

    const droughtSrc = ctx.createBufferSource();
    droughtSrc.buffer = noiseBuffer;
    droughtSrc.loop = true;
    const droughtFilter = ctx.createBiquadFilter();
    droughtFilter.type = 'bandpass';
    droughtFilter.frequency.value = 960;
    droughtFilter.Q.value = 3.2;
    const droughtLfo = ctx.createOscillator();
    droughtLfo.frequency.value = 0.18;
    const droughtLfoGain = ctx.createGain();
    droughtLfoGain.gain.value = 280;
    droughtLfo.connect(droughtLfoGain);
    droughtLfoGain.connect(droughtFilter.frequency);
    const droughtAmp = ctx.createGain();
    droughtAmp.gain.value = 0.36;
    droughtSrc.connect(droughtFilter);
    droughtFilter.connect(droughtAmp);
    droughtAmp.connect(this.droughtGain);
    droughtSrc.start();
    droughtLfo.start();

    // Aplicar estado inicial de clima ya seleccionado
    this.setWeatherAudio(
      this.currentWeatherType,
      this.currentWeatherIntensity,
      this.isTitleDucking
    );

    // Programador periódico de micro-eventos de paisaje base
    this.schedulerId = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      if (this.currentSoundscape === 'NATURE' && Math.random() < 0.55) {
        this.triggerBirdOrDrop();
      } else if (this.currentSoundscape === 'URBAN' && Math.random() < 0.45) {
        this.triggerDistantUrbanCue();
      }
    }, 3400);

    // Programador periódico de micro-eventos adaptables al clima (gotas/truenos, destellos de escarcha, aves solares)
    this.weatherSchedulerId = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      this.triggerWeatherMicroCue();
    }, 1500);
  }

  private triggerWeatherMicroCue(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const intensity = this.currentWeatherIntensity;

    if (this.currentWeatherType === 'RAIN' && this.rainGain) {
      if (Math.random() < 0.35 + intensity * 0.5) {
        // Gotas de lluvia resonantes en charcos / hojas
        const drops = intensity >= 0.7 ? 2 : 1;
        for (let i = 0; i < drops; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + i * 0.22 + Math.random() * 0.25;
          const baseFreq = 680 + Math.random() * 780;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, t + 0.045);

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.032 * intensity, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

          osc.connect(gain);
          gain.connect(this.rainGain);
          osc.start(t);
          osc.stop(t + 0.15);
        }
      }

      // Trueno cálido y lejano ocasional con lluvia intensa
      if (intensity >= 0.72 && Math.random() < 0.18) {
        const rumble = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        rumble.type = 'triangle';
        rumble.frequency.setValueAtTime(68, now);
        rumble.frequency.exponentialRampToValueAtTime(34, now + 1.1);
        filter.type = 'lowpass';
        filter.frequency.value = 110;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.065 * intensity, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

        rumble.connect(filter);
        filter.connect(gain);
        gain.connect(this.rainGain);
        rumble.start(now);
        rumble.stop(now + 1.3);
      }
      return;
    }

    if (this.currentWeatherType === 'SNOW' && this.snowGain) {
      if (Math.random() < 0.35 + intensity * 0.35) {
        // Destello cristalino de hielo / escarcha
        const crystalNotes = [1046.5, 1318.5, 1567.98, 2093.0];
        const freq = crystalNotes[Math.floor(Math.random() * crystalNotes.length)];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.025 * intensity, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

        osc.connect(gain);
        gain.connect(this.snowGain);
        osc.start(now);
        osc.stop(now + 0.78);
      }
      return;
    }

    if (
      (this.currentWeatherType === 'SUNNY' || this.currentWeatherType === 'TEMPERATE') &&
      this.sunnyGain
    ) {
      if (Math.random() < 0.3 + intensity * 0.35) {
        // Canto solar sutil de ave diurna
        const base = 1850 + Math.random() * 850;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(base * 0.92, now + 0.11);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.03 * intensity, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sunnyGain);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    }
  }

  private triggerBirdOrDrop(): void {
    const ctx = this.ctx;
    if (!ctx || !this.natureGain) return;
    const now = ctx.currentTime;

    if (Math.random() < 0.65) {
      const base = 1700 + Math.random() * 900;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.14;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.06);
        osc.frequency.exponentialRampToValueAtTime(base * 0.95, t + 0.11);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.natureGain);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    } else {
      const notes = [523.25, 659.25, 783.99, 987.77];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.natureGain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  private triggerDistantUrbanCue(): void {
    const ctx = this.ctx;
    if (!ctx || !this.urbanGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(523.25, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.value = 900;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.028, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.urbanGain);

    osc.start(now);
    osc.stop(now + 0.48);
  }

  public dispose(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.weatherSchedulerId !== null) {
      clearInterval(this.weatherSchedulerId);
      this.weatherSchedulerId = null;
    }
    this.moveTimeouts.forEach(id => clearTimeout(id));
    this.moveTimeouts = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isAmbientRunning = false;
  }

  // --- EFECTOS DE INTERFAZ (UI SFX) ---

  public uiClick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public uiToggle(active = true): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(active ? 420 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(active ? 640 : 360, now + 0.06);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public notification(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.085;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public achievementUnlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.065;

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public modalOpen(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public modalClose(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // --- EFECTOS DE JUEGO (ESPACIALIZADOS EN 3D) ---

  public diceRoll(position?: AudioPosition3D): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const panner = this.createSpatialPanner(position ?? { x: 4.5, y: 0.9, z: 4.5 }, {
      refDistance: 12,
      rolloffFactor: 1.15
    });
    const targetNode = panner ?? this.sfxBus;

    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      const time = now + i * 0.045 + Math.random() * 0.02;
      const freq = 160 + Math.random() * 120;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(60, time + 0.05);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, time);

      gain.gain.setValueAtTime(0.25 - i * 0.03, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(targetNode);

      osc.start(time);
      osc.stop(time + 0.07);
    }

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 550);
    }
  }

  /**
   * Paso espacial individual de una ficha sobre una casilla 3D (sonido táctil de madera/cerámica)
   */
  public pawnStep(
    position?: AudioPosition3D,
    stepIndex = 0,
    isLanding = true,
    isRebound = false
  ): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const panner = this.createSpatialPanner(position, {
      refDistance: 14,
      rolloffFactor: 1.25
    });
    const targetNode = panner ?? this.sfxBus;

    // Cuerpo cálido de pieza apoyándose en el tablero
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    const baseFreq = isRebound
      ? 240
      : isLanding
      ? 290
      : 330 + (stepIndex % 4) * 26;

    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(baseFreq, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(isRebound ? 190 : 125, now + (isLanding ? 0.09 : 0.055));

    const peakGain = isLanding ? 0.28 : 0.16;
    bodyGain.gain.setValueAtTime(peakGain, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + (isLanding ? 0.1 : 0.06));

    bodyOsc.connect(bodyGain);
    bodyGain.connect(targetNode);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.11);

    // Toque seco de madera en la superficie
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const clickFilter = ctx.createBiquadFilter();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(isLanding ? 820 : 960, now);
    clickOsc.frequency.exponentialRampToValueAtTime(280, now + 0.025);

    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 1100;
    clickFilter.Q.value = 1.8;

    clickGain.gain.setValueAtTime(isLanding ? 0.12 : 0.075, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(targetNode);
    clickOsc.start(now);
    clickOsc.stop(now + 0.035);

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 220);
    }
  }

  /**
   * Secuencia espacial completa del movimiento de una pieza casilla por casilla por el tablero 3D
   */
  public pawnMoveSequence(
    stepPositions: AudioPosition3D[],
    options?: MoveSequenceOptions
  ): void {
    if (this.muted || stepPositions.length === 0) return;
    this.ensureContext();

    const interval = options?.stepIntervalMs ?? 72;
    stepPositions.forEach((pos, idx) => {
      const isLast = idx === stepPositions.length - 1;
      const timerId = window.setTimeout(() => {
        this.pawnStep(
          pos,
          idx,
          isLast,
          isLast && Boolean(options?.isRebound)
        );
      }, idx * interval);
      this.moveTimeouts.push(timerId);
    });
  }

  /**
   * Paso espacial grave y metálico de los Especuladores patrullando el tablero 3D
   */
  public speculatorStep(position?: AudioPosition3D, isLanding = true): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const panner = this.createSpatialPanner(position, {
      refDistance: 14,
      rolloffFactor: 1.25
    });
    const targetNode = panner ?? this.sfxBus;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isLanding ? 115 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);

    filter.type = 'lowpass';
    filter.frequency.value = 380;

    gain.gain.setValueAtTime(isLanding ? 0.19 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(targetNode);
    osc.start(now);
    osc.stop(now + 0.11);

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 220);
    }
  }

  public speculatorMoveSequence(stepPositions: AudioPosition3D[], delayOffsetMs = 0): void {
    if (this.muted || stepPositions.length === 0) return;
    this.ensureContext();

    stepPositions.forEach((pos, idx) => {
      const isLast = idx === stepPositions.length - 1;
      const timerId = window.setTimeout(() => {
        this.speculatorStep(pos, isLast);
      }, delayOffsetMs + idx * 70);
      this.moveTimeouts.push(timerId);
    });
  }

  public unlockCommon(position?: AudioPosition3D): void {
    if (this.muted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastUnlockCommonAt < 140) return;
    this.lastUnlockCommonAt = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(position, { refDistance: 14, rolloffFactor: 1.15 });
    const targetNode = panner ?? this.sfxBus;

    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.22, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(targetNode);

      osc.start(noteTime);
      osc.stop(noteTime + 0.5);
    });

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 900);
    }
  }

  public unlockPublic(position?: AudioPosition3D): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(position, { refDistance: 14, rolloffFactor: 1.15 });
    const targetNode = panner ?? this.sfxBus;

    [440, 554.37].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(targetNode);

      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 700);
    }
  }

  public speculatorAlert(position?: AudioPosition3D): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(position, { refDistance: 14, rolloffFactor: 1.15 });
    const targetNode = panner ?? this.sfxBus;

    [220, 311.13].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.9, now + 0.35);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(targetNode);

      osc.start(now);
      osc.stop(now + 0.45);
    });

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 650);
    }
  }

  public detentionClang(position?: AudioPosition3D): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(position ?? { x: -10, y: 0.35, z: -10 }, {
      refDistance: 14,
      rolloffFactor: 1.2
    });
    const targetNode = panner ?? this.sfxBus;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(targetNode);

    osc.start(now);
    osc.stop(now + 0.55);

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 750);
    }
  }

  public agoraInsurrection(position?: AudioPosition3D): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(position ?? { x: 0, y: 0.5, z: 0 }, {
      refDistance: 15,
      rolloffFactor: 1.0
    });
    const targetNode = panner ?? this.sfxBus;

    const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.25, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.7);

      osc.connect(gain);
      gain.connect(targetNode);

      osc.start(noteTime);
      osc.stop(noteTime + 0.75);
    });

    if (panner) {
      setTimeout(() => {
        try {
          panner.disconnect();
        } catch {}
      }, 1200);
    }
  }

  public cardFlip(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.07);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    osc.stop(now + 0.09);
  }
}

export const audioManager = new CommonspolyAudioManager();

export const playSound = {
  diceRoll: (pos?: AudioPosition3D) => audioManager.diceRoll(pos),
  pawnStep: (pos?: AudioPosition3D, stepIdx?: number, isLanding?: boolean, isRebound?: boolean) =>
    audioManager.pawnStep(pos, stepIdx, isLanding, isRebound),
  pawnMoveSequence: (steps: AudioPosition3D[], options?: MoveSequenceOptions) =>
    audioManager.pawnMoveSequence(steps, options),
  speculatorStep: (pos?: AudioPosition3D, isLanding?: boolean) =>
    audioManager.speculatorStep(pos, isLanding),
  speculatorMoveSequence: (steps: AudioPosition3D[], delayOffsetMs?: number) =>
    audioManager.speculatorMoveSequence(steps, delayOffsetMs),
  unlockCommon: (pos?: AudioPosition3D) => audioManager.unlockCommon(pos),
  unlockPublic: (pos?: AudioPosition3D) => audioManager.unlockPublic(pos),
  speculatorAlert: (pos?: AudioPosition3D) => audioManager.speculatorAlert(pos),
  detentionClang: (pos?: AudioPosition3D) => audioManager.detentionClang(pos),
  agoraInsurrection: (pos?: AudioPosition3D) => audioManager.agoraInsurrection(pos),
  cardFlip: () => audioManager.cardFlip(),
  uiClick: () => audioManager.uiClick(),
  uiToggle: (active?: boolean) => audioManager.uiToggle(active),
  notification: () => audioManager.notification(),
  achievementUnlock: () => audioManager.achievementUnlock(),
  modalOpen: () => audioManager.modalOpen(),
  modalClose: () => audioManager.modalClose()
};
