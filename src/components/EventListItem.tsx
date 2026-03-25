import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, ChevronDown, ChevronUp, Music, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CachedImage } from './CachedImage';
import { OfflineBadge } from './OfflineBadge';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useTenantPath } from '@/contexts/TenantContext';
import { parseDateOnlyLocal } from '@/utils/dateParsing';

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

const getRelativeDateLabel = (date: string) => {
  const target = parseDateOnlyLocal(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / dayMs);

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanha';
  if (diffDays > 1) return `Em ${diffDays} dias`;
  return `${Math.abs(diffDays)} dias atras`;
};

export const EventListItem = ({ event }: EventListItemProps) => {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { isEventAvailableOffline } = useOfflineStorage();
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [songsLoaded, setSongsLoaded] = useState(false);

  const isOffline = isEventAvailableOffline(event.id);
  const relativeDate = getRelativeDateLabel(event.date);

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
        console.error('Erro ao carregar musicas:', error);
      } finally {
        setLoadingSongs(false);
      }
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card className="overflow-hidden border border-border/60 bg-card/95 transition-all duration-200 hover:shadow-md hover:border-primary/30">
      <button
        type="button"
        className="flex w-full flex-row text-left"
        onClick={() => navigate(buildPath(`/events/${event.id}`))}
        aria-label={`Abrir evento ${event.name}`}
      >
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden bg-muted sm:h-32 sm:w-32">
          {event.cover_image_url ? (
            <CachedImage
              src={event.cover_image_url}
              alt={event.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <Music className="h-8 w-8 text-primary/40" />
                </div>
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <Music className="h-8 w-8 text-primary/40" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
          <div>
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="flex-1 line-clamp-2 text-base font-bold sm:text-lg">{event.name}</h3>
              <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className="h-5 bg-background/80 px-1.5 text-[10px]">
                  {relativeDate}
                </Badge>
                {isOffline && <OfflineBadge variant="small" className="shrink-0" />}
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground sm:text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="line-clamp-1">{format(parseDateOnlyLocal(event.date), "dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="line-clamp-1 truncate">{event.location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 text-[11px] font-medium text-primary/80 sm:text-xs">Toque para abrir detalhes do evento</div>
        </div>
      </button>

      <div className="border-t border-border/50 bg-card px-3 py-2 sm:px-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs hover:bg-primary/10 hover:text-primary"
          onClick={handleExpand}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              Ocultar musicas
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Ver musicas
              {songsLoaded && songs.length > 0 && <span className="ml-1 text-muted-foreground">({songs.length})</span>}
            </>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="animate-in slide-in-from-top-2 border-t border-border/50 bg-muted/30 px-4 py-3">
          {loadingSongs ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : songs.length > 0 ? (
            <div className="space-y-2">
              {songs.map((song, index) => (
                <div key={song.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{index + 1}.</span>
                    <span className="truncate font-medium text-foreground/90">{song.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 bg-background/50 px-1.5 text-[10px] font-normal text-muted-foreground"
                  >
                    {getTypeLabel(song.type)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">Nenhuma musica cadastrada neste evento.</p>
          )}
        </div>
      )}
    </Card>
  );
};
