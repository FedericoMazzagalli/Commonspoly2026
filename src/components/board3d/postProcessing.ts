/**
 * postProcessing.ts
 * Pipeline de post-procesado cinematográfico en Three.js para el tablero Commonspoly 3D:
 * - RenderTarget HalfFloat con MSAA 4x en WebGL2
 * - RenderPass principal de la escena
 * - UnrealBloomPass calibrado dinámicamente para reflejos metálicos, Ágora y partículas
 * - CinematicColorPass (shader GLSL lineal de contraste, vibrancia, balance térmico por clima y viñeta suave)
 * - OutputPass (ACESFilmicToneMapping + conversión Linear -> sRGB)
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GamePhase, WeatherType } from '../../types/game';

const _targetTint = new THREE.Color(1.0, 1.0, 1.0);
const _targetShadowTint = new THREE.Color(0.95, 1.0, 1.02);

export const CinematicColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.07 },
    uSaturation: { value: 1.09 },
    uLift: { value: 0.004 },
    uVignette: { value: 0.24 },
    uTint: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uShadowTint: { value: new THREE.Color(0.94, 1.0, 1.03) }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uLift;
    uniform float uVignette;
    uniform vec3 uTint;
    uniform vec3 uShadowTint;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = max(texel.rgb, vec3(0.0));

      // Luminancia perceptual en espacio lineal (Rec. 709)
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

      // Contraste fílmico suave alrededor del gris medio lineal (0.18)
      vec3 contrasted = max((col - 0.18) * uContrast + 0.18, vec3(0.0));

      // Tinte atmosférico en luces y sombras
      float shadowMask = 1.0 - smoothstep(0.02, 0.42, luma);
      vec3 graded = contrasted * uTint;
      graded = mix(graded, graded * uShadowTint, shadowMask * 0.65) + vec3(uLift);

      // Vibrancia equilibrada (evita saturar en exceso colores ya intensos)
      float maxC = max(graded.r, max(graded.g, graded.b));
      float minC = min(graded.r, min(graded.g, graded.b));
      float satAmount = maxC - minC;
      float vibranceWeight = mix(uSaturation, 1.0 + (uSaturation - 1.0) * 0.45, clamp(satAmount, 0.0, 1.0));
      float gradedLuma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(gradedLuma), graded, vibranceWeight);

      // Viñeta periférica sutil que enmarca el tablero sin oscurecer esquinas
      vec2 centeredUv = vUv * 2.0 - 1.0;
      float dist = length(centeredUv);
      float vig = 1.0 - smoothstep(0.55, 1.45, dist) * uVignette;
      graded *= vig;

      gl_FragColor = vec4(max(graded, vec3(0.0)), texel.a);
    }
  `
};

export interface BoardPostProcessingController {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  colorPass: ShaderPass;
  outputPass: OutputPass;
  updateAtmosphere: (params: {
    weatherType: WeatherType;
    weatherIntensity: number;
    phase: GamePhase;
    gameResult?: 'VICTORY' | 'DRAW' | 'DEFEAT';
    hasCelebrationBurst: boolean;
    postTint?: THREE.Color;
    postShadowTint?: THREE.Color;
    twilightFactor?: number;
    nightFactor?: number;
    delta: number;
  }) => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createBoardPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number
): BoardPostProcessingController {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const pixelRatio = renderer.getPixelRatio();

  // RenderTarget HDR HalfFloat con MSAA 4x para preservar rango dinámico antes del Bloom y OutputPass
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.floor(safeWidth * pixelRatio),
    Math.floor(safeHeight * pixelRatio),
    {
      type: THREE.HalfFloatType,
      samples: 4
    }
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(safeWidth, safeHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(safeWidth, safeHeight),
    0.34, // strength calibrado para acentos dorados, Ágora y partículas sin saturar casillas
    0.44, // radius
    0.86  // threshold
  );
  composer.addPass(bloomPass);

  const colorPass = new ShaderPass(CinematicColorGradingShader);
  composer.addPass(colorPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const updateAtmosphere: BoardPostProcessingController['updateAtmosphere'] = ({
    weatherType,
    weatherIntensity,
    phase,
    gameResult,
    hasCelebrationBurst,
    postTint,
    postShadowTint,
    twilightFactor = 0,
    nightFactor = 0,
    delta
  }) => {
    const isGameOver = phase === 'GAME_OVER';

    let targetStrength = 0.34 + twilightFactor * 0.05 + nightFactor * 0.08;
    let targetThreshold = 0.86 - nightFactor * 0.04;
    let targetRadius = 0.44;
    let targetContrast = 1.07;
    let targetSaturation = 1.08;
    let targetVignette = 0.24 + nightFactor * 0.05;

    if (weatherType === 'RAIN') {
      _targetTint.setRGB(0.94, 1.0, 1.06);
      _targetShadowTint.setRGB(0.88, 0.98, 1.08);
      targetStrength += 0.03 + weatherIntensity * 0.05;
      targetThreshold = Math.min(targetThreshold, 0.83);
      targetContrast = 1.1;
      targetSaturation = 1.07;
      targetVignette += 0.04;
    } else if (weatherType === 'SNOW') {
      _targetTint.setRGB(0.96, 0.99, 1.06);
      _targetShadowTint.setRGB(0.9, 0.96, 1.08);
      targetStrength += weatherIntensity * 0.04;
      targetThreshold = 0.88;
      targetContrast = 1.05;
      targetSaturation = 1.03;
      targetVignette = 0.22;
    } else if (weatherType === 'SUNNY') {
      _targetTint.setRGB(1.04, 1.01, 0.95);
      _targetShadowTint.setRGB(0.94, 1.0, 1.02);
      targetStrength += 0.04 + weatherIntensity * 0.06;
      targetThreshold = Math.min(targetThreshold, 0.84);
      targetContrast = 1.08;
      targetSaturation = 1.12;
      targetVignette = 0.21;
    } else if (weatherType === 'DROUGHT') {
      _targetTint.setRGB(1.07, 0.97, 0.89);
      _targetShadowTint.setRGB(1.02, 0.94, 0.88);
      targetStrength = 0.4;
      targetThreshold = 0.82;
      targetContrast = 1.11;
      targetSaturation = 1.09;
      targetVignette = 0.3;
    } else {
      _targetTint.setRGB(1.0, 1.01, 0.99);
      _targetShadowTint.setRGB(0.94, 1.0, 1.02);
    }

    if (postTint) {
      _targetTint.lerp(postTint, 0.65);
    }
    if (postShadowTint) {
      _targetShadowTint.lerp(postShadowTint, 0.65);
    }

    if (hasCelebrationBurst) {
      targetStrength += 0.12;
      targetThreshold = Math.min(targetThreshold, 0.78);
      targetRadius = 0.52;
    }

    if (isGameOver) {
      if (gameResult === 'VICTORY') {
        _targetTint.setRGB(0.98, 1.04, 1.0);
        _targetShadowTint.setRGB(0.9, 1.04, 1.0);
        targetStrength = 0.48;
        targetThreshold = 0.78;
        targetSaturation = 1.14;
        targetVignette = 0.22;
      } else if (gameResult === 'DEFEAT') {
        _targetTint.setRGB(1.03, 0.94, 0.95);
        _targetShadowTint.setRGB(1.04, 0.9, 0.92);
        targetStrength = 0.4;
        targetContrast = 1.12;
        targetSaturation = 0.94;
        targetVignette = 0.32;
      } else {
        _targetTint.setRGB(0.96, 1.01, 1.05);
        targetStrength = 0.42;
        targetThreshold = 0.8;
      }
    }

    const alpha = 1 - Math.exp(-2.0 * delta);
    bloomPass.strength = THREE.MathUtils.damp(bloomPass.strength, targetStrength, 3.0, delta);
    bloomPass.threshold = THREE.MathUtils.damp(bloomPass.threshold, targetThreshold, 3.0, delta);
    bloomPass.radius = THREE.MathUtils.damp(bloomPass.radius, targetRadius, 3.0, delta);

    const uniforms = colorPass.uniforms;
    uniforms.uContrast.value = THREE.MathUtils.damp(uniforms.uContrast.value, targetContrast, 2.4, delta);
    uniforms.uSaturation.value = THREE.MathUtils.damp(uniforms.uSaturation.value, targetSaturation, 2.4, delta);
    uniforms.uVignette.value = THREE.MathUtils.damp(uniforms.uVignette.value, targetVignette, 2.4, delta);
    (uniforms.uTint.value as THREE.Color).lerp(_targetTint, alpha);
    (uniforms.uShadowTint.value as THREE.Color).lerp(_targetShadowTint, alpha);
  };

  const setSize = (nextW: number, nextH: number) => {
    const w = Math.max(1, nextW);
    const h = Math.max(1, nextH);
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  };

  const dispose = () => {
    renderTarget.dispose();
    renderPass.dispose();
    bloomPass.dispose();
    colorPass.dispose();
    outputPass.dispose();
    composer.dispose();
  };

  return {
    composer,
    bloomPass,
    colorPass,
    outputPass,
    updateAtmosphere,
    setSize,
    dispose
  };
}
