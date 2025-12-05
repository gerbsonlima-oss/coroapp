import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Plus, Music, LogOut, Settings, ListMusic, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { InstallPWAButton } from '@/components/InstallPWAButton';

interface SongTypeAlbum {
  type: string;
  name: string;
  count: number;
}

interface SongListItem {
  id: string;
  name: string;
  type: string;
  typeName: string;
}

// Ordem litúrgica dos cantos na Santa Missa
const songTypeOrder = [
  'canto_entrada',
  'ato_penitencial',
  'gloria',
  'salmo',
  'aclamacao',
  'oferendas',
  'santo',
  'cordeiro',
  'comunhao',
  'acao_gracas',
  'final',
  'outro',
];

const typeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho',
  oferendas: 'Canto das Oferendas',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Canto de Ação de Graças',
  final: 'Canto Final',
  outro: 'Outros',
};

const typeGradients: Record<string, string> = {
  canto_entrada: 'from-blue-500 to-blue-700',
  ato_penitencial: 'from-purple-500 to-purple-700',
  gloria: 'from-amber-500 to-amber-700',
  salmo: 'from-green-500 to-green-700',
  aclamacao: 'from-yellow-500 to-yellow-700',
  oferendas: 'from-orange-500 to-orange-700',
  santo: 'from-red-500 to-red-700',
  cordeiro: 'from-pink-500 to-pink-700',
  comunhao: 'from-indigo-500 to-indigo-700',
  acao_gracas: 'from-teal-500 to-teal-700',
  final: 'from-cyan-500 to-cyan-700',
  outro: 'from-gray-500 to-gray-700',
};

const Songs = () => {
  const [songTypes, setSongTypes] = useState<SongTypeAlbum[]>([]);
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [groupByType, setGroupByType] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchSongTypes();
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchSongTypes = async () => {
    try {
      const [{ data: songTypesData, error: songTypesError }, { data: songsData, error: songsError }] =
        await Promise.all([
          supabase.from('song_types').select('id, slug, name, order_index').order('order_index'),
          supabase.from('songs').select('id, name, type'),
        ]);

      if (songTypesError) throw songTypesError;
      if (songsError) throw songsError;

      const typeCount = (songsData || []).reduce((acc: Record<string, number>, song) => {
        acc[song.type] = (acc[song.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const typeNameMap = new Map<string, string>();
      (songTypesData || []).forEach((type) => {
        typeNameMap.set(type.slug, type.name);
      });

      const albums: SongTypeAlbum[] = (songTypesData || []).map((type) => ({
        type: type.slug,
        name: type.name,
        count: typeCount[type.slug] || 0,
      }));

      const songsList: SongListItem[] = (songsData || []).map((song) => ({
        id: song.id,
        name: song.name,
        type: song.type,
        typeName: typeNameMap.get(song.type) || 'Outros',
      }));

      setSongTypes(albums);
      setSongs(songsList);
    } catch (error: any) {
      toast.error('Erro ao carregar biblioteca');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">Biblioteca</h1>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <InstallPWAButton size="icon" showText={false} />
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/songs/admin/types')}
                className="hover:bg-accent/80"
                title="Gerenciar tipos de música"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            {user && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="hover:bg-accent/80"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 shadow-subtle">
                <ListMusic className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  {songs.length === 0
                    ? 'Nenhuma música cadastrada'
                    : `${songs.length} ${songs.length === 1 ? 'música' : 'músicas'}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="group-by-type" className="text-xs md:text-sm text-muted-foreground">
                Agrupar por tipo
              </Label>
              <Switch
                id="group-by-type"
                checked={groupByType}
                onCheckedChange={setGroupByType}
              />
            </div>
          </div>

          {groupByType ? (
            <div className="space-y-6">
              {songTypes.map((album) => {
                const songsForType = songs.filter((song) => song.type === album.type);
                if (songsForType.length === 0) return null;

                return (
                  <section key={album.type} className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <h2 className="text-sm md:text-base font-semibold">
                        {album.name}
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs md:text-sm"
                        onClick={() => navigate(`/songs/type/${album.type}`)}
                      >
                        Ver todos
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {songsForType.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => navigate(`/songs/${song.id}`)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.98]"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="text-base font-medium line-clamp-1">
                              {song.name}
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Ver detalhes
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {songs
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((song) => (
                  <button
                    key={song.id}
                    onClick={() => navigate(`/songs/${song.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.98]"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-base font-medium line-clamp-1">
                        {song.name}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {song.typeName}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
            </div>
          )}

          {user && (
            <Button
              onClick={() => navigate('/songs/new')}
              className="mt-4 gradient-primary shadow-glow hover:shadow-glow/50 transition-all w-full md:w-auto"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Cadastrar Música
            </Button>
          )}
        </section>
      </main>
      <BottomNavigation />
    </div>
  );
};

export default Songs;