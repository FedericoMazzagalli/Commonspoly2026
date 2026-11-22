/**
 * AccessibilityModal.tsx
 * Modal de Accesibilidad y Modos Daltónicos (Protanopía, Deuteranopía, Tritanopía,
 * Alto Contraste), marcadores simbólicos por forma, tamaño tipográfico HUD y reducción de movimiento.
 */

import React from 'react';
import { Accessibility, Check, Eye, Globe, RotateCcw, Sparkles, Type, X } from 'lucide-react';
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
  if (!isOpen) return null;

  const activePalette = getAccessibilityPalette(settings.colorVisionMode);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.accessibility.title}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-teal-500/50 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
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
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
              <span className={settings.showSymbolicShapes ? 'text-emerald-300' : 'text-slate-500'}>
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
              <span className={settings.hudTextScale === 'LARGE' ? 'text-sky-300' : 'text-slate-500'}>
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
              <span className={settings.reducedMotionOverride ? 'text-amber-300' : 'text-slate-500'}>
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
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.accessibility.resetDefault}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors"
          >
            {t.accessibility.applyClose}
          </button>
        </div>
      </div>
    </div>
  );
};
