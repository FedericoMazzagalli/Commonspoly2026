/**
 * globalIllumination.ts
 * Sistema de Shaders GLSL de Iluminación Global y Cúpula Atmosférica para Commonspoly 3D:
 * - Inyección PBR (`onBeforeCompile`) sobre materiales del tablero para calcular rebote indirecto
 *   hemisférico cielo-suelo, dispersión cálida de horizonte solar/lunar, resplandor radial
 *   del Ágora Central y reflejo húmedo durante precipitaciones.
 * - Sky-Dome ShaderMaterial procedural con gradiente Rayleigh/Mie, halo solar/lunar, nubosidad
 *   e iluminación nocturna sincronizada con la hora del juego y eventos de cartas.
 */

import * as THREE from 'three';
import { AtmosphereTargets } from '../../utils/atmosphere';

export interface GlobalIlluminationUniforms {
  uGiSkyColor: { value: THREE.Color };
  uGiGroundColor: { value: THREE.Color };
  uGiSunDirection: { value: THREE.Vector3 };
  uGiSunBounceColor: { value: THREE.Color };
  uGiAgoraGlowColor: { value: THREE.Color };
  uGiAgoraGlowStrength: { value: number };
  uGiStrength: { value: number };
  uGiWetness: { value: number };
  uGiTime: { value: number };
  uVolumetricFogColor: { value: THREE.Color };
  uVolumetricFogDensity: { value: number };
  uVolumetricFogEnabled: { value: number };
  uCleanseWaveRadius: { value: number };
  uCleanseWaveIntensity: { value: number };
  uCleanseEfficiency: { value: number };
  uCleanseWaveColor: { value: THREE.Color };
}

export function createGlobalIlluminationUniforms(): GlobalIlluminationUniforms {
  return {
    uGiSkyColor: { value: new THREE.Color(0x40e0d0) },
    uGiGroundColor: { value: new THREE.Color(0x112a24) },
    uGiSunDirection: { value: new THREE.Vector3(0.45, 0.78, 0.42).normalize() },
    uGiSunBounceColor: { value: new THREE.Color(0xfff5e6) },
    uGiAgoraGlowColor: { value: new THREE.Color(0xec4899) },
    uGiAgoraGlowStrength: { value: 0.24 },
    uGiStrength: { value: 0.32 },
    uGiWetness: { value: 0.0 },
    uGiTime: { value: 0.0 },
    uVolumetricFogColor: { value: new THREE.Color(0x0a1917) },
    uVolumetricFogDensity: { value: 0.025 },
    uVolumetricFogEnabled: { value: 0.08 },
    uCleanseWaveRadius: { value: -5.0 },
    uCleanseWaveIntensity: { value: 0.0 },
    uCleanseEfficiency: { value: 0.0 },
    uCleanseWaveColor: { value: new THREE.Color(0x2dd4bf) }
  };
}

