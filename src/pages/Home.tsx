import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Settings,
  LogOut,
  PlusCircle,
  Music,
  MessageCircle,
  Shield,
  ChevronRight,
  Church,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { BirthdayPanel } from '@/components/BirthdayPanel';
import { TenantSwitcher } from '@/components/TenantSwitcher';

import { useLiturgicalCalendar } from '@/hooks/useLiturgicalCalendar';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseDateOnlyLocal } from '@/utils/dateParsing';
import { useAuth } from '@/hooks/useAuth';
import { naipeLabels } from '@/constants/naipes';

import { injectTenantManifest } from '@/utils/injectTenantManifest';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  tenant_id: string | null;
}

interface UserProfile {
  full_name: string | null;
  naipe: string | null;
}

const getLiturgicalColor = (season: string): string => {
  const colors: Record<string, string> = {
    Advento: 'from-amber-600 via-orange-700 to-rose-700',
    'Tempo do Natal': 'from-rose-600 via-red-700 to-amber-700',
    'Tempo Comum': 'from-emerald-600 via-teal-700 to-cyan-700',
    Quaresma: 'from-violet-700 via-fuchsia-800 to-rose-800',
    'Semana Santa': 'from-zinc-700 via-zinc-800 to-black',
    'Tempo Pascal': 'from-yellow-500 via-amber-600 to-orange-700',
  };
  return colors[season] || 'from-orange-600 via-amber-700 to-rose-700';
};

const formatEventDate = (date: string) =>
  format(parseDateOnlyLocal(date), "dd 'de' MMM", { locale: ptBR });

const getRelativeDateLabel = (date: string): string => {
  const target = parseDateOnlyLocal(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / dayMs);

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanha';
  return `Em ${diffDays} dias`;
};

