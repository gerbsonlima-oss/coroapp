import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { convertPdfToImages, createCombinedImage } from '@/utils/pdfToImage';
import { NaipeAudioManager, type NaipeAudio } from '@/components/NaipeAudioManager';
import { uploadFileToBucket } from '@/utils/storageUpload';

const songSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  notes: z.string().max(1000, 'Notas muito longas').optional(),
});

const NAIPES = [
  { key: 'soprano', label: 'Soprano' },
  { key: 'contralto', label: 'Contralto' },
  { key: 'tenor', label: 'Tenor' },
  { key: 'baixo', label: 'Baixo' },
  { key: 'original', label: 'TODOS' },
];

interface SongTypeOption {
  id: string;
  slug: string;
  name: string;
}

interface Song {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  sheet_music_url: string | null;
}

interface ExistingAudio {
  id: string;
  name: string;
  audio_url: string;
  naipe: string;
}

const SongForm = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const isEditMode = !!id;
  const [song, setSong] = useState<Song | null>(null);
  const [existingAudios, setExistingAudios] = useState<ExistingAudio[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [naipeAudios, setNaipeAudios] = useState<Record<string, NaipeAudio[]>>({
    soprano: [],
    contralto: [],
    tenor: [],
    baixo: [],
    original: [],
  });
  const [sheetMusic, setSheetMusic] = useState<File | null>(null);
  const [originalPdf, setOriginalPdf] = useState<File | null>(null);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [songTypes, setSongTypes] = useState<SongTypeOption[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSongTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('song_types')
          .select('id, slug, name')
          .order('order_index');

        if (error) throw error;
        setSongTypes(data || []);
      } catch (error) {
        console.error('Erro ao carregar tipos de música:', error);
        toast.error('Erro ao carregar tipos de música');
      }
    };

    fetchSongTypes();
  }, []);

  useEffect(() => {
    if (isEditMode && id) {
      fetchSong();
    }
  }, [id, isEditMode]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setSong(data);
      setName(data.name);
      setType(data.type);
      setNotes(data.notes || '');

      await fetchAudios();
    } catch (error: any) {
      toast.error('Erro ao carregar música');
      navigate('/songs');
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchAudios = async () => {
    const { data: audios, error: audiosError } = await supabase
      .from('song_audios')
      .select('*')
      .eq('song_id', id)
      .order('created_at', { ascending: true });

    if (audiosError) {
      console.error('Erro ao buscar áudios:', audiosError);
      return;
    }
    setExistingAudios(audios || []);
  };

  const handleNaipeAudiosChange = (naipe: string, audios: NaipeAudio[]) => {
    setNaipeAudios((prev) => ({ ...prev, [naipe]: audios }));
  };

  const handleSheetMusicChange = async (file: File | null) => {
    if (!file) {
      setSheetMusic(null);
      setOriginalPdf(null);
      return;
    }

    // Se for PDF, converte para imagem e salva o original
    if (file.type === 'application/pdf') {
      setConvertingPdf(true);
      setPdfProgress({ current: 0, total: 0 });
      setOriginalPdf(file); // Salva o PDF original
      
      try {
        toast.info('Convertendo PDF para imagem...');
        
        const pages = await convertPdfToImages(file, (current, total) => {
          setPdfProgress({ current, total });
        });
        
        // Combina todas as páginas em uma única imagem
        const combinedBlob = await createCombinedImage(pages);
        
        // Cria um novo arquivo a partir do blob
        const imageFile = new File(
          [combinedBlob],
          file.name.replace('.pdf', '.jpg'),
          { type: 'image/jpeg' }
        );
        
        setSheetMusic(imageFile);
        toast.success(`PDF convertido com sucesso (${pages.length} página${pages.length > 1 ? 's' : ''})`);
      } catch (error) {
        console.error('Erro ao converter PDF:', error);
        toast.error('Erro ao converter PDF. Tente um arquivo de imagem.');
        setSheetMusic(null);
        setOriginalPdf(null);
      } finally {
        setConvertingPdf(false);
        setPdfProgress({ current: 0, total: 0 });
      }
    } else {
      setSheetMusic(file);
      setOriginalPdf(null);
    }
  };

  const sanitizeFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
 
    const sanitized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
 
    return sanitized + extension;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const data = { name, type, notes };
      songSchema.parse(data);

      let sheetMusicUrl = isEditMode ? (song?.sheet_music_url || null) : null;
      let sheetMusicPdfUrl = null;
      
      if (sheetMusic) {
        const sanitizedSheetName = sanitizeFileName(sheetMusic.name);
        const sheetPath = `${user?.id}/${Date.now()}_${sanitizedSheetName}`;
        sheetMusicUrl = await uploadFileToBucket(sheetMusic, 'sheet-music', sheetPath);
      }
      
      // Upload do PDF original se existir
      if (originalPdf) {
        const sanitizedPdfName = sanitizeFileName(originalPdf.name);
        const pdfPath = `${user?.id}/${Date.now()}_original_${sanitizedPdfName}`;
        sheetMusicPdfUrl = await uploadFileToBucket(originalPdf, 'sheet-music', pdfPath);
      }

      let songId = id;

      if (isEditMode) {
        // Modo Edição
        const updateData: any = {
          name,
          type,
          notes: notes || null,
        };
        
        if (sheetMusicUrl) {
          updateData.sheet_music_url = sheetMusicUrl;
        }
        
        if (sheetMusicPdfUrl) {
          updateData.sheet_music_pdf_url = sheetMusicPdfUrl;
        }
        
        const { error } = await supabase
          .from('songs')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
      } else {
        // Modo Criação
        const insertData: any = {
          user_id: user?.id,
          name,
          type,
          notes: notes || null,
          sheet_music_url: sheetMusicUrl,
        };
        
        if (sheetMusicPdfUrl) {
          insertData.sheet_music_pdf_url = sheetMusicPdfUrl;
        }
        
        const { data: songData, error: songError } = await supabase
          .from('songs')
          .insert([insertData])
          .select()
          .single();

        if (songError) throw songError;
        
        // Usa o ID da música criada
        songId = songData.id;
        
        // Se vier de um evento, adiciona a música ao evento
        if (eventId) {
          const { error: eventSongError } = await supabase
            .from('event_songs')
            .insert([
              {
                event_id: eventId,
                song_id: songData.id,
              },
            ]);

          if (eventSongError) throw eventSongError;
        }
      }

      // Insere novos áudios na tabela song_audios
      const audioInserts = [];
      let uploadCount = 0;
      const totalUploads = Object.values(naipeAudios).reduce((sum, audios) => sum + audios.length, 0);
      
      for (const [naipe, audios] of Object.entries(naipeAudios)) {
        for (const audio of audios) {
          uploadCount++;
          toast.loading(`Fazendo upload do áudio ${uploadCount}/${totalUploads}...`);
          
          const sanitizedAudioName = sanitizeFileName(audio.file.name);
          const audioPath = `${user?.id}/${naipe}_${Date.now()}_${sanitizedAudioName}`;
          
          const audioUrl = await uploadFileToBucket(audio.file, 'audio-files', audioPath);
          
          audioInserts.push({
            song_id: songId,
            naipe,
            audio_url: audioUrl,
            name: audio.name,
          });
          
          if (uploadCount < totalUploads) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (audioInserts.length > 0) {
        const { error: audioError } = await supabase
          .from('song_audios')
          .insert(audioInserts);

        if (audioError) throw audioError;
      }

      toast.success(isEditMode ? 'Música atualizada com sucesso!' : 'Música cadastrada com sucesso!');
      
      if (eventId) {
        navigate(`/events/${eventId}`);
      } else if (isEditMode) {
        navigate(`/songs/${songId}`);
      } else {
        navigate('/songs');
      }
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
        toast.error(isEditMode ? 'Erro ao atualizar música' : 'Erro ao cadastrar música');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isEditMode && fetchLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1DB954] border-t-transparent" />
      </div>
    );
  }

  if (isEditMode && !song) return null;

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#121212] border-b border-[#282828]">
        <div className="flex items-center gap-4 p-4">
          <button 
            onClick={() => navigate(eventId ? `/events/${eventId}` : (isEditMode ? `/songs/${id}` : '/songs'))}
            className="p-2 rounded-full hover:bg-[#282828] transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">{isEditMode ? 'Editar Música' : 'Cadastrar Música'}</h1>
        </div>
      </header>

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Informações Básicas</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white text-sm font-medium">Nome da Música *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ave Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className={`bg-[#282828] border-[#3e3e3e] text-white placeholder:text-[#a7a7a7] ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-white text-sm font-medium">Tipo *</Label>
              <Select value={type} onValueChange={setType} disabled={loading}>
                <SelectTrigger className={`bg-[#282828] border-[#3e3e3e] text-white ${errors.type ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#282828] border-[#3e3e3e]">
                  {songTypes.map((songType) => (
                    <SelectItem
                      key={songType.id}
                      value={songType.slug}
                      className="text-white focus:bg-[#3e3e3e] focus:text-white"
                    >
                      {songType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-white text-sm font-medium">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Notas sobre a música..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={3}
                className={`bg-[#282828] border-[#3e3e3e] text-white placeholder:text-[#a7a7a7] ${errors.notes ? 'border-red-500' : ''}`}
              />
              {errors.notes && <p className="text-sm text-red-500">{errors.notes}</p>}
            </div>
          </div>

          {/* Partitura */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Partitura</h2>
            
            {isEditMode && song?.sheet_music_url && (
              <div className="flex items-center gap-2 text-sm text-[#1DB954]">
                <FileText className="h-4 w-4" />
                <span>Partitura já cadastrada</span>
              </div>
            )}
            
            {convertingPdf && (
              <div className="rounded-lg bg-[#282828] p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Convertendo PDF...</p>
                    <p className="text-xs text-[#a7a7a7]">
                      Página {pdfProgress.current} de {pdfProgress.total}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Input
                id="sheet-music"
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleSheetMusicChange(e.target.files?.[0] || null)}
                disabled={loading || convertingPdf}
                className="bg-[#282828] border-[#3e3e3e] text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#1DB954] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-[#1ed760]"
              />
              {sheetMusic && (
                <div className="flex items-center gap-2 text-sm text-[#a7a7a7]">
                  <FileText className="h-4 w-4" />
                  {sheetMusic.name}
                </div>
              )}
              <p className="text-xs text-[#a7a7a7]">
                PDFs serão automaticamente convertidos em imagem
              </p>
            </div>
          </div>

          {/* Áudios por Naipe */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Áudios por Naipe</h2>
              <p className="text-sm text-[#a7a7a7] mt-1">
                {isEditMode ? 'Adicione novos áudios - os existentes serão mantidos' : 'Podem adicionar múltiplos áudios por naipe'}
              </p>
            </div>
            
            <div className="space-y-4">
              {NAIPES.map(({ key, label }) => (
                <div key={key} className="bg-[#181818] rounded-lg p-4">
                  <NaipeAudioManager
                    naipe={key}
                    naipeLabel={label}
                    audios={naipeAudios[key] || []}
                    onAudiosChange={(audios) => handleNaipeAudiosChange(key, audios)}
                    disabled={loading}
                    existingAudios={isEditMode ? existingAudios.filter(a => a.naipe === key) : undefined}
                    onAudioDeleted={isEditMode ? fetchAudios : undefined}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botão Salvar */}
          <Button
            type="submit"
            className="w-full rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760] hover:scale-105 transition-all h-12 text-base font-semibold"
            disabled={loading || convertingPdf}
          >
            {loading || convertingPdf ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
            ) : (
              <>
                {isEditMode ? (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Alterações
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Cadastrar Música
                  </>
                )}
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default SongForm;
