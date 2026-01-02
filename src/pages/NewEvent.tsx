import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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


interface Song {
  id: string;
  name: string;
  type: string;
}

interface EventSongType {
  type: string;
  label: string;
  song?: Song;
  songTypeId?: string;
}

interface SongType {
  id: string;
  slug: string;
  name: string;
}

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
  const [eventSongTypes, setEventSongTypes] = useState<EventSongType[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [songTypes, setSongTypes] = useState<SongType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (tenantId) {
      fetchInitialData();
    }
  }, [tenantId]);

  const fetchInitialData = async () => {
    await Promise.all([fetchAvailableSongs(), fetchDefaultSongTypes()]);
  };

const fetchDefaultSongTypes = async () => {
  if (!tenantId) return;
  
  try {
    const { data, error } = await supabase
      .from('song_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('order_index');

    if (error) throw error;

    const types = data || [];
    setSongTypes(types);

    // Todos os tipos selecionados por padrão
    const initialSelection: Record<string, boolean> = {};
    types.forEach((type) => {
      initialSelection[type.id] = true;
    });
    setSelectedTypeIds(initialSelection);
  } catch (error) {
    console.error('Error fetching song types:', error);
    toast.error('Erro ao carregar tipos de música');
  }
};

  const fetchAvailableSongs = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setAvailableSongs(data || []);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

const handleSongSelect = (type: string, song: Song) => {
  setEventSongTypes((prev) =>
    prev.map((item) => (item.type === type ? { ...item, song } : item))
  );
};

const handleSongRemove = (type: string) => {
  setEventSongTypes((prev) =>
    prev.map((item) => (item.type === type ? { ...item, song: undefined } : item))
  );
};

const handleSongCreate = async (type: string, songName: string) => {
  try {
    const { data: songData, error: songError } = await supabase
      .from('songs')
      .insert([
        {
          user_id: user?.id,
          tenant_id: tenantId,
          name: songName,
          type: type,
          notes: '',
          sheet_music_url: null,
        },
      ])
      .select()
      .single();

    if (songError) throw songError;

    setAvailableSongs((prev) => [...prev, songData]);
    handleSongSelect(type, songData);
    toast.success('Música criada com sucesso!');
  } catch (error) {
    toast.error('Erro ao criar música');
    throw error;
  }
};

const toggleTypeSelection = (typeId: string) => {
  setSelectedTypeIds((prev) => ({
    ...prev,
    [typeId]: !prev[typeId],
  }));
};

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
      const data = { name, date, location, notes };
      eventSchema.parse(data);

      // Upload da imagem se houver
      const uploadedImageUrl = await uploadCoverImage(user?.id || '');

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

      // Salvar seleção de tipos para o evento
      const selectedTypes = songTypes.filter((type) => selectedTypeIds[type.id]);
      if (selectedTypes.length > 0) {
        const { error: typesError } = await supabase
          .from('event_song_types')
          .insert(
            selectedTypes.map((type, index) => ({
              event_id: eventData.id,
              song_type_id: type.id,
              order_index: index,
            }))
          );

        if (typesError) throw typesError;
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

            <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
              <Label className="text-xs font-semibold">Tipos de música deste evento</Label>
              <p className="text-xs text-muted-foreground">
                Selecione quais tipos litúrgicos serão utilizados neste evento. Todos vêm
                selecionados por padrão.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {songTypes.map((type) => (
                  <label
                    key={type.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={!!selectedTypeIds[type.id]}
                      onChange={() => toggleTypeSelection(type.id)}
                      disabled={loading}
                    />
                    <span className="font-medium truncate">{type.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary shadow-glow mt-2"
              disabled={loading || uploadingImage}
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