import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';

interface Song {
  id: string;
  name: string;
  lyrics: string | null;
  type: string;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  location: string | null;
}

interface SongType {
  slug: string;
  name: string;
  order_index: number;
}

const defaultTypeLabels: Record<string, { label: string; order: number }> = {
  entrada: { label: 'Entrada', order: 1 },
  'ato-penitencial': { label: 'Ato Penitencial', order: 2 },
  gloria: { label: 'Glória', order: 3 },
  aclamacao: { label: 'Aclamação', order: 4 },
  ofertorio: { label: 'Ofertório', order: 5 },
  santo: { label: 'Santo', order: 6 },
  'paz': { label: 'Paz', order: 7 },
  'cordeiro': { label: 'Cordeiro', order: 8 },
  comunhao: { label: 'Comunhão', order: 9 },
  'acao-de-gracas': { label: 'Ação de Graças', order: 10 },
  final: { label: 'Final', order: 11 },
  outro: { label: 'Outro', order: 99 },
};

export default function EventLyrics() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songTypes, setSongTypes] = useState<SongType[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch song types for this tenant
      const { data: typesData } = await supabase
        .from('song_types')
        .select('slug, name, order_index')
        .eq('tenant_id', eventData.tenant_id);

      if (typesData) {
        setSongTypes(typesData);
      }

      // Fetch event songs with song details
      const { data: eventSongsData, error: songsError } = await supabase
        .from('event_songs')
        .select(`
          order_index,
          type,
          songs (
            id,
            name,
            lyrics,
            type
          )
        `)
        .eq('event_id', id)
        .order('order_index');

      if (songsError) throw songsError;

      if (eventSongsData) {
        const mappedSongs = eventSongsData.map((es: any) => ({
          id: es.songs.id,
          name: es.songs.name,
          lyrics: es.songs.lyrics,
          type: es.type || es.songs.type,
        }));

        // Sort by type order
        const getOrder = (type: string) => {
          const customType = typesData?.find(t => t.slug === type);
          if (customType) return customType.order_index;
          return defaultTypeLabels[type]?.order || 99;
        };

        mappedSongs.sort((a, b) => getOrder(a.type) - getOrder(b.type));
        setSongs(mappedSongs);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Erro ao carregar evento');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const customType = songTypes.find(t => t.slug === type);
    if (customType) return customType.name;
    return defaultTypeLabels[type]?.label || type;
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Letras - ${event?.name}`,
          url,
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  const formatLyrics = (lyrics: string) => {
    // Split by double line breaks for paragraphs
    const paragraphs = lyrics.split(/\n\n+/);
    
    return paragraphs.map((paragraph, pIndex) => {
      const lines = paragraph.split('\n');
      
      return (
        <div key={pIndex} className="mb-4 last:mb-0">
          {lines.map((line, lIndex) => {
            // Check for markers like "Refrão:", "Verso:", etc.
            const isMarker = /^(Refrão|Estribilho|Verso|Antífona|R\.|A\.|V\.):?/i.test(line.trim());
            
            // Render slashes in red
            if (line.includes('/')) {
              const parts = line.split('/');
              return (
                <p 
                  key={lIndex} 
                  className={`leading-relaxed ${isMarker ? 'font-semibold text-primary mt-3 first:mt-0' : ''}`}
                >
                  {parts.map((part, i) => (
                    <span key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <span className="text-destructive font-bold">/</span>
                      )}
                    </span>
                  ))}
                </p>
              );
            }
            
            return (
              <p 
                key={lIndex} 
                className={`leading-relaxed ${isMarker ? 'font-semibold text-primary mt-3 first:mt-0' : ''}`}
              >
                {line || '\u00A0'}
              </p>
            );
          })}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Music2 className="w-8 h-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Evento não encontrado</h1>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Helmet>
        <title>Letras - {event.name}</title>
        <meta name="description" content={`Letras das músicas para ${event.name}`} />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="text-center flex-1 min-w-0 px-2">
              <h1 className="font-semibold truncate">{event.name}</h1>
              <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleShare}
              className="shrink-0"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
          {songs.length === 0 ? (
            <div className="text-center py-12">
              <Music2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma música com letra encontrada</p>
            </div>
          ) : (
            <div className="space-y-8">
              {songs.map((song, index) => (
                <article 
                  key={song.id} 
                  className="bg-card rounded-2xl border shadow-sm overflow-hidden"
                >
                  {/* Song header */}
                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium mb-1">
                          {getTypeLabel(song.type)}
                        </span>
                        <h2 className="font-semibold text-lg leading-tight">{song.name}</h2>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lyrics */}
                  <div className="px-5 py-5">
                    {song.lyrics ? (
                      <div className="text-foreground/90 text-base leading-relaxed font-serif">
                        {formatLyrics(song.lyrics)}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-center py-4">
                        Letra não disponível
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-xl border-t py-3">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-xs text-muted-foreground">
              {songs.length} {songs.length === 1 ? 'música' : 'músicas'} • {event.location || 'Local não informado'}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
