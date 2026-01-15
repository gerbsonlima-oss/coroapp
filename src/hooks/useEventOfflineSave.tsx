import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAudioCache } from './useAudioCache';
import { toast } from 'sonner';

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
}

const OFFLINE_EVENTS_KEY = 'offline_events_complete';
const OFFLINE_EVENT_IDS_KEY = 'offline_event_ids';

export const useEventOfflineSave = (eventId: string) => {
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [isEventSaved, setIsEventSaved] = useState(false);
  const { cacheAudio, isCached } = useAudioCache();

  // Check if event is already saved offline
  useEffect(() => {
    const savedIds = getSavedEventIds();
    setIsEventSaved(savedIds.includes(eventId));
  }, [eventId]);

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

  const saveEventOffline = useCallback(async () => {
    if (isSaving) return false;
    
    setIsSaving(true);
    setProgress(0);
    setProgressText('Carregando dados do evento...');

    try {
      // 1. Fetch event data
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, location, cover_image_url, notes')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        throw new Error('Erro ao carregar evento');
      }

      setProgress(10);
      setProgressText('Carregando músicas...');

      // 2. Fetch event songs with song details
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
        throw new Error('Erro ao carregar músicas');
      }

      const songs = eventSongs?.map(es => es.songs).filter(Boolean) || [];
      const songIds = songs.map(s => s!.id);

      setProgress(20);
      setProgressText('Carregando áudios...');

      // 3. Fetch audios for all songs
      const { data: audios, error: audiosError } = await supabase
        .from('song_audios')
        .select('id, song_id, name, naipe, audio_url')
        .in('song_id', songIds.length > 0 ? songIds : ['none']);

      if (audiosError) {
        throw new Error('Erro ao carregar áudios');
      }

      setProgress(30);

      // 4. Cache cover image if exists
      if (event.cover_image_url) {
        setProgressText('Salvando imagem de capa...');
        try {
          const cache = await caches.open('event-images-cache');
          const response = await fetch(event.cover_image_url);
          if (response.ok) {
            await cache.put(event.cover_image_url, response.clone());
          }
        } catch (e) {
          console.warn('Failed to cache cover image:', e);
        }
      }

      setProgress(40);

      // 5. Cache all audio files
      const audioUrls = audios?.map(a => a.audio_url).filter(Boolean) || [];
      const totalAudios = audioUrls.length;
      
      if (totalAudios > 0) {
        for (let i = 0; i < audioUrls.length; i++) {
          const url = audioUrls[i];
          setProgressText(`Salvando áudio ${i + 1} de ${totalAudios}...`);
          
          if (!isCached(url)) {
            await cacheAudio(url);
          }
          
          setProgress(40 + Math.round((i + 1) / totalAudios * 40));
        }
      }

      setProgress(85);
      setProgressText('Salvando dados localmente...');

      // 6. Save complete event data to localStorage
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
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(`${OFFLINE_EVENTS_KEY}_${eventId}`, JSON.stringify(offlineData));

      // Update saved event IDs list
      const savedIds = getSavedEventIds();
      if (!savedIds.includes(eventId)) {
        savedIds.push(eventId);
        localStorage.setItem(OFFLINE_EVENT_IDS_KEY, JSON.stringify(savedIds));
      }

      setProgress(95);
      setProgressText('Preparando atalho...');

      // 7. Inject dynamic manifest for this event
      await injectEventManifest(event);

      setProgress(100);
      setProgressText('Concluído!');
      setIsEventSaved(true);

      return true;
    } catch (error) {
      console.error('Error saving event offline:', error);
      toast.error('Erro ao salvar evento offline');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [eventId, isSaving, cacheAudio, isCached]);

  const removeEventOffline = useCallback(async () => {
    try {
      // Remove from localStorage
      localStorage.removeItem(`${OFFLINE_EVENTS_KEY}_${eventId}`);

      // Update saved IDs list
      const savedIds = getSavedEventIds().filter(id => id !== eventId);
      localStorage.setItem(OFFLINE_EVENT_IDS_KEY, JSON.stringify(savedIds));

      // Dispatch storage event so other components can react
      window.dispatchEvent(new StorageEvent('storage', {
        key: OFFLINE_EVENT_IDS_KEY,
        newValue: JSON.stringify(savedIds)
      }));

      setIsEventSaved(false);
      toast.success('Evento removido do armazenamento offline');
    } catch (error) {
      console.error('Error removing event offline:', error);
      toast.error('Erro ao remover evento');
    }
  }, [eventId]);

  return {
    isSaving,
    progress,
    progressText,
    isEventSaved,
    saveEventOffline,
    removeEventOffline,
    getOfflineEvent,
    getSavedEventIds
  };
};

// Helper function to inject dynamic manifest with event name and cover image
// This is exported so it can be called before triggering PWA install prompt
export async function injectEventManifest(event: { id: string; name: string; cover_image_url: string | null }) {
  // Truncate name for short_name (max 12 chars)
  const shortName = event.name.length > 12 ? event.name.substring(0, 12) + '…' : event.name;
  
  const manifest = {
    name: event.name,
    short_name: shortName,
    description: `Liturgia+ - ${event.name}`,
    start_url: `/e/${event.id}?offline=true`,
    display: 'standalone',
    background_color: '#0f0f1e',
    theme_color: '#1a1a2e',
    icons: [
      {
        src: event.cover_image_url || '/liturgia-plus-icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: event.cover_image_url || '/liturgia-plus-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/liturgia-plus-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };

  // Create blob URL for dynamic manifest
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(blob);

  // Update manifest link
  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
  if (manifestLink) {
    manifestLink.href = manifestUrl;
  } else {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    document.head.appendChild(manifestLink);
  }
}

// Helper to load offline event data
export function loadOfflineEventData(eventId: string): OfflineEventComplete | null {
  try {
    const stored = localStorage.getItem(`${OFFLINE_EVENTS_KEY}_${eventId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Check if running in offline mode
export function isOfflineMode(): boolean {
  return new URLSearchParams(window.location.search).get('offline') === 'true' || !navigator.onLine;
}
