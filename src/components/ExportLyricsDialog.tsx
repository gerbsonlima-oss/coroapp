import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface LyricsExportOptions {
  fontSize: number;
  fontFamily: 'times' | 'helvetica' | 'courier';
  margin: number;
  gutter: number;
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
  const [margin, setMargin] = useState(18);
  const [gutter, setGutter] = useState(12);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    onExport({ fontSize, fontFamily, margin, gutter });
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

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Configurações avançadas
                </span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Margem lateral: {margin}mm
                </Label>
                <Slider
                  value={[margin]}
                  onValueChange={(values) => setMargin(values[0])}
                  min={10}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10mm (compacto)</span>
                  <span>30mm (espaçoso)</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Espaço entre colunas: {gutter}mm
                </Label>
                <Slider
                  value={[gutter]}
                  onValueChange={(values) => setGutter(values[0])}
                  min={6}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>6mm (próximas)</span>
                  <span>20mm (separadas)</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                💡 Aumente as margens se o texto estiver cortado nas bordas. Aumente o espaço entre colunas se houver sobreposição.
              </p>
            </CollapsibleContent>
          </Collapsible>
          
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