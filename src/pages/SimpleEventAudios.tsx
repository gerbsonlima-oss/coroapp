import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, MoreVertical, Download, MessageCircle, Music } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
}

interface SongAudio {
  id: string;
  song_id: string;
  naipe: string;
  audio_url: string;
  name: string;
  song_name: string;
  song_type: string;
}

const NAIPE_ORDER = ['soprano', 'contralto', 'tenor', 'baixo', 'unissono', 'original'];

const sortByNaipeOrder = (audios: SongAudio[]): SongAudio[] => {
  return [...audios].sort((a, b) => {
    // First sort by song name
    const nameCompare = a.song_name.localeCompare(b.song_name);
    if (nameCompare !== 0) return nameCompare;
    
    // Then by naipe order
    const indexA = NAIPE_ORDER.indexOf(a.naipe.toLowerCase());
    const indexB = NAIPE_ORDER.indexOf(b.naipe.toLowerCase());
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-500/20 text-pink-600 border-pink-500/30',
  contralto: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  tenor: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  baixo: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  unissono: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  original: 'bg-gray-500/20 text-gray-600 border-gray-500/30'
};

const SimpleEventAudios = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
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
        .select('id, name, date, location, cover_image_url')
        .eq('id', id)
        .single();
      
      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch event songs
      const { data: eventSongsData, error: eventSongsError } = await supabase
        .from('event_songs')
        .select(`
          id,
          songs (id, name, type)
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

      // Map audios with song info
      const mappedAudios: SongAudio[] = (audiosData || []).map((audio: any) => {
        const eventSong = eventSongsData.find((es: any) => es.songs.id === audio.song_id);
        return {
          ...audio,
          song_name: eventSong?.songs?.name || 'Música',
          song_type: eventSong?.songs?.type || ''
        };
      });

      setAudios(sortByNaipeOrder(mappedAudios));
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
                      {audio.song_name}
                    </p>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 mt-1 capitalize ${naipeColors[audio.naipe.toLowerCase()] || ''}`}
                    >
                      {audio.naipe}
                    </Badge>
                  </div>

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
      </div>
    </>
  );
};

export default SimpleEventAudios;
