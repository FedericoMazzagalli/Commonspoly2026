/**
 * performanceTelemetry.ts
 * Tipos y utilidades seguras para auditar FPS, latencia de frame, uso de memoria JS
 * y métricas WebGL del tablero 3D en dispositivos móviles y de escritorio.
 */

export interface BoardPerformanceTelemetry {
  fps: number;
  frameTimeMs: number;
  maxFrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  culledObjects: number;
  totalCullableObjects: number;
  pixelRatio: number;
  isSoftwareGl: boolean;
  updatedAt: number;
}

export interface MemorySnapshot {
  supported: boolean;
  usedJSHeapMB: number | null;
  totalJSHeapMB: number | null;
  jsHeapLimitMB: number | null;
  heapUsagePct: number | null;
  deviceMemoryGB: number | null;
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export function createInitialBoardTelemetry(): BoardPerformanceTelemetry {
  return {
    fps: 0,
    frameTimeMs: 0,
    maxFrameTimeMs: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    culledObjects: 0,
    totalCullableObjects: 0,
    pixelRatio: 1,
    isSoftwareGl: false,
    updatedAt: 0
  };
}

export function readBrowserMemorySnapshot(): MemorySnapshot {
  const perf = typeof performance !== 'undefined' ? (performance as PerformanceWithMemory) : undefined;
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithDeviceMemory) : undefined;
  const deviceMemoryGB =
    nav && typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)
      ? nav.deviceMemory
      : null;

  if (perf?.memory && perf.memory.jsHeapSizeLimit > 0) {
    const usedJSHeapMB = Math.round((perf.memory.usedJSHeapSize / 1048576) * 10) / 10;
    const totalJSHeapMB = Math.round((perf.memory.totalJSHeapSize / 1048576) * 10) / 10;
    const jsHeapLimitMB = Math.round(perf.memory.jsHeapSizeLimit / 1048576);
    const heapUsagePct = Math.min(
      100,
      Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 1000) / 10
    );

    return {
      supported: true,
      usedJSHeapMB,
      totalJSHeapMB,
      jsHeapLimitMB,
      heapUsagePct,
      deviceMemoryGB
    };
  }

  return {
    supported: false,
    usedJSHeapMB: null,
    totalJSHeapMB: null,
    jsHeapLimitMB: null,
    heapUsagePct: null,
    deviceMemoryGB
  };
}
