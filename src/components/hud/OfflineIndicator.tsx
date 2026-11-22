import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { useI18n } from '../../i18n';

export const OfflineIndicator: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const isOnline = useOnlineStatus();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        inline
          ? 'inline-flex items-center gap-1.5 rounded-xl bg-amber-950/95 border border-amber-500/60 px-3 py-1.5 text-[11px] font-bold text-amber-100 whitespace-nowrap'
          : 'fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-950/95 border border-amber-500/60 px-3 py-2 text-xs font-bold text-amber-100 shadow-lg'
      }
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{t.pwa.offlineStatus}</span>
    </div>
  );
};
