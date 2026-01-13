import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenant } from '@/contexts/TenantContext';
import { exportEventsReportPDF } from '@/utils/exportEventsReportPDF';

interface EventsReportExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { tenantId, tenantSlug, tenant } = useTenant();

  const monthOptions = getMonthOptions();

  const handleExport = async () => {
    if (!tenantId) {
      toast.error('Tenant não encontrado');
      return;
    }
    
    setIsExporting(true);
    try {
      await exportEventsReportPDF(tenantId, tenantSlug, tenant?.name || null, selectedMonth);
      toast.success('Relatório exportado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      if (error instanceof Error && error.message.includes('Nenhum evento')) {
        toast.error('Nenhum evento encontrado para este mês');
      } else {
        toast.error('Erro ao exportar relatório');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Relatório de Eventos</DialogTitle>
        </DialogHeader>

        <div className="py-4">
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

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
