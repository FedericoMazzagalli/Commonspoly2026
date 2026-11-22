/**
 * accessibility.ts
 * Sistema unificado de Accesibilidad y Modos Daltónicos (Protanopia, Deuteranopia,
 * Tritanopia y Alto Contraste) sincronizado entre el HUD 2D, las formas simbólicas
 * y los materiales/mapas de calor/trayectorias del tablero 3D.
 */

import { BoardDangerZoneTier, GoodState, GoodType } from '../types/game';

export type ColorVisionMode =
  | 'STANDARD'
  | 'PROTANOPIA'
  | 'DEUTERANOPIA'
  | 'TRITANOPIA'
  | 'HIGH_CONTRAST';

export type HudTextScale = 'NORMAL' | 'LARGE';

export interface AccessibilitySettings {
  colorVisionMode: ColorVisionMode;
  hudTextScale: HudTextScale;
  showSymbolicShapes: boolean;
  reducedMotionOverride: boolean;
}

export const ACCESSIBILITY_STORAGE_KEY = 'commonspoly_accessibility_v1';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  colorVisionMode: 'STANDARD',
  hudTextScale: 'NORMAL',
  showSymbolicShapes: false,
  reducedMotionOverride: false
};

export interface HeatmapTierVisual {
  label: string;
  shape: string;
  hex: number;
  ringHex: number;
  cssHex: string;
  swatchClass: string;
  textClass: string;
}

export interface TrajectoryPaletteItem {
  hex: number;
  css: string;
  shape: string;
}

export interface AccessibilityPalette {
  mode: ColorVisionMode;
  label: string;
  shortLabel: string;
  description: string;
  tileGoodHex: Record<GoodType, number> & {
    INALIENABLE: number;
    SPECIAL: number;
    SITUATION: number;
    CORNER: number;
    AGORA_ENTRY: number;
    AGORA_CENTER: number;
  };
  tileStateShapes: Record<GoodState, string>;
  tileStateLabels: Record<GoodState, string>;
  tileStateBadgeCss: Record<GoodState, string>;
  tileStateAccentHex: Record<GoodState, number>;
  heatmapTiers: Record<Exclude<BoardDangerZoneTier, 'NONE'>, HeatmapTierVisual>;
  trajectoryColors: TrajectoryPaletteItem[];
}

export const COLOR_VISION_OPTIONS: Array<{
  mode: ColorVisionMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    mode: 'STANDARD',
    label: 'Estándar',
    shortLabel: 'Estándar',
    description: 'Paleta verde, azul y rosa original de Commonspoly Edición Verde.'
  },
  {
    mode: 'PROTANOPIA',
    label: 'Protanopía',
    shortLabel: 'Protan.',
    description: 'Optimizada para déficit de conos rojos (azul cobalto, ámbar oro y cian).'
  },
  {
    mode: 'DEUTERANOPIA',
    label: 'Deuteranopía',
    shortLabel: 'Deuteran.',
    description: 'Optimizada para déficit rojo-verde (Okabe-Ito: azul, naranja y magenta).'
  },
  {
    mode: 'TRITANOPIA',
    label: 'Tritanopía',
    shortLabel: 'Tritan.',
    description: 'Optimizada para déficit azul-amarillo (turquesa, carmesí y blanco hueso).'
  },
  {
    mode: 'HIGH_CONTRAST',
    label: 'Alto Contraste',
    shortLabel: 'Contraste+',
    description: 'Contraste máximo luminoso con bordes reforzados y diferenciación simbólica.'
  }
];

