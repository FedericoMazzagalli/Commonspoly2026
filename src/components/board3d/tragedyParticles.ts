/**
 * tragedyParticles.ts
 * Sistema de partículas 3D en Three.js exclusivo del evento 'Tragedia de los Comunes':
 * lluvia de hojas secas tridimensionales en InstancedMesh + ceniza/esporas desaturadas
 * para visualizar la pérdida de bienes comunes y el impacto ambiental sobre el tablero.
 */

import * as THREE from 'three';
import { setExplicitBoundingSphere } from './frustumCulling';

const LEAF_COUNT = 170;
const ASH_COUNT = 240;
const BOARD_SPAN = 26;

// Pre-allocated math helpers (zero per-frame GC allocations)
const _leafDummy = new THREE.Object3D();
const _leafColor = new THREE.Color();

export interface TragedyParticleSystem {
  update: (
    isTragedyActive: boolean,
    delta: number,
    elapsed: number,
    reducedMotion?: boolean,
    isInFrustum?: boolean
  ) => void;
  isVisible: () => boolean;
  dispose: () => void;
}

/**
 * Construye una geometría orgánica de hoja seca con nervadura central y curvatura 3D
 * con poligonaje optimizado para InstancedMesh en dispositivos móviles.
 */
function createDryLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.46, 0.72, 2, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Perfil ahusado en punta y peciolo + ligero abombamiento de hoja seca
    const normalizedY = y / 0.36; // [-1, 1]
    const taper = Math.max(0.18, 1 - Math.pow(Math.abs(normalizedY), 1.65) * 0.85);
    const curvedX = x * taper;
    const midribFold = Math.abs(x) * 0.24;
    const longitudinalCurl = (normalizedY * normalizedY) * 0.08;

    pos.setXYZ(i, curvedX, y, midribFold - longitudinalCurl);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Genera una textura procedural de hoja seca marchita con nervaduras y bordes irregulares.
 */
function createDryLeafTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 64, 96);

    // Silueta orgánica de hoja ligeramente arqueada
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.bezierCurveTo(54, 22, 60, 56, 36, 82);
    ctx.lineTo(33, 93);
    ctx.lineTo(31, 93);
    ctx.lineTo(28, 82);
    ctx.bezierCurveTo(4, 56, 10, 22, 32, 4);
    ctx.closePath();

    const grad = ctx.createLinearGradient(12, 8, 52, 84);
    grad.addColorStop(0, '#d6cbb8');
    grad.addColorStop(0.5, '#b8aa95');
    grad.addColorStop(1, '#8b7d6b');
    ctx.fillStyle = grad;
    ctx.fill();

    // Nervadura central y venas laterales secas
    ctx.strokeStyle = 'rgba(72, 60, 48, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(32, 92);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    for (let y = 20; y <= 68; y += 14) {
      const reach = y < 48 ? 17 : 13;
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(32 - reach, y - 8);
      ctx.moveTo(32, y + 3);
      ctx.lineTo(32 + reach, y - 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  return texture;
}

/**
 * Genera una textura suave mate para motas de ceniza y polvillo desaturado.
 */
function createDesaturatedAshTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(226, 224, 218, 0.92)');
    grad.addColorStop(0.45, 'rgba(182, 178, 170, 0.55)');
    grad.addColorStop(1, 'rgba(130, 126, 118, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTragedyParticleSystem(
  scene: THREE.Scene,
  maxAnisotropy = 1
): TragedyParticleSystem {
  // --- 1. LLUVIA DE HOJAS SECAS 3D (InstancedMesh) ---
  const leafGeo = createDryLeafGeometry();
  const leafTexture = createDryLeafTexture(maxAnisotropy);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: leafTexture,
    alphaTest: 0.3,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0
  });

  setExplicitBoundingSphere(leafGeo, 0, 7.5, 0, 21.5);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
  leafMesh.visible = false;
  leafMesh.frustumCulled = true;
  leafMesh.castShadow = false;
  leafMesh.receiveShadow = false;

  const leafPosX = new Float32Array(LEAF_COUNT);
  const leafPosY = new Float32Array(LEAF_COUNT);
  const leafPosZ = new Float32Array(LEAF_COUNT);
  const leafFallSpeed = new Float32Array(LEAF_COUNT);
  const leafFlutterFreq = new Float32Array(LEAF_COUNT);
  const leafPhase = new Float32Array(LEAF_COUNT);
  const leafRotX = new Float32Array(LEAF_COUNT);
  const leafRotY = new Float32Array(LEAF_COUNT);
  const leafRotZ = new Float32Array(LEAF_COUNT);
  const leafSpinX = new Float32Array(LEAF_COUNT);
  const leafSpinY = new Float32Array(LEAF_COUNT);
  const leafSpinZ = new Float32Array(LEAF_COUNT);
  const leafScale = new Float32Array(LEAF_COUNT);

  // Paleta terrosa desaturada (hojas secas, paja marchita, ceniza sepia)
  const dryLeafPalette = [
    0x8f7a5e,
    0x786652,
    0xa19178,
    0x6b6757,
    0x5d5144,
    0x948779
  ];

  const resetLeaf = (i: number, initialStagger = true) => {
    leafPosX[i] = (Math.random() - 0.5) * BOARD_SPAN;
    leafPosY[i] = initialStagger ? 2.4 + Math.random() * 13.0 : 12.2 + Math.random() * 3.2;
    leafPosZ[i] = (Math.random() - 0.5) * BOARD_SPAN;
    leafFallSpeed[i] = 1.45 + Math.random() * 1.45;
    leafFlutterFreq[i] = 1.4 + Math.random() * 1.8;
    leafPhase[i] = Math.random() * Math.PI * 2;
    leafRotX[i] = Math.random() * Math.PI * 2;
    leafRotY[i] = Math.random() * Math.PI * 2;
    leafRotZ[i] = Math.random() * Math.PI * 2;
    leafSpinX[i] = (Math.random() - 0.5) * 3.1;
    leafSpinY[i] = (Math.random() - 0.5) * 2.8;
    leafSpinZ[i] = (Math.random() - 0.5) * 2.4;
    leafScale[i] = 0.78 + Math.random() * 0.55;
  };

  for (let i = 0; i < LEAF_COUNT; i++) {
    resetLeaf(i, true);
    _leafColor.setHex(dryLeafPalette[i % dryLeafPalette.length]);
    leafMesh.setColorAt(i, _leafColor);
  }
  if (leafMesh.instanceColor) {
    leafMesh.instanceColor.needsUpdate = true;
  }
  scene.add(leafMesh);

  // --- 2. PARTÍCULAS DESATURADAS / CENIZA AMBIENTAL (Points) ---
  const ashTexture = createDesaturatedAshTexture();
  const ashPositions = new Float32Array(ASH_COUNT * 3);
  const ashColors = new Float32Array(ASH_COUNT * 3);
  const ashSpeeds = new Float32Array(ASH_COUNT);
  const ashPhases = new Float32Array(ASH_COUNT);
  const ashPalette = [0x9ca3af, 0xa8a29e, 0x878279, 0x78716c, 0xb5ada1];

  const resetAshParticle = (i: number, initialStagger = true) => {
    ashPositions[i * 3] = (Math.random() - 0.5) * BOARD_SPAN;
    ashPositions[i * 3 + 1] = initialStagger ? 0.8 + Math.random() * 13.5 : 12.6 + Math.random() * 2.4;
    ashPositions[i * 3 + 2] = (Math.random() - 0.5) * BOARD_SPAN;
    ashSpeeds[i] = 0.85 + Math.random() * 1.15;
    ashPhases[i] = Math.random() * Math.PI * 2;
  };

  for (let i = 0; i < ASH_COUNT; i++) {
    resetAshParticle(i, true);
    _leafColor.setHex(ashPalette[i % ashPalette.length]);
    ashColors[i * 3] = _leafColor.r;
    ashColors[i * 3 + 1] = _leafColor.g;
    ashColors[i * 3 + 2] = _leafColor.b;
  }

  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  ashGeo.setAttribute('color', new THREE.BufferAttribute(ashColors, 3));
  setExplicitBoundingSphere(ashGeo, 0, 7.5, 0, 21.5);

  const ashMat = new THREE.PointsMaterial({
    size: 0.36,
    map: ashTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  const ashPoints = new THREE.Points(ashGeo, ashMat);
  ashPoints.visible = false;
  ashPoints.frustumCulled = true;
  scene.add(ashPoints);

  let tragedyWeight = 0;
  let wasTragedyActive = false;

  const update = (
    isTragedyActive: boolean,
    delta: number,
    elapsed: number,
    reducedMotion = false,
    isInFrustum = true
  ) => {
    // Al iniciar el evento, dispersamos de inmediato la lluvia de hojas por el volumen aéreo
    if (isTragedyActive && !wasTragedyActive) {
      for (let i = 0; i < LEAF_COUNT; i++) {
        resetLeaf(i, true);
      }
      const ashAttr = ashGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < ASH_COUNT; i++) {
        resetAshParticle(i, true);
        ashAttr.setXYZ(
          i,
          ashPositions[i * 3],
          ashPositions[i * 3 + 1],
          ashPositions[i * 3 + 2]
        );
      }
      ashAttr.needsUpdate = true;
    }
    wasTragedyActive = isTragedyActive;

    tragedyWeight = THREE.MathUtils.damp(
      tragedyWeight,
      isTragedyActive ? 1 : 0,
      isTragedyActive ? 2.8 : 4.6,
      delta
    );

    if (tragedyWeight <= 0.008) {
      leafMesh.visible = false;
      ashPoints.visible = false;
      leafMat.opacity = 0;
      ashMat.opacity = 0;
      return;
    }

    leafMesh.visible = true;
    ashPoints.visible = true;
    leafMat.opacity = Math.min(0.95, tragedyWeight * 0.96);
    ashMat.opacity = Math.min(0.72, tragedyWeight * 0.74);

    if (!isInFrustum) {
      return;
    }

    const motionScale = reducedMotion ? 0.25 : 1.0;

    // Actualizar cada hoja seca en caída con planeo oscilante y giro 3D
    for (let i = 0; i < LEAF_COUNT; i++) {
      const ph = leafPhase[i];
      const freq = leafFlutterFreq[i];

      leafPosY[i] -= leafFallSpeed[i] * motionScale * delta;
      leafPosX[i] +=
        (Math.sin(elapsed * freq + ph) * 1.15 + Math.cos(elapsed * 0.45 + ph) * 0.35) *
        motionScale *
        delta;
      leafPosZ[i] +=
        (Math.cos(elapsed * (freq * 0.85) + ph) * 1.05 + Math.sin(elapsed * 0.4 + ph) * 0.3) *
        motionScale *
        delta;

      leafRotX[i] += leafSpinX[i] * motionScale * delta;
      leafRotY[i] += leafSpinY[i] * motionScale * delta;
      leafRotZ[i] += leafSpinZ[i] * motionScale * delta;

      if (leafPosY[i] < 0.25) {
        resetLeaf(i, false);
      }

      _leafDummy.position.set(leafPosX[i], leafPosY[i], leafPosZ[i]);
      _leafDummy.rotation.set(leafRotX[i], leafRotY[i], leafRotZ[i]);
      _leafDummy.scale.setScalar(leafScale[i] * (0.75 + 0.25 * tragedyWeight));
      _leafDummy.updateMatrix();
      leafMesh.setMatrixAt(i, _leafDummy.matrix);
    }
    leafMesh.instanceMatrix.needsUpdate = true;

    // Actualizar partículas desaturadas de ceniza y sequía
    const ashPosAttr = ashGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < ASH_COUNT; i++) {
      let ax = ashPosAttr.getX(i);
      let ay = ashPosAttr.getY(i);
      let az = ashPosAttr.getZ(i);
      const ph = ashPhases[i];
      const spd = ashSpeeds[i];

      ay -= spd * motionScale * delta;
      ax += (Math.sin(elapsed * 0.9 + ph) * 0.72 + 0.18) * motionScale * delta;
      az += Math.cos(elapsed * 0.82 + ph) * 0.65 * motionScale * delta;

      if (ay < 0.24) {
        ay = 12.6 + Math.random() * 2.2;
        ax = (Math.random() - 0.5) * BOARD_SPAN;
        az = (Math.random() - 0.5) * BOARD_SPAN;
      }

      ashPosAttr.setXYZ(i, ax, ay, az);
    }
    ashPosAttr.needsUpdate = true;
  };

  const isVisible = () => tragedyWeight > 0.008;

  const dispose = () => {
    scene.remove(leafMesh);
    scene.remove(ashPoints);
    leafMesh.dispose();
    leafGeo.dispose();
    leafMat.dispose();
    leafTexture.dispose();
    ashGeo.dispose();
    ashMat.dispose();
    ashTexture.dispose();
  };

  return {
    update,
    isVisible,
    dispose
  };
}
