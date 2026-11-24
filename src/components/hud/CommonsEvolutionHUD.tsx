/**
 * CommonsEvolutionHUD.tsx
 * Panel flotante no intrusivo de visualización de datos en vivo con D3.js
 * Muestra la evolución histórica de los bienes comunes vs privatizados turno a turno.
 */

import React from 'react';
import { AnimatePresence } from 'motion/react';
import { LineChart, X } from 'lucide-react';
import { TurnCommonsSnapshot } from '../../types/game';
import { CommonsEvolutionD3Chart } from '../charts/CommonsEvolutionD3Chart';
import { playSound } from '../../utils/audio';
import { HudPanelMotion } from '../ui/MotionPrimitives';

interface CommonsEvolutionHUDProps {
  isOpen: boolean;
  turnHistory: TurnCommonsSnapshot[];
  onClose: () => void;
}

export const CommonsEvolutionHUD: React.FC<CommonsEvolutionHUDProps> = ({
  isOpen,
  turnHistory,
  onClose
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <HudPanelMotion
          as="section"
          direction="right"
          onSwipeDismiss={() => {
            playSound.modalClose();
            onClose();
          }}
          ariaLabel="Evolución D3 de Bienes Comunes vs Privatizados"
          className="pointer-events-auto fixed top-16 right-3 md:right-6 z-30 w-[24rem] sm:w-[32rem] max-w-[94vw] bg-slate-900/95 border border-teal-700/70 rounded-2xl shadow-2xl p-4 text-slate-100 select-none"
        >
          <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <LineChart className="w-4 h-4 text-teal-400 shrink-0" />
              <h3 className="hud-heading text-sm font-bold text-white truncate">
                Tendencia de Bienes por Turno
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                playSound.modalClose();
                onClose();
              }}
              className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Cerrar gráfico de evolución"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <CommonsEvolutionD3Chart
            data={turnHistory}
            height={215}
            compact
            title="Bienes Comunes recuperados vs Privatizados"
          />
        </HudPanelMotion>
      )}
    </AnimatePresence>
  );
};
