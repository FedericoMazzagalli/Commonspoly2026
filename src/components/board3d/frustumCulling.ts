/**
 * frustumCulling.ts
 * Sistema de Frustum Culling y LOD por distancia (cero asignaciones por frame)
 * para optimizar la tasa de refresco (FPS) del tablero 3D en dispositivos móviles antiguos.
 */

import * as THREE from 'three';

const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _cullSphere = new THREE.Sphere();

/**
 * Etiqueta un sub-objeto como detalle secundario de baja jerarquía visual
 * para ocultarlo automáticamente cuando la cámara está alejada (LOD por distancia).
 */
export function markAsSecondaryDetail(obj: THREE.Object3D): void {
  obj.userData.isSecondaryDetail = true;
}

/**
 * Asigna una esfera delimitadora explícita a una geometría dinámica (partículas, InstancedMesh, shaders)
 * para habilitar `frustumCulled = true` de forma segura sin desapariciones al rotar la cámara.
 */
export function setExplicitBoundingSphere(
  geometry: THREE.BufferGeometry,
  cx: number,
  cy: number,
  cz: number,
  radius: number
): void {
  if (!geometry.boundingSphere) {
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), radius);
  } else {
    geometry.boundingSphere.center.set(cx, cy, cz);
    geometry.boundingSphere.radius = radius;
  }
}

/**
 * Actualiza el plano de recorte (Frustum) de la cámara activa tras aplicar damping/lookAt.
 */
export function updateCameraFrustum(camera: THREE.PerspectiveCamera): void {
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_projScreenMatrix);
}

/**
 * Comprueba sin asignaciones en memoria si una esfera en espacio mundo intersecta el frustum actual.
 */
export function isWorldSphereInFrustum(
  x: number,
  y: number,
  z: number,
  radius: number
): boolean {
  _cullSphere.center.set(x, y, z);
  _cullSphere.radius = radius;
  return _frustum.intersectsSphere(_cullSphere);
}

function getCachedSecondaryDetails(group: THREE.Group): THREE.Object3D[] {
  const cached = group.userData._secondaryDetails as THREE.Object3D[] | undefined;
  if (cached) return cached;

  const list: THREE.Object3D[] = [];
  group.traverse((child) => {
    if (child !== group && child.userData.isSecondaryDetail === true) {
      list.push(child);
    }
  });
  group.userData._secondaryDetails = list;
  return list;
}

/**
 * Aplica frustum culling a nivel de grupo completo (evitando comprobar 6–10 sub-mallas fuera de cámara)
 * y desactiva micro-detalles secundarios cuando el grupo supera el umbral de distancia.
 */
export function applyGroupFrustumAndDetailLOD(
  group: THREE.Group,
  cameraPos: THREE.Vector3,
  boundingRadius: number,
  centerOffsetY: number,
  detailCullDistSq: number
): boolean {
  const inFrustum = isWorldSphereInFrustum(
    group.position.x,
    group.position.y + centerOffsetY,
    group.position.z,
    boundingRadius
  );

  if (group.visible !== inFrustum) {
    group.visible = inFrustum;
  }

  if (!inFrustum) {
    return false;
  }

  const showSecondary = cameraPos.distanceToSquared(group.position) <= detailCullDistSq;
  if (group.userData._lastShowSecondary !== showSecondary) {
    group.userData._lastShowSecondary = showSecondary;
    const details = getCachedSecondaryDetails(group);
    for (let i = 0; i < details.length; i++) {
      details[i].visible = showSecondary;
    }
  }

  return true;
}
