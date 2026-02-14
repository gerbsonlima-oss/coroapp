import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, RotateCw } from 'lucide-react';
import { searchSongMetadata, SongMetadata } from '@/utils/fetchSongMetadata';

interface SearchSongMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songName: string;
  onApprove: (metadata: SongMetadata) => Promise<void>;
}

export function SearchSongMetadataDialog({
  open,
  onOpenChange,
  songName,
  onApprove
}: SearchSongMetadataDialogProps) {
  const [metadata, setMetadata] = useState<SongMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [alternativeSearchName, setAlternativeSearchName] = useState('');

  const [editedComposer, setEditedComposer] = useState('');
  const [editedAlbum, setEditedAlbum] = useState('');
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedYear, setEditedYear] = useState('');

  useEffect(() => {
    if (open && songName) {
      handleSearchInternal();
    }
  }, [open, songName]);

  const handleSearchInternal = async () => {
    if (!songName.trim()) {
      toast.error('Nome da música não informado');
      return;
    }

    setLoading(true);
    try {
      const result = await searchSongMetadata(songName);
      if (result && Object.keys(result).length > 1) {
        setMetadata(result);
        setEditedComposer(result.composer || '');
        setEditedAlbum(result.album || '');
        setEditedLyrics(result.lyrics || '');
        setEditedYear(result.year?.toString() || '');
        toast.success('Informações encontradas!');
      } else {
        setMetadata({
          source: 'Manual'
        });
        setEditedComposer('');
        setEditedAlbum('');
        setEditedLyrics('');
        setEditedYear('');
        toast.info('Nenhuma informação encontrada. Preencha os campos manualmente.');
      }
    } catch (error) {
      console.error('Erro ao buscar:', error);
      setMetadata({
        source: 'Manual'
      });
      toast.info('Não foi possível buscar informações. Preencha manualmente.');
    } finally {
      setLoading(false);
    }
  };



  const handleApprove = async () => {
    if (!metadata) return;

    setApproving(true);
    try {
      const approvedMetadata: SongMetadata = {
        composer: editedComposer || undefined,
        album: editedAlbum || undefined,
        lyrics: editedLyrics || undefined,
        year: editedYear ? parseInt(editedYear) : undefined,
        source: metadata.source
      };

      await onApprove(approvedMetadata);
      onOpenChange(false);
      setMetadata(null);
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error('Erro ao salvar dados');
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informações da Música</DialogTitle>
          <DialogDescription>
            {songName ? `${songName}` : 'Carregando...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : metadata ? (
            <div className="space-y-4 p-4 border border-border/50 rounded-lg bg-card">
              <div className="text-xs text-muted-foreground">
                Fonte: {metadata.source}
              </div>

              <div className="space-y-2">
                <Label htmlFor="composer">Compositor</Label>
                <Input
                  id="composer"
                  value={editedComposer}
                  onChange={(e) => setEditedComposer(e.target.value)}
                  placeholder="Nome do compositor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="album">Álbum</Label>
                <Input
                  id="album"
                  value={editedAlbum}
                  onChange={(e) => setEditedAlbum(e.target.value)}
                  placeholder="Nome do álbum"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Ano de Lançamento</Label>
                <Input
                  id="year"
                  type="number"
                  value={editedYear}
                  onChange={(e) => setEditedYear(e.target.value)}
                  placeholder="YYYY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lyrics">Letra</Label>
                <Textarea
                  id="lyrics"
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  placeholder="Letra da música"
                  className="min-h-[150px] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setMetadata(null);
                    setEditedComposer('');
                    setEditedAlbum('');
                    setEditedLyrics('');
                    setEditedYear('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1"
                >
                  {approving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </div>
          ) : !loading && (
            <div className="space-y-4">
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhuma informação encontrada para "{songName}".
              </div>
              
              <div className="space-y-2 p-4 border border-dashed border-border/50 rounded-lg bg-card/50">
                <Label htmlFor="alternative-search">Tentar com outro nome:</Label>
                <div className="flex gap-2">
                  <Input
                    id="alternative-search"
                    value={alternativeSearchName}
                    onChange={(e) => setAlternativeSearchName(e.target.value)}
                    placeholder="Digite um nome alternativo para a música"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && alternativeSearchName.trim()) {
                        setLoading(true);
                        searchSongMetadata(alternativeSearchName)
                          .then(result => {
                            if (result && Object.keys(result).length > 1) {
                              setMetadata(result);
                              setEditedComposer(result.composer || '');
                              setEditedAlbum(result.album || '');
                              setEditedLyrics(result.lyrics || '');
                              setEditedYear(result.year?.toString() || '');
                            } else {
                              toast.error('Nenhum dado encontrado');
                            }
                          })
                          .catch(() => toast.error('Erro ao buscar'))
                          .finally(() => setLoading(false));
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (alternativeSearchName.trim()) {
                        const tempSongName = songName;
                        // Buscar com nome alternativo
                        setLoading(true);
                        searchSongMetadata(alternativeSearchName)
                          .then(result => {
                            if (result && Object.keys(result).length > 1) {
                              setMetadata(result);
                              setEditedComposer(result.composer || '');
                              setEditedAlbum(result.album || '');
                              setEditedLyrics(result.lyrics || '');
                              setEditedYear(result.year?.toString() || '');
                              toast.success('Informações encontradas!');
                            } else {
                              toast.info('Nenhuma informação encontrada com este nome também.');
                            }
                          })
                          .finally(() => setLoading(false));
                      }
                    }}
                    size="icon"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground pt-2">
                Você também pode preencher manualmente os campos abaixo.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
