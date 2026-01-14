import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, MoreVertical, Download, MessageCircle, Music, FileText, X, Guitar, BookOpen, Share2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import FullscreenChordViewer from '@/components/FullscreenChordViewer';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendAudioToWhatsApp } from '@/utils/whatsappShare';
import { Helmet } from 'react-helmet-async';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  tenant_id: string | null;
}

// Fallback type labels with liturgical order
const defaultTypeLabels: Record<string, { name: string; order: number }> = {
  canto_entrada: { name: 'Canto de Entrada', order: 1 },
  ato_penitencial: { name: 'Ato Penitencial', order: 2 },
  gloria: { name: 'Glória', order: 3 },
  salmo: { name: 'Salmo Responsorial', order: 4 },
  aclamacao: { name: 'Aclamação ao Evangelho', order: 5 },
  oferendas: { name: 'Canto das Oferendas', order: 6 },
  santo: { name: 'Santo', order: 7 },
  cordeiro: { name: 'Cordeiro de Deus', order: 8 },
  comunhao: { name: 'Canto da Comunhão', order: 9 },
  acao_gracas: { name: 'Ação de Graças', order: 10 },
  final: { name: 'Canto Final', order: 11 },
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchEventData = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, location, cover_image_url, tenant_id')
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
          songs (id, name, type, lyrics, chords)
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
          song_type_name: songType?.name || defaultType?.name || typeSlug,
          song_type_order: songType?.order_index ?? defaultType?.order ?? 999,
          song_lyrics: eventSong?.songs?.lyrics || null,
          song_chords: eventSong?.songs?.chords || null
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
      newAudio.onended = () => setPlayingId(null);
      newAudio.onerror = () => {
        toast.error('Erro ao reproduzir áudio');
        setPlayingId(null);
      };
      newAudio.play();
      audioRef.current = newAudio;
      setPlayingId(audio.id);
    }
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
    try {
      await sendAudioToWhatsApp(audio.audio_url, audio.song_name, audio.naipe);
    } catch (error) {
      toast.error('Erro ao compartilhar');
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
      audioRef.current?.pause();
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
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 py-6">
          <div className="flex items-start gap-4 max-w-2xl mx-auto">
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
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-xl text-foreground leading-tight mb-1">
                {event.name}
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {formattedDate}
              </p>
              {event.location && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {event.location}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {audios.length} áudio{audios.length !== 1 ? 's' : ''}
              </p>
              
              {/* Options dropdown */}
              <div className="mt-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={exportingLyrics || exportingChords}
                    >
                      <MoreVertical className="h-3.5 w-3.5 mr-1.5" />
                      {exportingLyrics || exportingChords ? 'Gerando...' : 'Opções'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover">
                    <DropdownMenuItem onClick={() => {
                      const shareUrl = window.location.href;
                      const text = `${event.name} - Áudios do evento`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + shareUrl)}`, '_blank');
                    }}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Compartilhar via WhatsApp
                    </DropdownMenuItem>
                    {songs.length > 0 && (
                      <>
                        <DropdownMenuItem onClick={handleExportSongBooklet} disabled={exportingLyrics}>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Livreto de Cantos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportChordBooklet} disabled={exportingChords}>
                          <Guitar className="mr-2 h-4 w-4" />
                          Livreto de Cifras
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Audio List */}
        <div className="px-4 py-4 max-w-2xl mx-auto">
          {audios.length === 0 ? (
            <Card className="p-8 text-center">
              <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum áudio disponível</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {audios.map((audio) => (
                <Card 
                  key={audio.id} 
                  className="p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                >
                  {/* Play Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20"
                    onClick={() => handlePlay(audio)}
                  >
                    {playingId === audio.id ? (
                      <Pause className="h-5 w-5 text-primary" />
                    ) : (
                      <Play className="h-5 w-5 text-primary ml-0.5" />
                    )}
                  </Button>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {audio.song_type_name}
                    </p>
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
                </Card>
              ))}
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
            
            {/* Footer with close button */}
            <div className="shrink-0 px-5 py-3 border-t bg-muted/30 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setLyricsModalOpen(false)}
                className="min-w-[120px]"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fullscreen Chords Viewer */}
        {chordsModalOpen && selectedAudio?.song_chords && (
          <FullscreenChordViewer
            chords={selectedAudio.song_chords}
            songName={selectedAudio.song_name}
            onClose={() => setChordsModalOpen(false)}
          />
        )}
      </div>
    </>
  );
};

export default SimpleEventAudios;
