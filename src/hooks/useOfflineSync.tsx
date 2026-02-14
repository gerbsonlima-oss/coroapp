import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

const OFFLINE_EVENTS_KEY = 'offline_events_complete';
const OFFLINE_EVENT_IDS_KEY = 'offline_event_ids';
const LAST_SYNC_KEY = 'offline_last_sync';

interface OfflineEventComplete {
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    cover_image_url: string | null;
    notes: string | null;
  };
  songs: Array<{
    id: string;
    name: string;
    lyrics: string | null;
    chords: string | null;
    type: string;
    sheet_music_url: string | null;
    sheet_music_pdf_url: string | null;
  }>;
  audios: Array<{
    id: string;
    song_id: string;
    name: string;
    naipe: string;
    audio_url: string;
  }>;
  eventSongs: Array<{
    id: string;
    song_id: string;
    order_index: number;
    type: string | null;
  }>;
  savedAt: string;
  lastSynced?: string;
}

export const useOfflineSync = () => {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const wasOfflineRef = useRef(!navigator.onLine);
  const syncInProgressRef = useRef(false);

  const getSavedEventIds = (): string[] => {
    try {
      const stored = localStorage.getItem(OFFLINE_EVENT_IDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const getOfflineEvent = (id: string): OfflineEventComplete | null => {
    try {
      const stored = localStorage.getItem(`${OFFLINE_EVENTS_KEY}_${id}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const syncSingleEvent = async (eventId: string): Promise<boolean> => {
    try {
      console.log(`[Offline Sync] Syncing event ${eventId}...`);

      // Fetch latest event data
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, location, cover_image_url, notes')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        console.warn(`[Offline Sync] Event ${eventId} not found, may have been deleted`);
        return false;
      }

      // Fetch event songs with song details
      const { data: eventSongs, error: eventSongsError } = await supabase
        .from('event_songs')
        .select(`
          id,
          song_id,
          order_index,
          type,
          songs (
            id,
            name,
            lyrics,
            chords,
            type,
            sheet_music_url,
            sheet_music_pdf_url
          )
        `)
        .eq('event_id', eventId)
        .order('order_index');

      if (eventSongsError) {
        console.error(`[Offline Sync] Error fetching songs for ${eventId}:`, eventSongsError);
        return false;
      }

      const songs = eventSongs?.map(es => es.songs).filter(Boolean) || [];
      const songIds = songs.map(s => s!.id);

      // Fetch audios for all songs
      const { data: audios, error: audiosError } = await supabase
        .from('song_audios')
        .select('id, song_id, name, naipe, audio_url')
        .in('song_id', songIds.length > 0 ? songIds : ['none']);

      if (audiosError) {
        console.error(`[Offline Sync] Error fetching audios for ${eventId}:`, audiosError);
        return false;
      }

      // Get existing offline data to compare
      const existingData = getOfflineEvent(eventId);
      const existingAudioUrls = new Set(existingData?.audios.map(a => a.audio_url) || []);

      // Cache any new audio files
      const newAudios = audios?.filter(a => !existingAudioUrls.has(a.audio_url)) || [];
      if (newAudios.length > 0) {
        console.log(`[Offline Sync] Caching ${newAudios.length} new audio files for ${eventId}`);
        const cache = await caches.open('audio-files-cache');
        
        for (const audio of newAudios) {
          try {
            const response = await fetch(audio.audio_url);
            if (response.ok) {
              await cache.put(audio.audio_url, response.clone());
            }
          } catch (e) {
            console.warn(`[Offline Sync] Failed to cache audio: ${audio.audio_url}`, e);
          }
        }
      }

      // Cache cover image if changed
      if (event.cover_image_url && event.cover_image_url !== existingData?.event.cover_image_url) {
        try {
          const cache = await caches.open('event-images-cache');
          const response = await fetch(event.cover_image_url);
          if (response.ok) {
            await cache.put(event.cover_image_url, response.clone());
          }
        } catch (e) {
          console.warn('[Offline Sync] Failed to cache cover image:', e);
        }
      }

      // Save updated offline data
      const offlineData: OfflineEventComplete = {
        event,
        songs: songs.filter(Boolean) as OfflineEventComplete['songs'],
        audios: audios || [],
        eventSongs: eventSongs?.map(es => ({
          id: es.id,
          song_id: es.song_id,
          order_index: es.order_index,
          type: es.type
        })) || [],
        savedAt: existingData?.savedAt || new Date().toISOString(),
        lastSynced: new Date().toISOString()
      };

      localStorage.setItem(`${OFFLINE_EVENTS_KEY}_${eventId}`, JSON.stringify(offlineData));
      console.log(`[Offline Sync] Event ${eventId} synced successfully`);
      
      return true;
    } catch (error) {
      console.error(`[Offline Sync] Error syncing event ${eventId}:`, error);
      return false;
    }
  };

  const syncAllOfflineEvents = useCallback(async () => {
    if (syncInProgressRef.current || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);

    const savedIds = getSavedEventIds();
    if (savedIds.length === 0) {
      syncInProgressRef.current = false;
      setIsSyncing(false);
      return { synced: 0, failed: 0 };
    }

    console.log(`[Offline Sync] Starting sync for ${savedIds.length} events...`);
    setSyncProgress({ current: 0, total: savedIds.length });

    let synced = 0;
    let failed = 0;

    for (let i = 0; i < savedIds.length; i++) {
      const eventId = savedIds[i];
      setSyncProgress({ current: i + 1, total: savedIds.length });

      const success = await syncSingleEvent(eventId);
      if (success) {
        synced++;
      } else {
        failed++;
      }

      // Small delay between syncs to avoid overwhelming the server
      if (i < savedIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Update last sync timestamp
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    syncInProgressRef.current = false;
    setIsSyncing(false);
    setSyncProgress({ current: 0, total: 0 });

    console.log(`[Offline Sync] Sync complete. Synced: ${synced}, Failed: ${failed}`);
    
    return { synced, failed };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    const performAutoSync = async () => {
      // Only sync if we were offline and now we're online
      if (wasOfflineRef.current && isOnline) {
        console.log('[Offline Sync] Connection restored, starting auto-sync...');
        
        const savedIds = getSavedEventIds();
        if (savedIds.length > 0) {
          toast.info('Sincronizando eventos offline...', {
            id: 'offline-sync',
            duration: 10000
          });

          const { synced, failed } = await syncAllOfflineEvents();

          if (synced > 0 && failed === 0) {
            toast.success(`${synced} evento${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}!`, {
              id: 'offline-sync'
            });
          } else if (synced > 0 && failed > 0) {
            toast.warning(`${synced} sincronizado${synced > 1 ? 's' : ''}, ${failed} falhou`, {
              id: 'offline-sync'
            });
          } else if (failed > 0) {
            toast.error('Falha ao sincronizar eventos', {
              id: 'offline-sync'
            });
          } else {
            toast.dismiss('offline-sync');
          }
        }
      }

      wasOfflineRef.current = !isOnline;
    };

    performAutoSync();
  }, [isOnline, syncAllOfflineEvents]);

  const getLastSyncTime = (): string | null => {
    return localStorage.getItem(LAST_SYNC_KEY);
  };

  return {
    isSyncing,
    syncProgress,
    syncAllOfflineEvents,
    syncSingleEvent,
    getLastSyncTime,
    isOnline
  };
};
