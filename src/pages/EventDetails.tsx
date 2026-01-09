import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { SheetViewer } from '@/components/SheetViewer';
import { MusicRain } from '@/components/MusicRain';
import { ArrowLeft, Plus, Download, Music, Search, Edit, Trash2, MoreVertical, Share2, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, FileText, FileArchive, ChevronDown, Sliders, Filter, Calendar, Users, WifiOff, CheckCircle2, Volume2, VolumeX, Loader2, Upload, FileDown, Mic2, Mic, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  
  const canEdit = isAdmin || isSuperAdmin;
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
  const songSheetInputRef = useRef<HTMLInputElement>(null);

  const checkOfflineStatus = () => {
    if (!id) return;
    const savedEventsJson = localStorage.getItem('cached_events');
    const savedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];
    const isSaved = savedEvents.some((e: any) => e.id === id);
    setIsOfflineSaved(isSaved);
  };

  useEffect(() => {
    checkOfflineStatus();
  }, [id]);

  const [sheetMusicSrc, setSheetMusicSrc] = useState<string | null>(null);
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
  const [showSheetViewer, setShowSheetViewer] = useState(false);
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
    setPlaylist
  } = usePlayer();

  useEffect(() => {
    setPlaylist(filteredPlaylist);
  }, [filteredPlaylist, setPlaylist]);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

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
          url: audio.audio_url
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
    const publicUrl = `${window.location.origin}/public/events/${id}`;
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
    const allAudioUrls = tracks.map(track => track.url);
    const sheetMusicUrls = songs.filter(song => song.sheet_music_url).map(song => song.sheet_music_url!);
    const pdfUrls = songs.filter(song => song.sheet_music_pdf_url).map(song => song.sheet_music_pdf_url!);
    const allUrls = [...allAudioUrls, ...sheetMusicUrls, ...pdfUrls];
    if (event?.cover_image_url) allUrls.push(event.cover_image_url);
    
    if (allUrls.length === 0 && songs.length === 0) {
      toast.error('Nada para salvar neste evento');
      return;
    }
    
    if (allUrls.length > 0) await cacheMultipleAudios(allUrls);

    if (event) {
      try {
        const savedEventsJson = localStorage.getItem('cached_events');
        const savedEvents: any[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
        const eventIndex = savedEvents.findIndex(e => e.id === event.id);
        if (eventIndex >= 0) savedEvents[eventIndex] = event;
        else savedEvents.push(event);
        localStorage.setItem('cached_events', JSON.stringify(savedEvents));
        localStorage.setItem(`event_audios_${event.id}`, JSON.stringify(allAudioUrls));
        localStorage.setItem(`event_sheets_${event.id}`, JSON.stringify(sheetMusicUrls));
        localStorage.setItem(`event_songs_data_${event.id}`, JSON.stringify(songs));
        localStorage.setItem(`event_types_data_${event.id}`, JSON.stringify(eventTypes));
        toast.success('Evento salvo para acesso offline!');
        checkOfflineStatus();
      } catch (error) {
        toast.error('Erro ao salvar evento offline');
      }
    }
  };

  const handleRemoveOffline = async () => {
    if (!event) return;
    try {
      const savedEventsJson = localStorage.getItem('cached_events');
      if (savedEventsJson) {
        const savedEvents: any[] = JSON.parse(savedEventsJson);
        const newSavedEvents = savedEvents.filter(e => e.id !== event.id);
        localStorage.setItem('cached_events', JSON.stringify(newSavedEvents));
      }
      localStorage.removeItem(`event_audios_${event.id}`);
      localStorage.removeItem(`event_sheets_${event.id}`);
      localStorage.removeItem(`event_songs_data_${event.id}`);
      localStorage.removeItem(`event_types_data_${event.id}`);
      toast.success('Evento removido do modo offline');
      checkOfflineStatus();
    } catch (error) {
      toast.error('Erro ao remover evento offline');
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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!event) return <div className="flex min-h-screen items-center justify-center"><p>Evento não encontrado</p></div>;

  return (
    <div className="min-h-screen bg-background pb-28">
      {showMusicRain && <MusicRain onComplete={() => setShowMusicRain(false)} />}
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
            <DropdownMenuContent align="end">
              {user && canEdit && <>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/events/edit/${id}`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar evento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/events/${id}/quick-edit`)}>
                  <Music className="mr-2 h-4 w-4" />
                  Editar músicas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar música
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/events/${id}/rehearsals`)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Ensaios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/events/${id}/registrations`)}>
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Inscrições
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>}
              {event.song_sheet_url && (
                <DropdownMenuItem onClick={handleDownloadSongSheet}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar Folha de Cantos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar evento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSaveOffline} disabled={isCaching}>
                <Download className="mr-2 h-4 w-4" />
                {isOfflineSaved ? 'Atualizar Offline' : 'Salvar Offline'}
              </DropdownMenuItem>
              {isOfflineSaved && (
                <DropdownMenuItem onClick={handleRemoveOffline}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover Offline
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowGroupModal(true)}>
                <Sliders className="mr-2 h-4 w-4" />
                Opções de Agrupamento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFilterModal(true)}>
                <Filter className="mr-2 h-4 w-4" />
                Opções de Filtro (Voz)
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
            <h2 className="line-clamp-2 font-bold text-base text-foreground leading-tight mb-1.5 flex items-center gap-2">
              {event.name}
            </h2>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'}
              {isOfflineSaved && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            </p>
            <div className="flex gap-2 mt-2">
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
                          return (
                            <div key={audio.id} ref={el => { if (globalIndex >= 0) trackRefs.current[globalIndex] = el; }} onClick={() => globalIndex >= 0 && playTrack(globalIndex)} className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'bg-primary/20 shadow-glow' : 'hover:bg-primary/8 cursor-pointer'}`}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button onClick={async e => {
                                  e.stopPropagation();
                                  if (song.sheet_music_url || song.sheet_music_pdf_url) {
                                    if (globalIndex >= 0) playTrack(globalIndex);
                                    const url = song.sheet_music_pdf_url || song.sheet_music_url;
                                    if (url) {
                                      const cached = await getCachedUrl(url);
                                      setSheetMusicSrc(cached);
                                      setShowSheetViewer(true);
                                    }
                                  }
                                }} className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${song.sheet_music_url || song.sheet_music_pdf_url ? 'hover:bg-primary/20 cursor-pointer text-primary' : 'text-muted-foreground'}`}>
                                  <Music className="h-5 w-5 shrink-0" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`truncate font-medium text-sm ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>{song.name}</p>
                                    {isOfflineSaved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{audio.naipe === 'original' ? 'Todas as Vozes' : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}</p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
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
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                      <button onClick={() => toggleGroup(groupKey)} className="p-1 hover:bg-primary/20 rounded transition-colors shrink-0"><ChevronDown className={`h-5 w-5 text-primary/70 transform transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} /></button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/15 shrink-0 transition-colors"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50">
                          <DropdownMenuItem onClick={async e => { e.stopPropagation(); await handleDownloadSongPdf(song); }}><FileText className="mr-2 h-4 w-4 text-primary" /> Baixar partitura (PDF)</DropdownMenuItem>
                          {user && canEdit && <>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/songs/${song.id}/edit?eventId=${id}`); }}><Edit className="mr-2 h-4 w-4" /> Editar música</DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); removeSongFromEvent(song.event_song_id); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remover do evento</DropdownMenuItem>
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-sm text-primary">{song.name}</p>
                        {isOfflineSaved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                      </div>
                      {songAudios.length > 0 && <p className="text-xs text-muted-foreground mt-1">{songAudios.length} {songAudios.length === 1 ? 'áudio' : 'áudios'} disponível</p>}
                    </div>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-primary/10">
                    {songAudios.length > 0 ? songAudios.map(audio => {
                      const track = filteredPlaylist.find(t => t.id === audio.id);
                      const globalIndex = track ? filteredPlaylist.findIndex(t => t.id === audio.id) : -1;
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
                              <p className={`truncate font-medium text-sm ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>{song.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{audio.naipe.toLowerCase() === 'original' ? 'Todas as Vozes' : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/15 shrink-0 transition-colors"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
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
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                        <p className={`truncate font-medium text-sm ${globalIndex >= 0 && currentTrackIndex === globalIndex ? 'text-primary' : 'text-foreground'}`}>{song.name}</p>
                        <p className="text-xs text-muted-foreground truncate"><Badge variant="outline" className="mr-1 py-0 px-1 text-[10px] h-4 bg-primary/5 border-primary/20">{getTypeLabel(song.type, typeLabels)}</Badge>{audio.naipe.toLowerCase() === 'original' ? 'Música Completa' : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}</p>
                      </div>
                    </div>
                  </div>
                );
              });
            })}
            {filteredPlaylist.length === 0 && <div className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhum áudio encontrado com os filtros atuais.</div>}
          </div>
        )}
      </div>

      {currentTrack && (
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-primary/20 shadow-elevated animate-in slide-in-from-bottom-full duration-300">
          <div className="relative w-full px-4 pt-2 group">
            <div className="flex justify-between text-[10px] mb-1 font-medium text-muted-foreground tabular-nums"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            <Slider value={[duration ? Math.min(currentTime, duration) : 0]} max={duration || 100} step={0.1} onValueChange={handleSeek} disabled={isLoading} className="w-full cursor-pointer" />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onClick={async () => {
              const song = songs.find(s => s.id === currentTrack.songId);
              if (song?.sheet_music_url || song?.sheet_music_pdf_url) {
                const url = song.sheet_music_pdf_url || song.sheet_music_url;
                if (url) {
                  const cached = await getCachedUrl(url);
                  setSheetMusicSrc(cached);
                  setShowSheetViewer(true);
                }
              }
            }}>
              <div className="gradient-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm text-white relative shadow-glow animate-float">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>♫{(() => {
                  const song = songs.find(s => s.id === currentTrack.songId);
                  return Boolean(song?.sheet_music_url || song?.sheet_music_pdf_url) ? <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-glow-pulse" /> : null;
                })()}</>}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-sm text-primary">{currentTrack.songName}</p>
                <p className="truncate text-xs text-muted-foreground">{currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={playPrevious} disabled={isLoading} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/15 active:scale-90 transition-all rounded-md disabled:opacity-50"><SkipBack className="h-4 w-4" /></button>
              <button onClick={togglePlay} disabled={isLoading} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition shadow-glow hover:shadow-elevated disabled:opacity-70">{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5 ml-0.5" /> : <Play className="h-5 w-5 ml-0.5" />}</button>
              <button onClick={playNext} disabled={isLoading} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/15 active:scale-90 transition-all rounded-md disabled:opacity-50"><SkipForward className="h-4 w-4" /></button>
              <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-primary/20">
                <button onClick={toggleMute} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/15 active:scale-90 transition-all rounded-md">{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={(value) => setVolume(value[0])} className="w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3" />
              </div>
              <button onClick={toggleRepeat} className={`flex h-9 w-9 items-center justify-center active:scale-90 transition-all rounded-md ${repeatMode !== 'off' ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-primary hover:bg-primary/15'}`}>{repeatMode === 'track' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>
      )}

      {showSheetViewer && currentTrack && (() => {
        const currentSong = songs.find(s => s.id === currentTrack.songId);
        if (!currentSong) return null;
        const sheetUrl = sheetMusicSrc || currentSong.sheet_music_pdf_url || currentSong.sheet_music_url;
        if (!sheetUrl) return null;
        return <SheetViewer currentTrack={currentTrack} isPlaying={isPlaying} onPlayPause={togglePlay} onNext={playNext} onPrevious={playPrevious} onClose={() => { setShowSheetViewer(false); setSheetMusicSrc(null); }} onTrackEnd={() => { if (repeatMode === 'track' && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } else playNext(); }} sheetMusicUrl={sheetUrl} allTracks={filteredPlaylist} currentTrackIndex={currentTrackIndex ?? 0} onTrackSelect={index => playTrack(index)} audioElement={audioRef.current} currentTime={currentTime} duration={duration} />;
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

      {event.song_sheet_url && (
        <div className="fixed bottom-36 right-4 z-30 flex flex-col items-center animate-in zoom-in duration-300">
          <Button onClick={handleDownloadSongSheet} className="h-14 w-14 rounded-full shadow-elevated gradient-primary text-white border-2 border-white/20 hover:scale-110 active:scale-95 transition-all shadow-glow" size="icon" title="Baixar Folha de Cantos"><FileDown className="h-7 w-7" /></Button>
          <span className="mt-1 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-primary border border-primary/20 shadow-sm uppercase tracking-tighter">Folha</span>
        </div>
      )}

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
              { id: 'unissono', label: 'Uníssono', icon: Users, color: 'from-orange-500/20 to-orange-500/10 border-orange-500/30 text-orange-600' },
            ].map((naipe) => (
              <button key={naipe.id} onClick={() => { setSelectedNaipe([naipe.id]); setShowNaipeSelector(false); toast.success(`Filtro ${naipe.label} aplicado!`); }} className={cn("flex flex-col items-center justify-center p-6 rounded-2xl border-2 bg-gradient-to-br transition-all active:scale-95 hover:shadow-lg", naipe.color)}><naipe.icon className="h-10 w-10 mb-3" /><span className="font-bold text-sm uppercase tracking-wide">{naipe.label}</span></button>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-4 text-muted-foreground" onClick={() => { setSelectedNaipe(['música completa']); setShowNaipeSelector(false); }}>Ouvir apenas a Música Completa</Button>
          <Button variant="ghost" className="w-full text-xs text-muted-foreground/60" onClick={() => { setSelectedNaipe(['todas']); setShowNaipeSelector(false); }}>Ver tudo (Repertório Completo)</Button>
        </DialogContent>
      </Dialog>
      <BottomNavigation />
    </div>
  );
};

export default EventDetails;