const PALETTES: Record<ColorVisionMode, AccessibilityPalette> = {
  STANDARD: {
    mode: 'STANDARD',
    label: 'Estándar',
    shortLabel: 'Estándar',
    description: 'Paleta original Commonspoly Edición Verde.',
    tileGoodHex: {
      HEALTH: 0x9333ea,
      URBAN: 0xea580c,
      KNOWLEDGE: 0xeab308,
      ENVIRONMENT: 0x16a34a,
      INALIENABLE: 0xec4899,
      SPECIAL: 0x334155,
      SITUATION: 0x0284c7,
      CORNER: 0x1e293b,
      AGORA_ENTRY: 0x0d9488,
      AGORA_CENTER: 0xd946ef
    },
    tileStateShapes: {
      COMMON: '★',
      PUBLIC: '▲',
      PRIVATE: '■'
    },
    tileStateLabels: {
      COMMON: 'Común',
      PUBLIC: 'Público',
      PRIVATE: 'Privado'
    },
    tileStateBadgeCss: {
      COMMON: '#10b981',
      PUBLIC: '#38bdf8',
      PRIVATE: '#f43f5e'
    },
    tileStateAccentHex: {
      COMMON: 0x10b981,
      PUBLIC: 0x38bdf8,
      PRIVATE: 0xf43f5e
    },
    heatmapTiers: {
      CRITICAL: {
        label: 'Crítico',
        shape: '◆',
        hex: 0xef4444,
        ringHex: 0xfca5a5,
        cssHex: '#ef4444',
        swatchClass: 'bg-rose-500',
        textClass: 'text-rose-300'
      },
      HIGH: {
        label: 'Alto',
        shape: '▲',
        hex: 0xf97316,
        ringHex: 0xfdba74,
        cssHex: '#f97316',
        swatchClass: 'bg-orange-500',
        textClass: 'text-orange-300'
      },
      MODERATE: {
        label: 'Moderado',
        shape: '●',
        hex: 0xf59e0b,
        ringHex: 0xfde68a,
        cssHex: '#f59e0b',
        swatchClass: 'bg-amber-400',
        textClass: 'text-amber-300'
      },
      PROTECTED: {
        label: 'Protegida',
        shape: '■',
        hex: 0x10b981,
        ringHex: 0x34d399,
        cssHex: '#10b981',
        swatchClass: 'bg-emerald-500',
        textClass: 'text-emerald-300'
      }
    },
    trajectoryColors: [
      { hex: 0xf43f5e, css: '#f43f5e', shape: '◆' },
      { hex: 0xf97316, css: '#f97316', shape: '▲' },
      { hex: 0xa855f7, css: '#a855f7', shape: '■' },
      { hex: 0x06b6d4, css: '#06b6d4', shape: '●' },
      { hex: 0xeab308, css: '#eab308', shape: '★' },
      { hex: 0xec4899, css: '#ec4899', shape: '✦' }
    ]
  },

  PROTANOPIA: {
    mode: 'PROTANOPIA',
    label: 'Protanopía',
    shortLabel: 'Protan.',
    description: 'Paleta segura azul-ámbar-cian sin ambigüedad rojo/verde.',
    tileGoodHex: {
      HEALTH: 0x3b82f6,
      URBAN: 0xf59e0b,
      KNOWLEDGE: 0xfde047,
      ENVIRONMENT: 0x06b6d4,
      INALIENABLE: 0x818cf8,
      SPECIAL: 0x334155,
      SITUATION: 0x0284c7,
      CORNER: 0x1e293b,
      AGORA_ENTRY: 0x2dd4bf,
      AGORA_CENTER: 0x60a5fa
    },
    tileStateShapes: {
      COMMON: '★',
      PUBLIC: '▲',
      PRIVATE: '■'
    },
    tileStateLabels: {
      COMMON: 'Común',
      PUBLIC: 'Público',
      PRIVATE: 'Privado'
    },
    tileStateBadgeCss: {
      COMMON: '#06b6d4',
      PUBLIC: '#60a5fa',
      PRIVATE: '#f59e0b'
    },
    tileStateAccentHex: {
      COMMON: 0x06b6d4,
      PUBLIC: 0x60a5fa,
      PRIVATE: 0xf59e0b
    },
    heatmapTiers: {
      CRITICAL: {
        label: 'Crítico',
        shape: '◆',
        hex: 0xf59e0b,
        ringHex: 0xfef08a,
        cssHex: '#f59e0b',
        swatchClass: 'bg-amber-500',
        textClass: 'text-amber-300'
      },
      HIGH: {
        label: 'Alto',
        shape: '▲',
        hex: 0xeab308,
        ringHex: 0xfef9c3,
        cssHex: '#eab308',
        swatchClass: 'bg-yellow-500',
        textClass: 'text-yellow-200'
      },
      MODERATE: {
        label: 'Moderado',
        shape: '●',
        hex: 0x93c5fd,
        ringHex: 0xdbeafe,
        cssHex: '#93c5fd',
        swatchClass: 'bg-blue-300',
        textClass: 'text-blue-200'
      },
      PROTECTED: {
        label: 'Protegida',
        shape: '■',
        hex: 0x06b6d4,
        ringHex: 0x67e8f9,
        cssHex: '#06b6d4',
        swatchClass: 'bg-cyan-500',
        textClass: 'text-cyan-300'
      }
    },
    trajectoryColors: [
      { hex: 0xf59e0b, css: '#f59e0b', shape: '◆' },
      { hex: 0x3b82f6, css: '#3b82f6', shape: '▲' },
      { hex: 0xfde047, css: '#fde047', shape: '■' },
      { hex: 0x06b6d4, css: '#06b6d4', shape: '●' },
      { hex: 0xa5b4fc, css: '#a5b4fc', shape: '★' },
      { hex: 0xf8fafc, css: '#f8fafc', shape: '✦' }
    ]
  },

  DEUTERANOPIA: {
    mode: 'DEUTERANOPIA',
    label: 'Deuteranopía',
    shortLabel: 'Deuteran.',
    description: 'Paleta Okabe-Ito azul, naranja intenso y magenta.',
    tileGoodHex: {
      HEALTH: 0x6366f1,
      URBAN: 0xd97706,
      KNOWLEDGE: 0xfacc15,
      ENVIRONMENT: 0x0ea5e9,
      INALIENABLE: 0xc084fc,
      SPECIAL: 0x334155,
      SITUATION: 0x0369a1,
      CORNER: 0x1e293b,
      AGORA_ENTRY: 0x38bdf8,
      AGORA_CENTER: 0xa855f7
    },
    tileStateShapes: {
      COMMON: '★',
      PUBLIC: '▲',
      PRIVATE: '■'
    },
    tileStateLabels: {
      COMMON: 'Común',
      PUBLIC: 'Público',
      PRIVATE: 'Privado'
    },
    tileStateBadgeCss: {
      COMMON: '#38bdf8',
      PUBLIC: '#a78bfa',
      PRIVATE: '#f97316'
    },
    tileStateAccentHex: {
      COMMON: 0x38bdf8,
      PUBLIC: 0xa78bfa,
      PRIVATE: 0xf97316
    },
    heatmapTiers: {
      CRITICAL: {
        label: 'Crítico',
        shape: '◆',
        hex: 0xd97706,
        ringHex: 0xfde68a,
        cssHex: '#d97706',
        swatchClass: 'bg-amber-600',
        textClass: 'text-amber-300'
      },
      HIGH: {
        label: 'Alto',
        shape: '▲',
        hex: 0xf59e0b,
        ringHex: 0xfef08a,
        cssHex: '#f59e0b',
        swatchClass: 'bg-amber-400',
        textClass: 'text-amber-200'
      },
      MODERATE: {
        label: 'Moderado',
        shape: '●',
        hex: 0xa78bfa,
        ringHex: 0xddd6fe,
        cssHex: '#a78bfa',
        swatchClass: 'bg-violet-400',
        textClass: 'text-violet-200'
      },
      PROTECTED: {
        label: 'Protegida',
        shape: '■',
        hex: 0x0ea5e9,
        ringHex: 0x7dd3fc,
        cssHex: '#0ea5e9',
        swatchClass: 'bg-sky-500',
        textClass: 'text-sky-300'
      }
    },
    trajectoryColors: [
      { hex: 0xe69f00, css: '#e69f00', shape: '◆' },
      { hex: 0x56b4e9, css: '#56b4e9', shape: '▲' },
      { hex: 0xcc79a7, css: '#cc79a7', shape: '■' },
      { hex: 0x0072b2, css: '#0072b2', shape: '●' },
      { hex: 0xf0e442, css: '#f0e442', shape: '★' },
      { hex: 0xd55e00, css: '#d55e00', shape: '✦' }
    ]
  },

  TRITANOPIA: {
    mode: 'TRITANOPIA',
    label: 'Tritanopía',
    shortLabel: 'Tritan.',
    description: 'Paleta carmesí-turquesa-hueso para déficit azul/amarillo.',
    tileGoodHex: {
      HEALTH: 0xe11d48,
      URBAN: 0xfb7185,
      KNOWLEDGE: 0xf1f5f9,
      ENVIRONMENT: 0x0d9488,
      INALIENABLE: 0xf43f5e,
      SPECIAL: 0x334155,
      SITUATION: 0x0f766e,
      CORNER: 0x1e293b,
      AGORA_ENTRY: 0x14b8a6,
      AGORA_CENTER: 0xf43f5e
    },
    tileStateShapes: {
      COMMON: '★',
      PUBLIC: '▲',
      PRIVATE: '■'
    },
    tileStateLabels: {
      COMMON: 'Común',
      PUBLIC: 'Público',
      PRIVATE: 'Privado'
    },
    tileStateBadgeCss: {
      COMMON: '#14b8a6',
      PUBLIC: '#f8fafc',
      PRIVATE: '#f43f5e'
    },
    tileStateAccentHex: {
      COMMON: 0x14b8a6,
      PUBLIC: 0xf8fafc,
      PRIVATE: 0xf43f5e
    },
    heatmapTiers: {
      CRITICAL: {
        label: 'Crítico',
        shape: '◆',
        hex: 0xe11d48,
        ringHex: 0xfecdd3,
        cssHex: '#e11d48',
        swatchClass: 'bg-rose-600',
        textClass: 'text-rose-300'
      },
      HIGH: {
        label: 'Alto',
        shape: '▲',
        hex: 0xfb7185,
        ringHex: 0xffe4e6,
        cssHex: '#fb7185',
        swatchClass: 'bg-rose-400',
        textClass: 'text-rose-200'
      },
      MODERATE: {
        label: 'Moderado',
        shape: '●',
        hex: 0xe2e8f0,
        ringHex: 0xffffff,
        cssHex: '#e2e8f0',
        swatchClass: 'bg-slate-200',
        textClass: 'text-slate-200'
      },
      PROTECTED: {
        label: 'Protegida',
        shape: '■',
        hex: 0x14b8a6,
        ringHex: 0x5eead4,
        cssHex: '#14b8a6',
        swatchClass: 'bg-teal-500',
        textClass: 'text-teal-300'
      }
    },
    trajectoryColors: [
      { hex: 0xe11d48, css: '#e11d48', shape: '◆' },
      { hex: 0x14b8a6, css: '#14b8a6', shape: '▲' },
      { hex: 0xf1f5f9, css: '#f1f5f9', shape: '■' },
      { hex: 0xfb7185, css: '#fb7185', shape: '●' },
      { hex: 0x2dd4bf, css: '#2dd4bf', shape: '★' },
      { hex: 0x94a3b8, css: '#94a3b8', shape: '✦' }
    ]
  },

  HIGH_CONTRAST: {
    mode: 'HIGH_CONTRAST',
    label: 'Alto Contraste',
    shortLabel: 'Contraste+',
    description: 'Luminancia máxima y contraste extremo sobre fondo oscuro.',
    tileGoodHex: {
      HEALTH: 0xd946ef,
      URBAN: 0xff6b00,
      KNOWLEDGE: 0xffff00,
      ENVIRONMENT: 0x00ff88,
      INALIENABLE: 0xff44cc,
      SPECIAL: 0x475569,
      SITUATION: 0x00d9ff,
      CORNER: 0x0f172a,
      AGORA_ENTRY: 0x00ffcc,
      AGORA_CENTER: 0xffffff
    },
    tileStateShapes: {
      COMMON: '★',
      PUBLIC: '▲',
      PRIVATE: '■'
    },
    tileStateLabels: {
      COMMON: 'Común',
      PUBLIC: 'Público',
      PRIVATE: 'Privado'
    },
    tileStateBadgeCss: {
      COMMON: '#00ff88',
      PUBLIC: '#00d9ff',
      PRIVATE: '#ff3366'
    },
    tileStateAccentHex: {
      COMMON: 0x00ff88,
      PUBLIC: 0x00d9ff,
      PRIVATE: 0xff3366
    },
    heatmapTiers: {
      CRITICAL: {
        label: 'Crítico',
        shape: '◆',
        hex: 0xff2a55,
        ringHex: 0xffffff,
        cssHex: '#ff2a55',
        swatchClass: 'bg-rose-500',
        textClass: 'text-white'
      },
      HIGH: {
        label: 'Alto',
        shape: '▲',
        hex: 0xffff00,
        ringHex: 0xffffff,
        cssHex: '#ffff00',
        swatchClass: 'bg-yellow-300',
        textClass: 'text-yellow-200'
      },
      MODERATE: {
        label: 'Moderado',
        shape: '●',
        hex: 0x00d9ff,
        ringHex: 0xffffff,
        cssHex: '#00d9ff',
        swatchClass: 'bg-cyan-400',
        textClass: 'text-cyan-200'
      },
      PROTECTED: {
        label: 'Protegida',
        shape: '■',
        hex: 0x00ff88,
        ringHex: 0xffffff,
        cssHex: '#00ff88',
        swatchClass: 'bg-emerald-400',
        textClass: 'text-emerald-200'
      }
    },
    trajectoryColors: [
      { hex: 0xffff00, css: '#ffff00', shape: '◆' },
      { hex: 0x00d9ff, css: '#00d9ff', shape: '▲' },
      { hex: 0xff2a55, css: '#ff2a55', shape: '■' },
      { hex: 0x00ff88, css: '#00ff88', shape: '●' },
      { hex: 0xffffff, css: '#ffffff', shape: '★' },
      { hex: 0xff77ff, css: '#ff77ff', shape: '✦' }
    ]
  }
};