export function applyGlobalIlluminationShader(
  material: THREE.MeshStandardMaterial,
  giUniforms: GlobalIlluminationUniforms,
  options?: {
    giWeight?: number;
    wetnessWeight?: number;
    saturationUniform?: { value: number };
  }
): void {
  const giWeight = options?.giWeight ?? 1.0;
  const wetnessWeight = options?.wetnessWeight ?? 0.65;
  const saturationUniform = options?.saturationUniform ?? { value: 1.0 };

  material.customProgramCacheKey = () =>
    `commonspoly_gi_v3_${giWeight.toFixed(2)}_${wetnessWeight.toFixed(2)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGiSkyColor = giUniforms.uGiSkyColor;
    shader.uniforms.uGiGroundColor = giUniforms.uGiGroundColor;
    shader.uniforms.uGiSunDirection = giUniforms.uGiSunDirection;
    shader.uniforms.uGiSunBounceColor = giUniforms.uGiSunBounceColor;
    shader.uniforms.uGiAgoraGlowColor = giUniforms.uGiAgoraGlowColor;
    shader.uniforms.uGiAgoraGlowStrength = giUniforms.uGiAgoraGlowStrength;
    shader.uniforms.uGiStrength = giUniforms.uGiStrength;
    shader.uniforms.uGiWetness = giUniforms.uGiWetness;
    shader.uniforms.uGiTime = giUniforms.uGiTime;
    shader.uniforms.uVolumetricFogColor = giUniforms.uVolumetricFogColor;
    shader.uniforms.uVolumetricFogDensity = giUniforms.uVolumetricFogDensity;
    shader.uniforms.uVolumetricFogEnabled = giUniforms.uVolumetricFogEnabled;
    shader.uniforms.uCleanseWaveRadius = giUniforms.uCleanseWaveRadius;
    shader.uniforms.uCleanseWaveIntensity = giUniforms.uCleanseWaveIntensity;
    shader.uniforms.uCleanseEfficiency = giUniforms.uCleanseEfficiency;
    shader.uniforms.uCleanseWaveColor = giUniforms.uCleanseWaveColor;
    shader.uniforms.uTileSaturation = saturationUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vGiWorldPos;
varying vec3 vGiWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 giWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  giWp = instanceMatrix * giWp;
#endif
giWp = modelMatrix * giWp;
vGiWorldPos = giWp.xyz;
vGiWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uVolumetricFogColor;
uniform float uVolumetricFogDensity;
uniform float uVolumetricFogEnabled;
uniform vec3 uGiSkyColor;
uniform vec3 uGiGroundColor;
uniform vec3 uGiSunDirection;
uniform vec3 uGiSunBounceColor;
uniform vec3 uGiAgoraGlowColor;
uniform float uGiAgoraGlowStrength;
uniform float uGiStrength;
uniform float uGiWetness;
uniform float uGiTime;
uniform float uCleanseWaveRadius;
uniform float uCleanseWaveIntensity;
uniform float uCleanseEfficiency;
uniform vec3 uCleanseWaveColor;
uniform float uTileSaturation;
varying vec3 vGiWorldPos;
varying vec3 vGiWorldNormal;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float satLuma = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  float clampedSat = clamp( uTileSaturation, 0.0, 1.0 );
  vec3 weatheredGrey = vec3( satLuma ) * mix( 0.72, 1.0, clampedSat );
  vec3 satAdjusted = mix( weatheredGrey, diffuseColor.rgb, uTileSaturation );
  diffuseColor.rgb = max( satAdjusted, vec3( 0.0 ) );
}`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
{
  vec3 giN = normalize( vGiWorldNormal );
  vec3 giSunDir = normalize( uGiSunDirection );
  float giUpMix = clamp( dot( giN, normalize( mix( vec3( 0.0, 1.0, 0.0 ), giSunDir, 0.25 ) ) ) * 0.5 + 0.5, 0.0, 1.0 );
  vec3 giIrradiance = mix( uGiGroundColor, uGiSkyColor, giUpMix );
  float giSunScatter = pow( max( 0.0, dot( giN, giSunDir ) ), 1.6 );
  float giAgoraDist = length( vGiWorldPos.xz );
  float giAgoraBounce = exp( -0.14 * giAgoraDist ) * uGiAgoraGlowStrength;

  vec3 giDiffuseBoost = diffuseColor.rgb * (
    giIrradiance * ( uGiStrength * ${giWeight.toFixed(3)} ) +
    uGiSunBounceColor * ( giSunScatter * uGiStrength * 0.42 * ${giWeight.toFixed(3)} ) +
    uGiAgoraGlowColor * ( giAgoraBounce * ${giWeight.toFixed(3)} )
  );
  reflectedLight.indirectDiffuse += giDiffuseBoost;

  float giRipple = 0.55 + 0.45 * sin( vGiWorldPos.x * 1.35 + uGiTime * 1.9 ) * cos( vGiWorldPos.z * 1.35 - uGiTime * 1.6 );
  float giWetSpec = uGiWetness * ${wetnessWeight.toFixed(3)} * giRipple * max( 0.0, giN.y ) * 0.085;
  reflectedLight.indirectSpecular += uGiSkyColor * giWetSpec;

  if ( uCleanseWaveIntensity > 0.001 ) {
    float cleanseDist = giAgoraDist - uCleanseWaveRadius;
    float waveCrest = exp( -cleanseDist * cleanseDist * 0.55 ) * uCleanseWaveIntensity;
    float wakeBand = smoothstep( 1.2, -2.5, cleanseDist ) * ( 1.0 - smoothstep( -4.0, -9.5, cleanseDist ) ) * uCleanseWaveIntensity;
    float effScale = 0.28 + 0.72 * uCleanseEfficiency;
    reflectedLight.indirectDiffuse += uCleanseWaveColor * ( waveCrest * ( 0.45 + 0.55 * effScale ) + wakeBand * 0.12 * effScale );
    reflectedLight.indirectSpecular += uCleanseWaveColor * ( waveCrest * 0.28 * max( 0.2, giN.y ) * effScale );
  }
}`
      )
      .replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
#ifdef USE_FOG
  float vDist = length( vViewPosition );
  float heightFalloff = exp( -max( 0.0, vGiWorldPos.y ) * 0.45 );
  float volFogFactor = 1.0 - exp( -pow( uVolumetricFogDensity * vDist * heightFalloff, 1.35 ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, uVolumetricFogColor, clamp( volFogFactor * uVolumetricFogEnabled, 0.0, 0.94 ) );
#endif`
      );
  };
  material.needsUpdate = true;
}

