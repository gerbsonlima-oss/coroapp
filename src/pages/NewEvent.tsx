import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Calendar, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { compressEventCoverImage } from '@/utils/imageCompression';

const eventSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
  date: z.string().min(1, 'Data é obrigatória'),
  location: z.string().max(200, 'Local muito longo').optional(),
  notes: z.string().max(1000, 'Notas muito longas').optional(),
});


const NewEvent = () => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { tenantId, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Apenas administradores podem criar eventos');
      navigate('/events');
    }
  }, [isAdmin, adminLoading, navigate]);


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setCoverImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setCoverImageFile(null);
    setCoverImageUrl(null);
  };

  const uploadCoverImage = async (userId: string): Promise<string | null> => {
    if (!coverImageFile) return null;

    setUploadingImage(true);
    try {
      // Compress image to WebP format for better performance
      const compressedFile = await compressEventCoverImage(coverImageFile);
      const fileName = `${userId}/${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('event-covers')
        .upload(fileName, compressedFile, {
          cacheControl: '31536000', // 1 year cache
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('event-covers')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Verificar se tenantId está disponível
      if (!tenantId) {
        toast.error('Erro: organização não identificada. Recarregue a página.');
        setLoading(false);
        return;
      }

      if (!user?.id) {
        toast.error('Erro: você precisa estar logado.');
        setLoading(false);
        return;
      }

      const data = { name, date, location, notes };
      eventSchema.parse(data);

      // Upload da imagem se houver
      const uploadedImageUrl = await uploadCoverImage(user.id);

      console.log('Tentando criar evento:', {
        user_id: user.id,
        tenant_id: tenantId,
        name,
        date
      });

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([
          {
            user_id: user?.id,
            tenant_id: tenantId,
            name,
            date,
            location: location || null,
            notes: notes || null,
            cover_image_url: uploadedImageUrl,
          },
        ])
        .select()
        .single();

      if (eventError) throw eventError;
      }

      toast.success('Evento criado com sucesso!');
      navigate('/events');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Erro ao criar evento');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle">
        <div className="flex items-center gap-4 px-4 py-3">
          <button 
            onClick={() => navigate('/events')}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Novo Evento</h1>
        </div>
      </header>

      <main className="px-3 py-3 max-w-2xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-3 flex-1 overflow-y-auto">
            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold">Nome do Evento *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Missa de Natal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className={`h-9 rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label htmlFor="cover" className="text-xs font-semibold">Imagem de Capa</Label>
              <div className="space-y-4">
                {coverImageUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
                    <img 
                      src={coverImageUrl} 
                      alt="Capa do evento" 
                      className="h-full w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={handleRemoveImage}
                      className="absolute right-2 top-2"
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-12">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nenhuma imagem selecionada
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    id="cover"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={loading}
                    className="hidden"
                  />
                  <Label
                    htmlFor="cover"
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Upload className="h-4 w-4" />
                    {coverImageUrl ? 'Alterar Imagem' : 'Selecionar Imagem'}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5MB
                </p>
              </div>
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label htmlFor="date" className="text-xs font-semibold">Data *</Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading}
                  className={`h-9 rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.date ? 'border-red-500' : ''}`}
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label htmlFor="location" className="text-xs font-semibold">Local</Label>
              <Input
                id="location"
                type="text"
                placeholder="Igreja Matriz"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
                className={`h-9 rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.location ? 'border-red-500' : ''}`}
              />
              {errors.location && <p className="text-xs text-red-500">{errors.location}</p>}
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label htmlFor="notes" className="text-xs font-semibold">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Notas sobre o evento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={4}
                className={`rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.notes ? 'border-red-500' : ''}`}
              />
              {errors.notes && <p className="text-xs text-red-500">{errors.notes}</p>}
            </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary shadow-glow mt-2"
              disabled={loading || uploadingImage || tenantLoading || !tenantId}
            >
              {loading || uploadingImage ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  {uploadingImage ? 'Fazendo upload...' : 'Criando...'}
                </div>
              ) : (
                'Criar Evento'
              )}
            </Button>
          </form>
      </main>
    </div>
  );
};

export default NewEvent;
