import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface CopySongToTenantDialogProps {
  songId: string;
  songName: string;
  currentTenantId: string;
}

export const CopySongToTenantDialog = ({
  songId,
  songName,
  currentTenantId,
}: CopySongToTenantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [copyAudios, setCopyAudios] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingTenants, setFetchingTenants] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTenants();
    }
  }, [open]);

  const fetchTenants = async () => {
    setFetchingTenants(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .neq('id', currentTenantId)
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Erro ao buscar tenants:', error);
      toast.error('Erro ao carregar lista de coros');
    } finally {
      setFetchingTenants(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedTenantId) {
      toast.error('Selecione um coro de destino');
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch the original song
      const { data: originalSong, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single();

      if (songError) throw songError;

      // 2. Create a copy in the target tenant
      const { data: newSong, error: insertError } = await supabase
        .from('songs')
        .insert({
          name: originalSong.name,
          type: originalSong.type,
          notes: originalSong.notes,
          sheet_music_url: originalSong.sheet_music_url,
          sheet_music_pdf_url: originalSong.sheet_music_pdf_url,
          tenant_id: selectedTenantId,
          user_id: originalSong.user_id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Copy audios if selected
      if (copyAudios) {
        const { data: originalAudios, error: audiosError } = await supabase
          .from('song_audios')
          .select('*')
          .eq('song_id', songId);

        if (audiosError) throw audiosError;

        if (originalAudios && originalAudios.length > 0) {
          const audiosCopy = originalAudios.map((audio) => ({
            song_id: newSong.id,
            naipe: audio.naipe,
            audio_url: audio.audio_url,
            name: audio.name,
            tenant_id: selectedTenantId,
          }));

          const { error: insertAudiosError } = await supabase
            .from('song_audios')
            .insert(audiosCopy);

          if (insertAudiosError) throw insertAudiosError;
        }
      }

      const targetTenant = tenants.find((t) => t.id === selectedTenantId);
      toast.success(`Música copiada para ${targetTenant?.name || 'o coro selecionado'}!`);
      setOpen(false);
      setSelectedTenantId('');
    } catch (error: any) {
      console.error('Erro ao copiar música:', error);
      toast.error('Erro ao copiar música: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Copiar para outro coro">
          <Copy className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar Música</DialogTitle>
          <DialogDescription>
            Copiar "{songName}" para outro coro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Coro de destino</Label>
            {fetchingTenants ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum outro coro disponível
              </p>
            ) : (
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um coro" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="copyAudios"
              checked={copyAudios}
              onCheckedChange={(checked) => setCopyAudios(checked === true)}
            />
            <Label htmlFor="copyAudios" className="text-sm font-normal cursor-pointer">
              Copiar também os áudios
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCopy}
            disabled={loading || !selectedTenantId || tenants.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Copiando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
