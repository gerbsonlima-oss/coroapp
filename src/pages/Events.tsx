import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';
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

import { EventListItem } from '@/components/EventListItem';

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
  const { isAdmin } = useIsAdmin();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { cachedAudios } = useAudioCache();

  useEffect(() => {
    if (tenantId) {
      fetchEvents();
    }
  }, [tenantId]);

  useEffect(() => {
    if (isOffline) {
      getOfflineEvents().then(cached => {
        if (cached.length > 0) setEvents(cached);
      });
    }
  }, [cachedAudios, isOffline]);

  const fetchEvents = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Se online, mostra todos os eventos
      setEvents(data || []);
      setIsOffline(false);
    } catch (error: any) {
      // Se offline, busca eventos do localStorage
      const cachedEvents = await getOfflineEvents();
      
      if (cachedEvents.length > 0) {
        setEvents(cachedEvents);
        setIsOffline(true);
        toast.info('Modo offline: mostrando eventos salvos');
      } else {
        setIsOffline(true);
        toast.error('Você está offline e não há eventos salvos');
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
      
      return JSON.parse(savedEventsJson);
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
              {user ? (isAdmin ? 'Crie seu primeiro evento para começar' : 'Nenhum evento agendado para esta organização') : 'Faça login para visualizar os eventos'}
            </p>
            {user && isAdmin && (
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
          <div className="space-y-3 md:space-y-4">
            {events.map((event) => (
              <EventListItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button - Mobile */}
      {user && isAdmin && (
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