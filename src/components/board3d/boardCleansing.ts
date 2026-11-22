/**
 * boardCleansing.ts
 * Sistema 3D de Transición de 'Limpieza' al final de la partida:
 * - Mantiene la saturación real de las casillas de recursos durante la partida
 *   (desaturadas si están privatizadas, parciales si son públicas, vibrantes si son comunes).
 * - Al entrar en 'GAME_OVER', lanza una onda radial luminosa desde el Ágora Central
 *   que barre progresivamente todo el tablero, devolviendo el color a los recursos
 *   desaturados de forma proporcional a la eficiencia cooperativa final del equipo
 *   y liberando destellos ascendentes de purificación por cada casilla alcanzada.
 */

import * as THREE from 'three';
import { GamePhase, Tile } from '../../types/game';
import { GlobalIlluminationUniforms } from './globalIllumination';
import { setExplicitBoundingSphere } from './frustumCulling';

const SPARK_COUNT = 200;
const SWEEP_START_SEC = 0.22;
const SWEEP_END_SEC = 4.05;
const WAVE_MIN_RADIUS = 1.4;
const WAVE_MAX_RADIUS = 19.2;

const _tmpColor = new THREE.Color();
const _waveColorHigh = new THREE.Color(0x2dd4bf); // Turquesa/esmeralda regenerador
const _waveColorMid = new THREE.Color(0x38bdf8);  // Azul transición
const _waveColorLow = new THREE.Color(0xf59e0b);  // Ámbar cálido de resistencia

export interface TileSaturationEntry {
  uniform: { value: number };
  baseY: number;
}

export interface BoardCleansingUpdateParams {
  phase: GamePhase;
  flyT: number;
  delta: number;
  elapsed: number;
  efficiency: number; // [0, 1]
  tiles: Tile[];
  tileEntries: Map<number, TileSaturationEntry>;
  tileMeshes: Map<number, THREE.Mesh>;
  feltSatUniform: { value: number };
  tableSatUniform: { value: number };
  giUniforms: GlobalIlluminationUniforms;
  isTragedyActive: boolean;
  reducedMotion?: boolean;
}

export interface BoardCleansingResult {
  /** Progreso global normalizado de la onda de limpieza [0, 1] */
  cleansingProgress: number;
  /** Progreso local de limpieza por ID de casilla [0, 1] */
  tileCleanseProgress: Map<number, number>;
}

export interface BoardCleansingSystem {
  update: (params: BoardCleansingUpdateParams) => BoardCleansingResult;
  dispose: () => void;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getGameplayTileSaturation(tile: Tile, isTragedyActive: boolean): number {
  let sat = 1.0;
  if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
    if (tile.state === 'PRIVATE') {
      sat = 0.14;
    } else if (tile.state === 'PUBLIC') {
      sat = 0.56;
    } else {
      sat = 1.0;
    }
  } else if (tile.category === 'INALIENABLE_COMMON') {
    sat = 1.0;
  } else {
    sat = 0.96;
  }

