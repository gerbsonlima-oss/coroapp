import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLiturgy } from '@/hooks/useLiturgy';

const Liturgy = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: liturgyData, loading, error } = useLiturgy(selectedDate);

  useEffect(() => {
    if (location.state?.selectedDate) {
      setSelectedDate(location.state.selectedDate);
    }
  }, [location.state]);

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
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
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

      <BottomNavigation />
    </div>
  );
};

export default Liturgy;