export interface AtmosphericSkyDome {
  mesh: THREE.Mesh;
  update: (delta: number, elapsed: number, targets: AtmosphereTargets) => void;
  dispose: () => void;
}

export function createAtmosphericSkyDome(
  giUniforms: GlobalIlluminationUniforms
): AtmosphericSkyDome {
  const geometry = new THREE.SphereGeometry(68, 16, 10);

  const skyUniforms = {
    uZenithColor: { value: new THREE.Color(0x081d22) },
    uHorizonColor: { value: new THREE.Color(0x13383a) },
    uSunGlowColor: { value: new THREE.Color(0xfde68a) },
    uAgoraGlowColor: giUniforms.uGiAgoraGlowColor,
    uSunDirection: giUniforms.uGiSunDirection,
    uCloudCover: { value: 0.2 },
    uOvercast: { value: 0.15 },
    uNightFactor: { value: 0.05 },
    uTime: giUniforms.uGiTime
  };

  const material = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4( position, 1.0 );
        vWorldDir = normalize( worldPos.xyz );
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunGlowColor;
      uniform vec3 uAgoraGlowColor;
      uniform vec3 uSunDirection;
      uniform float uCloudCover;
      uniform float uOvercast;
      uniform float uNightFactor;
      uniform float uTime;
      varying vec3 vWorldDir;

      float hash21( vec2 p ) {
        p = fract( p * vec2( 123.34, 456.21 ) );
        p += dot( p, p + 45.32 );
        return fract( p.x * p.y );
      }

      float valueNoise( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        float a = hash21( i );
        float b = hash21( i + vec2( 1.0, 0.0 ) );
        float c = hash21( i + vec2( 0.0, 1.0 ) );
        float d = hash21( i + vec2( 1.0, 1.0 ) );
        return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
      }

      void main() {
        vec3 dir = normalize( vWorldDir );
        float elev = clamp( dir.y, -0.25, 1.0 );
        float horizonMix = pow( 1.0 - clamp( elev, 0.0, 1.0 ), 2.1 );
        vec3 sky = mix( uZenithColor, uHorizonColor, horizonMix );

        // Dispersión Mie direccional solar / lunar
        float sunDot = max( 0.0, dot( dir, normalize( uSunDirection ) ) );
        float sunHalo = pow( sunDot, 6.0 ) * ( 0.35 - uOvercast * 0.22 );
        float sunDisc = pow( sunDot, 64.0 ) * ( 0.45 - uOvercast * 0.35 );
        sky += uSunGlowColor * ( sunHalo + sunDisc );

        // Nubosidad atmosférica gradual
        if ( dir.y > -0.05 ) {
          vec2 cloudUv = dir.xz / ( max( dir.y, 0.08 ) + 0.18 );
          float n1 = valueNoise( cloudUv * 1.6 + vec2( uTime * 0.015, uTime * 0.008 ) );
          float n2 = valueNoise( cloudUv * 3.4 - vec2( uTime * 0.01, uTime * 0.018 ) );
          float clouds = smoothstep( 1.0 - uCloudCover * 0.78, 1.0, n1 * 0.65 + n2 * 0.35 );
          vec3 cloudCol = mix( uHorizonColor * 1.25, uSunGlowColor * 0.8, sunHalo );
          sky = mix( sky, cloudCol, clouds * ( 0.28 + uOvercast * 0.42 ) * smoothstep( -0.05, 0.35, dir.y ) );
        }

        // Estrellas sutiles durante turnos nocturnos
        if ( uNightFactor > 0.15 && dir.y > 0.05 ) {
          vec2 starGrid = floor( dir.xz / max( dir.y, 0.15 ) * 48.0 );
          float starSeed = hash21( starGrid );
          if ( starSeed > 0.992 ) {
            float twinkle = 0.55 + 0.45 * sin( uTime * 2.2 + starSeed * 80.0 );
            sky += vec3( 0.78, 0.88, 1.0 ) * twinkle * uNightFactor * ( 1.0 - uOvercast * 0.85 ) * 0.55;
          }
        }

        // Sutil reflejo inferior desde el Ágora en el hemisferio bajo
        float groundMask = smoothstep( 0.05, -0.35, dir.y );
        sky = mix( sky, uHorizonColor * 0.55 + uAgoraGlowColor * 0.08, groundMask );

        gl_FragColor = vec4( max( sky, vec3( 0.0 ) ), 1.0 );
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  const update: AtmosphericSkyDome['update'] = (delta, elapsed, targets) => {
    const alpha = 1 - Math.exp(-1.55 * delta);

    giUniforms.uGiSkyColor.value.lerp(targets.giSkyBounceColor, alpha);
    giUniforms.uGiGroundColor.value.lerp(targets.giGroundBounceColor, alpha);
    giUniforms.uGiSunDirection.value.lerp(targets.sunDirection, alpha).normalize();
    giUniforms.uGiSunBounceColor.value.lerp(targets.giSunBounceColor, alpha);
    giUniforms.uGiAgoraGlowColor.value.lerp(targets.giAgoraGlowColor, alpha);
    giUniforms.uGiAgoraGlowStrength.value = THREE.MathUtils.damp(
      giUniforms.uGiAgoraGlowStrength.value,
      targets.giAgoraGlowStrength,
      1.6,
      delta
    );
    giUniforms.uGiStrength.value = THREE.MathUtils.damp(
      giUniforms.uGiStrength.value,
      targets.giStrength,
      1.6,
      delta
    );
    giUniforms.uGiWetness.value = THREE.MathUtils.damp(
      giUniforms.uGiWetness.value,
      targets.giWetness,
      1.4,
      delta
    );
    giUniforms.uVolumetricFogColor.value.lerp(targets.volumetricFogColor, alpha);
    giUniforms.uVolumetricFogDensity.value = THREE.MathUtils.damp(
      giUniforms.uVolumetricFogDensity.value,
      targets.volumetricFogDensity,
      1.4,
      delta
    );
    giUniforms.uVolumetricFogEnabled.value = THREE.MathUtils.damp(
      giUniforms.uVolumetricFogEnabled.value,
      targets.volumetricFogEnabled,
      1.4,
      delta
    );
    giUniforms.uGiTime.value = elapsed;

    skyUniforms.uZenithColor.value.lerp(targets.skyZenithColor, alpha);
    skyUniforms.uHorizonColor.value.lerp(targets.skyHorizonColor, alpha);
    skyUniforms.uSunGlowColor.value.lerp(targets.skySunGlowColor, alpha);
    skyUniforms.uCloudCover.value = THREE.MathUtils.damp(
      skyUniforms.uCloudCover.value,
      targets.cloudCover,
      1.3,
      delta
    );
    skyUniforms.uOvercast.value = THREE.MathUtils.damp(
      skyUniforms.uOvercast.value,
      targets.overcast,
      1.3,
      delta
    );
    skyUniforms.uNightFactor.value = THREE.MathUtils.damp(
      skyUniforms.uNightFactor.value,
      targets.nightFactor,
      1.4,
      delta
    );
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, update, dispose };
}
