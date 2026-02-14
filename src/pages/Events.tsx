import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useTenant } from '@/contexts/TenantContext';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { BottomNavigation } from '@/components/BottomNavigation';
import { EventsReportExporter } from '@/components/EventsReportExporter';
import { Plus, Calendar, LogOut, LogIn, WifiOff, FileText, Search, X } from 'lucide-react';
import { toast } from 'sonner';

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
  const [showReportExporter, setShowReportExporter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const { tenantId } = useTenant();
  
  const canCreateEvent = isAdmin || isSuperAdmin;
  const navigate = useNavigate();

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      e.date.includes(q)
    );
  }, [events, searchQuery]);

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
  }, [isOffline]);

  const fetchEvents = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      setEvents(data || []);
      setIsOffline(false);
      // Also save to legacy cache for backward compatibility
      localStorage.setItem('cached_events', JSON.stringify(data));
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
      <header className="sticky top-0 z-10 border-b border-border/40 bg-card/80 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold leading-tight">Meus Eventos</h1>
              {isOffline && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <WifiOff className="h-3 w-3" />
                  <span>Modo offline</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowReportExporter(true)} 
              className="h-9 w-9"
              title="Exportar Relatório"
            >
              <FileText className="h-4.5 w-4.5" />
            </Button>
            {user ? (
              <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
                <LogOut className="h-4.5 w-4.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="h-9 w-9">
                <LogIn className="h-4.5 w-4.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6">
        {/* Banner de instalação - visível apenas em mobile */}


        
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center px-4">
            <div className="mb-6 rounded-full bg-primary/10 p-8">
              <Calendar className="h-12 w-12 md:h-16 md:w-16 text-primary" />
            </div>
            <h2 className="mb-3 text-xl md:text-2xl font-semibold">Nenhum evento ainda</h2>
            <p className="mb-8 text-muted-foreground max-w-sm">
              {user ? (canCreateEvent ? 'Crie seu primeiro evento para começar' : 'Nenhum evento agendado para esta organização') : 'Faça login para visualizar os eventos'}
            </p>
            {user && canCreateEvent && (
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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, local ou data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop New Event Button */}
            {user && canCreateEvent && (
              <div className="hidden md:flex justify-end mb-4">
                <Button
                  onClick={() => navigate('/events/new')}
                  className="gradient-primary shadow-glow hover:shadow-glow/50 transition-all"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Novo Evento
                </Button>
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum evento encontrado para "{searchQuery}"</p>
              </div>
            ) : (
              filteredEvents.map((event) => (
                <EventListItem key={event.id} event={event} />
              ))
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button - Mobile */}
      {user && canCreateEvent && (
        <button
          onClick={() => navigate('/events/new')}
          className="fixed bottom-24 right-4 z-20 md:hidden h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-glow hover:shadow-glow/50 transition-all active:scale-95 flex items-center justify-center text-white hover:scale-110 duration-200"
          title="Novo Evento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <BottomNavigation />

      <EventsReportExporter 
        open={showReportExporter} 
        onOpenChange={setShowReportExporter} 
      />
    </div>
  );
};

export default Events;