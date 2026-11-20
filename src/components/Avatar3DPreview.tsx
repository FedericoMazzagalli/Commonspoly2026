/**
 * Avatar3DPreview.tsx
 * Visor interactivo Three.js para inspeccionar en 3D los avatares de Commonspoly
 * en la pantalla de preparación. Reutiliza el mismo constructor procedural del tablero.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw, MoveHorizontal } from 'lucide-react';
import { createCharacterPawnMesh, disposeAvatarGroup } from './board3d/characterAvatarBuilder';

interface Avatar3DPreviewProps {
  charId: string;
  name: string;
  color: string;
  accentColor: string;
  className?: string;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl =
      (probe.getContext('webgl2') as WebGLRenderingContext | null) ||
      (probe.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(rendererStr)) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

export const Avatar3DPreview: React.FC<Avatar3DPreviewProps> = ({
  charId,
  name,
  color,
  accentColor,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasManualRotate, setHasManualRotate] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const pawnGroupRef = useRef<THREE.Group | null>(null);
  const rimLightRef = useRef<THREE.PointLight | null>(null);
  const haloMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Estado de rotación interactiva
  const dragStateRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    manualOverride: boolean;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.45,
    pitch: 0.16,
    manualOverride: false
  });

  // Inicializar escena WebGL una sola vez
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = Math.max(container.clientWidth, 240);
    const height = Math.max(container.clientHeight, 240);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Entorno IBL PBR
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    // Cámara centrada en el busto / miniatura completa (altura ~1.35)
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 30);
    camera.position.set(0, 1.05, 2.85);
    camera.lookAt(0, 0.68, 0);

    // Iluminación de estudio de 3 puntos
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x0f172a, 0.55);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    keyLight.position.set(2.4, 3.6, 2.6);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(512, 512);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.85);
    fillLight.position.set(-2.6, 1.8, 1.4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(new THREE.Color(color), 2.4, 8);
    rimLight.position.set(-1.3, 1.8, -2.0);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Peana circular de exhibición
    const stageGroup = new THREE.Group();
    const plinthGeo = new THREE.CylinderGeometry(0.76, 0.86, 0.14, 36);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.32,
      metalness: 0.55
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.07;
    plinth.receiveShadow = true;
    stageGroup.add(plinth);

    const haloGeo = new THREE.TorusGeometry(0.77, 0.022, 12, 48);
    const haloMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8
    });
    haloMatRef.current = haloMat;
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.005;
    stageGroup.add(halo);
    scene.add(stageGroup);

    // ResizeObserver para ajustar cámara y viewport fluidamente
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 160);
        const h = Math.max(entry.contentRect.height, 160);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    ro.observe(container);

    // Pacing seguro (compatible con software GL / headless)
    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (fn: () => void) => {
      if (isSoftwareGl) {
        timerId = window.setTimeout(fn, 110);
      } else {
        rafId = window.requestAnimationFrame(fn);
      }
    };

    const animate = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const drag = dragStateRef.current;
      if (!drag.active && !drag.manualOverride && !prefersReducedMotion) {
        drag.yaw += delta * 0.55;
      }

      const activePawn = pawnGroupRef.current;
      if (activePawn) {
        activePawn.rotation.y = drag.yaw;
        activePawn.rotation.x = THREE.MathUtils.lerp(activePawn.rotation.x, drag.pitch, 0.18);
        // Entrada suave al cambiar personaje
        const s = THREE.MathUtils.lerp(activePawn.scale.x, 1.0, 0.18);
        activePawn.scale.setScalar(s);
      }

      renderer.render(scene, camera);
      afterDraw(animate);
    };

    afterDraw(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      ro.disconnect();

      if (pawnGroupRef.current) {
        disposeAvatarGroup(pawnGroupRef.current);
        pawnGroupRef.current = null;
      }

      plinthGeo.dispose();
      plinthMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Actualizar modelo 3D y paleta cuando cambia el personaje inspeccionado
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (pawnGroupRef.current) {
      disposeAvatarGroup(pawnGroupRef.current);
      pawnGroupRef.current = null;
    }

    const nextPawn = createCharacterPawnMesh(charId, color, accentColor, false, {
      includeShadowDisc: false
    });
    nextPawn.scale.setScalar(0.84);
    nextPawn.rotation.y = dragStateRef.current.yaw;
    scene.add(nextPawn);
    pawnGroupRef.current = nextPawn;

    if (rimLightRef.current) {
      rimLightRef.current.color.set(color);
    }
    if (haloMatRef.current) {
      haloMatRef.current.color.set(color);
      haloMatRef.current.emissive.set(color);
    }
  }, [charId, color, accentColor]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = true;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;
    dragStateRef.current.manualOverride = true;
    setIsDragging(true);
    setHasManualRotate(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.lastX;
    const dy = e.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;
    dragStateRef.current.yaw += dx * 0.012;
    dragStateRef.current.pitch = THREE.MathUtils.clamp(
      dragStateRef.current.pitch + dy * 0.006,
      -0.28,
      0.38
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const resetRotation = () => {
    dragStateRef.current.yaw = 0.45;
    dragStateRef.current.pitch = 0.16;
    dragStateRef.current.manualOverride = false;
    setHasManualRotate(false);
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-slate-950/90 border border-slate-800 select-none ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 42%, ${color}26 0%, rgba(2, 6, 23, 0.96) 72%)`
      }}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        aria-label={`Vista 3D interactiva de ${name}`}
      />

      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/95">
          <div
            className="w-16 h-16 rounded-full border-2 border-white/25 shadow-lg mb-2"
            style={{ backgroundColor: color }}
          />
          <p className="text-xs font-semibold text-slate-300">Avatar {name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Vista 3D no disponible en este navegador</p>
        </div>
      )}

      {/* Controles discretos en esquina superior/inferior */}
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-center justify-between text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/75 border border-slate-800/80">
          <MoveHorizontal className="w-3 h-3 text-teal-400" />
          Arrastra para rotar 360°
        </span>

        {hasManualRotate && (
          <button
            type="button"
            onClick={resetRotation}
            className="pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            title="Reanudar rotación automática"
          >
            <RotateCcw className="w-3 h-3" />
            Auto
          </button>
        )}
      </div>
    </div>
  );
};
