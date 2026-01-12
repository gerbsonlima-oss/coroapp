import { useState, useEffect, useCallback } from 'react';

interface OfflineEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  notes: string | null;
  tenant_id: string;
}

interface OfflineMetadata {
  lastSync: string;
  version: string;
  eventCount: number;
}

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

const STORAGE_KEYS = {
  EVENTS: 'offline_events',
  METADATA: 'offline_events_metadata',
  TENANT: 'offline_tenant_config',
} as const;

export const useOfflineStorage = () => {
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>([]);
  const [metadata, setMetadata] = useState<OfflineMetadata | null>(null);

  // Load events from localStorage on mount
  useEffect(() => {
    loadOfflineEvents();
    loadMetadata();
  }, []);

  const loadOfflineEvents = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (stored) {
        const events = JSON.parse(stored) as OfflineEvent[];
        setOfflineEvents(events);
        console.log(`[Offline Storage] Loaded ${events.length} cached events`);
      }
    } catch (error) {
      console.error('[Offline Storage] Error loading events:', error);
    }
  }, []);

  const loadMetadata = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.METADATA);
      if (stored) {
        setMetadata(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Offline Storage] Error loading metadata:', error);
    }
  }, []);

  const saveEvents = useCallback((events: OfflineEvent[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      
      const newMetadata: OfflineMetadata = {
        lastSync: new Date().toISOString(),
        version: '1.0',
        eventCount: events.length,
      };
      
      localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(newMetadata));
      
      setOfflineEvents(events);
      setMetadata(newMetadata);
      
      console.log(`[Offline Storage] Saved ${events.length} events`);
    } catch (error) {
      console.error('[Offline Storage] Error saving events:', error);
    }
  }, []);

  const getEventById = useCallback((eventId: string): OfflineEvent | null => {
    return offlineEvents.find(e => e.id === eventId) || null;
  }, [offlineEvents]);

  const isEventAvailableOffline = useCallback((eventId: string): boolean => {
    return offlineEvents.some(e => e.id === eventId);
  }, [offlineEvents]);

  const saveTenantConfig = useCallback((tenant: TenantConfig) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TENANT, JSON.stringify(tenant));
      console.log('[Offline Storage] Saved tenant config:', tenant.name);
    } catch (error) {
      console.error('[Offline Storage] Error saving tenant:', error);
    }
  }, []);

  const getTenantConfig = useCallback((): TenantConfig | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TENANT);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[Offline Storage] Error loading tenant:', error);
      return null;
    }
  }, []);

  const removeEventOffline = useCallback((eventId: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (stored) {
        const events = JSON.parse(stored) as OfflineEvent[];
        const filtered = events.filter(e => e.id !== eventId);
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filtered));
        setOfflineEvents(filtered);
        
        // Update metadata
        const storedMetadata = localStorage.getItem(STORAGE_KEYS.METADATA);
        if (storedMetadata) {
          const metadata = JSON.parse(storedMetadata) as OfflineMetadata;
          metadata.eventCount = filtered.length;
          localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
          setMetadata(metadata);
        }
        
        console.log(`[Offline Storage] Removed event ${eventId}`);
      }
    } catch (error) {
      console.error('[Offline Storage] Error removing event:', error);
    }
  }, []);

  const clearOfflineData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.METADATA);
      setOfflineEvents([]);
      setMetadata(null);
      console.log('[Offline Storage] Cleared offline data');
    } catch (error) {
      console.error('[Offline Storage] Error clearing data:', error);
    }
  }, []);

  return {
    offlineEvents,
    metadata,
    saveEvents,
    getEventById,
    isEventAvailableOffline,
    saveTenantConfig,
    getTenantConfig,
    removeEventOffline,
    clearOfflineData,
    loadOfflineEvents,
  };
};