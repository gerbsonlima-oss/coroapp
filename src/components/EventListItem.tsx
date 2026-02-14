import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, ChevronDown, ChevronUp, Music, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
}

interface Song {
  id: string;
  name: string;
  type: string;
}

interface EventListItemProps {
  event: Event;
}

export const EventListItem = ({ event }: EventListItemProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [songsLoaded, setSongsLoaded] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (!songsLoaded) {
      setLoadingSongs(true);
      try {
        const { data, error } = await supabase
          .from('event_songs')
          .select(`
            songs (
              id,
              name,
              type
            )
          `)
          .eq('event_id', event.id)
          .order('order_index');

        if (error) throw error;

        if (data) {
          const formattedSongs = data.map((item: any) => item.songs);
          setSongs(formattedSongs);
          setSongsLoaded(true);
        }
      } catch (error) {
        console.error('Erro ao carregar músicas:', error);
      } finally {
        setLoadingSongs(false);
      }
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const isPast = new Date(event.date) < new Date();

  return (
    <Card className={`overflow-hidden border-border/40 transition-all hover:shadow-elevated hover:border-border group ${isPast ? 'opacity-75 hover:opacity-100' : ''}`}>
      <div 
        className="flex flex-row cursor-pointer"
        onClick={() => navigate(`/events/${event.id}`)}
      >
        {/* Imagem */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 overflow-hidden rounded-l-xl">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className={`h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 ${isPast ? 'grayscale-[0.3] group-hover:grayscale-0' : ''}`}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <Music className="h-8 w-8 text-primary/40" />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="font-bold text-base sm:text-lg line-clamp-2 group-hover:text-primary transition-colors">{event.name}</h3>
            <div className="space-y-1 mt-1.5 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 flex-shrink-0 text-primary/60" />
                <span className="line-clamp-1">
                  {format(new Date(event.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary/60" />
                  <span className="line-clamp-1 truncate">{event.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={handleExpand}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Músicas
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Músicas Expandida */}
      {expanded && (
        <div className="border-t border-border/40 bg-secondary/30 px-4 py-3 animate-in slide-in-from-top-2">
          {loadingSongs ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : songs.length > 0 ? (
            <div className="space-y-2">
              {songs.map((song, index) => (
                <div key={song.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground text-xs w-4 text-right shrink-0">{index + 1}.</span>
                    <span className="font-medium truncate text-foreground/90">{song.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 font-normal text-muted-foreground bg-secondary/50 border-border/50">
                    {getTypeLabel(song.type)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhuma música cadastrada neste evento.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
