/**
 * atmosphere.ts
 * Motor de cálculo atmosférico y ciclo solar para el shader de iluminación global 3D.
 * Combina tres ejes en tiempo real:
 * 1. Hora del juego (ciclo solar continuo según ronda, turno o modo manual).
 * 2. Eventos de cartas y fases críticas (Cartas Globales, Situación, Ágora, Tragedia, Especuladores).
 * 3. Condición climática activa e intensidad (Lluvia, Nieve, Soleado, Sequía).
 */

import * as THREE from 'three';
import {
  CardAtmosphereKind,
  GameEngineState,
  GamePhase,
  GlobalCard,
  SituationCard,
  TimeOfDayMode,
  TimeOfDayPhase,
  WeatherType
} from '../types/game';

export interface GameTimeOfDayInfo {
  hour24: number;
  formattedHour: string;
  phase: TimeOfDayPhase;
  phaseLabel: string;
  mode: TimeOfDayMode;
  daylightFactor: number;
  twilightFactor: number;
  nightFactor: number;
  isDawn: boolean;
}

export interface CardAtmosphereInfo {
  kind: CardAtmosphereKind;
  label: string;
  description: string;
}

export interface AtmosphereTargets {
  sunDirection: THREE.Vector3;
  keyPosition: THREE.Vector3;
  keyColor: THREE.Color;
  keyIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  fogColor: THREE.Color;
  fogDensity: number;
  feltColor: THREE.Color;
  feltRoughness: number;
  exposure: number;
  // Shader de Iluminación Global + Sky-Dome
  skyZenithColor: THREE.Color;
  skyHorizonColor: THREE.Color;
  skySunGlowColor: THREE.Color;
  giSkyBounceColor: THREE.Color;
  giGroundBounceColor: THREE.Color;
  giSunBounceColor: THREE.Color;
  giAgoraGlowColor: THREE.Color;
  giAgoraGlowStrength: number;
  giStrength: number;
  giWetness: number;
  cloudCover: number;
  overcast: number;
  // Tinte para post-procesado
  postTint: THREE.Color;
  postShadowTint: THREE.Color;
  daylightFactor: number;
  twilightFactor: number;
  nightFactor: number;
  volumetricFogColor: THREE.Color;
  volumetricFogDensity: number;
  volumetricFogEnabled: number;
}

