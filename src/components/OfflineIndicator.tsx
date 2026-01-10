import { WifiOff, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { cn } from '@/lib/utils';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const { metadata } = useOfflineStorage();

  if (isOnline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 backdrop-blur-sm text-white px-4 py-2 shadow-md border-b border-amber-600/50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Você está offline</span>
            {metadata && metadata.eventCount > 0 && (
              <span className="text-xs opacity-90">
                {metadata.eventCount} {metadata.eventCount === 1 ? 'evento disponível' : 'eventos disponíveis'}
              </span>
            )}
          </div>
        </div>
        {metadata && metadata.eventCount > 0 && (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 opacity-80" />
        )}
      </div>
    </div>
  );
};