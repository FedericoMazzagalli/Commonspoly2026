/**
 * KeyboardShortcutsModal.tsx
 * Modal accesible con la referencia completa de atajos de teclado globales.
 */

import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Keyboard, X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, KeyboardShortcutItem } from '../../hooks/useKeyboardShortcuts';
import { useI18n } from '../../i18n';
import { ModalFrame } from '../ui/MotionPrimitives';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { t } = useI18n();

  const sectionMeta: { id: KeyboardShortcutItem['category']; title: string }[] = [
    { id: 'TURN', title: t.common.turn },
    { id: 'MODALS', title: t.hud.menuBtn },
    { id: 'VIEW', title: t.hud.cameraBtn }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalFrame
          ariaLabel={t.modals.shortcutsTitle}
          backdropClassName="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 overflow-y-auto pointer-events-auto"
          className="w-full max-w-2xl bg-slate-900 border border-teal-500/60 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto"
          onBackdropClick={onClose}
        >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="hud-heading text-lg font-extrabold text-white tracking-tight">
                {t.modals.shortcutsTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.modals.shortcutsSubtitle}
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

        {/* Shortcut Groups */}
        <div className="py-4 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {sectionMeta.map(section => {
            const items = KEYBOARD_SHORTCUTS.filter(item => item.category === section.id);
            return (
              <div key={section.id}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">
                  {section.title}
                </h3>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/70">
                  {items.map(item => (
                    <div
                      key={item.label}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-100">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">
                          {item.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, idx) => (
                          <React.Fragment key={k}>
                            {idx > 0 && <span className="text-slate-600 text-[10px]">/</span>}
                            <kbd className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-teal-300 shadow-sm whitespace-nowrap">
                              {k}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-slate-200">Esc</kbd>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[38px] px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors"
          >
            {t.common.close}
          </button>
        </div>
        </ModalFrame>
      )}
    </AnimatePresence>
  );
};
