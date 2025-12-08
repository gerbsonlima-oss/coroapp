import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Plus, Calendar, MapPin, LogOut, LogIn, Music, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioCache } from '@/hooks/useAudioCache';
interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  cover_image_url: string | null;
}
const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const {
    cachedAudios
  } = useAudioCache();
  useEffect(() => {
    fetchEvents();
  }, []);
  const fetchEvents = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('events').select('*').order('date', {
        ascending: false
      });
      if (error) throw error;

      // Se online, mostra todos os eventos
      setEvents(data || []);
      setIsOffline(false);
    } catch (error: any) {
      // Se offline, busca eventos do localStorage que têm áudios em cache
      const cachedEvents = await getOfflineEvents();
      if (cachedEvents.length > 0) {
        setEvents(cachedEvents);
        setIsOffline(true);
        toast.info('Modo offline: mostrando apenas eventos com áudios baixados');
      } else {
        setIsOffline(true);
        toast.error('Você está offline e não há eventos baixados');
      }
    } finally {
      setLoading(false);
    }
  };
  const getOfflineEvents = async (): Promise<Event[]> => {
    try {
      // Busca eventos salvos no localStorage
      const savedEventsJson = localStorage.getItem('cached_events');
      if (!savedEventsJson) return [];
      const savedEvents: Event[] = JSON.parse(savedEventsJson);

      // Busca quais eventos têm áudios em cache
      const eventsWithAudios: Event[] = [];
      for (const event of savedEvents) {
        const eventAudiosJson = localStorage.getItem(`event_audios_${event.id}`);
        if (eventAudiosJson) {
          const audioUrls: string[] = JSON.parse(eventAudiosJson);

          // Verifica se pelo menos um áudio está em cache
          const hasAudio = audioUrls.some(url => {
            const normalizedUrl = url.split('?')[0];
            return cachedAudios.has(normalizedUrl) || cachedAudios.has(url);
          });
          if (hasAudio) {
            eventsWithAudios.push(event);
          }
        }
      }
      return eventsWithAudios;
    } catch (error) {
      console.error('Erro ao buscar eventos offline:', error);
      return [];
    }
  };
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>;
  }
  return <div className="min-h-screen bg-background pb-[144px]">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-subtle px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Meus Eventos</h1>
              {isOffline && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <WifiOff className="h-3 w-3" />
                  <span>Modo offline</span>
                </div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <InstallPWAButton size="icon" showText={false} className="hidden md:flex" />
            {user ? <Button variant="ghost" size="icon" onClick={signOut} className="hover:bg-accent/80">
                <LogOut className="h-5 w-5" />
              </Button> : <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="hover:bg-accent/80">
                <LogIn className="h-5 w-5" />
              </Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6">
        {/* Banner de instalação - visível apenas em mobile */}
        <InstallPWAButton variant="default" size="lg" className="md:hidden w-full mb-4 gradient-primary shadow-glow" showText={true} />
        
        {events.length === 0 ? <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center px-4">
            <div className="mb-6 rounded-full bg-primary/10 p-8">
              <Calendar className="h-12 w-12 md:h-16 md:w-16 text-primary" />
            </div>
            <h2 className="mb-3 text-xl md:text-2xl font-semibold">Nenhum evento ainda</h2>
            <p className="mb-8 text-muted-foreground max-w-sm">
              {user ? 'Crie seu primeiro evento para começar' : 'Faça login para criar eventos'}
            </p>
            {user && <Button onClick={() => navigate('/events/new')} className="gradient-primary shadow-glow hover:shadow-glow/50 transition-all" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Novo Evento
              </Button>}
            {!user && <Button onClick={() => navigate('/auth')} className="gradient-primary shadow-glow hover:shadow-glow/50 transition-all" size="lg">
                Fazer Login para Criar Eventos
              </Button>}
          </div> : <>
            <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {events.map(event => <div key={event.id} onClick={() => navigate(`/events/${event.id}`)} className="group cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
                  <div className="gradient-card shadow-card hover:shadow-elevated relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border/50 transition-all">
                    {event.cover_image_url ? <img src={event.cover_image_url} alt={event.name} className="h-full w-full object-cover" /> : <Music className="h-12 w-12 md:h-16 md:w-16 text-primary/70" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="line-clamp-2 md:text-lg font-semibold text-sm">
                      {event.name}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {format(new Date(event.date), "dd 'de' MMMM", {
                  locale: ptBR
                })}
                    </p>
                  </div>
                 </div>)}
            </div>
            {user && <Button onClick={() => navigate('/events/new')} className="mt-8 gradient-primary shadow-glow hover:shadow-glow/50 transition-all w-full md:w-auto" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Novo Evento
              </Button>}
          </>}
      </main>
      <BottomNavigation />
    </div>;
};
export default Events;