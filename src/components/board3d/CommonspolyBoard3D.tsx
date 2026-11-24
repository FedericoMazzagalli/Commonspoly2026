/**
 * Commonspoly 3D Board Scene (Three.js)
 * Renderizado de mesa de juego física, peones procedurales, casillas,
 * fichas de estado (blanco/gris/negro), columnas radiales, Ágora Central y dado 3D.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Tile,
  Character,
  Speculator,
  GamePhase,
  WeatherMode,
  TimeOfDayMode,
  GlobalCard,
  SituationCard,
  NeighborhoodDecision,
  GameEngineState,
  DynamicWeatherEvent,
  WeatherAdvancedConfig,
  TutorialBoardFocus,
  BoardDangerZoneEntry,
  SpeculatorTrajectory
} from '../../types/game';
import {
  AccessibilitySettings,
  ColorVisionMode,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  getAccessibilityPalette
} from '../../utils/accessibility';
import { DEFAULT_WEATHER_ADVANCED_CONFIG } from '../../utils/weatherSettings';
import { resolveWeather } from '../../utils/weather';
import {
  createAtmosphereTargets,
  resolveGameTimeOfDay,
  resolveCardAtmosphere,
  computeAtmosphereTargets
} from '../../utils/atmosphere';
import { audioManager, playSound } from '../../utils/audio';
import { createBoardPostProcessing, BoardPostProcessingController } from './postProcessing';
import {
  createGlobalIlluminationUniforms,
  applyGlobalIlluminationShader,
  createAtmosphericSkyDome
} from './globalIllumination';
import {
  CinematicCameraController,
  resolveBoardNodePath,
  mapTilePathToCoords
} from './cinematicCamera';
import { createTragedyParticleSystem } from './tragedyParticles';
import {
  createBoardCleansingSystem,
  TileSaturationEntry
} from './boardCleansing';
import { computeCooperativeEfficiency } from '../../utils/cooperativeEfficiency';
import { createCharacterPawnMesh } from './characterAvatarBuilder';
import {
  applyGroupFrustumAndDetailLOD,
  isWorldSphereInFrustum,
  markAsSecondaryDetail,
  setExplicitBoundingSphere,
  updateCameraFrustum
} from './frustumCulling';
import type { BoardPerformanceTelemetry } from '../../utils/performanceTelemetry';
import { useI18n } from '../../i18n';

interface Board3DProps {
  tiles: Tile[];
  players: Character[];
  speculators: Speculator[];
  activePlayerIndex: number;
  currentDiceRoll: number | null;
  cameraMode: 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW';
  phase?: GamePhase;
  round?: number;
  gameResult?: 'VICTORY' | 'DRAW' | 'DEFEAT';
  cooperativeEfficiency?: number;
  weatherMode?: WeatherMode;
  weatherIntensity?: number;
  weatherAdvancedConfig?: WeatherAdvancedConfig;
  activeWeatherEvent?: DynamicWeatherEvent | null;
  timeOfDayMode?: TimeOfDayMode;
  currentGlobalCard?: GlobalCard | null;
  currentSituationCard?: SituationCard | null;
  activeModal?: GameEngineState['activeModal'];
  neighborhoodDecision?: NeighborhoodDecision | null;
  postProcessingEnabled?: boolean;
  onTileClick?: (tile: Tile) => void;
  telemetryRef?: React.MutableRefObject<BoardPerformanceTelemetry>;
  tutorialFocus?: TutorialBoardFocus;
  speculatorHeatmap?: Record<number, BoardDangerZoneEntry> | null;
  speculatorTrajectories?: SpeculatorTrajectory[] | null;
  accessibilitySettings?: AccessibilitySettings;
  selectedTileId?: number | null;
}

// Pre-allocated math helpers (zero per-frame GC allocations)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, 0);
const _returnCamPos = new THREE.Vector3();
const _returnLookAt = new THREE.Vector3();
const _tempColor = new THREE.Color();
const _atmosphereTargets = createAtmosphereTargets();
const _raycasterPointer = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _coneUp = new THREE.Vector3(0, 1, 0);
const _coneDir = new THREE.Vector3();

export const CommonspolyBoard3D: React.FC<Board3DProps> = ({
  tiles,
  players,
  speculators,
  activePlayerIndex,
  currentDiceRoll,
  cameraMode,
  phase = 'TITLE',
  round = 1,
  gameResult,
  cooperativeEfficiency,
  weatherMode = 'AUTO',
  weatherIntensity = 0.85,
  weatherAdvancedConfig = DEFAULT_WEATHER_ADVANCED_CONFIG,
  activeWeatherEvent = null,
  timeOfDayMode = 'AUTO',
  currentGlobalCard = null,
  currentSituationCard = null,
  activeModal = null,
  neighborhoodDecision = null,
  postProcessingEnabled = true,
  onTileClick,
  telemetryRef,
  tutorialFocus = 'NONE',
  speculatorHeatmap = null,
  speculatorTrajectories = null,
  accessibilitySettings = DEFAULT_ACCESSIBILITY_SETTINGS,
  selectedTileId = null
}) => {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglLost, setWebglLost] = useState(false);

  // References to keep across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const speculatorMeshesRef = useRef<Map<number, THREE.Group>>(new Map());
  const chipMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const tileMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const agoraGroupRef = useRef<THREE.Group | null>(null);
  const diceGroupRef = useRef<THREE.Group | null>(null);
  const isRollingRef = useRef<boolean>(false);
  const diceTargetRotationRef = useRef<THREE.Euler>(new THREE.Euler());
  const gameOverElapsedRef = useRef<number>(0);
  const prevPhaseRef = useRef<GamePhase>(phase);
  const prevPlayerPositionsRef = useRef<Map<string, number>>(new Map());
  const prevTileStatesRef = useRef<Map<number, string | undefined>>(new Map());

  // Store latest props for the render loop
  const propsRef = useRef({
    tiles,
    players,
    speculators,
    activePlayerIndex,
    currentDiceRoll,
    cameraMode,
    phase,
    round,
    gameResult,
    cooperativeEfficiency,
    weatherMode,
    weatherIntensity,
    weatherAdvancedConfig,
    activeWeatherEvent,
    timeOfDayMode,
    currentGlobalCard,
    currentSituationCard,
    activeModal,
    neighborhoodDecision,
    postProcessingEnabled,
    onTileClick,
    telemetryRef,
    tutorialFocus,
    speculatorHeatmap,
    speculatorTrajectories,
    accessibilitySettings,
    selectedTileId
  });
  propsRef.current = {
    tiles,
    players,
    speculators,
    activePlayerIndex,
    currentDiceRoll,
    cameraMode,
    phase,
    round,
    gameResult,
    cooperativeEfficiency,
    weatherMode,
    weatherIntensity,
    weatherAdvancedConfig,
    activeWeatherEvent,
    timeOfDayMode,
    currentGlobalCard,
    currentSituationCard,
    activeModal,
    neighborhoodDecision,
    postProcessingEnabled,
    onTileClick,
    telemetryRef,
    tutorialFocus,
    speculatorHeatmap,
    speculatorTrajectories,
    accessibilitySettings,
    selectedTileId
  };

  // Helper: map board tile ID to (x, y, z)
  const getTileCoords = (tileId: number): { x: number; z: number } => {
    const tile = propsRef.current.tiles.find(t => t.id === tileId);
    if (tile) return { x: tile.x, z: tile.z };
    if (tileId === 100) return { x: 0, z: 0 };
    return { x: -10, z: 10 };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- 1. SETUP THREE.JS SCENE & RENDERER ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a1917); // Dark teal-tinted atmospheric canvas
    scene.fog = new THREE.FogExp2(0x0a1917, 0.022);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    cameraRef.current = camera;
    camera.position.set(0, 24, 22);
    camera.lookAt(0, 0, 0);

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const isCompactViewport = Math.min(container.clientWidth, container.clientHeight) < 640;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isCompactViewport ? 1.5 : 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    container.appendChild(renderer.domElement);

    // PMREM Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // Post-procesado cinematográfico (Bloom + Corrección de Color + OutputPass) en GPUs hardware
    const postProcessing: BoardPostProcessingController | null = !isSoftwareGl
      ? createBoardPostProcessing(
          renderer,
          scene,
          camera,
          container.clientWidth,
          container.clientHeight
        )
      : null;

    // --- 1B. GLOBAL ILLUMINATION SHADER & PROCEDURAL ATMOSPHERIC SKY DOME ---
    const giUniforms = createGlobalIlluminationUniforms();
    const skyDome = createAtmosphericSkyDome(giUniforms);
    scene.add(skyDome.mesh);

    // --- 2. LIGHTING RIG ---
    // Warm key light (resolución adaptativa de sombras en pantallas compactas)
    const shadowMapSize = isCompactViewport ? 1024 : 2048;
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(14, 22, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = shadowMapSize;
    keyLight.shadow.mapSize.height = shadowMapSize;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 45;
    const d = 16;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0003;
    scene.add(keyLight);

    // Cool fill & ground bounce
    const hemiLight = new THREE.HemisphereLight(0x40e0d0, 0x111e1c, 1.2);
    scene.add(hemiLight);

    // Subtle rim light
    const rimLight = new THREE.DirectionalLight(0xa7f3d0, 0.8);
    rimLight.position.set(-15, 12, -15);
    scene.add(rimLight);

    // --- 3. PROCEDURAL TABLE & BOARD BASE ---
    const tableSatUniform = { value: 1.0 };
    const feltSatUniform = { value: 1.0 };

    // Luxury oak/felt board table surface
    const tableGeo = new THREE.BoxGeometry(27, 1.0, 27);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x092b25,
      roughness: 0.6,
      metalness: 0.1
    });
    applyGlobalIlluminationShader(tableMat, giUniforms, {
      giWeight: 0.72,
      wetnessWeight: 0.45,
      saturationUniform: tableSatUniform
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.55;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // Board inner felt area
    const feltGeo = new THREE.BoxGeometry(24.5, 0.15, 24.5);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x0f4a3e,
      roughness: 0.85,
      metalness: 0.05
    });
    applyGlobalIlluminationShader(feltMat, giUniforms, {
      giWeight: 1.0,
      wetnessWeight: 0.9,
      saturationUniform: feltSatUniform
    });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = 0.05;
    feltMesh.receiveShadow = true;
    scene.add(feltMesh);

    // --- 4. BOARD TILES CREATION ---
    const tilePaletteConfig: Record<
      string,
      { color: number; roughness: number; metalness?: number }
    > = {
      HEALTH: { color: 0x9333ea, roughness: 0.4 },        // Morado Salud
      URBAN: { color: 0xea580c, roughness: 0.4 },         // Naranja Urbano
      KNOWLEDGE: { color: 0xeab308, roughness: 0.4 },     // Amarillo Conocimiento
      ENVIRONMENT: { color: 0x16a34a, roughness: 0.4 },   // Verde Medioambiental
      INALIENABLE: { color: 0xec4899, roughness: 0.35 },  // Rosa Inalienable
      SPECIAL: { color: 0x334155, roughness: 0.5 },      // Gris Pizarra Especial
      CASINO: { color: 0x881337, roughness: 0.35, metalness: 0.25 }, // Casino Especulativo
      SITUATION: { color: 0x0284c7, roughness: 0.4 },    // Azul Situación
      CORNER: { color: 0x1e293b, roughness: 0.5 },       // Esquinas
      AGORA_ENTRY: { color: 0x0d9488, roughness: 0.4 },  // Columnas hacia el Ágora
      AGORA_CENTER: { color: 0xd946ef, roughness: 0.25, metalness: 0.2 }
    };

    const tileMaterialList: THREE.MeshStandardMaterial[] = [];
    const tileMatKeyEntries: Array<{ mat: THREE.MeshStandardMaterial; matKey: string }> = [];
    let lastAppliedColorVisionMode: ColorVisionMode =
      propsRef.current.accessibilitySettings?.colorVisionMode ?? 'STANDARD';
    const tileSaturationEntries = new Map<number, TileSaturationEntry>();

    const tileGeo = new THREE.BoxGeometry(1.7, 0.25, 1.7);
    const cornerGeo = new THREE.BoxGeometry(2.3, 0.28, 2.3);
    const chipGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 10);

    // Pre-allocated 3D Speculator Danger-Zone Heatmap overlays (zero per-frame allocations)
    const heatmapTileGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const heatmapCornerGeo = new THREE.PlaneGeometry(2.16, 2.16);
    const heatmapRingGeo = new THREE.RingGeometry(0.66, 0.84, 24);
    const heatmapPadMeshes = new Map<number, THREE.Mesh>();
    const heatmapPadMaterials: THREE.MeshBasicMaterial[] = [];
    const MAX_INTENDED_TARGET_RINGS = 6;
    const intendedTargetRingPool: THREE.Mesh[] = [];
    const intendedTargetRingMaterials: THREE.MeshBasicMaterial[] = [];

    for (let r = 0; r < MAX_INTENDED_TARGET_RINGS; r++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(heatmapRingGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(0, 0.34, 0);
      ringMesh.renderOrder = 3;
      ringMesh.visible = false;
      scene.add(ringMesh);
      intendedTargetRingPool.push(ringMesh);
      intendedTargetRingMaterials.push(ringMat);
    }

    // Pre-allocated 3D Hover & Selected Tile Indicator Rings (zero per-frame allocations)
    const hoverRingGeo = new THREE.RingGeometry(1.24, 1.38, 4);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      side: THREE.DoubleSide
    });
    const hoverRingMesh = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    hoverRingMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    hoverRingMesh.renderOrder = 4;
    hoverRingMesh.visible = false;
    scene.add(hoverRingMesh);

    const selectedRingGeo = new THREE.RingGeometry(1.26, 1.44, 4);
    const selectedRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide
    });
    const selectedRingMesh = new THREE.Mesh(selectedRingGeo, selectedRingMat);
    selectedRingMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    selectedRingMesh.renderOrder = 4;
    selectedRingMesh.visible = false;
    scene.add(selectedRingMesh);

    let hoveredTileId: number | null = null;

    // Pre-allocated 3D Speculator Trajectory Indicators (zero per-frame allocations)
    const MAX_SPECULATOR_TRAJECTORIES = 6;
    const TRAJECTORY_ARC_STEPS = 28;
    const TRAJECTORY_MAX_PATH_STEPS = 48;

    const trajectorySharedConeGeo = new THREE.ConeGeometry(0.24, 0.6, 10);
    const trajectorySharedSphereGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const trajectorySharedRingGeo = new THREE.RingGeometry(0.38, 0.52, 18);

    interface TrajectorySlotResources {
      group: THREE.Group;
      perimeterGeo: THREE.BufferGeometry;
      perimeterMat: THREE.LineBasicMaterial;
      perimeterLine: THREE.Line;
      arcGeo: THREE.BufferGeometry;
      arcMat: THREE.LineBasicMaterial;
      arcLine: THREE.Line;
      arrowCone: THREE.Mesh;
      arrowMat: THREE.MeshStandardMaterial;
      pulseOrb: THREE.Mesh;
      pulseMat: THREE.MeshStandardMaterial;
      startRing: THREE.Mesh;
      startRingMat: THREE.MeshBasicMaterial;
    }

    const trajectorySlots: TrajectorySlotResources[] = [];

    for (let sIdx = 0; sIdx < MAX_SPECULATOR_TRAJECTORIES; sIdx++) {
      const trajGroup = new THREE.Group();
      trajGroup.visible = false;

      // 1. Perimeter Ground Route Line
      const perimeterGeo = new THREE.BufferGeometry();
      const perimPositions = new Float32Array(TRAJECTORY_MAX_PATH_STEPS * 3);
      perimeterGeo.setAttribute('position', new THREE.BufferAttribute(perimPositions, 3));
      perimeterGeo.setDrawRange(0, 0);

      const perimeterMat = new THREE.LineBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      });
      const perimeterLine = new THREE.Line(perimeterGeo, perimeterMat);
      perimeterLine.renderOrder = 4;
      perimeterLine.frustumCulled = false;
      trajGroup.add(perimeterLine);

      // 2. 3D Parabolic Trajectory Arc
      const arcGeo = new THREE.BufferGeometry();
      const arcPositions = new Float32Array(TRAJECTORY_ARC_STEPS * 3);
      arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
      arcGeo.setDrawRange(0, 0);

      const arcMat = new THREE.LineBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcLine.renderOrder = 5;
      arcLine.frustumCulled = false;
      trajGroup.add(arcLine);

      // 3. Arrow Cone at destination
      const arrowMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.3
      });
      const arrowCone = new THREE.Mesh(trajectorySharedConeGeo, arrowMat);
      arrowCone.renderOrder = 5;
      arrowCone.frustumCulled = false;
      trajGroup.add(arrowCone);

      // 4. Traveling Pulse Orb
      const pulseMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.2
      });
      const pulseOrb = new THREE.Mesh(trajectorySharedSphereGeo, pulseMat);
      pulseOrb.renderOrder = 6;
      pulseOrb.frustumCulled = false;
      trajGroup.add(pulseOrb);

      // 5. Start Origin Ring
      const startRingMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const startRing = new THREE.Mesh(trajectorySharedRingGeo, startRingMat);
      startRing.rotation.x = -Math.PI / 2;
      startRing.position.y = 0.345;
      startRing.renderOrder = 3;
      startRing.frustumCulled = false;
      trajGroup.add(startRing);

      scene.add(trajGroup);
      trajectorySlots.push({
        group: trajGroup,
        perimeterGeo,
        perimeterMat,
        perimeterLine,
        arcGeo,
        arcMat,
        arcLine,
        arrowCone,
        arrowMat,
        pulseOrb,
        pulseMat,
        startRing,
        startRingMat
      });
    }

    // Render individual tiles con material individualizado (misma caché GLSL) para desaturación/limpieza
    propsRef.current.tiles.forEach(tile => {
      let matKey = 'SPECIAL';
      if (tile.category === 'INALIENABLE_COMMON') matKey = 'INALIENABLE';
      else if (tile.category === 'SITUATION') matKey = 'SITUATION';
      else if (tile.category === 'CORNER') matKey = 'CORNER';
      else if (tile.category === 'AGORA_ENTRY') matKey = 'AGORA_ENTRY';
      else if (tile.category === 'AGORA_CENTER') matKey = 'AGORA_CENTER';
      else if (tile.specialType === 'CASINO') matKey = 'CASINO';
      else if (tile.goodType && tilePaletteConfig[tile.goodType]) matKey = tile.goodType;

      const cfg = tilePaletteConfig[matKey] ?? tilePaletteConfig.SPECIAL;
      const satUniform = { value: 1.0 };
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: cfg.roughness,
        metalness: cfg.metalness ?? 0.05
      });
      applyGlobalIlluminationShader(mat, giUniforms, {
        giWeight: 0.78,
        wetnessWeight: 0.55,
        saturationUniform: satUniform
      });
      tileMaterialList.push(mat);
      tileMatKeyEntries.push({ mat, matKey });
      tileSaturationEntries.set(tile.id, { uniform: satUniform, baseY: 0.2 });

      const isCorner = tile.category === 'CORNER';
      const geometry = isCorner ? cornerGeo : tileGeo;
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(tile.x, 0.2, tile.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData = { tileId: tile.id };
      scene.add(mesh);
      tileMeshesRef.current.set(tile.id, mesh);

      // Heatmap overlay pad flush above tile top surface (hidden by default)
      if (tile.category !== 'AGORA_CENTER') {
        const padMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          side: THREE.DoubleSide
        });
        const padMesh = new THREE.Mesh(isCorner ? heatmapCornerGeo : heatmapTileGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(tile.x, isCorner ? 0.346 : 0.332, tile.z);
        padMesh.renderOrder = 2;
        padMesh.visible = false;
        scene.add(padMesh);
        heatmapPadMeshes.set(tile.id, padMesh);
        heatmapPadMaterials.push(padMat);
      }

      // Status chip (Cylinder) on resource tiles showing PRIVATE (white), PUBLIC (grey), COMMON (black)
      if (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY') {
        const chipMat = new THREE.MeshStandardMaterial({
          color: tile.state === 'COMMON' ? 0x111111 : tile.state === 'PUBLIC' ? 0x888888 : 0xffffff,
          roughness: 0.3,
          metalness: 0.1
        });
        const chipMesh = new THREE.Mesh(chipGeo, chipMat);
        chipMesh.position.set(tile.x, 0.42, tile.z);
        chipMesh.castShadow = false;
        scene.add(chipMesh);
        chipMeshesRef.current.set(tile.id, chipMesh);
      }
    });

    // --- 5. ÁGORA CENTRAL EMBLEM ---
    // Iconic multi-layered central dais
    const agoraGroup = new THREE.Group();
    const daisGeo = new THREE.CylinderGeometry(3.2, 3.4, 0.4, 6); // Hexágono asambleario
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.3,
      metalness: 0.25
    });
    const daisMesh = new THREE.Mesh(daisGeo, daisMat);
    daisMesh.position.y = 0.25;
    daisMesh.receiveShadow = true;
    daisMesh.castShadow = true;
    agoraGroup.add(daisMesh);

    // Inner diaphragm ring (poligonaje reducido)
    const ringGeo = new THREE.TorusGeometry(2.1, 0.15, 6, 6);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.28,
      roughness: 0.2,
      metalness: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.48;
    agoraGroup.add(ringMesh);

    // Inner core (poligonaje reducido)
    const coreGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 12);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xec4899,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.3
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 0.46;
    agoraGroup.add(coreMesh);
    scene.add(agoraGroup);
    agoraGroupRef.current = agoraGroup;

    // --- 6. 3D DICE MODEL ---
    const diceGroup = new THREE.Group();
    const diceGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const diceMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.1
    });
    const diceMesh = new THREE.Mesh(diceGeo, diceMat);
    diceMesh.castShadow = true;
    diceGroup.add(diceMesh);

    // Add pips (geometría octaedro low-poly etiquetada como detalle secundario)
    const pipGeo = new THREE.OctahedronGeometry(0.055, 0);
    const pipMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    // Face 1 (Y+)
    const p1 = new THREE.Mesh(pipGeo, pipMat);
    p1.position.set(0, 0.43, 0);
    markAsSecondaryDetail(p1);
    diceGroup.add(p1);

    // Face 6 (Y-)
    [[-0.2, -0.2], [-0.2, 0], [-0.2, 0.2], [0.2, -0.2], [0.2, 0], [0.2, 0.2]].forEach(([px, pz]) => {
      const p = new THREE.Mesh(pipGeo, pipMat);
      p.position.set(px, -0.43, pz);
      markAsSecondaryDetail(p);
      diceGroup.add(p);
    });

    diceGroup.position.set(4.5, 0.9, 4.5);
    scene.add(diceGroup);
    diceGroupRef.current = diceGroup;

    // --- 7. PROCEDURAL CHARACTER PAWNS (Shared Board-Optimized Character Models) ---
    propsRef.current.players.forEach((player) => {
      const pawnGroup = createCharacterPawnMesh(player.id, player.color, player.accentColor, false, {
        detail: 'board'
      });
      const coords = getTileCoords(player.position);
      pawnGroup.position.set(coords.x, 0.35, coords.z);
      scene.add(pawnGroup);
      playerMeshesRef.current.set(player.id, pawnGroup);
    });

    // --- 8. PROCEDURAL SPECULATOR PAWNS (Composite Top-Hat Models, Board-Optimized) ---
    propsRef.current.speculators.forEach((speculator) => {
      const specGroup = createCharacterPawnMesh('speculator', speculator.color, '#0f172a', true, {
        detail: 'board'
      });
      const coords = getTileCoords(speculator.position);
      specGroup.position.set(coords.x + 0.3, 0.35, coords.z + 0.3);
      scene.add(specGroup);
      speculatorMeshesRef.current.set(speculator.id, specGroup);
    });

    // --- 9. PROCEDURAL GAME-OVER PARTICLE SYSTEM ---
    const PARTICLE_COUNT = 220;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleColors = new Float32Array(PARTICLE_COUNT * 3);
    const particleSpeeds = new Float32Array(PARTICLE_COUNT);
    const particlePhases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 11.5;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = 0.4 + Math.random() * 7.5;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      particleSpeeds[i] = 0.8 + Math.random() * 1.9;
      particlePhases[i] = Math.random() * Math.PI * 2;

      particleColors[i * 3] = 0.2;
      particleColors[i * 3 + 1] = 0.9;
      particleColors[i * 3 + 2] = 0.75;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Procedural radial glow texture (zero external assets)
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const sCtx = spriteCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
    }
    const particleTexture = new THREE.CanvasTexture(spriteCanvas);
    particleTexture.colorSpace = THREE.SRGBColorSpace;

    const particleMat = new THREE.PointsMaterial({
      size: 0.55,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    setExplicitBoundingSphere(particleGeo, 0, 4.5, 0, 17.5);
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    particlePoints.visible = false;
    particlePoints.frustumCulled = true;
    scene.add(particlePoints);

    // --- 9B. PROCEDURAL GRADUAL CROSS-FADING WEATHER SYSTEMS (Rain, Snow, Sunny) ---
    // 1) Sistema de Lluvia: estelas lineales inclinadas + salpicaduras en el tablero
    const RAIN_COUNT = 420;
    const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 vértices por gota
    const rainColors = new Float32Array(RAIN_COUNT * 6);
    const rainRoots = new Float32Array(RAIN_COUNT * 3);
    const rainSpeeds = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 26;
      const ry = 0.5 + Math.random() * 14;
      const rz = (Math.random() - 0.5) * 26;
      const spd = 9.5 + Math.random() * 6.5;
      rainRoots[i * 3] = rx;
      rainRoots[i * 3 + 1] = ry;
      rainRoots[i * 3 + 2] = rz;
      rainSpeeds[i] = spd;

      const len = 0.45 + (spd - 9.5) * 0.04;
      const vIdx = i * 6;
      rainPositions[vIdx] = rx;
      rainPositions[vIdx + 1] = ry;
      rainPositions[vIdx + 2] = rz;
      rainPositions[vIdx + 3] = rx - 0.14;
      rainPositions[vIdx + 4] = ry + len;
      rainPositions[vIdx + 5] = rz - 0.05;

      // Cabeza cian luminosa -> cola translúcida azul hielo
      rainColors[vIdx] = 0.45;
      rainColors[vIdx + 1] = 0.88;
      rainColors[vIdx + 2] = 1.0;
      rainColors[vIdx + 3] = 0.14;
      rainColors[vIdx + 4] = 0.48;
      rainColors[vIdx + 5] = 0.78;
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainGeo.setAttribute('color', new THREE.BufferAttribute(rainColors, 3));
    const rainMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    setExplicitBoundingSphere(rainGeo, 0, 7.5, 0, 21.5);
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;
    rainLines.frustumCulled = true;
    scene.add(rainLines);

    // Salpicaduras sutiles de lluvia sobre el tablero
    const SPLASH_COUNT = 80;
    const splashPositions = new Float32Array(SPLASH_COUNT * 3);
    const splashTimers = new Float32Array(SPLASH_COUNT);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      splashPositions[i * 3] = (Math.random() - 0.5) * 23;
      splashPositions[i * 3 + 1] = 0.24;
      splashPositions[i * 3 + 2] = (Math.random() - 0.5) * 23;
      splashTimers[i] = Math.random();
    }
    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    setExplicitBoundingSphere(splashGeo, 0, 0.4, 0, 17.5);
    const splashMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.28,
      map: particleTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const rainSplashPoints = new THREE.Points(splashGeo, splashMat);
    rainSplashPoints.visible = false;
    rainSplashPoints.frustumCulled = true;
    scene.add(rainSplashPoints);

    // 2) Sistema de Nieve: textura procedural cristalina hexagonal (cero 404s)
    const snowCanvas = document.createElement('canvas');
    snowCanvas.width = 64;
    snowCanvas.height = 64;
    const snCtx = snowCanvas.getContext('2d');
    if (snCtx) {
      const grad = snCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.28, 'rgba(235,248,255,0.88)');
      grad.addColorStop(0.65, 'rgba(186,230,253,0.28)');
      grad.addColorStop(1, 'rgba(186,230,253,0)');
      snCtx.fillStyle = grad;
      snCtx.fillRect(0, 0, 64, 64);

      snCtx.strokeStyle = 'rgba(255,255,255,0.92)';
      snCtx.lineWidth = 2.2;
      snCtx.lineCap = 'round';
      for (let b = 0; b < 6; b++) {
        const ang = (b * Math.PI) / 3;
        snCtx.beginPath();
        snCtx.moveTo(32, 32);
        snCtx.lineTo(32 + Math.cos(ang) * 23, 32 + Math.sin(ang) * 23);
        snCtx.stroke();
      }
    }
    const snowTexture = new THREE.CanvasTexture(snowCanvas);
    snowTexture.colorSpace = THREE.SRGBColorSpace;

    const SNOW_COUNT = 360;
    const snowPositions = new Float32Array(SNOW_COUNT * 3);
    const snowColors = new Float32Array(SNOW_COUNT * 3);
    const snowSpeeds = new Float32Array(SNOW_COUNT);
    const snowPhases = new Float32Array(SNOW_COUNT);

    for (let i = 0; i < SNOW_COUNT; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 26;
      snowPositions[i * 3 + 1] = 0.3 + Math.random() * 14;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 26;
      snowSpeeds[i] = 0.8 + Math.random() * 1.1;
      snowPhases[i] = Math.random() * Math.PI * 2;

      const snowTint = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xe0f2fe : 0xdbeafe;
      _tempColor.setHex(snowTint);
      snowColors[i * 3] = _tempColor.r;
      snowColors[i * 3 + 1] = _tempColor.g;
      snowColors[i * 3 + 2] = _tempColor.b;
    }

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    snowGeo.setAttribute('color', new THREE.BufferAttribute(snowColors, 3));
    const snowMat = new THREE.PointsMaterial({
      size: 0.52,
      map: snowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    setExplicitBoundingSphere(snowGeo, 0, 7.5, 0, 21.5);
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    snowPoints.visible = false;
    snowPoints.frustumCulled = true;
    scene.add(snowPoints);

    // 3) Sistema Soleado: motas doradas cálidas y polen flotante
    const weatherSpriteCanvas = document.createElement('canvas');
    weatherSpriteCanvas.width = 32;
    weatherSpriteCanvas.height = 32;
    const wCtx = weatherSpriteCanvas.getContext('2d');
    if (wCtx) {
      const grad = wCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,250,210,0.8)');
      grad.addColorStop(0.7, 'rgba(253,224,71,0.28)');
      grad.addColorStop(1, 'rgba(253,224,71,0)');
      wCtx.fillStyle = grad;
      wCtx.fillRect(0, 0, 32, 32);
    }
    const weatherTexture = new THREE.CanvasTexture(weatherSpriteCanvas);
    weatherTexture.colorSpace = THREE.SRGBColorSpace;

    const SUN_COUNT = 200;
    const sunPositions = new Float32Array(SUN_COUNT * 3);
    const sunColors = new Float32Array(SUN_COUNT * 3);
    const sunPhases = new Float32Array(SUN_COUNT);
    const sunSpeeds = new Float32Array(SUN_COUNT);
    const sunPalette = [0xfde047, 0xfacc15, 0xfef08a, 0xffedd5, 0xa7f3d0];

    for (let i = 0; i < SUN_COUNT; i++) {
      sunPositions[i * 3] = (Math.random() - 0.5) * 25;
      sunPositions[i * 3 + 1] = 0.4 + Math.random() * 11.5;
      sunPositions[i * 3 + 2] = (Math.random() - 0.5) * 25;
      sunPhases[i] = Math.random() * Math.PI * 2;
      sunSpeeds[i] = 0.35 + Math.random() * 0.55;

      _tempColor.setHex(sunPalette[i % sunPalette.length]);
      sunColors[i * 3] = _tempColor.r;
      sunColors[i * 3 + 1] = _tempColor.g;
      sunColors[i * 3 + 2] = _tempColor.b;
    }

    const sunGeo = new THREE.BufferGeometry();
    sunGeo.setAttribute('position', new THREE.BufferAttribute(sunPositions, 3));
    sunGeo.setAttribute('color', new THREE.BufferAttribute(sunColors, 3));
    const sunMat = new THREE.PointsMaterial({
      size: 0.44,
      map: weatherTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    setExplicitBoundingSphere(sunGeo, 0, 6.5, 0, 20.5);
    const sunPoints = new THREE.Points(sunGeo, sunMat);
    sunPoints.visible = false;
    sunPoints.frustumCulled = true;
    scene.add(sunPoints);

    // Pesos continuos para cross-fade gradual entre condiciones climáticas
    let rainWeight = 0;
    let snowWeight = 0;
    let sunWeight = 0;
    let smoothWeatherIntensity = 0.85;

    // --- 9B-2. SISTEMA DE PARTÍCULAS DE TRAGEDIA DE LOS COMUNES (Hojas secas 3D + Ceniza desaturada) ---
    const tragedyParticles = createTragedyParticleSystem(
      scene,
      renderer.capabilities.getMaxAnisotropy()
    );
    const boardCleansing = createBoardCleansingSystem(scene);
    const reducedMotionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    // --- 9C. PROCEDURAL COMMONS CELEBRATION PARTICLE SYSTEM (Bienes Comunes) ---
    const COMMONS_PARTICLE_COUNT = 160;
    const commonsPositions = new Float32Array(COMMONS_PARTICLE_COUNT * 3);
    const commonsColors = new Float32Array(COMMONS_PARTICLE_COUNT * 3);
    const commonsVelocities = new Float32Array(COMMONS_PARTICLE_COUNT * 3);
    const commonsLife = new Float32Array(COMMONS_PARTICLE_COUNT);
    const commonsMaxLife = new Float32Array(COMMONS_PARTICLE_COUNT);

    // Inicializar partículas inactivas bajo el tablero
    for (let i = 0; i < COMMONS_PARTICLE_COUNT; i++) {
      commonsPositions[i * 3] = 0;
      commonsPositions[i * 3 + 1] = -20;
      commonsPositions[i * 3 + 2] = 0;
      commonsLife[i] = 0;
      commonsMaxLife[i] = 1;
    }

    const commonsGeo = new THREE.BufferGeometry();
    commonsGeo.setAttribute('position', new THREE.BufferAttribute(commonsPositions, 3));
    commonsGeo.setAttribute('color', new THREE.BufferAttribute(commonsColors, 3));

    // Textura procedural de destello estrellado (Canvas 64x64, cero dependencias externas)
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 64;
    starCanvas.height = 64;
    const starCtx = starCanvas.getContext('2d');
    if (starCtx) {
      // 1. Halo radial difuso
      const grad = starCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      starCtx.fillStyle = grad;
      starCtx.fillRect(0, 0, 64, 64);

      // 2. Rayos estrellados afilados de 4 puntas
      starCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      // Rayo vertical
      starCtx.beginPath();
      starCtx.moveTo(32, 3);
      starCtx.lineTo(34.5, 32);
      starCtx.lineTo(32, 61);
      starCtx.lineTo(29.5, 32);
      starCtx.closePath();
      starCtx.fill();

      // Rayo horizontal
      starCtx.beginPath();
      starCtx.moveTo(3, 32);
      starCtx.lineTo(32, 34.5);
      starCtx.lineTo(61, 32);
      starCtx.lineTo(32, 29.5);
      starCtx.closePath();
      starCtx.fill();

      // Núcleo central brillante
      starCtx.beginPath();
      starCtx.arc(32, 32, 4.5, 0, Math.PI * 2);
      starCtx.fillStyle = '#ffffff';
      starCtx.fill();
    }
    const commonsTexture = new THREE.CanvasTexture(starCanvas);
    commonsTexture.colorSpace = THREE.SRGBColorSpace;

    const commonsMat = new THREE.PointsMaterial({
      size: 0.72,
      map: commonsTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    setExplicitBoundingSphere(commonsGeo, 0, 3.0, 0, 8.0);
    const commonsPoints = new THREE.Points(commonsGeo, commonsMat);
    commonsPoints.visible = false;
    commonsPoints.frustumCulled = true;
    scene.add(commonsPoints);

    // Onda expansiva / aura luminosa en la superficie de la casilla (poligonaje reducido)
    const auraGeo = new THREE.RingGeometry(0.2, 0.44, 14);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.set(0, 0.34, 0);
    auraMesh.visible = false;
    scene.add(auraMesh);

    // Aro baliza reutilizable para resaltar elementos del tablero 3D durante el tutorial interactivo
    const tutorialRingGeo = new THREE.RingGeometry(1.12, 1.44, 24);
    const tutorialRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const tutorialRingMesh = new THREE.Mesh(tutorialRingGeo, tutorialRingMat);
    tutorialRingMesh.rotation.x = -Math.PI / 2;
    tutorialRingMesh.position.set(0, 0.38, 0);
    tutorialRingMesh.visible = false;
    scene.add(tutorialRingMesh);

    let auraLife = 0;
    const auraDuration = 0.85;
    let commonsBurstCenterX = 0;
    let commonsBurstCenterZ = 0;

    // Disparador del estallido celebratorio de Bienes Comunes
    const triggerCommonsBurst = (targetX: number, targetZ: number, goodType?: string) => {
      // Paletas temáticas armonizadas según tipo de bien
      const palette =
        goodType === 'HEALTH'
          ? [0xa855f7, 0xc084fc, 0x34d399, 0xfacc15, 0xe9d5ff]
          : goodType === 'URBAN'
          ? [0xf97316, 0xfb923c, 0xfacc15, 0x34d399, 0xfed7aa]
          : goodType === 'KNOWLEDGE'
          ? [0xfacc15, 0xfde047, 0x38bdf8, 0x34d399, 0xfef08a]
          : goodType === 'ENVIRONMENT'
          ? [0x10b981, 0x34d399, 0xa7f3d0, 0x6ee7b7, 0xfacc15]
          : [0xec4899, 0xf472b6, 0x34d399, 0xfacc15, 0x38bdf8];

      // Configurar onda expansiva luminosa y actualizar bounding sphere local del estallido
      commonsBurstCenterX = targetX;
      commonsBurstCenterZ = targetZ;
      setExplicitBoundingSphere(commonsGeo, targetX, 3.0, targetZ, 8.0);
      auraMesh.position.set(targetX, 0.34, targetZ);
      auraMesh.scale.set(1, 1, 1);
      auraMat.color.setHex(palette[0] || 0x10b981);
      auraMat.opacity = 0.85;
      auraLife = auraDuration;
      auraMesh.visible = true;

      // Distribuir fuente ascendente de partículas
      const posAttr = commonsGeo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = commonsGeo.getAttribute('color') as THREE.BufferAttribute;

      for (let i = 0; i < COMMONS_PARTICLE_COUNT; i++) {
        const pIdx = i * 3;
        // Ligero desplazamiento radial en la base de la casilla
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.45;
        posAttr.setXYZ(i, targetX + Math.cos(ang) * rad, 0.35, targetZ + Math.sin(ang) * rad);

        // Vector de expulsión vertical cónica con dispersión radial
        const speed = 1.2 + Math.random() * 2.8;
        const upVelocity = 3.6 + Math.random() * 4.6;
        commonsVelocities[pIdx] = Math.cos(ang) * speed;
        commonsVelocities[pIdx + 1] = upVelocity;
        commonsVelocities[pIdx + 2] = Math.sin(ang) * speed;

        const dur = 1.0 + Math.random() * 0.9;
        commonsLife[i] = dur;
        commonsMaxLife[i] = dur;

        // Color con destellos ocasionales en blanco diamante
        const isGlint = Math.random() < 0.25;
        _tempColor.setHex(isGlint ? 0xffffff : palette[i % palette.length]);
        colAttr.setXYZ(i, _tempColor.r, _tempColor.g, _tempColor.b);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      commonsMat.opacity = 0.95;
      commonsPoints.visible = true;

      // Sonido espacial inmersivo originado en la casilla
      playSound.unlockCommon({ x: targetX, y: 0.4, z: targetZ });
    };

    // --- 10. ANIMATION & RENDER LOOP ---
    let animationFrameId = 0;
    const clock = new THREE.Clock();
    let lastColoredResult: string | undefined;
    const cinematicCamera = new CinematicCameraController();
    const pawnWaypointQueues = new Map<string, number[]>();
    let prevCameraMode = propsRef.current.cameraMode;
    let perfWindowStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let perfPrevFrameTime = perfWindowStart;
    let perfFramesInWindow = 0;
    let perfMaxFrameMs = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          animationFrameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          animationFrameId = window.setTimeout(cb, 80);
        }
      };
      animationFrameId = window.setTimeout(poll, 5);
    };

    const render = () => {
      const frameNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const frameDeltaMs = Math.max(0.1, frameNow - perfPrevFrameTime);
      perfPrevFrameTime = frameNow;
      perfFramesInWindow += 1;
      if (frameDeltaMs < 500 && frameDeltaMs > perfMaxFrameMs) {
        perfMaxFrameMs = frameDeltaMs;
      }

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const {
        cameraMode: mode,
        players: currPlayers,
        activePlayerIndex: currIdx,
        phase: currPhase,
        gameResult: currResult
      } = propsRef.current;
      const activePlayer = currPlayers[currIdx];

      // Detectar entrada en GAME_OVER para reiniciar reloj del fly-through cinematográfico
      if (currPhase === 'GAME_OVER' && prevPhaseRef.current !== 'GAME_OVER') {
        gameOverElapsedRef.current = 0;
        lastColoredResult = undefined;
        cinematicCamera.cancel();
        pawnWaypointQueues.clear();
      }
      prevPhaseRef.current = currPhase;

      // Cancelar cámara cinematográfica si el jugador cambia manualmente el modo de cámara
      if (prevCameraMode !== mode) {
        prevCameraMode = mode;
        cinematicCamera.cancel();
      }

      // Detectar desplazamientos, aterrizajes en Bienes Comunes y cámara cinematográfica para bots
      if (prevPlayerPositionsRef.current.size === 0) {
        currPlayers.forEach(p => prevPlayerPositionsRef.current.set(p.id, p.position));
      } else {
        currPlayers.forEach(p => {
          const oldPos = prevPlayerPositionsRef.current.get(p.id);
          if (oldPos !== undefined && oldPos !== p.position) {
            prevPlayerPositionsRef.current.set(p.id, p.position);
            const nodePath = resolveBoardNodePath(oldPos, p.position);

            if (nodePath.length > 2) {
              pawnWaypointQueues.set(p.id, nodePath.slice(1));
            } else {
              pawnWaypointQueues.delete(p.id);
            }

            if (p.controller === 'BOT' && currPhase !== 'GAME_OVER') {
              const nodes = mapTilePathToCoords(nodePath, propsRef.current.tiles);
              if (mode === 'TOP_DOWN') {
                _returnCamPos.set(0, 32, 0.01);
                _returnLookAt.set(0, 0, 0);
              } else if (mode === 'FOLLOW') {
                const destCoords = getTileCoords(p.position);
                _returnCamPos.set(destCoords.x * 0.7, 14, destCoords.z * 0.7 + 10);
                _returnLookAt.set(destCoords.x, 0.5, destCoords.z);
              } else {
                _returnCamPos.set(0, 22, 21);
                _returnLookAt.set(0, 0, 0);
              }
              cinematicCamera.followBotNodes(
                nodes,
                camera.position,
                _currentLookAt,
                _returnCamPos,
                _returnLookAt
              );
            }

            const landedTile = propsRef.current.tiles.find(t => t.id === p.position);
            if (
              landedTile &&
              (landedTile.state === 'COMMON' || landedTile.category === 'INALIENABLE_COMMON')
            ) {
              triggerCommonsBurst(landedTile.x, landedTile.z, landedTile.goodType);
            }
          }
        });
      }

      // Detectar transición de casillas a estado 'COMMON' (comunalización)
      if (prevTileStatesRef.current.size === 0) {
        propsRef.current.tiles.forEach(t => prevTileStatesRef.current.set(t.id, t.state));
      } else {
        propsRef.current.tiles.forEach(t => {
          const oldState = prevTileStatesRef.current.get(t.id);
          if (oldState !== undefined && oldState !== t.state) {
            prevTileStatesRef.current.set(t.id, t.state);
            if (t.state === 'COMMON') {
              triggerCommonsBurst(t.x, t.z, t.goodType);
            }
          }
        });
      }

      if (currPhase === 'GAME_OVER') {
        gameOverElapsedRef.current += delta;
        const flyT = gameOverElapsedRef.current;

        // Vuelo cinematográfico multi-etapa sobre el estado final del tablero
        if (flyT < 3.6) {
          // Etapa 1: Barrido rasante panorámico bordeando el perímetro de casillas
          const p = flyT / 3.6;
          const angle = -0.85 + p * 1.45;
          const radius = THREE.MathUtils.lerp(22, 15.5, p);
          const height = THREE.MathUtils.lerp(15.5, 6.8, p);
          _targetCamPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
          _targetLookAt.set(Math.sin(angle + 0.5) * 3.5, 0.6, Math.cos(angle + 0.5) * 3.5);
        } else if (flyT < 7.8) {
          // Etapa 2: Órbita ascendente en espiral enfocando el Ágora Central y las columnas radiales
          const p = (flyT - 3.6) / 4.2;
          const angle = 0.6 + p * Math.PI * 0.9;
          const radius = THREE.MathUtils.lerp(15.5, 11.2, p);
          const height = THREE.MathUtils.lerp(6.8, 10.5, p);
          _targetCamPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
          _targetLookAt.set(0, 0.8, 0);
        } else {
          // Etapa 3: Órbita majestuosa continua sobre todo el tablero final
          const orbitAngle = 0.6 + Math.PI * 0.9 + (flyT - 7.8) * 0.24;
          const radius = 17.5 + Math.sin((flyT - 7.8) * 0.35) * 1.8;
          const height = 13.5 + Math.cos((flyT - 7.8) * 0.3) * 1.5;
          _targetCamPos.set(Math.sin(orbitAngle) * radius, height, Math.cos(orbitAngle) * radius);
          _targetLookAt.set(0, 0.4, 0);
        }

        // Activar y actualizar paleta de partículas 3D según desenlace
        particlePoints.visible = true;
        particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.92, 4, delta);

        if (lastColoredResult !== currResult) {
          lastColoredResult = currResult;
          const palette =
            currResult === 'VICTORY'
              ? [0x34d399, 0x2dd4bf, 0xfacc15, 0xf472b6]
              : currResult === 'DRAW'
              ? [0x38bdf8, 0x818cf8, 0x2dd4bf, 0xe2e8f0]
              : [0xf43f5e, 0xf97316, 0xfbbf24, 0x94a3b8];

          const colAttr = particleGeo.getAttribute('color') as THREE.BufferAttribute;
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            _tempColor.setHex(palette[i % palette.length]);
            colAttr.setXYZ(i, _tempColor.r, _tempColor.g, _tempColor.b);
          }
          colAttr.needsUpdate = true;
        }

        const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          let x = posAttr.getX(i);
          let y = posAttr.getY(i);
          let z = posAttr.getZ(i);
          const spd = particleSpeeds[i];
          const ph = particlePhases[i];

          if (currResult === 'DEFEAT') {
            y -= spd * 0.55 * delta;
            x += Math.sin(elapsed * 1.2 + ph) * 0.45 * delta;
            z += Math.cos(elapsed * 1.1 + ph) * 0.45 * delta;
            if (y < 0.3) y = 8.5;
          } else {
            y += spd * (currResult === 'VICTORY' ? 1.15 : 0.7) * delta;
            const swirl = delta * (currResult === 'VICTORY' ? 0.32 : 0.16);
            const rx = x * Math.cos(swirl) - z * Math.sin(swirl);
            const rz = x * Math.sin(swirl) + z * Math.cos(swirl);
            x = rx + Math.sin(elapsed * 1.8 + ph) * 0.25 * delta;
            z = rz + Math.cos(elapsed * 1.6 + ph) * 0.25 * delta;
            if (y > 9.0) y = 0.4;
          }

          posAttr.setXYZ(i, x, y, z);
        }
        posAttr.needsUpdate = true;

        // Rotación ceremonial del Ágora Central
        if (agoraGroupRef.current) {
          agoraGroupRef.current.rotation.y += delta * (currResult === 'VICTORY' ? 0.55 : 0.2);
        }
      } else {
        particlePoints.visible = false;
        particleMat.opacity = 0;

        if (agoraGroupRef.current) {
          agoraGroupRef.current.rotation.y = THREE.MathUtils.damp(agoraGroupRef.current.rotation.y, 0, 4, delta);
        }

        if (mode === 'TOP_DOWN') {
          _targetCamPos.set(0, 32, 0.01);
          _targetLookAt.set(0, 0, 0);
        } else if (mode === 'FOLLOW' && activePlayer) {
          const coords = getTileCoords(activePlayer.position);
          _targetCamPos.set(coords.x * 0.7, 14, coords.z * 0.7 + 10);
          _targetLookAt.set(coords.x, 0.5, coords.z);
        } else {
          // 'ISOMETRIC' (Default warm table overview)
          _targetCamPos.set(0, 22, 21);
          _targetLookAt.set(0, 0, 0);
        }
      }

      // --- TRANSICIÓN DE DESATURACIÓN & LIMPIEZA PROGRESIVA AL FINAL DE LA PARTIDA ---
      const isTragedyOfCommonsActive =
        currPhase !== 'GAME_OVER' && propsRef.current.activeModal === 'TRAGEDY_VOTE';
      const effectiveEfficiency =
        propsRef.current.cooperativeEfficiency ??
        computeCooperativeEfficiency(
          propsRef.current.tiles,
          undefined,
          propsRef.current.round ?? 1,
          currResult
        ).efficiency;

      const cleanseState = boardCleansing.update({
        phase: currPhase,
        flyT: currPhase === 'GAME_OVER' ? gameOverElapsedRef.current : 0,
        delta,
        elapsed,
        efficiency: effectiveEfficiency,
        tiles: propsRef.current.tiles,
        tileEntries: tileSaturationEntries,
        tileMeshes: tileMeshesRef.current,
        feltSatUniform,
        tableSatUniform,
        giUniforms,
        isTragedyActive: isTragedyOfCommonsActive,
        reducedMotion: reducedMotionQuery?.matches ?? false
      });

      // Smooth frame-rate independent camera damping or GSAP bot cinematic pathing (zero per-frame allocations)
      if (currPhase !== 'GAME_OVER' && cinematicCamera.isActive()) {
        cinematicCamera.applyToCamera(camera, _currentLookAt);
      } else {
        const camAlpha = 1 - Math.exp((currPhase === 'GAME_OVER' ? -3.4 : -6) * delta);
        camera.position.lerp(_targetCamPos, camAlpha);
        _currentLookAt.lerp(_targetLookAt, camAlpha);
        camera.lookAt(_currentLookAt);
      }

      // Sincronizar matriz de cámara y frustum de recorte (cero asignaciones)
      updateCameraFrustum(camera);
      const isBoardVolumeInFrustum = isWorldSphereInFrustum(0, 7.0, 0, 21.5);

      // Sincronizar oyente del sistema de audio espacial 3D con la cámara
      audioManager.updateListener(camera.position, _currentLookAt, camera.up);

      let totalCullableObjects = 0;
      let culledObjects = 0;

      const earlyA11ySettings = propsRef.current.accessibilitySettings ?? DEFAULT_ACCESSIBILITY_SETTINGS;
      const isReducedMotion = Boolean(
        reducedMotionQuery?.matches || earlyA11ySettings.reducedMotionOverride
      );

      // Update Player Pawn Positions with smooth node-by-node stepping, frustum culling & distance LOD
      currPlayers.forEach((player, idx) => {
        const mesh = playerMeshesRef.current.get(player.id);
        if (mesh) {
          const waypointQueue = pawnWaypointQueues.get(player.id);
          const hasQueuedWaypoints = currPhase !== 'GAME_OVER' && waypointQueue && waypointQueue.length > 0;
          const activeTargetTileId = hasQueuedWaypoints ? waypointQueue[0] : player.position;
          const coords = getTileCoords(activeTargetTileId);
          const offsetAngle = (idx * (Math.PI * 2)) / 4;
          const offsetX = coords.x === 0 && coords.z === 0 ? Math.cos(offsetAngle) * 0.9 : (idx % 2 === 0 ? -0.25 : 0.25);
          const offsetZ = coords.x === 0 && coords.z === 0 ? Math.sin(offsetAngle) * 0.9 : (idx > 1 ? -0.25 : 0.25);

          const targetX = coords.x + offsetX;
          const targetZ = coords.z + offsetZ;
          const travelDist = Math.hypot(targetX - mesh.position.x, targetZ - mesh.position.z);

          if (hasQueuedWaypoints && travelDist < 0.55) {
            waypointQueue.shift();
            if (waypointQueue.length === 0) {
              pawnWaypointQueues.delete(player.id);
            }
          }

          const hopY =
            !isReducedMotion && currPhase !== 'GAME_OVER' && travelDist > 0.08
              ? Math.min(0.62, travelDist * 0.16) * Math.abs(Math.sin(travelDist * 1.4))
              : 0;
          const targetY =
            currPhase === 'GAME_OVER' && currResult === 'VICTORY'
              ? (player.inAgora ? 0.65 : 0.35) + (isReducedMotion ? 0 : Math.abs(Math.sin(elapsed * 3.5 + idx)) * 0.35)
              : (player.inAgora ? 0.65 : 0.35) + hopY;

          const pawnDamp = hasQueuedWaypoints ? 14 : 10;
          mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetX, pawnDamp, delta);
          mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetZ, pawnDamp, delta);
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, targetY, pawnDamp, delta);

          const isPawnVisible = applyGroupFrustumAndDetailLOD(
            mesh,
            camera.position,
            2.2,
            0.65,
            760
          );
          totalCullableObjects += 1;
          if (!isPawnVisible) culledObjects += 1;

          if (isPawnVisible) {
            if (currPhase === 'GAME_OVER') {
              mesh.rotation.y += isReducedMotion ? 0 : delta * (currResult === 'VICTORY' ? 1.5 : 0.35);
              mesh.scale.setScalar(isReducedMotion ? 1.0 : 1.0 + Math.sin(elapsed * 3 + idx) * 0.06);
            } else if (idx === currIdx) {
              mesh.scale.setScalar(isReducedMotion ? 1.06 : 1.0 + Math.sin(elapsed * 4) * 0.05);
            } else {
              mesh.scale.setScalar(1.0);
            }
          }
        }
      });

      // Update Speculators Positions with subtle patrol hop, frustum culling & distance LOD
      propsRef.current.speculators.forEach((spec, sIdx) => {
        const mesh = speculatorMeshesRef.current.get(spec.id);
        if (mesh) {
          const coords = getTileCoords(spec.position);
          const targetX = coords.x + (sIdx === 0 ? 0.3 : -0.3);
          const targetZ = coords.z + (sIdx === 0 ? 0.3 : -0.3);
          const specDist = Math.hypot(targetX - mesh.position.x, targetZ - mesh.position.z);
          const specHopY =
            specDist > 0.08
              ? Math.min(0.5, specDist * 0.14) * Math.abs(Math.sin(specDist * 1.4))
              : 0;

          mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetX, 8, delta);
          mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetZ, 8, delta);
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, 0.35 + specHopY, 10, delta);

          const isSpecVisible = applyGroupFrustumAndDetailLOD(mesh, camera.position, 2.2, 0.65, 760);
          totalCullableObjects += 1;
          if (!isSpecVisible) culledObjects += 1;
        }
      });

      // Frustum culling de casillas y fichas + actualización selectiva de emisivos + Mapa de Calor 3D + Accesibilidad
      const a11ySettings = propsRef.current.accessibilitySettings ?? DEFAULT_ACCESSIBILITY_SETTINGS;
      const a11yPalette = getAccessibilityPalette(a11ySettings.colorVisionMode);
      if (lastAppliedColorVisionMode !== a11ySettings.colorVisionMode) {
        lastAppliedColorVisionMode = a11ySettings.colorVisionMode;
        for (let i = 0; i < tileMatKeyEntries.length; i++) {
          const entry = tileMatKeyEntries[i];
          const nextHex =
            a11yPalette.tileGoodHex[entry.matKey as keyof typeof a11yPalette.tileGoodHex] ??
            tilePaletteConfig[entry.matKey]?.color ??
            0x334155;
          entry.mat.color.setHex(nextHex);
        }
      }

      const currSelectedTileId = currPhase !== 'GAME_OVER' ? propsRef.current.selectedTileId : null;
      const activeDecision = propsRef.current.neighborhoodDecision;
      const currTutorialFocus: TutorialBoardFocus =
        currPhase !== 'GAME_OVER' ? (propsRef.current.tutorialFocus ?? 'NONE') : 'NONE';
      const currHeatmap = currPhase !== 'GAME_OVER' ? propsRef.current.speculatorHeatmap : null;
      const tutPulse = isReducedMotion ? 0.65 : 0.5 + 0.5 * Math.sin(elapsed * 4.2);
      const heatPulse = isReducedMotion ? 0.55 : 0.5 + 0.5 * Math.sin(elapsed * 4.6);
      let activeIntendedRings = 0;
      let hoverRingApplied = false;
      let selectedRingApplied = false;

      propsRef.current.tiles.forEach((tile, idx) => {
        const tileMesh = tileMeshesRef.current.get(tile.id);
        const chip = chipMeshesRef.current.get(tile.id);
        const padMesh = heatmapPadMeshes.get(tile.id);
        const cullRadius = tile.category === 'CORNER' ? 2.1 : 1.65;
        const isInView = isWorldSphereInFrustum(tile.x, 0.25, tile.z, cullRadius);
        const dangerEntry = currHeatmap ? currHeatmap[tile.id] : undefined;
        const isSelectedTile = currSelectedTileId !== null && tile.id === currSelectedTileId;
        const isHoveredTile = currPhase !== 'GAME_OVER' && hoveredTileId !== null && tile.id === hoveredTileId;

        if (tileMesh && currPhase !== 'GAME_OVER') {
          const targetTileY = isSelectedTile
            ? isReducedMotion
              ? 0.26
              : 0.3
            : isHoveredTile
            ? isReducedMotion
              ? 0.2
              : 0.26
            : 0.2;
          tileMesh.position.y = THREE.MathUtils.damp(tileMesh.position.y, targetTileY, 12, delta);
        }

        const currentTileLift = tileMesh ? tileMesh.position.y - 0.2 : 0;

        if (padMesh) {
          const showPad = isInView && Boolean(dangerEntry && dangerEntry.tier !== 'NONE');
          if (padMesh.visible !== showPad) {
            padMesh.visible = showPad;
          }
          if (showPad && dangerEntry && dangerEntry.tier !== 'NONE') {
            padMesh.position.y = (tile.category === 'CORNER' ? 0.346 : 0.332) + currentTileLift;
            const padMat = padMesh.material as THREE.MeshBasicMaterial;
            const tierVis = a11yPalette.heatmapTiers[dangerEntry.tier];
            padMat.color.setHex(tierVis.hex);
            padMat.opacity = Math.min(
              0.86,
              0.24 + dangerEntry.intensity * 0.5 + (dangerEntry.isIntendedTarget ? heatPulse * 0.14 : 0)
            );
          }
        }

        if (isSelectedTile && isInView) {
          selectedRingApplied = true;
          selectedRingMesh.visible = true;
          selectedRingMesh.position.set(
            tile.x,
            (tile.category === 'CORNER' ? 0.356 : 0.34) + currentTileLift,
            tile.z
          );
          selectedRingMesh.scale.setScalar(tile.category === 'CORNER' ? 1.32 : 1.0);
          selectedRingMat.opacity = isReducedMotion ? 0.88 : 0.78 + tutPulse * 0.18;
        } else if (isHoveredTile && isInView) {
          hoverRingApplied = true;
          hoverRingMesh.visible = true;
          hoverRingMesh.position.set(
            tile.x,
            (tile.category === 'CORNER' ? 0.352 : 0.336) + currentTileLift,
            tile.z
          );
          hoverRingMesh.scale.setScalar(tile.category === 'CORNER' ? 1.32 : 1.0);
        }

        if (
          isInView &&
          dangerEntry?.isIntendedTarget &&
          dangerEntry.tier !== 'NONE' &&
          activeIntendedRings < MAX_INTENDED_TARGET_RINGS
        ) {
          const ringMesh = intendedTargetRingPool[activeIntendedRings];
          const ringMat = intendedTargetRingMaterials[activeIntendedRings];
          const tierVis = a11yPalette.heatmapTiers[dangerEntry.tier];
          ringMesh.position.set(tile.x, (tile.category === 'CORNER' ? 0.354 : 0.338) + currentTileLift, tile.z);
          ringMat.color.setHex(tierVis.ringHex);
          ringMat.opacity = 0.72 + heatPulse * 0.24;
          ringMesh.scale.setScalar(
            (tile.category === 'CORNER' ? 1.18 : 1.0) * (0.96 + heatPulse * 0.08)
          );
          ringMesh.visible = true;
          activeIntendedRings += 1;
        }

        if (tileMesh) {
          totalCullableObjects += 1;
          if (!isInView) culledObjects += 1;
          if (tileMesh.visible !== isInView) {
            tileMesh.visible = isInView;
          }
          if (isInView) {
            const tileMat = tileMesh.material as THREE.MeshStandardMaterial;
            if (tileMat) {
              if (activeDecision && activeDecision.targetTileIds.includes(tile.id)) {
                const pulse = isReducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 6);
                tileMat.emissive.setHex(0x14b8a6);
                tileMat.emissiveIntensity = 0.4 + pulse * 0.6;
              } else if (currTutorialFocus === 'GOODS_STATES' && (tile.category === 'RESOURCE' || tile.category === 'AGORA_ENTRY')) {
                if (tile.state === 'COMMON') {
                  tileMat.emissive.setHex(a11yPalette.tileStateAccentHex.COMMON);
                  tileMat.emissiveIntensity = 0.26 + tutPulse * 0.44;
                } else if (tile.state === 'PUBLIC') {
                  tileMat.emissive.setHex(a11yPalette.tileStateAccentHex.PUBLIC);
                  tileMat.emissiveIntensity = 0.22 + tutPulse * 0.38;
                } else {
                  tileMat.emissive.setHex(a11yPalette.tileStateAccentHex.PRIVATE);
                  tileMat.emissiveIntensity = 0.22 + tutPulse * 0.38;
                }
              } else if (
                (currTutorialFocus === 'ACTIVE_PLAYER_PAWN' || currTutorialFocus === 'TURN_DICE_AND_TILE') &&
                activePlayer &&
                tile.id === activePlayer.position
              ) {
                tileMat.emissive.setHex(0x2dd4bf);
                tileMat.emissiveIntensity = 0.35 + tutPulse * 0.55;
              } else if (
                currTutorialFocus === 'SPECULATORS_THREAT' &&
                (propsRef.current.speculators.some(s => s.position === tile.id) || tile.id === 20)
              ) {
                tileMat.emissive.setHex(a11yPalette.heatmapTiers.HIGH.hex);
                tileMat.emissiveIntensity = 0.35 + tutPulse * 0.55;
              } else if (
                (currTutorialFocus === 'AGORA_CENTRAL' || currTutorialFocus === 'LEGITIMACY_AND_GOAL') &&
                (tile.category === 'AGORA_ENTRY' || (currTutorialFocus === 'LEGITIMACY_AND_GOAL' && tile.state === 'COMMON'))
              ) {
                tileMat.emissive.setHex(0xec4899);
                tileMat.emissiveIntensity = 0.28 + tutPulse * 0.48;
              } else if (dangerEntry && dangerEntry.tier !== 'NONE') {
                const tierVis = a11yPalette.heatmapTiers[dangerEntry.tier];
                tileMat.emissive.setHex(tierVis.hex);
                if (dangerEntry.tier === 'CRITICAL') {
                  tileMat.emissiveIntensity =
                    0.22 + dangerEntry.intensity * 0.36 + (dangerEntry.isIntendedTarget ? heatPulse * 0.18 : 0);
                } else if (dangerEntry.tier === 'HIGH') {
                  tileMat.emissiveIntensity =
                    0.16 + dangerEntry.intensity * 0.28 + (dangerEntry.isIntendedTarget ? heatPulse * 0.12 : 0);
                } else if (dangerEntry.tier === 'PROTECTED') {
                  tileMat.emissiveIntensity = 0.16 + dangerEntry.intensity * 0.22;
                } else {
                  tileMat.emissiveIntensity = 0.1 + dangerEntry.intensity * 0.22;
                }
              } else if (
                currPhase !== 'GAME_OVER' &&
                propsRef.current.players.length > 0 &&
                tile.category === 'AGORA_ENTRY' &&
                propsRef.current.players.reduce((s, p) => s + p.legitimacy, 0) >=
                  propsRef.current.players.length * 10
              ) {
                tileMat.emissive.setHex(0x14b8a6);
                tileMat.emissiveIntensity = 0.12 + tutPulse * 0.14;
              } else if (currPhase !== 'GAME_OVER' && tile.specialType === 'CASINO') {
                tileMat.emissive.setHex(0xbe123c);
                tileMat.emissiveIntensity = 0.12;
              } else if (tileMat.emissiveIntensity !== 0) {
                tileMat.emissive.setHex(0x000000);
                tileMat.emissiveIntensity = 0;
              }
            }
          }
        }

        if (chip) {
          totalCullableObjects += 1;
          if (!isInView) culledObjects += 1;
          if (chip.visible !== isInView) {
            chip.visible = isInView;
          }
          if (isInView && (chip.material as THREE.MeshStandardMaterial)) {
            const mat = chip.material as THREE.MeshStandardMaterial;
            const targetColor = tile.state === 'COMMON' ? 0x111111 : tile.state === 'PUBLIC' ? 0x888888 : 0xffffff;
            mat.color.setHex(targetColor);

            if (currPhase === 'GAME_OVER') {
              const wave = isReducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 4 - idx * 0.25);
              const localCleanse = cleanseState.tileCleanseProgress.get(tile.id) ?? 0;
              const tileMeshY = tileMesh?.position.y ?? 0.2;
              const tileLiftOffset = tileMeshY - 0.2;

              if (tile.state === 'COMMON') {
                mat.emissive.setHex(a11yPalette.tileStateAccentHex.COMMON);
                mat.emissiveIntensity = 0.45 + wave * 0.65 + localCleanse * 0.25;
                chip.position.y = 0.48 + wave * 0.24 + tileLiftOffset;
                chip.scale.setScalar(1.08 + wave * 0.14);
              } else if (tile.state === 'PUBLIC') {
                _tempColor
                  .setHex(a11yPalette.tileStateAccentHex.PUBLIC)
                  .lerp(giUniforms.uCleanseWaveColor.value, localCleanse * effectiveEfficiency * 0.65);
                mat.emissive.copy(_tempColor);
                mat.emissiveIntensity = 0.25 + wave * 0.35 + localCleanse * effectiveEfficiency * 0.25;
                chip.position.y = 0.44 + wave * 0.1 + tileLiftOffset;
                chip.scale.setScalar(1.04 + localCleanse * effectiveEfficiency * 0.06);
              } else {
                _tempColor
                  .setHex(a11yPalette.tileStateAccentHex.PRIVATE)
                  .lerp(giUniforms.uCleanseWaveColor.value, localCleanse * effectiveEfficiency * 0.85);
                mat.emissive.copy(_tempColor);
                mat.emissiveIntensity = 0.2 + wave * 0.3;
                chip.position.y = 0.42 + tileLiftOffset;
                chip.scale.setScalar(1.0 + localCleanse * effectiveEfficiency * 0.06);
              }
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
              const tileLiftOffset = tileMesh ? tileMesh.position.y - 0.2 : 0;
              chip.position.y = 0.42 + tileLiftOffset;
              chip.scale.setScalar(1.0);
            }
          }
        }
      });

      if (!hoverRingApplied && hoverRingMesh.visible) {
        hoverRingMesh.visible = false;
      }
      if (!selectedRingApplied && selectedRingMesh.visible) {
        selectedRingMesh.visible = false;
      }

      for (let r = activeIntendedRings; r < MAX_INTENDED_TARGET_RINGS; r++) {
        if (intendedTargetRingPool[r].visible) {
          intendedTargetRingPool[r].visible = false;
        }
      }

      // Actualización de indicadores 3D de trayectorias de especuladores (Devs Trajectory Visualizer)
      const currTrajectories =
        currPhase !== 'GAME_OVER' ? propsRef.current.speculatorTrajectories : null;
      const hasTrajectories = Boolean(currTrajectories && currTrajectories.length > 0);

      for (let sIdx = 0; sIdx < MAX_SPECULATOR_TRAJECTORIES; sIdx++) {
        const slot = trajectorySlots[sIdx];
        if (!hasTrajectories || !currTrajectories || sIdx >= currTrajectories.length) {
          if (slot.group.visible) {
            slot.group.visible = false;
          }
          continue;
        }

        const traj = currTrajectories[sIdx];
        slot.group.visible = true;

        const trajPal =
          a11yPalette.trajectoryColors[
            Math.max(0, traj.orderIndex - 1) % a11yPalette.trajectoryColors.length
          ];
        const trajHex = trajPal ? trajPal.hex : traj.colorHex;

        // Color según bot, amenaza y paleta de accesibilidad activa
        slot.perimeterMat.color.setHex(trajHex);
        slot.arcMat.color.setHex(trajHex);
        slot.arrowMat.color.setHex(trajHex);
        slot.arrowMat.emissive.setHex(trajHex);
        slot.pulseMat.color.setHex(trajHex);
        slot.pulseMat.emissive.setHex(trajHex);
        slot.startRingMat.color.setHex(trajHex);

        const startCoords = getTileCoords(traj.fromTileId);
        const targetCoords = getTileCoords(traj.toTileId);

        // Anillo de inicio en la casilla del especulador
        slot.startRing.position.set(startCoords.x, 0.345, startCoords.z);

        // 1. Trazado del recorrido terrestre sobre las casillas
        const pathIds = traj.pathTileIds;
        const pathCount = Math.min(TRAJECTORY_MAX_PATH_STEPS, pathIds.length);
        const perimPos = slot.perimeterGeo.attributes.position.array as Float32Array;
        for (let p = 0; p < pathCount; p++) {
          const c = getTileCoords(pathIds[p]);
          perimPos[p * 3] = c.x;
          perimPos[p * 3 + 1] = 0.418;
          perimPos[p * 3 + 2] = c.z;
        }
        slot.perimeterGeo.setDrawRange(0, pathCount);
        slot.perimeterGeo.attributes.position.needsUpdate = true;

        // 2. Arco parabólico 3D elevado en el espacio
        const arcPos = slot.arcGeo.attributes.position.array as Float32Array;
        const arcDist = Math.hypot(targetCoords.x - startCoords.x, targetCoords.z - startCoords.z);
        const peakHeight = Math.max(0.85, Math.min(2.8, 0.65 + arcDist * 0.14));
        const startY = 0.55;
        const targetY = 0.43;

        for (let a = 0; a < TRAJECTORY_ARC_STEPS; a++) {
          const t = a / (TRAJECTORY_ARC_STEPS - 1);
          const x = THREE.MathUtils.lerp(startCoords.x, targetCoords.x, t);
          const z = THREE.MathUtils.lerp(startCoords.z, targetCoords.z, t);
          const y = THREE.MathUtils.lerp(startY, targetY, t) + Math.sin(t * Math.PI) * peakHeight;
          arcPos[a * 3] = x;
          arcPos[a * 3 + 1] = y;
          arcPos[a * 3 + 2] = z;
        }
        slot.arcGeo.setDrawRange(0, TRAJECTORY_ARC_STEPS);
        slot.arcGeo.attributes.position.needsUpdate = true;

        // 3. Cono / flecha orientada en la casilla destino
        slot.arrowCone.position.set(targetCoords.x, 0.46, targetCoords.z);
        let dirX = targetCoords.x - startCoords.x;
        let dirZ = targetCoords.z - startCoords.z;
        if (pathIds.length >= 2) {
          const prevC = getTileCoords(pathIds[pathIds.length - 2]);
          dirX = targetCoords.x - prevC.x;
          dirZ = targetCoords.z - prevC.z;
        }
        const dirLen = Math.hypot(dirX, dirZ);
        if (dirLen > 0.001) {
          _coneDir.set(dirX / dirLen, 0, dirZ / dirLen);
          slot.arrowCone.quaternion.setFromUnitVectors(_coneUp, _coneDir);
        }

        // 4. Orbe de energía / pulso viajando a lo largo del arco
        const pulseT = isReducedMotion
          ? 0.75
          : ((elapsed * 0.8 + sIdx * 0.35) % 1.0);
        const orbX = THREE.MathUtils.lerp(startCoords.x, targetCoords.x, pulseT);
        const orbZ = THREE.MathUtils.lerp(startCoords.z, targetCoords.z, pulseT);
        const orbY = THREE.MathUtils.lerp(startY, targetY, pulseT) + Math.sin(pulseT * Math.PI) * peakHeight;
        slot.pulseOrb.position.set(orbX, orbY, orbZ);
        slot.pulseOrb.scale.setScalar(0.85 + 0.3 * Math.sin(pulseT * Math.PI));
      }

      if (agoraGroupRef.current) {
        const isAgoraVisible = applyGroupFrustumAndDetailLOD(
          agoraGroupRef.current,
          camera.position,
          4.0,
          0.35,
          1600
        );
        totalCullableObjects += 1;
        if (!isAgoraVisible) culledObjects += 1;
      }

      // Baliza 3D del Tutorial Interactivo sobre Ágora, peón activo, dado o especuladores
      if (currTutorialFocus === 'AGORA_CENTRAL' || currTutorialFocus === 'LEGITIMACY_AND_GOAL') {
        tutorialRingMesh.visible = true;
        tutorialRingMesh.position.set(0, 0.52, 0);
        tutorialRingMesh.scale.setScalar(2.45 + tutPulse * 0.22);
        tutorialRingMat.color.setHex(currTutorialFocus === 'AGORA_CENTRAL' ? 0xec4899 : 0xfacc15);
        tutorialRingMat.opacity = 0.48 + tutPulse * 0.36;
        ringMat.emissiveIntensity = 0.55 + tutPulse * 0.5;
        coreMat.emissiveIntensity = 0.45 + tutPulse * 0.55;
      } else {
        ringMat.emissiveIntensity = THREE.MathUtils.damp(ringMat.emissiveIntensity, 0.28, 6, delta);
        coreMat.emissiveIntensity = THREE.MathUtils.damp(coreMat.emissiveIntensity, 0.2, 6, delta);

        if (currTutorialFocus === 'ACTIVE_PLAYER_PAWN' && activePlayer) {
          const pawn = playerMeshesRef.current.get(activePlayer.id);
          if (pawn) {
            tutorialRingMesh.visible = true;
            tutorialRingMesh.position.set(pawn.position.x, 0.38, pawn.position.z);
            tutorialRingMesh.scale.setScalar(0.92 + tutPulse * 0.16);
            tutorialRingMat.color.setHex(0x2dd4bf);
            tutorialRingMat.opacity = 0.55 + tutPulse * 0.35;
          } else {
            tutorialRingMesh.visible = false;
          }
        } else if (currTutorialFocus === 'TURN_DICE_AND_TILE' && diceGroupRef.current) {
          tutorialRingMesh.visible = true;
          tutorialRingMesh.position.set(
            diceGroupRef.current.position.x,
            0.38,
            diceGroupRef.current.position.z
          );
          tutorialRingMesh.scale.setScalar(0.95 + tutPulse * 0.18);
          tutorialRingMat.color.setHex(0xfacc15);
          tutorialRingMat.opacity = 0.55 + tutPulse * 0.35;
        } else if (currTutorialFocus === 'SPECULATORS_THREAT' && propsRef.current.speculators[0]) {
          const specMesh = speculatorMeshesRef.current.get(propsRef.current.speculators[0].id);
          if (specMesh) {
            tutorialRingMesh.visible = true;
            tutorialRingMesh.position.set(specMesh.position.x, 0.38, specMesh.position.z);
            tutorialRingMesh.scale.setScalar(1.0 + tutPulse * 0.18);
            tutorialRingMat.color.setHex(0xf97316);
            tutorialRingMat.opacity = 0.58 + tutPulse * 0.35;
          } else {
            tutorialRingMesh.visible = false;
          }
        } else {
          tutorialRingMesh.visible = false;
        }
      }

      // Dice roll tumble animation + frustum/distance LOD culling
      if (diceGroupRef.current) {
        const diceVisible = applyGroupFrustumAndDetailLOD(
          diceGroupRef.current,
          camera.position,
          1.15,
          0,
          620
        );
        totalCullableObjects += 1;
        if (!diceVisible) culledObjects += 1;
        if (diceVisible || isRollingRef.current) {
          if (isRollingRef.current) {
            if (!isReducedMotion) {
              diceGroupRef.current.rotation.x += 18 * delta;
              diceGroupRef.current.rotation.y += 24 * delta;
              diceGroupRef.current.rotation.z += 15 * delta;
              diceGroupRef.current.position.y = 1.6 + Math.sin(elapsed * 12) * 0.4;
            }
          } else {
            diceGroupRef.current.rotation.x = THREE.MathUtils.damp(diceGroupRef.current.rotation.x, diceTargetRotationRef.current.x, 8, delta);
            diceGroupRef.current.rotation.y = THREE.MathUtils.damp(diceGroupRef.current.rotation.y, diceTargetRotationRef.current.y, 8, delta);
            diceGroupRef.current.rotation.z = THREE.MathUtils.damp(diceGroupRef.current.rotation.z, diceTargetRotationRef.current.z, 8, delta);
            diceGroupRef.current.position.y = THREE.MathUtils.damp(diceGroupRef.current.position.y, 0.75, 8, delta);
          }
        }
      }

      // --- SISTEMA DE CLIMA GRADUAL (Cross-fade Lluvia / Nieve / Soleado + Atmósfera) ---
      const weatherCond = resolveWeather(
        propsRef.current.tiles,
        propsRef.current.weatherMode,
        propsRef.current.weatherIntensity ?? 0.85,
        propsRef.current.round,
        propsRef.current.activePlayerIndex,
        propsRef.current.activeWeatherEvent
      );
      const isGameOver = currPhase === 'GAME_OVER';

      smoothWeatherIntensity = THREE.MathUtils.damp(
        smoothWeatherIntensity,
        isGameOver ? 0 : weatherCond.intensity,
        1.6,
        delta
      );

      const targetRainWeight = !isGameOver && weatherCond.type === 'RAIN' ? 1 : 0;
      const targetSnowWeight = !isGameOver && weatherCond.type === 'SNOW' ? 1 : 0;
      const targetSunWeight =
        !isGameOver && (weatherCond.type === 'SUNNY' || weatherCond.type === 'TEMPERATE') ? 1 : 0;

      // Damping lento (~1.2–1.4) para transiciones atmosféricas verdaderamente graduales
      rainWeight = THREE.MathUtils.damp(rainWeight, targetRainWeight, 1.35, delta);
      snowWeight = THREE.MathUtils.damp(snowWeight, targetSnowWeight, 1.15, delta);
      sunWeight = THREE.MathUtils.damp(sunWeight, targetSunWeight, 1.3, delta);

      const advWeatherCfg =
        propsRef.current.weatherAdvancedConfig ?? DEFAULT_WEATHER_ADVANCED_CONFIG;
      const particleScale = THREE.MathUtils.clamp(
        advWeatherCfg.particleDensityScale ?? 1,
        0,
        1.5
      );
      const atmosphereScale = THREE.MathUtils.clamp(
        advWeatherCfg.atmosphereImpactScale ?? 1,
        0,
        1.5
      );
      const particleDensityFraction = THREE.MathUtils.clamp(particleScale, 0, 1);

      const effectiveRain = rainWeight * smoothWeatherIntensity * particleScale;
      const effectiveSnow = snowWeight * smoothWeatherIntensity * particleScale;
      const effectiveSun = sunWeight * smoothWeatherIntensity * particleScale;

      // 1) Actualizar estelas de lluvia + salpicaduras si tienen peso visible y están en frustum
      if (effectiveRain > 0.01 && particleScale > 0.01 && isBoardVolumeInFrustum) {
        rainLines.visible = true;
        rainSplashPoints.visible = true;
        rainGeo.setDrawRange(0, Math.max(2, Math.round(RAIN_COUNT * particleDensityFraction)) * 2);
        splashGeo.setDrawRange(0, Math.max(1, Math.round(SPLASH_COUNT * particleDensityFraction)));
        rainMat.opacity = Math.min(0.92, effectiveRain * 0.9);
        splashMat.opacity = Math.min(0.76, effectiveRain * 0.72);

        const rPosAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        const speedScale = 0.65 + 0.45 * smoothWeatherIntensity * Math.max(0.5, particleScale);
        for (let i = 0; i < RAIN_COUNT; i++) {
          const rIdx = i * 3;
          const vIdx = i * 6;
          const spd = rainSpeeds[i] * speedScale;

          let rx = rainRoots[rIdx] + 1.65 * delta;
          let ry = rainRoots[rIdx + 1] - spd * delta;
          let rz = rainRoots[rIdx + 2] + 0.55 * delta;

          if (ry < 0.22) {
            ry = 13.8 + Math.random() * 1.2;
            rx = (Math.random() - 0.5) * 26;
            rz = (Math.random() - 0.5) * 26;
          }

          rainRoots[rIdx] = rx;
          rainRoots[rIdx + 1] = ry;
          rainRoots[rIdx + 2] = rz;

          const streakLen = (0.42 + (rainSpeeds[i] - 9.5) * 0.045) * (0.65 + 0.35 * Math.min(1.2, effectiveRain));
          rainPositions[vIdx] = rx;
          rainPositions[vIdx + 1] = ry;
          rainPositions[vIdx + 2] = rz;
          rainPositions[vIdx + 3] = rx - 0.16;
          rainPositions[vIdx + 4] = ry + streakLen;
          rainPositions[vIdx + 5] = rz - 0.05;
        }
        rPosAttr.needsUpdate = true;

        const spPosAttr = splashGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < SPLASH_COUNT; i++) {
          splashTimers[i] += delta * (2.6 + smoothWeatherIntensity * 1.4);
          if (splashTimers[i] >= 1) {
            splashTimers[i] = 0;
            spPosAttr.setXYZ(i, (Math.random() - 0.5) * 23, 0.23, (Math.random() - 0.5) * 23);
          } else {
            const arc = Math.sin(splashTimers[i] * Math.PI) * 0.28;
            spPosAttr.setY(i, 0.23 + arc);
          }
        }
        spPosAttr.needsUpdate = true;
      } else {
        rainLines.visible = false;
        rainSplashPoints.visible = false;
        rainMat.opacity = 0;
        splashMat.opacity = 0;
      }

      // 2) Actualizar copos cristalinos de nieve si están en frustum
      if (effectiveSnow > 0.01 && particleScale > 0.01 && isBoardVolumeInFrustum) {
        snowPoints.visible = true;
        snowGeo.setDrawRange(0, Math.max(1, Math.round(SNOW_COUNT * particleDensityFraction)));
        snowMat.opacity = Math.min(0.98, effectiveSnow * 0.96);
        snowMat.size = (0.42 + smoothWeatherIntensity * 0.22) * (0.75 + 0.25 * particleScale);

        const snPosAttr = snowGeo.getAttribute('position') as THREE.BufferAttribute;
        const fallScale = 0.7 + 0.4 * smoothWeatherIntensity * Math.max(0.5, particleScale);
        for (let i = 0; i < SNOW_COUNT; i++) {
          let sx = snPosAttr.getX(i);
          let sy = snPosAttr.getY(i);
          let sz = snPosAttr.getZ(i);
          const spd = snowSpeeds[i] * fallScale;
          const ph = snowPhases[i];

          sy -= (spd * 1.15 + 0.55) * delta;
          sx += (Math.sin(elapsed * 1.4 + ph) * 1.1 + Math.cos(elapsed * 0.7 + ph) * 0.35) * delta;
          sz += (Math.cos(elapsed * 1.2 + ph) * 1.1 + Math.sin(elapsed * 0.6 + ph) * 0.35) * delta;

          if (sy < 0.24) {
            sy = 13.8 + Math.random() * 1.0;
            sx = (Math.random() - 0.5) * 26;
            sz = (Math.random() - 0.5) * 26;
          }
          snPosAttr.setXYZ(i, sx, sy, sz);
        }
        snPosAttr.needsUpdate = true;
      } else {
        snowPoints.visible = false;
        snowMat.opacity = 0;
      }

      // 3) Actualizar motas solares doradas si están en frustum
      if (effectiveSun > 0.01 && particleScale > 0.01 && isBoardVolumeInFrustum) {
        sunPoints.visible = true;
        sunGeo.setDrawRange(0, Math.max(1, Math.round(SUN_COUNT * particleDensityFraction)));
        sunMat.opacity = Math.min(0.92, effectiveSun * 0.85);
        sunMat.size = (0.36 + smoothWeatherIntensity * 0.16) * (0.75 + 0.25 * particleScale);

        const suPosAttr = sunGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < SUN_COUNT; i++) {
          let gx = suPosAttr.getX(i);
          let gy = suPosAttr.getY(i);
          let gz = suPosAttr.getZ(i);
          const ph = sunPhases[i];
          const spd = sunSpeeds[i];

          gy += (Math.sin(elapsed * 0.85 + ph) * 0.35 + spd * 0.22) * delta;
          gx += Math.cos(elapsed * 0.65 + ph) * 0.45 * delta;
          gz += Math.sin(elapsed * 0.72 + ph) * 0.45 * delta;

          if (gy > 12.2) {
            gy = 0.38;
            gx = (Math.random() - 0.5) * 25;
            gz = (Math.random() - 0.5) * 25;
          }
          if (gy < 0.35) gy = 0.38;
          suPosAttr.setXYZ(i, gx, gy, gz);
        }
        suPosAttr.needsUpdate = true;
      } else {
        sunPoints.visible = false;
        sunMat.opacity = 0;
      }

      // 4) Iluminación global GLSL, cúpula atmosférica, niebla y luces dinámicas según clima, hora del juego y eventos de cartas
      const timeInfo = resolveGameTimeOfDay(
        propsRef.current.round ?? 1,
        currIdx,
        currPlayers.length || 4,
        propsRef.current.timeOfDayMode ?? 'AUTO'
      );
      const cardInfo = resolveCardAtmosphere({
        phase: currPhase,
        activeModal: propsRef.current.activeModal,
        currentGlobalCard: propsRef.current.currentGlobalCard,
        currentSituationCard: propsRef.current.currentSituationCard
      });

      const atmosphereWeatherIntensity = THREE.MathUtils.clamp(
        smoothWeatherIntensity * atmosphereScale,
        0,
        1.5
      );

      computeAtmosphereTargets(_atmosphereTargets, {
        weatherType: weatherCond.type,
        weatherIntensity: atmosphereWeatherIntensity,
        timeInfo,
        cardInfo,
        phase: currPhase,
        gameResult: currResult
      });

      skyDome.update(delta, elapsed, _atmosphereTargets);

      const atmosAlpha = 1 - Math.exp(-1.55 * delta);
      if (scene.fog && 'color' in scene.fog) {
        (scene.fog as THREE.FogExp2).color.lerp(_atmosphereTargets.fogColor, atmosAlpha);
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.damp(
          (scene.fog as THREE.FogExp2).density,
          _atmosphereTargets.fogDensity,
          1.4,
          delta
        );
      }
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_atmosphereTargets.fogColor, atmosAlpha);
      }

      keyLight.color.lerp(_atmosphereTargets.keyColor, atmosAlpha);
      keyLight.position.lerp(_atmosphereTargets.keyPosition, atmosAlpha);
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        _atmosphereTargets.keyIntensity,
        1.5,
        delta
      );

      hemiLight.color.lerp(_atmosphereTargets.hemiSkyColor, atmosAlpha);
      hemiLight.groundColor.lerp(_atmosphereTargets.hemiGroundColor, atmosAlpha);
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        _atmosphereTargets.hemiIntensity,
        1.5,
        delta
      );

      rimLight.color.lerp(_atmosphereTargets.rimColor, atmosAlpha);
      rimLight.intensity = THREE.MathUtils.damp(
        rimLight.intensity,
        _atmosphereTargets.rimIntensity,
        1.5,
        delta
      );

      // Respuesta del tapete del tablero (humedad reflectante en lluvia y balance térmico)
      feltMat.color.lerp(_atmosphereTargets.feltColor, atmosAlpha);
      feltMat.roughness = THREE.MathUtils.damp(
        feltMat.roughness,
        _atmosphereTargets.feltRoughness,
        1.4,
        delta
      );

      // Resplandor reactivo del Ágora Central sincronizado con la hora nocturna y cartas
      coreMat.emissive.lerp(_atmosphereTargets.giAgoraGlowColor, atmosAlpha);
      coreMat.emissiveIntensity = THREE.MathUtils.damp(
        coreMat.emissiveIntensity,
        0.18 + _atmosphereTargets.giAgoraGlowStrength * 0.55,
        2.0,
        delta
      );
      ringMat.emissiveIntensity = THREE.MathUtils.damp(
        ringMat.emissiveIntensity,
        0.24 + _atmosphereTargets.nightFactor * 0.25 + _atmosphereTargets.giAgoraGlowStrength * 0.3,
        2.0,
        delta
      );

      renderer.toneMappingExposure = THREE.MathUtils.damp(
        renderer.toneMappingExposure,
        _atmosphereTargets.exposure,
        1.5,
        delta
      );

      // --- ACTUALIZACIÓN DE PARTÍCULAS DE BIENES COMUNES & AURA (con frustum culling) ---
      if (commonsPoints.visible) {
        const isCommonsBurstInFrustum = isWorldSphereInFrustum(
          commonsBurstCenterX,
          3.0,
          commonsBurstCenterZ,
          8.0
        );
        let anyActive = false;

        if (!isCommonsBurstInFrustum) {
          for (let i = 0; i < COMMONS_PARTICLE_COUNT; i++) {
            if (commonsLife[i] > 0) {
              commonsLife[i] -= delta;
              if (commonsLife[i] > 0) anyActive = true;
            }
          }
          if (!anyActive) {
            commonsPoints.visible = false;
          }
        } else {
          const cPosAttr = commonsGeo.getAttribute('position') as THREE.BufferAttribute;
          const cColAttr = commonsGeo.getAttribute('color') as THREE.BufferAttribute;

          for (let i = 0; i < COMMONS_PARTICLE_COUNT; i++) {
            if (commonsLife[i] > 0) {
              anyActive = true;
              commonsLife[i] -= delta;
              const lifeFrac = Math.max(0, commonsLife[i] / commonsMaxLife[i]);
              const pIdx = i * 3;

              // Gravedad suave y resistencia aerodinámica
              commonsVelocities[pIdx + 1] -= 7.8 * delta;
              const drag = Math.pow(0.86, delta * 30);
              commonsVelocities[pIdx] *= drag;
              commonsVelocities[pIdx + 2] *= drag;

              // Giro sutil en espiral alrededor del vórtice
              const spin = delta * 1.5;
              const vx = commonsVelocities[pIdx];
              const vz = commonsVelocities[pIdx + 2];
              commonsVelocities[pIdx] = vx * Math.cos(spin) - vz * Math.sin(spin);
              commonsVelocities[pIdx + 2] = vx * Math.sin(spin) + vz * Math.cos(spin);

              let px = cPosAttr.getX(i) + commonsVelocities[pIdx] * delta;
              let py = cPosAttr.getY(i) + commonsVelocities[pIdx + 1] * delta;
              let pz = cPosAttr.getZ(i) + commonsVelocities[pIdx + 2] * delta;

              // Rebote elástico en la superficie de la casilla
              if (py < 0.28) {
                py = 0.28;
                commonsVelocities[pIdx + 1] = -commonsVelocities[pIdx + 1] * 0.32;
                commonsVelocities[pIdx] *= 0.65;
                commonsVelocities[pIdx + 2] *= 0.65;
              }

              cPosAttr.setXYZ(i, px, py, pz);

              // Modulación de brillo y color
              const fade = Math.sin(lifeFrac * Math.PI);
              cColAttr.setXYZ(
                i,
                cColAttr.getX(i) * 0.98 + fade * 0.02,
                cColAttr.getY(i) * 0.98 + fade * 0.02,
                cColAttr.getZ(i) * 0.98 + fade * 0.02
              );
            } else {
              cPosAttr.setY(i, -20);
            }
          }

          cPosAttr.needsUpdate = true;
          cColAttr.needsUpdate = true;

          if (!anyActive) {
            commonsPoints.visible = false;
          }
        }
      }

      // Actualizar onda expansiva del aura luminosa
      if (auraLife > 0) {
        auraLife -= delta;
        const progress = 1 - Math.max(0, auraLife / auraDuration);
        const currentScale = 1.0 + progress * 4.2;
        auraMesh.scale.set(currentScale, currentScale, 1);
        auraMat.opacity = Math.sin((1 - progress) * Math.PI) * 0.85;
      } else {
        auraMesh.visible = false;
      }

      // Actualizar lluvia de hojas secas y ceniza desaturada (solo durante 'Tragedia de los Comunes')
      tragedyParticles.update(
        isTragedyOfCommonsActive,
        delta,
        elapsed,
        reducedMotionQuery?.matches ?? false,
        isBoardVolumeInFrustum
      );

      const usePostProcessing = Boolean(
        postProcessing && (propsRef.current.postProcessingEnabled ?? true)
      );
      renderer.info.reset();
      if (usePostProcessing && postProcessing) {
        postProcessing.updateAtmosphere({
          weatherType: weatherCond.type,
          weatherIntensity: atmosphereWeatherIntensity,
          phase: currPhase,
          gameResult: currResult,
          hasCelebrationBurst: auraLife > 0 || commonsPoints.visible,
          postTint: _atmosphereTargets.postTint,
          postShadowTint: _atmosphereTargets.postShadowTint,
          twilightFactor: _atmosphereTargets.twilightFactor,
          nightFactor: _atmosphereTargets.nightFactor,
          isTragedyOfCommons: isTragedyOfCommonsActive,
          cooperativeEfficiency: effectiveEfficiency,
          cleansingProgress: cleanseState.cleansingProgress,
          delta
        });
        postProcessing.composer.render();
      } else {
        renderer.render(scene, camera);
      }

      const windowElapsedMs = frameNow - perfWindowStart;
      if (windowElapsedMs >= 450 && propsRef.current.telemetryRef) {
        const avgFrameMs = windowElapsedMs / Math.max(1, perfFramesInWindow);
        const computedFps = Math.min(240, Math.round((perfFramesInWindow * 1000) / windowElapsedMs));
        propsRef.current.telemetryRef.current = {
          fps: computedFps,
          frameTimeMs: Math.round(avgFrameMs * 10) / 10,
          maxFrameTimeMs: Math.round((perfMaxFrameMs > 0 ? perfMaxFrameMs : avgFrameMs) * 10) / 10,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          culledObjects,
          totalCullableObjects,
          pixelRatio: renderer.getPixelRatio(),
          isSoftwareGl,
          updatedAt: frameNow
        };
        perfWindowStart = frameNow;
        perfFramesInWindow = 0;
        perfMaxFrameMs = 0;
      }

      if (isSoftwareGl) {
        afterDraw(render);
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Ignorar si algún shader diferido no compila aún
      }
    }

    render();

    // Manejo de interacción táctil/ratón y raycasting sobre casillas
    let pointerStartX = 0;
    let pointerStartY = 0;
    let lastHoverRaycastAt = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!container || !renderer || !camera || isSoftwareGl) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastHoverRaycastAt < 45) return;
      lastHoverRaycastAt = now;

      if (propsRef.current.phase === 'GAME_OVER' || propsRef.current.activeModal) {
        if (hoveredTileId !== null) {
          hoveredTileId = null;
          renderer.domElement.style.cursor = '';
        }
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      _raycasterPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _raycasterPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_raycasterPointer, camera);

      const tileMeshArray = Array.from(tileMeshesRef.current.values());
      const intersects = _raycaster.intersectObjects(tileMeshArray, false);
      const nextTileId =
        intersects.length > 0 && intersects[0].object.userData?.tileId !== undefined
          ? (intersects[0].object.userData.tileId as number)
          : null;

      if (hoveredTileId !== nextTileId) {
        hoveredTileId = nextTileId;
        renderer.domElement.style.cursor = nextTileId !== null ? 'pointer' : '';
      }
    };

    const handlePointerLeave = () => {
      hoveredTileId = null;
      if (renderer?.domElement) {
        renderer.domElement.style.cursor = '';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || !container || !renderer || !camera) return;
      const dx = Math.abs(e.clientX - pointerStartX);
      const dy = Math.abs(e.clientY - pointerStartY);
      if (dx > 8 || dy > 8) return; // Considerado arrastre u órbita

      const rect = renderer.domElement.getBoundingClientRect();
      _raycasterPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _raycasterPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_raycasterPointer, camera);

      const tileMeshArray = Array.from(tileMeshesRef.current.values());
      const intersects = _raycaster.intersectObjects(tileMeshArray, false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const tileId = hit.object.userData?.tileId;
        if (tileId !== undefined) {
          const tile = propsRef.current.tiles.find(t => t.id === tileId);
          if (tile) {
            propsRef.current.onTileClick?.(tile);
            if (tile.state === 'COMMON' || tile.category === 'INALIENABLE_COMMON') {
              triggerCommonsBurst(tile.x, tile.z, tile.goodType);
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const compact = Math.min(width, height) < 640;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, compact ? 1.5 : 2));
      renderer.setSize(width, height);
      postProcessing?.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    const disposeObjectGroup = (group: THREE.Group) => {
      scene.remove(group);
      group.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.style.cursor = '';
      particleGeo.dispose();
      particleMat.dispose();
      particleTexture.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      splashGeo.dispose();
      splashMat.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      snowTexture.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      weatherTexture.dispose();
      commonsGeo.dispose();
      commonsMat.dispose();
      commonsTexture.dispose();
      auraGeo.dispose();
      auraMat.dispose();
      tutorialRingGeo.dispose();
      tutorialRingMat.dispose();
      skyDome.dispose();
      envTexture.dispose();
      scene.environment = null;
      tableGeo.dispose();
      tableMat.dispose();
      feltGeo.dispose();
      feltMat.dispose();
      tileGeo.dispose();
      cornerGeo.dispose();
      chipGeo.dispose();
      heatmapTileGeo.dispose();
      heatmapCornerGeo.dispose();
      heatmapRingGeo.dispose();
      hoverRingGeo.dispose();
      hoverRingMat.dispose();
      selectedRingGeo.dispose();
      selectedRingMat.dispose();
      heatmapPadMaterials.forEach(m => m.dispose());
      intendedTargetRingMaterials.forEach(m => m.dispose());
      heatmapPadMeshes.clear();
      trajectorySharedConeGeo.dispose();
      trajectorySharedSphereGeo.dispose();
      trajectorySharedRingGeo.dispose();
      trajectorySlots.forEach(slot => {
        scene.remove(slot.group);
        slot.perimeterGeo.dispose();
        slot.perimeterMat.dispose();
        slot.arcGeo.dispose();
        slot.arcMat.dispose();
        slot.arrowMat.dispose();
        slot.pulseMat.dispose();
        slot.startRingMat.dispose();
      });
      tileMaterialList.forEach(m => m.dispose());
      chipMeshesRef.current.forEach(chip => {
        if (Array.isArray(chip.material)) {
          chip.material.forEach(m => m.dispose());
        } else {
          chip.material?.dispose();
        }
      });
      chipMeshesRef.current.clear();
      tileMeshesRef.current.clear();
      tileSaturationEntries.clear();
      daisGeo.dispose();
      daisMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      diceGeo.dispose();
      diceMat.dispose();
      pipGeo.dispose();
      pipMat.dispose();
      playerMeshesRef.current.forEach(disposeObjectGroup);
      playerMeshesRef.current.clear();
      speculatorMeshesRef.current.forEach(disposeObjectGroup);
      speculatorMeshesRef.current.clear();
      agoraGroupRef.current = null;
      diceGroupRef.current = null;
      postProcessing?.dispose();
      tragedyParticles.dispose();
      boardCleansing.dispose();
      cinematicCamera.dispose();
      pawnWaypointQueues.clear();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Reconciliar fichas 3D de Personajes y Especuladores ante cambios de plantilla o reanudación de partida guardada
  const playerRosterKey = players.map(p => `${p.id}:${p.color}`).join('|');
  const speculatorRosterKey = speculators.map(s => `${s.id}:${s.color}`).join('|');

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const disposeGroup = (group: THREE.Group) => {
      scene.remove(group);
      group.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    };

    // Sincronizar personajes
    const validPlayerIds = new Set(players.map(p => p.id));
    playerMeshesRef.current.forEach((group, id) => {
      if (!validPlayerIds.has(id)) {
        disposeGroup(group);
        playerMeshesRef.current.delete(id);
      }
    });
    players.forEach(player => {
      if (!playerMeshesRef.current.has(player.id)) {
        const pawnGroup = createCharacterPawnMesh(player.id, player.color, player.accentColor, false, {
          detail: 'board'
        });
        const coords = getTileCoords(player.position);
        pawnGroup.position.set(coords.x, player.inAgora ? 0.65 : 0.35, coords.z);
        scene.add(pawnGroup);
        playerMeshesRef.current.set(player.id, pawnGroup);
      }
    });

    // Sincronizar especuladores
    const validSpecIds = new Set(speculators.map(s => s.id));
    speculatorMeshesRef.current.forEach((group, id) => {
      if (!validSpecIds.has(id)) {
        disposeGroup(group);
        speculatorMeshesRef.current.delete(id);
      }
    });
    speculators.forEach(speculator => {
      if (!speculatorMeshesRef.current.has(speculator.id)) {
        const specGroup = createCharacterPawnMesh('speculator', speculator.color, '#0f172a', true, {
          detail: 'board'
        });
        const coords = getTileCoords(speculator.position);
        specGroup.position.set(coords.x + 0.3, 0.35, coords.z + 0.3);
        scene.add(specGroup);
        speculatorMeshesRef.current.set(speculator.id, specGroup);
      }
    });

    // Reiniciar seguimiento base para evitar falsas explosiones de partículas al cargar partida
    prevPlayerPositionsRef.current.clear();
    prevTileStatesRef.current.clear();
  }, [playerRosterKey, speculatorRosterKey]);

  // Evitar falsos destellos de comunalización al salir de TITLE/SETUP hacia una partida cargada
  useEffect(() => {
    if (phase === 'TITLE' || phase === 'SETUP') {
      prevPlayerPositionsRef.current.clear();
      prevTileStatesRef.current.clear();
    }
  }, [phase]);

  // Update Dice animation when currentDiceRoll changes
  useEffect(() => {
    if (currentDiceRoll !== null) {
      isRollingRef.current = true;
      const timer = setTimeout(() => {
        isRollingRef.current = false;
        // Orient dice so the top face matches the roll
        const rotations: Record<number, [number, number, number]> = {
          1: [0, 0, 0],
          6: [Math.PI, 0, 0],
          2: [Math.PI / 2, 0, 0],
          5: [-Math.PI / 2, 0, 0],
          3: [0, 0, -Math.PI / 2],
          4: [0, 0, Math.PI / 2]
        };
        const [rx, ry, rz] = rotations[currentDiceRoll] || [0, 0, 0];
        diceTargetRotationRef.current.set(rx, ry, rz);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentDiceRoll]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <div ref={mountRef} className="w-full h-full" />
      {webglLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-slate-200 p-6 text-center z-0">
          <div className="max-w-sm space-y-2">
            <h3 className="text-base font-bold text-white">{t.hud.webglLostTitle}</h3>
            <p className="text-xs text-slate-400">
              {t.hud.webglLostDesc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
