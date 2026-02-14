import { useCallback } from 'react';

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

const TENANT_KEY = 'offline_tenant_config';

/**
 * Simplified offline storage hook - only keeps tenant config for fallback.
 */
export const useOfflineStorage = () => {
  const saveTenantConfig = useCallback((tenant: TenantConfig) => {
    try {
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
    } catch {}
  }, []);

  const getTenantConfig = useCallback((): TenantConfig | null => {
    try {
      const stored = localStorage.getItem(TENANT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  return {
    offlineEvents: [],
    metadata: null,
    savedEventIds: [] as string[],
    saveEvents: (_events: any[]) => {},
    getEventById: (_id: string) => null,
    isEventAvailableOffline: (_id: string) => false,
    saveTenantConfig,
    getTenantConfig,
    removeEventOffline: (_id: string) => {},
    clearOfflineData: () => {},
    loadOfflineEvents: () => {},
    refreshSavedEventIds: () => {},
  };
};
