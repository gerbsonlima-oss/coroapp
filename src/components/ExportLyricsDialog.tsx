import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen } from 'lucide-react';

export interface LyricsExportOptions {
  fontSize: number;
  fontFamily: 'times' | 'helvetica' | 'courier';
}

interface ExportLyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: LyricsExportOptions) => void;
  isExporting: boolean;
}

const fontFamilyLabels: Record<string, string> = {
  times: 'Times (Serifada)',
  helvetica: 'Helvetica (Sem serifa)',
  courier: 'Courier (Monoespaçada)',
};

export const ExportLyricsDialog = ({
  open,
  onOpenChange,
  onExport,
  isExporting
}: ExportLyricsDialogProps) => {
  const [fontSize, setFontSize] = useState(11);
  const [fontFamily, setFontFamily] = useState<'times' | 'helvetica' | 'courier'>('times');

  const fontSizeLabels: Record<number, string> = {
    8: 'Muito pequena',
    9: 'Pequena',
    10: 'Média pequena',
    11: 'Média (padrão)',
    12: 'Média grande',
    14: 'Grande',
    16: 'Muito grande',
    18: 'Extra grande',
  };

  const handleExport = () => {
    onExport({ fontSize, fontFamily });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Letras</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fonte</Label>
            <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as 'times' | 'helvetica' | 'courier')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="times">{fontFamilyLabels.times}</SelectItem>
                <SelectItem value="helvetica">{fontFamilyLabels.helvetica}</SelectItem>
                <SelectItem value="courier">{fontFamilyLabels.courier}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Tamanho da fonte: {fontSize}pt ({fontSizeLabels[fontSize] || ''})
            </Label>
            <Slider
              value={[fontSize]}
              onValueChange={(values) => setFontSize(values[0])}
              min={8}
              max={18}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>8pt</span>
              <span>18pt</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Espaçamento mínimo entre linhas e sem recuo de parágrafos para otimizar espaço.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full gap-2"
          >
            <BookOpen className="w-4 h-4" />
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};