import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ArrowLeft, Music2, FileText, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
}

interface SongAudio {
  id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

const typeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial (Kyrie)',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho (Aleluia)',
  oferendas: 'Canto das Oferendas (Ofertório)',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Canto de Ação de Graças',
  final: 'Canto Final (ou de Envio)',
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

const SongDetails = () => {
  const { id } = useParams();
  const [song, setSong] = useState<Song | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSong();
  }, [id]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setSong(data);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!song) return null;

  return (
    <div className="min-h-screen bg-background pb-6">
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
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/songs/${id}/edit`)}
            >
              <Pencil className="h-5 w-5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="h-5 w-5" />
                </Button>
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
              onClick={() => window.open(song.sheet_music_url!, '_blank')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Visualizar Partitura
            </Button>
          </Card>
        )}

        {audios.length > 0 ? (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-base md:text-lg font-semibold">
              <Music2 className="h-5 w-5" />
              Áudios por Naipe
            </h2>
            {audios.map((audio) => (
              <AudioPlayer key={audio.id} src={audio.audio_url} naipe={audio.name} />
            ))}
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
    </div>
  );
};

export default SongDetails;
