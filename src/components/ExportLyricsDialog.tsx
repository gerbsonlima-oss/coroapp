import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { BookOpen } from 'lucide-react';

interface ExportLyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (fontSize: number) => void;
  isExporting: boolean;
}

export const ExportLyricsDialog = ({
  open,
  onOpenChange,
  onExport,
  isExporting
}: ExportLyricsDialogProps) => {
  const [fontSize, setFontSize] = useState(11);

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
    onExport(fontSize);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Letras</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
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
            O tamanho afeta apenas o texto das letras. Cabeçalhos e títulos mantêm o tamanho original.
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
