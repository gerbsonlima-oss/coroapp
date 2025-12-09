import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Music, Sparkles, ChevronLeft, ChevronRight, Crown, Heart, Gift, Sun, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useLiturgicalCalendar } from '@/hooks/useLiturgicalCalendar';
import { format, addMonths, addDays, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLiturgicalDay } from '@/data/liturgicalCalendar';

interface DayCard {
  date: Date;
  dayNum: number;
  monthDay: string;
  saint: string;
  season: string;
  celebration: string;
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
  const today = new Date();
  const { today: liturgicalDay } = useLiturgicalCalendar(today);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [monthDays, setMonthDays] = useState<DayCard[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const { data: feedData } = useQuery({
    queryKey: ['feed-updates'],
    queryFn: async () => {
      const [events, songs, audios] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('songs')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('song_audios')
          .select('id, created_at, songs(title, voice_type)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: FeedItem[] = [];
      
      if (events.data) {
        items.push(...events.data.map(e => ({
          id: e.id,
          type: 'event' as const,
          title: e.name,
          date: e.created_at,
        })));
      }
      
      if (songs.data) {
        items.push(...songs.data.map(s => ({
          id: s.id,
          type: 'song' as const,
          title: s.title,
          date: s.created_at,
        })));
      }
      
      if (audios.data) {
        items.push(...audios.data.map((a: any) => ({
          id: a.id,
          type: 'audio' as const,
          title: a.songs?.title || 'Áudio adicionado',
          voiceType: a.songs?.voice_type || undefined,
          date: a.created_at,
        })));
      }

      return items.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ).slice(0, 10);
    },
  });

  useEffect(() => {
    const selectedDate = addMonths(today, selectedMonthIndex);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(selectedDate);
    
    const days: DayCard[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const liturgy = getLiturgicalDay(date);
      
      days.push({
        date,
        dayNum: day,
        monthDay: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`,
        saint: liturgy?.saint || 'Dia Comum',
        season: liturgy?.liturgicalSeason || 'Tempo Comum',
        celebration: liturgy?.celebration || 'Féria',
      });
    }
    
    setMonthDays(days);
  }, [selectedMonthIndex]);

  useEffect(() => {
    if (feedData) {
      setFeedItems(feedData);
    }
  }, [feedData]);

  const liturgicalColor = liturgicalDay 
    ? getLiturgicalColor(liturgicalDay.liturgicalSeason)
    : 'from-blue-600 to-blue-900';

  const handleDayClick = (date: Date) => {
    navigate('/liturgy', { state: { selectedDate: date } });
  };

  const handlePrevMonth = () => {
    setSelectedMonthIndex(prev => Math.max(prev - 1, -24));
  };

  const handleNextMonth = () => {
    setSelectedMonthIndex(prev => Math.min(prev + 1, 24));
  };

  const getSelectedMonthStr = () => {
    const selectedDate = addMonths(today, selectedMonthIndex);
    return format(selectedDate, 'MMM/yyyy', { locale: ptBR }).toUpperCase();
  };

  const getCelebrationCode = (celebration: string): string => {
    const normalized = celebration.toLowerCase().trim();
    
    if (normalized.includes('solenidade')) return 'S';
    if (normalized.includes('festa')) return 'F';
    if (normalized === 'memória' || normalized === 'memória obrigatória') return 'M';
    if (normalized === 'memória facultativa') return 'm';
    if (normalized.includes('comemoração')) return 'm*';
    if (normalized.includes('domingo')) return 'D';
    if (normalized.includes('féria')) return 'Féria';
    
    return '-';
  };

  const getCelebrationLabel = (celebration: string): string => {
    const normalized = celebration.toLowerCase().trim();
    
    if (normalized.includes('solenidade')) return 'Solenidade';
    if (normalized.includes('festa')) return 'Festa';
    if (normalized === 'memória' || normalized === 'memória obrigatória') return 'Memória Obrigatória';
    if (normalized === 'memória facultativa') return 'Memória Facultativa';
    if (normalized.includes('comemoração')) return 'Comemoração Facultativa';
    if (normalized.includes('domingo')) return 'Domingo';
    if (normalized.includes('féria')) return 'Féria';
    
    return celebration;
  };

  const getCelebrationIcon = (celebration: string) => {
    const normalized = celebration.toLowerCase();
    
    if (normalized.includes('solenidade')) return <Crown className="h-5 w-5" />;
    if (normalized.includes('domingo')) return <Sun className="h-5 w-5" />;
    if (normalized.includes('festa')) return <Gift className="h-5 w-5" />;
    if (normalized.includes('memória')) return <Heart className="h-5 w-5" />;
    if (normalized.includes('féria')) return <Zap className="h-5 w-5" />;
    
    return <Calendar className="h-5 w-5" />;
  };

  const getLiturgicalColor2 = (season: string): string => {
    const colors: Record<string, string> = {
      'Advento': 'bg-purple-600 dark:bg-purple-900',
      'Tempo do Natal': 'bg-red-600 dark:bg-red-900',
      'Tempo Comum': 'bg-green-600 dark:bg-green-900',
      'Quaresma': 'bg-violet-600 dark:bg-violet-900',
      'Semana Santa': 'bg-slate-900 dark:bg-black',
      'Tempo Pascal': 'bg-yellow-600 dark:bg-yellow-900',
    };
    return colors[season] || 'bg-blue-600 dark:bg-blue-900';
  };

  const getSeasonTextColor = (season: string): string => {
    const colors: Record<string, string> = {
      'Semana Santa': 'text-white',
      'Advento': 'text-white',
      'Tempo do Natal': 'text-white',
      'Quaresma': 'text-white',
      'Tempo Comum': 'text-white',
      'Tempo Pascal': 'text-white',
    };
    return colors[season] || 'text-white';
  };

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
      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${liturgicalColor} text-white pt-8 pb-12 px-4 rounded-b-3xl shadow-lg`}>
        <div className="text-center space-y-2 mb-6">
          <p className="text-sm font-medium opacity-90">Hoje,</p>
          <h1 className="text-4xl font-bold">
            {format(today, "dd 'de' MMMM", { locale: ptBR })}
          </h1>
          <p className="text-sm opacity-80">
            {format(today, 'EEEE', { locale: ptBR })}
          </p>
        </div>

        {liturgicalDay && (
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" />
              <p className="text-sm font-semibold">{liturgicalDay.liturgicalSeason}</p>
            </div>
            <h2 className="text-xl font-bold leading-snug">
              {liturgicalDay.saint || liturgicalDay.celebration}
            </h2>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto">
        {/* Calendar */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Calendário Litúrgico</h3>
          </div>

          {/* Month Selector */}
          <div className="flex items-center justify-between gap-3 px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              disabled={selectedMonthIndex === -24}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-bold text-lg min-w-[120px] text-center">
              {getSelectedMonthStr()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              disabled={selectedMonthIndex === 24}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {monthDays.map((day) => (
              <Card
                key={day.monthDay}
                className={`p-3 cursor-pointer hover:shadow-lg transition-all border-0 ${getLiturgicalColor2(day.season)} ${getSeasonTextColor(day.season)}`}
                onClick={() => handleDayClick(day.date)}
                title={getCelebrationLabel(day.celebration)}
              >
                <div className="flex gap-2 items-start">
                  <div className="flex-shrink-0 mt-0.5 opacity-90">
                    {getCelebrationIcon(day.celebration)}
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">
                        {day.monthDay}
                      </p>
                      <span className="text-xs font-bold opacity-85 bg-white/20 px-1.5 py-0.5 rounded">
                        {getCelebrationCode(day.celebration)}
                      </span>
                    </div>
                    <p className="text-xs opacity-90 line-clamp-2 leading-tight">
                      {day.saint}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

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
