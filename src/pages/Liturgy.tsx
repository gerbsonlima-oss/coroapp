import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Crown, Heart, Gift, Sun, Zap, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, addMonths, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLiturgy } from '@/hooks/useLiturgy';
import { getLiturgicalDay } from '@/data/liturgicalCalendar';
import { TenantSwitcher } from '@/components/TenantSwitcher';

interface DayCard {
  date: Date;
  dayNum: number;
  monthDay: string;
  saint: string;
  season: string;
  celebration: string;
}

const Liturgy = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('liturgy');
  const [monthDays, setMonthDays] = useState<DayCard[]>([]);
  const { data: liturgyData, loading, error } = useLiturgy(selectedDate);

  useEffect(() => {
    if (location.state?.selectedDate) {
      setSelectedDate(location.state.selectedDate);
    }
  }, [location.state]);

  useEffect(() => {
    const selectedMonthDate = addMonths(today, selectedMonthIndex);
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(selectedMonthDate);
    
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
  }, [selectedMonthIndex, today]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setActiveTab('liturgy');
  };

  const handlePrevMonth = () => {
    setSelectedMonthIndex(prev => Math.max(prev - 1, -24));
  };

  const handleNextMonth = () => {
    setSelectedMonthIndex(prev => Math.min(prev + 1, 24));
  };

  const getSelectedMonthStr = () => {
    const selectedMonthDate = addMonths(today, selectedMonthIndex);
    return format(selectedMonthDate, 'MMM/yyyy', { locale: ptBR }).toUpperCase();
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

  const getLiturgicalColor = (season: string): string => {
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

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/events')}
          className="h-8 w-8 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold">Liturgia</h1>
        <div className="w-8 flex justify-end">
          <TenantSwitcher />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="liturgy" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Liturgia
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liturgy" className="space-y-6 animate-in fade-in-50 duration-300">
            {/* Liturgy Section */}
            <div className="space-y-4">
              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() - 1);
                    setSelectedDate(newDate);
                  }}
                >
                  ← Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() + 1);
                    setSelectedDate(newDate);
                  }}
                >
                  Próximo →
                </Button>
              </div>

              {/* Date Display */}
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <h1 className="text-2xl font-bold">{liturgyData?.title || 'Liturgia do Dia'}</h1>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-sm text-red-800">
                  Erro ao carregar liturgia: {error}
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}

              {/* Liturgia Content */}
              {!loading && liturgyData && (
                <div className="prose prose-sm dark:prose-invert max-w-none bg-card rounded-lg border p-6 space-y-4">
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: liturgyData.body }}
                  />
                </div>
              )}

              {!loading && !error && !liturgyData && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6 animate-in fade-in-50 duration-300">
            {/* Calendar Section */}
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
                    className={`p-3 cursor-pointer hover:shadow-lg transition-all border-0 ${getLiturgicalColor(day.season)} ${getSeasonTextColor(day.season)} ${
                      format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
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
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Liturgy;