export function getAccessibilityPalette(mode: ColorVisionMode): AccessibilityPalette {
  return PALETTES[mode] ?? PALETTES.STANDARD;
}

export function loadAccessibilitySettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESSIBILITY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    const validModes: ColorVisionMode[] = [
      'STANDARD',
      'PROTANOPIA',
      'DEUTERANOPIA',
      'TRITANOPIA',
      'HIGH_CONTRAST'
    ];
    return {
      colorVisionMode: validModes.includes(parsed.colorVisionMode as ColorVisionMode)
        ? (parsed.colorVisionMode as ColorVisionMode)
        : 'STANDARD',
      hudTextScale: parsed.hudTextScale === 'LARGE' ? 'LARGE' : 'NORMAL',
      showSymbolicShapes: Boolean(parsed.showSymbolicShapes),
      reducedMotionOverride: Boolean(parsed.reducedMotionOverride)
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  try {
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignorar errores de cuota
  }
}

export function applyAccessibilityDocumentAttributes(settings: AccessibilitySettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-color-vision', settings.colorVisionMode.toLowerCase());
  root.setAttribute('data-hud-scale', settings.hudTextScale.toLowerCase());
  root.setAttribute('data-reduced-motion', settings.reducedMotionOverride ? 'true' : 'false');
}
