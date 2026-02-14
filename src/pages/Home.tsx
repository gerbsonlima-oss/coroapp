import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Music, Sparkles, MapPin, Clock, LogIn, LogOut, History, Settings, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { BirthdayPanel } from '@/components/BirthdayPanel';

import { useLiturgicalCalendar } from '@/hooks/useLiturgicalCalendar';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { injectTenantManifest } from '@/utils/injectTenantManifest';

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
      } catch {
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
      } catch {
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
    if (tenantSlug && tenant?.name) {
      injectTenantManifest(tenantSlug, tenant.name);
    }
  }, [tenantSlug, tenant?.name]);

  useEffect(() => {
    if (upcomingEventsData) setUpcomingEvents(upcomingEventsData);
    if (pastEventsData) setPastEvents(pastEventsData);
  }, [upcomingEventsData, pastEventsData]);

  const liturgicalColor = liturgicalDay 
    ? getLiturgicalColor(liturgicalDay.liturgicalSeason)
    : 'from-blue-600 to-blue-900';

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Music className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="text-sm font-bold text-foreground truncate max-w-[160px]">
              {tenant?.name || 'Liturgia+'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TenantSwitcher />
            {(isAdmin || isSuperAdmin) && (
              <Button
                onClick={() => navigate(tenantSlug ? `/${tenantSlug}/admin` : '/admin')}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                <Settings className="h-4.5 w-4.5" />
              </Button>
            )}
            {user ? (
              <Button onClick={() => signOut()} variant="ghost" size="icon" className="h-9 w-9">
                <LogOut className="h-4.5 w-4.5" />
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')} variant="ghost" size="sm" className="h-9 gap-1.5 text-xs">
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Liturgical Strip */}
      <div className={`bg-gradient-to-r ${liturgicalColor} text-white py-3 px-4`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="shrink-0">
            <p className="text-[10px] font-medium opacity-70 leading-none mb-0.5 uppercase tracking-wider">Hoje</p>
            <h2 className="text-sm font-bold leading-tight">
              {format(today, "dd 'de' MMMM", { locale: ptBR })}
            </h2>
          </div>

          {liturgicalDay && (
            <div 
              className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 cursor-pointer hover:bg-white/15 transition-all flex items-center gap-2.5 min-w-0"
              onClick={() => navigate('/liturgy')}
            >
              <Sparkles className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold opacity-60 leading-none uppercase tracking-wider truncate">
                  {liturgicalDay.liturgicalSeason}
                </p>
                <p className="text-[11px] font-semibold leading-tight truncate mt-0.5">
                  {liturgicalDay.saint || liturgicalDay.celebration}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-6 max-w-6xl mx-auto">
        {/* Birthday Panel */}
        {tenantId && <BirthdayPanel tenantId={tenantId} />}

        {/* Próximos Eventos */}
        {upcomingEvents.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-primary" />
                <h3 className="font-bold text-base">Próximos Eventos</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground h-8 px-2"
                onClick={() => navigate('/events')}
              >
                Ver todos
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>

            <div className="space-y-2">
              {upcomingEvents.map((event, index) => (
                <Card
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:bg-accent/5 transition-all border-border/40 group flex flex-row"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  {event.cover_image_url ? (
                    <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden bg-muted">
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        loading={index < 3 ? "eager" : "lazy"}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 flex-shrink-0 bg-primary/10 flex items-center justify-center">
                      <Music className="h-6 w-6 text-primary/40" />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col justify-center min-w-0 gap-1.5">
                    <h4 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{event.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">
                          {format(new Date(event.date), "dd MMM · HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center pr-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Eventos Recentes */}
        {pastEvents.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4.5 w-4.5 text-muted-foreground" />
              <h3 className="font-bold text-base text-muted-foreground">Eventos Recentes</h3>
            </div>

            <div className="space-y-2">
              {pastEvents.map((event) => (
                <Card
                  key={event.id}
                  className="overflow-hidden cursor-pointer hover:bg-accent/5 transition-all border-border/30 group flex flex-row opacity-75 hover:opacity-100"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  {event.cover_image_url ? (
                    <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden bg-muted">
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        loading="lazy"
                        className="h-full w-full object-cover grayscale-[0.4] group-hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 flex-shrink-0 bg-muted/50 flex items-center justify-center">
                      <Music className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-2.5 flex-1 flex flex-col justify-center min-w-0 gap-1">
                    <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{event.name}</h4>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{format(new Date(event.date), "dd MMM · HH:mm", { locale: ptBR })}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Home;
