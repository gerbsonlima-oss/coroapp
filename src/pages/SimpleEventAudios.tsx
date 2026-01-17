import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, MoreVertical, Download, MessageCircle, Music, FileText, X, Guitar, BookOpen, Share2, CloudDownload, CheckCircle, Trash2, RefreshCw, Music2, Search, Filter, ArrowLeft, Link2, Loader2, Edit, Plus, Pencil, FileArchive } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FullscreenChordViewer from '@/components/FullscreenChordViewer';
import { SimpleSheetViewer } from '@/components/SimpleSheetViewer';
import { SaveEventOfflineDialog } from '@/components/SaveEventOfflineDialog';
import { useEventOfflineSave, loadOfflineEventData, isOfflineMode } from '@/hooks/useEventOfflineSave';
import { useAudioCache } from '@/hooks/useAudioCache';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareCompleteToWhatsApp } from '@/utils/whatsappShare';
import { Helmet } from 'react-helmet-async';
import { useTenant } from '@/contexts/TenantContext';

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
  final: { name: 'Final', order: 11 },
  outro: { name: 'Outro', order: 99 },
};

interface SongAudio {
  id: string;
  song_id: string;
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
}

interface SongType {
  id: string;
  slug: string;
  name: string;
  order_index: number;
}

const sortByTypeOrder = (audios: SongAudio[]): SongAudio[] => {
  return [...audios].sort((a, b) => {
    // First sort by song type order
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
  const location = useLocation();
  const { tenantSlug, tenant } = useTenant();
  const { isAdmin } = useIsAdmin();
  
  // Check if this is accessed from internal navigation (not shared link /e/:id)
  const isInternalAccess = !location.pathname.startsWith('/e/');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('simpleEvent_searchQuery') || '';
  });
  const [selectedNaipes, setSelectedNaipes] = useState<string[]>(() => {
    const saved = localStorage.getItem('simpleEvent_selectedNaipes');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem('simpleEvent_searchQuery', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('simpleEvent_selectedNaipes', JSON.stringify(selectedNaipes));
  }, [selectedNaipes]);

  const handleGoBack = () => {
    const basePath = tenantSlug ? `/${tenantSlug}` : '';
    navigate(`${basePath}/events`);
  };

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
  const { getCachedUrl } = useAudioCache();

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
          song_name: eventSong?.songs?.name || 'Música',
          song_type_slug: typeSlug,
          song_type_name: defaultType?.name || songType?.name || typeSlug,
          song_type_order: songType?.order_index ?? defaultType?.order ?? 999,
          song_lyrics: eventSong?.songs?.lyrics || null,
          song_chords: eventSong?.songs?.chords || null,
          song_sheet_music_pdf_url: eventSong?.songs?.sheet_music_pdf_url || null
        };
      });

      // Map songs for PDF export
      const mappedSongs = eventSongsData.map((es: any) => {
        const typeSlug = es.type || es.songs?.type || '';
        const songType = songTypesMap[typeSlug];
        const defaultType = defaultTypeLabels[typeSlug];
        return {
          ...es.songs,
          type: typeSlug,
          typeName: songType?.name || defaultType?.name || typeSlug,
          typeOrder: songType?.order_index ?? defaultType?.order ?? 999,
          order_index: es.order_index
        };
      });

      setSongs(mappedSongs);
      setAudios(sortByTypeOrder(mappedAudios));
    } catch (error) {
      console.error('Error fetching event data:', error);
      toast.error('Erro ao carregar dados do evento');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (audio: SongAudio) => {
    // If clicking the same audio that's active
    if (activeAudioId === audio.id) {
      if (playingId === audio.id) {
        // Currently playing - pause it
        audioRef.current?.pause();
        setPlayingId(null);
        setIsPaused(true);
      } else {
        // Currently paused - resume it
        audioRef.current?.play();
        setPlayingId(audio.id);
        setIsPaused(false);
      }
      return;
    }
    
    // If loading, ignore additional clicks
    if (isLoadingAudio) return;
    
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setIsLoadingAudio(true);
    setActiveAudioId(audio.id);
    setIsPaused(false);
    
    try {
      // Use preloaded URL if available, otherwise fetch from cache
      const audioUrl = preloadedUrls[audio.audio_url] || await getCachedUrl(audio.audio_url);
      const newAudio = new Audio(audioUrl);
      
      newAudio.onloadedmetadata = () => {
        setDuration(newAudio.duration);
      };
      
      newAudio.ontimeupdate = () => {
        if (!isSeeking) {
          setCurrentTime(newAudio.currentTime);
        }
      };
      
      newAudio.onended = () => {
        setPlayingId(null);
        setActiveAudioId(null);
        setIsPaused(false);
        setCurrentTime(0);
        setDuration(0);
      };
      
      newAudio.onerror = () => {
        toast.error('Erro ao reproduzir áudio. Verifique se está disponível offline.');
        setPlayingId(null);
        setActiveAudioId(null);
        setIsPaused(false);
        setCurrentTime(0);
        setDuration(0);
      };
      
      await newAudio.play();
      audioRef.current = newAudio;
      setPlayingId(audio.id);
      setCurrentTime(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('Erro ao reproduzir áudio');
      setActiveAudioId(null);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleSeek = useCallback((value: number[]) => {
    const seekTime = value[0];
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  }, []);

  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get unique naipes from audios (exclude unissono - always shown)
  const availableNaipes = useMemo(() => {
    const naipes = new Set(audios.map(a => a.naipe).filter(n => n.toLowerCase() !== 'unissono'));
    return Array.from(naipes).sort();
  }, [audios]);

  // Filter audios based on search and naipe selection (unissono always included)
  const filteredAudios = useMemo(() => {
    let result = audios;
    
    // Filter by naipes (if any selected) - always include unissono
    if (selectedNaipes.length > 0) {
      result = result.filter(a => 
        a.naipe.toLowerCase() === 'unissono' || selectedNaipes.includes(a.naipe)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.song_name.toLowerCase().includes(query) ||
        a.song_type_name.toLowerCase().includes(query) ||
        a.naipe.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [audios, selectedNaipes, searchQuery]);

  const toggleNaipe = (naipe: string) => {
    setSelectedNaipes(prev => 
      prev.includes(naipe) 
        ? prev.filter(n => n !== naipe)
        : [...prev, naipe]
    );
  };

  const clearFilters = () => {
    setSelectedNaipes([]);
    setSearchQuery('');
  };

  const handleDownload = async (audio: SongAudio) => {
    try {
      const response = await fetch(audio.audio_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${audio.song_name} - ${audio.naipe}.mp3`;
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
        naipe: a.naipe,
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
      audio.naipe
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

  const handleExportSongBooklet = async () => {
    if (!event || songs.length === 0) return;
    setExportingLyrics(true);
    try {
      const { exportSongBookletPDF } = await import('@/utils/exportSongBookletPDF');
      
      // Get tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name, logo_url')
        .eq('id', (event as any).tenant_id)
        .single();
      
      await exportSongBookletPDF(event, songs, tenantData || undefined);
      toast.success('Livreto de cantos gerado!');
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
    const basePath = tenantSlug ? `/${tenantSlug}` : '';
    navigate(`${basePath}/events/${id}/edit`);
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
      const { data, error } = await supabase
        .from('songs')
        .select('id, name, type')
        .eq('tenant_id', event.tenant_id)
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
    if (!event?.tenant_id) return;
    const { data } = await supabase
      .from('song_types')
      .select('id, slug, name, order_index')
      .or(`tenant_id.eq.${event.tenant_id},tenant_id.is.null`)
      .order('order_index');
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
    const basePath = tenantSlug ? `/${tenantSlug}` : '';
    navigate(`${basePath}/songs/${songId}/edit`);
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setCurrentTime(0);
        setDuration(0);
      }
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
  const formattedDate = format(new Date(event.date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR });

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
                Modo Offline — Dados carregados do armazenamento local
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 py-6">
          <div className="flex items-start gap-4 max-w-2xl mx-auto relative">
            {/* Back button - only show when accessed internally */}
            {isInternalAccess && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 -ml-2"
                onClick={handleGoBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="h-20 w-20 shrink-0 rounded-lg shadow-lg overflow-hidden bg-gradient-to-br from-primary/45 to-primary/25 flex items-center justify-center">
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
            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xl text-foreground leading-tight">
                  {event.name}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'wxagqywobyzntrlkhfao';
                    const ogUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/og-event?id=${id}`;
                    navigator.clipboard.writeText(ogUrl);
                    toast.success('Link copiado!');
                  }}
                  title="Copiar link do evento"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  {audios.length} áudio{audios.length !== 1 ? 's' : ''}
                </p>
                {isEventSaved && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    Offline
                  </span>
                )}
                {isSyncing && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronizando
                  </span>
                )}
              </div>
            </div>
            
            {/* Options dropdown - positioned top right */}
            <div className="absolute top-0 right-0 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDownloadAllAudios}
                disabled={isDownloadingAll || audios.length === 0}
                title="Baixar áudios"
              >
                {isDownloadingAll ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileArchive className="h-5 w-5" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
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
                      <DropdownMenuItem onClick={handleAddSong}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Música
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

                  <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar Música
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setFilterOpen(true)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrar por Voz
                  </DropdownMenuItem>
                  
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
                          naipe: audio.naipe,
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
                      <DropdownMenuItem onClick={handleExportSongBooklet} disabled={exportingLyrics}>
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
        <div className="px-4 py-2 max-w-2xl mx-auto pb-24">
          {/* Naipe Filter Chips */}
          {availableNaipes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {availableNaipes.map((naipe) => {
                const lowerNaipe = naipe.toLowerCase();
                const isActive = selectedNaipes.includes(naipe);
                const colorClasses = 
                  lowerNaipe === 'soprano' ? (isActive ? 'bg-pink-500 text-white hover:bg-pink-600' : 'border-pink-500/30 text-pink-600 hover:bg-pink-50') :
                  lowerNaipe === 'contralto' ? (isActive ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'border-yellow-500/30 text-yellow-600 hover:bg-yellow-50') :
                  lowerNaipe === 'tenor' ? (isActive ? 'bg-green-500 text-white hover:bg-green-600' : 'border-green-500/30 text-green-600 hover:bg-green-50') :
                  lowerNaipe === 'baixo' ? (isActive ? 'bg-blue-500 text-white hover:bg-blue-600' : 'border-blue-500/30 text-blue-600 hover:bg-blue-50') :
                  isActive ? 'bg-primary text-primary-foreground' : 'border-primary/30 text-primary hover:bg-primary/10';

                return (
                  <Button
                    key={naipe}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-3 text-xs font-medium rounded-full ${colorClasses}`}
                    onClick={() => toggleNaipe(naipe)}
                  >
                    {naipe}
                  </Button>
                );
              })}
              {selectedNaipes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedNaipes([])}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          
          {/* Active filters indicator */}
          {(searchQuery || selectedNaipes.length > 0) && (
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {filteredAudios.length} {filteredAudios.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar busca
                </Button>
              )}
            </div>
          )}

          {/* Search Dialog */}
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent className="w-[90vw] max-w-sm p-4 pt-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar música..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                >
                  Limpar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => setSearchOpen(false)}
                >
                  Pronto
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Filter Dialog */}
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogContent className="w-[90vw] max-w-sm p-4 pt-8">
              <DialogHeader>
                <DialogTitle className="text-base">Filtrar por voz</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 py-4">
                {availableNaipes.map((naipe) => (
                  <Button
                    key={naipe}
                    variant={selectedNaipes.includes(naipe) ? "default" : "outline"}
                    className="justify-start gap-2 h-10 px-3"
                    onClick={() => toggleNaipe(naipe)}
                  >
                    <Checkbox
                      checked={selectedNaipes.includes(naipe)}
                      className="border-current data-[state=checked]:bg-foreground data-[state=checked]:text-background"
                    />
                    <span className="truncate">{naipe}</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => {
                    setSelectedNaipes([]);
                    setFilterOpen(false);
                  }}
                >
                  Limpar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => setFilterOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {audios.length === 0 ? (
            <Card className="p-8 text-center">
              <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum áudio disponível</p>
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
              {filteredAudios.map((audio) => {
                const isPlaying = playingId === audio.id;
                const isActive = activeAudioId === audio.id;
                const isThisPaused = isActive && isPaused;
                
                return (
                  <Card 
                    key={audio.id} 
                    className={`p-3 transition-colors hover:bg-accent/50 ${isActive ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Play Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20"
                        onClick={() => handlePlay(audio)}
                        disabled={isLoadingAudio && activeAudioId !== audio.id}
                      >
                        {isLoadingAudio && activeAudioId === audio.id ? (
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-5 w-5 text-primary" />
                        ) : (
                          <Play className="h-5 w-5 text-primary ml-0.5" />
                        )}
                      </Button>

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground truncate">
                            {audio.song_type_name}
                          </p>
                          <Badge 
                            variant="secondary" 
                            className={`h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider border-none pointer-events-none ${
                              audio.naipe.toLowerCase() === 'soprano' ? 'bg-pink-500/20 text-pink-700 dark:text-pink-400' :
                              audio.naipe.toLowerCase() === 'contralto' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                              audio.naipe.toLowerCase() === 'tenor' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                              audio.naipe.toLowerCase() === 'baixo' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                              audio.naipe.toLowerCase() === 'unissono' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' :
                              'bg-primary/15 text-primary'
                            }`}
                          >
                            {audio.naipe}
                            {audio.naipe.toLowerCase() === 'unissono' && ' ★'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {audio.song_name}
                        </p>
                      </div>

                      {/* Lyrics Button */}
                      {audio.song_lyrics && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleOpenLyrics(audio)}
                          title="Ver letra"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}

                      {/* Chords Button */}
                      {audio.song_chords && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleOpenChords(audio)}
                          title="Ver cifra"
                        >
                          <Guitar className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}

                      {/* Sheet Music Button */}
                      {audio.song_sheet_music_pdf_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleOpenSheetMusic(audio)}
                          title="Ver partitura"
                        >
                          <Music2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleShareWhatsApp(audio)}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Enviar por WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(audio)}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
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
                    {isActive && duration > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                          {formatTime(currentTime)}
                        </span>
                        <Slider
                          value={[currentTime]}
                          max={duration}
                          step={0.1}
                          onValueChange={handleSeek}
                          onPointerDown={() => setIsSeeking(true)}
                          onPointerUp={() => setIsSeeking(false)}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-10">
                          {formatTime(duration)}
                        </span>
                      </div>
                    )}
                  </Card>
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
                      if (/^\[REFR[ÃA]O\]$/i.test(trimmed) || /^\[\/REFR[ÃA]O\]$/i.test(trimmed)) {
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
      </div>
    </>
  );
};

export default SimpleEventAudios;
