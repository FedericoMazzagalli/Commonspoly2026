/**
 * AchievementNotificationHUD.tsx
 * Notificación compacta en la parte superior del HUD cuando se desbloquea un logro local.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Trees,
  HeartHandshake,
  Layers,
  ShieldCheck,
  Users,
  Sparkles,
  Award,
  Flame,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CooperativeAchievement } from '../../types/game';
import { playSound } from '../../utils/audio';

interface AchievementNotificationHUDProps {
  achievement: CooperativeAchievement | null | undefined;
  onDismiss: () => void;
  onOpenAchievements?: () => void;
}

const AUTO_DISMISS_MS = 5500;

function renderAchievementIcon(iconName: string, className: string) {
  switch (iconName) {
    case 'Trees':
      return <Trees className={className} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Trophy':
    default:
      return <Trophy className={className} />;
  }
}

export const AchievementNotificationHUD: React.FC<AchievementNotificationHUDProps> = ({
  achievement,
  onDismiss,
  onOpenAchievements
}) => {
  const { t } = useTranslation();
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (!achievement || isHovering) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [achievement, isHovering, onDismiss]);

  const getTierMeta = (tier?: CooperativeAchievement['tier']) => {
    switch (tier) {
      case 'GOLD':
        return {
          label: t('modals.tierGold'),
          border: 'border-amber-400/70',
          iconWrap: 'bg-amber-500/15 text-amber-300',
          kickerColor: 'text-amber-300'
        };
      case 'SILVER':
        return {
          label: t('modals.tierSilver'),
          border: 'border-teal-400/70',
          iconWrap: 'bg-teal-500/15 text-teal-300',
          kickerColor: 'text-teal-300'
        };
      case 'BRONZE':
      default:
        return {
          label: t('modals.tierBronze'),
          border: 'border-emerald-500/60',
          iconWrap: 'bg-emerald-500/15 text-emerald-300',
          kickerColor: 'text-emerald-300'
        };
    }
  };

  const tierMeta = getTierMeta(achievement?.tier);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('achievementToast.ariaLabel')}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-sm"
    >
      <AnimatePresence mode="wait">
        {achievement && (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`pointer-events-auto bg-slate-900/95 border ${tierMeta.border} rounded-xl shadow-2xl px-3.5 py-2.5 text-slate-100 flex items-center gap-3`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${tierMeta.iconWrap}`}>
              {renderAchievementIcon(achievement.iconName, 'w-4 h-4')}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 tabular-nums">
                <span className={`font-bold uppercase tracking-wider ${tierMeta.kickerColor}`}>
                  {t('achievementToast.unlockedKicker')}
                </span>
                <span aria-hidden="true">·</span>
                <span>{tierMeta.label}</span>
                {achievement.unlockedAtRound !== undefined && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t('common.round')} {achievement.unlockedAtRound}</span>
                  </>
                )}
              </div>

              <div className="text-xs font-extrabold text-white leading-snug truncate mt-0.5">
                {achievement.title}
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[11px] text-slate-300 leading-snug truncate">
                  {achievement.description}
                </p>
                {onOpenAchievements && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound.modalOpen();
                      onOpenAchievements();
                      onDismiss();
                    }}
                    className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline whitespace-nowrap shrink-0 transition-colors"
                  >
                    {t('achievementToast.viewAll')}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                onDismiss();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              aria-label={t('achievementToast.closeAria')}
              title={t('common.close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
