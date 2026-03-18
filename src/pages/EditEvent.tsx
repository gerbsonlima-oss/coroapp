import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Calendar, Upload, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { compressEventCoverImage } from '@/utils/imageCompression';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const eventSchema = z.object({
  name: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo'),
  date: z.string().min(1, 'Data é obrigatória'),
  location: z.string().max(200, 'Local muito longo').optional(),
  notes: z.string().max(1000, 'Notas muito longas').optional(),
});


const EditEvent = () => {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<string>('deep_blue_gold');
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Você não tem permissão para acessar esta página');
      navigate(buildPath('/events'));
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (id && tenantId) {
      fetchEventData();
    }
  }, [id, tenantId]);

  useEffect(() => {
    if (!id) return;

    const loadPdfTheme = async () => {
      const { data } = await supabase
        .from('events')
        .select('pdf_theme')
        .eq('id', id)
        .maybeSingle();

      if (data && data.pdf_theme) {
        setPdfTheme(data.pdf_theme);
      }
    };

    loadPdfTheme();
  }, [id]);

  const fetchEventData = async () => {
    if (!id) return;

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;

      setName(eventData.name);
      setDate(eventData.date);
      setLocation(eventData.location || '');
      setNotes(eventData.notes || '');
      setCoverImageUrl(eventData.cover_image_url || null);
    } catch (error) {
      toast.error('Erro ao carregar dados do evento');
      navigate(buildPath('/events'));
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setCoverImageFile(file);
    
    // Preview da imagem
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
    if (!coverImageFile) return coverImageUrl;

    setUploadingImage(true);
    try {
      // Compress image to WebP format for better performance
      const compressedFile = await compressEventCoverImage(coverImageFile);
      const fileName = `${userId}/${id}-${Date.now()}.webp`;

      const { error: uploadError, data } = await supabase.storage
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
      return coverImageUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    if (!id) {
      toast.error('Evento inválido');
      setLoading(false);
      return;
    }

    try {
      const data = { name, date, location, notes };
      eventSchema.parse(data);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Upload da imagem se houver
      const uploadedImageUrl = await uploadCoverImage(user.id);

      // Atualizar dados básicos do evento
      const { error: eventError } = await supabase
        .from('events')
        .update({
          name,
          date,
          location: location || null,
          notes: notes || null,
          cover_image_url: uploadedImageUrl,
          pdf_theme: pdfTheme,
        })
        .eq('id', id);

      if (eventError) throw eventError;

      toast.success('Evento atualizado com sucesso!');
      navigate(buildPath(`/events/${id}`));
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
        toast.error('Erro ao atualizar evento');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Evento excluído com sucesso!');
      setShowDeleteDialog(false);
      navigate(buildPath('/events'));
    } catch (error: any) {
      toast.error('Erro ao excluir evento');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle">
        <div className="flex items-center gap-4 px-4 py-3">
          <button 
            onClick={() => navigate(buildPath(`/events/${id}`))}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Editar Evento</h1>
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
              <Label className="text-xs font-semibold">Tema do PDF de Partituras</Label>
              <p className="text-xs text-muted-foreground">
                Escolha a paleta de cores usada na capa, no índice e nos cabeçalhos das partituras exportadas.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPdfTheme('deep_blue_gold')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'deep_blue_gold'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Azul & Dourado</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-sky-600 to-amber-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('emerald_night')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'emerald_night'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Verde Esmeralda</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-900" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('violet_sunset')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'violet_sunset'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Roxo & Rosa</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-rose-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('graphite_copper')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'graphite_copper'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Grafite & Cobre</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-slate-800 to-orange-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('crimson_noir')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'crimson_noir'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Vermelho Borgonha</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-800 to-slate-900" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('sunrise_coral')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'sunrise_coral'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Coral & Dourado</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-orange-500 to-amber-300" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('ocean_teal')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'ocean_teal'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Oceano Turquesa</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-teal-600 to-cyan-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('forest_sage')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'forest_sage'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Verde Floresta</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-300" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('midnight_purple')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'midnight_purple'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Roxo Meia-noite</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-purple-800 to-purple-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('wine_burgundy')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'wine_burgundy'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Vinho Borgonha</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-rose-800 to-pink-300" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('indigo_silver')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'indigo_silver'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Índigo & Prata</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-indigo-700 to-slate-300" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('navy_gold')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'navy_gold'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Azul Marinho & Ouro</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-900 to-yellow-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('terracotta_cream')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'terracotta_cream'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Terracota & Creme</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-orange-700 to-amber-100" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('jade_bronze')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'jade_bronze'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Jade & Bronze</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-green-600 to-amber-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setPdfTheme('charcoal_rose')}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    pdfTheme === 'charcoal_rose'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="font-semibold text-foreground">Carvão & Rosa</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-gray-800 to-rose-300" />
                </button>
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

            <Button
              type="submit"
              className="w-full gradient-primary shadow-glow mt-2"
              disabled={loading || uploadingImage}
            >
              {loading || uploadingImage ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  {uploadingImage ? 'Fazendo upload...' : 'Salvando...'}
                </div>
              ) : (
                'Salvar Alterações'
              )}
            </Button>

            {user && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Evento
              </Button>
            )}
          </form>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditEvent;
