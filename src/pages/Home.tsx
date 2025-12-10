import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Music, Sparkles, MapPin, Clock, LogIn, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useLiturgicalCalendar } from '@/hooks/useLiturgicalCalendar';
import { useAuth } from '@/hooks/useAuth';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { format, addMonths, addDays, getDaysInMonth, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLiturgicalDay } from '@/data/liturgicalCalendar';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
}

interface FeedItem {
  id: string;
  type: 'event' | 'song' | 'audio';
  title: string;
  subtitle?: string;
  date: string;
  voiceType?: string;
}

const getLiturgicalColor = (season: string): string => {
  const colors: Record<string, string> = {
    'Advento': 'from-purple-600 to-purple-900',
    'Tempo do Natal': 'from-red-600 to-red-900',
    'Tempo Comum': 'from-green-600 to-green-900',
    'Quaresma': 'from-violet-600 to-violet-900',
    'Semana Santa': 'from-black to-gray-800',
    'Tempo Pascal': 'from-yellow-600 to-yellow-900',
  };
  return colors[season] || 'from-blue-600 to-blue-900';
};

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();
  const { today: liturgicalDay } = useLiturgicalCalendar(today);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);

  const { data: upcomingEventsData } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('id, name, date, location, cover_image_url')
        .gte('date', format(today, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .limit(5);

      return data as Event[] || [];
    },
  });

  const { data: feedData } = useQuery({
    queryKey: ['feed-updates'],
    queryFn: async () => {
      const [songs, audios] = await Promise.all([
        supabase
          .from('songs')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('song_audios')
          .select('id, created_at, songs(name, naipe)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: FeedItem[] = [];
      
      if (songs.data) {
        items.push(...songs.data.map((s: any) => ({
          id: s.id,
          type: 'song' as const,
          title: s.name,
          date: s.created_at,
        })));
      }
      
      if (audios.data) {
        items.push(...audios.data.map((a: any) => ({
          id: a.id,
          type: 'audio' as const,
          title: a.songs?.name || 'Áudio adicionado',
          voiceType: a.songs?.naipe || undefined,
          date: a.created_at,
        })));
      }

      return items.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ).slice(0, 10);
    },
  });

  useEffect(() => {
    if (upcomingEventsData) {
      setUpcomingEvents(upcomingEventsData);
    }
  }, [upcomingEventsData]);

  useEffect(() => {
    if (feedData) {
      setFeedItems(feedData);
    }
  }, [feedData]);

  const liturgicalColor = liturgicalDay 
    ? getLiturgicalColor(liturgicalDay.liturgicalSeason)
    : 'from-blue-600 to-blue-900';

  const getFeedIcon = (type: string) => {
    switch (type) {
      case 'event':
        return '📅';
      case 'song':
        return '🎵';
      case 'audio':
        return '🎙️';
      default:
        return '✨';
    }
  };

  const getFeedTypeLabel = (type: string) => {
    switch (type) {
      case 'event':
        return 'Novo Evento';
      case 'song':
        return 'Nova Canção';
      case 'audio':
        return 'Novo Áudio';
      default:
        return 'Atualização';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50 pb-28">
      {/* Header with Auth and Install buttons */}
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        {!user && (
          <Button
            onClick={() => navigate('/auth')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        )}
        <InstallPWAButton />
      </div>

      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${liturgicalColor} text-white pt-6 pb-8 px-4 rounded-b-2xl shadow-lg`}>
        <div className="text-center space-y-1">
          <p className="text-xs font-medium opacity-90">Hoje,</p>
          <h1 className="text-2xl font-bold">
            {format(today, "dd 'de' MMMM", { locale: ptBR })}
          </h1>
          <p className="text-xs opacity-80">
            {format(today, 'EEEE', { locale: ptBR })}
          </p>
        </div>

        {liturgicalDay && (
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2 border border-white/20 mt-3">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold">{liturgicalDay.liturgicalSeason}</p>
            </div>
            <h2 className="text-sm font-bold leading-snug line-clamp-2">
              {liturgicalDay.saint || liturgicalDay.celebration}
            </h2>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto">
        {/* Próximos Eventos */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Próximos Eventos</h3>
            </div>

            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <Card
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-all border-0 group flex flex-row"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  {event.cover_image_url && (
                    <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden bg-muted">
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                    <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{event.name}</h3>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {format(new Date(event.date), "dd MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="line-clamp-1 truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Feed Updates */}
        {feedItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Últimas Atualizações</h3>
            </div>

            <div className="space-y-2">
              {feedItems.map((item) => (
                <Card
                  key={`${item.type}-${item.id}`}
                  className="p-4 border-0 bg-card hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">{getFeedIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {getFeedTypeLabel(item.type)}
                        </span>
                        {item.voiceType && item.type === 'audio' && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {item.voiceType}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm mb-1 truncate">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.date), "dd MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Home;
