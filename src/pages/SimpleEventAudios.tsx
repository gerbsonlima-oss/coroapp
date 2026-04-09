import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, MoreVertical, Download, MessageCircle, Music, FileText, X, Guitar, BookOpen, Share2, CloudDownload, CheckCircle, Trash2, RefreshCw, Music2, Search, ArrowLeft, Loader2, Edit, Plus, Pencil, FileArchive, Check, Repeat1, ListOrdered, Link, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FullscreenChordViewer from '@/components/FullscreenChordViewer';
import { SimpleSheetViewer } from '@/components/SimpleSheetViewer';
import { SaveEventOfflineDialog } from '@/components/SaveEventOfflineDialog';
import { ReorderSongsSheet } from '@/components/ReorderSongsSheet';
import { useEventOfflineSave, loadOfflineEventData, isOfflineMode } from '@/hooks/useEventOfflineSave';
import { useAudioCache } from '@/hooks/useAudioCache';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareCompleteToWhatsApp } from '@/utils/whatsappShare';
import { Helmet } from 'react-helmet-async';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { ExportLyricsDialog, LyricsExportOptions } from '@/components/ExportLyricsDialog';
import { useExportPreferences } from '@/hooks/useExportPreferences';
import { parseDateOnlyLocal } from '@/utils/dateParsing';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  tenant_id: string | null;
  pdf_theme: string | null;
}

// Fallback type labels with liturgical order
const defaultTypeLabels: Record<string, { name: string; order: number }> = {
  canto_entrada: { name: 'Entrada', order: 1 },
  entrada: { name: 'Entrada', order: 1 },
  ato_penitencial: { name: 'Ato Penitencial', order: 2 },
  perdao: { name: 'Ato Penitencial', order: 2 },
  gloria: { name: 'Glória', order: 3 },
  salmo: { name: 'Salmo', order: 4 },
  aclamacao: { name: 'Aclamação', order: 5 },
  oferendas: { name: 'Ofertório', order: 6 },
  ofertorio: { name: 'Ofertório', order: 6 },
  santo: { name: 'Santo', order: 7 },
  cordeiro: { name: 'Cordeiro', order: 8 },
  comunhao: { name: 'Canto da Comunhão', order: 9 },
  acao_gracas: { name: 'Ação de Graças', order: 10 },
  canto_processional: { name: 'Canto Processional', order: 12 },
  final: { name: 'Final', order: 11 },
  outro: { name: 'Outro', order: 99 },
};

interface SongAudio {
  id: string;
  song_id: string;
  event_song_id?: string;
  naipe: string;
  audio_url: string;
  name: string;
  song_name: string;
  song_type_slug: string;
  song_type_name: string;
  song_type_order: number;
  song_lyrics: string | null;
  song_chords: string | null;
  song_sheet_music_pdf_url: string | null;
  event_order_index?: number;
}

interface SongType {
  id: string;
  slug: string;
  name: string;
  order_index: number;
}

const MAIN_NAIPE_FILTERS = ['soprano', 'contralto', 'tenor', 'baixo'] as const;
const AUDIO_NAIPE_OPTIONS = ['soprano', 'contralto', 'tenor', 'baixo', 'todos'] as const;

const NAIPE_DISPLAY_LABELS: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
  todos: '4 vozes',
  unissono: 'Original',
};

const normalizeNaipe = (value: string) => value.trim().toLowerCase();
const normalizeNaipeAlias = (value: string) => {
  const normalized = normalizeNaipe(value).replace(/\s+/g, ' ');
  if (normalized === 'unissono' || normalized === 'todos' || normalized === '4vozes' || normalized === '4 vozes') {
    return 'todos';
  }
  return normalized;
};
const isFourVoices = (value: string) => {
  return normalizeNaipeAlias(value) === 'todos';
};

const NAIPE_ORDER: Record<string, number> = {
  soprano: 0,
  contralto: 1,
  tenor: 2,
  baixo: 3,
  todos: 4,
};

const getNaipeSortOrder = (naipe: string) => {
  const normalized = normalizeNaipeAlias(naipe);
  return NAIPE_ORDER[normalized] ?? 99;
};

const sortByTypeOrder = (audios: SongAudio[]): SongAudio[] => {
  return [...audios].sort((a, b) => {
    // First sort by event order_index (from drag-and-drop reordering)
    const aOrder = a.event_order_index ?? 999;
    const bOrder = b.event_order_index ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Inside the same song group, always sort by naipe:
    // soprano -> contralto -> tenor -> baixo -> 4 vozes
    if (a.song_id === b.song_id) {
      const naipeOrderCompare = getNaipeSortOrder(a.naipe) - getNaipeSortOrder(b.naipe);
      if (naipeOrderCompare !== 0) return naipeOrderCompare;
    }
    
    // Fallback: sort by song type order
    const typeOrderCompare = a.song_type_order - b.song_type_order;
    if (typeOrderCompare !== 0) return typeOrderCompare;
    
    // Then by song name
    return a.song_name.localeCompare(b.song_name);
  });
};

