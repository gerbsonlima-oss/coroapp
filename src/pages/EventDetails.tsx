import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlaylistPlayer } from '@/components/PlaylistPlayer';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { SheetViewer } from '@/components/SheetViewer';
import { ArrowLeft, Plus, Download, Music, Search, Edit, Trash2, MoreVertical, Share2, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, FileText, FileArchive } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioCache } from '@/hooks/useAudioCache';
import { usePlaylistPlayer, type Track } from '@/hooks/usePlaylistPlayer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  type: z.string().min(1, 'Tipo é obrigatório'),
});

const NAIPE_ORDER = ['soprano', 'contralto', 'tenor', 'baixo', 'original'];

const sortByNaipeOrder = <T extends { naipe: string }>(audios: T[]): T[] => {
  return [...audios].sort((a, b) => {
    const indexA = NAIPE_ORDER.indexOf(a.naipe.toLowerCase());
    const indexB = NAIPE_ORDER.indexOf(b.naipe.toLowerCase());
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};

const getTypeLabel = (type: string | undefined, labels: Record<string, string>) => {
  if (!type) return 'Sem tipo';
  if (labels[type]) return labels[type];
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  outro: 'bg-transparent text-muted-foreground border-border',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
  contralto: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  tenor: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  baixo: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
};

// Ordem litúrgica dos tipos de música
const liturgicalOrder: Record<string, number> = {
  canto_entrada: 1,
  ato_penitencial: 2,
  gloria: 3,
  salmo: 4,
  aclamacao: 5,
  oferendas: 6,
  santo: 7,
  cordeiro: 8,
  comunhao: 9,
  acao_gracas: 10,
  final: 11,
  outro: 12,
};

const EventDetails = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isPublicView = location.pathname.startsWith('/public/');
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [songs, setSongs] = useState<EventSong[]>([]);
  
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedNaipe, setSelectedNaipe] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newSongName, setNewSongName] = useState('');
  const [newSongType, setNewSongType] = useState('');
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [showSheetViewer, setShowSheetViewer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [eventTypes, setEventTypes] = useState<{ id: string; slug: string; name: string; order_index: number }[]>([]);
  const navigate = useNavigate();
  const { cacheMultipleAudios, isLoading: isCaching } = useAudioCache();
  const trackRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    fetchSongTypes();
  }, []);

  const fetchSongTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('song_types')
        .select('*');

      if (error) throw error;

      const labels: Record<string, string> = {};
      (data || []).forEach((type) => {
        labels[type.slug] = type.name;
      });
      setTypeLabels(labels);
    } catch (error) {
      console.error('Error fetching song types:', error);
    }
  };
  
  
  // Playlist filtrada baseada no naipe selecionado
  const filteredPlaylist = selectedNaipe === 'all' 
    ? tracks 
    : tracks.filter(track => 
        track.naipe.toLowerCase().includes(selectedNaipe.toLowerCase())
      );

  const {
    currentTrack,
    currentTrackIndex,
    isPlaying,
    repeatMode,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    setAudioElement,
  } = usePlaylistPlayer(filteredPlaylist);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(audio.currentTime || 0);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentTrack?.id, isScrubbing]);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  useEffect(() => {
    // Constrói a lista de tracks respeitando a ordem definida em event_songs (order_index)
    const allTracks: Track[] = [];

    songs.forEach((song) => {
      sortByNaipeOrder(song.audios).forEach((audio) => {
        allTracks.push({
          id: audio.id,
          songId: song.id,
          songName: song.name,
          songType: song.type,
          naipe: audio.naipe,
          url: audio.audio_url,
        });
      });
    });

    setTracks(allTracks);
  }, [songs]);

  // Auto-scroll to current track
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
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: eventSongsData, error: eventSongsError } = await supabase
        .from('event_songs')
        .select(`
          id,
          songs (*)
        `)
        .eq('event_id', id)
        .order('order_index');

      if (eventSongsError) throw eventSongsError;

      const { data: eventTypesData, error: eventTypesError } = await supabase
        .from('event_song_types')
        .select(`
          id,
          order_index,
          song_types (
            id,
            slug,
            name,
            order_index
          )
        `)
        .eq('event_id', id)
        .order('order_index');

      if (eventTypesError) throw eventTypesError;

      const types = (eventTypesData || [])
        .map((row: any) => row.song_types)
        .filter(Boolean);
      setEventTypes(types);

      // Buscar os áudios de cada música
      const songIds = eventSongsData.map((es: any) => es.songs.id);
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .in('song_id', songIds);

      if (audiosError) throw audiosError;

      // Organizar áudios por música
      const formattedSongs = eventSongsData.map((es: any) => ({
        ...es.songs,
        event_song_id: es.id,
        audios: audiosData?.filter((a: any) => a.song_id === es.songs.id) || [],
      }));
      setSongs(formattedSongs);

      const { data: allSongs, error: allSongsError } = await supabase
        .from('songs')
        .select('*')
        .order('name');

      if (allSongsError) throw allSongsError;
      
      const usedSongIds = formattedSongs.map((s: any) => s.id);
      const available = allSongs.filter((s) => !usedSongIds.includes(s.id));
      setAvailableSongs(available);
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes do evento');
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
      const response = await fetch(song.sheet_music_pdf_url);
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

    const songsWithSheets = songs
      .filter((song) => song.sheet_music_pdf_url || song.sheet_music_url)
      .map((song) => ({
        id: song.id,
        name: song.name,
        type: song.type,
        sheet_music_url: song.sheet_music_url,
        sheet_music_pdf_url: song.sheet_music_pdf_url,
      }));

    if (songsWithSheets.length === 0) {
      toast.error('Nenhuma partitura encontrada. Adicione partituras às músicas antes de exportar.');
      return;
    }

    try {
      toast.info('Gerando PDF de partituras...');
      await exportEventPDF(
        {
          id: event.id,
          name: event.name,
          date: event.date,
          location: event.location,
          cover_image_url: event.cover_image_url,
          pdf_theme: event.pdf_theme,
        },
        songsWithSheets
      );
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
      await exportEventZIP(event.name, filteredPlaylist, selectedNaipe);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const addSongToEvent = async () => {
    if (!selectedSong) return;

    try {
      const { error } = await supabase.from('event_songs').insert([
        {
          event_id: id,
          song_id: selectedSong,
        },
      ]);

      if (error) throw error;

      toast.success('Música adicionada ao evento!');
      setShowAddDialog(false);
      setSelectedSong(null);
      setSearchQuery('');
      fetchEventDetails();
    } catch (error: any) {
      toast.error('Erro ao adicionar música');
    }
  };

  const createAndAddSongToEvent = async () => {
    try {
      const validatedData = songSchema.parse({
        name: newSongName,
        type: newSongType,
      });

      setIsCreatingSong(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert([
          {
            user_id: user.id,
            name: validatedData.name,
            type: validatedData.type,
            notes: '',
            sheet_music_url: null,
          },
        ])
        .select()
        .single();

      if (songError) throw songError;

      const { error: eventSongError } = await supabase.from('event_songs').insert([
        {
          event_id: id,
          song_id: songData.id,
        },
      ]);

      if (eventSongError) throw eventSongError;

      toast.success('Música criada e adicionada ao evento!');
      setShowAddDialog(false);
      setNewSongName('');
      setNewSongType('');
      fetchEventDetails();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Erro ao criar música');
      }
    } finally {
      setIsCreatingSong(false);
    }
  };

  const removeSongFromEvent = async (eventSongId: string) => {
    try {
      const { error } = await supabase
        .from('event_songs')
        .delete()
        .eq('id', eventSongId);

      if (error) throw error;

      toast.success('Música removida do evento!');
      fetchEventDetails();
    } catch (error: any) {
      toast.error('Erro ao remover música');
    }
  };

  const filteredAvailableSongs = availableSongs.filter(song =>
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const naipeOptions = ['Soprano', 'Contralto', 'Tenor', 'Baixo'];

  const getFilteredTracks = () => {
    return filteredPlaylist;
  };

  const handleDownloadAll = async () => {
    const allAudioUrls = tracks.map(track => track.url);
    
    // Coletar URLs das partituras
    const sheetMusicUrls = songs
      .filter(song => song.sheet_music_url)
      .map(song => song.sheet_music_url!);

    const allUrls = [...allAudioUrls, ...sheetMusicUrls];

    if (allUrls.length === 0) {
      toast.error('Nenhum arquivo disponível para download');
      return;
    }

    await cacheMultipleAudios(allUrls);
    
    // Salvar evento e áudios no localStorage para acesso offline
    if (event) {
      try {
        // Buscar eventos já salvos
        const savedEventsJson = localStorage.getItem('cached_events');
        const savedEvents: any[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
        
        // Adicionar ou atualizar evento
        const eventIndex = savedEvents.findIndex(e => e.id === event.id);
        if (eventIndex >= 0) {
          savedEvents[eventIndex] = event;
        } else {
          savedEvents.push(event);
        }
        
        localStorage.setItem('cached_events', JSON.stringify(savedEvents));
        localStorage.setItem(`event_audios_${event.id}`, JSON.stringify(allAudioUrls));
        localStorage.setItem(`event_sheets_${event.id}`, JSON.stringify(sheetMusicUrls));
        
        toast.success('Evento salvo para acesso offline!');
      } catch (error) {
        console.error('Erro ao salvar evento offline:', error);
      }
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || !time) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current || !duration) return;
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Evento não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header com gradiente e imagem de capa */}
      <div className="relative">
        <div className="gradient-header relative flex h-64 items-end overflow-hidden">
          {event.cover_image_url && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${event.cover_image_url})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background" />
            </div>
          )}
          
          <div className="relative z-10 w-full px-4 pb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(isPublicView ? '/auth' : '/events')} 
              className="absolute left-4 top-4 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <h1 className="mb-2 text-2xl font-bold">{event.name}</h1>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span>{format(new Date(event.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
              <span>•</span>
              <span>{tracks.length} músicas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de ações - agora rola com a página */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              if (filteredPlaylist.length > 0) {
                if (currentTrackIndex === null) {
                  playTrack(0);
                } else {
                  togglePlay();
                }
              }
            }}
            disabled={filteredPlaylist.length === 0}
            className="h-14 w-14 rounded-full bg-primary p-0 hover:scale-105 hover:bg-primary-hover"
          >
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownloadAll}
            disabled={isCaching || tracks.length === 0}
            className="text-muted-foreground hover:text-foreground"
          >
            <Download className="h-6 w-6" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {user && (
                <>
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
                </>
              )}
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar Partituras
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportZIP}>
                <FileArchive className="mr-2 h-4 w-4" />
                Exportar Áudios
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedNaipe} onValueChange={setSelectedNaipe}>
            <SelectTrigger className="w-[140px] border-muted bg-transparent text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {naipeOptions.map((naipe) => (
                <SelectItem key={naipe} value={naipe}>
                  {naipe}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de músicas - grupos por música na ordem definida na edição rápida */}
      <div className="space-y-2 pb-4 px-3 sm:px-4">
        {songs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma música adicionada a este evento ainda.
          </p>
        ) : (
          songs.map((song, index) => {
            const displayIndex = index + 1;

            const songAudios = sortByNaipeOrder(
              selectedNaipe === 'all'
                ? song.audios
                : song.audios.filter(audio => {
                    const audioNaipe = String(audio.naipe || '').toLowerCase();
                    const targetNaipe = String(selectedNaipe).toLowerCase();
                    return audioNaipe === targetNaipe;
                  })
            );

            const hasSongAudios = songAudios.length > 0;
            const hasAnyAudio = (song.audios || []).length > 0;
            const hasSheetMusic = Boolean(song.sheet_music_url || song.sheet_music_pdf_url);

            return (
              <Card key={song.event_song_id} className="mb-3 overflow-hidden">
                <div className="border-b border-border px-4 py-3 bg-muted/40">
                  <div className="flex flex-col gap-2">
                    {/* Linha 1: numeração + tipo da música à esquerda, ícones e menu à direita */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {displayIndex}
                        </div>
                        <Badge className={typeColors[song.type]}>
                          {getTypeLabel(song.type, typeLabels)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center justify-center"
                          title={hasAnyAudio ? 'Possui áudios cadastrados' : 'Sem áudios cadastrados'}
                        >
                          <Music
                            className={
                              hasAnyAudio
                                ? 'h-4 w-4 text-primary'
                                : 'h-4 w-4 text-muted-foreground/60'
                            }
                          />
                        </div>

                        <div
                          className="flex items-center justify-center"
                          title={hasSheetMusic ? 'Possui partitura cadastrada' : 'Sem partitura cadastrada'}
                        >
                          <FileText
                            className={
                              hasSheetMusic
                                ? 'h-4 w-4 text-primary'
                                : 'h-4 w-4 text-muted-foreground/60'
                            }
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50">
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleDownloadSongPdf(song);
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Baixar partitura (PDF)
                            </DropdownMenuItem>
                            {user && (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/songs/${song.id}/edit?eventId=${id}`);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar música
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSongFromEvent(song.event_song_id);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remover do evento
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Linha 2: nome da música ocupando toda a largura */}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-base md:text-lg leading-snug">
                        {song.name}
                      </p>
                      {songAudios.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {songAudios.length} áudio(s) disponível(is)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {hasSongAudios ? (
                    songAudios.map((audio) => {
                      const track = filteredPlaylist.find(t => t.id === audio.id);
                      const globalIndex = track ? filteredPlaylist.findIndex(t => t.id === audio.id) : -1;

                      return (
                        <div
                          key={audio.id}
                          ref={(el) => {
                            if (globalIndex >= 0) {
                              trackRefs.current[globalIndex] = el;
                            }
                          }}
                          onClick={() => globalIndex >= 0 && playTrack(globalIndex)}
                          className={`flex items-center gap-3 px-4 py-3 active:bg-muted ${
                            globalIndex >= 0 && currentTrackIndex === globalIndex ? '' : 'cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Music className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p
                                className={`truncate font-medium text-sm ${
                                  globalIndex >= 0 && currentTrackIndex === globalIndex
                                    ? 'text-primary'
                                    : 'text-foreground'
                                }`}
                              >
                                {song.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {audio.naipe.toLowerCase() === 'original' 
                                  ? 'Todas as Vozes' 
                                  : audio.naipe.charAt(0).toUpperCase() + audio.naipe.slice(1).toLowerCase()}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await fetch(audio.audio_url);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                const fileName = `${getTypeLabel(song.type, typeLabels)} - ${song.name} - ${audio.naipe}.mp3`;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                                toast.success('Download iniciado!');
                              } catch (error) {
                                toast.error('Erro ao baixar áudio');
                              }
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Baixar áudio"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground">
                      Esta música ainda não possui áudios cadastrados.
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Mini Player Fixo - acima da navegação */}
      {currentTrack && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4">
          <div className="rounded-lg border border-border bg-card/95 shadow-elevated backdrop-blur-md px-3 py-2 space-y-2">
            {/* Cabeçalho: capa/partitura + info da faixa + tempo */}
            <div className="flex items-center gap-3">
              <div 
                className="gradient-card flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded relative"
                onClick={() => {
                  const song = songs.find(s => s.id === currentTrack.songId);
                  if (song?.sheet_music_url || song?.sheet_music_pdf_url) {
                    setShowSheetViewer(true);
                  } else {
                    toast.info('Nenhuma partitura disponível para esta música');
                  }
                }}
              >
                <span className="text-sm text-white">♫</span>
                {(() => {
                  const song = songs.find(s => s.id === currentTrack.songId);
                  const hasSheet = Boolean(song?.sheet_music_url || song?.sheet_music_pdf_url);
                  return hasSheet ? (
                    <div
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background"
                      title="Partitura disponível"
                    />
                  ) : (
                    <div
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-muted-foreground/40 border-2 border-background"
                      title="Sem partitura"
                    />
                  );
                })()}
              </div>

              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => {
                const song = songs.find(s => s.id === currentTrack.songId);
                if (song?.sheet_music_url || song?.sheet_music_pdf_url) {
                  setShowSheetViewer(true);
                }
              }}>
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentTrack.songName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}
                </p>
              </div>

              <span className="ml-2 text-xs text-muted-foreground shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Barra de progresso inspirada no player de naipe */}
            <Slider
              value={[duration ? Math.min(currentTime, duration) : 0]}
              max={duration || 0}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full cursor-pointer touch-action-pan-y"
            />

            {/* Controles principais */}
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={playPrevious}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-subtle active:scale-95 transition"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              <button
                onClick={playNext}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button 
                onClick={toggleRepeat}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition ${
                  repeatMode !== 'off' ? 'text-primary' : ''
                }`}
                title={
                  repeatMode === 'off' ? 'Sem repetição' :
                  repeatMode === 'playlist' ? 'Repetir playlist' :
                  'Repetir música'
                }
              >
                {repeatMode === 'track' ? (
                  <Repeat1 className="h-4 w-4" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Audio player oculto - controla o áudio */}
          <div style={{ display: 'none' }}>
            <PlaylistPlayer
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              repeatMode={repeatMode}
              onPlayPause={togglePlay}
              onNext={playNext}
              onPrevious={playPrevious}
              onToggleRepeat={toggleRepeat}
              onTrackEnd={() => {
                if (repeatMode === 'track') {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                  }
                } else {
                  playNext();
                }
              }}
              onSetAudioElement={(audio) => {
                audioRef.current = audio;
                setAudioElement(audio);
              }}
              showDownloadButton={false}
            />
          </div>
        </div>
      )}

      {/* Visualizador de partitura */}
      {showSheetViewer && currentTrack && (() => {
        const currentSong = songs.find(s => s.id === currentTrack.songId);
        if (!currentSong) return null;

        const sheetUrl = currentSong.sheet_music_pdf_url || currentSong.sheet_music_url;
        if (!sheetUrl) return null;

        return (
          <SheetViewer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            onNext={playNext}
            onPrevious={playPrevious}
            onClose={() => setShowSheetViewer(false)}
            onTrackEnd={() => {
              if (repeatMode === 'track') {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play();
                }
              } else {
                playNext();
              }
            }}
            sheetMusicUrl={sheetUrl}
            allTracks={filteredPlaylist}
            currentTrackIndex={currentTrackIndex ?? 0}
            onTrackSelect={(index) => playTrack(index)}
            audioElement={audioRef.current}
            currentTime={currentTime}
            duration={duration}
          />
        );
      })()}


      <BottomNavigation />
    </div>
  );
};

export default EventDetails;
