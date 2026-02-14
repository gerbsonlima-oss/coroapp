import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Online Status] Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Online Status] Connection lost');
    };

    const handleNetworkStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isOnline: boolean }>;
      setIsOnline(customEvent.detail.isOnline);
    };

    // Listen to both native and custom events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('network-status-change', handleNetworkStatusChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('network-status-change', handleNetworkStatusChange);
    };
  }, []);

  return isOnline;
};