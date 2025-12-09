import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, Music } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import coroLogo from '@/assets/coro-logo.png';
import html2canvas from 'html2canvas';

interface RepertoireExporterProps {
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    cover_image_url: string | null;
  };
  songs: Array<{
    id: string;
    name: string;
    type: string;
    typeName: string;
  }>;
  typeLabels: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeIcons: Record<string, string> = {
  canto_entrada: '🎵',
  ato_penitencial: '🙏',
  gloria: '✨',
  salmo: '📖',
  aclamacao: '🎤',
  oferendas: '🕯️',
  santo: '✝️',
  cordeiro: '🐑',
  comunhao: '🍞',
  acao_gracas: '🙌',
  final: '🎺',
  entrada: '🎵',
  perdao: '🙏',
  ofertorio: '🕯️',
  outro: '🎵'
};

const defaultTypeColor = { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };

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
  concerto_natalino: { bg: '#FEF2F2', text: '#B91C1C', border: '#DC2626' },
  outro: { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
};

export const RepertoireExporter = ({
  event,
  songs,
  typeLabels,
  open,
  onOpenChange
}: RepertoireExporterProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getTypeColor = (type: string) => {
    return typeColors[type] || defaultTypeColor;
  };

  const groupedSongs = songs.reduce((acc, song) => {
    if (!acc[song.type]) {
      acc[song.type] = [];
    }
    acc[song.type].push(song);
    return acc;
  }, {} as Record<string, typeof songs>);

  const sortedTypes = Object.keys(groupedSongs).sort();

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
      link.download = `${event.name.replace(/\s+/g, '_')}_repertorio.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Repertório exportado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao exportar repertório:', error);
      toast.error('Erro ao exportar repertório');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Exportar Repertório</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div
            ref={contentRef}
            className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-lg"
            style={{ aspectRatio: '9/16' }}
          >
            <div className="bg-gradient-to-b from-primary/90 to-primary/70 p-6 text-white">
              {event.cover_image_url ? (
                <div className="mb-4 rounded-lg overflow-hidden h-32">
                  <img
                    src={event.cover_image_url}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg overflow-hidden h-32 bg-white/20 flex items-center justify-center">
                  <Music className="w-12 h-12 text-white/50" />
                </div>
              )}

              <h1 className="text-2xl font-bold mb-2 leading-tight">{event.name}</h1>
              
              <div className="flex items-center gap-2 text-sm text-white/90 mb-1">
                <span>📅</span>
                <span>
                  {format(new Date(event.date), 'd MMMM yyyy', { locale: ptBR })}
                </span>
              </div>

              {event.location && (
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <span>📍</span>
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            <div className="p-6 max-h-[calc(100%-240px)] overflow-y-auto">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                Repertório
              </h2>

              {sortedTypes.map((type) => {
                const typeColor = getTypeColor(type);
                const typeLabel = typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const icon = typeIcons[type] || '🎵';

                return (
                  <div key={type} className="mb-5">
                    <div
                      className="px-3 py-2 rounded-lg mb-3 border-2"
                      style={{
                        backgroundColor: typeColor.bg,
                        color: typeColor.text,
                        borderColor: typeColor.border
                      }}
                    >
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <span>{icon}</span>
                        {typeLabel}
                      </h3>
                    </div>

                    <div className="space-y-2 pl-2">
                      {groupedSongs[type].map((song, index) => (
                        <div key={song.id} className="flex items-start gap-3">
                          <span className="text-xs font-bold text-muted-foreground min-w-[20px]">
                            {index + 1}.
                          </span>
                          <span className="text-sm text-foreground font-medium flex-1">
                            {song.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50">
              <img src={coroLogo} alt="Coro" className="w-5 h-5" />
              <span>Coro Diocesano de Quixadá</span>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full mt-6 gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exportando...' : 'Exportar como Imagem'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
