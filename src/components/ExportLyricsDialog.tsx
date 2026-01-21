import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Globe, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface LyricsExportOptions {
  fontSize: number;
  fontFamily: 'times' | 'helvetica' | 'courier';
}

interface ExportLyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: LyricsExportOptions) => void;
  onOpenWeb?: () => void;
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
  onOpenWeb,
  isExporting
}: ExportLyricsDialogProps) => {
  const [fontSize, setFontSize] = useState(11);
  const [fontFamily, setFontFamily] = useState<'times' | 'helvetica' | 'courier'>('times');
  const [activeTab, setActiveTab] = useState('web');

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
          <DialogTitle>Visualizar Letras</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="web" className="gap-2">
              <Globe className="w-4 h-4" />
              Web
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="web" className="mt-4 space-y-4">
            <div className="text-center py-6">
              <Globe className="w-12 h-12 mx-auto text-primary/60 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Visualize as letras em uma página web elegante, pronta para compartilhar ou usar durante a celebração.
              </p>
            </div>
            
            <Button
              onClick={onOpenWeb}
              className="w-full gap-2"
              size="lg"
            >
              <Globe className="w-4 h-4" />
              Abrir Página de Letras
            </Button>
          </TabsContent>

          <TabsContent value="pdf" className="mt-4 space-y-4">
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

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {isExporting ? 'Exportando...' : 'Exportar PDF'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