  if (isTragedyActive) {
    sat *= 0.58;
  }
  return sat;
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(220, 255, 245, 0.85)');
    grad.addColorStop(0.65, 'rgba(45, 212, 191, 0.28)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBoardCleansingSystem(scene: THREE.Scene): BoardCleansingSystem {
  // 1. Anillo superficial de onda radial de limpieza (sin z-fighting, additive blending)
  const waveUniforms = {
    uRadius: { value: -5.0 },
    uIntensity: { value: 0.0 },
    uTime: { value: 0.0 },
    uColor: { value: new THREE.Color(0x2dd4bf) }
  };

  const waveGeo = new THREE.PlaneGeometry(40, 40);
  const waveMat = new THREE.ShaderMaterial({
    uniforms: waveUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vWorldXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRadius;
      uniform float uIntensity;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vWorldXZ;

      void main() {
        if (uIntensity <= 0.001) discard;
        float dist = length(vWorldXZ);
        float angle = atan(vWorldXZ.y, vWorldXZ.x);
        float ripple = sin(angle * 8.0 + uTime * 3.0) * 0.16;
        float d = dist - (uRadius + ripple);

        // Cresta afilada + estela suave interior
        float ringCore = exp(-d * d * 2.1);
        float outerHalo = exp(-d * d * 0.28) * 0.42;
        float innerWake = smoothstep(0.4, -3.2, d) * (1.0 - smoothstep(-3.2, -7.0, d)) * 0.22;

        // Atenuar antes de alcanzar el borde exterior de la mesa
        float boardMask = 1.0 - smoothstep(14.5, 19.5, dist);
        float alpha = (ringCore + outerHalo + innerWake) * uIntensity * boardMask;
        if (alpha <= 0.004) discard;

        vec3 col = mix(uColor, vec3(0.95, 1.0, 0.98), ringCore * 0.55);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
      }
    `
  });

  setExplicitBoundingSphere(waveGeo, 0, 0, 0, 20.5);
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.rotation.x = -Math.PI / 2;
  waveMesh.position.y = 0.345;
  waveMesh.renderOrder = 2;
  waveMesh.visible = false;
  waveMesh.frustumCulled = true;
  scene.add(waveMesh);

  // 2. Emisor agrupado de destellos de purificación cuando la onda limpia cada casilla
  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkColors = new Float32Array(SPARK_COUNT * 3);
  const sparkVelocities = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  const sparkMaxLife = new Float32Array(SPARK_COUNT);

  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkPositions[i * 3 + 1] = -25;
    sparkLife[i] = 0;
    sparkMaxLife[i] = 1;
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  setExplicitBoundingSphere(sparkGeo, 0, 2.5, 0, 21.0);

  const sparkTexture = createSparkTexture();
  const sparkMat = new THREE.PointsMaterial({
    size: 0.48,
    map: sparkTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.visible = false;
  sparkPoints.frustumCulled = true;
  scene.add(sparkPoints);

  let sparkCursor = 0;
  let wasGameOver = false;
  const startSaturations = new Map<number, number>();
  const triggeredTiles = new Set<number>();
  const tileCleanseProgress = new Map<number, number>();

  const spawnTileCleanseSparks = (
    tile: Tile,
    efficiency: number
  ) => {
    const count = Math.max(2, Math.round(3 + efficiency * 5));
    const posAttr = sparkGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = sparkGeo.getAttribute('color') as THREE.BufferAttribute;

    let accentHex = 0x34d399;
    if (tile.goodType === 'HEALTH') accentHex = 0xc084fc;
    else if (tile.goodType === 'URBAN') accentHex = 0xfb923c;
    else if (tile.goodType === 'KNOWLEDGE') accentHex = 0xfacc15;
    else if (tile.goodType === 'ENVIRONMENT') accentHex = 0x34d399;
    else if (tile.category === 'AGORA_ENTRY') accentHex = 0x2dd4bf;

    for (let k = 0; k < count; k++) {
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARK_COUNT;
      const pIdx = idx * 3;

      const ang = Math.random() * Math.PI * 2;
      const rad = 0.15 + Math.random() * 0.65;
      posAttr.setXYZ(idx, tile.x + Math.cos(ang) * rad, 0.36, tile.z + Math.sin(ang) * rad);

      sparkVelocities[pIdx] = Math.cos(ang) * (0.35 + Math.random() * 0.7);
      sparkVelocities[pIdx + 1] = 1.6 + Math.random() * (1.8 + efficiency * 1.4);
      sparkVelocities[pIdx + 2] = Math.sin(ang) * (0.35 + Math.random() * 0.7);

      const dur = 0.85 + Math.random() * 0.75;
      sparkLife[idx] = dur;
      sparkMaxLife[idx] = dur;

      const useEmerald = k % 2 === 0;
      _tmpColor.setHex(useEmerald ? 0x5eead4 : accentHex);
      colAttr.setXYZ(idx, _tmpColor.r, _tmpColor.g, _tmpColor.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sparkPoints.visible = true;
  };

  const updateParticles = (delta: number) => {
    if (!sparkPoints.visible) return;
    let anyAlive = false;
    const posAttr = sparkGeo.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < SPARK_COUNT; i++) {
      if (sparkLife[i] > 0) {
        anyAlive = true;
        sparkLife[i] -= delta;
        const pIdx = i * 3;
        sparkVelocities[pIdx + 1] -= 1.4 * delta;
        const drag = Math.pow(0.92, delta * 30);
        sparkVelocities[pIdx] *= drag;
        sparkVelocities[pIdx + 2] *= drag;

        const nx = posAttr.getX(i) + sparkVelocities[pIdx] * delta;
        const ny = posAttr.getY(i) + sparkVelocities[pIdx + 1] * delta;
        const nz = posAttr.getZ(i) + sparkVelocities[pIdx + 2] * delta;
        posAttr.setXYZ(i, nx, ny, nz);
      } else {
        posAttr.setY(i, -25);
      }
    }

    posAttr.needsUpdate = true;
    if (!anyAlive) {
      sparkPoints.visible = false;
    }
  };

  const update: BoardCleansingSystem['update'] = ({
    phase,
    flyT,
    delta,
    elapsed,
    efficiency,
    tiles,
    tileEntries,
    tileMeshes,
    feltSatUniform,
    tableSatUniform,
    giUniforms,
    isTragedyActive,
    reducedMotion = false
  }) => {
    const clampedEff = Math.max(0, Math.min(1, efficiency));

    // Seleccionar color de la onda según eficiencia cooperativa lograda
    if (clampedEff >= 0.65) {
      _tmpColor.copy(_waveColorMid).lerp(_waveColorHigh, (clampedEff - 0.65) / 0.35);
    } else if (clampedEff >= 0.3) {
      _tmpColor.copy(_waveColorLow).lerp(_waveColorMid, (clampedEff - 0.3) / 0.35);
    } else {
      _tmpColor.copy(_waveColorLow);
    }
    giUniforms.uCleanseWaveColor.value.copy(_tmpColor);
    waveUniforms.uColor.value.copy(_tmpColor);
    waveUniforms.uTime.value = elapsed;

    if (phase !== 'GAME_OVER') {
      if (wasGameOver) {
        wasGameOver = false;
        startSaturations.clear();
        triggeredTiles.clear();
        tileCleanseProgress.clear();
      }

      giUniforms.uCleanseWaveRadius.value = -5.0;
      giUniforms.uCleanseWaveIntensity.value = THREE.MathUtils.damp(
        giUniforms.uCleanseWaveIntensity.value,
        0,
        6,
        delta
      );
      giUniforms.uCleanseEfficiency.value = clampedEff;
      waveUniforms.uIntensity.value = 0;
      waveMesh.visible = false;

      // Durante partida activa: mostrar desaturación viva en casillas privatizadas/públicas
      let resourceCount = 0;
      let recoveredSum = 0;

      for (const tile of tiles) {
        const entry = tileEntries.get(tile.id);
        const mesh = tileMeshes.get(tile.id);
        if (!entry) continue;

        const targetSat = getGameplayTileSaturation(tile, isTragedyActive);
        entry.uniform.value = THREE.MathUtils.damp(entry.uniform.value, targetSat, 4.5, delta);

        if (mesh) {
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, entry.baseY, 6, delta);
        }

        if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
          resourceCount++;
          recoveredSum += tile.state === 'COMMON' ? 1 : tile.state === 'PUBLIC' ? 0.45 : 0;
        }
      }

      const boardVitality = resourceCount > 0 ? recoveredSum / resourceCount : 1;
      const targetBoardSat = isTragedyActive
        ? 0.55
        : THREE.MathUtils.lerp(0.74, 1.0, boardVitality);
      feltSatUniform.value = THREE.MathUtils.damp(feltSatUniform.value, targetBoardSat, 3.2, delta);
      tableSatUniform.value = THREE.MathUtils.damp(
        tableSatUniform.value,
        THREE.MathUtils.lerp(0.82, 1.0, boardVitality),
        3.2,
        delta
      );

      updateParticles(delta);
      return { cleansingProgress: 0, tileCleanseProgress };
    }

    // --- FASE GAME_OVER: TRANSICIÓN PROGRESIVA DE LIMPIEZA ---
    if (!wasGameOver) {
      wasGameOver = true;
      triggeredTiles.clear();
      tileCleanseProgress.clear();
      startSaturations.clear();

      for (const tile of tiles) {
        const currentSat = tileEntries.get(tile.id)?.uniform.value ?? getGameplayTileSaturation(tile, false);
        // Las casillas ya comunes parten ligeramente atenuadas (0.86) para lucir la ola de purificación
        const baseStart =
          tile.state === 'COMMON' || tile.category === 'INALIENABLE_COMMON'
            ? Math.min(currentSat, 0.86)
            : currentSat;
        startSaturations.set(tile.id, baseStart);
      }
    }

    const rawSweep = (flyT - SWEEP_START_SEC) / (SWEEP_END_SEC - SWEEP_START_SEC);
    const clampedSweep = Math.max(0, Math.min(1, rawSweep));
    // Ease-out cúbico suave para el avance radial
    const easedSweep = 1 - Math.pow(1 - clampedSweep, 2.2);
    const waveRadius = THREE.MathUtils.lerp(WAVE_MIN_RADIUS, WAVE_MAX_RADIUS, easedSweep);

    // Intensidad luminosa de la onda: sube rápido al arrancar y se desvanece limpiamente tras cruzar el tablero
    const fadeIn = smoothstep(0.0, 0.12, clampedSweep);
    const fadeOut = 1.0 - smoothstep(0.84, 1.0, clampedSweep);
    const waveIntensity = fadeIn * fadeOut * (0.45 + 0.65 * clampedEff);

    giUniforms.uCleanseWaveRadius.value = waveRadius;
    giUniforms.uCleanseWaveIntensity.value = waveIntensity;
    giUniforms.uCleanseEfficiency.value = clampedEff;

    waveUniforms.uRadius.value = waveRadius;
    waveUniforms.uIntensity.value = waveIntensity * 0.95;
    waveMesh.visible = !reducedMotion && waveIntensity > 0.01;

    // Restaurar color en el tapete y mesa según avance de onda y eficiencia final
    const boardCleanseFraction = smoothstep(2.0, 15.5, waveRadius);
    const targetFeltSat = THREE.MathUtils.lerp(
      0.72,
      THREE.MathUtils.lerp(0.76, 1.08, Math.pow(clampedEff, 0.85)),
      boardCleanseFraction
    );
    const targetTableSat = THREE.MathUtils.lerp(
      0.8,
      THREE.MathUtils.lerp(0.82, 1.05, Math.pow(clampedEff, 0.85)),
      boardCleanseFraction
    );
    feltSatUniform.value = THREE.MathUtils.damp(feltSatUniform.value, targetFeltSat, 4.5, delta);
    tableSatUniform.value = THREE.MathUtils.damp(tableSatUniform.value, targetTableSat, 4.5, delta);

    // Restaurar color casilla a casilla conforme la onda las alcanza
    const effPower = Math.pow(clampedEff, 0.82);

    for (const tile of tiles) {
      const entry = tileEntries.get(tile.id);
      const mesh = tileMeshes.get(tile.id);
      if (!entry) continue;

      const startSat = startSaturations.get(tile.id) ?? 0.5;
      const tileDist = Math.hypot(tile.x, tile.z);
      // Desfase angular sutil para que el barrido tenga ritmo orgánico alrededor del perímetro
      const angleBias = (Math.atan2(tile.z, tile.x) + Math.PI) / (Math.PI * 2);
      const triggerDist = tileDist + angleBias * 0.75;

      const localProgress = smoothstep(triggerDist - 1.1, triggerDist + 1.45, waveRadius);
      tileCleanseProgress.set(tile.id, localProgress);

      const maxTargetSat =
        tile.category === 'RESOURCE' ||
        tile.category === 'AGORA_ENTRY' ||
        tile.category === 'INALIENABLE_COMMON'
          ? 1.0 + 0.14 * clampedEff
          : 1.02 + 0.06 * clampedEff;

      const recoveredTargetSat = THREE.MathUtils.lerp(startSat, maxTargetSat, effPower);
      const finalSat = THREE.MathUtils.lerp(startSat, recoveredTargetSat, localProgress);

      entry.uniform.value = THREE.MathUtils.damp(entry.uniform.value, finalSat, 7.5, delta);

      // Ligera elevación ceremonial cuando la onda purifica la casilla
      if (mesh) {
        const waveLift =
          !reducedMotion && localProgress > 0 && localProgress < 1
            ? Math.sin(localProgress * Math.PI) * (0.05 + 0.12 * clampedEff)
            : 0;
        mesh.position.y = THREE.MathUtils.damp(mesh.position.y, entry.baseY + waveLift, 8, delta);
      }

      // Emitir destellos al cruzar el frente de onda sobre cada casilla
      if (
        !reducedMotion &&
        localProgress >= 0.22 &&
        clampedEff > 0.05 &&
        !triggeredTiles.has(tile.id)
      ) {
        triggeredTiles.add(tile.id);
        if (
          tile.category === 'RESOURCE' ||
          tile.category === 'AGORA_ENTRY' ||
          tile.category === 'INALIENABLE_COMMON'
        ) {
          spawnTileCleanseSparks(tile, clampedEff);
        }
      }
    }

    updateParticles(delta);

    return {
      cleansingProgress: clampedSweep,
      tileCleanseProgress
    };
  };

  const dispose = () => {
    scene.remove(waveMesh);
    waveGeo.dispose();
    waveMat.dispose();
    scene.remove(sparkPoints);
    sparkGeo.dispose();
    sparkMat.dispose();
    sparkTexture.dispose();
    startSaturations.clear();
    triggeredTiles.clear();
    tileCleanseProgress.clear();
  };

  return { update, dispose };
}
