import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowLeft, Save, Upload, FileText, Loader2, Music, Mic, Paperclip, Check, ChevronsUpDown, FileType, Search, Guitar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LyricsSearchModal } from '@/components/LyricsSearchModal';
import { toast } from 'sonner';
import { z } from 'zod';
import { convertPdfToImages, createCombinedImage } from '@/utils/pdfToImage';
import { NaipeAudioManager, type NaipeAudio } from '@/components/NaipeAudioManager';
import { uploadFileToBucket } from '@/utils/storageUpload';

const songSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo'),
  type: z.string().min(1, 'Tipo é obrigatório'),
});

const NAIPES = [
  { key: 'soprano', label: 'Soprano' },
  { key: 'contralto', label: 'Contralto' },
  { key: 'tenor', label: 'Tenor' },
  { key: 'baixo', label: 'Baixo' },
  { key: 'unissono', label: 'Uníssono' },
  { key: 'original', label: 'Todas as Vozes' },
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
  sheet_music_url: string | null;
  sheet_music_pdf_url?: string | null;
  lyrics?: string | null;
  chords?: string | null;
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
  const [openTypeSelect, setOpenTypeSelect] = useState(false);
  const [naipeAudios, setNaipeAudios] = useState<Record<string, NaipeAudio[]>>({
    soprano: [],
    contralto: [],
    tenor: [],
    baixo: [],
    unissono: [],
    original: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const [sheetMusic, setSheetMusic] = useState<File | null>(null);
  const [originalPdf, setOriginalPdf] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const [chordsText, setChordsText] = useState('');
  const [lyricsSearchOpen, setLyricsSearchOpen] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [songTypes, setSongTypes] = useState<SongTypeOption[]>([]);
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Você não tem permissão para acessar esta página');
      navigate('/songs');
    }
  }, [isAdmin, adminLoading, navigate]);

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
  }, [tenantId]);

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
      
      setSong(data as Song);
      setName(data.name);
      setType(data.type);
      if (data.lyrics) {
        setLyricsText(data.lyrics);
      }
      if (data.chords) {
        setChordsText(data.chords);
      }

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
      const data = { name, type };
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
      
      // Get lyrics content from file or text
      let lyricsContent: string | null = lyricsText || null;
      if (lyricsFile && !lyricsText) {
        lyricsContent = await lyricsFile.text();
      }

      if (isEditMode) {
        // Modo Edição
        const updateData: any = {
          name,
          type,
        };
        
        if (sheetMusicUrl) {
          updateData.sheet_music_url = sheetMusicUrl;
        }
        
        if (sheetMusicPdfUrl) {
          updateData.sheet_music_pdf_url = sheetMusicPdfUrl;
        }
        
        if (lyricsContent) {
          updateData.lyrics = lyricsContent;
        }
        
        if (chordsText) {
          updateData.chords = chordsText;
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
          tenant_id: tenantId,
          name,
          type,
          sheet_music_url: sheetMusicUrl,
        };
        
        if (sheetMusicPdfUrl) {
          insertData.sheet_music_pdf_url = sheetMusicPdfUrl;
        }
        
        if (lyricsContent) {
          insertData.lyrics = lyricsContent;
        }
        
        if (chordsText) {
          insertData.chords = chordsText;
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
      
      let toastId: string | number | undefined;
      if (totalUploads > 0) {
        toastId = toast.loading(`Iniciando upload de ${totalUploads} áudios...`);
      }
      
      for (const [naipe, audios] of Object.entries(naipeAudios)) {
        for (const audio of audios) {
          uploadCount++;
          if (toastId) {
            toast.loading(`Fazendo upload do áudio ${uploadCount}/${totalUploads}...`, { id: toastId });
          }
          
          const sanitizedAudioName = sanitizeFileName(audio.file.name);
          const audioPath = `${user?.id}/${naipe}_${Date.now()}_${sanitizedAudioName}`;
          
          const audioUrl = await uploadFileToBucket(audio.file, 'audio-files', audioPath);
          
          audioInserts.push({
            song_id: songId,
            tenant_id: tenantId,
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

      if (toastId) {
        toast.dismiss(toastId);
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isEditMode && !song) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle">
        <div className="flex items-center gap-4 px-4 py-3">
          <button 
            onClick={() => navigate(eventId ? `/events/${eventId}` : (isEditMode ? `/songs/${id}` : '/songs'))}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">{isEditMode ? 'Editar Música' : 'Cadastrar Música'}</h1>
        </div>
      </header>

      <main className="px-3 py-3 max-w-2xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-3 flex-1 overflow-y-auto">
          {/* Informações Básicas Card */}
          <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold">Nome *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ave Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className={`h-9 rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="type" className="text-xs font-semibold">Tipo *</Label>
              <Popover open={openTypeSelect} onOpenChange={setOpenTypeSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openTypeSelect}
                    className={`w-full h-9 justify-between rounded-md text-sm border-primary/30 bg-secondary/50 ${errors.type ? 'border-red-500' : ''}`}
                    disabled={loading}
                  >
                    {type ? songTypes.find((t) => t.slug === type)?.name : 'Selecione'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar tipo..." />
                    <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {songTypes.map((songType) => (
                          <CommandItem
                            key={songType.id}
                            value={songType.slug}
                            onSelect={(currentValue) => {
                              setType(currentValue === type ? '' : currentValue);
                              setOpenTypeSelect(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                type === songType.slug ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {songType.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.type && <p className="text-xs text-red-500">{errors.type}</p>}
            </div>
          </div>

          {/* Partitura Card */}
          <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
            <Label className="text-xs font-semibold">Partitura</Label>

            {isEditMode && song?.sheet_music_url && (
              <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-700 dark:text-green-400">
                <FileText className="h-3 w-3" />
                <span>Cadastrada</span>
              </div>
            )}
            
            {convertingPdf && (
              <div className="rounded bg-primary/5 border border-primary/20 p-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">Convertendo...</p>
                    <p className="text-xs text-muted-foreground">
                      {pdfProgress.current}/{pdfProgress.total}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <Input
              ref={fileInputRef}
              id="sheet-music"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => handleSheetMusicChange(e.target.files?.[0] || null)}
              disabled={loading || convertingPdf}
              className="hidden"
            />
            
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || convertingPdf}
                title="Anexar arquivo"
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-50"
              >
                <Paperclip className="h-5 w-5 text-primary" />
              </button>
              {sheetMusic && (
                <span className="text-xs truncate bg-primary/5 px-2 py-1 rounded border border-primary/20">
                  {sheetMusic.name}
                </span>
              )}
            </div>
          </div>

          {/* Letra Card */}
          <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
            <Label className="text-xs font-semibold">Letra</Label>
            
            <Input
              ref={lyricsInputRef}
              id="lyrics-file"
              type="file"
              accept=".txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setLyricsFile(file);
                  const text = await file.text();
                  setLyricsText(text);
                }
              }}
              disabled={loading || convertingPdf}
              className="hidden"
            />
            
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => lyricsInputRef.current?.click()}
                disabled={loading || convertingPdf}
                title="Anexar arquivo TXT"
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-50"
              >
                <Paperclip className="h-5 w-5 text-primary" />
              </button>
              <button
                type="button"
                onClick={() => setLyricsSearchOpen(true)}
                disabled={loading || convertingPdf || !name}
                title="Buscar letra online"
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-50"
              >
                <Search className="h-5 w-5 text-primary" />
              </button>
              {lyricsFile && (
                <span className="text-xs truncate bg-primary/5 px-2 py-1 rounded border border-primary/20">
                  {lyricsFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Anexe .txt, busque online ou digite abaixo</p>
            
            {/* Dica de formatação */}
            <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded border border-primary/10">
              <p className="font-medium text-foreground/80 mb-1">Formatação:</p>
              <p>• Use <code className="bg-primary/10 px-1 rounded">[REFRÃO]</code>...<code className="bg-primary/10 px-1 rounded">[/REFRÃO]</code> para marcar refrões</p>
              <p>• Inicie estrofes com <code className="bg-primary/10 px-1 rounded">1.</code>, <code className="bg-primary/10 px-1 rounded">2.</code> etc para numerar</p>
            </div>
            
            {/* Textarea para editar letra */}
            <textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder={`[REFRÃO]\nGlória a Deus nas alturas\nE paz na terra aos homens\n[/REFRÃO]\n\n1. Primeira estrofe aqui...\n\n2. Segunda estrofe aqui...`}
              disabled={loading}
              rows={10}
              className="w-full rounded-lg bg-secondary/30 p-3 text-sm font-mono leading-relaxed border border-primary/10 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y min-h-[150px] placeholder:text-muted-foreground/50"
            />
            {lyricsText && (
              <p className="text-xs text-muted-foreground text-right">
                {lyricsText.length} caracteres
              </p>
            )}
          </div>

          <LyricsSearchModal
            open={lyricsSearchOpen}
            onOpenChange={setLyricsSearchOpen}
            songName={name}
            onImport={(lyrics) => {
              setLyricsText(lyrics);
              const blob = new Blob([lyrics], { type: 'text/plain' });
              const file = new File([blob], `${name || 'letra'}.txt`, { type: 'text/plain' });
              setLyricsFile(file);
            }}
          />

          {/* Cifra Card */}
          <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
            <div className="flex items-center gap-2">
              <Guitar className="h-4 w-4 text-primary" />
              <Label className="text-xs font-semibold">Cifra</Label>
            </div>
            
            {/* Dica de formatação */}
            <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded border border-primary/10">
              <p className="font-medium text-foreground/80 mb-1">Formatos suportados:</p>
              <p>• <strong>ChordPro:</strong> <code className="bg-primary/10 px-1 rounded">[C]Letra[G]aqui</code></p>
              <p>• <strong>Acordes acima:</strong> acordes em linha separada</p>
              <p className="mt-1 font-medium text-foreground/80">Seções:</p>
              <p>• Use <code className="bg-primary/10 px-1 rounded">[REFRÃO]</code>...<code className="bg-primary/10 px-1 rounded">[/REFRÃO]</code> para refrão</p>
              <p>• Use <code className="bg-primary/10 px-1 rounded">[1]</code>...<code className="bg-primary/10 px-1 rounded">[/1]</code>, <code className="bg-primary/10 px-1 rounded">[2]</code>...<code className="bg-primary/10 px-1 rounded">[/2]</code> para estrofes</p>
            </div>
            
            {/* Textarea para editar cifra */}
            <textarea
              value={chordsText}
              onChange={(e) => setChordsText(e.target.value)}
              placeholder={`[1]
[C]Quão grande [G]és Tu, [Am]Senhor
[F]Quão grande [C]és Tu
[/1]

[REFRÃO]
[C]Minh'alma [G]canta a [Am]Ti
[F]Quão grande [C]és Tu
[/REFRÃO]

[2]
[C]Segunda estrofe [G]aqui
[/2]`}
              disabled={loading}
              rows={10}
              className="w-full rounded-lg bg-secondary/30 p-3 text-sm font-mono leading-relaxed border border-primary/10 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y min-h-[150px] placeholder:text-muted-foreground/50"
            />
            {chordsText && (
              <p className="text-xs text-muted-foreground text-right">
                {chordsText.length} caracteres
              </p>
            )}
          </div>

          {/* Áudios por Naipe Card */}
          <div className="bg-card border border-primary/20 rounded-lg p-3 shadow-card space-y-2">
            <Label className="text-xs font-semibold">Áudios</Label>
            
            <div className="space-y-2">
              {NAIPES.map(({ key, label }) => (
                <div key={key} className="bg-secondary/50 rounded p-2 border border-primary/10 hover:border-primary/20 transition-all">
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
        </form>

        {/* Botão Salvar - Fixed Bottom */}
        <Button
          type="submit"
          onClick={handleSubmit}
          className="w-full h-12 rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:to-primary text-primary-foreground hover:scale-105 transition-all text-sm font-bold shadow-glow hover:shadow-glow/50 mt-3"
          disabled={loading || convertingPdf}
        >
          {loading || convertingPdf ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <>
              {isEditMode ? 'Salvar' : 'Cadastrar'}
            </>
          )}
        </Button>
      </main>
    </div>
  );
};

export default SongForm;
