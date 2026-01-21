import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAudioCache } from '@/hooks/useAudioCache';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SheetViewer } from '@/components/SheetViewer';
import { EnhancedMiniPlayer } from '@/components/EnhancedMiniPlayer';
import { CopySongToTenantDialog } from '@/components/CopySongToTenantDialog';
import { 
  ArrowLeft, 
  Music2, 
  FileText, 
  Trash2, 
  Pencil, 
  FileType, 
  MoreVertical, 
  Download, 
  MessageCircle,
  Check,
  Music,
  Share2,
  Guitar
} from 'lucide-react';
import ChordViewer from '@/components/ChordViewer';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Song {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  sheet_music_url: string | null;
  sheet_music_pdf_url?: string | null;
  lyrics?: string | null;
  chords?: string | null;
}

interface SongAudio {
  id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

const typeLabels: Record<string, string> = {
  canto_entrada: 'Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo',
  aclamacao: 'Aclamação',
  oferendas: 'Ofertório',
  santo: 'Santo',
  cordeiro: 'Cordeiro',
  comunhao: 'Comunhão',
  acao_gracas: 'Ação de Graças',
  final: 'Final',
  outro: 'Outro',
};

const typeColors: Record<string, string> = {
  // Novos tipos
  canto_entrada: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ato_penitencial: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  gloria: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  salmo: 'bg-green-500/10 text-green-500 border-green-500/20',
  aclamacao: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  oferendas: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  santo: 'bg-red-500/10 text-red-500 border-red-500/20',
  cordeiro: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  comunhao: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  acao_gracas: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  final: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  // Tipos antigos (para retrocompatibilidade)
  entrada: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  perdao: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ofertorio: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  outro: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-500/5 text-pink-600 border-pink-500/40',
  contralto: 'bg-yellow-500/5 text-yellow-600 border-yellow-500/40',
  tenor: 'bg-green-500/5 text-green-600 border-green-500/40',
  baixo: 'bg-blue-500/5 text-blue-600 border-blue-500/40',
  unissono: 'bg-slate-100 text-slate-800 border-none',
};

const NAIPE_ORDER = ['soprano', 'contralto', 'tenor', 'baixo', 'unissono'];

const SongDetails = () => {
  const { id } = useParams();
  const [song, setSong] = useState<Song | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { isSuperAdmin } = useSuperAdmin();
  const { tenantId } = useTenant();
  const { getCachedUrl, isCached } = useAudioCache();
  const { 
    currentTrackIndex, 
    playTrack, 
    setPlaylist, 
    isPlaying, 
    togglePlay, 
    playNext, 
    playPrevious, 
    showSheetViewer, 
    setShowSheetViewer, 
    sheetMusicSrc, 
    setSheetMusicSrc,
    currentTime,
    duration,
    audioRef,
    repeatMode,
    currentTrack
  } = usePlayer();

  useEffect(() => {
    fetchSong();
  }, [id]);

  const sortedAudios = useMemo(() => {
    return [...audios].sort((a, b) => {
      const indexA = NAIPE_ORDER.indexOf((a.naipe || '').toLowerCase());
      const indexB = NAIPE_ORDER.indexOf((b.naipe || '').toLowerCase());
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [audios]);

  const tracks = useMemo(() => {
    if (!song) return [];
    return sortedAudios.map(audio => ({
      id: audio.id,
      songId: song.id,
      songName: song.name,
      songType: song.type,
      naipe: audio.naipe || audio.name,
      url: audio.audio_url,
      sheetMusicUrl: song.sheet_music_pdf_url || song.sheet_music_url
    }));
  }, [song, sortedAudios]);

  useEffect(() => {
    if (tracks.length > 0) {
      setPlaylist(tracks);
    }
  }, [tracks, setPlaylist]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setSong(data as Song);

      // Buscar áudios da música
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .eq('song_id', id)
        .order('created_at', { ascending: true });

      if (audiosError) throw audiosError;
      setAudios(audiosData || []);

    } catch (error: any) {
      toast.error('Erro ao carregar música');
      navigate('/songs');
    } finally {
      setLoading(false);
    }
  };

  const fetchLyrics = async (url: string) => {
    setLoadingLyrics(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao carregar letra');
      const text = await response.text();
      setLyrics(text);
    } catch (error) {
      console.error('Erro ao carregar letra:', error);
      toast.error('Erro ao carregar letra da música');
    } finally {
      setLoadingLyrics(false);
    }
  };

  const handleDelete = async () => {
    if (!song) return;
    setDeleting(true);

    try {
      const { error } = await supabase.from('songs').delete().eq('id', song.id);

      if (error) throw error;

      toast.success('Música excluída com sucesso!');
      navigate('/songs');
    } catch (error: any) {
      toast.error('Erro ao excluir música');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadAudio = async (audio: SongAudio) => {
    try {
      const cachedUrl = await getCachedUrl(audio.audio_url);
      const response = await fetch(cachedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${typeLabels[song?.type || '']} - ${song?.name} - ${audio.name}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download do áudio iniciado!');
    } catch (error) {
      toast.error('Erro ao baixar áudio');
    }
  };

  const handleShareWhatsApp = async (audio: SongAudio) => {
    if (!song) return;
    try {
      const cachedUrl = await getCachedUrl(audio.audio_url);
      const text = encodeURIComponent(`🎵 ${typeLabels[song.type]} - ${song.name} (${audio.name})\n\nOuvir áudio: ${cachedUrl}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (error) {
      toast.error('Erro ao compartilhar via WhatsApp');
    }
  };

  const handleDownloadPdf = async () => {
    if (!song?.sheet_music_pdf_url && !song?.sheet_music_url) return;
    const url = song.sheet_music_pdf_url || song.sheet_music_url;
    try {
      const cachedUrl = await getCachedUrl(url!);
      const response = await fetch(cachedUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${typeLabels[song.type]} - ${song.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success('Download da partitura iniciado!');
    } catch (error) {
      toast.error('Erro ao baixar partitura');
    }
  };

  const handleFullShareWhatsApp = async () => {
    if (!song) return;
    
    try {
      // Build WhatsApp message
      let message = `🎵 *${song.name}*\n`;
      message += `📋 ${typeLabels[song.type] || song.type}\n\n`;

      // Add sheet music link
      if (song.sheet_music_pdf_url || song.sheet_music_url) {
        const sheetUrl = song.sheet_music_pdf_url || song.sheet_music_url;
        message += `📄 *Partitura:* ${sheetUrl}\n`;
      }

      // Add audio links
      if (audios && audios.length > 0) {
        message += `\n🎧 *Áudios por Naipe:*\n`;
        const sorted = [...audios].sort((a, b) => {
          const indexA = NAIPE_ORDER.indexOf((a.naipe || a.name).toLowerCase());
          const indexB = NAIPE_ORDER.indexOf((b.naipe || b.name).toLowerCase());
          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });

        sorted.forEach((audio: any) => {
          message += `• ${audio.naipe || audio.name}: ${audio.audio_url}\n`;
        });
      }

      message += `\nRepositório Litúrgico Digital 🙏`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      toast.success('Compartilhando catálogo da música no WhatsApp!');
    } catch (error) {
      console.error('Error sharing music via WhatsApp:', error);
      toast.error('Erro ao preparar compartilhamento');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!song) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <EnhancedMiniPlayer />
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/songs')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{song.name}</h1>
              <Badge className={`bg-primary/10 text-primary border-primary/30 mt-1 text-xs font-medium`}>
                {typeLabels[song.type]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleFullShareWhatsApp}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar Completa
                </DropdownMenuItem>
                
                {song.sheet_music_url && (
                  <DropdownMenuItem onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Partitura (PDF)
                  </DropdownMenuItem>
                )}

                {(isAdmin || isSuperAdmin) && (
                  <>
                    <div className="h-px bg-muted my-1" />
                    {isSuperAdmin && song && tenantId && (
                      <CopySongToTenantDialog
                        songId={song.id}
                        songName={song.name}
                        currentTenantId={tenantId}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <div className="flex items-center w-full cursor-default">
                              <Share2 className="mr-2 h-4 w-4" /> Copiar para outro coro
                            </div>
                          </DropdownMenuItem>
                        }
                      />
                    )}
                    <DropdownMenuItem onClick={() => navigate(`/songs/${id}/edit`)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar Música
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir Música
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a música "{song.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleting ? 'Excluindo...' : 'Excluir'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 p-4">
          {song.notes && (
            <Card className="gradient-card border-border/50 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Music2 className="h-4 w-4" />
                Observações
              </h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{song.notes}</p>
            </Card>
          )}

        {song.sheet_music_url && (
          <Card className="gradient-card border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-4 w-4" />
              Partitura
            </h2>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const url = song.sheet_music_pdf_url || song.sheet_music_url;
                if (url) {
                  const cached = await getCachedUrl(url);
                  setSheetMusicSrc(cached);
                  setShowSheetViewer(true);
                  // Se houver faixas, começa a tocar a primeira se nada estiver tocando
                  if (tracks.length > 0 && currentTrackIndex === null) {
                    playTrack(0);
                  }
                }
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Visualizar Partitura
            </Button>
          </Card>
        )}

        {song.lyrics && (
          <Card className="gradient-card border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileType className="h-4 w-4" />
              Letra
            </h2>
            <div className="rounded-lg bg-secondary/30 p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground">
                {song.lyrics}
              </pre>
            </div>
          </Card>
        )}

        {song.chords && (
          <Card className="gradient-card border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Guitar className="h-4 w-4" />
              Cifra
            </h2>
            <ChordViewer chords={song.chords} songId={song.id} />
          </Card>
        )}

        {audios.length > 0 ? (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-base md:text-lg font-semibold">
              <Music2 className="h-5 w-5" />
              Áudios por Naipe
            </h2>
            <div className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card p-1 divide-y divide-primary/10">
              {sortedAudios.map((audio, index) => {
                const globalIndex = index;
                const isAudioCached = isCached(audio.audio_url);
                const hasSheetMusic = Boolean(song.sheet_music_url || song.sheet_music_pdf_url);
                
                return (
                  <div 
                    key={audio.id} 
                    onClick={() => playTrack(globalIndex)}
                    className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 ${currentTrackIndex === globalIndex && currentTrack?.id === audio.id ? 'bg-primary/20 shadow-glow' : 'hover:bg-primary/8 cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (hasSheetMusic) {
                            playTrack(globalIndex);
                            const url = song.sheet_music_pdf_url || song.sheet_music_url;
                            if (url) {
                              const cached = await getCachedUrl(url);
                              setSheetMusicSrc(cached);
                              setShowSheetViewer(true);
                            }
                          }
                        }}
                        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${hasSheetMusic ? 'hover:bg-primary/20 cursor-pointer text-primary' : 'text-muted-foreground'}`}
                      >
                        <Music className="h-5 w-5 shrink-0" />
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`truncate font-bold text-sm uppercase tracking-tight ${currentTrackIndex === globalIndex && currentTrack?.id === audio.id ? 'text-primary' : 'text-foreground'}`}>
                            {typeLabels[song.type]}
                          </p>
                          {isAudioCached && (
                            <div className="flex items-center gap-1 shrink-0" title="Disponível offline">
                              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className={`py-0 px-1.5 text-[10px] h-4 shrink-0 uppercase tracking-wider font-bold ${naipeColors[(audio.naipe || audio.name).toLowerCase()] || 'bg-primary/10 border-primary/20 text-primary'}`}>
                            {audio.naipe || audio.name}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadAudio(audio); }}>
                          <Download className="mr-2 h-4 w-4" /> Baixar Áudio
                        </DropdownMenuItem>
                        {hasSheetMusic && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadPdf(); }}>
                            <FileText className="mr-2 h-4 w-4" /> Baixar Partitura
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(audio); }}>
                          <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Card className="gradient-card border-border/50 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-muted p-4">
                <Music2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="mb-2 text-base font-semibold">Nenhum áudio disponível</h3>
            <p className="text-sm text-muted-foreground">
              Esta música não possui áudios cadastrados
            </p>
          </Card>
        )}
      </main>

      {showSheetViewer && (
        <SheetViewer 
          currentTrack={currentTrack || {
            id: 'dummy',
            songId: song.id,
            songName: song.name,
            songType: song.type,
            naipe: 'Partitura',
            url: '',
            sheetMusicUrl: song.sheet_music_pdf_url || song.sheet_music_url
          }} 
          isPlaying={isPlaying} 
          onPlayPause={togglePlay} 
          onNext={playNext} 
          onPrevious={playPrevious} 
          onClose={() => { 
            setShowSheetViewer(false); 
            setSheetMusicSrc(null); 
          }} 
          onTrackEnd={() => { 
            if (repeatMode === 'track' && audioRef.current) { 
              audioRef.current.currentTime = 0; 
              audioRef.current.play(); 
            } else {
              playNext(); 
            }
          }} 
          sheetMusicUrl={sheetMusicSrc || song.sheet_music_pdf_url || song.sheet_music_url || ''} 
          allTracks={tracks.length > 0 ? tracks : [{
            id: 'dummy',
            songId: song.id,
            songName: song.name,
            songType: song.type,
            naipe: 'Partitura',
            url: '',
            sheetMusicUrl: song.sheet_music_pdf_url || song.sheet_music_url
          }]} 
          currentTrackIndex={currentTrackIndex ?? 0} 
          onTrackSelect={index => tracks.length > 0 && playTrack(index)} 
          audioElement={audioRef.current} 
          currentTime={currentTime} 
          duration={duration} 
        />
      )}
    </div>
  );
};

export default SongDetails;
