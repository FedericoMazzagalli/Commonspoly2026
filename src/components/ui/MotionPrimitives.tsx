/**
 * MotionPrimitives.tsx
 * Contenedores animados reutilizables (exclusivamente compositor: opacity + transform)
 * que respetan automáticamente la preferencia del sistema y el modo de movimiento reducido.
 */

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { X } from 'lucide-react';

export const HUD_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type SwipeDismissDirection = 'left' | 'right' | 'up' | 'down';

export function isReducedMotionActive(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true') {
    return true;
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return true;
  }
  return false;
}

interface UseSwipeToDismissOptions {
  direction: SwipeDismissDirection;
  enabled?: boolean;
  thresholdPx?: number;
  velocityThreshold?: number;
  resetOnDismiss?: boolean;
  initialOffset?: { x: number; y: number };
  onDismiss?: () => void;
}

function shouldSkipSwipeTarget(
  target: EventTarget | null,
  root: HTMLElement,
  direction: SwipeDismissDirection
): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== root) {
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') {
      return true;
    }
    if (node.dataset?.noSwipe === 'true') {
      return true;
    }
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(node);
      if (
        (direction === 'left' || direction === 'right') &&
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        node.scrollWidth > node.clientWidth + 4
      ) {
        return true;
      }
      if (direction === 'down' && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        if (node.scrollHeight > node.clientHeight + 4 && node.scrollTop > 2) {
          return true;
        }
      }
      if (direction === 'up' && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        if (
          node.scrollHeight > node.clientHeight + 4 &&
          node.scrollTop + node.clientHeight < node.scrollHeight - 2
        ) {
          return true;
        }
      }
    }
    node = node.parentElement;
  }
  return false;
}

export function useSwipeToDismiss({
  direction,
  enabled = true,
  thresholdPx = 64,
  velocityThreshold = 0.42,
  resetOnDismiss = false,
  initialOffset,
  onDismiss
}: UseSwipeToDismissOptions) {
  const reduced = isReducedMotionActive();
  const swipeX = useMotionValue(reduced ? 0 : initialOffset?.x ?? 0);
  const swipeY = useMotionValue(reduced ? 0 : initialOffset?.y ?? 0);
  const suppressClickUntilRef = useRef<number>(0);

  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastCoord: number;
    lastTime: number;
    velocity: number;
    lockedAxis: 'horizontal' | 'vertical' | 'ignored' | null;
    captured: boolean;
  } | null>(null);

  useEffect(() => {
    if (reduced) {
      swipeX.set(0);
      swipeY.set(0);
      return;
    }
    const cx = animate(swipeX, 0, { duration: 0.2, ease: HUD_EASE });
    const cy = animate(swipeY, 0, { duration: 0.2, ease: HUD_EASE });
    return () => {
      cx.stop();
      cy.stop();
    };
  }, [reduced, swipeX, swipeY]);

  useEffect(() => {
    if (!enabled) {
      swipeX.set(0);
      swipeY.set(0);
      gestureRef.current = null;
    }
  }, [enabled, swipeX, swipeY]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || !onDismiss) return;
    const targetEl = e.target as HTMLElement | null;
    const isHandle = Boolean(targetEl?.closest('[data-swipe-handle="true"]'));
    if (e.pointerType === 'mouse' && (!isHandle || e.button !== 0)) return;
    if (!isHandle && shouldSkipSwipeTarget(e.target, e.currentTarget, direction)) return;

    const now = performance.now();
    const isHorizontal = direction === 'left' || direction === 'right';
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastCoord: isHorizontal ? e.clientX : e.clientY,
      lastTime: now,
      velocity: 0,
      lockedAxis: null,
      captured: false
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const isHorizontal = direction === 'left' || direction === 'right';

    if (g.lockedAxis === null) {
      if (Math.hypot(dx, dy) < 10) return;

      if (isHorizontal) {
        const matchesDir = direction === 'right' ? dx > 0 : dx < 0;
        if (matchesDir && Math.abs(dx) > Math.abs(dy) * 1.2) {
          g.lockedAxis = 'horizontal';
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
            g.captured = true;
          } catch {
            // Ignorar si el navegador no soporta captura
          }
        } else {
          g.lockedAxis = 'ignored';
          return;
        }
      } else {
        const matchesDir = direction === 'down' ? dy > 0 : dy < 0;
        if (matchesDir && Math.abs(dy) > Math.abs(dx) * 1.2) {
          g.lockedAxis = 'vertical';
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
            g.captured = true;
          } catch {
            // Ignorar si el navegador no soporta captura
          }
        } else {
          g.lockedAxis = 'ignored';
          return;
        }
      }
    }

    if (g.lockedAxis === 'ignored') return;

    const now = performance.now();
    const dt = Math.max(1, now - g.lastTime);
    const coord = isHorizontal ? e.clientX : e.clientY;
    const instantVelocity = (coord - g.lastCoord) / dt;
    g.velocity = g.velocity * 0.4 + instantVelocity * 0.6;
    g.lastCoord = coord;
    g.lastTime = now;

    if (g.lockedAxis === 'horizontal') {
      const clampedX = direction === 'right' ? Math.max(0, dx) : Math.min(0, dx);
      swipeX.set(clampedX);
    } else if (g.lockedAxis === 'vertical') {
      const clampedY = direction === 'down' ? Math.max(0, dy) : Math.min(0, dy);
      swipeY.set(clampedY);
    }
  };

  const finishGesture = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;

    if (g.captured) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignorar
      }
    }

    const lockedAxis = g.lockedAxis;
    const velocity = g.velocity;
    gestureRef.current = null;

    if (lockedAxis !== 'horizontal' && lockedAxis !== 'vertical') return;

    suppressClickUntilRef.current = performance.now() + 90;

    const isHorizontal = lockedAxis === 'horizontal';
    const currentOffset = isHorizontal ? swipeX.get() : swipeY.get();
    const distance = Math.abs(currentOffset);
    const dirVelocity = direction === 'right' || direction === 'down' ? velocity : -velocity;

    const shouldDismiss =
      !cancelled &&
      Boolean(onDismiss) &&
      (distance >= thresholdPx || (distance >= 26 && dirVelocity >= velocityThreshold));

    if (shouldDismiss && onDismiss) {
      if (resetOnDismiss) {
        swipeX.set(0);
        swipeY.set(0);
      } else if (!reduced) {
        const exitTarget = direction === 'right' || direction === 'down' ? 140 : -140;
        animate(isHorizontal ? swipeX : swipeY, exitTarget, { duration: 0.16, ease: HUD_EASE });
      }
      onDismiss();
      return;
    }

    const springDur = reduced ? 0.01 : 0.2;
    animate(swipeX, 0, { duration: springDur, ease: HUD_EASE });
    animate(swipeY, 0, { duration: springDur, ease: HUD_EASE });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => finishGesture(e, false);
  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => finishGesture(e, true);

  const onClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (performance.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const touchActionClass = !enabled || !onDismiss
    ? ''
    : direction === 'left' || direction === 'right'
    ? 'touch-pan-y'
    : 'touch-pan-x';

  return {
    swipeX,
    swipeY,
    touchActionClass,
    swipeHandlers: enabled && onDismiss
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
          onClickCapture
        }
      : {}
  };
}

