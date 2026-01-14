import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { SheetViewer } from '@/components/SheetViewer';
import { MusicRain } from '@/components/MusicRain';
import { EnhancedMiniPlayer } from '@/components/EnhancedMiniPlayer';
import { ArrowLeft, Plus, Download, Music, Search, Edit, Trash2, MoreVertical, Share2, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, FileText, FileArchive, ChevronDown, Sliders, Filter, Calendar, Users, Check, CheckCircle2, Volume2, VolumeX, Loader2, Upload, FileDown, Mic2, Mic, Music2, MessageCircle, Save, BookOpen, Guitar, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import FullscreenChordViewer from '@/components/FullscreenChordViewer';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioCache } from '@/hooks/useAudioCache';
import { type Track } from '@/hooks/useEventPlayer';
import { usePlayer } from '@/contexts/PlayerContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { z } from 'zod';
import { exportEventPDF } from '@/utils/exportEventPDF';
import { exportEventZIP } from '@/utils/exportEventZIP';
import { exportSongBookletPDF } from '@/utils/exportSongBookletPDF';
import { exportChordBookletPDF } from '@/utils/exportChordBookletPDF';
import { EventMembersManager } from '@/components/EventMembersManager';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  pdf_theme: string | null;
  song_sheet_url: string | null;
}
interface Song {
  id: string;
  name: string;
  type: string;
  sheet_music_url: string | null;
  sheet_music_pdf_url: string | null;
  lyrics?: string | null;
  chords?: string | null;
}
interface SongAudio {
  id: string;
  song_id: string;
  naipe: string;
  audio_url: string;
  name: string;
}
interface EventSong extends Song {
  event_song_id: string;
  audios: SongAudio[];
}
const songSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255, 'Nome muito longo'),
  type: z.string().min(1, 'Tipo é obrigatório')
});
const NAIPE_ORDER = ['soprano', 'contralto', 'tenor', 'baixo', 'unissono', 'original'];
const sortByNaipeOrder = <T extends {
  naipe: string;
},>(audios: T[]): T[] => {
  return [...audios].sort((a, b) => {
    const indexA = NAIPE_ORDER.indexOf(a.naipe.toLowerCase());
    const indexB = NAIPE_ORDER.indexOf(b.naipe.toLowerCase());
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};
const getTypeLabel = (type: string | undefined, labels: Record<string, string>) => {
  if (!type) return 'Sem tipo';
  if (labels[type]) return labels[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
const typeColors: Record<string, string> = {
  // Novos tipos
  canto_entrada: 'bg-transparent text-muted-foreground border-border',
  ato_penitencial: 'bg-transparent text-muted-foreground border-border',
  gloria: 'bg-transparent text-muted-foreground border-border',
  salmo: 'bg-transparent text-muted-foreground border-border',
  aclamacao: 'bg-transparent text-muted-foreground border-border',
  oferendas: 'bg-transparent text-muted-foreground border-border',
  santo: 'bg-transparent text-muted-foreground border-border',
  cordeiro: 'bg-transparent text-muted-foreground border-border',
  comunhao: 'bg-transparent text-muted-foreground border-border',
  acao_gracas: 'bg-transparent text-muted-foreground border-border',
  final: 'bg-transparent text-muted-foreground border-border',
  // Tipos antigos (para retrocompatibilidade)
  entrada: 'bg-transparent text-muted-foreground border-border',
  perdao: 'bg-transparent text-muted-foreground border-border',
  ofertorio: 'bg-transparent text-muted-foreground border-border',
  outro: 'bg-transparent text-muted-foreground border-border'
};
const naipeColors: Record<string, string> = {
  soprano: 'bg-primary/20 text-primary dark:text-primary/80 border-primary/30',
  contralto: 'bg-primary/20 text-primary dark:text-primary/80 border-primary/30',
  tenor: 'bg-primary/20 text-primary dark:text-primary/80 border-primary/30',
  baixo: 'bg-primary/20 text-primary dark:text-primary/80 border-primary/30',
  unissono: 'bg-primary/20 text-primary dark:text-primary/80 border-primary/30'
};

const EventDetails = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const location = useLocation();
  const isPublicView = location.pathname.startsWith('/public/');
  const {
    user
  } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const { tenantId } = useTenant();
  const { saveEvents, isEventAvailableOffline, removeEventOffline } = useOfflineStorage();
  const isOnline = useOnlineStatus();
  
  const canEdit = isAdmin || isSuperAdmin;
  const isAvailableOffline = id ? isEventAvailableOffline(id) : false;
  const [event, setEvent] = useState<Event | null>(null);
  const [songs, setSongs] = useState<EventSong[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedNaipe, setSelectedNaipe] = useState<string[]>(() => {
    const saved = localStorage.getItem('eventDetails_selectedNaipe');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [saved];
      }
    }
    return ['todas'];
  });
  const [showNaipeSelector, setShowNaipeSelector] = useState(() => {
    return !localStorage.getItem('eventDetails_selectedNaipe');
  });
  const [groupBy, setGroupBy] = useState<'musica' | 'naipe' | 'nenhum'>(() => {
    const saved = localStorage.getItem('eventDetails_groupBy');
    return (saved === 'musica' || saved === 'naipe' || saved === 'nenhum') ? saved : 'nenhum';
  });

  useEffect(() => {
    localStorage.setItem('eventDetails_selectedNaipe', JSON.stringify(selectedNaipe));
  }, [selectedNaipe]);

  useEffect(() => {
    localStorage.setItem('eventDetails_groupBy', groupBy);
  }, [groupBy]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [imageClickCount, setImageClickCount] = useState(0);
  const [showMusicRain, setShowMusicRain] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isUploadingSongSheet, setIsUploadingSongSheet] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [chordsModalOpen, setChordsModalOpen] = useState(false);
  const [selectedSongForModal, setSelectedSongForModal] = useState<EventSong | null>(null);
  const songSheetInputRef = useRef<HTMLInputElement>(null);

  const checkOfflineStatus = () => {
    if (!id) return;
    
    // Usa a mesma chave que useOfflineStorage usa para salvar
    const savedEventsJson = localStorage.getItem('offline_events');
    const savedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];
    const isSaved = savedEvents.some((e: any) => e.id === id);
    
    console.log('[Offline] Status check:', {
      eventId: id,
      isSaved,
      totalSavedEvents: savedEvents.length
    });
    
    setIsOfflineSaved(isSaved);
  };

  useEffect(() => {
    checkOfflineStatus();
  }, [id, isAvailableOffline]);

  const [coverImageSrc, setCoverImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (event?.cover_image_url) {
      const loadCover = async () => {
        const url = await getCachedUrl(event.cover_image_url!);
        setCoverImageSrc(url);
      };
      loadCover();
    }
  }, [event?.cover_image_url]);

  const handleImageClick = () => {
    setImageClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowMusicRain(true);
        return 0;
      }
      return newCount;
    });
  };

  const filteredSongs = songs.filter(song => 
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const [newSongName, setNewSongName] = useState('');
  const [newSongType, setNewSongType] = useState('');
  const [isCreatingSong, setIsCreatingSong] = useState(false);

  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [eventTypes, setEventTypes] = useState<{
    id: string;
    slug: string;
    name: string;
    order_index: number;
  }[]>([]);
  const navigate = useNavigate();
  const {
    cacheMultipleAudios,
    isLoading: isCaching,
    getCachedUrl,
    isCached,
    removeFromCache,
    progress
  } = useAudioCache();
  const trackRefs = useRef<{
    [key: number]: HTMLDivElement | null;
  }>({});

  useEffect(() => {
    if (tenantId) {
      fetchSongTypes();
    }
  }, [tenantId]);

  const fetchSongTypes = async () => {
    try {
      const { data, error } = await supabase.from('song_types').select('*').order('order_index');
      if (error) throw error;
      const labels: Record<string, string> = {};
      (data || []).forEach(type => {
        labels[type.slug] = type.name;
      });
      setTypeLabels(labels);
    } catch (error) {
      console.error('Error fetching song types:', error);
    }
  };

  const filteredPlaylist = useMemo(() => {
    if (selectedNaipe.includes('todas')) return tracks;
    if (selectedNaipe.length === 0) return [];
    
    return tracks.filter(track => {
      const audioNaipe = track.naipe.toLowerCase();
      // Sempre inclui uníssono se não estiver filtrando por "todas"
      if (audioNaipe === 'unissono') return true;

      return selectedNaipe.some(sel => {
        const target = sel.toLowerCase();
        if (target === 'música completa') return audioNaipe === 'original';
        return audioNaipe === target;
      });
    });
  }, [tracks, selectedNaipe]);

  const {
    currentTrack,
    currentTrackIndex,
    audioRef,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    currentTime,
    duration,
    isPlaying,
    repeatMode,
    isLoading,
    volume,
    isMuted,
    setPlaylist,
    showSheetViewer,
    setShowSheetViewer,
    sheetMusicSrc,
    setSheetMusicSrc
  } = usePlayer();

  useEffect(() => {
    setPlaylist(filteredPlaylist);
  }, [filteredPlaylist, setPlaylist]);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  // Listen for audio errors
  useEffect(() => {
    const handleAudioError = (e: globalThis.Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.message) {
        toast.error(customEvent.detail.message);
      }
    };
    
    window.addEventListener('audio-error', handleAudioError);
    return () => window.removeEventListener('audio-error', handleAudioError);
  }, []);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  useEffect(() => {
    const allTracks: Track[] = [];
    filteredSongs.forEach(song => {
      sortByNaipeOrder(song.audios).forEach(audio => {
        allTracks.push({
          id: audio.id,
          songId: song.id,
          songName: song.name,
          songType: song.type,
          naipe: audio.naipe,
          url: audio.audio_url,
          sheetMusicUrl: song.sheet_music_pdf_url || song.sheet_music_url
        });
      });
    });
    setTracks(allTracks);
  }, [songs]);

  useEffect(() => {
    if (currentTrackIndex !== null && trackRefs.current[currentTrackIndex]) {
      trackRefs.current[currentTrackIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [currentTrackIndex]);

  const fetchEventDetails = async () => {
    try {
      const {
        data: eventData,
        error: eventError
      } = await supabase.from('events').select('*').eq('id', id).single();
      if (eventError) throw eventError;
      setEvent(eventData);
      const {
        data: eventSongsData,
        error: eventSongsError
      } = await supabase.from('event_songs').select(`
          id,
          songs (*)
        `).eq('event_id', id).order('order_index');
      if (eventSongsError) throw eventSongsError;
      const {
        data: eventTypesData,
        error: eventTypesError
      } = await supabase.from('event_song_types').select(`
          id,
          order_index,
          song_types (
            id,
            slug,
            name,
            order_index
          )
        `).eq('event_id', id).order('order_index');
      if (eventTypesError) throw eventTypesError;
      const types = (eventTypesData || []).map((row: any) => row.song_types).filter(Boolean);
      setEventTypes(types);

      const songIds = eventSongsData.map((es: any) => es.songs.id);
      const {
        data: audiosData,
        error: audiosError
      } = await supabase.from('song_audios').select('*').in('song_id', songIds);
      if (audiosError) throw audiosError;

      const formattedSongs = eventSongsData.map((es: any) => ({
        ...es.songs,
        event_song_id: es.id,
        audios: audiosData?.filter((a: any) => a.song_id === es.songs.id) || []
      }));
      setSongs(formattedSongs);
      
      let songsQuery = supabase.from('songs').select('*').order('name');
      if (tenantId) {
        songsQuery = songsQuery.eq('tenant_id', tenantId);
      }
      const {
        data: allSongs,
        error: allSongsError
      } = await songsQuery;
      if (allSongsError) throw allSongsError;
      const usedSongIds = formattedSongs.map((s: any) => s.id);
      const available = (allSongs || []).filter(s => !usedSongIds.includes(s.id));
      setAvailableSongs(available);
    } catch (error: any) {
      console.error('Error fetching event details:', error);
      const savedEventsJson = localStorage.getItem('cached_events');
      const savedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      const cachedEvent = savedEvents.find((e: any) => e.id === id);
      
      if (cachedEvent) {
        setEvent(cachedEvent);
        const cachedSongs = localStorage.getItem(`event_songs_data_${id}`);
        if (cachedSongs) setSongs(JSON.parse(cachedSongs));
        const cachedTypes = localStorage.getItem(`event_types_data_${id}`);
        if (cachedTypes) setEventTypes(JSON.parse(cachedTypes));
        toast.info('Modo offline: visualizando evento salvo');
      } else {
        toast.error('Erro ao carregar detalhes do evento');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const publicUrl = `${window.location.origin}/e/${id}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado para a área de transferência!');
  };

  const handleDownloadSongPdf = async (song: EventSong) => {
    if (!song.sheet_music_pdf_url) {
      toast.error('Nenhum PDF original cadastrado para esta música');
      return;
    }
    try {
      const cachedUrl = await getCachedUrl(song.sheet_music_pdf_url);
      const response = await fetch(cachedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const typeLabel = getTypeLabel(song.type, typeLabels);
      a.download = `${typeLabel} - ${song.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download da partitura iniciado!');
    } catch (error) {
      console.error('Erro ao baixar PDF da partitura:', error);
      toast.error('Erro ao baixar PDF da partitura');
    }
  };

  const handleShareWhatsApp = async (audioUrl: string, songName: string, songType: string, naipe: string) => {
    try {
      const cachedUrl = await getCachedUrl(audioUrl);
      
      // Tenta usar Web Share API primeiro (funciona melhor em mobile)
      if (navigator.share) {
        try {
          const response = await fetch(cachedUrl);
          const blob = await response.blob();
          const fileName = `${getTypeLabel(songType, typeLabels)} - ${songName} - ${naipe}.mp3`;
          const file = new File([blob], fileName, { type: 'audio/mpeg' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: songName,
              text: `🎵 ${getTypeLabel(songType, typeLabels)} - ${songName} (${naipe})`
            });
            toast.success('Compartilhado com sucesso!');
            return;
          }
        } catch (fetchError) {
          console.log('Web Share com arquivo não disponível, usando fallback');
        }
      }
      
      // Fallback: abre o WhatsApp com link direto do áudio
      const text = encodeURIComponent(`🎵 ${getTypeLabel(songType, typeLabels)} - ${songName} (${naipe})\n\n${cachedUrl}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', error);
        toast.error('Erro ao compartilhar via WhatsApp');
      }
    }
  };

  const handleExportPDF = async () => {
    if (!event) return;
    const songsWithSheets = songs.filter(song => song.sheet_music_pdf_url || song.sheet_music_url).map(song => ({
      id: song.id,
      name: song.name,
      type: song.type,
      sheet_music_url: song.sheet_music_url,
      sheet_music_pdf_url: song.sheet_music_pdf_url
    }));
    if (songsWithSheets.length === 0) {
      toast.error('Nenhuma partitura encontrada. Adicione partituras às músicas antes de exportar.');
      return;
    }
    try {
      toast.info('Gerando PDF de partituras...');
      await exportEventPDF({
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        cover_image_url: event.cover_image_url,
        pdf_theme: event.pdf_theme
      }, songsWithSheets);
      toast.success('PDF de partituras exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  const handleExportZIP = async () => {
    if (!event || filteredPlaylist.length === 0) {
      toast.error('Nenhum áudio disponível para exportar');
      return;
    }
    try {
      toast.info('Preparando áudios para exportação...');
      await exportEventZIP(event.name, filteredPlaylist, selectedNaipe[0]);
      toast.success('Áudios exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error);
      toast.error('Erro ao gerar ZIP');
    }
  };

  const { tenant } = useTenant();
  
  const handleExportSongBooklet = async () => {
    if (!event) return;
    
    // Fetch songs with lyrics
    const songIds = songs.map(s => s.id);
    const { data: songsWithLyrics, error } = await supabase
      .from('songs')
      .select('id, name, type, lyrics')
      .in('id', songIds);
    
    if (error) {
      console.error('Erro ao buscar letras:', error);
      toast.error('Erro ao buscar letras das músicas');
      return;
    }
    
    const songsForBooklet = songsWithLyrics?.filter(s => s.lyrics?.trim()) || [];
    
    if (songsForBooklet.length === 0) {
      toast.error('Nenhuma música do evento possui letra cadastrada');
      return;
    }
    
    try {
      toast.info('Gerando folheto de cantos...');
      const tenantInfo = tenant ? { name: tenant.name, logo_url: tenant.logo_url } : undefined;
      await exportSongBookletPDF(event, songsForBooklet, tenantInfo);
      toast.success('Folheto de cantos gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar folheto:', error);
      toast.error(error.message || 'Erro ao gerar folheto de cantos');
    }
  };

  const handleExportChordBooklet = async () => {
    if (!event) return;
    
    // Fetch songs with chords
    const songIds = songs.map(s => s.id);
    const { data: songsWithChords, error } = await supabase
      .from('songs')
      .select('id, name, type, chords')
      .in('id', songIds);
    
    if (error) {
      console.error('Erro ao buscar cifras:', error);
      toast.error('Erro ao buscar cifras das músicas');
      return;
    }
    
    const songsForBooklet = songsWithChords?.filter(s => s.chords?.trim()) || [];
    
    if (songsForBooklet.length === 0) {
      toast.error('Nenhuma música do evento possui cifra cadastrada');
      return;
    }
    
    try {
      toast.info('Gerando livreto de cifras...');
      const tenantInfo = tenant ? { name: tenant.name, logo_url: tenant.logo_url } : undefined;
      await exportChordBookletPDF(event, songsForBooklet, tenantInfo);
      toast.success('Livreto de cifras gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar livreto:', error);
      toast.error(error.message || 'Erro ao gerar livreto de cifras');
    }
  };

  const removeSongFromEvent = async (eventSongId: string) => {
    try {
      const { error } = await supabase.from('event_songs').delete().eq('id', eventSongId);
      if (error) throw error;
      toast.success('Música removida do evento!');
      fetchEventDetails();
    } catch (error: any) {
      toast.error('Erro ao remover música');
    }
  };

  const filterOptions = ['Soprano', 'Contralto', 'Tenor', 'Baixo', 'Uníssono', 'Música Completa'];

  const handleSaveOffline = async () => {
    if (!event) {
      toast.error('Evento não encontrado');
      return;
    }

    console.log('[Offline] Starting offline save for event:', event.name);
    
    // Coleta todas as URLs que precisam ser cacheadas
    const allAudioUrls = tracks.map(track => track.url);
    const sheetMusicUrls = songs
      .filter(song => song.sheet_music_url)
      .map(song => song.sheet_music_url!);
    const pdfUrls = songs
      .filter(song => song.sheet_music_pdf_url)
      .map(song => song.sheet_music_pdf_url!);
    
    const allUrls = [
      ...allAudioUrls,
      ...sheetMusicUrls,
      ...pdfUrls
    ];
    
    if (event.cover_image_url) {
      allUrls.push(event.cover_image_url);
    }
    
    console.log('[Offline] URLs to cache:', {
      audios: allAudioUrls.length,
      sheets: sheetMusicUrls.length,
      pdfs: pdfUrls.length,
      cover: event.cover_image_url ? 1 : 0,
      total: allUrls.length
    });
    
    if (allUrls.length === 0) {
      toast.error('Nenhum arquivo para salvar neste evento');
      return;
    }
    
    try {
      // Cachea todos os arquivos
      await cacheMultipleAudios(allUrls);

      // Salva os metadados do evento no localStorage
      const savedEventsJson = localStorage.getItem('cached_events');
      const savedEvents: any[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      
      const eventIndex = savedEvents.findIndex(e => e.id === event.id);
      if (eventIndex >= 0) {
        savedEvents[eventIndex] = event;
      } else {
        savedEvents.push(event);
      }
      
      localStorage.setItem('cached_events', JSON.stringify(savedEvents));
      localStorage.setItem(`event_audios_${event.id}`, JSON.stringify(allAudioUrls));
      localStorage.setItem(`event_sheets_${event.id}`, JSON.stringify(sheetMusicUrls));
      localStorage.setItem(`event_songs_data_${event.id}`, JSON.stringify(songs));
      localStorage.setItem(`event_types_data_${event.id}`, JSON.stringify(eventTypes));
      
      console.log('[Offline] Event metadata saved to localStorage');
      
      checkOfflineStatus();
      
      // Força o player a recarregar a track atual com a versão cacheada
      if (currentTrack) {
        const currentIndex = filteredPlaylist.findIndex(t => t.id === currentTrack.id);
        if (currentIndex >= 0) {
          console.log('[Offline] Reloading current track from cache');
          playTrack(currentIndex);
        }
      }
      
      toast.success('Evento salvo para acesso offline!');
    } catch (error) {
      console.error('[Offline] Error saving event:', error);
      toast.error('Erro ao salvar evento offline');
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || !time) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number[]) => {
    setIsScrubbing(true);
    seek(value[0]);
    setIsScrubbing(false);
  };

  const handleSongSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }
    setIsUploadingSongSheet(true);
    try {
      const fileName = `${event.id}-folha-cantos-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('sheet-music').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sheet-music').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('events').update({ song_sheet_url: publicUrl }).eq('id', event.id);
      if (updateError) throw updateError;
      setEvent({ ...event, song_sheet_url: publicUrl });
      toast.success('Folha de cantos enviada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da folha de cantos');
    } finally {
      setIsUploadingSongSheet(false);
      if (songSheetInputRef.current) songSheetInputRef.current.value = '';
    }
  };

  const handleRemoveSongSheet = async () => {
    if (!event?.song_sheet_url) return;
    try {
      const { error: updateError } = await supabase.from('events').update({ song_sheet_url: null }).eq('id', event.id);
      if (updateError) throw updateError;
      setEvent({ ...event, song_sheet_url: null });
      toast.success('Folha de cantos removida!');
    } catch (error) {
      toast.error('Erro ao remover folha de cantos');
    }
  };

  const handleDownloadSongSheet = async () => {
    if (!event?.song_sheet_url) return;
    try {
      const cachedUrl = await getCachedUrl(event.song_sheet_url);
      const response = await fetch(cachedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.name} - Folha de Cantos.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download iniciado!');
    } catch (error) {
      toast.error('Erro ao baixar folha de cantos');
    }
  };

  const handleSaveForOffline = async () => {
    if (!event || !tenantId) return;
    
    setIsSavingOffline(true);
    try {
      // 1. Save event data
      saveEvents([{
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        cover_image_url: event.cover_image_url,
        notes: null,
        tenant_id: tenantId,
      }]);

      // 2. Collect all audio URLs to cache
      const audioUrls: string[] = [];
      songs.forEach(song => {
        song.audios.forEach(audio => {
          audioUrls.push(audio.audio_url);
        });
      });

      // 3. Cache the cover image if exists
      if (event.cover_image_url) {
        audioUrls.push(event.cover_image_url);
      }

      // 4. Cache song sheet if exists
      if (event.song_sheet_url) {
        audioUrls.push(event.song_sheet_url);
      }

      // 5. Cache all sheet music PDFs
      songs.forEach(song => {
        if (song.sheet_music_pdf_url) {
          audioUrls.push(song.sheet_music_pdf_url);
        }
      });

      // 6. Cache all audio files
      if (audioUrls.length > 0) {
        await cacheMultipleAudios(audioUrls);
      }

      setIsOfflineSaved(true);
      checkOfflineStatus();
      toast.success('Evento salvo para acesso offline!');
    } catch (error) {
      console.error('Error saving for offline:', error);
      toast.error('Erro ao salvar evento offline');
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleRemoveOffline = async () => {
    if (!id) return;
    
    try {
      removeEventOffline(id);
      
      // Also remove audios from cache
      const audioUrls: string[] = [];
      songs.forEach(song => {
        song.audios.forEach(audio => {
          audioUrls.push(audio.audio_url);
        });
      });
      
      for (const url of audioUrls) {
        await removeFromCache(url);
      }
      
      setIsOfflineSaved(false);
      checkOfflineStatus();
      toast.success('Evento removido do modo offline');
    } catch (error) {
      console.error('Error removing offline:', error);
      toast.error('Erro ao remover evento offline');
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!event) return <div className="flex min-h-screen items-center justify-center"><p>Evento não encontrado</p></div>;

  return (
    <div className="min-h-screen bg-background pb-28">
      {showMusicRain && <MusicRain onComplete={() => setShowMusicRain(false)} />}
      <EnhancedMiniPlayer />
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => navigate(isPublicView ? '/auth' : '/events')} className="h-8 w-8 shrink-0 text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Ações Principais */}
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar
              </DropdownMenuItem>
              
              {isOfflineSaved ? (
                <DropdownMenuItem onClick={handleRemoveOffline} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover do Modo Offline
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleSaveForOffline} disabled={isSavingOffline}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingOffline ? 'Salvando...' : 'Salvar para Acesso Offline'}
                </DropdownMenuItem>
              )}
              {event.song_sheet_url && (
                <DropdownMenuItem onClick={handleDownloadSongSheet}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar Folha de Cantos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar Partituras
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportZIP}>
                <FileArchive className="mr-2 h-4 w-4" />
                Exportar Áudios
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSongBooklet}>
                <BookOpen className="mr-2 h-4 w-4" />
                Gerar Folheto de Cantos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportChordBooklet}>
                <Guitar className="mr-2 h-4 w-4" />
                Gerar Livreto de Cifras
              </DropdownMenuItem>

              {/* Edição (Admin) */}
              {user && canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/events/edit/${id}`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Evento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/events/${id}/quick-edit`)}>
                    <Music className="mr-2 h-4 w-4" />
                    Editar Músicas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Música
                  </DropdownMenuItem>
                  {event.song_sheet_url ? (
                    <DropdownMenuItem onClick={handleRemoveSongSheet} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover Folha de Cantos
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => songSheetInputRef.current?.click()} disabled={isUploadingSongSheet}>
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploadingSongSheet ? 'Enviando...' : 'Adicionar Folha de Cantos'}
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* Gerenciamento (Admin) */}
              {user && canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/events/${id}/rehearsals`)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Ensaios
                  </DropdownMenuItem>
                </>
              )}

              {/* Configurações de Visualização */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowGroupModal(true)}>
                <Sliders className="mr-2 h-4 w-4" />
                Agrupamento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFilterModal(true)}>
                <Filter className="mr-2 h-4 w-4" />
                Filtro de Voz
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={songSheetInputRef} type="file" accept="application/pdf" onChange={handleSongSheetUpload} className="hidden" />
        </div>
      </div>

      <div className="sticky top-12 z-10 bg-background/95 backdrop-blur-md border-b border-primary/20 shadow-subtle px-4 py-3 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 rounded-lg shadow-card overflow-hidden bg-gradient-to-br from-primary/45 to-primary/25 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-75 transition-opacity" onClick={handleImageClick}>
            {event.cover_image_url ? (
              <img src={coverImageSrc || event.cover_image_url} alt={event.name} className="h-full w-full object-cover" />
            ) : (
              <Music className="h-7 w-7 text-primary/70 animate-float" />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h2 className="line-clamp-2 font-bold text-base text-foreground leading-tight mb-1.5 flex items-center gap-2 flex-wrap">
              {event.name}
              {isOfflineSaved && <OfflineBadge variant="small" />}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {canEdit && id && (
                <EventMembersManager eventId={id} isAdmin={canEdit} />
              )}
              {event.song_sheet_url && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadSongSheet}
                  className="h-7 px-2 gap-1 text-[10px] font-bold border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-subtle"
                >
                  <FileDown className="h-3 w-3" />
                  FOLHA DE CANTOS
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                className="h-7 px-2 gap-1 text-[10px] font-bold border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-subtle"
              >
                <FileText className="h-3 w-3" />
                PARTITURAS
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-2 border-b border-primary/15 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar música..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full h-11 bg-secondary/50 border-primary/30 text-sm rounded-md shadow-subtle focus:shadow-glow focus:border-primary/60 transition-all" />
        </div>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {filteredSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma música adicionada a este evento ainda.</p>
        ) : groupBy === 'naipe' ? (
          (() => {
            const naipeGroups: Record<string, { song: EventSong; audio: SongAudio; }[]> = {};
            const naipeOrder = ['soprano', 'contralto', 'tenor', 'baixo', 'unissono', 'original'];
            filteredSongs.forEach(song => {
              song.audios.forEach(audio => {
                const naipeKey = audio.naipe.toLowerCase();
                if (!selectedNaipe.includes('todas')) {
                  const isMatch = naipeKey === 'unissono' || selectedNaipe.some(sel => {
                    const target = sel.toLowerCase();
                    if (target === 'música completa') return naipeKey === 'original';
                    return naipeKey === target;
                  });
                  if (!isMatch) return;
                }
                if (selectedNaipe.length === 0) return;
                if (!naipeGroups[naipeKey]) naipeGroups[naipeKey] = [];
                naipeGroups[naipeKey].push({ song, audio });
              });
            });
            const sortedNaipes = naipeOrder.filter(n => naipeGroups[n]);
            if (sortedNaipes.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum áudio encontrado com o filtro selecionado.</p>;
            return sortedNaipes.map((naipeKey) => {
              const items = naipeGroups[naipeKey];
              const groupKey = `naipe:${naipeKey}`;
              const isCollapsed = Boolean(collapsedGroups[groupKey]);
              return (
                <div key={naipeKey}>
                  <div className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card hover:shadow-elevated transition-all">
                    <div className="px-3 py-3.5 bg-gradient-to-r from-primary/8 to-transparent flex items-center justify-between cursor-pointer hover:from-primary/12 transition-all" onClick={() => toggleGroup(groupKey)}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Badge className={naipeColors[naipeKey] || 'bg-primary/25 text-primary border-primary/40'}>
                          {naipeKey === 'original' ? 'Música Completa' : naipeKey.charAt(0).toUpperCase() + naipeKey.slice(1)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">{items.length} {items.length === 1 ? 'áudio' : 'áudios'}</span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-primary/70 transform transition-transform shrink-0 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                    </div>
                    {!isCollapsed && (
                      <div className="divide-y divide-primary/10">
                         {items.map(({ song, audio }) => {
                           const track = filteredPlaylist.find(t => t.id === audio.id);
                           const globalIndex = track ? filteredPlaylist.findIndex(t => t.id === audio.id) : -1;
                           const isAudioCached = isCached(audio.audio_url);
                           return (
                             <div key={audio.id} ref={el => { if (globalIndex >= 0) trackRefs.current[globalIndex] = el; }} onClick={() => globalIndex >= 0 && playTrack(globalIndex)} className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'bg-primary/20 shadow-glow' : 'hover:bg-primary/8 cursor-pointer'}`}>
                               <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button onClick={async e => {
                                  e.stopPropagation();
                                  if (song.sheet_music_url || song.sheet_music_pdf_url) {
                                    if (globalIndex >= 0) playTrack(globalIndex);
                                    const url = song.sheet_music_pdf_url || song.sheet_music_url;
                                    if (url) {
                                      console.log('[EventDetails] Opening sheet music, original URL:', url);
                                      const cached = await getCachedUrl(url);
                                      console.log('[EventDetails] Cached URL:', cached);
                                      setSheetMusicSrc(cached);
                                      setShowSheetViewer(true);
                                    }
                                  }
                                }} className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${song.sheet_music_url || song.sheet_music_pdf_url ? 'hover:bg-primary/20 cursor-pointer text-primary' : 'text-muted-foreground'}`}>
                                  <Music className="h-5 w-5 shrink-0" />
                                </button>
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2">
                                     <p className={`truncate font-bold text-sm uppercase tracking-tight ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>
                                       {getTypeLabel(song.type, typeLabels)}
                                     </p>
                                     {isAudioCached && (
                                       <div className="flex items-center gap-1 shrink-0" title={isOnline ? 'Disponível offline' : 'Reproduzindo offline'}>
                                         <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500 stroke-[3]" />
                                       </div>
                                     )}
                                   </div>
                                   <p className="text-xs text-muted-foreground truncate font-medium">
                                     {song.name} • {audio.naipe === 'original' ? 'Música Completa' : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}
                                   </p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {song.lyrics && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setLyricsModalOpen(true); }} title="Ver letra">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
                                {song.chords && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setChordsModalOpen(true); }} title="Ver cifra">
                                    <Guitar className="h-4 w-4" />
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={async e => {
                                      e.stopPropagation();
                                      try {
                                        const cachedUrl = await getCachedUrl(audio.audio_url);
                                        const response = await fetch(cachedUrl);
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${getTypeLabel(song.type, typeLabels)} - ${song.name} - ${audio.naipe}.mp3`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                        toast.success('Download do áudio iniciado!');
                                      } catch (error) { toast.error('Erro ao baixar áudio'); }
                                    }}><Download className="mr-2 h-4 w-4" /> Baixar Áudio</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleDownloadSongPdf(song); }}><FileText className="mr-2 h-4 w-4" /> Baixar Partitura</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleShareWhatsApp(audio.audio_url, song.name, song.type, audio.naipe); }}><MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp</DropdownMenuItem>
                                    {user && canEdit && (
                                      <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/songs/${song.id}/edit?eventId=${id}`); }}><Edit className="mr-2 h-4 w-4" /> Editar Música</DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()
        ) : groupBy === 'musica' ? (
          filteredSongs.map((song, index) => {
            const groupKey = `song:${song.event_song_id}`;
            const isCollapsed = Boolean(collapsedGroups[groupKey]);
            const songAudios = sortByNaipeOrder(selectedNaipe.includes('todas') ? song.audios : selectedNaipe.length === 0 ? [] : song.audios.filter(audio => {
              const audioNaipe = String(audio.naipe || '').toLowerCase();
              return audioNaipe === 'unissono' || selectedNaipe.some(sel => {
                const target = sel.toLowerCase();
                if (target === 'música completa') return audioNaipe === 'original';
                return audioNaipe === target;
              });
            }));
            const hasSheetMusic = Boolean(song.sheet_music_url || song.sheet_music_pdf_url);
            return (
              <div key={song.event_song_id} className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card hover:shadow-elevated transition-all animate-slide-up">
                <div className="px-3 py-3.5 bg-gradient-to-r from-primary/8 to-transparent border-b border-primary/15">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">{index + 1}</div>
                        <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">{getTypeLabel(song.type, typeLabels)}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {song.lyrics && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setLyricsModalOpen(true); }} title="Ver letra">
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {song.chords && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setChordsModalOpen(true); }} title="Ver cifra">
                            <Guitar className="h-4 w-4" />
                          </Button>
                        )}
                        <button onClick={() => toggleGroup(groupKey)} className="p-1 hover:bg-primary/20 rounded transition-colors shrink-0"><ChevronDown className={`h-5 w-5 text-primary/70 transform transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} /></button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15 shrink-0 transition-colors"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50">
                            <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleDownloadSongPdf(song); }}><FileText className="mr-2 h-4 w-4 text-primary" /> Baixar partitura (PDF)</DropdownMenuItem>
                            {user && canEdit && <>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/songs/${song.id}/edit?eventId=${id}`); }}><Edit className="mr-2 h-4 w-4" /> Editar música</DropdownMenuItem>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); removeSongFromEvent(song.event_song_id); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remover do evento</DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-sm uppercase tracking-tight text-primary">
                          {getTypeLabel(song.type, typeLabels)}
                        </p>
                        {isOfflineSaved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium truncate">{song.name}</p>
                    </div>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-primary/10">
                     {songAudios.length > 0 ? songAudios.map(audio => {
                       const track = filteredPlaylist.find(t => t.id === audio.id);
                       const globalIndex = track ? filteredPlaylist.findIndex(t => t.id === audio.id) : -1;
                       const isAudioCached = isCached(audio.audio_url);
                       return (
                         <div key={audio.id} ref={el => { if (globalIndex >= 0) trackRefs.current[globalIndex] = el; }} onClick={() => globalIndex >= 0 && playTrack(globalIndex)} className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'bg-primary/20 shadow-glow' : 'hover:bg-primary/8 cursor-pointer'}`}>
                           <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button onClick={async e => {
                              e.stopPropagation();
                              if (hasSheetMusic) {
                                if (globalIndex >= 0) playTrack(globalIndex);
                                const url = song.sheet_music_pdf_url || song.sheet_music_url;
                                if (url) {
                                  const cached = await getCachedUrl(url);
                                  setSheetMusicSrc(cached);
                                  setShowSheetViewer(true);
                                }
                              }
                             }} className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${hasSheetMusic ? 'hover:bg-primary/20 cursor-pointer text-primary' : 'text-muted-foreground'}`}><Music className="h-5 w-5 shrink-0" /></button>
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 <p className={`truncate font-bold text-sm uppercase tracking-tight ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>
                                   {getTypeLabel(song.type, typeLabels)}
                                 </p>
                           {isAudioCached && (
                             <div className="flex items-center gap-1 shrink-0" title={isOnline ? 'Disponível offline' : 'Reproduzindo offline'}>
                               <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500 stroke-[3]" />
                             </div>
                           )}
                               </div>
                               <p className="truncate text-xs text-muted-foreground font-medium">
                                 {song.name} • {audio.naipe.toLowerCase() === 'original' ? 'Música Completa' : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}
                               </p>
                             </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {song.lyrics && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setLyricsModalOpen(true); }} title="Ver letra">
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            {song.chords && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setChordsModalOpen(true); }} title="Ver cifra">
                                <Guitar className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15 shrink-0 transition-colors"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={async e => {
                                  e.stopPropagation();
                                  try {
                                    const response = await fetch(audio.audio_url);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${getTypeLabel(song.type, typeLabels)} - ${song.name} - ${audio.naipe}.mp3`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                    toast.success('Download do áudio iniciado!');
                                  } catch (error) { toast.error('Erro ao baixar áudio'); }
                                }}><Download className="mr-2 h-4 w-4" /> Baixar Áudio</DropdownMenuItem>
                                <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleDownloadSongPdf(song); }}><FileText className="mr-2 h-4 w-4" /> Baixar Partitura</DropdownMenuItem>
                                <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleShareWhatsApp(audio.audio_url, song.name, song.type, audio.naipe); }}><MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp</DropdownMenuItem>
                                {user && canEdit && (
                                  <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/songs/${song.id}/edit?eventId=${id}`); }}><Edit className="mr-2 h-4 w-4" /> Editar Música</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    }) : <div className="px-4 py-3 text-sm text-muted-foreground text-center">Nenhum áudio cadastrado</div>}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card p-1 divide-y divide-primary/10">
            {filteredSongs.flatMap(song => {
              const songAudios = sortByNaipeOrder(selectedNaipe.includes('todas') ? song.audios : selectedNaipe.length === 0 ? [] : song.audios.filter(audio => {
                const audioNaipe = String(audio.naipe || '').toLowerCase();
                return audioNaipe === 'unissono' || selectedNaipe.some(sel => {
                  const target = sel.toLowerCase();
                  if (target === 'música completa') return audioNaipe === 'original';
                  return audioNaipe === target;
                });
              }));
               return songAudios.map(audio => {
                 const track = filteredPlaylist.find(t => t.id === audio.id);
                 const globalIndex = track ? filteredPlaylist.findIndex(t => t.id === audio.id) : -1;
                 const hasSheetMusic = Boolean(song.sheet_music_url || song.sheet_music_pdf_url);
                 const isAudioCached = isCached(audio.audio_url);
                 return (
                   <div key={audio.id} ref={el => { if (globalIndex >= 0) trackRefs.current[globalIndex] = el; }} onClick={() => globalIndex >= 0 && playTrack(globalIndex)} className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'bg-primary/20 shadow-glow' : 'hover:bg-primary/8 cursor-pointer'}`}>
                     <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button onClick={async e => {
                        e.stopPropagation();
                        if (hasSheetMusic) {
                          if (globalIndex >= 0) playTrack(globalIndex);
                          const url = song.sheet_music_pdf_url || song.sheet_music_url;
                          if (url) {
                            const cached = await getCachedUrl(url);
                            setSheetMusicSrc(cached);
                            setShowSheetViewer(true);
                          }
                        }
                       }} className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${hasSheetMusic ? 'hover:bg-primary/20 cursor-pointer text-primary' : 'text-muted-foreground'}`}><Music className="h-5 w-5 shrink-0" /></button>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <p className={`truncate font-bold text-sm uppercase tracking-tight ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>
                             {getTypeLabel(song.type, typeLabels)}
                           </p>
                           {isAudioCached && (
                             <div className="flex items-center gap-1 shrink-0" title={isOnline ? 'Disponível offline' : 'Reproduzindo offline'}>
                               <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500 stroke-[3]" />
                             </div>
                           )}
                         </div>
                         <div className="flex items-center gap-1.5 mt-0.5">
                           <p className="text-xs text-muted-foreground truncate font-medium flex-1">
                             {song.name}
                           </p>
                           <Badge variant="outline" className="py-0 px-1 text-[9px] h-3.5 bg-secondary/30 border-primary/10 text-muted-foreground shrink-0 uppercase tracking-tighter">
                             {audio.naipe.toLowerCase() === 'original' ? 'Completa' : audio.naipe}
                           </Badge>
                         </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {song.lyrics && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setLyricsModalOpen(true); }} title="Ver letra">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      {song.chords && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/15" onClick={e => { e.stopPropagation(); setSelectedSongForModal(song); setChordsModalOpen(true); }} title="Ver cifra">
                          <Guitar className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={e => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={async e => {
                            e.stopPropagation();
                            try {
                              const cachedUrl = await getCachedUrl(audio.audio_url);
                              const response = await fetch(cachedUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${getTypeLabel(song.type, typeLabels)} - ${song.name} - ${audio.naipe}.mp3`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                              toast.success('Download do áudio iniciado!');
                            } catch (error) { toast.error('Erro ao baixar áudio'); }
                          }}>
                            <Download className="mr-2 h-4 w-4" /> Baixar Áudio
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleDownloadSongPdf(song); }}>
                            <FileText className="mr-2 h-4 w-4" /> Baixar Partitura
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleShareWhatsApp(audio.audio_url, song.name, song.type, audio.naipe); }}>
                            <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                          </DropdownMenuItem>
                          {user && canEdit && (
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/songs/${song.id}/edit?eventId=${id}`); }}>
                              <Edit className="mr-2 h-4 w-4" /> Editar Música
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              });
            })}
            {filteredPlaylist.length === 0 && <div className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhum áudio encontrado com os filtros atuais.</div>}
          </div>
        )}
      </div>



      {showSheetViewer && currentTrack && (() => {
        const currentSong = songs.find(s => s.id === currentTrack.songId);
        if (!currentSong) {
          console.warn('[EventDetails] Current song not found for sheet viewer');
          return null;
        }
        
        const sheetUrl = sheetMusicSrc || currentSong.sheet_music_pdf_url || currentSong.sheet_music_url;
        if (!sheetUrl) {
          console.warn('[EventDetails] No sheet music URL available');
          return null;
        }
        
        console.log('[EventDetails] Rendering SheetViewer with URL:', sheetUrl);
        console.log('[EventDetails] Is blob URL:', sheetUrl.startsWith('blob:'));
        
        return <SheetViewer 
          currentTrack={currentTrack} 
          isPlaying={isPlaying} 
          onPlayPause={togglePlay} 
          onNext={playNext} 
          onPrevious={playPrevious} 
          onClose={() => { 
            console.log('[EventDetails] Closing SheetViewer');
            setShowSheetViewer(false); 
            setSheetMusicSrc(null); 
          }} 
          onTrackEnd={() => { 
            if (repeatMode === 'track' && audioRef.current) { 
              audioRef.current.currentTime = 0; 
              audioRef.current.play(); 
            } else {
              playNext(); 
            }
          }} 
          sheetMusicUrl={sheetUrl} 
          allTracks={filteredPlaylist} 
          currentTrackIndex={currentTrackIndex ?? 0} 
          onTrackSelect={index => playTrack(index)} 
          audioElement={audioRef.current} 
          currentTime={currentTime} 
          duration={duration} 
        />;
      })()}

      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent className="w-[90vw] max-w-sm">
          <DialogHeader><DialogTitle>Agrupar por</DialogTitle><DialogDescription>Escolha como deseja agrupar as músicas</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {['musica', 'naipe', 'nenhum'].map(mode => (
              <Button key={mode} variant={groupBy === mode ? 'default' : 'outline'} className="w-full justify-start capitalize" onClick={() => { setGroupBy(mode as any); setShowGroupModal(false); }}>{mode === 'nenhum' ? 'Nenhum (Lista Plana)' : mode}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent className="w-[90vw] max-w-sm">
          <DialogHeader><DialogTitle>Filtrar por Voz</DialogTitle><DialogDescription>Selecione uma ou mais vozes para visualizar</DialogDescription></DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pb-4">
            <Button variant={selectedNaipe.includes('todas') ? 'default' : 'outline'} className="w-full justify-start gap-2" onClick={() => setSelectedNaipe(['todas'])}>{selectedNaipe.includes('todas') && <CheckCircle2 className="h-4 w-4" />} Todas as Músicas</Button>
            <div className="h-px bg-border my-2" />
            {filterOptions.map(option => {
              const value = option.toLowerCase();
              const isSelected = selectedNaipe.includes(value);
              return <Button key={option} variant={isSelected ? 'default' : 'outline'} className="w-full justify-start gap-2" onClick={() => setSelectedNaipe(prev => { const withoutTodas = prev.filter(p => p !== 'todas'); if (isSelected) { const next = withoutTodas.filter(p => p !== value); return next.length === 0 ? ['todas'] : next; } return [...withoutTodas, value]; })}>{isSelected && <CheckCircle2 className="h-4 w-4" />} {option}</Button>;
            })}
          </div>
          <div className="flex gap-2 border-t pt-4"><Button variant="ghost" className="flex-1" onClick={() => { setSelectedNaipe(['todas']); setShowFilterModal(false); }}>Limpar Filtros</Button><Button className="flex-1 gradient-primary" onClick={() => setShowFilterModal(false)}>Aplicar</Button></div>
        </DialogContent>
      </Dialog>



      {isCaching && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-background/95 backdrop-blur-md border border-primary/20 rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Salvando offline...</span><span className="text-xs text-muted-foreground">{progress.current} de {progress.total}</span></div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
        </div>
      )}

      <Dialog open={showNaipeSelector} onOpenChange={setShowNaipeSelector}>
        <DialogContent className="w-[90vw] max-w-md p-6">
          <DialogHeader><DialogTitle className="text-center text-xl font-bold">Qual o seu naipe?</DialogTitle><DialogDescription className="text-center">Selecione sua voz para filtrar as músicas deste evento automaticamente.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {[
              { id: 'soprano', label: 'Soprano', icon: Mic2, color: 'from-pink-500/20 to-pink-500/10 border-pink-500/30 text-pink-600' },
              { id: 'contralto', label: 'Contralto', icon: Mic, color: 'from-purple-500/20 to-purple-500/10 border-purple-500/30 text-purple-600' },
              { id: 'tenor', label: 'Tenor', icon: Music2, color: 'from-blue-500/20 to-blue-500/10 border-blue-500/30 text-blue-600' },
              { id: 'baixo', label: 'Baixo', icon: Music, color: 'from-emerald-500/20 to-emerald-500/10 border-emerald-500/30 text-emerald-600' },
            ].map((naipe) => (
              <button key={naipe.id} onClick={() => { setSelectedNaipe([naipe.id]); setShowNaipeSelector(false); toast.success(`Filtro ${naipe.label} aplicado!`); }} className={cn("flex flex-col items-center justify-center p-6 rounded-2xl border-2 bg-gradient-to-br transition-all active:scale-95 hover:shadow-lg", naipe.color)}><naipe.icon className="h-10 w-10 mb-3" /><span className="font-bold text-sm uppercase tracking-wide">{naipe.label}</span></button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lyrics Modal */}
      <Dialog open={lyricsModalOpen} onOpenChange={setLyricsModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
          <DialogHeader className="relative px-5 py-4 shrink-0 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
                  {getTypeLabel(selectedSongForModal?.type, typeLabels)}
                </p>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  {selectedSongForModal?.name}
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLyricsModalOpen(false)}
                className="shrink-0 h-8 w-8 rounded-full hover:bg-background/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 overflow-auto">
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              {selectedSongForModal?.lyrics ? (
                <div className="whitespace-pre-wrap text-base sm:text-lg leading-[1.9] text-foreground/90 font-normal tracking-wide">
                  {selectedSongForModal.lyrics.split('\n').map((line, index) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={index} className="h-4" />;
                    if (/^\[REFR[ÃA]O\]$/i.test(trimmed) || /^\[\/REFR[ÃA]O\]$/i.test(trimmed)) return null;
                    if (/^(R:|REFRÃO:|REFRAO:|REF:)/i.test(trimmed)) {
                      return <p key={index} className="font-bold text-primary mt-4 mb-2">{trimmed}</p>;
                    }
                    const numberedVerse = /^(\d+)\.\s*(.*)/.exec(trimmed);
                    if (numberedVerse) {
                      return <p key={index} className="mt-4 first:mt-0"><span className="font-bold text-primary">{numberedVerse[1]}.</span><span className="ml-1">{numberedVerse[2]}</span></p>;
                    }
                    return <p key={index} className="leading-[1.9]">{trimmed}</p>;
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
          
          <div className="shrink-0 px-5 py-3 border-t bg-muted/30 flex justify-center">
            <Button variant="outline" onClick={() => setLyricsModalOpen(false)} className="min-w-[120px]">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Chords Viewer */}
      {chordsModalOpen && selectedSongForModal?.chords && (
        <FullscreenChordViewer
          chords={selectedSongForModal.chords}
          songName={selectedSongForModal.name}
          onClose={() => setChordsModalOpen(false)}
        />
      )}

      <BottomNavigation />
    </div>
  );
};

export default EventDetails;