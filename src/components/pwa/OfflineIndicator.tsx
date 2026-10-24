import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getQueuedOfflineItems } from '../../lib/pwaSync';

interface OfflineIndicatorProps {
  onOpenCapabilities?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = () => {
  const isOnline = useOnlineStatus();
  const queuedItems = getQueuedOfflineItems();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-400/40 px-3.5 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-fadeIn">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      <div className="flex items-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline Mode — Operating on cached local ledger.</span>
        {queuedItems.length > 0 && (
          <span className="bg-amber-900/60 px-2 py-0.5 rounded-full font-bold text-[10px] text-amber-200">
            {queuedItems.length} queued for sync
          </span>
        )}
      </div>
    </div>
  );
};