interface ModalFrameProps {
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onBackdropClick?: () => void;
}

/**
 * Envuelve un modal completo (telón + tarjeta) con transiciones fluidas sobre opacity y transform.
 * En móviles (< 640px) adopta ergonomía de hoja inferior (bottom-sheet) con bordes redondeados arriba
 * y cierre por deslizamiento cuando `onBackdropClick` está definido.
 */
export const ModalFrame: React.FC<ModalFrameProps> = ({
  children,
  className = '',
  backdropClassName = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/82 overflow-y-auto pointer-events-auto',
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  onBackdropClick
}) => {
  const reduced = isReducedMotionActive();
  const { swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: 'down',
    enabled: Boolean(onBackdropClick),
    resetOnDismiss: true,
    onDismiss: onBackdropClick
  });

  const normalizedBackdropClass = backdropClassName
    .replace(/\bitems-center\b/g, 'items-end sm:items-center')
    .replace(/\bp-3\b/g, 'p-0 sm:p-4');

  const normalizedCardClass = className
    .replace(/\brounded-2xl\b/g, 'rounded-t-3xl sm:rounded-2xl')
    .replace(/\brounded-3xl\b/g, 'rounded-t-3xl sm:rounded-3xl')
    .replace(/\bmy-auto\b/g, 'sm:my-auto')
    .replace(/\bmax-h-\[90vh\]\b/g, 'max-h-[90dvh]')
    .replace(/\bmax-h-\[88vh\]\b/g, 'max-h-[90dvh]');

  return (
    <motion.div
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.16, ease: 'easeOut' }}
      className={normalizedBackdropClass}
      onClick={(e) => {
        if (onBackdropClick && e.target === e.currentTarget) {
          onBackdropClick();
        }
      }}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 20 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 16 }}
        transition={{ duration: reduced ? 0.01 : 0.22, ease: HUD_EASE }}
        style={{ y: swipeY }}
        className={`hud-surface relative max-h-[90dvh] overflow-y-auto overscroll-contain-y pb-safe ${touchActionClass} ${normalizedCardClass}`}
        onClick={(e) => e.stopPropagation()}
        {...swipeHandlers}
      >
        {onBackdropClick && (
          <div
            aria-hidden="true"
            data-swipe-handle="true"
            className="sm:hidden flex justify-center pb-2 -mt-1 cursor-grab active:cursor-grabbing"
          >
            <span className="w-10 h-1 rounded-full bg-slate-400/55" />
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
};

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  zIndexClass?: string;
  accentBorderClass?: string;
  maxHeightClass?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * Hoja inferior deslizable para móvil y tablet vertical con cierre táctil por swipe,
 * barra de agarre superior, área central desplazable y safe-area inferior.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerExtra,
  footer,
  zIndexClass = 'z-40',
  accentBorderClass = 'border-teal-700/80',
  maxHeightClass = 'max-h-[78dvh]',
  ariaLabel,
  children
}) => {
  const reduced = isReducedMotionActive();
  const { swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: 'down',
    enabled: isOpen,
    resetOnDismiss: true,
    onDismiss: onClose
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel ?? title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.16, ease: 'easeOut' }}
          className={`fixed inset-0 ${zIndexClass} bg-slate-950/65 flex items-end justify-center pointer-events-auto`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.section
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduced ? 0.01 : 0.22, ease: HUD_EASE }}
            style={{ y: swipeY }}
            onClick={(e) => e.stopPropagation()}
            className={`hud-surface w-full max-w-2xl bg-slate-900 border-t border-x ${accentBorderClass} rounded-t-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ${maxHeightClass} pb-safe ${touchActionClass}`}
            {...swipeHandlers}
          >
            {/* Barra de agarre táctil */}
            <div
              aria-hidden="true"
              data-swipe-handle="true"
              className="w-full flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing shrink-0"
            >
              <span className="w-10 h-1 rounded-full bg-slate-400/55" />
            </div>

            {/* Cabecera */}
            <div
              data-swipe-handle="true"
              className="px-4 pb-2.5 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {icon && (
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="hud-heading text-sm font-extrabold text-white truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {headerExtra}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido desplazable */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain-y px-4 py-3">
              {children}
            </div>

            {/* Pie opcional fijo */}
            {footer && (
              <div className="px-4 py-2.5 border-t border-slate-800/90 bg-slate-950/80 shrink-0">
                {footer}
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface HudPanelMotionProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  swipeDirection?: SwipeDismissDirection;
  onSwipeDismiss?: () => void;
  showMobileSwipeHandle?: boolean;
  ariaLabel?: string;
  role?: string;
  as?: 'aside' | 'section' | 'div';
}

export const HudPanelMotion: React.FC<HudPanelMotionProps> = ({
  children,
  className = '',
  direction = 'right',
  swipeDirection,
  onSwipeDismiss,
  showMobileSwipeHandle = true,
  ariaLabel,
  role,
  as = 'aside'
}) => {
  const reduced = isReducedMotionActive();
  const offset =
    reduced
      ? { x: 0, y: 0 }
      : direction === 'left'
      ? { x: -16, y: 0 }
      : direction === 'right'
      ? { x: 16, y: 0 }
      : direction === 'up'
      ? { x: 0, y: 12 }
      : { x: 0, y: -12 };

  const resolvedSwipeDir: SwipeDismissDirection =
    swipeDirection ??
    (direction === 'left'
      ? 'left'
      : direction === 'right'
      ? 'right'
      : direction === 'up'
      ? 'down'
      : 'up');

  const { swipeX, swipeY, touchActionClass, swipeHandlers } = useSwipeToDismiss({
    direction: resolvedSwipeDir,
    enabled: Boolean(onSwipeDismiss),
    initialOffset: offset,
    onDismiss: onSwipeDismiss
  });

  const Component =
    as === 'section' ? motion.section : as === 'div' ? motion.div : motion.aside;

  return (
    <Component
      role={role}
      aria-label={ariaLabel}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: reduced ? 0.01 : 0.2, ease: HUD_EASE }}
      style={{ x: swipeX, y: swipeY }}
      className={`hud-surface ${touchActionClass} ${className}`}
      {...swipeHandlers}
    >
      {onSwipeDismiss && showMobileSwipeHandle && (
        <div
          aria-hidden="true"
          data-swipe-handle="true"
          className="md:hidden pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
        >
          <span className="w-10 h-1 rounded-full bg-slate-400/55" />
        </div>
      )}
      {children}
    </Component>
  );
};
