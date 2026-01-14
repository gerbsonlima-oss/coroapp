import { useEffect } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

/**
 * Component that handles automatic offline sync.
 * Place this at the root of your app to enable auto-sync when coming back online.
 */
export const OfflineSyncManager = () => {
  // The useOfflineSync hook automatically syncs when connection is restored
  const { isSyncing, syncProgress } = useOfflineSync();

  // Log sync activity for debugging
  useEffect(() => {
    if (isSyncing) {
      console.log(`[OfflineSyncManager] Syncing: ${syncProgress.current}/${syncProgress.total}`);
    }
  }, [isSyncing, syncProgress]);

  // This component doesn't render anything visible
  // The sync notifications are handled by the hook via toast
  return null;
};
