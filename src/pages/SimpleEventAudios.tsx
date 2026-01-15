import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Pause, MoreVertical, Download, MessageCircle, Music, FileText, X, Guitar, BookOpen, Share2, CloudDownload, CheckCircle, Trash2, RefreshCw, Music2, Search, Filter, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import FullscreenChordViewer from '@/components/FullscreenChordViewer';
import { SimpleSheetViewer } from '@/components/SimpleSheetViewer';
import { SaveEventOfflineDialog } from '@/components/SaveEventOfflineDialog';
import { useEventOfflineSave, loadOfflineEventData, isOfflineMode } from '@/hooks/useEventOfflineSave';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendAudioToWhatsApp } from '@/utils/whatsappShare';
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
  const { tenantSlug } = useTenant();
  
  // Check if this is accessed from internal navigation (not shared link /e/:id)
  const isInternalAccess = !location.pathname.startsWith('/e/');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [chordsModalOpen, setChordsModalOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<SongAudio | null>(null);
  const [exportingLyrics, setExportingLyrics] = useState(false);
  const [exportingChords, setExportingChords] = useState(false);
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

  // Offline sync hook
  const { isSyncing, syncSingleEvent, isOnline } = useOfflineSync();

  // Check if we're in offline mode
  const offlineMode = isOfflineMode();

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
      
      setAudios(sortByTypeOrder(offlineAudios));
      setSongs(offlineData.songs);
      setLoading(false);
      
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

  const handlePlay = (audio: SongAudio) => {
    if (playingId === audio.id) {
      // Pause current
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(audio.audio_url);
      
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
        setCurrentTime(0);
        setDuration(0);
      };
      
      newAudio.onerror = () => {
        toast.error('Erro ao reproduzir áudio');
        setPlayingId(null);
        setCurrentTime(0);
        setDuration(0);
      };
      
      newAudio.play();
      audioRef.current = newAudio;
      setPlayingId(audio.id);
      setCurrentTime(0);
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

  // Get unique naipes from audios
  const availableNaipes = useMemo(() => {
    const naipes = new Set(audios.map(a => a.naipe));
    return Array.from(naipes).sort();
  }, [audios]);

  // Filter audios based on search and naipe selection
  const filteredAudios = useMemo(() => {
    let result = audios;
    
    // Filter by naipes (if any selected)
    if (selectedNaipes.length > 0) {
      result = result.filter(a => selectedNaipes.includes(a.naipe));
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

  const handleShareWhatsApp = async (audio: SongAudio) => {
    toast.info('Preparando arquivo para envio...');
    try {
      await sendAudioToWhatsApp(audio.audio_url, audio.song_name, audio.naipe, audio.song_sheet_music_pdf_url || undefined);
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Erro ao compartilhar arquivo');
    }
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
              <h1 className="font-bold text-xl text-foreground leading-tight mb-1">
                {event.name}
              </h1>
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
            <div className="absolute top-0 right-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={exportingLyrics || exportingChords}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
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
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => {
                    const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'wxagqywobyzntrlkhfao';
                    const ogUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/og-event?id=${id}`;
                    const text = `🎵 ${event.name} - Áudios e Cifras`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n\n' + ogUrl)}`, '_blank');
                  }}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Compartilhar
                  </DropdownMenuItem>
                  {songs.length > 0 && (
                    <>
                      <DropdownMenuItem onClick={async () => {
                        const { exportEventPDF } = await import('@/utils/exportEventPDF');
                        const songsWithSheets = songs.filter(s => s.sheet_music_pdf_url || s.sheet_music_url);
                        if (songsWithSheets.length === 0) {
                          toast.error('Nenhuma partitura disponível');
                          return;
                        }
                        await exportEventPDF(event, songsWithSheets);
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
        <div className="px-4 py-2 max-w-2xl mx-auto">
          {/* Active filters indicator */}
          {(searchQuery || selectedNaipes.length > 0) && (
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {filteredAudios.length} {filteredAudios.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
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
                
                return (
                  <Card 
                    key={audio.id} 
                    className={`p-3 transition-colors hover:bg-accent/50`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Play Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20"
                        onClick={() => handlePlay(audio)}
                      >
                        {isPlaying ? (
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
                            className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider bg-secondary/50 text-muted-foreground/70 border-none pointer-events-none"
                          >
                            {audio.naipe}
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleShareWhatsApp(audio)}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Enviar por WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(audio)}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Progress Bar - Only shows when playing */}
                    {isPlaying && duration > 0 && (
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
      </div>
    </>
  );
};

export default SimpleEventAudios;
