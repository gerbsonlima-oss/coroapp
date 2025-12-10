import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Youtube } from 'lucide-react';
import { toast } from 'sonner';

interface YouTubeDownloadDialogProps {
  onDownloadComplete: (file: File) => void;
  disabled?: boolean;
}

export const YouTubeDownloadDialog = ({ onDownloadComplete, disabled = false }: YouTubeDownloadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp3');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!url.trim()) {
      toast.error('Cole um link do YouTube válido');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/download-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), format }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `Erro ${response.status}` }));
        throw new Error(error.error || 'Erro ao baixar do YouTube');
      }

      const blob = await response.blob();
      const fileName = `youtube_${Date.now()}.${format === 'mp4a' ? 'm4a' : 'mp3'}`;
      const file = new File([blob], fileName, { type: format === 'mp4a' ? 'audio/mp4' : 'audio/mpeg' });

      onDownloadComplete(file);
      toast.success('Áudio baixado com sucesso!');
      
      setUrl('');
      setOpen(false);
    } catch (error: any) {
      console.error('Download error:', error);
      
      let errorMessage = 'Erro ao baixar áudio do YouTube';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Servidor não está rodando. Execute: npm run server';
      } else if (error.message.includes('Invalid YouTube URL')) {
        errorMessage = 'Link inválido. Use um link do YouTube válido';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          title="Baixar do YouTube"
          className="p-1.5 rounded bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Youtube className="h-4 w-4 text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar do YouTube</DialogTitle>
          <DialogDescription>
            Cole um link do YouTube para baixar o áudio
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-url" className="text-sm">URL do YouTube</Label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Formato</Label>
            <RadioGroup value={format} onValueChange={setFormat} disabled={loading}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp3" id="mp3" />
                <Label htmlFor="mp3" className="font-normal cursor-pointer">MP3 (melhor compatibilidade)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp4a" id="mp4a" />
                <Label htmlFor="mp4a" className="font-normal cursor-pointer">MP4A (melhor qualidade)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1 h-9"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDownload}
              disabled={loading || !url.trim()}
              className="flex-1 h-9"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Baixando...
                </>
              ) : (
                'Baixar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
