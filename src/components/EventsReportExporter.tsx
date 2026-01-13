import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Calendar, MapPin, Music, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import coroLogo from '@/assets/coro-logo.png';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface EventWithSongs {
  id: string;
  name: string;
  date: string;
  location: string | null;
  songs: Array<{
    id: string;
    name: string;
    type: string;
    typeName: string;
  }>;
}

interface EventsReportExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  canto_entrada: { bg: '#EFF6FF', text: '#0369A1', border: '#0EA5E9' },
  ato_penitencial: { bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' },
  gloria: { bg: '#FEFCE8', text: '#854D0E', border: '#EAB308' },
  salmo: { bg: '#F0FDF4', text: '#166534', border: '#22C55E' },
  aclamacao: { bg: '#FCE7F3', text: '#BE185D', border: '#EC4899' },
  oferendas: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  santo: { bg: '#F3E8FF', text: '#581C87', border: '#D946EF' },
  cordeiro: { bg: '#FCE7F3', text: '#BE123C', border: '#F43F5E' },
  comunhao: { bg: '#F0FDF4', text: '#065F46', border: '#10B981' },
  acao_gracas: { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },
  final: { bg: '#FFF7ED', text: '#92400E', border: '#FB923C' },
  adoracao: { bg: '#FDF4FF', text: '#7E22CE', border: '#A855F7' },
  outro: { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
};

const defaultTypeColor = { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    });
  }
  return options;
};

export const EventsReportExporter = ({
  open,
  onOpenChange
}: EventsReportExporterProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [events, setEvents] = useState<EventWithSongs[]>([]);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const { tenantId } = useTenant();

  const monthOptions = getMonthOptions();

  useEffect(() => {
    if (open && tenantId) {
      fetchEventsForMonth();
      fetchTypeLabels();
    }
  }, [open, selectedMonth, tenantId]);

  const fetchTypeLabels = async () => {
    const { data } = await supabase
      .from('song_types')
      .select('slug, name');
    
    if (data) {
      const labels: Record<string, string> = {};
      data.forEach(type => {
        labels[type.slug] = type.name;
      });
      setTypeLabels(labels);
    }
  };

  const fetchEventsForMonth = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, name, date, location')
        .eq('tenant_id', tenantId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (eventsError) throw eventsError;

      const eventsWithSongs: EventWithSongs[] = [];

      for (const event of eventsData || []) {
        const { data: songsData } = await supabase
          .from('event_songs')
          .select('id, songs(id, name, type)')
          .eq('event_id', event.id)
          .order('order_index', { ascending: true });

        const songs = songsData?.map(es => ({
          id: es.songs?.id || '',
          name: es.songs?.name || '',
          type: es.songs?.type || '',
          typeName: ''
        })).filter(s => s.id) || [];

        eventsWithSongs.push({
          ...event,
          songs
        });
      }

      setEvents(eventsWithSongs);
    } catch (error) {
      console.error('Erro ao buscar eventos:', error);
      toast.error('Erro ao carregar eventos do mês');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    return typeColors[type] || defaultTypeColor;
  };

  const handleExport = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const monthLabel = format(parseISO(`${selectedMonth}-01`), 'MMMM_yyyy', { locale: ptBR });
      link.download = `relatorio_eventos_${monthLabel}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Relatório exportado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Exportar Relatório de Eventos</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="mb-4">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Selecione o mês
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum evento encontrado para este mês</p>
            </div>
          ) : (
            <>
              <div
                ref={contentRef}
                className="w-full bg-white rounded-2xl overflow-hidden shadow-lg"
              >
                <div className="bg-gradient-to-b from-primary/90 to-primary/70 p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold">Relatório de Eventos</h1>
                      <p className="text-white/80 text-sm capitalize">{selectedMonthLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="font-semibold">{events.length}</span>
                    <span>evento{events.length !== 1 ? 's' : ''} programado{events.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-muted/50 px-4 py-3 border-b border-border">
                        <h3 className="font-bold text-foreground text-sm">{event.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.date), 'd MMM', { locale: ptBR })}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {event.songs.length > 0 ? (
                        <div className="p-3 space-y-1.5">
                          {event.songs.map((song, index) => {
                            const typeColor = getTypeColor(song.type);
                            const typeLabel = typeLabels[song.type] || song.type;
                            return (
                              <div key={song.id} className="flex items-center gap-2">
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
                                  style={{
                                    backgroundColor: typeColor.bg,
                                    color: typeColor.text,
                                    border: `1px solid ${typeColor.border}`
                                  }}
                                >
                                  {typeLabel.substring(0, 8)}
                                </span>
                                <span className="text-xs text-foreground truncate">{song.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          Sem músicas cadastradas
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50">
                  <img src={coroLogo} alt="Coro" className="w-5 h-5" />
                  <span>Coro Diocesano de Quixadá</span>
                </div>
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting || events.length === 0}
                className="w-full mt-6 gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exportando...' : 'Exportar como Imagem'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