export function createAtmosphereTargets(): AtmosphereTargets {
  return {
    sunDirection: new THREE.Vector3(0.45, 0.78, 0.42).normalize(),
    keyPosition: new THREE.Vector3(14, 22, 12),
    keyColor: new THREE.Color(0xfff5e6),
    keyIntensity: 2.2,
    hemiSkyColor: new THREE.Color(0x40e0d0),
    hemiGroundColor: new THREE.Color(0x111e1c),
    hemiIntensity: 1.2,
    rimColor: new THREE.Color(0xa7f3d0),
    rimIntensity: 0.8,
    fogColor: new THREE.Color(0x0a1917),
    fogDensity: 0.019,
    feltColor: new THREE.Color(0x0f4a3e),
    feltRoughness: 0.85,
    exposure: 1.15,
    skyZenithColor: new THREE.Color(0x081d22),
    skyHorizonColor: new THREE.Color(0x13383a),
    skySunGlowColor: new THREE.Color(0xfde68a),
    giSkyBounceColor: new THREE.Color(0x38bdf8),
    giGroundBounceColor: new THREE.Color(0x0f3d33),
    giSunBounceColor: new THREE.Color(0xfff1d6),
    giAgoraGlowColor: new THREE.Color(0xec4899),
    giAgoraGlowStrength: 0.24,
    giStrength: 0.32,
    giWetness: 0,
    cloudCover: 0.2,
    overcast: 0.15,
    postTint: new THREE.Color(1, 1, 1),
    postShadowTint: new THREE.Color(0.94, 1, 1.02),
    daylightFactor: 0.85,
    twilightFactor: 0.1,
    nightFactor: 0.05,
    volumetricFogColor: new THREE.Color(0x0a1917),
    volumetricFogDensity: 0.025,
    volumetricFogEnabled: 0.05
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function resolveGameTimeOfDay(
  round: number,
  activePlayerIndex: number,
  playersCount: number,
  mode: TimeOfDayMode = 'AUTO'
): GameTimeOfDayInfo {
  let hour24 = 9.5;
  if (mode === 'DAWN') {
    hour24 = 6.25;
  } else if (mode === 'NOON') {
    hour24 = 13.0;
  } else if (mode === 'SUNSET') {
    hour24 = 18.6;
  } else if (mode === 'NIGHT') {
    hour24 = 22.85;
  } else {
    const turnFrac = playersCount > 0 ? activePlayerIndex / playersCount : 0;
    hour24 = (9.25 + Math.max(0, round - 1) * 3.15 + turnFrac * 2.2) % 24;
  }

  const wholeHour = Math.floor(hour24) % 24;
  const minutes = Math.floor((hour24 - Math.floor(hour24)) * 60);
  const formattedHour = `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Ángulo solar: 06:00 -> 0 rad (orto), 12:00 -> PI/2 (cenit), 18:00 -> PI (ocaso), 00:00 -> -PI/2
  const solarAngle = ((hour24 - 6) / 24) * Math.PI * 2;
  const sunSin = Math.sin(solarAngle);

  const daylightFactor = clamp01((sunSin + 0.18) / 1.18);
  const twilightFactor = Math.exp(-Math.pow((sunSin - 0.04) / 0.25, 2));
  const nightFactor = clamp01((-sunSin + 0.08) / 0.82);
  const isDawn = hour24 >= 4.2 && hour24 < 11.2;

  let phase: TimeOfDayPhase = 'MORNING';
  let phaseLabel = 'Mañana';
  if (hour24 >= 5.0 && hour24 < 8.2) {
    phase = 'DAWN';
    phaseLabel = 'Amanecer';
  } else if (hour24 >= 8.2 && hour24 < 11.8) {
    phase = 'MORNING';
    phaseLabel = 'Mañana';
  } else if (hour24 >= 11.8 && hour24 < 16.5) {
    phase = 'NOON';
    phaseLabel = 'Mediodía';
  } else if (hour24 >= 16.5 && hour24 < 19.6) {
    phase = 'SUNSET';
    phaseLabel = 'Atardecer';
  } else if (hour24 >= 19.6 && hour24 < 21.4) {
    phase = 'TWILIGHT';
    phaseLabel = 'Crepúsculo';
  } else {
    phase = 'NIGHT';
    phaseLabel = 'Noche';
  }

  return {
    hour24,
    formattedHour,
    phase,
    phaseLabel,
    mode,
    daylightFactor,
    twilightFactor,
    nightFactor,
    isDawn
  };
}

export function resolveCardAtmosphere(params: {
  phase: GamePhase;
  activeModal?: GameEngineState['activeModal'];
  currentGlobalCard?: GlobalCard | null;
  currentSituationCard?: SituationCard | null;
}): CardAtmosphereInfo {
  const { phase, activeModal, currentGlobalCard, currentSituationCard } = params;

  if (activeModal === 'AGORA_INSURRECTION') {
    return {
      kind: 'AGORA_RADIANCE',
      label: 'Insurrección en el Ágora',
      description: 'Luminosidad asamblearia irradia desde el centro del tablero.'
    };
  }

  if (activeModal === 'TRAGEDY_VOTE' || phase === 'SPECULATOR_TURN') {
    return {
      kind: 'TRAGEDY_SHADOW',
      label: activeModal === 'TRAGEDY_VOTE' ? 'Tragedia de los Comunes' : 'Ofensiva Especuladora',
      description: 'Cielo encapotado y tensión cromática durante la ofensiva privatizadora.'
    };
  }

  if (activeModal === 'DETENTION_RESCUE') {
    return {
      kind: 'SPECULATIVE_PRESSURE',
      label: 'Alerta de Detención',
      description: 'Iluminación de vigilancia fría sobre las calles del tablero.'
    };
  }

  if (activeModal === 'SITUATION_CARD' && currentSituationCard) {
    if (currentSituationCard.id === 'sit_redada' || currentSituationCard.id === 'sit_agotamiento') {
      return {
        kind: 'SPECULATIVE_PRESSURE',
        label: currentSituationCard.title,
        description: 'Tono frío y contraste contenido por situación de desgaste.'
      };
    }
    return {
      kind: 'SOLIDARITY_GLOW',
      label: currentSituationCard.title,
      description: 'Resplandor cálido solidario sobre los nodos vecinales.'
    };
  }

  switch (currentGlobalCard?.id) {
    case 'g_clima':
      return {
        kind: 'HEATWAVE',
        label: 'Ola de Calor Extremo',
        description: 'Calima solar dorada y luz cenital intensa sobre los refugios.'
      };
    case 'g_inflacion':
      return {
        kind: 'ENERGY_CRISIS',
        label: 'Crisis Energética',
        description: 'Penumbra eléctrica y contraste azul-violeta en el entorno.'
      };
    case 'g_fondos_buitre':
      return {
        kind: 'SPECULATIVE_PRESSURE',
        label: 'Presión Inmobiliaria',
        description: 'Luz acerada de tormenta especulativa sobre el tablero.'
      };
    case 'g_huelga_cuidados':
    case 'g_asamblea_barrial':
      return {
        kind: 'SOLIDARITY_GLOW',
        label: 'Pulso Comunitario',
        description: 'Iluminación indirecta cálida y rebote esmeralda cooperativo.'
      };
    case 'g_ciencia_abierta':
    case 'g_red_solidaridad':
      return {
        kind: 'ECOLOGICAL_HOPE',
        label: 'Horizonte Común',
        description: 'Atmósfera diáfana con reflejos cian y verdes regenerativos.'
      };
    default:
      return {
        kind: 'NONE',
        label: 'Ciclo Natural',
        description: 'Iluminación global guiada por la hora del juego y el clima.'
      };
  }
}

// Helpers reutilizables para evitar allocaciones en el loop 60fps
const _dayZenith = new THREE.Color(0x0b2c38);
const _twilightZenith = new THREE.Color(0x1f1938);
const _nightZenith = new THREE.Color(0x040916);
const _dawnHorizon = new THREE.Color(0xd97757);
const _dayHorizon = new THREE.Color(0x194f56);
const _sunsetHorizon = new THREE.Color(0xc2410c);
const _nightHorizon = new THREE.Color(0x091326);

const _dayKey = new THREE.Color(0xfff7e2);
const _dawnKey = new THREE.Color(0xffc99e);
const _sunsetKey = new THREE.Color(0xff9f59);
const _nightKey = new THREE.Color(0x7aa2f7);

const _dayHemiSky = new THREE.Color(0x45d6cb);
const _sunsetHemiSky = new THREE.Color(0xf59e0b);
const _nightHemiSky = new THREE.Color(0x1d4ed8);

const _dayHemiGround = new THREE.Color(0x13382e);
const _nightHemiGround = new THREE.Color(0x060b14);

const _weatherTint = new THREE.Color();
const _cardTint = new THREE.Color();
const _tmpColor = new THREE.Color();

export function computeAtmosphereTargets(
  out: AtmosphereTargets,
  params: {
    weatherType: WeatherType;
    weatherIntensity: number;
    timeInfo: GameTimeOfDayInfo;
    cardInfo: CardAtmosphereInfo;
    phase: GamePhase;
    gameResult?: 'VICTORY' | 'DRAW' | 'DEFEAT';
  }
): void {
  const { weatherType, weatherIntensity, timeInfo, cardInfo, phase, gameResult } = params;
  const { daylightFactor, twilightFactor, nightFactor, isDawn, hour24 } = timeInfo;

  // 1) Posición solar/lunar continua según hora del juego
  const azimuth = ((hour24 - 6) / 24) * Math.PI * 2 - Math.PI * 0.4;
  const elevationRad = THREE.MathUtils.lerp(0.32, 1.08, daylightFactor);
  const radius = 26;
  const horiz = Math.cos(elevationRad) * radius;
  const kx = Math.cos(azimuth) * horiz;
  const ky = Math.max(9.5, Math.sin(elevationRad) * radius);
  const kz = Math.sin(azimuth) * horiz;

  out.keyPosition.set(kx, ky, kz);
  out.sunDirection.set(kx, ky, kz).normalize();

  // 2) Paleta base por hora del juego (Día -> Amanecer/Atardecer -> Noche)
  out.skyZenithColor
    .copy(_nightZenith)
    .lerp(_dayZenith, daylightFactor)
    .lerp(_twilightZenith, twilightFactor * 0.65);

  const twilightHorizTarget = isDawn ? _dawnHorizon : _sunsetHorizon;
  out.skyHorizonColor
    .copy(_nightHorizon)
    .lerp(_dayHorizon, daylightFactor)
    .lerp(twilightHorizTarget, twilightFactor * 0.72);

  const twilightKeyTarget = isDawn ? _dawnKey : _sunsetKey;
  out.keyColor
    .copy(_nightKey)
    .lerp(_dayKey, daylightFactor)
    .lerp(twilightKeyTarget, twilightFactor * 0.75);

  out.hemiSkyColor
    .copy(_nightHemiSky)
    .lerp(_dayHemiSky, daylightFactor)
    .lerp(_sunsetHemiSky, twilightFactor * 0.45);

  out.hemiGroundColor.copy(_nightHemiGround).lerp(_dayHemiGround, daylightFactor);

  out.rimColor.copy(isDawn ? _dawnKey : _sunsetKey).lerp(_dayHemiSky, daylightFactor * 0.6 + nightFactor * 0.5);
  out.skySunGlowColor.copy(twilightKeyTarget).lerp(_dayKey, daylightFactor * 0.7);

  // Intensidades equilibradas para mantener legibilidad táctica incluso de noche
  out.keyIntensity = THREE.MathUtils.lerp(1.25, 2.38, daylightFactor) + twilightFactor * 0.25;
  out.hemiIntensity = THREE.MathUtils.lerp(0.95, 1.32, daylightFactor) + twilightFactor * 0.12;
  out.rimIntensity = THREE.MathUtils.lerp(0.92, 0.78, daylightFactor) + twilightFactor * 0.22;
  out.exposure = THREE.MathUtils.lerp(1.06, 1.18, daylightFactor) + twilightFactor * 0.04;

  out.fogColor.copy(out.skyHorizonColor).multiplyScalar(0.45);
  out.fogDensity = THREE.MathUtils.lerp(0.022, 0.015, daylightFactor) + twilightFactor * 0.002;
  out.feltColor.setHex(0x0f4a3e).lerp(_tmpColor.setHex(0x0a292b), nightFactor * 0.55);
  out.feltRoughness = 0.85;

  out.volumetricFogColor.copy(out.fogColor);
  out.volumetricFogDensity = 0.028;
  out.volumetricFogEnabled = 0.08;

  // Iluminación global indirecta
  out.giSkyBounceColor.copy(out.hemiSkyColor);
  out.giGroundBounceColor.copy(out.hemiGroundColor).lerp(_tmpColor.setHex(0x124538), daylightFactor * 0.5);
  out.giSunBounceColor.copy(out.keyColor);
  out.giAgoraGlowColor.setHex(0xec4899);
  out.giAgoraGlowStrength = 0.22 + nightFactor * 0.28 + twilightFactor * 0.1;
  out.giStrength = 0.30 + nightFactor * 0.1 + twilightFactor * 0.08;
  out.giWetness = 0;
  out.cloudCover = 0.2 + nightFactor * 0.15;
  out.overcast = 0.12;

  out.postTint.setRGB(1.0, 1.0, 1.0).lerp(twilightKeyTarget, twilightFactor * 0.09);
  out.postShadowTint.setRGB(0.94, 1.0, 1.02).lerp(_nightKey, nightFactor * 0.14);

  // 3) Modulación por Clima (Lluvia, Nieve, Soleado, Sequía)
  if (weatherType === 'RAIN') {
    _weatherTint.setHex(0x38bdf8);
    out.skyZenithColor.lerp(_tmpColor.setHex(0x081a24), 0.65);
    out.skyHorizonColor.lerp(_tmpColor.setHex(0x102a36), 0.6);
    out.fogColor.lerp(_tmpColor.setHex(0x071a22), 0.72);
    out.fogDensity += 0.005 + weatherIntensity * 0.005;
    out.keyColor.lerp(_tmpColor.setHex(0xcbe9f5), 0.65);
    out.keyIntensity *= 0.82 - weatherIntensity * 0.08;
    out.hemiSkyColor.lerp(_weatherTint, 0.55);
    out.hemiIntensity += 0.14;
    out.rimColor.lerp(_tmpColor.setHex(0x67e8f9), 0.55);
    out.rimIntensity += 0.18;
    out.feltColor.lerp(_tmpColor.setHex(0x0b3c36), 0.55);
    out.feltRoughness = Math.max(0.32, 0.85 - weatherIntensity * 0.45);
    out.giSkyBounceColor.lerp(_weatherTint, 0.55);
    out.giWetness = 0.45 + weatherIntensity * 0.55;
    out.cloudCover = Math.max(out.cloudCover, 0.65 + weatherIntensity * 0.3);
    out.overcast = 0.6 + weatherIntensity * 0.3;
    out.exposure -= 0.06;
    out.postTint.lerp(_tmpColor.setRGB(0.93, 1.0, 1.06), 0.75);
    out.postShadowTint.lerp(_tmpColor.setRGB(0.88, 0.98, 1.08), 0.75);
    out.volumetricFogColor.setHex(0x133848);
    out.volumetricFogDensity = 0.042 + weatherIntensity * 0.025;
    out.volumetricFogEnabled = 0.88 + weatherIntensity * 0.12;
  } else if (weatherType === 'SNOW') {
    out.skyZenithColor.lerp(_tmpColor.setHex(0x10243d), 0.55);
    out.skyHorizonColor.lerp(_tmpColor.setHex(0x1f3a52), 0.55);
    out.fogColor.lerp(_tmpColor.setHex(0x0d1f33), 0.7);
    out.fogDensity += 0.004 + weatherIntensity * 0.004;
    out.keyColor.lerp(_tmpColor.setHex(0xe0f2fe), 0.65);
    out.hemiSkyColor.lerp(_tmpColor.setHex(0xbae6fd), 0.6);
    out.hemiGroundColor.lerp(_tmpColor.setHex(0x1e293b), 0.55);
    out.hemiIntensity += 0.25;
    out.rimColor.lerp(_tmpColor.setHex(0xe2e8f0), 0.6);
    out.feltColor.lerp(_tmpColor.setHex(0x164e4a), 0.5);
    out.feltRoughness = 0.78;
    out.giSkyBounceColor.lerp(_tmpColor.setHex(0xbae6fd), 0.6);
    out.giGroundBounceColor.lerp(_tmpColor.setHex(0x334155), 0.45);
    out.cloudCover = Math.max(out.cloudCover, 0.55 + weatherIntensity * 0.25);
    out.overcast = 0.45 + weatherIntensity * 0.25;
    out.postTint.lerp(_tmpColor.setRGB(0.96, 0.99, 1.06), 0.7);
    out.postShadowTint.lerp(_tmpColor.setRGB(0.9, 0.96, 1.08), 0.7);
    out.volumetricFogColor.setHex(0x1e3a5f);
    out.volumetricFogDensity = 0.035 + weatherIntensity * 0.02;
    out.volumetricFogEnabled = 0.82 + weatherIntensity * 0.18;
  } else if (weatherType === 'SUNNY') {
    out.fogDensity = Math.max(0.011, out.fogDensity - 0.003);
    out.keyIntensity += 0.18 + weatherIntensity * 0.22;
    out.hemiIntensity += 0.12;
    out.feltColor.lerp(_tmpColor.setHex(0x115243), 0.4);
    out.giSunBounceColor.lerp(_tmpColor.setHex(0xfde68a), 0.35);
    out.cloudCover = Math.min(out.cloudCover, 0.15);
    out.overcast = 0.05;
    out.exposure += 0.04 + weatherIntensity * 0.05;
    out.postTint.lerp(_tmpColor.setRGB(1.04, 1.01, 0.95), 0.55);
    out.volumetricFogColor.copy(out.skyHorizonColor);
    out.volumetricFogDensity = 0.012;
    out.volumetricFogEnabled = 0.15;
  } else if (weatherType === 'DROUGHT') {
    out.skyZenithColor.lerp(_tmpColor.setHex(0x331d0c), 0.6);
    out.skyHorizonColor.lerp(_tmpColor.setHex(0x7c2d12), 0.55);
    out.fogColor.lerp(_tmpColor.setHex(0x221508), 0.72);
    out.fogDensity += 0.005;
    out.keyColor.lerp(_tmpColor.setHex(0xffedd5), 0.6);
    out.hemiSkyColor.lerp(_tmpColor.setHex(0xf59e0b), 0.55);
    out.hemiGroundColor.lerp(_tmpColor.setHex(0x451a03), 0.55);
    out.feltColor.lerp(_tmpColor.setHex(0x283618), 0.55);
    out.giSunBounceColor.lerp(_tmpColor.setHex(0xfdba74), 0.65);
    out.postTint.lerp(_tmpColor.setRGB(1.07, 0.97, 0.89), 0.75);
    out.volumetricFogColor.setHex(0x52240a);
    out.volumetricFogDensity = 0.038 + weatherIntensity * 0.02;
    out.volumetricFogEnabled = 0.8 + weatherIntensity * 0.2;
  }

  // 4) Modulación por Eventos de Cartas y Fases Críticas
  switch (cardInfo.kind) {
    case 'HEATWAVE':
      _cardTint.setHex(0xf59e0b);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0xd97706), 0.45);
      out.fogColor.lerp(_tmpColor.setHex(0x271507), 0.5);
      out.keyColor.lerp(_tmpColor.setHex(0xffdca8), 0.55);
      out.keyIntensity *= 1.16;
      out.giSunBounceColor.lerp(_cardTint, 0.65);
      out.giStrength += 0.12;
      out.exposure += 0.06;
      out.postTint.lerp(_tmpColor.setRGB(1.08, 0.98, 0.9), 0.65);
      break;

    case 'ENERGY_CRISIS':
      out.skyZenithColor.lerp(_tmpColor.setHex(0x060918), 0.6);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x1e1b4b), 0.5);
      out.fogColor.lerp(_tmpColor.setHex(0x090d1e), 0.6);
      out.fogDensity += 0.004;
      out.keyIntensity *= 0.76;
      out.hemiSkyColor.lerp(_tmpColor.setHex(0x6366f1), 0.5);
      out.giSkyBounceColor.lerp(_tmpColor.setHex(0x818cf8), 0.55);
      out.giAgoraGlowColor.setHex(0xf59e0b);
      out.giAgoraGlowStrength += 0.2;
      out.exposure -= 0.08;
      out.postShadowTint.lerp(_tmpColor.setRGB(0.86, 0.9, 1.08), 0.65);
      break;

    case 'SPECULATIVE_PRESSURE':
      out.skyZenithColor.lerp(_tmpColor.setHex(0x141824), 0.5);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x3b1d2a), 0.35);
      out.fogColor.lerp(_tmpColor.setHex(0x141622), 0.52);
      out.keyIntensity *= 0.9;
      out.rimColor.lerp(_tmpColor.setHex(0xfb7185), 0.45);
      out.giSkyBounceColor.lerp(_tmpColor.setHex(0x94a3b8), 0.45);
      out.overcast = Math.max(out.overcast, 0.48);
      break;

    case 'TRAGEDY_SHADOW':
      out.skyZenithColor.lerp(_tmpColor.setHex(0x170d16), 0.68);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x4c1d2e), 0.55);
      out.fogColor.lerp(_tmpColor.setHex(0x1a0b14), 0.7);
      out.fogDensity += 0.006;
      out.keyColor.lerp(_tmpColor.setHex(0xfca5a5), 0.4);
      out.keyIntensity *= 0.78;
      out.rimColor.lerp(_tmpColor.setHex(0xf43f5e), 0.65);
      out.rimIntensity += 0.35;
      out.giSkyBounceColor.lerp(_tmpColor.setHex(0xfb7185), 0.45);
      out.giAgoraGlowColor.setHex(0xf43f5e);
      out.giAgoraGlowStrength += 0.16;
      out.overcast = Math.max(out.overcast, 0.68);
      out.postTint.lerp(_tmpColor.setRGB(1.04, 0.93, 0.95), 0.6);
      break;

    case 'SOLIDARITY_GLOW':
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x115e59), 0.35);
      out.hemiSkyColor.lerp(_tmpColor.setHex(0x34d399), 0.35);
      out.giGroundBounceColor.lerp(_tmpColor.setHex(0x10b981), 0.35);
      out.giSunBounceColor.lerp(_tmpColor.setHex(0xfde047), 0.35);
      out.giAgoraGlowColor.setHex(0x34d399);
      out.giAgoraGlowStrength += 0.18;
      out.giStrength += 0.08;
      break;

    case 'ECOLOGICAL_HOPE':
      out.skyZenithColor.lerp(_tmpColor.setHex(0x0a2e36), 0.4);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x0d9488), 0.35);
      out.hemiSkyColor.lerp(_tmpColor.setHex(0x2dd4bf), 0.45);
      out.giSkyBounceColor.lerp(_tmpColor.setHex(0x5eead4), 0.45);
      out.giGroundBounceColor.lerp(_tmpColor.setHex(0x15803d), 0.4);
      out.giStrength += 0.09;
      break;

    case 'AGORA_RADIANCE':
      out.giAgoraGlowColor.setHex(0xf472b6);
      out.giAgoraGlowStrength = 0.85;
      out.giSunBounceColor.lerp(_tmpColor.setHex(0xfacc15), 0.55);
      out.rimColor.lerp(_tmpColor.setHex(0xf472b6), 0.6);
      out.rimIntensity += 0.45;
      out.giStrength += 0.18;
      break;

    case 'NONE':
    default:
      break;
  }

  // 5) Matiz final si la partida terminó
  if (phase === 'GAME_OVER') {
    if (gameResult === 'VICTORY') {
      out.giAgoraGlowColor.setHex(0x34d399);
      out.giAgoraGlowStrength = 0.72;
      out.fogColor.lerp(_tmpColor.setHex(0x082620), 0.55);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x10b981), 0.38);
    } else if (gameResult === 'DEFEAT') {
      out.giAgoraGlowColor.setHex(0xf43f5e);
      out.giAgoraGlowStrength = 0.45;
      out.fogColor.lerp(_tmpColor.setHex(0x1e0d14), 0.6);
      out.skyHorizonColor.lerp(_tmpColor.setHex(0x881337), 0.4);
    }
  }

  out.daylightFactor = daylightFactor;
  out.twilightFactor = twilightFactor;
  out.nightFactor = nightFactor;
}
