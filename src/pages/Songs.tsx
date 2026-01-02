import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Plus, Music, LogOut, Settings, Search, X, Sparkles, Sliders, Filter, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupBy, setGroupBy] = useState<'tipo' | 'lista'>(() => {
    const saved = localStorage.getItem('songs_groupBy');
    return (saved === 'tipo' || saved === 'lista') ? saved : 'tipo';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { tenantId } = useTenant();

  useEffect(() => {
    localStorage.setItem('songs_groupBy', groupBy);
  }, [groupBy]);

  useEffect(() => {
    if (tenantId) {
      fetchSongTypes();
    }
    checkAdminStatus();
  }, [user, tenantId]);

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

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const fetchSongTypes = async () => {
    if (!tenantId) return;
    
    try {
      const [{ data: songTypesData, error: songTypesError }, { data: songsData, error: songsError }] =
        await Promise.all([
          supabase.from('song_types').select('id, slug, name, order_index').eq('tenant_id', tenantId).order('order_index'),
          supabase.from('songs').select('id, name, type').eq('tenant_id', tenantId),
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

  const filteredSongs = songs.filter(song => 
    song.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedType === null || song.type === selectedType)
  );

  const renderSongsContent = () => {
    if (filteredSongs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Music className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium mb-1">Nenhuma música encontrada</p>
          <p className="text-xs text-muted-foreground">
            {searchQuery ? 'Tente outro termo de busca' : 'Comece a adicionar músicas ao repertório'}
          </p>
        </div>
      );
    }

    if (groupBy === 'tipo') {
      return songTypes.map(type => {
        const typeGroupSongs = filteredSongs.filter(s => s.type === type.type).sort((a, b) => a.name.localeCompare(b.name));
        if (typeGroupSongs.length === 0) return null;

        const groupKey = `type:${type.type}`;
        const isCollapsed = Boolean(collapsedGroups[groupKey]);

        return (
          <div key={type.type}>
            <div className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card hover:shadow-elevated transition-all">
              <div 
                className="px-3 py-3.5 bg-gradient-to-r from-primary/8 to-transparent flex items-center justify-between cursor-pointer hover:from-primary/12 transition-all"
                onClick={e => {
                  e.stopPropagation();
                  toggleGroup(groupKey);
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    {type.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {typeGroupSongs.length} {typeGroupSongs.length === 1 ? 'música' : 'músicas'}
                  </span>
                </div>
                <ChevronDown className={`h-5 w-5 text-primary/70 transform transition-transform shrink-0 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
              </div>
              {!isCollapsed && (
                <div className="divide-y divide-primary/10">
                  {typeGroupSongs.map((song) => (
                    <Card
                      key={song.id}
                      className="group cursor-pointer border-0 rounded-none bg-transparent hover:bg-primary/5 transition-all"
                      onClick={() => navigate(`/songs/${song.id}`)}
                    >
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
                            {song.name}
                          </h3>
                        </div>
                        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Music className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }).filter(Boolean);
    }

    return (
      <div className="space-y-2">
        {filteredSongs
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((song) => (
            <Card
              key={song.id}
              className="group cursor-pointer border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => navigate(`/songs/${song.id}`)}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
                    {song.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {song.typeName}
                  </p>
                </div>
                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Music className="h-4 w-4 text-primary" />
                </div>
              </div>
            </Card>
          ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">Repertório</h1>
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

      <main className="mx-auto max-w-[1280px] px-3 py-3 md:px-6 md:py-6">
        <section className="space-y-6">
          {/* Search e Filtros */}
          <div className="space-y-2 border-b border-primary/15 bg-gradient-to-b from-primary/5 to-transparent px-0 pb-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar música..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full h-11 bg-secondary/50 border-primary/30 text-sm rounded-md shadow-subtle focus:shadow-glow focus:border-primary/60 transition-all" 
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowGroupModal(true)}
                className="flex-1 h-10 text-sm px-3 gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Sliders className="h-4 w-4" />
                <span>Agrupar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilterModal(true)}
                className="flex-1 h-10 text-sm px-3 gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Filter className="h-4 w-4" />
                <span>Filtrar</span>
              </Button>
            </div>
          </div>

          {/* Songs List */}
          <div className="space-y-2.5">
            {renderSongsContent()}
          </div>
        </section>
      </main>

      {/* Floating Action Button - Mobile */}
      {user && (
        <button
          onClick={() => navigate('/songs/new')}
          className="fixed bottom-24 right-4 z-20 md:hidden h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-glow hover:shadow-glow/50 transition-all active:scale-95 flex items-center justify-center text-white hover:scale-110 duration-200"
          title="Cadastrar Música"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Filter Modal */}
      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar Músicas</DialogTitle>
            <DialogDescription>Selecione um tipo de música para filtrar</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => {
                setSelectedType(null);
                setShowFilterModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                selectedType === null
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Todos ({songs.length})
            </button>
            {songTypes.map((type) => {
              const count = songs.filter(s => s.type === type.type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type.type}
                  onClick={() => {
                    setSelectedType(type.type);
                    setShowFilterModal(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                    selectedType === type.type
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  {type.name} ({count})
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Modal */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agrupar Músicas</DialogTitle>
            <DialogDescription>Escolha como exibir as músicas</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => {
                setGroupBy('tipo');
                setShowGroupModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                groupBy === 'tipo'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Agrupar por Tipo
            </button>
            <button
              onClick={() => {
                setGroupBy('lista');
                setShowGroupModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                groupBy === 'lista'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Lista Simples
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default Songs;