const SimpleEventAudios = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const location = useLocation();
  const { tenantSlug, tenant } = useTenant();  const { isAdmin } = useIsAdmin();
  const { preferences: exportPreferences, savePreferences: saveExportPreferences } = useExportPreferences();
  
  // Internal access is only when user is inside app routes (not share/public links)
  const isPublicAccess = location.pathname.includes('/public/events/');
  const isInternalAccess = !location.pathname.startsWith('/e/') && !isPublicAccess;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { 
    playTrack, 
    togglePlay, 
    isPlaying, 
    currentTrack, 
    currentTime, 
    duration, 
    seek,
    setPlaylist,
    isLoading: isPlayerLoading,
    repeatMode,
    toggleRepeat
  } = usePlayer();

  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [chordsModalOpen, setChordsModalOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<SongAudio | null>(null);
  const [exportingLyrics, setExportingLyrics] = useState(false);
  const [exportingChords, setExportingChords] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [saveOfflineDialogOpen, setSaveOfflineDialogOpen] = useState(false);
  const [sheetViewerOpen, setSheetViewerOpen] = useState(false);
  const [sheetMusicUrl, setSheetMusicUrl] = useState<string | null>(null);
  const [sheetSongName, setSheetSongName] = useState<string>('');
  const [isSeeking, setIsSeeking] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('simpleEvent_searchQuery') || '';
  });
  const [selectedNaipes, setSelectedNaipes] = useState<string[]>(() => {
    const saved = localStorage.getItem('simpleEvent_selectedNaipes');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: unknown) => String(item))
        .map(normalizeNaipe)
        .filter((naipe) => MAIN_NAIPE_FILTERS.includes(naipe as typeof MAIN_NAIPE_FILTERS[number]));
    } catch {
      return [];
    }
  });
  const [showExportLyricsDialog, setShowExportLyricsDialog] = useState(false);
  const [showReorderSheet, setShowReorderSheet] = useState(false);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [trackProgress, setTrackProgress] = useState<Record<string, { currentTime: number; duration: number }>>({});

  // Helper functions and Memoized values
  const filteredAudios = useMemo(() => {
    let result = audios;
    if (selectedNaipes.length > 0) {
      result = result.filter(a => 
        // Include songs without audio (naipe is empty)
        a.naipe === '' ||
        // Always include "4 vozes" tracks
        isFourVoices(a.naipe) ||
        
        selectedNaipes.includes(normalizeNaipe(a.naipe))
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.song_name.toLowerCase().includes(query) ||
        a.song_type_name.toLowerCase().includes(query) ||
        (a.naipe && normalizeNaipeAlias(a.naipe).includes(query))
      );
    }
    return result;
  }, [audios, selectedNaipes, searchQuery]);

  const songGroupNumberBySongId = useMemo(() => {
    const map: Record<string, number> = {};
    let currentNumber = 0;

    for (const audio of filteredAudios) {
      if (!map[audio.song_id]) {
        currentNumber += 1;
        map[audio.song_id] = currentNumber;
      }
    }

    return map;
  }, [filteredAudios]);

  const playableAudios = useMemo(
    () => filteredAudios.filter((audio) => audio.audio_url !== ''),
    [filteredAudios]
  );

  const handlePlay = async (audio: SongAudio) => {
    const index = playableAudios.findIndex(a => a.id === audio.id);
    if (index >= 0) {
      if (currentTrack?.id === audio.id) {
        togglePlay();
      } else {
        playTrack(index);
      }
    }
  };

  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const [preloadedUrls, setPreloadedUrls] = useState<Record<string, string>>({});
  const [isPreloading, setIsPreloading] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [songToDelete, setSongToDelete] = useState<SongAudio | null>(null);
  
  // Add Song Modal states
  const [addSongModalOpen, setAddSongModalOpen] = useState(false);
  const [addSongSearchQuery, setAddSongSearchQuery] = useState('');
  const [availableSongs, setAvailableSongs] = useState<any[]>([]);
  const [loadingAvailableSongs, setLoadingAvailableSongs] = useState(false);
  const [isCreatingNewSong, setIsCreatingNewSong] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [selectedSongType, setSelectedSongType] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [songTypesForModal, setSongTypesForModal] = useState<SongType[]>([]);
  const [editTypeModalOpen, setEditTypeModalOpen] = useState(false);
  const [audioForTypeEdit, setAudioForTypeEdit] = useState<SongAudio | null>(null);
  const [selectedTypeForEdit, setSelectedTypeForEdit] = useState('');
  const [savingTypeForEvent, setSavingTypeForEvent] = useState(false);
  const [editNaipeModalOpen, setEditNaipeModalOpen] = useState(false);
  const [audioForNaipeEdit, setAudioForNaipeEdit] = useState<SongAudio | null>(null);
  const [selectedNaipeForEdit, setSelectedNaipeForEdit] = useState('');
  const [savingNaipeForAudio, setSavingNaipeForAudio] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem('simpleEvent_searchQuery', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('simpleEvent_selectedNaipes', JSON.stringify(selectedNaipes));
  }, [selectedNaipes]);

  useEffect(() => {
    setTrackProgress({});
  }, [id]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    if (currentTime <= 0 && duration <= 0) return;

    setTrackProgress((prev) => {
      const existing = prev[currentTrack.id];
      const nextDuration = duration > 0 ? duration : (existing?.duration ?? 0);

      if (
        existing &&
        Math.abs(existing.currentTime - currentTime) < 0.15 &&
        Math.abs(existing.duration - nextDuration) < 0.15
      ) {
        return prev;
      }

      return {
        ...prev,
        [currentTrack.id]: {
          currentTime,
          duration: nextDuration,
        },
      };
    });
  }, [currentTrack?.id, currentTime, duration]);

  const handleGoBack = () => {
    navigate(buildPath('/events'));
  };

  // Update global playlist when audios or filters change (only include items with actual audio)
  useEffect(() => {
    if (playableAudios.length > 0) {
      const tracks = playableAudios.map(a => ({
        id: a.id,
        songId: a.song_id,
        songName: a.song_name,
        songType: a.song_type_slug,
        naipe: a.naipe,
        url: a.audio_url,
        sheetMusicUrl: a.song_sheet_music_pdf_url
      }));
      setPlaylist(tracks);
    } else {
      setPlaylist([]);
    }
  }, [playableAudios, setPlaylist]);

  // Offline save hook
  const {
    isSaving,
    progress,
    progressText,
    isEventSaved,
    saveEventOffline,
    removeEventOffline
  } = useEventOfflineSave(id || '');

  // Audio cache hook for offline playback
  const { getCachedUrl, isCached } = useAudioCache();

  // Offline sync hook
  const { isSyncing, syncSingleEvent, isOnline } = useOfflineSync();

  // Check if we're in offline mode
  const offlineMode = isOfflineMode();

  // Preload cached audio URLs for faster offline playback
  const preloadCachedUrls = useCallback(async (audioList: SongAudio[]) => {
    if (audioList.length === 0) return;
    
    setIsPreloading(true);
    const urlMap: Record<string, string> = {};
    
    try {
      // Preload all audio URLs in parallel
      await Promise.all(
        audioList.map(async (audio) => {
          const cachedUrl = await getCachedUrl(audio.audio_url);
          urlMap[audio.audio_url] = cachedUrl;
        })
      );
      
      setPreloadedUrls(urlMap);
      console.log(`Preloaded ${Object.keys(urlMap).length} audio URLs`);
    } catch (error) {
      console.error('Error preloading audio URLs:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [getCachedUrl]);

  useEffect(() => {
    if (id) {
      // If offline mode or no connection, try to load from offline storage first
      if (offlineMode || !navigator.onLine) {
        loadFromOfflineStorage();
      } else {
        fetchEventData();
      }
    }
  }, [id, offlineMode]);

  const loadFromOfflineStorage = () => {
    if (!id) return;
    
    const offlineData = loadOfflineEventData(id);
    if (offlineData) {
      // Add tenant_id: null and pdf_theme: null for compatibility
      setEvent({ ...offlineData.event, tenant_id: null, pdf_theme: (offlineData.event as any).pdf_theme || null } as Event);
      
      // Convert offline data to SongAudio format
      const offlineAudios: SongAudio[] = offlineData.audios.map(audio => {
        const song = offlineData.songs.find(s => s.id === audio.song_id);
        const eventSong = offlineData.eventSongs.find(es => es.song_id === audio.song_id);
        const typeSlug = eventSong?.type || song?.type || 'outro';
        const typeInfo = defaultTypeLabels[typeSlug] || defaultTypeLabels['outro'];
        
        return {
          id: audio.id,
          song_id: audio.song_id,
          event_song_id: eventSong?.id,
          naipe: audio.naipe,
          audio_url: audio.audio_url,
          name: audio.name,
          song_name: song?.name || 'Música',
          song_type_slug: typeSlug,
          song_type_name: typeInfo.name,
          song_type_order: typeInfo.order,
          song_lyrics: song?.lyrics || null,
          song_chords: song?.chords || null,
          song_sheet_music_pdf_url: song?.sheet_music_pdf_url || null
        };
      });
      
      const sortedAudios = sortByTypeOrder(offlineAudios);
      setAudios(sortedAudios);
      setSongs(offlineData.songs);
      setLoading(false);
      
      // Preload cached URLs for faster playback
      preloadCachedUrls(sortedAudios);
      
      toast.info('Carregado do armazenamento offline');
    } else {
      // If no offline data, try to fetch from network
      if (navigator.onLine) {
        fetchEventData();
      } else {
        setLoading(false);
        toast.error('Evento não disponível offline');
      }
    }
  };

  const fetchEventData = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, location, cover_image_url, tenant_id, pdf_theme')
        .eq('id', id)
        .single();
      
      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch song types (all types, prioritize tenant-specific ones)
      const { data: songTypesData } = await supabase
        .from('song_types')
        .select('id, slug, name, order_index, tenant_id')
        .order('order_index');
      
      // Build map with tenant-specific types taking priority
      const songTypesMap: Record<string, SongType> = {};
      (songTypesData || []).forEach((st: any) => {
        // Only override if this is tenant-specific or no entry exists
        if (st.tenant_id === eventData.tenant_id || !songTypesMap[st.slug]) {
          songTypesMap[st.slug] = st;
        }
      });

      // Fetch event songs with order_index for event-specific ordering
      const { data: eventSongsData, error: eventSongsError } = await supabase
        .from('event_songs')
        .select(`
          id,
          order_index,
          type,
          songs (id, name, type, lyrics, chords, sheet_music_pdf_url)
        `)
        .eq('event_id', id)
        .order('order_index');
      
      if (eventSongsError) throw eventSongsError;

      // Get song IDs
      const songIds = eventSongsData.map((es: any) => es.songs.id);

      // Fetch audios for these songs
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .in('song_id', songIds);
      
      if (audiosError) throw audiosError;

      // Map audios with song info - use event_songs.type if available, otherwise songs.type
      const mappedAudios: SongAudio[] = (audiosData || []).map((audio: any) => {
        const eventSong = eventSongsData.find((es: any) => es.songs.id === audio.song_id);
        // Use event-specific type if set, otherwise use song's default type
        const typeSlug = eventSong?.type || eventSong?.songs?.type || '';
        const songType = songTypesMap[typeSlug];
        const defaultType = defaultTypeLabels[typeSlug];
        
        return {
          ...audio,
          event_song_id: eventSong?.id,
          song_name: eventSong?.songs?.name || 'Música',
          song_type_slug: typeSlug,
          song_type_name: defaultType?.name || songType?.name || typeSlug,
          song_type_order: songType?.order_index ?? defaultType?.order ?? 999,
          song_lyrics: eventSong?.songs?.lyrics || null,
          song_chords: eventSong?.songs?.chords || null,
          song_sheet_music_pdf_url: eventSong?.songs?.sheet_music_pdf_url || null,
          event_order_index: eventSong?.order_index ?? 999
        };
      });

      // Find songs without audios and create placeholder entries for them
      const songsWithAudios = new Set((audiosData || []).map((a: any) => a.song_id));
      const songsWithoutAudios: SongAudio[] = eventSongsData
        .filter((es: any) => !songsWithAudios.has(es.songs.id))
        .map((es: any) => {
          const typeSlug = es.type || es.songs?.type || '';
          const songType = songTypesMap[typeSlug];
          const defaultType = defaultTypeLabels[typeSlug];
          
          return {
            id: `no-audio-${es.songs.id}`,
            song_id: es.songs.id,
            event_song_id: es.id,
            naipe: '',
            audio_url: '',
            name: '',
            song_name: es.songs?.name || 'Música',
            song_type_slug: typeSlug,
            song_type_name: defaultType?.name || songType?.name || typeSlug,
            song_type_order: songType?.order_index ?? defaultType?.order ?? 999,
            song_lyrics: es.songs?.lyrics || null,
            song_chords: es.songs?.chords || null,
            song_sheet_music_pdf_url: es.songs?.sheet_music_pdf_url || null,
            event_order_index: es.order_index ?? 999
          };
        });

      // Map songs for PDF export and reordering
      const mappedSongs = eventSongsData.map((es: any) => {
        const typeSlug = es.type || es.songs?.type || '';
        const songType = songTypesMap[typeSlug];
        const defaultType = defaultTypeLabels[typeSlug];
        return {
          ...es.songs,
          event_song_id: es.id, // ID from event_songs table for reordering
          type: typeSlug,
          typeName: songType?.name || defaultType?.name || typeSlug,
          typeOrder: songType?.order_index ?? defaultType?.order ?? 999,
          order_index: es.order_index
        };
      });

      // Build type labels map for ReorderSongsSheet
      const labelsMap: Record<string, string> = {};
      Object.entries(songTypesMap).forEach(([slug, st]) => {
        labelsMap[slug] = st.name;
      });
      setTypeLabels(labelsMap);

      setSongs(mappedSongs);
      // Combine audios with songs that have no audios
      const allItems = [...mappedAudios, ...songsWithoutAudios];
      setAudios(sortByTypeOrder(allItems));
    } catch (error) {
      console.error('Error fetching event data:', error);
      toast.error('Erro ao carregar dados do evento');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedNaipes([]);
    setSearchQuery('');
  };

  const toggleNaipeFilter = (naipe: string) => {
    setSelectedNaipes((prev) => {
      const next = prev.includes(naipe)
        ? prev.filter((item) => item !== naipe)
        : [...prev, naipe];

      return [...next].sort(
        (a, b) =>
          MAIN_NAIPE_FILTERS.indexOf(a as typeof MAIN_NAIPE_FILTERS[number]) -
          MAIN_NAIPE_FILTERS.indexOf(b as typeof MAIN_NAIPE_FILTERS[number])
      );
    });
  };

  const handleSeek = useCallback((value: number[]) => {
    seek(value[0]);
  }, [seek]);

  const handleDownload = async (audio: SongAudio) => {
    try {
      const response = await fetch(audio.audio_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${audio.song_name} - ${normalizeNaipeAlias(audio.naipe)}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download iniciado!');
    } catch (error) {
      toast.error('Erro ao baixar áudio');
    }
  };

  const handleDownloadAllAudios = async () => {
    if (audios.length === 0 || !event) return;
    
    setIsDownloadingAll(true);
    const toastId = toast.loading('Preparando download de todos os áudios...');
    
    try {
      const { exportEventZIP } = await import('@/utils/exportEventZIP');
      
      // Map to Track interface required by exportEventZIP
      const tracks = audios.map(a => ({
        id: a.id,
        songId: a.song_id,
        songName: a.song_name,
        songType: a.song_type_slug,
        naipe: normalizeNaipeAlias(a.naipe),
        url: a.audio_url
      }));

      // If naipes are selected, the ZIP utility will label it accordingly
      const naipeLabel = selectedNaipes.length === 1 ? selectedNaipes[0] : 'todos';
      
      await exportEventZIP(event.name, tracks, naipeLabel);
      toast.dismiss(toastId);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      toast.error('Erro ao gerar arquivo ZIP', { id: toastId });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleShareWhatsApp = async (audio: SongAudio) => {
    toast.info('Preparando link curto...');
    await shareCompleteToWhatsApp(
      audio.song_name,
      audio.audio_url,
      audio.song_sheet_music_pdf_url || undefined,
      normalizeNaipeAlias(audio.naipe)
    );
  };

  const handleOpenLyrics = (audio: SongAudio) => {
    setSelectedAudio(audio);
    setLyricsModalOpen(true);
  };

  const handleOpenChords = (audio: SongAudio) => {
    setSelectedAudio(audio);
    setChordsModalOpen(true);
  };

  const handleOpenSheetMusic = (audio: SongAudio) => {
    if (audio.song_sheet_music_pdf_url) {
      setSheetMusicUrl(audio.song_sheet_music_pdf_url);
      setSheetSongName(audio.song_name);
      setSheetViewerOpen(true);
    }
  };

  const handleExportSongBooklet = async (options: LyricsExportOptions) => {
    if (!event || songs.length === 0) return;
    saveExportPreferences(options);
    setExportingLyrics(true);
    try {
      const { exportSongBookletPDF } = await import('@/utils/exportSongBookletPDF');
      
      // Get tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name, logo_url')
        .eq('id', (event as any).tenant_id)
        .single();
      
      await exportSongBookletPDF(event, songs, tenantData || undefined, options);
      toast.success('Livreto de cantos gerado!');
      setShowExportLyricsDialog(false);
    } catch (error) {
      console.error('Error exporting song booklet:', error);
      toast.error('Erro ao gerar livreto de cantos');
    } finally {
      setExportingLyrics(false);
    }
  };

  const handleExportChordBooklet = async () => {
    if (!event || songs.length === 0) return;
    setExportingChords(true);
    try {
      const { exportChordBookletPDF } = await import('@/utils/exportChordBookletPDF');
      
      // Get tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name, logo_url')
        .eq('id', (event as any).tenant_id)
        .single();
      
      await exportChordBookletPDF(event, songs, tenantData || undefined);
      toast.success('Livreto de cifras gerado!');
    } catch (error) {
      console.error('Error exporting chord booklet:', error);
      toast.error('Erro ao gerar livreto de cifras');
    } finally {
      setExportingChords(false);
    }
  };

  // Navigation handlers for admin actions
  const handleEditEvent = () => {
    navigate(buildPath(`/events/${id}/edit`));
  };

  const handleAddSong = () => {
    fetchAvailableSongs();
    fetchSongTypesForModal();
    setAddSongModalOpen(true);
  };

  const fetchAvailableSongs = async () => {
    if (!event?.tenant_id) return;
    setLoadingAvailableSongs(true);
    try {
      // Fetch songs from all tenants the user belongs to (RLS handles access)
      const { data, error } = await supabase
        .from('songs')
        .select('id, name, type, tenant_id')
        .order('name');
      
      if (error) throw error;
      
      // Filter out songs already in the event
      const eventSongIds = new Set(songs.map(s => s.id));
      const filtered = (data || []).filter(s => !eventSongIds.has(s.id));
      setAvailableSongs(filtered);
    } catch (error) {
      console.error('Error fetching songs:', error);
      toast.error('Erro ao carregar músicas');
    } finally {
      setLoadingAvailableSongs(false);
    }
  };

  const fetchSongTypesForModal = async () => {
    // Fetch all song types: tenant-specific, global (null), and shared (00000000-0000-0000-0000-000000000001)
    let query = supabase
      .from('song_types')
      .select('id, slug, name, order_index')
      .order('order_index');
    
    if (event?.tenant_id) {
      query = query.or(`tenant_id.eq.${event.tenant_id},tenant_id.is.null,tenant_id.eq.00000000-0000-0000-0000-000000000001`);
    } else {
      query = query.or(`tenant_id.is.null,tenant_id.eq.00000000-0000-0000-0000-000000000001`);
    }
    
    const { data } = await query;
    setSongTypesForModal(data || []);
  };

  const handleAddExistingSong = async () => {
    if (!id || !selectedSongId) return;
    
    const song = availableSongs.find(s => s.id === selectedSongId);
    if (!song) return;
    
    setAddingSong(true);
    try {
      const maxOrder = songs.reduce((max, s) => Math.max(max, s.order_index || 0), 0);
      
      const { error } = await supabase
        .from('event_songs')
        .insert({
          event_id: id,
          song_id: song.id,
          type: song.type || 'outro',
          order_index: maxOrder + 1
        });
      
      if (error) throw error;
      
      toast.success(`"${song.name}" adicionada ao evento`);
      setAddSongModalOpen(false);
      setAddSongSearchQuery('');
      setSelectedSongId(null);
      fetchEventData();
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error('Erro ao adicionar música');
    } finally {
      setAddingSong(false);
    }
  };

  const handleCreateNewSong = async () => {
    if (!newSongName.trim() || !event?.tenant_id) return;
    
    setIsCreatingNewSong(true);
    try {
      // Create the song
      const { data: newSong, error: createError } = await supabase
        .from('songs')
        .insert({
          name: newSongName.trim(),
          type: selectedSongType || null,
          tenant_id: event.tenant_id
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Add to the event
      const maxOrder = songs.reduce((max, s) => Math.max(max, s.order_index || 0), 0);
      
      const { error: linkError } = await supabase
        .from('event_songs')
        .insert({
          event_id: id,
          song_id: newSong.id,
          type: selectedSongType || null,
          order_index: maxOrder + 1
        });
      
      if (linkError) throw linkError;
      
      toast.success(`"${newSongName}" criada e adicionada ao evento`);
      setAddSongModalOpen(false);
      setNewSongName('');
      setSelectedSongType('');
      setAddSongSearchQuery('');
      fetchEventData();
    } catch (error) {
      console.error('Error creating song:', error);
      toast.error('Erro ao criar música');
    } finally {
      setIsCreatingNewSong(false);
    }
  };

  const handleEditSong = (songId: string) => {
    navigate(buildPath(`/songs/${songId}/edit`));
  };

  const openTypeEditModal = async (audio: SongAudio) => {
    if (!songTypesForModal.length) {
      await fetchSongTypesForModal();
    }
    setAudioForTypeEdit(audio);
    setSelectedTypeForEdit(audio.song_type_slug || '');
    setEditTypeModalOpen(true);
  };

  const handleSaveTypeForEvent = async () => {
    if (!audioForTypeEdit || !selectedTypeForEdit || !id) return;

    setSavingTypeForEvent(true);
    try {
      const baseQuery = supabase.from('event_songs').update({ type: selectedTypeForEdit });
      const { error } = audioForTypeEdit.event_song_id
        ? await baseQuery.eq('id', audioForTypeEdit.event_song_id)
        : await baseQuery.eq('event_id', id).eq('song_id', audioForTypeEdit.song_id);

      if (error) throw error;

      const selectedType = songTypesForModal.find((t) => t.slug === selectedTypeForEdit);
      const defaultType = defaultTypeLabels[selectedTypeForEdit];
      const typeName = selectedType?.name || defaultType?.name || selectedTypeForEdit;
      const typeOrder = selectedType?.order_index ?? defaultType?.order ?? 999;

      setAudios((prev) =>
        sortByTypeOrder(
          prev.map((a) => {
            const sameEventSong = audioForTypeEdit.event_song_id
              ? a.event_song_id === audioForTypeEdit.event_song_id
              : a.song_id === audioForTypeEdit.song_id;

            if (!sameEventSong) return a;

            return {
              ...a,
              song_type_slug: selectedTypeForEdit,
              song_type_name: typeName,
              song_type_order: typeOrder,
            };
          })
        )
      );

      setSongs((prev) =>
        prev.map((s) => {
          const sameEventSong = audioForTypeEdit.event_song_id
            ? (s.event_song_id || s.id) === audioForTypeEdit.event_song_id
            : s.id === audioForTypeEdit.song_id;
          return sameEventSong ? { ...s, type: selectedTypeForEdit, typeName, typeOrder } : s;
        })
      );

      setSelectedAudio((prev) =>
        prev && prev.song_id === audioForTypeEdit.song_id
          ? {
              ...prev,
              song_type_slug: selectedTypeForEdit,
              song_type_name: typeName,
              song_type_order: typeOrder,
            }
          : prev
      );

      toast.success('Tipo atualizado neste evento');
      setEditTypeModalOpen(false);
    } catch (error) {
      console.error('Error updating event song type:', error);
      toast.error('Erro ao atualizar tipo no evento');
    } finally {
      setSavingTypeForEvent(false);
    }
  };

  const openNaipeEditModal = (audio: SongAudio) => {
    setAudioForNaipeEdit(audio);
    setSelectedNaipeForEdit(normalizeNaipeAlias(audio.naipe));
    setEditNaipeModalOpen(true);
  };

  const handleSaveNaipeForAudio = async () => {
    if (!audioForNaipeEdit || !selectedNaipeForEdit) return;

    setSavingNaipeForAudio(true);
    try {
      const { error } = await supabase
        .from('song_audios')
        .update({ naipe: selectedNaipeForEdit })
        .eq('id', audioForNaipeEdit.id);

      if (error) throw error;

      setAudios((prev) =>
        sortByTypeOrder(
          prev.map((a) =>
            a.id === audioForNaipeEdit.id
              ? {
                  ...a,
                  naipe: selectedNaipeForEdit,
                }
              : a
          )
        )
      );

      setSelectedAudio((prev) =>
        prev && prev.id === audioForNaipeEdit.id
          ? {
              ...prev,
              naipe: selectedNaipeForEdit,
            }
          : prev
      );

      toast.success('Naipe do áudio atualizado');
      setEditNaipeModalOpen(false);
    } catch (error) {
      console.error('Error updating audio naipe:', error);
      toast.error('Erro ao atualizar naipe do áudio');
    } finally {
      setSavingNaipeForAudio(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!songToDelete) return;
    
    setDeletingSongId(songToDelete.song_id);
    try {
      // Remove song from event_songs
      const { error } = await supabase
        .from('event_songs')
        .delete()
        .eq('event_id', id)
        .eq('song_id', songToDelete.song_id);
      
      if (error) throw error;
      
      toast.success('Música removida do evento');
      // Refresh data
      fetchEventData();
    } catch (error) {
      console.error('Error removing song:', error);
      toast.error('Erro ao remover música');
    } finally {
      setDeletingSongId(null);
      setSongToDelete(null);
    }
  };

  // Global cleanup moved to context
  useEffect(() => {
    return () => {
      // Local cleanup for this page if needed
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Evento não encontrado</p>
      </div>
    );
  }

  const ogImageUrl = event.cover_image_url || `${window.location.origin}/favicon.png`;
  const formattedDate = format(parseDateOnlyLocal(event.date), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <Helmet>
        <title>{event.name} - Áudios</title>
        <meta property="og:title" content={event.name} />
        <meta property="og:description" content={`${formattedDate}${event.location ? ` - ${event.location}` : ''} • ${audios.length} áudios`} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.name} />
        <meta name="twitter:description" content={`${formattedDate}${event.location ? ` - ${event.location}` : ''} • ${audios.length} áudios`} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Offline Mode Banner */}
        {offlineMode && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
            <div className="max-w-2xl mx-auto flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <CloudDownload className="h-4 w-4 shrink-0" />
              <p className="text-xs font-medium">
                Modo Offline - Dados carregados do armazenamento local
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-[#111111] px-4 py-6">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="absolute inset-0 h-[230px] w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 h-[230px] w-full bg-gradient-to-br from-[#1b63e6]/30 via-[#111111] to-[#111111]" />
          )}
          <div className="absolute inset-0 h-[230px] bg-gradient-to-b from-black/30 via-black/65 to-[#111111]" />
          <div className="absolute inset-x-0 top-[220px] h-14 bg-black/70 blur-3xl" />
          <div className="relative flex items-start gap-4 max-w-2xl mx-auto">
            {/* Back button - only show when accessed internally */}
            {isInternalAccess && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 -ml-2 rounded-full bg-black/35 text-white hover:bg-black/60"
                onClick={handleGoBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="h-16 w-16 shrink-0 rounded-lg shadow-lg overflow-hidden bg-gradient-to-br from-primary/45 to-primary/25 flex items-center justify-center ring-1 ring-white/20">
              {event.cover_image_url ? (
                <img 
                  src={event.cover_image_url} 
                  alt={event.name} 
                  className="h-full w-full object-cover" 
                />
              ) : (
                <Music className="h-8 w-8 text-primary/70" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-8 pt-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white leading-[1.08] tracking-tight">
                  {event.name}
                </h1>
              </div>
              <p className="mt-1 text-xs text-white/75">
                {formattedDate}{event.location ? ` - ${event.location}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-white/80">
                  {audios.length} audio{audios.length !== 1 ? 's' : ''}
                </p>
                {isEventSaved && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-200">
                    <CheckCircle className="h-3 w-3" />
                    Offline
                  </span>
                )}
                {isSyncing && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronizando
                  </span>
                )}
              </div>
              <button
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-white/60 hover:text-white/90 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const slug = tenantSlug || (event as any).tenant_slug;
                  const publicUrl = slug
                    ? `${window.location.origin}/${slug}/public/events/${event.id}`
                    : `${window.location.origin}/e/${event.id}`;
                  navigator.clipboard.writeText(publicUrl).then(() => {
                    toast.success('Link copiado!');
                  }).catch(() => {
                    toast.error('Erro ao copiar link');
                  });
                }}
              >
                <Link className="h-3.5 w-3.5" />
                Copiar link do evento
              </button>
            </div>
            
            {/* Options dropdown - positioned top right */}
            <div className="absolute top-0 right-0 flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/35 text-white hover:bg-black/60"
                    disabled={exportingLyrics || exportingChords || isDownloadingAll}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  {/* Admin Actions */}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={handleEditEvent}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Evento
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(buildPath(`/events/${event.id}/rehearsals`))}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Ensaios do Evento
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleAddSong}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Música
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowReorderSheet(true)}>
                        <ListOrdered className="mr-2 h-4 w-4" />
                        Reordenar Músicas
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {!isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => navigate(buildPath(`/events/${event.id}/rehearsals`))}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Ensaios do Evento
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* Save Offline Option */}
                  {isEventSaved ? (
                    <>
                      {/* Sync option when saved offline */}
                      <DropdownMenuItem 
                        onClick={async () => {
                          if (id && isOnline) {
                            toast.info('Sincronizando evento...');
                            const success = await syncSingleEvent(id);
                            if (success) {
                              toast.success('Evento sincronizado!');
                              // Reload data after sync
                              fetchEventData();
                            } else {
                              toast.error('Falha ao sincronizar');
                            }
                          }
                        }}
                        disabled={isSyncing || !isOnline}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={removeEventOffline}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover offline
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => setSaveOfflineDialogOpen(true)}>
                      <CloudDownload className="mr-2 h-4 w-4" />
                      Salvar offline
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />

                  <DropdownMenuItem 
                    onClick={handleDownloadAllAudios} 
                    disabled={isDownloadingAll || audios.length === 0}
                  >
                    {isDownloadingAll ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileArchive className="mr-2 h-4 w-4" />
                    )}
                    Baixar Áudios
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => {
                    if (!event) return;
                    
                    // Importar função de compartilhamento
                    import('@/utils/whatsappShare').then(({ shareEventSongsToWhatsApp }) => {
                      // Agrupar áudios por song_id mantendo ordem
                      const songMap = new Map<string, {
                        songName: string;
                        typeName: string;
                        lyrics: string | null;
                        sheetMusicUrl: string | null;
                        audios: { naipe: string; audioUrl: string }[];
                      }>();
                      
                      const orderedSongIds: string[] = [];
                      
                      audios.forEach(audio => {
                        if (!songMap.has(audio.song_id)) {
                          // Buscar dados da música
                          const song = songs.find(s => s.id === audio.song_id);
                          songMap.set(audio.song_id, {
                            songName: audio.song_name,
                            typeName: audio.song_type_name || 'Música',
                            lyrics: song?.lyrics || null,
                            sheetMusicUrl: song?.sheet_music_pdf_url || song?.sheet_music_url || null,
                            audios: []
                          });
                          orderedSongIds.push(audio.song_id);
                        }
                        songMap.get(audio.song_id)!.audios.push({
                          naipe: normalizeNaipeAlias(audio.naipe),
                          audioUrl: audio.audio_url
                        });
                      });
                      
                      const songsForShare = orderedSongIds.map(id => {
                        const song = songMap.get(id)!;
                        return {
                          songName: song.songName,
                          typeName: song.typeName,
                          lyrics: song.lyrics,
                          sheetMusicUrl: song.sheetMusicUrl,
                          audiosByNaipe: song.audios
                        };
                      });
                      
                      shareEventSongsToWhatsApp(event.name, songsForShare);
                    });
                  }}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Compartilhar
                  </DropdownMenuItem>
                  {songs.length > 0 && (
                    <>
                      <DropdownMenuItem onClick={async () => {
                        if (!event) return;
                        try {
                          const { exportEventPDF } = await import('@/utils/exportEventPDF');
                          const songsWithSheets = songs.filter(s => s.sheet_music_pdf_url || s.sheet_music_url);
                          if (songsWithSheets.length === 0) {
                            toast.error('Nenhuma partitura disponível');
                            return;
                          }

                          // Sempre priorizar o tenant do evento (evita usar a logo errada quando o usuário está em outro tenant)
                          let tenantInfo: { name: string; logo_url: string | null } | undefined;
                          if ((event as any).tenant_id) {
                            const { data } = await supabase
                              .from('tenants')
                              .select('name, logo_url')
                              .eq('id', (event as any).tenant_id)
                              .single();
                            tenantInfo = data || undefined;
                          } else if (tenant) {
                            tenantInfo = { name: tenant.name, logo_url: tenant.logo_url };
                          }

                          await exportEventPDF(event, songsWithSheets, tenantInfo);
                        } catch (error) {
                          console.error('Erro ao exportar PDF de partituras:', error);
                          toast.error('Erro ao exportar PDF de partituras');
                        }
                      }}>
                        <FileText className="mr-2 h-4 w-4" />
                        Partituras (PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowExportLyricsDialog(true)} disabled={exportingLyrics}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Letras
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportChordBooklet} disabled={exportingChords}>
                        <Guitar className="mr-2 h-4 w-4" />
                        Cifras
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Audio List */}
        <div className="px-4 py-3 max-w-2xl mx-auto pb-24">
          <div className="mb-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar música, tipo ou voz..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 pr-3"
              />
            </div>
            <div className="grid w-full grid-cols-4 h-9 rounded-xl bg-white/5 border border-white/10 p-0.5 gap-1">
              {MAIN_NAIPE_FILTERS.map((naipe) => {
                const isSelected = selectedNaipes.includes(naipe);
                const selectedClasses =
                  naipe === 'soprano'
                    ? 'bg-pink-500 text-white'
                    : naipe === 'contralto'
                      ? 'bg-yellow-500 text-black'
                      : naipe === 'tenor'
                        ? 'bg-green-500 text-black'
                        : 'bg-blue-500 text-white';

                return (
                  <button
                    key={naipe}
                    type="button"
                    onClick={() => toggleNaipeFilter(naipe)}
                    aria-pressed={isSelected}
                    className={`text-xs capitalize rounded-lg transition-colors ${
                      isSelected
                        ? selectedClasses
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {naipe}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Active filters indicator */}
          {(searchQuery || selectedNaipes.length > 0) && (
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {filteredAudios.length} {filteredAudios.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
              {(searchQuery || selectedNaipes.length > 0) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          {audios.length === 0 ? (
            <Card className="p-8 text-center">
              <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma música cadastrada</p>
            </Card>
          ) : filteredAudios.length === 0 ? (
            <Card className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum resultado encontrado</p>
              <Button 
                variant="link" 
                className="mt-2"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAudios.map((audio, index) => {
                const hasAudio = audio.audio_url !== '';
                const isActive = hasAudio && currentTrack?.id === audio.id;
                const isActuallyPlaying = isActive && isPlaying;
                const rememberedProgress = trackProgress[audio.id];
                const displayedCurrentTime = isActive
                  ? currentTime
                  : (rememberedProgress?.currentTime ?? 0);
                const displayedDuration = isActive
                  ? duration
                  : (rememberedProgress?.duration ?? 0);
                const shouldShowProgress =
                  hasAudio &&
                  displayedDuration > 0 &&
                  (isActive || displayedCurrentTime > 0);
                const isFirstInSongGroup = index === 0 || filteredAudios[index - 1]?.song_id !== audio.song_id;
                const normalizedAudioNaipe = normalizeNaipeAlias(audio.naipe);
                
                return (
                  <div key={audio.id} className="space-y-2">
                    {isFirstInSongGroup && (
                      <div className="px-1 pt-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {songGroupNumberBySongId[audio.song_id]}. {audio.song_name}
                        </p>
                      </div>
                    )}
                    <Card 
                    className={`border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06] ${isActive ? 'ring-1 ring-primary/30 bg-primary/10' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Play Button or Music Icon */}
                      {hasAudio ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20"
                          onClick={() => handlePlay(audio)}
                          disabled={isPlayerLoading && !isActive}
                        >
                          {isPlayerLoading && isActive ? (
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          ) : isActuallyPlaying ? (
                            <Pause className="h-5 w-5 text-primary" />
                          ) : (
                            <Play className="h-5 w-5 text-primary ml-0.5" />
                          )}
                        </Button>
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                          <Music className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="font-medium text-sm text-foreground leading-tight break-words line-clamp-2">
                            {audio.song_type_name}
                          </p>
                          {hasAudio ? (
                            <Badge 
                              variant={normalizedAudioNaipe === 'todos' ? "secondary" : "outline"}
                              className={`h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider pointer-events-none ${
                                normalizedAudioNaipe === 'soprano' ? 'border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/5' :
                                normalizedAudioNaipe === 'contralto' ? 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5' :
                                normalizedAudioNaipe === 'tenor' ? 'border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5' :
                                normalizedAudioNaipe === 'baixo' ? 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5' :
                                normalizedAudioNaipe === 'todos' ? 'border-violet-400/50 text-violet-700 dark:text-violet-300 bg-violet-500/10' :
                                'border-primary/40 text-primary bg-primary/5'
                              }`}
                            >
                              {NAIPE_DISPLAY_LABELS[normalizedAudioNaipe] || normalizedAudioNaipe}
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline"
                              className="h-4 px-1.5 text-[9px] font-medium uppercase tracking-wider pointer-events-none text-muted-foreground border-muted-foreground/30"
                            >
                              Sem áudio
                            </Badge>
                          )}
                          {hasAudio && isCached(audio.audio_url) && (
                            <span title="Disponível offline" className="flex shrink-0">
                              <Check className="h-3 w-3 text-green-500" />
                            </span>
                          )}
                          {hasAudio && currentTrack?.id === audio.id && repeatMode === 'track' && (
                            <span title="Repetindo esta música" className="flex shrink-0">
                              <Repeat1 className="h-3 w-3 text-primary" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2 break-words">
                          {audio.song_name}
                        </p>
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          {audio.song_lyrics && (
                            <DropdownMenuItem onClick={() => handleOpenLyrics(audio)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Ver letra
                            </DropdownMenuItem>
                          )}
                          {audio.song_chords && (
                            <DropdownMenuItem onClick={() => handleOpenChords(audio)}>
                              <Guitar className="mr-2 h-4 w-4" />
                              Ver cifra
                            </DropdownMenuItem>
                          )}
                          {audio.song_sheet_music_pdf_url && (
                            <DropdownMenuItem onClick={() => handleOpenSheetMusic(audio)}>
                              <Music2 className="mr-2 h-4 w-4" />
                              Ver partitura
                            </DropdownMenuItem>
                          )}
                          {(audio.song_lyrics || audio.song_chords || audio.song_sheet_music_pdf_url) && <DropdownMenuSeparator />}
                          {hasAudio && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => {
                                  // Se a música atual não está tocando ou é outra, primeiro seleciona ela
                                  if (currentTrack?.id !== audio.id) {
                                    handlePlay(audio);
                                  }
                                  // Ativa/desativa repetição individual
                                  if (repeatMode !== 'track') {
                                    // Precisamos ativar repeat mode 'track'
                                    // toggleRepeat vai de off -> playlist -> track -> off
                                    // então precisamos chamar até chegar em 'track'
                                    if (repeatMode === 'off') {
                                      toggleRepeat(); // off -> playlist
                                      setTimeout(() => toggleRepeat(), 50); // playlist -> track
                                    } else if (repeatMode === 'playlist') {
                                      toggleRepeat(); // playlist -> track
                                    }
                                  } else {
                                    toggleRepeat(); // track -> off
                                  }
                                }}
                              >
                                <Repeat1 className={`mr-2 h-4 w-4 ${currentTrack?.id === audio.id && repeatMode === 'track' ? 'text-primary' : ''}`} />
                                {currentTrack?.id === audio.id && repeatMode === 'track' ? 'Desativar Repetição' : 'Repetir Música'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleShareWhatsApp(audio)}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Enviar por WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(audio)}>
                                <Download className="mr-2 h-4 w-4" />
                                Baixar
                              </DropdownMenuItem>
                            </>
                          )}
                          {isAdmin && (
                            <>
                              {hasAudio && <DropdownMenuSeparator />}
                              {hasAudio && (
                                <DropdownMenuItem onClick={() => openNaipeEditModal(audio)}>
                                  <Music className="mr-2 h-4 w-4" />
                                  Alterar naipe do áudio
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openTypeEditModal(audio)}>
                                <ListOrdered className="mr-2 h-4 w-4" />
                                Alterar tipo no evento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditSong(audio.song_id)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar Música
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setSongToDelete(audio)}
                                className="text-destructive focus:text-destructive"
                                disabled={deletingSongId === audio.song_id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover do Evento
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Progress Bar - Shows when active (playing or paused) */}
                    {shouldShowProgress && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                          {formatTime(displayedCurrentTime)}
                        </span>
                        <Slider
                          value={[displayedCurrentTime]}
                          max={displayedDuration}
                          step={0.1}
                          onValueChange={handleSeek}
                          onPointerDown={() => setIsSeeking(true)}
                          onPointerUp={() => setIsSeeking(false)}
                          disabled={!isActive}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-10">
                          {formatTime(displayedDuration)}
                        </span>
                      </div>
                    )}
                  </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lyrics Modal - Full screen on mobile, large on desktop */}
        <Dialog open={lyricsModalOpen} onOpenChange={setLyricsModalOpen}>
          <DialogContent className="max-w-2xl w-[95vw] h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
            {/* Header with gradient background */}
            <DialogHeader className="relative px-5 py-4 shrink-0 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
                    {selectedAudio?.song_type_name}
                  </p>
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                    {selectedAudio?.song_name}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>
            
            {/* Lyrics content with better typography */}
            <ScrollArea className="flex-1 overflow-auto">
              <div className="px-5 py-6 sm:px-8 sm:py-8">
                {selectedAudio?.song_lyrics ? (
                  <div className="whitespace-pre-wrap text-base sm:text-lg leading-[1.9] text-foreground/90 font-normal tracking-wide">
                    {selectedAudio.song_lyrics.split('\n').map((line, index) => {
                      const trimmed = line.trim();
                      
                      // Empty lines
                      if (!trimmed) {
                        return <div key={index} className="h-4" />;
                      }
                      
                      // Refrain markers [REFRÃO] or R:
                      if (/^\[REFR(?:ÃO|AO)\]$/i.test(trimmed) || /^\[\/REFR(?:ÃO|AO)\]$/i.test(trimmed)) {
                        return null;
                      }
                      
                      if (/^(R:|REFRÃO:|REFRAO:|REF:)/i.test(trimmed)) {
                        return (
                          <p key={index} className="font-bold text-primary mt-4 mb-2 text-base sm:text-lg">
                            {trimmed}
                          </p>
                        );
                      }
                      
                      // Numbered verses
                      const numberedVerse = /^(\d+)\.\s*(.*)/.exec(trimmed);
                      if (numberedVerse) {
                        return (
                          <p key={index} className="mt-4 first:mt-0">
                            <span className="font-bold text-primary">{numberedVerse[1]}.</span>
                            <span className="ml-1">{numberedVerse[2]}</span>
                          </p>
                        );
                      }
                      
                      // Regular lines
                      return (
                        <p key={index} className="leading-[1.9]">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-40" />
                    <p className="text-base">Letra não disponível</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
          </DialogContent>
        </Dialog>

        {/* Fullscreen Chords Viewer */}
        {chordsModalOpen && selectedAudio?.song_chords && (
          <FullscreenChordViewer
            chords={selectedAudio.song_chords}
            songName={selectedAudio.song_name}
            songId={selectedAudio.song_id}
            onClose={() => setChordsModalOpen(false)}
            defaultNightMode={true}
          />
        )}

        {/* Sheet Music Viewer */}
        {sheetViewerOpen && sheetMusicUrl && (
          <SimpleSheetViewer
            sheetMusicUrl={sheetMusicUrl}
            songName={sheetSongName}
            onClose={() => {
              setSheetViewerOpen(false);
              setSheetMusicUrl(null);
            }}
          />
        )}

        {/* Edit Event Type Dialog */}
        <Dialog open={editTypeModalOpen} onOpenChange={setEditTypeModalOpen}>
          <DialogContent className="w-[90vw] max-w-sm">
            <DialogHeader>
              <DialogTitle>Alterar tipo no evento</DialogTitle>
              <DialogDescription>
                Essa alteração vale apenas para este evento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground truncate">
                {audioForTypeEdit?.song_name}
              </p>
              <Select value={selectedTypeForEdit} onValueChange={setSelectedTypeForEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {songTypesForModal.map((type) => (
                    <SelectItem key={type.slug} value={type.slug}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditTypeModalOpen(false)}
                disabled={savingTypeForEvent}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveTypeForEvent}
                disabled={savingTypeForEvent || !selectedTypeForEdit}
              >
                {savingTypeForEvent ? 'Salvando...' : 'Salvar tipo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Audio Naipe Dialog */}
        <Dialog open={editNaipeModalOpen} onOpenChange={setEditNaipeModalOpen}>
          <DialogContent className="w-[90vw] max-w-sm">
            <DialogHeader>
              <DialogTitle>Alterar naipe do áudio</DialogTitle>
              <DialogDescription>
                Essa alteração vale apenas para este áudio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground truncate">
                {audioForNaipeEdit?.song_name}
              </p>
              <Select value={selectedNaipeForEdit} onValueChange={setSelectedNaipeForEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o naipe" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIO_NAIPE_OPTIONS.map((naipe) => (
                    <SelectItem key={naipe} value={naipe}>
                      {NAIPE_DISPLAY_LABELS[naipe] || naipe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditNaipeModalOpen(false)}
                disabled={savingNaipeForAudio}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveNaipeForAudio}
                disabled={savingNaipeForAudio || !selectedNaipeForEdit}
              >
                {savingNaipeForAudio ? 'Salvando...' : 'Salvar naipe'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Save Offline Dialog */}
        <SaveEventOfflineDialog
          open={saveOfflineDialogOpen}
          onOpenChange={setSaveOfflineDialogOpen}
          eventName={event.name}
          eventId={event.id}
          coverImageUrl={event.cover_image_url}
          isSaving={isSaving}
          progress={progress}
          progressText={progressText}
          onSave={saveEventOffline}
          isCompleted={isEventSaved}
        />

        {/* Delete Song Confirmation Dialog */}
        <AlertDialog open={!!songToDelete} onOpenChange={(open) => !open && setSongToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover música do evento?</AlertDialogTitle>
              <AlertDialogDescription>
                A música "{songToDelete?.song_name}" será removida deste evento. 
                A música continuará disponível no catálogo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSong}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Song Modal - using AlertDialog with Tabs like EventQuickEdit */}
        <AlertDialog
          open={addSongModalOpen}
          onOpenChange={(open) => {
            setAddSongModalOpen(open);
            if (!open) {
              setSelectedSongId(null);
              setAddSongSearchQuery('');
              setNewSongName('');
              setSelectedSongType('');
            }
          }}
        >
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Adicionar Música</AlertDialogTitle>
              <AlertDialogDescription>
                Escolha uma música existente ou crie uma nova
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Tabs defaultValue="existing" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Música Existente</TabsTrigger>
                <TabsTrigger value="new">Nova Música</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar música..."
                    value={addSongSearchQuery}
                    onChange={(e) => setAddSongSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {loadingAvailableSongs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : availableSongs.filter(s => 
                    s.name.toLowerCase().includes(addSongSearchQuery.toLowerCase())
                  ).length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      {addSongSearchQuery
                        ? 'Nenhuma música encontrada'
                        : 'Todas as músicas já foram adicionadas'}
                    </p>
                  ) : (
                    availableSongs
                      .filter(s => s.name.toLowerCase().includes(addSongSearchQuery.toLowerCase()))
                      .map((song) => (
                        <Card
                          key={song.id}
                          onClick={() => setSelectedSongId(song.id)}
                          className={`cursor-pointer p-3 transition-all ${
                            selectedSongId === song.id
                              ? 'border-primary bg-primary/10'
                              : 'hover:bg-accent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{song.name}</span>
                            {song.type && (
                              <Badge className="bg-primary/10 text-primary border-primary/30">
                                {defaultTypeLabels[song.type]?.name || song.type}
                              </Badge>
                            )}
                          </div>
                        </Card>
                      ))
                  )}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setSelectedSongId(null);
                      setAddSongSearchQuery('');
                    }}
                  >
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAddExistingSong}
                    disabled={!selectedSongId || addingSong}
                  >
                    {addingSong ? 'Adicionando...' : 'Adicionar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </TabsContent>

              <TabsContent value="new" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome da Música</label>
                    <Input
                      placeholder="Digite o nome da música"
                      value={newSongName}
                      onChange={(e) => setNewSongName(e.target.value)}
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={selectedSongType} onValueChange={setSelectedSongType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {songTypesForModal.map((type) => (
                          <SelectItem key={type.slug} value={type.slug}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setNewSongName('');
                      setSelectedSongType('');
                    }}
                  >
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCreateNewSong}
                    disabled={!newSongName.trim() || !selectedSongType || isCreatingNewSong}
                  >
                    {isCreatingNewSong ? 'Criando...' : 'Criar e Adicionar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </TabsContent>
            </Tabs>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* FAB for adding music - Admin only */}
        {isAdmin && (
          <Button
            onClick={handleAddSong}
            size="lg"
            className="fixed bottom-6 right-4 h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-40 flex items-center justify-center"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}

        {/* Export Lyrics Dialog */}
        <ExportLyricsDialog
          open={showExportLyricsDialog}
          onOpenChange={setShowExportLyricsDialog}
          onExport={handleExportSongBooklet}
          isExporting={exportingLyrics}
          initialOptions={exportPreferences}
          currentTheme={(event as any)?.pdf_theme || undefined}
        />

        {/* Reorder Songs Sheet */}
        <ReorderSongsSheet
          open={showReorderSheet}
          onOpenChange={setShowReorderSheet}
          eventId={id || ''}
          songs={songs.map((s: any) => ({
            id: s.id,
            event_song_id: s.event_song_id || s.id,
            name: s.name,
            type: s.type,
          }))}
          typeLabels={typeLabels}
          onReorderComplete={() => fetchEventData()}
        />
      </div>
    </>
  );
};

export default SimpleEventAudios;



