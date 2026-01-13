import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Import, Search } from 'lucide-react';

interface LyricsSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songName: string;
  onImport: (lyrics: string) => void;
}

export const LyricsSearchModal = ({
  open,
  onOpenChange,
  songName,
  onImport,
}: LyricsSearchModalProps) => {
  const [lyrics, setLyrics] = useState('');

  const handleSearch = () => {
    const searchQuery = encodeURIComponent(songName);
    window.open(`https://www.letras.com/?q=${searchQuery}`, '_blank');
  };

  const handleImport = () => {
    if (lyrics.trim()) {
      onImport(lyrics.trim());
      setLyrics('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setLyrics('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar e Importar Letra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-secondary/50 rounded-lg p-3 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Música:</p>
            <p className="font-semibold text-foreground">{songName || 'Sem nome'}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              1. Clique no botão abaixo para buscar a letra no Letras.com
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleSearch}
              disabled={!songName}
              className="w-full gap-2 border-primary/30 hover:bg-primary/10"
            >
              <ExternalLink className="h-4 w-4" />
              Buscar no Letras.com
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              2. Copie a letra encontrada e cole no campo abaixo
            </p>
            <Textarea
              placeholder="Cole a letra da música aqui..."
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="min-h-[200px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!lyrics.trim()}
            className="gap-2"
          >
            <Import className="h-4 w-4" />
            Importar Letra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