const Home = () => {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { isSuperAdmin } = useSuperAdmin();
  const { isAdmin } = useIsAdmin();
  const { user, signOut } = useAuth();
  const { tenant, tenantId } = useTenant();
  const { saveEvents } = useOfflineStorage();
  const today = new Date();
  const { today: liturgicalDay } = useLiturgicalCalendar(today);

  const queryTenantIds = tenantId ? [tenantId] : [];

  const { data: upcomingEventsData, isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['upcoming-events', queryTenantIds],
    queryFn: async () => {
      if (queryTenantIds.length === 0) return [];

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, date, location, cover_image_url, tenant_id')
          .in('tenant_id', queryTenantIds)
          .gte('date', format(today, 'yyyy-MM-dd'))
          .order('date', { ascending: true })
          .limit(10);

        if (error) throw error;
        return (data as Event[]) || [];
      } catch (error) {
        console.log('Offline mode: fetching upcoming events from cache');
        const savedEventsJson = localStorage.getItem('cached_events');
        if (!savedEventsJson) return [];

        const savedEvents: Event[] = JSON.parse(savedEventsJson);
        const todayStr = format(today, 'yyyy-MM-dd');

        return savedEvents
          .filter((event) => event.date >= todayStr)
          .sort((a, b) => parseDateOnlyLocal(a.date).getTime() - parseDateOnlyLocal(b.date).getTime())
          .slice(0, 10);
      }
    },
    enabled: queryTenantIds.length > 0,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['home-user-profile', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return null;
      let query = supabase
        .from('profiles')
        .select('full_name, naipe')
        .eq('id', user.id)
        .maybeSingle();

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (tenant?.slug && tenant?.name) {
      injectTenantManifest(tenant.slug, tenant.name);
    }
  }, [tenant?.slug, tenant?.name]);

  useEffect(() => {
    if (upcomingEventsData) {
      const allEvents = [...(upcomingEventsData || [])];

      if (allEvents.length > 0 && tenantId) {
        saveEvents(
          allEvents.map((event) => ({
            id: event.id,
            name: event.name,
            date: event.date,
            location: event.location,
            cover_image_url: event.cover_image_url,
            notes: null,
            tenant_id: event.tenant_id || tenantId,
          })),
        );
      }
    }
  }, [upcomingEventsData, saveEvents, tenantId]);

  const liturgicalColor = liturgicalDay
    ? getLiturgicalColor(liturgicalDay.liturgicalSeason)
    : 'from-orange-600 via-amber-700 to-rose-700';

  const upcomingEvents = upcomingEventsData || [];
  const canSeeQuickActions = isAdmin || isSuperAdmin;
  const userDisplayName =
    userProfile?.full_name?.trim() ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Coralista';
  const firstName = userDisplayName.split(' ')[0] || userDisplayName;
  const userNaipeKey = userProfile?.naipe?.toLowerCase().trim() || '';
  const userNaipeLabel = userNaipeKey ? naipeLabels[userNaipeKey] || userProfile?.naipe : null;

  const quickActions = [
    {
      id: 'new-event',
      label: 'Novo Evento',
      icon: PlusCircle,
      path: '/events/new',
      accent: 'from-orange-500/20 to-rose-500/20',
    },
    {
      id: 'events',
      label: 'Eventos',
      icon: Calendar,
      path: '/events',
      accent: 'from-amber-500/20 to-orange-500/20',
    },
    {
      id: 'songs',
      label: 'Repertorio',
      icon: Music,
      path: '/songs',
      accent: 'from-emerald-500/20 to-teal-500/20',
    },
    tenant?.chat_enabled
      ? {
          id: 'chat',
          label: 'Chat',
          icon: MessageCircle,
          path: '/chat',
          accent: 'from-sky-500/20 to-cyan-500/20',
        }
      : isAdmin || isSuperAdmin
        ? {
            id: 'admin',
            label: 'Admin',
            icon: Shield,
            path: '/admin',
            accent: 'from-indigo-500/20 to-blue-500/20',
          }
        : {
            id: 'liturgy',
            label: 'Liturgia',
            icon: Church,
            path: '/liturgy',
            accent: 'from-violet-500/20 to-fuchsia-500/20',
          },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-4 md:space-y-8 md:px-6" aria-label="Pagina inicial">
        <section
          aria-label="Resumo liturgico"
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${liturgicalColor} p-4 shadow-elevated md:p-6 animate-slide-up`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.22),transparent_40%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.14),transparent_45%)]" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Hoje</p>
              <h1 className="mb-0 mt-1 text-2xl font-black text-white md:text-3xl">
                {format(today, "dd 'de' MMMM", { locale: ptBR })}
              </h1>
              <p className="mt-2 text-sm font-semibold text-white/95 line-clamp-1">
                Bem-vindo, {firstName}
              </p>
              <p className="text-xs text-white/80 line-clamp-1">
                Naipe: {userNaipeLabel || 'nao informado'}
              </p>
              {tenant?.name && (
                <p className="mt-1 text-sm text-white/80 line-clamp-1">{tenant.name}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <TenantSwitcher buttonClassName="text-white hover:text-white/90 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70" />
              <button
                type="button"
                onClick={() => signOut()}
                className="touch-target rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Sair da conta"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
              {(isAdmin || isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => navigate(buildPath('/admin'))}
                  className="touch-target rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Painel administrativo"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(buildPath('/liturgy'))}
            className="relative z-10 mt-4 flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-left backdrop-blur-sm transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:mt-5"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-yellow-200" />
            {liturgicalDay ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {liturgicalDay.liturgicalSeason}
                </p>
                <p className="truncate text-sm font-semibold text-white">
                  {liturgicalDay.saint || liturgicalDay.celebration}
                </p>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Liturgia</p>
                <p className="text-sm font-semibold text-white">Abrir calendario liturgico</p>
              </div>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
          </button>
        </section>

        {canSeeQuickActions && (
          <section aria-label="Acoes rapidas" className="animate-slide-up" style={{ animationDelay: '80ms' }}>
            <h2 className="mb-3 text-base font-bold text-foreground md:text-lg">Acoes rapidas</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => navigate(buildPath(action.path))}
                  className={`touch-target rounded-xl border border-border bg-gradient-to-br ${action.accent} p-3 text-left shadow-card transition-all duration-200 hover:translate-y-[-1px] hover:border-primary/50 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70`}
                >
                  <action.icon className="h-5 w-5 text-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">{action.label}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Aniversariantes" className="animate-slide-up" style={{ animationDelay: '140ms' }}>
          {tenantId ? (
            <BirthdayPanel tenantId={tenantId} />
          ) : (
            <Card className="rounded-xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">
              Selecione uma organizacao para ver aniversariantes do mes.
            </Card>
          )}
        </section>

        <section aria-label="Proximos eventos" className="space-y-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="mb-0 text-base font-bold text-foreground md:text-lg">Proximos eventos</h2>
            </div>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {upcomingEvents.length}
            </span>
          </div>

          {isLoadingUpcoming ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <Card
                  key={item}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 shadow-elevated"
                >
                  <Skeleton className="h-32 w-full md:h-36" />
                  <div className="space-y-2 p-3.5 md:p-4">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <Card
                  key={event.id}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 shadow-elevated transition-all duration-300 hover:border-primary/50"
                  onClick={() => navigate(buildPath(`/events/${event.id}`))}
                >
                  <div className="relative">
                    {event.cover_image_url ? (
                      <img
                        src={event.cover_image_url}
                        alt={event.name}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        decoding={index < 2 ? 'sync' : 'async'}
                        fetchPriority={index < 2 ? 'high' : undefined}
                        className="h-32 w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105 md:h-36"
                      />
                    ) : (
                      <div className="h-32 w-full bg-gradient-to-r from-orange-600/30 to-rose-700/30 md:h-36" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {getRelativeDateLabel(event.date)}
                    </div>
                  </div>
                  <div className="space-y-1.5 p-3.5 md:p-4">
                    <p className="text-xs uppercase tracking-wide text-primary">
                      {index === 0 ? 'Proximo compromisso' : 'Evento futuro'}
                    </p>
                    <h3 className="mb-0 line-clamp-2 text-base font-black text-white md:text-lg">{event.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/85">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatEventDate(event.date)}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="line-clamp-1">{event.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
              <p>Nenhum proximo evento encontrado. Crie um novo evento para iniciar o mes.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(buildPath('/events'))}>
                  Ver agenda
                </Button>
                {canSeeQuickActions && (
                  <Button size="sm" variant="outline" onClick={() => navigate(buildPath('/events/new'))}>
                    Criar evento
                  </Button>
                )}
              </div>
            </Card>
          )}
        </section>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Home;
