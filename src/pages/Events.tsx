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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { cachedAudios } = useAudioCache();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[144px]">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-subtle px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Meus Eventos</h1>
              {isOffline && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <WifiOff className="h-3 w-3" />
                  <span>Modo offline</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <InstallPWAButton size="icon" showText={false} className="hidden md:flex" />
            {user ? (
              <Button variant="ghost" size="icon" onClick={signOut} className="hover:bg-accent/80">
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="hover:bg-accent/80">
                <LogIn className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6">
        {/* Banner de instalação - visível apenas em mobile */}
        <InstallPWAButton 
          variant="default" 
          size="lg" 
          className="md:hidden w-full mb-4 gradient-primary shadow-glow"
          showText={true}
        />
        
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center px-4">
            <div className="mb-6 rounded-full bg-primary/10 p-8">
              <Calendar className="h-12 w-12 md:h-16 md:w-16 text-primary" />
            </div>
            <h2 className="mb-3 text-xl md:text-2xl font-semibold">Nenhum evento ainda</h2>
            <p className="mb-8 text-muted-foreground max-w-sm">
              {user ? 'Crie seu primeiro evento para começar' : 'Faça login para criar eventos'}
            </p>
            {user && (
              <Button
                onClick={() => navigate('/events/new')}
                className="gradient-primary shadow-glow hover:shadow-glow/50 transition-all"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Novo Evento
              </Button>
            )}
            {!user && (
              <Button
                onClick={() => navigate('/auth')}
                className="gradient-primary shadow-glow hover:shadow-glow/50 transition-all"
                size="lg"
              >
                Fazer Login para Criar Eventos
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="group cursor-pointer transition-all duration-300 hover:scale-[1.04] active:scale-[0.96]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] hover:shadow-[0_12px_48px_0_rgba(31,38,135,0.5)] transition-all duration-300 border border-white/20 backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 group-hover:from-white/15 group-hover:to-white/8 group-hover:border-white/30">
                    {event.cover_image_url ? (
                      <>
                        <img 
                          src={event.cover_image_url} 
                          alt={event.name}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/40 opacity-60 group-hover:opacity-50 transition-opacity duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-white/5 pointer-events-none" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/30 to-primary/10 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <Music className="h-12 w-12 md:h-16 md:w-16 text-white/80 relative z-10 drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 px-2 py-3 rounded-lg mt-2 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 group-hover:from-white/10 group-hover:to-white/5 group-hover:border-white/20 transition-all duration-300 shadow-md">
                    <h3 className="font-bold text-sm md:text-base text-foreground line-clamp-2 drop-shadow-sm">
                      {event.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 opacity-70" />
                      <span>{format(new Date(event.date), "dd 'de' MMM", { locale: ptBR })}</span>
                    </div>
                  </div>
                 </div>
               ))}
            </div>
          </>
        )}
      </main>

      {/* Floating Action Button - Mobile */}
      {user && (
        <button
          onClick={() => navigate('/events/new')}
          className="fixed bottom-24 right-4 z-20 md:hidden h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-glow hover:shadow-glow/50 transition-all active:scale-95 flex items-center justify-center text-white hover:scale-110 duration-200"
          title="Novo Evento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <BottomNavigation />
    </div>
  );
};

export default Events;