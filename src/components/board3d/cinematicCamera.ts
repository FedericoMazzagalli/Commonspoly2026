/**
 * cinematicCamera.ts
 * Controlador de Cámara Cinematográfica basado en GSAP para seguir suavemente
 * el recorrido nodo a nodo (casilla por casilla) de los bots sobre el tablero 3D.
 */

import gsap from 'gsap';
import * as THREE from 'three';
import { Tile } from '../../types/game';

export interface BoardNodeCoord {
  tileId: number;
  x: number;
  z: number;
}

interface CameraProxyState {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

/**
 * Resuelve la secuencia ordenada de nodos (IDs de casillas) entre origen y destino.
 */
export function resolveBoardNodePath(fromTileId: number, toTileId: number): number[] {
  if (fromTileId === toTileId) return [toTileId];

  // Entrada o salida del Ágora Central (ID 100)
  if (fromTileId === 100 || toTileId === 100) {
    return [fromTileId, toTileId];
  }

  // Movimiento estándar por el perímetro de 40 casillas (0..39)
  if (fromTileId >= 0 && fromTileId < 40 && toTileId >= 0 && toTileId < 40) {
    const forwardDelta = (toTileId - fromTileId + 40) % 40;
    // Tirada normal (1..6) o avance con rebote (hasta 8 pasos)
    if (forwardDelta >= 1 && forwardDelta <= 8) {
      const path: number[] = [fromTileId];
      for (let step = 1; step <= forwardDelta; step++) {
        path.push((fromTileId + step) % 40);
      }
      return path;
    }
  }

  // Salto especial (p. ej. envío directo al Centro de Detención o teletransporte)
  return [fromTileId, toTileId];
}

/**
 * Convierte IDs de casilla en coordenadas 3D sobre el tablero.
 */
export function mapTilePathToCoords(tileIds: number[], tiles: Tile[]): BoardNodeCoord[] {
  return tileIds.map(tileId => {
    if (tileId === 100) {
      return { tileId, x: 0, z: 0 };
    }
    const found = tiles.find(t => t.id === tileId);
    if (found) {
      return { tileId, x: found.x, z: found.z };
    }
    return { tileId, x: -10, z: 10 };
  });
}

function computeCinematicFramingForNode(
  node: BoardNodeCoord,
  isFinalNode: boolean
): { camX: number; camY: number; camZ: number; lookX: number; lookY: number; lookZ: number } {
  const dist = Math.hypot(node.x, node.z);
  const dirX = dist > 0.25 ? node.x / dist : 0;
  const dirZ = dist > 0.25 ? node.z / dist : 1;

  // Encuadre cinematográfico elevado desde el perímetro mirando hacia la casilla y el tablero
  const radialPush = isFinalNode ? 4.8 : 5.4;
  const camX = THREE.MathUtils.clamp(node.x * 0.58 + dirX * radialPush, -15.5, 15.5);
  const camZ = THREE.MathUtils.clamp(node.z * 0.58 + dirZ * radialPush + 3.6, -13.5, 19.5);
  const camY = isFinalNode ? 11.8 : 13.4;

  return {
    camX,
    camY,
    camZ,
    lookX: node.x * 0.86,
    lookY: 0.45,
    lookZ: node.z * 0.86
  };
}

export class CinematicCameraController {
  private timeline: gsap.core.Timeline | null = null;
  private active = false;
  private proxy: CameraProxyState = {
    camX: 0,
    camY: 22,
    camZ: 21,
    lookX: 0,
    lookY: 0,
    lookZ: 0
  };

  public isActive(): boolean {
    return this.active;
  }

  /**
   * Inicia una secuencia GSAP que interpola suavemente entre los nodos del tablero
   * recorridos por el bot durante su turno.
   */
  public followBotNodes(
    nodes: BoardNodeCoord[],
    currentCamPos: THREE.Vector3,
    currentLookAt: THREE.Vector3,
    returnCamPos: THREE.Vector3,
    returnLookAt: THREE.Vector3
  ): void {
    if (nodes.length === 0) return;

    this.cancel();

    this.proxy.camX = currentCamPos.x;
    this.proxy.camY = currentCamPos.y;
    this.proxy.camZ = currentCamPos.z;
    this.proxy.lookX = currentLookAt.x;
    this.proxy.lookY = currentLookAt.y;
    this.proxy.lookZ = currentLookAt.z;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tl = gsap.timeline({
      onComplete: () => {
        this.active = false;
        this.timeline = null;
      }
    });

    this.timeline = tl;
    this.active = true;

    const waypoints = nodes.length > 1 ? nodes.slice(1) : nodes;

    if (prefersReducedMotion) {
      const finalNode = waypoints[waypoints.length - 1];
      const framing = computeCinematicFramingForNode(finalNode, true);
      tl.to(this.proxy, {
        ...framing,
        duration: 0.45,
        ease: 'power2.out'
      }).to(this.proxy, {
        camX: returnCamPos.x,
        camY: returnCamPos.y,
        camZ: returnCamPos.z,
        lookX: returnLookAt.x,
        lookY: returnLookAt.y,
        lookZ: returnLookAt.z,
        duration: 0.45,
        delay: 0.25,
        ease: 'power2.inOut'
      });
      return;
    }

    // Interpolación continua nodo a nodo a lo largo de la trayectoria del bot
    const stepDuration = waypoints.length > 3 ? 0.16 : 0.22;

    waypoints.forEach((node, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === waypoints.length - 1;
      const framing = computeCinematicFramingForNode(node, isLast);

      tl.to(this.proxy, {
        ...framing,
        duration: isLast ? 0.34 : isFirst ? 0.26 : stepDuration,
        ease: isLast ? 'power2.out' : isFirst ? 'power1.in' : 'none'
      });
    });

    // Breve pausa dramática en la casilla destino y retorno suave hacia la cámara base
    tl.to(this.proxy, {
      camX: returnCamPos.x,
      camY: returnCamPos.y,
      camZ: returnCamPos.z,
      lookX: returnLookAt.x,
      lookY: returnLookAt.y,
      lookZ: returnLookAt.z,
      duration: 0.55,
      delay: 0.36,
      ease: 'power2.inOut'
    });
  }

  public applyToCamera(
    camera: THREE.PerspectiveCamera,
    currentLookAtOut: THREE.Vector3
  ): void {
    if (!this.active) return;
    camera.position.set(this.proxy.camX, this.proxy.camY, this.proxy.camZ);
    currentLookAtOut.set(this.proxy.lookX, this.proxy.lookY, this.proxy.lookZ);
    camera.lookAt(currentLookAtOut);
  }

  public cancel(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.active = false;
  }

  public dispose(): void {
    this.cancel();
  }
}
