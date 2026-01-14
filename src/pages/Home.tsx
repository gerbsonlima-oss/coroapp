import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Music, Sparkles, MapPin, Clock, LogIn, Download, Shield, LogOut, History, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { BirthdayPanel } from '@/components/BirthdayPanel';
import { OfflineEventsManager } from '@/components/OfflineEventsManager';
import { useLiturgicalCalendar } from '@/hooks/useLiturgicalCalendar';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
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
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { isAdmin } = useIsAdmin();
  const { tenant, tenantId, tenantSlug } = useTenant();
  const { saveEvents } = useOfflineStorage();
  const today = new Date();
  const { today: liturgicalDay } = useLiturgicalCalendar(today);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  const { data: upcomingEventsData } = useQuery({
    queryKey: ['upcoming-events', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, date, location, cover_image_url')
          .eq('tenant_id', tenantId)
          .gte('date', format(today, 'yyyy-MM-dd'))
          .order('date', { ascending: true })
          .limit(5);

        if (error) throw error;
        return data as Event[] || [];
      } catch (error) {
        console.log('Offline mode: fetching upcoming events from cache');
        const savedEventsJson = localStorage.getItem('cached_events');
        if (!savedEventsJson) return [];
        
        const savedEvents: Event[] = JSON.parse(savedEventsJson);
        const todayStr = format(today, 'yyyy-MM-dd');
        
        return savedEvents
          .filter(event => event.date >= todayStr)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5);
      }
    },
    enabled: !!tenantId,
  });

  const { data: pastEventsData } = useQuery({
    queryKey: ['past-events', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, date, location, cover_image_url')
          .eq('tenant_id', tenantId)
          .lt('date', format(today, 'yyyy-MM-dd'))
          .order('date', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data as Event[] || [];
      } catch (error) {
        console.log('Offline mode: fetching past events from cache');
        const savedEventsJson = localStorage.getItem('cached_events');
        if (!savedEventsJson) return [];
        
        const savedEvents: Event[] = JSON.parse(savedEventsJson);
        const todayStr = format(today, 'yyyy-MM-dd');
        
        return savedEvents
          .filter(event => event.date < todayStr)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);
      }
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (upcomingEventsData) {
      setUpcomingEvents(upcomingEventsData);
    }
    if (pastEventsData) {
      setPastEvents(pastEventsData);
    }
    
    // Save combined events to offline storage
    if (upcomingEventsData || pastEventsData) {
      const allEvents = [
        ...(upcomingEventsData || []),
        ...(pastEventsData || []),
      ];
      
      if (allEvents.length > 0 && tenantId) {
        saveEvents(allEvents.map(event => ({
          id: event.id,
          name: event.name,
          date: event.date,
          location: event.location,
          cover_image_url: event.cover_image_url,
          notes: null,
          tenant_id: tenantId,
        })));
      }
    }
  }, [upcomingEventsData, pastEventsData, saveEvents, tenantId]);

  const liturgicalColor = liturgicalDay 
    ? getLiturgicalColor(liturgicalDay.liturgicalSeason)
    : 'from-blue-600 to-blue-900';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50 pb-28">
      {/* Header with Auth and Install buttons */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {tenant && (
            <span className="text-sm font-medium text-muted-foreground truncate max-w-[150px]">
              {tenant.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <OfflineEventsManager />
          <TenantSwitcher />
          {(isAdmin || isSuperAdmin) && (
            <Button
              onClick={() => navigate(tenantSlug ? `/${tenantSlug}/choir-members` : '/choir-members')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Coralistas</span>
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              onClick={() => navigate('/admin/tenants')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        {user ? (
          <Button
            onClick={() => signOut()}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        ) : (
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
      </div>

      {/* Compact Liturgy Strip */}
      <div className={`bg-gradient-to-r ${liturgicalColor} text-white py-2.5 px-4 rounded-b-xl shadow-md border-t border-white/10`}>
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <p className="text-[10px] font-medium opacity-80 leading-none mb-0.5">Hoje,</p>
            <h1 className="text-sm font-bold leading-none">
              {format(today, "dd 'de' MMMM", { locale: ptBR })}
            </h1>
          </div>

          {liturgicalDay && (
            <div 
              className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10 cursor-pointer hover:bg-white/20 transition-all flex items-center gap-2 min-w-0"
              onClick={() => navigate('/liturgy')}
            >
              <Sparkles className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold opacity-70 leading-none uppercase tracking-wider truncate">
                  {liturgicalDay.liturgicalSeason}
                </p>
                <h2 className="text-[11px] font-bold leading-tight truncate">
                  {liturgicalDay.saint || liturgicalDay.celebration}
                </h2>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto">
        {/* Birthday Panel */}
        {tenantId && <BirthdayPanel tenantId={tenantId} />}

        {/* Próximos Eventos */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Próximos Eventos</h3>
            </div>

            <div className="space-y-2">
              {upcomingEvents.map((event, index) => (
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
                        loading={index < 3 ? "eager" : "lazy"}
                        decoding={index < 3 ? "sync" : "async"}
                        fetchPriority={index < 2 ? "high" : undefined}
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

        {/* Eventos Recentes */}
        {pastEvents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Eventos Recentes</h3>
            </div>

            <div className="space-y-2">
              {pastEvents.map((event, index) => (
                <Card
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-all border-0 group flex flex-row bg-muted/30"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  {event.cover_image_url && (
                    <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden bg-muted">
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        loading="lazy"
                        className="h-full w-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                    <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{event.name}</h3>
                    <div className="space-y-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {format(new Date(event.date), "dd MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
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
