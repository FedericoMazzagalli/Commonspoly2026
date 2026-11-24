/**
 * useResponsiveViewport.ts
 * Hook reactivo para adaptar el HUD y los paneles según tamaño de pantalla
 * y orientación (móvil, tablet vertical, tablet horizontal y escritorio).
 */

import { useEffect, useState } from 'react';

export type ViewportMode =
  | 'mobile'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop';

export interface ResponsiveViewportState {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  mode: ViewportMode;
  isMobile: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isDesktop: boolean;
  /** True en móvil (< 640px) y tablet vertical (640–1023px portrait), donde se usa dock + hojas deslizables */
  isCompactSheetLayout: boolean;
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

export function resolveViewportMode(width: number, height: number): ViewportMode {
  if (width < 640) {
    return 'mobile';
  }
  const isPortrait = height >= width;
  if (width < 1024 && isPortrait) {
    return 'tablet-portrait';
  }
  if (width < 1280 && !isPortrait) {
    return 'tablet-landscape';
  }
  return 'desktop';
}

export function useResponsiveViewport(): ResponsiveViewportState {
  const [size, setSize] = useState<{ width: number; height: number }>(readViewportSize);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const next = readViewportSize();
      setSize(prev =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const mode = resolveViewportMode(size.width, size.height);
  const orientation = size.width > size.height ? 'landscape' : 'portrait';

  return {
    width: size.width,
    height: size.height,
    orientation,
    mode,
    isMobile: mode === 'mobile',
    isTabletPortrait: mode === 'tablet-portrait',
    isTabletLandscape: mode === 'tablet-landscape',
    isDesktop: mode === 'desktop',
    isCompactSheetLayout: mode === 'mobile' || mode === 'tablet-portrait'
  };
}
