/**
 * AccessibilityModal.tsx
 * Modal de Accesibilidad y Modos Daltónicos (Protanopía, Deuteranopía, Tritanopía,
 * Alto Contraste), marcadores simbólicos por forma, tamaño tipográfico HUD y reducción de movimiento.
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Accessibility,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Contrast,
  Eye,
  Globe,
  RotateCcw,
  Sparkles,
  Type,
  X
} from 'lucide-react';
import {
  AccessibilitySettings,
  COLOR_VISION_OPTIONS,
  ColorVisionMode,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  getAccessibilityPalette
} from '../../utils/accessibility';
import { playSound } from '../../utils/audio';
import { useI18n } from '../../i18n';
import { LanguageSelector } from '../hud/LanguageSelector';
import { ModalFrame } from '../ui/MotionPrimitives';

interface AccessibilityModalProps {
  isOpen: boolean;
  settings: AccessibilitySettings;
  onUpdateSettings: (next: AccessibilitySettings) => void;
  onClose: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose
}) => {
  const { t, languageMeta } = useI18n();
  const [showVisualGuide, setShowVisualGuide] = useState(true);

  const activePalette = getAccessibilityPalette(settings.colorVisionMode);
  const standardPalette = getAccessibilityPalette('STANDARD');
  const comparisonPalette =
    settings.colorVisionMode === 'STANDARD'
      ? getAccessibilityPalette('HIGH_CONTRAST')
      : activePalette;

  const getModeText = (mode: ColorVisionMode) => {
    switch (mode) {
      case 'PROTANOPIA':
        return { label: t.accessibility.modeProtanopia, desc: t.accessibility.modeProtanopiaDesc };
      case 'DEUTERANOPIA':
        return { label: t.accessibility.modeDeuteranopia, desc: t.accessibility.modeDeuteranopiaDesc };
      case 'TRITANOPIA':
        return { label: t.accessibility.modeTritanopia, desc: t.accessibility.modeTritanopiaDesc };
      case 'HIGH_CONTRAST':
        return { label: t.accessibility.modeHighContrast, desc: t.accessibility.modeHighContrastDesc };
      default:
        return { label: t.accessibility.modeStandard, desc: t.accessibility.modeStandardDesc };
    }
  };
  const activeModeLabel = getModeText(settings.colorVisionMode).label;

  const handleSelectVisionMode = (mode: ColorVisionMode) => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      colorVisionMode: mode
    });
  };

  const handleToggleShapes = () => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      showSymbolicShapes: !settings.showSymbolicShapes
    });
  };

  const handleToggleTextScale = () => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      hudTextScale: settings.hudTextScale === 'LARGE' ? 'NORMAL' : 'LARGE'
    });
  };

  const handleToggleReducedMotion = () => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      reducedMotionOverride: !settings.reducedMotionOverride
    });
  };

  const handleReset = () => {
    playSound.uiClick();
    onUpdateSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
  };

  const handleApplyHighContrastKit = () => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      colorVisionMode: 'HIGH_CONTRAST',
      showSymbolicShapes: true,
      hudTextScale: 'LARGE'
    });
  };

  const handleApplyColorblindKit = () => {
    playSound.uiClick();
    onUpdateSettings({
      ...settings,
      colorVisionMode:
        settings.colorVisionMode === 'PROTANOPIA' ||
        settings.colorVisionMode === 'DEUTERANOPIA' ||
        settings.colorVisionMode === 'TRITANOPIA'
          ? settings.colorVisionMode
          : 'DEUTERANOPIA',
      showSymbolicShapes: true
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalFrame
          ariaLabel={t.accessibility.title}
          backdropClassName="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 overflow-y-auto pointer-events-auto"
          className="w-full max-w-2xl bg-slate-900 border border-teal-500/50 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto space-y-5"
          onBackdropClick={onClose}
        >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h2 className="hud-heading text-lg font-extrabold text-white tracking-tight">
                {t.accessibility.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.accessibility.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label={t.common.close}
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Idioma (17 idiomas) */}
        <section className="space-y-2.5 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.accessibility.languageSection}</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-300">
              {t.accessibility.activeLabel}: {languageMeta.nativeName} ({languageMeta.shortCode})
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {t.accessibility.languageSectionDesc}
          </p>
          <LanguageSelector variant="inlineGrid" />
        </section>

        {/* Modos de Visión Cromática */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-teal-400" />
              <span>{t.accessibility.paletteSection}</span>
            </h3>
            <span className="text-[11px] font-semibold text-teal-300">
              {t.accessibility.activeLabel}: {activeModeLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {COLOR_VISION_OPTIONS.map(option => {
              const pal = getAccessibilityPalette(option.mode);
              const isSelected = settings.colorVisionMode === option.mode;
              const modeText = getModeText(option.mode);
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => handleSelectVisionMode(option.mode)}
                  aria-pressed={isSelected}
                  className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 min-h-[76px] ${
                    isSelected
                      ? 'bg-teal-950/50 border-teal-400 ring-1 ring-teal-400/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-300 shrink-0" />}
                      <span>{modeText.label}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                      <span
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: pal.tileStateBadgeCss.COMMON }}
                        title={t.common.common}
                      />
                      <span
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: pal.tileStateBadgeCss.PUBLIC }}
                        title={t.common.public}
                      />
                      <span
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: pal.tileStateBadgeCss.PRIVATE }}
                        title={t.common.private}
                      />
                      <span
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: pal.heatmapTiers.CRITICAL.cssHex }}
                        title={t.debug.critical}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {modeText.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Guía Visual Interactiva: Modos Daltónicos y Alto Contraste */}
        <section
          aria-label={t.accessibility.guideTitle ?? 'Guía Visual: Modos Daltónicos y Alto Contraste'}
          className="bg-slate-950/90 border border-teal-500/40 rounded-xl p-3.5 space-y-3"
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0 mt-0.5">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-white">
                  {t.accessibility.guideTitle ?? 'Guía Visual: Modos Daltónicos y Alto Contraste'}
                </h3>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t.accessibility.guideSubtitle ??
                    'Configura en 3 pasos una experiencia visual sin ambigüedades sobre el tablero 3D y el HUD.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleApplyHighContrastKit}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                <Contrast className="w-3 h-3" />
                <span>{t.accessibility.guidePresetContrast ?? 'Kit Alto Contraste'}</span>
              </button>
              <button
                type="button"
                onClick={handleApplyColorblindKit}
                className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3 h-3" />
                <span>{t.accessibility.guidePresetColorblind ?? 'Kit Daltónico + Formas'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVisualGuide(prev => !prev)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
                title={
                  showVisualGuide
                    ? t.accessibility.guideToggleHide ?? 'Ocultar guía'
                    : t.accessibility.guideToggleShow ?? 'Ver guía'
                }
                aria-expanded={showVisualGuide}
              >
                {showVisualGuide ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showVisualGuide && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              {/* Paso 1: Comparativa visual Estándar vs Modo Activo / Alto Contraste */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 space-y-2.5">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-teal-300">
                    {t.accessibility.guideStep1Title ?? '1. Adapta la Paleta Cromática'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {t.accessibility.guideStep1Body ??
                      'Sustituye los pares de color problemáticos tanto en casillas 3D como en el mapa de calor de especuladores.'}
                  </p>
                </div>

                {/* Diagrama comparativo lado a lado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      title: t.accessibility.guideCompareStandard ?? 'Estándar',
                      pal: standardPalette,
                      showShapes: false
                    },
                    {
                      title: `${
                        settings.colorVisionMode === 'STANDARD'
                          ? t.accessibility.modeHighContrast
                          : activeModeLabel
                      } (${t.accessibility.guideCompareActive ?? 'Vista Activa'})`,
                      pal: comparisonPalette,
                      showShapes: true
                    }
                  ].map(col => (
                    <div
                      key={col.title}
                      className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 space-y-2"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {col.title}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          {
                            label: t.accessibility.tileCommon,
                            color: col.pal.tileStateBadgeCss.COMMON,
                            shape: col.pal.tileStateShapes.COMMON
                          },
                          {
                            label: t.accessibility.tilePublic,
                            color: col.pal.tileStateBadgeCss.PUBLIC,
                            shape: col.pal.tileStateShapes.PUBLIC
                          },
                          {
                            label: t.accessibility.tilePrivate,
                            color: col.pal.tileStateBadgeCss.PRIVATE,
                            shape: col.pal.tileStateShapes.PRIVATE
                          },
                          {
                            label: t.debug.critical,
                            color: col.pal.heatmapTiers.CRITICAL.cssHex,
                            shape: col.pal.heatmapTiers.CRITICAL.shape
                          }
                        ].map(item => (
                          <div
                            key={item.label}
                            className="rounded-md bg-slate-900 border px-1.5 py-1.5 flex flex-col items-center gap-1 text-center"
                            style={{ borderColor: item.color }}
                          >
                            <span
                              className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-black text-slate-950"
                              style={{ backgroundColor: item.color }}
                            >
                              {col.showShapes ? item.shape : ''}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-200 truncate w-full">
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Referencia rápida por perfil visual */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-slate-300">
                  <li className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    {t.accessibility.guideTipProtanopia ??
                      'Protanopía: reemplaza rojo/verde por Azul Cobalto, Cian y Ámbar.'}
                  </li>
                  <li className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    {t.accessibility.guideTipDeuteranopia ??
                      'Deuteranopía: paleta Okabe-Ito en Azul profundo, Naranja y Magenta.'}
                  </li>
                  <li className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    {t.accessibility.guideTipTritanopia ??
                      'Tritanopía: separa azul/amarillo con Turquesa, Carmesí y Blanco Hueso.'}
                  </li>
                  <li className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    {t.accessibility.guideTipHighContrast ??
                      'Alto Contraste: luminancia máxima (#00ff88, #00d9ff, #ff3366) y bordes marcados.'}
                  </li>
                </ul>
              </div>

              {/* Pasos 2 y 3 en paralelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-emerald-300">
                      {t.accessibility.guideStep2Title ?? '2. Refuerza con Formas Simbólicas'}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {t.accessibility.guideStep2Body ??
                        'Combina cada estado con un símbolo geométrico (★ Común, ▲ Público, ■ Privado, ◆ Crítico) para no depender solo del color.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                      <span style={{ color: activePalette.tileStateBadgeCss.COMMON }}>★</span>
                      <span style={{ color: activePalette.tileStateBadgeCss.PUBLIC }}>▲</span>
                      <span style={{ color: activePalette.tileStateBadgeCss.PRIVATE }}>■</span>
                      <span style={{ color: activePalette.heatmapTiers.CRITICAL.cssHex }}>◆</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleShapes}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        settings.showSymbolicShapes
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      {settings.showSymbolicShapes
                        ? t.accessibility.guideShapesActive ?? 'Formas Activas'
                        : t.accessibility.guideEnableShapes ?? 'Activar Formas ★▲■◆'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-sky-300">
                      {t.accessibility.guideStep3Title ?? '3. Escala de Lectura y Movimiento'}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {t.accessibility.guideStep3Body ??
                        'Amplía la tipografía del HUD al 115% y activa Reducir Movimiento para suprimir destellos climáticos.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                        100%
                      </span>
                      <span aria-hidden="true">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-700 text-sky-200 font-bold">
                        115%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleTextScale}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        settings.hudTextScale === 'LARGE'
                          ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      {settings.hudTextScale === 'LARGE'
                        ? t.accessibility.guideLargeTextActive ?? 'Texto 115% Activo'
                        : t.accessibility.guideEnableLargeText ?? 'Activar Texto 115%'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Vista previa de señales */}
        <section className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-300">
            {t.accessibility.previewTitle} ({activeModeLabel})
          </div>
          <div className="flex items-center flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: activePalette.tileStateBadgeCss.COMMON }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: activePalette.tileStateBadgeCss.COMMON }} />
              {settings.showSymbolicShapes ? `${activePalette.tileStateShapes.COMMON} ` : ''}{t.common.common}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: activePalette.tileStateBadgeCss.PUBLIC }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: activePalette.tileStateBadgeCss.PUBLIC }} />
              {settings.showSymbolicShapes ? `${activePalette.tileStateShapes.PUBLIC} ` : ''}{t.common.public}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: activePalette.tileStateBadgeCss.PRIVATE }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: activePalette.tileStateBadgeCss.PRIVATE }} />
              {settings.showSymbolicShapes ? `${activePalette.tileStateShapes.PRIVATE} ` : ''}{t.common.private}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: activePalette.heatmapTiers.CRITICAL.cssHex }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: activePalette.heatmapTiers.CRITICAL.cssHex }} />
              {settings.showSymbolicShapes ? `${activePalette.heatmapTiers.CRITICAL.shape} ` : ''}{t.debug.critical}
            </span>
          </div>
        </section>

        {/* Opciones complementarias */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleToggleShapes}
            aria-pressed={settings.showSymbolicShapes}
            className={`p-3 rounded-xl border text-left transition-colors min-h-[70px] ${
              settings.showSymbolicShapes
                ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {t.accessibility.symbolicShapes}
              </span>
              <span className={settings.showSymbolicShapes ? 'text-emerald-300' : 'text-slate-400'}>
                {settings.showSymbolicShapes ? t.common.on : t.common.off}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t.accessibility.symbolicShapesDesc}
            </p>
          </button>

          <button
            type="button"
            onClick={handleToggleTextScale}
            aria-pressed={settings.hudTextScale === 'LARGE'}
            className={`p-3 rounded-xl border text-left transition-colors min-h-[70px] ${
              settings.hudTextScale === 'LARGE'
                ? 'bg-sky-950/40 border-sky-500/60 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-sky-400" />
                {t.accessibility.largeText}
              </span>
              <span className={settings.hudTextScale === 'LARGE' ? 'text-sky-300' : 'text-slate-400'}>
                {settings.hudTextScale === 'LARGE' ? '115%' : '100%'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t.accessibility.largeTextDesc}
            </p>
          </button>

          <button
            type="button"
            onClick={handleToggleReducedMotion}
            aria-pressed={settings.reducedMotionOverride}
            className={`p-3 rounded-xl border text-left transition-colors min-h-[70px] ${
              settings.reducedMotionOverride
                ? 'bg-amber-950/40 border-amber-500/60 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold mb-1">
              <span>{t.accessibility.reducedMotion}</span>
              <span className={settings.reducedMotionOverride ? 'text-amber-300' : 'text-slate-400'}>
                {settings.reducedMotionOverride ? t.common.on : t.common.auto}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t.accessibility.reducedMotionDesc}
            </p>
          </button>
        </section>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.accessibility.resetDefault}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[38px] px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors"
          >
            {t.accessibility.applyClose}
          </button>
        </div>
        </ModalFrame>
      )}
    </AnimatePresence>
  );
};
