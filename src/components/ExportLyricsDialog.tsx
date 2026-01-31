import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Settings2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface LyricsExportOptions {
  fontSize: number;
  fontFamily: 'times' | 'helvetica' | 'courier' | 'libre-baskerville';
  margin: number;
  gutter: number;
  theme?: string;
}

interface ExportLyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: LyricsExportOptions) => void;
  isExporting: boolean;
  initialOptions?: LyricsExportOptions;
  currentTheme?: string;
}

const fontFamilyLabels: Record<string, string> = {
  times: 'Times (Serifada)',
  helvetica: 'Helvetica (Sem serifa)',
  courier: 'Courier (Monoespaçada)',
  'libre-baskerville': 'Libre Baskerville (Elegante)',
};

const themeOptions: { value: string; label: string; color: string }[] = [
  { value: 'deep_blue_gold', label: 'Azul Profundo', color: '#19376D' },
  { value: 'emerald_night', label: 'Esmeralda', color: '#064E3B' },
  { value: 'violet_sunset', label: 'Violeta', color: '#581C87' },
  { value: 'graphite_copper', label: 'Grafite', color: '#0F172A' },
  { value: 'crimson_noir', label: 'Carmesim', color: '#7F1D1D' },
  { value: 'sunrise_coral', label: 'Coral', color: '#EA580C' },
  { value: 'ocean_teal', label: 'Oceano', color: '#0D9488' },
  { value: 'forest_sage', label: 'Floresta', color: '#166534' },
  { value: 'midnight_purple', label: 'Púrpura', color: '#4C1D95' },
  { value: 'wine_burgundy', label: 'Vinho', color: '#881337' },
];

export const ExportLyricsDialog = ({
  open,
  onOpenChange,
  onExport,
  isExporting,
  initialOptions,
  currentTheme
}: ExportLyricsDialogProps) => {
  const [fontSize, setFontSize] = useState(initialOptions?.fontSize ?? 11);
  const [fontFamily, setFontFamily] = useState<'times' | 'helvetica' | 'courier' | 'libre-baskerville'>(initialOptions?.fontFamily ?? 'times');
  const [margin, setMargin] = useState(initialOptions?.margin ?? 18);
  const [gutter, setGutter] = useState(initialOptions?.gutter ?? 12);
  const [theme, setTheme] = useState(initialOptions?.theme ?? currentTheme ?? 'deep_blue_gold');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync state when dialog opens with new initialOptions
  useEffect(() => {
    if (open && initialOptions) {
      setFontSize(initialOptions.fontSize);
      setFontFamily(initialOptions.fontFamily);
      setMargin(initialOptions.margin);
      setGutter(initialOptions.gutter);
      if (initialOptions.theme) {
        setTheme(initialOptions.theme);
      }
    }
  }, [open, initialOptions]);

  // Update theme when currentTheme changes
  useEffect(() => {
    if (currentTheme && !initialOptions?.theme) {
      setTheme(currentTheme);
    }
  }, [currentTheme, initialOptions?.theme]);

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
    onExport({ fontSize, fontFamily, margin, gutter, theme });
  };

  const selectedTheme = themeOptions.find(t => t.value === theme) || themeOptions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Letras</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Theme Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Tema de Cores
            </Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-border" 
                      style={{ backgroundColor: selectedTheme.color }}
                    />
                    {selectedTheme.label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-border" 
                        style={{ backgroundColor: t.color }}
                      />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Fonte</Label>
            <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as 'times' | 'helvetica' | 'courier' | 'libre-baskerville')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="times">{fontFamilyLabels.times}</SelectItem>
                <SelectItem value="helvetica">{fontFamilyLabels.helvetica}</SelectItem>
                <SelectItem value="courier">{fontFamilyLabels.courier}</SelectItem>
                <SelectItem value="libre-baskerville">{fontFamilyLabels['libre-baskerville']}</SelectItem>
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
                  min={3}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>3mm (mínimo)</span>
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
                  min={2}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>2mm (mínimo)</span>
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